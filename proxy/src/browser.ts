import puppeteer, { Browser, HTTPResponse, Page } from "puppeteer";

let browserInstance: Browser | null = null;
let lastAccessTime = Date.now();
let timeoutId: NodeJS.Timeout | null = null;

const MIN = 60 * 1000;
const TIMEOUT = 20 * MIN;
const TIMEOUT_PAGE = 2 * MIN;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: false,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--window-size=720,800",
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

export default async function (url, handler, onSuccess, onFail) {
  const browser = await getBrowser();
  const page: Page = await browser.newPage();
  page.setViewport(null);

  const responseHandler = async (response: HTTPResponse) => {
    const shouldStop = await handler(response, page, onSuccess, onFail);
    if (shouldStop) {
      page.off("response", responseHandler);
      page.close().catch(console.error);
    }
  };

  page.on("response", responseHandler);

  setTimeout(async () => {
    if (!page.isClosed()) {
      page.off("response", responseHandler);
      console.log(`Force closing page after ${TIMEOUT_PAGE}ms`);
      page.close().catch(console.error);
      onFail("Timeout");
    }
  }, TIMEOUT_PAGE);

  console.log(`Navigate to ${url}`);
  page
    .goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    })
    .catch((error) => console.error(`Error on browser: ${error}`));
}
