import { chromium } from "playwright";

import { applyLightweightStealth } from "./src/stealth";

const DEFAULT_URL = "https://9anime.blue/anime/ahiru-no-sora/episode-21/";

const SECOND = 1000;
const targetUrl = process.env.URL || DEFAULT_URL;
const headless = process.env.HEADLESS !== "false";
const useStealth = process.env.STEALTH !== "false";
const logConsole = process.env.LOG_CONSOLE === "true";
const waitMs = parseInt(process.env.WAIT_SECONDS || "20", 10) * SECOND;

const mediaUrls: string[] = [];

const browser = await chromium.launch({
  headless,
  args: ["--disable-blink-features=AutomationControlled", "--disable-gpu"],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-MY",
    timezoneId: "Asia/Kuala_Lumpur",
  });

  if (useStealth) {
    await applyLightweightStealth(context);
  }

  const page = await context.newPage();

  page.on("response", (response) => {
    const url = response.url();
    if (!/\.(m3u8|mp4)(\?|$)|\/master\.txt|\/playlist/i.test(url)) return;

    const line = `${response.status()} ${url}`;
    mediaUrls.push(line);
    console.log(`[media] ${line}`);
  });

  if (logConsole) {
    page.on("console", (message) => {
      console.log(
        `[console:${message.type()}] ${message.text().replace(/\s+/g, " ").slice(0, 300)}`,
      );
    });
  }

  console.log(
    `[test-browser] url=${targetUrl} headless=${headless} stealth=${useStealth} wait=${waitMs / SECOND}s`,
  );

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45 * SECOND,
  });
  await page.waitForTimeout(8 * SECOND).catch(() => {});

  await clickFirstPlayableControl(page).catch((error) => {
    console.log(`[click] skipped: ${error.message}`);
  });

  await page.waitForTimeout(waitMs).catch(() => {});

  const videoStates = await collectVideoStates(page);

  console.log(`[result] title=${await page.title().catch(() => "")}`);
  console.log(`[result] pageUrl=${page.url()}`);
  console.log(`[result] mediaCount=${mediaUrls.length}`);
  console.log(`[result] videoStates=${JSON.stringify(videoStates, null, 2)}`);
} finally {
  await browser.close().catch(() => {});
}

async function clickFirstPlayableControl(page: import("playwright").Page) {
  for (const frame of page.frames()) {
    const control = frame
      .locator(
        [
          ".jw-icon-playback",
          ".plyr__control",
          "button[aria-label*=Play]",
          "button[title*=Play]",
          "[role=button][aria-label*=Play]",
        ].join(","),
      )
      .first();

    if (!(await control.count().catch(() => 0))) continue;

    await control.click({ timeout: 3000 });
    console.log(`[click] frame=${frame.url()}`);
    return;
  }

  await page.mouse.click(640, 360);
  console.log("[click] fallback page center");
}

async function collectVideoStates(page: import("playwright").Page) {
  const states: unknown[] = [];

  for (const frame of page.frames()) {
    const frameStates = await frame
      .evaluate(() =>
        Array.from(document.querySelectorAll("video")).map((video) => ({
          src: video.currentSrc || video.src,
          paused: video.paused,
          currentTime: video.currentTime,
          readyState: video.readyState,
          networkState: video.networkState,
          error: video.error?.message || video.error?.code || null,
        })),
      )
      .catch(() => []);

    if (frameStates.length) {
      states.push({ frame: frame.url(), videos: frameStates });
    }
  }

  return states;
}
