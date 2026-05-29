(function () {
  "use strict";

  const STORAGE_KEY = "heroquest:forest-map-composer:layout:v2";
  const WORLD = { width: 8000, height: 720 };
  const MANIFEST_FILE = "composer-assets.manifest.json";
  const KIT_PATH = "assets/biomes/enchanted-forest-kit-v2/individual/";
  const LOCAL_KIT_PATH = "public/assets/biomes/enchanted-forest-kit-v2/individual/";
  const MANIFEST_PATH = "assets/biomes/enchanted-forest-kit-v2/";
  const LOCAL_MANIFEST_PATH = "public/assets/biomes/enchanted-forest-kit-v2/";

  let ASSETS = [
    { id: "bg-canopy-strip", label: "Canopy Strip", file: "bg-canopy-strip.png", category: "background", width: 720, height: 210, depth: -210, scrollFactor: 0.25 },
    { id: "bg-canopy-deep", label: "Deep Canopy", file: "bg-canopy-strip.png", category: "background", width: 980, height: 245, depth: -215, scrollFactor: 0.18 },
    { id: "bg-distant-trunks", label: "Distant Trunks", file: "bg-distant-trunks.png", category: "background", width: 520, height: 300, depth: -180, scrollFactor: 0.42 },
    { id: "bg-distant-trunks-tall", label: "Tall Trunk Wall", file: "bg-distant-trunks.png", category: "background", width: 700, height: 390, depth: -182, scrollFactor: 0.36 },
    { id: "fx-blue-fog-band", label: "Blue Fog", file: "fx-blue-fog-band.png", category: "background", width: 720, height: 180, depth: -170, scrollFactor: 0.42, blendMode: "SCREEN", alpha: 0.62 },
    { id: "fx-blue-fog-low", label: "Low Blue Mist", file: "fx-blue-fog-band.png", category: "background", width: 920, height: 120, depth: -60, scrollFactor: 0.75, blendMode: "SCREEN", alpha: 0.38 },
    { id: "terrain-moss-path", label: "Moss Path", file: "terrain-moss-path.png", category: "terrain", width: 512, height: 128, depth: -20, scrollFactor: 1 },
    { id: "terrain-moss-path-wide", label: "Moss Path Wide", file: "terrain-moss-path.png", category: "terrain", width: 768, height: 128, depth: -20, scrollFactor: 1 },
    { id: "terrain-shadow-moss-path", label: "Shadow Path", file: "terrain-shadow-moss-path.png", category: "terrain", width: 512, height: 128, depth: -20, scrollFactor: 1 },
    { id: "terrain-golden-gate-path", label: "Golden Gate Path", file: "terrain-golden-gate-path.png", category: "terrain", width: 512, height: 128, depth: -20, scrollFactor: 1 },
    { id: "terrain-golden-gate-wide", label: "Golden Path Wide", file: "terrain-golden-gate-path.png", category: "terrain", width: 768, height: 128, depth: -20, scrollFactor: 1 },
    { id: "water-stream", label: "Stream", file: "water-stream.png", category: "water", width: 512, height: 116, depth: -18, scrollFactor: 1, blendMode: "NORMAL" },
    { id: "water-stream-wide", label: "Stream Wide", file: "water-stream.png", category: "water", width: 768, height: 116, depth: -18, scrollFactor: 1, blendMode: "NORMAL" },
    { id: "water-bank-edge", label: "Water Bank", file: "water-bank-edge.png", category: "water", width: 512, height: 128, depth: -18, scrollFactor: 1 },
    { id: "water-bank-wide", label: "Water Bank Wide", file: "water-bank-edge.png", category: "water", width: 768, height: 128, depth: -18, scrollFactor: 1 },
    { id: "platform-moss-stone", label: "Stone Platform", file: "platform-moss-stone.png", category: "cliff", width: 430, height: 170, depth: -10, scrollFactor: 1 },
    { id: "platform-moss-stone-large", label: "Large Platform", file: "platform-moss-stone.png", category: "cliff", width: 620, height: 220, depth: -10, scrollFactor: 1 },
    { id: "platform-small-cap", label: "Small Platform Cap", file: "platform-small-cap.png", category: "cliff", width: 280, height: 120, depth: -10, scrollFactor: 1 },
    { id: "cliff-vertical-face", label: "Vertical Cliff Face", file: "cliff-vertical-face.png", category: "cliff", width: 260, height: 360, depth: -12, scrollFactor: 1 },
    { id: "bridge-broken-wood", label: "Broken Bridge", file: "bridge-broken-wood.png", category: "bridge", width: 390, height: 130, depth: -8, scrollFactor: 1 },
    { id: "bridge-rope-intact", label: "Rope Bridge", file: "bridge-rope-intact.png", category: "bridge", width: 430, height: 145, depth: -8, scrollFactor: 1 },
    { id: "tree-large", label: "Large Tree", file: "tree-large.png", category: "foliage", width: 270, height: 340, depth: -120, scrollFactor: 0.72 },
    { id: "tree-large-foreground", label: "Front Tree", file: "tree-large.png", category: "foliage", width: 350, height: 440, depth: 420, scrollFactor: 0.95, alpha: 0.92 },
    { id: "tree-trunk-ancient", label: "Ancient Trunk", file: "tree-trunk-ancient.png", category: "foliage", width: 170, height: 360, depth: -105, scrollFactor: 0.72 },
    { id: "root-arch", label: "Root Arch", file: "root-arch.png", category: "foliage", width: 360, height: 210, depth: 30, scrollFactor: 1 },
    { id: "foliage-shrub", label: "Shrub Clump", file: "foliage-shrub.png", category: "foliage", width: 240, height: 130, depth: 520, scrollFactor: 0.96 },
    { id: "foliage-shrub-small", label: "Small Shrub", file: "foliage-shrub.png", category: "foliage", width: 145, height: 80, depth: 520, scrollFactor: 0.96 },
    { id: "fg-leaf-bed", label: "Leaf Bed Strip", file: "fg-leaf-bed.png", category: "foliage", width: 620, height: 170, depth: 540, scrollFactor: 0.96 },
    { id: "fg-leaf-bed-wide", label: "Leaf Bed Wide", file: "fg-leaf-bed.png", category: "foliage", width: 880, height: 175, depth: 540, scrollFactor: 0.96 },
    { id: "ruin-stone-post", label: "Ruin Post", file: "ruin-stone-post.png", category: "prop", width: 90, height: 170, depth: -6, scrollFactor: 1 },
    { id: "ruin-stone-post-tall", label: "Tall Ruin Post", file: "ruin-stone-post.png", category: "prop", width: 120, height: 230, depth: -6, scrollFactor: 1 },
    { id: "ruin-arch-fragment", label: "Ruin Arch", file: "ruin-arch-fragment.png", category: "prop", width: 250, height: 180, depth: -6, scrollFactor: 1 },
    { id: "gate-banner", label: "Banner Gate", file: "gate-banner.png", category: "prop", width: 360, height: 270, depth: -6, scrollFactor: 1 },
    { id: "banner-cloth-strip", label: "Torn Banner", file: "banner-cloth-strip.png", category: "prop", width: 160, height: 220, depth: -3, scrollFactor: 1 },
    { id: "torch-post", label: "Torch", file: "torch-post.png", category: "prop", width: 70, height: 145, depth: -4, scrollFactor: 1 },
    { id: "prop-fallen-log", label: "Fallen Log", file: "prop-fallen-log.png", category: "prop", width: 260, height: 120, depth: -5, scrollFactor: 1 },
    { id: "prop-wood-fence", label: "Wood Fence", file: "prop-wood-fence.png", category: "prop", width: 240, height: 120, depth: -5, scrollFactor: 1 },
    { id: "prop-signpost", label: "Signpost", file: "prop-signpost.png", category: "prop", width: 120, height: 150, depth: -4, scrollFactor: 1 },
    { id: "decal-mushrooms", label: "Mushrooms", file: "decal-mushrooms.png", category: "decal", width: 120, height: 92, depth: 545, scrollFactor: 1 },
    { id: "decal-mushrooms-small", label: "Tiny Mushrooms", file: "decal-mushrooms.png", category: "decal", width: 70, height: 54, depth: 546, scrollFactor: 1 },
    { id: "decal-hanging-vines", label: "Hanging Vines", file: "decal-hanging-vines.png", category: "decal", width: 210, height: 240, depth: 80, scrollFactor: 0.95 },
    { id: "ruin-rubble", label: "Ruin Rubble", file: "ruin-rubble.png", category: "decal", width: 180, height: 100, depth: -4, scrollFactor: 1 }
    ,{ id: "decal-water-reeds", label: "Water Reeds", file: "decal-water-reeds.png", category: "decal", width: 140, height: 150, depth: 30, scrollFactor: 1 }
  ];

  let CATEGORIES = [
    ["background", "Background"],
    ["terrain", "Terrain"],
    ["water", "Water"],
    ["cliff", "Cliffs"],
    ["bridge", "Bridge"],
    ["foliage", "Foliage"],
    ["prop", "Props"],
    ["decal", "Decals"]
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
    imagePromises: new Map(),
    activeCategory: "terrain",
    activeAssetId: "terrain-moss-path",
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
      waterRegions: [{ x: 0, y: 452, width: 8000, height: 48, speed: 0.18, alpha: 0.22 }]
    };
  }

  function assetCandidates(file) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const appBase = parts.length > 0 ? `/${parts[0]}/` : "/";
    return [
      `${KIT_PATH}${file}`,
      `/${KIT_PATH}${file}`,
      `${appBase}${KIT_PATH}${file}`,
      `${LOCAL_KIT_PATH}${file}`,
      `/${LOCAL_KIT_PATH}${file}`,
      `${appBase}${LOCAL_KIT_PATH}${file}`
    ].filter((value, index, array) => array.indexOf(value) === index);
  }

  function manifestCandidates() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const appBase = parts.length > 0 ? `/${parts[0]}/` : "/";
    return [
      `${MANIFEST_PATH}${MANIFEST_FILE}`,
      `/${MANIFEST_PATH}${MANIFEST_FILE}`,
      `${appBase}${MANIFEST_PATH}${MANIFEST_FILE}`,
      `${LOCAL_MANIFEST_PATH}${MANIFEST_FILE}`,
      `/${LOCAL_MANIFEST_PATH}${MANIFEST_FILE}`,
      `${appBase}${LOCAL_MANIFEST_PATH}${MANIFEST_FILE}`
    ].filter((value, index, array) => array.indexOf(value) === index);
  }

  async function loadManifest() {
    const tried = [];
    for (const url of manifestCandidates()) {
      tried.push(url);
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        return await response.json();
      } catch (_) {
        // Try the next likely Vite/base-path location.
      }
    }
    throw new Error(`Could not load ${MANIFEST_FILE}. Tried:\n${tried.join("\n")}`);
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

  function ensureImage(asset) {
    if (state.images.has(asset.id)) return Promise.resolve(state.images.get(asset.id));
    if (state.imagePromises.has(asset.id)) return state.imagePromises.get(asset.id);
    const promise = loadImageFromCandidates(asset.file).then((image) => {
      state.images.set(asset.id, image);
      state.imagePromises.delete(asset.id);
      return image;
    });
    state.imagePromises.set(asset.id, promise);
    return promise;
  }

  async function loadCategory(category) {
    await Promise.all(ASSETS.filter((asset) => asset.category === category).map((asset) => ensureImage(asset)));
  }

  function activeAsset() {
    return ASSETS.find((asset) => asset.id === state.activeAssetId) || ASSETS[0];
  }

  function getAsset(id) {
    return ASSETS.find((asset) => asset.id === id);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function screenToWorld(x, y) {
    return { x: state.camera.x + x / state.zoom, y: state.camera.y + y / state.zoom };
  }

  function drawImageAsset(asset, placement) {
    const img = state.images.get(asset.id);
    if (!img) return;
    ctx.save();
    ctx.translate(placement.x, placement.y);
    ctx.rotate(placement.rotation);
    ctx.scale(placement.flipX ? -1 : 1, 1);
    ctx.globalAlpha = placement.alpha ?? asset.alpha ?? 1;
    ctx.globalCompositeOperation = placement.blendMode === "SCREEN" || placement.blendMode === "ADD"
      ? "screen"
      : placement.blendMode === "MULTIPLY"
        ? "multiply"
        : "source-over";
    const width = placement.width * placement.scaleX;
    const height = placement.height * placement.scaleY;
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
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
    drawBackdrop();
    if (state.showGrid) drawGrid();
    drawGuides();

    const placements = [...state.layout.placements].sort((a, b) => a.depth - b.depth);
    for (const placement of placements) {
      const asset = getAsset(placement.assetId);
      if (!asset) continue;
      if (!state.images.has(asset.id)) {
        ensureImage(asset).then(render);
        continue;
      }
      drawImageAsset(asset, placement);
      if (placement.id === state.selectedId) drawSelection(placement);
    }

    ctx.restore();
    updateStatus();
  }

  function drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    gradient.addColorStop(0, "#07160f");
    gradient.addColorStop(0.48, "#10291a");
    gradient.addColorStop(1, "#03100b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.strokeStyle = "rgba(211,241,174,0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(214,238,178,0.075)";
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
      ctx.fillStyle = "rgba(62, 210, 230, 0.15)";
      ctx.strokeStyle = "rgba(89, 236, 243, 0.78)";
      for (const w of state.layout.waterRegions) {
        ctx.fillRect(w.x, w.y, w.width, w.height);
        ctx.strokeRect(w.x, w.y, w.width, w.height);
      }
    }
  }

  function drawSelection(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.strokeStyle = "#f4d04d";
    ctx.lineWidth = 3 / Math.max(0.5, state.zoom);
    ctx.setLineDash([8 / state.zoom, 5 / state.zoom]);
    ctx.strokeRect(-p.width * p.scaleX / 2, -p.height * p.scaleY / 2, p.width * p.scaleX, p.height * p.scaleY);
    ctx.restore();
  }

  function buildPalette() {
    tabs.innerHTML = "";
    for (const [id, label] of CATEGORIES) {
      const button = document.createElement("button");
      button.className = `tab${id === state.activeCategory ? " active" : ""}`;
      button.textContent = label;
      button.onclick = () => {
        setActiveCategory(id);
      };
      tabs.appendChild(button);
    }

    assetGrid.innerHTML = "";
    for (const asset of ASSETS.filter((item) => item.category === state.activeCategory)) {
      const tile = document.createElement("button");
      tile.className = `asset-tile${asset.id === state.activeAssetId ? " selected" : ""}`;
      tile.title = asset.label;
      const thumb = document.createElement("canvas");
      thumb.width = 128;
      thumb.height = 96;
      tile.appendChild(thumb);
      drawThumb(thumb, asset);
      tile.onclick = () => {
        state.activeAssetId = asset.id;
        buildPalette();
      };
      assetGrid.appendChild(tile);
    }
  }

  function drawThumb(canvasEl, asset) {
    const img = state.images.get(asset.id);
    const tctx = canvasEl.getContext("2d");
    tctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (!img) {
      ensureImage(asset).then(() => buildPalette());
      return;
    }
    const scale = Math.min(canvasEl.width / asset.width, canvasEl.height / asset.height) * 0.86;
    const width = asset.width * scale;
    const height = asset.height * scale;
    tctx.drawImage(img, (canvasEl.width - width) / 2, (canvasEl.height - height) / 2, width, height);
  }

  function createPlacement(x, y) {
    const asset = activeAsset();
    ensureImage(asset).then(render);
    const snap = asset.category === "terrain" || asset.category === "water";
    const p = {
      id: `${asset.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`,
      assetId: asset.id,
      file: asset.file,
      x: Math.round(snap ? Math.round(x / 64) * 64 : x),
      y: Math.round(snap ? Math.round(y / 64) * 64 : y),
      width: asset.width,
      height: asset.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      flipX: false,
      depth: asset.depth,
      scrollFactor: asset.scrollFactor,
      category: asset.category,
      blendMode: asset.blendMode || "NORMAL",
      alpha: asset.alpha ?? 1
    };
    state.layout.placements.push(p);
    select(p.id);
  }

  async function setActiveCategory(id) {
    state.activeCategory = id;
    const first = ASSETS.find((asset) => asset.category === id);
    if (first) state.activeAssetId = first.id;
    buildPalette();
    await loadCategory(id);
    buildPalette();
    render();
  }

  function hitTest(x, y) {
    const list = [...state.layout.placements].sort((a, b) => b.depth - a.depth);
    for (const p of list) {
      const hw = Math.abs(p.width * p.scaleX) / 2;
      const hh = Math.abs(p.height * p.scaleY) / 2;
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

  function field(label, prop, value, type = "text", step = "1") {
    return `<div class="field"><label>${label}</label><input data-prop="${prop}" type="${type}" step="${step}" value="${value}"></div>`;
  }

  function readonly(label, value) {
    return `<div class="field"><label>${label}</label><input readonly value="${value}"></div>`;
  }

  function selectField(label, prop, value, options) {
    return `<div class="field"><label>${label}</label><select data-prop="${prop}">${options.map((o) => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
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
        ${readonly("Asset", p.assetId)}
        ${field("ID", "id", p.id)}
        ${field("X", "x", p.x, "number")}
        ${field("Y", "y", p.y, "number")}
        ${field("Width", "width", p.width, "number")}
        ${field("Height", "height", p.height, "number")}
        ${field("Scale X", "scaleX", p.scaleX, "number", "0.05")}
        ${field("Scale Y", "scaleY", p.scaleY, "number", "0.05")}
        ${field("Rotation", "rotation", p.rotation, "number", "0.01")}
        <div class="field inline"><label>Flip X</label><input data-prop="flipX" type="checkbox" ${p.flipX ? "checked" : ""}></div>
        ${field("Depth", "depth", p.depth, "number")}
        ${field("Scroll", "scrollFactor", p.scrollFactor, "number", "0.05")}
        ${field("Alpha", "alpha", p.alpha ?? 1, "number", "0.05")}
        ${selectField("Category", "category", p.category, CATEGORIES.map(([id]) => id))}
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
      state.zoom = Math.max(0.35, Math.min(1.75, state.zoom + (event.deltaY < 0 ? 0.1 : -0.1)));
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
    const manifest = await loadManifest();
    if (Array.isArray(manifest.assets) && manifest.assets.length > 0) {
      ASSETS = manifest.assets;
    }
    if (Array.isArray(manifest.categories) && manifest.categories.length > 0) {
      CATEGORIES = manifest.categories.map((item) => [item.id, item.label]);
    }
    state.activeCategory = CATEGORIES[0][0];
    state.activeAssetId = ASSETS.find((asset) => asset.category === state.activeCategory)?.id || ASSETS[0]?.id;

    await loadCategory(state.activeCategory);
    buildPalette();
    renderProperties();
    resize();
  }

  window.addEventListener("resize", resize);
  boot().catch((error) => {
    document.body.innerHTML = `<pre style="padding:20px;color:#ffb4a8;background:#120807;height:100vh;white-space:pre-wrap">${error.stack || error.message}</pre>`;
  });
})();
