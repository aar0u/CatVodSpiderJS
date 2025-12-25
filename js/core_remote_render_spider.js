import { Spider } from "./core_spider.js";

/**
 * Base spider class for sites that require remote proxy (Playwright) for player content
 */
class RemoteRenderSpider extends Spider {
  PROXY_URL = this.getScriptOrigin();
  /**
   * Timeout for player content requests in milliseconds
   * Override in subclass if needed
   */
  REQ_TIMEOUT = 30000;
  /**
   * Referer header for player requests
   * Override in subclass if needed
   */
  PLAY_REFERER = "";
  /**
   * Flag parameter for player URL
   * Override in subclass if needed
   */
  PLAY_FLAG = "";

  /**
   * 获取脚本的下载origin
   * @returns {string} 脚本的下载origin，格式为 http://HOST:PORT
   */
  getScriptOrigin() {
    try {
      throw new Error();
    } catch (e) {
      // 从错误堆栈中提取脚本URL，格式如: http://192.168.31.171:8000/js/123anime.js:99
      const stack = e.stack || "";
      const urlMatch = stack.match(/https?:\/\/[^\/]+\/[^\s:]+/);

      if (urlMatch && urlMatch[0]) {
        // 从完整URL中提取origin（协议 + 域名 + 端口）
        const originMatch = urlMatch[0].match(/(https?:\/\/[^\/]+)/);
        if (originMatch && originMatch[1]) {
          return originMatch[1];
        }
      }

      // 处理错误情况
      this.jadeLog.info("获取脚本origin时出错: " + (e.message || "未知错误"));
    }
    return "http://127.0.0.1:8787"; // 默认回退值
  }

  /**
   * Generic player content handler using remote proxy
   * @param {string} flag - Play flag
   * @param {string} id - Episode ID
   * @param {string} vipFlags - VIP flags
   * @returns {string} Play result JSON
   */
  async playerContent(flag, id, vipFlags) {
    await this.jadeLog.info(
      `playerContent params: flag=${flag}, id=${id}, vipFlags=${vipFlags}`
    );
    const browserUrl = encodeURIComponent(this.DOMAIN + id);
    const flagParam = this.PLAY_FLAG ? `?flag=${encodeURIComponent(this.PLAY_FLAG)}` : "";
    const url = `${this.PROXY_URL}/url/${browserUrl}${flagParam}`;
    try {
      const res = await req(url, { method: "get", timeout: this.REQ_TIMEOUT });
      if (!res.content) {
        await this.jadeLog.info(
          `Empty response: ${url}, most likely due to timeout`
        );
        return this.result.play("");
      }
      const json = JSON.parse(res.content);

      if (json.subs) {
        const subs = [];
        for (const subUrl of json.subs) {
          const ext = subUrl.split(".").pop().toLowerCase();
          subs.push({
            name: "auto-sub",
            lang: "eng",
            format: this.getSubFormat(ext),
            url: subUrl,
          });
        }
        this.result.setSubs(subs);
      }

      let headers = this.getHeader();
      if (this.PLAY_REFERER) {
        headers["Referer"] = this.PLAY_REFERER;
      }
      this.result.header = headers;

      const output = this.result.play(json.url);
      await this.jadeLog.info(`output: ${output}`);
      return output;
    } catch (e) {
      await this.jadeLog.info(e.stack);
    }
    return this.result.play("");
  }
}

export { RemoteRenderSpider };
