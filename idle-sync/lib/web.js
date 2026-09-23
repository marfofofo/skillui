// Server HTTPS: certificato locale, file statici, JSON e indirizzi di rete.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { config } from "./config.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

export function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
}

export function baseUrl() {
  const host = lanAddresses()[0] ?? "localhost";
  return `${config.https ? "https" : "http"}://${host}:${config.port}`;
}

// Safari su iOS consente il microfono solo su HTTPS: generiamo un certificato locale.
function ensureCertificate() {
  const key = path.join(config.dataDir, "key.pem");
  const cert = path.join(config.dataDir, "cert.pem");
  if (!existsSync(key) || !existsSync(cert)) {
    const san = ["DNS:localhost", `DNS:${config.host}.local`, ...lanAddresses().map((ip) => `IP:${ip}`)].join(",");
    const base = ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "825", "-subj", "/CN=IDLE SYNC"];
    try {
      execFileSync("openssl", [...base, "-addext", `subjectAltName=${san}`], { stdio: "ignore" });
    } catch {
      execFileSync("openssl", base, { stdio: "ignore" });
    }
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

export function createWebServer(handler) {
  return config.https ? https.createServer(ensureCertificate(), handler) : http.createServer(handler);
}

export function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.resolve(config.publicDir, rel);
  if (!file.startsWith(config.publicDir + path.sep) || !existsSync(file)) {
    sendJson(res, 404, { error: "Non trovato" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  res.end(readFileSync(file));
}

export function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export function readJson(req, limit = 16_384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("Richiesta troppo grande"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("JSON non valido"));
      }
    });
    req.on("error", reject);
  });
}

export function clientIp(req) {
  return req.socket.remoteAddress ?? "?";
}
