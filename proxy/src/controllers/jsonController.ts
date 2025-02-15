import { IncomingMessage, ServerResponse } from "http";

import axios from "axios";

export const jsonController = {
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const response = await axios.get("http://tv.999888987.xyz", {
        headers: { "User-Agent": "okhttp/5.0.0-alpha.14" },
      });

      // 过滤掉 sites 中 name 包含 💓 的项 (网盘)
      const filteredData = {
        ...response.data,
        sites: response.data.sites.filter(
          (site: { name: string }) => !site.name.includes("💓"),
        ),
      };

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(filteredData));
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: "Failed to fetch or process data",
          details: error.message,
        }),
      );
    }
  },
};
