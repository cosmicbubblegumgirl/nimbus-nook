const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json"
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = decodeURIComponent(url.pathname);
    if (file === "/") file = "/index.html";
    const full = path.normalize(path.join(root, file));
    if (!full.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(full, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(full)] || "application/octet-stream"
      });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Nimbus Nook running at http://127.0.0.1:${port}`);
  });
