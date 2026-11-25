import {
  COLD_CUSTOMER_SLOTS,
  CUSTOMER_SLOTS,
  HELPER_NPCS,
  HELPER_NPC_IDS,
  SNACK_CUSTOMER_SLOTS,
  STARTING_CASH_CENTS,
  STARTING_WATER,
} from './constants.ts';
import type {
  CafeFurniture,
  DrinkType,
  FurnitureKind,
  HelperKidState,
  HelperNpcId,
  Player2State,
  RentedShopRecord,
  ShiftSnapshot,
  ShopBuildingId,
  WoodMasterOrder,
  WoodOrderKind,
  WorldSave,
} from './types.ts';

const LOCAL_STORAGE_KEY = 'rush_hour_cafe_worlds_v3';

const VALID_DRINKS = new Set<DrinkType>([
  'tea',
  'doodh_patti',
  'coffee',
  'biscuit_pack',
  'cupcake',
  'samosa',
  'pakora',
  'cold_drink',
  'ice_cream',
]);

function sanitizeDrink(val: unknown): DrinkType {
  return typeof val === 'string' && VALID_DRINKS.has(val as DrinkType)
    ? (val as DrinkType)
    : 'tea';
}

export function createDefaultHelperState(
  id: HelperNpcId = 'chotu'
): HelperKidState {
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

function normalizeShift(rawShift: unknown): ShiftSnapshot | null {
  if (!rawShift || typeof rawShift !== 'object') return null;
  const s = rawShift as Partial<ShiftSnapshot> & {
    inventory?: Partial<ShiftSnapshot['inventory']>;
  };
  if (!s.milkman || !s.carCustomer || !s.player || !s.inventory) return null;
  const inv = {
    cups: typeof s.inventory.cups === 'number' ? s.inventory.cups : 20,
    teaLeaves:
      typeof s.inventory.teaLeaves === 'number' ? s.inventory.teaLeaves : 12,
    sugar: typeof s.inventory.sugar === 'number' ? s.inventory.sugar : 12,
    water:
      typeof s.inventory.water === 'number' ? s.inventory.water : STARTING_WATER,
    milkPackets:
      typeof s.inventory.milkPackets === 'number'
        ? s.inventory.milkPackets
        : 0,
    coffeePowder:
      typeof s.inventory.coffeePowder === 'number'
        ? s.inventory.coffeePowder
        : 0,
    biscuits:
      typeof s.inventory.biscuits === 'number' ? s.inventory.biscuits : 0,
    cupcakes:
      typeof s.inventory.cupcakes === 'number' ? s.inventory.cupcakes : 0,
    samosaMix:
      typeof s.inventory.samosaMix === 'number' ? s.inventory.samosaMix : 0,
    pakoraMix:
      typeof s.inventory.pakoraMix === 'number' ? s.inventory.pakoraMix : 0,
    cookingOil:
      typeof s.inventory.cookingOil === 'number' ? s.inventory.cookingOil : 0,
    iceBlocks:
      typeof s.inventory.iceBlocks === 'number' ? s.inventory.iceBlocks : 0,
    coldDrinkBottles:
      typeof s.inventory.coldDrinkBottles === 'number'
        ? s.inventory.coldDrinkBottles
        : 0,
    iceCreamMix:
      typeof s.inventory.iceCreamMix === 'number' ? s.inventory.iceCreamMix : 0,
    iceCreamCones:
      typeof s.inventory.iceCreamCones === 'number'
        ? s.inventory.iceCreamCones
        : 0,
  };

  const normalizedCustomers = Array.isArray(s.customers)
    ? s.customers.map((c) => {
        const orderDrink = sanitizeDrink(c.orderDrink);
        const isFried = orderDrink === 'samosa' || orderDrink === 'pakora';
        const isCold = orderDrink === 'cold_drink' || orderDrink === 'ice_cream';
        const pool = isFried
          ? SNACK_CUSTOMER_SLOTS
          : isCold
            ? COLD_CUSTOMER_SLOTS
            : CUSTOMER_SLOTS;
        const slot =
          pool[Math.max(0, Math.min(pool.length - 1, c.slotIndex ?? 0))];
        const migratedTargetZ =
          !c.targetChairId && c.targetZ < 0 ? slot.z : c.targetZ;
        const migratedTargetX =
          !c.targetChairId && c.targetZ < 0 ? slot.x : c.targetX;
        const migratedZ =
          !c.seatedChairId && !c.targetChairId && c.status === 'waiting' && c.z < 0
            ? slot.z
            : c.z;
        const migratedX =
          !c.seatedChairId && !c.targetChairId && c.status === 'waiting' && c.z < 0
            ? slot.x
            : c.x;

        return {
          ...c,
          x: migratedX,
          z: migratedZ,
          targetX: migratedTargetX,
          targetZ: migratedTargetZ,
          orderDrink,
          targetChairId: c.targetChairId ?? null,
          seatedChairId: c.seatedChairId ?? null,
        };
      })
    : [];

  const rawTrayList = Array.isArray(s.trayItems) ? s.trayItems : [];
  const trayItems = [0, 1, 2, 3].map((idx) =>
    idx < rawTrayList.length
      ? (rawTrayList[idx] ?? null)
      : idx === 0
        ? (s.trayItem ?? null)
        : null
  );

  const rawSnackTrayList = Array.isArray(s.snackTrayItems)
    ? s.snackTrayItems
    : [];
  const snackTrayItems = [0, 1].map((idx) =>
    idx < rawSnackTrayList.length ? (rawSnackTrayList[idx] ?? null) : null
  );

  const rawColdTrayList = Array.isArray(s.coldTrayItems)
    ? s.coldTrayItems
    : [];
  const coldTrayItems = [0, 1].map((idx) =>
    idx < rawColdTrayList.length ? (rawColdTrayList[idx] ?? null) : null
  );

  const rawHelpers = Array.isArray(s.helpers) ? s.helpers : [];
  const helpers: HelperKidState[] = HELPER_NPC_IDS.map((id, idx) => {
    const defHelper = createDefaultHelperState(id);
    const match =
      rawHelpers.find((h) => h && h.id === id) ??
      (id === 'chotu' ? (s.helper as Partial<HelperKidState> | undefined) : rawHelpers[idx]);
    if (!match || typeof match !== 'object') return defHelper;
    return {
      ...defHelper,
      ...match,
      id,
      name: HELPER_NPCS[id].name,
      role: HELPER_NPCS[id].role,
      status: match.status === 'hired' ? 'hired' : 'sitting',
    };
  });
  const helper = helpers[0];

  const player2: Player2State =
    s.player2 && typeof s.player2 === 'object'
      ? {
          x: typeof s.player2.x === 'number' ? s.player2.x : -0.75,
          z: typeof s.player2.z === 'number' ? s.player2.z : -2.45,
          yaw: typeof s.player2.yaw === 'number' ? s.player2.yaw : 0,
          holding: s.player2.holding ?? null,
          walkCycle: typeof s.player2.walkCycle === 'number' ? s.player2.walkCycle : 0,
          dashCooldown: 0,
          dashTimer: 0,
          isMoving: false,
          sittingChairId: s.player2.sittingChairId ?? null,
          active: Boolean(s.player2.active),
        }
      : {
          x: -0.75,
          z: -2.45,
          yaw: 0,
          holding: null,
          walkCycle: 0,
          dashCooldown: 0,
          dashTimer: 0,
          isMoving: false,
          sittingChairId: null,
          active: false,
        };

  return {
    ...(s as ShiftSnapshot),
    player: {
      ...s.player,
      sittingChairId: s.player.sittingChairId ?? null,
    },
    player2,
    carCustomer: {
      ...s.carCustomer,
      orderDrink: sanitizeDrink(s.carCustomer.orderDrink),
    },
    supermarketOwner: s.supermarketOwner
      ? {
          ...s.supermarketOwner,
          orderDrink: sanitizeDrink(s.supermarketOwner.orderDrink),
        }
      : {
          x: 6.2,
          z: -7.8,
          yaw: 0,
          phase: 'patrol_inside',
          targetX: 9.8,
          targetZ: -6.1,
          waitTimer: 3.5,
          nextVisitTimer: 48,
          orderDrink: 'tea',
          patience: 115,
          maxPatience: 115,
          drinkTimer: 0,
          walkCycle: 0,
        },
    kettle: s.kettle
      ? {
          ...s.kettle,
          brewingDrink: s.kettle.brewingDrink
            ? sanitizeDrink(s.kettle.brewingDrink)
            : null,
        }
      : { status: 'idle', progress: 0, brewingDrink: null },
    fryer: s.fryer
      ? {
          status:
            s.fryer.status === 'frying' || s.fryer.status === 'ready'
              ? s.fryer.status
              : 'idle',
          progress: typeof s.fryer.progress === 'number' ? s.fryer.progress : 0,
          fryingSnack:
            s.fryer.fryingSnack === 'samosa' || s.fryer.fryingSnack === 'pakora'
              ? s.fryer.fryingSnack
              : null,
        }
      : { status: 'idle', progress: 0, fryingSnack: null },
    chiller: s.chiller
      ? {
          status:
            s.chiller.status === 'chilling' || s.chiller.status === 'ready'
              ? s.chiller.status
              : 'idle',
          progress:
            typeof s.chiller.progress === 'number' ? s.chiller.progress : 0,
          chillingItem:
            s.chiller.chillingItem === 'cold_drink' ||
            s.chiller.chillingItem === 'ice_cream'
              ? s.chiller.chillingItem
              : null,
        }
      : { status: 'idle', progress: 0, chillingItem: null },
    helper,
    helpers,
    customers: normalizedCustomers,
    pedestrians: Array.isArray(s.pedestrians) ? s.pedestrians : [],
    pedestrianSpawnTimer:
      typeof s.pedestrianSpawnTimer === 'number' ? s.pedestrianSpawnTimer : 2.5,
    trayItem: trayItems[0] ?? null,
    trayItems,
    snackTrayItems,
    coldTrayItems,
    inventory: inv,
  };
}

function normalizeWorld(
  raw: Partial<WorldSave> & { id: string; name: string }
): WorldSave {
  const validList = Array.isArray(raw.unlockedRecipes)
    ? raw.unlockedRecipes.filter((d): d is DrinkType =>
        VALID_DRINKS.has(d as DrinkType)
      )
    : [];
  const recipes: DrinkType[] = validList.includes('tea')
    ? validList
    : ['tea', ...validList];

  const furniture: CafeFurniture[] = Array.isArray(raw.furniture)
    ? raw.furniture.filter(
        (f): f is CafeFurniture =>
          Boolean(
            f &&
              f.id &&
              (f.kind === 'chair' || f.kind === 'table') &&
              typeof f.x === 'number' &&
              typeof f.z === 'number'
          )
      )
    : [];

  const pendingFurniture: FurnitureKind[] = Array.isArray(raw.pendingFurniture)
    ? raw.pendingFurniture.filter(
        (k): k is FurnitureKind => k === 'chair' || k === 'table'
      )
    : [];

  const rentedShops: RentedShopRecord[] = Array.isArray(raw.rentedShops)
    ? raw.rentedShops.filter(
        (r): r is RentedShopRecord =>
          Boolean(
            r &&
              (r.buildingId === 'west_shop' ||
                r.buildingId === 'center_shop' ||
                r.buildingId === 'east_shop') &&
              typeof r.nextRentDueDay === 'number'
          )
      )
    : [];

  const disabledMenuItems: DrinkType[] = Array.isArray(raw.disabledMenuItems)
    ? Array.from(
        new Set(
          raw.disabledMenuItems.filter((d): d is DrinkType =>
            VALID_DRINKS.has(d as DrinkType)
          )
        )
      )
    : [];

  const shopKitchens: ShopBuildingId[] = Array.isArray(raw.shopKitchens)
    ? Array.from(
        new Set(
          raw.shopKitchens.filter(
            (id): id is ShopBuildingId =>
              id === 'west_shop' || id === 'center_shop' || id === 'east_shop'
          )
        )
      )
    : [];

  const validOrderKinds = new Set<WoodOrderKind>([
    'chair',
    'table',
    'shop_kitchen',
    'snacks_cart',
    'cold_cart',
    'chai_stall',
  ]);
  const woodOrders: WoodMasterOrder[] = Array.isArray(raw.woodOrders)
    ? raw.woodOrders.filter(
        (o): o is WoodMasterOrder =>
          Boolean(
            o &&
              o.id &&
              validOrderKinds.has(o.kind) &&
              typeof o.durationSec === 'number' &&
              typeof o.remainingSec === 'number'
          )
      )
    : [];

  return {
    id: raw.id,
    name: raw.name,
    stage: raw.stage === 2 ? 2 : 1,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    lastPlayedAt:
      typeof raw.lastPlayedAt === 'number' ? raw.lastPlayedAt : Date.now(),
    day: typeof raw.day === 'number' && raw.day >= 1 ? raw.day : 1,
    cashCents:
      typeof raw.cashCents === 'number' && Number.isFinite(raw.cashCents)
        ? raw.cashCents
        : STARTING_CASH_CENTS,
    totalServed: typeof raw.totalServed === 'number' ? raw.totalServed : 0,
    unlockedRecipes: recipes,
    disabledMenuItems,
    hasTeaStall: raw.hasTeaStall !== false,
    hasSnacksCart: Boolean(raw.hasSnacksCart),
    hasColdCart: Boolean(raw.hasColdCart),
    rentedShops,
    shopKitchens,
    woodOrders,
    furniture,
    pendingFurniture,
    activeShift: normalizeShift(raw.activeShift),
  };
}

export function readLocalWorlds(): WorldSave[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorldSave[];
    return Array.isArray(parsed)
      ? parsed.filter((w) => w && w.id && w.name).map(normalizeWorld)
      : [];
  } catch {
    return [];
  }
}

export function writeLocalWorlds(worlds: WorldSave[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(worlds));
  } catch {
    // Ignore storage quota issues
  }
}

export async function loadAllWorlds(): Promise<WorldSave[]> {
  const localWorlds = readLocalWorlds();
  const merged = new Map<string, WorldSave>();
  for (const w of localWorlds) {
    merged.set(w.id, w);
  }

  try {
    const res = await fetch('/api/worlds', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { worlds?: WorldSave[] };
      const serverWorlds = (data.worlds ?? [])
        .filter((w) => w && w.id && w.name)
        .map(normalizeWorld);
      for (const sw of serverWorlds) {
        const existing = merged.get(sw.id);
        if (!existing || sw.lastPlayedAt >= existing.lastPlayedAt) {
          merged.set(sw.id, sw);
        }
      }

      for (const lw of localWorlds) {
        const onServer = serverWorlds.find((s) => s.id === lw.id);
        if (!onServer || lw.lastPlayedAt > onServer.lastPlayedAt) {
          fetch('/api/worlds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lw),
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Fall back to localStorage cleanly
  }

  const list = Array.from(merged.values()).sort(
    (a, b) => b.lastPlayedAt - a.lastPlayedAt
  );
  writeLocalWorlds(list);
  return list;
}

export async function persistWorld(
  world: WorldSave,
  keepalive = false
): Promise<void> {
  const updated: WorldSave = {
    ...world,
    lastPlayedAt: Date.now(),
  };

  const current = readLocalWorlds();
  const idx = current.findIndex((w) => w.id === updated.id);
  if (idx >= 0) {
    current[idx] = updated;
  } else {
    current.unshift(updated);
  }
  writeLocalWorlds(current);

  try {
    await fetch(`/api/worlds/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
      keepalive,
    });
  } catch {
    // Local copy is already safe
  }
}

export async function removeWorld(worldId: string): Promise<void> {
  const filtered = readLocalWorlds().filter((w) => w.id !== worldId);
  writeLocalWorlds(filtered);
  try {
    await fetch(`/api/worlds/${encodeURIComponent(worldId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Ignore network error
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 45) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
