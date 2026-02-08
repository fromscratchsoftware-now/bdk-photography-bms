/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const repoRoot = path.resolve(__dirname, "..");
const entry = path.join(repoRoot, "apps", "web", "src", "main.tsx");
const outDir = path.join(repoRoot, "assets");

function emptyDir(dir) {
  if (typeof fs.rmSync === "function") {
    fs.rmSync(dir, { recursive: true, force: true });
  } else if (fs.existsSync(dir)) {
    // Node 12 fallback.
    fs.rmdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
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
    target: ["es2020"],
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
