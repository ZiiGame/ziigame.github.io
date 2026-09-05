const FIRESTORE_QUERY_URL =
    "https://firestore.googleapis.com/v1/projects/eride-1e493/databases/(default)/documents:runQuery";

const statusElement = document.getElementById("leaderboardStatus");
const contentElement = document.getElementById("leaderboardContent");

function getField(fields, name, fallback = "") {
    const field = fields?.[name];
    if (!field) return fallback;

    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return Number(field.integerValue);
    if (field.doubleValue !== undefined) return Number(field.doubleValue);
    if (field.booleanValue !== undefined) return field.booleanValue;

    return fallback;
}

function formatScore(value) {
    return Number(value || 0).toLocaleString("en-US");
}

function renderLeaderboard(players) {
    if (!players.length) {
        contentElement.innerHTML = '<div class="empty-state">No players have been recorded yet.</div>';
        return;
    }

    const rows = players.map((player, index) => {
        const fields = player.document?.fields || {};
        const name = String(getField(fields, "PlayerName", "Unknown Player")).trim() || "Unknown Player";
        const crystal = Number(getField(fields, "Crystal", 0)) || 0;

        return `
            <tr>
                <td class="rank">#${index + 1}</td>
                <td class="player-name">${escapeHtml(name)}</td>
                <td class="score">${formatScore(crystal)}</td>
            </tr>`;
    }).join("");

    contentElement.innerHTML = `
        <div style="overflow-x:auto">
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th class="score">Eride Crystal</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadLeaderboard() {
    statusElement.textContent = "Loading ranking...";

    const requestBody = {
        structuredQuery: {
            from: [{ collectionId: "players" }],
            orderBy: [{
                field: { fieldPath: "Crystal" },
                direction: "DESCENDING"
            }],
            limit: 100
        }
    };

    try {
        const response = await fetch(FIRESTORE_QUERY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Firestore HTTP ${response.status}`);
        }

        const results = await response.json();
        const players = results.filter(result => result.document);

        statusElement.textContent = `Pre-Season · ${players.length} player${players.length === 1 ? "" : "s"}`;
        renderLeaderboard(players);
    } catch (error) {
        console.error("Eride leaderboard error:", error);
        statusElement.textContent = "Unable to load the ranking.";
        contentElement.innerHTML = '<div class="empty-state">The leaderboard is temporarily unavailable.</div>';
    }
}

loadLeaderboard();
