/**
 * YHDM Spider for CatVod/FongmiTV
 *
 * Reference documentation:
 * - Java implementation: https://github.com/FongMi/TV/blob/b67af3c691f1cff410cb692cb7802e31289ac195/quickjs/src/main/java/com/fongmi/quickjs/crawler/Spider.java#L160
 * - JavaScript libraries: https://github.com/FongMi/TV/blob/release/quickjs/src/main/assets/js/lib/
 * - JavaScript loader: https://github.com/FongMi/TV/blob/a5aac3ed7be1b977ac59602fa9c53c7e51127319/app/src/main/java/com/fongmi/android/tv/api/loader/JsLoader.java#L32
 * - Loaders: https://github.com/FongMi/TV/commit/0c8e12f5ae3d65bc8afff64ebdd07e9fdef98d18
 *
 * The Spider.java file shows how JavaScript spiders are loaded and executed.
 * The js/lib directory contains the base Spider class and HTTP utilities.
 */

import { _ } from "./catvod-assets/js/lib/cat.js";
import { Spider } from "./core_spider.js";
import { spider as mxanime } from "./mxanime.js";
import { VodDetail } from "../lib/vod.js";
import * as Utils from "../lib/utils.js";

import { JadeLogging } from "../lib/log.js";
const jadeLog = new JadeLogging(Utils.getCurrentFileName(), "DEBUG");

class ABC extends Spider {
  DOMAIN = "https://www.dmla7.com";
  categoryVodLists = new Map(); // 添加缓存Map

  getVodListFromSection($, selector) {
    const vodList = [];
    $(selector).each((_, item) => {
      const vod = new VodDetail();
      const $item = $(item);
      const $a = $item.find("a.stui-vodlist__thumb, a.v-thumb");
      if (!$a.length) return;

      vod.vod_id = $a.attr("href");
      vod.vod_name = $a.attr("title");
      vod.vod_pic = $a.attr("data-original");
      vod.vod_remarks = $item.find(".pic-text").text().trim();

      vodList.push(vod);
    });
    return vodList;
  }

  async homeContent(filter) {
    jadeLog.info("homeContent params: filter=" + filter);
    this.classes = [];

    const $ = await this.getHtml(this.DOMAIN);

    // 收集分类，只要"最新"开头的分类
    $(".stui-pannel-box h3").each((_, el) => {
      const title = $(el).text().trim();
      if (title.startsWith("最新")) {
        const $section = $(el).closest(".stui-pannel-box");
        const vodList = this.getVodListFromSection(
          $,
          $section.find(".stui-vodlist__box")
        );
        // 缓存该分类下的视频列表
        this.categoryVodLists.set(title, vodList);
        jadeLog.info(`Cached ${vodList.length} items for category: ${title}`);

        this.classes.push({
          type_id: title,
          type_name: title,
        });
      }
    });
    jadeLog.info(`Added ${this.classes.length} categories`);

    const $hotSection = $(".stui-pannel:contains('热门动漫推荐')");
    this.vodList = this.getVodListFromSection(
      $,
      $hotSection.find(".stui-vodlist li")
    );
    jadeLog.info(`Items in hot section: ${this.vodList.length}`);

    this.filterObj = {};

    const output = this.result.home(this.classes, this.vodList, this.filterObj);
    jadeLog.info("output: " + output);
    return output;
  }

  async categoryContent(tid, pg, filter, extend) {
    jadeLog.info(
      `categoryContent params: tid=${tid}, pg=${pg}, filter=${filter}, extend=${extend}`
    );

    // 从缓存中获取分类视频列表
    const vodList = this.categoryVodLists.get(tid) || [];
    jadeLog.info(`Found ${vodList.length} cached items for category: ${tid}`);

    return this.result.category(vodList, pg, 1, 0, vodList.length);
  }

  async searchContent(key, quick) {
    jadeLog.info(`searchContent params: key=${key}, quick=${quick}`);

    const $ = await this.getHtml(
      this.DOMAIN + "/search/-------------.html?wd=" + key
    );
    this.vodList = this.getVodListFromSection($, "ul.stui-vodlist__media li");

    const output = this.result.search(this.vodList);
    jadeLog.info("output: " + output);
    return output;
  }

  async detailContent(ids) {
    jadeLog.info(`detailContent params: ids=${ids}`);

    try {
      const $ = await this.getHtml(`${this.DOMAIN}${ids}`);

      const playFromList = [];
      const playUrlsList = [];

      $(".stui-content__playlist").each((sourceIndex, playlist) => {
        const playUrls = [];
        const sourceName =
          $(`.nav-tabs a[href="#playlist${sourceIndex + 1}"]`)
            .text()
            .trim() || `播放源${sourceIndex + 1}`;

        $(playlist)
          .find("li a")
          .each((_, item) => {
            const episode = $(item).text().trim();
            const playUrl = $(item).attr("href");
            playUrls.push(`${episode}$${playUrl}`);
          });

        playFromList.push(`${sourceName}$$$`);
        playUrlsList.push(playUrls.join("#") + "$$$");
      });

      const vodDetail = new VodDetail();
      vodDetail.vod_id = ids[0];
      vodDetail.vod_pic = $(".stui-vodlist__thumb img").attr("data-original");

      const $detail = $(".stui-content__detail");
      vodDetail.vod_name = $detail
        .find("h1.title")
        .text()
        .replace(/\s*在线观看.*|\s+/g, "");

      vodDetail.type_name = $detail
        .find("span:contains('类型')")
        .nextUntil(".split-line")
        .map((_, el) => $(el).text().trim())
        .get()
        .join(" ");
      vodDetail.vod_area = $detail
        .find("span:contains('地区')")
        .next()
        .text()
        .trim();
      vodDetail.vod_year = $detail
        .find("span:contains('年份')")
        .next()
        .text()
        .trim();
      vodDetail.vod_actor = $detail
        .find("span:contains('主演')")
        .parent()
        .text()
        .trim();
      vodDetail.vod_director =
        $detail.find("span:contains('导演')").text().trim() ||
        $detail.find("span:contains('别名')").parent().text().trim();

      vodDetail.vod_content = $detail
        .find(".desc")
        .text()
        .replace(/(?:简介：|\t|详情.*|\s+)/g, "");
      vodDetail.vod_play_from = playFromList.join("");
      vodDetail.vod_play_url = playUrlsList.join("");

      this.vodDetail = vodDetail;
    } catch (e) {
      jadeLog.info(e.stack);
    }

    const output = this.result.detail(this.vodDetail);
    jadeLog.info("output: " + output);
    return output;
  }

  async playerContent(flag, id, vipFlags) {
    jadeLog.info(
      `playerContent params: flag=${flag}, id=${id}, vipFlags=${vipFlags}`
    );
    const url = `${this.DOMAIN}${id}`;
    try {
      const res = await req(url, { method: "get", timeout: 15000 });

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
        jadeLog.info("output: " + output);
        return output;
      } else {
        jadeLog.info("Failed to extract player_aaaa object");
      }
    } catch (e) {
      jadeLog.info(e.stack);
    }
    return this.result.play("");
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
