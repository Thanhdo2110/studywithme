/**
 * Local helper server for the StudyWithMe marketing video:
 *  - serves the project statically (so assets/fonts/images resolve)
 *  - accepts POST /upload?name=... and writes the file into marketing/
 *    (name may contain a sub folder, e.g. frames/f00001.jpg)
 *
 * Usage: node marketing/render-server.cjs [port]
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.argv[2] || 5199);
const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(__dirname);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/upload") {
    const raw = url.searchParams.get("name") || "out.bin";
    const name = raw.replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\.\./g, "_");
    const target = path.join(OUT, name);
    if (!target.startsWith(OUT + path.sep)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const buf = req.headers["x-b64"]
        ? Buffer.from(Buffer.concat(chunks).toString("utf8"), "base64")
        : Buffer.concat(chunks);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
      if (!url.searchParams.get("quiet")) {
        console.log(`saved ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, name, bytes: buf.length }));
    });
    return;
  }

  let p = decodeURIComponent(url.pathname);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`render server on http://127.0.0.1:${PORT} (root ${ROOT})`);
});
