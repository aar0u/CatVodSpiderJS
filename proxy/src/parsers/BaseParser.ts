import { HTTPResponse, Page } from "puppeteer";

export interface BaseParser {
  beforeHandleResponse(page, selector: string);
  handleResponse(
    response: HTTPResponse,
    page: Page,
    onSuccess: (data) => void,
    onFail: (error) => void,
  );
}
