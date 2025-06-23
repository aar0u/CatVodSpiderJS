import * as Utils from "../lib/utils.js";
import "../wrapper/index.js";

// 定义测试用例
const testCases = {
  dubo: {
    enabled: false,
    init: { ext: {}, stype: 3 },
    tests: [{ enabled: true, fn: "detail", args: ["30786"] }],
  },
  yhdm: {
    enabled: false,
    init: { ext: {}, stype: 3 },
    tests: [
      { enabled: true, fn: "home", args: [true] },
      { enabled: true, fn: "search", args: ["浪客剑心"] },
      { enabled: true, fn: "detail", args: ["/video/9013.html"] },
      { enabled: true, fn: "play", args: ["播放源1", "/play/7544-1-22.html"] },
    ],
  },
  "123anime": {
    enabled: false,
    init: { ext: {}, stype: 3 },
    tests: [
      { enabled: true, fn: "category", args: ["/home", 1, true, {}] },
      { enabled: false, fn: "category", args: ["/genere/Sports", 1, true, {}] },
      {
        enabled: false,
        fn: "detail",
        args: ["/anime/fanren-xiu-xian-chuan-xinghai-feichi"],
      },
      { enabled: false, fn: "detail", args: ["/anime/pokemon-2023-dub"] },
      {
        enabled: false,
        fn: "play",
        args: ["线路1", "/anime/pokemon-2023-dub/episode/005"],
      },
    ],
  },
  "9anime": {
    enabled: true,
    init: { ext: {}, stype: 3 },
    tests: [
      { enabled: true, fn: "home", args: [true] },
      { enabled: true, fn: "search", args: ["One Piece"] },
      { enabled: false, fn: "category", args: ["/genere/Sports", 2, true, {}] },
      { enabled: false, fn: "detail", args: ["/watch/one-piece-100"] },
      {
        enabled: false,
        fn: "play",
        args: ["线路1", "/watch/one-piece-100?ep=94047"],
      },
    ],
  },
};

async function runTest(spiderName, config) {
  if (!config.enabled) return;

  Utils.log(`Testing ${spiderName}...`);
  const spider = (await import(`../js/${spiderName}.js`)).__jsEvalReturn();
  await spider.init(config.init);

  for (const test of config.tests) {
    if (!test.enabled) continue;
    Utils.log(`Running ${test.fn}...`);
    await spider[test.fn](...test.args);
  }
}

async function test() {
  Utils.log("Test started");

  for (const [name, config] of Object.entries(testCases)) {
    await runTest(name, config);
  }
}

await test();
