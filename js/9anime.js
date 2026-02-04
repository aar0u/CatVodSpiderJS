import { RemoteRenderSpider } from "./core_remote_render_spider.js";
import { _, load } from "./catvod-assets/js/lib/cat.js";
import { VodDetail } from "../lib/vod.js";
import * as Utils from "../lib/utils.js";

import { JadeLogging } from "../lib/log.js";
const jadeLog = new JadeLogging(Utils.getCurrentFileName(), "DEBUG");

class ABC extends RemoteRenderSpider {
  DOMAIN = "https://9animetv.to";
  PLAY_REFERER = "https://rapid-cloud.co/";
  PLAY_FLAG = ".servers-dub .server-item:first-child";

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

    const output = this.result.home(this.classes, [], this.filterObj);
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
    const vodList = this.getVodListFromSection($, ".flw-item");
    jadeLog.info(`Fetching URL: ${url}, ${vodList.length} items for category: ${tid}`);
    return this.result.category(vodList, pg, 1, 0);
  }

  async searchContent(key, quick) {
    jadeLog.info(`searchContent params: key=${key}, quick=${quick}`);

    const $ = await this.getHtml(
      this.DOMAIN + "/search?keyword=" + encodeURIComponent(key)
    );
    this.vodList = this.getVodListFromSection($, ".flw-item");

    const output = this.result.search(this.vodList);
    jadeLog.info(`output: ${output}`);
    return output;
  }

  async detailContent(ids) {
    jadeLog.info(`detailContent params: ids=${ids}`);

    try {
      const url = `${this.PROXY_URL}/url/${this.DOMAIN}${ids}`;

      const res = await req(url, { method: "get", timeout: this.REQ_TIMEOUT });
      const json = JSON.parse(res.content);
      const $ = load(json.html);

      const vodDetail = new VodDetail();
      vodDetail.vod_id = ids[0];

      // Get basic info
      const $filmPoster = $(".film-poster");
      vodDetail.vod_pic = $filmPoster.find("img.film-poster-img").attr("src");

      // Get title
      vodDetail.vod_name = $(".film-name.dynamic-name").text().trim();

      // Get description
      vodDetail.vod_content = $(".film-description p.shorting").text().trim();

      // Get metadata
      const $meta = $(".meta");

      // Get type
      vodDetail.type_name = $meta
        .find(".item:contains('Type:') .item-content a")
        .text()
        .trim();

      // Get studios
      vodDetail.vod_director = $meta
        .find(".item:contains('Studios:') .item-content a")
        .text()
        .trim();

      // Get date aired
      vodDetail.vod_year = $meta
        .find(".item:contains('Date aired:') .item-content span")
        .text()
        .trim()
        .split(" to ")[0];

      // Get status
      vodDetail.vod_remarks = $meta
        .find(".item:contains('Status:') .item-content span")
        .text()
        .trim();

      // Get genres
      const genres = [];
      $meta.find(".item:contains('Genres:') .item-content a").each((_, el) => {
        genres.push($(el).text().trim());
      });
      vodDetail.vod_area = genres.join(",");

      const playFromList = [];
      const playUrlsList = [];

      $("#servers-content .server-item").each((serverIndex, server) => {
        const $server = $(server);

        // The server-item is inside a ps_-block-sub, so we need to find the parent first
        const $parentBlock = $server.closest(".ps_-block-sub");
        const serverType = $parentBlock.find(".ps__-title").text().trim() || "";

        // Get server name from the button text
        const serverName = $server.find("a.btn").text().trim();
        // Combine type and name with proper spacing
        const fullServerName = serverType
          ? `${serverType} ${serverName}`
          : serverName;

        const serverId = $server.attr("data-id");

        // Keep only the first DUB server to avoid projector freezing
        if (playUrlsList.length > 0 || !fullServerName.includes("DUB")) {
          jadeLog.info(`Skipping server: ${fullServerName} (ID: ${serverId})`);
          return;
        }

        const episodes = [];
        $(`.episodes-ul a.ep-item`).each((_, ep) => {
          const $ep = $(ep);
          const epNumber = $ep.attr("data-number");
          const epId = $ep.attr("data-id");
          const epUrl = $ep.attr("href");
          if (epId && epUrl) {
            episodes.push(`${epNumber}$${epUrl}`);
          }
        });

        playFromList.push(`${fullServerName}$$$`);
        playUrlsList.push(episodes.join("#") + "$$$");
        jadeLog.info(
          `Added server: ${fullServerName} with ${episodes.length} episodes`
        );
      });

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

  getVodListFromSection($, selector) {
    const vodList = [];
    $(selector).each((_, item) => {
      try {
        const vod = new VodDetail();
        const $item = $(item);

        // For 9anime search results - use film-poster instead of poster
        const $filmPoster = $item.find(".film-poster");
        const $filmDetail = $item.find(".film-detail");

        // Get link from film-name
        const $titleLink = $filmDetail.find(".film-name a");

        if (!$titleLink.length) {
          jadeLog.info("No title link found, skipping item");
          return;
        }

        vod.vod_id = $titleLink.attr("href");
        vod.vod_name = $titleLink.attr("title") || $titleLink.text().trim();

        // Get image from film-poster
        const $img = $filmPoster.find("img.film-poster-img");
        if ($img.length) {
          vod.vod_pic = $img.attr("data-src") || $img.attr("src");
        }

        // Get status info from tick items
        const statusItems = [];
        $item.find(".tick-item").each((_, el) => {
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
