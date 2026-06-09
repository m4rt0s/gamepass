const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600000;

const cache = new Map();

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key, data) {
    cache.set(key, { data, ts: Date.now() });
}

const MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon"
};

function proxyFetch(targetUrl) {
    return new Promise((resolve, reject) => {
        https.get(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => resolve(data));
        }).on("error", reject);
    });
}

async function cachedFetch(url) {
    const hit = getCached(url);
    if (hit !== null) return hit;
    const data = await proxyFetch(url);
    setCache(url, data);
    return data;
}

const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

    if (reqUrl.pathname === "/api/catalog") {
        try {
            const tier = reqUrl.searchParams.get("tier");
            const market = reqUrl.searchParams.get("market");
            const language = reqUrl.searchParams.get("language");
            const ids = {
                core: "f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e",
                premium: "fdd9e2a7-0fee-49f6-ad69-4354098401ff",
                eaPlay: "b8900d09-a491-44cc-916e-32b5acae621b"
            };
            const apiUrl = `https://catalog.gamepass.com/sigls/v2?id=${ids[tier]}&language=${language}&market=${market}`;
            const data = await cachedFetch(apiUrl);
            res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(data);
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (reqUrl.pathname === "/api/products") {
        try {
            const ids = reqUrl.searchParams.get("ids");
            const market = reqUrl.searchParams.get("market");
            const language = reqUrl.searchParams.get("language");
            const apiUrl = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ids}&market=${market}&languages=${language}`;
            const data = await cachedFetch(apiUrl);
            res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(data);
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (reqUrl.pathname === "/api/cache") {
        const stats = { entries: cache.size, ttl: CACHE_TTL };
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(stats));
        return;
    }

    let filePath = path.join(__dirname, reqUrl.pathname === "/" ? "index.html" : reqUrl.pathname);
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Cache TTL: ${CACHE_TTL / 1000}s`);
});
