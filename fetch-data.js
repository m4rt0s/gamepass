const https = require("https");
const fs = require("fs");
const path = require("path");

const MARKET = "ES";
const LANGUAGE = "es-ES";

const CATALOG_IDS = {
    core: "f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e",
    premium: "fdd9e2a7-0fee-49f6-ad69-4354098401ff",
    eaPlay: "b8900d09-a491-44cc-916e-32b5acae621b",
    allGames: "29a81209-df6f-41fd-a528-2ae6b91f719c"
};

const PASS_IDS = {
    "CFQ7TTC0K5DJ": "essential",
    "CFQ7TTC0P85B": "premium",
    "CFQ7TTC0KGQ8": "pc",
    "CFQ7TTC0KHS0": "ultimate"
};

function fetchJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", ...headers }
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
            });
        });
        req.on("error", reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error("timeout")); });
    });
}

async function fetchGameIds(tier) {
    const url = `https://catalog.gamepass.com/sigls/v2?id=${CATALOG_IDS[tier]}&language=${LANGUAGE}&market=${MARKET}`;
    const data = await fetchJson(url);
    return data.filter(e => e.id).map(e => e.id);
}

async function fetchEmeraldProduct(productId) {
    const url = `https://emerald.xboxservices.com/xboxcomfd/products/${productId}?market=${MARKET}&language=${LANGUAGE}&locale=${LANGUAGE}`;
    const data = await fetchJson(url, { "MS-CV": "gp-" + Date.now() });
    return data.productSummaries?.[0] || null;
}

async function fetchAllEmeraldProducts(productIds) {
    const results = [];
    for (let i = 0; i < productIds.length; i += 5) {
        const batch = productIds.slice(i, i + 5);
        const batchResults = await Promise.all(batch.map(id => fetchEmeraldProduct(id).catch(() => null)));
        results.push(...batchResults);
        if (i + 5 < productIds.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }
    return results;
}

function extractGameInfo(emerald, catalogProduct) {
    if (!emerald) return null;

    const passMeta = emerald.passMetadataByPassProductId || {};
    const tiers = new Set();
    for (const passId of Object.keys(passMeta)) {
        const mapped = PASS_IDS[passId];
        if (mapped) tiers.add(mapped);
    }

    const images = emerald.images || {};
    const poster = images.poster?.url || "";
    const hero = images.superHeroArt?.url || "";
    const screenshots = [...new Set((images.screenshots || []).map(s => s.url))];

    const videos = emerald.videos || emerald.cmsVideos || [];
    let videoUrl = "";
    let videoCaption = "";
    for (const v of videos) {
        if (v.uri) {
            videoUrl = v.uri;
            videoCaption = v.caption || v.title || "";
            break;
        }
    }

    const specificPrices = emerald.specificPrices || {};
    const purchaseable = specificPrices.purchaseable || [];
    let price = 0;
    let msrp = 0;
    let currency = "EUR";
    let hasDiscount = false;
    let discountPercent = 0;

    if (purchaseable.length > 0) {
        const p = purchaseable[0];
        price = p.listPrice || 0;
        msrp = p.msrp || p.srp || price;
        currency = p.currencyCode || "EUR";
        hasDiscount = price > 0 && msrp > price;
        discountPercent = hasDiscount ? Math.round((1 - price / msrp) * 100) : 0;
    }

    const categories = emerald.categories || [];

    const platform = emerald.availableOn || [];
    let detectedPlatform = "both";
    const hasConsole = platform.some(p => p.includes("Xbox"));
    const hasPC = platform.some(p => p === "PC" || p === "Windows");
    if (hasConsole && !hasPC) detectedPlatform = "console";
    else if (!hasConsole && hasPC) detectedPlatform = "pc";

    let pegiRating = "";
    const contentRating = emerald.contentRating || {};
    if (contentRating.boardName === "PEGI") {
        pegiRating = contentRating.rating || "";
    }

    return {
        id: emerald.productId,
        title: emerald.title || "Sin título",
        description: emerald.description || emerald.shortDescription || "",
        developer: emerald.developerName || "",
        publisher: emerald.publisherName || "",
        imageUrl: poster,
        heroImage: hero,
        screenshots: screenshots.slice(0, 4),
        videoUrl,
        videoCaption,
        releaseDate: emerald.releaseDate?.split("T")[0] || "",
        categories,
        tiers: Array.from(tiers).sort(),
        platform: detectedPlatform,
        price,
        msrp,
        currency,
        hasDiscount,
        discountPercent,
        rating: emerald.averageRating || 0,
        ratingCount: emerald.ratingCount || 0,
        ageRating: contentRating.ratingAge || 0,
        pegiRating,
        storeUrl: `https://www.xbox.com/es-es/games/store/${(emerald.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}/${emerald.productId}`
    };
}

async function fetchDisplayCatalogBatch(productIds) {
    const ids = productIds.join(",");
    const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ids}&market=${MARKET}&languages=${LANGUAGE}&MS-CV=gp-catalog-${Date.now()}`;
    const data = await fetchJson(url);
    const videos = new Map();
    for (const p of data.Products || []) {
        const props = p.LocalizedProperties?.[0];
        const cmsVideos = props?.CMSVideos || [];
        if (cmsVideos.length > 0) {
            const best = cmsVideos.find(v => v.VideoPurpose === "trailer") || cmsVideos[0];
            if (best?.HLS) {
                videos.set(p.ProductId, { url: best.HLS, caption: best.Caption || "" });
            }
        }
    }
    return videos;
}

async function fetchAllDisplayCatalogVideos(productIds) {
    const allVideos = new Map();
    for (let i = 0; i < productIds.length; i += 20) {
        const batch = productIds.slice(i, i + 20);
        const batchVideos = await fetchDisplayCatalogBatch(batch);
        for (const [id, video] of batchVideos) {
            allVideos.set(id, video);
        }
        if (i + 20 < productIds.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }
    return allVideos;
}

async function main() {
    console.log("Fetching Game Pass data via Emerald API...");

    const [coreIds, premiumIds, eaPlayIds, allGameIds] = await Promise.all([
        fetchGameIds("core"),
        fetchGameIds("premium"),
        fetchGameIds("eaPlay"),
        fetchGameIds("allGames")
    ]);

    const allIds = [...new Set([...coreIds, ...premiumIds, ...eaPlayIds, ...allGameIds])];
    console.log(`Total unique IDs: ${allIds.length}`);

    console.log("Fetching product details from Emerald API...");
    const emeraldProducts = await fetchAllEmeraldProducts(allIds);

    const gameMap = new Map();
    let fetched = 0;
    for (const emerald of emeraldProducts) {
        if (!emerald) continue;
        const game = extractGameInfo(emerald);
        if (!game) continue;
        gameMap.set(game.id, game);
        fetched++;
        if (fetched % 100 === 0) console.log(`  ${fetched}/${allIds.length} processed`);
    }

    console.log(`Extracted ${gameMap.size} games`);

    console.log("Fetching videos from Display Catalog API...");
    const gameIds = Array.from(gameMap.keys());
    const catalogVideos = await fetchAllDisplayCatalogVideos(gameIds);
    let videosAdded = 0;
    for (const [id, video] of catalogVideos) {
        const game = gameMap.get(id);
        if (game && !game.videoUrl) {
            game.videoUrl = video.url;
            game.videoCaption = video.caption;
            videosAdded++;
        }
    }
    console.log(`Added ${videosAdded} videos from Display Catalog`);

    const games = Array.from(gameMap.values()).sort((a, b) => a.title.localeCompare(b.title, "es"));

    const outputDir = path.join(__dirname, "data");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const allCategories = [...new Set(games.flatMap(g => g.categories))].sort();

    const output = {
        updatedAt: new Date().toISOString(),
        market: MARKET,
        language: LANGUAGE,
        totalGames: games.length,
        counts: {
            essential: games.filter(g => g.tiers.includes("essential")).length,
            premium: games.filter(g => g.tiers.includes("premium")).length,
            pc: games.filter(g => g.tiers.includes("pc")).length,
            ultimate: games.filter(g => g.tiers.includes("ultimate")).length,
            total: games.length
        },
        categories: allCategories,
        games
    };

    fs.writeFileSync(path.join(outputDir, "games.json"), JSON.stringify(output, null, 2));
    console.log(`Saved ${games.length} games to data/games.json`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});