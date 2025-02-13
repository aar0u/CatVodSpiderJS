import { IncomingMessage, ServerResponse } from "http";

import { closeBrowser } from "../browser";

export const closeController = {
  handle(req: IncomingMessage, res: ServerResponse): void {
    try {
      closeBrowser();
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Browser closed successfully");
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error closing browser: ${err}`);
    }
  },
};
