import {
  CUSTOMER_SLOTS,
  KID_SIT_POS,
  SNACK_CUSTOMER_SLOTS,
  STARTING_CASH_CENTS,
  STARTING_WATER,
} from './constants.ts';
import type {
  CafeFurniture,
  DrinkType,
  FurnitureKind,
  HelperKidState,
  RentedShopRecord,
  ShiftSnapshot,
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
]);

function sanitizeDrink(val: unknown): DrinkType {
  return typeof val === 'string' && VALID_DRINKS.has(val as DrinkType)
    ? (val as DrinkType)
    : 'tea';
}

export function createDefaultHelperState(): HelperKidState {
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
  };

  const normalizedCustomers = Array.isArray(s.customers)
    ? s.customers.map((c) => {
        const orderDrink = sanitizeDrink(c.orderDrink);
        const isFried = orderDrink === 'samosa' || orderDrink === 'pakora';
        const pool = isFried ? SNACK_CUSTOMER_SLOTS : CUSTOMER_SLOTS;
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

  const rawHelper = s.helper as Partial<HelperKidState> | undefined;
  const defHelper = createDefaultHelperState();
  const helper: HelperKidState = rawHelper
    ? {
        ...defHelper,
        ...rawHelper,
        status: rawHelper.status === 'hired' ? 'hired' : 'sitting',
      }
    : defHelper;

  return {
    ...(s as ShiftSnapshot),
    player: {
      ...s.player,
      sittingChairId: s.player.sittingChairId ?? null,
    },
    carCustomer: {
      ...s.carCustomer,
      orderDrink: sanitizeDrink(s.carCustomer.orderDrink),
    },
    supermarketOwner: s.supermarketOwner ?? {
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
    helper,
    customers: normalizedCustomers,
    pedestrians: Array.isArray(s.pedestrians) ? s.pedestrians : [],
    pedestrianSpawnTimer:
      typeof s.pedestrianSpawnTimer === 'number' ? s.pedestrianSpawnTimer : 2.5,
    trayItem: trayItems[0] ?? null,
    trayItems,
    snackTrayItems,
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
    hasSnacksCart: Boolean(raw.hasSnacksCart),
    rentedShops,
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
