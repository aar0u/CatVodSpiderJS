import { RemoteRenderSpider } from "./core_remote_render_spider.js";
import { VodDetail } from "../lib/vod.js";
import * as Utils from "../lib/utils.js";

import { JadeLogging } from "../lib/log.js";
const jadeLog = new JadeLogging(Utils.getCurrentFileName(), "DEBUG");

class ABC extends RemoteRenderSpider {
  DOMAIN = "https://animesuge.cz";

  async homeContent(filter) {
    jadeLog.info("homeContent params: filter=" + filter);
    return this.result.home([], [], {});
  }

  async homeVod() {
    return JSON.stringify({ list: [] });
  }

  async categoryContent(tid, pg, filter, extend) {
    jadeLog.info(
      `categoryContent params: tid=${tid}, pg=${pg}, filter=${filter}, extend=${JSON.stringify(
        extend
      )}`
    );
    return this.result.category([], pg, 1, 0);
  }

  async searchContent(key, quick) {
    jadeLog.info(`searchContent params: key=${key}, quick=${quick}`);

    const $ = await this.getHtml(
      `${this.DOMAIN}/search?keyword=${encodeURIComponent(key)}`
    );
    const vodList = this.getVodList($, ".original.anime .item");

    const output = this.result.search(vodList);
    jadeLog.info(`output: ${output}`);
    return output;
  }

  async detailContent(ids) {
    jadeLog.info(`detailContent params: ids=${ids}`);

    try {
      const id = this.normalizeDetailId(Array.isArray(ids) ? ids[0] : ids);
      const $ = await this.getHtml(`${this.DOMAIN}${id}`);

      const vodDetail = new VodDetail();
      vodDetail.vod_id = id;
      vodDetail.vod_pic = $("#media-info .poster img").first().attr("src");
      vodDetail.vod_name = $("#media-info h1[itemprop='name']")
        .first()
        .text()
        .trim();
      vodDetail.vod_content = $("#media-info .description .short div")
        .first()
        .text()
        .trim();
      vodDetail.type_name = this.getMetaValue($, "Type:");
      vodDetail.vod_year = (this.getMetaValue($, "Premiered:").match(/\d{4}/) || [])[0] || "";
      vodDetail.vod_remarks = this.getMetaValue($, "Status:");
      vodDetail.vod_director = this.getMetaValue($, "Studios:");
      vodDetail.vod_area = this.getGenres($).join(",");

      const episodes = this.getEpisodes($, id);
      const playFrom = await this.getPlaySources(episodes[0]?.split("$")[1]);
      const playUrl = episodes.join("#");

      vodDetail.vod_play_from = playFrom.join("$$$");
      vodDetail.vod_play_url = playFrom.map(() => playUrl).join("$$$");
      this.vodDetail = vodDetail;
    } catch (e) {
      jadeLog.info(`Error in detailContent: ${e.message}`);
      return "";
    }

    const output = this.result.detail(this.vodDetail);
    jadeLog.info(`output: ${output}`);
    return output;
  }

  async getPlaySources(episodeId) {
    const { servers } = await this.getEpisodeServers(episodeId);
    return servers.map((server) => server.name).filter(Boolean);
  }

  async getPlayClicks(flag, id) {
    const { servers } = await this.getEpisodeServers(id);
    if (!servers.some((server) => server.name === flag)) return [];

    return [
      `xpath=//div[contains(concat(' ', normalize-space(@class), ' '), ' server-type ') and @data-type='dub']//div[contains(concat(' ', normalize-space(@class), ' '), ' server ')][.//span[normalize-space()=${this.xpathLiteral(flag)}] or normalize-space()=${this.xpathLiteral(flag)}]`,
    ];
  }

  async getPlayReferer(flag, id, json) {
    return "https://vidtube.site/";
  }

  async getEpisodeServers(id) {
    if (!id?.includes("/ep-")) return { servers: [], hasDub: false };
    this.serverCache = this.serverCache || {};
    if (this.serverCache[id]) return this.serverCache[id];

    const rawUrl = `${this.PROXY_URL}/url?raw=1&url=${encodeURIComponent(`${this.DOMAIN}${id}`)}`;
    const $ = await this.getHtml(rawUrl);
    const servers = [];
    const seen = new Set();

    $('.server-type[data-type="dub"] .server-list .server').each((_, element) => {
      const name = $(element).find("span").first().text().trim() || $(element).text().trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      servers.push({ name, url: "https://vidtube.site/" });
    });

    this.serverCache[id] = { servers, hasDub: servers.length > 0 };
    return this.serverCache[id];
  }

  getVodList($, selector) {
    const vodList = [];

    $(selector).each((_, item) => {
      const $item = $(item);
      const $link = $item.find("a.poster, .item-bottom .name").first();
      const vodId = this.normalizeDetailId($link.attr("href"));
      const vodName =
        $item.find(".item-bottom .name").first().text().trim() ||
        $item.find("img").first().attr("alt") ||
        $link.text().trim();

      if (!vodId || !vodName) return;

      const vod = new VodDetail();
      vod.vod_id = vodId;
      vod.vod_name = vodName;
      vod.vod_pic = $item.find(".poster img, img").first().attr("data-src") ||
        $item.find(".poster img, img").first().attr("src");
      vod.vod_remarks = $item
        .find(".dub-sub-total, .item-status")
        .text()
        .replace(/\s+/g, " ")
        .trim();
      vodList.push(vod);
    });

    return vodList;
  }

  getEpisodes($, id) {
    const totalEpisodes = Number(this.getMetaValue($, "Episodes:"));
    if (!totalEpisodes) return [];

    return Array.from({ length: totalEpisodes }, (_, index) => {
      const episode = index + 1;
      return `${episode}$${id}/ep-${episode}`;
    });
  }

  getMetaValue($, label) {
    return $("#media-info .meta > div")
      .filter((_, el) => $(el).children("div").first().text().trim() === label)
      .first()
      .find("span")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
  }

  getGenres($) {
    const genres = [];
    $("#media-info .meta div:contains('Genre:') a").each((_, el) => {
      const genre = $(el).text().trim();
      if (genre) genres.push(genre);
    });
    return genres;
  }

  normalizeDetailId(id) {
    id = id?.replace(this.DOMAIN, "");
    const matched = id?.match(/^(\/anime\/[^/]+)(?:\/ep-\d+)?\/?$/);
    return matched ? matched[1] : id;
  }

  xpathLiteral(value) {
    if (!value.includes("'")) return `'${value}'`;
    if (!value.includes('"')) return `"${value}"`;
    return `concat(${value
      .split("'")
      .map((part) => `'${part}'`)
      .join(`, "'", `)})`;
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
    homeVod,
    category,
    detail,
    play,
    search,
  };
}

export { spider, ABC };
