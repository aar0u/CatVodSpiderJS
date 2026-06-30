import { createReadStream, existsSync, statSync, unlinkSync } from "fs";
import { IncomingMessage, ServerResponse } from "http";
import { tmpdir } from "os";
import path from "path";

import mime from "mime-types";

import browser from "../browser";
import { BaseParser } from "../parsers/BaseParser";
import { parserFactory } from "../parsers/parserFactory";
import { getOrigin } from "../utils";
import { color } from "../utils/color";

import type { Download } from "playwright";

const DOWNLOAD_WAIT_MS = 2000;

async function handleRawMode(targetUrl: string, res: ServerResponse) {
  const { getBrowser } = await import("../browser");
  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    let downloadEvent: Download | null = null;
    page.on("download", (dl) => {
      console.log(
        `${color.success("[URL] Raw")} Download triggered: ${dl.suggestedFilename()}`,
      );
      downloadEvent = dl;
    });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60 * 1000,
    });

    const download = await waitForDownload(page, downloadEvent);

    if (download) {
      await pipeDownload(download, res);
    } else {
      const html = await page.content();
      console.log(`${color.success("[URL] Raw HTML")} length=${html.length}`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    }
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

function waitForDownload(
  page: import("playwright").Page,
  existingEvent: Download | null,
): Promise<Download | null> {
  if (existingEvent) return Promise.resolve(existingEvent);

  return new Promise<Download | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), DOWNLOAD_WAIT_MS);
    page.on("download", (dl) => {
      clearTimeout(timer);
      resolve(dl);
    });
  });
}

async function pipeDownload(download: Download, res: ServerResponse) {
  const suggestedName = download.suggestedFilename();
  const tmpPath = path.join(tmpdir(), `raw-${Date.now()}-${suggestedName}`);
  await download.saveAs(tmpPath);

  const fileSize = existsSync(tmpPath) ? statSync(tmpPath).size : 0;
  console.log(
    `${color.success("[URL] Raw Download")} saved=${tmpPath}, size=${fileSize}`,
  );

  const contentType = mime.lookup(suggestedName) || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(suggestedName)}"`,
  );

  const cleanup = () => {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
  };

  const stream = createReadStream(tmpPath);
  stream.pipe(res);
  stream.on("end", cleanup);
  stream.on("error", () => {
    cleanup();
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Stream error");
    }
  });
}

export const urlController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url, getOrigin(req));
    const targetUrl = url.searchParams.get("url") || "";
    const selectors = url.searchParams.getAll("click");
    const raw = url.searchParams.get("raw");

    console.log(
      `[URL] ${url.pathname}, ${targetUrl}, ${selectors.join(" -> ")}, raw=${raw}`,
    );

    if (!targetUrl) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Missing url parameter" }));
      return;
    }

    if (raw === "1" || raw === "true") {
      try {
        await handleRawMode(targetUrl, res);
      } catch (err) {
        console.error(`${color.danger("[URL] Raw")} Error: ${err}`);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : "Unknown error",
          }),
        );
      }
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    try {
      const parser: BaseParser = parserFactory.createParser(targetUrl);

      let isCompleted = false; // 添加状态锁防止多次 resolve

      const onSuccess = (data) => {
        const logMsg = JSON.stringify({ ...data, html: "[omitted]" });
        console.log(
          `${color.success("[URL] Response")} (ignored: ${isCompleted}) - ${logMsg}`,
        );

        if (isCompleted) return;
        isCompleted = true;

        res.end(JSON.stringify(data));
      };

      const onFail = (err) => {
        const logMsg = err instanceof Error ? err.message : err;
        console.log(
          `${color.danger("[URL] Error")} (ignored: ${isCompleted}) - ${logMsg}`,
        );

        if (isCompleted) return;
        isCompleted = true;
        res.end(JSON.stringify({ error: logMsg }));
      };

      await browser(targetUrl, selectors, parser, onSuccess, onFail);
    } catch (err) {
      console.error(`${color.danger("[URL]")} Error: ${err}`);
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Unknown error",
        }),
      );
    }
  },
};
