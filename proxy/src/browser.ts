import puppeteer, { Browser, HTTPResponse, Page } from "puppeteer";

import { BaseParser } from "./parsers/BaseParser";
import { color, logError } from "./utils";

let browserInstance: Browser | null = null;
let lastAccessTime = Date.now();
let timeoutId: NodeJS.Timeout | null = null;

const MIN = 60 * 1000;
const TIMEOUT = 20 * MIN;
const TIMEOUT_PAGE = 2 * MIN;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      // headless: false,
      defaultViewport: null,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--window-size=720,800",
        // "--no-startup-window",
      ],
    });
    console.log("Browser launched");
  }
  lastAccessTime = Date.now();
  startTimeoutCheck();
  return browserInstance;
}

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
    if (Date.now() - lastAccessTime > TIMEOUT) {
      console.log(`Closing browser due to inactivity for ${TIMEOUT}ms`);
      await closeBrowser();
    }
  }, 60000); // 每分钟检查一次
}

export default async function (
  url: string,
  parser: BaseParser,
  onSuccess: (data: unknown) => void,
  onFail: (error: string | Error) => void,
) {
  const browser = await getBrowser();
  const page: Page = await browser.newPage();

  const responseHandler = async (response: HTTPResponse) => {
    const shouldStop = await parser.handleResponse(
      response,
      page,
      onSuccess,
      onFail,
    );
    if (shouldStop && !page.isClosed()) {
      await page.close().catch((err) => {
        logError(`Closing - ${err.stack || err.message}`);
      });
    }
  };

  page.on("response", responseHandler);
  page.once("close", () => {
    page.off("response", responseHandler);
  });

  setTimeout(async () => {
    if (!page.isClosed()) {
      console.log(color.caution(`Force closing page after ${TIMEOUT_PAGE}ms`));
      await page.close().catch((err) => {
        logError(`Force closing - ${err.stack || err.message}`);
      });
    }
    onFail("Timeout");
  }, TIMEOUT_PAGE);

  console.log(`Open page: ${url} - ${color.notice(parser.constructor.name)}`);

  page
    .goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    })
    .catch((err) => {
      logError(`Browser - ${err.stack || err.message}`);
      onFail(err.message);
    });
}
