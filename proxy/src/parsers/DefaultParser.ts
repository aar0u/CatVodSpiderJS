import { Page, Response } from "playwright";

import { BaseParser } from "./BaseParser";
import { Playable } from "../models/Playable";
import { color, logError } from "../utils";

export class DefaultParser implements BaseParser {
  // 恢复状态，用于累积数据（如 m3u8 + subs）
  private playable = new Playable();
  // 定时器引用，防止重复触发
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    // bind `this` to can access properties
    this.handleResponse = this.handleResponse.bind(this);
  }

  async beforeHandleResponse(page: Page, selector: string) {
    // const svrTab = 'span.tip.tab[data-name="10"]';
    try {
      if (selector) {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        console.log(`${color.success("Clicked")} on ${selector}`);
      }
    } catch (err: unknown) {
      logError(`Failed to click ${selector} - ${(err as Error).message}`);
    }
  }

  async handleResponse(
    response: Response,
    page: Page,
    onComplete: (data: unknown) => void,
  ): Promise<boolean> {
    try {
      const url = response.url().toLowerCase();
      if (!url.match(/\.(mp4|m3u8|vtt)/)) return false;

      console.log("(m3u8|vtt) ", url);

      // 1. 捕获 m3u8
      if (url.endsWith("m3u8")) {
        if (!this.playable.url) {
          this.playable.url = url;
          console.log(`${color.success("Captured URL")} - ${url}`);

          // 开启延迟发送，等待可能的字幕文件
          const sec = 2;
          if (!this.timer) {
            console.log(color.info(`Waiting ${sec}s for potential subs...`));
            this.timer = setTimeout(async () => {
              // 再次检查页面是否存在，获取 HTML 上下文
              if (!page.isClosed() && !this.playable.html) {
                try {
                  this.playable.html = await page.content();
                } catch {
                  // ignore errors
                }
              }
              console.log(color.info("Triggering onComplete after timeout"));
              onComplete(this.playable);
            }, sec * 1000);
          }
        }
      }

      // 2. 捕获字幕
      else if (url.endsWith(".vtt") && !url.includes("thumbnails")) {
        console.log(`${color.success("Subtitle")} - ${url}`);
        // 累积字幕
        if (!this.playable.subs) {
          this.playable.subs = [];
        }
        this.playable.subs.push(url);
      }

      // 无论如何返回 false，因为真正的停止逻辑现在由 timer 里的 onSuccess 触发
      // browser.ts 中的 wrappedOnSuccess 会负责设置 finished=true 并关闭页面
      return false;
    } catch (err) {
      logError(`Capturing - ${err.stack || err.message}`);
      // 错误也不立即终止，以防只是某个流的小错误
      return false;
    }
  }
}
