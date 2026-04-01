"use strict";
// ================================================================
//  GAME STATE
// ================================================================
let cv, ctx, mmcv, mmctx;
let running = false,
  gameover = false;
let selMapIdx = 0,
  selDiff_ = "easy";
let curMapIdx = 0,
  curDiff = "easy";
let map2d = [];
let P = {},
  B = {};
let tool = "select"; // 'select'|'pan'|'move'|'build'
let buildType = null;
let selUnits = [];
let selBox = null; // {sx,sy,ex,ey} drag-select box
let hovTile = { x: -1, y: -1 };
let lastTs = 0,
  gtime = 0,
  notifTimer = 0;
let rafId = null;
// Camera
let cam = { x: 0, y: 0, zoom: 1, minZ: 0.3, maxZ: 3 };
let targetZoom = 1;
// Pan drag
let panDrag = null; // {sx,sy,cx,cy}
let selDrag = null; // {sx,sy} selection box start (screen space)

// ================================================================
//  A* PATHFINDING
// ================================================================
function walkable(x, y) {
  if (x < 0 || x >= MW || y < 0 || y >= MH) return false;
  // Check if a bridge exists on this tile (allows crossing water/mountains)
  const hasBridge = [...P.buildings, ...B.buildings].some(
    (b) => b.type === "bridge" && b.tx === x && b.ty === y,
  );
  if (hasBridge) return true;
  if (!WALK[map2d[y][x]]) return false;
  for (const b of [...P.buildings, ...B.buildings]) {
    const c = BCFG[b.type];
    if (b.type === "bridge") continue;
    if (x >= b.tx && x < b.tx + c.w && y >= b.ty && y < b.ty + c.h)
      return false;
  }
  return true;
}
function astar(sx, sy, ex, ey) {
  ex = Math.max(0, Math.min(MW - 1, ex));
  ey = Math.max(0, Math.min(MH - 1, ey));
  if (sx === ex && sy === ey) return [];
  const K = (x, y) => y * MW + x;
  const H = (x, y) => Math.abs(ex - x) + Math.abs(ey - y);
  const open = new Map(),
    closed = new Set();
  const mapSize = MW * MH;
  const g = new Float32Array(mapSize).fill(Infinity);
  const f = new Float32Array(mapSize).fill(Infinity);
  const par = new Int32Array(mapSize).fill(-1);
  const sk = K(sx, sy);
  g[sk] = 0;
  f[sk] = H(sx, sy);
  open.set(sk, { x: sx, y: sy });
  const D = [
    { dx: 0, dy: -1, c: 1 },
    { dx: 0, dy: 1, c: 1 },
    { dx: -1, dy: 0, c: 1 },
    { dx: 1, dy: 0, c: 1 },
    { dx: -1, dy: -1, c: 1.41 },
    { dx: 1, dy: -1, c: 1.41 },
    { dx: -1, dy: 1, c: 1.41 },
    { dx: 1, dy: 1, c: 1.41 },
  ];
  const maxIter = Math.max(1500, MW * MH * 0.15 | 0);
  let iter = 0;
  while (open.size > 0 && iter++ < maxIter) {
    let cur = null,
      mf = Infinity;
    for (const [k, v] of open) {
      if (f[k] < mf) {
        mf = f[k];
        cur = { k, x: v.x, y: v.y };
      }
    }
    if (!cur) break;
    const { k: ck, x: cx, y: cy } = cur;
    open.delete(ck);
    closed.add(ck);
    if (cx === ex && cy === ey) {
      const path = [];
      let k = ck;
      while (par[k] >= 0) {
        path.unshift({ x: k % MW, y: Math.floor(k / MW) });
        k = par[k];
      }
      return path;
    }
    for (const { dx, dy, c } of D) {
      const nx = cx + dx,
        ny = cy + dy;
      if (nx < 0 || nx >= MW || ny < 0 || ny >= MH) continue;
      const nk = K(nx, ny);
      if (closed.has(nk)) continue;
      const isEnd = nx === ex && ny === ey;
      if (!isEnd && !walkable(nx, ny)) continue;
      const ng = g[ck] + c;
      if (ng < g[nk]) {
        par[nk] = ck;
        g[nk] = ng;
        f[nk] = ng + H(nx, ny);
        open.set(nk, { x: nx, y: ny });
      }
    }
  }
  return null;
}

// ================================================================
//  GAME LOOP
// ================================================================
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.08);
  lastTs = ts;
  if (running && !gameover) {
    update(dt);
  }
  updateSmoothZoom();
  render();
  rafId = requestAnimationFrame(loop);
}
function update(dt) {
  updateRes(P, dt, 1);
  updateRes(B, dt, AI_PROFILES[curDiff].resourceMultiplier);
  updateSpawns(P, dt);
  updateSpawns(B, dt);
  updateUnits(P, B, dt);
  updateUnits(B, P, dt);
  updateTowers(P, B, dt);
  updateTowers(B, P, dt);
  updateBotAI(dt);
  // Cull dead
  const pd = P.units.filter((u) => u.hp <= 0).length;
  const bd = B.units.filter((u) => u.hp <= 0).length;
  P.units = P.units.filter((u) => u.hp > 0);
  B.units = B.units.filter((u) => u.hp <= 0 ? false : true);
  P.pop = Math.max(0, P.pop - pd);
  B.pop = Math.max(0, B.pop - bd);
  selUnits = selUnits.filter((u) => u.hp > 0 && P.units.includes(u));
  // Win/lose
  if (!gameover) {
    if (!P.buildings.find((b) => b.type === "castle")) {
      endGame(false);
      return;
    }
    if (!B.buildings.find((b) => b.type === "castle")) {
      endGame(true);
      return;
    }
  }
  if (notifTimer > 0) {
    notifTimer -= dt;
    if (notifTimer <= 0) document.getElementById("notif").style.opacity = "0";
  }
  gtime += dt;
  updateUI();
}

function updateRes(o, dt, mul) {
  let gr = 1.5 * mul,
    sr = 0,
    wr = 0,
    mr = 0;
  for (const b of o.buildings) {
    b.genT += dt;
    if (b.genT >= 1) {
      b.genT -= 1;
      const g = BCFG[b.type].gen || {};
      o.gold = Math.min(9999, o.gold + (g.gold || 0) * mul);
      o.stone = Math.min(9999, o.stone + (g.stone || 0) * mul);
      o.water = Math.min(9999, o.water + (g.water || 0) * mul);
      o.metal = Math.min(9999, o.metal + (g.metal || 0) * mul);
    }
    if (o === P) {
      const g = BCFG[b.type].gen || {};
      gr += g.gold || 0;
      sr += g.stone || 0;
      wr += g.water || 0;
      mr += g.metal || 0;
    }
  }
  o.gold += 0.5 * dt * mul;
  if (o === P) {
    const fmt = (v) => (v > 0 ? `+${v.toFixed(0)}/ث` : "");
    document.getElementById("r-gold-r").textContent = fmt(gr);
    document.getElementById("r-stone-r").textContent = fmt(sr);
    document.getElementById("r-water-r").textContent = fmt(wr);
    document.getElementById("r-metal-r").textContent = fmt(mr);
  }
}
function updateSpawns(o, dt) {
  for (const b of o.buildings) {
    if (b.type !== "house") continue;
    b.spawnT += dt;
    if (b.spawnT >= BCFG.house.spawnEvery) {
      b.spawnT -= BCFG.house.spawnEvery;
      if (o.pop < o.maxPop) {
        spawnUnit(o, "soldier", b.tx + 2, b.ty + 1);
        if (o === P) notify("🗡️ جندي جديد تم تجنيده!");
      }
    }
  }
}
function d2(a, b) {
  const ax = a.x / TS,
    ay = a.y / TS;
  const bx = b.x != null ? b.x / TS : b.tx + (BCFG[b.type]?.w || 1) / 2;
  const by = b.y != null ? b.y / TS : b.ty + (BCFG[b.type]?.h || 1) / 2;
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}
function findTarget(u, enemy) {
  let best = null,
    bd = Infinity;
  for (const e of enemy.units) {
    if (e.hp <= 0) continue;
    const d = d2(u, e);
    if (d < 7 && d < bd) {
      bd = d;
      best = e;
    }
  }
  if (best) return best;
  for (const b of enemy.buildings) {
    const bx = b.tx + BCFG[b.type].w / 2,
      by = b.ty + BCFG[b.type].h / 2;
    const d = Math.sqrt((u.x / TS - bx) ** 2 + (u.y / TS - by) ** 2);
    if (d < 4 && d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
function updateUnits(owner, enemy, dt) {
  for (const u of owner.units) {
    if (u.hp <= 0) continue;
    u.atkT = Math.max(0, u.atkT - dt);
    if (!u.target || u.target.hp <= 0) u.target = findTarget(u, enemy);
    if (u.target && u.atkT <= 0) {
      const dd = d2(u, u.target);
      if (dd <= u.rng + 0.5) {
        const dmg = Math.max(1, u.atk - (u.target.def || 0));
        u.target.hp -= dmg;
        u.atkT = 0.85;
        u.state = "atk";
        if (u.target.hp <= 0) {
          if (BCFG[u.target.type]) {
            const i = enemy.buildings.indexOf(u.target);
            if (i >= 0) {
              enemy.buildings.splice(i, 1);
              recalcPop(enemy);
              notify(
                enemy === B
                  ? `💥 دمّرنا ${BCFG[u.target.type].label} العدو!`
                  : `❌ دمّر العدو ${BCFG[u.target.type].label}!`,
              );
            }
          }
          u.kills++;
          if (owner === P) {
            achievements.kills++;
            checkAchievements();
          }
          if (u.kills >= 3 * u.level && u.level < 3) {
            u.level++;
            u.atk += 3;
            u.def += 1;
            u.maxHp += 20;
            u.hp = Math.min(u.hp + 20, u.maxHp);
            if (owner === P) {
              achievements.maxLevel = Math.max(achievements.maxLevel, u.level);
              notify(`⭐ وحدة رُقِّيت إلى مستوى ${u.level}!`);
              saveAchievements();
              checkAchievements();
            }
          }
          u.target = null;
          u.state = "idle";
          continue;
        }
      }
    }
    if (u.path && u.pi < u.path.length) {
      const pt = u.path[u.pi];
      const tx = (pt.x + 0.5) * TS,
        ty = (pt.y + 0.5) * TS;
      const dx = tx - u.x,
        dy = ty - u.y,
        dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.5) {
        u.pi++;
        u.tx = pt.x;
        u.ty = pt.y;
      } else {
        const spd = u.spd * TS;
        u.x += (dx / dist) * spd * dt;
        u.y += (dy / dist) * spd * dt;
        u.state = "move";
      }
    } else if (u.target) {
      const sx = Math.floor(u.x / TS),
        sy = Math.floor(u.y / TS);
      let ex, ey;
      if (u.target.tx !== undefined) {
        ex = u.target.tx;
        ey = u.target.ty;
      } else {
        ex = Math.floor(u.target.x / TS);
        ey = Math.floor(u.target.y / TS);
      }
      const path = astar(sx, sy, ex, ey);
      if (path) {
        u.path = path;
        u.pi = 0;
      } else u.state = "idle";
    } else u.state = "idle";
  }
}
function recalcPop(o) {
  o.maxPop = 10;
  for (const b of o.buildings) o.maxPop += BCFG[b.type].maxPop || 0;
}
function updateTowers(owner, enemy, dt) {
  for (const b of owner.buildings) {
    if (b.type !== "tower") continue;
    b.atkT = Math.max(0, (b.atkT || 0) - dt);
    if (b.atkT > 0) continue;
    const cfg = BCFG.tower;
    const bx = (b.tx + 0.5) * TS,
      by = (b.ty + 1) * TS;
    let best = null,
      bd = Infinity;
    for (const u of enemy.units) {
      const d = Math.sqrt((u.x - bx) ** 2 + (u.y - by) ** 2);
      if (d <= cfg.range * TS && d < bd) {
        bd = d;
        best = u;
      }
    }
    if (best) {
      best.hp -= cfg.dmg;
      b.atkT = 1.5;
      continue;
    }
    for (const eb of enemy.buildings) {
      const ex2 = (eb.tx + BCFG[eb.type].w / 2) * TS,
        ey2 = (eb.ty + BCFG[eb.type].h / 2) * TS;
      const d = Math.sqrt((ex2 - bx) ** 2 + (ey2 - by) ** 2);
      if (d <= cfg.range * TS * 0.6 && d < bd) {
        bd = d;
        best = eb;
      }
    }
    if (best) {
      best.hp -= cfg.dmg * 0.5;
      b.atkT = 2;
      if (best.hp <= 0) {
        const i = enemy.buildings.indexOf(best);
        if (i >= 0) {
          enemy.buildings.splice(i, 1);
          recalcPop(enemy);
        }
      }
    }
  }
}

// ================================================================
//  RENDER
// ================================================================
function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const theme = THEMES[curMapTheme] || THEMES.mesopotamia;
  // Apply camera transform
  ctx.save();
  ctx.setTransform(
    cam.zoom,
    0,
    0,
    cam.zoom,
    -cam.x * cam.zoom,
    -cam.y * cam.zoom,
  );

  // World bounds visible
  const wx0 = cam.x,
    wy0 = cam.y;
  const wx1 = cam.x + cv.width / cam.zoom,
    wy1 = cam.y + cv.height / cam.zoom;
  const tx0 = Math.max(0, Math.floor(wx0 / TS) - 1),
    ty0 = Math.max(0, Math.floor(wy0 / TS) - 1);
  const tx1 = Math.min(MW, Math.ceil(wx1 / TS) + 1),
    ty1 = Math.min(MH, Math.ceil(wy1 / TS) + 1);

  // Tiles
  for (let y = ty0; y < ty1; y++)
    for (let x = tx0; x < tx1; x++) {
      ctx.fillStyle = theme[map2d[y][x]] || "#3a6830";
      ctx.fillRect(x * TS, y * TS, TS, TS);
    }
  // Grid (only when zoomed in enough)
  if (cam.zoom > 0.6) {
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 0.4;
    for (let y = ty0; y < ty1; y++)
      for (let x = tx0; x < tx1; x++) ctx.strokeRect(x * TS, y * TS, TS, TS);
  }

  // Hover tile
  if (hovTile.x >= 0 && hovTile.y >= 0 && tool !== "pan") {
    ctx.fillStyle =
      tool === "build"
        ? "rgba(255,200,0,.2)"
        : tool === "move"
          ? "rgba(0,140,255,.2)"
          : "rgba(255,255,255,.08)";
    ctx.fillRect(hovTile.x * TS, hovTile.y * TS, TS, TS);
  }
  // Build ghost
  if (tool === "build" && buildType && hovTile.x >= 0) {
    const c = BCFG[buildType];
    const ok = canPlace(P, hovTile.x, hovTile.y, c.w, c.h, buildType);
    ctx.fillStyle = ok ? "rgba(0,220,80,.25)" : "rgba(220,30,30,.25)";
    ctx.fillRect(hovTile.x * TS, hovTile.y * TS, c.w * TS, c.h * TS);
    ctx.strokeStyle = ok ? "#00e850" : "#e82020";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      hovTile.x * TS + 0.5,
      hovTile.y * TS + 0.5,
      c.w * TS - 1,
      c.h * TS - 1,
    );
  }
  // Selection box drag
  if (selDrag && selBox) {
    const { sx, sy, ex, ey } = selBox;
    const wx = Math.min(sx, ex) / cam.zoom + cam.x,
      wy = Math.min(sy, ey) / cam.zoom + cam.y;
    const ww = Math.abs(ex - sx) / cam.zoom,
      wh = Math.abs(ey - sy) / cam.zoom;
    ctx.strokeStyle = "rgba(0,200,255,.8)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.fillStyle = "rgba(0,200,255,.06)";
    ctx.fillRect(wx, wy, ww, wh);
    ctx.setLineDash([]);
  }
  // Path lines
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(0,180,255,.4)";
  ctx.lineWidth = 1;
  for (const u of selUnits) {
    if (!u.path || u.pi >= u.path.length) continue;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    for (let i = u.pi; i < u.path.length; i++)
      ctx.lineTo((u.path[i].x + 0.5) * TS, (u.path[i].y + 0.5) * TS);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings
  drawBuildings(P.buildings, true);
  drawBuildings(B.buildings, false);
  // Units
  drawUnits(P.units, true);
  drawUnits(B.units, false);

  ctx.restore();

  // Minimap
  renderMinimap();
}

function drawBuildings(blds, isP) {
  for (const b of blds) {
    const c = BCFG[b.type];
    const px = b.tx * TS,
      py = b.ty * TS,
      pw = c.w * TS,
      ph = c.h * TS;
    const dr = b.hp / b.maxHp;
    // Background
    ctx.fillStyle = isP ? "#0e1e0e" : "#1e0808";
    ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.strokeStyle = isP
      ? dr > 0.5
        ? "#3a7a3a"
        : "#7a4a2a"
      : dr > 0.5
        ? "#7a2a2a"
        : "#7a5a2a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    // Bridge special render: draw a tan plank over the tile
    if (b.type === "bridge") {
      ctx.fillStyle = isP ? "#8b6914" : "#6b4910";
      ctx.fillRect(px + 2, py + 6, pw - 4, ph - 12);
      ctx.fillStyle = "#c8a050";
      for (let plank = 0; plank < 3; plank++) {
        ctx.fillRect(
          px + 2 + (plank * (pw - 4)) / 3,
          py + 6,
          Math.max(2, (pw - 8) / 3),
          ph - 12,
        );
      }
      ctx.fillStyle = "#111";
      ctx.fillRect(px + 1, py + ph - 3, pw - 2, 3);
      ctx.fillStyle = "#8b6914";
      ctx.fillRect(px + 1, py + ph - 3, (pw - 2) * dr, 3);
      continue;
    }
    // Icon — use emoji font, scale to building size
    const iconSize = Math.max(10, Math.min(pw, ph) * 0.55);
    ctx.font = `${iconSize}px "Segoe UI Emoji","Apple Color Emoji",serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.icon, px + pw / 2, py + ph / 2);
    // HP bar
    ctx.fillStyle = "#111";
    ctx.fillRect(px + 1, py + ph - 3, pw - 2, 3);
    ctx.fillStyle = dr > 0.6 ? "#3a8a3a" : dr > 0.3 ? "#8a8a3a" : "#8a3a3a";
    ctx.fillRect(px + 1, py + ph - 3, (pw - 2) * dr, 3);
  }
}
function drawUnits(units, isP) {
  for (const u of units) {
    if (u.hp <= 0) continue;
    const c = UCFG[u.type];
    const col = isP ? c.col : c.ecol;
    if (u.selected) {
      ctx.strokeStyle = "#00d8ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 9.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(u.x + 1, u.y + 2, 5.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isP ? "#70e070" : "#e07070";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 6.5, 0, Math.PI * 2);
    ctx.stroke();
    // Icon — emoji font for reliable rendering
    ctx.font = '10px "Segoe UI Emoji","Apple Color Emoji",serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.icon, u.x, u.y);
    // Level stars
    if (u.level > 1) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("★".repeat(u.level - 1), u.x, u.y - 14);
    }
    // HP bar
    const hr = u.hp / u.maxHp;
    ctx.fillStyle = "#111";
    ctx.fillRect(u.x - 7, u.y - 12, 14, 2);
    ctx.fillStyle = hr > 0.5 ? "#40d040" : hr > 0.25 ? "#d0d040" : "#d04040";
    ctx.fillRect(u.x - 7, u.y - 12, 14 * hr, 2);
    // Attack indicator
    if (u.state === "atk") {
      ctx.font = '8px "Segoe UI Emoji",serif';
      ctx.fillText("⚔️", u.x, u.y - 18);
    }
  }
}
function renderMinimap() {
  const mw = mmcv.width,
    mh = mmcv.height;
  mmctx.clearRect(0, 0, mw, mh);
  const theme = THEMES[curMapTheme] || THEMES.mesopotamia;

  // Use ImageData pixel writing for the terrain — fast even for 500×500 maps
  const imgd = mmctx.createImageData(mw, mh);
  const pix  = imgd.data;
  const rgb  = _buildTilePixels(theme);
  const tw = mw / MW, th = mh / MH;

  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const tileType = map2d[y][x];
      const [r, g, b] = rgb[tileType] || [58, 104, 48];
      // Fill the minimap pixels that correspond to this tile
      const px0 = Math.floor(x * tw), px1 = Math.floor((x + 1) * tw);
      const py0 = Math.floor(y * th), py1 = Math.floor((y + 1) * th);
      for (let py = py0; py < py1; py++) {
        for (let px = px0; px < px1; px++) {
          const idx = (py * mw + px) * 4;
          pix[idx]     = r;
          pix[idx + 1] = g;
          pix[idx + 2] = b;
          pix[idx + 3] = 255;
        }
      }
    }
  }
  mmctx.putImageData(imgd, 0, 0);

  // Entities
  const tw2 = mw / MW, th2 = mh / MH;
  mmctx.fillStyle = "#40e040";
  for (const b of P.buildings) mmctx.fillRect(b.tx * tw2, b.ty * th2, Math.max(2,tw2*2), Math.max(2,th2*2));
  mmctx.fillStyle = "#a0ffa0";
  for (const u of P.units)
    mmctx.fillRect(
      (u.x / (MW * TS)) * mw - 1,
      (u.y / (MH * TS)) * mh - 1,
      2.5, 2.5,
    );
  mmctx.fillStyle = "#e04040";
  for (const b of B.buildings) mmctx.fillRect(b.tx * tw2, b.ty * th2, Math.max(2,tw2*2), Math.max(2,th2*2));
  mmctx.fillStyle = "#ffa0a0";
  for (const u of B.units)
    mmctx.fillRect(
      (u.x / (MW * TS)) * mw - 1,
      (u.y / (MH * TS)) * mh - 1,
      2.5, 2.5,
    );
  // Viewport rect
  const vx = (cam.x / (MW * TS)) * mw,
    vy = (cam.y / (MH * TS)) * mh;
  const vw = (cv.width / cam.zoom / (MW * TS)) * mw,
    vh = (cv.height / cam.zoom / (MH * TS)) * mh;
  mmctx.strokeStyle = "rgba(255,255,200,.7)";
  mmctx.lineWidth = 1;
  mmctx.strokeRect(
    Math.max(0, vx), Math.max(0, vy),
    Math.min(mw, vw), Math.min(mh, vh),
  );
}

// ================================================================
//  INPUT
// ================================================================
function initInput() {
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      camZoomSmoothAt(
        { x: e.offsetX, y: e.offsetY },
        e.deltaY < 0 ? 0.15 : -0.15,
      );
    },
    { passive: false },
  );
  cv.addEventListener("mousedown", onCvDown);
  cv.addEventListener("mousemove", onCvMove);
  cv.addEventListener("mouseup", onCvUp);
  cv.addEventListener("mouseleave", () => {
    document.getElementById("tooltip").style.display = "none";
    hovTile = { x: -1, y: -1 };
  });
  cv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    cancelMode();
  });
  mmcv.addEventListener("click", onMiniClick);
  document.addEventListener("keydown", onKey);

  // ---- Touch support ----
  let lastTouchDist = 0,
    lastTouchX = 0,
    lastTouchY = 0,
    touchPan = false;
  cv.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        touchPan = false;
      } else if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        touchPan = true;
        panDrag = { sx: lastTouchX, sy: lastTouchY, cx: cam.x, cy: cam.y };
      }
    },
    { passive: false },
  );
  cv.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const delta = (d - lastTouchDist) * 0.007;
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = cv.getBoundingClientRect();
        camZoomSmoothAt({ x: mx - rect.left, y: my - rect.top }, delta);
        lastTouchDist = d;
      } else if (e.touches.length === 1 && panDrag) {
        const sx = e.touches[0].clientX,
          sy = e.touches[0].clientY;
        cam.x = panDrag.cx - (sx - panDrag.sx) / cam.zoom;
        cam.y = panDrag.cy - (sy - panDrag.sy) / cam.zoom;
        clampCam();
      }
    },
    { passive: false },
  );
  cv.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 0) {
        const wasPan =
          panDrag &&
          (Math.abs(cam.x - (panDrag ? panDrag.cx : cam.x)) > 2 ||
            Math.abs(cam.y - (panDrag ? panDrag.cy : cam.y)) > 2);
        panDrag = null;
        if (!wasPan && e.changedTouches.length === 1) {
          const rect = cv.getBoundingClientRect();
          const sx = e.changedTouches[0].clientX - rect.left;
          const sy = e.changedTouches[0].clientY - rect.top;
          const w = screenToWorld(sx, sy);
          if (tool === "build" && buildType)
            tryPlace(Math.floor(w.x / TS), Math.floor(w.y / TS));
          else if (tool === "move" && selUnits.length > 0)
            moveUnitsTo(selUnits, Math.floor(w.x / TS), Math.floor(w.y / TS));
          else onSingleClick({ shiftKey: false, offsetX: sx, offsetY: sy }, w);
        }
      }
    },
    { passive: false },
  );
}
function onCvDown(e) {
  const sx = e.offsetX,
    sy = e.offsetY;
  if (tool === "pan" || e.button === 1 || (e.button === 0 && e.altKey)) {
    panDrag = { sx, sy, cx: cam.x, cy: cam.y };
    e.preventDefault();
    return;
  }
  if (e.button === 2) {
    cancelMode();
    return;
  }
  if (tool === "build" && buildType) {
    const w = screenToWorld(sx, sy);
    tryPlace(Math.floor(w.x / TS), Math.floor(w.y / TS));
    return;
  }
  if (tool === "move") {
    const w = screenToWorld(sx, sy);
    if (selUnits.length > 0)
      moveUnitsTo(selUnits, Math.floor(w.x / TS), Math.floor(w.y / TS));
    return;
  }
  if (tool === "select") {
    selDrag = { sx, sy };
    selBox = null;
  }
}
function onCvMove(e) {
  const sx = e.offsetX,
    sy = e.offsetY;
  // Pan drag
  if (panDrag) {
    cam.x = panDrag.cx - (sx - panDrag.sx) / cam.zoom;
    cam.y = panDrag.cy - (sy - panDrag.sy) / cam.zoom;
    clampCam();
    return;
  }
  // Select drag
  if (selDrag) {
    selBox = { sx: selDrag.sx, sy: selDrag.sy, ex: sx, ey: sy };
  }
  // Hover tile
  const w = screenToWorld(sx, sy);
  hovTile = { x: Math.floor(w.x / TS), y: Math.floor(w.y / TS) };
  // Tooltip
  updateTooltip(e, w);
}
function onCvUp(e) {
  if (panDrag) {
    panDrag = null;
    return;
  }
  if (selDrag && selBox) {
    const dx = Math.abs(selBox.ex - selBox.sx),
      dy = Math.abs(selBox.ey - selBox.sy);
    if (dx > 6 || dy > 6) {
      // Box select
      const wx1 = Math.min(selBox.sx, ex) / cam.zoom + cam.x;
      const wy1 = Math.min(selBox.sy, ey) / cam.zoom + cam.y;
      const wx2 = Math.max(selBox.sx, ex) / cam.zoom + cam.x;
      const wy2 = Math.max(selBox.sy, ey) / cam.zoom + cam.y;
      if (!e.shiftKey) P.units.forEach((u) => (u.selected = false));
      for (const u of P.units) {
        if (u.x >= wx1 && u.x <= wx2 && u.y >= wy1 && u.y <= wy2)
          u.selected = true;
      }
      selUnits = P.units.filter((u) => u.selected);
      if (selUnits.length) notify(`تم تحديد ${selUnits.length} وحدة`);
    } else {
      // Single click
      const w = screenToWorld(e.offsetX, e.offsetY);
      onSingleClick(e, w);
    }
    selDrag = null;
    selBox = null;
    return;
  }
  selDrag = null;
  selBox = null;
}
function onSingleClick(e, w) {
  const tx = Math.floor(w.x / TS),
    ty = Math.floor(w.y / TS);
  let hitUnit = null;
  for (const u of P.units) {
    if (Math.sqrt((u.x - w.x) ** 2 + (u.y - w.y) ** 2) < 10) {
      hitUnit = u;
      break;
    }
  }
  if (hitUnit) {
    if (!e.shiftKey) {
      P.units.forEach((u) => (u.selected = false));
      selUnits = [];
    }
    hitUnit.selected = !hitUnit.selected;
    selUnits = P.units.filter((u) => u.selected);
    showUnitInfo(hitUnit);
    return;
  }
  if (!e.shiftKey) {
    P.units.forEach((u) => (u.selected = false));
    selUnits = [];
  }
  for (const b of [...P.buildings, ...B.buildings]) {
    const c = BCFG[b.type];
    if (tx >= b.tx && tx < b.tx + c.w && ty >= b.ty && ty < b.ty + c.h) {
      showBldgInfo(b);
      return;
    }
  }
  document.getElementById("info-box").textContent =
    "انقر على وحدة أو مبنى لعرض معلوماتها";
}
function onMiniClick(e) {
  const r = mmcv.getBoundingClientRect();
  const mx = ((e.clientX - r.left) / mmcv.width) * (MW * TS);
  const my = ((e.clientY - r.top) / mmcv.height) * (MH * TS);
  cam.x = mx - cv.width / cam.zoom / 2;
  cam.y = my - cv.height / cam.zoom / 2;
  clampCam();
}
function onKey(e) {
  if (
    !running ||
    document.getElementById("guide-modal").style.display !== "none"
  )
    return;
  if (e.key === "Escape") cancelMode();
  if (e.key.toLowerCase() === "m") setTool("move");
  if (e.key.toLowerCase() === "a") {
    e.preventDefault();
    selectAll();
  }
  if (e.key === "=" || e.key === "+") camZoomSmoothAt(null, 0.2);
  if (e.key === "-") camZoomSmoothAt(null, -0.2);
}
function updateTooltip(e, w) {
  const tip = document.getElementById("tooltip");
  let txt = "",
    sub = "";
  // Check units
  for (const u of [...P.units, ...B.units]) {
    if (Math.sqrt((u.x - w.x) ** 2 + (u.y - w.y) ** 2) < 12) {
      const c = UCFG[u.type];
      txt = `${c.icon} ${c.label} (${u.side === "player" ? "أنت" : "عدو"})`;
      sub = `❤️${Math.floor(u.hp)}/${u.maxHp} ⚔️${u.atk} 🛡️${u.def} ⭐Lv${u.level}`;
      break;
    }
  }
  if (!txt) {
    const tx = Math.floor(w.x / TS),
      ty = Math.floor(w.y / TS);
    for (const b of [...P.buildings, ...B.buildings]) {
      const c = BCFG[b.type];
      if (tx >= b.tx && tx < b.tx + c.w && ty >= b.ty && ty < b.ty + c.h) {
        txt = `${c.icon} ${c.label} (${b.side === "player" ? "قاعدتك" : "عدو"})`;
        sub = `❤️${Math.floor(b.hp)}/${b.maxHp}`;
        break;
      }
    }
  }
  if (!txt) {
    const tx = Math.floor(w.x / TS),
      ty = Math.floor(w.y / TS);
    if (tx >= 0 && tx < MW && ty >= 0 && ty < MH) {
      txt = TILE_NAME[map2d[ty][tx]] || "";
      sub = TILE_RES[map2d[ty][tx]] || "";
    }
  }
  if (txt) {
    tip.innerHTML = `<b>${txt}</b>${sub ? `<br><span style="font-size:10px;color:#607060">${sub}</span>` : ""}`;
    tip.style.left = e.clientX + 14 + "px";
    tip.style.top = e.clientY + 14 + "px";
    tip.style.display = "block";
  } else tip.style.display = "none";
}

// ================================================================
//  TOOLS & MODE
// ================================================================
function setTool(t) {
  tool = t;
  if (t !== "build") {
    buildType = null;
    document
      .querySelectorAll(".sb-btn")
      .forEach((b) => b.classList.remove("sel-on"));
  }
  setToolUI(t);
  if (t === "move" && selUnits.length === 0) selectAll();
}
function setToolUI(t) {
  ["sel", "pan", "mov"].forEach((id) => {
    const el = document.getElementById("tb-" + id);
    if (el)
      el.classList.toggle(
        "active",
        (id === "sel" && (t === "select" || t === "build")) ||
          (id === "pan" && t === "pan") ||
          (id === "mov" && t === "move"),
      );
  });
  document.getElementById("btn-move").classList.toggle("on", t === "move");
  const wrap = document.getElementById("cv-wrap");
  wrap.style.cursor =
    t === "pan"
      ? "grab"
      : t === "build"
        ? "crosshair"
        : t === "move"
          ? "cell"
          : "default";
}
function cancelMode() {
  setTool("select");
  selUnits = [];
  P.units.forEach((u) => (u.selected = false));
  selBox = null;
  selDrag = null;
}
function selectAll() {
  P.units.forEach((u) => (u.selected = true));
  selUnits = [...P.units];
  if (selUnits.length) notify(`☰ تم تحديد ${selUnits.length} وحدة`);
  else notify("لا توجد وحدات بعد! أنشئ منازل لتوليد الجنود.");
}
function selBuild(type) {
  buildType = type;
  tool = "build";
  document
    .querySelectorAll(".sb-btn")
    .forEach((b) => b.classList.remove("sel-on"));
  const c = BCFG[type];
  notify(`🏗️ انقر لإنشاء ${c.label} | ${fmtCost(c.cost)}`);
  setToolUI("build");
}
function orderAttack() {
  const targets = [...B.units, ...B.buildings];
  if (!targets.length) {
    notify("لا يوجد أعداء!");
    return;
  }
  const units = selUnits.length > 0 ? selUnits : P.units;
  for (const u of units) {
    let best = null,
      bd = Infinity;
    for (const t of targets) {
      const d = d2(u, t);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (best) {
      u.target = best;
      u.path = null;
    }
  }
  notify(`⚔️ الهجوم! ${units.length} وحدة تتقدم للمعركة`);
}
function moveUnitsTo(units, tx, ty) {
  const sp = Math.ceil(Math.sqrt(units.length));
  units.forEach((u, i) => {
    const ox = (i % sp) - Math.floor(sp / 2),
      oy = Math.floor(i / sp) - Math.floor(sp / 2);
    const dx = Math.max(0, Math.min(MW - 1, tx + ox)),
      dy = Math.max(0, Math.min(MH - 1, ty + oy));
    const path = astar(Math.floor(u.x / TS), Math.floor(u.y / TS), dx, dy);
    if (path) {
      u.path = path;
      u.pi = 0;
      u.state = "move";
      u.target = null;
    }
  });
  notify(`🚶 تحريك ${units.length} وحدة إلى الهدف`);
}

// ================================================================
//  BUILDING PLACEMENT
// ================================================================
function canPlace(owner, tx, ty, w, h, type) {
  if (tx < 0 || ty < 0 || tx + w > MW || ty + h > MH) return false;
  const isBridge = type === "bridge";
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      const tile = map2d[ty + dy][tx + dx];
      if (isBridge) {
        // Bridge can only be placed on non-walkable tiles (water, mountain, rock, ice)
        if (WALK[tile]) return false;
      } else {
        if (!WALK[tile]) return false;
      }
    }
  for (const b of [...P.buildings, ...B.buildings]) {
    const c = BCFG[b.type];
    if (tx < b.tx + c.w && tx + w > b.tx && ty < b.ty + c.h && ty + h > b.ty)
      return false;
  }
  return true;
}
function afford(o, cost) {
  if (!cost) return true;
  return (
    o.gold >= (cost.gold || 0) &&
    o.stone >= (cost.stone || 0) &&
    o.water >= (cost.water || 0) &&
    o.metal >= (cost.metal || 0)
  );
}
function spend(o, cost) {
  if (!cost) return;
  o.gold -= cost.gold || 0;
  o.stone -= cost.stone || 0;
  o.water -= cost.water || 0;
  o.metal -= cost.metal || 0;
}
function fmtCost(cost) {
  const p = [];
  if (cost.gold) p.push(`🟡${cost.gold}`);
  if (cost.stone) p.push(`🧱${cost.stone}`);
  if (cost.water) p.push(`💧${cost.water}`);
  if (cost.metal) p.push(`⚙️${cost.metal}`);
  return p.join(" ") || "مجاني";
}
function tryPlace(tx, ty) {
  const c = BCFG[buildType];
  if (!afford(P, c.cost)) {
    notify("❌ موارد غير كافية! " + fmtCost(c.cost));
    return;
  }
  if (!canPlace(P, tx, ty, c.w, c.h, buildType)) {
    notify("❌ لا يمكن البناء هنا!");
    return;
  }
  spend(P, c.cost);
  placeBuilding(P, buildType, tx, ty);
  notify(`✅ تم إنشاء ${c.label}!`);
  // Track achievement
  achievements.buildingsBuilt++;
  if (buildType === "bridge") achievements.bridgesBuilt++;
  saveAchievements();
  checkAchievements();
}
function trainU(type) {
  const c = UCFG[type];
  if (!afford(P, c.cost)) {
    notify("❌ موارد غير كافية! " + fmtCost(c.cost));
    return;
  }
  if (P.pop >= P.maxPop) {
    notify("❌ وصلت للحد الأقصى! أنشئ منازل لزيادة سعة الجيش.");
    return;
  }
  if (!P.buildings.find((b) => b.type === "barracks")) {
    notify("❌ تحتاج إلى ثكنة عسكرية أولاً!");
    return;
  }
  spend(P, c.cost);
  const bar = P.buildings.find((b) => b.type === "barracks");
  spawnUnit(P, type, bar.tx + 2, bar.ty + 1);
  notify(`✅ تم تدريب ${c.label}!`);
}

// ================================================================
//  UI HELPERS
// ================================================================
function updateUI() {
  document.getElementById("r-gold").textContent = Math.floor(P.gold);
  document.getElementById("r-stone").textContent = Math.floor(P.stone);
  document.getElementById("r-water").textContent = Math.floor(P.water);
  document.getElementById("r-metal").textContent = Math.floor(P.metal);
  document.getElementById("r-pop").textContent = `${P.pop}/${P.maxPop}`;
  // Track achievements
  if (P.pop > achievements.maxSoldiers) {
    achievements.maxSoldiers = P.pop;
    checkAchievements();
  }
}
function showUnitInfo(u) {
  const c = UCFG[u.type];
  document.getElementById("info-box").innerHTML =
    `<b>${c.icon} ${c.label} ${"⭐".repeat(u.level - 1)}</b><br>
    ❤️ صحة: ${Math.floor(u.hp)}/${u.maxHp}<br>
    ⚔️ هجوم: ${u.atk} | 🛡️ دفاع: ${u.def}<br>
    🎯 مدى: ${u.rng.toFixed(1)} | ⚡ سرعة: ${u.spd}<br>
    🏅 انتصارات: ${u.kills} | مستوى: ${u.level}<br>
    <span style="color:#406040;font-size:10px;">${c.desc}</span>`;
}
function showBldgInfo(b) {
  const c = BCFG[b.type];
  document.getElementById("info-box").innerHTML =
    `<b>${c.icon} ${c.label}</b> (${b.side === "player" ? "قاعدتك" : "للعدو"})<br>
    ❤️ صحة: ${Math.floor(b.hp)}/${b.maxHp}<br>
    <span style="color:#406040;font-size:10px;">${c.desc}</span>`;
}
function setStatus(msg) {
  document.getElementById("status-txt").textContent = msg;
}
function notify(msg) {
  const el = document.getElementById("notif");
  el.textContent = msg;
  el.style.opacity = "1";
  notifTimer = 3.5;
}

// ================================================================
//  GAME FLOW
// ================================================================
function endGame(won) {
  gameover = true;
  if (won) {
    achievements.mapsWon++;
    saveAchievements();
    checkAchievements();
  }
  setTimeout(() => {
    if (won) {
      const mdef = MAPS_DEF[curMapIdx];
      document.getElementById("win-msg").textContent =
        `لقد فتحت ${mdef.name}! ${curMapIdx < MAPS_DEF.length - 1 ? "استعد للخريطة التالية!" : "أنت بطل الإمبراطورية!"}`;
      document.getElementById("ovl-win").style.display = "flex";
    } else {
      document.getElementById("ovl-lose").style.display = "flex";
    }
  }, 600);
}
function nextMap() {
  document.getElementById("ovl-win").style.display = "none";
  const next = (curMapIdx + 1) % MAPS_DEF.length;
  running = true;
  setupMap(next, curDiff);
}
function restartMap() {
  document.getElementById("ovl-win").style.display = "none";
  document.getElementById("ovl-lose").style.display = "none";
  running = true;
  gameover = false;
  setupMap(curMapIdx, curDiff);
}
function backToMenu() {
  running = false;
  gameover = false;
  document.getElementById("ovl-win").style.display = "none";
  document.getElementById("ovl-lose").style.display = "none";
  document.getElementById("scr-game").style.display = "none";
  document.getElementById("scr-start").style.display = "flex";
}
function resizeCanvas() {
  const wrap = document.getElementById("cv-wrap");
  cv.width = wrap.clientWidth;
  cv.height = wrap.clientHeight;
}

// ================================================================
//  START SCREEN
// ================================================================
function selDiff(d) {
  selDiff_ = d;
  document
    .querySelectorAll(".diff-btn")
    .forEach((b) => b.classList.remove("sel"));
  const map = { easy: "easy", medium: "med", hard: "hard" };
  document.querySelector(".diff-btn." + map[d])?.classList.add("sel");
}
function selectMap(idx) {
  selMapIdx = idx;
  document
    .querySelectorAll(".map-card")
    .forEach((c, i) => c.classList.toggle("selected", i === idx));
}
function startGame() {
  document.getElementById("scr-start").style.display = "none";
  const g = document.getElementById("scr-game");
  g.style.display = "flex";
  setTimeout(() => {
    initCanvas();
    running = true;
    setupMap(selMapIdx, selDiff_);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }, 50);
}
function initCanvas() {
  cv = document.getElementById("cv");
  ctx = cv.getContext("2d");
  mmcv = document.getElementById("minimap-cv");
  mmctx = mmcv.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", () => {
    resizeCanvas();
    clampCam();
  });
  initInput();
}
function buildStartScreen() {
  const grid = document.getElementById("maps-grid");
  grid.innerHTML = "";
  MAPS_DEF.forEach((m, i) => {
    const card = document.createElement("div");
    card.className = "map-card" + (i === 0 ? " selected" : "");
    card.onclick = () => selectMap(i);
    const cvEl = document.createElement("canvas");
    cvEl.width = 160;
    cvEl.height = 88;
    renderMapPreview(cvEl, m);
    const badge = document.createElement("div");
    badge.className = "map-card-badge";
    badge.textContent = m.region;
    const info = document.createElement("div");
    info.className = "map-card-info";
    info.innerHTML = `<div class="map-card-name">${m.name}</div>
      <div class="map-card-en">${m.en}</div>
      <div class="map-card-desc">${m.desc}</div>`;
    // Delete button for custom maps
    if (m._custom) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.title = "حذف الخريطة";
      delBtn.style.cssText =
        "position:absolute;top:4px;left:4px;background:#600;color:#fff;border:none;" +
        "border-radius:3px;cursor:pointer;font-size:12px;padding:2px 5px;z-index:10;";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (!confirm(`حذف الخريطة "${m.name}"؟`)) return;
        removeCustomMap(m.id);
        buildStartScreen();
      };
      card.style.position = "relative";
      card.appendChild(delBtn);
    }
    card.appendChild(cvEl);
    card.appendChild(badge);
    card.appendChild(info);
    grid.appendChild(card);
  });

  // "Add Map" button
  const addCard = document.createElement("div");
  addCard.className = "map-card add-map-card";
  addCard.style.cssText =
    "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "cursor:pointer;border:2px dashed #555;min-height:140px;";
  addCard.innerHTML =
    `<div style="font-size:32px;margin-bottom:8px;">➕</div>
     <div style="color:#aaa;font-size:13px;">استيراد خريطة</div>`;
  addCard.onclick = () => openImportModal();
  grid.appendChild(addCard);
}

function renderMapPreview(cvEl, mdef) {
  const ctx2 = cvEl.getContext("2d");

  // Determine data & dimensions without disturbing global MW/MH
  let data, mapW, mapH;
  if (mdef.data) {
    data  = mdef.data;
    mapH  = data.length;
    mapW  = data[0] ? data[0].length : 64;
  } else {
    const savedMW = MW, savedMH = MH;
    MW = 64; MH = 48;
    data  = mdef.gen();
    MW    = savedMW;
    MH    = savedMH;
    mapW  = 64;
    mapH  = 48;
  }

  const theme = THEMES[mdef.theme] || THEMES.mesopotamia;
  const rgb   = _buildTilePixels(theme);
  const cw = cvEl.width, ch = cvEl.height;
  const imgd  = ctx2.createImageData(cw, ch);
  const pix   = imgd.data;

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const tileType = data[y][x];
      const [r, g, b] = rgb[tileType] || [58, 104, 48];
      const px0 = Math.floor((x / mapW) * cw);
      const px1 = Math.floor(((x + 1) / mapW) * cw);
      const py0 = Math.floor((y / mapH) * ch);
      const py1 = Math.floor(((y + 1) / mapH) * ch);
      for (let py = py0; py < py1; py++) {
        for (let px = px0; px < px1; px++) {
          const idx = (py * cw + px) * 4;
          pix[idx] = r; pix[idx+1] = g; pix[idx+2] = b; pix[idx+3] = 255;
        }
      }
    }
  }
  ctx2.putImageData(imgd, 0, 0);

  // Mark bases
  const pp = mdef.playerPos, ep = mdef.enemyPos;
  const tw = cw / mapW, th = ch / mapH;
  ctx2.fillStyle = "#40ff40";
  ctx2.fillRect(pp.tx * tw, pp.ty * th, Math.max(4, tw*2), Math.max(4, th*2));
  ctx2.fillStyle = "#ff4040";
  ctx2.fillRect(ep.tx * tw, ep.ty * th, Math.max(4, tw*2), Math.max(4, th*2));
}

// ================================================================
//  MAP IMPORT MODAL
// ================================================================
function openImportModal() {
  let modal = document.getElementById("import-map-modal");
  if (!modal) modal = _createImportModal();
  modal.style.display = "flex";
  document.getElementById("import-json-area").value = "";
  document.getElementById("import-status").textContent = "";
}
function closeImportModal() {
  const m = document.getElementById("import-map-modal");
  if (m) m.style.display = "none";
}

function _createImportModal() {
  const modal = document.createElement("div");
  modal.id = "import-map-modal";
  modal.style.cssText =
    "display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.75);" +
    "align-items:center;justify-content:center;";
  modal.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #444;border-radius:8px;padding:28px;
                width:min(580px,94vw);max-height:90vh;overflow-y:auto;direction:rtl;">
      <h2 style="margin:0 0 18px;color:#ddd;">📥 استيراد خريطة JSON</h2>

      <p style="color:#aaa;font-size:13px;margin-bottom:14px;">
        الصق كود JSON الناتج من <b>محرر الخرائط</b>، أو ارفع ملف <code>.json</code>.
        تدعم الخرائط أي حجم (64×48 حتى 500×500+).
      </p>

      <!-- File upload -->
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
                    background:#292929;border:1px dashed #555;border-radius:6px;
                    padding:12px 16px;margin-bottom:14px;">
        <span style="font-size:22px;">📂</span>
        <span style="color:#aaa;font-size:13px;">رفع ملف .json</span>
        <input type="file" id="import-file-input" accept=".json,application/json"
               style="display:none;" onchange="handleImportFile(event)">
      </label>

      <!-- Paste area -->
      <div style="color:#888;font-size:12px;margin-bottom:6px;">أو الصق الكود مباشرة:</div>
      <textarea id="import-json-area"
        style="width:100%;box-sizing:border-box;height:180px;background:#111;color:#0f0;
               font-family:monospace;font-size:11px;border:1px solid #333;border-radius:4px;
               padding:8px;resize:vertical;direction:ltr;" placeholder='{"name":"...","data":[[0,1,...],...]}'></textarea>

      <div id="import-status" style="min-height:22px;font-size:13px;margin:10px 0;color:#f88;"></div>

      <div style="display:flex;gap:10px;">
        <button onclick="doImportMap()"
          style="flex:1;padding:11px;background:#286028;color:#fff;border:none;
                 border-radius:5px;cursor:pointer;font-size:14px;">
          ✅ استيراد
        </button>
        <button onclick="closeImportModal()"
          style="flex:1;padding:11px;background:#444;color:#fff;border:none;
                 border-radius:5px;cursor:pointer;font-size:14px;">
          إلغاء
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  // Close on backdrop click
  modal.addEventListener("click", e => { if (e.target === modal) closeImportModal(); });
  return modal;
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById("import-json-area").value = ev.target.result;
    document.getElementById("import-status").textContent = `📄 تم تحميل الملف: ${file.name}`;
    document.getElementById("import-status").style.color = "#8f8";
  };
  reader.onerror = () => {
    document.getElementById("import-status").textContent = "❌ فشل قراءة الملف";
  };
  reader.readAsText(file);
  // Reset so same file can be re-uploaded
  e.target.value = "";
}

function doImportMap() {
  const statusEl = document.getElementById("import-status");
  const raw = document.getElementById("import-json-area").value.trim();
  if (!raw) {
    statusEl.style.color = "#f88";
    statusEl.textContent = "❌ الحقل فارغ — الصق JSON أو ارفع ملفاً";
    return;
  }
  let obj;
  try { obj = JSON.parse(raw); }
  catch(e) {
    statusEl.style.color = "#f88";
    statusEl.textContent = "❌ JSON غير صالح: " + e.message;
    return;
  }
  const result = importMapFromObject(obj);
  if (!result.ok) {
    statusEl.style.color = "#f88";
    statusEl.textContent = "❌ " + result.error;
    return;
  }
  statusEl.style.color = "#8f8";
  const W = result.map.data[0].length, H = result.map.data.length;
  statusEl.textContent = `✅ تمت الإضافة: "${result.map.name}" (${W}×${H})`;
  // Rebuild start screen to show new map
  buildStartScreen();
  // Select the newly added map
  selectMap(MAPS_DEF.length - 1);
  setTimeout(closeImportModal, 1200);
}

// ================================================================
//  ACHIEVEMENTS SYSTEM — نظام الإنجازات
// ================================================================
const ACHIEVEMENTS_DEF = [
  {
    id: "first_kill",
    icon: "⚔️",
    name: "أول انتصار",
    desc: "اهزم جندياً عدواً للمرة الأولى",
    req: (u) => u.kills >= 1,
  },
  {
    id: "kills10",
    icon: "🗡️",
    name: "محارب",
    desc: "اهزم 10 جنود أعداء",
    req: (u) => u.kills >= 10,
  },
  {
    id: "kills50",
    icon: "💀",
    name: "قاتل بارد",
    desc: "اهزم 50 جندياً عدواً",
    req: (u) => u.kills >= 50,
  },
  {
    id: "soldiers10",
    icon: "🔰",
    name: "فرقة عسكرية",
    desc: "وصول إلى 10 جنود في آنٍ واحد",
    req: (u) => u.maxSoldiers >= 10,
  },
  {
    id: "soldiers20",
    icon: "🛡️",
    name: "جيش متكامل",
    desc: "وصول إلى 20 جندياً في آنٍ واحد",
    req: (u) => u.maxSoldiers >= 20,
  },
  {
    id: "build5",
    icon: "🏗️",
    name: "باني",
    desc: "ابنِ 5 مبانٍ",
    req: (u) => u.buildingsBuilt >= 5,
  },
  {
    id: "build15",
    icon: "🏙️",
    name: "مدينة ناشئة",
    desc: "ابنِ 15 مبنىً",
    req: (u) => u.buildingsBuilt >= 15,
  },
  {
    id: "win1",
    icon: "🏆",
    name: "فاتح",
    desc: "افتح أول خريطة",
    req: (u) => u.mapsWon >= 1,
  },
  {
    id: "win3",
    icon: "👑",
    name: "قائد إمبراطورية",
    desc: "افتح 3 خرائط",
    req: (u) => u.mapsWon >= 3,
  },
  {
    id: "win6",
    icon: "⭐",
    name: "إمبراطور الأزمنة",
    desc: "افتح جميع الخرائط الست",
    req: (u) => u.mapsWon >= 6,
  },
  {
    id: "bridge1",
    icon: "🌉",
    name: "مهندس الطرق",
    desc: "ابنِ أول معبر",
    req: (u) => u.bridgesBuilt >= 1,
  },
  {
    id: "level3",
    icon: "🌟",
    name: "محارب نخبة",
    desc: "رقِّ وحدة إلى المستوى 3",
    req: (u) => u.maxLevel >= 3,
  },
];

let achievements = {
  kills: 0,
  maxSoldiers: 0,
  buildingsBuilt: 0,
  mapsWon: 0,
  bridgesBuilt: 0,
  maxLevel: 1,
  unlocked: [],
};

function loadAchievements() {
  try {
    const saved = localStorage.getItem("warEmpire_ach");
    if (saved) {
      const d = JSON.parse(saved);
      Object.assign(achievements, d);
    }
  } catch (e) {}
}
function saveAchievements() {
  try {
    localStorage.setItem("warEmpire_ach", JSON.stringify(achievements));
  } catch (e) {}
}
function checkAchievements() {
  for (const a of ACHIEVEMENTS_DEF) {
    if (!achievements.unlocked.includes(a.id) && a.req(achievements)) {
      achievements.unlocked.push(a.id);
      saveAchievements();
      notify(`🏅 إنجاز جديد: ${a.name}!`);
    }
  }
}
function showAch() {
  const modal = document.getElementById("ach-modal");
  modal.style.display = "flex";
  // Stats
  document.getElementById("ach-stats").innerHTML = `
    <div class="ach-stat">⚔️ إجمالي القتلى: <b>${achievements.kills}</b></div>
    <div class="ach-stat">🔰 أكبر جيش: <b>${achievements.maxSoldiers}</b></div>
    <div class="ach-stat">🏗️ المباني المبنية: <b>${achievements.buildingsBuilt}</b></div>
    <div class="ach-stat">🏆 الخرائط المفتوحة: <b>${achievements.mapsWon}</b></div>
    <div class="ach-stat">🌉 المعابر المبنية: <b>${achievements.bridgesBuilt}</b></div>
  `;
  // Grid
  const grid = document.getElementById("ach-grid");
  grid.innerHTML = "";
  for (const a of ACHIEVEMENTS_DEF) {
    const done = achievements.unlocked.includes(a.id);
    const card = document.createElement("div");
    card.className = "ach-card" + (done ? " unlocked" : "");
    card.innerHTML = `<div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>`;
    grid.appendChild(card);
  }
}
function closeAch() {
  document.getElementById("ach-modal").style.display = "none";
}

// ================================================================
//  SMOOTH ZOOM
// ================================================================
function camZoomSmoothAt(pivot, delta) {
  const px = pivot ? pivot.x : cv.width / 2,
    py = pivot ? pivot.y : cv.height / 2;
  targetZoom = Math.max(cam.minZ, Math.min(cam.maxZ, targetZoom + delta));
  // Store pivot for smooth animation
  cam._pivot = { px, py };
}
function updateSmoothZoom() {
  if (Math.abs(cam.zoom - targetZoom) < 0.005) return;
  const prev = cam.zoom;
  cam.zoom += (targetZoom - cam.zoom) * 0.18;
  if (cam._pivot) {
    const px = cam._pivot.px,
      py = cam._pivot.py;
    const wx = px / prev + cam.x;
    const wy = py / prev + cam.y;
    cam.x = wx - px / cam.zoom;
    cam.y = wy - py / cam.zoom;
  }
  clampCam();
}

// ================================================================
//  GUIDE
// ================================================================
const GUIDE_TABS = [
  {
    label: "⚙️ أساسيات",
    content: `
    <h3>هدف اللعبة</h3>
    <p>دمّر قلعة العدو قبل أن يدمّر قلعتك! بنِ مبانيك، اجمع الموارد، ودرّب جيشك للنصر.</p>
    <h3>الموارد الأربعة</h3>
    <ul>
      <li>🟡 <b>الذهب</b> — يُجمع من المناجم والقلاع. أساس كل شيء.</li>
      <li>🧱 <b>الحجر</b> — من المحاجر. لبناء الأسوار والمباني الثقيلة.</li>
      <li>💧 <b>الماء</b> — من الآبار. لتدريب الجند والبناء.</li>
      <li>⚙️ <b>المعدن</b> — من المناجم والمسابك. للوحدات القوية والتحسينات.</li>
    </ul>
    <h3>استراتيجية البداية المُوصى بها</h3>
    <ul>
      <li>1. أنشئ منجماً لتدفق الذهب والمعدن.</li>
      <li>2. أنشئ منزلاً لزيادة حجم جيشك.</li>
      <li>3. أنشئ ثكنة عسكرية لتدريب الجنود.</li>
      <li>4. درّب ثلاثة جنود واهجم المناطق الخارجية.</li>
      <li>5. أنشئ أبراج مراقبة لحماية قلعتك.</li>
    </ul>
  `,
  },
  {
    label: "🏗️ المباني",
    content: `
    <h3>قائمة المباني</h3>
    <table class="g-table">
      <tr><th>المبنى</th><th>التكلفة</th><th>التأثير</th></tr>
      ${Object.entries(BCFG)
        .map(
          ([k, c]) => `
        <tr>
          <td class="tc-name">${c.icon} ${c.label}</td>
          <td>${
            Object.entries(c.cost || {})
              .map(
                ([r, v]) =>
                  ({ gold: "🪙", stone: "🪨", water: "💧", metal: "⚙️" })[r] +
                  v,
              )
              .join(" ") || "—"
          }</td>
          <td style="font-size:11px">${c.desc}</td>
        </tr>
      `,
        )
        .join("")}
    </table>
    <p>💡 <b>نصيحة:</b> ابنِ المناجم أولاً لتسريع توليد الذهب، ثم المنازل لزيادة جيشك.</p>
  `,
  },
  {
    label: "🔰 الوحدات",
    content: `
    <h3>الوحدات العسكرية</h3>
    <table class="g-table">
      <tr><th>الوحدة</th><th>التكلفة</th><th>الصحة</th><th>الهجوم</th><th>الدفاع</th><th>المدى</th></tr>
      ${Object.entries(UCFG)
        .map(
          ([k, c]) => `
        <tr>
          <td class="tc-name">${c.icon} ${c.label}</td>
          <td style="font-size:10px">${Object.entries(c.cost)
            .map(
              ([r, v]) =>
                ({ gold: "🟡", stone: "🧱", water: "💧", metal: "⚙️" })[r] + v,
            )
            .join(" ")}</td>
          <td>${c.hp}</td><td>${c.atk}</td><td>${c.def}</td><td>${c.rng}</td>
        </tr>
      `,
        )
        .join("")}
    </table>
    <h3>نظام المستويات ⭐</h3>
    <p>كل وحدة تكتسب مستوى عند هزيمة 3 أعداء! المستوى الأعلى = هجوم وصحة أكبر.</p>
    <ul>
      <li>⭐ المستوى 2: +3 هجوم، +1 دفاع، +20 صحة</li>
      <li>⭐⭐ المستوى 3: تضاعف فوائد المستوى 2</li>
    </ul>
  `,
  },
  {
    label: "🗺️ التضاريس",
    content: `
    <h3>أنواع التضاريس</h3>
    <div class="tile-legend">
      <div class="tile-item"><div class="tile-swatch" style="background:#487838"></div><span>أرض عشبية — ✅ قابل للمشي والبناء</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#c89840"></div><span>رمال — ✅ قابل للمشي والبناء</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#e0eaf8"></div><span>ثلج — ✅ قابل للمشي</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#285818"></div><span>غابة — ✅ قابل للمشي والبناء</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#886840"></div><span>تراب — ✅ قابل للمشي والبناء</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#2068b0"></div><span>ماء/نهر — 🚫 غير قابل للعبور (يمكن بناء معبر)</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#786848"></div><span>جبل — 🚫 غير قابل للعبور (يمكن بناء معبر)</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#686048"></div><span>صخرة — 🚫 غير قابلة للعبور</span></div>
      <div class="tile-item"><div class="tile-swatch" style="background:#b0cef0"></div><span>جليد — 🚫 غير قابل للعبور</span></div>
    </div>
    <h3>الخرائط المتاحة</h3>
    <div id="guide-map-list"><!-- filled dynamically --></div>
  `,
    onShow: () => {
      const el = document.getElementById("guide-map-list");
      if (el) el.innerHTML = MAPS_DEF.map(m => {
        const size = m.data ? ` — ${m.data[0]?.length ?? "?"}×${m.data.length}` : "";
        return `<p><b>${m.icon || (m._custom ? "📌" : "🗺️")} ${m.name}</b> (${m.en})${size} — ${m.desc}</p>`;
      }).join("");
    },
  },
  {
    label: "🕹️ التحكم",
    content: `
    <h3>أدوات الفأرة (الشريط الجانبي الأيسر)</h3>
    <ul>
      <li>🔲 <b>اختيار</b> — انقر أو اسحب لتحديد وحداتك</li>
      <li>✋ <b>تحريك الخريطة</b> — انقر واسحب لتحريك المنظور</li>
      <li>🚶 <b>أمر التحريك</b> — انقر على الخريطة لإرسال الجيش المحدد</li>
    </ul>
    <h3>تحريك الخريطة</h3>
    <ul>
      <li>🖱️ عجلة الفأرة — تكبير/تصغير الخريطة</li>
      <li>🖱️ أداة التحريك + سحب — تحريك المنظور</li>
      <li>🗺️ النقر على الخريطة المصغرة — القفز لأي موقع</li>
      <li>▢ زر (كل) — لعرض الخريطة كاملة</li>
    </ul>
    <h3>اختصارات لوحة المفاتيح</h3>
    <ul>
      <li><span class="kbd">A</span> — تحديد جميع الوحدات</li>
      <li><span class="kbd">M</span> — تفعيل أمر التحريك</li>
      <li><span class="kbd">F</span> — هجوم فوري على أقرب عدو</li>
      <li><span class="kbd">+/-</span> — تكبير/تصغير الخريطة</li>
      <li><span class="kbd">Esc</span> — إلغاء الأمر الحالي</li>
    </ul>
    <h3>إختيار الوحدات</h3>
    <ul>
      <li>انقر على وحدة لتحديدها</li>
      <li>Shift + انقر لإضافة وحدة للتحديد</li>
      <li>اسحب المؤشر على منطقة لتحديد جميع وحداتها</li>
    </ul>
  `,
  },
];
function showGuide() {
  document.getElementById("guide-modal").style.display = "flex";
  switchTab(0);
}
function closeGuide() {
  document.getElementById("guide-modal").style.display = "none";
}
function switchTab(i) {
  document
    .querySelectorAll(".gtab")
    .forEach((t, j) => t.classList.toggle("on", i === j));
  const body = document.getElementById("guide-body");
  body.innerHTML = GUIDE_TABS[i].content;
  if (GUIDE_TABS[i].onShow) GUIDE_TABS[i].onShow();
}

// ================================================================
//  INIT
// ================================================================
window.addEventListener("DOMContentLoaded", () => {
  loadAchievements();
  loadCustomMaps();
  buildStartScreen();
});