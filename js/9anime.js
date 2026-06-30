import { RemoteRenderSpider } from "./core_remote_render_spider.js";
import { VodDetail } from "../lib/vod.js";
import * as Utils from "../lib/utils.js";

import { JadeLogging } from "../lib/log.js";
const jadeLog = new JadeLogging(Utils.getCurrentFileName(), "DEBUG");

class ABC extends RemoteRenderSpider {
  DOMAIN = "https://9anime.blue";

  async homeContent(filter) {
    jadeLog.info("homeContent params: filter=" + filter + ", browser proxy=" + this.PROXY_URL);

    this.classes = [{ type_id: "/home", type_name: "首页" }];

    this.filterObj = {
      "/home": [
        {
          key: "language",
          name: "配音",
          value: [
            { n: "配音版", v: "dub" },
            { n: "字幕版", v: "sub" },
          ],
        },
        {
          key: "year",
          name: "年份",
          value: Array.from({ length: 25 }, (_, i) => {
            const year = 2025 - i;
            return { n: year.toString(), v: year.toString() };
          }),
        },
      ],
    };

    const $ = await this.getHtml(`${this.DOMAIN}/home`);
    const topList = this.getTopAnimeList($);
    const homeList = this.getVodListFromSection($, ".flw-item, .a-card");
    const seenIds = new Set();
    const vodList = [...topList, ...homeList].filter((vod) => {
      if (!vod.vod_id || seenIds.has(vod.vod_id)) return false;
      seenIds.add(vod.vod_id);
      return true;
    });

    const output = this.result.home(this.classes, vodList, this.filterObj);
    jadeLog.info(`output: ${output}`);
    return output;
  }

  async getPlayClicks(flag, id) {
    const { subServers, dubServers } = await this.getEpisodeServers(id);
    const selection = this.selectServer(flag, subServers, dubServers);
    if (!selection) return [];

    const serverSelector = `.server-btn[data-index="${selection.index}"]`;
    if (!subServers.length || !dubServers.length) return [serverSelector];

    return [`.type-tab[data-type="${selection.type}"]`, serverSelector];
  }

  async getPlayReferer(flag, id, json) {
    const { subServers, dubServers } = await this.getEpisodeServers(id);
    const selection = this.selectServer(flag, subServers, dubServers);
    return this.getOriginFromUrl(selection?.server?.url) || "";
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
    const vodList = this.getVodListFromSection($, ".flw-item, .a-card");
    jadeLog.info(`Fetching URL: ${url}, ${vodList.length} items for category: ${tid}`);
    return this.result.category(vodList, pg, 1, 0);
  }

  async searchContent(key, quick) {
    jadeLog.info(`searchContent params: key=${key}, quick=${quick}`);

    const $ = await this.getHtml(
      this.DOMAIN + "/search?q=" + encodeURIComponent(key)
    );
    this.vodList = this.getVodListFromSection($, ".flw-item, .a-card");

    const output = this.result.search(this.vodList);
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
      vodDetail.vod_pic = $(".poster-col img, img.poster-img, .anime-poster img")
        .first()
        .attr("src");
      vodDetail.vod_name = $(".anime-title, h1").first().text().trim();
      vodDetail.vod_content = $(".description").first().text().trim();
      vodDetail.type_name = $(".meta-row .meta-badge")
        .filter((_, el) => $(el).text().trim() === "TV" || $(el).text().trim() === "Movie")
        .first()
        .text()
        .trim();
      vodDetail.vod_year = $(".stat-item:contains('Year') .stat-value")
        .first()
        .text()
        .trim();
      vodDetail.vod_remarks = this.getInfoValue($, "Status:");
      vodDetail.vod_director = this.getInfoValue($, "Studio:");

      const genres = [];
      $(".genres a, .genre-tag").each((_, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
      });
      vodDetail.vod_area = genres.join(",");

      const episodes = [];
      const episodeUrls = new Set();
      $(".episode-card").each((_, ep) => {
        const $ep = $(ep);
        const epUrl = $ep.attr("href");
        if (!epUrl || !epUrl.includes("/episode-")) return;

        const epNumber =
          $ep.find(".ep-num").text().trim().replace(/^EP\s*/i, "") ||
          epUrl.match(/episode-(\d+)/)?.[1];
        if (episodeUrls.has(epUrl)) return;
        episodeUrls.add(epUrl);
        episodes.push(`${epNumber}$${epUrl}`);
      });

      const totalEpisodes = Number(
        ($.html().match(/var\s+totalEpisodes\s*=\s*(\d+)/) || [])[1]
      );
      const slug = ($.html().match(/var\s+animeSlug\s*=\s*['"]([^'"]+)['"]/) || [])[1];
      if (slug && totalEpisodes > episodes.length) {
        for (let i = 1; i <= totalEpisodes; i++) {
          const epUrl = `/anime/${slug}/episode-${i}/`;
          if (!episodeUrls.has(epUrl)) episodes.push(`${i}$${epUrl}`);
        }
      }

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
    const { subServers, dubServers } = await this.getEpisodeServers(episodeId);
    return [
      ...dubServers.map((server) => this.formatPlayFlag("dub", server.name)),
      ...subServers.map((server) => this.formatPlayFlag("sub", server.name)),
    ].filter(Boolean);
  }

  async getEpisodeServers(id) {
    if (!id?.includes("/episode-")) return { subServers: [], dubServers: [] };
    this.serverCache = this.serverCache || {};
    if (this.serverCache[id]) return this.serverCache[id];

    const $ = await this.getHtml(`${this.DOMAIN}${id}`);
    const html = $.html();
    const subServers = this.parseServerList(html, "subServers");
    const dubServers = this.parseServerList(html, "dubServers");

    this.serverCache[id] = { subServers, dubServers };
    return this.serverCache[id];
  }

  selectServer(flag, subServers, dubServers) {
    const parsed = this.parsePlayFlag(flag);
    if (!parsed) return null;

    const servers = parsed.type === "dub" ? dubServers : subServers;
    const index = servers.findIndex((server) => server.name === parsed.name);
    if (index < 0) return null;

    return { type: parsed.type, index, server: servers[index] };
  }

  formatPlayFlag(type, name) {
    return name ? `${type}-${name}` : "";
  }

  parsePlayFlag(flag) {
    const matched = flag?.match(/^(sub|dub)-(.+)$/);
    if (!matched) return null;
    return { type: matched[1], name: matched[2] };
  }

  parseServerList(html, key) {
    const matched = html.match(new RegExp(`${key}\\s*:\\s*(\\[[\\s\\S]*?\\])`));
    if (!matched) return [];
    try {
      return JSON.parse(matched[1]);
    } catch {
      return [];
    }
  }

  getOriginFromUrl(url) {
    return (url?.match(/^(https?:\/\/[^/]+)/) || [])[1]?.concat("/") || "";
  }

  normalizeDetailId(id) {
    const matched = id?.match(/^(\/anime\/[^/]+\/)(?:episode-\d+\/)?$/);
    return matched ? matched[1] : id;
  }

  cleanEpisodeName(name) {
    return name
      .trim()
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/#/g, " ");
  }

  getInfoValue($, label) {
    return $(".info-grid div")
      .filter((_, el) => $(el).find(".label").text().trim() === label)
      .first()
      .find(".value")
      .text()
      .trim();
  }

  getTopAnimeList($) {
    const vodList = [];

    $(".top-h1, .top-row").each((_, item) => {
      const $item = $(item);
      const vod = new VodDetail();
      vod.vod_id = this.normalizeDetailId($item.attr("href"));
      vod.vod_name = $item.find(".top-h1-n, .top-rn").first().text().trim();
      vod.vod_pic = $item.find("img").first().attr("src");

      const rank = $item.find(".top-rank, .top-rk").first().text().trim();
      const views = $item
        .find(".top-h1-v, .top-rv")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      vod.vod_remarks = [rank && `#${rank}`, views].filter(Boolean).join(" ");

      if (vod.vod_id && vod.vod_name) vodList.push(vod);
    });

    return vodList;
  }

  getVodListFromSection($, selector) {
    const vodList = [];
    $(selector).each((_, item) => {
      try {
        const vod = new VodDetail();
        const $item = $(item);

        const $titleLink = $item.find(".film-detail .film-name a, > a").first();

        if (!$titleLink.length) {
          jadeLog.info("No title link found, skipping item");
          return;
        }

        vod.vod_id = this.normalizeDetailId($titleLink.attr("href"));
        vod.vod_name =
          $titleLink.find(".a-name").text().trim() ||
          $titleLink.attr("title") ||
          $titleLink.text().trim();

        const $img = $item.find("img.film-poster-img, .a-poster img").first();
        if ($img.length) {
          vod.vod_pic = $img.attr("data-src") || $img.attr("src");
        }

        const statusItems = [];
        $item.find(".tick-item, .b-hd, .b-sub, .b-dub").each((_, el) => {
          statusItems.push($(el).text().trim());
        });
        vod.vod_remarks = statusItems.join(" ");

        if (vod.vod_id && vod.vod_name) {
          vodList.push(vod);
        }
      } catch (e) {
        jadeLog.info(`Error parsing item: ${e.message}`);
      }
    });
    return vodList;
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
