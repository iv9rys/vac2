// ── VAC: Import pro comps from a VLR.gg team ────────────────────
// Vercel serverless function. Scrapes vlr.gg (no official API exists)
// for a team's recent completed matches, then reads each match's
// per-map stats table to find which 5 agents that team played on
// each map. Returns the most recent comp seen per map.
//
// GET /api/vlr-comps?team=<vlr.gg team URL or ID>

const cheerio = require("cheerio");

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; VAC-import/1.0; +https://vlr.gg)",
};

const MATCH_FETCH_LIMIT = 20; // how many recent matches to scan
const FETCH_TIMEOUT_MS  = 8000;

function extractTeamId(input) {
    const str = (input || "").trim();
    const urlMatch = str.match(/team\/(?:matches\/|stats\/|transactions\/)?(\d+)/i);
    if (urlMatch) return urlMatch[1];
    const idOnly = str.match(/^(\d+)$/);
    if (idOnly) return idOnly[1];
    return null;
}

async function fetchHtml(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

function normAgent($img) {
    const alt = ($img.attr("alt") || "").trim();
    if (alt) return alt.toLowerCase().replace(/[^a-z]/g, "");
    const title = ($img.attr("title") || "").trim();
    return title.toLowerCase().replace(/[^a-z]/g, "");
}

function normTeamName(name) {
    return (name || "").trim().toLowerCase();
}

// Pulls { mapName -> { agents, opponent, matchUrl } } for `teamNameNorm`
// out of one match's detail page HTML.
function parseMatchComps(html, teamNameNorm) {
    const $ = cheerio.load(html);
    const out = {};

    $(".vm-stats-game").each((_, gameEl) => {
        const $game = $(gameEl);
        if ($game.attr("data-game-id") === "all") return;

        const header = $game.find(".vm-stats-game-header").first();
        const teams  = header.find(".team");
        if (teams.length < 2) return;

        const teamNames = teams.map((__, t) => $(t).find(".team-name").first().text().trim()).get();
        const tables = $game.find(".ovw-table");
        if (tables.length < 2 || teamNames.length < 2) return;

        let teamIdx = -1;
        teamNames.forEach((n, i) => { if (normTeamName(n) === teamNameNorm) teamIdx = i; });
        if (teamIdx === -1) {
            teamNames.forEach((n, i) => {
                if (teamIdx === -1 && normTeamName(n).includes(teamNameNorm)) teamIdx = i;
            });
        }
        if (teamIdx === -1 || !tables[teamIdx]) return;

        const nameDiv = header.find(".map").children().first().clone();
        nameDiv.find(".picked").remove();
        const mapName = nameDiv.text().trim();
        if (!mapName) return;

        const agents = [];
        $(tables[teamIdx]).find(".ovw-row:not(.mod-head)").each((__, row) => {
            const img = $(row).find(".ovw-agents img").first();
            if (img.length) {
                const a = normAgent(img);
                if (a) agents.push(a);
            }
        });
        if (agents.length !== 5) return;

        const opponent = teamNames[1 - teamIdx];
        out[mapName] = { agents, opponent };
    });

    return out;
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const teamInput = req.query.team;
    const teamId = extractTeamId(Array.isArray(teamInput) ? teamInput[0] : teamInput);
    if (!teamId) {
        res.status(400).json({ error: "Couldn't find a team ID in that link. Paste a vlr.gg team page URL (vlr.gg/team/<id>/<name>)." });
        return;
    }

    try {
        const matchesHtml = await fetchHtml(`https://www.vlr.gg/team/matches/${teamId}/x/?group=completed`);
        const $list = cheerio.load(matchesHtml);

        const ogTitle = $list('meta[property="og:title"]').attr("content") || "";
        const teamName = ogTitle.replace(/:\s*Match Results.*$/i, "").trim() || `Team ${teamId}`;
        const teamNameNorm = normTeamName(teamName);

        const matchIds = [];
        $list("a.m-item").each((_, el) => {
            const href = $list(el).attr("href") || "";
            const m = href.match(/^\/(\d+)\//);
            if (m && !matchIds.includes(m[1])) matchIds.push(m[1]);
        });

        if (matchIds.length === 0) {
            res.status(404).json({ error: `No completed matches found for team ID ${teamId}. Double-check the VLR.gg team link.` });
            return;
        }

        const targets = matchIds.slice(0, MATCH_FETCH_LIMIT);
        const results = await Promise.allSettled(
            targets.map(id => fetchHtml(`https://www.vlr.gg/${id}/x`).then(html => parseMatchComps(html, teamNameNorm)))
        );

        // Matches are already newest-first, so the first hit per map wins.
        const maps = {};
        for (const r of results) {
            if (r.status !== "fulfilled") continue;
            for (const [mapName, data] of Object.entries(r.value)) {
                if (!maps[mapName]) maps[mapName] = data;
            }
        }

        if (Object.keys(maps).length === 0) {
            res.status(404).json({ error: `Found ${teamName} but couldn't read any per-map comps from their recent matches.` });
            return;
        }

        res.status(200).json({ team: teamName, teamId, maps });
    } catch (err) {
        res.status(502).json({ error: `Failed to fetch from VLR.gg: ${err.message}` });
    }
};
