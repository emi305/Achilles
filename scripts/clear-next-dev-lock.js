const fs = require("node:fs");
const path = require("node:path");

const lockPath = path.join(process.cwd(), ".next", "dev", "lock");

try {
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
    console.log("[predev] Removed stale .next/dev/lock");
  } else {
    console.log("[predev] No .next/dev/lock found");
  }
} catch (error) {
  console.error("[predev] Failed to clear .next/dev/lock:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
