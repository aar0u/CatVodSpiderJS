import { __jsEvalReturn } from "../js/123anime.js";
import * as Utils from "../lib/utils.js";
import { Crypto } from "../lib/cat.js";

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

  // await spider.search("one piece");

  // await spider.detail("/anime/pokemon-2023-dub");
  // await spider.detail("30786");

  await spider.play("线路1", "/anime/pokemon-2023-dub/episode/005");
}

await test();
