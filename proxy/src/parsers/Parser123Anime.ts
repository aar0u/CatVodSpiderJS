import { BaseParser } from "./BaseParser";
import { Playable } from "../models/Playable";
import { color, logError } from "../utils";

export class Parser123Anime implements BaseParser {
  private playable = new Playable();
  private isProcessing = false;

  constructor() {
    // bind `this` to can access properties
    this.handleResponse = this.handleResponse.bind(this);
  }

  async beforeHandleResponse(page, selector) {
    // const svrTab = 'span.tip.tab[data-name="10"]';
    try {
      if (selector) {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        console.log(`${color.success("Clicked")} on ${selector}`);
      }
    } catch (err) {
      logError(`Failed to click ${selector} - ${err.message}`);
    }
  }

  async handleResponse(response, page, onSuccess, onFail) {
    try {
      const url = response.url().toLowerCase();
      if (!url.match(/\.(mp4|m3u8|vtt)/)) return false;

      console.log("(m3u8|vtt) ", url);

      if (url.endsWith("m3u8") && !this.isProcessing) {
        this.isProcessing = true;
        // immediately stop other handling
        page.off("response", this.handleResponse);

        this.playable.url = url;
        console.log(`${color.success("Captured")} - ${url}`);

        this.isProcessing = false;
      } else if (url.endsWith(".vtt") && url.includes("eng")) {
        console.log(`${color.success("Subtitle")} - ${url}`);
        this.playable.subs = [url];
      }

      // if (this.playable.url && this.playable.subs) {
      if (this.playable.url && !page.isClosed() && !this.playable.html) {
        this.playable.html = await page.content();
        console.log(`${color.success("Response")} to client`);
        onSuccess(this.playable);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      logError(`Capturing - ${err.stack || err.message}`);
      onFail(err);
      return true;
    }
  }
}
