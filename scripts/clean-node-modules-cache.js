/**
 * Remove node_modules/.cache before npm ci (Render/Railway EBUSY rmdir fix).
 */
const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), "node_modules", ".cache");

try {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
} catch {
  /* ignore — directory may not exist */
}
