import path from "path";

import AdmZip from "adm-zip";
import axios from "axios";

import { color } from "./color";
import { setCache } from "../cache/cache";

export async function retrieveSubtitle(
  name: string,
  episode: number,
  targetUrl: string,
): Promise<string | null> {
  console.log(`Retrieving subtitle from ${targetUrl}`);

  const response = await axios.get(targetUrl, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": "Chrome/120.0.0.0",
    },
  });

  const zip = new AdmZip(response.data);
  const zipEntries = zip.getEntries();

  // Find the first supported subtitle file
  let subtitleEntry = null;
  const supportedFormats = [".srt", ".vtt", ".ass", ".ssa"];
  zipEntries.forEach((entry) => {
    if (
      !subtitleEntry &&
      supportedFormats.some((format) => entry.entryName.endsWith(format))
    ) {
      subtitleEntry = entry;
    }
  });

  if (subtitleEntry) {
    console.log(`${color.info("Found")} ${subtitleEntry.entryName}`);
    const subtitleContent = subtitleEntry.getData().toString("utf8");
    const subId = `${name}-${episode}${path.extname(subtitleEntry.entryName)}`;
    setCache(subId, subtitleContent);
    return subId;
  }

  return null;
}
