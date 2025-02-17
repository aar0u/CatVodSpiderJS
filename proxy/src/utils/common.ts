import { IncomingMessage } from "http";
import { TLSSocket } from "tls";

import { color } from "./color";

export const getOrigin = (req: IncomingMessage): string => {
  const isHttps = (req.socket as TLSSocket)?.encrypted;
  const protocol = isHttps ? "https" : "http";
  const host = req.headers.host || "localhost";
  return `${protocol}://${host}`;
};

export const logError = (message: string) => {
  console.error(`${color.danger("[ERROR]")} ${message}`);
};

export const logSuccess = (message: string) => {
  console.log(`${color.success("[SUCCESS]")} ${message}`);
};

export const normalizeUrl = (url: string): string => {
  return url.endsWith("/") ? url.slice(0, -1) : url;
};
