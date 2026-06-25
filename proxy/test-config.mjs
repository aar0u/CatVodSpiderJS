#!/usr/bin/env node
import crypto from "crypto";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TEST_SOURCE = "饭太硬";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

function resolveOutputPath(target, outputArg) {
  if (outputArg) {
    return path.resolve(process.cwd(), outputArg);
  }
  return path.join(__dirname, "output", `${sanitizeFileName(target)}.json`);
}

function writeOutput(data, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(`[SUCCESS] 已输出 JSON: ${outputPath}`);
}

function loadConfig() {
  const configPath = path.join(__dirname, "src/config/cfg.json");
  const data = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(data);
}

function base64Decode(data) {
  const extract = data.match(/[A-Za-z0-9]{8}\*\*(.*)/)?.[1] || "";
  return Buffer.from(extract, "base64").toString("utf-8");
}

function aesDecrypt(data) {
  try {
    const decode = Buffer.from(data, "hex").toString("utf-8").toLowerCase();
    const key = decode.match(/\$#(.*?)#\$/)?.[1] || "";
    const paddedKey = (key + "0".repeat(16)).slice(0, 16);
    const iv = (decode.slice(-13) + "0".repeat(16)).slice(0, 16);
    const decipher = crypto.createDecipheriv("aes-128-cbc", paddedKey, iv);
    const encryptedData = data.slice(data.indexOf("2324") + 4, -26);
    return decipher.update(encryptedData, "hex", "utf-8") + decipher.final("utf-8");
  } catch {
    throw new Error("Decryption failed");
  }
}

function processData(data) {
  if (data.includes("**")) {
    console.log("[INFO] 检测到 Base64 编码，正在解码...");
    data = base64Decode(data);
  }
  if (data.startsWith("2423")) {
    console.log("[INFO] 检测到 AES 加密，正在解密...");
    data = aesDecrypt(data);
  }
  return data;
}

async function fetchAndProcess(url, name) {
  console.log(`\n=== 测试: ${name} ===`);
  console.log(`URL: ${url}`);

  if (!url) {
    console.log("[WARN] URL 为空，跳过此源");
    return null;
  }

  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "okhttp/5.0.0-alpha.14" },
      timeout: 30000,
    });

    if (typeof response.data === "string") {
      const processed = processData(response.data).replace(/^\s*?\/\/.*?\r?\n/gm, "");
      try {
        const jsonData = JSON.parse(processed);
        console.log(`[SUCCESS] 站点数量: ${jsonData.sites?.length || 0}`);
        console.log(`[SUCCESS] Spider: ${jsonData.spider || "N/A"}`);
        return jsonData;
      } catch {
        console.error("[ERROR] JSON 解析失败");
      }
    } else {
      console.log(`[INFO] 站点数量: ${response.data.sites?.length || 0}`);
      return response.data;
    }
  } catch (error) {
    console.error(`[ERROR] 请求失败: ${error.message}`);
    return null;
  }
}

async function main() {
  const config = loadConfig();
  const target = process.argv[2] || TEST_SOURCE;
  const outputPath = resolveOutputPath(target, process.argv[3]);
  const url = config.sources[target];

  if (url) {
    const data = await fetchAndProcess(url, target);
    if (data) {
      writeOutput(data, outputPath);
    }
  } else {
    console.log(`[ERROR] 未找到源: ${target}`);
    console.log(`[INFO] 可用源: ${Object.keys(config.sources).join(", ")}`);
  }
}

main().catch(console.error);
