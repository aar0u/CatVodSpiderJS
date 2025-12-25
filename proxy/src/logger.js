import fs from "fs";

const LOG_FILE = process.env.LOG_FILE || "app.log";
const MAX_LOG_SIZE = parseInt(process.env.MAX_LOG_SIZE, 10) || 5 * 1024 * 1024; // 5 MB

function checkLogSize() {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > MAX_LOG_SIZE) {
      fs.truncateSync(LOG_FILE, 0);
    }
  } catch {
    // ignore errors
  }
}

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
logStream.on("error", (err) => {
  // fallback: print to console if log file fails
  console.error("Logger stream error:", err);
});

function formatLog(level, args) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ` + args.map(String).join(" ") + "\n";
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function (...args) {
  originalLog.apply(console, args);
  checkLogSize();
  logStream.write(formatLog("INFO", args));
};

console.error = function (...args) {
  originalError.apply(console, args);
  checkLogSize();
  logStream.write(formatLog("ERROR", args));
};

console.warn = function (...args) {
  originalWarn.apply(console, args);
  checkLogSize();
  logStream.write(formatLog("WARN", args));
};
