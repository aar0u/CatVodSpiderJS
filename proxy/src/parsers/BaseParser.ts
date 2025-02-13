import { HTTPResponse, Page } from "puppeteer";

import { Vod } from "../models/Vod";

export interface BaseParser {
  parse(html: string): { vod: Vod; episodes: string[] };
  handleResponse(
    response: HTTPResponse,
    page: Page,
    onSuccess: (data) => void,
    onFail: (error) => void,
  );
}
