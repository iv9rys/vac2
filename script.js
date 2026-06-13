const allMaps = [
    "Ascent", "Breeze", "Lotus", "Split", "Pearl",
    "Haven", "Fracture", "Bind", "Abyss", "Corrode", "Sunset", "Icebox"
];

const defaultPool = [
    "Ascent", "Breeze", "Lotus", "Split", "Pearl", "Haven", "Fracture"
];

const agentsByClass = {
    Duelists:    ["jett", "raze", "reyna", "phoenix", "neon", "iso", "yoru", "waylay"],
    Controllers: ["astra", "brimstone", "clove", "harbor", "omen", "viper", "miks"],
    Initiators:  ["breach", "fade", "gekko", "kayo", "skye", "sova", "tejo"],
    Sentinels:   ["chamber", "cypher", "deadlock", "killjoy", "sage", "vyse", "veto"]
};

let mapPool      = JSON.parse(localStorage.getItem("mapPool")) || defaultPool;
let comps        = migrateComps(JSON.parse(localStorage.getItem("comps")) || {});
let bannedMaps   = JSON.parse(localStorage.getItem("bannedMaps")) ||
                   (localStorage.getItem("bannedMap") ? [localStorage.getItem("bannedMap")] : []);
let multipleBans = localStorage.getItem("multipleBans") === "true";
let playerLabels = JSON.parse(localStorage.getItem("playerLabels")) || ["P1","P2","P3","P4","P5"];
let lightMode    = localStorage.getItem("lightMode") === "true";
let currentMap   = null;
let activePlayer      = 1;
let activeTier        = "Main";
let activeSettingsTab = "My Team";
let teamName          = localStorage.getItem("teamName") || "";
let teamLogo          = localStorage.getItem("teamLogo") || null;
let activeExtraTab    = "Comfort List";
let randomComp        = null;
let accentColor       = localStorage.getItem("accentColor") || "#2f5cff";

// Apply light mode immediately on every page
if (lightMode) document.body.classList.add("light");

function hexToRgb(hex) {
    return `${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)}`;
}
function applyAccent(color) {
    document.body.style.setProperty("--accent", color);
    document.body.style.setProperty("--accent-rgb", hexToRgb(color));
}
applyAccent(accentColor);

function migrateComps(raw) {
    const out = {};
    for (const [map, comp] of Object.entries(raw)) {
        if (Array.isArray(comp)) {
            const obj = {};
            comp.forEach((agent, i) => { if (agent) obj[i + 1] = agent; });
            out[map] = obj;
        } else {
            out[map] = comp || {};
        }
    }
    return out;
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

// Returns the custom label for player slot i (1-5), falling back to "Pi"
function getLabel(i) {
    const l = (playerLabels[i - 1] || "").trim();
    return l || `P${i}`;
}

function saveComps() {
    localStorage.setItem("comps", JSON.stringify(comps));
}

function nextEmptySlot(comp) {
    for (let i = 1; i <= 5; i++) {
        if (!comp[i]) return i;
    }
    return 1;
}

// ── Page init ────────────────────────────────────────────────
if (document.getElementById("map-list"))              renderBuilder();
if (document.getElementById("saved-comps-container")) renderSavedComps();
if (document.getElementById("settings-maps"))         renderSettings();
if (document.getElementById("comfort-container"))     renderComfortList();
if (document.getElementById("extra-tools-container")) renderExtraTools();

// ── Builder ──────────────────────────────────────────────────
function renderBuilder() {
    const mapList       = document.getElementById("map-list");
    const agentSections = document.getElementById("agent-sections");
    const saveBtn       = document.getElementById("save-btn");

    // Map buttons
    mapList.innerHTML = "";
    mapPool.forEach(map => {
        const btn = document.createElement("button");
        btn.classList.add("map-btn");
        btn.innerText = map;
        btn.addEventListener("click", () => {
            currentMap = map;
            document.querySelectorAll(".map-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById("current-map").innerText = map;
            activePlayer = nextEmptySlot(comps[currentMap] || {});
            if (saveBtn) saveBtn.disabled = false;
            renderPlayerSlots();
            updateBorders();
        });
        mapList.appendChild(btn);
    });

    // Ban dropdown
    const banSelect  = document.getElementById("ban-select");
    const banHeading = document.getElementById("ban-heading");
    const banError   = document.getElementById("ban-error");

    function showBanError() {
        if (banError) {
            banError.textContent = "At least one map must remain unbanned.";
            banError.classList.add("visible");
        }
    }
    function clearBanError() {
        if (banError) banError.classList.remove("visible");
    }

    if (banSelect) {
        if (multipleBans) {
            if (banHeading) banHeading.textContent = "Banned Maps";
            banSelect.style.display = "none";

            const dd = document.createElement("div");
            dd.classList.add("ban-custom-dd");

            const ddBtn = document.createElement("button");
            ddBtn.type = "button";
            ddBtn.classList.add("ban-dd-btn");

            const ddPanel = document.createElement("div");
            ddPanel.classList.add("ban-dd-panel");

            function updateBtnLabel() {
                ddBtn.textContent = bannedMaps.length === 0   ? "None"
                    : bannedMaps.length === 1                  ? bannedMaps[0]
                    : `${bannedMaps.length} maps banned`;
            }

            mapPool.forEach(map => {
                const item = document.createElement("div");
                item.classList.add("setting-map");
                const cbId = `ban-cb-${map}`;
                item.innerHTML = `
                    <input type="checkbox" id="${cbId}" ${bannedMaps.includes(map) ? "checked" : ""}>
                    <label for="${cbId}">${map}</label>
                `;
                item.querySelector("input").addEventListener("change", e => {
                    if (e.target.checked) {
                        if (bannedMaps.length + 1 >= mapPool.length) {
                            e.target.checked = false;
                            showBanError();
                            return;
                        }
                        bannedMaps = [...bannedMaps, map];
                    } else {
                        bannedMaps = bannedMaps.filter(m => m !== map);
                    }
                    localStorage.setItem("bannedMaps", JSON.stringify(bannedMaps));
                    clearBanError();
                    updateBtnLabel();
                });
                ddPanel.appendChild(item);
            });

            ddBtn.addEventListener("click", e => {
                e.stopPropagation();
                const opening = !ddPanel.classList.contains("open");
                ddPanel.classList.toggle("open");
                if (opening) {
                    const closeHandler = ev => {
                        if (!dd.contains(ev.target)) {
                            ddPanel.classList.remove("open");
                            document.removeEventListener("mousedown", closeHandler);
                        }
                    };
                    document.addEventListener("mousedown", closeHandler);
                }
            });

            updateBtnLabel();
            dd.appendChild(ddBtn);
            dd.appendChild(ddPanel);
            banSelect.insertAdjacentElement("afterend", dd);

        } else {
            if (banHeading) banHeading.textContent = "Banned Map";
            banSelect.style.display = "";
            banSelect.removeAttribute("multiple");
            banSelect.innerHTML = `<option value="">None</option>`;
            mapPool.forEach(map => {
                const opt = document.createElement("option");
                opt.value = map;
                opt.innerText = map;
                if (bannedMaps.includes(map)) opt.selected = true;
                banSelect.appendChild(opt);
            });
            banSelect.addEventListener("change", () => {
                const val = banSelect.value;
                if (val && mapPool.length <= 1) {
                    banSelect.value = bannedMaps[0] || "";
                    showBanError();
                } else {
                    bannedMaps = val ? [val] : [];
                    localStorage.setItem("bannedMaps", JSON.stringify(bannedMaps));
                    clearBanError();
                }
            });
        }
    }

    // Save & clear button
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            if (!currentMap) return;
            saveBtn.textContent = "Saved ✓";
            saveBtn.classList.add("saved");
            setTimeout(() => {
                currentMap = null;
                activePlayer = 1;
                document.querySelectorAll(".map-btn").forEach(b => b.classList.remove("active"));
                document.getElementById("current-map").textContent = "Select a Map";
                saveBtn.textContent = "Save Comp";
                saveBtn.classList.remove("saved");
                saveBtn.disabled = true;
                renderPlayerSlots();
                updateBorders();
            }, 700);
        });
    }

    // Agent grid
    agentSections.innerHTML = "";
    Object.entries(agentsByClass).forEach(([role, agents]) => {
        const section = document.createElement("div");
        section.classList.add("agent-section");
        section.innerHTML = `<h2>${role}</h2><div class="agent-grid"></div>`;
        const grid = section.querySelector(".agent-grid");

        agents.forEach(agent => {
            const card = document.createElement("div");
            card.classList.add("agent-card");
            card.dataset.agent = agent;
            card.innerHTML = `
                <img src="agents/${agent}.png" alt="${capitalize(agent)}">
                <div class="agent-name">${capitalize(agent)}</div>
            `;
            card.addEventListener("click", () => handleAgentClick(agent));
            grid.appendChild(card);
        });

        agentSections.appendChild(section);
    });

    renderPlayerSlots();
}

function handleAgentClick(agent) {
    if (!currentMap) {
        alert("Select a map first");
        return;
    }

    const comp = comps[currentMap] || {};

    if (comp[activePlayer] === agent) {
        delete comp[activePlayer];
    } else {
        for (const p in comp) {
            if (comp[p] === agent) delete comp[p];
        }
        comp[activePlayer] = agent;
        activePlayer = nextEmptySlot(comp);
    }

    comps[currentMap] = comp;
    saveComps();
    renderPlayerSlots();
    updateBorders();
}

function renderPlayerSlots() {
    const container = document.getElementById("player-slots");
    if (!container) return;

    container.innerHTML = "";
    const comp = currentMap ? (comps[currentMap] || {}) : {};

    for (let i = 1; i <= 5; i++) {
        const slot = document.createElement("div");
        slot.classList.add("player-slot");
        if (i === activePlayer) slot.classList.add("active");

        const agent = comp[i];
        slot.innerHTML = `
            <div class="player-num">${getLabel(i)}</div>
            ${agent
                ? `<img src="agents/${agent}.png" alt="${capitalize(agent)}">
                   <div class="player-agent-name">${capitalize(agent)}</div>`
                : `<div class="player-empty">—</div>`
            }
        `;

        slot.addEventListener("click", () => {
            activePlayer = i;
            document.querySelectorAll(".player-slot").forEach(s => s.classList.remove("active"));
            slot.classList.add("active");
        });

        container.appendChild(slot);
    }
}

function updateBorders() {
    const comp = currentMap ? (comps[currentMap] || {}) : {};
    const assigned = new Set(Object.values(comp));
    document.querySelectorAll(".agent-card").forEach(card => {
        card.classList.toggle("selected", assigned.has(card.dataset.agent));
    });
}

// ── Saved Comps ──────────────────────────────────────────────
function renderSavedComps() {
    const container = document.getElementById("saved-comps-container");

    const dlBtn = document.getElementById("download-all-btn");
    if (dlBtn) dlBtn.addEventListener("click", downloadAllComps);

    const clearBtn = document.getElementById("clear-comps-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (!confirm("Clear all saved comps? This cannot be undone.")) return;
            comps = {};
            saveComps();
            buildCompCards();
        });
    }

    buildCompCards();

    function buildCompCards() {
        container.innerHTML = "";

        // Banned maps always render last
        const mapsToRender = [...mapPool].sort((a, b) => {
            if (bannedMaps.includes(a) && !bannedMaps.includes(b)) return 1;
            if (!bannedMaps.includes(a) && bannedMaps.includes(b)) return -1;
            return 0;
        });

        mapsToRender.forEach(map => {
            const comp = comps[map] || {};
            const card = document.createElement("div");
            card.classList.add("saved-comp");

            let agentsHtml = "";
            for (let i = 1; i <= 5; i++) {
                const agent = comp[i];
                agentsHtml += `
                    <div class="saved-player">
                        <div class="saved-player-num">${getLabel(i)}</div>
                        ${agent
                            ? `<img src="agents/${agent}.png" alt="${capitalize(agent)}">
                               <div class="saved-agent-name">${capitalize(agent)}</div>`
                            : `<div class="saved-empty">—</div>`
                        }
                    </div>
                `;
            }

            card.innerHTML = `
                <h2>${map}${bannedMaps.includes(map) ? ' <span class="banned-label">(BANNED)</span>' : ''}</h2>
                <div class="saved-agents">${agentsHtml}</div>
            `;

            container.appendChild(card);
        });
    }
}

// ── Shared canvas header ─────────────────────────────────────
function drawCanvasHeader(ctx, W, marginX, label, logoImg, tName) {
    const logoSize = 52;
    let rightEdge  = W - marginX;
    const fg       = lightMode ? "#16161a"              : "#ffffff";
    const teamFg   = lightMode ? "rgba(0,0,0,0.85)"    : "rgba(255,255,255,0.92)";
    const labelFg  = lightMode ? "rgba(0,0,0,0.35)"    : "rgba(255,255,255,0.3)";
    const sepColor = lightMode ? "rgba(0,0,0,0.08)"    : "rgba(255,255,255,0.07)";

    ctx.fillStyle = fg;
    ctx.font = '900 34px "Archivo Black", Arial';
    ctx.textAlign = "left";
    ctx.fillText("VAC", marginX, 54);
    ctx.fillStyle = accentColor;
    canvasFillRounded(ctx, marginX, 62, 50, 4, 2);

    if (logoImg) {
        const lx = rightEdge - logoSize, ly = 12;
        ctx.save();
        ctx.beginPath();
        canvasRoundedPath(ctx, lx, ly, logoSize, logoSize, 8);
        ctx.clip();
        ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
        ctx.restore();
        rightEdge = lx - 12;
    }

    if (tName) {
        ctx.fillStyle = teamFg;
        ctx.font = '900 17px "Archivo Black", Arial';
        ctx.textAlign = "right";
        ctx.fillText(tName.toUpperCase(), rightEdge, logoImg ? 34 : 44);
    }

    ctx.fillStyle = labelFg;
    ctx.font = "500 11px Arial";
    ctx.textAlign = "right";
    ctx.fillText(label, rightEdge, (logoImg || tName) ? 52 : 54);

    ctx.fillStyle = sepColor;
    ctx.fillRect(marginX, 78, W - marginX * 2, 1);
}

// ── Download full screenshot (all maps) ──────────────────────
async function downloadAllComps() {
    const btn = document.getElementById("download-all-btn");
    if (btn) { btn.textContent = "Generating…"; btn.disabled = true; }

    const W       = 1200;
    const marginX = 44;
    const cardH   = 160;
    const cardGap = 10;
    const headerH = 96;
    const footerH = 52;
    const maps    = [...mapPool].sort((a, b) => {
        if (bannedMaps.includes(a) && !bannedMaps.includes(b)) return 1;
        if (!bannedMaps.includes(a) && bannedMaps.includes(b)) return -1;
        return 0;
    });

    // Left column (map name area) and right column (player slots)
    const leftColW    = 196;
    const dividerX    = marginX + leftColW;
    const rightStartX = dividerX + 20;
    const rightW      = W - marginX - rightStartX;
    const slotGap     = 10;
    const slotW       = (rightW - 4 * slotGap) / 5;  // ≈ 170px
    const imgSize     = 100;

    const H = headerH + maps.length * (cardH + cardGap) - cardGap + footerH + 16;

    // ── Load all agent images ─────────────────────────────────
    const imgs = {};   // key: `${map}|${slot}`
    await Promise.all(maps.flatMap(map =>
        Array.from({ length: 5 }, (_, k) => {
            const agent = (comps[map] || {})[k + 1];
            if (!agent) return Promise.resolve();
            const key = `${map}|${k + 1}`;
            return new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload  = () => { imgs[key] = img; resolve(); };
                img.onerror = () => resolve();
                img.src = `agents/${agent}.png`;
            });
        })
    ));
    // Load team logo if set
    let logoImg = null;
    if (teamLogo) {
        await new Promise(resolve => {
            const img = new Image();
            img.onload  = () => { logoImg = img; resolve(); };
            img.onerror = () => resolve();
            img.src = teamLogo;
        });
    }
    await document.fonts.ready;

    const C = lightMode ? {
        bg:        "#f6f6f4",
        card:      "#eaeae8",
        divider:   "rgba(0,0,0,0.08)",
        mapName:   "#16161a",
        playerLbl: "rgba(0,0,0,0.4)",
        agentName: "rgba(0,0,0,0.65)",
        emptySlot: "rgba(0,0,0,0.12)",
        footerSep: "rgba(0,0,0,0.07)",
        footerVAC: "rgba(0,0,0,0.22)",
        footerSub: "rgba(0,0,0,0.13)",
        watermark: "rgba(0,0,0,0.18)",
    } : {
        bg:        "#0d0d0d",
        card:      "#141414",
        divider:   "rgba(255,255,255,0.06)",
        mapName:   "#ffffff",
        playerLbl: "rgba(255,255,255,0.3)",
        agentName: "rgba(255,255,255,0.75)",
        emptySlot: "rgba(255,255,255,0.08)",
        footerSep: "rgba(255,255,255,0.07)",
        footerVAC: "rgba(255,255,255,0.2)",
        footerSub: "rgba(255,255,255,0.1)",
        watermark: "rgba(255,255,255,0.2)",
    };

    const canvas = document.createElement("canvas");
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // ── Background ───────────────────────────────────────────
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Header ───────────────────────────────────────────────
    drawCanvasHeader(ctx, W, marginX, "SAVED COMPS", logoImg, teamName);

    // ── Map cards ────────────────────────────────────────────
    maps.forEach((map, idx) => {
        const comp   = comps[map] || {};
        const cardY  = headerH + 8 + idx * (cardH + cardGap);
        const cardX  = marginX;
        const cardW  = W - marginX * 2;
        const isBanned = bannedMaps.includes(map);

        // Card background
        ctx.fillStyle = C.card;
        canvasFillRounded(ctx, cardX, cardY, cardW, cardH, 10);

        // Left accent bar (red if banned, accent otherwise)
        ctx.fillStyle = isBanned ? "#ff4655" : accentColor;
        canvasFillRounded(ctx, cardX, cardY, 4, cardH, 2);

        // Map name (vertically centered in left col)
        const midY = cardY + cardH / 2;
        ctx.fillStyle = isBanned ? "#ff6370" : C.mapName;
        ctx.font = '900 20px "Archivo Black", Arial';
        ctx.textAlign = "left";
        ctx.fillText(map.toUpperCase(), cardX + 16, midY + (isBanned ? -6 : 6));

        if (isBanned) {
            ctx.fillStyle = "#ff4655";
            ctx.font = "600 11px Arial";
            ctx.fillText("BANNED", cardX + 16, midY + 11);
        }

        // Vertical divider
        ctx.fillStyle = C.divider;
        ctx.fillRect(dividerX, cardY + 14, 1, cardH - 28);

        // ── Player slots ─────────────────────────────────────
        for (let i = 1; i <= 5; i++) {
            const agent   = comp[i];
            const slotX   = rightStartX + (i - 1) * (slotW + slotGap);
            const centerX = slotX + slotW / 2;
            const imgX    = centerX - imgSize / 2;
            const imgY    = cardY + (cardH - imgSize) / 2 - 8;

            // Player label
            ctx.fillStyle = C.playerLbl;
            ctx.font = "500 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(getLabel(i), centerX, cardY + 16);

            const imgKey = `${map}|${i}`;
            if (imgs[imgKey]) {
                // Rounded agent portrait
                ctx.save();
                ctx.beginPath();
                canvasRoundedPath(ctx, imgX, imgY, imgSize, imgSize, 8);
                ctx.clip();
                ctx.drawImage(imgs[imgKey], imgX, imgY, imgSize, imgSize);
                ctx.restore();

                // Agent name
                ctx.fillStyle = C.agentName;
                ctx.font = "500 11px Arial";
                ctx.textAlign = "center";
                ctx.fillText(capitalize(agent), centerX, imgY + imgSize + 13);
            } else {
                // Empty slot placeholder
                ctx.strokeStyle = C.emptySlot;
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                canvasRoundedPath(ctx, imgX, imgY, imgSize, imgSize, 8);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    });

    // ── Footer ───────────────────────────────────────────────
    ctx.fillStyle = C.footerSep;
    ctx.fillRect(marginX, H - footerH + 8, W - marginX * 2, 1);

    ctx.fillStyle = C.footerVAC;
    ctx.font = '900 15px "Archivo Black", Arial';
    ctx.textAlign = "center";
    ctx.fillText("VAC", W / 2, H - 22);

    ctx.fillStyle = C.footerSub;
    ctx.font = "500 10px Arial";
    ctx.fillText("VALORANT · AGENT · COMPS", W / 2, H - 8);

    ctx.fillStyle = C.watermark;
    ctx.textAlign = "left";
    ctx.fillText("@iv9rys", marginX, H - 8);

    // ── Trigger download ─────────────────────────────────────
    const link = document.createElement("a");
    link.download = "VAC-comps.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    if (btn) { btn.textContent = "Download Screenshot"; btn.disabled = false; }
}

// ── Download comfort list screenshot ─────────────────────────
async function downloadComfortList() {
    const btn = document.getElementById("comfort-download-btn");
    if (btn) { btn.textContent = "Generating…"; btn.disabled = true; }

    const TIERS = [
        { key: "Main",             color: "#ff4655" },
        { key: "Comfortable",      color: "#22c55e" },
        { key: "Okay",             color: "#f59e0b" },
        { key: "Willing to Learn", color: "#a78bfa" },
        { key: "Not Playable",     color: "#6b7280" },
    ];

    const comfortTiers = JSON.parse(localStorage.getItem("comfortTiers")) || {};

    const W          = 1200;
    const marginX    = 44;
    const headerH    = 96;
    const footerH    = 52;
    const tierGap    = 4;
    const labelW     = 150;
    const dividerX   = marginX + labelW;
    const rightX     = dividerX + 20;
    const rightW     = W - marginX - rightX;
    const imgSize    = 72;
    const cardW      = imgSize + 12;
    const cardCH     = imgSize + 22;
    const cardGap    = 8;
    const tierPad    = 10;
    const perRow     = Math.floor((rightW + cardGap) / (cardW + cardGap));

    const tierHeights = TIERS.map(({ key }) => {
        const n = (comfortTiers[key] || []).length;
        if (n === 0) return 70;
        const rows = Math.ceil(n / perRow);
        return tierPad * 2 + rows * cardCH + (rows - 1) * cardGap;
    });

    const totalH = headerH + 8 + tierHeights.reduce((s, h) => s + h + tierGap, 0) - tierGap + footerH + 16;

    // Load images
    const imgs = {};
    await Promise.all(
        TIERS.flatMap(({ key }) => (comfortTiers[key] || []).map(agent =>
            new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload  = () => { imgs[agent] = img; resolve(); };
                img.onerror = () => resolve();
                img.src = `agents/${agent}.png`;
            })
        ))
    );
    // Load team logo if set
    let logoImg = null;
    if (teamLogo) {
        await new Promise(resolve => {
            const img = new Image();
            img.onload  = () => { logoImg = img; resolve(); };
            img.onerror = () => resolve();
            img.src = teamLogo;
        });
    }
    await document.fonts.ready;

    const C = lightMode ? {
        bg:        "#f6f6f4",
        card:      "#eaeae8",
        agentCard: "#dcdcda",
        divider:   "rgba(0,0,0,0.08)",
        agentName: "rgba(0,0,0,0.65)",
        footerSep: "rgba(0,0,0,0.07)",
        footerVAC: "rgba(0,0,0,0.22)",
        footerSub: "rgba(0,0,0,0.13)",
        watermark: "rgba(0,0,0,0.18)",
    } : {
        bg:        "#0d0d0d",
        card:      "#141414",
        agentCard: "#1e1e1e",
        divider:   "rgba(255,255,255,0.06)",
        agentName: "rgba(255,255,255,0.55)",
        footerSep: "rgba(255,255,255,0.07)",
        footerVAC: "rgba(255,255,255,0.2)",
        footerSub: "rgba(255,255,255,0.1)",
        watermark: "rgba(255,255,255,0.2)",
    };

    const canvas = document.createElement("canvas");
    canvas.width  = W;
    canvas.height = totalH;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, totalH);

    // Header
    drawCanvasHeader(ctx, W, marginX, "COMFORT LIST", logoImg, teamName);

    // Tier rows
    let y = headerH + 8;
    TIERS.forEach(({ key, color }, idx) => {
        const agents = comfortTiers[key] || [];
        const tH = tierHeights[idx];
        const cardW2 = W - marginX * 2;

        // Row bg
        ctx.fillStyle = C.card;
        canvasFillRounded(ctx, marginX, y, cardW2, tH, 8);

        // Colored label (left-rounded only)
        ctx.fillStyle = color;
        ctx.save();
        ctx.beginPath();
        const r = 8;
        ctx.moveTo(marginX + r, y);
        ctx.lineTo(marginX + labelW, y);
        ctx.lineTo(marginX + labelW, y + tH);
        ctx.lineTo(marginX + r, y + tH);
        ctx.quadraticCurveTo(marginX, y + tH, marginX, y + tH - r);
        ctx.lineTo(marginX, y + r);
        ctx.quadraticCurveTo(marginX, y, marginX + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Label text (word-wrapped) — always white since on colored bg
        ctx.fillStyle = "white";
        ctx.font = '900 13px "Archivo Black", Arial';
        ctx.textAlign = "center";
        const words = key.split(" ");
        const lineH = 17;
        const textY = y + tH / 2 - ((words.length - 1) * lineH) / 2;
        words.forEach((w, wi) => ctx.fillText(w, marginX + labelW / 2, textY + wi * lineH));

        // Divider
        ctx.fillStyle = C.divider;
        ctx.fillRect(dividerX, y + 10, 1, tH - 20);

        // Agent cards
        agents.forEach((agent, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const ax  = rightX + col * (cardW + cardGap);
            const ay  = y + tierPad + row * (cardCH + cardGap);

            ctx.fillStyle = C.agentCard;
            canvasFillRounded(ctx, ax, ay, cardW, cardCH, 6);

            if (imgs[agent]) {
                ctx.save();
                ctx.beginPath();
                canvasRoundedPath(ctx, ax + 6, ay + 4, imgSize, imgSize, 5);
                ctx.clip();
                ctx.drawImage(imgs[agent], ax + 6, ay + 4, imgSize, imgSize);
                ctx.restore();
            }

            ctx.fillStyle = C.agentName;
            ctx.font = "500 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(capitalize(agent), ax + cardW / 2, ay + 4 + imgSize + 12);
        });

        y += tH + tierGap;
    });

    // Footer
    ctx.fillStyle = C.footerSep;
    ctx.fillRect(marginX, totalH - footerH + 8, W - marginX * 2, 1);
    ctx.fillStyle = C.footerVAC;
    ctx.font = '900 15px "Archivo Black", Arial';
    ctx.textAlign = "center";
    ctx.fillText("VAC", W / 2, totalH - 22);
    ctx.fillStyle = C.footerSub;
    ctx.font = "500 10px Arial";
    ctx.fillText("VALORANT · AGENT · COMPS", W / 2, totalH - 8);

    ctx.fillStyle = C.watermark;
    ctx.textAlign = "left";
    ctx.fillText("@iv9rys", marginX, totalH - 8);

    const link = document.createElement("a");
    link.download = "VAC-comfort.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    if (btn) { btn.textContent = "Download Screenshot"; btn.disabled = false; }
}

function canvasFillRounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    canvasRoundedPath(ctx, x, y, w, h, r);
    ctx.fill();
}

function canvasRoundedPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── Settings ─────────────────────────────────────────────────
function renderSettings() {
    const container = document.getElementById("settings-maps");
    container.innerHTML = "";

    // Tab bar
    const tabBar = document.createElement("div");
    tabBar.classList.add("settings-tabs");
    ["My Team", "Display", "Map Pool"].forEach(tab => {
        const btn = document.createElement("button");
        btn.classList.add("settings-tab-btn");
        btn.textContent = tab;
        if (tab === activeSettingsTab) btn.classList.add("active");
        btn.addEventListener("click", () => { activeSettingsTab = tab; renderSettings(); });
        tabBar.appendChild(btn);
    });
    container.appendChild(tabBar);

    if (activeSettingsTab === "My Team") {
        // ── Team Name ────────────────────────────────────────
        const nameSection = makeSection("Team Name");
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.classList.add("team-name-input");
        nameInput.value = teamName;
        nameInput.placeholder = "e.g. Sentinels";
        nameInput.addEventListener("input", e => {
            teamName = e.target.value;
            localStorage.setItem("teamName", teamName);
        });
        nameSection.appendChild(nameInput);
        container.appendChild(nameSection);

        // ── Team Logo ─────────────────────────────────────────
        const logoSection = makeSection("Team Logo");
        if (teamLogo) {
            const preview = document.createElement("img");
            preview.src = teamLogo;
            preview.classList.add("team-logo-preview");
            logoSection.appendChild(preview);
        }
        const logoActions = document.createElement("div");
        logoActions.classList.add("team-logo-actions");

        const uploadLabel = document.createElement("label");
        uploadLabel.classList.add("download-btn");
        uploadLabel.style.cursor = "pointer";
        uploadLabel.textContent = teamLogo ? "Change Logo" : "Upload Logo";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        fileInput.addEventListener("change", e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                teamLogo = ev.target.result;
                localStorage.setItem("teamLogo", teamLogo);
                renderSettings();
            };
            reader.readAsDataURL(file);
        });
        uploadLabel.appendChild(fileInput);
        logoActions.appendChild(uploadLabel);

        if (teamLogo) {
            const removeBtn = document.createElement("button");
            removeBtn.classList.add("clear-comps-btn");
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", () => {
                teamLogo = null;
                localStorage.removeItem("teamLogo");
                renderSettings();
            });
            logoActions.appendChild(removeBtn);
        }
        logoSection.appendChild(logoActions);
        container.appendChild(logoSection);

        // ── Player Names ──────────────────────────────────────
        const labelsSection = makeSection("Player Names");
        const labelsGrid = document.createElement("div");
        labelsGrid.classList.add("player-labels-grid");
        playerLabels.forEach((label, i) => {
            const item = document.createElement("div");
            item.classList.add("player-label-item");
            item.innerHTML = `
                <span class="player-label-default">P${i + 1}</span>
                <input type="text" class="player-label-input"
                       value="${label === `P${i + 1}` ? "" : label}"
                       maxlength="6" placeholder="P${i + 1}" spellcheck="false">
            `;
            item.querySelector("input").addEventListener("input", e => {
                playerLabels[i] = e.target.value.toUpperCase();
                localStorage.setItem("playerLabels", JSON.stringify(playerLabels));
            });
            labelsGrid.appendChild(item);
        });
        labelsSection.appendChild(labelsGrid);
        container.appendChild(labelsSection);

    } else if (activeSettingsTab === "Display") {
        // ── Light Mode ────────────────────────────────────────
        const displaySection = makeSection("Light Mode");
        const lightDiv = document.createElement("div");
        lightDiv.classList.add("setting-map");
        lightDiv.innerHTML = `
            <input type="checkbox" id="light-mode-toggle" ${lightMode ? "checked" : ""}>
            <label for="light-mode-toggle">Light Mode</label>
        `;
        lightDiv.querySelector("input").addEventListener("change", e => {
            lightMode = e.target.checked;
            localStorage.setItem("lightMode", lightMode);
            document.body.classList.toggle("light", lightMode);
        });
        displaySection.appendChild(lightDiv);
        container.appendChild(displaySection);

        // ── Accent Color ──────────────────────────────────────
        const ACCENT_OPTIONS = [
            { label: "Blue",   color: "#2f5cff" },
            { label: "Red",    color: "#ff4655" },
            { label: "Purple", color: "#a855f7" },
            { label: "Teal",   color: "#06b6d4" },
            { label: "Green",  color: "#22c55e" },
            { label: "Orange", color: "#f97316" },
        ];
        const accentSection = makeSection("Accent Color");
        const swatchRow = document.createElement("div");
        swatchRow.classList.add("accent-swatch-row");
        ACCENT_OPTIONS.forEach(({ label, color }) => {
            const btn = document.createElement("button");
            btn.classList.add("accent-swatch");
            btn.style.background = color;
            btn.title = label;
            if (color === accentColor) btn.classList.add("active");
            btn.addEventListener("click", () => {
                accentColor = color;
                localStorage.setItem("accentColor", accentColor);
                applyAccent(accentColor);
                swatchRow.querySelectorAll(".accent-swatch").forEach(s => s.classList.remove("active"));
                btn.classList.add("active");
            });
            swatchRow.appendChild(btn);
        });
        accentSection.appendChild(swatchRow);
        container.appendChild(accentSection);

    } else if (activeSettingsTab === "Map Pool") {
        const banSection = makeSection("Banned Maps");
        const banDiv = document.createElement("div");
        banDiv.classList.add("setting-map");
        banDiv.innerHTML = `
            <input type="checkbox" id="multiple-bans-toggle" ${multipleBans ? "checked" : ""}>
            <label for="multiple-bans-toggle">Allow multiple banned maps</label>
        `;
        banDiv.querySelector("input").addEventListener("change", e => {
            multipleBans = e.target.checked;
            localStorage.setItem("multipleBans", multipleBans);
            if (!multipleBans && bannedMaps.length > 1) {
                bannedMaps = [bannedMaps[0]];
                localStorage.setItem("bannedMaps", JSON.stringify(bannedMaps));
            }
        });
        banSection.appendChild(banDiv);
        container.appendChild(banSection);

        const mapSection = makeSection("Map Pool");
        allMaps.forEach(map => {
            const div = document.createElement("div");
            div.classList.add("setting-map");
            const checked = mapPool.includes(map) ? "checked" : "";
            div.innerHTML = `
                <input type="checkbox" ${checked} id="${map}">
                <label for="${map}">${map}</label>
            `;
            div.querySelector("input").addEventListener("change", e => {
                if (e.target.checked) { mapPool.push(map); }
                else { mapPool = mapPool.filter(m => m !== map); }
                localStorage.setItem("mapPool", JSON.stringify(mapPool));
            });
            mapSection.appendChild(div);
        });
        container.appendChild(mapSection);
    }
}

// ── Comfort List ─────────────────────────────────────────────
function renderComfortList() {
    const container = document.getElementById("comfort-container");
    if (!container) return;

    const TIERS = [
        { key: "Main",             color: "#ff4655" },
        { key: "Comfortable",      color: "#22c55e" },
        { key: "Okay",             color: "#f59e0b" },
        { key: "Willing to Learn", color: "#a78bfa" },
        { key: "Not Playable",     color: "#6b7280" },
    ];

    const dlBtn = document.getElementById("comfort-download-btn");
    if (dlBtn) dlBtn.onclick = downloadComfortList;

    const resetBtn = document.getElementById("comfort-reset-btn");
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (!confirm("Reset all tier placements?")) return;
            localStorage.removeItem("comfortTiers");
            activeTier = "Main";
            renderComfortList();
        };
    }

    function getTiers() { return JSON.parse(localStorage.getItem("comfortTiers")) || {}; }
    function saveTiers(t) { localStorage.setItem("comfortTiers", JSON.stringify(t)); }

    const tiers = getTiers();

    // Map agent → tier color for border styling
    const agentTierColor = {};
    TIERS.forEach(({ key, color }) => {
        (tiers[key] || []).forEach(agent => { agentTierColor[agent] = color; });
    });

    container.innerHTML = "";

    // ── Tier rows (click to activate) ────────────────────────
    const tiersSection = document.createElement("div");
    tiersSection.classList.add("comfort-tiers");

    TIERS.forEach(({ key, color }) => {
        const row = document.createElement("div");
        row.classList.add("comfort-tier-row");
        if (key === activeTier) row.classList.add("active");

        const nameEl = document.createElement("div");
        nameEl.classList.add("comfort-tier-name");
        nameEl.style.backgroundColor = color;
        nameEl.textContent = key;

        const preview = document.createElement("div");
        preview.classList.add("comfort-tier-agents-preview");

        const agentsInTier = tiers[key] || [];
        if (agentsInTier.length === 0) {
            const empty = document.createElement("div");
            empty.classList.add("comfort-tier-empty");
            empty.textContent = "None";
            preview.appendChild(empty);
        } else {
            agentsInTier.forEach(agent => {
                const img = document.createElement("img");
                img.src = `agents/${agent}.png`;
                img.alt = capitalize(agent);
                img.title = capitalize(agent);
                img.classList.add("comfort-tier-chip");
                preview.appendChild(img);
            });
        }

        row.appendChild(nameEl);
        row.appendChild(preview);

        row.addEventListener("click", () => {
            activeTier = key;
            document.querySelectorAll(".comfort-tier-row").forEach(r => r.classList.remove("active"));
            row.classList.add("active");
        });

        tiersSection.appendChild(row);
    });

    container.appendChild(tiersSection);

    // ── Agent grid (click to assign to active tier) ──────────
    Object.entries(agentsByClass).forEach(([role, agents]) => {
        const section = document.createElement("div");
        section.classList.add("agent-section");
        section.innerHTML = `<h2>${role}</h2><div class="agent-grid"></div>`;
        const grid = section.querySelector(".agent-grid");

        agents.forEach(agent => {
            const card = document.createElement("div");
            card.classList.add("agent-card");
            card.dataset.agent = agent;

            const tierColor = agentTierColor[agent];
            if (tierColor) {
                card.style.borderColor = tierColor;
                card.style.backgroundColor = tierColor + "1a";
            }

            card.innerHTML = `
                <img src="agents/${agent}.png" alt="${capitalize(agent)}">
                <div class="agent-name">${capitalize(agent)}</div>
            `;

            card.addEventListener("click", () => {
                const t = getTiers();
                const currentTier = TIERS.find(({ key }) => (t[key] || []).includes(agent))?.key;
                if (currentTier === activeTier) {
                    t[currentTier] = t[currentTier].filter(a => a !== agent);
                } else {
                    if (currentTier) t[currentTier] = t[currentTier].filter(a => a !== agent);
                    if (!t[activeTier]) t[activeTier] = [];
                    if (!t[activeTier].includes(agent)) t[activeTier].push(agent);
                }
                saveTiers(t);
                renderComfortList();
            });

            grid.appendChild(card);
        });

        container.appendChild(section);
    });
}

// ── Extra Tools ──────────────────────────────────────────────
function renderExtraTools() {
    const container = document.getElementById("extra-tools-container");
    if (!container) return;

    container.innerHTML = "";

    // Tab bar
    const tabBar = document.createElement("div");
    tabBar.classList.add("settings-tabs");
    ["Comfort List", "Randomizer", "Role Breakdown", "Comp Analysis"].forEach(tab => {
        const btn = document.createElement("button");
        btn.classList.add("settings-tab-btn");
        btn.textContent = tab;
        if (tab === activeExtraTab) btn.classList.add("active");
        btn.addEventListener("click", () => { activeExtraTab = tab; renderExtraTools(); });
        tabBar.appendChild(btn);
    });
    container.appendChild(tabBar);

    if (activeExtraTab === "Comfort List") {
        // Header buttons (renderComfortList picks these up by ID)
        const header = document.createElement("div");
        header.classList.add("comfort-header");
        const dlBtn = document.createElement("button");
        dlBtn.id = "comfort-download-btn";
        dlBtn.classList.add("download-btn");
        dlBtn.textContent = "Download Screenshot";
        const rstBtn = document.createElement("button");
        rstBtn.id = "comfort-reset-btn";
        rstBtn.classList.add("clear-comps-btn");
        rstBtn.textContent = "Reset";
        header.appendChild(dlBtn);
        header.appendChild(rstBtn);
        container.appendChild(header);

        const comfortDiv = document.createElement("div");
        comfortDiv.id = "comfort-container";
        container.appendChild(comfortDiv);

        renderComfortList();

    } else if (activeExtraTab === "Randomizer") {
        renderRandomizerTab(container);
    } else if (activeExtraTab === "Role Breakdown") {
        renderRoleBreakdownTab(container);
    } else if (activeExtraTab === "Comp Analysis") {
        renderCompAnalysisTab(container);
    }
}

// ── Comp Analysis ─────────────────────────────────────────────
function getAgentRole(agent) {
    for (const [role, agents] of Object.entries(agentsByClass)) {
        if (agents.includes(agent)) return role;
    }
    return null;
}

function getAgentSubRole(agent) {
    for (const { subRoles } of roleBreakdown) {
        for (const { name, agents } of subRoles) {
            if (agents.includes(agent)) return name;
        }
    }
    return null;
}

function getMapBonus(map, agentSet, subRoleSet) {
    const b = { score: 0, strengths: [], weaknesses: [] };
    switch (map) {
        case "Ascent":
            if (agentSet.has("killjoy"))                        { b.score += 5; b.strengths.push("Killjoy is a top pick on Ascent for locking down B or A site"); }
            if (agentSet.has("omen") || agentSet.has("astra")) { b.score += 3; b.strengths.push("Global smokes provide flexible coverage across Ascent's mid"); }
            if (agentSet.has("reyna"))                          { b.score -= 3; b.weaknesses.push("Reyna offers limited team utility on Ascent compared to other duelists"); }
            break;
        case "Bind":
            if (agentSet.has("brimstone"))                      { b.score += 5; b.strengths.push("Brimstone's triple smokes are ideal for Bind's tight defender positions"); }
            if (agentSet.has("raze"))                           { b.score += 3; b.strengths.push("Raze's mobility pairs well with Bind's teleporters for fast flanks"); }
            if (subRoleSet.has("Wall Smokes"))                  { b.score += 3; b.strengths.push("Viper wall cuts off Hookah and Showers entries cleanly"); }
            break;
        case "Breeze":
            if (subRoleSet.has("Wall Smokes"))                  { b.score += 8; b.strengths.push("Wall smokes are near-essential to cut Breeze's long open sightlines"); }
            else                                                { b.score -= 5; b.weaknesses.push("Breeze's long sightlines demand wall smokes — Viper is a near must-pick"); }
            if (agentSet.has("jett") || agentSet.has("chamber")){ b.score += 4; b.strengths.push("Op-friendly duelist thrives on Breeze's long-range angles"); }
            if (agentSet.has("sova"))                           { b.score += 3; b.strengths.push("Sova's recon has clear line-of-sight across Breeze's open layout"); }
            break;
        case "Fracture":
            if (subRoleSet.has("Flash Initiator"))              { b.score += 5; b.strengths.push("Flash initiators are key for coordinating Fracture's split-attack rotations"); }
            if (agentSet.has("breach"))                         { b.score += 4; b.strengths.push("Breach excels at clearing Fracture's close-angle chokepoints"); }
            if (agentSet.has("neon") || agentSet.has("raze"))   { b.score += 3; b.strengths.push("Mobile duelist thrives in Fracture's fast-push playstyle"); }
            break;
        case "Haven":
            if (subRoleSet.has("Solo Site Sentinel"))           { b.score += 6; b.strengths.push("Solo sentinel holds one of Haven's three sites alone, freeing teammates"); }
            else                                                { b.score -= 3; b.weaknesses.push("Haven's three sites benefit greatly from a solo-hold sentinel"); }
            if (agentSet.has("brimstone"))                      { b.score += 4; b.strengths.push("Brimstone's precise triple smokes cover all three of Haven's key spots"); }
            break;
        case "Icebox":
            if (subRoleSet.has("Wall Smokes"))                  { b.score += 8; b.strengths.push("Wall smokes dominate Icebox's B orange control and tube executes"); }
            else                                                { b.score -= 5; b.weaknesses.push("Icebox heavily rewards wall smokes — Viper is near must-pick here"); }
            if (agentSet.has("sage"))                           { b.score += 4; b.strengths.push("Sage wall blocks B tube and A screens for strong defensive anchors"); }
            if (agentSet.has("killjoy"))                        { b.score += 3; b.strengths.push("Killjoy's lockdown is punishing in Icebox's enclosed site areas"); }
            break;
        case "Lotus":
            if (subRoleSet.has("Wall Smokes"))                  { b.score += 5; b.strengths.push("Viper wall splits Lotus's linked sites and cuts rotate paths efficiently"); }
            if (agentSet.has("astra") || agentSet.has("brimstone")){ b.score += 3; b.strengths.push("Global smokes help manage Lotus's three-site pressure with wide reach"); }
            if (subRoleSet.has("Info Initiator"))               { b.score += 3; b.strengths.push("Info utility reads Lotus's rotate-heavy defender setups before committing"); }
            break;
        case "Pearl":
            if (subRoleSet.has("Wall Smokes"))                  { b.score += 5; b.strengths.push("Viper wall controls Pearl's crucial mid and blocks B main cleanly"); }
            if (agentSet.has("fade"))                           { b.score += 4; b.strengths.push("Fade's recon excels in Pearl's tight and layered corridors"); }
            if (agentSet.has("kayo"))                           { b.score += 3; b.strengths.push("KAY/O's suppression shuts down Pearl's coordinated defender setups"); }
            break;
        case "Split":
            if (subRoleSet.has("Wall Smokes"))                  { b.score += 5; b.strengths.push("Wall smokes carve through Split's narrow chokepoints efficiently"); }
            if (agentSet.has("sage"))                           { b.score += 5; b.strengths.push("Sage wall is one of the strongest tools on Split, blocking ramps and mid"); }
            if (agentSet.has("cypher") || agentSet.has("killjoy")){ b.score += 3; b.strengths.push("Setup sentinels are ideal for Split's stacked and predictable sites"); }
            break;
        case "Sunset":
            if (agentSet.has("kayo"))                           { b.score += 4; b.strengths.push("KAY/O's suppression shuts down defender setups on Sunset effectively"); }
            if (agentSet.has("brimstone"))                      { b.score += 3; b.strengths.push("Brimstone's stim and smokes complement Sunset's mid-focused fighting"); }
            break;
        case "Abyss":
            if (subRoleSet.has("Info Initiator"))               { b.score += 4; b.strengths.push("Info utility is valuable on Abyss's open and information-dependent layout"); }
            if (agentSet.has("viper"))                          { b.score -= 2; b.weaknesses.push("Viper's wall has fewer natural surfaces to anchor on Abyss"); }
            break;
    }
    return b;
}

function analyzeComp(map, comp) {
    const agents = [];
    for (let i = 1; i <= 5; i++) { if (comp[i]) agents.push(comp[i]); }
    if (agents.length === 0) return null;

    const roles      = agents.map(getAgentRole);
    const subRoles   = agents.map(getAgentSubRole);
    const subRoleSet = new Set(subRoles);
    const agentSet   = new Set(agents);

    let score = 0;
    const strengths = [], weaknesses = [];

    // Role coverage
    const hasController = roles.includes("Controllers");
    const hasInitiator  = roles.includes("Initiators");
    const hasSentinel   = roles.includes("Sentinels");
    const duelistCount  = roles.filter(r => r === "Duelists").length;

    if (hasController) { score += 20; strengths.push("Has smoke coverage to cut sightlines and control space"); }
    else               { weaknesses.push("No controller — site executes and map control will be difficult"); }

    if (hasInitiator)  { score += 15; }
    else               { weaknesses.push("No initiator — no flash or recon utility to open angles safely"); }

    if (hasSentinel)   { score += 15; }
    else               { weaknesses.push("No sentinel — no anchor, flank watch, or site-hold utility"); }

    // Duelist balance
    if      (duelistCount === 0) { weaknesses.push("No duelist — the team may struggle to win first contact fights"); }
    else if (duelistCount === 1) { score += 8; }
    else if (duelistCount === 2) { score += 15; strengths.push("Dual duelist setup for strong and flexible entry potential"); }
    else if (duelistCount === 3) { score += 5;  weaknesses.push("Three duelists leaves the team light on support and utility"); }
    else                         {              weaknesses.push("Four or more duelists — severely lacking utility and support roles"); }

    // Sub-role synergies
    const hasEntry     = subRoleSet.has("Entry Duelist");
    const hasSpecialty = subRoleSet.has("Specialty Duelist");
    const hasFlash     = subRoleSet.has("Flash Initiator");
    const hasInfo      = subRoleSet.has("Info Initiator");
    const hasOrb       = subRoleSet.has("Orb Smokes");
    const hasSoloSen   = subRoleSet.has("Solo Site Sentinel");

    if (hasEntry)                  score += 5;
    if (hasFlash)                  score += 5;
    if (hasEntry && hasFlash)    { score += 5; strengths.push("Entry duelist and flash initiator combo for clean, coordinated site takes"); }
    if (hasEntry && hasSpecialty){ strengths.push("Entry and specialty duelist pairing covers both space creation and team utility"); }
    if (hasInfo && hasOrb)       { score += 3; strengths.push("Info initiator paired with smokes for full pre-execute site control"); }
    if (hasSoloSen)              { score += 5; strengths.push("Solo site sentinel holds a site alone and stalls for rotates"); }
    if (hasFlash && !hasEntry)   { weaknesses.push("Flash initiator without an entry duelist limits how much the flashes can be converted"); }

    // Completeness
    if (agents.length >= 5) score += 5;
    else weaknesses.push(`Only ${agents.length} of 5 agents filled — add more agents for a complete picture`);

    // Map bonus
    const bonus = getMapBonus(map, agentSet, subRoleSet);
    score += bonus.score;
    strengths.push(...bonus.strengths);
    weaknesses.push(...bonus.weaknesses);

    score = Math.min(100, Math.max(0, score));
    const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";
    return { score, grade, strengths, weaknesses };
}

function renderCompAnalysis(map, container) {
    container.innerHTML = "";
    if (!map) return;

    const comp   = comps[map] || {};
    const agents = Object.values(comp).filter(Boolean);

    if (agents.length === 0) {
        const empty = document.createElement("div");
        empty.classList.add("ca-empty");
        empty.textContent = `No comp saved for ${map}. Build one in the Comp Builder first.`;
        container.appendChild(empty);
        return;
    }

    // Agent preview
    const preview = document.createElement("div");
    preview.classList.add("ca-preview");
    for (let i = 1; i <= 5; i++) {
        const agent = comp[i];
        const slot  = document.createElement("div");
        slot.classList.add("ca-agent");
        if (agent) {
            slot.innerHTML = `
                <img src="agents/${agent}.png" alt="${capitalize(agent)}">
                <div class="ca-agent-name">${capitalize(agent)}</div>
            `;
        } else {
            slot.innerHTML = `<div class="ca-agent-empty">—</div>`;
        }
        preview.appendChild(slot);
    }
    container.appendChild(preview);

    const result = analyzeComp(map, comp);
    if (!result) return;

    const gradeColors = { S: "#22c55e", A: "#2f5cff", B: "#f59e0b", C: "#f97316", D: "#ff4655" };
    const gradeColor  = gradeColors[result.grade];

    // Grade card
    const gradeCard = document.createElement("div");
    gradeCard.classList.add("ca-grade-card");
    gradeCard.innerHTML = `
        <div class="ca-grade-letter" style="color:${gradeColor}">${result.grade}</div>
        <div class="ca-grade-info">
            <div class="ca-grade-score">${result.score}<span class="ca-grade-denom">/100</span></div>
            <div class="ca-grade-map">${map}</div>
        </div>
    `;
    container.appendChild(gradeCard);

    // Strengths
    if (result.strengths.length > 0) {
        const sec = document.createElement("div");
        sec.classList.add("ca-section");
        sec.innerHTML = `<div class="ca-section-title ca-good">Strengths</div>`;
        result.strengths.forEach(s => {
            const item = document.createElement("div");
            item.classList.add("ca-item", "ca-item-good");
            item.textContent = s;
            sec.appendChild(item);
        });
        container.appendChild(sec);
    }

    // Weaknesses
    if (result.weaknesses.length > 0) {
        const sec = document.createElement("div");
        sec.classList.add("ca-section");
        sec.innerHTML = `<div class="ca-section-title ca-bad">Weaknesses</div>`;
        result.weaknesses.forEach(w => {
            const item = document.createElement("div");
            item.classList.add("ca-item", "ca-item-bad");
            item.textContent = w;
            sec.appendChild(item);
        });
        container.appendChild(sec);
    }
}

function renderCompAnalysisTab(container) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("comp-analysis");

    const sel = document.createElement("select");
    sel.classList.add("ca-select");
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "Choose a map...";
    sel.appendChild(def);
    mapPool.forEach(map => {
        const opt = document.createElement("option");
        opt.value = map;
        opt.textContent = map;
        sel.appendChild(opt);
    });

    const resultArea = document.createElement("div");
    sel.addEventListener("change", () => renderCompAnalysis(sel.value, resultArea));

    wrapper.appendChild(sel);
    wrapper.appendChild(resultArea);
    container.appendChild(wrapper);
}

// ── Role Breakdown ────────────────────────────────────────────
const roleBreakdown = [
    {
        role: "Duelist",
        color: "#ff4655",
        subRoles: [
            {
                name: "Entry Duelist",
                desc: "The initial break into a site, built to be first contact with strong movement tools that lead pushes and create space for the team.",
                agents: ["jett", "raze", "neon", "waylay"],
                link: "https://youtu.be/r6gu3kr1rCw?si=9gJZhULfp-AMMkPR"
            },
            {
                name: "Specialty Duelist",
                desc: "Team pieces with strong utility who play secondary to an entry duelist, enabling the team rather than purely fragging.",
                agents: ["reyna", "phoenix", "iso", "yoru"],
                link: "https://youtu.be/OSbv2GtAfHk?si=LVccPt3-Aae0xqUr"
            }
        ]
    },
    {
        role: "Controller",
        color: "#a78bfa",
        subRoles: [
            {
                name: "Orb Smokes",
                desc: "Cut off sightlines and form one-ways remotely, giving the team flexible map-wide control without committing to a position.",
                agents: ["astra", "brimstone", "omen", "clove", "miks"],
                link: "https://youtu.be/GJexPatsblU?si=yRIR4su3qdi-mywC"
            },
            {
                name: "Wall Smokes",
                desc: "Split sites and reshape the fight with long linear walls, fundamentally changing the angles and territory available to both sides.",
                agents: ["harbor", "viper"],
                link: "https://youtube.com/shorts/GtplC_5gKb4?si=shywfPOwohaaIBvc"
            }
        ]
    },
    {
        role: "Initiator",
        color: "#22c55e",
        subRoles: [
            {
                name: "Flash Initiator",
                desc: "Allow for easier fights and clear dangerous angles with flashes and crowd-control, making entries safer for the whole team.",
                agents: ["breach", "gekko", "kayo", "skye"],
                link: "https://youtu.be/iHf1cie5MxY?si=ma84XkdDkdNdMUlI"
            },
            {
                name: "Info Initiator",
                desc: "Clear angles and unknowns with information-gathering utility, telling the team exactly what they're walking into before committing.",
                agents: ["fade", "sova", "tejo"],
                link: "https://youtu.be/Rvy4YA-P03s?si=btbcnFn271t8Qqmw"
            }
        ]
    },
    {
        role: "Sentinel",
        color: "#f59e0b",
        subRoles: [
            {
                name: "Solo Site Sentinel",
                desc: "Hold a site with setups and utility that stall for rotates while gathering passive info, capable of managing a site alone.",
                agents: ["cypher", "killjoy", "vyse", "veto"],
                link: "https://youtu.be/ZQ9xI2czBtg?si=s_hnJZJv7GervPKC"
            },
            {
                name: "Team Play Sentinel",
                desc: "Create fights and support the team with utility that goes beyond solo holding, enabling plays and keeping teammates in the game.",
                agents: ["chamber", "deadlock", "sage"],
                link: "https://youtu.be/qUKx_4ZljiI?si=qaJy7R2RccNnpv6z"
            }
        ]
    }
];

function renderRoleBreakdownTab(container) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("role-breakdown");

    roleBreakdown.forEach(({ role, color, subRoles }) => {
        const section = document.createElement("div");
        section.classList.add("rb-section");

        const header = document.createElement("div");
        header.classList.add("rb-section-header");
        const bar = document.createElement("div");
        bar.classList.add("rb-role-bar");
        bar.style.background = color;
        const nameEl = document.createElement("span");
        nameEl.classList.add("rb-role-name");
        nameEl.style.color = color;
        nameEl.textContent = role;
        header.appendChild(bar);
        header.appendChild(nameEl);
        section.appendChild(header);

        const subRolesEl = document.createElement("div");
        subRolesEl.classList.add("rb-subroles");

        subRoles.forEach(({ name, desc, agents, link }) => {
            const sr = document.createElement("div");
            sr.classList.add("rb-subrole");

            const srHeader = document.createElement("div");
            srHeader.classList.add("rb-subrole-header");

            const srName = document.createElement("div");
            srName.classList.add("rb-subrole-name");
            srName.textContent = name;

            const srLink = document.createElement("a");
            srLink.classList.add("rb-how-to-btn");
            srLink.href = link;
            srLink.target = "_blank";
            srLink.rel = "noopener noreferrer";
            srLink.textContent = "How to Play";

            srHeader.appendChild(srName);
            srHeader.appendChild(srLink);

            const srDesc = document.createElement("div");
            srDesc.classList.add("rb-subrole-desc");
            srDesc.textContent = desc;

            const agentsRow = document.createElement("div");
            agentsRow.classList.add("rb-agents");
            agents.forEach(agent => {
                const agentEl = document.createElement("div");
                agentEl.classList.add("rb-agent");
                agentEl.innerHTML = `
                    <img src="agents/${agent}.png" alt="${capitalize(agent)}">
                    <div class="rb-agent-name">${capitalize(agent)}</div>
                `;
                agentsRow.appendChild(agentEl);
            });

            sr.appendChild(srHeader);
            sr.appendChild(srDesc);
            sr.appendChild(agentsRow);
            subRolesEl.appendChild(sr);
        });

        section.appendChild(subRolesEl);
        wrapper.appendChild(section);
    });

    container.appendChild(wrapper);
}

function generateRandomComp() {
    const pool = Object.entries(agentsByClass).flatMap(([cls, agents]) =>
        agents.map(a => ({ agent: a, cls }))
    );
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const classCounts = {};
    const selected = [];
    for (const entry of pool) {
        if (selected.length >= 5) break;
        if ((classCounts[entry.cls] || 0) >= 2) continue;
        classCounts[entry.cls] = (classCounts[entry.cls] || 0) + 1;
        selected.push(entry);
    }
    return selected;
}

function renderRandomizerTab(container) {
    const CLASS_COLORS = {
        Duelists:    "#ff4655",
        Controllers: "#a78bfa",
        Initiators:  "#22c55e",
        Sentinels:   "#f59e0b",
    };

    const section = document.createElement("div");
    section.classList.add("randomizer-section");

    const genBtn = document.createElement("button");
    genBtn.classList.add("randomizer-gen-btn");
    genBtn.textContent = "Generate Random Comp";

    const resultDiv = document.createElement("div");
    resultDiv.classList.add("randomizer-result");

    genBtn.addEventListener("click", () => {
        randomComp = generateRandomComp();
        drawRandomizerResult(resultDiv, randomComp, CLASS_COLORS);
    });

    section.appendChild(genBtn);
    section.appendChild(resultDiv);
    container.appendChild(section);

    // Restore previous result if any
    if (randomComp) drawRandomizerResult(resultDiv, randomComp, CLASS_COLORS);
}

function drawRandomizerResult(container, comp, CLASS_COLORS) {
    container.innerHTML = "";

    const row = document.createElement("div");
    row.classList.add("randomizer-agent-row");

    comp.forEach(({ agent, cls }) => {
        const color = CLASS_COLORS[cls] || "#888";
        const card = document.createElement("div");
        card.classList.add("randomizer-agent-card");
        card.style.borderColor = color + "40";
        card.innerHTML = `
            <img src="agents/${agent}.png" alt="${capitalize(agent)}">
            <div class="randomizer-agent-name">${capitalize(agent)}</div>
            <div class="randomizer-agent-class" style="color:${color}">${cls}</div>
        `;
        row.appendChild(card);
    });

    container.appendChild(row);

    // Class breakdown pills
    const breakdown = {};
    comp.forEach(({ cls }) => { breakdown[cls] = (breakdown[cls] || 0) + 1; });
    const bdRow = document.createElement("div");
    bdRow.classList.add("randomizer-breakdown");
    Object.entries(breakdown).forEach(([cls, count]) => {
        const pill = document.createElement("span");
        pill.classList.add("randomizer-class-pill");
        pill.style.borderColor = CLASS_COLORS[cls] + "55";
        pill.style.color = CLASS_COLORS[cls];
        pill.textContent = `${cls} ×${count}`;
        bdRow.appendChild(pill);
    });
    container.appendChild(bdRow);
}

function makeSection(title) {
    const section = document.createElement("div");
    section.classList.add("settings-section");
    const h = document.createElement("h2");
    h.classList.add("settings-label");
    h.textContent = title;
    section.appendChild(h);
    return section;
}
