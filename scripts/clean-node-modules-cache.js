/**
 * Remove node_modules (and .cache) before npm ci — fixes Railway/Render EBUSY rmdir.
 */
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function rmWithRetry(target) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      fs.rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200,
      });
      return;
    } catch (err) {
      const code = err && typeof err === "object" ? err.code : null;
      if (code !== "EBUSY" && code !== "EPERM" && code !== "ENOTEMPTY") {
        throw err;
      }
      sleep(200 + attempt * 100);
    }
  }
}

const root = process.cwd();
const cacheDir = path.join(root, "node_modules", ".cache");
const nodeModules = path.join(root, "node_modules");

if (fs.existsSync(cacheDir)) {
  rmWithRetry(cacheDir);
}

if (fs.existsSync(nodeModules)) {
  rmWithRetry(nodeModules);
}
