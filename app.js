let allGames = [];
let filteredGames = [];
let gameData = null;

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

async function loadGames() {
    loading.style.display = "flex";
    errorDiv.style.display = "none";
    gamesGrid.innerHTML = "";
    refreshBtn.disabled = true;

    try {
        const res = await fetch("data/games.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        gameData = await res.json();

        allGames = gameData.games;
        filteredGames = [...allGames];

        const ts = new Date(gameData.updatedAt).toLocaleString("es-ES");
        document.querySelector(".subtitle").textContent = `Actualizado: ${ts}`;

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
    totalGames.textContent = gameData.totalGames;
    coreCount.textContent = gameData.counts.core;
    premiumCount.textContent = gameData.counts.premium;
    ultimateCount.textContent = gameData.counts.ultimate;
}

function applyFilters() {
    const tier = tierFilter.value;
    const search = searchFilter.value.toLowerCase().trim();
    const platform = platformFilter.value;

    filteredGames = allGames.filter(game => {
        if (tier === "core" && !game.tiers.includes("core")) return false;
        if (tier === "premium" && !game.tiers.includes("premium")) return false;
        if (tier === "ultimate" && !game.tiers.includes("ultimate")) return false;
        if (tier === "eaPlay" && !game.tiers.includes("eaPlay")) return false;

        if (platform !== "all") {
            if (platform === "console" && !game.tiers.includes("core")) return false;
            if (platform === "pc" && !game.tiers.includes("premium")) return false;
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