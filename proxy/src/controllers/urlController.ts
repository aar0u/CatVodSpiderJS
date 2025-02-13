import { IncomingMessage, ServerResponse } from "http";

import browser from "../browser";
import { CACHE, CACHE_TTL } from "../cache/cache";
import { parserFactory } from "../parsers/parserFactory";

export const urlController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    if (!req.url || !req.headers.host) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid request" }));
      return;
    }

    const fullPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    const targetUrl = decodeURIComponent(fullPath.split("/url/")[1]);

    res.setHeader("Content-Type", "application/json");

    if (!targetUrl) {
      res.end(JSON.stringify({ error: "Missing url parameter" }));
      return;
    }

    const cached = CACHE[targetUrl];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for ${targetUrl}`);
      res.end(JSON.stringify(cached.item));
      return;
    }

    try {
      const parser = parserFactory.createParser(targetUrl);
      let isCompleted = false; // 添加状态锁防止多次 resolve

      const onSuccess = (data) => {
        if (isCompleted) return;
        isCompleted = true;

        CACHE[targetUrl] = {
          item: data,
          timestamp: Date.now(),
        };
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
