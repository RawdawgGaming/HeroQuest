(function () {
  "use strict";

  const STORAGE_KEY = "heroquest:forest-map-composer:layout";
  const WORLD = { width: 8000, height: 720 };
  const KIT_PATH = "assets/biomes/enchanted-forest-kit/atlases/";
  const LOCAL_KIT_PATH = "public/assets/biomes/enchanted-forest-kit/atlases/";

  const ATLASES = [
    { key: "forestTerrainTiles", label: "Terrain", file: "terrain-tiles-atlas.png", columns: 6, rows: 4, frameWidth: 256, frameHeight: 256, category: "terrain", depth: -20, scrollFactor: 1 },
    { key: "forestWaterWetland", label: "Water", file: "water-wetland-atlas.png", columns: 6, rows: 4, frameWidth: 256, frameHeight: 256, category: "water", depth: -18, scrollFactor: 1 },
    { key: "forestCliffsBridgesPlatforms", label: "Cliffs", file: "cliffs-bridges-platforms-atlas.png", columns: 6, rows: 4, frameWidth: 256, frameHeight: 256, category: "cliff", depth: -12, scrollFactor: 1 },
    { key: "forestTreesFoliage", label: "Foliage", file: "trees-foliage-atlas.png", columns: 6, rows: 4, frameWidth: 256, frameHeight: 256, category: "foliage", depth: -110, scrollFactor: 0.75 },
    { key: "forestRuinsProps", label: "Props", file: "ruins-props-atlas.png", columns: 6, rows: 4, frameWidth: 256, frameHeight: 256, category: "prop", depth: -8, scrollFactor: 1 },
    { key: "forestFogFxDecals", label: "FX", file: "fog-fx-decals-atlas.png", columns: 6, rows: 4, frameWidth: 256, frameHeight: 256, category: "fx", depth: 600, scrollFactor: 0.85, blendMode: "SCREEN" }
  ];

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const assetGrid = document.getElementById("assetGrid");
  const tabs = document.getElementById("categoryTabs");
  const props = document.getElementById("propertiesPanel");
  const mouseStatus = document.getElementById("mouseStatus");
  const selectedStatus = document.getElementById("selectedStatus");
  const countStatus = document.getElementById("countStatus");
  const zoomStatus = document.getElementById("zoomStatus");
  const zoomSelect = document.getElementById("zoomSelect");
  const importFile = document.getElementById("importFile");

  const state = {
    images: new Map(),
    activeAtlas: ATLASES[0],
    activeFrame: 0,
    selectedId: null,
    zoom: 1,
    camera: { x: 0, y: 0 },
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0 },
    dragging: null,
    panning: null,
    showGrid: true,
    showCollision: true,
    showWater: true,
    layout: newLayout()
  };

  function newLayout() {
    return {
      id: "forest-stage-1",
      world: { width: 8000, height: 720 },
      spawn: { x: 180, y: 470 },
      exit: { x: 7580, y: 370, width: 260, height: 170 },
      placements: [],
      collision: [{ x: 0, y: 420, width: 8000, height: 140, label: "main-walk-band" }],
      waterRegions: []
    };
  }

  function assetCandidates(file) {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const appBase = pathParts.length > 0 ? `/${pathParts[0]}/` : "/";
    return [
      `${KIT_PATH}${file}`,
      `/${KIT_PATH}${file}`,
      `${appBase}${KIT_PATH}${file}`,
      `${LOCAL_KIT_PATH}${file}`,
      `/${LOCAL_KIT_PATH}${file}`,
      `${appBase}${LOCAL_KIT_PATH}${file}`
    ].filter((value, index, array) => array.indexOf(value) === index);
  }

  function loadImageFromCandidates(file) {
    const candidates = assetCandidates(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      let index = 0;
      img.onload = () => resolve(img);
      img.onerror = () => {
        index += 1;
        if (index >= candidates.length) {
          reject(new Error(`Could not load ${file}. Tried:\n${candidates.join("\n")}`));
          return;
        }
        img.src = candidates[index];
      };
      img.src = candidates[index];
    });
  }

  function frameRect(atlas, frame) {
    const col = frame % atlas.columns;
    const row = Math.floor(frame / atlas.columns);
    return {
      x: col * atlas.frameWidth,
      y: row * atlas.frameHeight,
      width: atlas.frameWidth,
      height: atlas.frameHeight
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function screenToWorld(x, y) {
    return {
      x: state.camera.x + x / state.zoom,
      y: state.camera.y + y / state.zoom
    };
  }

  function worldToScreen(x, y) {
    return {
      x: (x - state.camera.x) * state.zoom,
      y: (y - state.camera.y) * state.zoom
    };
  }

  function drawFrame(atlas, frame, x, y, scaleX = 1, scaleY = 1, rotation = 0, flipX = false, alpha = 1, blendMode = "NORMAL") {
    const img = state.images.get(atlas.key);
    if (!img) return;
    const r = frameRect(atlas, frame);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale((flipX ? -1 : 1) * scaleX, scaleY);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = blendMode === "ADD" || blendMode === "SCREEN" ? "screen" : blendMode === "MULTIPLY" ? "multiply" : "source-over";
    ctx.drawImage(img, r.x, r.y, r.width, r.height, -r.width / 2, -r.height / 2, r.width, r.height);
    ctx.restore();
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#050b09";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    drawWorldBackdrop();
    if (state.showGrid) drawGrid();
    drawGuides();

    const placements = [...state.layout.placements].sort((a, b) => a.depth - b.depth);
    for (const p of placements) {
      const atlas = ATLASES.find((a) => a.key === p.atlasKey);
      if (!atlas) continue;
      drawFrame(atlas, p.frame, p.x, p.y, p.scaleX, p.scaleY, p.rotation, p.flipX, 1, p.blendMode);
      if (p.id === state.selectedId) drawSelection(p, atlas);
    }

    ctx.restore();
    updateStatus();
  }

  function drawWorldBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    gradient.addColorStop(0, "#0a1d14");
    gradient.addColorStop(0.5, "#10291a");
    gradient.addColorStop(1, "#06100b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.strokeStyle = "rgba(211,241,174,0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(214,238,178,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }
  }

  function drawGuides() {
    ctx.fillStyle = "rgba(225, 196, 75, 0.08)";
    ctx.fillRect(0, 420, WORLD.width, 140);
    ctx.strokeStyle = "rgba(241, 219, 106, 0.5)";
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(0, 420, WORLD.width, 140);
    ctx.setLineDash([]);

    if (state.showCollision) {
      ctx.fillStyle = "rgba(255, 82, 104, 0.16)";
      ctx.strokeStyle = "rgba(255, 82, 104, 0.8)";
      for (const c of state.layout.collision) {
        ctx.fillRect(c.x, c.y, c.width, c.height);
        ctx.strokeRect(c.x, c.y, c.width, c.height);
      }
    }

    if (state.showWater) {
      ctx.fillStyle = "rgba(62, 210, 230, 0.16)";
      ctx.strokeStyle = "rgba(89, 236, 243, 0.78)";
      for (const w of state.layout.waterRegions) {
        ctx.fillRect(w.x, w.y, w.width, w.height);
        ctx.strokeRect(w.x, w.y, w.width, w.height);
      }
    }
  }

  function drawSelection(p, atlas) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.scale(Math.abs(p.scaleX), Math.abs(p.scaleY));
    ctx.strokeStyle = "#f4d04d";
    ctx.lineWidth = 3 / Math.max(0.5, state.zoom);
    ctx.setLineDash([8 / state.zoom, 5 / state.zoom]);
    ctx.strokeRect(-atlas.frameWidth / 2, -atlas.frameHeight / 2, atlas.frameWidth, atlas.frameHeight);
    ctx.restore();
  }

  function buildPalette() {
    tabs.innerHTML = "";
    for (const atlas of ATLASES) {
      const button = document.createElement("button");
      button.className = `tab${atlas.key === state.activeAtlas.key ? " active" : ""}`;
      button.textContent = atlas.label;
      button.onclick = () => {
        state.activeAtlas = atlas;
        state.activeFrame = 0;
        buildPalette();
      };
      tabs.appendChild(button);
    }

    assetGrid.innerHTML = "";
    const frameCount = state.activeAtlas.columns * state.activeAtlas.rows;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const tile = document.createElement("button");
      tile.className = `asset-tile${frame === state.activeFrame ? " selected" : ""}`;
      tile.title = `${state.activeAtlas.label} frame ${frame}`;
      const thumb = document.createElement("canvas");
      thumb.width = 128;
      thumb.height = 96;
      tile.appendChild(thumb);
      drawThumb(thumb, state.activeAtlas, frame);
      tile.onclick = () => {
        state.activeFrame = frame;
        buildPalette();
      };
      assetGrid.appendChild(tile);
    }
  }

  function drawThumb(thumb, atlas, frame) {
    const img = state.images.get(atlas.key);
    const tctx = thumb.getContext("2d");
    tctx.clearRect(0, 0, thumb.width, thumb.height);
    if (!img) return;
    const r = frameRect(atlas, frame);
    const scale = Math.min(thumb.width / r.width, thumb.height / r.height) * 0.92;
    const w = r.width * scale;
    const h = r.height * scale;
    tctx.drawImage(img, r.x, r.y, r.width, r.height, (thumb.width - w) / 2, (thumb.height - h) / 2, w, h);
  }

  function createPlacement(x, y) {
    const atlas = state.activeAtlas;
    const snapped = atlas.category === "terrain" || atlas.category === "water";
    const px = snapped ? Math.round(x / 64) * 64 : x;
    const py = snapped ? Math.round(y / 64) * 64 : y;
    const p = {
      id: `${atlas.category}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`,
      atlasKey: atlas.key,
      frame: state.activeFrame,
      x: Math.round(px),
      y: Math.round(py),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      flipX: false,
      depth: atlas.depth,
      scrollFactor: atlas.scrollFactor,
      category: atlas.category,
      blendMode: atlas.blendMode || "NORMAL"
    };
    state.layout.placements.push(p);
    select(p.id);
  }

  function hitTest(x, y) {
    const list = [...state.layout.placements].sort((a, b) => b.depth - a.depth);
    for (const p of list) {
      const atlas = ATLASES.find((a) => a.key === p.atlasKey);
      if (!atlas) continue;
      const hw = Math.abs(atlas.frameWidth * p.scaleX) / 2;
      const hh = Math.abs(atlas.frameHeight * p.scaleY) / 2;
      if (x >= p.x - hw && x <= p.x + hw && y >= p.y - hh && y <= p.y + hh) return p;
    }
    return null;
  }

  function selected() {
    return state.layout.placements.find((p) => p.id === state.selectedId) || null;
  }

  function select(id) {
    state.selectedId = id;
    renderProperties();
    render();
  }

  function renderProperties() {
    const p = selected();
    if (!p) {
      props.innerHTML = `
        <form>
          ${field("Map ID", "id", state.layout.id)}
          ${field("Spawn X", "spawn.x", state.layout.spawn.x, "number")}
          ${field("Spawn Y", "spawn.y", state.layout.spawn.y, "number")}
          ${field("Exit X", "exit.x", state.layout.exit.x, "number")}
          ${field("Exit Y", "exit.y", state.layout.exit.y, "number")}
          ${field("Exit W", "exit.width", state.layout.exit.width, "number")}
          ${field("Exit H", "exit.height", state.layout.exit.height, "number")}
        </form>`;
      bindMapFields();
      return;
    }

    props.innerHTML = `
      <form>
        ${field("ID", "id", p.id)}
        ${readonly("Atlas", p.atlasKey)}
        ${field("Frame", "frame", p.frame, "number")}
        ${field("X", "x", p.x, "number")}
        ${field("Y", "y", p.y, "number")}
        ${field("Scale X", "scaleX", p.scaleX, "number", "0.05")}
        ${field("Scale Y", "scaleY", p.scaleY, "number", "0.05")}
        ${field("Rotation", "rotation", p.rotation, "number", "0.01")}
        <div class="field inline"><label>Flip X</label><input data-prop="flipX" type="checkbox" ${p.flipX ? "checked" : ""}></div>
        ${field("Depth", "depth", p.depth, "number")}
        ${field("Scroll", "scrollFactor", p.scrollFactor, "number", "0.05")}
        ${selectField("Category", "category", p.category, ["terrain", "water", "cliff", "bridge", "tree", "foliage", "ruin", "prop", "fog", "fx", "decal"])}
        ${selectField("Blend", "blendMode", p.blendMode || "NORMAL", ["NORMAL", "ADD", "SCREEN", "MULTIPLY"])}
        <button type="button" class="delete-button" data-delete>Delete Object</button>
      </form>`;

    props.querySelectorAll("[data-prop]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.prop;
        p[key] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
        render();
      });
    });
    props.querySelector("[data-delete]").onclick = deleteSelected;
  }

  function field(label, prop, value, type = "text", step = "1") {
    return `<div class="field"><label>${label}</label><input data-prop="${prop}" type="${type}" step="${step}" value="${value}"></div>`;
  }

  function readonly(label, value) {
    return `<div class="field"><label>${label}</label><input readonly value="${value}"></div>`;
  }

  function selectField(label, prop, value, options) {
    return `<div class="field"><label>${label}</label><select data-prop="${prop}">${options.map((o) => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
  }

  function bindMapFields() {
    props.querySelectorAll("[data-prop]").forEach((input) => {
      input.addEventListener("input", () => {
        const path = input.dataset.prop.split(".");
        let target = state.layout;
        while (path.length > 1) target = target[path.shift()];
        target[path[0]] = input.type === "number" ? Number(input.value) : input.value;
        render();
      });
    });
  }

  function updateStatus() {
    mouseStatus.textContent = `Mouse: ${Math.round(state.mouse.worldX)}, ${Math.round(state.mouse.worldY)}`;
    selectedStatus.textContent = `Selected: ${state.selectedId || "none"}`;
    countStatus.textContent = `Objects: ${state.layout.placements.length}`;
    zoomStatus.textContent = `Zoom: ${Math.round(state.zoom * 100)}%`;
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    state.layout.placements = state.layout.placements.filter((p) => p.id !== state.selectedId);
    state.selectedId = null;
    renderProperties();
    render();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.layout.id || "forest-map"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setLayout(layout) {
    if (!layout || !Array.isArray(layout.placements)) throw new Error("Invalid layout JSON");
    state.layout = layout;
    state.selectedId = null;
    renderProperties();
    render();
  }

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const w = screenToWorld(sx, sy);

    if (event.button === 1 || event.button === 2) {
      state.panning = { x: event.clientX, y: event.clientY, cameraX: state.camera.x, cameraY: state.camera.y };
      return;
    }

    const hit = hitTest(w.x, w.y);
    if (hit) {
      select(hit.id);
      state.dragging = { id: hit.id, dx: w.x - hit.x, dy: w.y - hit.y };
    } else {
      createPlacement(w.x, w.y);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const w = screenToWorld(sx, sy);
    state.mouse = { x: sx, y: sy, worldX: w.x, worldY: w.y };

    if (state.panning) {
      state.camera.x = Math.max(0, state.panning.cameraX - (event.clientX - state.panning.x) / state.zoom);
      state.camera.y = Math.max(0, state.panning.cameraY - (event.clientY - state.panning.y) / state.zoom);
      render();
      return;
    }

    if (state.dragging) {
      const p = selected();
      if (p) {
        p.x = Math.round(w.x - state.dragging.dx);
        p.y = Math.round(w.y - state.dragging.dy);
        renderProperties();
      }
    }
    render();
  });

  canvas.addEventListener("pointerup", () => {
    state.dragging = null;
    state.panning = null;
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.ctrlKey) {
      const next = Math.max(0.35, Math.min(1.75, state.zoom + (event.deltaY < 0 ? 0.1 : -0.1)));
      state.zoom = next;
      zoomSelect.value = String([0.5, 0.75, 1, 1.5].reduce((a, b) => Math.abs(b - next) < Math.abs(a - next) ? b : a));
    } else {
      state.camera.x = Math.max(0, state.camera.x + event.deltaY / state.zoom);
      state.camera.y = Math.max(0, state.camera.y + event.deltaX / state.zoom);
    }
    render();
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    const p = selected();
    if (event.key === "Delete" || event.key === "Backspace") {
      deleteSelected();
      event.preventDefault();
      return;
    }
    if (!p) return;
    const nudge = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") p.x -= nudge;
    else if (event.key === "ArrowRight") p.x += nudge;
    else if (event.key === "ArrowUp") p.y -= nudge;
    else if (event.key === "ArrowDown") p.y += nudge;
    else return;
    renderProperties();
    render();
    event.preventDefault();
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "new" && confirm("Start a new blank layout?")) setLayout(newLayout());
      if (action === "save") localStorage.setItem(STORAGE_KEY, JSON.stringify(state.layout));
      if (action === "load") {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setLayout(JSON.parse(saved));
      }
      if (action === "export") exportJson();
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      const prop = `show${key[0].toUpperCase()}${key.slice(1)}`;
      state[prop] = !state[prop];
      button.classList.toggle("active", state[prop]);
      render();
    });
  });

  zoomSelect.addEventListener("change", () => {
    state.zoom = Number(zoomSelect.value);
    render();
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;
    setLayout(JSON.parse(await file.text()));
    importFile.value = "";
  });

  async function boot() {
    await Promise.all(ATLASES.map(async (atlas) => {
      state.images.set(atlas.key, await loadImageFromCandidates(atlas.file));
    }));
    buildPalette();
    renderProperties();
    resize();
  }

  window.addEventListener("resize", resize);
  boot().catch((error) => {
    document.body.innerHTML = `<pre style="padding:20px;color:#ffb4a8;background:#120807;height:100vh;white-space:pre-wrap">${error.stack || error.message}</pre>`;
  });
})();
