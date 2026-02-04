import crypto from "crypto";
import fs from "fs/promises";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { fileURLToPath } from "url";

import axios from "axios";

import { replaceUrlsInJson } from "../cache/resourceCache";
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
  const cacheKey = crypto.createHash("md5").update(url).digest("hex");
  const cacheDir = path.join(__dirname, "../../static/cache");
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);

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

    // 保存到缓存
    await fs.mkdir(cacheDir, { recursive: true });

    const cacheData = {
      ...jsonData,
      _cached: false,
      _cacheTime: new Date().toISOString(),
    };
    await fs.writeFile(cachePath, JSON.stringify(cacheData), "utf-8");
    console.log(`[JSON CACHE] Saved new config for ${url}`);

    return jsonData;
  } catch (error) {
    console.error(`Failed to fetch config from ${url}:`, error.message);

    // 如果获取失败，尝试返回缓存
    try {
      const cachedData = await fs.readFile(cachePath, "utf-8");
      const parsedCache = JSON.parse(cachedData);
      console.log(`[JSON CACHE] Fallback to cached config for ${url}`);
      return {
        ...parsedCache,
        _cached: true,
        _cacheTime: parsedCache._cacheTime,
      };
    } catch {
      // 缓存也不存在，返回null
      return null;
    }
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
      const host = req.headers.host || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const forwarded =
        req.headers["x-forwarded-for"] || req.headers["x-real-ip"];

      let logMsg = `[jsonController] ${req.method}: ${req.url}\n`;
      logMsg += `  Host: ${host}\n`;
      logMsg += `  UA: ${userAgent}\n`;
      logMsg += `  IP: ${forwarded ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]) : "unknown"}\n`;

      if (body) {
        const bodyLog =
          body.length > 200
            ? `${body.slice(0, 200)}… (${body.length} chars)`
            : body;
        logMsg += `  Body: ${bodyLog}\n`;
      }

      console.log(logMsg);
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
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

      // 替换远程资源URL为本地缓存URL
      const processedData = (await replaceUrlsInJson(
        filteredData,
        host,
      )) as Record<string, unknown>;

      res.end(JSON.stringify(processedData));
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
