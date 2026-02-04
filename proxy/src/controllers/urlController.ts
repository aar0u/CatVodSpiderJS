import { IncomingMessage, ServerResponse } from "http";

import browser from "../browser";
import { BaseParser } from "../parsers/BaseParser";
import { parserFactory } from "../parsers/parserFactory";
import { getOrigin } from "../utils";
import { color } from "../utils/color";

export const urlController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url, getOrigin(req));
    const selector = url.searchParams.get("flag");
    // Remove flag parameter from search string if it exists
    url.searchParams.delete("flag");
    const fullPath = url.pathname + url.search;
    const targetUrl = decodeURIComponent(fullPath.split("/url/")[1]);

    console.log(`[URL] ${fullPath.toString()}, ${targetUrl}, ${selector}`);

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    if (!targetUrl) {
      res.end(JSON.stringify({ error: "Missing url parameter" }));
      return;
    }

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

      await browser(targetUrl, selector, parser, onSuccess, onFail);
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
