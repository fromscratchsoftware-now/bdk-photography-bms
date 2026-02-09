/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const esbuild = require("esbuild");

const repoRoot = path.resolve(__dirname, "..");
const entry = path.join(repoRoot, "apps", "web", "src", "main.tsx");
const outDir = path.join(repoRoot, "assets");
const htmlEntry = path.join(repoRoot, "index.html");

function emptyDir(dir) {
  if (typeof fs.rmSync === "function") {
    fs.rmSync(dir, { recursive: true, force: true });
  } else if (fs.existsSync(dir)) {
    // Node 12 fallback.
    fs.rmdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function shortSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

function updateIndexHtmlAssetRefs(jsHash, cssHash) {
  if (!fs.existsSync(htmlEntry)) {
    console.warn(`Missing ${path.relative(repoRoot, htmlEntry)}; skipping asset versioning.`);
    return;
  }

  const raw = fs.readFileSync(htmlEntry, "utf8");
  const next = raw
    .replace(/src="\.\/assets\/app\.js(\?v=[^"]+)?"/g, `src="./assets/app.js?v=${jsHash}"`)
    .replace(/href="\.\/assets\/app\.css(\?v=[^"]+)?"/g, `href="./assets/app.css?v=${cssHash}"`);

  if (next !== raw) {
    fs.writeFileSync(htmlEntry, next, "utf8");
  }
}

async function main() {
  if (!fs.existsSync(entry)) {
    console.error(`Missing entry: ${entry}`);
    process.exit(1);
  }

  emptyDir(outDir);

  await esbuild.build({
    entryPoints: { app: entry },
    outdir: outDir,
    entryNames: "[name]",
    assetNames: "[name]",
    chunkNames: "chunks/[name]-[hash]",
    bundle: true,
    format: "esm",
    platform: "browser",
    // Shared-host deployments often get accessed from older Android WebViews.
    // ES2020 syntax (nullish coalescing / optional chaining) can cause a hard blank page.
    // Target ES2017 for broader compatibility while keeping async/await.
    target: ["es2017"],
    jsx: "automatic",
    loader: {
      ".css": "css"
    },
    define: {
      "process.env.NODE_ENV": "\"production\""
    },
    logLevel: "info",
    minify: true,
    sourcemap: false,
    legalComments: "none"
  });

  const jsOut = path.join(outDir, "app.js");
  const cssOut = path.join(outDir, "app.css");

  if (!fs.existsSync(jsOut)) {
    console.error("Build did not produce assets/app.js");
    process.exit(1);
  }
  if (!fs.existsSync(cssOut)) {
    console.warn("Build did not produce assets/app.css (no CSS imports?)");
  }

  // Version app.js/app.css to defeat overly-aggressive shared-host caching.
  const jsHash = shortSha256(fs.readFileSync(jsOut));
  const cssHash = fs.existsSync(cssOut) ? shortSha256(fs.readFileSync(cssOut)) : jsHash;
  updateIndexHtmlAssetRefs(jsHash, cssHash);

  console.log("Web build complete:");
  console.log(`- ${path.relative(repoRoot, jsOut)}`);
  if (fs.existsSync(cssOut)) {
    console.log(`- ${path.relative(repoRoot, cssOut)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
