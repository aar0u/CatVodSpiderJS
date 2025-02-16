import { Spider } from "./spider.js";
import { _ } from "../lib/cat.js";
import * as Utils from "../lib/utils.js";
import { VodDetail } from "../lib/vod.js";

class ABC extends Spider {
  PROXY_URL = "http://192.168.31.171:3000/url/";
  SUB_URL = "http://192.168.31.171:3000/sub/";
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
    return super.detail(ids[0]);
  }

  async playerContent(flag, id, vipFlags) {
    Utils.log(
      `playerContent params: flag=${flag}, id=${id}, vipFlags=${vipFlags}`
    );
    return super.play(flag, id, vipFlags);
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

  async setDetail(showName) {
    const url = this.PROXY_URL + this.DOMAIN + showName;

    try {
      const res = await req(url, { method: "get" });
      const json = JSON.parse(res);

      const episodes = json.episodes;
      const total = episodes.length;
      let playUrl = `001$${showName}#`;

      for (let i = 1; i < total; i++) {
        const episode = episodes[i];
        playUrl += `${episode}$${showName}/episode/${episode}`;
        playUrl += i < total - 1 ? "#" : "$$$";
      }

      json.vod.vod_play_from = `${this.constructor.name}$$$`;
      json.vod.vod_play_url = playUrl;

      let vodDetail = new VodDetail();
      vodDetail.load_data(json.vod);

      this.vodDetail = vodDetail;
    } catch (e) {
      Utils.log(e.stack);
    }
  }

  async setPlay(flag, id, vipFlags) {
    Utils.log(`#### setPlay called from super.play`);
    const url = this.PROXY_URL + this.DOMAIN + id;
    try {
      const res = await req(url, { method: "get" });
      const json = JSON.parse(res);

      if (json.subs) {
        // Spider class don't have sub method, directly set to result
        this.result.setSubs([
          {
            name: "sub",
            format: "application/x-subrip",
            url: this.SUB_URL + json.subs[0],
          },
        ]);
      }

      this.playUrl = json.url;
    } catch (e) {
      Utils.log(e.stack);
    }
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
