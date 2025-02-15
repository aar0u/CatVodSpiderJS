import { createServer } from "http";

import { closeController } from "./controllers/closeController";
import { jsonController } from "./controllers/jsonController";
import { urlController } from "./controllers/urlController";

const routes = {
  "/url/": urlController.handle,
  "/closebrowser": closeController.handle,
  "/json": jsonController.handle,
};

const server = createServer(async (req, res) => {
  if (!req.url || !req.headers.host) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid request");
    return;
  }

  const route = new URL(req.url, `http://${req.headers.host}`).pathname;

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

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
