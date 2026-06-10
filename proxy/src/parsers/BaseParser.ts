import { Response, Page } from "playwright";

export interface BaseParser {
  beforeHandleResponse(page: Page, selector: string | string[]);
  handleResponse(
    response: Response,
    page: Page,
    onComplete: (data: unknown) => void,
  ): Promise<boolean>;
}
