import { Spider } from "./core_spider.js";
import { _, load } from "./catvod-assets/js/lib/cat.js";
import { VodDetail } from "../lib/vod.js";
import * as Utils from "../lib/utils.js";

import { JadeLogging } from "../lib/log.js";
const jadeLog = new JadeLogging(Utils.getCurrentFileName(), "DEBUG");

class ABC extends Spider {
  PROXY_URL = "http://192.168.31.171";
  DOMAIN = "https://123animehub.cc";

  async homeContent(filter) {
    jadeLog.info("homeContent params: filter=" + filter);

    this.classes = [
      { type_id: "/home", type_name: "Trending" },
      { type_id: "/chinese-anime", type_name: "Chinese" },
      { type_id: "/japanese-anime", type_name: "Japanese" },
      { type_id: "/genere/Sports", type_name: "Sports" },
      { type_id: "/genere/Action", type_name: "Action" },
    ];

    this.filterObj = {
      "/home": [
        {
          key: "language[]",
          name: "配音",
          value: [
            { n: "配音版", v: "d" },
            { n: "字幕版", v: "s" },
          ],
        },
        {
          key: "country[]",
          name: "国家",
          value: [
            { n: "中国", v: "c" },
            { n: "日本", v: "j" },
          ],
        },
      ],
    };

    const vodList = [
      {
        vod_id: "/anime/pokemon-2023-dub",
        vod_name: "Pokemon (2023)",
        vod_pic: "https://123animehub.cc/imgs/poster/pokemon-2023-dub.jpg",
        vod_remarks: "Dear Boy",
      },
      {
        vod_id: "/anime/one-piece-dub",
        vod_name: "One Piece",
        vod_pic: "https://123animehub.cc/imgs/poster/one-piece.jpg",
        vod_remarks: "Sweet Girl",
      },
    ];

    const output = this.result.home(this.classes, vodList, this.filterObj);
    jadeLog.info(`output: ${output}`);
    return output;
  }

  async categoryContent(tid, pg, filter, extend) {
    jadeLog.info(
      `categoryContent params: tid=${tid}, pg=${pg}, filter=${filter}, extend=${JSON.stringify(
        extend
      )}`
    );

    // Determine URL based on whether filters are present
    const url =
      Object.keys(extend).length === 0
        ? this.DOMAIN + tid
        : `${this.DOMAIN}/filter?${Object.entries(extend)
            .map(([key, value]) => `${key}=${value}`)
            .join("&")}`;

    let $ = await this.getHtml(url);
    const vodList = this.getVods($);
    jadeLog.info(
      `Fetching URL: ${url}, ${vodList.length} items for category: ${tid}`
    );
    return this.result.category(vodList, pg, 1, 0, vodList.length);
  }

  async searchContent(key, quick) {
    jadeLog.info(`searchContent params: key=${key}, quick=${quick}`);
    return super.search(key, quick);
  }

  async detailContent(ids) {
    jadeLog.info(`detailContent params: ids=${ids}`);

    const url = `${this.PROXY_URL}/url/${this.DOMAIN}${ids}`;
    try {
      const res = await req(url, { method: "get", timeout: 15000 });
      const json = JSON.parse(res.content);
      const $ = load(json.html);

      const vodDetail = new VodDetail();
      vodDetail.vod_id = ids[0];

      // Get poster image from meta tag
      const ogImage = $('meta[property="og:image"]').attr("content");
      vodDetail.vod_pic = ogImage || "";

      // Get description
      const desc = $("div.desc").first();
      if (desc.length > 0) {
        vodDetail.vod_content = desc
          .text()
          .replace(/\t/g, " ")
          .replace(/\s{2,}/g, " ")
          .replace(/More$/, "")
          .trim();
      }

      // Process metadata
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
              vodDetail.type_name = value;
              break;
            case "Country":
              vodDetail.vod_area = value;
              break;
            case "Released":
              vodDetail.vod_year = value;
              break;
            case "Status":
              vodDetail.vod_remarks = value;
              break;
            case "Genre":
              vodDetail.vod_tag = value;
              break;
          }
        }
      });

      const playFromList = [];
      const playUrlsList = [];

      const episodes = [];
      $(".episodes.range a[data-base]").each((_, ep) => {
        const $ep = $(ep);
        const epNumber = $ep.attr("data-base");
        const epUrl = $ep.attr("href");
        if (epUrl) {
          episodes.push(`${epNumber}$${epUrl}`);
        }
      });

      playFromList.push("Default$$$");
      playUrlsList.push(episodes.join("#") + "$$$");

      vodDetail.vod_play_from = playFromList.join("");
      vodDetail.vod_play_url = playUrlsList.join("");

      this.vodDetail = vodDetail;
    } catch (e) {
      jadeLog.info(
        `Error in detailContent: ${
          e instanceof SyntaxError ? "Invalid JSON response" : e.message
        }`
      );
      return "";
    }

    const output = this.result.detail(this.vodDetail);
    jadeLog.info(`output: ${output}`);
    return output;
  }

  async playerContent(flag, id, vipFlags) {
    const matches = id.match(/\/anime\/(.*?)\/episode\/(\d+)/);
    const animeName = matches ? matches[1] : "";
    const episodeNumber = matches ? matches[2] : "";
    jadeLog.info(
      `playerContent params: flag=${flag}, id=${id}, vipFlags=${vipFlags}, parsed: anime=${animeName}, episode=${episodeNumber}`
    );
    const url = `${this.PROXY_URL}/url/${this.DOMAIN}${id}?flag=span.tip.tab[data-name="10"]`;
    try {
      const res = await req(url, { method: "get", timeout: 15000 });
      const json = JSON.parse(res.content);
      this.result.setSubs([
        {
          name: "sub",
          format: "application/x-subrip",
          url: `${this.PROXY_URL}/sub/${animeName}-${episodeNumber}.srt`,
        },
      ]);
      let headers = this.getHeader();
      headers["Referer"] = "https://play.bunnycdn.to/";
      this.result.header = headers;
      return this.result.play(json.url);
    } catch (e) {
      jadeLog.info(e.stack);
    }
    return this.result.play("");
  }

  async setSearch(key, quick, pg) {
    const cheerio = await this.getHtml(this.DOMAIN + "/search?keyword=" + key);
    this.vodList = this.getVods(cheerio);
  }

  getVods($) {
    const vods = [];

    $("div.item:has(a[href^='/anime/'][data-jtitle])").each((_, item) => {
      const $item = $(item);
      const a = $item.find("a[href^='/anime/']");

      const title =
        a.data("jtitle") || $item.find("img.lazyload").attr("alt") || "";
      const img = $item.find("img.lazyload");
      const pic = img.length ? img.data("src") || img.attr("src") : "";
      const ep = $item.find("div.ep").text().trim() || "";
      const sub = $item.find("span.sub").text() || "";

      vods.push({
        vod_id: a.attr("href"),
        vod_name: title,
        vod_pic: this.DOMAIN + pic,
        vod_remarks: `${ep} ${sub}`,
      });
    });

    return vods;
  }
}

let spider = new ABC();

async function init(cfg) {
  await spider.init(cfg);
}

async function home(filter) {
  return await spider.homeContent(filter);
}

async function homeVod() {
  return await spider.homeVod();
}

async function category(tid, pg, filter, extend) {
  return await spider.categoryContent(tid, pg, filter, extend);
}

async function detail(id) {
  return await spider.detailContent([id]);
}

async function play(flag, id, flags) {
  return await spider.playerContent(flag, id, flags);
}

async function search(wd, quick) {
  return await spider.searchContent(wd, quick);
}

export function __jsEvalReturn() {
  return {
    init,
    home,
    category,
    detail,
    play,
    search,
  };
}

export { spider, ABC };
