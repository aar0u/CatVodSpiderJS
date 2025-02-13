import { BaseParser } from "./BaseParser";
import { Parser123Anime } from "./Parser123Anime";

export const parserFactory = {
  createParser(url: string): BaseParser {
    if (url.includes("123anime")) {
      return new Parser123Anime();
    } else if (url === "test") {
      return new Parser123Anime();
    }
    throw new Error("Unsupported parser type");
  },
};
