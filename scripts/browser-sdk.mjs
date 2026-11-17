import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { version } = require("@farcaster/miniapp-sdk/package.json");

// Bundle the public SDK entry, so the pre-hydration script uses the same
// patched dependencies as the application. Firebase caches JS as immutable.
export async function buildBrowserSdk() {
  const result = await build({
    entryPoints: [require.resolve("@farcaster/miniapp-sdk")],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "miniapp",
    minify: true,
    legalComments: "eof",
    write: false,
  });
  const bytes = Buffer.from(result.outputFiles[0].contents);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  return { bytes, path: `/vendor/farcaster-sdk-${version}/index.${hash}.min.js` };
}
