import { Spider } from "./core_spider.js";
import { _, load } from "./catvod-assets/js/lib/cat.js";
import * as Utils from "../lib/utils.js";
import { VodDetail } from "../lib/vod.js";

class ABC extends Spider {
  PROXY_URL = "http://192.168.31.171";
  DOMAIN = "https://123animehub.cc";

  async homeContent(filter) {
    Utils.log("homeContent params: filter=" + filter);
    return super.home(filter);
  }

  async categoryContent(tid, pg, filter, extend) {
    Utils.log(
      `categoryContent params: tid=${tid}, pg=${pg}, filter=${filter}, extend=${extend}
      }`
    );
    return super.category(tid, pg, filter, extend);
  }

  async searchContent(key, quick) {
    Utils.log(`searchContent params: key=${key}, quick=${quick}`);
    return super.search(key, quick);
  }

  async detailContent(ids) {
    Utils.log(`detailContent params: ids=${ids}`);

    const url = `${this.PROXY_URL}/url/${this.DOMAIN}${ids}`;
    try {
      const res = await req(url, { method: "get", timeout: 25000 });
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
      Utils.log(`Error in detailContent: ${e.stack}`);
    }

    const output = this.result.detail(this.vodDetail);
    Utils.log(`output: ${output}`);
    return output;
  }

  async playerContent(flag, id, vipFlags) {
    const matches = id.match(/\/anime\/(.*?)\/episode\/(\d+)/);
    const animeName = matches ? matches[1] : "";
    const episodeNumber = matches ? matches[2] : "";
    Utils.log(
      `playerContent params: flag=${flag}, id=${id}, vipFlags=${vipFlags}, parsed: anime=${animeName}, episode=${episodeNumber}`
    );
    const url = `${this.PROXY_URL}/url/${this.DOMAIN}${id}?flag=span.tip.tab[data-name="10"]`;
    try {
      const res = await req(url, { method: "get", timeout: 25000 });
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
      Utils.log(e.stack);
    }
    return this.result.play("");
  }

  async setHome(filter) {
    Utils.log(`#### setHome called from super.home`);
    this.classes = [
      { type_id: "/genere/Sports", type_name: "Sports" },
      { type_id: "/genere/Action", type_name: "Action" },
    ];
    const vodDetail = new VodDetail();
    vodDetail.load_data({
      vod_id: "/anime/pokemon-2023-dub",
      vod_name: "Pokemon (2023)",
      vod_pic: "https://123animehub.cc/imgs/poster/pokemon-2023-dub.jpg",
      vod_remarks: "Dear Boy",
    });
    const vodDetail1 = new VodDetail();
    vodDetail1.load_data({
      vod_id: "/anime/one-piece-dub",
      vod_name: "One Piece",
      vod_pic: "https://123animehub.cc/imgs/poster/one-piece.jpg",
      vod_remarks: "Sweet Girl",
    });
    this.vodList = [vodDetail, vodDetail1];
    this.filterObj = {};
  }

  async setCategory(tid, pg, filter, extend) {
    const cheerio = await this.getHtml(this.DOMAIN + tid);
    this.vodList = this.getVods(cheerio);
  }

  async setSearch(key, quick, pg) {
    const cheerio = await this.getHtml(this.DOMAIN + "/search?keyword=" + key);
    this.vodList = this.getVods(cheerio);
  }

  getVods($) {
    const vods = [];

    // 使用 Cheerio 的方法遍历
    $("div.item").each((_, item) => {
      const a = $(item).find("a[href^='/anime/']");
      if (!a.length) return;

      const title =
        a.data("jtitle") || $(item).find("img.lazyload").attr("alt") || "";
      const img = $(item).find("img.lazyload");
      const pic = img.length ? img.data("src") || img.attr("src") : "";
      const ep = $(item).find("div.ep").text().trim() || "";
      const sub = $(item).find("span.sub").text() || "";

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
