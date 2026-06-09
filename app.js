const PROXY = "";
const MARKET = "ES";
const LANGUAGE = "es-es";

let allGames = [];
let filteredGames = [];

const tierFilter = document.getElementById("tier-filter");
const searchFilter = document.getElementById("search-filter");
const platformFilter = document.getElementById("platform-filter");
const refreshBtn = document.getElementById("refresh-btn");
const gamesGrid = document.getElementById("games-grid");
const loading = document.getElementById("loading");
const errorDiv = document.getElementById("error");
const errorMessage = document.getElementById("error-message");
const totalGames = document.getElementById("total-games");
const coreCount = document.getElementById("core-count");
const premiumCount = document.getElementById("premium-count");
const ultimateCount = document.getElementById("ultimate-count");

tierFilter.addEventListener("change", applyFilters);
searchFilter.addEventListener("input", applyFilters);
platformFilter.addEventListener("change", applyFilters);
refreshBtn.addEventListener("click", loadGames);

async function fetchGameIds(tier) {
    const url = `${PROXY}/api/catalog?tier=${tier}&language=${LANGUAGE}&market=${MARKET}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error fetching ${tier} list: ${res.status}`);
    const data = await res.json();
    return data.filter(e => e.id).map(e => e.id);
}

async function fetchGameDetails(ids) {
    if (!ids.length) return [];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 20) {
        chunks.push(ids.slice(i, i + 20));
    }
    const allProducts = [];
    for (const chunk of chunks) {
        const url = `${PROXY}/api/products?ids=${chunk.join(",")}&market=${MARKET}&language=${LANGUAGE}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.Products) allProducts.push(...data.Products);
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
        platform,
        storeUrl: `https://www.xbox.com/es-es/games/store/${product.ProductId}`
    };
}

async function loadGames() {
    loading.style.display = "flex";
    errorDiv.style.display = "none";
    gamesGrid.innerHTML = "";
    refreshBtn.disabled = true;

    try {
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
            const unique = [...new Set(game.tiers)];
            game.tiers = unique;
            if (game.tiers.includes("core") || game.tiers.includes("premium")) {
                if (!game.tiers.includes("ultimate")) game.tiers.push("ultimate");
            }
        }

        allGames = Array.from(gameMap.values());
        filteredGames = [...allGames];

        updateStats();
        applyFilters();
    } catch (err) {
        console.error(err);
        errorDiv.style.display = "block";
        errorMessage.textContent = `Error al cargar los juegos: ${err.message}`;
    } finally {
        loading.style.display = "none";
        refreshBtn.disabled = false;
    }
}

function updateStats() {
    totalGames.textContent = allGames.length;
    coreCount.textContent = allGames.filter(g => g.tiers?.includes("core")).length;
    premiumCount.textContent = allGames.filter(g => g.tiers?.includes("premium")).length;
    ultimateCount.textContent = allGames.filter(g => g.tiers?.includes("ultimate")).length;
}

function applyFilters() {
    const tier = tierFilter.value;
    const search = searchFilter.value.toLowerCase().trim();
    const platform = platformFilter.value;

    filteredGames = allGames.filter(game => {
        if (tier === "core" && !game.tiers?.includes("core")) return false;
        if (tier === "premium" && !game.tiers?.includes("premium")) return false;
        if (tier === "ultimate" && !game.tiers?.includes("ultimate")) return false;

        if (platform !== "all" && game.platform !== "all" && game.platform !== platform) {
            if (platform === "console" && !game.tiers?.includes("core")) return false;
            if (platform === "pc" && !game.tiers?.includes("premium")) return false;
        }

        if (search) {
            const matchTitle = game.title.toLowerCase().includes(search);
            const matchDev = game.developer.toLowerCase().includes(search);
            const matchPub = game.publisher.toLowerCase().includes(search);
            const matchCat = game.categories.some(c => c.toLowerCase().includes(search));
            if (!matchTitle && !matchDev && !matchPub && !matchCat) return false;
        }

        return true;
    });

    filteredGames.sort((a, b) => a.title.localeCompare(b.title, "es"));
    renderGames();
}

function renderGames() {
    if (filteredGames.length === 0) {
        gamesGrid.innerHTML = '<div class="loading"><p>No se encontraron juegos con los filtros seleccionados.</p></div>';
        return;
    }

    gamesGrid.innerHTML = filteredGames.map(game => `
        <div class="game-card">
            <img src="${game.imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" fill="%23333"><rect width="300" height="180"/><text x="150" y="90" text-anchor="middle" fill="%23666" font-size="14">Sin imagen</text></svg>'}"
                 alt="${game.title}"
                 loading="lazy"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22180%22 fill=%22%23333%22><rect width=%22300%22 height=%22180%22/><text x=%22150%22 y=%2290%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2214%22>Sin imagen</text></svg>'">
            <div class="game-info">
                <div class="game-title">${game.title}</div>
                <div class="game-description">${game.description || "Sin descripción"}</div>
                <div class="game-tags">
                    ${game.tiers.includes("core") ? `<span class="game-tag core" onclick="filterByTier('core')">Core</span>` : ''}
                    ${game.tiers.includes("premium") ? `<span class="game-tag premium" onclick="filterByTier('premium')">Premium</span>` : ''}
                    ${game.tiers.includes("ultimate") ? `<span class="game-tag ultimate" onclick="filterByTier('ultimate')">Ultimate</span>` : ''}
                    ${game.tiers.includes("eaPlay") ? `<span class="game-tag eaplay" onclick="filterByTier('eaPlay')">EA Play</span>` : ''}
                    ${game.developer ? `<span class="game-tag">${game.developer}</span>` : ''}
                </div>
                <div class="game-meta">
                    <span>${game.releaseDate || "N/D"}</span>
                    <span>${game.categories.slice(0, 2).join(", ") || ""}</span>
                </div>
            </div>
        </div>
    `).join("");
}

function filterByTier(tier) {
    tierFilter.value = tier;
    applyFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

loadGames();