import fs from "fs/promises";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { fileURLToPath } from "url";

import axios from "axios";
import * as cheerio from "cheerio";

import { getCache } from "../cache/cache";
import { color, getOrigin, normalizeUrl } from "../utils";
import { retrieveSubtitle } from "../utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  async fetch(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url, getOrigin(req));
    const name = url.searchParams.get("name");
    const upto = url.searchParams.get("upto");

    // Return immediately to browser
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: `processing ${name} ${upto}` }));

    // Start background task
    (async () => {
      try {
        console.log("Starting background task for:", name);
        for (let i = 1; i <= Number(upto); i++) {
          const subId = `${name}-${i}.srt`;
          const cached = await getCache(normalizeUrl(subId));
          if (cached) {
            console.log(`already cached ${color.info("cached")} for ${subId}`);
            continue;
          }
          console.log(`Processing episode ${i}`);
          const url = await subController.getSubUrl(name, i);
          console.log(`Subtitle for ${name} - ${i} is ${url}`);
        }
      } catch (error) {
        console.error("Background task failed:", error);
      }
    })().catch(console.error);
  },
  async getSubUrl(name, episode): Promise<string | null> {
    if (!name) {
      console.log("Invalid anime URL");
      return null;
    }

    const subs = JSON.parse(
      await fs.readFile(path.join(__dirname, "../config/sub.json"), "utf-8"),
    );

    if (!subs[name]) {
      console.log(`No subtitle URL found for ${name}`);
      return null;
    }

    const subtitleUrl = subs[name];
    console.log(`Find subtitle for ${name} - ${episode} at ${subtitleUrl}`);

    try {
      const response = await axios.get(subtitleUrl);
      const $ = cheerio.load(response.data);

      // Find the row corresponding to the episode number
      const episodeRow = $(`tr:has(td:contains("${episode}."))`);
      if (episodeRow.length > 0) {
        // Extract the download link for the specific episode
        const downloadLink = episodeRow
          .find('a[href*="/download/"]')
          .attr("href");
        if (downloadLink) {
          const baseUrl = new URL(subtitleUrl).origin;
          const fullDownloadUrl = `${baseUrl}${downloadLink}`;
          console.log(`Zip file for Episode ${episode} - ${fullDownloadUrl}`);

          const subId = await retrieveSubtitle(name, episode, fullDownloadUrl);

          return `/sub/${subId}`;
        } else {
          console.error(`No download link found for episode ${episode}`);
        }
      } else {
        console.error(`Episode ${episode} not found`);
      }
    } catch (error) {
      console.error(`Error scraping: ${error}`);
    }
    return null;
  },
};
