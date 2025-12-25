import "./logger";
import { createServer } from "http";

import { config } from "./config/config";
import { dumpController } from "./controllers/dumpController";
import { fileController } from "./controllers/fileController";
import { jsonController } from "./controllers/jsonController";
import { urlController } from "./controllers/urlController";
import { getOrigin } from "./utils";

const routes = {
  "/js/*": fileController("../../../js").handle,
  "/lib/*": fileController("../../../lib").handle,
  "/json/*": fileController("../../../json").handle,
  "/url/*": urlController.handle,
  "/sub/rec": dumpController.receive,
  "/sub/*": dumpController.handle,
  "/": jsonController.handle,
  "/*": fileController("../../static").handle,
};

const server = createServer(async (req, res) => {
  if (!req.url || !req.headers.host) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid request");
    return;
  }

  const route = new URL(req.url, getOrigin(req)).pathname;

  let handler = routes[route];
  if (!handler) {
    handler = Object.entries(routes).find(([path]) => {
      if (path.endsWith("*")) {
        const base = path.slice(0, -1);
        return route.startsWith(base);
      }
      return false;
    })?.[1];
  }

  if (handler) {
    await handler(req, res);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

server.listen(config.port, () => {
  console.log(`Server running at http://0.0.0.0:${config.port}`);
});
