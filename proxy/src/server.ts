import { createServer } from "http";

import { closeController } from "./controllers/closeController";
import { urlController } from "./controllers/urlController";

const server = createServer(async (req, res) => {
  if (!req.url || !req.headers.host) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid request");
    return;
  }

  const route = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (route.startsWith("/url/")) {
    await urlController.handle(req, res);
  } else if (route === "/closebrowser") {
    closeController.handle(req, res);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
