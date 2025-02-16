import { IncomingMessage, ServerResponse } from "http";

import AdmZip from "adm-zip";
import axios from "axios";

import { getProtocolAndHost } from "../utils/urlUtils";

export const subController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    const fullPath = new URL(req.url, getProtocolAndHost(req)).pathname;
    const targetUrl = decodeURIComponent(fullPath.split("/sub/")[1]);

    console.log(`Retrieving ${targetUrl}`);
    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
    });

    const zip = new AdmZip(response.data);
    const zipEntries = zip.getEntries();

    // Find the first .srt file
    const srtEntry = zipEntries.find((entry) =>
      entry.entryName.endsWith(".srt"),
    );
    if (srtEntry) {
      console.log(`Found ${srtEntry.entryName}`);
      const srtContent = srtEntry.getData().toString("utf8");
      res.setHeader("Content-Type", "text/plain");
      res.end(srtContent);
    } else {
      res.statusCode = 404;
      res.end("No .srt file found in the ZIP");
    }
  },
};
