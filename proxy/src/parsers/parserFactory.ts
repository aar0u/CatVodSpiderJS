import { BaseParser } from "./BaseParser";
import { DefaultParser } from "./DefaultParser";

export const parserFactory = {
  createParser(url: string): BaseParser {
    if (url.includes("123anime")) {
      return new DefaultParser();
    } else if (url.includes("9anime")) {
      return new DefaultParser();
    }
    throw new Error("Unsupported parser type");
  },
};
