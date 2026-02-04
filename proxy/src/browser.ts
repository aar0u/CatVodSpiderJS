import { execSync } from "child_process";

import { Browser, Response, Page } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

import { BaseParser } from "./parsers/BaseParser";
import { color, logError } from "./utils";

// 使用 stealth 插件
chromium.use(stealth());

// 默认开启 Headless，除非环境变量显式指定 HEADLESS=false
const IS_HEADLESS = process.env.HEADLESS !== "false";

let browserInstance: Browser | null = null;
let lastAccessTime = Date.now();
let timeoutId: NodeJS.Timeout | null = null;

const SECOND = 1000;
// 从环境变量读取浏览器超时时间，默认为 20 分钟（1200秒）
const BROWSER_TIMEOUT =
  parseInt(process.env.BROWSER_TIMEOUT || "1200") * SECOND;
// 从环境变量读取页面超时时间，默认为 2 分钟（120秒）
const TIMEOUT_PAGE = parseInt(process.env.PAGE_TIMEOUT || "120") * SECOND;
// 页面关闭的延迟时间（毫秒），从环境变量读取，默认为 2 秒
const PAGE_CLOSE_DELAY = parseInt(process.env.PAGE_CLOSE_DELAY || "2") * SECOND;

const launch = async () => {
  const browser = await chromium.launch({
    headless: IS_HEADLESS,
    args: ["--disable-blink-features=AutomationControlled", "--disable-gpu"],
  });

  console.log(
    `Browser launched (Chromium + Stealth) [Headless: ${IS_HEADLESS}] [Timeouts: Browser=${BROWSER_TIMEOUT / SECOND}s, Page=${TIMEOUT_PAGE / SECOND}s, CloseDelay=${PAGE_CLOSE_DELAY / SECOND}s]`,
  );

  return browser;
};

export const getBrowser = async () => {
  if (!browserInstance || !browserInstance.isConnected()) {
    try {
      browserInstance = await launch();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message.toLowerCase() : "";

      // 如果不是环境缺失问题，直接抛出
      if (
        !errMsg.includes("executable doesn't exist") &&
        !errMsg.includes("not installed")
      ) {
        throw err;
      }

      // 尝试自动安装
      console.log(
        color.notice(
          "\n[Browser] Chromium not found. Attempting automatic installation...",
        ),
      );

      try {
        const installCmd = "npx playwright install --with-deps chromium";
        console.log(color.info(`Running: ${installCmd}`));
        execSync(installCmd, { stdio: "inherit" });

        console.log(
          color.success(
            "[Browser] Installation finished. Retrying launch...\n",
          ),
        );

        // 安装后重试启动
        browserInstance = await launch();
      } catch (retryErr) {
        console.error(
          color.danger("[Browser] Setup failed. Please run manually:"),
        );
        console.log(
          color.notice("npx playwright install --with-deps chromium"),
        );
        throw retryErr;
      }
    }
  }

  lastAccessTime = Date.now();
  startTimeoutCheck();
  return browserInstance;
};

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
  if (timeoutId) {
    clearInterval(timeoutId);
    timeoutId = null;
  }
}

function startTimeoutCheck() {
  if (timeoutId) return;
  timeoutId = setInterval(async () => {
    if (Date.now() - lastAccessTime > BROWSER_TIMEOUT) {
      console.log(
        `Closing browser due to inactivity for ${BROWSER_TIMEOUT / SECOND} seconds`,
      );
      await closeBrowser();
    }
  }, 60 * SECOND);
}

export default async function (
  url: string,
  selector: string,
  parser: BaseParser,
  onSuccess: (data: unknown) => void,
  onFail: (error: unknown) => void,
) {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    onFail(err);
    return;
  }

  const requestId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const logPrefix = `[Req:${requestId}]`;

  console.log(
    `${color.info(logPrefix)} Open page: ${url} - ${color.notice(parser.constructor.name)}`,
  );

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page: Page = await context.newPage();

  // 1. 先挂载响应监听，防止跳转过程中漏掉请求
  let finished = false;
  const responseHandler = async (response: Response) => {
    // 如果已经完成，直接忽略后续流量，不再处理
    if (finished) return;

    await parser.handleResponse(response, page, wrappedOnComplete);
  };

  const wrappedOnComplete = (data: unknown) => {
    if (finished) return;
    finished = true;
    onSuccess(data);

    // 延迟关闭页面，防止立刻关闭引发的 "Target closed" 报错
    setTimeout(async () => {
      if (!page.isClosed()) {
        try {
          await page.close();
          await context.close();
          console.log(`${color.info(logPrefix)} Page closed gracefully`);
        } catch (e) {
          console.log("Close page failed", e);
        }
      }
    }, PAGE_CLOSE_DELAY);
  };

  // 2. 根据是否有 selector 决定响应监听的设置时机
  //
  // 关键逻辑说明：
  // - 当没有 selector 时：页面加载过程中就会产生 m3u8 请求，需要提前设置响应监听
  // - 当有 selector 时：需要先点击切换片源，然后再设置响应监听，确保捕获到切换后的 m3u8
  //
  // 这种差异化处理解决了以下问题：
  // 1. 有 selector 时，避免捕获到默认的 m3u8（切换前的）
  // 2. 没有 selector 时，避免错过页面加载过程中的默认 m3u8

  if (!selector) {
    // 没有 selector 时，先设置响应监听，防止错过默认 m3u8, 因为页面一打开就会开始加载 m3u8
    page.on("response", responseHandler);
  }

  // 3. 开始跳转
  page
    .goto(url, {
      waitUntil: "networkidle",
      timeout: 60 * SECOND,
    })
    .then(async () => {
      // 获取页面标题和内容长度作为调试信息
      try {
        const title = await page.title();
        console.log(
          `${color.info(logPrefix)} Page loaded, title: ${title}, URL: ${page.url()}`,
        );
      } catch (e) {
        console.log(
          `${color.caution(logPrefix)} Failed to get page details: ${e}`,
        );
      }

      // 跳转完成后执行 parser 的前置处理（如点击）, 只有当有 selector 时才调用 beforeHandleResponse
      if (selector && !page.isClosed()) {
        await parser.beforeHandleResponse(page, selector);
        // 设置响应监听，确保捕获到点击切换后的片源，而不是默认片源
        page.on("response", responseHandler);
      }
    })
    .catch((err) => {
      if (finished) return; // 如果已经成功，忽略由于页面关闭导致的错误
      logError(`Browser - ${err.stack || err.message}`);
      onFail(err.message);
    });

  // 3. 超时保护
  setTimeout(async () => {
    if (!finished && !page.isClosed()) {
      console.log(
        color.caution(
          `Force closing page after ${TIMEOUT_PAGE / SECOND} seconds`,
        ),
      );
      finished = true;
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      onFail("Timeout");
    }
  }, TIMEOUT_PAGE);
}
