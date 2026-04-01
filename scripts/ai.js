"use strict";
// ================================================================
//  ملفات ذكاء العدو — AI_PROFILES
//  ════════════════════════════════════════════════════════════
//  هذا القسم هو المكان الوحيد الذي تحتاج لتعديله لتغيير سلوك
//  ذكاء العدو في أي صعوبة. كل خاصية موثّقة بالعربية.
//
//  المفاتيح الجديدة (التحسينات الذكية):
//    smartTargeting: {
//        targetPriority: ["tower","barracks","forge","mine","castle"],  // ترتيب استهداف المباني
//        dynamic: true,        // إعادة ترتيب ديناميكي حسب التهديد
//    },
//    dynamicUnitSelection: {
//        enabled: true,
//        counterEnemy: true,   // اختيار وحدات مضادة لنوع وحدات العدو
//        considerFutureResources: true, // توقع الموارد المستقبلية
//    },
//    bridgeStrategy: {
//        multipleBridges: false,   // بناء أكثر من جسر إن لزم
//        strategicPlacement: true, // اختيار أفضل موقع للجسر
//    },
//    advancedDefense: {
//        guardResources: true,     // حراسة المناجم والمحاجر
//        protectTowers: true,      // حماية الأبراج
//        reinforceWeakPoints: true,// تعزيز النقاط الضعيفة
//    },
//    powerEvaluation: {
//        typeWeights: { soldier:1, archer:1.2, knight:1.5, siege:2 }, // أوزان الوحدات
//        includeBuildingsWeight: true, // تضمين وزن المباني الدفاعية
//    }
// ================================================================
const AI_PROFILES = {

  // 🟢 سهل — عدو بطيء القرار وضعيف التنظيم
  easy: {
    label: "easy",
    resourceMultiplier: 0.75,
    thinkInterval:   8,
    attackInterval: 100,
    populationCap:   10,
    maxHouses:        3,
    attackSquadSize:  4,
    features: {
      buildBridge:  false,
      buildForge:   false,
      buildTower:   false,
      defendBase:   false,
      regroupUnits: false,
    },
    buildQueue: [
      { type: "well",     when: "waterLow"   },
      { type: "house",    when: "popNearMax" },
      { type: "barracks", when: "noBarracks" },
      { type: "mine",     when: "metalLow"   },
    ],
    thresholds: {
      waterLow:           80,
      stoneLow:          100,
      metalLow:           60,
      popNearMax:          2,
      forgeIfWeakerThan: 0.0,
      forgeIfGold:       999,
      maxTowers:           0,
      towerIfEnemyPower: 999,
      towerIfEnemyClose:   0,
    },
    unitPriority: [
      { type: "soldier" },
    ],
    attackPolicy: {
      minPowerRatio:  1.0,
      alsoAttackIf: { aggressionActive: false, aggRatio: 0.0 },
    },
    defensePolicy: { detectRadius: 0 },
    regroupPolicy: { maxDistFromBase: 0 },
    // إعدادات التحسينات الجديدة (كلها معطلة للسهل)
    smartTargeting: {
      targetPriority: ["tower","barracks","mine","castle"],
      dynamic: false,
    },
    dynamicUnitSelection: { enabled: false, counterEnemy: false, considerFutureResources: false },
    bridgeStrategy: { multipleBridges: false, strategicPlacement: false },
    advancedDefense: { guardResources: false, protectTowers: false, reinforceWeakPoints: false },
    powerEvaluation: { typeWeights: null, includeBuildingsWeight: false },
  },

  // 🟡 متوسط — عدو متوازن وذكي
  medium: {
    label: "medium",
    resourceMultiplier: 1.0,
    thinkInterval:   5,
    attackInterval:  60,
    populationCap:   16,
    maxHouses:        4,
    attackSquadSize:  7,
    features: {
      buildBridge:  true,
      buildForge:   true,
      buildTower:   true,
      defendBase:   true,
      regroupUnits: true,
    },
    buildQueue: [
      { type: "well",     when: "waterLow"       },
      { type: "quarry",   when: "stoneLow"        },
      { type: "mine",     when: "metalLow"        },
      { type: "house",    when: "popNearMax"      },
      { type: "barracks", when: "noBarracks"      },
      { type: "forge",    when: "noForgeAndWeak"  },
      { type: "tower",    when: "needTower"       },
    ],
    thresholds: {
      waterLow:           80,
      stoneLow:          100,
      metalLow:           60,
      popNearMax:          2,
      forgeIfWeakerThan: 0.8,
      forgeIfGold:       300,
      maxTowers:           2,
      towerIfEnemyPower: 150,
      towerIfEnemyClose:  20,
    },
    unitPriority: [
      { type: "siege",  minEnemyPower: 150, minTowers: 1             },
      { type: "knight", maxPowerRatio: 0.9, needForge: true          },
      { type: "archer", maxPop: 8                                    },
      { type: "soldier"                                               },
    ],
    attackPolicy: {
      minPowerRatio: 0.9,
      alsoAttackIf: { aggressionActive: true, aggRatio: 0.7 },
    },
    defensePolicy: { detectRadius: 12 },
    regroupPolicy: { maxDistFromBase: 8 },
    // تحسينات متوسطة
    smartTargeting: {
      targetPriority: ["tower","barracks","forge","mine","castle"],
      dynamic: true,
    },
    dynamicUnitSelection: { enabled: true, counterEnemy: true, considerFutureResources: true },
    bridgeStrategy: { multipleBridges: false, strategicPlacement: true },
    advancedDefense: { guardResources: true, protectTowers: true, reinforceWeakPoints: false },
    powerEvaluation: { typeWeights: { soldier:1, archer:1.2, knight:1.5, siege:2 }, includeBuildingsWeight: true },
  },

  // 🔴 صعب — عدو شرس ومتقدم وسريع القرار
  hard: {
    label: "hard",
    resourceMultiplier: 1.5,
    thinkInterval:   0.2,
    attackInterval:  10,
    populationCap:   150,
    maxHouses:       50,
    attackSquadSize: 8,
    features: {
      buildBridge:  true,
      buildForge:   true,
      buildTower:   true,
      defendBase:   true,
      regroupUnits: true,
    },
    buildQueue: [
      { type: "mine",     when: "metalLow"        },
      { type: "well",     when: "waterLow"        },
      { type: "quarry",   when: "stoneLow"        },
      { type: "house",    when: "popNearMax"      },
      { type: "barracks", when: "noBarracks"      },
      { type: "forge",    when: "noForgeAndWeak"  },
      { type: "tower",    when: "needTower"       },
    ],
    thresholds: {
      waterLow:          120,
      stoneLow:          150,
      metalLow:           80,
      popNearMax:          2,
      forgeIfWeakerThan: 1.0,
      forgeIfGold:       200,
      maxTowers:           3,
      towerIfEnemyPower: 100,
      towerIfEnemyClose:  30,
    },
    unitPriority: [
      { type: "siege",  minEnemyPower: 100, minTowers: 1             },
      { type: "knight", maxPowerRatio: 1.0, needForge: false         },
      { type: "archer", maxPop: 12                                   },
      { type: "soldier"                                              },
    ],
    attackPolicy: {
      minPowerRatio: 0.7,
      alsoAttackIf: { aggressionActive: true, aggRatio: 0.6 },
    },
    defensePolicy: { detectRadius: 16 },
    regroupPolicy: { maxDistFromBase: 5 },
    // تحسينات متقدمة
    smartTargeting: {
      targetPriority: ["tower","barracks","forge","mine","castle"],
      dynamic: true,
    },
    dynamicUnitSelection: { enabled: true, counterEnemy: true, considerFutureResources: true },
    bridgeStrategy: { multipleBridges: true, strategicPlacement: true },
    advancedDefense: { guardResources: true, protectTowers: true, reinforceWeakPoints: true },
    powerEvaluation: { typeWeights: { soldier:1, archer:1.3, knight:1.8, siege:2.5 }, includeBuildingsWeight: true },
  },

};

// ================================================================
//  BOT AI — مدار بالملف الشخصي AI_PROFILES
//  لتعديل سلوك الذكاء: عدّل AI_PROFILES فقط (بالأعلى)
// ================================================================

function formatGameTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function aiLog(message) {
  if (!B.aiThoughts) B.aiThoughts = [];
  if (!B.aiThoughtCount) B.aiThoughtCount = 0;

  B.aiThoughts.push(message);
  B.aiThoughtCount++;

  if (B.aiThoughtCount % 10 === 0) {
    console.clear();
    B.aiThoughts = [];
    console.log("(الكونسول تم مسحه بعد 10 أفكار، وتم إعادة تعيين قائمة الأفكار)");
  }

  const time = typeof gtime === "number" ? formatGameTime(gtime) : "0:00.0";
  console.log(`فكرة العدو #${B.aiThoughtCount} [${time}] => ${message}`);
}

function updateBotAI(dt) {
  const profile = AI_PROFILES[curDiff];

  B.aiTimer  = (B.aiTimer  || 0) + dt;
  B.atkTimer = (B.atkTimer || 0) + dt;

  if (B.aiTimer < profile.thinkInterval) return;
  B.aiTimer = 0;

  const castle      = B.buildings.find(b => b.type === 'castle');
  if (!castle) return;
  const enemyCastle = P.buildings.find(b => b.type === 'castle');
  if (!enemyCastle) return;

  const ourPower    = evaluateMilitaryPower(B, profile);
  const enemyPower  = evaluateMilitaryPower(P, profile);
  const powerRatio  = ourPower / (enemyPower + 0.01);
  const towersCount = countBuildingsOfType('tower');

  // ── 1. بناء جسر إذا كان الطريق مقطوعاً ──────────────────────
  if (profile.features.buildBridge) {
    const pathExists = isPathClear(
      castle.tx + 1, castle.ty + 1,
      enemyCastle.tx + 1, enemyCastle.ty + 1
    );
    if (!pathExists && !hasBridgeOnPath(castle, enemyCastle)) {
      const dist = Math.abs(castle.tx - enemyCastle.tx)
                 + Math.abs(castle.ty - enemyCastle.ty);
      if (dist >= 8 && dist <= 45) {
        if (tryBuildBridge(castle, enemyCastle, profile)) {
          aiLog("ابني بيتا جسرًا لعبور العقبة");
          return;
        }
      }
    }
  }

  // ── 2. أولويات البناء من الملف الشخصي ───────────────────────
  for (const entry of profile.buildQueue) {
    if (aiBuildConditionMet(entry.when, profile, powerRatio, enemyPower, towersCount)) {
      if (tryBuild(entry.type, castle)) {
        const label = BCFG[entry.type]?.label || entry.type;
        aiLog(`ابني بيتا ${label}`);
        return;
      }
    }
  }

  // ── 3. تدريب الوحدات ─────────────────────────────────────────
  if (hasBuildingOfType('barracks') && B.pop < B.maxPop) {
    const unit = aiSelectUnit(profile, powerRatio, enemyPower, towersCount);
    if (unit && tryTrainUnit(unit)) {
      const unitLabel = UCFG[unit]?.label || unit;
      aiLog(`أدرّب وحدة ${unitLabel}`);
      return;
    }
  }

  // ── 4. الدفاع عن القلعة (الدفاع الأساسي) ──────────────────────
  if (profile.features.defendBase && profile.defensePolicy.detectRadius > 0) {
    const nearEnemies = getEnemyUnitsNear(castle, profile.defensePolicy.detectRadius);
    if (nearEnemies.length > 0) {
      aiLog(`أدافع عن القلعة ضد ${nearEnemies.length} وحدة`);
      defendAgainst(nearEnemies, profile);
      return;
    }
  }

  // ── 5. دفاع متقدم: حراسة الموارد والأبراج ─────────────────────
  if (profile.advancedDefense && profile.advancedDefense.guardResources) {
    const threatenedResources = getThreatenedResources(profile);
    if (threatenedResources.length > 0) {
      aiLog(`أحرس الموارد المهددة (${threatenedResources.length})`);
      defendResources(threatenedResources, profile);
      // لا نعود هنا حتى نستمر في الهجوم أيضاً إن أمكن
    }
  }

  // ── 6. إطلاق هجوم ────────────────────────────────────────────
  if (B.atkTimer >= profile.attackInterval) {
    const pol    = profile.attackPolicy;
    const baseOk = powerRatio >= pol.minPowerRatio;
    const aggrOk = pol.alsoAttackIf.aggressionActive
                && powerRatio >= pol.alsoAttackIf.aggRatio;
    if (baseOk || aggrOk) {
      aiLog(`أشن هجومًا بـ ${profile.attackSquadSize} وحدات`);
      launchSmartAttack(profile.attackSquadSize, enemyCastle, profile);
      B.atkTimer = 0;
      return;
    }
  }

  // ── 7. إعادة التجميع ─────────────────────────────────────────
  if (profile.features.regroupUnits && profile.regroupPolicy.maxDistFromBase > 0) {
    aiLog(`أعيد تجميع الوحدات داخل مسافة ${profile.regroupPolicy.maxDistFromBase}`);
    regroupUnits(castle, profile.regroupPolicy.maxDistFromBase);
  }
}

// ================================================================
//  دوال تقييم الشروط — مرتبطة بـ AI_PROFILES
// ================================================================

function aiBuildConditionMet(when, profile, powerRatio, enemyPower, towersCount) {
  const t = profile.thresholds;
  switch (when) {
    case "waterLow":
      return B.water < t.waterLow && !hasBuildingOfType('well');
    case "stoneLow":
      return B.stone < t.stoneLow && !hasBuildingOfType('quarry');
    case "metalLow":
      return B.metal < t.metalLow && !hasBuildingOfType('mine');
    case "popNearMax":
      return B.pop >= B.maxPop - t.popNearMax
          && countBuildingsOfType('house') < profile.maxHouses + 1;
    case "noBarracks":
      return !hasBuildingOfType('barracks') && B.pop > 2;
    case "noForgeAndWeak": {
      if (!profile.features.buildForge)   return false;
      if (hasBuildingOfType('forge'))      return false;
      return powerRatio < t.forgeIfWeakerThan
          || (B.gold > t.forgeIfGold && B.metal > 100);
    }
    case "needTower": {
      if (!profile.features.buildTower)   return false;
      if (towersCount >= t.maxTowers)      return false;
      const ec = P.buildings.find(b => b.type === 'castle');
      const bc = B.buildings.find(b => b.type === 'castle');
      const close = ec && bc && distanceBetween(bc, ec) < t.towerIfEnemyClose;
      return enemyPower > t.towerIfEnemyPower || close;
    }
    default:
      return false;
  }
}

// اختيار الوحدة المناسبة حسب unitPriority مع التحسينات الديناميكية
function aiSelectUnit(profile, powerRatio, enemyPower, towersCount) {
  // إذا كانت الميزة الديناميكية مفعلة، نعيد ترتيب الأولويات بناءً على حالة العدو
  let priorityList = profile.unitPriority;
  if (profile.dynamicUnitSelection && profile.dynamicUnitSelection.enabled) {
    priorityList = dynamicReorderUnitPriority(profile, enemyPower, towersCount);
  }

  for (const entry of priorityList) {
    if (entry.minEnemyPower !== undefined && enemyPower  <  entry.minEnemyPower) continue;
    if (entry.minTowers     !== undefined && towersCount <  entry.minTowers)     continue;
    if (entry.maxPowerRatio !== undefined && powerRatio  >= entry.maxPowerRatio) continue;
    if (entry.needForge     === true      && !hasBuildingOfType('forge'))        continue;
    if (entry.maxPop        !== undefined && B.pop       >= entry.maxPop)        continue;
    if (afford(B, UCFG[entry.type].cost)) return entry.type;
  }
  return null;
}

// إعادة ترتيب أولويات الوحدات بناءً على تهديدات العدو
function dynamicReorderUnitPriority(profile, enemyPower, towersCount) {
  // استنساخ القائمة الأصلية
  let list = [...profile.unitPriority];
  // تحليل وحدات العدو لتحديد ما نحتاجه للتصدي
  const enemyUnitTypes = P.units.map(u => u.type);
  const hasEnemySiege = enemyUnitTypes.includes('siege');
  const hasEnemyKnight = enemyUnitTypes.includes('knight');
  const hasEnemyArcher = enemyUnitTypes.includes('archer');

  // إعطاء وزن إضافي لأنواع معينة بناءً على حالة العدو
  const weights = {
    'siege': hasEnemySiege ? 3 : 1,
    'knight': hasEnemyKnight ? 2 : 1,
    'archer': hasEnemyArcher ? 2 : 1,
    'soldier': 1
  };
  // ترتيب تنازلي حسب الوزن (مع الحفاظ على الشروط الأصلية)
  list.sort((a,b) => (weights[b.type]||0) - (weights[a.type]||0));
  return list;
}

// ================================================================
//  دوال مساعدة للذكاء الاصطناعي (محسنة)
// ================================================================

// تقييم القوة العسكرية مع أوزان حسب الملف الشخصي
function evaluateMilitaryPower(owner, profile = null) {
  let power = 0;
  const weights = (profile && profile.powerEvaluation && profile.powerEvaluation.typeWeights) ?
                  profile.powerEvaluation.typeWeights : { soldier:1, archer:1, knight:1, siege:1 };

  for (const u of owner.units) {
    let up = u.hp * (u.atk + u.def * 0.5);
    const w = weights[u.type] || 1;
    up *= w;
    if (UCFG[u.type].rng > 3) up *= 1.2; // الرماة والمدفعية أكثر تأثيراً
    power += up;
  }
  if (profile && profile.powerEvaluation && profile.powerEvaluation.includeBuildingsWeight) {
    for (const b of owner.buildings) {
      if (b.type === 'tower')  power += 80;
      if (b.type === 'castle') power += 200;
      if (b.type === 'forge')  power += 30;
    }
  }
  return power;
}

// BFS للتحقق من وجود مسار سالك بدون جسور
function isPathClear(sx, sy, ex, ey) {
  const queue = [{x: sx, y: sy}];
  const visited = new Set([`${sx},${sy}`]);
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  while (queue.length) {
    const {x, y} = queue.shift();
    if (x === ex && y === ey) return true;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < MW && ny >= 0 && ny < MH && !visited.has(key)) {
        if (isTileWalkableWithoutBridge(nx, ny)) {
          visited.add(key);
          queue.push({x: nx, y: ny});
        }
      }
    }
  }
  return false;
}

function isTileWalkableWithoutBridge(x, y) {
  if (x < 0 || x >= MW || y < 0 || y >= MH) return false;
  return WALK[map2d[y][x]];
}

function hasBridgeOnPath(castle, enemyCastle) {
  const minX = Math.min(castle.tx, enemyCastle.tx);
  const maxX = Math.max(castle.tx, enemyCastle.tx);
  const minY = Math.min(castle.ty, enemyCastle.ty);
  const maxY = Math.max(castle.ty, enemyCastle.ty);
  return B.buildings.some(b =>
    b.type === 'bridge' &&
    b.tx >= minX && b.tx <= maxX &&
    b.ty >= minY && b.ty <= maxY
  );
}

// محاولة بناء جسر محسنة (استراتيجية)
function tryBuildBridge(castle, enemyCastle, profile) {
  const strategy = profile.bridgeStrategy || { multipleBridges: false, strategicPlacement: true };
  const dx = enemyCastle.tx - castle.tx;
  const dy = enemyCastle.ty - castle.ty;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return false;
  const stepX = dx / steps, stepY = dy / steps;

  // جمع كل الخلايا غير القابلة للمشي على الخط المستقيم
  let badSpots = [];
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(castle.tx + i * stepX);
    const y = Math.round(castle.ty + i * stepY);
    if (x < 0 || x >= MW || y < 0 || y >= MH) continue;
    if (!WALK[map2d[y][x]]) {
      badSpots.push({x,y});
    }
  }

  if (badSpots.length === 0) return false;

  // اختيار أفضل موقع للجسر
  let bestSpot = null;
  let bestScore = -Infinity;
  for (const spot of badSpots) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = spot.x + dx, ny = spot.y + dy;
        if (nx >= 0 && nx < MW && ny >= 0 && ny < MH &&
            canPlace(B, nx, ny, 1, 1, 'bridge') && afford(B, BCFG.bridge.cost)) {
          let score = 0;
          if (strategy.strategicPlacement) {
            // تقييم الموقع: قرب المسار المثالي، وتجنب الزوايا
            const distToIdeal = Math.hypot(nx - (castle.tx + dx/2), ny - (castle.ty + dy/2));
            score = -distToIdeal; // كلما كان أقرب للمسار المثالي كان أفضل
          }
          if (score > bestScore) {
            bestScore = score;
            bestSpot = {x: nx, y: ny};
          }
        }
      }
    }
    if (bestSpot) break;
  }

  if (bestSpot) {
    spend(B, BCFG.bridge.cost);
    placeBuilding(B, 'bridge', bestSpot.x, bestSpot.y);
    notify(`🌉 العدو يبني جسراً!`);
    return true;
  }

  // إذا لم نجد موقعاً استراتيجياً، نعود للطريقة القديمة (أول موقع متاح)
  for (const spot of badSpots) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = spot.x + dx, ny = spot.y + dy;
        if (nx >= 0 && nx < MW && ny >= 0 && ny < MH &&
            canPlace(B, nx, ny, 1, 1, 'bridge') && afford(B, BCFG.bridge.cost)) {
          spend(B, BCFG.bridge.cost);
          placeBuilding(B, 'bridge', nx, ny);
          notify(`🌉 العدو يبني جسراً!`);
          return true;
        }
      }
    }
  }
  return false;
}

// دوال مساعدة عامة
function hasBuildingOfType(type)    { return B.buildings.some(b => b.type === type); }
function countBuildingsOfType(type) { return B.buildings.filter(b => b.type === type).length; }
function distanceBetween(a, b)      { return Math.hypot(a.tx - b.tx, a.ty - b.ty); }

function tryBuild(type, castle) {
  const cfg = BCFG[type];
  if (!afford(B, cfg.cost)) return false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const tx = castle.tx + Math.floor(Math.random() * 9) - 4;
    const ty = castle.ty + Math.floor(Math.random() * 7) - 3;
    if (canPlace(B, tx, ty, cfg.w, cfg.h, type)) {
      spend(B, cfg.cost);
      placeBuilding(B, type, tx, ty);
      return true;
    }
  }
  return false;
}

function tryTrainUnit(type) {
  const barracks = B.buildings.find(b => b.type === 'barracks');
  if (!barracks) return false;
  if (!afford(B, UCFG[type].cost) || B.pop >= B.maxPop) return false;
  spend(B, UCFG[type].cost);
  spawnUnit(B, type, barracks.tx + 2, barracks.ty + 1);
  return true;
}

function getEnemyUnitsNear(castle, radius) {
  const cx = castle.tx + 1.5, cy = castle.ty + 1.5;
  return P.units.filter(u => Math.hypot(u.x / TS - cx, u.y / TS - cy) < radius);
}

// دفاع محسن (مع مراعاة الإعدادات)
function defendAgainst(enemyUnits, profile) {
  if (!enemyUnits.length || !B.units.length) return;
  for (const u of B.units) {
    let closest = null, bestDist = Infinity;
    for (const e of enemyUnits) {
      const d = Math.hypot(u.x / TS - e.x / TS, u.y / TS - e.y / TS);
      if (d < bestDist) { bestDist = d; closest = e; }
    }
    if (closest) {
      const path = astar(Math.floor(u.x / TS), Math.floor(u.y / TS),
                         Math.floor(closest.x / TS), Math.floor(closest.y / TS));
      if (path) { u.path = path; u.pi = 0; u.target = closest; }
    }
  }
}

// دفاع الموارد: حماية المناجم والمحاجر والآبار
function getThreatenedResources(profile) {
  const resources = B.buildings.filter(b => ['mine','quarry','well'].includes(b.type));
  const threatened = [];
  for (const res of resources) {
    const nearEnemies = P.units.filter(u => Math.hypot(u.x/TS - (res.tx+0.5), u.y/TS - (res.ty+0.5)) < 8);
    if (nearEnemies.length > 0) threatened.push(res);
  }
  return threatened;
}

function defendResources(threatened, profile) {
  if (!B.units.length) return;
  for (const res of threatened) {
    const defenders = B.units.filter(u => !u.target || u.target.hp <= 0).slice(0, 2);
    for (const u of defenders) {
      const path = astar(Math.floor(u.x/TS), Math.floor(u.y/TS), res.tx+1, res.ty+1);
      if (path) { u.path = path; u.pi = 0; u.target = res; }
    }
  }
}

// هجوم ذكي مع أولويات قابلة للتخصيص
function launchSmartAttack(attackSize, enemyCastle, profile) {
  const attackers = B.units.filter(u => u.hp > 0).slice(0, attackSize);
  if (!attackers.length) return;

  // تحديد أولوية الأهداف حسب smartTargeting
  let targetPriority = ["tower","barracks","forge","mine","castle"];
  if (profile.smartTargeting && profile.smartTargeting.targetPriority) {
    targetPriority = profile.smartTargeting.targetPriority;
  }

  // بناء قائمة الأهداف حسب الأولوية
  let targets = [];
  for (const type of targetPriority) {
    const buildings = P.buildings.filter(b => b.type === type);
    targets.push(...buildings);
  }
  // إضافة القلعة إن لم تكن موجودة
  if (!targets.some(b => b.type === 'castle')) targets.push(enemyCastle);

  // إذا كان dynamic مفعلاً، نعيد ترتيب الأهداف بناءً على حالة العدو
  if (profile.smartTargeting && profile.smartTargeting.dynamic) {
    targets = dynamicReorderTargets(targets);
  }

  let ti = 0;
  for (const u of attackers) {
    let assigned = false;
    while (ti < targets.length && !assigned) {
      const b  = targets[ti];
      const tx = b.tx + Math.floor((BCFG[b.type]?.w || 1) / 2);
      const ty = b.ty + Math.floor((BCFG[b.type]?.h || 1) / 2);
      const path = astar(Math.floor(u.x / TS), Math.floor(u.y / TS), tx, ty);
      if (path) { u.path = path; u.pi = 0; u.target = b; assigned = true; }
      else ti++;
    }
    if (!assigned) break;
  }
  notify(`⚔️ العدو يشن هجوماً بـ ${attackers.length} وحدة!`);
}

// إعادة ترتيب ديناميكي للأهداف (مثلاً استهداف الثكنات إذا كان العدو ينتج وحدات)
function dynamicReorderTargets(targets) {
  // نقوم بتصنيف الأهداف حسب أهميتها المتغيرة
  const hasManyUnits = P.units.length > 10;
  const hasTowers = P.buildings.some(b => b.type === 'tower');
  const hasForge = P.buildings.some(b => b.type === 'forge');

  let score = (b) => {
    let s = 0;
    if (b.type === 'tower') s = 100;
    else if (b.type === 'barracks') s = hasManyUnits ? 90 : 70;
    else if (b.type === 'forge') s = hasForge ? 80 : 50;
    else if (b.type === 'mine') s = 60;
    else if (b.type === 'castle') s = 40;
    return s;
  };
  return targets.sort((a,b) => score(b) - score(a));
}

function regroupUnits(castle, maxDist) {
  const cx = castle.tx + 1.5, cy = castle.ty + 1.5;
  for (const u of B.units) {
    const dist = Math.hypot(u.x / TS - cx, u.y / TS - cy);
    if (dist > maxDist && u.state !== 'atk' && (!u.target || u.target.hp <= 0)) {
      const path = astar(Math.floor(u.x / TS), Math.floor(u.y / TS),
                         castle.tx + 2, castle.ty + 2);
      if (path) { u.path = path; u.pi = 0; u.target = null; }
    }
  }
}

// دوال مساعدة قديمة (محفوظة للتوافقية)
function botTrain(type) {
  const c = UCFG[type];
  if (!afford(B, c.cost) || B.pop >= B.maxPop) return;
  const bar = B.buildings.find((b) => b.type === "barracks");
  if (!bar) return;
  spend(B, c.cost);
  spawnUnit(B, type, bar.tx + 2, bar.ty + 1);
}
function botAttack(sz) {
  const pc = P.buildings.find((b) => b.type === "castle");
  if (!pc) return;
  const attackers = B.units.filter((u) => u.hp > 0).slice(0, sz);
  attackers.forEach((u, i) => {
    if (i % 3 === 0 && P.units.length > 0) {
      const t = P.units[Math.floor(Math.random() * P.units.length)];
      botMoveUnit(u, Math.floor(t.x / TS), Math.floor(t.y / TS));
    } else {
      botMoveUnit(u, pc.tx + 1 + Math.floor(Math.random() * 4 - 2),
                     pc.ty + 2 + Math.floor(Math.random() * 4 - 2));
    }
  });
}
function botMoveUnit(u, tx, ty) {
  const sx = Math.floor(u.x / TS), sy = Math.floor(u.y / TS);
  const path = astar(sx, sy, Math.max(0, Math.min(MW - 1, tx)),
                             Math.max(0, Math.min(MH - 1, ty)));
  if (path) { u.path = path; u.pi = 0; u.state = "move"; }
}