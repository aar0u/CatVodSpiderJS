import fs from "fs";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { fileURLToPath } from "url";

import mime from "mime-types";

import { color, getOrigin } from "../utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const fileController = (baseDir: string) => {
  return {
    async handle(req: IncomingMessage, res: ServerResponse) {
      try {
        const method = req.method || "GET";
        const userAgent = req.headers["user-agent"] || "unknown";

        console.log(
          `${color.success(method)} ${color.info(req.url || "/")} "${color.notice(userAgent)}"`,
        );

        const url = new URL(req.url || "", getOrigin(req));
        const baseDirName = path.basename(path.resolve(baseDir));
        const relativePath = url.pathname.replace(
          new RegExp(`^/(${baseDirName})/`),
          "",
        );
        const filePath = path.join(__dirname, baseDir, relativePath);

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end("File not found");
          return;
        }

        // 读取文件内容
        const fileContent = fs.readFileSync(filePath);

        // 动态设置 Content-Type
        const contentType = mime.lookup(filePath) || "application/octet-stream";
        res.setHeader("Content-Type", contentType);

        // 返回文件内容
        res.end(fileContent);
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
};
