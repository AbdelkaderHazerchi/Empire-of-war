"use strict";
// ================================================================
//  CONSTANTS
// ================================================================
const TS = 20; // tile size px
let MW = 64;   // map width  tiles  — updated dynamically per map
let MH = 48;   // map height tiles  — updated dynamically per map

const T = {
  GRASS: 0,
  WATER: 1,
  MOUNTAIN: 2,
  FOREST: 3,
  SAND: 4,
  SNOW: 5,
  ICE: 6,
  ROCK: 7,
  DIRT: 8,
};
const WALK = [true, false, false, true, true, true, false, false, true];
//gras  wat   mtn  for   snd   snw   ice  rck   drt

const TILE_NAME = {
  [T.GRASS]: "أرض عشبية",
  [T.WATER]: "نهر/ماء",
  [T.MOUNTAIN]: "جبل",
  [T.FOREST]: "غابة",
  [T.SAND]: "رمال صحراوية",
  [T.SNOW]: "أرض ثلجية",
  [T.ICE]: "جليد",
  [T.ROCK]: "صخرة",
  [T.DIRT]: "تراب",
};

const TILE_RES = {
  [T.FOREST]: "🌲 مصدر الخشب",
  [T.SAND]: "🏜️ رمال يمكن البناء عليها",
  [T.DIRT]: "🌿 تربة خصبة مناسبة للبناء",
  [T.GRASS]: "🌿 أرض صالحة للبناء",
  [T.SNOW]: "❄️ أرض صالحة للبناء",
  [T.ROCK]: "⛏️ منطقة صخرية غير قابلة للعبور",
  [T.MOUNTAIN]: "⛰️ جبل غير قابل للعبور",
  [T.WATER]: "🚫 غير قابل للعبور",
  [T.ICE]: "🚫 جليد غير قابل للعبور",
};

// ================================================================
//  THEMES (tile colors per map theme)
// ================================================================
const THEMES = {
  mesopotamia: {
    [T.GRASS]: "#487838",
    [T.WATER]: "#2068b0",
    [T.MOUNTAIN]: "#786848",
    [T.FOREST]: "#285818",
    [T.SAND]: "#c89840",
    [T.SNOW]: "#d8dcc8",
    [T.ICE]: "#a8c0d0",
    [T.ROCK]: "#686048",
    [T.DIRT]: "#886840",
  },
  sahara: {
    [T.GRASS]: "#8a9038",
    [T.WATER]: "#2888a0",
    [T.MOUNTAIN]: "#988050",
    [T.FOREST]: "#607028",
    [T.SAND]: "#d8a838",
    [T.SNOW]: "#e0d098",
    [T.ICE]: "#c0a850",
    [T.ROCK]: "#887848",
    [T.DIRT]: "#b89850",
  },
  alps: {
    [T.GRASS]: "#508040",
    [T.WATER]: "#3870b0",
    [T.MOUNTAIN]: "#7888a0",
    [T.FOREST]: "#286030",
    [T.SAND]: "#c0b080",
    [T.SNOW]: "#e0eaf8",
    [T.ICE]: "#b0cef0",
    [T.ROCK]: "#607080",
    [T.DIRT]: "#987868",
  },
  amazon: {
    [T.GRASS]: "#387828",
    [T.WATER]: "#1858a0",
    [T.MOUNTAIN]: "#507030",
    [T.FOREST]: "#1a4810",
    [T.SAND]: "#908840",
    [T.SNOW]: "#c0d0c0",
    [T.ICE]: "#80a898",
    [T.ROCK]: "#406028",
    [T.DIRT]: "#607838",
  },
  nile: {
    [T.GRASS]: "#508830",
    [T.WATER]: "#1870b0",
    [T.MOUNTAIN]: "#906858",
    [T.FOREST]: "#306820",
    [T.SAND]: "#d0a848",
    [T.SNOW]: "#e0d0a0",
    [T.ICE]: "#b0c8b8",
    [T.ROCK]: "#786040",
    [T.DIRT]: "#a07848",
  },
  steppe: {
    [T.GRASS]: "#5a9040",
    [T.WATER]: "#2870a8",
    [T.MOUNTAIN]: "#708090",
    [T.FOREST]: "#2a5828",
    [T.SAND]: "#b8a880",
    [T.SNOW]: "#d0e0f0",
    [T.ICE]: "#a8c8e8",
    [T.ROCK]: "#587080",
    [T.DIRT]: "#786858",
  },
};

// ================================================================
//  MAPS DEFINITION
// ================================================================
let MAPS_DEF = [
  {
    id: 0,
    name: "وادي الرافدين",
    en: "Mesopotamia",
    region: "العراق",
    desc: "سهول خصبة تجري بينها دجلة والفرات — مهد الحضارة الأولى",
    theme: "mesopotamia",
    gen: genMesopotamia,
    playerPos: { tx: 2, ty: 38 },
    enemyPos: { tx: MW - 16, ty: 2 },
  },
  {
    id: 1,
    name: "الصحراء الكبرى",
    en: "Sahara Desert",
    region: "شمال أفريقيا",
    desc: "رمال لاهبة تمتد إلى الأفق، واحات نادرة وتكوينات صخرية مهيبة",
    theme: "sahara",
    gen: genSahara,
    playerPos: { tx: 2, ty: 38 },
    enemyPos: { tx: MW - 16, ty: 2 },
  },
  {
    id: 2,
    name: "جبال الألب",
    en: "The Alps",
    region: "أوروبا الوسطى",
    desc: "قمم ثلجية شامخة وأودية خضراء وغابات كثيفة تحجب الشمس",
    theme: "alps",
    gen: genAlps,
    playerPos: { tx: 3, ty: MH - 12 },
    enemyPos: { tx: MW - 17, ty: MH - 12 },
  },
  {
    id: 3,
    name: "غابات الأمازون",
    en: "Amazon Rainforest",
    region: "أمريكا الجنوبية",
    desc: "أدغال استوائية كثيفة وأنهار عريضة تشابكت حتى غدت متاهات",
    theme: "amazon",
    gen: genAmazon,
    playerPos: { tx: 2, ty: 38 },
    enemyPos: { tx: MW - 16, ty: 2 },
  },
  {
    id: 4,
    name: "دلتا النيل",
    en: "Nile Delta",
    region: "مصر",
    desc: "نهر النيل الأبدي يشق الصحراء القاحلة ويُنبت الحياة على ضفافه",
    theme: "nile",
    gen: genNile,
    playerPos: { tx: 2, ty: 38 },
    enemyPos: { tx: MW - 16, ty: 2 },
  },
  {
    id: 5,
    name: "السهول الروسية",
    en: "Russian Steppe",
    region: "روسيا",
    desc: "سهول شاسعة تمتد لا نهاية لها، بغابات صنوبر في الشمال وضباب كثيف",
    theme: "steppe",
    gen: genSteppe,
    playerPos: { tx: 2, ty: 38 },
    enemyPos: { tx: MW - 16, ty: 2 },
  },
];

// ================================================================
//  CUSTOM MAPS — JSON-based, saved in localStorage
// ================================================================

// Converts a raw JSON map definition (from editor.html) into a
// game-ready entry and pushes it into MAPS_DEF.
function _mapDefFromJSON(raw) {
  return {
    id:        raw.id,
    name:      raw.name      || "خريطة مخصصة",
    en:        raw.en        || "Custom Map",
    region:    raw.region    || "—",
    desc:      raw.desc      || "",
    theme:     raw.theme     || "mesopotamia",
    data:      raw.data,           // 2-D array — drives getMapData()
    playerPos: raw.playerPos || { tx: 2,  ty: 2 },
    enemyPos:  raw.enemyPos  || { tx: (raw.data?.[0]?.length ?? 62) - 14, ty: 2 },
    _custom:   true,
  };
}

function loadCustomMaps() {
  try {
    const saved = localStorage.getItem("warEmpire_customMaps");
    if (!saved) return;
    const arr = JSON.parse(saved);
    if (!Array.isArray(arr)) return;
    // Remove any previously-loaded custom maps from MAPS_DEF
    const builtinCount = MAPS_DEF.filter(m => !m._custom).length;
    MAPS_DEF.splice(builtinCount);
    arr.forEach(raw => MAPS_DEF.push(_mapDefFromJSON(raw)));
  } catch(e) { console.warn("loadCustomMaps error:", e); }
}

function saveCustomMaps() {
  try {
    const customs = MAPS_DEF.filter(m => m._custom).map(m => ({
      id: m.id, name: m.name, en: m.en, region: m.region,
      desc: m.desc, theme: m.theme, data: m.data,
      playerPos: m.playerPos, enemyPos: m.enemyPos,
    }));
    localStorage.setItem("warEmpire_customMaps", JSON.stringify(customs));
  } catch(e) { console.warn("saveCustomMaps error:", e); }
}

// Import & validate a map JSON object.
// Returns {ok, error, map} 
function importMapFromObject(raw) {
  try {
    if (!raw || typeof raw !== "object")
      return { ok: false, error: "ليس كائن JSON صالح" };
    if (!Array.isArray(raw.data) || !raw.data.length || !Array.isArray(raw.data[0]))
      return { ok: false, error: "حقل data مفقود أو غير صالح (يجب أن يكون مصفوفة ثنائية الأبعاد)" };
    // Warn about extreme sizes but allow them
    const W = raw.data[0].length, H = raw.data.length;
    if (W < 8 || H < 8)
      return { ok: false, error: `أبعاد الخريطة صغيرة جداً (${W}×${H})` };
    // Generate a fresh id if missing or duplicate
    const usedIds = new Set(MAPS_DEF.map(m => m.id));
    let id = raw.id ?? Date.now();
    if (usedIds.has(id)) id = Date.now() + Math.floor(Math.random() * 1000);
    raw = { ...raw, id };
    const mdef = _mapDefFromJSON(raw);
    MAPS_DEF.push(mdef);
    saveCustomMaps();
    return { ok: true, map: mdef };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

function removeCustomMap(id) {
  const idx = MAPS_DEF.findIndex(m => m._custom && m.id === id);
  if (idx === -1) return false;
  MAPS_DEF.splice(idx, 1);
  saveCustomMaps();
  return true;
}

// ================================================================
//  BUILDINGS & UNITS CONFIG
// ================================================================
const BCFG = {
  castle: {
    icon: "🏰",
    w: 3,
    h: 3,
    hp: 600,
    cost: {},
    gen: { gold: 1.5 },
    maxPop: 10,
    label: "القلعة",
    desc: "مقرك الرئيسي — احمها بكل قوتك!",
  },
  house: {
    icon: "🏠",
    w: 2,
    h: 2,
    hp: 100,
    cost: { gold: 50, stone: 10 },
    gen: {},
    maxPop: 6,
    spawnEvery: 18,
    label: "منزل",
    desc: "+6 مقاتلين. يولّد جندياً كل 18 ثانية تلقائياً.",
  },
  barracks: {
    icon: "🏯",
    w: 2,
    h: 2,
    hp: 140,
    cost: { gold: 100, stone: 40 },
    gen: {},
    maxPop: 0,
    label: "ثكنة عسكرية",
    desc: "يتيح تدريب الجنود يدوياً بشكل أسرع.",
  },
  mine: {
    icon: "⛏️",
    w: 2,
    h: 2,
    hp: 100,
    cost: { gold: 60, stone: 30 },
    gen: { gold: 4, metal: 2 },
    maxPop: 0,
    label: "منجم",
    desc: "+4 ذهب/ث و+2 معدن/ث",
  },
  quarry: {
    icon: "🧱",
    w: 2,
    h: 2,
    hp: 90,
    cost: { gold: 60, water: 20 },
    gen: { stone: 4 },
    maxPop: 0,
    label: "محجرة",
    desc: "+4 حجر/ث",
  },
  well: {
    icon: "💧",
    w: 1,
    h: 1,
    hp: 60,
    cost: { gold: 40 },
    gen: { water: 6 },
    maxPop: 0,
    label: "بئر ماء",
    desc: "+6 ماء/ث",
  },
  forge: {
    icon: "🔨",
    w: 2,
    h: 2,
    hp: 120,
    cost: { gold: 120, metal: 50 },
    gen: { metal: 1.5 },
    maxPop: 0,
    atkBonus: 4,
    label: "مسبك",
    desc: "+4 هجوم لجميع وحداتك. +1.5 معدن/ث",
  },
  tower: {
    icon: "🗼",
    w: 1,
    h: 2,
    hp: 180,
    cost: { gold: 90, stone: 50 },
    gen: {},
    maxPop: 0,
    range: 7,
    dmg: 12,
    label: "برج مراقبة",
    desc: "يهاجم الأعداء في نطاق 7 مربعات تلقائياً.",
  },
  wall: {
    icon: "🧱",
    w: 1,
    h: 1,
    hp: 300,
    cost: { gold: 30, stone: 20 },
    gen: {},
    maxPop: 0,
    label: "سور دفاعي",
    desc: "حاجز غير قابل للاختراق بصحة عالية.",
  },
  bridge: {
    icon: "🌉",
    w: 1,
    h: 1,
    hp: 200,
    cost: { gold: 60, stone: 40 },
    gen: {},
    maxPop: 0,
    label: "معبر",
    desc: "يسمح بعبور الماء والجبال. أساسي للتوسع!",
  },
};
const UCFG = {
  soldier: {
    icon: "🗡️",
    col: "#3a8a3a",
    ecol: "#8a2a2a",
    hp: 70,
    atk: 10,
    def: 4,
    spd: 1.5,
    rng: 1.3,
    cost: { gold: 30, water: 10 },
    label: "جندي",
    desc: "مقاتل متوازن — خيار ممتاز للسيطرة.",
  },
  archer: {
    icon: "🏹",
    col: "#3a6898",
    ecol: "#986030",
    hp: 45,
    atk: 16,
    def: 2,
    spd: 1.7,
    rng: 5.0,
    cost: { gold: 50, stone: 10 },
    label: "قوسي",
    desc: "رشيق وبعيد المدى — لكنه هش أمام الفرسان.",
  },
  knight: {
    icon: "🐴",
    col: "#8a7838",
    ecol: "#703870",
    hp: 150,
    atk: 22,
    def: 10,
    spd: 2,
    rng: 1.4,
    cost: { gold: 100, metal: 30 },
    label: "فارس",
    desc: "مدرع وقوي — أبطأ قليلاً لكنه لا يُهزم.",
  },
  siege: {
    icon: "🚜",
    col: "#606060",
    ecol: "#804040",
    hp: 80,
    atk: 40,
    def: 2,
    spd: 1,
    rng: 6.0,
    cost: { gold: 180, metal: 60, stone: 50 },
    label: "مدفع حجري",
    desc: "دمار هائل للمباني — بطيء جداً، لا يتعامل مع الوحدات.",
  },
};

// ================================================================
//  SEEDED RNG
// ================================================================
let _seed = 0;
const sseed = (s) => {
  _seed = s >>> 0;
};
const srng = () => {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
};

// ================================================================
//  MAP GENERATION HELPERS
// ================================================================
function mgrid(base) {
  return Array.from({ length: MH }, () => new Int8Array(MW).fill(base));
}
function mblob(g, t, cx, cy, r) {
  for (let y = Math.max(0, cy - r - 2); y <= Math.min(MH - 1, cy + r + 2); y++)
    for (
      let x = Math.max(0, cx - r - 2);
      x <= Math.min(MW - 1, cx + r + 2);
      x++
    ) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= (r + srng() * 0.8 - 0.1) ** 2)
        g[y][x] = t;
    }
}
function mfill(g, x1, y1, x2, y2, t) {
  for (let y = Math.max(0, y1); y <= Math.min(MH - 1, y2); y++)
    for (let x = Math.max(0, x1); x <= Math.min(MW - 1, x2); x++) g[y][x] = t;
}
function mriver(g, sx, ex, t, wide = 1) {
  let x = sx;
  for (let y = 0; y < MH; y++) {
    for (let w = -wide; w <= wide; w++) {
      const nx = Math.max(0, Math.min(MW - 1, x + w));
      g[y][nx] = t;
    }
    const tgt = sx + ((ex - sx) * y) / (MH - 1);
    if (x < tgt - 0.5) x++;
    else if (x > tgt + 0.5) x--;
    else if (srng() > 0.65) x += srng() > 0.5 ? 1 : -1;
    x = Math.max(wide, Math.min(MW - wide - 1, x));
  }
}
function mhriver(g, sy, ey, t, wide = 1) {
  let y = sy;
  for (let x = 0; x < MW; x++) {
    for (let w = -wide; w <= wide; w++) {
      const ny = Math.max(0, Math.min(MH - 1, y + w));
      g[ny][x] = t;
    }
    const tgt = sy + ((ey - sy) * x) / (MW - 1);
    if (y < tgt - 0.5) y++;
    else if (y > tgt + 0.5) y--;
    else if (srng() > 0.65) y += srng() > 0.5 ? 1 : -1;
    y = Math.max(wide, Math.min(MH - wide - 1, y));
  }
}
function mclear(g, x, y, w, h) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      if (y + dy >= 0 && y + dy < MH && x + dx >= 0 && x + dx < MW) {
        const t = g[y + dy][x + dx];
        if (t !== T.WATER) g[y + dy][x + dx] = T.GRASS;
      }
    }
}

// ================================================================
//  MAP GENERATORS
// ================================================================
function genMesopotamia() {
  sseed(101001);
  const g = mgrid(T.SAND);
  mfill(g, 13, 0, 50, MH - 1, T.GRASS);
  mriver(g, 13, 17, T.WATER, 1); // Euphrates
  mriver(g, 48, 44, T.WATER, 1); // Tigris
  mfill(g, 10, 0, 12, MH - 1, T.GRASS);
  mfill(g, 50, 0, 53, MH - 1, T.GRASS);
  // Forests along rivers
  for (let i = 0; i < 6; i++) {
    mblob(g, T.FOREST, 18 + i * 5, 8 + i * 4, 2 + Math.floor(srng() * 2));
  }
  for (let i = 0; i < 5; i++) {
    mblob(g, T.FOREST, 35 + i * 3, 10 + i * 5, 2 + Math.floor(srng() * 2));
  }
  // Rocky desert edges
  for (let i = 0; i < 5; i++) {
    mblob(
      g,
      T.ROCK,
      Math.floor(srng() * 8) + 1,
      Math.floor(srng() * MH),
      1 + Math.floor(srng() * 2),
    );
  }
  for (let i = 0; i < 5; i++) {
    mblob(
      g,
      T.ROCK,
      MW - Math.floor(srng() * 8) - 1,
      Math.floor(srng() * MH),
      1 + Math.floor(srng() * 2),
    );
  }
  mblob(g, T.MOUNTAIN, 5, 14, 2);
  mblob(g, T.MOUNTAIN, 57, 10, 2);
  mblob(g, T.MOUNTAIN, 59, 32, 2);
  mblob(g, T.MOUNTAIN, 4, 32, 2);
  // Dirt patches in fertile zone
  for (let i = 0; i < 6; i++)
    mblob(
      g,
      T.DIRT,
      20 + Math.floor(srng() * 25),
      5 + Math.floor(srng() * 38),
      2,
    );
  mclear(g, 0, MH - 12, 14, 11);
  mclear(g, MW - 16, 0, 15, 11);
  return g;
}

function genSahara() {
  sseed(202002);
  const g = mgrid(T.SAND);
  // Rock formations
  [
    [16, 12, 4],
    [42, 8, 3],
    [10, 32, 4],
    [50, 36, 4],
    [30, 22, 3],
    [55, 18, 3],
    [8, 18, 2],
    [60, 42, 2],
  ].forEach(([x, y, r]) => {
    mblob(g, T.MOUNTAIN, x, y, r);
    mblob(g, T.ROCK, x, y, r + 1);
  });
  // Oases
  [
    { x: 11, y: 22 },
    { x: 52, y: 28 },
    { x: 32, y: 40 },
    { x: 24, y: 10 },
  ].forEach((o, i) => {
    mblob(g, T.GRASS, o.x, o.y, i < 2 ? 4 : 3);
    mblob(g, T.WATER, o.x, o.y, i < 2 ? 2 : 1);
    mblob(g, T.FOREST, o.x, o.y, 1);
  });
  // Dirt
  for (let i = 0; i < 8; i++)
    mblob(
      g,
      T.DIRT,
      Math.floor(srng() * 60) + 2,
      Math.floor(srng() * 44) + 2,
      2,
    );
  mclear(g, 0, MH - 12, 14, 11);
  mclear(g, MW - 16, 0, 15, 11);
  return g;
}

function genAlps() {
  sseed(303003);
  const g = mgrid(T.GRASS);
  mfill(g, 0, 0, MW - 1, 22, T.SNOW);
  // Main mountain chain
  for (let i = 0; i < 22; i++) {
    const cx = (4 + i * 2.7) | 0,
      cy = (6 + i * 0.7) | 0;
    mblob(g, T.MOUNTAIN, cx, cy, 3 + ((srng() * 2) | 0));
    mblob(g, T.SNOW, cx, cy - 3, 2);
  }
  // Secondary ridges
  for (let i = 0; i < 12; i++) {
    mblob(g, T.MOUNTAIN, 8 + i * 4, (18 + i * 0.5) | 0, 2);
  }
  // Ice lakes
  mblob(g, T.ICE, 28, 14, 3);
  mblob(g, T.ICE, 46, 10, 2);
  mblob(g, T.ICE, 15, 8, 2);
  // Mountain streams
  mriver(g, 14, 8, T.WATER, 0);
  mriver(g, 50, 54, T.WATER, 0);
  // Lower forests
  [
    [6, 36, 4],
    [18, 40, 5],
    [35, 38, 4],
    [50, 38, 4],
    [28, 32, 3],
    [58, 34, 3],
  ].forEach(([x, y, r]) => mblob(g, T.FOREST, x, y, r));
  // Rocks
  [
    [20, 22, 2],
    [38, 18, 2],
    [52, 24, 2],
  ].forEach(([x, y, r]) => mblob(g, T.ROCK, x, y, r));
  // Dirt in valleys
  [
    [10, 30, 3],
    [48, 32, 3],
    [30, 26, 2],
  ].forEach(([x, y, r]) => mblob(g, T.DIRT, x, y, r));
  mclear(g, 0, MH - 12, 14, 11);
  mclear(g, MW - 16, MH - 12, 15, 11);
  return g;
}

function genAmazon() {
  sseed(404004);
  const g = mgrid(T.FOREST);
  // Major river system
  mhriver(g, (MH / 2) | 0, (MH / 2 + 5) | 0, T.WATER, 2);
  mriver(g, 18, 22, T.WATER, 1);
  mriver(g, 44, 40, T.WATER, 1);
  mhriver(g, 10, 14, T.WATER, 1);
  // Clearings
  [
    [8, 12, 4],
    [30, 8, 4],
    [54, 15, 4],
    [12, 40, 4],
    [40, 38, 4],
    [28, 32, 3],
    [50, 26, 3],
    [20, 24, 3],
  ].forEach(([x, y, r]) => mblob(g, T.GRASS, x, y, r));
  // Rocky areas
  [
    [26, 22, 2],
    [42, 28, 2],
    [15, 30, 1],
    [50, 10, 2],
  ].forEach(([x, y, r]) => mblob(g, T.ROCK, x, y, r));
  // Sandbars
  [
    [10, 24, 2],
    [52, 24, 2],
    [30, 10, 2],
  ].forEach(([x, y, r]) => mblob(g, T.SAND, x, y, r));
  mclear(g, 0, MH - 12, 14, 11);
  mclear(g, MW - 16, 0, 15, 11);
  return g;
}

function genNile() {
  sseed(505005);
  const g = mgrid(T.SAND);
  // Main Nile (wide)
  mriver(g, 29, 30, T.WATER, 2);
  // Delta branches (south)
  mriver(g, 20, 18, T.WATER, 1);
  mriver(g, 38, 40, T.WATER, 1);
  // Fertile banks
  for (let y = 0; y < MH; y++) {
    for (let w = 3; w <= 8; w++) {
      if (g[y][Math.max(0, 28 - w)] === T.SAND)
        g[y][Math.max(0, 28 - w)] = T.GRASS;
      if (g[y][Math.min(MW - 1, 32 + w)] === T.SAND)
        g[y][Math.min(MW - 1, 32 + w)] = T.GRASS;
    }
  }
  // Delta fertile zone
  mfill(g, 16, (MH * 0.6) | 0, 46, MH - 1, T.GRASS);
  // Forests on banks
  [
    [24, 18, 3],
    [34, 28, 3],
    [20, 40, 3],
    [40, 40, 3],
    [28, 10, 2],
    [32, 35, 2],
  ].forEach(([x, y, r]) => mblob(g, T.FOREST, x, y, r));
  // Desert rocks
  [
    [6, 12, 3],
    [56, 8, 3],
    [4, 32, 3],
    [58, 36, 3],
    [10, 22, 2],
    [52, 22, 2],
  ].forEach(([x, y, r]) => mblob(g, T.ROCK, x, y, r));
  [
    [14, 10, 3],
    [44, 18, 3],
    [8, 40, 2],
    [56, 44, 2],
  ].forEach(([x, y, r]) => mblob(g, T.DIRT, x, y, r));
  mclear(g, 0, MH - 12, 14, 11);
  mclear(g, MW - 16, 0, 15, 11);
  return g;
}

function genSteppe() {
  sseed(606006);
  const g = mgrid(T.GRASS);
  // Northern snow/taiga
  mfill(g, 0, 0, MW - 1, 16, T.SNOW);
  // Taiga forests
  for (let i = 0; i < 9; i++)
    mblob(g, T.FOREST, 6 + i * 7, 4 + (i % 3) * 2, 3 + (i % 2));
  // Central forests
  [
    [8, 26, 4],
    [24, 22, 3],
    [42, 28, 4],
    [18, 38, 3],
    [50, 38, 4],
    [32, 32, 3],
    [58, 24, 3],
    [4, 44, 3],
  ].forEach(([x, y, r]) => mblob(g, T.FOREST, x, y, r));
  // River
  mriver(g, 30, 28, T.WATER, 1);
  // Dirt plains
  [
    [14, 30, 4],
    [40, 22, 4],
    [55, 42, 3],
    [26, 42, 3],
  ].forEach(([x, y, r]) => mblob(g, T.DIRT, x, y, r));
  // Rocks
  [
    [18, 12, 2],
    [48, 18, 2],
    [34, 8, 1],
    [58, 28, 2],
    [6, 34, 2],
  ].forEach(([x, y, r]) => mblob(g, T.ROCK, x, y, r));
  mclear(g, 0, MH - 12, 14, 11);
  mclear(g, MW - 16, 0, 15, 11);
  return g;
}

// ================================================================
//  MAP DATA LOADER — handles both gen-functions and JSON data
// ================================================================
let curMapTheme = "mesopotamia";

/**
 * Given a map definition, return the 2-D tile array and update
 * the global MW / MH to match the map dimensions.
 * For JSON maps the rows are converted to Int8Array for ~4× lower
 * memory usage (critical for maps like 500 × 500).
 */
function getMapData(mdef) {
  if (mdef.data) {
    // JSON map produced by editor.html
    MH = mdef.data.length;
    MW = mdef.data[0] ? mdef.data[0].length : 64;
    // Convert each plain JS row to Int8Array (memory-efficient, still indexable)
    return mdef.data.map(row =>
      (row instanceof Int8Array || row instanceof Uint8Array) ? row : new Int8Array(row)
    );
  } else {
    // Procedural map — always 64 × 48
    MW = 64;
    MH = 48;
    return mdef.gen();
  }
}

/**
 * Build an ImageData-based tile renderer for large maps.
 * Parses theme hex colors into RGBA tuples once, then writes
 * pixels directly — 50-100× faster than fillRect for huge maps.
 */
function _buildTilePixels(theme) {
  const parse = hex => {
    const c = parseInt(hex.slice(1), 16);
    return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
  };
  const rgb = {};
  for (const [k, v] of Object.entries(theme)) rgb[k] = parse(v);
  return rgb;
}

// ================================================================
//  CAMERA HELPERS
// ================================================================
function worldToScreen(wx, wy) {
  return { x: (wx - cam.x) * cam.zoom, y: (wy - cam.y) * cam.zoom };
}
function screenToWorld(sx, sy) {
  return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
}
function clampCam() {
  const ww = MW * TS,
    wh = MH * TS;
  const maxX = ww - cv.width / cam.zoom,
    maxY = wh - cv.height / cam.zoom;
  cam.x = Math.max(0, Math.min(maxX, cam.x));
  cam.y = Math.max(0, Math.min(maxY, cam.y));
}
function fitMap() {
  const ww = MW * TS,
    wh = MH * TS;
  // Fit zoom so entire map is visible
  cam.zoom = Math.min(cv.width / ww, cv.height / wh, cam.maxZ);
  cam.zoom = Math.max(cam.zoom, cam.minZ);
  // Center the map in the canvas
  cam.x = (ww - cv.width / cam.zoom) / 2;
  cam.y = (wh - cv.height / cam.zoom) / 2;
  targetZoom = cam.zoom;
  clampCam();
}
function camZoomAt(pivot, delta) {
  const px = pivot ? pivot.x : cv.width / 2,
    py = pivot ? pivot.y : cv.height / 2;
  const wx = px / cam.zoom + cam.x,
    wy = py / cam.zoom + cam.y;
  cam.zoom = Math.max(cam.minZ, Math.min(cam.maxZ, cam.zoom + delta));
  targetZoom = cam.zoom;
  cam.x = wx - px / cam.zoom;
  cam.y = wy - py / cam.zoom;
  clampCam();
}

// ================================================================
//  GAME SETUP
// ================================================================
function initOwner(isPlayer) {
  return {
    gold: isPlayer ? 200 : 250,
    stone: isPlayer ? 100 : 120,
    water: isPlayer ? 100 : 120,
    metal: isPlayer ? 60 : 80,
    maxPop: 10,
    pop: 0,
    buildings: [],
    units: [],
    atkBonus: 0,
    side: isPlayer ? "player" : "bot",
    aiTimer: 0,
    atkTimer: 0,
    aiThoughtCount: 0,
    aiThoughts: [],
  };
}
function setupMap(idx, diff) {
  curMapIdx = idx;
  curDiff = diff;
  gameover = false;
  const mdef = MAPS_DEF[idx];
  curMapTheme = mdef.theme || "mesopotamia";
  map2d = getMapData(mdef);
  P = initOwner(true);
  B = initOwner(false);
  selUnits = [];
  selBox = null;
  tool = "select";
  buildType = null;
  document
    .querySelectorAll(".sb-btn")
    .forEach((b) => b.classList.remove("sel-on"));
  setToolUI("select");

  // Player castle & units
  const pp = mdef.playerPos;
  placeBuilding(P, "castle", pp.tx, pp.ty);
  spawnUnit(P, "soldier", pp.tx + 4, pp.ty + 1);
  spawnUnit(P, "soldier", pp.tx + 5, pp.ty + 1);
  spawnUnit(P, "soldier", pp.tx + 4, pp.ty + 2);

  // Enemy castle & units
  const ep = mdef.enemyPos;
  placeBuilding(B, "castle", ep.tx, ep.ty);
  spawnUnit(B, "soldier", ep.tx - 2, ep.ty + 2);
  spawnUnit(B, "soldier", ep.tx - 3, ep.ty + 2);
  spawnUnit(B, "soldier", ep.tx - 2, ep.ty + 3);

  // Enemy starting buildings by difficulty
  placeBuilding(B, "house", ep.tx - 7, ep.ty);
  if (diff !== "easy") {
    placeBuilding(B, "mine", ep.tx - 7, ep.ty + 3);
    placeBuilding(B, "barracks", ep.tx - 10, ep.ty);
    spawnUnit(B, "archer", ep.tx - 5, ep.ty + 4);
  }
  if (diff === "hard") {
    placeBuilding(B, "forge", ep.tx - 10, ep.ty + 3);
    placeBuilding(B, "tower", ep.tx - 5, ep.ty);
    placeBuilding(B, "house", ep.tx - 10, ep.ty + 6);
    spawnUnit(B, "knight", ep.tx - 8, ep.ty + 5);
    spawnUnit(B, "archer", ep.tx - 6, ep.ty + 5);
    B.atkBonus = BCFG.forge.atkBonus;
  }

  document.getElementById("map-badge").textContent =
    `${mdef.name} | ${mdef.region}`;
  setStatus(`${mdef.name} — ${AI_PROFILES[diff].label} | دمر قلعة العدو للفوز!`);
  notify(`⚔️ ${mdef.name} — ${mdef.en}`);

  resizeCanvas();
  fitMap();
  updateUI();
}

function placeBuilding(owner, type, tx, ty) {
  const c = BCFG[type];
  owner.buildings.push({
    type,
    tx,
    ty,
    hp: c.hp,
    maxHp: c.hp,
    side: owner.side,
    genT: 0,
    spawnT: 0,
    atkT: 0,
    id: Math.random(),
  });
  owner.maxPop += c.maxPop || 0;
  if (type === "forge") owner.atkBonus += c.atkBonus || 0;
}
function spawnUnit(owner, type, tx, ty) {
  const c = UCFG[type];
  for (let r = 0; r < 6; r++) {
    const ox = ((Math.random() > 0.5 ? 1 : -1) * r) | 0,
      oy = ((Math.random() > 0.5 ? 1 : -1) * r) | 0;
    if (walkable(tx + ox, ty + oy)) {
      tx += ox;
      ty += oy;
      break;
    }
  }
  owner.units.push({
    type,
    side: owner.side,
    x: (tx + 0.5) * TS,
    y: (ty + 0.5) * TS,
    tx,
    ty,
    hp: c.hp,
    maxHp: c.hp,
    atk: c.atk + owner.atkBonus,
    def: c.def,
    spd: c.spd,
    rng: c.rng,
    path: null,
    pi: 0,
    state: "idle",
    atkT: 0,
    target: null,
    selected: false,
    id: Math.random(),
    kills: 0,
    level: 1,
  });
  owner.pop++;
}