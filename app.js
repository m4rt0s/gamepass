let allGames = [];
let filteredGames = [];
let gameData = null;

const searchFilter = document.getElementById("search-filter");
const sortFilter = document.getElementById("sort-filter");
const categoryFilter = document.getElementById("category-filter");
const discountFilter = document.getElementById("discount-filter");
const exclusiveFilter = document.getElementById("exclusive-filter");
const tierQuickFilter = document.getElementById("tier-quick-filter");
const platformFilterBar = document.getElementById("platform-filter-bar");
const gamesGrid = document.getElementById("games-grid");
const loading = document.getElementById("loading");
const errorDiv = document.getElementById("error");
const errorMessage = document.getElementById("error-message");
const resultsInfo = document.getElementById("results-info");
const modalOverlay = document.getElementById("modal-overlay");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");

let currentTier = "all";
let currentPlatform = "all";

searchFilter.addEventListener("input", applyFilters);
sortFilter.addEventListener("change", applyFilters);
categoryFilter.addEventListener("change", applyFilters);
discountFilter.addEventListener("change", applyFilters);
exclusiveFilter.addEventListener("change", applyFilters);

tierQuickFilter.addEventListener("click", (e) => {
    const btn = e.target.closest(".tier-btn");
    if (!btn) return;
    tierQuickFilter.querySelectorAll(".tier-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTier = btn.dataset.tier;
    applyFilters();
});

platformFilterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".platform-btn");
    if (!btn) return;
    platformFilterBar.querySelectorAll(".platform-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentPlatform = btn.dataset.platform;
    updateStats();
    applyFilters();
});

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

async function loadGames() {
    loading.style.display = "flex";
    errorDiv.style.display = "none";
    gamesGrid.innerHTML = "";

    try {
        const res = await fetch("data/games.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        gameData = await res.json();

        allGames = gameData.games;
        filteredGames = [...allGames];

        const ts = new Date(gameData.updatedAt).toLocaleString("es-ES");
        document.querySelector(".subtitle").textContent = `${gameData.totalGames} juegos · ${ts}`;

        populateCategories();
        updateStats();
        applyFilters();
    } catch (err) {
        console.error(err);
        errorDiv.style.display = "block";
        errorMessage.textContent = `Error al cargar: ${err.message}`;
    } finally {
        loading.style.display = "none";
    }
}

function populateCategories() {
    const cats = gameData.categories || [];
    categoryFilter.innerHTML = '<option value="all">Todas las categorías</option>';
    cats.forEach(cat => {
        categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function updateStats() {
    const platformGames = allGames.filter(game => {
        if (currentPlatform !== "all") {
            if (currentPlatform === "console" && game.platform !== "console" && game.platform !== "both") return false;
            if (currentPlatform === "pc" && game.platform !== "pc" && game.platform !== "both") return false;
            if (currentPlatform === "both" && game.platform !== "both") return false;
        }
        return true;
    });

    document.getElementById("total-games").textContent = platformGames.length;
    document.getElementById("essential-count").textContent = platformGames.filter(g => g.tiers.includes("essential")).length;
    document.getElementById("premium-count").textContent = platformGames.filter(g => g.tiers.includes("premium")).length;
    document.getElementById("ultimate-count").textContent = platformGames.filter(g => g.tiers.includes("ultimate")).length;
    document.getElementById("pc-count").textContent = platformGames.filter(g => g.tiers.includes("pc")).length;
    document.getElementById("discount-count").textContent = platformGames.filter(g => g.hasDiscount).length;
}

function applyFilters() {
    const search = searchFilter.value.toLowerCase().trim();
    const sort = sortFilter.value;
    const category = categoryFilter.value;
    const onlyDiscount = discountFilter.checked;
    const onlyExclusive = exclusiveFilter.checked;

    filteredGames = allGames.filter(game => {
        if (currentTier !== "all" && !game.tiers.includes(currentTier)) return false;

        if (onlyExclusive && currentTier !== "all") {
            if (currentTier === "essential") {
                if (game.tiers.includes("premium") || game.tiers.includes("ultimate")) return false;
            } else if (currentTier === "premium") {
                if (game.tiers.includes("essential")) return false;
            } else if (currentTier === "ultimate") {
                if (game.tiers.includes("essential") || game.tiers.includes("premium")) return false;
            }
        }

        if (category !== "all" && !game.categories.includes(category)) return false;

        if (currentPlatform !== "all") {
            if (currentPlatform === "console" && game.platform !== "console" && game.platform !== "both") return false;
            if (currentPlatform === "pc" && game.platform !== "pc" && game.platform !== "both") return false;
            if (currentPlatform === "both" && game.platform !== "both") return false;
        }

        if (onlyDiscount && !game.hasDiscount) return false;

        if (search) {
            const matchTitle = game.title.toLowerCase().includes(search);
            const matchDev = game.developer.toLowerCase().includes(search);
            const matchPub = game.publisher.toLowerCase().includes(search);
            const matchCat = game.categories.some(c => c.toLowerCase().includes(search));
            if (!matchTitle && !matchDev && !matchPub && !matchCat) return false;
        }

        return true;
    });

    const [field, dir] = sort.split("-");
    filteredGames.sort((a, b) => {
        let va, vb;
        switch (field) {
            case "title":
                va = a.title.toLowerCase();
                vb = b.title.toLowerCase();
                return dir === "asc" ? va.localeCompare(vb, "es") : vb.localeCompare(va, "es");
            case "rating":
                va = a.rating || 0;
                vb = b.rating || 0;
                if (sort === "rating-desc-count") {
                    va = a.ratingCount || 0;
                    vb = b.ratingCount || 0;
                }
                return vb - va;
            case "release":
                va = a.releaseDate || "0000";
                vb = b.releaseDate || "0000";
                return dir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
            case "price":
                va = a.price || 0;
                vb = b.price || 0;
                return dir === "asc" ? va - vb : vb - va;
            default:
                return 0;
        }
    });

    resultsInfo.textContent = `${filteredGames.length} de ${allGames.length} juegos`;
    renderGames();
}

function renderGames() {
    if (filteredGames.length === 0) {
        gamesGrid.innerHTML = '<div class="loading"><p>No se encontraron juegos.</p></div>';
        return;
    }

    gamesGrid.innerHTML = filteredGames.map(game => {
        const img = game.imageUrl
            ? (game.imageUrl.startsWith("//") ? "https:" + game.imageUrl : game.imageUrl)
            : "";

        const tierTags = [];
        if (game.tiers.includes("essential")) tierTags.push('<span class="game-tag essential">Essential</span>');
        if (game.tiers.includes("premium")) tierTags.push('<span class="game-tag premium">Premium</span>');
        if (game.tiers.includes("ultimate")) tierTags.push('<span class="game-tag ultimate">Ultimate</span>');
        if (game.hasDiscount) tierTags.push(`<span class="game-tag discount">-${game.discountPercent}%</span>`);

        let priceHtml = "";
        if (game.price > 0) {
            if (game.hasDiscount) {
                priceHtml = `<span class="game-price on-sale"><span class="original">${game.msrp}€</span>${game.price}€</span>`;
            } else {
                priceHtml = `<span class="game-price">${game.price}€</span>`;
            }
        }

        const ratingHtml = game.rating > 0
            ? `<span class="game-rating">⭐ ${game.rating}</span>`
            : "";

        return `
        <div class="game-card" onclick="openModal('${game.id}')">
            ${img
                ? `<img src="${img}" alt="${game.title}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="game-img-placeholder">🎮</div>`
            }
            <div class="game-info">
                <div class="game-title">${game.title}</div>
                <div class="game-tags">${tierTags.join("")}</div>
                <div class="game-meta">
                    ${ratingHtml}
                    ${priceHtml}
                </div>
            </div>
        </div>`;
    }).join("");
}

function openModal(gameId) {
    const game = allGames.find(g => g.id === gameId);
    if (!game) return;

    const img = game.heroImage || game.imageUrl || "";
    const fullImg = img ? (img.startsWith("//") ? "https:" + img : img) : "";

    const tierTags = [];
    if (game.tiers.includes("essential")) tierTags.push('<span class="game-tag essential">Essential</span>');
    if (game.tiers.includes("premium")) tierTags.push('<span class="game-tag premium">Premium</span>');
    if (game.tiers.includes("ultimate")) tierTags.push('<span class="game-tag ultimate">Ultimate</span>');

    let priceDetail = "Gratis con suscripción";
    if (game.price > 0) {
        if (game.hasDiscount) {
            priceDetail = `<span class="modal-detail-value sale">${game.price}€ <small style="text-decoration:line-through;color:#888">${game.msrp}€</small> (-${game.discountPercent}%)</span>`;
        } else {
            priceDetail = `<span class="modal-detail-value">${game.price}€</span>`;
        }
    }

    let ratingDetail = "Sin valoraciones";
    if (game.rating > 0) {
        ratingDetail = `<span class="modal-detail-value rating">⭐ ${game.rating} <small style="color:#888">(${game.ratingCount} votos)</small></span>`;
    }

    const screenshotsHtml = game.screenshots.length > 0
        ? `<div class="modal-screenshots">
            <h3>Screenshots</h3>
            <div class="modal-screenshots-grid">
                ${game.screenshots.map(s => `<img src="${s}" alt="Screenshot" loading="lazy">`).join("")}
            </div>
           </div>`
        : "";

    const videoHtml = game.videoUrl
        ? `<video class="modal-video" controls preload="none" poster="${fullImg}">
            <source src="${game.videoUrl}" type="application/dash+xml">
           </video>
           ${game.videoCaption ? `<p style="color:#888;font-size:0.85rem;padding:0.5rem 1rem">${game.videoCaption}</p>` : ""}`
        : "";

    modalContent.innerHTML = `
        ${fullImg && !game.videoUrl ? `<img class="modal-hero" src="${fullImg}" alt="${game.title}">` : ""}
        ${videoHtml}
        <div class="modal-body">
            <div class="modal-title">${game.title}</div>
            <div class="modal-tags">
                ${tierTags.join("")}
                ${game.categories.map(c => `<span class="game-tag">${c}</span>`).join("")}
            </div>
            ${game.description ? `<div class="modal-description">${game.description}</div>` : ""}
            <div class="modal-details">
                <div class="modal-detail">
                    <div class="modal-detail-label">Precio</div>
                    ${priceDetail}
                </div>
                <div class="modal-detail">
                    <div class="modal-detail-label">Valoración</div>
                    ${ratingDetail}
                </div>
                <div class="modal-detail">
                    <div class="modal-detail-label">Desarrollador</div>
                    <div class="modal-detail-value">${game.developer || "N/D"}</div>
                </div>
                <div class="modal-detail">
                    <div class="modal-detail-label">Editorial</div>
                    <div class="modal-detail-value">${game.publisher || "N/D"}</div>
                </div>
                <div class="modal-detail">
                    <div class="modal-detail-label">Lanzamiento</div>
                    <div class="modal-detail-value">${game.releaseDate || "N/D"}</div>
                </div>
                <div class="modal-detail">
                    <div class="modal-detail-label">Edad</div>
                    <div class="modal-detail-value">${game.ageRating ? game.ageRating + "+" : "N/D"} ${game.pegiRating ? `(${game.pegiRating})` : ""}</div>
                </div>
                <div class="modal-detail">
                    <div class="modal-detail-label">Plataforma</div>
                    <div class="modal-detail-value">${game.platform === "console" ? "🎮 Consola" : game.platform === "pc" ? "🖥️ PC" : "🎮🖥️ Consola + PC"}</div>
                </div>
            </div>
            ${screenshotsHtml}
            <div class="modal-actions">
                <a class="btn-store" href="${game.storeUrl}" target="_blank" rel="noopener">Ver en Microsoft Store</a>
            </div>
        </div>
    `;

    modalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    modalOverlay.classList.remove("active");
    document.body.style.overflow = "";
    const video = modalContent.querySelector("video");
    if (video) video.pause();
}

loadGames();