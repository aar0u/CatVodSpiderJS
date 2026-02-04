import crypto from "crypto";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 缓存目录
const CACHE_DIR = path.join(__dirname, "../../static/cache");

// 需要缓存的域名列表
const CACHE_DOMAINS = [
  "aisearch.cdn.bcebos.com",
  "storage.7x24cc.com",
  "support-chat.rongcloud.cn",
  "oss4liview.moji.com",
];

// 跟踪正在下载的资源，避免重复下载
// key: url, value: md5
const downloadingResources = new Map<string, string | null>();

// 初始化缓存目录
async function ensureCacheDir(): Promise<void> {
  try {
    await fsPromises.access(CACHE_DIR);
  } catch {
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
  }
}

// 从URL中提取文件名，确保唯一性
function getFileNameFromUrl(url: string): string {
  // 提取MD5前面的部分作为实际下载URL
  const downloadUrl = url.split(";md5;")[0];
  const urlObj = new URL(downloadUrl);
  const pathname = urlObj.pathname;
  let fileName = path.basename(pathname) || "file";

  // 如果URL中有MD5，使用MD5作为文件名，确保唯一性
  const md5Match = url.match(/;md5;([a-f0-9]{32})/i);
  if (md5Match) {
    const md5 = md5Match[1].toLowerCase();
    const ext = path.extname(fileName);
    fileName = `${md5}${ext}`;
  } else {
    // 如果没有MD5，使用URL的hash作为文件名前缀，确保唯一性
    const urlHash = crypto
      .createHash("md5")
      .update(url)
      .digest("hex")
      .substring(0, 8);
    const ext = path.extname(fileName);
    const nameWithoutExt = path.basename(fileName, ext);
    fileName = `${nameWithoutExt}_${urlHash}${ext}`;
  }

  return fileName;
}

// 获取实际下载URL（去除MD5部分）
function getDownloadUrl(url: string): string {
  return url.split(";md5;")[0];
}

// 从URL中提取MD5（如果存在）
function extractMd5FromUrl(url: string): string | null {
  const md5Match = url.match(/;md5;([a-f0-9]{32})/i);
  return md5Match ? md5Match[1].toLowerCase() : null;
}

// 计算文件的MD5
async function calculateMd5(filePath: string): Promise<string> {
  try {
    const data = await fsPromises.readFile(filePath);
    return crypto.createHash("md5").update(data).digest("hex");
  } catch (error) {
    console.error(`Failed to calculate MD5 for ${filePath}:`, error);
    throw error;
  }
}

// 检查URL是否需要缓存
function shouldCacheUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return CACHE_DOMAINS.some((domain) => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

// 下载文件并保存到缓存
async function downloadAndCache(
  url: string,
  localPath: string,
  reason: string = "UNKNOWN",
): Promise<void> {
  const downloadUrl = getDownloadUrl(url);
  const timeoutMs = 30 * 60 * 1000; // 30分钟超时
  console.log(
    `[ASYNC DOWNLOAD] Starting download (${reason}): ${downloadUrl} (timeout: ${timeoutMs}ms)`,
  );

  try {
    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      timeout: timeoutMs,
    });

    // 设置心跳定时器，每30秒打印一次心跳
    const heartbeatInterval = setInterval(() => {
      console.log(`[ASYNC DOWNLOAD] Still downloading... ${downloadUrl}`);
    }, 30000);

    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        clearInterval(heartbeatInterval);
        resolve();
      });
      writer.on("error", (error) => {
        clearInterval(heartbeatInterval);
        console.error(`[ASYNC DOWNLOAD] Error: ${downloadUrl}`, error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`[ASYNC DOWNLOAD] Failed: ${downloadUrl}`, error);
    throw error;
  }
}

// 获取缓存的本地URL
async function getCachedUrl(url: string, baseUrl: string): Promise<string> {
  if (!shouldCacheUrl(url)) {
    return url;
  }

  await ensureCacheDir();

  const fileName = getFileNameFromUrl(url);
  const localPath = path.join(CACHE_DIR, fileName);

  // 提取原始URL中的MD5部分
  const md5Part = url.includes(";md5;")
    ? url.substring(url.indexOf(";md5;"))
    : "";
  const localUrl = `${baseUrl}/cache/${fileName}${md5Part}`;

  // 检查文件是否存在
  try {
    await fsPromises.access(localPath);

    // 如果文件存在，检查MD5是否匹配
    const expectedMd5 = extractMd5FromUrl(url);
    if (expectedMd5) {
      const actualMd5 = await calculateMd5(localPath);
      if (actualMd5 === expectedMd5) {
        console.log(
          `[SYNC CACHE] Using cached file with valid MD5: ${localUrl}`,
        );
        return localUrl;
      }
      console.log(
        `[SYNC CACHE] MD5 mismatch for ${fileName}, re-downloading...`,
      );
    } else {
      // 没有MD5信息，但文件存在，直接使用
      console.log(`[SYNC CACHE] Using cached file: ${localUrl}`);
      return localUrl;
    }
  } catch {
    console.log(`[SYNC CACHE] Cached file not found, need to download...`);
  }

  // 如果缓存不存在或MD5不匹配，启动异步下载但不等待
  // 先检查是否已经在下载中，避免重复下载
  const expectedMd5 = extractMd5FromUrl(url);

  // 检查是否有相同URL或相同MD5的资源正在下载
  let isAlreadyDownloading = false;

  // 检查URL是否已在下载
  if (downloadingResources.has(url)) {
    isAlreadyDownloading = true;
  }

  // 如果有MD5，检查是否有相同MD5的资源正在下载
  if (expectedMd5) {
    for (const [, md5] of downloadingResources.entries()) {
      if (md5 === expectedMd5) {
        isAlreadyDownloading = true;
        break;
      }
    }
  }

  if (isAlreadyDownloading) {
    const reason = expectedMd5 ? "MD5" : "URL";
    console.log(`[ASYNC DOWNLOAD] Already downloading (${reason}): ${url}`);
    return url;
  }

  // 标记为正在下载
  downloadingResources.set(url, expectedMd5);

  // 判断是第一次下载还是MD5改变下载
  let downloadReason = "FIRST_DOWNLOAD";
  try {
    await fsPromises.access(localPath);
    // 文件存在，检查MD5是否匹配
    if (expectedMd5) {
      const actualMd5 = await calculateMd5(localPath);
      if (actualMd5 !== expectedMd5) {
        downloadReason = "MD5_CHANGED";
      }
    }
  } catch {
    // 文件不存在，是第一次下载
    downloadReason = "FIRST_DOWNLOAD";
  }

  // 先返回原始URL，让客户端可以继续工作
  downloadAndCache(url, localPath, downloadReason)
    .then(async () => {
      // 验证MD5（如果提供）
      const expectedMd5 = extractMd5FromUrl(url);
      if (expectedMd5) {
        const actualMd5 = await calculateMd5(localPath);
        if (actualMd5 !== expectedMd5) {
          console.error(
            `MD5 verification failed for ${fileName}: expected ${expectedMd5}, got ${actualMd5}`,
          );
          return;
        }
        console.log(`MD5 verification passed for ${fileName}`);
      }

      console.log(
        `[ASYNC DOWNLOAD] Completed (${downloadReason}): ${localUrl}`,
      );
    })
    .catch((error) => {
      console.error(`Async download failed for ${url}:`, error);
    })
    .finally(() => {
      // 下载完成后，从下载集合中移除资源
      downloadingResources.delete(url);
    });

  // 返回原始URL，让客户端可以继续工作
  console.log(`Cache not ready, returning original URL: ${url}`);
  return url;
}

// 替换JSON对象中的URL
export async function replaceUrlsInJson(
  obj: unknown,
  baseUrl: string,
): Promise<unknown> {
  if (typeof obj === "string") {
    // 检查是否是URL
    if (obj.startsWith("http")) {
      return getCachedUrl(obj, baseUrl);
    }
    return obj;
  } else if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => replaceUrlsInJson(item, baseUrl)));
  } else if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await replaceUrlsInJson(value, baseUrl);
    }
    return result;
  }
  return obj;
}

// 初始化缓存目录
ensureCacheDir().catch(console.error);
