const https = require("https");
const fs = require("fs");
const path = require("path");

const MARKET = "ES";
const LANGUAGE = "es-es";

const CATALOG_IDS = {
    core: "f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e",
    premium: "fdd9e2a7-0fee-49f6-ad69-4354098401ff",
    eaPlay: "b8900d09-a491-44cc-916e-32b5acae621b"
};

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
            });
        }).on("error", reject);
    });
}

async function fetchGameIds(tier) {
    const url = `https://catalog.gamepass.com/sigls/v2?id=${CATALOG_IDS[tier]}&language=${LANGUAGE}&market=${MARKET}`;
    const data = await fetchJson(url);
    return data.filter(e => e.id).map(e => e.id);
}

async function fetchGameDetails(ids) {
    if (!ids.length) return [];
    const allProducts = [];
    for (let i = 0; i < ids.length; i += 20) {
        const chunk = ids.slice(i, i + 20);
        const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${chunk.join(",")}&market=${MARKET}&languages=${LANGUAGE}`;
        try {
            const data = await fetchJson(url);
            if (data.Products) allProducts.push(...data.Products);
        } catch (e) {
            console.error(`Error fetching chunk: ${e.message}`);
        }
    }
    return allProducts;
}

function extractGameInfo(product, tier, platform) {
    const props = product.LocalizedProperties?.[0] || {};
    const marketProps = product.MarketProperties?.[0] || {};
    const images = props.Images || [];

    let imageUrl = "";
    for (const img of images) {
        if (img.ImagePurpose === "Poster" || img.ImagePurpose === "BoxArt") {
            imageUrl = img.Uri?.startsWith("//") ? "https:" + img.Uri : img.Uri;
            break;
        }
    }
    if (!imageUrl) {
        for (const img of images) {
            if (img.ImagePurpose === "Screenshot" || img.ImagePurpose === "Hero") {
                imageUrl = img.Uri?.startsWith("//") ? "https:" + img.Uri : img.Uri;
                break;
            }
        }
    }

    const categories = product.Properties?.Categories || [];
    const mainCategory = product.Properties?.Category || "";
    const allCategories = [...new Set([mainCategory, ...categories])].filter(Boolean);

    return {
        id: product.ProductId,
        title: props.ProductTitle || "Sin título",
        description: props.ShortDescription || props.ProductDescription || "",
        developer: props.DeveloperName || "",
        publisher: props.PublisherName || "",
        imageUrl,
        releaseDate: marketProps.OriginalReleaseDate?.split("T")[0] || "",
        categories: allCategories,
        tier,
        platform
    };
}

async function main() {
    console.log("Fetching Game Pass data...");

    const [coreIds, premiumIds, eaPlayIds] = await Promise.all([
        fetchGameIds("core"),
        fetchGameIds("premium"),
        fetchGameIds("eaPlay")
    ]);

    console.log(`Core: ${coreIds.length}, Premium: ${premiumIds.length}, EA Play: ${eaPlayIds.length}`);

    const [coreProducts, premiumProducts, eaPlayProducts] = await Promise.all([
        fetchGameDetails(coreIds),
        fetchGameDetails(premiumIds),
        fetchGameDetails(eaPlayIds)
    ]);

    const gameMap = new Map();

    for (const p of coreProducts) {
        const g = extractGameInfo(p, "core", "console");
        g.tiers = ["core"];
        gameMap.set(g.id, g);
    }

    for (const p of premiumProducts) {
        const g = extractGameInfo(p, "premium", "pc");
        if (gameMap.has(g.id)) {
            gameMap.get(g.id).tiers.push("premium");
        } else {
            g.tiers = ["premium"];
            gameMap.set(g.id, g);
        }
    }

    for (const p of eaPlayProducts) {
        const g = extractGameInfo(p, "eaPlay", "all");
        if (gameMap.has(g.id)) {
            gameMap.get(g.id).tiers.push("eaPlay");
        } else {
            g.tiers = ["eaPlay"];
            gameMap.set(g.id, g);
        }
    }

    for (const game of gameMap.values()) {
        game.tiers = [...new Set(game.tiers)];
        if (game.tiers.includes("core") || game.tiers.includes("premium")) {
            if (!game.tiers.includes("ultimate")) game.tiers.push("ultimate");
        }
    }

    const games = Array.from(gameMap.values()).sort((a, b) => a.title.localeCompare(b.title, "es"));

    const outputDir = path.join(__dirname, "data");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const output = {
        updatedAt: new Date().toISOString(),
        market: MARKET,
        language: LANGUAGE,
        totalGames: games.length,
        counts: {
            core: games.filter(g => g.tiers.includes("core")).length,
            premium: games.filter(g => g.tiers.includes("premium")).length,
            ultimate: games.filter(g => g.tiers.includes("ultimate")).length,
            eaPlay: games.filter(g => g.tiers.includes("eaPlay")).length
        },
        games
    };

    fs.writeFileSync(path.join(outputDir, "games.json"), JSON.stringify(output, null, 2));
    console.log(`Saved ${games.length} games to data/games.json`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});