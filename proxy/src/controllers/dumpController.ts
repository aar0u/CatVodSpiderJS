import { IncomingMessage, ServerResponse } from "http";

let cacheContent: Buffer | null = null;
const MAX_SUBTITLE_SIZE = 10 * 1024 * 1024; // 10MB limit

export const dumpController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    if (req.method === "POST") {
      return dumpController.receive(req, res);
    }

    if (!cacheContent) {
      res.statusCode = 404;
      console.log(`Cache is empty`);
      res.end("Not found");
      return;
    }

    res.setHeader("Content-Type", "text/plain");
    console.log(
      `${req.method}: ${req.url}, Headers: ${JSON.stringify(req.headers)}`,
    );
    res.end(cacheContent);
  },
  async receive(req: IncomingMessage, res: ServerResponse) {
    const fileName = req.headers["x-file-name"];

    if (!fileName) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing X-File-Name header" }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const content = Buffer.concat(chunks);
      const decodedFileName = decodeURIComponent(fileName as string);

      if (content.length > MAX_SUBTITLE_SIZE) {
        console.error(`Uploaded file too large: ${content.length} bytes`);
        res.statusCode = 413;
        res.end("File too large");
        return;
      }

      cacheContent = content;

      console.log(`Stored cache: ${decodedFileName} (${content.length} bytes)`);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end(decodedFileName);
    });

    req.on("error", (err) => {
      console.error(`Error receiving data: ${err}`);
      res.statusCode = 500;
      res.end("Error processing request");
    });
  },
};
