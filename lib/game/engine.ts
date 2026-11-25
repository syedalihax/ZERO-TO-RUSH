import {
  CAR_PARK_POS,
  CUSTOMER_SLOTS,
  CYCLE_ANCHOR,
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SPEED_MULT,
  DAY_DURATION_SECONDS,
  DRINK_CATALOG,
  FRYING_DURATION,
  HELD_ITEM_LABELS,
  HELPER_IDLE_SPOT,
  HELPER_WAGE_CENTS,
  KETTLING_DURATION,
  KID_SIT_POS,
  LEVEL2_SERVED_THRESHOLD,
  MAX_WATER_CAPACITY,
  MILKMAN_PARK_DURATION,
  MILKMAN_PARK_POS,
  OWNER_STALL_SPOT,
  PLAYER_SPEED,
  RANDOM_TIP_AMOUNTS_CENTS,
  RANDOM_TIP_CHANCE,
  RENTABLE_BUILDINGS,
  SNACKS_CART_ANCHOR,
  SNACKS_CART_PRICE_CENTS,
  SNACK_CUSTOMER_SLOTS,
  SNACK_STATIONS,
  SNACK_TRAY_SPOTS,
  STARTING_CASH_CENTS,
  STARTING_CUPS,
  STARTING_SUGAR,
  STARTING_TEA,
  STARTING_WATER,
  STATIONS,
  SUPERMARKET_AISLE_POS,
  SUPERMARKET_BOUNDS,
  SUPERMARKET_COUNTER_POS,
  SUPERMARKET_FURNITURE_POS,
  SUPERMARKET_PICKUP_POS,
  TRASH_BIN_POS,
  TRAY_SPOTS,
  WATER_TAP_POS,
  WATER_TAP_REFILL_AMOUNT,
  WORLD_BOUNDS,
  drinkToHotItem,
  formatMoney,
  heldFurnitureKind,
  heldHotDrinkType,
  isSwappableCounterItem,
} from './constants.ts';
import type {
  CafeFurniture,
  DrinkType,
  FootpathPedestrian,
  HeldItem,
  HelperKidState,
  InteractTargetKind,
  InventoryState,
  Player3DState,
  ShiftSnapshot,
  ShopBuildingId,
  SimStepEvents,
  Stage1Input,
  SupermarketOwnerState,
  TeaCustomer,
  WorldSave,
} from './types.ts';

export function isOwnerInsideSupermarket(owner: SupermarketOwnerState): boolean {
  const insideBounds =
    owner.x >= SUPERMARKET_BOUNDS.minX &&
    owner.x <= SUPERMARKET_BOUNDS.maxX &&
    owner.z >= SUPERMARKET_BOUNDS.minZ &&
    owner.z <= SUPERMARKET_BOUNDS.maxZ - 0.15;
  return (
    insideBounds &&
    (owner.phase === 'patrol_inside' || owner.phase === 'returning_to_store')
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function randomSpawnInterval(): number {
  return 10 + Math.random() * 75;
}

export function createDefaultHelper(): HelperKidState {
  return {
    x: KID_SIT_POS.x,
    z: KID_SIT_POS.z,
    yaw: Math.PI,
    walkCycle: 0,
    status: 'sitting',
    charityGivenToday: false,
    task: 'idle',
    targetDrink: null,
    targetCustomerId: null,
    holding: null,
    actionTimer: 0,
    servedCount: 0,
    wageEarnedCents: 0,
    statusNote: null,
  };
}

export function createNewWorldSave(id: string, name: string): WorldSave {
  const now = Date.now();
  return {
    id,
    name: name.trim() || 'Sunny Corner Chai',
    stage: 1,
    createdAt: now,
    lastPlayedAt: now,
    day: 1,
    cashCents: STARTING_CASH_CENTS,
    totalServed: 0,
    unlockedRecipes: ['tea'],
    hasSnacksCart: false,
    rentedShops: [],
    furniture: [],
    pendingFurniture: [],
    activeShift: null,
  };
}

export function createInitialShift(
  world: WorldSave,
  carryInventory?: InventoryState
): ShiftSnapshot {
  return {
    stage: world.stage,
    day: world.day,
    timeLeft: DAY_DURATION_SECONDS,
    shiftDuration: DAY_DURATION_SECONDS,
    earningsCents: 0,
    servedCount: 0,
    missedCount: 0,
    player: {
      x: -2.0,
      z: -2.45,
      yaw: 0,
      holding: null,
      walkCycle: 0,
      dashCooldown: 0,
      dashTimer: 0,
      isMoving: false,
      sittingChairId: null,
    },
    trayItem: null,
    trayItems: [null, null, null, null],
    snackTrayItems: [null, null],
    inventory: carryInventory
      ? {
          cups: carryInventory.cups,
          teaLeaves: carryInventory.teaLeaves,
          sugar: carryInventory.sugar,
          water: carryInventory.water,
          milkPackets: carryInventory.milkPackets,
          coffeePowder: carryInventory.coffeePowder,
          biscuits: carryInventory.biscuits,
          cupcakes: carryInventory.cupcakes,
          samosaMix: carryInventory.samosaMix ?? 0,
          pakoraMix: carryInventory.pakoraMix ?? 0,
          cookingOil: carryInventory.cookingOil ?? 0,
        }
      : {
          cups: STARTING_CUPS,
          teaLeaves: STARTING_TEA,
          sugar: STARTING_SUGAR,
          water: STARTING_WATER,
          milkPackets: 0,
          coffeePowder: 0,
          biscuits: 0,
          cupcakes: 0,
          samosaMix: 0,
          pakoraMix: 0,
          cookingOil: 0,
        },
    kettle: {
      status: 'idle',
      progress: 0,
      brewingDrink: null,
    },
    fryer: {
      status: 'idle',
      progress: 0,
      fryingSnack: null,
    },
    helper: createDefaultHelper(),
    milkman: {
      phase: 'away',
      timer: 0,
      x: -26,
      z: MILKMAN_PARK_POS.z,
      nextArrivalElapsed: 36,
    },
    carCustomer: {
      phase: 'away',
      x: 26,
      z: CAR_PARK_POS.z,
      orderDrink: 'tea',
      qtyTotal: 1,
      qtyServed: 0,
      patience: 85,
      maxPatience: 85,
      nextArrivalElapsed: 26 + Math.random() * 24,
      carColor: '#DC2626',
    },
    supermarketOwner: {
      x: 6.2,
      z: -5.85,
      yaw: 0,
      phase: 'patrol_inside',
      targetX: 8.15,
      targetZ: -5.7,
      waitTimer: 3.5,
      nextVisitTimer: 38 + Math.random() * 22,
      orderDrink: 'tea',
      patience: 115,
      maxPatience: 115,
      drinkTimer: 0,
      walkCycle: 0,
    },
    customers: [],
    pedestrians: [],
    spawnTimer: 4.5,
    pedestrianSpawnTimer: 1.2,
    nextCustomerSeq: 1,
    phase: 'playing',
  };
}

export function getFurnitureDropSpot(player: Player3DState): {
  x: number;
  z: number;
} {
  return {
    x: player.x + Math.sin(player.yaw) * 1.05,
    z: player.z + Math.cos(player.yaw) * 1.05,
  };
}

export function canPlaceFurnitureAt(
  x: number,
  z: number,
  furniture: CafeFurniture[],
  world?: WorldSave
): boolean {
  const onOutdoorSidewalk =
    x >= -16.4 &&
    x <= 19.2 &&
    z >= -4.8 &&
    z <= 1.45 &&
    !(x > 3.9 && z < -3.25);

  let insideRentedShop = false;
  if (world?.rentedShops?.length) {
    for (const rec of world.rentedShops) {
      const cfg = RENTABLE_BUILDINGS.find((b) => b.id === rec.buildingId);
      if (!cfg) continue;
      if (
        x >= cfg.bounds.minX + 0.55 &&
        x <= cfg.bounds.maxX - 0.55 &&
        z >= cfg.bounds.minZ + 2.6 &&
        z <= cfg.bounds.maxZ - 0.45
      ) {
        insideRentedShop = true;
        break;
      }
    }
  }

  if (!onOutdoorSidewalk && !insideRentedShop) {
    return false;
  }

  // Keep clear of 4-Wheel Chai Readi (7.4m x 1.64m)
  if (
    x > CYCLE_ANCHOR.x - 4.15 &&
    x < CYCLE_ANCHOR.x + 4.15 &&
    z > CYCLE_ANCHOR.z - 1.28 &&
    z < CYCLE_ANCHOR.z + 1.28
  ) {
    return false;
  }

  // Keep clear of 2nd Snacks Readi plot (4.8m x 1.64m)
  if (
    x > SNACKS_CART_ANCHOR.x - 2.85 &&
    x < SNACKS_CART_ANCHOR.x + 2.85 &&
    z > SNACKS_CART_ANCHOR.z - 1.28 &&
    z < SNACKS_CART_ANCHOR.z + 1.28
  ) {
    return false;
  }

  // Keep clear of Water Tap, Trash Bin & Helper Kid Mat
  if (
    Math.hypot(x - WATER_TAP_POS.x, z - WATER_TAP_POS.z) < 0.95 ||
    Math.hypot(x - TRASH_BIN_POS.x, z - TRASH_BIN_POS.z) < 0.85 ||
    Math.hypot(x - KID_SIT_POS.x, z - KID_SIT_POS.z) < 0.95
  ) {
    return false;
  }

  // Keep clear of existing placed furniture
  for (const item of furniture) {
    if (Math.hypot(x - item.x, z - item.z) < 0.78) {
      return false;
    }
  }
  return true;
}

export function isChairNearTable(
  chair: CafeFurniture,
  furniture: CafeFurniture[]
): boolean {
  return furniture.some(
    (f) => f.kind === 'table' && Math.hypot(f.x - chair.x, f.z - chair.z) < 1.75
  );
}

export function getFacingAngleForSeat(
  chair: CafeFurniture,
  furniture: CafeFurniture[]
): number {
  let nearestTable: CafeFurniture | null = null;
  let bestDist = 1.75;
  for (const f of furniture) {
    if (f.kind !== 'table') continue;
    const d = Math.hypot(f.x - chair.x, f.z - chair.z);
    if (d < bestDist) {
      bestDist = d;
      nearestTable = f;
    }
  }
  if (nearestTable) {
    return Math.atan2(nearestTable.x - chair.x, nearestTable.z - chair.z);
  }
  return chair.rotationY;
}

function findAvailableChair(
  shift: ShiftSnapshot,
  world: WorldSave
): CafeFurniture | null {
  const occupied = new Set<string>();
  if (shift.player.sittingChairId) {
    occupied.add(shift.player.sittingChairId);
  }
  for (const c of shift.customers) {
    if (c.seatedChairId) occupied.add(c.seatedChairId);
    if (c.targetChairId) occupied.add(c.targetChairId);
  }

  const freeChairs = world.furniture.filter(
    (f) => f.kind === 'chair' && !occupied.has(f.id)
  );
  if (freeChairs.length === 0) return null;

  const tableChair = freeChairs.find((ch) =>
    isChairNearTable(ch, world.furniture)
  );
  return tableChair ?? freeChairs[0];
}

const SHIRT_COLORS = [
  '#2563EB',
  '#DB2777',
  '#059669',
  '#7C3AED',
  '#D97706',
  '#0284C7',
];
const HAIR_COLORS = ['#1C1917', '#451A03', '#78350F', '#292524'];
const CAR_COLORS = ['#DC2626', '#2563EB', '#059669', '#D97706', '#6D28D9'];

function rollRandomTipCents(): number {
  if (Math.random() >= RANDOM_TIP_CHANCE) return 0;
  return RANDOM_TIP_AMOUNTS_CENTS[
    Math.floor(Math.random() * RANDOM_TIP_AMOUNTS_CENTS.length)
  ];
}

export function getAvailableMenuChoices(
  world: WorldSave,
  shift: ShiftSnapshot
): DrinkType[] {
  const baseDrinks: DrinkType[] = (
    world.unlockedRecipes.length > 0 ? world.unlockedRecipes : ['tea']
  ).filter((d) => d === 'tea' || d === 'doodh_patti' || d === 'coffee');
  const pool: DrinkType[] = baseDrinks.length > 0 ? [...baseDrinks] : ['tea'];

  const trays = shift.trayItems ?? [shift.trayItem ?? null];
  const snackTrays = shift.snackTrayItems ?? [null, null];

  const hasBiscuitStock =
    shift.inventory.biscuits > 0 ||
    shift.player.holding === 'biscuit_pack' ||
    trays.includes('biscuit_pack');
  const hasCupcakeStock =
    shift.inventory.cupcakes > 0 ||
    shift.player.holding === 'cupcake' ||
    trays.includes('cupcake');

  if (hasBiscuitStock && !pool.includes('biscuit_pack')) {
    pool.push('biscuit_pack');
  }
  if (hasCupcakeStock && !pool.includes('cupcake')) {
    pool.push('cupcake');
  }

  if (world.hasSnacksCart) {
    const hasSamosaStock =
      shift.inventory.samosaMix > 0 ||
      shift.player.holding === 'hot_samosa' ||
      shift.player.holding === 'raw_samosa' ||
      snackTrays.includes('hot_samosa') ||
      trays.includes('hot_samosa');
    const hasPakoraStock =
      shift.inventory.pakoraMix > 0 ||
      shift.player.holding === 'hot_pakora' ||
      shift.player.holding === 'raw_pakora' ||
      snackTrays.includes('hot_pakora') ||
      trays.includes('hot_pakora');

    if (hasSamosaStock || !hasPakoraStock) {
      pool.push('samosa');
    }
    if (hasPakoraStock || !hasSamosaStock) {
      pool.push('pakora');
    }
  }

  return pool;
}

function pickCustomerOrder(world: WorldSave, shift: ShiftSnapshot): DrinkType {
  const pool = getAvailableMenuChoices(world, shift);
  return pool[Math.floor(Math.random() * pool.length)];
}

function maybeUnlockLevel2(
  world: WorldSave,
  shift: ShiftSnapshot,
  events: SimStepEvents
): void {
  if (world.stage === 1 && world.totalServed >= LEVEL2_SERVED_THRESHOLD) {
    world.stage = 2;
    shift.stage = 2;
    shift.milkman.nextArrivalElapsed =
      shift.shiftDuration - shift.timeLeft + 10;
    events.leveledUpTo2 = true;
    events.sounds.push('level_up');
  }
}

function spawnCustomerWave(shift: ShiftSnapshot, world: WorldSave): void {
  const maxCust = world.hasSnacksCart ? 7 : 6;
  if (shift.customers.length >= maxCust) return;

  const usedChaiSlots = new Set(
    shift.customers
      .filter(
        (c) =>
          c.status !== 'walking_out' &&
          !c.targetChairId &&
          !c.seatedChairId &&
          c.orderDrink !== 'samosa' &&
          c.orderDrink !== 'pakora'
      )
      .map((c) => c.slotIndex)
  );
  const freeChaiSlots = CUSTOMER_SLOTS.map((_, i) => i).filter(
    (i) => !usedChaiSlots.has(i)
  );

  const usedSnackSlots = new Set(
    shift.customers
      .filter(
        (c) =>
          c.status !== 'walking_out' &&
          !c.targetChairId &&
          !c.seatedChairId &&
          (c.orderDrink === 'samosa' || c.orderDrink === 'pakora')
      )
      .map((c) => c.slotIndex)
  );
  const freeSnackSlots = SNACK_CUSTOMER_SLOTS.map((_, i) => i).filter(
    (i) => !usedSnackSlots.has(i)
  );

  const fromLeft = shift.nextCustomerSeq % 2 === 1;
  const maxSpawn = Math.random() < 0.38 ? 2 : 1;

  for (let i = 0; i < maxSpawn; i++) {
    let orderDrink = pickCustomerOrder(world, shift);
    let isFried = orderDrink === 'samosa' || orderDrink === 'pakora';
    const openChair = findAvailableChair(shift, world);

    let slotIndex = 0;
    if (!openChair) {
      if (isFried) {
        const nextSnackSlot = freeSnackSlots.shift();
        if (nextSnackSlot !== undefined) {
          slotIndex = nextSnackSlot;
        } else {
          // Fall back to chai stall menu if snack counter full
          const nextChai = freeChaiSlots.shift();
          if (nextChai === undefined) break;
          orderDrink = 'tea';
          isFried = false;
          slotIndex = nextChai;
        }
      } else {
        const nextChai = freeChaiSlots.shift();
        if (nextChai === undefined) break;
        slotIndex = nextChai;
      }
    }

    const slot = isFried
      ? SNACK_CUSTOMER_SLOTS[slotIndex % SNACK_CUSTOMER_SLOTS.length]
      : CUSTOMER_SLOTS[slotIndex % CUSTOMER_SLOTS.length];
    const targetX = openChair ? openChair.x : slot.x;
    const targetZ = openChair ? openChair.z : slot.z;
    const maxPatience = (openChair ? 105 : 80) + Math.random() * 20;

    const cust: TeaCustomer = {
      id: `cust_${shift.nextCustomerSeq}`,
      seq: shift.nextCustomerSeq,
      slotIndex,
      x: (fromLeft ? -17.2 : 19.8) + (i === 1 ? (fromLeft ? -2.1 : 2.1) : 0),
      z: 1.05 + i * 0.42,
      yaw: fromLeft ? Math.PI / 2 : -Math.PI / 2,
      targetX,
      targetZ,
      status: 'walking_in',
      orderDrink,
      patience: maxPatience,
      maxPatience,
      drinkTimer: 0,
      walkCycle: 0,
      shirtColor: SHIRT_COLORS[shift.nextCustomerSeq % SHIRT_COLORS.length],
      hairColor: HAIR_COLORS[shift.nextCustomerSeq % HAIR_COLORS.length],
      targetChairId: openChair ? openChair.id : null,
      seatedChairId: null,
      selfServeWait: 0,
    };

    shift.nextCustomerSeq += 1;
    shift.customers.push(cust);
  }
}

function findNearestUnoccupiedFurniture(
  shift: ShiftSnapshot,
  world: WorldSave,
  kind?: 'chair' | 'table'
): CafeFurniture | null {
  const p = shift.player;
  const occupiedChairs = new Set<string>();
  if (shift.player.sittingChairId) occupiedChairs.add(shift.player.sittingChairId);
  for (const c of shift.customers) {
    if (c.seatedChairId) occupiedChairs.add(c.seatedChairId);
    if (c.targetChairId) occupiedChairs.add(c.targetChairId);
  }

  let best: CafeFurniture | null = null;
  let bestDist = 1.25;
  for (const item of world.furniture) {
    if (kind && item.kind !== kind) continue;
    if (item.kind === 'chair' && occupiedChairs.has(item.id)) continue;
    const d = Math.hypot(item.x - p.x, item.z - p.z);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

export interface TargetLookup {
  kind: InteractTargetKind;
  x: number;
  z: number;
  prompt: string;
  customerId?: string;
  furnitureId?: string;
  trayIndex?: number;
  buildingId?: ShopBuildingId;
}

export function findInteractTarget(
  shift: ShiftSnapshot,
  world: WorldSave
): TargetLookup | null {
  const p = shift.player;

  // 0. Player sitting on a chair
  if (p.sittingChairId) {
    const chair = world.furniture.find((f) => f.id === p.sittingChairId);
    return {
      kind: 'stand_up',
      x: chair ? chair.x : p.x,
      z: chair ? chair.z : p.z,
      prompt: 'Sitting · [E] or Move (WASD) to Stand Up',
    };
  }

  // 1. Carrying a Chair or Table -> Place anywhere on outdoor sidewalk or inside rented shop
  const carryingFurn = heldFurnitureKind(p.holding);
  if (carryingFurn) {
    const drop = getFurnitureDropSpot(p);
    const valid = canPlaceFurnitureAt(drop.x, drop.z, world.furniture, world);
    const label = carryingFurn === 'chair' ? 'Chair' : 'Table';
    return {
      kind: 'place_furniture',
      x: drop.x,
      z: drop.z,
      prompt: valid
        ? `[E] Place ${label} Here`
        : `Move to open sidewalk or rented shop floor to place ${label}`,
    };
  }

  const heldDrink = heldHotDrinkType(p.holding);

  // 2. Serving hot drinks / snacks / samosa / pakora to matching walk-up / seated Customer, Mart Owner, or Car
  if (heldDrink) {
    let bestCust: TeaCustomer | null = null;
    let bestDist = Infinity;
    for (const c of shift.customers) {
      if (c.status !== 'waiting' || c.orderDrink !== heldDrink) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      const maxServeDist = c.seatedChairId ? 2.45 : 3.45;
      if (d < maxServeDist && d < bestDist) {
        bestDist = d;
        bestCust = c;
      }
    }
    if (bestCust) {
      const info = DRINK_CATALOG[bestCust.orderDrink] ?? DRINK_CATALOG.tea;
      return {
        kind: 'customer',
        x: bestCust.x,
        z: bestCust.z,
        customerId: bestCust.id,
        prompt: `[E] Serve ${info.name} (+${formatMoney(info.priceCents)})`,
      };
    }

    const owner = shift.supermarketOwner;
    if (owner.phase === 'ordering_chai' && owner.orderDrink === heldDrink) {
      const dOwn = Math.hypot(owner.x - p.x, owner.z - p.z);
      if (dOwn < 3.1) {
        const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
        return {
          kind: 'owner_customer',
          x: owner.x,
          z: owner.z,
          prompt: `[E] Serve Mart Owner ${info.name} (+${formatMoney(info.priceCents)})`,
        };
      }
    }

    if (
      shift.carCustomer.phase === 'waiting' &&
      (shift.carCustomer.orderDrink || 'tea') === heldDrink
    ) {
      const dCar = Math.hypot(
        shift.carCustomer.x - p.x,
        shift.carCustomer.z - p.z
      );
      if (dCar < 3.1) {
        const info = DRINK_CATALOG[shift.carCustomer.orderDrink] ?? DRINK_CATALOG.tea;
        return {
          kind: 'car',
          x: shift.carCustomer.x,
          z: shift.carCustomer.z,
          prompt: `[E] Serve Car (${shift.carCustomer.qtyServed + 1}/${shift.carCustomer.qtyTotal} ${info.name} · +${formatMoney(info.priceCents)})`,
        };
      }
    }
  }

  // 3. Chai Readi Stations + 2nd Snacks Readi Stations
  const hasDoodhPatti = world.unlockedRecipes.includes('doodh_patti');
  const hasCoffee = world.unlockedRecipes.includes('coffee');
  const hasSnacksRecipe =
    world.unlockedRecipes.includes('samosa') ||
    world.unlockedRecipes.includes('pakora');

  const makeTrayPrompt = (trayVal: HeldItem, areaName: string): string => {
    if (trayVal && p.holding && isSwappableCounterItem(p.holding)) {
      return `[E] Swap ${HELD_ITEM_LABELS[p.holding]} <-> ${HELD_ITEM_LABELS[trayVal]}`;
    }
    if (trayVal) {
      return p.holding === null
        ? `[E] Pick up ${HELD_ITEM_LABELS[trayVal]} from ${areaName}`
        : `${areaName} holds ${HELD_ITEM_LABELS[trayVal]}`;
    }
    return p.holding !== null
      ? `[E] Place ${HELD_ITEM_LABELS[p.holding]} on ${areaName} (Customers auto-pickup!)`
      : `${areaName} (Place drinks/snacks for self-serve!)`;
  };

  const trays = shift.trayItems ?? [shift.trayItem ?? null, null, null, null];
  const snackTrays = shift.snackTrayItems ?? [null, null];
  const isPlayerInFrontOfStall = p.z > CYCLE_ANCHOR.z - 0.1;

  const candidates: Array<{
    kind:
      | 'cups'
      | 'tea_tin'
      | 'coffee_jar'
      | 'sugar_jar'
      | 'water_jug'
      | 'milk_crate'
      | 'biscuit_box'
      | 'cupcake_box'
      | 'kettle'
      | 'counter_tray'
      | 'snack_plates'
      | 'samosa_prep'
      | 'pakora_prep'
      | 'kadhai'
      | 'snack_tray';
    x: number;
    z: number;
    prompt: string;
    priority: number;
    trayIndex?: number;
  }> = [
    ...TRAY_SPOTS.map((spot, idx) => {
      const slotVal = trays[idx] ?? null;
      const canPlaceOrSwap =
        (p.holding === null && slotVal !== null) ||
        (p.holding !== null && isSwappableCounterItem(p.holding));
      const basePriority = canPlaceOrSwap
        ? isPlayerInFrontOfStall || heldDrink !== null
          ? 0.58
          : 0.34
        : -0.2;
      return {
        kind: 'counter_tray' as const,
        x: spot.x,
        z: spot.z,
        trayIndex: idx,
        prompt: makeTrayPrompt(slotVal, 'Readi Space'),
        priority: basePriority,
      };
    }),
    {
      kind: 'cupcake_box',
      x: STATIONS.cupcake_box.x,
      z: STATIONS.cupcake_box.z,
      prompt:
        shift.inventory.cupcakes <= 0
          ? 'No Mini Cupcakes! Buy inside Supermarket'
          : p.holding === 'biscuit_pack' || p.holding === 'empty_cup'
            ? `[E] Swap for Mini Cupcake (${shift.inventory.cupcakes} left)`
            : `[E] Take Mini Cupcake (${shift.inventory.cupcakes} left)`,
      priority:
        shift.inventory.cupcakes > 0 &&
        (p.holding === null || p.holding === 'biscuit_pack')
          ? 0.52
          : -0.05,
    },
    {
      kind: 'biscuit_box',
      x: STATIONS.biscuit_box.x,
      z: STATIONS.biscuit_box.z,
      prompt:
        shift.inventory.biscuits <= 0
          ? 'No Biscuits! Buy inside Supermarket'
          : p.holding === 'cupcake' || p.holding === 'empty_cup'
            ? `[E] Swap for Tea Biscuits (${shift.inventory.biscuits} left)`
            : `[E] Take Tea Biscuits (${shift.inventory.biscuits} left)`,
      priority:
        shift.inventory.biscuits > 0 &&
        (p.holding === null || p.holding === 'cupcake')
          ? 0.52
          : -0.05,
    },
    {
      kind: 'cups',
      x: STATIONS.cups.x,
      z: STATIONS.cups.z,
      prompt:
        shift.inventory.cups <= 0
          ? 'No Cups Left! Buy inside the Supermarket'
          : p.holding === 'biscuit_pack' || p.holding === 'cupcake'
            ? `[E] Swap for Disposable Cup (${shift.inventory.cups} left)`
            : `[E] Take Disposable Cup (${shift.inventory.cups} left)`,
      priority: p.holding === null ? 0.55 : 0,
    },
    {
      kind: 'tea_tin',
      x: STATIONS.tea_tin.x,
      z: STATIONS.tea_tin.z,
      prompt:
        shift.inventory.teaLeaves > 0
          ? `[E] Add Tea Leaves (${shift.inventory.teaLeaves} left)`
          : 'No Tea Leaves! Buy inside the Supermarket',
      priority: p.holding === 'empty_cup' ? 0.6 : 0,
    },
    {
      kind: 'coffee_jar',
      x: STATIONS.coffee_jar.x,
      z: STATIONS.coffee_jar.z,
      prompt: !hasCoffee
        ? 'Coffee Recipe Locked (Buy inside Supermarket)'
        : shift.inventory.coffeePowder > 0
          ? `[E] Add Coffee Beans (${shift.inventory.coffeePowder} left)`
          : 'No Coffee Beans! Buy inside the Supermarket',
      priority: hasCoffee && p.holding === 'empty_cup' ? 0.55 : -0.1,
    },
    {
      kind: 'sugar_jar',
      x: STATIONS.sugar_jar.x,
      z: STATIONS.sugar_jar.z,
      prompt:
        shift.inventory.sugar > 0
          ? `[E] Add Sugar (${shift.inventory.sugar} left)`
          : 'No Sugar! Buy inside the Supermarket',
      priority:
        p.holding === 'cup_with_tea' || p.holding === 'cup_with_coffee'
          ? 0.65
          : 0,
    },
    {
      kind: 'water_jug',
      x: STATIONS.water_jug.x,
      z: STATIONS.water_jug.z,
      prompt:
        shift.inventory.water > 0
          ? `[E] Add Water (${shift.inventory.water}/${MAX_WATER_CAPACITY} left)`
          : 'Water Jug Empty! Refill Free at Water Tap',
      priority:
        p.holding === 'cup_with_tea_sugar' ||
        p.holding === 'cup_with_coffee_sugar'
          ? 0.68
          : 0,
    },
    {
      kind: 'milk_crate',
      x: STATIONS.milk_crate.x,
      z: STATIONS.milk_crate.z,
      prompt: !hasDoodhPatti
        ? 'Doodh Patti Locked (Buy Recipe inside Supermarket)'
        : shift.inventory.milkPackets > 0
          ? `[E] Add Milk Packet (${shift.inventory.milkPackets} left)`
          : 'No Milk Packets! Buy from Milkman on Bike',
      priority: hasDoodhPatti && p.holding === 'cup_with_tea_sugar' ? 0.7 : -0.1,
    },
    {
      kind: 'kettle',
      x: STATIONS.kettle.x,
      z: STATIONS.kettle.z,
      prompt:
        shift.kettle.status === 'ready' && shift.kettle.brewingDrink
          ? p.holding === 'cup_with_tea_water' ||
            p.holding === 'cup_with_doodh_patti_mix' ||
            p.holding === 'cup_with_coffee_water'
            ? `[E] Swap & Boil Next Cup`
            : `[E] Take Hot ${(DRINK_CATALOG[shift.kettle.brewingDrink] ?? DRINK_CATALOG.tea).name}`
          : shift.kettle.status === 'brewing'
            ? `Boiling... ${Math.round(shift.kettle.progress * 100)}%`
            : '[E] Boil on Kettle',
      priority:
        (p.holding === null && shift.kettle.status === 'ready') ||
        (shift.kettle.status === 'idle' &&
          (p.holding === 'cup_with_tea_water' ||
            p.holding === 'cup_with_doodh_patti_mix' ||
            p.holding === 'cup_with_coffee_water'))
          ? 0.72
          : 0,
    },
  ];

  // 2nd Readi Stations (when purchased)
  if (world.hasSnacksCart) {
    candidates.push(
      ...SNACK_TRAY_SPOTS.map((spot, idx) => {
        const slotVal = snackTrays[idx] ?? null;
        const canPlaceOrSwap =
          (p.holding === null && slotVal !== null) ||
          (p.holding !== null && isSwappableCounterItem(p.holding));
        return {
          kind: 'snack_tray' as const,
          x: spot.x,
          z: spot.z,
          trayIndex: idx,
          prompt: makeTrayPrompt(slotVal, 'Snacks Showcase'),
          priority: canPlaceOrSwap ? 0.58 : -0.15,
        };
      }),
      {
        kind: 'snack_plates',
        x: SNACK_STATIONS.snack_plates.x,
        z: SNACK_STATIONS.snack_plates.z,
        prompt:
          p.holding === null
            ? '[E] Take Paper Plate (Free)'
            : 'Empty hands to take Paper Plate',
        priority: p.holding === null ? 0.56 : -0.1,
      },
      {
        kind: 'samosa_prep',
        x: SNACK_STATIONS.samosa_prep.x,
        z: SNACK_STATIONS.samosa_prep.z,
        prompt:
          shift.inventory.samosaMix <= 0
            ? 'No Aloo Samosa Mix! Buy inside Supermarket'
            : '[E] Put Raw Aloo Samosa on Plate',
        priority: p.holding === 'paper_plate' ? 0.64 : 0,
      },
      {
        kind: 'pakora_prep',
        x: SNACK_STATIONS.pakora_prep.x,
        z: SNACK_STATIONS.pakora_prep.z,
        prompt:
          shift.inventory.pakoraMix <= 0
            ? 'No Besan Pakora Mix! Buy inside Supermarket'
            : '[E] Scoop Raw Pakora Mix onto Plate',
        priority: p.holding === 'paper_plate' ? 0.64 : 0,
      },
      {
        kind: 'kadhai',
        x: SNACK_STATIONS.kadhai.x,
        z: SNACK_STATIONS.kadhai.z,
        prompt:
          shift.fryer.status === 'ready' && shift.fryer.fryingSnack
            ? p.holding === 'raw_samosa' || p.holding === 'raw_pakora'
              ? '[E] Swap & Fry Next Batch'
              : `[E] Take Hot ${(DRINK_CATALOG[shift.fryer.fryingSnack] ?? DRINK_CATALOG.samosa).name}`
            : shift.fryer.status === 'frying'
              ? `Frying in Oil... ${Math.round(shift.fryer.progress * 100)}%`
              : shift.inventory.cookingOil <= 0
                ? 'No Cooking Oil! Buy inside Supermarket'
                : `[E] Fry Samosa/Pakora (${shift.inventory.cookingOil} oil)`,
        priority:
          (p.holding === null && shift.fryer.status === 'ready') ||
          (shift.fryer.status === 'idle' &&
            (p.holding === 'raw_samosa' || p.holding === 'raw_pakora'))
            ? 0.72
            : 0,
      }
    );
  }

  let bestStation: (typeof candidates)[number] | null = null;
  let bestStationScore = Infinity;
  for (const cand of candidates) {
    const d = Math.hypot(cand.x - p.x, cand.z - p.z);
    if (d > 1.85) continue;
    const score = d - cand.priority;
    if (score < bestStationScore) {
      bestStationScore = score;
      bestStation = cand;
    }
  }
  if (bestStation) {
    return {
      kind: bestStation.kind,
      x: bestStation.x,
      z: bestStation.z,
      prompt: bestStation.prompt,
      trayIndex: bestStation.trayIndex,
    };
  }

  // 3b. Reserved 2nd Readi Plot (when not yet bought)
  if (!world.hasSnacksCart) {
    const dPlot = Math.hypot(
      SNACKS_CART_ANCHOR.x - p.x,
      SNACKS_CART_ANCHOR.z - p.z
    );
    if (dPlot < 2.2) {
      return {
        kind: 'buy_snacks_cart',
        x: SNACKS_CART_ANCHOR.x,
        z: SNACKS_CART_ANCHOR.z,
        prompt: !hasSnacksRecipe
          ? `2nd Readi Spot · First buy Samosa & Pakora Recipe in Supermarket (${formatMoney(DRINK_CATALOG.samosa.unlockCostCents)})!`
          : `[E] Buy 2nd Readi (Samosa & Pakora Cart) · ${formatMoney(SNACKS_CART_PRICE_CENTS)}`,
      };
    }
  }

  // 4. Poor Kid ("Chotu") Sitting Outside Supermarket (Charity or 1-Day Job!)
  if (shift.helper.status === 'sitting') {
    const dKid = Math.hypot(KID_SIT_POS.x - p.x, KID_SIT_POS.z - p.z);
    if (dKid < 1.95) {
      return {
        kind: 'helper_kid',
        x: KID_SIT_POS.x,
        z: KID_SIT_POS.z,
        prompt: '[E] Talk to Boy Outside Market ($0.25 Help or Hire Helper)',
      };
    }
  }

  // 5. Milkman on Motorcycle (only when parked)
  if (shift.milkman.phase === 'parked') {
    const dMilk = Math.hypot(shift.milkman.x - p.x, shift.milkman.z - p.z);
    if (dMilk < 2.65) {
      return {
        kind: 'milkman',
        x: shift.milkman.x,
        z: shift.milkman.z,
        prompt: '[E] Buy Milk Packets (Milkman)',
      };
    }
  }

  // 6. Free Water Tap & Side Trash Bin
  const dWaterTap = Math.hypot(WATER_TAP_POS.x - p.x, WATER_TAP_POS.z - p.z);
  const dTrash = Math.hypot(TRASH_BIN_POS.x - p.x, TRASH_BIN_POS.z - p.z);
  if (
    dTrash < 1.55 &&
    p.holding !== null &&
    heldFurnitureKind(p.holding) === null
  ) {
    return {
      kind: 'trash',
      x: TRASH_BIN_POS.x,
      z: TRASH_BIN_POS.z,
      prompt: `[E] Discard ${HELD_ITEM_LABELS[p.holding]}`,
    };
  }
  if (dWaterTap < 1.85) {
    return {
      kind: 'water_tap',
      x: WATER_TAP_POS.x,
      z: WATER_TAP_POS.z,
      prompt:
        shift.inventory.water >= MAX_WATER_CAPACITY
          ? `Water Tank Full (${shift.inventory.water}/${MAX_WATER_CAPACITY})`
          : `[E] Refill Free Water (+${WATER_TAP_REFILL_AMOUNT}) · ${shift.inventory.water}/${MAX_WATER_CAPACITY}`,
    };
  }
  if (dTrash < 1.55) {
    return {
      kind: 'trash',
      x: TRASH_BIN_POS.x,
      z: TRASH_BIN_POS.z,
      prompt: 'Trash Bin (Bring unwanted cup/plate here to discard)',
    };
  }

  // 7. Open Rentable Buildings -> Meet Building Owner Inside!
  for (const b of RENTABLE_BUILDINGS) {
    const dOwner = Math.hypot(
      b.counterPos.x - p.x,
      b.counterPos.z + 0.7 - p.z
    );
    if (dOwner < 2.1) {
      const rec = world.rentedShops.find((r) => r.buildingId === b.id);
      const isDue = rec && world.day >= rec.nextRentDueDay;
      return {
        kind: 'building_owner',
        x: b.ownerPos.x,
        z: b.ownerPos.z,
        buildingId: b.id,
        prompt: !rec
          ? `[E] Meet ${b.ownerName} · Rent ${b.shopName} (${formatMoney(b.weeklyRentCents)}/wk)`
          : isDue
            ? `[E] Pay ${b.ownerName} Weekly Rent (${formatMoney(b.weeklyRentCents)})!`
            : `[E] Meet ${b.ownerName} · ${b.shopName} (Paid until Day ${rec.nextRentDueDay})`,
      };
    }
  }

  // 8. Supermarket Furniture Pickup Pad
  if (world.pendingFurniture.length > 0) {
    const dPickup = Math.hypot(
      SUPERMARKET_PICKUP_POS.x - p.x,
      SUPERMARKET_PICKUP_POS.z - p.z
    );
    if (dPickup < 1.75) {
      const nextKind = world.pendingFurniture[0];
      const nextLabel = nextKind === 'chair' ? 'Chair' : 'Table';
      return {
        kind: 'supermarket_pickup',
        x: SUPERMARKET_PICKUP_POS.x,
        z: SUPERMARKET_PICKUP_POS.z,
        prompt:
          p.holding === null
            ? `[E] Pick Up Bought ${nextLabel} (${world.pendingFurniture.length} waiting)`
            : `Empty hands to pick up ${nextLabel} (${world.pendingFurniture.length} waiting)`,
      };
    }
  }

  // 9. Walk-In Supermarket Interactive Zones
  const smSpots = [
    {
      x: SUPERMARKET_COUNTER_POS.x,
      z: SUPERMARKET_COUNTER_POS.z + 0.55,
      prompt: '[E] Supermarket Counter (Supplies, 2nd Readi & Recipes)',
    },
    {
      x: SUPERMARKET_AISLE_POS.x,
      z: SUPERMARKET_AISLE_POS.z,
      prompt: '[E] Supermarket Shelves (Tea, Sugar, Beans, Samosa & Pakora Mix)',
    },
    {
      x: SUPERMARKET_FURNITURE_POS.x,
      z: SUPERMARKET_FURNITURE_POS.z,
      prompt: '[E] Supermarket Furniture Display (Buy Chairs & Tables)',
    },
  ];
  let bestSm: (typeof smSpots)[number] | null = null;
  let bestSmDist = 2.05;
  for (const s of smSpots) {
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < bestSmDist) {
      bestSmDist = d;
      bestSm = s;
    }
  }
  if (bestSm) {
    const ownerInShop = isOwnerInsideSupermarket(shift.supermarketOwner);
    return {
      kind: 'supermarket',
      x: bestSm.x,
      z: bestSm.z,
      prompt: ownerInShop
        ? bestSm.prompt
        : 'Mart Owner is outside — wait for him to return inside!',
    };
  }

  // 10. Placed Cafe Chairs & Tables (Sit or Pick Up to Move)
  const nearFurn = findNearestUnoccupiedFurniture(shift, world);
  if (nearFurn) {
    if (nearFurn.kind === 'chair') {
      return {
        kind: 'furniture_chair',
        x: nearFurn.x,
        z: nearFurn.z,
        furnitureId: nearFurn.id,
        prompt:
          p.holding === null
            ? '[E] Sit on Chair · [F] Pick Up & Move Chair'
            : '[E] Sit on Chair',
      };
    }
    if (p.holding === null) {
      return {
        kind: 'furniture_table',
        x: nearFurn.x,
        z: nearFurn.z,
        furnitureId: nearFurn.id,
        prompt: '[E] Pick Up & Move Table',
      };
    }
  }

  // 11. Waiting walk-up Customer or Car for [F] Offer/Reject
  let nearAnyCustomer: TeaCustomer | null = null;
  let nearAnyDist = Infinity;
  for (const c of shift.customers) {
    if (c.status !== 'waiting') continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    const maxActionDist = c.seatedChairId ? 2.25 : 3.25;
    if (d < maxActionDist && d < nearAnyDist) {
      nearAnyDist = d;
      nearAnyCustomer = c;
    }
  }
  if (nearAnyCustomer) {
    const info = DRINK_CATALOG[nearAnyCustomer.orderDrink] ?? DRINK_CATALOG.tea;
    return {
      kind: 'customer',
      x: nearAnyCustomer.x,
      z: nearAnyCustomer.z,
      customerId: nearAnyCustomer.id,
      prompt: heldDrink
        ? `Wants ${info.name} · [F] Offer ${(DRINK_CATALOG[heldDrink] ?? DRINK_CATALOG.tea).name} / Reject`
        : `Wants ${info.name} · [F] Offer Another / Reject`,
    };
  }

  if (shift.carCustomer.phase === 'waiting') {
    const dCar = Math.hypot(
      shift.carCustomer.x - p.x,
      shift.carCustomer.z - p.z
    );
    if (dCar < 3.1) {
      const info = DRINK_CATALOG[shift.carCustomer.orderDrink] ?? DRINK_CATALOG.tea;
      return {
        kind: 'car',
        x: shift.carCustomer.x,
        z: shift.carCustomer.z,
        prompt: heldDrink
          ? `Car wants ${info.name} · [F] Offer ${(DRINK_CATALOG[heldDrink] ?? DRINK_CATALOG.tea).name} / Reject`
          : `Car wants ${shift.carCustomer.qtyTotal}x ${info.name} · [F] Offer / Reject`,
      };
    }
  }

  return null;
}

export function findNearestCustomerForAction(
  shift: ShiftSnapshot
): { kind: 'customer' | 'car'; id: string; requestedDrink: DrinkType } | null {
  const p = shift.player;
  let bestCust: TeaCustomer | null = null;
  let bestDist = Infinity;
  for (const c of shift.customers) {
    if (c.status !== 'waiting') continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    const maxDist = c.seatedChairId ? 2.45 : 3.35;
    if (d < maxDist && d < bestDist) {
      bestDist = d;
      bestCust = c;
    }
  }
  if (bestCust) {
    return {
      kind: 'customer',
      id: bestCust.id,
      requestedDrink: bestCust.orderDrink,
    };
  }
  if (shift.carCustomer.phase === 'waiting') {
    const dCar = Math.hypot(
      shift.carCustomer.x - p.x,
      shift.carCustomer.z - p.z
    );
    if (dCar < 3.4) {
      return {
        kind: 'car',
        id: 'car_customer',
        requestedDrink: shift.carCustomer.orderDrink,
      };
    }
  }
  return null;
}

export function getGuidedHint(shift: ShiftSnapshot, world: WorldSave): string {
  if (shift.player.sittingChairId) {
    return 'Relaxing on Cafe Chair — move (WASD) or press E to stand back up.';
  }

  const overdueShop = world.rentedShops.find((r) => world.day >= r.nextRentDueDay);
  if (overdueShop) {
    const b = RENTABLE_BUILDINGS.find((x) => x.id === overdueShop.buildingId);
    if (b) {
      return `Weekly rent due for ${b.shopName}! Walk inside and meet ${b.ownerName} (E) to pay ${formatMoney(b.weeklyRentCents)}.`;
    }
  }

  if (
    shift.player.holding === 'carried_chair' ||
    shift.player.holding === 'carried_table'
  ) {
    return 'Walk to open sidewalk or inside a rented shop and press E to place it down!';
  }
  if (
    shift.player.holding === 'biscuit_pack' ||
    shift.player.holding === 'cupcake' ||
    shift.player.holding === 'hot_samosa' ||
    shift.player.holding === 'hot_pakora'
  ) {
    return `Serve ${HELD_ITEM_LABELS[shift.player.holding]} to customer (E) or place on Readi Free Space for auto-pickup!`;
  }

  if (shift.supermarketOwner.phase === 'ordering_chai') {
    const oInfo = DRINK_CATALOG[shift.supermarketOwner.orderDrink] ?? DRINK_CATALOG.tea;
    return `Supermarket Owner is waiting at your Readi for ${oInfo.name}!`;
  }

  if (shift.milkman.phase === 'parked' && world.stage >= 2) {
    if (
      world.unlockedRecipes.includes('doodh_patti') &&
      shift.inventory.milkPackets <= 2
    ) {
      return 'Milkman parked on the curb! Press E near him to buy Milk Packets.';
    }
  }

  if (shift.inventory.water <= 2) {
    return 'Water Jug is low! Refill free at the Blue Water Tap on the sidewalk (E).';
  }

  if (shift.kettle.status === 'ready' && shift.player.holding === null) {
    return 'Drink is boiled! Walk to the Kettle and press E to pick it up.';
  }
  if (shift.fryer.status === 'ready' && shift.player.holding === null) {
    return 'Crispy Samosa/Pakora ready in Kadhai! Press E at the 2nd Readi to grab it.';
  }

  switch (shift.player.holding) {
    case null:
      if (shift.inventory.cups <= 0) {
        return 'Out of Cups! Walk inside the Open Supermarket on the right and press E.';
      }
      return 'Take a Cup (E), talk to Boy outside Market (E), or walk inside ANY open shop building to rent!';
    case 'empty_cup':
      return world.unlockedRecipes.includes('coffee')
        ? 'Add Tea Leaves (Chai/Doodh Patti) OR Coffee Beans (Coffee) at Chai Readi.'
        : 'Add Tea Leaves at the green Tea Tin (E).';
    case 'cup_with_tea':
      return 'Add Sugar at the Sugar Jar (E).';
    case 'cup_with_tea_sugar':
      return world.unlockedRecipes.includes('doodh_patti')
        ? 'Add Water (E) for Simple Chai, OR add Milk Packet (E) for $1.00 Doodh Patti!'
        : 'Add Water at the Readi Water Jug (E) next!';
    case 'cup_with_tea_water':
      return 'Walk to the Kettle Stove and press E to boil Simple Chai!';
    case 'cup_with_doodh_patti_mix':
      return 'Walk to the Kettle Stove and press E to boil Doodh Patti!';
    case 'cup_with_coffee':
      return 'Add Sugar at the Sugar Jar (E).';
    case 'cup_with_coffee_sugar':
      return 'Add Water at the Readi Water Jug (E) next!';
    case 'cup_with_coffee_water':
      return 'Walk to the Kettle Stove and press E to boil Street Coffee!';
    case 'paper_plate':
      return 'Pick Aloo Samosa or Besan Pakora Mix on the 2nd Readi (E)!';
    case 'raw_samosa':
    case 'raw_pakora':
      return 'Walk to the Hot Oil Kadhai on the 2nd Readi and press E to fry!';
    case 'hot_tea':
    case 'hot_doodh_patti':
    case 'hot_coffee':
      return 'Serve customer (E), or place on Readi Free Space (E) so customers auto-pick & pay!';
  }
}

function resolveCollisionBox(
  p: { x: number; z: number },
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  radius: number
): void {
  const cx = clamp(p.x, minX, maxX);
  const cz = clamp(p.z, minZ, maxZ);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq < radius * radius) {
    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      const push = radius - dist;
      p.x += (dx / dist) * push;
      p.z += (dz / dist) * push;
    } else {
      p.z -= radius;
    }
  }
}

function resolveCollisionCircle(
  p: { x: number; z: number },
  cx: number,
  cz: number,
  minDist: number
): void {
  const dx = p.x - cx;
  const dz = p.z - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq < minDist * minDist) {
    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      const push = minDist - dist;
      p.x += (dx / dist) * push;
      p.z += (dz / dist) * push;
    } else {
      p.z += minDist;
    }
  }
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function resolveAllBuildingCollisions(
  p: { x: number; z: number },
  radius: number
): void {
  // Back walls across alley gaps behind building row
  resolveCollisionBox(p, -22, -16.2, -12, -5.6, radius);
  resolveCollisionBox(p, -9.6, -6.4, -12, -5.6, radius);
  resolveCollisionBox(p, 1.2, 4.4, -12, -5.6, radius);
  resolveCollisionBox(p, 12.8, 13.6, -12, -5.6, radius);
  resolveCollisionBox(p, 19.6, 24, -12, -5.6, radius);

  // All 3 Open Walk-In Rentable Buildings (walls + front pillars + interior counter)
  for (const b of RENTABLE_BUILDINGS) {
    const { minX, maxX, minZ, maxZ } = b.bounds;
    // Back wall
    resolveCollisionBox(p, minX, maxX, minZ - 0.35, minZ + 0.16, radius);
    // Left wall
    resolveCollisionBox(p, minX - 0.2, minX + 0.16, minZ, maxZ, radius);
    // Right wall
    resolveCollisionBox(p, maxX - 0.16, maxX + 0.2, minZ, maxZ, radius);
    // Front wall left & right of open doorway
    resolveCollisionBox(p, minX, b.doorMinX, maxZ - 0.16, maxZ + 0.14, radius);
    resolveCollisionBox(p, b.doorMaxX, maxX, maxZ - 0.16, maxZ + 0.14, radius);
    // Interior desk/counter
    resolveCollisionBox(
      p,
      b.counterPos.x - 1.05,
      b.counterPos.x + 1.05,
      b.counterPos.z - 0.34,
      b.counterPos.z + 0.34,
      radius
    );
  }

  // Open Walk-In Supermarket walls, front-left pillar & counters
  resolveCollisionBox(p, 4.3, 4.55, -8.9, -6.5, radius);
  resolveCollisionBox(
    p,
    SUPERMARKET_BOUNDS.minX,
    SUPERMARKET_BOUNDS.minX + 0.28,
    SUPERMARKET_BOUNDS.maxZ - 0.14,
    SUPERMARKET_BOUNDS.maxZ + 0.14,
    radius
  );
  resolveCollisionBox(
    p,
    SUPERMARKET_BOUNDS.minX,
    SUPERMARKET_BOUNDS.maxX,
    SUPERMARKET_BOUNDS.minZ - 0.4,
    SUPERMARKET_BOUNDS.minZ + 0.14,
    radius
  );
  resolveCollisionBox(
    p,
    SUPERMARKET_BOUNDS.maxX - 0.14,
    SUPERMARKET_BOUNDS.maxX + 0.4,
    SUPERMARKET_BOUNDS.minZ,
    SUPERMARKET_BOUNDS.maxZ,
    radius
  );
  resolveCollisionBox(
    p,
    SUPERMARKET_COUNTER_POS.x - 1.25,
    SUPERMARKET_COUNTER_POS.x + 1.25,
    SUPERMARKET_COUNTER_POS.z - 0.55,
    SUPERMARKET_COUNTER_POS.z + 0.38,
    radius
  );
  resolveCollisionBox(
    p,
    SUPERMARKET_AISLE_POS.x - 1.3,
    SUPERMARKET_AISLE_POS.x + 1.3,
    SUPERMARKET_AISLE_POS.z - 0.42,
    SUPERMARKET_AISLE_POS.z + 0.42,
    radius
  );
  resolveCollisionBox(
    p,
    SUPERMARKET_FURNITURE_POS.x - 0.7,
    SUPERMARKET_FURNITURE_POS.x + 0.7,
    SUPERMARKET_FURNITURE_POS.z - 0.55,
    SUPERMARKET_FURNITURE_POS.z + 0.55,
    radius
  );
}

function isStaticBlockedForNpc(
  x: number,
  z: number,
  world: WorldSave,
  shift: ShiftSnapshot,
  opts: {
    ignoreChairId?: string | null;
    stayOnSidewalk?: boolean;
    allowRoadCurb?: boolean;
  }
): boolean {
  const maxAllowedZ = opts.allowRoadCurb ? 2.78 : 1.62;
  if (opts.stayOnSidewalk && (z > maxAllowedZ || z < -4.85)) {
    return true;
  }
  if (!opts.stayOnSidewalk && (z < SUPERMARKET_BOUNDS.minZ + 0.35 || z > maxAllowedZ)) {
    return true;
  }

  // Alley back walls & Open Supermarket walls/counters
  if (z < -5.2 && x < 4.35) {
    return true;
  }
  if (z < -3.6 && x > SUPERMARKET_BOUNDS.maxX - 0.35) {
    return true;
  }
  if (x > 4.05 && x < 4.78 && z < -6.2) {
    return true;
  }
  if (
    x > SUPERMARKET_BOUNDS.minX - 0.12 &&
    x < SUPERMARKET_BOUNDS.minX + 0.42 &&
    z > SUPERMARKET_BOUNDS.maxZ - 0.35 &&
    z < SUPERMARKET_BOUNDS.maxZ + 0.35
  ) {
    return true;
  }
  if (
    x > SUPERMARKET_COUNTER_POS.x - 1.5 &&
    x < SUPERMARKET_COUNTER_POS.x + 1.5 &&
    z > SUPERMARKET_COUNTER_POS.z - 0.78 &&
    z < SUPERMARKET_COUNTER_POS.z + 0.62
  ) {
    return true;
  }
  if (
    x > SUPERMARKET_AISLE_POS.x - 1.55 &&
    x < SUPERMARKET_AISLE_POS.x + 1.55 &&
    z > SUPERMARKET_AISLE_POS.z - 0.68 &&
    z < SUPERMARKET_AISLE_POS.z + 0.68
  ) {
    return true;
  }
  if (
    x > SUPERMARKET_FURNITURE_POS.x - 0.92 &&
    x < SUPERMARKET_FURNITURE_POS.x + 0.92 &&
    z > SUPERMARKET_FURNITURE_POS.z - 0.78 &&
    z < SUPERMARKET_FURNITURE_POS.z + 0.78
  ) {
    return true;
  }

  // 4-Wheel Chai Readi (7.4m x 1.64m — NO bike cockpit!)
  if (
    x > CYCLE_ANCHOR.x - 4.05 &&
    x < CYCLE_ANCHOR.x + 4.05 &&
    z > CYCLE_ANCHOR.z - 1.15 &&
    z < CYCLE_ANCHOR.z + 1.15
  ) {
    return true;
  }

  // 2nd Snacks Readi (4.8m x 1.64m)
  if (
    world.hasSnacksCart &&
    x > SNACKS_CART_ANCHOR.x - 2.75 &&
    x < SNACKS_CART_ANCHOR.x + 2.75 &&
    z > SNACKS_CART_ANCHOR.z - 1.15 &&
    z < SNACKS_CART_ANCHOR.z + 1.15
  ) {
    return true;
  }

  // Water Tap, Trash Bin & Sitting Kid Mat
  if (Math.hypot(x - WATER_TAP_POS.x, z - WATER_TAP_POS.z) < 0.72) return true;
  if (Math.hypot(x - TRASH_BIN_POS.x, z - TRASH_BIN_POS.z) < 0.52) return true;
  if (
    shift.helper.status === 'sitting' &&
    Math.hypot(x - KID_SIT_POS.x, z - KID_SIT_POS.z) < 0.65
  ) {
    return true;
  }

  // Milkman Bike when parked
  if (
    shift.milkman.phase !== 'away' &&
    x > shift.milkman.x - 1.45 &&
    x < shift.milkman.x + 1.45 &&
    z > shift.milkman.z - 0.85 &&
    z < shift.milkman.z + 0.85
  ) {
    return true;
  }

  // Car Customer when on road
  if (
    shift.carCustomer.phase !== 'away' &&
    x > shift.carCustomer.x - 2.05 &&
    x < shift.carCustomer.x + 2.05 &&
    z > shift.carCustomer.z - 1.1 &&
    z < shift.carCustomer.z + 1.1
  ) {
    return true;
  }

  // Placed Tables & Chairs
  for (const f of world.furniture) {
    if (f.kind === 'table') {
      if (
        x > f.x - 0.68 &&
        x < f.x + 0.68 &&
        z > f.z - 0.68 &&
        z < f.z + 0.68
      ) {
        return true;
      }
    } else if (f.id !== opts.ignoreChairId) {
      if (Math.hypot(x - f.x, z - f.z) < 0.56) {
        return true;
      }
    }
  }

  return false;
}

function findChairApproachSpot(
  chair: CafeFurniture,
  world: WorldSave,
  shift: ShiftSnapshot
): { x: number; z: number } {
  const offsets = [
    { dx: 0, dz: 0.72 },
    { dx: 0, dz: -0.72 },
    { dx: 0.72, dz: 0 },
    { dx: -0.72, dz: 0 },
    { dx: 0.55, dz: 0.55 },
    { dx: -0.55, dz: 0.55 },
    { dx: 0.55, dz: -0.55 },
    { dx: -0.55, dz: -0.55 },
  ];

  let bestSpot = { x: chair.x, z: chair.z + 0.72 };
  let bestScore = -Infinity;

  for (const off of offsets) {
    const sx = chair.x + off.dx;
    const sz = chair.z + off.dz;
    if (
      isStaticBlockedForNpc(sx, sz, world, shift, {
        ignoreChairId: chair.id,
        stayOnSidewalk: true,
      })
    ) {
      continue;
    }

    let minFurnDist = Infinity;
    for (const f of world.furniture) {
      if (f.id === chair.id) continue;
      const d = Math.hypot(sx - f.x, sz - f.z);
      if (d < minFurnDist) minFurnDist = d;
    }
    if (minFurnDist > bestScore) {
      bestScore = minFurnDist;
      bestSpot = { x: sx, z: sz };
    }
  }
  return bestSpot;
}

function isDynamicBlockedForNpc(
  x: number,
  z: number,
  shift: ShiftSnapshot,
  opts: { selfId?: string }
): boolean {
  const minClear = 0.62;
  if (!shift.player.sittingChairId) {
    if (Math.hypot(x - shift.player.x, z - shift.player.z) < minClear) {
      return true;
    }
  }
  for (const other of shift.customers) {
    if (other.id === opts.selfId || other.seatedChairId) continue;
    if (other.status === 'walking_out' && (other.x < -15.8 || other.x > 18.8)) {
      continue;
    }
    if (Math.hypot(x - other.x, z - other.z) < minClear) {
      return true;
    }
  }
  if (opts.selfId !== 'owner') {
    if (
      Math.hypot(x - shift.supermarketOwner.x, z - shift.supermarketOwner.z) <
      minClear
    ) {
      return true;
    }
  }
  if (opts.selfId !== 'helper' && shift.helper.status === 'hired') {
    if (Math.hypot(x - shift.helper.x, z - shift.helper.z) < minClear) {
      return true;
    }
  }
  for (const ped of shift.pedestrians) {
    if (ped.id === opts.selfId || ped.x < -15.8 || ped.x > 18.8) continue;
    if (Math.hypot(x - ped.x, z - ped.z) < minClear) {
      return true;
    }
  }
  return false;
}

interface NpcNavMemory {
  anchorX: number;
  anchorZ: number;
  windowTime: number;
  detourTimer: number;
  detourAngleOffset: number;
  bumpStreak: number;
  flipSign: 1 | -1;
}

const npcNavMemory = new Map<string, NpcNavMemory>();

function resolveNpcWorldCollisions(
  pos: { x: number; z: number },
  world: WorldSave,
  shift: ShiftSnapshot,
  opts: {
    ignoreChairId?: string | null;
    selfId?: string;
    stayOnSidewalk?: boolean;
    allowRoadCurb?: boolean;
  }
): void {
  const maxZ = opts.allowRoadCurb ? 2.75 : 1.6;
  if (opts.stayOnSidewalk) {
    pos.z = clamp(pos.z, -4.85, maxZ);
  } else {
    pos.z = clamp(pos.z, -8.35, maxZ);
  }

  if (!opts.stayOnSidewalk) {
    resolveAllBuildingCollisions(pos, 0.3);
  } else {
    resolveCollisionBox(pos, -22, 4.35, -12, -5.25, 0.34);
  }

  // 4-Wheel Chai Readi (NO bicycle cockpit!)
  resolveCollisionBox(
    pos,
    CYCLE_ANCHOR.x - 3.7,
    CYCLE_ANCHOR.x + 3.7,
    CYCLE_ANCHOR.z - 0.82,
    CYCLE_ANCHOR.z + 0.82,
    0.36
  );

  // 2nd Snacks Readi
  if (world.hasSnacksCart) {
    resolveCollisionBox(
      pos,
      SNACKS_CART_ANCHOR.x - 2.4,
      SNACKS_CART_ANCHOR.x + 2.4,
      SNACKS_CART_ANCHOR.z - 0.82,
      SNACKS_CART_ANCHOR.z + 0.82,
      0.36
    );
  }

  // Water Tap, Trash Bin & Sitting Kid
  resolveCollisionBox(
    pos,
    WATER_TAP_POS.x - 0.42,
    WATER_TAP_POS.x + 0.42,
    WATER_TAP_POS.z - 0.42,
    WATER_TAP_POS.z + 0.42,
    0.32
  );
  resolveCollisionBox(
    pos,
    TRASH_BIN_POS.x - 0.25,
    TRASH_BIN_POS.x + 0.25,
    TRASH_BIN_POS.z - 0.25,
    TRASH_BIN_POS.z + 0.25,
    0.24
  );
  if (shift.helper.status === 'sitting' && opts.selfId !== 'helper') {
    resolveCollisionCircle(pos, KID_SIT_POS.x, KID_SIT_POS.z, 0.56);
  }

  // Placed Tables & Chairs
  for (const f of world.furniture) {
    if (f.kind === 'table') {
      resolveCollisionBox(pos, f.x - 0.42, f.x + 0.42, f.z - 0.42, f.z + 0.42, 0.28);
    } else if (f.kind === 'chair' && f.id !== opts.ignoreChairId) {
      resolveCollisionCircle(pos, f.x, f.z, 0.38);
    }
  }

  // Milkman Bike & Customer Car when present
  if (shift.milkman.phase !== 'away') {
    resolveCollisionBox(
      pos,
      shift.milkman.x - 1.1,
      shift.milkman.x + 1.1,
      shift.milkman.z - 0.55,
      shift.milkman.z + 0.55,
      0.34
    );
  }
  if (shift.carCustomer.phase !== 'away') {
    resolveCollisionBox(
      pos,
      shift.carCustomer.x - 1.75,
      shift.carCustomer.x + 1.75,
      shift.carCustomer.z - 0.85,
      shift.carCustomer.z + 0.85,
      0.38
    );
  }

  // Personal space separation with Player & other people
  if (!shift.player.sittingChairId) {
    resolveCollisionCircle(pos, shift.player.x, shift.player.z, 0.7);
  }
  for (const other of shift.customers) {
    if (other.id === opts.selfId || other.seatedChairId) continue;
    if (other.status === 'walking_out' && (other.x < -15.8 || other.x > 18.8)) {
      continue;
    }
    resolveCollisionCircle(pos, other.x, other.z, 0.78);
  }
  if (opts.selfId !== 'owner') {
    resolveCollisionCircle(
      pos,
      shift.supermarketOwner.x,
      shift.supermarketOwner.z,
      0.76
    );
  }
  if (opts.selfId !== 'helper' && shift.helper.status === 'hired') {
    resolveCollisionCircle(pos, shift.helper.x, shift.helper.z, 0.65);
  }
  for (const ped of shift.pedestrians) {
    if (ped.id === opts.selfId) continue;
    if (ped.x < -15.8 || ped.x > 18.8) continue;
    resolveCollisionCircle(pos, ped.x, ped.z, 0.74);
  }
}

function moveNpcWithAvoidance(
  npc: { x: number; z: number; yaw?: number; walkCycle: number },
  targetX: number,
  targetZ: number,
  speed: number,
  dt: number,
  world: WorldSave,
  shift: ShiftSnapshot,
  opts: {
    biasSign: 1 | -1;
    ignoreChairId?: string | null;
    selfId?: string;
    stayOnSidewalk?: boolean;
    allowRoadCurb?: boolean;
  }
): boolean {
  const directDist = Math.hypot(targetX - npc.x, targetZ - npc.z);
  if (directDist < 0.18) {
    npc.x = targetX;
    npc.z = targetZ;
    if (opts.selfId) {
      const m = npcNavMemory.get(opts.selfId);
      if (m) {
        m.detourTimer = 0;
        m.windowTime = 0;
        m.anchorX = npc.x;
        m.anchorZ = npc.z;
      }
    }
    return true;
  }

  let wayX = targetX;
  let wayZ = targetZ;

  // 1. Hysteresis-free Supermarket doorway routing FIRST
  if (targetZ > -3.45 && npc.x > 4.2 && npc.z < -3.45) {
    wayX = 6.2;
    wayZ = -2.65;
  } else if (targetZ < -4.0 && npc.z > -3.75 && npc.x >= CYCLE_ANCHOR.x + 4.0) {
    wayX = 6.2;
    wayZ = -4.25;
  }

  // 2. Clean 2-stage detour around Chai Readi (and Snacks Readi if bought)
  const applyCartDetour = (minX: number, maxX: number, midZ: number) => {
    const onFront = npc.z > midZ;
    const wayOnFront = wayZ > midZ;
    const crossesZ = onFront !== wayOnFront;
    const inCartX =
      (npc.x > minX && npc.x < maxX) || (wayX > minX && wayX < maxX);

    if (crossesZ && inCartX) {
      const exitLeftX = minX - 0.55;
      const exitRightX = maxX + 0.55;
      const leftDist = Math.abs(npc.x - exitLeftX) + Math.abs(wayX - exitLeftX);
      const rightDist =
        Math.abs(npc.x - exitRightX) + Math.abs(wayX - exitRightX);
      const chosenExitX = leftDist < rightDist ? exitLeftX : exitRightX;

      if (npc.x > minX && npc.x < maxX) {
        wayX = chosenExitX;
        wayZ = onFront ? 0.72 : -2.65;
      } else {
        wayX = npc.x <= minX ? exitLeftX : exitRightX;
        wayZ = wayOnFront ? 0.85 : -2.65;
      }
    }
  };

  applyCartDetour(CYCLE_ANCHOR.x - 4.15, CYCLE_ANCHOR.x + 4.15, CYCLE_ANCHOR.z);
  if (world.hasSnacksCart) {
    applyCartDetour(
      SNACKS_CART_ANCHOR.x - 2.8,
      SNACKS_CART_ANCHOR.x + 2.8,
      SNACKS_CART_ANCHOR.z
    );
  }

  // 2b. Stuck-Detection & Immediate Bump Direction Change
  let navMem: NpcNavMemory | undefined;
  if (opts.selfId) {
    navMem = npcNavMemory.get(opts.selfId);
    if (!navMem) {
      navMem = {
        anchorX: npc.x,
        anchorZ: npc.z,
        windowTime: 0,
        detourTimer: 0,
        detourAngleOffset: 0,
        bumpStreak: 0,
        flipSign: opts.biasSign,
      };
      npcNavMemory.set(opts.selfId, navMem);
    }

    if (navMem.detourTimer > 0) {
      navMem.detourTimer = Math.max(0, navMem.detourTimer - dt);
      if (navMem.detourTimer === 0) {
        navMem.detourAngleOffset = 0;
        navMem.bumpStreak = 0;
      }
    }

    navMem.windowTime += dt;
    if (navMem.windowTime >= 0.32) {
      const movedWindow = Math.hypot(
        npc.x - navMem.anchorX,
        npc.z - navMem.anchorZ
      );
      navMem.anchorX = npc.x;
      navMem.anchorZ = npc.z;
      navMem.windowTime = 0;

      if (movedWindow < 0.13 && directDist > 0.32) {
        navMem.bumpStreak += 1;
        navMem.flipSign = navMem.flipSign === 1 ? -1 : 1;
        const baseToWay = Math.atan2(wayX - npc.x, wayZ - npc.z);
        const fs = navMem.flipSign;
        const tryOffsets =
          navMem.bumpStreak > 1
            ? [fs * 1.45, -fs * 1.45, fs * 2.05, -fs * 2.05, fs * 0.95, -fs * 0.95]
            : [fs * 0.85, fs * 1.35, -fs * 0.85, -fs * 1.35, fs * 1.85, -fs * 1.85];
        let pickedOff = fs * 1.05;
        for (const off of tryOffsets) {
          const ang = baseToWay + off;
          const ax1 = npc.x + Math.sin(ang) * 0.55;
          const az1 = npc.z + Math.cos(ang) * 0.55;
          const ax2 = npc.x + Math.sin(ang) * 1.05;
          const az2 = npc.z + Math.cos(ang) * 1.05;
          if (
            !isStaticBlockedForNpc(ax1, az1, world, shift, opts) &&
            !isStaticBlockedForNpc(ax2, az2, world, shift, opts) &&
            !isDynamicBlockedForNpc(ax1, az1, shift, opts)
          ) {
            pickedOff = off;
            break;
          }
        }
        navMem.detourAngleOffset = pickedOff;
        navMem.detourTimer = 0.72;
      }
    }
  }

  const dx = wayX - npc.x;
  const dz = wayZ - npc.z;
  const wayDist = Math.max(0.001, Math.hypot(dx, dz));
  const dirX = dx / wayDist;
  const dirZ = dz / wayDist;

  // 3. Smooth continuous right-hand passing & personal-space steering
  let steerX = dirX;
  let steerZ = dirZ;
  const rightX = -dirZ;
  const rightZ = dirX;

  const applyPersonRepulsion = (ox: number, oz: number, radius: number) => {
    const rx = npc.x - ox;
    const rz = npc.z - oz;
    const d = Math.hypot(rx, rz);
    if (d < radius && d > 0.001) {
      const toOtherX = -rx / d;
      const toOtherZ = -rz / d;
      const aheadDot = toOtherX * dirX + toOtherZ * dirZ;
      if (aheadDot > -0.25 || d < 1.0) {
        const w = (radius - d) / radius;
        steerX += (rx / d) * w * 1.15 + rightX * w * 1.45;
        steerZ += (rz / d) * w * 1.15 + rightZ * w * 1.45;
      }
    }
  };

  if (!shift.player.sittingChairId) {
    applyPersonRepulsion(shift.player.x, shift.player.z, 1.35);
  }
  for (const other of shift.customers) {
    if (other.id === opts.selfId || other.seatedChairId) continue;
    if (other.status === 'walking_out' && (other.x < -15.8 || other.x > 18.8)) {
      continue;
    }
    applyPersonRepulsion(other.x, other.z, 1.48);
  }
  if (opts.selfId !== 'owner') {
    applyPersonRepulsion(shift.supermarketOwner.x, shift.supermarketOwner.z, 1.45);
  }
  if (opts.selfId !== 'helper' && shift.helper.status === 'hired') {
    applyPersonRepulsion(shift.helper.x, shift.helper.z, 1.25);
  }
  for (const ped of shift.pedestrians) {
    if (ped.id === opts.selfId || ped.x < -15.8 || ped.x > 18.8) continue;
    applyPersonRepulsion(ped.x, ped.z, 1.4);
  }

  const baseAngle =
    Math.atan2(steerX, steerZ) +
    (navMem && navMem.detourTimer > 0 ? navMem.detourAngleOffset : 0);
  const b = navMem ? navMem.flipSign : opts.biasSign;
  const candidateOffsets = [
    0,
    b * 0.38,
    -b * 0.38,
    b * 0.78,
    -b * 0.78,
    b * 1.18,
    -b * 1.18,
    b * 1.58,
    -b * 1.58,
    b * 2.0,
    -b * 2.0,
    Math.PI,
  ];

  let chosenAngle = baseAngle;
  let foundClear = false;
  // Pass 1: Clear of BOTH static obstacles AND nearby people at short + medium lookahead
  for (const offset of candidateOffsets) {
    const ang = baseAngle + offset;
    const look1X = npc.x + Math.sin(ang) * 0.45;
    const look1Z = npc.z + Math.cos(ang) * 0.45;
    const look2X = npc.x + Math.sin(ang) * 0.92;
    const look2Z = npc.z + Math.cos(ang) * 0.92;
    if (
      !isStaticBlockedForNpc(look1X, look1Z, world, shift, opts) &&
      !isStaticBlockedForNpc(look2X, look2Z, world, shift, opts) &&
      !isDynamicBlockedForNpc(look1X, look1Z, shift, opts) &&
      !isDynamicBlockedForNpc(look2X, look2Z, shift, opts)
    ) {
      chosenAngle = ang;
      foundClear = true;
      break;
    }
  }
  // Pass 2: Static clear at 0.45 + 0.92, dynamic clear at immediate step 0.45
  if (!foundClear) {
    for (const offset of candidateOffsets) {
      const ang = baseAngle + offset;
      const look1X = npc.x + Math.sin(ang) * 0.45;
      const look1Z = npc.z + Math.cos(ang) * 0.45;
      const look2X = npc.x + Math.sin(ang) * 0.92;
      const look2Z = npc.z + Math.cos(ang) * 0.92;
      if (
        !isStaticBlockedForNpc(look1X, look1Z, world, shift, opts) &&
        !isStaticBlockedForNpc(look2X, look2Z, world, shift, opts) &&
        !isDynamicBlockedForNpc(look1X, look1Z, shift, opts)
      ) {
        chosenAngle = ang;
        foundClear = true;
        break;
      }
    }
  }
  // Pass 3: Static clear at 0.42 + 0.85
  if (!foundClear) {
    for (const offset of candidateOffsets) {
      const ang = baseAngle + offset;
      const look1X = npc.x + Math.sin(ang) * 0.42;
      const look1Z = npc.z + Math.cos(ang) * 0.42;
      const look2X = npc.x + Math.sin(ang) * 0.85;
      const look2Z = npc.z + Math.cos(ang) * 0.85;
      if (
        !isStaticBlockedForNpc(look1X, look1Z, world, shift, opts) &&
        !isStaticBlockedForNpc(look2X, look2Z, world, shift, opts)
      ) {
        chosenAngle = ang;
        foundClear = true;
        break;
      }
    }
  }
  // Pass 4: Immediate static clear
  if (!foundClear) {
    for (const offset of candidateOffsets) {
      const ang = baseAngle + offset;
      const look1X = npc.x + Math.sin(ang) * 0.42;
      const look1Z = npc.z + Math.cos(ang) * 0.42;
      if (!isStaticBlockedForNpc(look1X, look1Z, world, shift, opts)) {
        chosenAngle = ang;
        break;
      }
    }
  }

  const prevX = npc.x;
  const prevZ = npc.z;
  const step = Math.min(directDist, speed * dt);
  const intendedX = npc.x + Math.sin(chosenAngle) * step;
  const intendedZ = npc.z + Math.cos(chosenAngle) * step;
  npc.x = intendedX;
  npc.z = intendedZ;

  resolveNpcWorldCollisions(npc, world, shift, opts);

  const bumpX = npc.x - intendedX;
  const bumpZ = npc.z - intendedZ;
  const bumpMag = Math.hypot(bumpX, bumpZ);
  const movedX = npc.x - prevX;
  const movedZ = npc.z - prevZ;
  const movedDist = Math.hypot(movedX, movedZ);

  // Immediately change direction slightly whenever the NPC bumps into an obstacle or person!
  if (navMem && directDist > 0.3 && (bumpMag > 0.008 || movedDist < step * 0.35)) {
    const rawTargetAng = Math.atan2(wayX - npc.x, wayZ - npc.z);
    if (navMem.detourTimer <= 0.12) {
      const fs = navMem.flipSign;
      const quickAngles = [fs * 0.72, -fs * 0.72, fs * 1.22, -fs * 1.22, fs * 1.72];
      let chosenOff = fs * 0.78;
      for (const off of quickAngles) {
        const testAng = rawTargetAng + off;
        const tx = npc.x + Math.sin(testAng) * 0.65;
        const tz = npc.z + Math.cos(testAng) * 0.65;
        if (
          !isStaticBlockedForNpc(tx, tz, world, shift, opts) &&
          !isDynamicBlockedForNpc(tx, tz, shift, opts)
        ) {
          chosenOff = off;
          break;
        }
      }
      navMem.detourAngleOffset = chosenOff;
      navMem.detourTimer = 0.48;
    }
  }

  const targetYaw =
    movedDist > 0.002 ? Math.atan2(movedX, movedZ) : chosenAngle;
  npc.yaw =
    typeof npc.yaw === 'number'
      ? dampAngle(npc.yaw, targetYaw, 10, dt)
      : targetYaw;
  npc.walkCycle += dt * (speed * 3.85);
  return Math.hypot(targetX - npc.x, targetZ - npc.z) < 0.26;
}

function canHelperMakeDrink(
  drink: 'tea' | 'doodh_patti' | 'coffee',
  shift: ShiftSnapshot,
  world: WorldSave
): boolean {
  if (!world.unlockedRecipes.includes(drink)) return false;
  if (shift.inventory.cups <= 0 || shift.inventory.sugar <= 0) return false;
  if (drink === 'tea') {
    return shift.inventory.teaLeaves > 0 && shift.inventory.water > 0;
  }
  if (drink === 'doodh_patti') {
    return shift.inventory.teaLeaves > 0 && shift.inventory.milkPackets > 0;
  }
  return shift.inventory.coffeePowder > 0 && shift.inventory.water > 0;
}

function stepHelperNpc(
  shift: ShiftSnapshot,
  world: WorldSave,
  dt: number,
  events: SimStepEvents
): void {
  const helper = shift.helper;
  if (helper.status !== 'hired') return;

  const moveHelperTo = (
    tx: number,
    tz: number,
    speed = 2.75,
    allowRoadCurb = false
  ): boolean =>
    moveNpcWithAvoidance(helper, tx, tz, speed, dt, world, shift, {
      biasSign: -1,
      selfId: 'helper',
      stayOnSidewalk: true,
      allowRoadCurb: allowRoadCurb || helper.z > 1.55,
    });

  // Find eligible customers, Mart Owner, OR Cars wanting Chai, Doodh Patti, or Coffee
  const eligibleDrinks: Array<'tea' | 'doodh_patti' | 'coffee'> = [
    'tea',
    'doodh_patti',
    'coffee',
  ];

  const pickBestWaitingTarget = (
    preferredDrink?: 'tea' | 'doodh_patti' | 'coffee' | null
  ): {
    id: string;
    drink: 'tea' | 'doodh_patti' | 'coffee';
    x: number;
    z: number;
    isOwner: boolean;
    isCar: boolean;
  } | null => {
    let best: {
      id: string;
      drink: 'tea' | 'doodh_patti' | 'coffee';
      x: number;
      z: number;
      patienceRatio: number;
      isOwner: boolean;
      isCar: boolean;
    } | null = null;

    for (const c of shift.customers) {
      if (c.status !== 'waiting') continue;
      if (!eligibleDrinks.includes(c.orderDrink as 'tea' | 'doodh_patti' | 'coffee')) {
        continue;
      }
      const dType = c.orderDrink as 'tea' | 'doodh_patti' | 'coffee';
      if (preferredDrink && dType !== preferredDrink) continue;
      if (!preferredDrink && !canHelperMakeDrink(dType, shift, world)) continue;
      const ratio = c.patience / Math.max(1, c.maxPatience);
      if (!best || ratio < best.patienceRatio) {
        best = {
          id: c.id,
          drink: dType,
          x: c.x,
          z: c.z,
          patienceRatio: ratio,
          isOwner: false,
          isCar: false,
        };
      }
    }

    const owner = shift.supermarketOwner;
    if (
      owner.phase === 'ordering_chai' &&
      (!preferredDrink || owner.orderDrink === preferredDrink) &&
      (preferredDrink || canHelperMakeDrink(owner.orderDrink, shift, world))
    ) {
      const ratio = owner.patience / Math.max(1, owner.maxPatience);
      if (!best || ratio < best.patienceRatio) {
        best = {
          id: 'owner_customer',
          drink: owner.orderDrink,
          x: owner.x,
          z: owner.z,
          patienceRatio: ratio,
          isOwner: true,
          isCar: false,
        };
      }
    }

    const car = shift.carCustomer;
    if (
      car.phase === 'waiting' &&
      eligibleDrinks.includes(car.orderDrink as 'tea' | 'doodh_patti' | 'coffee')
    ) {
      const carDrink = car.orderDrink as 'tea' | 'doodh_patti' | 'coffee';
      if (
        (!preferredDrink || carDrink === preferredDrink) &&
        (preferredDrink || canHelperMakeDrink(carDrink, shift, world))
      ) {
        const ratio = car.patience / Math.max(1, car.maxPatience);
        if (!best || ratio < best.patienceRatio) {
          best = {
            id: 'car_customer',
            drink: carDrink,
            x: car.x,
            z: car.z,
            patienceRatio: ratio,
            isOwner: false,
            isCar: true,
          };
        }
      }
    }

    return best;
  };

  if (helper.actionTimer > 0) {
    helper.actionTimer = Math.max(0, helper.actionTimer - dt);
    return;
  }

  // If helper already holds a finished hot drink -> serve matching customer, owner, or car, or place on Free Space!
  const helperHot = heldHotDrinkType(helper.holding);
  if (
    helperHot === 'tea' ||
    helperHot === 'doodh_patti' ||
    helperHot === 'coffee'
  ) {
    helper.task = 'serving';
    const target = pickBestWaitingTarget(helperHot);
    if (!target) {
      // No one wants this drink right now -> place on empty Chai Readi Free Space so next customer grabs it!
      const trays = shift.trayItems ?? [null, null, null, null];
      const emptyIdx = trays.findIndex((t) => t === null);
      if (emptyIdx >= 0) {
        const spot = TRAY_SPOTS[emptyIdx];
        const arrived = moveHelperTo(spot.x, -2.28);
        if (arrived) {
          trays[emptyIdx] = helper.holding;
          shift.trayItems = trays;
          shift.trayItem = trays[0] ?? null;
          helper.holding = null;
          helper.task = 'idle';
          helper.targetDrink = null;
          helper.targetCustomerId = null;
          helper.statusNote = 'Placed spare cup on Readi';
          events.sounds.push('pickup');
        }
      } else {
        moveHelperTo(HELPER_IDLE_SPOT.x, HELPER_IDLE_SPOT.z, 2.0);
        helper.statusNote = 'Holding ready drink...';
      }
      return;
    }

    // Walk to Car window, Seated Customer, or behind Readi near Standing Customer / Owner!
    const cust =
      target.isOwner || target.isCar
        ? null
        : shift.customers.find((c) => c.id === target.id);

    const serveX = target.isCar
      ? target.x
      : cust && cust.seatedChairId
        ? target.x
        : clamp(target.x, CYCLE_ANCHOR.x - 3.6, 12.0);

    const serveZ = target.isCar
      ? 2.45
      : cust && cust.seatedChairId
        ? findChairApproachSpot(
            world.furniture.find((f) => f.id === cust.seatedChairId) ?? {
              id: '',
              kind: 'chair',
              x: cust.x,
              z: cust.z,
              rotationY: 0,
            },
            world,
            shift
          ).z
        : -2.25;

    if (target.isCar) {
      helper.statusNote = `Serving Car (${DRINK_CATALOG[helperHot].name})`;
    }

    const arrived = moveHelperTo(serveX, serveZ, 2.95, target.isCar);
    const serveRange = target.isCar ? 2.35 : 3.55;
    if (arrived || Math.hypot(target.x - helper.x, target.z - helper.z) < serveRange) {
      const info = DRINK_CATALOG[helperHot] ?? DRINK_CATALOG.tea;
      const tip = rollRandomTipCents();
      const totalPay = info.priceCents + tip;
      const netCash = totalPay - HELPER_WAGE_CENTS;

      helper.holding = null;
      helper.task = 'idle';
      helper.targetDrink = null;
      helper.targetCustomerId = null;
      helper.servedCount += 1;
      helper.wageEarnedCents += HELPER_WAGE_CENTS;
      helper.actionTimer = 0.4;

      shift.servedCount += 1;
      shift.earningsCents += netCash;
      world.cashCents += netCash;
      world.totalServed += 1;
      events.sounds.push('serve');

      if (target.isCar) {
        const car = shift.carCustomer;
        car.qtyServed += 1;
        if (car.qtyServed >= car.qtyTotal) {
          car.phase = 'leaving';
          helper.statusNote = `Served Car (${info.name})!`;
          events.feedbackText = `Chotu served Car (${car.qtyTotal}x ${info.name})! +${formatMoney(totalPay)} (-${formatMoney(HELPER_WAGE_CENTS)} wage)`;
        } else {
          helper.statusNote = `Car ${car.qtyServed}/${car.qtyTotal} Served`;
          events.feedbackText = `Chotu served Car ${car.qtyServed}/${car.qtyTotal} ${info.name}! +${formatMoney(totalPay)} (-${formatMoney(HELPER_WAGE_CENTS)} wage)`;
        }
        events.feedbackColor = '#86EFAC';
      } else if (target.isOwner) {
        shift.supermarketOwner.phase = 'drinking_chai';
        shift.supermarketOwner.drinkTimer = 4.2;
        helper.statusNote = `Served ${info.name}!`;
        events.feedbackText = `Chotu served ${info.name}! +${formatMoney(totalPay)} (-${formatMoney(HELPER_WAGE_CENTS)} wage)`;
        events.feedbackColor = '#86EFAC';
      } else if (cust) {
        cust.status = 'drinking';
        cust.drinkTimer = 4.2;
        helper.statusNote = `Served ${info.name}!`;
        events.feedbackText = `Chotu served ${info.name}! +${formatMoney(totalPay)} (-${formatMoney(HELPER_WAGE_CENTS)} wage)`;
        events.feedbackColor = '#86EFAC';
      }

      maybeUnlockLevel2(world, shift, events);
    }
    return;
  }

  // If kettle is already ready with a drink matching any waiting customer/car, grab it!
  if (
    helper.holding === null &&
    shift.kettle.status === 'ready' &&
    shift.kettle.brewingDrink &&
    (shift.kettle.brewingDrink === 'tea' ||
      shift.kettle.brewingDrink === 'doodh_patti' ||
      shift.kettle.brewingDrink === 'coffee')
  ) {
    const matchCust = pickBestWaitingTarget(shift.kettle.brewingDrink);
    if (matchCust) {
      helper.statusNote = 'Grabbing boiled cup';
      const arrived = moveHelperTo(STATIONS.kettle.x, -2.28, 2.85);
      if (arrived) {
        helper.holding = drinkToHotItem(shift.kettle.brewingDrink);
        shift.kettle.status = 'idle';
        shift.kettle.progress = 0;
        shift.kettle.brewingDrink = null;
        helper.task = 'serving';
        helper.actionTimer = 0.3;
        events.sounds.push('pickup');
      }
      return;
    }
  }

  // Idle -> pick an eligible order to start brewing
  if (helper.task === 'idle') {
    helper.targetDrink = null;
    helper.targetCustomerId = null;
    const nextOrder = pickBestWaitingTarget(null);
    if (nextOrder) {
      helper.targetDrink = nextOrder.drink;
      helper.targetCustomerId = nextOrder.id;
      helper.task = 'fetching_cup';
      helper.statusNote = nextOrder.isCar
        ? `Making Car ${DRINK_CATALOG[nextOrder.drink].name}`
        : `Making ${DRINK_CATALOG[nextOrder.drink].name}`;
    } else {
      // Check if walk-up customers, owner, or car are waiting but missing stock
      const waitingDrinks: Array<'tea' | 'doodh_patti' | 'coffee'> = [];
      for (const c of shift.customers) {
        if (
          c.status === 'waiting' &&
          eligibleDrinks.includes(c.orderDrink as 'tea' | 'doodh_patti' | 'coffee')
        ) {
          waitingDrinks.push(c.orderDrink as 'tea' | 'doodh_patti' | 'coffee');
        }
      }
      if (
        shift.carCustomer.phase === 'waiting' &&
        eligibleDrinks.includes(
          shift.carCustomer.orderDrink as 'tea' | 'doodh_patti' | 'coffee'
        )
      ) {
        waitingDrinks.push(
          shift.carCustomer.orderDrink as 'tea' | 'doodh_patti' | 'coffee'
        );
      }
      if (shift.supermarketOwner.phase === 'ordering_chai') {
        waitingDrinks.push(shift.supermarketOwner.orderDrink);
      }

      const missingDrink = waitingDrinks[0];
      if (missingDrink) {
        if (shift.inventory.cups <= 0) helper.statusNote = 'Need Cups!';
        else if (
          missingDrink === 'doodh_patti' &&
          shift.inventory.milkPackets <= 0
        ) {
          helper.statusNote = 'Need Milk!';
        } else if (
          missingDrink === 'coffee' &&
          shift.inventory.coffeePowder <= 0
        ) {
          helper.statusNote = 'Need Beans!';
        } else if (
          missingDrink !== 'doodh_patti' &&
          shift.inventory.water <= 0
        ) {
          helper.statusNote = 'Need Water!';
        } else if (shift.inventory.sugar <= 0) helper.statusNote = 'Need Sugar!';
        else helper.statusNote = 'Need Stock!';
      } else {
        helper.statusNote = 'Ready to Help';
      }
      const arrivedIdle = moveHelperTo(
        HELPER_IDLE_SPOT.x,
        HELPER_IDLE_SPOT.z,
        2.0
      );
      if (arrivedIdle) {
        helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
      }
      return;
    }
  }

  const drink = helper.targetDrink ?? 'tea';

  if (helper.task === 'fetching_cup') {
    if (helper.holding !== null) {
      helper.task = 'adding_base';
      return;
    }
    const arrived = moveHelperTo(STATIONS.cups.x, -2.28);
    if (arrived) {
      if (shift.inventory.cups > 0) {
        shift.inventory.cups -= 1;
        helper.holding = 'empty_cup';
        helper.task = 'adding_base';
        helper.actionTimer = 0.4;
        events.sounds.push('pickup');
      } else {
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'adding_base') {
    const station = drink === 'coffee' ? STATIONS.coffee_jar : STATIONS.tea_tin;
    const arrived = moveHelperTo(station.x, -2.28);
    if (arrived) {
      if (drink === 'coffee' && shift.inventory.coffeePowder > 0) {
        shift.inventory.coffeePowder -= 1;
        helper.holding = 'cup_with_coffee';
        helper.task = 'adding_sugar';
        helper.actionTimer = 0.4;
        events.sounds.push('pour');
      } else if (drink !== 'coffee' && shift.inventory.teaLeaves > 0) {
        shift.inventory.teaLeaves -= 1;
        helper.holding = 'cup_with_tea';
        helper.task = 'adding_sugar';
        helper.actionTimer = 0.4;
        events.sounds.push('pour');
      } else {
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'adding_sugar') {
    const arrived = moveHelperTo(STATIONS.sugar_jar.x, -2.28);
    if (arrived) {
      if (shift.inventory.sugar > 0) {
        shift.inventory.sugar -= 1;
        helper.holding =
          helper.holding === 'cup_with_coffee'
            ? 'cup_with_coffee_sugar'
            : 'cup_with_tea_sugar';
        helper.task = 'adding_liquid';
        helper.actionTimer = 0.4;
        events.sounds.push('pour');
      } else {
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'adding_liquid') {
    const isMilk = drink === 'doodh_patti';
    const station = isMilk ? STATIONS.milk_crate : STATIONS.water_jug;
    const arrived = moveHelperTo(station.x, -2.28);
    if (arrived) {
      if (isMilk && shift.inventory.milkPackets > 0) {
        shift.inventory.milkPackets -= 1;
        helper.holding = 'cup_with_doodh_patti_mix';
        helper.task = 'to_kettle';
        helper.actionTimer = 0.4;
        events.sounds.push('pour');
      } else if (!isMilk && shift.inventory.water > 0) {
        shift.inventory.water -= 1;
        helper.holding =
          helper.holding === 'cup_with_coffee_sugar'
            ? 'cup_with_coffee_water'
            : 'cup_with_tea_water';
        helper.task = 'to_kettle';
        helper.actionTimer = 0.4;
        events.sounds.push('pour');
      } else {
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'to_kettle') {
    const arrived = moveHelperTo(STATIONS.kettle.x, -2.28);
    if (arrived) {
      helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
      if (shift.kettle.status === 'idle') {
        helper.holding = null;
        shift.kettle.status = 'brewing';
        shift.kettle.progress = 0;
        shift.kettle.brewingDrink = drink;
        helper.task = 'waiting_boil';
        helper.statusNote = 'Boiling on Kettle...';
        events.sounds.push('pour');
      } else {
        helper.statusNote = 'Waiting for Kettle';
      }
    }
    return;
  }

  if (helper.task === 'waiting_boil') {
    helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
    if (shift.kettle.status === 'ready' && shift.kettle.brewingDrink) {
      helper.holding = drinkToHotItem(shift.kettle.brewingDrink);
      shift.kettle.status = 'idle';
      shift.kettle.progress = 0;
      shift.kettle.brewingDrink = null;
      helper.task = 'serving';
      helper.actionTimer = 0.3;
      events.sounds.push('pickup');
    } else if (shift.kettle.status === 'idle') {
      // Player grabbed the kettle cup first -> gracefully reset helper to idle
      helper.task = 'idle';
      helper.targetDrink = null;
      helper.targetCustomerId = null;
    }
  }
}

export function stepStage1Simulation(
  shift: ShiftSnapshot,
  world: WorldSave,
  input: Stage1Input,
  rawDt: number
): SimStepEvents {
  const dt = Math.min(rawDt, 0.05);
  const events: SimStepEvents = {
    sounds: [],
    openSupermarket: false,
    openMilkmanShop: false,
    openHelperModal: false,
    openBuildingOwnerId: null,
    openCustomerAction: null,
    feedbackText: null,
    feedbackColor: '#FBBF24',
    leveledUpTo2: false,
  };

  if (shift.phase !== 'playing') {
    return events;
  }

  // 1. 5-Minute Day Countdown + Active Rented Shop Daily Bonus
  shift.timeLeft = Math.max(0, shift.timeLeft - dt);
  if (shift.timeLeft <= 0) {
    shift.phase = 'day_complete';
    events.sounds.push('day_end');

    let shopBonusTotal = 0;
    for (const rec of world.rentedShops) {
      if (world.day < rec.nextRentDueDay) {
        const cfg = RENTABLE_BUILDINGS.find((b) => b.id === rec.buildingId);
        if (cfg) shopBonusTotal += cfg.dailyIncomeBonusCents;
      }
    }
    if (shopBonusTotal > 0) {
      shift.earningsCents += shopBonusTotal;
      world.cashCents += shopBonusTotal;
      events.feedbackText = `Rented Shops Daily Profit: +${formatMoney(shopBonusTotal)}!`;
      events.feedbackColor = '#86EFAC';
    }
    return events;
  }

  // 2. Player Movement, Sitting & Dash
  const p = shift.player;
  if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);

  let mx = input.dx;
  let mz = input.dz;
  const mag = Math.hypot(mx, mz);
  if (mag > 1) {
    mx /= mag;
    mz /= mag;
  }

  if (p.sittingChairId) {
    const chair = world.furniture.find((f) => f.id === p.sittingChairId);
    if (!chair) {
      p.sittingChairId = null;
    } else if (mag > 0.1 || input.interactJustPressed) {
      p.sittingChairId = null;
      p.isMoving = false;
      events.sounds.push('pickup');
      if (input.interactJustPressed) {
        return events;
      }
    } else {
      p.x = chair.x;
      p.z = chair.z;
      p.yaw = getFacingAngleForSeat(chair, world.furniture);
      p.isMoving = false;
    }
  }

  if (!p.sittingChairId) {
    if (input.dashJustPressed && p.dashCooldown <= 0) {
      p.dashTimer = DASH_DURATION;
      p.dashCooldown = DASH_COOLDOWN;
      events.sounds.push('dash');
    }

    p.isMoving = mag > 0.1;
    if (p.isMoving) {
      p.yaw = Math.atan2(mx, mz);
      p.walkCycle += dt * 10.5;
    }

    const speed = PLAYER_SPEED * (p.dashTimer > 0 ? DASH_SPEED_MULT : 1);
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;

    p.x = clamp(p.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
    p.z = clamp(p.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);

    // ALL Street Buildings + Supermarket open walk-in collisions
    resolveAllBuildingCollisions(p, 0.34);

    // Solid collision with 4-Wheel Chai Readi (7.4m x 1.64m, NO bike cockpit!)
    resolveCollisionBox(
      p,
      CYCLE_ANCHOR.x - 3.7,
      CYCLE_ANCHOR.x + 3.7,
      CYCLE_ANCHOR.z - 0.82,
      CYCLE_ANCHOR.z + 0.82,
      0.4
    );

    // Solid collision with 2nd Snacks Readi (or small reserved plot sign)
    if (world.hasSnacksCart) {
      resolveCollisionBox(
        p,
        SNACKS_CART_ANCHOR.x - 2.4,
        SNACKS_CART_ANCHOR.x + 2.4,
        SNACKS_CART_ANCHOR.z - 0.82,
        SNACKS_CART_ANCHOR.z + 0.82,
        0.4
      );
    } else {
      resolveCollisionBox(
        p,
        SNACKS_CART_ANCHOR.x - 0.35,
        SNACKS_CART_ANCHOR.x + 0.35,
        SNACKS_CART_ANCHOR.z - 0.25,
        SNACKS_CART_ANCHOR.z + 0.25,
        0.3
      );
    }

    // Solid collision with Water Tap, Trash Bin & Sitting Kid
    resolveCollisionBox(
      p,
      WATER_TAP_POS.x - 0.42,
      WATER_TAP_POS.x + 0.42,
      WATER_TAP_POS.z - 0.42,
      WATER_TAP_POS.z + 0.42,
      0.34
    );
    resolveCollisionBox(
      p,
      TRASH_BIN_POS.x - 0.25,
      TRASH_BIN_POS.x + 0.25,
      TRASH_BIN_POS.z - 0.25,
      TRASH_BIN_POS.z + 0.25,
      0.26
    );
    if (shift.helper.status === 'sitting') {
      resolveCollisionCircle(p, KID_SIT_POS.x, KID_SIT_POS.z, 0.56);
    }

    // Solid collision with placed Tables & Chairs
    for (const f of world.furniture) {
      if (f.kind === 'table') {
        resolveCollisionBox(p, f.x - 0.4, f.x + 0.4, f.z - 0.4, f.z + 0.4, 0.3);
      } else {
        resolveCollisionCircle(p, f.x, f.z, 0.42);
      }
    }

    // Solid collision with Milkman Motorcycle
    if (shift.milkman.phase !== 'away') {
      resolveCollisionBox(
        p,
        shift.milkman.x - 1.1,
        shift.milkman.x + 1.1,
        shift.milkman.z - 0.55,
        shift.milkman.z + 0.55,
        0.4
      );
    }

    // Solid collision with Car Customer
    if (shift.carCustomer.phase !== 'away') {
      resolveCollisionBox(
        p,
        shift.carCustomer.x - 1.75,
        shift.carCustomer.x + 1.75,
        shift.carCustomer.z - 0.85,
        shift.carCustomer.z + 0.85,
        0.42
      );
    }
  }

  // 3. Kettle Boiling & 2nd Readi Kadhai Frying Progress
  if (shift.kettle.status === 'brewing') {
    shift.kettle.progress += dt / KETTLING_DURATION;
    if (shift.kettle.progress >= 1) {
      shift.kettle.progress = 1;
      shift.kettle.status = 'ready';
      events.sounds.push('boil_done');
      const dName = shift.kettle.brewingDrink
        ? (DRINK_CATALOG[shift.kettle.brewingDrink] ?? DRINK_CATALOG.tea).name
        : 'Chai';
      events.feedbackText = `${dName} Ready!`;
      events.feedbackColor = '#86EFAC';
    }
  }

  if (shift.fryer.status === 'frying') {
    shift.fryer.progress += dt / FRYING_DURATION;
    if (shift.fryer.progress >= 1) {
      shift.fryer.progress = 1;
      shift.fryer.status = 'ready';
      events.sounds.push('boil_done');
      const sName = shift.fryer.fryingSnack
        ? (DRINK_CATALOG[shift.fryer.fryingSnack] ?? DRINK_CATALOG.samosa).name
        : 'Samosa';
      events.feedbackText = `Hot ${sName} Fried & Ready!`;
      events.feedbackColor = '#FBBF24';
    }
  }

  // 4. Secondary Action Key (F / X): Pick Up Chair/Table OR Customer Offer/Reject
  if (input.offerRejectJustPressed && !p.sittingChairId) {
    if (p.holding === null) {
      const nearFurn = findNearestUnoccupiedFurniture(shift, world);
      if (nearFurn) {
        world.furniture = world.furniture.filter((f) => f.id !== nearFurn.id);
        p.holding =
          nearFurn.kind === 'chair' ? 'carried_chair' : 'carried_table';
        events.sounds.push('pickup');
        events.feedbackText = `Picked up ${nearFurn.kind === 'chair' ? 'Chair' : 'Table'} — press E to place!`;
        events.feedbackColor = '#FDE68A';
        return events;
      }
    }

    const custAction = findNearestCustomerForAction(shift);
    if (custAction) {
      events.openCustomerAction = custAction;
      return events;
    }
  }

  // 5. Primary Interact Key (E / Space)
  if (input.interactJustPressed) {
    const target = findInteractTarget(shift, world);
    if (target) {
      if (target.kind === 'place_furniture') {
        const furnKind = heldFurnitureKind(p.holding);
        if (furnKind) {
          const drop = getFurnitureDropSpot(p);
          if (canPlaceFurnitureAt(drop.x, drop.z, world.furniture, world)) {
            world.furniture = [
              ...world.furniture,
              {
                id: `furn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                kind: furnKind,
                x: drop.x,
                z: drop.z,
                rotationY: p.yaw,
              },
            ];
            p.holding = null;
            events.sounds.push('pickup');
            events.feedbackText = `${furnKind === 'chair' ? 'Chair' : 'Table'} Placed!`;
            events.feedbackColor = '#86EFAC';
          } else {
            events.sounds.push('error');
            events.feedbackText =
              'Move to open outdoor sidewalk or rented shop floor to place it!';
            events.feedbackColor = '#FCA5A5';
          }
        }
      } else if (target.kind === 'furniture_chair' && target.furnitureId) {
        const chair = world.furniture.find((f) => f.id === target.furnitureId);
        if (chair) {
          p.sittingChairId = chair.id;
          p.x = chair.x;
          p.z = chair.z;
          p.yaw = getFacingAngleForSeat(chair, world.furniture);
          p.isMoving = false;
          events.sounds.push('pickup');
          events.feedbackText = 'Sitting on Chair (Move or E to stand)';
          events.feedbackColor = '#FDE68A';
        }
      } else if (target.kind === 'furniture_table' && target.furnitureId) {
        if (p.holding === null) {
          world.furniture = world.furniture.filter(
            (f) => f.id !== target.furnitureId
          );
          p.holding = 'carried_table';
          events.sounds.push('pickup');
          events.feedbackText = 'Picked up Table — walk & press E to place!';
          events.feedbackColor = '#FDE68A';
        }
      } else if (target.kind === 'helper_kid') {
        events.openHelperModal = true;
      } else if (target.kind === 'building_owner' && target.buildingId) {
        events.openBuildingOwnerId = target.buildingId;
      } else if (target.kind === 'buy_snacks_cart') {
        const hasSnacksRecipe =
          world.unlockedRecipes.includes('samosa') ||
          world.unlockedRecipes.includes('pakora');
        if (!hasSnacksRecipe) {
          events.sounds.push('error');
          events.feedbackText =
            'Buy the Samosa & Pakora Recipe inside the Supermarket ($3.50) first!';
          events.feedbackColor = '#FCA5A5';
        } else if (world.cashCents < SNACKS_CART_PRICE_CENTS) {
          events.sounds.push('error');
          events.feedbackText = `Need ${formatMoney(SNACKS_CART_PRICE_CENTS)} to buy the 2nd Samosa & Pakora Readi!`;
          events.feedbackColor = '#FCA5A5';
        } else {
          world.cashCents -= SNACKS_CART_PRICE_CENTS;
          world.hasSnacksCart = true;
          shift.inventory.samosaMix += 4;
          shift.inventory.pakoraMix += 4;
          shift.inventory.cookingOil += 8;
          events.sounds.push('level_up');
          events.feedbackText =
            '2nd Readi Bought (+4 Samosa, +4 Pakora, +8 Oil starter)!';
          events.feedbackColor = '#86EFAC';
        }
      } else if (target.kind === 'supermarket') {
        if (isOwnerInsideSupermarket(shift.supermarketOwner)) {
          events.openSupermarket = true;
        } else {
          events.sounds.push('error');
          events.feedbackText =
            'Mart Owner is away from shop! Wait for him to return inside.';
          events.feedbackColor = '#FCA5A5';
        }
      } else if (target.kind === 'supermarket_pickup') {
        if (p.holding !== null) {
          events.sounds.push('error');
          events.feedbackText = 'Empty your hands first to pick up furniture!';
          events.feedbackColor = '#FCA5A5';
        } else if (world.pendingFurniture.length > 0) {
          const [nextKind, ...rest] = world.pendingFurniture;
          world.pendingFurniture = rest;
          p.holding = nextKind === 'chair' ? 'carried_chair' : 'carried_table';
          events.sounds.push('pickup');
          events.feedbackText = `Picked up ${nextKind === 'chair' ? 'Chair' : 'Table'}! Place outside with E`;
          events.feedbackColor = '#FDE68A';
        }
      } else if (target.kind === 'milkman') {
        events.openMilkmanShop = true;
      } else if (target.kind === 'water_tap') {
        if (shift.inventory.water >= MAX_WATER_CAPACITY) {
          events.sounds.push('pickup');
          events.feedbackText = 'Water Tank already full!';
          events.feedbackColor = '#93C5FD';
        } else {
          const before = shift.inventory.water;
          shift.inventory.water = Math.min(
            MAX_WATER_CAPACITY,
            shift.inventory.water + WATER_TAP_REFILL_AMOUNT
          );
          const added = shift.inventory.water - before;
          events.sounds.push('pour');
          events.feedbackText = `Refilled +${added} Free Water (${shift.inventory.water}/${MAX_WATER_CAPACITY})`;
          events.feedbackColor = '#7DD3FC';
        }
      } else if (target.kind === 'counter_tray') {
        const trays = shift.trayItems ?? [shift.trayItem ?? null, null, null, null];
        const idx = target.trayIndex ?? 0;
        const slotItem = trays[idx] ?? null;
        if (p.holding !== null && slotItem === null) {
          if (isSwappableCounterItem(p.holding)) {
            const placed = p.holding;
            trays[idx] = placed;
            shift.trayItems = trays;
            shift.trayItem = trays[0] ?? null;
            p.holding = null;
            events.sounds.push('pickup');
            events.feedbackText = `Placed ${HELD_ITEM_LABELS[placed]} on Readi Space`;
            events.feedbackColor = '#FDE68A';
          }
        } else if (p.holding === null && slotItem !== null) {
          p.holding = slotItem;
          trays[idx] = null;
          shift.trayItems = trays;
          shift.trayItem = trays[0] ?? null;
          events.sounds.push('pickup');
          events.feedbackText = `Picked up ${HELD_ITEM_LABELS[p.holding]}`;
          events.feedbackColor = '#FDE68A';
        } else if (
          p.holding !== null &&
          slotItem !== null &&
          isSwappableCounterItem(p.holding)
        ) {
          const prevHeld = p.holding;
          p.holding = slotItem;
          trays[idx] = prevHeld;
          shift.trayItems = trays;
          shift.trayItem = trays[0] ?? null;
          events.sounds.push('pickup');
          events.feedbackText = `Swapped ${HELD_ITEM_LABELS[prevHeld]} <-> ${HELD_ITEM_LABELS[p.holding]}!`;
          events.feedbackColor = '#86EFAC';
        }
      } else if (target.kind === 'snack_tray') {
        const sTrays = shift.snackTrayItems ?? [null, null];
        const idx = target.trayIndex ?? 0;
        const slotItem = sTrays[idx] ?? null;
        if (p.holding !== null && slotItem === null) {
          if (isSwappableCounterItem(p.holding)) {
            const placed = p.holding;
            sTrays[idx] = placed;
            shift.snackTrayItems = sTrays;
            p.holding = null;
            events.sounds.push('pickup');
            events.feedbackText = `Placed ${HELD_ITEM_LABELS[placed]} in Showcase`;
            events.feedbackColor = '#FDE68A';
          }
        } else if (p.holding === null && slotItem !== null) {
          p.holding = slotItem;
          sTrays[idx] = null;
          shift.snackTrayItems = sTrays;
          events.sounds.push('pickup');
          events.feedbackText = `Picked up ${HELD_ITEM_LABELS[p.holding]}`;
          events.feedbackColor = '#FDE68A';
        } else if (
          p.holding !== null &&
          slotItem !== null &&
          isSwappableCounterItem(p.holding)
        ) {
          const prevHeld = p.holding;
          p.holding = slotItem;
          sTrays[idx] = prevHeld;
          shift.snackTrayItems = sTrays;
          events.sounds.push('pickup');
          events.feedbackText = `Swapped ${HELD_ITEM_LABELS[prevHeld]} <-> ${HELD_ITEM_LABELS[p.holding]}!`;
          events.feedbackColor = '#86EFAC';
        }
      } else if (target.kind === 'snack_plates') {
        if (p.holding === null) {
          p.holding = 'paper_plate';
          events.sounds.push('pickup');
          events.feedbackText = 'Took Serving Paper Plate';
          events.feedbackColor = '#FDE68A';
        } else {
          events.sounds.push('error');
          events.feedbackText = 'Empty hands first to grab Paper Plate!';
          events.feedbackColor = '#FCA5A5';
        }
      } else if (target.kind === 'samosa_prep') {
        if (p.holding !== 'paper_plate') {
          events.sounds.push('error');
          events.feedbackText = 'Take a Paper Plate on the 2nd Readi first!';
          events.feedbackColor = '#FCA5A5';
        } else if (shift.inventory.samosaMix <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Aloo Samosa Mix! Buy inside Supermarket';
          events.feedbackColor = '#FCA5A5';
        } else {
          shift.inventory.samosaMix -= 1;
          p.holding = 'raw_samosa';
          events.sounds.push('pickup');
          events.feedbackText = `Prepared Raw Aloo Samosa (${shift.inventory.samosaMix} left)`;
          events.feedbackColor = '#FDE68A';
        }
      } else if (target.kind === 'pakora_prep') {
        if (p.holding !== 'paper_plate') {
          events.sounds.push('error');
          events.feedbackText = 'Take a Paper Plate on the 2nd Readi first!';
          events.feedbackColor = '#FCA5A5';
        } else if (shift.inventory.pakoraMix <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Besan Pakora Mix! Buy inside Supermarket';
          events.feedbackColor = '#FCA5A5';
        } else {
          shift.inventory.pakoraMix -= 1;
          p.holding = 'raw_pakora';
          events.sounds.push('pickup');
          events.feedbackText = `Scooped Raw Pakora Batter (${shift.inventory.pakoraMix} left)`;
          events.feedbackColor = '#FDE68A';
        }
      } else if (target.kind === 'kadhai') {
        const heldRaw: 'samosa' | 'pakora' | null =
          p.holding === 'raw_samosa'
            ? 'samosa'
            : p.holding === 'raw_pakora'
              ? 'pakora'
              : null;

        if (shift.fryer.status === 'idle') {
          if (!heldRaw) {
            events.sounds.push('error');
            events.feedbackText = 'Prepare Raw Samosa or Pakora on a Plate first!';
            events.feedbackColor = '#FCA5A5';
          } else if (shift.inventory.cookingOil <= 0) {
            events.sounds.push('error');
            events.feedbackText = 'Out of Cooking Oil! Buy inside Supermarket';
            events.feedbackColor = '#FCA5A5';
          } else {
            shift.inventory.cookingOil -= 1;
            p.holding = null;
            shift.fryer.status = 'frying';
            shift.fryer.progress = 0;
            shift.fryer.fryingSnack = heldRaw;
            events.sounds.push('pour');
            events.feedbackText = `Frying ${(DRINK_CATALOG[heldRaw] ?? DRINK_CATALOG.samosa).name}...`;
            events.feedbackColor = '#FDBA74';
          }
        } else if (
          shift.fryer.status === 'ready' &&
          shift.fryer.fryingSnack
        ) {
          if (p.holding === null) {
            p.holding = drinkToHotItem(shift.fryer.fryingSnack);
            const sName = (DRINK_CATALOG[shift.fryer.fryingSnack] ?? DRINK_CATALOG.samosa).name;
            shift.fryer.status = 'idle';
            shift.fryer.progress = 0;
            shift.fryer.fryingSnack = null;
            events.sounds.push('pickup');
            events.feedbackText = `Hot ${sName} Ready to Serve!`;
            events.feedbackColor = '#FBBF24';
          } else if (heldRaw && shift.inventory.cookingOil > 0) {
            const readyItem = drinkToHotItem(shift.fryer.fryingSnack);
            const readyName = (DRINK_CATALOG[shift.fryer.fryingSnack] ?? DRINK_CATALOG.samosa).name;
            shift.inventory.cookingOil -= 1;
            p.holding = readyItem;
            shift.fryer.status = 'frying';
            shift.fryer.progress = 0;
            shift.fryer.fryingSnack = heldRaw;
            events.sounds.push('pour');
            events.feedbackText = `Swapped! Took ${readyName} & frying next batch`;
            events.feedbackColor = '#86EFAC';
          }
        }
      } else if (target.kind === 'biscuit_box') {
        if (shift.inventory.biscuits <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Tea Biscuits! Buy inside Supermarket';
          events.feedbackColor = '#FCA5A5';
        } else if (p.holding === null) {
          shift.inventory.biscuits -= 1;
          p.holding = 'biscuit_pack';
          events.sounds.push('pickup');
          events.feedbackText = `Biscuit Pack Taken (${shift.inventory.biscuits} left)`;
          events.feedbackColor = '#FDE68A';
        } else if (p.holding === 'cupcake') {
          shift.inventory.cupcakes += 1;
          shift.inventory.biscuits -= 1;
          p.holding = 'biscuit_pack';
          events.sounds.push('pickup');
          events.feedbackText = 'Swapped Mini Cupcake <-> Tea Biscuits!';
          events.feedbackColor = '#86EFAC';
        } else if (p.holding === 'empty_cup') {
          shift.inventory.cups += 1;
          shift.inventory.biscuits -= 1;
          p.holding = 'biscuit_pack';
          events.sounds.push('pickup');
          events.feedbackText = 'Swapped Disposable Cup <-> Tea Biscuits!';
          events.feedbackColor = '#86EFAC';
        } else {
          events.sounds.push('error');
          events.feedbackText = 'Use Readi Free Space to swap or put down current item!';
          events.feedbackColor = '#FCA5A5';
        }
      } else if (target.kind === 'cupcake_box') {
        if (shift.inventory.cupcakes <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Mini Cupcakes! Buy inside Supermarket';
          events.feedbackColor = '#FCA5A5';
        } else if (p.holding === null) {
          shift.inventory.cupcakes -= 1;
          p.holding = 'cupcake';
          events.sounds.push('pickup');
          events.feedbackText = `Mini Cupcake Taken (${shift.inventory.cupcakes} left)`;
          events.feedbackColor = '#FDE68A';
        } else if (p.holding === 'biscuit_pack') {
          shift.inventory.biscuits += 1;
          shift.inventory.cupcakes -= 1;
          p.holding = 'cupcake';
          events.sounds.push('pickup');
          events.feedbackText = 'Swapped Tea Biscuits <-> Mini Cupcake!';
          events.feedbackColor = '#86EFAC';
        } else if (p.holding === 'empty_cup') {
          shift.inventory.cups += 1;
          shift.inventory.cupcakes -= 1;
          p.holding = 'cupcake';
          events.sounds.push('pickup');
          events.feedbackText = 'Swapped Disposable Cup <-> Mini Cupcake!';
          events.feedbackColor = '#86EFAC';
        } else {
          events.sounds.push('error');
          events.feedbackText = 'Use Readi Free Space to swap or put down current item!';
          events.feedbackColor = '#FCA5A5';
        }
      } else if (target.kind === 'cups') {
        if (shift.inventory.cups <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Cups! Walk inside Supermarket to buy';
          events.feedbackColor = '#FCA5A5';
        } else if (p.holding === null) {
          shift.inventory.cups -= 1;
          p.holding = 'empty_cup';
          events.sounds.push('pickup');
          events.feedbackText = `Cup Taken (${shift.inventory.cups} left)`;
          events.feedbackColor = '#FDE68A';
        } else if (p.holding === 'biscuit_pack') {
          shift.inventory.biscuits += 1;
          shift.inventory.cups -= 1;
          p.holding = 'empty_cup';
          events.sounds.push('pickup');
          events.feedbackText = 'Swapped Tea Biscuits <-> Disposable Cup!';
          events.feedbackColor = '#86EFAC';
        } else if (p.holding === 'cupcake') {
          shift.inventory.cupcakes += 1;
          shift.inventory.cups -= 1;
          p.holding = 'empty_cup';
          events.sounds.push('pickup');
          events.feedbackText = 'Swapped Mini Cupcake <-> Disposable Cup!';
          events.feedbackColor = '#86EFAC';
        } else {
          events.sounds.push('error');
          events.feedbackText = 'Hands full! Use Readi Free Space or serve first';
          events.feedbackColor = '#FCA5A5';
        }
      } else if (target.kind === 'tea_tin') {
        if (p.holding !== 'empty_cup') {
          events.sounds.push('error');
          events.feedbackText = 'Take a Disposable Cup first!';
          events.feedbackColor = '#FCA5A5';
        } else if (shift.inventory.teaLeaves <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Tea Leaves! Buy inside Supermarket';
          events.feedbackColor = '#FCA5A5';
        } else {
          shift.inventory.teaLeaves -= 1;
          p.holding = 'cup_with_tea';
          events.sounds.push('pour');
          events.feedbackText = 'Added Tea Leaves';
          events.feedbackColor = '#86EFAC';
        }
      } else if (target.kind === 'coffee_jar') {
        if (!world.unlockedRecipes.includes('coffee')) {
          events.sounds.push('error');
          events.feedbackText = 'Buy Coffee Recipe inside Supermarket (E)!';
          events.feedbackColor = '#FCA5A5';
        } else if (p.holding !== 'empty_cup') {
          events.sounds.push('error');
          events.feedbackText = 'Take a Disposable Cup first!';
          events.feedbackColor = '#FCA5A5';
        } else if (shift.inventory.coffeePowder <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Coffee Beans! Buy inside Supermarket';
          events.feedbackColor = '#FCA5A5';
        } else {
          shift.inventory.coffeePowder -= 1;
          p.holding = 'cup_with_coffee';
          events.sounds.push('pour');
          events.feedbackText = 'Added Coffee Beans';
          events.feedbackColor = '#86EFAC';
        }
      } else if (target.kind === 'sugar_jar') {
        if (p.holding !== 'cup_with_tea' && p.holding !== 'cup_with_coffee') {
          events.sounds.push('error');
          events.feedbackText = 'Add Tea Leaves or Coffee Beans first!';
          events.feedbackColor = '#FCA5A5';
        } else if (shift.inventory.sugar <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'Out of Sugar! Buy inside Supermarket';
          events.feedbackColor = '#FCA5A5';
        } else {
          shift.inventory.sugar -= 1;
          p.holding =
            p.holding === 'cup_with_coffee'
              ? 'cup_with_coffee_sugar'
              : 'cup_with_tea_sugar';
          events.sounds.push('pour');
          events.feedbackText = 'Added Sugar';
          events.feedbackColor = '#86EFAC';
        }
      } else if (target.kind === 'water_jug') {
        if (
          p.holding !== 'cup_with_tea_sugar' &&
          p.holding !== 'cup_with_coffee_sugar'
        ) {
          events.sounds.push('error');
          events.feedbackText =
            p.holding === 'cup_with_doodh_patti_mix'
              ? 'Doodh Patti needs NO water — boil on Kettle!'
              : 'Add Tea/Coffee + Sugar first before adding Water!';
          events.feedbackColor = '#FCA5A5';
        } else if (shift.inventory.water <= 0) {
          events.sounds.push('error');
          events.feedbackText =
            'Water Jug empty! Refill free at the Water Tap';
          events.feedbackColor = '#FCA5A5';
        } else {
          shift.inventory.water -= 1;
          p.holding =
            p.holding === 'cup_with_coffee_sugar'
              ? 'cup_with_coffee_water'
              : 'cup_with_tea_water';
          events.sounds.push('pour');
          events.feedbackText = `Added Water (${shift.inventory.water} left)`;
          events.feedbackColor = '#7DD3FC';
        }
      } else if (target.kind === 'milk_crate') {
        if (!world.unlockedRecipes.includes('doodh_patti')) {
          events.sounds.push('error');
          events.feedbackText = 'Buy Doodh Patti Recipe inside Supermarket (E)!';
          events.feedbackColor = '#FCA5A5';
        } else if (p.holding !== 'cup_with_tea_sugar') {
          events.sounds.push('error');
          events.feedbackText =
            'Need Cup + Tea Leaves + Sugar before adding Milk Packet!';
          events.feedbackColor = '#FCA5A5';
        } else if (shift.inventory.milkPackets <= 0) {
          events.sounds.push('error');
          events.feedbackText = 'No Milk Packets! Buy from Milkman on Bike';
          events.feedbackColor = '#FCA5A5';
        } else {
          shift.inventory.milkPackets -= 1;
          p.holding = 'cup_with_doodh_patti_mix';
          events.sounds.push('pour');
          events.feedbackText = 'Added Milk Packet (Ready for Kettle!)';
          events.feedbackColor = '#86EFAC';
        }
      } else if (target.kind === 'kettle') {
        const heldMixDrink: DrinkType | null =
          p.holding === 'cup_with_tea_water'
            ? 'tea'
            : p.holding === 'cup_with_doodh_patti_mix'
              ? 'doodh_patti'
              : p.holding === 'cup_with_coffee_water'
                ? 'coffee'
                : null;

        if (shift.kettle.status === 'idle') {
          if (heldMixDrink) {
            p.holding = null;
            shift.kettle.status = 'brewing';
            shift.kettle.progress = 0;
            shift.kettle.brewingDrink = heldMixDrink;
            events.sounds.push('pour');
            events.feedbackText = `Boiling ${(DRINK_CATALOG[heldMixDrink] ?? DRINK_CATALOG.tea).name}...`;
            events.feedbackColor = '#FDBA74';
          } else {
            events.sounds.push('error');
            events.feedbackText =
              p.holding === 'cup_with_tea_sugar' ||
              p.holding === 'cup_with_coffee_sugar'
                ? 'Add Water (or Milk for Doodh Patti) before boiling!'
                : 'Prepare Cup + Ingredients before boiling!';
            events.feedbackColor = '#FCA5A5';
          }
        } else if (
          shift.kettle.status === 'ready' &&
          shift.kettle.brewingDrink
        ) {
          if (p.holding === null) {
            p.holding = drinkToHotItem(shift.kettle.brewingDrink);
            const dName = (DRINK_CATALOG[shift.kettle.brewingDrink] ?? DRINK_CATALOG.tea).name;
            shift.kettle.status = 'idle';
            shift.kettle.progress = 0;
            shift.kettle.brewingDrink = null;
            events.sounds.push('pickup');
            events.feedbackText = `Hot ${dName} Ready to Serve!`;
            events.feedbackColor = '#FBBF24';
          } else if (heldMixDrink) {
            const readyItem = drinkToHotItem(shift.kettle.brewingDrink);
            const readyName = (DRINK_CATALOG[shift.kettle.brewingDrink] ?? DRINK_CATALOG.tea).name;
            p.holding = readyItem;
            shift.kettle.status = 'brewing';
            shift.kettle.progress = 0;
            shift.kettle.brewingDrink = heldMixDrink;
            events.sounds.push('pour');
            events.feedbackText = `Swapped! Took Hot ${readyName} & boiling next cup`;
            events.feedbackColor = '#86EFAC';
          }
        }
      } else if (target.kind === 'customer' && target.customerId) {
        const cust = shift.customers.find((c) => c.id === target.customerId);
        const heldDrink = heldHotDrinkType(p.holding);
        if (cust && cust.status === 'waiting') {
          const orderDrink = cust.orderDrink || 'tea';
          if (heldDrink && heldDrink === orderDrink) {
            const info = DRINK_CATALOG[orderDrink] ?? DRINK_CATALOG.tea;
            const tip = rollRandomTipCents();
            const totalPay = info.priceCents + tip;

            p.holding = null;
            cust.status = 'drinking';
            cust.drinkTimer = 4.2;
            shift.servedCount += 1;
            shift.earningsCents += totalPay;
            world.cashCents += totalPay;
            world.totalServed += 1;
            events.sounds.push('serve');
            events.feedbackText = tip
              ? `+${formatMoney(info.priceCents)} + ${formatMoney(tip)} Happy Tip!`
              : `+${formatMoney(info.priceCents)} ${info.name} Served!`;
            events.feedbackColor = '#FBBF24';

            maybeUnlockLevel2(world, shift, events);
          } else {
            events.openCustomerAction = {
              kind: 'customer',
              id: cust.id,
              requestedDrink: orderDrink,
            };
          }
        }
      } else if (target.kind === 'owner_customer') {
        const owner = shift.supermarketOwner;
        const heldDrink = heldHotDrinkType(p.holding);
        if (owner.phase === 'ordering_chai' && heldDrink === owner.orderDrink) {
          const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
          const tip = rollRandomTipCents();
          const totalPay = info.priceCents + tip;

          p.holding = null;
          owner.phase = 'drinking_chai';
          owner.drinkTimer = 4.2;
          shift.servedCount += 1;
          shift.earningsCents += totalPay;
          world.cashCents += totalPay;
          world.totalServed += 1;
          events.sounds.push('serve');
          events.feedbackText = tip
            ? `Mart Owner Tipped +${formatMoney(tip)}! (+${formatMoney(totalPay)})`
            : `Mart Owner loved ${info.name}! (+${formatMoney(info.priceCents)})`;
          events.feedbackColor = '#86EFAC';

          maybeUnlockLevel2(world, shift, events);
        }
      } else if (target.kind === 'car') {
        const car = shift.carCustomer;
        const heldDrink = heldHotDrinkType(p.holding);
        if (car.phase === 'waiting') {
          const orderDrink = car.orderDrink || 'tea';
          if (heldDrink && heldDrink === orderDrink) {
            const info = DRINK_CATALOG[orderDrink] ?? DRINK_CATALOG.tea;
            const tip = rollRandomTipCents();
            const totalPay = info.priceCents + tip;
            p.holding = null;
            car.qtyServed += 1;
            shift.servedCount += 1;
            shift.earningsCents += totalPay;
            world.cashCents += totalPay;
            world.totalServed += 1;
            events.sounds.push('serve');

            if (car.qtyServed >= car.qtyTotal) {
              car.phase = 'leaving';
              events.feedbackText = tip
                ? `Car Complete! +${formatMoney(info.priceCents)} + ${formatMoney(tip)} Tip!`
                : `Car Order Complete! +${formatMoney(info.priceCents)}`;
              events.feedbackColor = '#FBBF24';
            } else {
              events.feedbackText = `Car 1/${car.qtyTotal} Served (+${formatMoney(totalPay)})`;
              events.feedbackColor = '#86EFAC';
            }

            maybeUnlockLevel2(world, shift, events);
          } else {
            events.openCustomerAction = {
              kind: 'car',
              id: 'car_customer',
              requestedDrink: orderDrink,
            };
          }
        }
      } else if (target.kind === 'trash' && p.holding) {
        p.holding = null;
        events.sounds.push('pickup');
        events.feedbackText = 'Discarded at Trash Bin';
        events.feedbackColor = '#D6C7B5';
      }
    }
  }

  const elapsed = shift.shiftDuration - shift.timeLeft;

  // 6. Milkman on Motorcycle Schedule
  const mk = shift.milkman;
  if (world.stage >= 2) {
    if (mk.phase === 'away') {
      if (elapsed >= mk.nextArrivalElapsed) {
        mk.phase = 'arriving';
        mk.x = -26;
        mk.z = MILKMAN_PARK_POS.z;
        events.sounds.push('bike_bell');
        events.feedbackText = 'Milkman on Motorcycle Approaching...';
        events.feedbackColor = '#FDE68A';
      }
    } else if (mk.phase === 'arriving') {
      mk.x += 4.6 * dt;
      if (mk.x >= MILKMAN_PARK_POS.x) {
        mk.x = MILKMAN_PARK_POS.x;
        mk.phase = 'parked';
        mk.timer = MILKMAN_PARK_DURATION;
        events.sounds.push('bike_bell');
        events.feedbackText = 'Milkman Parked! Press E near bike for Milk Packets';
        events.feedbackColor = '#FDE68A';
      }
    } else if (mk.phase === 'parked') {
      mk.timer -= dt;
      if (mk.timer <= 0) {
        mk.phase = 'departing';
      }
    } else if (mk.phase === 'departing') {
      mk.x += 5.0 * dt;
      if (mk.x >= 26) {
        mk.phase = 'away';
        mk.nextArrivalElapsed = elapsed + 85 + Math.random() * 45;
      }
    }
  }

  // 7. Car Customer Schedule
  const car = shift.carCustomer;
  if (car.phase === 'away') {
    if (elapsed >= car.nextArrivalElapsed) {
      car.phase = 'arriving';
      car.x = 26;
      car.z = CAR_PARK_POS.z;
      car.orderDrink = pickCustomerOrder(world, shift);
      car.qtyTotal = Math.random() < 0.52 ? 2 : 1;
      car.qtyServed = 0;
      car.maxPatience = 85;
      car.patience = 85;
      car.carColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      events.sounds.push('car_horn');
      events.feedbackText = `Car pulling up (${car.qtyTotal}x ${(DRINK_CATALOG[car.orderDrink] ?? DRINK_CATALOG.tea).name})!`;
      events.feedbackColor = '#FDBA74';
    }
  } else if (car.phase === 'arriving') {
    car.x -= 6.2 * dt;
    if (car.x <= CAR_PARK_POS.x) {
      car.x = CAR_PARK_POS.x;
      car.phase = 'waiting';
      events.sounds.push('car_horn');
    }
  } else if (car.phase === 'waiting') {
    car.patience -= dt;
    if (car.patience <= 0) {
      car.phase = 'leaving';
      shift.missedCount += 1;
      events.sounds.push('angry');
      events.feedbackText = 'Car drove off!';
      events.feedbackColor = '#FCA5A5';
    }
  } else if (car.phase === 'leaving') {
    car.x -= 7.4 * dt;
    if (car.x <= -26) {
      car.phase = 'away';
      car.nextArrivalElapsed = elapsed + 38 + Math.random() * 45;
    }
  }

  // 8. Sidewalk Customer Spawning (Rented shops slightly boost customer flow!)
  shift.spawnTimer -= dt;
  if (shift.spawnTimer <= 0) {
    spawnCustomerWave(shift, world);
    const rentBoost = Math.min(0.35, world.rentedShops.length * 0.12);
    shift.spawnTimer = randomSpawnInterval() * (1 - rentBoost);
  }

  // 9. Update Walk-up & Seated Customers + AUTO-PICKUP FROM READI COUNTER!
  const trays = shift.trayItems ?? [shift.trayItem ?? null, null, null, null];
  const snackTrays = shift.snackTrayItems ?? [null, null];
  const nextCustomers: TeaCustomer[] = [];

  for (const c of shift.customers) {
    const biasSign: 1 | -1 = c.seq % 2 === 0 ? 1 : -1;

    if (c.status === 'walking_in') {
      let targetChair: CafeFurniture | undefined;
      if (c.targetChairId) {
        targetChair = world.furniture.find((f) => f.id === c.targetChairId);
        if (!targetChair) {
          c.targetChairId = null;
          const isFried = c.orderDrink === 'samosa' || c.orderDrink === 'pakora';
          const fallbackPool = isFried ? SNACK_CUSTOMER_SLOTS : CUSTOMER_SLOTS;
          const fallbackSlot = fallbackPool[c.slotIndex % fallbackPool.length];
          c.targetX = fallbackSlot.x;
          c.targetZ = fallbackSlot.z;
        }
      }

      if (targetChair) {
        const approach = findChairApproachSpot(targetChair, world, shift);
        const distToChair = Math.hypot(targetChair.x - c.x, targetChair.z - c.z);
        const distToApproach = Math.hypot(approach.x - c.x, approach.z - c.z);

        if (distToChair < 1.1 && distToApproach < 0.55) {
          c.x = targetChair.x;
          c.z = targetChair.z;
          c.status = 'waiting';
          c.seatedChairId = targetChair.id;
          c.targetChairId = null;
          c.selfServeWait = 0;
        } else {
          moveNpcWithAvoidance(c, approach.x, approach.z, 2.35, dt, world, shift, {
            biasSign,
            selfId: c.id,
            stayOnSidewalk: true,
          });
        }
      } else {
        const arrived = moveNpcWithAvoidance(
          c,
          c.targetX,
          c.targetZ,
          2.35,
          dt,
          world,
          shift,
          {
            biasSign,
            selfId: c.id,
            stayOnSidewalk: true,
          }
        );
        if (arrived) {
          c.x = c.targetX;
          c.z = c.targetZ;
          c.status = 'waiting';
          c.selfServeWait = 0;
        }
      }
      nextCustomers.push(c);
    } else if (c.status === 'waiting') {
      // Self-serve auto-pickup from Readi Free Spaces / Snacks Showcase!
      if (!c.seatedChairId) {
        c.selfServeWait = (c.selfServeWait ?? 0) + dt;
        if (c.selfServeWait >= 0.45) {
          const wantedItem = drinkToHotItem(c.orderDrink);
          const isSnackItem =
            c.orderDrink === 'samosa' || c.orderDrink === 'pakora';
          let pickedFromTray = false;

          if (isSnackItem) {
            const sIdx = snackTrays.findIndex((it) => it === wantedItem);
            if (sIdx >= 0) {
              snackTrays[sIdx] = null;
              shift.snackTrayItems = snackTrays;
              pickedFromTray = true;
            }
          }
          if (!pickedFromTray) {
            const tIdx = trays.findIndex((it) => it === wantedItem);
            if (tIdx >= 0) {
              trays[tIdx] = null;
              shift.trayItems = trays;
              shift.trayItem = trays[0] ?? null;
              pickedFromTray = true;
            }
          }

          if (pickedFromTray) {
            const info = DRINK_CATALOG[c.orderDrink] ?? DRINK_CATALOG.tea;
            const tip = rollRandomTipCents();
            const totalPay = info.priceCents + tip;
            c.status = 'drinking';
            c.drinkTimer = 4.2;
            shift.servedCount += 1;
            shift.earningsCents += totalPay;
            world.cashCents += totalPay;
            world.totalServed += 1;
            events.sounds.push('serve');
            events.feedbackText = tip
              ? `Customer grabbed ${info.name} from Readi! +${formatMoney(totalPay)} (incl. tip)`
              : `Customer picked up ${info.name} from Readi & paid +${formatMoney(info.priceCents)}!`;
            events.feedbackColor = '#86EFAC';
            maybeUnlockLevel2(world, shift, events);
            nextCustomers.push(c);
            continue;
          }
        }
      }

      c.patience -= dt;
      if (c.patience <= 0) {
        if (c.seatedChairId) {
          const chair = world.furniture.find((f) => f.id === c.seatedChairId);
          if (chair) {
            const stepOff = findChairApproachSpot(chair, world, shift);
            c.x = stepOff.x;
            c.z = stepOff.z;
          }
        }
        c.targetZ = c.z < CYCLE_ANCHOR.z ? -3.35 : 1.02;
        c.status = 'walking_out';
        c.seatedChairId = null;
        c.targetChairId = null;
        shift.missedCount += 1;
        events.sounds.push('angry');
        events.feedbackText = 'Customer Left';
        events.feedbackColor = '#FCA5A5';
      }
      nextCustomers.push(c);
    } else if (c.status === 'drinking') {
      c.drinkTimer -= dt;
      if (c.drinkTimer <= 0) {
        if (c.seatedChairId) {
          const chair = world.furniture.find((f) => f.id === c.seatedChairId);
          if (chair) {
            const stepOff = findChairApproachSpot(chair, world, shift);
            c.x = stepOff.x;
            c.z = stepOff.z;
          }
        }
        c.targetZ = c.z < CYCLE_ANCHOR.z ? -3.35 : 1.02;
        c.status = 'walking_out';
        c.seatedChairId = null;
        c.targetChairId = null;
      }
      nextCustomers.push(c);
    } else if (c.status === 'walking_out') {
      c.seatedChairId = null;
      c.targetChairId = null;
      const exitX = c.seq % 2 === 0 ? -17.5 : 20.4;
      const exitZ = c.targetZ < CYCLE_ANCHOR.z ? -3.35 : 1.02;
      const arrived = moveNpcWithAvoidance(c, exitX, exitZ, 2.55, dt, world, shift, {
        biasSign,
        selfId: c.id,
        stayOnSidewalk: true,
      });
      if (!arrived && c.x > -17.2 && c.x < 20.1) {
        nextCustomers.push(c);
      }
    }
  }
  shift.customers = nextCustomers;

  // 10. Supermarket Owner NPC Patrol & Occasional Chai Visit (+ Auto-Pickup from Free Space!)
  const owner = shift.supermarketOwner;
  const insideWaypoints = [
    { x: 6.2, z: -5.85 },
    { x: 8.15, z: -5.7 },
    { x: 8.15, z: -7.7 },
    { x: 6.4, z: -4.45 },
  ];
  const moveOwnerToward = (tx: number, tz: number, speed: number): boolean =>
    moveNpcWithAvoidance(owner, tx, tz, speed, dt, world, shift, {
      biasSign: 1,
      selfId: 'owner',
      stayOnSidewalk: false,
    });

  if (owner.phase === 'patrol_inside' || owner.phase === 'stroll_outside') {
    owner.nextVisitTimer -= dt;
    if (owner.nextVisitTimer <= 0) {
      owner.phase = 'walking_to_stall';
      owner.targetX = OWNER_STALL_SPOT.x;
      owner.targetZ = OWNER_STALL_SPOT.z;
      owner.orderDrink =
        world.unlockedRecipes.includes('doodh_patti') && Math.random() < 0.55
          ? 'doodh_patti'
          : 'tea';
      owner.maxPatience = 115;
      owner.patience = 115;
    } else {
      const arrived = moveOwnerToward(owner.targetX, owner.targetZ, 1.85);
      if (arrived) {
        owner.waitTimer -= dt;
        if (owner.waitTimer <= 0) {
          if (Math.random() < 0.35) {
            owner.phase = 'stroll_outside';
            owner.targetX = 5.6 + Math.random() * 2.8;
            owner.targetZ = -2.85;
            owner.waitTimer = 4 + Math.random() * 3.5;
          } else {
            owner.phase = 'patrol_inside';
            const wp =
              insideWaypoints[
                Math.floor(Math.random() * insideWaypoints.length)
              ];
            owner.targetX = wp.x;
            owner.targetZ = wp.z;
            owner.waitTimer = 3.5 + Math.random() * 3.5;
          }
        }
      }
    }
  } else if (owner.phase === 'walking_to_stall') {
    const arrived = moveOwnerToward(OWNER_STALL_SPOT.x, OWNER_STALL_SPOT.z, 2.2);
    if (arrived) {
      owner.phase = 'ordering_chai';
      owner.yaw = Math.atan2(
        CYCLE_ANCHOR.x - owner.x,
        CYCLE_ANCHOR.z - owner.z
      );
      events.feedbackText = `Mart Owner came over for ${(DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea).name}!`;
      events.feedbackColor = '#86EFAC';
    }
  } else if (owner.phase === 'ordering_chai') {
    owner.yaw = Math.atan2(CYCLE_ANCHOR.x - owner.x, CYCLE_ANCHOR.z - owner.z);
    // Mart Owner can also grab his matching chai off the Readi Free Space!
    if (owner.patience <= owner.maxPatience - 0.55) {
      const wantedOwnerItem = drinkToHotItem(owner.orderDrink);
      const tIdx = trays.findIndex((it) => it === wantedOwnerItem);
      if (tIdx >= 0) {
        trays[tIdx] = null;
        shift.trayItems = trays;
        shift.trayItem = trays[0] ?? null;
        const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
        const tip = rollRandomTipCents();
        const totalPay = info.priceCents + tip;
        owner.phase = 'drinking_chai';
        owner.drinkTimer = 4.2;
        shift.servedCount += 1;
        shift.earningsCents += totalPay;
        world.cashCents += totalPay;
        world.totalServed += 1;
        events.sounds.push('serve');
        events.feedbackText = `Mart Owner picked up ${info.name} from Readi & paid +${formatMoney(totalPay)}!`;
        events.feedbackColor = '#86EFAC';
        maybeUnlockLevel2(world, shift, events);
      }
    }
    if (owner.phase === 'ordering_chai') {
      owner.patience -= dt;
      if (owner.patience <= 0) {
        owner.phase = 'returning_to_store';
        events.feedbackText = 'Mart Owner headed back to his store';
        events.feedbackColor = '#D6C7B5';
      }
    }
  } else if (owner.phase === 'drinking_chai') {
    owner.drinkTimer -= dt;
    if (owner.drinkTimer <= 0) {
      owner.phase = 'returning_to_store';
    }
  } else if (owner.phase === 'returning_to_store') {
    const arrived = moveOwnerToward(6.2, -5.85, 2.25);
    if (arrived) {
      owner.phase = 'patrol_inside';
      owner.targetX = 8.15;
      owner.targetZ = -5.7;
      owner.waitTimer = 4;
      owner.nextVisitTimer = 46 + Math.random() * 34;
    }
  }

  // 10b. Hired Kid Helper ("Chotu") Autonomous Chai Readi Work
  stepHelperNpc(shift, world, dt, events);

  // 11. Ambient Footpath Passerby NPCs across expanded plaza
  shift.pedestrianSpawnTimer -= dt;
  if (shift.pedestrianSpawnTimer <= 0) {
    if (shift.pedestrians.length < 5) {
      const seq = shift.nextCustomerSeq;
      shift.nextCustomerSeq += 1;
      const fromLeft = seq % 2 === 0;
      const useUpperPath = Math.random() < 0.62;
      const laneZ = useUpperPath
        ? -3.75 + Math.random() * 0.55
        : 1.46 + Math.random() * 0.12;
      const startX = fromLeft ? -18.0 : 20.6;
      const endX = fromLeft ? 20.8 : -18.2;

      const ped: FootpathPedestrian = {
        id: `ped_${seq}`,
        seq,
        x: startX,
        z: laneZ,
        targetX: endX,
        targetZ: laneZ,
        yaw: fromLeft ? Math.PI / 2 : -Math.PI / 2,
        speed: 1.45 + Math.random() * 0.55,
        walkCycle: Math.random() * 6,
        shirtColor: SHIRT_COLORS[(seq + 2) % SHIRT_COLORS.length],
        hairColor: HAIR_COLORS[(seq + 1) % HAIR_COLORS.length],
        hasBag: Math.random() < 0.45,
      };
      shift.pedestrians.push(ped);
    }
    shift.pedestrianSpawnTimer = 3.2 + Math.random() * 4.2;
  }

  const nextPedestrians: FootpathPedestrian[] = [];
  for (const ped of shift.pedestrians) {
    const arrived = moveNpcWithAvoidance(
      ped,
      ped.targetX,
      ped.targetZ,
      ped.speed,
      dt,
      world,
      shift,
      {
        biasSign: ped.seq % 2 === 0 ? 1 : -1,
        selfId: ped.id,
        stayOnSidewalk: true,
      }
    );
    if (!arrived && ped.x > -18.5 && ped.x < 21.0) {
      nextPedestrians.push(ped);
    }
  }
  shift.pedestrians = nextPedestrians;

  // 12. Pairwise Crowd Separation Pass
  const refs: Array<{
    ref: { x: number; z: number };
    stayOnSidewalk: boolean;
    anchored: boolean;
    allowRoadCurb?: boolean;
  }> = [];
  for (const c of shift.customers) {
    if (c.seatedChairId) continue;
    if (c.status === 'walking_out' && (c.x < -15.8 || c.x > 18.8)) continue;
    refs.push({
      ref: c,
      stayOnSidewalk: true,
      anchored: c.status === 'waiting' || c.status === 'drinking',
    });
  }
  for (const ped of shift.pedestrians) {
    if (ped.x < -15.8 || ped.x > 18.8) continue;
    refs.push({ ref: ped, stayOnSidewalk: true, anchored: false });
  }
  if (owner.z > -3.5) {
    refs.push({
      ref: owner,
      stayOnSidewalk: false,
      anchored: owner.phase === 'ordering_chai' || owner.phase === 'drinking_chai',
    });
  }
  if (shift.helper.status === 'hired') {
    refs.push({
      ref: shift.helper,
      stayOnSidewalk: true,
      anchored: false,
      allowRoadCurb: shift.helper.z > 1.55 || shift.helper.task === 'serving',
    });
  }

  const minPersonGap = 0.82;
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const itemA = refs[i];
      const itemB = refs[j];
      const a = itemA.ref;
      const b = itemB.ref;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minPersonGap) {
        const nx = dist > 0.001 ? dx / dist : i % 2 === 0 ? 1 : -1;
        const nz = dist > 0.001 ? dz / dist : 0;
        const overlap = minPersonGap - dist;
        const wA =
          itemA.anchored && !itemB.anchored
            ? 0.1
            : !itemA.anchored && itemB.anchored
              ? 0.9
              : 0.5;
        const wB = 1 - wA;
        a.x -= nx * overlap * wA;
        a.z -= nz * overlap * wA;
        b.x += nx * overlap * wB;
        b.z += nz * overlap * wB;
        a.z = clamp(
          a.z,
          itemA.stayOnSidewalk ? -4.85 : -8.35,
          itemA.allowRoadCurb ? 2.75 : 1.6
        );
        b.z = clamp(
          b.z,
          itemB.stayOnSidewalk ? -4.85 : -8.35,
          itemB.allowRoadCurb ? 2.75 : 1.6
        );
        resolveCollisionBox(
          a,
          CYCLE_ANCHOR.x - 3.7,
          CYCLE_ANCHOR.x + 3.7,
          CYCLE_ANCHOR.z - 0.82,
          CYCLE_ANCHOR.z + 0.82,
          0.36
        );
        resolveCollisionBox(
          b,
          CYCLE_ANCHOR.x - 3.7,
          CYCLE_ANCHOR.x + 3.7,
          CYCLE_ANCHOR.z - 0.82,
          CYCLE_ANCHOR.z + 0.82,
          0.36
        );
      }
    }
  }

  return events;
}
