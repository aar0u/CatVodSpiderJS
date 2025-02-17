import crypto from "crypto";
import { IncomingMessage, ServerResponse } from "http";

import axios from "axios";

import { color, getOrigin } from "../utils";

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

export const jsonController = {
  async handle(req: IncomingMessage, res: ServerResponse) {
    try {
      const host = getOrigin(req);
      const url = new URL(req.url || "", host);
      const config = url.searchParams.get("cf");

      const urls = (await axios.get(`${host}/json/livecfg/mul.json`)).data;
      const cfUrl = urls[config];
      console.log(`Retrieving ${color.info(config)} from ${cfUrl}`);
      const response = await axios.get(cfUrl, {
        headers: { "User-Agent": "okhttp/5.0.0-alpha.14" },
      });

      let jsonData: { sites: { name: string }[] };
      if (typeof response.data === "string") {
        const decryptedData = verifyAndDecrypt(response.data);
        const cleanedData = decryptedData.replace(/^\s*?\/\/.*?\r?\n/gm, ""); // 移除注释
        jsonData = JSON.parse(cleanedData);
      } else {
        jsonData = response.data;
      }

      // 过滤掉 sites 中网盘资源
      const filteredSites = jsonData.sites
        .map((site: { name: string }) => {
          const ignoreKeywords = ["💓", "盘", "玩偶"];
          if (ignoreKeywords.some((keyword) => site.name.includes(keyword))) {
            console.log(
              `${color.muted("Ignored")} site:`,
              JSON.stringify(site),
            );
            return null; // 标记为忽略
          }
          return { ...site, change: 0 }; // 修改 change 为 0
        })
        .filter((site) => site !== null);

      const newSite = {
        api: "./js/123anime.js",
        changeable: 0,
        key: "123animehub",
        name: "B & C",
        searchable: 1,
        timeout: 50,
        ext: {
          box: "TVBox",
        },
        type: 3,
      };

      const filteredData = {
        ...jsonData,
        sites: [newSite, ...filteredSites], // 将 newSite 放在第一个位置
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
