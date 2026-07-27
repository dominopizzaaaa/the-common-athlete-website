/* ==========================================================================
   The Common Athlete — The Fitting Room
   On-device virtual try-on. A pose model finds the body's landmarks, then each
   garment cut-out is placed with a similarity transform (rotate + uniform
   scale) anchored to a pair of landmarks — the same idea as an eyewear try-on,
   applied to shoulders, hips and ears. No photo ever leaves the device.
   ========================================================================== */

const MP_WASM  = "vendor/mediapipe/wasm";
const MP_MODULE = "vendor/mediapipe/vision_bundle.js";
const MP_MODEL = "assets/models/pose_landmarker_lite.task";

/* Pose landmark indices (MediaPipe Pose, 33 points).
   Pairs are ordered [image-left, image-right] for a person facing the camera:
   the subject's right side appears on the viewer's left. */
const PAIRS = {
  shoulders: [12, 11],
  hips:      [24, 23],
  ears:      [8, 7],
};

/* Placement is expressed relative to the body, so it scales with the person
   automatically:
     widthFactor  — garment width ÷ distance between the two anchor landmarks
     heightFactor — garment height ÷ torso length (shoulders→hips). Optional;
                    without it the garment scales uniformly. Flat product
                    renders are proportionally taller than the span a garment
                    actually covers on a body — straps and waistbands are laid
                    out at full length rather than curving over the shoulder or
                    hip — so the clothing pieces are fitted on both axes.
     anchorY      — where the landmark line sits down the garment image (0–1)
     offsetPerp   — shift perpendicular to the landmark line (+ = down the body)
     offsetAlong  — shift along the landmark line (+ = toward image right)
   Values are calibrated against a reference figure with known anthropometry
   (see the fit-measure harness). */
const GARMENTS = [
  { id: "headband", name: "Studio Headband", short: "Headband",
    slot: "head", price: 14, z: 3,
    anchor: "ears", widthFactor: 1.08, anchorY: 0.50, offsetPerp: -0.35, offsetAlong: 0 },

  { id: "cross-back-bra", name: "Featherweight Cross-Back Bralette", short: "Cross-Back Bralette",
    slot: "top", price: 34, z: 2,
    anchor: "shoulders", widthFactor: 0.90, heightFactor: 0.327,
    anchorY: 0.02, offsetPerp: 0, offsetAlong: 0 },

  { id: "halter", name: "Studio Halter Longline Crop", short: "Halter Crop",
    slot: "top", price: 42, z: 2,
    anchor: "shoulders", widthFactor: 1.06, heightFactor: 0.816,
    anchorY: 0.20, offsetPerp: 0, offsetAlong: 0 },

  { id: "sculpt-short", name: "Sculpt V-Waist Short", short: "Sculpt Short",
    slot: "bottom", price: 40, z: 1,
    anchor: "hips", widthFactor: 2.19, heightFactor: 0.712,
    anchorY: 0.487, offsetPerp: 0, offsetAlong: 0 },

  { id: "tempo-short", name: "Tempo 2-in-1 Running Short", short: "Tempo Short",
    slot: "bottom", price: 48, z: 1,
    anchor: "hips", widthFactor: 2.48, heightFactor: 0.690,
    anchorY: 0.463, offsetPerp: 0, offsetAlong: 0 },
];

const COLOURS = { black: "Black", sand: "Sand", espresso: "Espresso" };
const MAX_EDGE = 1600;
const MIN_VIS = 0.4;

/* ---------------------------------------------------------------- state --- */
const state = {
  colour: "black",
  worn: { head: null, top: null, bottom: null },
  adjust: {},                 // per garment id: { scale, perp, along }
  active: null,               // garment id the sliders act on
  landmarks: null,
  photo: null,                // canvas holding the (oriented, downscaled) photo
  allowBottom: true,
};

const els = {};
const imgCache = new Map();
let landmarker = null;

/* ------------------------------------------------------------- elements --- */
function cacheEls() {
  [
    "stageIntro", "stageLoading", "stageError", "stageStudio",
    "dropZone", "fileInput", "chooseBtn", "loadingMsg", "errorTitle", "errorMsg",
    "retryBtn", "stage", "canvasWrap", "changePhotoBtn", "saveBtn", "stageNote",
    "colourRow", "tray", "adjustBlock", "adjustTarget", "resetAdjust",
    "scaleRange", "offsetRange", "shiftRange", "lookSummary",
  ].forEach((id) => (els[id] = document.getElementById(id)));
}

function showStage(name) {
  ["stageIntro", "stageLoading", "stageError", "stageStudio"].forEach((s) => {
    els[s].hidden = s !== name;
  });
  if (name !== "stageStudio") window.scrollTo({ top: 0, behavior: "smooth" });
}

/* --------------------------------------------------------------- assets --- */
function garmentSrc(id, colour) {
  return `assets/garments/${id}-${colour}.png`;
}

function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
  imgCache.set(src, p);
  return p;
}

/* Warm the cache for a colourway so swapping feels instant. */
function prefetchColour(colour) {
  GARMENTS.forEach((g) => loadImage(garmentSrc(g.id, colour)).catch(() => {}));
}

/* ------------------------------------------------------------ pose init --- */
async function getLandmarker(onProgress) {
  if (landmarker) return landmarker;

  onProgress("Loading the fitting engine…");
  const vision = await import(`./../${MP_MODULE}`);
  const { FilesetResolver, PoseLandmarker } = vision;

  const fileset = await FilesetResolver.forVisionTasks(MP_WASM);

  onProgress("Warming up…");
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MP_MODEL, delegate },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.4,
    minPosePresenceConfidence: 0.4,
  });

  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts("GPU"));
  } catch (e) {
    // Some mobile GPUs refuse the delegate — CPU is slower but universal.
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
  }
  return landmarker;
}

/* ---------------------------------------------------------------- photo --- */
async function decodePhoto(file) {
  // Decode with EXIF orientation applied so what we show matches what the
  // model sees, then downscale for predictable memory use on phones.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    bitmap = await createImageBitmap(file);
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return c;
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    return fail("That file isn't an image", "Please choose a photo — JPEG, PNG or HEIC all work.");
  }

  showStage("stageLoading");
  const progress = (m) => (els.loadingMsg.textContent = m);
  progress("Reading your photo…");

  try {
    state.photo = await decodePhoto(file);
  } catch (e) {
    return fail("We couldn't open that photo", "The file may be corrupted or in a format your browser can't read. Try another one.");
  }

  let detector;
  try {
    detector = await getLandmarker(progress);
  } catch (e) {
    return fail("The fitting engine didn't load", "Check your connection and try again — it needs a one-time download of about 15 MB.");
  }

  progress("Finding your fit…");
  let result;
  try {
    result = detector.detect(state.photo);
  } catch (e) {
    return fail("Something went wrong reading the photo", "Try a different photo, or reload the page.");
  }

  const lm = result?.landmarks?.[0];
  if (!lm) {
    return fail("We couldn't quite see you",
      "No body was detected. Try a photo taken from the front, showing your head and shoulders, in good light.");
  }

  const vis = (i) => (lm[i].visibility ?? 1);
  const shouldersOK = vis(11) > MIN_VIS && vis(12) > MIN_VIS;
  if (!shouldersOK) {
    return fail("We couldn't find your shoulders",
      "Try standing square to the camera with both shoulders in frame and arms relaxed by your sides.");
  }

  state.landmarks = lm;
  state.allowBottom = vis(23) > MIN_VIS && vis(24) > MIN_VIS;

  // Sensible opening look, limited to what the photo actually shows.
  state.worn = { head: null, top: "cross-back-bra", bottom: state.allowBottom ? "sculpt-short" : null };
  state.adjust = {};
  state.active = "cross-back-bra";

  prefetchColour(state.colour);
  buildTray();
  showStage("stageStudio");
  await render();
  syncPanel();

  els.stageNote.textContent = stageNote();
}

/* A photo taken side-on gives a short shoulder line, so garments come out
   narrow. That's geometrically faithful but rarely what someone wants to see. */
function stageNote() {
  if (!state.allowBottom) {
    return "We can only see your upper body here, so shorts are unavailable — upload a fuller shot to try them on.";
  }
  const W = state.photo.width, H = state.photo.height;
  const lm = state.landmarks;
  const shoulders = Math.hypot((lm[11].x - lm[12].x) * W, (lm[11].y - lm[12].y) * H);
  const torso = torsoLength(lm, W, H);
  if (torso > 0 && shoulders / torso < 0.5) {
    return "You're turned side-on in this photo, so the pieces sit narrow. A straight-on shot fits best.";
  }
  return "Not quite right? Use Adjust to nudge the size and position.";
}

function fail(title, msg) {
  els.errorTitle.textContent = title;
  els.errorMsg.textContent = msg;
  showStage("stageError");
}

/* --------------------------------------------------------------- layout --- */
/* Torso length (shoulder midpoint → hip midpoint) is the vertical yardstick.
   Hip landmarks are used even when barely visible: the model extrapolates them
   sensibly, and only *wearing shorts* is gated on real visibility. */
function torsoLength(lm, W, H) {
  const sx = (lm[11].x + lm[12].x) / 2 * W, sy = (lm[11].y + lm[12].y) / 2 * H;
  const hx = (lm[23].x + lm[24].x) / 2 * W, hy = (lm[23].y + lm[24].y) / 2 * H;
  return Math.hypot(hx - sx, hy - sy);
}

/* Map the garment's anchor onto the landmark pair: rotate to the body's angle,
   scale horizontally to body width and vertically to torso length. */
function placement(g, lm, W, H) {
  const [ia, ib] = PAIRS[g.anchor];
  const ax = lm[ia].x * W, ay = lm[ia].y * H;
  const bx = lm[ib].x * W, by = lm[ib].y * H;

  const dx = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (!dist) return null;

  const angle = Math.atan2(dy, dx);
  const ux = Math.cos(angle), uy = Math.sin(angle);   // along the landmark line
  const vx = -uy, vy = ux;                            // perpendicular, down the body

  const adj = state.adjust[g.id] || { scale: 1, perp: 0, along: 0 };
  const targetW = dist * g.widthFactor * adj.scale;

  let targetH = null;
  if (g.heightFactor) {
    const torso = torsoLength(lm, W, H);
    if (torso > 0) targetH = torso * g.heightFactor * adj.scale;
  }

  const perp = (g.offsetPerp + adj.perp) * dist;
  const along = (g.offsetAlong + adj.along) * dist;

  return {
    angle,
    targetW,
    targetH,
    cx: (ax + bx) / 2 + ux * along + vx * perp,
    cy: (ay + by) / 2 + uy * along + vy * perp,
    anchorY: g.anchorY,
  };
}

async function render() {
  const photo = state.photo;
  if (!photo) return;

  const cv = els.stage;
  cv.width = photo.width;
  cv.height = photo.height;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(photo, 0, 0);

  const active = GARMENTS
    .filter((g) => state.worn[g.slot] === g.id)
    .sort((a, b) => a.z - b.z);

  for (const g of active) {
    let img;
    try {
      img = await loadImage(garmentSrc(g.id, state.colour));
    } catch (e) {
      continue;
    }
    const p = placement(g, state.landmarks, cv.width, cv.height);
    if (!p) continue;

    const sx = p.targetW / img.naturalWidth;
    const sy = p.targetH ? p.targetH / img.naturalHeight : sx;
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.rotate(p.angle);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight * p.anchorY);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------- UI --- */
function buildTray() {
  els.tray.innerHTML = "";
  GARMENTS.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tray__item";
    btn.dataset.id = g.id;
    btn.innerHTML = `
      <span class="tray__thumb"><img alt="" src="${garmentSrc(g.id, state.colour)}"></span>
      <span class="tray__name">${g.short}</span>
      <span class="tray__price">S$${g.price}</span>`;
    btn.addEventListener("click", () => toggleGarment(g));
    els.tray.appendChild(btn);
  });
  syncTray();
}

function toggleGarment(g) {
  if (g.slot === "bottom" && !state.allowBottom) return;

  if (state.worn[g.slot] === g.id) {
    state.worn[g.slot] = null;
    if (state.active === g.id) state.active = null;
  } else {
    state.worn[g.slot] = g.id;
    state.active = g.id;
  }
  render();
  syncPanel();
}

function syncTray() {
  els.tray.querySelectorAll(".tray__item").forEach((btn) => {
    const g = GARMENTS.find((x) => x.id === btn.dataset.id);
    const on = state.worn[g.slot] === g.id;
    const locked = g.slot === "bottom" && !state.allowBottom;
    btn.classList.toggle("is-on", on);
    btn.classList.toggle("is-active", state.active === g.id);
    btn.classList.toggle("is-locked", locked);
    btn.disabled = locked;
    btn.setAttribute("aria-pressed", String(on));
    btn.querySelector("img").src = garmentSrc(g.id, state.colour);
  });
}

function syncPanel() {
  syncTray();

  const g = GARMENTS.find((x) => x.id === state.active);
  const wearing = g && state.worn[g.slot] === g.id;
  els.adjustBlock.hidden = !wearing;
  if (wearing) {
    els.adjustTarget.textContent = g.short.toLowerCase();
    const adj = state.adjust[g.id] || { scale: 1, perp: 0, along: 0 };
    els.scaleRange.value = Math.round(adj.scale * 100);
    els.offsetRange.value = Math.round(adj.perp * 200);
    els.shiftRange.value = Math.round(adj.along * 200);
  }

  const items = GARMENTS.filter((x) => state.worn[x.slot] === x.id);
  if (!items.length) {
    els.lookSummary.innerHTML = `<p class="look-summary__empty">Nothing on — tap a piece above to start building your look.</p>`;
    return;
  }
  const total = items.reduce((s, x) => s + x.price, 0);
  els.lookSummary.innerHTML = `
    <p class="look-summary__title">Your look — ${COLOURS[state.colour]}</p>
    <ul>${items.map((x) => `<li><span>${x.name}</span><span>S$${x.price}</span></li>`).join("")}</ul>
    <p class="look-summary__total"><span>Total</span><span>S$${total}</span></p>`;
}

function ensureAdjust(id) {
  if (!state.adjust[id]) state.adjust[id] = { scale: 1, perp: 0, along: 0 };
  return state.adjust[id];
}

/* ---------------------------------------------------------------- save --- */
async function saveLook() {
  const blob = await new Promise((res) => els.stage.toBlob(res, "image/jpeg", 0.92));
  if (!blob) return;
  const file = new File([blob], "the-common-athlete-look.jpg", { type: "image/jpeg" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My Common Athlete look" });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "the-common-athlete-look.jpg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ---------------------------------------------------------------- wire --- */
function wire() {
  const pick = () => els.fileInput.click();
  els.chooseBtn.addEventListener("click", pick);
  els.dropZone.addEventListener("click", (e) => {
    if (e.target !== els.chooseBtn) pick();
  });
  els.changePhotoBtn.addEventListener("click", pick);
  els.retryBtn.addEventListener("click", pick);

  els.fileInput.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) handleFile(f);
  });

  ["dragenter", "dragover"].forEach((ev) =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.add("is-over");
    }));
  ["dragleave", "drop"].forEach((ev) =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove("is-over");
    }));
  els.dropZone.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  });

  els.colourRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-colour]");
    if (!btn) return;
    state.colour = btn.dataset.colour;
    els.colourRow.querySelectorAll(".colour-pill")
      .forEach((b) => b.classList.toggle("is-active", b === btn));
    prefetchColour(state.colour);
    render();
    syncPanel();
  });

  const onSlider = (el, key, div) =>
    el.addEventListener("input", () => {
      if (!state.active) return;
      ensureAdjust(state.active)[key] = Number(el.value) / div;
      render();
    });
  onSlider(els.scaleRange, "scale", 100);
  onSlider(els.offsetRange, "perp", 200);
  onSlider(els.shiftRange, "along", 200);

  els.resetAdjust.addEventListener("click", () => {
    if (!state.active) return;
    delete state.adjust[state.active];
    render();
    syncPanel();
  });

  els.saveBtn.addEventListener("click", saveLook);

  // Swipe across the canvas to cycle the top, since that's the piece people
  // compare most. Horizontal intent only, so vertical scrolling still works.
  let sx = 0, sy = 0;
  els.canvasWrap.addEventListener("touchstart", (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  els.canvasWrap.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    cycleSlot("top", dx < 0 ? 1 : -1);
  }, { passive: true });
}

function cycleSlot(slot, dir) {
  const opts = GARMENTS.filter((g) => g.slot === slot).map((g) => g.id);
  const ring = [null, ...opts];
  const i = ring.indexOf(state.worn[slot]);
  const next = ring[(i + dir + ring.length) % ring.length];
  state.worn[slot] = next;
  if (next) state.active = next;
  render();
  syncPanel();
}

/* ---------------------------------------------------------------- init --- */
cacheEls();
wire();

// Test hook — lets the placement maths be verified against known landmarks.
window.__TCA_TRYON__ = { GARMENTS, PAIRS, placement, state, render, loadImage, garmentSrc };
