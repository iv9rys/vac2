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
    ["Comfort List", "Randomizer"].forEach(tab => {
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
    }
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
