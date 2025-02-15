import * as cheerio from "cheerio";

import { BaseParser } from "./BaseParser";
import { Playable } from "../models/Playable";
import { Vod } from "../models/Vod";

export class Parser123Anime implements BaseParser {
  private playable = new Playable();

  handleResponse = async (response, page, onSuccess, onFail) => {
    try {
      const url = response.url().toLowerCase();
      if (!url.match(/\.(mp4|m3u8|vtt)/)) return false;

      console.log("(m3u8|vtt) ", url);

      if (url.endsWith("m3u8") && !this.playable.url) {
        console.log(`### Captured - ${url}`);
        this.playable.url = url;
      } else if (url.endsWith(".vtt") && url.includes("eng")) {
        console.log(`### Subtitle - ${url}`);
        this.playable.subs = [url];
      }

      // if (this.playable.url && this.playable.subs) {
      if (this.playable.url) {
        const { vod, episodes } = this.parse(await page.content());
        this.playable.vod = vod;
        this.playable.episodes = episodes;
        console.log("### Response back to client");
        onSuccess(this.playable);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(`Error on capturing: ${error}`);
      onFail(error);
      return true;
    }
  };

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
}
