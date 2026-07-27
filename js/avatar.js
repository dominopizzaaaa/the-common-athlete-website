/* ==========================================================================
   The Common Athlete — parametric avatar
   Builds a body from real measurements, so every anatomical station (shoulder,
   underbust, waist, crotch) is known exactly rather than estimated. Garments
   are then placed against those stations, which means placement stays correct
   at any height or shape.
   ========================================================================== */

/* Front-view width from a circumference: modelling the torso as an ellipse
   whose depth is ~0.72 of its width gives perimeter ≈ 2.72 × width. */
const CIRC_TO_WIDTH = 2.72;
export const circToHalfWidth = (c) => c / (CIRC_TO_WIDTH * 2);

/* Vertical stations as a fraction of standing height, measured from the top of
   the head. Standard female anthropometry (≈7.5 heads). */
const STATION = {
  headTop:   0.000,
  shoulder:  0.1875,
  bust:      0.2438,
  underbust: 0.2875,
  waist:     0.3875,
  hip:       0.4875,
  crotch:    0.5438,
  knee:      0.7188,
  ankle:     0.9700,
  floor:     1.000,
};

/* The head barely changes between a short and a tall woman, so it is sized
   sub-linearly. At 160cm this matches the plain fractions exactly; away from
   it the head stays believable instead of ballooning or shrinking. */
const HEAD_CM_AT_160 = 21.5;
const HEAD_HALF_CM_AT_160 = 7.5;
const headScale = (h) => Math.pow(h / 160, 0.35);

/* Fractions down the head itself. The headband station sits at the hairline
   rather than the mid-forehead, so it reads as holding hair back. */
const HEAD_STATION = { forehead: 0.30, ear: 0.51 };

/* Widths that track height rather than girth. */
const BY_HEIGHT = {
  shoulder: 0.1080,   // half biacromial + deltoid
  neck:     0.0315,
};

export const HEIGHT_RANGE = { min: 145, max: 185, step: 1 };
export const PX_PER_CM = 1080 / HEIGHT_RANGE.max;   // fixed, so height is visible

/* --------------------------------------------------------- size chart --- */
/* Body measurements per size, straight from the manufacturing spec pack. */
export const SIZE_CHART = [
  { size: "XS", bust: [81, 84],   underbust: [69, 72], waist: [62, 65], hip: [88, 91] },
  { size: "S",  bust: [86, 89],   underbust: [74, 77], waist: [67, 70], hip: [93, 96] },
  { size: "M",  bust: [91, 94],   underbust: [79, 82], waist: [72, 75], hip: [98, 101] },
  { size: "L",  bust: [96, 99],   underbust: [84, 87], waist: [77, 80], hip: [103, 106] },
  { size: "XL", bust: [101, 104], underbust: [89, 92], waist: [82, 85], hip: [108, 111] },
];
export const SIZE_KEYS = SIZE_CHART.map((s) => s.size);

/* Graded garment lengths in cm, XS→XL, from the spec pack. These drive how far
   down the body a piece actually sits — which is why the same size reads
   shorter on a taller body. */
export const GRADE = {
  "sculpt-short": { frontRise: [26.6, 27.3, 28.0, 28.7, 29.4], inseam: [9.0, 9.5, 10.0, 10.5, 11.0] },
  "tempo-short":  { frontRise: [25.6, 26.3, 27.0, 27.7, 28.4], inseam: [12.4, 12.7, 13.0, 13.3, 13.6] },
  "halter":       { bodyLength: [30, 31, 32, 33, 34] },
  "cross-back-bra": { cfLength: [15.8, 16.4, 17.0, 17.6, 18.2] },
  "headband":     { height: [5, 5, 5, 5, 5] },
};

function nearestSize(value, key) {
  let best = 0, bestD = Infinity;
  SIZE_CHART.forEach((row, i) => {
    const [lo, hi] = row[key];
    const d = value < lo ? lo - value : value > hi ? value - hi : 0;
    if (d < bestD) { bestD = d; best = i; }
  });
  return { index: best, exact: bestD === 0 };
}

/* Tops follow the bust; bottoms follow whichever of waist/hip needs more room. */
export function recommendSize(m) {
  const top = nearestSize(m.bust, "bust");
  const waist = nearestSize(m.waist, "waist");
  const hip = nearestSize(m.hip, "hip");
  const bottomIdx = Math.max(waist.index, hip.index);
  return {
    top: SIZE_KEYS[top.index],
    topIndex: top.index,
    bottom: SIZE_KEYS[bottomIdx],
    bottomIndex: bottomIdx,
    exact: top.exact && waist.exact && hip.exact,
  };
}

/* ------------------------------------------------------------- geometry --- */
export function buildBody(m, canvasW, canvasH) {
  const ppcm = PX_PER_CM;
  const figH = m.height * ppcm;
  const baseline = canvasH - 26;
  const top = baseline - figH;
  const cx = canvasW / 2;

  const y = {};
  for (const k in STATION) y[k] = top + STATION[k] * figH;

  const headH = HEAD_CM_AT_160 * headScale(m.height) * ppcm;
  y.chin = top + headH;
  y.forehead = top + headH * HEAD_STATION.forehead;
  y.ear = top + headH * HEAD_STATION.ear;

  const underbustCirc = Math.max(m.bust - 12, 55);
  const hw = {
    head:      HEAD_HALF_CM_AT_160 * headScale(m.height) * ppcm,
    neck:      BY_HEIGHT.neck * m.height * ppcm,
    shoulder:  BY_HEIGHT.shoulder * m.height * ppcm,
    bust:      circToHalfWidth(m.bust) * ppcm,
    underbust: circToHalfWidth(underbustCirc) * ppcm,
    waist:     circToHalfWidth(m.waist) * ppcm,
    hip:       circToHalfWidth(m.hip) * ppcm,
  };
  hw.thigh = hw.hip * 0.48;
  hw.knee  = hw.hip * 0.30;
  hw.ankle = hw.hip * 0.17;
  hw.upperArm = hw.hip * 0.165;
  hw.wrist = hw.hip * 0.095;

  // the head is an ellipse, so it is narrower at the hairline than at its
  // widest — a headband has to follow that, not the maximum width
  const t = (HEAD_STATION.forehead - 0.5) / 0.5;
  hw.headAtForehead = hw.head * Math.sqrt(Math.max(0, 1 - t * t));

  return { m, ppcm, cx, y, hw, figH, baseline, canvasW, canvasH, headH };
}

/* Studio backdrop, painted into the canvas so a saved look carries it too. */
export function drawBackdrop(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H * 0.34, W * 0.05, W / 2, H * 0.34, H * 0.78);
  g.addColorStop(0, "#FCF8F0");
  g.addColorStop(0.62, "#EFE4D3");
  g.addColorStop(1, "#E3D5C0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------- drawing --- */
/* Catmull-Rom through the control points, emitted as cubic beziers, so the
   silhouette reads as a drawn figure rather than a polygon. */
function smoothPath(ctx, pts, close = true) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  const n = pts.length;
  const at = (i) => pts[close ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1]
    );
  }
  if (close) ctx.closePath();
}

function limb(ctx, pts) {
  ctx.beginPath();
  smoothPath(ctx, pts, true);
  ctx.fill();
}

export const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", skin: "#F2D9C4", shade: "#E4C4AA", hair: "#3B2C22" },
  { id: "warm",      label: "Warm",      skin: "#E3B792", shade: "#D0A079", hair: "#2E211A" },
  { id: "tan",       label: "Tan",       skin: "#C99368", shade: "#B27E55", hair: "#241A14" },
  { id: "deep",      label: "Deep",      skin: "#8E5C3C", shade: "#7A4C30", hair: "#1C1410" },
];

export function drawBody(ctx, B, toneId) {
  const tone = SKIN_TONES.find((t) => t.id === toneId) || SKIN_TONES[1];
  const { cx, y, hw } = B;

  ctx.save();
  ctx.lineJoin = "round";

  /* ---- ground shadow, so the figure sits in the space ---- */
  const sh = ctx.createRadialGradient(cx, y.floor, 2, cx, y.floor, hw.hip * 2.6);
  sh.addColorStop(0, "rgba(46,33,26,0.20)");
  sh.addColorStop(1, "rgba(46,33,26,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cx, y.floor + 4, hw.hip * 2.2, hw.hip * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  /* ---- legs ---- */
  ctx.fillStyle = tone.skin;
  for (const s of [-1, 1]) {
    const cTop = cx + s * hw.hip * 0.50;
    const cKnee = cx + s * hw.hip * 0.38;
    const cAnk = cx + s * hw.hip * 0.26;
    limb(ctx, [
      [cTop - hw.thigh, y.crotch - hw.thigh * 0.5],
      [cKnee - hw.knee, y.knee],
      [cAnk - hw.ankle, y.ankle],
      [cAnk - hw.ankle * 0.85, y.floor],
      [cAnk + hw.ankle * 0.85, y.floor],
      [cAnk + hw.ankle, y.ankle],
      [cKnee + hw.knee, y.knee],
      [cTop + hw.thigh, y.crotch - hw.thigh * 0.5],
    ]);
  }

  /* ---- torso, with the neck as its top station so there is no visible join --- */
  const L = [], R = [];
  const station = (yy, w) => { L.push([cx - w, yy]); R.push([cx + w, yy]); };
  const neckTop = y.chin - (y.chin - y.headTop) * 0.06;
  station(neckTop, hw.neck * 0.90);
  station(neckTop + (y.shoulder - neckTop) * 0.55, hw.neck * 1.02);
  station(y.shoulder, hw.shoulder);
  station(y.bust, hw.bust);
  station(y.underbust, hw.underbust);
  station(y.waist, hw.waist);
  station(y.hip, hw.hip);
  station(y.crotch, hw.hip * 0.94);
  ctx.beginPath();
  smoothPath(ctx, [...L, ...R.reverse()], true);
  ctx.fill();

  /* soft shadow under the jaw, so the neck reads as behind the head */
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, neckTop + hw.neck * 0.5, hw.neck * 0.82, hw.neck * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = tone.shade;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.restore();

  /* ---- head ---- */
  ctx.fillStyle = tone.skin;
  ctx.beginPath();
  ctx.ellipse(cx, (y.headTop + y.chin) / 2, hw.head, (y.chin - y.headTop) / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  /* ---- hair: swept cap plus a high bun ---- */
  ctx.fillStyle = tone.hair;
  const headMid = (y.headTop + y.chin) / 2;
  const headRy = (y.chin - y.headTop) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, headMid, hw.head * 1.04, headRy * 1.03, 0, 0, Math.PI * 2);
  ctx.clip();
  // sleek, pulled back: a neat cap to the hairline plus thin strands at the
  // temples — leaves the face open and gives the headband something to sit on
  ctx.beginPath();
  ctx.ellipse(cx, headMid - headRy * 0.69, hw.head * 1.05, headRy * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * hw.head * 0.88, headMid - headRy * 0.12,
                hw.head * 0.18, headRy * 0.60, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(cx, y.headTop - headRy * 0.20, hw.head * 0.42, headRy * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* Arms are drawn after the garments so a sleeve or strap never floats over
   the arm that should be in front of it. */
export function drawArms(ctx, B, toneId) {
  const tone = SKIN_TONES.find((t) => t.id === toneId) || SKIN_TONES[1];
  const { cx, y, hw } = B;
  ctx.save();
  ctx.fillStyle = tone.shade;
  for (const s of [-1, 1]) {
    const top = cx + s * (hw.shoulder - hw.upperArm * 0.55);
    const elbow = cx + s * (hw.waist + hw.upperArm * 1.15);
    const wrist = cx + s * (hw.hip * 0.92);
    limb(ctx, [
      [top - s * hw.upperArm, y.shoulder + hw.upperArm * 0.5],
      [elbow - s * hw.upperArm * 0.82, y.waist],
      [wrist - s * hw.wrist, y.hip + (y.crotch - y.hip) * 0.55],
      [wrist + s * hw.wrist, y.hip + (y.crotch - y.hip) * 0.6],
      [elbow + s * hw.upperArm * 0.82, y.waist + hw.upperArm * 0.2],
      [top + s * hw.upperArm, y.shoulder + hw.upperArm * 0.9],
    ]);
  }
  ctx.restore();
}

/* ------------------------------------------------- garment placement --- */
/* Each garment reports the box its PNG should occupy. Widths come from the
   body (these fabrics stretch to fit); lengths come from the graded spec for
   the chosen size, in real centimetres. */
const WIDEST = {           // widest opaque row as a fraction of image width
  "cross-back-bra": 0.946,
  "halter": 0.990,
  "sculpt-short": 0.990,
  "tempo-short": 0.990,
  "headband": 0.990,
};

export function garmentBox(id, B, sizeIndex) {
  const { y, hw, ppcm } = B;
  const cm = (v) => v * ppcm;
  const box = (imgW, top, bottom) => ({ imgW, top, bottom, cx: B.cx });

  switch (id) {
    case "cross-back-bra": {
      // Band sits at the underbust; straps meet the shoulder line.
      const w = (2 * hw.underbust) / WIDEST[id];
      return box(w, y.shoulder, y.underbust);
    }
    case "halter": {
      const len = cm(GRADE.halter.bodyLength[sizeIndex]);
      const w = (2 * hw.bust) / WIDEST[id];
      // the neck strap rises above the shoulder line by ~25% of body length
      return box(w, y.shoulder - len * 0.248, y.shoulder + len);
    }
    case "sculpt-short": {
      const g = GRADE["sculpt-short"];
      const w = (2 * hw.hip) / WIDEST[id];
      return box(w, y.crotch - cm(g.frontRise[sizeIndex]), y.crotch + cm(g.inseam[sizeIndex]));
    }
    case "tempo-short": {
      const g = GRADE["tempo-short"];
      const w = (2 * hw.hip * 1.13) / WIDEST[id];
      return box(w, y.crotch - cm(g.frontRise[sizeIndex]), y.crotch + cm(g.inseam[sizeIndex]));
    }
    case "headband": {
      // uniform scale — a simple band, sized to the head at the hairline
      const w = (2 * hw.headAtForehead) / WIDEST[id];
      return { imgW: w, cy: y.forehead, uniform: true, cx: B.cx };
    }
    default:
      return null;
  }
}
