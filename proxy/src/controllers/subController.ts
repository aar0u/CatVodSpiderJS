import { IncomingMessage, ServerResponse } from "http";

import { getCache } from "../cache/cache";
import { color, getOrigin, normalizeUrl } from "../utils";

export const subController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    const fullPath = new URL(req.url, getOrigin(req)).pathname;
    const subId = decodeURIComponent(fullPath.split("/sub/")[1]);

    console.log(`Get subtitle for ${color.info(subId)}`);

    const cached = await getCache(normalizeUrl(subId));
    if (cached) {
      res.setHeader("Content-Type", "text/plain");
      return res.end(cached.item);
    } else {
      res.statusCode = 404;
      res.end("No found");
    }
  },
};
