/* =========================================================
   宇宙どうぶつ ジェネレーター
   speciesId(13) × 各パーツのバリエーション × 連続的な色(色相/彩度/明度)
   の掛け合わせにより、理論上9京通り以上の組み合わせを目指す設計。
   FQT LIFE COUNTER の「宇宙どうぶつ」と同じ考え方:
   パーツはPNGを保存せず、その場でSVGとして生成する。
   ========================================================= */

// 文字列+数値から安定した整数シードを作る
function seedFrom(...parts) {
  const str = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// シードから 0..1 の疑似乱数列を作る（呼ぶたびに次の値を返す）
function makeRng(seed) {
  let s = seed || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967295;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/* ---------- 体のかたち（species.shape ごとに13種） ---------- */
const BODY_PATHS = {
  circle:   () => `<circle cx="100" cy="105" r="52"/>`,
  star:     () => starPath(100, 105, 5, 55, 26),
  teardrop: () => `<path d="M100,50 C130,90 150,120 100,158 C50,120 70,90 100,50 Z"/>`,
  leaf:     () => `<path d="M100,50 C150,70 150,150 100,160 C50,150 50,70 100,50 Z"/>`,
  diamond:  () => `<path d="M100,45 L150,105 L100,165 L50,105 Z"/>`,
  cloud:    () => `<path d="M60,120 a26,26 0 0,1 8,-51 a30,30 0 0,1 58,-6 a24,24 0 0,1 22,44 a20,20 0 0,1 -6,39 H70 a22,22 0 0,1 -10,-26 Z"/>`,
  spiral:   () => `<path d="M100,105 m0,-46 a46,46 0 1,1 -32,79 a30,30 0 1,1 22,-51 a16,16 0 1,1 -10,26" fill="none" stroke-width="16" stroke-linecap="round"/>`,
  hexagon:  () => hexPath(100, 105, 54),
  flame:    () => `<path d="M100,48 C130,80 128,105 112,118 C122,100 108,95 104,108 C100,90 84,95 88,118 C68,105 70,80 100,48 Z"/>`,
  moon:     () => `<path d="M120,52 A54,54 0 1,0 120,158 A42,42 0 1,1 120,52 Z"/>`,
  blob:     (rng) => blobPath(100, 105, 50, rng),
  gem:      () => `<path d="M100,50 L134,80 L122,160 L78,160 L66,80 Z"/>`,
  wave:     () => `<path d="M45,115 Q65,80 100,115 T155,115 L155,150 Q120,175 100,150 Q80,175 45,150 Z"/>`,
};

function starPath(cx, cy, spikes, outerR, innerR) {
  let pts = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = i * step - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}"/>`;
}

function hexPath(cx, cy, r) {
  let pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}"/>`;
}

function blobPath(cx, cy, r, rng) {
  const points = 8;
  let d = "";
  const coords = [];
  for (let i = 0; i < points; i++) {
    const a = (Math.PI * 2 * i) / points;
    const wobble = r * (0.78 + rng() * 0.34);
    coords.push([cx + Math.cos(a) * wobble, cy + Math.sin(a) * wobble]);
  }
  d += `M ${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)} `;
  for (let i = 0; i < points; i++) {
    const c = coords[i];
    const n = coords[(i + 1) % points];
    const mx = (c[0] + n[0]) / 2, my = (c[1] + n[1]) / 2;
    d += `Q ${c[0].toFixed(1)},${c[1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)} `;
  }
  d += "Z";
  return `<path d="${d}"/>`;
}

/* ---------- 目 (6種) ---------- */
function eyesSvg(kind, cx1, cx2, cy) {
  switch (kind) {
    case "dot": return `<circle cx="${cx1}" cy="${cy}" r="4.5" fill="#241533"/><circle cx="${cx2}" cy="${cy}" r="4.5" fill="#241533"/>`;
    case "sparkle": return `<circle cx="${cx1}" cy="${cy}" r="5.5" fill="#241533"/><circle cx="${cx1+1.5}" cy="${cy-1.5}" r="1.6" fill="#fff"/><circle cx="${cx2}" cy="${cy}" r="5.5" fill="#241533"/><circle cx="${cx2+1.5}" cy="${cy-1.5}" r="1.6" fill="#fff"/>`;
    case "happy": return `<path d="M${cx1-5},${cy} Q${cx1},${cy-7} ${cx1+5},${cy}" fill="none" stroke="#241533" stroke-width="3" stroke-linecap="round"/><path d="M${cx2-5},${cy} Q${cx2},${cy-7} ${cx2+5},${cy}" fill="none" stroke="#241533" stroke-width="3" stroke-linecap="round"/>`;
    case "wide": return `<circle cx="${cx1}" cy="${cy}" r="7" fill="#241533"/><circle cx="${cx2}" cy="${cy}" r="7" fill="#241533"/>`;
    case "sleepy": return `<line x1="${cx1-5}" y1="${cy}" x2="${cx1+5}" y2="${cy}" stroke="#241533" stroke-width="3" stroke-linecap="round"/><line x1="${cx2-5}" y1="${cy}" x2="${cx2+5}" y2="${cy}" stroke="#241533" stroke-width="3" stroke-linecap="round"/>`;
    default: return `<circle cx="${cx1}" cy="${cy}" r="4" fill="#241533"/><circle cx="${cx2}" cy="${cy}" r="4" fill="#241533"/>`;
  }
}

/* ---------- 口 (愛の進行度に応じて5段階) ---------- */
function mouthSvg(progress, cx, cy) {
  if (progress < 0.2) return `<line x1="${cx-4}" y1="${cy}" x2="${cx+4}" y2="${cy}" stroke="#241533" stroke-width="2.5" stroke-linecap="round"/>`;
  if (progress < 0.4) return `<path d="M${cx-5},${cy} Q${cx},${cy+3} ${cx+5},${cy}" fill="none" stroke="#241533" stroke-width="2.5" stroke-linecap="round"/>`;
  if (progress < 0.65) return `<path d="M${cx-6},${cy-1} Q${cx},${cy+6} ${cx+6},${cy-1}" fill="none" stroke="#241533" stroke-width="2.8" stroke-linecap="round"/>`;
  if (progress < 0.85) return `<path d="M${cx-7},${cy-2} Q${cx},${cy+9} ${cx+7},${cy-2} Z" fill="#241533"/>`;
  return `<path d="M${cx-8},${cy-3} Q${cx},${cy+11} ${cx+8},${cy-3} Z" fill="#241533"/><circle cx="${cx-4}" cy="${cy+9}" r="2" fill="#ff9d81" opacity="0.7"/><circle cx="${cx+4}" cy="${cy+9}" r="2" fill="#ff9d81" opacity="0.7"/>`;
}

/* ---------- 模様 (6種) ---------- */
function patternSvg(kind, rng) {
  if (kind === "none") return "";
  let out = "";
  if (kind === "dots") {
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2, r = 20 + rng() * 24;
      out += `<circle cx="${(100 + Math.cos(a) * r).toFixed(1)}" cy="${(105 + Math.sin(a) * r).toFixed(1)}" r="${(2 + rng() * 2.5).toFixed(1)}" fill="#fff" opacity="0.35"/>`;
    }
  } else if (kind === "stripes") {
    for (let i = -2; i <= 2; i++) {
      out += `<line x1="${60}" y1="${105 + i * 12}" x2="${140}" y2="${105 + i * 12}" stroke="#fff" stroke-width="2" opacity="0.18"/>`;
    }
  } else if (kind === "stars") {
    for (let i = 0; i < 4; i++) {
      const a = rng() * Math.PI * 2, r = 22 + rng() * 20;
      out += starPath((100 + Math.cos(a) * r), (105 + Math.sin(a) * r), 4, 4, 1.6).replace("<polygon", `<polygon fill="#fff" opacity="0.4"`);
    }
  } else if (kind === "rings") {
    out += `<circle cx="100" cy="105" r="34" fill="none" stroke="#fff" stroke-width="2" opacity="0.22"/>`;
  }
  return out;
}

/* ---------- メイン生成関数 ---------- */
function generateCreatureSVG({ speciesShape, hue, love, maxKnownLove, egoAvg, seedKey }) {
  const rng = makeRng(seedFrom(seedKey));
  const progress = Math.max(0, Math.min(1, love / Math.max(1, maxKnownLove)));

  // 色: 愛が育つほど彩度・明度が上がり輝きが増す
  const sat = 42 + progress * 40;
  const light = 40 + progress * 26;
  const fill = `hsl(${(hue + Math.floor(rng() * 12 - 6) + 360) % 360}, ${sat}%, ${light}%)`;
  const glowColor = `hsl(${(hue + 30) % 360}, 90%, 75%)`;

  const eyeKind = pick(rng, ["dot", "sparkle", "happy", "wide", "sleepy"]);
  const patternKind = pick(rng, ["none", "dots", "stripes", "stars", "rings"]);
  const hasAntenna = rng() > (0.35 + progress * 0.2); // 愛が育つほど角/触角が減っていくイメージ
  const antennaCount = hasAntenna ? (rng() > 0.6 ? 2 : 1) : 0;
  const auraStrength = 0.15 + progress * 0.55;
  const starCount = Math.round(progress * 10);

  const bodyFn = BODY_PATHS[speciesShape] || BODY_PATHS.circle;
  const bodyMarkup = bodyFn(rng);

  let bg = "";
  for (let i = 0; i < starCount; i++) {
    const x = (rng() * 190 + 5).toFixed(1);
    const y = (rng() * 190 + 5).toFixed(1);
    const r = (0.6 + rng() * 1.3).toFixed(1);
    bg += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${(0.3 + rng() * 0.4).toFixed(2)}"/>`;
  }

  let antenna = "";
  if (antennaCount >= 1) {
    antenna += `<line x1="88" y1="58" x2="82" y2="38" stroke="${fill}" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="36" r="3.5" fill="${fill}"/>`;
  }
  if (antennaCount >= 2) {
    antenna += `<line x1="112" y1="58" x2="118" y2="38" stroke="${fill}" stroke-width="3" stroke-linecap="round"/><circle cx="118" cy="36" r="3.5" fill="${fill}"/>`;
  }

  return `
<svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="aura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${glowColor}" stop-opacity="${auraStrength.toFixed(2)}"/>
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="105" r="95" fill="url(#aura)"/>
  ${bg}
  ${antenna}
  <g fill="${fill}" stroke="rgba(0,0,0,0.08)" stroke-width="1">
    ${bodyMarkup}
  </g>
  <g>${patternSvg(patternKind, rng)}</g>
  ${eyesSvg(eyeKind, 90, 110, 100)}
  ${mouthSvg(progress, 100, 112)}
</svg>`;
}
