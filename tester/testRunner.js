// import { __jsEvalReturn } from "../js/dubo.js";
import { __jsEvalReturn } from "../js/yhdm.js";
import * as Utils from "../lib/utils.js";
import { Crypto } from "../js/catvod-assets/js/lib/cat.js";

import "../wrapper/index.js";

let spider = __jsEvalReturn();

async function test() {
  await spider.init({
    ext: {
      box: "TVBox",
    },
    stype: 3,
  });

  Utils.log("Test started");

  // await spider.home(true);

  // await spider.category("/genere/Sports", 2, true, {});

  // await spider.search("斗破");

  // await spider.detail("/anime/pokemon-2023-dub");

  //"../js/yhdm.js";
  // await spider.detail("/video/7544.html");

  //"../js/dubo.js";
  // await spider.detail("30786");

  // "../js/yhdm.js";
  await spider.play("ABC", "/play/7544-1-22.html")
  
  // await spider.play("线路1", "/anime/pokemon-2023-dub/episode/005");
}

await test();
