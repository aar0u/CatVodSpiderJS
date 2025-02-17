import { IncomingMessage, ServerResponse } from "http";

import AdmZip from "adm-zip";
import axios from "axios";

import { getCache, setCache } from "../cache/cache";
import { color, getOrigin, normalizeUrl } from "../utils";

export const subController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    const fullPath = new URL(req.url, getOrigin(req)).pathname;
    const targetUrl = decodeURIComponent(fullPath.split("/sub/")[1]);

    const cached = await getCache(normalizeUrl(targetUrl));
    if (cached) {
      console.log(`Serving ${color.info("cached")} for ${targetUrl}`);
      res.setHeader("Content-Type", "text/plain");
      return res.end(cached.item);
    }

    console.log(`Retrieving ${targetUrl}`);
    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Chrome/120.0.0.0",
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

      // Cache the content
      setCache(normalizeUrl(targetUrl), srtContent);

      res.setHeader("Content-Type", "text/plain");
      res.end(srtContent);
    } else {
      res.statusCode = 404;
      res.end("No .srt file found in the ZIP");
    }
  },
};
