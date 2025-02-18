import axios from "axios";
import * as cheerio from "cheerio";

import { BaseParser } from "./BaseParser";
import { CACHE_TTL, setCache } from "../cache/cache";
import { config } from "../config/config";
import { Playable } from "../models/Playable";
import { Vod } from "../models/Vod";
import { color, logError, normalizeUrl, retrieveSubtitle } from "../utils";

export class Parser123Anime implements BaseParser {
  private playable = new Playable();
  private isProcessing = false;

  constructor() {
    // bind `this` to can access properties
    this.handleResponse = this.handleResponse.bind(this);
  }

  async handleResponse(response, page, onSuccess, onFail) {
    try {
      const url = response.url().toLowerCase();
      if (!url.match(/\.(mp4|m3u8|vtt)/)) return false;

      console.log("(m3u8|vtt) ", url);

      if (url.endsWith("m3u8") && !this.isProcessing) {
        this.isProcessing = true;
        // immediately stop other handling
        page.off("response", this.handleResponse);

        const subUrl = await this.getSubUrl(page.url());
        if (subUrl) {
          this.playable.subs = [subUrl];
        }

        this.playable.url = url;
        console.log(`${color.success("Captured")} - ${url}`);

        this.isProcessing = false;
      } else if (url.endsWith(".vtt") && url.includes("eng")) {
        console.log(`${color.success("Subtitle")} - ${url}`);
        this.playable.subs = [url];
      }

      // if (this.playable.url && this.playable.subs) {
      if (this.playable.url && !page.isClosed()) {
        const { vod, episodes } = this.parse(await page.content());
        this.playable.vod = vod;
        this.playable.episodes = episodes;

        // details to be updated when accessing episode
        const detailPage = page.url().replace(/\/episode\/\d+\/?$/, "");
        const { url, ...playableWithoutUrl } = this.playable;
        void url;
        if (detailPage === page.url()) {
          setCache(detailPage + "/episode/001", this.playable, CACHE_TTL);
          setCache(detailPage, playableWithoutUrl);
        } else {
          setCache(normalizeUrl(page.url()), this.playable, CACHE_TTL);
          setCache(detailPage, playableWithoutUrl);
        }

        console.log(color.success("Response to client"));
        onSuccess(this.playable);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      logError(`Capturing - ${err.stack || err.message}`);
      onFail(err);
      return true;
    }
  }

  parse(html: string): { vod: Vod; episodes: string[] } {
    const $ = cheerio.load(html);

    const vod = new Vod();
    const desc = $("div.desc").first();
    if (desc.length > 0) {
      vod.vodContent = desc
        .text()
        .replace(/\t/g, " ")
        .replace(/\s{2,}/g, " ") // 将多个连续空格替换为单个空格
        .replace(/More$/, "") // 去掉末尾的 "More"
        .trim();
    }

    const metaItems = $("dl.meta > dt");
    metaItems.each((_, dt) => {
      const key = $(dt).text().replace(":", "").trim();
      const dd = $(dt).next();

      if (dd.length > 0 && dd.prop("tagName") === "DD") {
        let value = dd
          .find("a")
          .map((_, a) => $(a).text())
          .get()
          .join(", ");

        if (!value) {
          value = dd.text().trim();
        }

        switch (key) {
          case "Type":
            vod.typeName = value;
            break;
          case "Country":
            vod.vodArea = value;
            break;
          case "Released":
            vod.vodYear = value;
            break;
          case "Status":
            vod.vodRemarks = value;
            break;
          case "Genre":
            vod.vodTag = value;
            break;
        }
      }
    });

    const episodes = [
      ...new Set(
        $(".episodes.range a[data-base]")
          .get()
          .map((el) => $(el).attr("data-base")?.padStart(3, "0") ?? ""),
      ),
    ].sort((a, b) => parseInt(a) - parseInt(b));

    return { vod, episodes };
  }

  private extractInfo(url: string): {
    name: string | null;
    episode: number;
  } {
    const parts = url.split("/");
    const animeIndex = parts.indexOf("anime");

    // Extract animeSlug
    const name =
      animeIndex !== -1 && animeIndex + 1 < parts.length
        ? parts[animeIndex + 1]
        : null;

    // Extract episodeNumber
    const trailingPart = parts.pop();
    let episode = 1; // Default value
    if (trailingPart && !isNaN(Number(trailingPart))) {
      episode = parseInt(trailingPart.replace(/^0+/, ""), 10);
    }

    return { name: name, episode: episode };
  }

  private async getSubUrl(url: string): Promise<string | null> {
    const { name, episode } = this.extractInfo(url);

    if (!name) {
      console.log("Invalid anime URL");
      return null;
    }

    const subs = (
      await axios.get(`http://localhost:${config.port}/json/livecfg/sub.json`)
    ).data;

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
  }
}
