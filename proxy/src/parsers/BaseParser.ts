import { Response, Page } from "playwright";

export interface BaseParser {
  beforeHandleResponse(page: Page, selector: string);
  handleResponse(
    response: Response,
    page: Page,
    onComplete: (data: unknown) => void,
  ): Promise<boolean>;
}
