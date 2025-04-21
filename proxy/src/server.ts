import { createServer } from "http";

import { config } from "./config/config";
import { fileController } from "./controllers/fileController";
import { jsonController } from "./controllers/jsonController";
import { subController } from "./controllers/subController";
import { urlController } from "./controllers/urlController";
import { getOrigin } from "./utils";

const routes = {
  "/js/": fileController("../../../js").handle,
  "/lib/": fileController("../../../lib").handle,
  "/json/": fileController("../../../json").handle,
  "/url/": urlController.handle,
  "/sub/fetch": subController.fetch,
  "/sub/": subController.handle,
  "/json": jsonController.handle,
  "/": jsonController.handle,
};

const server = createServer(async (req, res) => {
  if (!req.url || !req.headers.host) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid request");
    return;
  }

  const route = new URL(req.url, getOrigin(req)).pathname;

  const handler = Object.entries(routes).find(
    ([path]) => route.startsWith(path) || route === path,
  )?.[1];

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
