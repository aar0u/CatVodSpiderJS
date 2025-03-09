import { __jsEvalReturn } from "../js/dubo.js";
import * as Utils from "../lib/utils.js";
import { Crypto } from "../js/catvod-assets/js/lib/cat.js";
import "../wrapper/index.js";

async function test() {
  Utils.log("Test started");

  //"../js/dubo.js";
  let spider = __jsEvalReturn();
  await spider.init({
    ext: {
      box: "TVBox",
    },
    stype: 3,
  });
  // await spider.detail("30786");


  spider = (await import("../js/yhdm.js")).__jsEvalReturn();
  // await spider.home(true);
  // await spider.search("浪客剑心");
  await spider.detail("/video/9013.html");
  // await spider.play("播放源1", "/play/7544-1-22.html")

  // const { __jsEvalReturn } = await import( "../js/123anime.js")
  // spider = __jsEvalReturn();
  // await spider.category("/genere/Sports", 2, true, {});
  // await spider.detail("/anime/pokemon-2023-dub");
  // await spider.play("线路1", "/anime/pokemon-2023-dub/episode/005");
}

await test();
