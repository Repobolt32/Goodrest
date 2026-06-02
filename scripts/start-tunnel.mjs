#!/usr/bin/env node
// start-tunnel.mjs — Start tunnel for dev server access from mobile.
// Uses Cloudflare Tunnel (cloudflared) by default — stable, no subdomain hijack.
// Usage: node scripts/start-tunnel.mjs [PORT]
// Default port: 3000

import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2] || "3000", 10);
const CLOUDFLARED = resolve(__dirname, "bin", "cloudflared.exe");

console.log(`Starting Cloudflare Tunnel on port ${PORT}...`);
console.log(`(No subdomain needed — cloudflared provides a stable URL automatically)\n`);

const proc = spawn(CLOUDFLARED, ["tunnel", "--url", `http://localhost:${PORT}`], {
  stdio: ["ignore", "pipe", "pipe"],
});

let urlPrinted = false;

proc.stdout.on("data", (data) => {
  const text = data.toString();
  process.stdout.write(text);
  // Capture the trycloudflare.com URL from output
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !urlPrinted) {
    urlPrinted = true;
    const url = match[0];
    console.log(`\n  Tunnel:   ${url}`);
    console.log(`  APK URL:  ${url}/rider/dashboard\n`);
    console.log(`  ⚠ Update capacitor.config.json server.url to: ${url}/rider/dashboard`);
    console.log(`  Then rebuild APK.\n`);
  }
});

proc.stderr.on("data", (data) => {
  const text = data.toString();
  process.stderr.write(text);
  // cloudflared prints the URL to stderr too
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !urlPrinted) {
    urlPrinted = true;
    const url = match[0];
    console.log(`\n  Tunnel:   ${url}`);
    console.log(`  APK URL:  ${url}/rider/dashboard\n`);
    console.log(`  ⚠ Update capacitor.config.json server.url to: ${url}/rider/dashboard`);
    console.log(`  Then rebuild APK.\n`);
  }
});

proc.on("close", (code) => {
  console.log(`Tunnel closed (exit code ${code}).`);
  process.exit(code || 0);
});

process.on("SIGINT", () => {
  proc.kill("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  proc.kill("SIGTERM");
  process.exit(0);
});