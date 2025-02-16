import { IncomingMessage } from "http";
import { TLSSocket } from "tls";

export const getProtocolAndHost = (req: IncomingMessage): string => {
  const isHttps = (req.socket as TLSSocket)?.encrypted;
  const protocol = isHttps ? "https" : "http";
  const host = req.headers.host || "localhost";
  return `${protocol}://${host}`;
};
