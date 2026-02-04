import crypto from "crypto";
import fs from "fs/promises";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { fileURLToPath } from "url";

import axios from "axios";

import { color, getOrigin } from "../utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base64 解码
function base64Decode(data: string): string {
  const extract = data.match(/[A-Za-z0-9]{8}\*\*(.*)/)?.[1] || "";
  return Buffer.from(extract, "base64").toString("utf-8");
}

// AES-CBC 解密
function aesDecrypt(data: string): string {
  try {
    const decode = Buffer.from(data, "hex").toString("utf-8").toLowerCase();
    const keyMatch = decode.match(/\$#(.*?)#\$/);
    const key = keyMatch ? padEnd(keyMatch[1], 16) : "";
    const iv = padEnd(decode.slice(-13), 16);
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    const encryptedData = data.slice(data.indexOf("2324") + 4, -26); // 提取加密部分
    let decrypted = decipher.update(encryptedData, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
  } catch (error) {
    console.error("AES decryption failed:", error);
    throw new Error("Decryption failed"); // 抛出错误以便上层处理
  }
}

function padEnd(str: string, length: number): string {
  return (str + "0".repeat(length)).slice(0, length);
}

// 验证并解密数据
function verifyAndDecrypt(data: string): string {
  if (data.includes("**")) data = base64Decode(data);
  if (data.startsWith("2423")) data = aesDecrypt(data);
  return data;
}

async function fetchConfigData(
  url: string,
): Promise<{ sites: Record<string, unknown>[]; spider?: string } | null> {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "okhttp/5.0.0-alpha.14" },
      timeout: 10000,
    });

    let jsonData: { sites: Record<string, unknown>[]; spider?: string };
    if (typeof response.data === "string") {
      const decryptedData = verifyAndDecrypt(response.data);
      const cleanedData = decryptedData.replace(/^\s*?\/\/.*?\r?\n/gm, ""); // 移除注释
      jsonData = JSON.parse(cleanedData);
    } else {
      jsonData = response.data;
    }
    return jsonData;
  } catch (error) {
    console.error(`Failed to fetch config from ${url}:`, error.message);
    return null;
  }
}

export const jsonController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    // Log request details
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let logMsg = "[jsonController] Incoming request:\n";
      logMsg += `  Method: ${req.method}\n`;
      logMsg += `  URL: ${req.url}\n`;
      logMsg += `  Headers: ${JSON.stringify(req.headers, null, 2)}\n`;
      if (body) {
        logMsg += `  Body: ${body}\n`;
      }
      console.log(logMsg);
    });

    try {
      const host = getOrigin(req);
      const url = new URL(req.url || "", host);

      const urls = JSON.parse(
        await fs.readFile(path.join(__dirname, "../config/cfg.json"), "utf-8"),
      );

      const config = url.searchParams.get("cf") || urls.default;
      const cfUrl = urls.sources[config];
      console.log(`Retrieving ${color.info(config)} from ${cfUrl}`);

      const cfgData = await fetchConfigData(cfUrl);
      if (!cfgData) {
        throw new Error(`Failed to fetch main config from ${cfUrl}`);
      }

      let allSites = cfgData.sites || [];
      if (config !== "饭太硬" && urls.sources["饭太硬"]) {
        console.log(`Additionally retrieving "饭太硬" for "秒播" sites`);
        const ftyData = await fetchConfigData(urls.sources["饭太硬"]);
        if (ftyData && ftyData.sites) {
          const ftySites = ftyData.sites
            .filter(
              (site: { name: string }) =>
                site.name && site.name.includes("秒播"),
            )
            .map((site: { name: string }) => ({
              ...site,
              name: `[饭]${site.name}`,
              jar: ftyData.spider,
            }));
          allSites = [...allSites, ...ftySites];
        }
      }

      // 过滤 sites
      const ignoreKeywords = ["💓", "🎠", "盘", "玩偶", "配置"];
      const keepKeys = ["WexZhaoPansoGuard", "Wexconfig"];
      const priorityKeys = ["WexkuihuatvGuard", "Wexwencai"];

      const filteredSites = allSites
        .map((site: { key: string; name: string; changeable?: number }) => {
          if (
            !new Set([...keepKeys, ...priorityKeys]).has(site.key) &&
            ignoreKeywords.some((keyword) => site.name.includes(keyword))
          ) {
            console.log(
              `${color.muted("Ignored")} site:`,
              JSON.stringify(site),
            );
            return null; // 标记为忽略
          }
          const changeable = priorityKeys.includes(site.key) ? 1 : 0;
          return {
            ...site,
            originalChangeable: site.changeable,
            changeable,
          };
        })
        .filter((site) => site !== null)
        .sort((a, b) => b.changeable - a.changeable);

      const sitesPath = path.join(__dirname, "../config/sites.json");
      const sitesData = await fs.readFile(sitesPath, "utf-8");
      const newSites = JSON.parse(sitesData);

      const filteredData = {
        ...cfgData,
        sites: [...newSites, ...filteredSites], // 将 newSites 放在第一个位置
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
