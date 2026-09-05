const FIRESTORE_DOCUMENTS_URL =
    "https://firestore.googleapis.com/v1/projects/eride-1e493/databases/(default)/documents/players";

const PLAYERS_PER_PAGE = 50;

const statusElement = document.getElementById("leaderboardStatus");
const contentElement = document.getElementById("leaderboardContent");
const paginationElement = document.getElementById("pagination");
const searchElement = document.getElementById("playerSearch");

let allPlayers = [];
let currentPage = 1;
let searchTerm = "";

function getField(fields, name, fallback = "") {
    const field = fields?.[name];
    if (!field) return fallback;

    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return Number(field.integerValue);
    if (field.doubleValue !== undefined) return Number(field.doubleValue);
    if (field.booleanValue !== undefined) return field.booleanValue;

    return fallback;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-US");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizePlayers(documents) {
    return documents.map(document => {
        const fields = document.fields || {};

        return {
            document,
            name: String(getField(fields, "PlayerName", "Unknown Player")).trim() || "Unknown Player",
            crystal: Number(getField(fields, "Crystal", 0)) || 0,
            perkLevel: Number(getField(fields, "PerkLVL", 0)) || 0,
            paragonLevel: Number(getField(fields, "ParagonLVL", 0)) || 0
        };
    }).sort((a, b) => {
        if (b.crystal !== a.crystal) {
            return b.crystal - a.crystal;
        }

        return a.name.localeCompare(b.name, undefined, {
            sensitivity: "base"
        });
    });
}

function getFilteredPlayers() {
    const query = searchTerm.trim().toLocaleLowerCase();

    if (!query) {
        return allPlayers;
    }

    return allPlayers.filter(player =>
        player.name.toLocaleLowerCase().includes(query)
    );
}

function renderLeaderboard() {
    const filteredPlayers = getFilteredPlayers();
    const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PLAYERS_PER_PAGE));

    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * PLAYERS_PER_PAGE;
    const pagePlayers = filteredPlayers.slice(start, start + PLAYERS_PER_PAGE);

    if (!filteredPlayers.length) {
        contentElement.innerHTML = '<div class="empty-state">No player matches your search.</div>';
        renderPagination(0, 0);
        return;
    }

    const rows = pagePlayers.map(player => {
        const globalRank = allPlayers.indexOf(player) + 1;

        return `
            <tr>
                <td class="rank">#${globalRank}</td>
                <td class="player-name">${escapeHtml(player.name)}</td>
                <td class="level">${formatNumber(player.perkLevel)}</td>
                <td class="level">${formatNumber(player.paragonLevel)}</td>
                <td class="score">${formatNumber(player.crystal)}</td>
            </tr>`;
    }).join("");

    contentElement.innerHTML = `
        <div class="leaderboard-table-wrap">
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Perk LVL</th>
                        <th>Paragon LVL</th>
                        <th class="score">Eride Crystal</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;

    renderPagination(filteredPlayers.length, totalPages);
}

function renderPagination(totalPlayers, totalPages) {
    if (totalPlayers <= PLAYERS_PER_PAGE) {
        paginationElement.innerHTML = "";
        return;
    }

    const buttons = [];

    buttons.push(`
        <button class="page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>
            Previous
        </button>`);

    const maxVisiblePages = 7;
    let firstPage = Math.max(1, currentPage - 3);
    let lastPage = Math.min(totalPages, firstPage + maxVisiblePages - 1);

    if (lastPage - firstPage + 1 < maxVisiblePages) {
        firstPage = Math.max(1, lastPage - maxVisiblePages + 1);
    }

    if (firstPage > 1) {
        buttons.push(`<button class="page-button" data-page="1">1</button>`);
        if (firstPage > 2) {
            buttons.push('<span class="page-dots">…</span>');
        }
    }

    for (let page = firstPage; page <= lastPage; page++) {
        buttons.push(`
            <button class="page-button ${page === currentPage ? "active" : ""}" data-page="${page}">
                ${page}
            </button>`);
    }

    if (lastPage < totalPages) {
        if (lastPage < totalPages - 1) {
            buttons.push('<span class="page-dots">…</span>');
        }
        buttons.push(`<button class="page-button" data-page="${totalPages}">${totalPages}</button>`);
    }

    buttons.push(`
        <button class="page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>
            Next
        </button>`);

    paginationElement.innerHTML = buttons.join("");
}

async function loadAllPlayers() {
    statusElement.textContent = "Loading ranking...";

    const documents = [];
    let pageToken = "";

    try {
        do {
            const url = new URL(FIRESTORE_DOCUMENTS_URL);
            url.searchParams.set("pageSize", "1000");

            if (pageToken) {
                url.searchParams.set("pageToken", pageToken);
            }

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`Firestore HTTP ${response.status}`);
            }

            const data = await response.json();

            if (Array.isArray(data.documents)) {
                documents.push(...data.documents);
            }

            pageToken = data.nextPageToken || "";
        } while (pageToken);

        allPlayers = normalizePlayers(documents);
        currentPage = 1;

        updateStatus();
        renderLeaderboard();
    } catch (error) {
        console.error("Eride leaderboard error:", error);
        statusElement.textContent = "Unable to load the ranking.";
        contentElement.innerHTML =
            '<div class="empty-state">The leaderboard is temporarily unavailable.</div>';
        paginationElement.innerHTML = "";
    }
}

function updateStatus() {
    const filteredPlayers = getFilteredPlayers();

    if (searchTerm.trim()) {
        statusElement.textContent =
            `Search · ${filteredPlayers.length} matching player${filteredPlayers.length === 1 ? "" : "s"}`;
    } else {
        statusElement.textContent =
            `Pre-Season · ${allPlayers.length} player${allPlayers.length === 1 ? "" : "s"}`;
    }
}

searchElement.addEventListener("input", () => {
    searchTerm = searchElement.value;
    currentPage = 1;
    updateStatus();
    renderLeaderboard();
});

paginationElement.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");

    if (!button || button.disabled) {
        return;
    }

    currentPage = Number(button.dataset.page);
    renderLeaderboard();

    document.querySelector(".leaderboard-card").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

loadAllPlayers();
