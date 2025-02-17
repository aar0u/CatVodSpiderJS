import { IncomingMessage, ServerResponse } from "http";

import browser from "../browser";
import { getCache } from "../cache/cache";
import { BaseParser } from "../parsers/BaseParser";
import { parserFactory } from "../parsers/parserFactory";
import { color, getOrigin, normalizeUrl } from "../utils";

export const urlController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    const fullPath = new URL(req.url, getOrigin(req)).pathname;
    const targetUrl = decodeURIComponent(fullPath.split("/url/")[1]);

    res.setHeader("Content-Type", "application/json");

    if (!targetUrl) {
      res.end(JSON.stringify({ error: "Missing url parameter" }));
      return;
    }

    const cached = await getCache(normalizeUrl(targetUrl));
    if (cached) {
      console.log(`Serving ${color.info("cached")} for ${targetUrl}`);
      res.end(JSON.stringify(cached.item));
      return;
    }

    try {
      const parser: BaseParser = parserFactory.createParser(targetUrl);
      console.log(`Using handler: ${parser.constructor.name}.handleResponse`);

      let isCompleted = false; // 添加状态锁防止多次 resolve

      const onSuccess = (data) => {
        if (isCompleted) return;
        isCompleted = true;

        res.end(JSON.stringify(data));
      };

      const onFail = (err) => {
        if (isCompleted) return;
        isCompleted = true;

        res.end(
          JSON.stringify({ error: err instanceof Error ? err.message : err }),
        );
      };

      await browser(targetUrl, parser.handleResponse, onSuccess, onFail);
    } catch (err) {
      console.error(`Error on urlController: ${err}`);
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Unknown error",
        }),
      );
    }
  },
};
