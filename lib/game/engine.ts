import {
  BEGGAR_COLD_SLOTS,
  BEGGAR_KID_MAX_SALES_BOOST,
  BEGGAR_KID_SALES_BOOST_PER_HELP,
  BEGGAR_KID_SLOTS,
  BEGGAR_KID_WAIT_SECONDS,
  BEGGAR_MARKETING_SPOTS,
  BEGGAR_SNACK_SLOTS,
  BANK_LOAN_OPTIONS,
  BANK_SHOP,
  BUYER_SHOP,
  CAR_PARK_POS,
  CHILLING_DURATION,
  COLD_CART_ANCHOR,
  COLD_CART_PRICE_CENTS,
  COLD_CUSTOMER_SLOTS,
  COLD_STATIONS,
  COLD_TRAY_SPOTS,
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
  HELPER_NPCS,
  HELPER_NPC_IDS,
  HELPER_WAGE_CENTS,
  KETTLING_DURATION,
  KID_SIT_POS,
  LEVEL2_SERVED_THRESHOLD,
  MARKETING_DURATION,
  MAX_WATER_CAPACITY,
  MILKMAN_PARK_DURATION,
  MILKMAN_PARK_POS,
  OWNER_STALL_SPOT,
  PLAYER_SPEED,
  RANDOM_TIP_AMOUNTS_CENTS,
  RANDOM_TIP_CHANCE,
  RENTABLE_BUILDINGS,
  SHOP_VISITOR_SLOTS,
  SNACKS_CART_ANCHOR,
  SNACKS_CART_PRICE_CENTS,
  SNACK_CUSTOMER_SLOTS,
  SNACK_STATIONS,
  SNACK_TRAY_SPOTS,
  STARTING_CASH_CENTS,
  STARTING_CUPS,
  STARTING_SUGAR,
  STARTING_WATER,
  STARTING_TEA,
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
  WOOD_MASTER_SHOP,
  WORLD_BOUNDS,
  CHAIR_PRICE_CENTS,
  TABLE_PRICE_CENTS,
  SHOP_KITCHEN_PRICE_CENTS,
  RESALE_RATE,
  drinkToHotItem,
  formatMoney,
  getHelperWageCents,
  getShopKitchenBounds,
  getShopKitchenStations,
  heldFurnitureKind,
  heldHotDrinkType,
  isSwappableCounterItem,
} from './constants.ts';
import type {
  BeggarKidCustomer,
  CafeFurniture,
  DrinkType,
  FootpathPedestrian,
  HeldItem,
  HelperKidState,
  HelperNpcId,
  InteractTargetKind,
  InventoryState,
  Player2State,
  Player3DState,
  ShiftSnapshot,
  ShopBuildingId,
  ShopVisitorId,
  ShopVisitorState,
  SimStepEvents,
  Stage1Input,
  SupermarketOwnerState,
  TeaCustomer,
  WorldSave,
} from './types.ts';

function isInsideAnyRentedShop(x: number, z: number, world: WorldSave): boolean {
  for (const rec of world.rentedShops) {
    const b = RENTABLE_BUILDINGS.find((cfg) => cfg.id === rec.buildingId);
    if (!b) continue;
    if (
      x >= b.bounds.minX - 0.15 &&
      x <= b.bounds.maxX + 0.15 &&
      z >= b.bounds.minZ - 0.15 &&
      z <= b.bounds.maxZ + 0.25
    ) {
      return true;
    }
  }
  return false;
}

function hasShopKitchen(world: WorldSave, buildingId: ShopBuildingId): boolean {
  return (world.shopKitchens ?? []).includes(buildingId);
}

function getFirstRentedBuilding(world: WorldSave) {
  for (const rec of world.rentedShops) {
    const b = RENTABLE_BUILDINGS.find((cfg) => cfg.id === rec.buildingId);
    if (b) return b;
  }
  return null;
}

function getFirstKitchenBuilding(world: WorldSave) {
  for (const rec of world.rentedShops) {
    if (!hasShopKitchen(world, rec.buildingId)) continue;
    const b = RENTABLE_BUILDINGS.find((cfg) => cfg.id === rec.buildingId);
    if (b) return b;
  }
  return null;
}

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

export function createDefaultHelper(id: HelperNpcId = 'chotu'): HelperKidState {
  const cfg = HELPER_NPCS[id];
  return {
    id,
    name: cfg.name,
    role: cfg.role,
    x: cfg.sitPos.x,
    z: cfg.sitPos.z,
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

export function getShiftHelpers(shift: ShiftSnapshot): HelperKidState[] {
  if (Array.isArray(shift.helpers) && shift.helpers.length > 0) {
    return shift.helpers;
  }
  return [shift.helper];
}

export function applySalesBoostCents(
  baseCents: number,
  shift: ShiftSnapshot
): number {
  const boostPct = Math.max(0, shift.salesBoostPercent ?? 0);
  if (boostPct <= 0) return baseCents;
  return Math.round(baseCents * (1 + boostPct / 100));
}

export function createDefaultShopVisitors(): ShopVisitorState[] {
  const west = RENTABLE_BUILDINGS.find((b) => b.id === 'west_shop')!;
  const center = RENTABLE_BUILDINGS.find((b) => b.id === 'center_shop')!;
  const east = RENTABLE_BUILDINGS.find((b) => b.id === 'east_shop')!;

  return [
    {
      id: 'west_owner',
      name: west.ownerName,
      roleLabel: 'Shop Owner',
      x: west.ownerPos.x,
      z: west.ownerPos.z,
      yaw: 0,
      homeX: west.ownerPos.x,
      homeZ: west.ownerPos.z,
      homeYaw: 0,
      doorX: (west.doorMinX + west.doorMaxX) / 2,
      doorZ: west.bounds.maxZ,
      counterX: west.counterPos.x,
      counterZ: west.counterPos.z,
      phase: 'at_shop',
      targetX: west.ownerPos.x,
      targetZ: west.ownerPos.z,
      nextVisitTimer: 22 + Math.random() * 14,
      orderDrink: 'tea',
      patience: 105,
      maxPatience: 105,
      drinkTimer: 0,
      walkCycle: 0,
      shirtColor: west.ownerShirtHex,
      hairColor: '#1C1917',
    },
    {
      id: 'center_owner',
      name: center.ownerName,
      roleLabel: 'Shop Owner',
      x: center.ownerPos.x,
      z: center.ownerPos.z,
      yaw: 0,
      homeX: center.ownerPos.x,
      homeZ: center.ownerPos.z,
      homeYaw: 0,
      doorX: (center.doorMinX + center.doorMaxX) / 2,
      doorZ: center.bounds.maxZ,
      counterX: center.counterPos.x,
      counterZ: center.counterPos.z,
      phase: 'at_shop',
      targetX: center.ownerPos.x,
      targetZ: center.ownerPos.z,
      nextVisitTimer: 40 + Math.random() * 18,
      orderDrink: 'tea',
      patience: 105,
      maxPatience: 105,
      drinkTimer: 0,
      walkCycle: 0,
      shirtColor: center.ownerShirtHex,
      hairColor: '#1C1917',
    },
    {
      id: 'east_owner',
      name: east.ownerName,
      roleLabel: 'Shop Owner',
      x: east.ownerPos.x,
      z: east.ownerPos.z,
      yaw: 0,
      homeX: east.ownerPos.x,
      homeZ: east.ownerPos.z,
      homeYaw: 0,
      doorX: (east.doorMinX + east.doorMaxX) / 2,
      doorZ: east.bounds.maxZ,
      counterX: east.counterPos.x,
      counterZ: east.counterPos.z,
      phase: 'at_shop',
      targetX: east.ownerPos.x,
      targetZ: east.ownerPos.z,
      nextVisitTimer: 58 + Math.random() * 20,
      orderDrink: 'tea',
      patience: 105,
      maxPatience: 105,
      drinkTimer: 0,
      walkCycle: 0,
      shirtColor: east.ownerShirtHex,
      hairColor: '#1C1917',
    },
    {
      id: 'gear_buyer',
      name: BUYER_SHOP.buyerName,
      roleLabel: 'Gear Buyer',
      x: BUYER_SHOP.buyerPos.x,
      z: BUYER_SHOP.buyerPos.z,
      yaw: 0,
      homeX: BUYER_SHOP.buyerPos.x,
      homeZ: BUYER_SHOP.buyerPos.z,
      homeYaw: 0,
      doorX: (BUYER_SHOP.doorMinX + BUYER_SHOP.doorMaxX) / 2,
      doorZ: BUYER_SHOP.bounds.maxZ,
      counterX: BUYER_SHOP.counterPos.x,
      counterZ: BUYER_SHOP.counterPos.z,
      phase: 'at_shop',
      targetX: BUYER_SHOP.buyerPos.x,
      targetZ: BUYER_SHOP.buyerPos.z,
      nextVisitTimer: 74 + Math.random() * 20,
      orderDrink: 'tea',
      patience: 105,
      maxPatience: 105,
      drinkTimer: 0,
      walkCycle: 0,
      shirtColor: BUYER_SHOP.buyerShirtHex,
      hairColor: '#1C1917',
    },
    {
      id: 'wood_master',
      name: WOOD_MASTER_SHOP.masterName,
      roleLabel: 'Wood Master',
      x: WOOD_MASTER_SHOP.masterPos.x,
      z: WOOD_MASTER_SHOP.masterPos.z,
      yaw: 0,
      homeX: WOOD_MASTER_SHOP.masterPos.x,
      homeZ: WOOD_MASTER_SHOP.masterPos.z,
      homeYaw: 0,
      doorX: (WOOD_MASTER_SHOP.doorMinX + WOOD_MASTER_SHOP.doorMaxX) / 2,
      doorZ: WOOD_MASTER_SHOP.bounds.maxZ,
      counterX: WOOD_MASTER_SHOP.counterPos.x,
      counterZ: WOOD_MASTER_SHOP.counterPos.z,
      phase: 'at_shop',
      targetX: WOOD_MASTER_SHOP.masterPos.x,
      targetZ: WOOD_MASTER_SHOP.masterPos.z,
      nextVisitTimer: 28 + Math.random() * 16,
      orderDrink: 'tea',
      patience: 110,
      maxPatience: 110,
      drinkTimer: 0,
      walkCycle: 0,
      shirtColor: WOOD_MASTER_SHOP.masterShirtHex,
      hairColor: '#451A03',
    },
  ];
}

export function getShiftShopVisitors(shift: ShiftSnapshot): ShopVisitorState[] {
  if (!Array.isArray(shift.shopVisitors) || shift.shopVisitors.length === 0) {
    shift.shopVisitors = createDefaultShopVisitors();
  }
  return shift.shopVisitors;
}

export function getShiftBeggarKids(shift: ShiftSnapshot): BeggarKidCustomer[] {
  if (!Array.isArray(shift.beggarKids)) {
    shift.beggarKids = [];
  }
  return shift.beggarKids;
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
    disabledMenuItems: [],
    hasTeaStall: true,
    hasSnacksCart: false,
    hasColdCart: false,
    rentedShops: [],
    shopKitchens: [],
    woodOrders: [],
    furniture: [],
    pendingFurniture: [],
    activeShift: null,
  };
}

export interface ShiftCarryOver {
  playerHolding?: HeldItem;
  player2Holding?: HeldItem;
  player2Active?: boolean;
  trayItems?: HeldItem[];
  snackTrayItems?: HeldItem[];
  coldTrayItems?: HeldItem[];
  kettle?: ShiftSnapshot['kettle'];
  fryer?: ShiftSnapshot['fryer'];
  chiller?: ShiftSnapshot['chiller'];
}

function normalizeCarryOverSlots(
  items: HeldItem[] | undefined,
  count: number
): HeldItem[] {
  return Array.from({ length: count }, (_, idx) => items?.[idx] ?? null);
}

export function createInitialShift(
  world: WorldSave,
  carryInventory?: InventoryState,
  carryOver?: ShiftCarryOver
): ShiftSnapshot {
  const trayItems = normalizeCarryOverSlots(carryOver?.trayItems, 4);
  const snackTrayItems = normalizeCarryOverSlots(carryOver?.snackTrayItems, 2);
  const coldTrayItems = normalizeCarryOverSlots(carryOver?.coldTrayItems, 2);
  const kettle = carryOver?.kettle
    ? {
        status: carryOver.kettle.status,
        progress: carryOver.kettle.progress,
        brewingDrink: carryOver.kettle.brewingDrink ?? null,
      }
    : { status: 'idle' as const, progress: 0, brewingDrink: null };
  const fryer = carryOver?.fryer
    ? {
        status: carryOver.fryer.status,
        progress: carryOver.fryer.progress,
        fryingSnack: carryOver.fryer.fryingSnack ?? null,
      }
    : { status: 'idle' as const, progress: 0, fryingSnack: null };
  const chiller = carryOver?.chiller
    ? {
        status: carryOver.chiller.status,
        progress: carryOver.chiller.progress,
        chillingItem: carryOver.chiller.chillingItem ?? null,
      }
    : { status: 'idle' as const, progress: 0, chillingItem: null };

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
      holding: carryOver?.playerHolding ?? null,
      walkCycle: 0,
      dashCooldown: 0,
      dashTimer: 0,
      isMoving: false,
      sittingChairId: null,
    },
    player2: {
      x: -0.75,
      z: -2.45,
      yaw: 0,
      holding: carryOver?.player2Holding ?? null,
      walkCycle: 0,
      dashCooldown: 0,
      dashTimer: 0,
      isMoving: false,
      sittingChairId: null,
      active: carryOver?.player2Active ?? false,
    },
    trayItem: trayItems[0] ?? null,
    trayItems,
    snackTrayItems,
    coldTrayItems,
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
          iceBlocks: carryInventory.iceBlocks ?? 0,
          coldDrinkBottles: carryInventory.coldDrinkBottles ?? 0,
          iceCreamMix: carryInventory.iceCreamMix ?? 0,
          iceCreamCones: carryInventory.iceCreamCones ?? 0,
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
          iceBlocks: 0,
          coldDrinkBottles: 0,
          iceCreamMix: 0,
          iceCreamCones: 0,
        },
    kettle,
    fryer,
    chiller,
    helper: createDefaultHelper('chotu'),
    helpers: HELPER_NPC_IDS.map((id) => createDefaultHelper(id)),
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
      nextVisitTimer: 26 + Math.random() * 18,
      orderDrink: 'tea',
      patience: 115,
      maxPatience: 115,
      drinkTimer: 0,
      walkCycle: 0,
    },
    shopVisitors: createDefaultShopVisitors(),
    beggarKids: [],
    beggarSpawnTimer: 16,
    beggarKidsHelped: 0,
    salesBoostPercent: 0,
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
  const isInsideBuildingFootprint = (
    b: { minX: number; maxX: number; minZ: number; maxZ: number },
    pad = 0.25
  ) =>
    x >= b.minX - pad &&
    x <= b.maxX + pad &&
    z >= b.minZ - pad &&
    z <= b.maxZ + pad;

  const onOutdoorSidewalk =
    x >= WORLD_BOUNDS.minX + 0.8 &&
    x <= WORLD_BOUNDS.maxX - 0.8 &&
    z >= WORLD_BOUNDS.minZ + 0.6 &&
    z <= 1.5 &&
    !isInsideBuildingFootprint(SUPERMARKET_BOUNDS, 0.25) &&
    !isInsideBuildingFootprint(BUYER_SHOP.bounds, 0.25) &&
    !isInsideBuildingFootprint(WOOD_MASTER_SHOP.bounds, 0.25) &&
    !isInsideBuildingFootprint(BANK_SHOP.bounds, 0.25) &&
    !RENTABLE_BUILDINGS.some((b) => isInsideBuildingFootprint(b.bounds, 0.25));

  let insideRentedShop = false;
  if (world?.rentedShops?.length) {
    for (const rec of world.rentedShops) {
      const cfg = RENTABLE_BUILDINGS.find((b) => b.id === rec.buildingId);
      if (!cfg) continue;
      const kb = getShopKitchenBounds(cfg);
      const kitchenInstalled = hasShopKitchen(world, cfg.id);
      const nearOwnerCounter =
        Math.abs(x - cfg.counterPos.x) < 1.35 &&
        Math.abs(z - cfg.counterPos.z) < 0.78;
      const nearKitchen =
        kitchenInstalled &&
        x > kb.minX - 0.45 &&
        x < kb.maxX + 0.45 &&
        z > kb.minZ - 0.45 &&
        z < kb.maxZ + 0.45;
      const minZAllow = kitchenInstalled ? cfg.bounds.minZ + 2.75 : cfg.bounds.minZ + 0.9;
      if (
        !nearOwnerCounter &&
        !nearKitchen &&
        x >= cfg.bounds.minX + 0.65 &&
        x <= cfg.bounds.maxX - 0.65 &&
        z >= minZAllow &&
        z <= cfg.bounds.maxZ - 0.55
      ) {
        insideRentedShop = true;
        break;
      }
    }
  }

  if (!onOutdoorSidewalk && !insideRentedShop) {
    return false;
  }

  // Keep clear of 4-Wheel Chai Readi (only when player still owns it)
  if (
    world?.hasTeaStall !== false &&
    x > CYCLE_ANCHOR.x - 4.15 &&
    x < CYCLE_ANCHOR.x + 4.15 &&
    z > CYCLE_ANCHOR.z - 1.28 &&
    z < CYCLE_ANCHOR.z + 1.28
  ) {
    return false;
  }

  // Keep clear of 2nd Snacks Readi plot (4.8m x 1.64m)
  if (
    world?.hasSnacksCart &&
    x > SNACKS_CART_ANCHOR.x - 2.85 &&
    x < SNACKS_CART_ANCHOR.x + 2.85 &&
    z > SNACKS_CART_ANCHOR.z - 1.28 &&
    z < SNACKS_CART_ANCHOR.z + 1.28
  ) {
    return false;
  }

  // Keep clear of 3rd Cold Readi plot (4.8m x 1.64m)
  if (
    world?.hasColdCart &&
    x > COLD_CART_ANCHOR.x - 2.85 &&
    x < COLD_CART_ANCHOR.x + 2.85 &&
    z > COLD_CART_ANCHOR.z - 1.28 &&
    z < COLD_CART_ANCHOR.z + 1.28
  ) {
    return false;
  }

  // Keep clear of Water Tap, Trash Bin & All Sitting Helper Kid Mats
  if (
    Math.hypot(x - WATER_TAP_POS.x, z - WATER_TAP_POS.z) < 0.95 ||
    Math.hypot(x - TRASH_BIN_POS.x, z - TRASH_BIN_POS.z) < 0.85
  ) {
    return false;
  }
  for (const id of HELPER_NPC_IDS) {
    const sp = HELPER_NPCS[id].sitPos;
    if (Math.hypot(x - sp.x, z - sp.z) < 0.95) {
      return false;
    }
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
  if (shift.player2?.active && shift.player2.sittingChairId) {
    occupied.add(shift.player2.sittingChairId);
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

export function isMenuItemEnabled(
  world: WorldSave,
  item: DrinkType
): boolean {
  return !(world.disabledMenuItems ?? []).includes(item);
}

export function getDrinkStockStatus(
  drink: DrinkType,
  shift: ShiftSnapshot
): { inStock: boolean; missing: string[] } {
  const inv = shift.inventory;
  const missing: string[] = [];

  if (drink === 'tea') {
    if (inv.cups <= 0) missing.push('Cups');
    if (inv.teaLeaves <= 0) missing.push('Tea');
    if (inv.sugar <= 0) missing.push('Sugar');
    if (inv.water <= 0) missing.push('Water');
  } else if (drink === 'doodh_patti') {
    if (inv.cups <= 0) missing.push('Cups');
    if (inv.teaLeaves <= 0) missing.push('Tea');
    if (inv.sugar <= 0) missing.push('Sugar');
    if (inv.milkPackets <= 0) missing.push('Milk');
  } else if (drink === 'coffee') {
    if (inv.cups <= 0) missing.push('Cups');
    if (inv.coffeePowder <= 0) missing.push('Beans');
    if (inv.sugar <= 0) missing.push('Sugar');
    if (inv.water <= 0) missing.push('Water');
  } else if (drink === 'biscuit_pack') {
    if (inv.biscuits <= 0) missing.push('Biscuits');
  } else if (drink === 'cupcake') {
    if (inv.cupcakes <= 0) missing.push('Cupcakes');
  } else if (drink === 'samosa') {
    if (inv.samosaMix <= 0) missing.push('Samosa Mix');
    if (inv.cookingOil <= 0) missing.push('Oil');
  } else if (drink === 'pakora') {
    if (inv.pakoraMix <= 0) missing.push('Pakora Mix');
    if (inv.cookingOil <= 0) missing.push('Oil');
  } else if (drink === 'cold_drink') {
    if ((inv.coldDrinkBottles ?? 0) <= 0) missing.push('Soda Bottles');
    if ((inv.iceBlocks ?? 0) <= 0) missing.push('Ice Blocks');
  } else if (drink === 'ice_cream') {
    if ((inv.iceCreamCones ?? 0) <= 0) missing.push('Cones');
    if ((inv.iceCreamMix ?? 0) <= 0) missing.push('IC Mix');
    if ((inv.iceBlocks ?? 0) <= 0) missing.push('Ice Blocks');
  }

  return { inStock: missing.length === 0, missing };
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
  const coldTrays = shift.coldTrayItems ?? [null, null];

  const p2Holding = shift.player2?.active ? shift.player2.holding : null;
  const hasBiscuitStock =
    shift.inventory.biscuits > 0 ||
    shift.player.holding === 'biscuit_pack' ||
    p2Holding === 'biscuit_pack' ||
    trays.includes('biscuit_pack');
  const hasCupcakeStock =
    shift.inventory.cupcakes > 0 ||
    shift.player.holding === 'cupcake' ||
    p2Holding === 'cupcake' ||
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
      p2Holding === 'hot_samosa' ||
      p2Holding === 'raw_samosa' ||
      snackTrays.includes('hot_samosa') ||
      trays.includes('hot_samosa');
    const hasPakoraStock =
      shift.inventory.pakoraMix > 0 ||
      shift.player.holding === 'hot_pakora' ||
      shift.player.holding === 'raw_pakora' ||
      p2Holding === 'hot_pakora' ||
      p2Holding === 'raw_pakora' ||
      snackTrays.includes('hot_pakora') ||
      trays.includes('hot_pakora');

    if (hasSamosaStock || !hasPakoraStock) {
      pool.push('samosa');
    }
    if (hasPakoraStock || !hasSamosaStock) {
      pool.push('pakora');
    }
  }

  if (world.hasColdCart) {
    const hasSodaStock =
      (shift.inventory.coldDrinkBottles ?? 0) > 0 ||
      shift.player.holding === 'chilled_cold_drink' ||
      shift.player.holding === 'cold_bottle_iced' ||
      p2Holding === 'chilled_cold_drink' ||
      coldTrays.includes('chilled_cold_drink') ||
      trays.includes('chilled_cold_drink');
    const hasIceCreamStock =
      ((shift.inventory.iceCreamMix ?? 0) > 0 &&
        (shift.inventory.iceCreamCones ?? 0) > 0) ||
      shift.player.holding === 'ready_ice_cream' ||
      shift.player.holding === 'iced_cream_mix' ||
      p2Holding === 'ready_ice_cream' ||
      coldTrays.includes('ready_ice_cream') ||
      trays.includes('ready_ice_cream');

    if (hasSodaStock || !hasIceCreamStock) {
      pool.push('cold_drink');
    }
    if (hasIceCreamStock || !hasSodaStock) {
      pool.push('ice_cream');
    }
  }

  const enabledPool = pool.filter((item) => isMenuItemEnabled(world, item));
  if (enabledPool.length > 0) {
    return enabledPool;
  }
  return [baseDrinks[0] ?? 'tea'];
}

function pickCustomerOrder(world: WorldSave, shift: ShiftSnapshot): DrinkType {
  const pool = getAvailableMenuChoices(world, shift);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getStallLookTargetForDrink(
  drink: DrinkType,
  world: WorldSave
): { x: number; z: number } {
  if (world.hasSnacksCart && (drink === 'samosa' || drink === 'pakora')) {
    return SNACKS_CART_ANCHOR;
  }
  if (world.hasColdCart && (drink === 'cold_drink' || drink === 'ice_cream')) {
    return COLD_CART_ANCHOR;
  }
  const firstBuilt = getFirstKitchenBuilding(world) ?? getFirstRentedBuilding(world);
  if (world.hasTeaStall === false && firstBuilt) {
    return {
      x: (firstBuilt.doorMinX + firstBuilt.doorMaxX) / 2,
      z: firstBuilt.bounds.maxZ - 0.8,
    };
  }
  return CYCLE_ANCHOR;
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
  const helpedKids = shift.beggarKidsHelped ?? 0;
  const activeNormalCustomers = shift.customers.filter(
    (c) => c.status !== 'walking_out'
  ).length;
  if (activeNormalCustomers >= 4) return;

  const isSnackOrder = (d: DrinkType) => d === 'samosa' || d === 'pakora';
  const isColdOrder = (d: DrinkType) => d === 'cold_drink' || d === 'ice_cream';

  const usedChaiSlots = new Set(
    shift.customers
      .filter(
        (c) =>
          c.status !== 'walking_out' &&
          !c.targetChairId &&
          !c.seatedChairId &&
          !isSnackOrder(c.orderDrink) &&
          !isColdOrder(c.orderDrink)
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
          isSnackOrder(c.orderDrink)
      )
      .map((c) => c.slotIndex)
  );
  const freeSnackSlots = SNACK_CUSTOMER_SLOTS.map((_, i) => i).filter(
    (i) => !usedSnackSlots.has(i)
  );

  const usedColdSlots = new Set(
    shift.customers
      .filter(
        (c) =>
          c.status !== 'walking_out' &&
          !c.targetChairId &&
          !c.seatedChairId &&
          isColdOrder(c.orderDrink)
      )
      .map((c) => c.slotIndex)
  );
  const freeColdSlots = COLD_CUSTOMER_SLOTS.map((_, i) => i).filter(
    (i) => !usedColdSlots.has(i)
  );

  const fromLeft = shift.nextCustomerSeq % 2 === 1;
  const multiChance = 0.38 + Math.min(0.38, helpedKids * 0.12);
  const maxSpawn =
    Math.random() < multiChance
      ? helpedKids >= 2 && Math.random() < 0.45
        ? 3
        : 2
      : 1;

  for (let i = 0; i < maxSpawn; i++) {
    const standingReadhiCount = shift.customers.filter(
      (c) =>
        c.status !== 'walking_out' &&
        !c.targetChairId &&
        !c.seatedChairId
    ).length;
    let orderDrink = pickCustomerOrder(world, shift);
    let isFried = isSnackOrder(orderDrink);
    let isCold = isColdOrder(orderDrink);
    const openChair = findAvailableChair(shift, world);

    let slotIndex = 0;
    if (!openChair) {
      if (standingReadhiCount >= 5) break;
      if (isFried) {
        const nextSnackSlot = freeSnackSlots.shift();
        if (nextSnackSlot !== undefined) {
          slotIndex = nextSnackSlot;
        } else {
          const nextChai = freeChaiSlots.shift();
          const fallbackDrinks = getAvailableMenuChoices(world, shift).filter(
            (d) => !isSnackOrder(d) && !isColdOrder(d)
          );
          if (nextChai === undefined || fallbackDrinks.length === 0) break;
          orderDrink =
            fallbackDrinks[Math.floor(Math.random() * fallbackDrinks.length)];
          isFried = false;
          isCold = false;
          slotIndex = nextChai;
        }
      } else if (isCold) {
        const nextColdSlot = freeColdSlots.shift();
        if (nextColdSlot !== undefined) {
          slotIndex = nextColdSlot;
        } else {
          const nextChai = freeChaiSlots.shift();
          const fallbackDrinks = getAvailableMenuChoices(world, shift).filter(
            (d) => !isSnackOrder(d) && !isColdOrder(d)
          );
          if (nextChai === undefined || fallbackDrinks.length === 0) break;
          orderDrink =
            fallbackDrinks[Math.floor(Math.random() * fallbackDrinks.length)];
          isFried = false;
          isCold = false;
          slotIndex = nextChai;
        }
      } else {
        const nextChai = freeChaiSlots.shift();
        if (nextChai === undefined) break;
        slotIndex = nextChai;
      }
    }

    const firstRented = getFirstKitchenBuilding(world) ?? getFirstRentedBuilding(world);
    const activeChaiSlots =
      world.hasTeaStall === false && firstRented
        ? [
            { x: firstRented.doorMinX - 0.5, z: -3.55 },
            { x: (firstRented.doorMinX + firstRented.doorMaxX) / 2, z: -3.55 },
            { x: firstRented.doorMaxX + 0.5, z: -3.55 },
            { x: firstRented.doorMaxX + 1.7, z: -3.55 },
          ]
        : CUSTOMER_SLOTS;

    const slot = isFried
      ? SNACK_CUSTOMER_SLOTS[slotIndex % SNACK_CUSTOMER_SLOTS.length]
      : isCold
        ? COLD_CUSTOMER_SLOTS[slotIndex % COLD_CUSTOMER_SLOTS.length]
        : activeChaiSlots[slotIndex % activeChaiSlots.length];
    const targetX = openChair ? openChair.x : slot.x;
    const targetZ = openChair ? openChair.z : slot.z;
    const maxPatience = (openChair ? 105 : 80) + Math.random() * 20;

    const cust: TeaCustomer = {
      id: `cust_${shift.nextCustomerSeq}`,
      seq: shift.nextCustomerSeq,
      slotIndex,
      x:
        (fromLeft ? WORLD_BOUNDS.minX + 0.8 : WORLD_BOUNDS.maxX - 0.8) +
        (i === 1 ? (fromLeft ? -2.1 : 2.1) : 0),
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
  p: Player3DState,
  shift: ShiftSnapshot,
  world: WorldSave,
  kind?: 'chair' | 'table'
): CafeFurniture | null {
  const occupiedChairs = new Set<string>();
  if (shift.player.sittingChairId) occupiedChairs.add(shift.player.sittingChairId);
  if (shift.player2?.active && shift.player2.sittingChairId) {
    occupiedChairs.add(shift.player2.sittingChairId);
  }
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
  helperId?: HelperNpcId;
  visitorId?: ShopVisitorId;
  beggarKidId?: string;
}

export function findInteractTarget(
  shift: ShiftSnapshot,
  world: WorldSave
): TargetLookup | null {
  return findInteractTargetForPlayer(shift.player, shift, world);
}

export function findInteractTargetForPlayer(
  p: Player3DState,
  shift: ShiftSnapshot,
  world: WorldSave
): TargetLookup | null {

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

  // 0b. Second-Hand Buyer Counter (prioritized even when holding a chair/table!)
  const dBuyerPre = Math.hypot(
    BUYER_SHOP.counterPos.x - p.x,
    BUYER_SHOP.counterPos.z + 0.7 - p.z
  );
  if (dBuyerPre < 2.25) {
    return {
      kind: 'gear_buyer',
      x: BUYER_SHOP.buyerPos.x,
      z: BUYER_SHOP.buyerPos.z,
      prompt: `[E] Meet ${BUYER_SHOP.buyerName} · Sell Stalls, Chairs & Tables (-50%)`,
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

  // 2. Serving hot drinks / fried snacks / cold drinks / ice cream to matching Customer, Poor Kid, Hungry Corner Beggar, Shop Visitors, Mart Owner, or Car
  if (heldDrink) {
    // Check waiting Poor Beggar Kids & Hungry Sitting Helpers if player holds what they asked for
    let bestBeggar: BeggarKidCustomer | null = null;
    let bestBeggarDist = 2.85;
    for (const bk of getShiftBeggarKids(shift)) {
      if (bk.status !== 'waiting' || bk.orderDrink !== heldDrink) continue;
      const d = Math.hypot(bk.x - p.x, bk.z - p.z);
      if (d < bestBeggarDist) {
        bestBeggarDist = d;
        bestBeggar = bk;
      }
    }
    if (bestBeggar) {
      const info = DRINK_CATALOG[bestBeggar.orderDrink] ?? DRINK_CATALOG.tea;
      return {
        kind: 'beggar_kid',
        x: bestBeggar.x,
        z: bestBeggar.z,
        beggarKidId: bestBeggar.id,
        prompt: `[E] Help Poor Kid with Free ${info.name} (+Sales & Marketing!)`,
      };
    }

    let bestHungryHelper: HelperKidState | null = null;
    let bestHungryHelperDist = 2.85;
    for (const h of getShiftHelpers(shift)) {
      if (
        h.status !== 'sitting' ||
        h.beggingState !== 'begging_at_stall' ||
        h.beggingDrink !== heldDrink
      ) {
        continue;
      }
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < bestHungryHelperDist) {
        bestHungryHelperDist = d;
        bestHungryHelper = h;
      }
    }
    if (bestHungryHelper) {
      const hId = bestHungryHelper.id ?? 'chotu';
      const cfg = HELPER_NPCS[hId];
      const info =
        DRINK_CATALOG[bestHungryHelper.beggingDrink ?? 'tea'] ?? DRINK_CATALOG.tea;
      return {
        kind: 'beggar_helper',
        helperId: hId,
        x: bestHungryHelper.x,
        z: bestHungryHelper.z,
        prompt: `[E] Feed Hungry ${cfg.name} Free ${info.name} (+10% Sales & Corner Marketing!)`,
      };
    }

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
      const boosted = applySalesBoostCents(info.priceCents, shift);
      return {
        kind: 'customer',
        x: bestCust.x,
        z: bestCust.z,
        customerId: bestCust.id,
        prompt: `[E] Serve ${info.name} (+${formatMoney(boosted)})`,
      };
    }

    const owner = shift.supermarketOwner;
    if (owner.phase === 'ordering_chai' && owner.orderDrink === heldDrink) {
      const dOwn = Math.hypot(owner.x - p.x, owner.z - p.z);
      if (dOwn < 3.1) {
        const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
        const boosted = applySalesBoostCents(info.priceCents, shift);
        return {
          kind: 'owner_customer',
          x: owner.x,
          z: owner.z,
          prompt: `[E] Serve Mart Owner ${info.name} (+${formatMoney(boosted)})`,
        };
      }
    }

    let bestVisitor: ShopVisitorState | null = null;
    let bestVisitorDist = 3.1;
    for (const v of getShiftShopVisitors(shift)) {
      if (v.phase !== 'ordering' || v.orderDrink !== heldDrink) continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < bestVisitorDist) {
        bestVisitorDist = d;
        bestVisitor = v;
      }
    }
    if (bestVisitor) {
      const info = DRINK_CATALOG[bestVisitor.orderDrink] ?? DRINK_CATALOG.tea;
      const boosted = applySalesBoostCents(info.priceCents, shift);
      return {
        kind: 'shop_visitor',
        x: bestVisitor.x,
        z: bestVisitor.z,
        visitorId: bestVisitor.id,
        prompt: `[E] Serve ${bestVisitor.name} (${bestVisitor.roleLabel}) ${info.name} (+${formatMoney(boosted)})`,
      };
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
        const boosted = applySalesBoostCents(info.priceCents, shift);
        return {
          kind: 'car',
          x: shift.carCustomer.x,
          z: shift.carCustomer.z,
          prompt: `[E] Serve Car (${shift.carCustomer.qtyServed + 1}/${shift.carCustomer.qtyTotal} ${info.name} · +${formatMoney(boosted)})`,
        };
      }
    }
  }

  // 3. Chai Readi + 2nd Snacks Readi + 3rd Cold Readi Stations
  const hasDoodhPatti = world.unlockedRecipes.includes('doodh_patti');
  const hasCoffee = world.unlockedRecipes.includes('coffee');
  const hasSnacksRecipe =
    world.unlockedRecipes.includes('samosa') ||
    world.unlockedRecipes.includes('pakora');
  const hasColdRecipe =
    world.unlockedRecipes.includes('cold_drink') ||
    world.unlockedRecipes.includes('ice_cream');

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
      : `${areaName} (Place items for self-serve!)`;
  };

  const trays = shift.trayItems ?? [shift.trayItem ?? null, null, null, null];
  const snackTrays = shift.snackTrayItems ?? [null, null];
  const coldTrays = shift.coldTrayItems ?? [null, null];
  const isPlayerInFrontOfStall = p.z > CYCLE_ANCHOR.z - 0.1;

  type StationCandidate = {
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
      | 'snack_tray'
      | 'soda_crate'
      | 'cone_stack'
      | 'icecream_tub'
      | 'ice_box'
      | 'chiller'
      | 'cold_tray';
    x: number;
    z: number;
    prompt: string;
    priority: number;
    trayIndex?: number;
  };

  const buildChaiKitchenCandidates = (
    layout: {
      kettle: { x: number; z: number };
      milk_crate: { x: number; z: number };
      water_jug: { x: number; z: number };
      sugar_jar: { x: number; z: number };
      coffee_jar: { x: number; z: number };
      tea_tin: { x: number; z: number };
      cups: { x: number; z: number };
      biscuit_box: { x: number; z: number };
      cupcake_box: { x: number; z: number };
      trays: ReadonlyArray<{ x: number; z: number }>;
    },
    areaLabel: string,
    frontCheck: boolean
  ): StationCandidate[] => [
    ...layout.trays.map((spot, idx) => {
      const slotVal = trays[idx] ?? null;
      const canPlaceOrSwap =
        (p.holding === null && slotVal !== null) ||
        (p.holding !== null && isSwappableCounterItem(p.holding));
      const basePriority = canPlaceOrSwap
        ? frontCheck || heldDrink !== null
          ? 0.58
          : 0.34
        : -0.2;
      return {
        kind: 'counter_tray' as const,
        x: spot.x,
        z: spot.z,
        trayIndex: idx,
        prompt: makeTrayPrompt(slotVal, areaLabel),
        priority: basePriority,
      };
    }),
    {
      kind: 'cupcake_box',
      x: layout.cupcake_box.x,
      z: layout.cupcake_box.z,
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
      x: layout.biscuit_box.x,
      z: layout.biscuit_box.z,
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
      x: layout.cups.x,
      z: layout.cups.z,
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
      x: layout.tea_tin.x,
      z: layout.tea_tin.z,
      prompt:
        shift.inventory.teaLeaves > 0
          ? `[E] Add Tea Leaves (${shift.inventory.teaLeaves} left)`
          : 'No Tea Leaves! Buy inside the Supermarket',
      priority: p.holding === 'empty_cup' ? 0.6 : 0,
    },
    {
      kind: 'coffee_jar',
      x: layout.coffee_jar.x,
      z: layout.coffee_jar.z,
      prompt: !hasCoffee
        ? 'Coffee Recipe Locked (Buy inside Supermarket)'
        : shift.inventory.coffeePowder > 0
          ? `[E] Add Coffee Beans (${shift.inventory.coffeePowder} left)`
          : 'No Coffee Beans! Buy inside the Supermarket',
      priority: hasCoffee && p.holding === 'empty_cup' ? 0.55 : -0.1,
    },
    {
      kind: 'sugar_jar',
      x: layout.sugar_jar.x,
      z: layout.sugar_jar.z,
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
      x: layout.water_jug.x,
      z: layout.water_jug.z,
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
      x: layout.milk_crate.x,
      z: layout.milk_crate.z,
      prompt: !hasDoodhPatti
        ? 'Doodh Patti Locked (Buy Recipe inside Supermarket)'
        : shift.inventory.milkPackets > 0
          ? `[E] Add Milk Packet (${shift.inventory.milkPackets} left)`
          : 'No Milk Packets! Buy from Milkman on Bike',
      priority: hasDoodhPatti && p.holding === 'cup_with_tea_sugar' ? 0.7 : -0.1,
    },
    {
      kind: 'kettle',
      x: layout.kettle.x,
      z: layout.kettle.z,
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

  const candidates: StationCandidate[] = [];

  if (world.hasTeaStall !== false) {
    candidates.push(
      ...buildChaiKitchenCandidates(
        { ...STATIONS, trays: TRAY_SPOTS },
        'Readi Space',
        isPlayerInFrontOfStall
      )
    );
  }

  for (const rec of world.rentedShops) {
    if (!hasShopKitchen(world, rec.buildingId)) continue;
    const b = RENTABLE_BUILDINGS.find((cfg) => cfg.id === rec.buildingId);
    if (!b) continue;
    const ks = getShopKitchenStations(b);
    candidates.push(
      ...buildChaiKitchenCandidates(ks, 'Shop Counter', true)
    );
  }

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

  // 3rd Cold Readi Stations (when purchased)
  if (world.hasColdCart) {
    const chillerState = shift.chiller ?? {
      status: 'idle',
      progress: 0,
      chillingItem: null,
    };
    candidates.push(
      ...COLD_TRAY_SPOTS.map((spot, idx) => {
        const slotVal = coldTrays[idx] ?? null;
        const canPlaceOrSwap =
          (p.holding === null && slotVal !== null) ||
          (p.holding !== null && isSwappableCounterItem(p.holding));
        return {
          kind: 'cold_tray' as const,
          x: spot.x,
          z: spot.z,
          trayIndex: idx,
          prompt: makeTrayPrompt(slotVal, 'Chilled Showcase'),
          priority: canPlaceOrSwap ? 0.58 : -0.15,
        };
      }),
      {
        kind: 'soda_crate',
        x: COLD_STATIONS.soda_crate.x,
        z: COLD_STATIONS.soda_crate.z,
        prompt:
          (shift.inventory.coldDrinkBottles ?? 0) <= 0
            ? 'No Cold Drink Bottles! Buy inside Supermarket'
            : p.holding === null
              ? `[E] Take Cold Drink Bottle (${shift.inventory.coldDrinkBottles ?? 0} left)`
              : `Cold Drink Crate (${shift.inventory.coldDrinkBottles ?? 0} left)`,
        priority:
          (shift.inventory.coldDrinkBottles ?? 0) > 0 && p.holding === null
            ? 0.58
            : -0.05,
      },
      {
        kind: 'cone_stack',
        x: COLD_STATIONS.cone_stack.x,
        z: COLD_STATIONS.cone_stack.z,
        prompt:
          (shift.inventory.iceCreamCones ?? 0) <= 0
            ? 'No Waffle Cones! Buy inside Supermarket'
            : p.holding === null
              ? `[E] Take Waffle Cone (${shift.inventory.iceCreamCones ?? 0} left)`
              : `Waffle Cones (${shift.inventory.iceCreamCones ?? 0} left)`,
        priority:
          (shift.inventory.iceCreamCones ?? 0) > 0 && p.holding === null
            ? 0.58
            : -0.05,
      },
      {
        kind: 'icecream_tub',
        x: COLD_STATIONS.icecream_tub.x,
        z: COLD_STATIONS.icecream_tub.z,
        prompt:
          (shift.inventory.iceCreamMix ?? 0) <= 0
            ? 'No Ice Cream Mix! Buy inside Supermarket'
            : p.holding === 'empty_cone'
              ? `[E] Scoop Ice Cream Mix (${shift.inventory.iceCreamMix ?? 0} left)`
              : `Ice Cream Tub (${shift.inventory.iceCreamMix ?? 0} left · Hold Cone first)`,
        priority:
          (shift.inventory.iceCreamMix ?? 0) > 0 && p.holding === 'empty_cone'
            ? 0.65
            : 0,
      },
      {
        kind: 'ice_box',
        x: COLD_STATIONS.ice_box.x,
        z: COLD_STATIONS.ice_box.z,
        prompt:
          (shift.inventory.iceBlocks ?? 0) <= 0
            ? 'No Ice Blocks! Buy Ice Blocks inside Supermarket'
            : p.holding === 'cold_bottle' || p.holding === 'cone_with_mix'
              ? `[E] Pack with Ice Block (${shift.inventory.iceBlocks ?? 0} left)`
              : `Ice Blocks Box (${shift.inventory.iceBlocks ?? 0} left · Hold Bottle or Cone+Mix)`,
        priority:
          (shift.inventory.iceBlocks ?? 0) > 0 &&
          (p.holding === 'cold_bottle' || p.holding === 'cone_with_mix')
            ? 0.68
            : 0,
      },
      {
        kind: 'chiller',
        x: COLD_STATIONS.chiller.x,
        z: COLD_STATIONS.chiller.z,
        prompt:
          chillerState.status === 'ready' && chillerState.chillingItem
            ? p.holding === 'cold_bottle_iced' || p.holding === 'iced_cream_mix'
              ? '[E] Swap & Chill Next Item'
              : `[E] Take Chilled ${(DRINK_CATALOG[chillerState.chillingItem] ?? DRINK_CATALOG.cold_drink).name}`
            : chillerState.status === 'chilling'
              ? `Chilling with Ice... ${Math.round(chillerState.progress * 100)}%`
              : '[E] Chill in Ice Chiller',
        priority:
          (p.holding === null && chillerState.status === 'ready') ||
          (chillerState.status === 'idle' &&
            (p.holding === 'cold_bottle_iced' || p.holding === 'iced_cream_mix'))
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

  // 3b. Reserved 2nd Readi Plot (guide to Wood Master Workshop!)
  if (!world.hasSnacksCart) {
    const dPlot = Math.hypot(
      SNACKS_CART_ANCHOR.x - p.x,
      SNACKS_CART_ANCHOR.z - p.z
    );
    if (dPlot < 2.2) {
      const readySnacks = (world.woodOrders ?? []).find(
        (o) => o.kind === 'snacks_cart' && o.status === 'ready'
      );
      const buildingSnacks = (world.woodOrders ?? []).find(
        (o) => o.kind === 'snacks_cart' && o.status === 'building'
      );
      return {
        kind: 'buy_snacks_cart',
        x: SNACKS_CART_ANCHOR.x,
        z: SNACKS_CART_ANCHOR.z,
        prompt: readySnacks
          ? '2nd Snacks Readi is READY! Visit Wood Master Workshop (Ustad Karim) to receive!'
          : buildingSnacks
            ? `2nd Snacks Readi building at Wood Master (${Math.ceil(buildingSnacks.remainingSec)}s left)`
            : !hasSnacksRecipe
              ? `2nd Readi Spot · First learn Samosa Recipe in Supermarket (${formatMoney(DRINK_CATALOG.samosa.unlockCostCents)}), then order at Wood Master!`
              : `2nd Readi Spot · Order from Ustad Karim at Wood Master Workshop (${formatMoney(SNACKS_CART_PRICE_CENTS)} · 3m)!`,
      };
    }
  }

  // 3c. Reserved 3rd Cold Readi Plot (guide to Wood Master Workshop!)
  if (!world.hasColdCart) {
    const dColdPlot = Math.hypot(
      COLD_CART_ANCHOR.x - p.x,
      COLD_CART_ANCHOR.z - p.z
    );
    if (dColdPlot < 2.2) {
      const readyCold = (world.woodOrders ?? []).find(
        (o) => o.kind === 'cold_cart' && o.status === 'ready'
      );
      const buildingCold = (world.woodOrders ?? []).find(
        (o) => o.kind === 'cold_cart' && o.status === 'building'
      );
      return {
        kind: 'buy_cold_cart',
        x: COLD_CART_ANCHOR.x,
        z: COLD_CART_ANCHOR.z,
        prompt: readyCold
          ? '3rd Cold Readi is READY! Visit Wood Master Workshop (Ustad Karim) to receive!'
          : buildingCold
            ? `3rd Cold Readi building at Wood Master (${Math.ceil(buildingCold.remainingSec)}s left)`
            : !hasColdRecipe
              ? `3rd Readi Spot · First buy Cold Drinks & Ice Cream License inside Supermarket ($4.00), then order at Wood Master!`
              : `3rd Readi Spot · Order from Ustad Karim at Wood Master Workshop (${formatMoney(COLD_CART_PRICE_CENTS)} · 2.5m)!`,
      };
    }
  }

  // 4. Poor Kids Sitting Around the Street (Charity or 1-Day Job — available while at mat or marketing!)
  {
    let bestHelper: HelperKidState | null = null;
    let bestHelperDist = 1.95;
    const heldDrinkForHelperTalk = heldHotDrinkType(p.holding);
    for (const h of getShiftHelpers(shift)) {
      if (h.status !== 'sitting') continue;
      if (
        h.beggingState &&
        h.beggingState !== 'at_mat' &&
        h.beggingState !== 'marketing' &&
        h.beggingState !== 'begging_at_stall'
      ) {
        continue;
      }
      if (
        h.beggingState === 'begging_at_stall' &&
        heldDrinkForHelperTalk !== null &&
        heldDrinkForHelperTalk === (h.beggingDrink ?? 'tea')
      ) {
        continue;
      }
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < bestHelperDist) {
        bestHelperDist = d;
        bestHelper = h;
      }
    }
    if (bestHelper) {
      const hId: HelperNpcId = bestHelper.id ?? 'chotu';
      const cfg = HELPER_NPCS[hId];
      const hireLabel =
        cfg.requiresSnacksCart && !world.hasSnacksCart
          ? 'Charity Only (Unlock Samosa Cart to Hire)'
          : '$0.25 Help or Hire Helper';
      return {
        kind: 'helper_kid',
        helperId: hId,
        x: bestHelper.x,
        z: bestHelper.z,
        prompt: `[E] Talk to ${cfg.name} · ${cfg.locationLabel} (${hireLabel})`,
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
    const rec = world.rentedShops.find((r) => r.buildingId === b.id);
    const isDue = !!rec && world.day >= rec.nextRentDueDay;
    const isGrace = !!rec && world.day > rec.nextRentDueDay;
    // Owner leaves the shop while rented and rent is not due; returns on due day.
    if (rec && !isDue) continue;

    const dOwner = Math.hypot(
      b.counterPos.x - p.x,
      b.counterPos.z + 0.7 - p.z
    );
    if (dOwner < 2.2) {
      return {
        kind: 'building_owner',
        x: b.ownerPos.x,
        z: b.ownerPos.z,
        buildingId: b.id,
        prompt: !rec
          ? `[E] Meet ${b.ownerName} ? Rent ${b.shopName} (${formatMoney(b.weeklyRentCents)}/wk)`
          : isGrace
            ? `[E] ${b.ownerName} is waiting! Pay ${formatMoney(b.weeklyRentCents)} or vacate today`
            : `[E] Pay ${b.ownerName} Weekly Rent (${formatMoney(b.weeklyRentCents)})`,
      };
    }
  }

  // 7b. Second-Hand Buyer Shop -> Meet Raza Bhai Inside!
  const dBuyer = Math.hypot(
    BUYER_SHOP.counterPos.x - p.x,
    BUYER_SHOP.counterPos.z + 0.7 - p.z
  );
  if (dBuyer < 2.25) {
    return {
      kind: 'gear_buyer',
      x: BUYER_SHOP.buyerPos.x,
      z: BUYER_SHOP.buyerPos.z,
      prompt: `[E] Meet ${BUYER_SHOP.buyerName} · Sell Stalls, Chairs & Tables (-50%)`,
    };
  }

  // 7c. Wood Master Workshop (Ustad Karim - Custom Furniture, Kitchens & Readi Carts)
  {
    const orders = world.woodOrders ?? [];
    const readyCount = orders.filter((o) => o.status === 'ready').length;
    const buildingCount = orders.filter((o) => o.status === 'building').length;
    const dWoodCounter = Math.hypot(
      WOOD_MASTER_SHOP.counterPos.x - p.x,
      WOOD_MASTER_SHOP.counterPos.z + 0.7 - p.z
    );
    const dWoodPickup = Math.hypot(
      WOOD_MASTER_SHOP.pickupPos.x - p.x,
      WOOD_MASTER_SHOP.pickupPos.z - p.z
    );
    if (dWoodCounter < 2.25 || (orders.length > 0 && dWoodPickup < 1.9)) {
      return {
        kind: 'wood_master',
        x:
          orders.length > 0 && dWoodPickup < dWoodCounter
            ? WOOD_MASTER_SHOP.pickupPos.x
            : WOOD_MASTER_SHOP.masterPos.x,
        z:
          orders.length > 0 && dWoodPickup < dWoodCounter
            ? WOOD_MASTER_SHOP.pickupPos.z
            : WOOD_MASTER_SHOP.masterPos.z,
        prompt:
          readyCount > 0
            ? `[E] Receive Ready Order (${readyCount} completed) at Wood Master!`
            : buildingCount > 0
              ? `[E] Wood Master Workshop (${buildingCount} crafting...)`
              : `[E] Meet ${WOOD_MASTER_SHOP.masterName} · Order Chairs, Tables, Shop Kitchen & Readi`,
      };
    }
  }

  // 7d. City Micro Bank (Loan / Repay / Collateral)
  {
    const dBank = Math.hypot(
      BANK_SHOP.counterPos.x - p.x,
      BANK_SHOP.counterPos.z + 0.7 - p.z
    );
    if (dBank < 2.25) {
      const loan = world.activeLoan;
      const prompt =
        loan && loan.status === 'active'
          ? `[E] ${BANK_SHOP.shopName} · Repay Loan (${formatMoney(loan.remainingDueCents)} left)`
          : `[E] ${BANK_SHOP.shopName} · Talk to ${BANK_SHOP.bankerName} for Loan`;
      return {
        kind: 'bank',
        x: BANK_SHOP.bankerPos.x,
        z: BANK_SHOP.bankerPos.z,
        prompt,
      };
    }
  }

  // 8. Furniture Pickup Pad (when multiple furniture pieces wait)
  if (world.pendingFurniture.length > 0) {
    const dPickup = Math.hypot(
      SUPERMARKET_PICKUP_POS.x - p.x,
      SUPERMARKET_PICKUP_POS.z - p.z
    );
    const dWoodPickup = Math.hypot(
      WOOD_MASTER_SHOP.pickupPos.x - p.x,
      WOOD_MASTER_SHOP.pickupPos.z - p.z
    );
    if (dPickup < 1.75 || dWoodPickup < 1.75) {
      const nextKind = world.pendingFurniture[0];
      const nextLabel = nextKind === 'chair' ? 'Chair' : 'Table';
      const padPos =
        dWoodPickup < dPickup
          ? WOOD_MASTER_SHOP.pickupPos
          : SUPERMARKET_PICKUP_POS;
      return {
        kind: 'supermarket_pickup',
        x: padPos.x,
        z: padPos.z,
        prompt:
          p.holding === null
            ? `[E] Pick Up Built ${nextLabel} (${world.pendingFurniture.length} waiting)`
            : `Empty hands to pick up ${nextLabel} (${world.pendingFurniture.length} waiting)`,
      };
    }
  }

  // 9. Walk-In Supermarket Interactive Zones (Supplies, Biscuits/Cakes & Recipes — NO chairs/tables)
  const smSpots = [
    {
      x: SUPERMARKET_COUNTER_POS.x,
      z: SUPERMARKET_COUNTER_POS.z + 0.55,
      prompt: '[E] Supermarket Counter (Supplies, Snacks & Recipes)',
    },
  {
    x: SUPERMARKET_AISLE_POS.x,
    z: SUPERMARKET_AISLE_POS.z,
    prompt: '[E] Supermarket Shelves (Tea, Coffee, Snacks & Cold Stock)',
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
  const nearFurn = findNearestUnoccupiedFurniture(p, shift, world);
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

  // 11. Waiting Customer, Beggar Kid, Hungry Corner Beggar, Mart Owner, Shop Visitor, or Car for [E]/[F] Offer/Reject
  {
    let bestAny: {
      kind:
        | 'customer'
        | 'beggar_kid'
        | 'beggar_helper'
        | 'owner_customer'
        | 'shop_visitor'
        | 'car';
      x: number;
      z: number;
      dist: number;
      drink: DrinkType;
      label: string;
      customerId?: string;
      beggarKidId?: string;
      helperId?: HelperNpcId;
      visitorId?: ShopVisitorId;
    } | null = null;

    for (const bk of getShiftBeggarKids(shift)) {
      if (bk.status !== 'waiting') continue;
      const d = Math.hypot(bk.x - p.x, bk.z - p.z);
      if (d < 2.85 && (!bestAny || d < bestAny.dist)) {
        bestAny = {
          kind: 'beggar_kid',
          x: bk.x,
          z: bk.z,
          dist: d,
          drink: bk.orderDrink,
          label: 'Poor Kid (Free)',
          beggarKidId: bk.id,
        };
      }
    }

    for (const h of getShiftHelpers(shift)) {
      if (h.status !== 'sitting' || h.beggingState !== 'begging_at_stall') continue;
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < 2.85 && (!bestAny || d < bestAny.dist)) {
        const hId = h.id ?? 'chotu';
        bestAny = {
          kind: 'beggar_helper',
          x: h.x,
          z: h.z,
          dist: d,
          drink: h.beggingDrink ?? 'tea',
          label: `${HELPER_NPCS[hId].name} (Free)`,
          helperId: hId,
        };
      }
    }

    for (const c of shift.customers) {
      if (c.status !== 'waiting') continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      const maxActionDist = c.seatedChairId ? 2.25 : 3.25;
      if (d < maxActionDist && (!bestAny || d < bestAny.dist)) {
        bestAny = {
          kind: 'customer',
          x: c.x,
          z: c.z,
          dist: d,
          drink: c.orderDrink,
          label: 'Customer',
          customerId: c.id,
        };
      }
    }

    const owner = shift.supermarketOwner;
    if (owner.phase === 'ordering_chai') {
      const dOwn = Math.hypot(owner.x - p.x, owner.z - p.z);
      if (dOwn < 3.1 && (!bestAny || dOwn < bestAny.dist)) {
        bestAny = {
          kind: 'owner_customer',
          x: owner.x,
          z: owner.z,
          dist: dOwn,
          drink: owner.orderDrink,
          label: 'Mart Owner',
        };
      }
    }

    for (const v of getShiftShopVisitors(shift)) {
      if (v.phase !== 'ordering') continue;
      const dVis = Math.hypot(v.x - p.x, v.z - p.z);
      if (dVis < 3.1 && (!bestAny || dVis < bestAny.dist)) {
        bestAny = {
          kind: 'shop_visitor',
          x: v.x,
          z: v.z,
          dist: dVis,
          drink: v.orderDrink,
          label: v.name,
          visitorId: v.id,
        };
      }
    }

    if (shift.carCustomer.phase === 'waiting') {
      const dCar = Math.hypot(
        shift.carCustomer.x - p.x,
        shift.carCustomer.z - p.z
      );
      if (dCar < 3.1 && (!bestAny || dCar < bestAny.dist)) {
        bestAny = {
          kind: 'car',
          x: shift.carCustomer.x,
          z: shift.carCustomer.z,
          dist: dCar,
          drink: shift.carCustomer.orderDrink,
          label: `Car (${shift.carCustomer.qtyTotal}x)`,
        };
      }
    }

    if (bestAny) {
      const info = DRINK_CATALOG[bestAny.drink] ?? DRINK_CATALOG.tea;
      return {
        kind: bestAny.kind,
        x: bestAny.x,
        z: bestAny.z,
        customerId: bestAny.customerId,
        beggarKidId: bestAny.beggarKidId,
        helperId: bestAny.helperId,
        visitorId: bestAny.visitorId,
        prompt: heldDrink
          ? `${bestAny.label} wants ${info.name} · [E]/[F] Offer ${(DRINK_CATALOG[heldDrink] ?? DRINK_CATALOG.tea).name} / Reject`
          : `${bestAny.label} wants ${info.name} · [E]/[F] Offer Another / Reject`,
      };
    }
  }

  return null;
}

export function findNearestCustomerForAction(
  shift: ShiftSnapshot,
  actor?: Player3DState
): {
  kind:
    | 'customer'
    | 'car'
    | 'owner_customer'
    | 'shop_visitor'
    | 'beggar_kid'
    | 'beggar_helper';
  id: string;
  requestedDrink: DrinkType;
  npcLabel?: string;
  isFreeHelp?: boolean;
} | null {
  const p = actor ?? shift.player;
  let best: {
    kind:
      | 'customer'
      | 'car'
      | 'owner_customer'
      | 'shop_visitor'
      | 'beggar_kid'
      | 'beggar_helper';
    id: string;
    requestedDrink: DrinkType;
    dist: number;
    npcLabel?: string;
    isFreeHelp?: boolean;
  } | null = null;

  for (const bk of getShiftBeggarKids(shift)) {
    if (bk.status !== 'waiting') continue;
    const d = Math.hypot(bk.x - p.x, bk.z - p.z);
    if (d < 3.0 && (!best || d < best.dist)) {
      best = {
        kind: 'beggar_kid',
        id: bk.id,
        requestedDrink: bk.orderDrink,
        dist: d,
        npcLabel: 'Poor Kid (Free Meal)',
        isFreeHelp: true,
      };
    }
  }

  for (const h of getShiftHelpers(shift)) {
    if (h.status !== 'sitting' || h.beggingState !== 'begging_at_stall') continue;
    const d = Math.hypot(h.x - p.x, h.z - p.z);
    if (d < 3.0 && (!best || d < best.dist)) {
      const hId = h.id ?? 'chotu';
      best = {
        kind: 'beggar_helper',
        id: hId,
        requestedDrink: h.beggingDrink ?? 'tea',
        dist: d,
        npcLabel: `${HELPER_NPCS[hId].name} (Hungry Beggar · Free Meal)`,
        isFreeHelp: true,
      };
    }
  }

  for (const c of shift.customers) {
    if (c.status !== 'waiting') continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    const maxDist = c.seatedChairId ? 2.45 : 3.35;
    if (d < maxDist && (!best || d < best.dist)) {
      best = {
        kind: 'customer',
        id: c.id,
        requestedDrink: c.orderDrink,
        dist: d,
      };
    }
  }

  const owner = shift.supermarketOwner;
  if (owner.phase === 'ordering_chai') {
    const dOwn = Math.hypot(owner.x - p.x, owner.z - p.z);
    if (dOwn < 3.35 && (!best || dOwn < best.dist)) {
      best = {
        kind: 'owner_customer',
        id: 'owner_customer',
        requestedDrink: owner.orderDrink,
        dist: dOwn,
        npcLabel: 'Mart Owner',
      };
    }
  }

  for (const v of getShiftShopVisitors(shift)) {
    if (v.phase !== 'ordering') continue;
    const dVis = Math.hypot(v.x - p.x, v.z - p.z);
    if (dVis < 3.35 && (!best || dVis < best.dist)) {
      best = {
        kind: 'shop_visitor',
        id: v.id,
        requestedDrink: v.orderDrink,
        dist: dVis,
        npcLabel: `${v.name} (${v.roleLabel})`,
      };
    }
  }

  if (shift.carCustomer.phase === 'waiting') {
    const dCar = Math.hypot(
      shift.carCustomer.x - p.x,
      shift.carCustomer.z - p.z
    );
    if (dCar < 3.4 && (!best || dCar < best.dist)) {
      best = {
        kind: 'car',
        id: 'car_customer',
        requestedDrink: shift.carCustomer.orderDrink,
        dist: dCar,
      };
    }
  }

  if (!best) return null;
  return {
    kind: best.kind,
    id: best.id,
    requestedDrink: best.requestedDrink,
    npcLabel: best.npcLabel,
    isFreeHelp: best.isFreeHelp,
  };
}

export function getGuidedHint(shift: ShiftSnapshot, world: WorldSave): string {
  const readyWoodOrder = (world.woodOrders ?? []).find(
    (o) => o.status === 'ready'
  );
  if (readyWoodOrder) {
    return `Wood Master Order READY: "${readyWoodOrder.label}"! Walk to Wood Master Workshop (E) on the right side of the street to receive it!`;
  }

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
    shift.player.holding === 'hot_pakora' ||
    shift.player.holding === 'chilled_cold_drink' ||
    shift.player.holding === 'ready_ice_cream'
  ) {
    return `Serve ${HELD_ITEM_LABELS[shift.player.holding]} to customer (E) or place on Readi Showcase for auto-pickup!`;
  }

  const hungryHelper = getShiftHelpers(shift).find(
    (h) => h.status === 'sitting' && h.beggingState === 'begging_at_stall'
  );
  if (hungryHelper) {
    const cfg = HELPER_NPCS[hungryHelper.id ?? 'chotu'];
    const hInfo = DRINK_CATALOG[hungryHelper.beggingDrink ?? 'tea'] ?? DRINK_CATALOG.tea;
    return `${cfg.name} is hungry at the Readi (${Math.ceil(hungryHelper.patience ?? 60)}s) asking for free ${hInfo.name}! Feed them (E) so they market your stall!`;
  }

  const waitingBeggar = getShiftBeggarKids(shift).find(
    (b) => b.status === 'waiting'
  );
  if (waitingBeggar) {
    const bInfo = DRINK_CATALOG[waitingBeggar.orderDrink] ?? DRINK_CATALOG.tea;
    return `Poor Kid is waiting (${Math.ceil(waitingBeggar.patience)}s) for free ${bInfo.name}! Help them (E) for +10% Sales & Marketing!`;
  }

  if (shift.supermarketOwner.phase === 'ordering_chai') {
    const oInfo = DRINK_CATALOG[shift.supermarketOwner.orderDrink] ?? DRINK_CATALOG.tea;
    return `Supermarket Owner is waiting at your Readi for ${oInfo.name} ([E] Serve · [F] Offer/Reject)!`;
  }

  const waitingVisitor = getShiftShopVisitors(shift).find(
    (v) => v.phase === 'ordering'
  );
  if (waitingVisitor) {
    const vInfo = DRINK_CATALOG[waitingVisitor.orderDrink] ?? DRINK_CATALOG.tea;
    return `${waitingVisitor.name} (${waitingVisitor.roleLabel}) is waiting for ${vInfo.name} ([E] Serve · [F] Offer/Reject)!`;
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
  if (shift.chiller?.status === 'ready' && shift.player.holding === null) {
    return 'Ice-Cold Treat is chilled! Press E at the 3rd Cold Readi Ice Chiller to grab it.';
  }

  switch (shift.player.holding) {
    case null:
      if (shift.inventory.cups <= 0) {
        return 'Out of Cups! Walk inside the Open Supermarket on the right and press E.';
      }
      return 'Take a Cup (E), talk to Corner Kids (E), or walk inside ANY open shop building to rent!';
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
    case 'cold_bottle':
      return 'Pack the Cold Drink Bottle with an Ice Block at the 3rd Readi Ice Box (E)!';
    case 'empty_cone':
      return 'Scoop Ice Cream Mix into the Waffle Cone at the Ice Cream Tub (E)!';
    case 'cone_with_mix':
      return 'Pack the Cone with an Ice Block at the 3rd Readi Ice Box (E)!';
    case 'cold_bottle_iced':
    case 'iced_cream_mix':
      return 'Chill in the Ice Chiller Drum on the 3rd Cold Readi (E)!';
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
  radius: number,
  world?: WorldSave
): void {
  // Side alleys & backsides behind buildings are COMPLETELY OPEN — player & partners can roam freely around sides, backsides, and the road!

  // All 3 Spacious Open Walk-In Rentable Buildings (walls + front pillars + owner counter + indoor kitchen ONLY when built at Wood Master)
  for (const b of RENTABLE_BUILDINGS) {
    const { minX, maxX, minZ, maxZ } = b.bounds;
    // Back wall
    resolveCollisionBox(p, minX, maxX, minZ - 0.16, minZ + 0.16, radius);
    // Left wall
    resolveCollisionBox(p, minX - 0.16, minX + 0.16, minZ, maxZ, radius);
    // Right wall
    resolveCollisionBox(p, maxX - 0.16, maxX + 0.16, minZ, maxZ, radius);
    // Front wall left & right of open doorway
    resolveCollisionBox(p, minX, b.doorMinX, maxZ - 0.16, maxZ + 0.14, radius);
    resolveCollisionBox(p, b.doorMaxX, maxX, maxZ - 0.16, maxZ + 0.14, radius);
    // Interior owner desk/counter
    resolveCollisionBox(
      p,
      b.counterPos.x - 1.05,
      b.counterPos.x + 1.05,
      b.counterPos.z - 0.34,
      b.counterPos.z + 0.34,
      radius
    );
    // Interior Shop Kitchen Counter (only exists after ordered & received from Wood Master!)
    if (world && hasShopKitchen(world, b.id)) {
      const kb = getShopKitchenBounds(b);
      resolveCollisionBox(p, kb.minX, kb.maxX, kb.minZ, kb.maxZ, radius);
    }
  }

  // Second-Hand Buyer Shop (walls + doorway + buyer counter)
  {
    const { minX, maxX, minZ, maxZ } = BUYER_SHOP.bounds;
    resolveCollisionBox(p, minX, maxX, minZ - 0.16, minZ + 0.16, radius);
    resolveCollisionBox(p, minX - 0.16, minX + 0.16, minZ, maxZ, radius);
    resolveCollisionBox(p, maxX - 0.16, maxX + 0.16, minZ, maxZ, radius);
    resolveCollisionBox(
      p,
      minX,
      BUYER_SHOP.doorMinX,
      maxZ - 0.16,
      maxZ + 0.14,
      radius
    );
    resolveCollisionBox(
      p,
      BUYER_SHOP.doorMaxX,
      maxX,
      maxZ - 0.16,
      maxZ + 0.14,
      radius
    );
    resolveCollisionBox(
      p,
      BUYER_SHOP.counterPos.x - 1.15,
      BUYER_SHOP.counterPos.x + 1.15,
      BUYER_SHOP.counterPos.z - 0.34,
      BUYER_SHOP.counterPos.z + 0.34,
      radius
    );
  }

  // Wood Master Carpentry Workshop (walls + wide doorway + Ustad Karim workbench counter)
  {
    const { minX, maxX, minZ, maxZ } = WOOD_MASTER_SHOP.bounds;
    resolveCollisionBox(p, minX, maxX, minZ - 0.16, minZ + 0.16, radius);
    resolveCollisionBox(p, minX - 0.16, minX + 0.16, minZ, maxZ, radius);
    resolveCollisionBox(p, maxX - 0.16, maxX + 0.16, minZ, maxZ, radius);
    resolveCollisionBox(
      p,
      minX,
      WOOD_MASTER_SHOP.doorMinX,
      maxZ - 0.16,
      maxZ + 0.14,
      radius
    );
    resolveCollisionBox(
      p,
      WOOD_MASTER_SHOP.doorMaxX,
      maxX,
      maxZ - 0.16,
      maxZ + 0.14,
      radius
    );
    resolveCollisionBox(
      p,
      WOOD_MASTER_SHOP.counterPos.x - 1.45,
      WOOD_MASTER_SHOP.counterPos.x + 1.45,
      WOOD_MASTER_SHOP.counterPos.z - 0.38,
      WOOD_MASTER_SHOP.counterPos.z + 0.38,
      radius
    );
  }

  // City Micro Bank (walls + doorway + banker counter)
  {
    const { minX, maxX, minZ, maxZ } = BANK_SHOP.bounds;
    resolveCollisionBox(p, minX, maxX, minZ - 0.16, minZ + 0.16, radius);
    resolveCollisionBox(p, minX - 0.16, minX + 0.16, minZ, maxZ, radius);
    resolveCollisionBox(p, maxX - 0.16, maxX + 0.16, minZ, maxZ, radius);
    resolveCollisionBox(
      p,
      minX,
      BANK_SHOP.doorMinX,
      maxZ - 0.16,
      maxZ + 0.14,
      radius
    );
    resolveCollisionBox(
      p,
      BANK_SHOP.doorMaxX,
      maxX,
      maxZ - 0.16,
      maxZ + 0.14,
      radius
    );
    resolveCollisionBox(
      p,
      BANK_SHOP.counterPos.x - 0.95,
      BANK_SHOP.counterPos.x + 0.95,
      BANK_SHOP.counterPos.z - 0.3,
      BANK_SHOP.counterPos.z + 0.3,
      radius
    );
  }

  // Open Walk-In Supermarket walls & counters (cleanly walkable around outer sides & backside!)
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
    SUPERMARKET_BOUNDS.minZ - 0.16,
    SUPERMARKET_BOUNDS.minZ + 0.14,
    radius
  );
  resolveCollisionBox(
    p,
    SUPERMARKET_BOUNDS.maxX - 0.14,
    SUPERMARKET_BOUNDS.maxX + 0.16,
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
  if (!opts.stayOnSidewalk && (z < -14.4 || z > maxAllowedZ)) {
    return true;
  }

  // Building walls & interior counters when NPCs can enter buildings
  if (z < -5.1) {
    // Rentable buildings: walls + owner counter + installed kitchen counter
    for (const b of RENTABLE_BUILDINGS) {
      const { minX, maxX, minZ, maxZ } = b.bounds;
      if (x >= minX - 0.2 && x <= maxX + 0.2) {
        if (z < minZ + 0.35 && z > minZ - 0.35) return true;
        if (x < minX + 0.35 || x > maxX - 0.35) {
          if (z >= minZ - 0.2 && z <= maxZ + 0.2) return true;
        }
        if (
          z > maxZ - 0.35 &&
          z < maxZ + 0.3 &&
          (x < b.doorMinX + 0.2 || x > b.doorMaxX - 0.2)
        ) {
          return true;
        }
        if (
          x > b.counterPos.x - 1.3 &&
          x < b.counterPos.x + 1.3 &&
          z > b.counterPos.z - 0.6 &&
          z < b.counterPos.z + 0.6
        ) {
          return true;
        }
        if (hasShopKitchen(world, b.id)) {
          const kb = getShopKitchenBounds(b);
          if (
            x > kb.minX - 0.28 &&
            x < kb.maxX + 0.28 &&
            z > kb.minZ - 0.28 &&
            z < kb.maxZ + 0.28
          ) {
            return true;
          }
        }
      }
    }

    // Buyer shop walls
    if (x >= BUYER_SHOP.bounds.minX - 0.2 && x <= BUYER_SHOP.bounds.maxX + 0.2) {
      if (z < BUYER_SHOP.bounds.minZ + 0.35 && z > BUYER_SHOP.bounds.minZ - 0.35) return true;
      if (x < BUYER_SHOP.bounds.minX + 0.35 || x > BUYER_SHOP.bounds.maxX - 0.35) {
        if (z >= BUYER_SHOP.bounds.minZ - 0.2 && z <= BUYER_SHOP.bounds.maxZ + 0.2) return true;
      }
      if (
        z > BUYER_SHOP.bounds.maxZ - 0.35 &&
        z < BUYER_SHOP.bounds.maxZ + 0.3 &&
        (x < BUYER_SHOP.doorMinX + 0.2 || x > BUYER_SHOP.doorMaxX - 0.2)
      ) {
        return true;
      }
      if (
        x > BUYER_SHOP.counterPos.x - 1.35 &&
        x < BUYER_SHOP.counterPos.x + 1.35 &&
        z > BUYER_SHOP.counterPos.z - 0.55 &&
        z < BUYER_SHOP.counterPos.z + 0.55
      ) {
        return true;
      }
    }

    // Wood Master Shop walls
    if (
      x >= WOOD_MASTER_SHOP.bounds.minX - 0.2 &&
      x <= WOOD_MASTER_SHOP.bounds.maxX + 0.2 &&
      z >= WOOD_MASTER_SHOP.bounds.minZ - 0.2 &&
      z <= WOOD_MASTER_SHOP.bounds.maxZ + 0.2
    ) {
      if (z < WOOD_MASTER_SHOP.bounds.minZ + 0.35) return true;
      if (
        x < WOOD_MASTER_SHOP.bounds.minX + 0.35 ||
        x > WOOD_MASTER_SHOP.bounds.maxX - 0.35
      ) {
        return true;
      }
      if (
        z > WOOD_MASTER_SHOP.bounds.maxZ - 0.35 &&
        (x < WOOD_MASTER_SHOP.doorMinX + 0.2 ||
          x > WOOD_MASTER_SHOP.doorMaxX - 0.2)
      ) {
        return true;
      }
      if (
        x > WOOD_MASTER_SHOP.counterPos.x - 1.55 &&
        x < WOOD_MASTER_SHOP.counterPos.x + 1.55 &&
        z > WOOD_MASTER_SHOP.counterPos.z - 0.55 &&
        z < WOOD_MASTER_SHOP.counterPos.z + 0.55
      ) {
        return true;
      }
    }
  }

  // Bank walls
  if (
    x >= BANK_SHOP.bounds.minX - 0.2 &&
    x <= BANK_SHOP.bounds.maxX + 0.2 &&
    z >= BANK_SHOP.bounds.minZ - 0.2 &&
    z <= BANK_SHOP.bounds.maxZ + 0.2
  ) {
    if (z < BANK_SHOP.bounds.minZ + 0.35) return true;
    if (
      x < BANK_SHOP.bounds.minX + 0.35 ||
      x > BANK_SHOP.bounds.maxX - 0.35
    ) {
      return true;
    }
    if (
      z > BANK_SHOP.bounds.maxZ - 0.35 &&
      (x < BANK_SHOP.doorMinX + 0.2 || x > BANK_SHOP.doorMaxX - 0.2)
    ) {
      return true;
    }
    if (
      x > BANK_SHOP.counterPos.x - 1.05 &&
      x < BANK_SHOP.counterPos.x + 1.05 &&
      z > BANK_SHOP.counterPos.z - 0.45 &&
      z < BANK_SHOP.counterPos.z + 0.45
    ) {
      return true;
    }
  }

  // Open Supermarket walls/counters
  if (
    z < -3.6 &&
    z > SUPERMARKET_BOUNDS.minZ - 0.3 &&
    x > SUPERMARKET_BOUNDS.maxX - 0.35 &&
    x < SUPERMARKET_BOUNDS.maxX + 0.35
  ) {
    return true;
  }
  if (x > 4.05 && x < 4.78 && z < -6.2 && z > SUPERMARKET_BOUNDS.minZ - 0.3) {
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

  // 4-Wheel Chai Readi (only when owned)
  if (
    world.hasTeaStall !== false &&
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

  // 3rd Cold Readi (4.8m x 1.64m)
  if (
    world.hasColdCart &&
    x > COLD_CART_ANCHOR.x - 2.75 &&
    x < COLD_CART_ANCHOR.x + 2.75 &&
    z > COLD_CART_ANCHOR.z - 1.15 &&
    z < COLD_CART_ANCHOR.z + 1.15
  ) {
    return true;
  }

  // Water Tap, Trash Bin & Sitting Helper Kid Mats (only while anchored at mat or marketing!)
  if (Math.hypot(x - WATER_TAP_POS.x, z - WATER_TAP_POS.z) < 0.72) return true;
  if (Math.hypot(x - TRASH_BIN_POS.x, z - TRASH_BIN_POS.z) < 0.52) return true;
  for (const h of getShiftHelpers(shift)) {
    const atCornerMat =
      h.status === 'sitting' &&
      (!h.beggingState || h.beggingState === 'at_mat' || h.beggingState === 'marketing');
    if (atCornerMat && Math.hypot(x - h.x, z - h.z) < 0.65) {
      return true;
    }
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

  const insideShop = isInsideAnyRentedShop(chair.x, chair.z, world);
  let bestSpot = { x: chair.x, z: chair.z + 0.72 };
  let bestScore = -Infinity;

  for (const off of offsets) {
    const sx = chair.x + off.dx;
    const sz = chair.z + off.dz;
    if (
      isStaticBlockedForNpc(sx, sz, world, shift, {
        ignoreChairId: chair.id,
        stayOnSidewalk: !insideShop,
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
  if (shift.player2?.active && !shift.player2.sittingChairId) {
    if (Math.hypot(x - shift.player2.x, z - shift.player2.z) < minClear) {
      return true;
    }
  }
  for (const other of shift.customers) {
    if (other.id === opts.selfId || other.seatedChairId) continue;
    if (
      other.status === 'walking_out' &&
      (other.x < WORLD_BOUNDS.minX + 1.5 || other.x > WORLD_BOUNDS.maxX - 1.5)
    ) {
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
  for (const v of getShiftShopVisitors(shift)) {
    if (v.id === opts.selfId || (v.phase === 'at_shop' && v.z <= -5.5)) continue;
    if (Math.hypot(x - v.x, z - v.z) < minClear) {
      return true;
    }
  }
  for (const bk of getShiftBeggarKids(shift)) {
    if (bk.id === opts.selfId) continue;
    if (Math.hypot(x - bk.x, z - bk.z) < minClear) {
      return true;
    }
  }
  for (const h of getShiftHelpers(shift)) {
    const hSelfId = `helper_${h.id ?? 'chotu'}`;
    const isMovingOrBegging =
      h.status === 'hired' ||
      (h.status === 'sitting' &&
        (h.beggingState === 'walking_to_stall' ||
          h.beggingState === 'begging_at_stall' ||
          h.beggingState === 'eating_free' ||
          h.beggingState === 'returning_marketing'));
    if (opts.selfId !== hSelfId && isMovingOrBegging) {
      if (Math.hypot(x - h.x, z - h.z) < minClear) {
        return true;
      }
    }
  }
  for (const ped of shift.pedestrians) {
    if (
      ped.id === opts.selfId ||
      ped.x < WORLD_BOUNDS.minX + 1.5 ||
      ped.x > WORLD_BOUNDS.maxX - 1.5
    ) {
      continue;
    }
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
    pos.z = clamp(pos.z, -14.2, maxZ);
  }

  if (!opts.stayOnSidewalk) {
    resolveAllBuildingCollisions(pos, 0.3, world);
  } else {
    resolveCollisionBox(
      pos,
      WORLD_BOUNDS.minX + 1.8,
      WORLD_BOUNDS.maxX - 1.8,
      -16.5,
      -5.25,
      0.34
    );
  }

  // 4-Wheel Chai Readi (only when owned)
  if (world.hasTeaStall !== false) {
    resolveCollisionBox(
      pos,
      CYCLE_ANCHOR.x - 3.7,
      CYCLE_ANCHOR.x + 3.7,
      CYCLE_ANCHOR.z - 0.82,
      CYCLE_ANCHOR.z + 0.82,
      0.36
    );
  }

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

  // 3rd Cold Readi
  if (world.hasColdCart) {
    resolveCollisionBox(
      pos,
      COLD_CART_ANCHOR.x - 2.4,
      COLD_CART_ANCHOR.x + 2.4,
      COLD_CART_ANCHOR.z - 0.82,
      COLD_CART_ANCHOR.z + 0.82,
      0.36
    );
  }

  // Water Tap, Trash Bin & Sitting Kid Mats
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
  for (const h of getShiftHelpers(shift)) {
    const hSelfId = `helper_${h.id ?? 'chotu'}`;
    const atCornerMat =
      h.status === 'sitting' &&
      (!h.beggingState || h.beggingState === 'at_mat' || h.beggingState === 'marketing');
    if (atCornerMat && opts.selfId !== hSelfId) {
      resolveCollisionCircle(pos, h.x, h.z, 0.56);
    }
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

  // Personal space separation with Player, Partner & other people
  if (!shift.player.sittingChairId) {
    resolveCollisionCircle(pos, shift.player.x, shift.player.z, 0.7);
  }
  if (shift.player2?.active && !shift.player2.sittingChairId) {
    resolveCollisionCircle(pos, shift.player2.x, shift.player2.z, 0.7);
  }
  for (const other of shift.customers) {
    if (other.id === opts.selfId || other.seatedChairId) continue;
    if (
      other.status === 'walking_out' &&
      (other.x < WORLD_BOUNDS.minX + 1.5 || other.x > WORLD_BOUNDS.maxX - 1.5)
    ) {
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
  for (const v of getShiftShopVisitors(shift)) {
    if (v.id === opts.selfId || (v.phase === 'at_shop' && v.z <= -5.5)) continue;
    resolveCollisionCircle(pos, v.x, v.z, 0.72);
  }
  for (const bk of getShiftBeggarKids(shift)) {
    if (bk.id === opts.selfId) continue;
    resolveCollisionCircle(pos, bk.x, bk.z, 0.68);
  }
  for (const h of getShiftHelpers(shift)) {
    const hSelfId = `helper_${h.id ?? 'chotu'}`;
    const isMovingOrBegging =
      h.status === 'hired' ||
      (h.status === 'sitting' &&
        (h.beggingState === 'walking_to_stall' ||
          h.beggingState === 'begging_at_stall' ||
          h.beggingState === 'eating_free' ||
          h.beggingState === 'returning_marketing'));
    if (opts.selfId !== hSelfId && isMovingOrBegging) {
      resolveCollisionCircle(pos, h.x, h.z, 0.65);
    }
  }
  for (const ped of shift.pedestrians) {
    if (ped.id === opts.selfId) continue;
    if (ped.x < WORLD_BOUNDS.minX + 1.5 || ped.x > WORLD_BOUNDS.maxX - 1.5) {
      continue;
    }
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

  // 1. Hysteresis-free Supermarket & Rentable Shop doorway routing FIRST
  if (targetZ > -3.45 && npc.x > 4.2 && npc.x < 13.0 && npc.z < -3.45) {
    wayX = 6.2;
    wayZ = -2.65;
  } else if (
    targetZ < -4.0 &&
    npc.z > -3.75 &&
    targetX >= SUPERMARKET_BOUNDS.minX &&
    targetX <= SUPERMARKET_BOUNDS.maxX
  ) {
    wayX = 6.2;
    wayZ = -4.25;
  } else {
    let routed = false;
    for (const b of RENTABLE_BUILDINGS) {
      const doorX = (b.doorMinX + b.doorMaxX) / 2;
      if (
        npc.z >= b.bounds.maxZ - 0.15 &&
        targetZ < b.bounds.maxZ - 0.35 &&
        targetX >= b.bounds.minX &&
        targetX <= b.bounds.maxX
      ) {
        wayX = doorX;
        wayZ = b.bounds.maxZ - 0.75;
        routed = true;
        break;
      }
      if (
        npc.z < b.bounds.maxZ - 0.25 &&
        npc.x >= b.bounds.minX &&
        npc.x <= b.bounds.maxX
      ) {
        if (targetZ > b.bounds.maxZ - 0.15) {
          if (
            npc.z < b.counterPos.z + 0.35 &&
            Math.abs(npc.x - b.counterPos.x) < 1.35
          ) {
            wayX = b.counterPos.x + 1.55;
            wayZ = b.counterPos.z + 0.3;
          } else {
            wayX = doorX;
            wayZ = b.bounds.maxZ + 0.85;
          }
          routed = true;
          break;
        }
        if (
          targetZ < b.counterPos.z - 0.2 &&
          npc.z > b.counterPos.z - 0.3 &&
          Math.abs(targetX - b.counterPos.x) < 1.35
        ) {
          wayX = b.counterPos.x + 1.55;
          wayZ = b.counterPos.z - 0.85;
          routed = true;
          break;
        }
      }
    }
    if (!routed) {
      const specialtyShops = [
        {
          bounds: BUYER_SHOP.bounds,
          doorX: (BUYER_SHOP.doorMinX + BUYER_SHOP.doorMaxX) / 2,
          counterPos: BUYER_SHOP.counterPos,
          clearOffsetX: 1.65,
        },
        {
          bounds: WOOD_MASTER_SHOP.bounds,
          doorX: (WOOD_MASTER_SHOP.doorMinX + WOOD_MASTER_SHOP.doorMaxX) / 2,
          counterPos: WOOD_MASTER_SHOP.counterPos,
          clearOffsetX: 1.95,
        },
      ];
      for (const s of specialtyShops) {
        if (
          npc.z >= s.bounds.maxZ - 0.15 &&
          targetZ < s.bounds.maxZ - 0.35 &&
          targetX >= s.bounds.minX &&
          targetX <= s.bounds.maxX
        ) {
          wayX = s.doorX;
          wayZ = s.bounds.maxZ - 0.85;
          break;
        }
        if (
          npc.z < s.bounds.maxZ - 0.25 &&
          npc.x >= s.bounds.minX &&
          npc.x <= s.bounds.maxX
        ) {
          if (targetZ > s.bounds.maxZ - 0.15) {
            if (
              npc.z < s.counterPos.z + 0.42 &&
              Math.abs(npc.x - s.counterPos.x) < s.clearOffsetX - 0.12
            ) {
              wayX = s.counterPos.x + s.clearOffsetX;
              wayZ = s.counterPos.z + 0.25;
            } else {
              wayX = s.doorX;
              wayZ = s.bounds.maxZ + 0.85;
            }
            break;
          }
          if (
            targetZ < s.counterPos.z - 0.2 &&
            npc.z > s.counterPos.z - 0.35 &&
            Math.abs(targetX - s.counterPos.x) < s.clearOffsetX - 0.12
          ) {
            wayX = s.counterPos.x + s.clearOffsetX;
            wayZ = s.counterPos.z - 0.85;
            break;
          }
        }
      }
    }
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

  if (world.hasTeaStall !== false) {
    applyCartDetour(CYCLE_ANCHOR.x - 4.15, CYCLE_ANCHOR.x + 4.15, CYCLE_ANCHOR.z);
  }
  if (world.hasSnacksCart) {
    applyCartDetour(
      SNACKS_CART_ANCHOR.x - 2.8,
      SNACKS_CART_ANCHOR.x + 2.8,
      SNACKS_CART_ANCHOR.z
    );
  }
  if (world.hasColdCart) {
    applyCartDetour(
      COLD_CART_ANCHOR.x - 2.8,
      COLD_CART_ANCHOR.x + 2.8,
      COLD_CART_ANCHOR.z
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
  if (shift.player2?.active && !shift.player2.sittingChairId) {
    applyPersonRepulsion(shift.player2.x, shift.player2.z, 1.35);
  }
  for (const other of shift.customers) {
    if (other.id === opts.selfId || other.seatedChairId) continue;
    if (
      other.status === 'walking_out' &&
      (other.x < WORLD_BOUNDS.minX + 1.5 || other.x > WORLD_BOUNDS.maxX - 1.5)
    ) {
      continue;
    }
    applyPersonRepulsion(other.x, other.z, 1.48);
  }
  if (opts.selfId !== 'owner') {
    applyPersonRepulsion(shift.supermarketOwner.x, shift.supermarketOwner.z, 1.45);
  }
  for (const v of getShiftShopVisitors(shift)) {
    if (v.id === opts.selfId || (v.phase === 'at_shop' && v.z <= -5.5)) continue;
    applyPersonRepulsion(v.x, v.z, 1.4);
  }
  for (const bk of getShiftBeggarKids(shift)) {
    if (bk.id === opts.selfId) continue;
    applyPersonRepulsion(bk.x, bk.z, 1.3);
  }
  for (const h of getShiftHelpers(shift)) {
    const hSelfId = `helper_${h.id ?? 'chotu'}`;
    const isMovingOrBegging =
      h.status === 'hired' ||
      (h.status === 'sitting' &&
        (h.beggingState === 'walking_to_stall' ||
          h.beggingState === 'begging_at_stall' ||
          h.beggingState === 'eating_free' ||
          h.beggingState === 'returning_marketing'));
    if (opts.selfId !== hSelfId && isMovingOrBegging) {
      applyPersonRepulsion(h.x, h.z, 1.25);
    }
  }
  for (const ped of shift.pedestrians) {
    if (
      ped.id === opts.selfId ||
      ped.x < WORLD_BOUNDS.minX + 1.5 ||
      ped.x > WORLD_BOUNDS.maxX - 1.5
    ) {
      continue;
    }
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
  drink: DrinkType,
  shift: ShiftSnapshot,
  world: WorldSave
): boolean {
  const hasTeaKitchen =
    world.hasTeaStall !== false || getFirstKitchenBuilding(world) !== null;
  if (drink === 'biscuit_pack') {
    return hasTeaKitchen && shift.inventory.biscuits > 0;
  }
  if (drink === 'cupcake') {
    return hasTeaKitchen && shift.inventory.cupcakes > 0;
  }
  if (drink === 'samosa') {
    return (
      world.hasSnacksCart &&
      world.unlockedRecipes.includes('samosa') &&
      shift.inventory.samosaMix > 0 &&
      shift.inventory.cookingOil > 0
    );
  }
  if (drink === 'pakora') {
    return (
      world.hasSnacksCart &&
      world.unlockedRecipes.includes('pakora') &&
      shift.inventory.pakoraMix > 0 &&
      shift.inventory.cookingOil > 0
    );
  }
  if (drink === 'cold_drink') {
    return (
      world.hasColdCart === true &&
      world.unlockedRecipes.includes('cold_drink') &&
      (shift.inventory.coldDrinkBottles ?? 0) > 0 &&
      (shift.inventory.iceBlocks ?? 0) > 0
    );
  }
  if (drink === 'ice_cream') {
    return (
      world.hasColdCart === true &&
      world.unlockedRecipes.includes('ice_cream') &&
      (shift.inventory.iceCreamCones ?? 0) > 0 &&
      (shift.inventory.iceCreamMix ?? 0) > 0 &&
      (shift.inventory.iceBlocks ?? 0) > 0
    );
  }
  if (!hasTeaKitchen || !world.unlockedRecipes.includes(drink)) return false;
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
  helper: HelperKidState,
  shift: ShiftSnapshot,
  world: WorldSave,
  dt: number,
  events: SimStepEvents
): void {
  if (helper.status !== 'hired') return;

  const helperId: HelperNpcId = helper.id ?? 'chotu';
  const cfg = HELPER_NPCS[helperId];
  const isSnacksOnly = cfg.role === 'snacks_only';

  if (isSnacksOnly && !world.hasSnacksCart) {
    helper.statusNote = 'Need 2nd Snacks Readi!';
    return;
  }

  const allHelpers = getShiftHelpers(shift);
  const otherHelpers = allHelpers.filter((h) => h !== helper && h.status === 'hired');
  const munniHired = allHelpers.some(
    (h) => (h.id ?? 'chotu') === 'munni' && h.status === 'hired'
  );
  const otherUsingKettle = otherHelpers.some(
    (h) =>
      h.task === 'fetching_cup' ||
      h.task === 'adding_base' ||
      h.task === 'adding_sugar' ||
      h.task === 'adding_liquid' ||
      h.task === 'to_kettle' ||
      h.task === 'waiting_boil'
  );
  const otherUsingFryer = otherHelpers.some(
    (h) =>
      h.task === 'fetching_plate' ||
      h.task === 'prepping_snack' ||
      h.task === 'to_kadhai' ||
      h.task === 'waiting_fry'
  );
  const otherUsingChiller = otherHelpers.some(
    (h) =>
      h.task === 'fetching_cold_base' ||
      h.task === 'prepping_icecream_mix' ||
      h.task === 'adding_ice_block' ||
      h.task === 'to_chiller' ||
      h.task === 'waiting_chill'
  );
  const claimedCustomerIds = new Set(
    otherHelpers
      .map((h) => h.targetCustomerId)
      .filter((cid): cid is string => Boolean(cid))
  );

  const isDrinkAllowedForRole = (d: DrinkType): boolean => {
    if (isSnacksOnly) {
      return d === 'samosa' || d === 'pakora';
    }
    // When Munni is hired specifically for the Samosa Readi, Chotu/Babloo let her handle fried snacks cleanly
    if ((d === 'samosa' || d === 'pakora') && munniHired) {
      return false;
    }
    return true;
  };

  const firstKitchen = getFirstKitchenBuilding(world);
  const usingShopKitchen =
    !isSnacksOnly && world.hasTeaStall === false && firstKitchen !== null;
  const shopKs = usingShopKitchen ? getShopKitchenStations(firstKitchen) : null;
  const activeStations = shopKs ?? STATIONS;
  const activeTrays = shopKs ? shopKs.trays : TRAY_SPOTS;
  const hasTeaKitchen = world.hasTeaStall !== false || firstKitchen !== null;
  const helperWorkZ = shopKs ? shopKs.standZ : -2.78;
  const helperIdle = isSnacksOnly
    ? cfg.idlePos
    : shopKs
      ? {
          x: shopKs.kettle.x + (helperId === 'babloo' ? 2.4 : 1.5),
          z: shopKs.standZ + 0.3,
        }
      : world.hasTeaStall === false && world.hasSnacksCart
        ? { x: SNACKS_CART_ANCHOR.x + (helperId === 'babloo' ? 1.2 : 0), z: -2.95 }
        : cfg.idlePos;

  const moveHelperTo = (
    tx: number,
    tz: number,
    speed = 2.75,
    allowRoadCurb = false
  ): boolean =>
    moveNpcWithAvoidance(helper, tx, tz, speed, dt, world, shift, {
      biasSign: helperId === 'babloo' ? 1 : -1,
      selfId: `helper_${helperId}`,
      stayOnSidewalk: !(usingShopKitchen || tz < -4.9 || helper.z < -4.9),
      allowRoadCurb: allowRoadCurb || helper.z > 1.55,
    });

  const canHelperTakeNewOrder = (dType: DrinkType): boolean => {
    if (!isDrinkAllowedForRole(dType)) return false;
    if (!canHelperMakeDrink(dType, shift, world)) return false;
    // Kettle/fryer/chiller are single stations, but helpers can queue:
    // to_kettle/to_kadhai/to_chiller handlers wait until the station is free.
    return true;
  };

  const pickBestWaitingTarget = (
    preferredDrink?: DrinkType | null,
    requireMakeable = true
  ): {
    id: string;
    drink: DrinkType;
    x: number;
    z: number;
    isOwner: boolean;
    isCar: boolean;
    isVisitor: boolean;
  } | null => {
    let best: {
      id: string;
      drink: DrinkType;
      x: number;
      z: number;
      patienceRatio: number;
      isOwner: boolean;
      isCar: boolean;
      isVisitor: boolean;
    } | null = null;

    for (const c of shift.customers) {
      if (c.status !== 'waiting') continue;
      if (claimedCustomerIds.has(c.id)) continue;
      const dType = c.orderDrink;
      if (preferredDrink && dType !== preferredDrink) continue;
      if (!preferredDrink) {
        if (!isDrinkAllowedForRole(dType)) continue;
        if (requireMakeable && !canHelperTakeNewOrder(dType)) continue;
      }
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
          isVisitor: false,
        };
      }
    }

    const owner = shift.supermarketOwner;
    if (
      !claimedCustomerIds.has('owner_customer') &&
      owner.phase === 'ordering_chai' &&
      (!preferredDrink || owner.orderDrink === preferredDrink) &&
      (preferredDrink ||
        (isDrinkAllowedForRole(owner.orderDrink) &&
          (!requireMakeable || canHelperTakeNewOrder(owner.orderDrink))))
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
          isVisitor: false,
        };
      }
    }

    for (const v of getShiftShopVisitors(shift)) {
      if (v.phase !== 'ordering') continue;
      if (claimedCustomerIds.has(v.id)) continue;
      const dType = v.orderDrink;
      if (preferredDrink && dType !== preferredDrink) continue;
      if (!preferredDrink) {
        if (!isDrinkAllowedForRole(dType)) continue;
        if (requireMakeable && !canHelperTakeNewOrder(dType)) continue;
      }
      const ratio = v.patience / Math.max(1, v.maxPatience);
      if (!best || ratio < best.patienceRatio) {
        best = {
          id: v.id,
          drink: dType,
          x: v.x,
          z: v.z,
          patienceRatio: ratio,
          isOwner: false,
          isCar: false,
          isVisitor: true,
        };
      }
    }

    const car = shift.carCustomer;
    if (!claimedCustomerIds.has('car_customer') && car.phase === 'waiting') {
      const carDrink = car.orderDrink || 'tea';
      if (
        (!preferredDrink || carDrink === preferredDrink) &&
        (preferredDrink ||
          (isDrinkAllowedForRole(carDrink) &&
            (!requireMakeable || canHelperTakeNewOrder(carDrink))))
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
            isVisitor: false,
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

  // If helper already holds any finished drink/snack -> serve matching customer, owner, or car, or place on Free Space!
  const helperHot = heldHotDrinkType(helper.holding);
  if (helperHot !== null) {
    helper.task = 'serving';
    const target = pickBestWaitingTarget(helperHot, false);
    if (!target) {
      // No one wants this item right now -> place on empty Showcase/Free Space so customers auto-grab it!
      if (
        (helperHot === 'samosa' || helperHot === 'pakora') &&
        world.hasSnacksCart
      ) {
        const sTrays = shift.snackTrayItems ?? [null, null];
        const emptyIdx = sTrays.findIndex((t) => t === null);
        if (emptyIdx >= 0 && SNACK_TRAY_SPOTS[emptyIdx]) {
          const spot = SNACK_TRAY_SPOTS[emptyIdx];
          const arrived = moveHelperTo(spot.x, -2.78);
          if (arrived) {
            sTrays[emptyIdx] = helper.holding;
            shift.snackTrayItems = sTrays;
            helper.holding = null;
            helper.task = 'idle';
            helper.targetDrink = null;
            helper.targetCustomerId = null;
            helper.statusNote = 'Placed on Snacks Showcase';
            events.sounds.push('pickup');
          }
          return;
        }
      }

      if (
        (helperHot === 'cold_drink' || helperHot === 'ice_cream') &&
        world.hasColdCart
      ) {
        const cTrays = shift.coldTrayItems ?? [null, null];
        const emptyIdx = cTrays.findIndex((t) => t === null);
        if (emptyIdx >= 0 && COLD_TRAY_SPOTS[emptyIdx]) {
          const spot = COLD_TRAY_SPOTS[emptyIdx];
          const arrived = moveHelperTo(spot.x, -2.78);
          if (arrived) {
            cTrays[emptyIdx] = helper.holding;
            shift.coldTrayItems = cTrays;
            helper.holding = null;
            helper.task = 'idle';
            helper.targetDrink = null;
            helper.targetCustomerId = null;
            helper.statusNote = 'Placed on Chilled Showcase';
            events.sounds.push('pickup');
          }
          return;
        }
      }

      if (!isSnacksOnly && hasTeaKitchen) {
        const trays = shift.trayItems ?? [null, null, null, null];
        const emptyIdx = trays.findIndex((t) => t === null);
        if (emptyIdx >= 0 && activeTrays[emptyIdx % activeTrays.length]) {
          const spot = activeTrays[emptyIdx % activeTrays.length];
          const arrived = moveHelperTo(spot.x, helperWorkZ);
          if (arrived) {
            trays[emptyIdx] = helper.holding;
            shift.trayItems = trays;
            shift.trayItem = trays[0] ?? null;
            helper.holding = null;
            helper.task = 'idle';
            helper.targetDrink = null;
            helper.targetCustomerId = null;
            helper.statusNote = 'Placed spare item';
            events.sounds.push('pickup');
          }
          return;
        }
      }

      moveHelperTo(helperIdle.x, helperIdle.z, 2.0);
      helper.statusNote = `Holding ${DRINK_CATALOG[helperHot].name}...`;
      return;
    }

    // Walk to Car window, Seated Customer, Shop Visitor, or Standing Customer / Mart Owner!
    const cust =
      target.isOwner || target.isCar || target.isVisitor
        ? null
        : shift.customers.find((c) => c.id === target.id);

    const nearSnacksCart =
      world.hasSnacksCart &&
      Math.abs(target.x - SNACKS_CART_ANCHOR.x) < 3.4 &&
      target.z > -0.5;
    const nearColdCart =
      world.hasColdCart &&
      Math.abs(target.x - COLD_CART_ANCHOR.x) < 3.4 &&
      target.z > -0.5;
    const nearTeaCart =
      world.hasTeaStall !== false &&
      Math.abs(target.x - CYCLE_ANCHOR.x) < 4.5 &&
      target.z > -0.5;

    const serveX = target.isCar
      ? target.x
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
          ).x
        : nearSnacksCart || nearColdCart || nearTeaCart
          ? target.x
          : clamp(target.x, -23.0, 23.0);

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
        : nearSnacksCart || nearColdCart || nearTeaCart
          ? -2.78
          : clamp(target.z - 1.15, -4.5, 1.25);

    if (target.isCar) {
      helper.statusNote = `Serving Car (${DRINK_CATALOG[helperHot].name})`;
    } else {
      helper.statusNote = `Serving ${DRINK_CATALOG[helperHot].name}`;
    }

    const arrived = moveHelperTo(serveX, serveZ, 2.95, target.isCar);
    const serveRange = target.isCar ? 2.35 : 3.55;
    if (arrived || Math.hypot(target.x - helper.x, target.z - helper.z) < serveRange) {
      const info = DRINK_CATALOG[helperHot] ?? DRINK_CATALOG.tea;
      const tip = rollRandomTipCents();
      const boostedPrice = applySalesBoostCents(info.priceCents, shift);
      const totalPay = boostedPrice + tip;
      const wage = getHelperWageCents(helperId, info.priceCents);
      const netCash = totalPay - wage;

      helper.holding = null;
      helper.task = 'idle';
      helper.targetDrink = null;
      helper.targetCustomerId = null;
      helper.servedCount += 1;
      helper.wageEarnedCents += wage;
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
          events.feedbackText = `${cfg.name} served Car (${car.qtyTotal}x ${info.name})! +${formatMoney(totalPay)} (-${formatMoney(wage)} wage)`;
        } else {
          helper.statusNote = `Car ${car.qtyServed}/${car.qtyTotal} Served`;
          events.feedbackText = `${cfg.name} served Car ${car.qtyServed}/${car.qtyTotal} ${info.name}! +${formatMoney(totalPay)} (-${formatMoney(wage)} wage)`;
        }
        events.feedbackColor = '#86EFAC';
      } else if (target.isOwner) {
        shift.supermarketOwner.phase = 'drinking_chai';
        shift.supermarketOwner.drinkTimer = 4.2;
        helper.statusNote = `Served Mart Owner!`;
        events.feedbackText = `${cfg.name} served Mart Owner ${info.name}! +${formatMoney(totalPay)} (-${formatMoney(wage)} wage)`;
        events.feedbackColor = '#86EFAC';
      } else if (target.isVisitor) {
        const vis = getShiftShopVisitors(shift).find((v) => v.id === target.id);
        if (vis) {
          vis.phase = 'eating_drinking';
          vis.drinkTimer = 4.2;
          helper.statusNote = `Served ${vis.name}!`;
          events.feedbackText = `${cfg.name} served ${vis.name} (${info.name})! +${formatMoney(totalPay)} (-${formatMoney(wage)} wage)`;
          events.feedbackColor = '#86EFAC';
        }
      } else if (cust) {
        cust.status = 'drinking';
        cust.drinkTimer = 4.2;
        helper.statusNote = `Served ${info.name}!`;
        events.feedbackText = `${cfg.name} served ${info.name}! +${formatMoney(totalPay)} (-${formatMoney(wage)} wage)`;
        events.feedbackColor = '#86EFAC';
      }

      maybeUnlockLevel2(world, shift, events);
    }
    return;
  }

  // If kettle is already ready with a drink matching any waiting customer/car (never for Snacks-only girl!)
  if (
    !isSnacksOnly &&
    hasTeaKitchen &&
    helper.holding === null &&
    shift.kettle.status === 'ready' &&
    shift.kettle.brewingDrink
  ) {
    const matchCust = pickBestWaitingTarget(shift.kettle.brewingDrink, false);
    const kettleClaimedByGrabber = otherHelpers.some(
      (h) => h.status === 'hired' && h.holding === null && h.statusNote === 'Grabbing boiled cup'
    );
    if (matchCust && !kettleClaimedByGrabber) {
      helper.statusNote = 'Grabbing boiled cup';
      const arrived = moveHelperTo(activeStations.kettle.x, helperWorkZ, 2.85);
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

  // If fryer is already ready with a snack matching any waiting customer/car, grab it!
  const fryerClaimedByWaitingHelper = allHelpers.some(
    (h) => h.status === 'hired' && h.task === 'waiting_fry'
  );
  if (
    world.hasSnacksCart &&
    (isSnacksOnly || !munniHired) &&
    helper.holding === null &&
    shift.fryer.status === 'ready' &&
    shift.fryer.fryingSnack &&
    !fryerClaimedByWaitingHelper
  ) {
    const matchCust = pickBestWaitingTarget(shift.fryer.fryingSnack, false);
    const fryerClaimedByGrabber = otherHelpers.some(
      (h) => h.status === 'hired' && h.holding === null && h.statusNote === `Grabbing hot ${DRINK_CATALOG[shift.fryer.fryingSnack!].name}`
    );
    if (matchCust && !fryerClaimedByGrabber) {
      helper.statusNote = `Grabbing hot ${DRINK_CATALOG[shift.fryer.fryingSnack].name}`;
      const arrived = moveHelperTo(SNACK_STATIONS.kadhai.x, -2.78, 2.85);
      if (arrived) {
        helper.holding = drinkToHotItem(shift.fryer.fryingSnack);
        shift.fryer.status = 'idle';
        shift.fryer.progress = 0;
        shift.fryer.fryingSnack = null;
        helper.task = 'serving';
        helper.actionTimer = 0.3;
        events.sounds.push('pickup');
      }
      return;
    }
  }

  // If chiller is already ready with a cold item matching any waiting customer/car, grab it!
  const chillerClaimedByWaitingHelper = allHelpers.some(
    (h) => h.status === 'hired' && h.task === 'waiting_chill'
  );
  if (
    !isSnacksOnly &&
    world.hasColdCart &&
    helper.holding === null &&
    shift.chiller?.status === 'ready' &&
    shift.chiller.chillingItem &&
    !chillerClaimedByWaitingHelper
  ) {
    const matchCust = pickBestWaitingTarget(shift.chiller.chillingItem, false);
    const chillerClaimedByGrabber = otherHelpers.some(
      (h) => h.status === 'hired' && h.holding === null && h.statusNote === `Grabbing chilled ${DRINK_CATALOG[shift.chiller.chillingItem!].name}`
    );
    if (matchCust && !chillerClaimedByGrabber) {
      helper.statusNote = `Grabbing chilled ${DRINK_CATALOG[shift.chiller.chillingItem].name}`;
      const arrived = moveHelperTo(COLD_STATIONS.chiller.x, -2.78, 2.85);
      if (arrived) {
        helper.holding = drinkToHotItem(shift.chiller.chillingItem);
        shift.chiller.status = 'idle';
        shift.chiller.progress = 0;
        shift.chiller.chillingItem = null;
        helper.task = 'serving';
        helper.actionTimer = 0.3;
        events.sounds.push('pickup');
      }
      return;
    }
  }

  // Idle -> pick an already-placed tray item or an eligible order matching helper's role
  if (helper.task === 'idle') {
    if (helper.holding !== null) {
      if (helper.holding === 'empty_cup') shift.inventory.cups += 1;
      helper.holding = null;
    }
    helper.targetDrink = null;
    helper.targetCustomerId = null;

    // 1. Check if a ready item on counter/snack/cold trays already matches a waiting customer/owner/car
    if (!isSnacksOnly && hasTeaKitchen) {
      const trays = shift.trayItems ?? [null, null, null, null];
      for (let i = 0; i < trays.length; i++) {
        const item = trays[i];
        const trayDrink = heldHotDrinkType(item);
        if (!trayDrink || !isDrinkAllowedForRole(trayDrink)) continue;
        const match = pickBestWaitingTarget(trayDrink, false);
        if (match && activeTrays[i % activeTrays.length]) {
          const spot = activeTrays[i % activeTrays.length];
          helper.statusNote = `Grabbing ${DRINK_CATALOG[trayDrink].name}`;
          const arrived = moveHelperTo(spot.x, helperWorkZ, 2.85);
          if (arrived) {
            helper.holding = item;
            trays[i] = null;
            shift.trayItems = trays;
            shift.trayItem = trays[0] ?? null;
            helper.task = 'serving';
            helper.actionTimer = 0.25;
            events.sounds.push('pickup');
          }
          return;
        }
      }
    }
    if (world.hasSnacksCart && (isSnacksOnly || !munniHired)) {
      const sTrays = shift.snackTrayItems ?? [null, null];
      for (let i = 0; i < sTrays.length; i++) {
        const item = sTrays[i];
        const trayDrink = heldHotDrinkType(item);
        if (!trayDrink) continue;
        const match = pickBestWaitingTarget(trayDrink, false);
        if (match && SNACK_TRAY_SPOTS[i]) {
          const spot = SNACK_TRAY_SPOTS[i];
          helper.statusNote = `Grabbing ${DRINK_CATALOG[trayDrink].name}`;
          const arrived = moveHelperTo(spot.x, -2.78, 2.85);
          if (arrived) {
            helper.holding = item;
            sTrays[i] = null;
            shift.snackTrayItems = sTrays;
            helper.task = 'serving';
            helper.actionTimer = 0.25;
            events.sounds.push('pickup');
          }
          return;
        }
      }
    }
    if (!isSnacksOnly && world.hasColdCart) {
      const cTrays = shift.coldTrayItems ?? [null, null];
      for (let i = 0; i < cTrays.length; i++) {
        const item = cTrays[i];
        const trayDrink = heldHotDrinkType(item);
        if (!trayDrink) continue;
        const match = pickBestWaitingTarget(trayDrink, false);
        if (match && COLD_TRAY_SPOTS[i]) {
          const spot = COLD_TRAY_SPOTS[i];
          helper.statusNote = `Grabbing ${DRINK_CATALOG[trayDrink].name}`;
          const arrived = moveHelperTo(spot.x, -2.78, 2.85);
          if (arrived) {
            helper.holding = item;
            cTrays[i] = null;
            shift.coldTrayItems = cTrays;
            helper.task = 'serving';
            helper.actionTimer = 0.25;
            events.sounds.push('pickup');
          }
          return;
        }
      }
    }

    // 2. Otherwise pick the most urgent eligible order this helper can make/grab from stock
    const stationConflicts = (drink: DrinkType): boolean => {
      const needsFryer = drink === 'samosa' || drink === 'pakora';
      const needsChiller = drink === 'cold_drink' || drink === 'ice_cream';
      const needsKettle =
        !needsFryer &&
        !needsChiller &&
        drink !== 'biscuit_pack' &&
        drink !== 'cupcake';
      return (
        (needsKettle && otherUsingKettle) ||
        (needsFryer && otherUsingFryer) ||
        (needsChiller && otherUsingChiller)
      );
    };

    let nextOrder = pickBestWaitingTarget(null, true);
    if (nextOrder && stationConflicts(nextOrder.drink)) {
      type AltOrder = {
        id: string;
        drink: DrinkType;
        x: number;
        z: number;
        isOwner: boolean;
        isCar: boolean;
        isVisitor: boolean;
        patienceRatio: number;
      };
      const altRef: { current: AltOrder | null } = { current: null };
      const considerAlt = (
        candidate: {
          id: string;
          drink: DrinkType;
          x: number;
          z: number;
          isOwner: boolean;
          isCar: boolean;
          isVisitor: boolean;
        } | null,
        patienceRatio: number
      ) => {
        if (!candidate || stationConflicts(candidate.drink)) return;
        if (!altRef.current || patienceRatio < altRef.current.patienceRatio) {
          altRef.current = { ...candidate, patienceRatio };
        }
      };
      for (const c of shift.customers) {
        if (c.status !== 'waiting' || claimedCustomerIds.has(c.id)) continue;
        if (!isDrinkAllowedForRole(c.orderDrink)) continue;
        if (!canHelperTakeNewOrder(c.orderDrink)) continue;
        considerAlt(
          { id: c.id, drink: c.orderDrink, x: c.x, z: c.z, isOwner: false, isCar: false, isVisitor: false },
          c.patience / Math.max(1, c.maxPatience)
        );
      }
      const ownerAlt = shift.supermarketOwner;
      if (!claimedCustomerIds.has('owner_customer') && ownerAlt.phase === 'ordering_chai' && isDrinkAllowedForRole(ownerAlt.orderDrink) && canHelperTakeNewOrder(ownerAlt.orderDrink)) {
        considerAlt(
          { id: 'owner_customer', drink: ownerAlt.orderDrink, x: ownerAlt.x, z: ownerAlt.z, isOwner: true, isCar: false, isVisitor: false },
          ownerAlt.patience / Math.max(1, ownerAlt.maxPatience)
        );
      }
      for (const v of getShiftShopVisitors(shift)) {
        if (v.phase !== 'ordering' || claimedCustomerIds.has(v.id)) continue;
        if (!isDrinkAllowedForRole(v.orderDrink) || !canHelperTakeNewOrder(v.orderDrink)) continue;
        considerAlt(
          { id: v.id, drink: v.orderDrink, x: v.x, z: v.z, isOwner: false, isCar: false, isVisitor: true },
          v.patience / Math.max(1, v.maxPatience)
        );
      }
      const carAlt = shift.carCustomer;
      if (!claimedCustomerIds.has('car_customer') && carAlt.phase === 'waiting') {
        const carDrink = carAlt.orderDrink || 'tea';
        if (isDrinkAllowedForRole(carDrink) && canHelperTakeNewOrder(carDrink)) {
          considerAlt(
            { id: 'car_customer', drink: carDrink, x: carAlt.x, z: carAlt.z, isOwner: false, isCar: true, isVisitor: false },
            carAlt.patience / Math.max(1, carAlt.maxPatience)
          );
        }
      }
      if (altRef.current) {
        const best = altRef.current;
        nextOrder = {
          id: best.id,
          drink: best.drink,
          x: best.x,
          z: best.z,
          isOwner: best.isOwner,
          isCar: best.isCar,
          isVisitor: best.isVisitor,
        };
      }
    }

    if (nextOrder) {
      helper.targetDrink = nextOrder.drink;
      helper.targetCustomerId = nextOrder.id;
      const dName = DRINK_CATALOG[nextOrder.drink].name;
      if (nextOrder.drink === 'biscuit_pack') {
        helper.task = 'fetching_biscuit';
        helper.statusNote = nextOrder.isCar
          ? `Grabbing Car ${dName}`
          : `Grabbing ${dName}`;
      } else if (nextOrder.drink === 'cupcake') {
        helper.task = 'fetching_cupcake';
        helper.statusNote = nextOrder.isCar
          ? `Grabbing Car ${dName}`
          : `Grabbing ${dName}`;
      } else if (nextOrder.drink === 'samosa' || nextOrder.drink === 'pakora') {
        helper.task = 'fetching_plate';
        helper.statusNote = nextOrder.isCar
          ? `Frying Car ${dName}`
          : `Frying ${dName}`;
      } else if (
        nextOrder.drink === 'cold_drink' ||
        nextOrder.drink === 'ice_cream'
      ) {
        helper.task = 'fetching_cold_base';
        helper.statusNote = nextOrder.isCar
          ? `Chilling Car ${dName}`
          : `Chilling ${dName}`;
      } else {
        helper.task = 'fetching_cup';
        helper.statusNote = nextOrder.isCar
          ? `Making Car ${dName}`
          : `Making ${dName}`;
      }
    } else {
      const anyWaiting = pickBestWaitingTarget(null, false);
      const missingDrink = anyWaiting?.drink;
      if (missingDrink) {
        if (missingDrink === 'biscuit_pack' && shift.inventory.biscuits <= 0) {
          helper.statusNote = 'Need Biscuits!';
        } else if (missingDrink === 'cupcake' && shift.inventory.cupcakes <= 0) {
          helper.statusNote = 'Need Cupcakes!';
        } else if (missingDrink === 'samosa' && shift.inventory.samosaMix <= 0) {
          helper.statusNote = 'Need Samosa Mix!';
        } else if (missingDrink === 'pakora' && shift.inventory.pakoraMix <= 0) {
          helper.statusNote = 'Need Pakora Mix!';
        } else if (
          (missingDrink === 'samosa' || missingDrink === 'pakora') &&
          shift.inventory.cookingOil <= 0
        ) {
          helper.statusNote = 'Need Oil!';
        } else if (
          missingDrink === 'cold_drink' &&
          (shift.inventory.coldDrinkBottles ?? 0) <= 0
        ) {
          helper.statusNote = 'Need Soda!';
        } else if (
          missingDrink === 'ice_cream' &&
          (shift.inventory.iceCreamCones ?? 0) <= 0
        ) {
          helper.statusNote = 'Need Cones!';
        } else if (
          missingDrink === 'ice_cream' &&
          (shift.inventory.iceCreamMix ?? 0) <= 0
        ) {
          helper.statusNote = 'Need IC Mix!';
        } else if (
          (missingDrink === 'cold_drink' || missingDrink === 'ice_cream') &&
          (shift.inventory.iceBlocks ?? 0) <= 0
        ) {
          helper.statusNote = 'Need Ice Blocks!';
        } else if (
          (missingDrink === 'cold_drink' || missingDrink === 'ice_cream') &&
          ((shift.chiller?.status ?? 'idle') !== 'idle' || otherUsingChiller)
        ) {
          helper.statusNote = 'Chiller Busy';
        } else if (shift.inventory.cups <= 0) {
          helper.statusNote = 'Need Cups!';
        } else if (
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
        } else if (shift.inventory.sugar <= 0) {
          helper.statusNote = 'Need Sugar!';
        } else if (
          (missingDrink === 'tea' ||
            missingDrink === 'doodh_patti' ||
            missingDrink === 'coffee') &&
          shift.kettle.status !== 'idle' &&
          otherUsingKettle
        ) {
          helper.statusNote = 'Kettle Busy (Queueing)';
        } else {
          helper.statusNote = 'Ready to Help';
        }
      } else {
        const waitingKid =
          getShiftBeggarKids(shift).some((bk) => bk.status === 'waiting') ||
          allHelpers.some(
            (h) => h.status === 'sitting' && h.beggingState === 'begging_at_stall'
          );
        if (waitingKid) {
          helper.statusNote = 'Keeping Kid Waiting (2m)';
        } else {
          helper.statusNote = isSnacksOnly
            ? 'Watching Samosa Cart'
            : 'Ready to Help';
        }
      }
      const arrivedIdle = moveHelperTo(helperIdle.x, helperIdle.z, 2.0);
      if (arrivedIdle) {
        helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
      }
      return;
    }
  }

  const drink = helper.targetDrink ?? (isSnacksOnly ? 'samosa' : 'tea');

  if (!isSnacksOnly && helper.task === 'fetching_biscuit') {
    if (!hasTeaKitchen) {
      helper.task = 'idle';
      return;
    }
    const arrived = moveHelperTo(activeStations.biscuit_box.x, helperWorkZ);
    if (arrived) {
      if (shift.inventory.biscuits > 0) {
        shift.inventory.biscuits -= 1;
        helper.holding = 'biscuit_pack';
        helper.task = 'serving';
        helper.actionTimer = 0.35;
        events.sounds.push('pickup');
      } else {
        helper.task = 'idle';
      }
    }
    return;
  }

  if (!isSnacksOnly && helper.task === 'fetching_cupcake') {
    if (!hasTeaKitchen) {
      helper.task = 'idle';
      return;
    }
    const arrived = moveHelperTo(activeStations.cupcake_box.x, helperWorkZ);
    if (arrived) {
      if (shift.inventory.cupcakes > 0) {
        shift.inventory.cupcakes -= 1;
        helper.holding = 'cupcake';
        helper.task = 'serving';
        helper.actionTimer = 0.35;
        events.sounds.push('pickup');
      } else {
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'fetching_plate') {
    if (!world.hasSnacksCart) {
      helper.task = 'idle';
      return;
    }
    if (helper.holding === 'paper_plate') {
      helper.task = 'prepping_snack';
      return;
    }
    const arrived = moveHelperTo(SNACK_STATIONS.snack_plates.x, -2.78);
    if (arrived) {
      helper.holding = 'paper_plate';
      helper.task = 'prepping_snack';
      helper.actionTimer = 0.35;
      events.sounds.push('pickup');
    }
    return;
  }

  if (helper.task === 'prepping_snack') {
    if (!world.hasSnacksCart) {
      helper.holding = null;
      helper.task = 'idle';
      return;
    }
    const isPakora = drink === 'pakora';
    const station = isPakora
      ? SNACK_STATIONS.pakora_prep
      : SNACK_STATIONS.samosa_prep;
    const arrived = moveHelperTo(station.x, -2.78);
    if (arrived) {
      if (isPakora && shift.inventory.pakoraMix > 0) {
        shift.inventory.pakoraMix -= 1;
        helper.holding = 'raw_pakora';
        helper.task = 'to_kadhai';
        helper.actionTimer = 0.35;
        events.sounds.push('pickup');
      } else if (!isPakora && shift.inventory.samosaMix > 0) {
        shift.inventory.samosaMix -= 1;
        helper.holding = 'raw_samosa';
        helper.task = 'to_kadhai';
        helper.actionTimer = 0.35;
        events.sounds.push('pickup');
      } else {
        helper.holding = null;
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'to_kadhai') {
    if (!world.hasSnacksCart) {
      helper.holding = null;
      helper.task = 'idle';
      return;
    }
    const arrived = moveHelperTo(SNACK_STATIONS.kadhai.x, -2.78);
    if (arrived) {
      helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
      if (shift.fryer.status === 'idle') {
        if (shift.inventory.cookingOil > 0) {
          shift.inventory.cookingOil -= 1;
          helper.holding = null;
          shift.fryer.status = 'frying';
          shift.fryer.progress = 0;
          shift.fryer.fryingSnack = drink === 'pakora' ? 'pakora' : 'samosa';
          helper.task = 'waiting_fry';
          helper.statusNote = `Frying ${DRINK_CATALOG[shift.fryer.fryingSnack].name}...`;
          events.sounds.push('pour');
        } else {
          helper.holding = null;
          helper.task = 'idle';
        }
      } else {
        helper.statusNote = 'Waiting for Kadhai';
      }
    }
    return;
  }

  if (helper.task === 'waiting_fry') {
    helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
    if (shift.fryer.status === 'ready' && shift.fryer.fryingSnack) {
      helper.holding = drinkToHotItem(shift.fryer.fryingSnack);
      shift.fryer.status = 'idle';
      shift.fryer.progress = 0;
      shift.fryer.fryingSnack = null;
      helper.task = 'serving';
      helper.actionTimer = 0.3;
      events.sounds.push('pickup');
    } else if (shift.fryer.status === 'idle') {
      helper.task = 'idle';
      helper.targetDrink = null;
      helper.targetCustomerId = null;
    }
    return;
  }

  if (isSnacksOnly) {
    helper.task = 'idle';
    return;
  }

  if (helper.task === 'fetching_cup') {
    if (helper.holding !== null) {
      helper.task = 'adding_base';
      return;
    }
    const arrived = moveHelperTo(activeStations.cups.x, helperWorkZ);
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
    const station =
      drink === 'coffee' ? activeStations.coffee_jar : activeStations.tea_tin;
    const arrived = moveHelperTo(station.x, helperWorkZ);
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
    const arrived = moveHelperTo(activeStations.sugar_jar.x, helperWorkZ);
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
    const station = isMilk ? activeStations.milk_crate : activeStations.water_jug;
    const arrived = moveHelperTo(station.x, helperWorkZ);
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
    const arrived = moveHelperTo(activeStations.kettle.x, helperWorkZ);
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
      helper.task = 'idle';
      helper.targetDrink = null;
      helper.targetCustomerId = null;
    }
    return;
  }

  // Cold Readi Helper Steps (Cold Drink & Ice Cream)
  if (helper.task === 'fetching_cold_base') {
    if (!world.hasColdCart) {
      helper.holding = null;
      helper.task = 'idle';
      return;
    }
    const isIceCream = drink === 'ice_cream';
    const station = isIceCream
      ? COLD_STATIONS.cone_stack
      : COLD_STATIONS.soda_crate;
    const arrived = moveHelperTo(station.x, -2.78);
    if (arrived) {
      if (isIceCream && (shift.inventory.iceCreamCones ?? 0) > 0) {
        shift.inventory.iceCreamCones -= 1;
        helper.holding = 'empty_cone';
        helper.task = 'prepping_icecream_mix';
        helper.actionTimer = 0.35;
        events.sounds.push('pickup');
      } else if (!isIceCream && (shift.inventory.coldDrinkBottles ?? 0) > 0) {
        shift.inventory.coldDrinkBottles -= 1;
        helper.holding = 'cold_bottle';
        helper.task = 'adding_ice_block';
        helper.actionTimer = 0.35;
        events.sounds.push('pickup');
      } else {
        helper.holding = null;
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'prepping_icecream_mix') {
    if (!world.hasColdCart) {
      helper.holding = null;
      helper.task = 'idle';
      return;
    }
    const arrived = moveHelperTo(COLD_STATIONS.icecream_tub.x, -2.78);
    if (arrived) {
      if ((shift.inventory.iceCreamMix ?? 0) > 0) {
        shift.inventory.iceCreamMix -= 1;
        helper.holding = 'cone_with_mix';
        helper.task = 'adding_ice_block';
        helper.actionTimer = 0.35;
        events.sounds.push('pickup');
      } else {
        helper.holding = null;
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'adding_ice_block') {
    if (!world.hasColdCart) {
      helper.holding = null;
      helper.task = 'idle';
      return;
    }
    const arrived = moveHelperTo(COLD_STATIONS.ice_box.x, -2.78);
    if (arrived) {
      if ((shift.inventory.iceBlocks ?? 0) > 0) {
        shift.inventory.iceBlocks -= 1;
        helper.holding =
          helper.holding === 'cone_with_mix'
            ? 'iced_cream_mix'
            : 'cold_bottle_iced';
        helper.task = 'to_chiller';
        helper.actionTimer = 0.35;
        events.sounds.push('pour');
      } else {
        helper.holding = null;
        helper.task = 'idle';
      }
    }
    return;
  }

  if (helper.task === 'to_chiller') {
    if (!world.hasColdCart) {
      helper.holding = null;
      helper.task = 'idle';
      return;
    }
    const arrived = moveHelperTo(COLD_STATIONS.chiller.x, -2.78);
    if (arrived) {
      helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
      if ((shift.chiller?.status ?? 'idle') === 'idle') {
        const chillKind: 'cold_drink' | 'ice_cream' =
          helper.holding === 'iced_cream_mix' ? 'ice_cream' : 'cold_drink';
        helper.holding = null;
        shift.chiller = {
          status: 'chilling',
          progress: 0,
          chillingItem: chillKind,
        };
        helper.task = 'waiting_chill';
        helper.statusNote = `Chilling ${DRINK_CATALOG[chillKind].name}...`;
        events.sounds.push('pour');
      } else {
        helper.statusNote = 'Waiting for Chiller';
      }
    }
    return;
  }

  if (helper.task === 'waiting_chill') {
    helper.yaw = dampAngle(helper.yaw, 0, 8, dt);
    if (shift.chiller?.status === 'ready' && shift.chiller.chillingItem) {
      helper.holding = drinkToHotItem(shift.chiller.chillingItem);
      shift.chiller.status = 'idle';
      shift.chiller.progress = 0;
      shift.chiller.chillingItem = null;
      helper.task = 'serving';
      helper.actionTimer = 0.3;
      events.sounds.push('pickup');
    } else if ((shift.chiller?.status ?? 'idle') === 'idle') {
      helper.task = 'idle';
      helper.targetDrink = null;
      helper.targetCustomerId = null;
    }
  }
}

function stepUnhiredHelperBegging(
  helper: HelperKidState,
  shift: ShiftSnapshot,
  world: WorldSave,
  dt: number,
  events: SimStepEvents,
  activeHelperLabel: string | null
): void {
  if (helper.status !== 'sitting') return;

  const hId: HelperNpcId = helper.id ?? 'chotu';
  const cfg = HELPER_NPCS[hId];
  const state = helper.beggingState ?? 'at_mat';
  const hBias: 1 | -1 = hId === 'babloo' ? 1 : -1;

  if (typeof helper.hungerTimer !== 'number') {
    helper.hungerTimer = hId === 'chotu' ? 22 : hId === 'munni' ? 36 : 50;
  }

  if (state === 'at_mat') {
    helper.x = cfg.sitPos.x;
    helper.z = cfg.sitPos.z;
    helper.yaw = 0;
    helper.beggingDrink = null;
    helper.statusNote = '';
    helper.hungerTimer -= dt;
    if (helper.hungerTimer <= 0) {
      const choices = getAvailableMenuChoices(world, shift);
      let picked: DrinkType =
        choices.length > 0
          ? choices[Math.floor(Math.random() * choices.length)]
          : 'tea';
      if (
        hId === 'munni' &&
        world.hasSnacksCart &&
        choices.some((d) => d === 'samosa' || d === 'pakora')
      ) {
        const snackChoices = choices.filter(
          (d) => d === 'samosa' || d === 'pakora'
        );
        picked = snackChoices[Math.floor(Math.random() * snackChoices.length)];
      }
      const spotPool =
        world.hasSnacksCart && (picked === 'samosa' || picked === 'pakora')
          ? BEGGAR_SNACK_SLOTS
          : world.hasColdCart && (picked === 'cold_drink' || picked === 'ice_cream')
            ? BEGGAR_COLD_SLOTS
            : BEGGAR_KID_SLOTS;
      const idx = hId === 'chotu' ? 0 : hId === 'munni' ? 1 : 0;
      const targetSpot = spotPool[idx % spotPool.length];
      helper.beggingState = 'walking_to_stall';
      helper.beggingDrink = picked;
      helper.beggingTargetX = targetSpot.x;
      helper.beggingTargetZ = targetSpot.z;
      helper.patience = BEGGAR_KID_WAIT_SECONDS;
      helper.maxPatience = BEGGAR_KID_WAIT_SECONDS;
      helper.beggingWalkTimer = 15;
      helper.statusNote = `Hungry! Asking for free ${(DRINK_CATALOG[picked] ?? DRINK_CATALOG.tea).name}`;
      events.feedbackText = `${cfg.name} (${cfg.locationLabel}) is hungry & walking to Readi for free ${(DRINK_CATALOG[picked] ?? DRINK_CATALOG.tea).name}!`;
      events.feedbackColor = '#FDE68A';
    }
    return;
  }

  if (state === 'walking_to_stall') {
    const tx = helper.beggingTargetX ?? BEGGAR_KID_SLOTS[0].x;
    const tz = helper.beggingTargetZ ?? BEGGAR_KID_SLOTS[0].z;
    helper.beggingWalkTimer = Math.max(0, (helper.beggingWalkTimer ?? 15) - dt);
    const arrived = moveNpcWithAvoidance(helper, tx, tz, 2.05, dt, world, shift, {
      biasSign: hBias,
      selfId: `helper_${hId}`,
      stayOnSidewalk: true,
    });
    const timedOut = (helper.beggingWalkTimer ?? 0) <= 0;
    if (arrived || timedOut) {
      helper.x = tx;
      helper.z = tz;
      helper.beggingState = 'begging_at_stall';
      helper.beggingWalkTimer = undefined;
      const look = getStallLookTargetForDrink(helper.beggingDrink ?? 'tea', world);
      helper.yaw = Math.atan2(look.x - helper.x, look.z - helper.z);
    }
    return;
  }

  if (state === 'begging_at_stall') {
    const look = getStallLookTargetForDrink(helper.beggingDrink ?? 'tea', world);
    helper.yaw = Math.atan2(look.x - helper.x, look.z - helper.z);
    const rate = activeHelperLabel ? 0.25 : 1.0;
    helper.patience = Math.max(0, (helper.patience ?? BEGGAR_KID_WAIT_SECONDS) - dt * rate);
    helper.statusNote = activeHelperLabel
      ? `Held by ${activeHelperLabel}`
      : 'Hungry · Help Free!';
    if (helper.patience <= 0) {
      helper.beggingState = 'returning_marketing';
      helper.marketingTimer = 0;
      helper.beggingDrink = null;
      helper.beggingWalkTimer = 15;
      helper.statusNote = 'Returning to Corner';
      events.feedbackText = `${cfg.name} returned politely to their corner`;
      events.feedbackColor = '#D6C7B5';
    }
    return;
  }

  if (state === 'eating_free') {
    helper.actionTimer = Math.max(0, helper.actionTimer - dt);
    if (helper.actionTimer <= 0) {
      helper.beggingState = 'returning_marketing';
      helper.marketingTimer = MARKETING_DURATION;
      helper.marketingCallTimer = 6;
      helper.beggingDrink = null;
      helper.beggingWalkTimer = 15;
      helper.statusNote = 'Going to Market Stall!';
    }
    return;
  }

  if (state === 'returning_marketing') {
    helper.beggingWalkTimer = Math.max(0, (helper.beggingWalkTimer ?? 15) - dt);
    const arrived = moveNpcWithAvoidance(
      helper,
      cfg.sitPos.x,
      cfg.sitPos.z,
      2.2,
      dt,
      world,
      shift,
      {
        biasSign: hBias,
        selfId: `helper_${hId}`,
        stayOnSidewalk: true,
      }
    );
    const timedOut = (helper.beggingWalkTimer ?? 0) <= 0;
    if (arrived || timedOut) {
      helper.x = cfg.sitPos.x;
      helper.z = cfg.sitPos.z;
      helper.yaw = 0;
      helper.beggingWalkTimer = undefined;
      if ((helper.marketingTimer ?? 0) > 0) {
        helper.beggingState = 'marketing';
        helper.statusNote = 'Promoting Your Readi! (+Sales)';
      } else {
        helper.beggingState = 'at_mat';
        helper.hungerTimer = 46 + Math.random() * 24;
        helper.statusNote = '';
      }
    }
    return;
  }

  if (state === 'marketing') {
    helper.x = cfg.sitPos.x;
    helper.z = cfg.sitPos.z;
    helper.yaw = 0;
    helper.marketingTimer = Math.max(0, (helper.marketingTimer ?? 0) - dt);
    helper.marketingCallTimer = (helper.marketingCallTimer ?? 7) - dt;
    if (helper.marketingCallTimer <= 0) {
      shift.spawnTimer = Math.min(shift.spawnTimer, 1.8);
      helper.marketingCallTimer = 7.5 + Math.random() * 3.5;
    }
    if ((helper.marketingTimer ?? 0) <= 0) {
      helper.beggingState = 'at_mat';
      helper.hungerTimer = 48 + Math.random() * 24;
      helper.statusNote = '';
    }
  }
}

export function stepStage1Simulation(
  shift: ShiftSnapshot,
  world: WorldSave,
  input: Stage1Input,
  rawDt: number,
  input2?: Stage1Input
): SimStepEvents {
  const dt = Math.min(rawDt, 0.05);
  const events: SimStepEvents = {
    sounds: [],
    openSupermarket: false,
    openMilkmanShop: false,
    openHelperModal: false,
    openHelperId: null,
    openGearBuyer: false,
    openWoodMaster: false,
    openBank: false,
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

    // Evict overdue rented shops after 1 grace day. Owner sells furniture at -50% to second-hand buyer.
    const evictedShopIds: string[] = [];
    let evictionPayoutTotal = 0;
    for (const rec of [...world.rentedShops]) {
      if (world.day <= rec.nextRentDueDay) continue;
      const cfg = RENTABLE_BUILDINGS.find((b) => b.id === rec.buildingId);
      if (!cfg) continue;
      const b = cfg.bounds;
      const inside = (x: number, z: number) =>
        x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

      const furnitureInside = (world.furniture ?? []).filter((f) => inside(f.x, f.z));
      const chairsInside = furnitureInside.filter((f) => f.kind === 'chair');
      const tablesInside = furnitureInside.filter((f) => f.kind === 'table');
      const chairRefund = chairsInside.length * Math.floor(CHAIR_PRICE_CENTS * RESALE_RATE);
      const tableRefund = tablesInside.length * Math.floor(TABLE_PRICE_CENTS * RESALE_RATE);
      const kitchenRefund = (world.shopKitchens ?? []).includes(rec.buildingId)
        ? Math.floor(SHOP_KITCHEN_PRICE_CENTS * RESALE_RATE)
        : 0;
      const payout = chairRefund + tableRefund + kitchenRefund;

      world.furniture = (world.furniture ?? []).filter((f) => !inside(f.x, f.z));
      world.shopKitchens = (world.shopKitchens ?? []).filter((id) => id !== rec.buildingId);
      world.rentedShops = world.rentedShops.filter((r) => r.buildingId !== rec.buildingId);

      if (payout > 0) {
        world.cashCents += payout;
        evictionPayoutTotal += payout;
      }
      evictedShopIds.push(cfg.shopName);
      events.sounds.push('buy');
    }
    if (evictedShopIds.length > 0) {
      events.feedbackText =
        evictionPayoutTotal > 0
          ? `${evictedShopIds.join(', ')} vacated: items sold at -50% for ${formatMoney(evictionPayoutTotal)}.`
          : `${evictedShopIds.join(', ')} vacated by owner.`;
      events.feedbackColor = '#FCA5A5';
    }

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
      events.feedbackText = evictionPayoutTotal > 0
        ? `${events.feedbackText} Rent bonus +${formatMoney(shopBonusTotal)}.`
        : `Rented Shops Daily Profit: +${formatMoney(shopBonusTotal)}!`;
      events.feedbackColor = evictionPayoutTotal > 0 ? '#FBBF24' : '#86EFAC';
    }

    world.lastDayRevenueCents = Math.max(0, shift.earningsCents);

    const loan = world.activeLoan;
    if (loan && loan.status === 'active') {
      loan.daysRemaining = Math.max(0, loan.daysRemaining - 1);
      if (loan.daysRemaining <= 0 && loan.remainingDueCents > 0) {
        const pay = Math.min(world.cashCents, loan.remainingDueCents);
        if (pay > 0) {
          world.cashCents -= pay;
          loan.remainingDueCents -= pay;
        }
        if (loan.remainingDueCents <= 0) {
          loan.status = 'repaid';
          loan.remainingDueCents = 0;
          events.feedbackText = `Bank Loan fully repaid (${formatMoney(pay)} deducted).`;
          events.feedbackColor = '#86EFAC';
        } else {
          loan.status = 'defaulted';
          events.feedbackText = `Loan default! ${formatMoney(pay)} deducted, ${formatMoney(loan.remainingDueCents)} still unpaid.`;
          events.feedbackColor = '#FCA5A5';
        }
      } else if (loan.remainingDueCents <= 0) {
        loan.status = 'repaid';
        loan.remainingDueCents = 0;
        events.feedbackText = 'Bank Loan already repaid. Good standing!';
        events.feedbackColor = '#86EFAC';
      } else {
        events.feedbackText = `Bank Loan due in ${loan.daysRemaining} day(s): ${formatMoney(loan.remainingDueCents)} remaining.`;
        events.feedbackColor = '#FDE68A';
      }
    }
    return events;
  }

  // 2. Player 1 & Optional Co-Op Partner (Player 2) Movement, Sitting & Dash
  const movePlayerActor = (p: Player3DState, pInput: Stage1Input) => {
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);

    let mx = pInput.dx;
    let mz = pInput.dz;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }

    if (p.sittingChairId) {
      const chair = world.furniture.find((f) => f.id === p.sittingChairId);
      if (!chair) {
        p.sittingChairId = null;
      } else if (mag > 0.1 || pInput.interactJustPressed) {
        p.sittingChairId = null;
        p.isMoving = false;
        events.sounds.push('pickup');
        if (pInput.interactJustPressed) {
          return { stoodUpThisFrame: true };
        }
      } else {
        p.x = chair.x;
        p.z = chair.z;
        p.yaw = getFacingAngleForSeat(chair, world.furniture);
        p.isMoving = false;
      }
    }

    if (!p.sittingChairId) {
      if (pInput.dashJustPressed && p.dashCooldown <= 0) {
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

      // ALL Street Buildings + Supermarket + Wood Master open walk-in collisions (sides & backsides are FREE!)
      resolveAllBuildingCollisions(p, 0.34, world);

      // Solid collision with 4-Wheel Chai Readi (only when owned)
      if (world.hasTeaStall !== false) {
        resolveCollisionBox(
          p,
          CYCLE_ANCHOR.x - 3.7,
          CYCLE_ANCHOR.x + 3.7,
          CYCLE_ANCHOR.z - 0.82,
          CYCLE_ANCHOR.z + 0.82,
          0.4
        );
      }

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

      // Solid collision with 3rd Cold Readi (or small reserved plot sign)
      if (world.hasColdCart) {
        resolveCollisionBox(
          p,
          COLD_CART_ANCHOR.x - 2.4,
          COLD_CART_ANCHOR.x + 2.4,
          COLD_CART_ANCHOR.z - 0.82,
          COLD_CART_ANCHOR.z + 0.82,
          0.4
        );
      } else {
        resolveCollisionBox(
          p,
          COLD_CART_ANCHOR.x - 0.35,
          COLD_CART_ANCHOR.x + 0.35,
          COLD_CART_ANCHOR.z - 0.25,
          COLD_CART_ANCHOR.z + 0.25,
          0.3
        );
      }

      // Solid collision with Water Tap, Trash Bin & Sitting Kids (when at corner mat or marketing)
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
      for (const h of getShiftHelpers(shift)) {
        const atCornerMat =
          h.status === 'sitting' &&
          (!h.beggingState || h.beggingState === 'at_mat' || h.beggingState === 'marketing');
        if (atCornerMat) {
          resolveCollisionCircle(p, h.x, h.z, 0.56);
        }
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

    return { stoodUpThisFrame: false };
  };

  const p1MoveRes = movePlayerActor(shift.player, input);
  let p2MoveRes = { stoodUpThisFrame: false };
  const p2Active = Boolean(shift.player2?.active && input2);
  if (p2Active && shift.player2 && input2) {
    p2MoveRes = movePlayerActor(shift.player2, input2);
    if (!shift.player.sittingChairId && !shift.player2.sittingChairId) {
      resolveCollisionCircle(
        shift.player2,
        shift.player.x,
        shift.player.z,
        0.62
      );
      resolveAllBuildingCollisions(shift.player2, 0.34, world);
    }
  }

  // 3. Kettle Boiling, 2nd Readi Kadhai Frying & Wood Master Build Timers
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

  if (shift.chiller?.status === 'chilling') {
    shift.chiller.progress += dt / CHILLING_DURATION;
    if (shift.chiller.progress >= 1) {
      shift.chiller.progress = 1;
      shift.chiller.status = 'ready';
      events.sounds.push('boil_done');
      const cName = shift.chiller.chillingItem
        ? (DRINK_CATALOG[shift.chiller.chillingItem] ?? DRINK_CATALOG.cold_drink).name
        : 'Cold Drink';
      events.feedbackText = `Ice-Cold ${cName} Chilled & Ready!`;
      events.feedbackColor = '#7DD3FC';
    }
  }

  if (world.woodOrders && world.woodOrders.length > 0) {
    let anyChanged = false;
    const updatedOrders = world.woodOrders.map((order) => {
      if (order.status !== 'building') return order;
      anyChanged = true;
      const nextRem = Math.max(0, order.remainingSec - dt);
      if (nextRem <= 0) {
        events.sounds.push('level_up');
        events.feedbackText = `Wood Master Ready! "${order.label}" ban chuka hai — visit Ustad Karim to receive!`;
        events.feedbackColor = '#86EFAC';
        return {
          ...order,
          remainingSec: 0,
          status: 'ready' as const,
          notified: true,
        };
      }
      return { ...order, remainingSec: nextRem };
    });
    if (anyChanged) {
      world.woodOrders = updatedOrders;
    }
  }

  // 4 & 5. Actor Secondary ([F]/[.] Pick Up Furniture or Customer Alt/Reject) & Primary ([E]/[Enter|/]) Interactions
  const handleActorActions = (
    p: Player3DState,
    pInput: Stage1Input,
    stoodUpThisFrame: boolean,
    actorLabel: string,
    actorId: 'p1' | 'p2'
  ) => {
    if (stoodUpThisFrame) return;

    if (pInput.offerRejectJustPressed && !p.sittingChairId) {
      if (p.holding === null) {
        const nearFurn = findNearestUnoccupiedFurniture(p, shift, world);
        if (nearFurn) {
          world.furniture = world.furniture.filter((f) => f.id !== nearFurn.id);
          p.holding =
            nearFurn.kind === 'chair' ? 'carried_chair' : 'carried_table';
          events.sounds.push('pickup');
          events.feedbackText = `${actorLabel}picked up ${nearFurn.kind === 'chair' ? 'Chair' : 'Table'} — place with Interact!`;
          events.feedbackColor = '#FDE68A';
          return;
        }
      }

      const custAction = findNearestCustomerForAction(shift, p);
      if (custAction) {
        events.openCustomerAction = { ...custAction, actorId };
        return;
      }
    }

    if (!pInput.interactJustPressed) return;
    const target = findInteractTargetForPlayer(p, shift, world);
    if (!target) return;

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
          events.feedbackText = `${actorLabel}${furnKind === 'chair' ? 'Chair' : 'Table'} Placed!`;
          events.feedbackColor = '#86EFAC';
        } else {
          events.sounds.push('error');
          events.feedbackText =
            'Move to open sidewalk, backside, or empty floor inside a rented shop to place it!';
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
        events.feedbackText = `${actorLabel}sitting on Chair (Move or Interact to stand)`;
        events.feedbackColor = '#FDE68A';
      }
    } else if (target.kind === 'furniture_table' && target.furnitureId) {
      if (p.holding === null) {
        world.furniture = world.furniture.filter(
          (f) => f.id !== target.furnitureId
        );
        p.holding = 'carried_table';
        events.sounds.push('pickup');
        events.feedbackText = `${actorLabel}picked up Table — walk & press Interact to place!`;
        events.feedbackColor = '#FDE68A';
      }
    } else if (target.kind === 'helper_kid') {
      events.openHelperModal = true;
      events.openHelperId = target.helperId ?? 'chotu';
    } else if (target.kind === 'building_owner' && target.buildingId) {
      events.openBuildingOwnerId = target.buildingId;
    } else if (target.kind === 'gear_buyer') {
      events.openGearBuyer = true;
      events.openModalActor = actorId;
    } else if (target.kind === 'wood_master') {
      events.openWoodMaster = true;
      events.openModalActor = actorId;
    } else if (target.kind === 'bank') {
      events.openBank = true;
      events.openModalActor = actorId;
    } else if (target.kind === 'buy_snacks_cart') {
      const existingOrder = (world.woodOrders ?? []).find(
        (o) => o.kind === 'snacks_cart'
      );
      if (existingOrder?.status === 'ready') {
        events.sounds.push('level_up');
        events.feedbackText =
          '2nd Snacks Readi is READY! Visit Wood Master Workshop (right side) to receive it!';
        events.feedbackColor = '#86EFAC';
      } else if (existingOrder?.status === 'building') {
        events.sounds.push('pickup');
        events.feedbackText = `Ustad Karim is building your 2nd Snacks Readi (${Math.ceil(existingOrder.remainingSec)}s left)!`;
        events.feedbackColor = '#FDE68A';
      } else {
        const hasSnacksRecipe =
          world.unlockedRecipes.includes('samosa') ||
          world.unlockedRecipes.includes('pakora');
        events.sounds.push(hasSnacksRecipe ? 'pickup' : 'error');
        events.feedbackText = hasSnacksRecipe
          ? `Order 2nd Snacks Readi (${formatMoney(SNACKS_CART_PRICE_CENTS)} · 3m build) at Wood Master Workshop on the right!`
          : 'Buy Samosa & Pakora Recipe inside Supermarket ($3.50), then order 2nd Readi at Wood Master!';
        events.feedbackColor = hasSnacksRecipe ? '#FDE68A' : '#FCA5A5';
      }
    } else if (target.kind === 'buy_cold_cart') {
      const existingCold = (world.woodOrders ?? []).find(
        (o) => o.kind === 'cold_cart'
      );
      if (existingCold?.status === 'ready') {
        events.sounds.push('level_up');
        events.feedbackText =
          '3rd Cold Readi is READY! Visit Wood Master Workshop (right side) to receive it!';
        events.feedbackColor = '#86EFAC';
      } else if (existingCold?.status === 'building') {
        events.sounds.push('pickup');
        events.feedbackText = `Ustad Karim is building your 3rd Cold Readi (${Math.ceil(existingCold.remainingSec)}s left)!`;
        events.feedbackColor = '#FDE68A';
      } else {
        const hasColdRecipe =
          world.unlockedRecipes.includes('cold_drink') ||
          world.unlockedRecipes.includes('ice_cream');
        events.sounds.push(hasColdRecipe ? 'pickup' : 'error');
        events.feedbackText = hasColdRecipe
          ? `Order 3rd Cold Readi (${formatMoney(COLD_CART_PRICE_CENTS)} · 2.5m build) at Wood Master Workshop on the right!`
          : 'Buy Cold Drinks & Ice Cream Recipe inside Supermarket ($4.00), then order 3rd Readi at Wood Master!';
        events.feedbackColor = hasColdRecipe ? '#7DD3FC' : '#FCA5A5';
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
        events.feedbackText = `${actorLabel}picked up ${nextKind === 'chair' ? 'Chair' : 'Table'}! Place with Interact`;
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
        events.feedbackText = `${actorLabel}refilled +${added} Free Water (${shift.inventory.water}/${MAX_WATER_CAPACITY})`;
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
          events.feedbackText = `${actorLabel}placed ${HELD_ITEM_LABELS[placed]} on Readi Space`;
          events.feedbackColor = '#FDE68A';
        }
      } else if (p.holding === null && slotItem !== null) {
        p.holding = slotItem;
        trays[idx] = null;
        shift.trayItems = trays;
        shift.trayItem = trays[0] ?? null;
        events.sounds.push('pickup');
        events.feedbackText = `${actorLabel}picked up ${HELD_ITEM_LABELS[p.holding]}`;
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
          events.feedbackText = `${actorLabel}placed ${HELD_ITEM_LABELS[placed]} in Showcase`;
          events.feedbackColor = '#FDE68A';
        }
      } else if (p.holding === null && slotItem !== null) {
        p.holding = slotItem;
        sTrays[idx] = null;
        shift.snackTrayItems = sTrays;
        events.sounds.push('pickup');
        events.feedbackText = `${actorLabel}picked up ${HELD_ITEM_LABELS[p.holding]}`;
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
        events.feedbackText = `${actorLabel}took Serving Paper Plate`;
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
        events.feedbackText = `${actorLabel}prepared Raw Aloo Samosa (${shift.inventory.samosaMix} left)`;
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
        events.feedbackText = `${actorLabel}scooped Raw Pakora Batter (${shift.inventory.pakoraMix} left)`;
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
          events.feedbackText = `${actorLabel}frying ${(DRINK_CATALOG[heldRaw] ?? DRINK_CATALOG.samosa).name}...`;
          events.feedbackColor = '#FDBA74';
        }
      } else if (shift.fryer.status === 'ready' && shift.fryer.fryingSnack) {
        if (p.holding === null) {
          p.holding = drinkToHotItem(shift.fryer.fryingSnack);
          const sName = (
            DRINK_CATALOG[shift.fryer.fryingSnack] ?? DRINK_CATALOG.samosa
          ).name;
          shift.fryer.status = 'idle';
          shift.fryer.progress = 0;
          shift.fryer.fryingSnack = null;
          events.sounds.push('pickup');
          events.feedbackText = `${actorLabel}took Hot ${sName}!`;
          events.feedbackColor = '#FBBF24';
        } else if (heldRaw && shift.inventory.cookingOil > 0) {
          const readyItem = drinkToHotItem(shift.fryer.fryingSnack);
          const readyName = (
            DRINK_CATALOG[shift.fryer.fryingSnack] ?? DRINK_CATALOG.samosa
          ).name;
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
    } else if (target.kind === 'cold_tray') {
      const cTrays = shift.coldTrayItems ?? [null, null];
      const idx = target.trayIndex ?? 0;
      const slotItem = cTrays[idx] ?? null;
      if (p.holding !== null && slotItem === null) {
        if (isSwappableCounterItem(p.holding)) {
          const placed = p.holding;
          cTrays[idx] = placed;
          shift.coldTrayItems = cTrays;
          p.holding = null;
          events.sounds.push('pickup');
          events.feedbackText = `${actorLabel}placed ${HELD_ITEM_LABELS[placed]} in Chilled Showcase`;
          events.feedbackColor = '#7DD3FC';
        }
      } else if (p.holding === null && slotItem !== null) {
        p.holding = slotItem;
        cTrays[idx] = null;
        shift.coldTrayItems = cTrays;
        events.sounds.push('pickup');
        events.feedbackText = `${actorLabel}picked up ${HELD_ITEM_LABELS[p.holding]}`;
        events.feedbackColor = '#7DD3FC';
      } else if (
        p.holding !== null &&
        slotItem !== null &&
        isSwappableCounterItem(p.holding)
      ) {
        const prevHeld = p.holding;
        p.holding = slotItem;
        cTrays[idx] = prevHeld;
        shift.coldTrayItems = cTrays;
        events.sounds.push('pickup');
        events.feedbackText = `Swapped ${HELD_ITEM_LABELS[prevHeld]} <-> ${HELD_ITEM_LABELS[p.holding]}!`;
        events.feedbackColor = '#86EFAC';
      }
    } else if (target.kind === 'soda_crate') {
      if (p.holding !== null) {
        events.sounds.push('error');
        events.feedbackText = 'Empty hands first to take Cold Drink Bottle!';
        events.feedbackColor = '#FCA5A5';
      } else if ((shift.inventory.coldDrinkBottles ?? 0) <= 0) {
        events.sounds.push('error');
        events.feedbackText = 'Out of Cold Drink Bottles! Buy inside Supermarket';
        events.feedbackColor = '#FCA5A5';
      } else {
        shift.inventory.coldDrinkBottles -= 1;
        p.holding = 'cold_bottle';
        events.sounds.push('pickup');
        events.feedbackText = `${actorLabel}took Cold Drink Bottle (${shift.inventory.coldDrinkBottles} left)`;
        events.feedbackColor = '#7DD3FC';
      }
    } else if (target.kind === 'cone_stack') {
      if (p.holding !== null) {
        events.sounds.push('error');
        events.feedbackText = 'Empty hands first to grab Waffle Cone!';
        events.feedbackColor = '#FCA5A5';
      } else if ((shift.inventory.iceCreamCones ?? 0) <= 0) {
        events.sounds.push('error');
        events.feedbackText = 'Out of Waffle Cones! Buy inside Supermarket';
        events.feedbackColor = '#FCA5A5';
      } else {
        shift.inventory.iceCreamCones -= 1;
        p.holding = 'empty_cone';
        events.sounds.push('pickup');
        events.feedbackText = `${actorLabel}took Waffle Cone (${shift.inventory.iceCreamCones} left)`;
        events.feedbackColor = '#FDE68A';
      }
    } else if (target.kind === 'icecream_tub') {
      if (p.holding !== 'empty_cone') {
        events.sounds.push('error');
        events.feedbackText = 'Take a Waffle Cone on the 3rd Readi first!';
        events.feedbackColor = '#FCA5A5';
      } else if ((shift.inventory.iceCreamMix ?? 0) <= 0) {
        events.sounds.push('error');
        events.feedbackText = 'Out of Ice Cream Mix! Buy inside Supermarket';
        events.feedbackColor = '#FCA5A5';
      } else {
        shift.inventory.iceCreamMix -= 1;
        p.holding = 'cone_with_mix';
        events.sounds.push('pickup');
        events.feedbackText = `${actorLabel}scooped Ice Cream Mix (${shift.inventory.iceCreamMix} left)`;
        events.feedbackColor = '#F9A8D4';
      }
    } else if (target.kind === 'ice_box') {
      if (p.holding !== 'cold_bottle' && p.holding !== 'cone_with_mix') {
        events.sounds.push('error');
        events.feedbackText = 'Hold a Cold Bottle or Cone + Mix first!';
        events.feedbackColor = '#FCA5A5';
      } else if ((shift.inventory.iceBlocks ?? 0) <= 0) {
        events.sounds.push('error');
        events.feedbackText = 'Out of Ice Blocks! Buy Crystal Ice Blocks inside Supermarket';
        events.feedbackColor = '#FCA5A5';
      } else {
        shift.inventory.iceBlocks -= 1;
        p.holding =
          p.holding === 'cone_with_mix'
            ? 'iced_cream_mix'
            : 'cold_bottle_iced';
        events.sounds.push('pour');
        events.feedbackText = `${actorLabel}packed Ice Block! Chill inside Ice Chiller Drum (${shift.inventory.iceBlocks} ice left)`;
        events.feedbackColor = '#7DD3FC';
      }
    } else if (target.kind === 'chiller') {
      const heldIced: 'cold_drink' | 'ice_cream' | null =
        p.holding === 'cold_bottle_iced'
          ? 'cold_drink'
          : p.holding === 'iced_cream_mix'
            ? 'ice_cream'
            : null;
      if (!shift.chiller) {
        shift.chiller = { status: 'idle', progress: 0, chillingItem: null };
      }
      if (shift.chiller.status === 'idle') {
        if (!heldIced) {
          events.sounds.push('error');
          events.feedbackText =
            'Pack Bottle or Cone with an Ice Block at the Ice Box first!';
          events.feedbackColor = '#FCA5A5';
        } else {
          p.holding = null;
          shift.chiller.status = 'chilling';
          shift.chiller.progress = 0;
          shift.chiller.chillingItem = heldIced;
          events.sounds.push('pour');
          events.feedbackText = `${actorLabel}chilling ${(DRINK_CATALOG[heldIced] ?? DRINK_CATALOG.cold_drink).name}...`;
          events.feedbackColor = '#7DD3FC';
        }
      } else if (
        shift.chiller.status === 'ready' &&
        shift.chiller.chillingItem
      ) {
        if (p.holding === null) {
          p.holding = drinkToHotItem(shift.chiller.chillingItem);
          const cName = (
            DRINK_CATALOG[shift.chiller.chillingItem] ?? DRINK_CATALOG.cold_drink
          ).name;
          shift.chiller.status = 'idle';
          shift.chiller.progress = 0;
          shift.chiller.chillingItem = null;
          events.sounds.push('pickup');
          events.feedbackText = `${actorLabel}took Chilled ${cName}!`;
          events.feedbackColor = '#7DD3FC';
        } else if (heldIced) {
          const readyItem = drinkToHotItem(shift.chiller.chillingItem);
          const readyName = (
            DRINK_CATALOG[shift.chiller.chillingItem] ?? DRINK_CATALOG.cold_drink
          ).name;
          p.holding = readyItem;
          shift.chiller.status = 'chilling';
          shift.chiller.progress = 0;
          shift.chiller.chillingItem = heldIced;
          events.sounds.push('pour');
          events.feedbackText = `Swapped! Took ${readyName} & chilling next item`;
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
        events.feedbackText = `${actorLabel}took Biscuit Pack (${shift.inventory.biscuits} left)`;
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
        events.feedbackText = `${actorLabel}took Mini Cupcake (${shift.inventory.cupcakes} left)`;
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
        events.feedbackText = `${actorLabel}took Cup (${shift.inventory.cups} left)`;
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
        events.feedbackText = `${actorLabel}added Tea Leaves`;
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
        events.feedbackText = `${actorLabel}added Coffee Beans`;
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
        events.feedbackText = `${actorLabel}added Sugar`;
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
        events.feedbackText = `${actorLabel}added Water (${shift.inventory.water} left)`;
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
        events.feedbackText = `${actorLabel}added Milk Packet (Ready for Kettle!)`;
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
          events.feedbackText = `${actorLabel}boiling ${(DRINK_CATALOG[heldMixDrink] ?? DRINK_CATALOG.tea).name}...`;
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
          const dName = (
            DRINK_CATALOG[shift.kettle.brewingDrink] ?? DRINK_CATALOG.tea
          ).name;
          shift.kettle.status = 'idle';
          shift.kettle.progress = 0;
          shift.kettle.brewingDrink = null;
          events.sounds.push('pickup');
          events.feedbackText = `${actorLabel}took Hot ${dName}!`;
          events.feedbackColor = '#FBBF24';
        } else if (heldMixDrink) {
          const readyItem = drinkToHotItem(shift.kettle.brewingDrink);
          const readyName = (
            DRINK_CATALOG[shift.kettle.brewingDrink] ?? DRINK_CATALOG.tea
          ).name;
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
          const boostedPrice = applySalesBoostCents(info.priceCents, shift);
          const totalPay = boostedPrice + tip;

          p.holding = null;
          cust.status = 'drinking';
          cust.drinkTimer = 4.2;
          shift.servedCount += 1;
          shift.earningsCents += totalPay;
          world.cashCents += totalPay;
          world.totalServed += 1;
          events.sounds.push('serve');
          events.feedbackText = tip
            ? `${actorLabel}+${formatMoney(boostedPrice)} + ${formatMoney(tip)} Happy Tip!`
            : `${actorLabel}+${formatMoney(boostedPrice)} ${info.name} Served!`;
          events.feedbackColor = '#FBBF24';

          maybeUnlockLevel2(world, shift, events);
        } else {
          events.openCustomerAction = {
            kind: 'customer',
            id: cust.id,
            requestedDrink: orderDrink,
            actorId,
          };
        }
      }
    } else if (target.kind === 'owner_customer') {
      const owner = shift.supermarketOwner;
      const heldDrink = heldHotDrinkType(p.holding);
      if (owner.phase === 'ordering_chai') {
        if (heldDrink && heldDrink === owner.orderDrink) {
          const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
          const tip = rollRandomTipCents();
          const boostedPrice = applySalesBoostCents(info.priceCents, shift);
          const totalPay = boostedPrice + tip;

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
            : `Mart Owner loved ${info.name}! (+${formatMoney(boostedPrice)})`;
          events.feedbackColor = '#86EFAC';

          maybeUnlockLevel2(world, shift, events);
        } else {
          events.openCustomerAction = {
            kind: 'owner_customer',
            id: 'owner_customer',
            requestedDrink: owner.orderDrink,
            actorId,
            npcLabel: 'Mart Owner',
          };
        }
      }
    } else if (target.kind === 'shop_visitor' && target.visitorId) {
      const v = getShiftShopVisitors(shift).find(
        (sv) => sv.id === target.visitorId
      );
      const heldDrink = heldHotDrinkType(p.holding);
      if (v && v.phase === 'ordering') {
        if (heldDrink && heldDrink === v.orderDrink) {
          const info = DRINK_CATALOG[v.orderDrink] ?? DRINK_CATALOG.tea;
          const tip = rollRandomTipCents();
          const boostedPrice = applySalesBoostCents(info.priceCents, shift);
          const totalPay = boostedPrice + tip;

          p.holding = null;
          v.phase = 'eating_drinking';
          v.drinkTimer = 4.2;
          shift.servedCount += 1;
          shift.earningsCents += totalPay;
          world.cashCents += totalPay;
          world.totalServed += 1;
          events.sounds.push('serve');
          events.feedbackText = tip
            ? `${v.name} Tipped +${formatMoney(tip)}! (+${formatMoney(totalPay)})`
            : `${v.name} loved ${info.name}! (+${formatMoney(boostedPrice)})`;
          events.feedbackColor = '#86EFAC';

          maybeUnlockLevel2(world, shift, events);
        } else {
          events.openCustomerAction = {
            kind: 'shop_visitor',
            id: v.id,
            requestedDrink: v.orderDrink,
            actorId,
            npcLabel: `${v.name} (${v.roleLabel})`,
          };
        }
      }
    } else if (target.kind === 'beggar_kid' && target.beggarKidId) {
      const bk = getShiftBeggarKids(shift).find(
        (k) => k.id === target.beggarKidId
      );
      const heldDrink = heldHotDrinkType(p.holding);
      if (bk && bk.status === 'waiting') {
        if (heldDrink && heldDrink === bk.orderDrink) {
          const info = DRINK_CATALOG[bk.orderDrink] ?? DRINK_CATALOG.tea;
          p.holding = null;
          bk.status = 'eating';
          bk.eatTimer = 4.0;
          bk.marketingTimer = MARKETING_DURATION;
          bk.marketingMoveTimer = 0;
          bk.marketingCallTimer = 7;
          shift.servedCount += 1;
          world.totalServed += 1;
          shift.beggarKidsHelped = (shift.beggarKidsHelped ?? 0) + 1;
          shift.salesBoostPercent = Math.min(
            BEGGAR_KID_MAX_SALES_BOOST,
            shift.beggarKidsHelped * BEGGAR_KID_SALES_BOOST_PER_HELP
          );
          shift.spawnTimer = Math.min(shift.spawnTimer, 2.2);
          events.sounds.push('level_up');
          events.feedbackText = `${actorLabel}gave free ${info.name} to Poor Kid! +${shift.salesBoostPercent}% Sales & Kid will market your stall!`;
          events.feedbackColor = '#86EFAC';

          maybeUnlockLevel2(world, shift, events);
        } else {
          events.openCustomerAction = {
            kind: 'beggar_kid',
            id: bk.id,
            requestedDrink: bk.orderDrink,
            actorId,
            npcLabel: 'Poor Kid (Free Meal)',
            isFreeHelp: true,
          };
        }
      }
    } else if (target.kind === 'beggar_helper' && target.helperId) {
      const hh = getShiftHelpers(shift).find((k) => k.id === target.helperId);
      const heldDrink = heldHotDrinkType(p.holding);
      if (hh && hh.status === 'sitting' && hh.beggingState === 'begging_at_stall') {
        const reqDrink = hh.beggingDrink ?? 'tea';
        const cfg = HELPER_NPCS[target.helperId];
        if (heldDrink && heldDrink === reqDrink) {
          const info = DRINK_CATALOG[reqDrink] ?? DRINK_CATALOG.tea;
          p.holding = null;
          hh.beggingState = 'eating_free';
          hh.actionTimer = 4.0;
          hh.marketingTimer = MARKETING_DURATION;
          hh.statusNote = `Eating ${info.name}`;
          shift.servedCount += 1;
          world.totalServed += 1;
          shift.beggarKidsHelped = (shift.beggarKidsHelped ?? 0) + 1;
          shift.salesBoostPercent = Math.min(
            BEGGAR_KID_MAX_SALES_BOOST,
            shift.beggarKidsHelped * BEGGAR_KID_SALES_BOOST_PER_HELP
          );
          shift.spawnTimer = Math.min(shift.spawnTimer, 2.2);
          events.sounds.push('level_up');
          events.feedbackText = `${actorLabel}fed ${cfg.name} free ${info.name}! +${shift.salesBoostPercent}% Sales & Corner Marketing!`;
          events.feedbackColor = '#86EFAC';
          maybeUnlockLevel2(world, shift, events);
        } else {
          events.openCustomerAction = {
            kind: 'beggar_helper',
            id: target.helperId,
            requestedDrink: reqDrink,
            actorId,
            npcLabel: `${cfg.name} (Hungry Beggar · Free Meal)`,
            isFreeHelp: true,
          };
        }
      }
    } else if (target.kind === 'car') {
      const car = shift.carCustomer;
      const heldDrink = heldHotDrinkType(p.holding);
      if (car.phase === 'waiting') {
        const orderDrink = car.orderDrink || 'tea';
        if (heldDrink && heldDrink === orderDrink) {
          const info = DRINK_CATALOG[orderDrink] ?? DRINK_CATALOG.tea;
          const tip = rollRandomTipCents();
          const boostedPrice = applySalesBoostCents(info.priceCents, shift);
          const totalPay = boostedPrice + tip;
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
              ? `Car Complete! +${formatMoney(boostedPrice)} + ${formatMoney(tip)} Tip!`
              : `Car Order Complete! +${formatMoney(boostedPrice)}`;
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
            actorId,
          };
        }
      }
    } else if (target.kind === 'trash' && p.holding) {
      p.holding = null;
      events.sounds.push('pickup');
      events.feedbackText = `${actorLabel}discarded item at Trash Bin`;
      events.feedbackColor = '#D6C7B5';
    }
  };

  handleActorActions(
    shift.player,
    input,
    p1MoveRes.stoodUpThisFrame,
    p2Active ? 'P1 ' : '',
    'p1'
  );
  if (p2Active && shift.player2 && input2) {
    handleActorActions(
      shift.player2,
      input2,
      p2MoveRes.stoodUpThisFrame,
      'P2 ',
      'p2'
    );
  }

  const elapsed = shift.shiftDuration - shift.timeLeft;

  // 6. Milkman on Motorcycle Schedule
  const mk = shift.milkman;
  if (world.stage >= 2) {
    if (mk.phase === 'away') {
      if (elapsed >= mk.nextArrivalElapsed) {
        mk.phase = 'arriving';
        mk.x = -30;
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
      if (mk.x >= WORLD_BOUNDS.maxX - 0.8) {
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
      car.x = WORLD_BOUNDS.maxX - 0.8;
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
    if (car.x <= -30) {
      car.phase = 'away';
      car.nextArrivalElapsed = elapsed + 38 + Math.random() * 45;
    }
  }

  // 8. Sidewalk Customer Spawning (Rented shops & Helped Beggar Kids boost customer flow!)
  shift.spawnTimer -= dt;
  if (shift.spawnTimer <= 0) {
    spawnCustomerWave(shift, world);
    const rentBoost = Math.min(0.35, world.rentedShops.length * 0.12);
    const beggarBoost = Math.min(0.45, (shift.beggarKidsHelped ?? 0) * 0.12);
    const totalFlowBoost = Math.min(0.65, rentBoost + beggarBoost);
    shift.spawnTimer = randomSpawnInterval() * (1 - totalFlowBoost);
  }

  // 9. Update Walk-up & Seated Customers + AUTO-PICKUP FROM READI COUNTER!
  const trays = shift.trayItems ?? [shift.trayItem ?? null, null, null, null];
  const snackTrays = shift.snackTrayItems ?? [null, null];
  const coldTrays = shift.coldTrayItems ?? [null, null];
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
          const isCold = c.orderDrink === 'cold_drink' || c.orderDrink === 'ice_cream';
          const fallbackPool = isFried
            ? SNACK_CUSTOMER_SLOTS
            : isCold
              ? COLD_CUSTOMER_SLOTS
              : CUSTOMER_SLOTS;
          const fallbackSlot = fallbackPool[c.slotIndex % fallbackPool.length];
          c.targetX = fallbackSlot.x;
          c.targetZ = fallbackSlot.z;
        }
      }

      if (targetChair) {
        const approach = findChairApproachSpot(targetChair, world, shift);
        const chairInShop = isInsideAnyRentedShop(
          targetChair.x,
          targetChair.z,
          world
        );
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
            stayOnSidewalk: !(chairInShop || c.z < -4.9),
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
      // Self-serve auto-pickup from Readi Free Spaces / Snacks / Chilled Showcase!
      if (!c.seatedChairId) {
        c.selfServeWait = (c.selfServeWait ?? 0) + dt;
        if (c.selfServeWait >= 0.45) {
          const wantedItem = drinkToHotItem(c.orderDrink);
          const isSnackItem =
            c.orderDrink === 'samosa' || c.orderDrink === 'pakora';
          const isColdItem =
            c.orderDrink === 'cold_drink' || c.orderDrink === 'ice_cream';
          let pickedFromTray = false;

          if (isSnackItem) {
            const sIdx = snackTrays.findIndex((it) => it === wantedItem);
            if (sIdx >= 0) {
              snackTrays[sIdx] = null;
              shift.snackTrayItems = snackTrays;
              pickedFromTray = true;
            }
          }
          if (!pickedFromTray && isColdItem) {
            const cIdx = coldTrays.findIndex((it) => it === wantedItem);
            if (cIdx >= 0) {
              coldTrays[cIdx] = null;
              shift.coldTrayItems = coldTrays;
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
            const boostedPrice = applySalesBoostCents(info.priceCents, shift);
            const totalPay = boostedPrice + tip;
            c.status = 'drinking';
            c.drinkTimer = 4.2;
            shift.servedCount += 1;
            shift.earningsCents += totalPay;
            world.cashCents += totalPay;
            world.totalServed += 1;
            events.sounds.push('serve');
            events.feedbackText = tip
              ? `Customer grabbed ${info.name} from Readi! +${formatMoney(totalPay)} (incl. tip)`
              : `Customer picked up ${info.name} from Readi & paid +${formatMoney(boostedPrice)}!`;
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
      const exitX =
        c.seq % 2 === 0 ? WORLD_BOUNDS.minX + 0.6 : WORLD_BOUNDS.maxX - 0.9;
      const exitZ = c.targetZ < CYCLE_ANCHOR.z ? -3.35 : 1.02;
      const arrived = moveNpcWithAvoidance(c, exitX, exitZ, 2.55, dt, world, shift, {
        biasSign,
        selfId: c.id,
        stayOnSidewalk: c.z > -4.9,
      });
      if (
        !arrived &&
        c.x > WORLD_BOUNDS.minX + 0.8 &&
        c.x < WORLD_BOUNDS.maxX - 1.1
      ) {
        nextCustomers.push(c);
      }
    }
  }
  shift.customers = nextCustomers;

  // 10. Supermarket Owner NPC Patrol & Full-Menu Purchase Visit (+ Auto-Pickup from Free Space!)
  const owner = shift.supermarketOwner;
  const firstKitchenForOwner = getFirstKitchenBuilding(world);
  const isOwnerSnackOrder =
    world.hasSnacksCart &&
    (owner.orderDrink === 'samosa' || owner.orderDrink === 'pakora');
  const isOwnerColdOrder =
    world.hasColdCart &&
    (owner.orderDrink === 'cold_drink' || owner.orderDrink === 'ice_cream');
  const ownerOrderSpot = isOwnerSnackOrder
    ? { x: SNACKS_CART_ANCHOR.x + 1.85, z: 0.94 }
    : isOwnerColdOrder
      ? { x: COLD_CART_ANCHOR.x + 1.45, z: 0.94 }
      : world.hasTeaStall === false && firstKitchenForOwner
        ? {
            x: (firstKitchenForOwner.doorMinX + firstKitchenForOwner.doorMaxX) / 2,
            z: -3.55,
          }
        : OWNER_STALL_SPOT;
  const ownerLookTarget = getStallLookTargetForDrink(owner.orderDrink, world);
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
      const ownerChoices = getAvailableMenuChoices(world, shift);
      owner.orderDrink =
        ownerChoices.length > 0
          ? ownerChoices[Math.floor(Math.random() * ownerChoices.length)]
          : 'tea';
      const nextIsSnack =
        world.hasSnacksCart &&
        (owner.orderDrink === 'samosa' || owner.orderDrink === 'pakora');
      const nextIsCold =
        world.hasColdCart &&
        (owner.orderDrink === 'cold_drink' || owner.orderDrink === 'ice_cream');
      const nextSpot = nextIsSnack
        ? { x: SNACKS_CART_ANCHOR.x + 1.85, z: 0.94 }
        : nextIsCold
          ? { x: COLD_CART_ANCHOR.x + 1.45, z: 0.94 }
          : world.hasTeaStall === false && firstKitchenForOwner
            ? {
                x:
                  (firstKitchenForOwner.doorMinX +
                    firstKitchenForOwner.doorMaxX) /
                  2,
                z: -3.55,
              }
            : OWNER_STALL_SPOT;
      owner.phase = 'walking_to_stall';
      owner.targetX = nextSpot.x;
      owner.targetZ = nextSpot.z;
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
    const arrived = moveOwnerToward(ownerOrderSpot.x, ownerOrderSpot.z, 2.2);
    if (arrived) {
      owner.phase = 'ordering_chai';
      owner.yaw = Math.atan2(
        ownerLookTarget.x - owner.x,
        ownerLookTarget.z - owner.z
      );
      events.feedbackText = `Mart Owner came over for ${(DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea).name}!`;
      events.feedbackColor = '#86EFAC';
    }
  } else if (owner.phase === 'ordering_chai') {
    owner.yaw = Math.atan2(
      ownerLookTarget.x - owner.x,
      ownerLookTarget.z - owner.z
    );
    if (owner.patience <= owner.maxPatience - 0.55) {
      const wantedOwnerItem = drinkToHotItem(owner.orderDrink);
      let picked = false;
      if (isOwnerSnackOrder) {
        const sIdx = snackTrays.findIndex((it) => it === wantedOwnerItem);
        if (sIdx >= 0) {
          snackTrays[sIdx] = null;
          shift.snackTrayItems = snackTrays;
          picked = true;
        }
      }
      if (!picked && isOwnerColdOrder) {
        const cIdx = coldTrays.findIndex((it) => it === wantedOwnerItem);
        if (cIdx >= 0) {
          coldTrays[cIdx] = null;
          shift.coldTrayItems = coldTrays;
          picked = true;
        }
      }
      if (!picked) {
        const tIdx = trays.findIndex((it) => it === wantedOwnerItem);
        if (tIdx >= 0) {
          trays[tIdx] = null;
          shift.trayItems = trays;
          shift.trayItem = trays[0] ?? null;
          picked = true;
        }
      }
      if (picked) {
        const info = DRINK_CATALOG[owner.orderDrink] ?? DRINK_CATALOG.tea;
        const tip = rollRandomTipCents();
        const boostedPrice = applySalesBoostCents(info.priceCents, shift);
        const totalPay = boostedPrice + tip;
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

  // 10a. Shop Owners, Gear Buyer & Wood Master Purchase Visits
  const visitors = getShiftShopVisitors(shift);
  const hasReadyWoodOrder = (world.woodOrders ?? []).some(
    (o) => o.status === 'ready'
  );
  const occupiedVisitorSpots = new Set(
    visitors
      .filter((v) => v.phase !== 'at_shop' && v.phase !== 'returning_to_shop')
      .map((v) => `${v.targetX.toFixed(1)}_${v.targetZ.toFixed(1)}`)
  );
  let activeVisitorsOut = visitors.filter((v) => v.phase !== 'at_shop').length;

  for (let vIdx = 0; vIdx < visitors.length; vIdx++) {
    const v = visitors[vIdx];
    const vBias: 1 | -1 = vIdx % 2 === 0 ? -1 : 1;
    const ownerBuildingId =
      v.id === 'west_owner'
        ? 'west_shop'
        : v.id === 'center_owner'
          ? 'center_shop'
          : v.id === 'east_owner'
            ? 'east_shop'
            : null;
    const ownerRentRec = ownerBuildingId
      ? world.rentedShops.find((r) => r.buildingId === ownerBuildingId)
      : undefined;
    const ownerAway = !!ownerRentRec && world.day < ownerRentRec.nextRentDueDay;
    if (ownerAway) {
      v.phase = 'at_shop';
      v.x = -999;
      v.z = -999;
      v.nextVisitTimer = 9999;
      continue;
    }
    const isSnackVis =
      world.hasSnacksCart &&
      (v.orderDrink === 'samosa' || v.orderDrink === 'pakora');
    const isColdVis =
      world.hasColdCart &&
      (v.orderDrink === 'cold_drink' || v.orderDrink === 'ice_cream');
    const visLookTarget = getStallLookTargetForDrink(v.orderDrink, world);

    if (v.phase === 'at_shop') {
      v.x = v.homeX;
      v.z = v.homeZ;
      v.yaw = v.homeYaw;
      v.nextVisitTimer -= dt;
      if (
        v.nextVisitTimer <= 0 &&
        activeVisitorsOut < 2 &&
        !(v.id === 'wood_master' && hasReadyWoodOrder)
      ) {
        const menuChoices = getAvailableMenuChoices(world, shift);
        v.orderDrink =
          menuChoices.length > 0
            ? menuChoices[Math.floor(Math.random() * menuChoices.length)]
            : 'tea';
        const wantSnack =
          world.hasSnacksCart &&
          (v.orderDrink === 'samosa' || v.orderDrink === 'pakora');
        const wantCold =
          world.hasColdCart &&
          (v.orderDrink === 'cold_drink' || v.orderDrink === 'ice_cream');
        let chosenSpot: { x: number; z: number } | null = null;
        if (wantSnack) {
          const snackCandidates = [
            { x: SNACKS_CART_ANCHOR.x - 1.5, z: 0.96 },
            { x: SNACKS_CART_ANCHOR.x + 1.5, z: 0.96 },
          ];
          chosenSpot =
            snackCandidates.find(
              (s) => !occupiedVisitorSpots.has(`${s.x.toFixed(1)}_${s.z.toFixed(1)}`)
            ) ?? snackCandidates[vIdx % snackCandidates.length];
        } else if (wantCold) {
          const coldCandidates = [
            { x: COLD_CART_ANCHOR.x - 1.4, z: 0.96 },
            { x: COLD_CART_ANCHOR.x + 1.4, z: 0.96 },
          ];
          chosenSpot =
            coldCandidates.find(
              (s) => !occupiedVisitorSpots.has(`${s.x.toFixed(1)}_${s.z.toFixed(1)}`)
            ) ?? coldCandidates[vIdx % coldCandidates.length];
        } else if (world.hasTeaStall === false && firstKitchenForOwner) {
          const dx =
            (firstKitchenForOwner.doorMinX + firstKitchenForOwner.doorMaxX) /
              2 +
            (vIdx % 2 === 0 ? -0.9 : 0.9);
          chosenSpot = { x: dx, z: -3.55 };
        } else {
          chosenSpot =
            SHOP_VISITOR_SLOTS.find(
              (s) => !occupiedVisitorSpots.has(`${s.x.toFixed(1)}_${s.z.toFixed(1)}`)
            ) ?? SHOP_VISITOR_SLOTS[vIdx % SHOP_VISITOR_SLOTS.length];
        }
        v.targetX = chosenSpot.x;
        v.targetZ = chosenSpot.z;
        occupiedVisitorSpots.add(
          `${chosenSpot.x.toFixed(1)}_${chosenSpot.z.toFixed(1)}`
        );
        v.phase = 'walking_to_stall';
        v.maxPatience = 105;
        v.patience = 105;
        activeVisitorsOut += 1;
      }
    } else if (v.phase === 'walking_to_stall') {
      const arrived = moveNpcWithAvoidance(
        v,
        v.targetX,
        v.targetZ,
        2.15,
        dt,
        world,
        shift,
        {
          biasSign: vBias,
          selfId: v.id,
          stayOnSidewalk: false,
        }
      );
      if (arrived) {
        v.x = v.targetX;
        v.z = v.targetZ;
        v.phase = 'ordering';
        v.yaw = Math.atan2(visLookTarget.x - v.x, visLookTarget.z - v.z);
        const info = DRINK_CATALOG[v.orderDrink] ?? DRINK_CATALOG.tea;
        events.feedbackText = `${v.name} (${v.roleLabel}) wants to buy ${info.name}!`;
        events.feedbackColor = '#86EFAC';
      }
    } else if (v.phase === 'ordering') {
      v.yaw = Math.atan2(visLookTarget.x - v.x, visLookTarget.z - v.z);
      if (v.patience <= v.maxPatience - 0.65) {
        const wantedItem = drinkToHotItem(v.orderDrink);
        let picked = false;
        if (isSnackVis) {
          const sIdx = snackTrays.findIndex((it) => it === wantedItem);
          if (sIdx >= 0) {
            snackTrays[sIdx] = null;
            shift.snackTrayItems = snackTrays;
            picked = true;
          }
        }
        if (!picked && isColdVis) {
          const cIdx = coldTrays.findIndex((it) => it === wantedItem);
          if (cIdx >= 0) {
            coldTrays[cIdx] = null;
            shift.coldTrayItems = coldTrays;
            picked = true;
          }
        }
        if (!picked) {
          const tIdx = trays.findIndex((it) => it === wantedItem);
          if (tIdx >= 0) {
            trays[tIdx] = null;
            shift.trayItems = trays;
            shift.trayItem = trays[0] ?? null;
            picked = true;
          }
        }
        if (picked) {
          const info = DRINK_CATALOG[v.orderDrink] ?? DRINK_CATALOG.tea;
          const tip = rollRandomTipCents();
          const boostedPrice = applySalesBoostCents(info.priceCents, shift);
          const totalPay = boostedPrice + tip;
          v.phase = 'eating_drinking';
          v.drinkTimer = 4.2;
          shift.servedCount += 1;
          shift.earningsCents += totalPay;
          world.cashCents += totalPay;
          world.totalServed += 1;
          events.sounds.push('serve');
          events.feedbackText = `${v.name} picked up ${info.name} from Readi & paid +${formatMoney(totalPay)}!`;
          events.feedbackColor = '#86EFAC';
          maybeUnlockLevel2(world, shift, events);
        }
      }
      if (v.phase === 'ordering') {
        v.patience -= dt;
        if (v.patience <= 0) {
          v.phase = 'returning_to_shop';
          events.feedbackText = `${v.name} headed back to shop`;
          events.feedbackColor = '#D6C7B5';
        }
      }
    } else if (v.phase === 'eating_drinking') {
      v.drinkTimer -= dt;
      if (v.drinkTimer <= 0) {
        v.phase = 'returning_to_shop';
      }
    } else if (v.phase === 'returning_to_shop') {
      const arrived = moveNpcWithAvoidance(
        v,
        v.homeX,
        v.homeZ,
        2.25,
        dt,
        world,
        shift,
        {
          biasSign: vBias,
          selfId: v.id,
          stayOnSidewalk: false,
        }
      );
      if (arrived) {
        v.x = v.homeX;
        v.z = v.homeZ;
        v.yaw = v.homeYaw;
        v.phase = 'at_shop';
        v.nextVisitTimer = 48 + Math.random() * 40;
      }
    }
  }

  // 10b. Helper NPCs: Hired Autonomous Work + Unhired Hungry Corner Begging & Marketing!
  const allHelpers = getShiftHelpers(shift);
  const activeHiredHelper = allHelpers.find((h) => h.status === 'hired');
  const activeHelperLabel = activeHiredHelper
    ? HELPER_NPCS[activeHiredHelper.id ?? 'chotu'].name
    : null;

  for (const h of allHelpers) {
    if (h.status === 'hired') {
      stepHelperNpc(h, shift, world, dt, events);
    } else {
      stepUnhiredHelperBegging(h, shift, world, dt, events, activeHelperLabel);
    }
  }
  shift.helper = allHelpers[0];

  // 10c. Poor Beggar Kids (Free Food · 2-Min Wait Held by Helper · Sales & Street Marketing Animation!)
  if (typeof shift.beggarSpawnTimer !== 'number') {
    shift.beggarSpawnTimer = 26;
  }
  if (typeof shift.beggarKidsHelped !== 'number') {
    shift.beggarKidsHelped = 0;
  }
  if (typeof shift.salesBoostPercent !== 'number') {
    shift.salesBoostPercent = 0;
  }

  // Beggar kids (free food) removed by design.
  const existingBeggars: BeggarKidCustomer[] = [];
  shift.beggarKids = [];
  shift.beggarSpawnTimer = 99999;

  const nextBeggarKids: BeggarKidCustomer[] = [];
  for (const bk of existingBeggars) {
    const bkBias: 1 | -1 = bk.seq % 2 === 0 ? 1 : -1;
    if (bk.status === 'walking_in') {
      const arrived = moveNpcWithAvoidance(
        bk,
        bk.targetX,
        bk.targetZ,
        2.1,
        dt,
        world,
        shift,
        {
          biasSign: bkBias,
          selfId: bk.id,
          stayOnSidewalk: true,
        }
      );
      if (arrived) {
        bk.x = bk.targetX;
        bk.z = bk.targetZ;
        bk.status = 'waiting';
      }
      nextBeggarKids.push(bk);
    } else if (bk.status === 'waiting') {
      bk.heldByHelperName = activeHelperLabel;
      const decayRate = activeHelperLabel ? 0.25 : 1.0;
      bk.patience -= dt * decayRate;
      if (bk.patience <= 0) {
        bk.status = 'walking_out';
        bk.targetZ = 1.08;
        bk.walkOutTimer = 12;
        events.feedbackText = 'Poor Kid waited 2m and left politely';
        events.feedbackColor = '#D6C7B5';
      }
      nextBeggarKids.push(bk);
    } else if (bk.status === 'eating') {
      bk.eatTimer -= dt;
      if (bk.eatTimer <= 0) {
        bk.status = 'marketing';
        bk.marketingTimer = MARKETING_DURATION;
        bk.marketingMoveTimer = 0;
        bk.marketingCallTimer = 6.5;
        const firstSpot =
          BEGGAR_MARKETING_SPOTS[
            Math.floor(Math.random() * BEGGAR_MARKETING_SPOTS.length)
          ];
        bk.targetX = firstSpot.x;
        bk.targetZ = firstSpot.z;
        events.feedbackText =
          'Helped Poor Kid is now waving & sending customers to your Readi!';
        events.feedbackColor = '#86EFAC';
      }
      nextBeggarKids.push(bk);
    } else if (bk.status === 'marketing') {
      bk.marketingTimer = Math.max(0, (bk.marketingTimer ?? 0) - dt);
      bk.marketingMoveTimer = (bk.marketingMoveTimer ?? 0) - dt;
      bk.marketingCallTimer = (bk.marketingCallTimer ?? 7) - dt;

      if (bk.marketingCallTimer <= 0) {
        shift.spawnTimer = Math.min(shift.spawnTimer, 1.8);
        bk.marketingCallTimer = 7 + Math.random() * 4;
      }

      const distToSpot = Math.hypot(bk.targetX - bk.x, bk.targetZ - bk.z);
      if (distToSpot > 0.28) {
        moveNpcWithAvoidance(
          bk,
          bk.targetX,
          bk.targetZ,
          2.05,
          dt,
          world,
          shift,
          {
            biasSign: bkBias,
            selfId: bk.id,
            stayOnSidewalk: true,
          }
        );
      } else {
        bk.yaw = dampAngle(bk.yaw, 0, 8, dt);
        if ((bk.marketingMoveTimer ?? 0) <= 0) {
          const nextSpot =
            BEGGAR_MARKETING_SPOTS[
              Math.floor(Math.random() * BEGGAR_MARKETING_SPOTS.length)
            ];
          bk.targetX = nextSpot.x;
          bk.targetZ = nextSpot.z;
          bk.marketingMoveTimer = 6.5 + Math.random() * 4.5;
        }
      }

      if ((bk.marketingTimer ?? 0) <= 0) {
        bk.status = 'walking_out';
        bk.targetZ = 1.08;
        bk.walkOutTimer = 12;
      }
      nextBeggarKids.push(bk);
    } else if (bk.status === 'walking_out') {
      bk.walkOutTimer = Math.max(0, (bk.walkOutTimer ?? 12) - dt);
      const exitX =
        bk.seq % 2 === 0 ? WORLD_BOUNDS.minX + 0.6 : WORLD_BOUNDS.maxX - 0.9;
      const arrived = moveNpcWithAvoidance(
        bk,
        exitX,
        1.08,
        2.35,
        dt,
        world,
        shift,
        {
          biasSign: bkBias,
          selfId: bk.id,
          stayOnSidewalk: true,
        }
      );
      const insideBounds =
        bk.x > WORLD_BOUNDS.minX + 0.8 && bk.x < WORLD_BOUNDS.maxX - 1.1;
      if (!arrived && insideBounds && (bk.walkOutTimer ?? 0) > 0) {
        nextBeggarKids.push(bk);
      }
    }
  }
  shift.beggarKids = nextBeggarKids;

  // 11. Ambient Footpath Passerby NPCs across expanded plaza
  shift.pedestrianSpawnTimer -= dt;
  if (shift.pedestrianSpawnTimer <= 0) {
    if (shift.pedestrians.length < 6) {
      const seq = shift.nextCustomerSeq;
      shift.nextCustomerSeq += 1;
      const fromLeft = seq % 2 === 0;
      const useUpperPath = Math.random() < 0.62;
      const laneZ = useUpperPath
        ? -3.75 + Math.random() * 0.55
        : 1.46 + Math.random() * 0.12;
      const startX =
        fromLeft ? WORLD_BOUNDS.minX + 0.6 : WORLD_BOUNDS.maxX - 0.9;
      const endX =
        fromLeft ? WORLD_BOUNDS.maxX - 0.7 : WORLD_BOUNDS.minX + 0.4;

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
    if (
      !arrived &&
      ped.x > WORLD_BOUNDS.minX + 0.2 &&
      ped.x < WORLD_BOUNDS.maxX - 0.5
    ) {
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
    if (
      c.status === 'walking_out' &&
      (c.x < WORLD_BOUNDS.minX + 1.3 || c.x > WORLD_BOUNDS.maxX - 2.3)
    ) {
      continue;
    }
    refs.push({
      ref: c,
      stayOnSidewalk: true,
      anchored: c.status === 'waiting' || c.status === 'drinking',
    });
  }
  for (const ped of shift.pedestrians) {
    if (ped.x < WORLD_BOUNDS.minX + 1.3 || ped.x > WORLD_BOUNDS.maxX - 2.3) {
      continue;
    }
    refs.push({ ref: ped, stayOnSidewalk: true, anchored: false });
  }
  if (owner.z > -3.5) {
    refs.push({
      ref: owner,
      stayOnSidewalk: false,
      anchored: owner.phase === 'ordering_chai' || owner.phase === 'drinking_chai',
    });
  }
  for (const v of visitors) {
    if (v.phase !== 'at_shop' || v.z > -5.5) {
      refs.push({
        ref: v,
        stayOnSidewalk: false,
        anchored: v.phase === 'ordering' || v.phase === 'eating_drinking',
      });
    }
  }
  for (const bk of nextBeggarKids) {
    refs.push({
      ref: bk,
      stayOnSidewalk: true,
      anchored: bk.status === 'waiting' || bk.status === 'eating',
    });
  }
  for (const h of getShiftHelpers(shift)) {
    const isMovingOrBegging =
      h.status === 'hired' ||
      (h.status === 'sitting' &&
        (h.beggingState === 'walking_to_stall' ||
          h.beggingState === 'begging_at_stall' ||
          h.beggingState === 'eating_free' ||
          h.beggingState === 'returning_marketing'));
    if (isMovingOrBegging) {
      refs.push({
        ref: h,
        stayOnSidewalk:
          !isInsideAnyRentedShop(h.x, h.z, world) && h.z > -4.9,
        anchored: h.status === 'sitting' && h.beggingState === 'begging_at_stall',
        allowRoadCurb: h.status === 'hired' && (h.z > 1.55 || h.task === 'serving'),
      });
    }
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
          itemA.stayOnSidewalk ? -4.85 : -14.2,
          itemA.allowRoadCurb ? 2.75 : 1.6
        );
        b.z = clamp(
          b.z,
          itemB.stayOnSidewalk ? -4.85 : -14.2,
          itemB.allowRoadCurb ? 2.75 : 1.6
        );
        if (world.hasTeaStall !== false) {
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
        if (world.hasColdCart) {
          resolveCollisionBox(
            a,
            COLD_CART_ANCHOR.x - 2.4,
            COLD_CART_ANCHOR.x + 2.4,
            COLD_CART_ANCHOR.z - 0.82,
            COLD_CART_ANCHOR.z + 0.82,
            0.36
          );
          resolveCollisionBox(
            b,
            COLD_CART_ANCHOR.x - 2.4,
            COLD_CART_ANCHOR.x + 2.4,
            COLD_CART_ANCHOR.z - 0.82,
            COLD_CART_ANCHOR.z + 0.82,
            0.36
          );
        }
      }
    }
  }

  return events;
}
