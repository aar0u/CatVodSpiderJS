/**
 * YHDM Spider for CatVodSpiderJS
 * 
 * Reference documentation:
 * - Java implementation: https://github.com/FongMi/TV/blob/b67af3c691f1cff410cb692cb7802e31289ac195/quickjs/src/main/java/com/fongmi/quickjs/crawler/Spider.java#L160
 * - JavaScript libraries: https://github.com/FongMi/TV/blob/release/quickjs/src/main/assets/js/lib/
 * 
 * The Spider.java file shows how JavaScript spiders are loaded and executed.
 * The js/lib directory contains the base Spider class and HTTP utilities.
 */

import { _ } from "./catvod-assets/js/lib/cat.js";
import { Spider } from "./core_spider.js";
import { spider as mxanime } from "./mxanime.js";
import * as Utils from "../lib/utils.js";
import { VodDetail } from "../lib/vod.js";

class ABC extends Spider {
  DOMAIN = "https://www.dmla7.com";

  async homeContent(filter) {
    Utils.log("homeContent params: filter=" + filter);
    this.classes = [];
    const vod1 = new VodDetail();
    vod1.load_data({
      vod_id: "/video/7544.html",
      vod_name: "斗破苍穹年番",
      vod_pic:
        "https://images.weserv.nl/?url=https://lz.sinaimg.cn/large/006sgDP3gy1h3h22896cgj307i0ai74u.jpg",
      vod_remarks: "",
    });
    this.vodList = [vod1];
    this.filterObj = {};

    const output = this.result.home(this.classes, this.vodList, this.filterObj);
    Utils.log("output: " + output);
    return output;
  }

  async categoryContent(tid, pg, filter, extend) {
    Utils.log(
      `categoryContent params: tid=${tid}, pg=${pg}, filter=${filter}, extend=${extend}
      }`
    );
    return this.result.category([], tid, pg, filter, extend);
  }

  async searchContent(key, quick) {
    Utils.log(`searchContent params: key=${key}, quick=${quick}`);

    const cheerio = await this.getHtml(
      this.DOMAIN + "/search/-------------.html?wd=" + key
    );
    this.vodList = this.getVods(cheerio);

    const output = this.result.search(this.vodList);
    Utils.log("output: " + output);
    return output;
  }

  async detailContent(ids) {
    Utils.log(`detailContent params: ids=${ids}`);

    const url = `${this.DOMAIN}${ids}`;

    try {
      const $ = await this.getHtml(`${this.DOMAIN}${ids}`);

      const playUrls = [];
      $(".stui-content__playlist li a").each((_, item) => {
        const episode = $(item).text().trim(); // 如 "第01集", "总集篇上"
        const playUrl = $(item).attr("href"); // 如 "/play/7544-2-1.html"
        playUrls.push(`${episode}$${playUrl}`);
      });

      // 构建播放URL
      const playUrl = playUrls.join("#") + "$$$";

      // 提取视频详情
      const vodDetail = new VodDetail();
      vodDetail.load_data({
        vod_id: ids[0],
        vod_name: $(".stui-content__detail h1.title")
          .text()
          .trim()
          .replace(/\s*在线观看.*/, ""), // 移除 "在线观看" 和评分
        vod_pic: $(".stui-vodlist__thumb img").attr("data-original"),
        vod_remarks: $(".stui-content__detail .desc")
          .text()
          .trim() // 移除首尾空白
          .replace(/简介：/, "") // 移除 "简介："
          .replace(/\t/g, "") // 移除所有 \t
          .replace(/详情.*/, ""), // 移除 "详情" 及其后的内容
        vod_play_from: `${this.constructor.name}$$$`,
        vod_play_url: playUrl,
      });

      this.vodDetail = vodDetail;
    } catch (e) {
      Utils.log(e.stack);
    }

    const output = this.result.detail(this.vodDetail);
    Utils.log("output: " + output);
    return output;
  }

  async playerContent(flag, id, vipFlags) {
    Utils.log(
      `playerContent params: flag=${flag}, id=${id}, vipFlags=${vipFlags}`
    );
    const url = `${this.DOMAIN}${id}`;
    try {
      const res = await req(url, { method: "get", timeout: 25000 });

      const playerScriptRegex = /var player_aaaa\s*=\s*({[^;]*})/;
      const match = res.content.match(playerScriptRegex);

      if (match && match[1]) {
        const playerData = JSON.parse(match[1]);

        const m3mu8_url =
          "https://danmu.yhdmjx.com/m3u8.php?url=" + playerData.url;
        const m3u8_res = await this.fetch(m3mu8_url, null, this.getHeader());

        const m3u8_result = m3u8_res.match(
          /"url": getVideoInfo\("(.*?)"\),/
        )[1];
        const bt_token = m3u8_res.match(/<script>var bt_token = "(.*?)"/)[1];
        let m3u8_token_key = await this.fetch(
          "https://danmu.yhdmjx.com/js/play.js",
          null,
          this.getHeader()
        );
        m3u8_token_key = m3u8_token_key.match(
          /var _token_key=CryptoJS\['enc'\]\['Utf8'\]\[_0x17f1\('67','qETJ'\)\]\((.*?\))/
        )[1];
        m3u8_token_key = mxanime.decrypt_token_key(m3u8_token_key);

        const videoUrl = await mxanime.getVideoInfo(
          m3u8_result,
          m3u8_token_key,
          bt_token
        );
        const output = this.result.play(videoUrl);
        Utils.log("output: " + output);
        return output;
      } else {
        Utils.log("Failed to extract player_aaaa object");
      }
    } catch (e) {
      Utils.log(e.stack);
    }
    return this.result.play("");
  }

  getVods($) {
    const vods = [];

    // 使用 Cheerio 的方法遍历
    $("ul.stui-vodlist__media li").each((_, item) => {
      const a = $(item).find("a.v-thumb");
      if (!a.length) return;

      const title = a.attr("title") || "";
      const pic = a.attr("data-original") || "";
      const remarks = $(item).find(".pic-text").text().trim() || "";

      vods.push({
        vod_id: a.attr("href"),
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remarks,
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
