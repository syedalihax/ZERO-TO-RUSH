import type {
  DrinkType,
  FurnitureKind,
  HeldItem,
  HelperNpcId,
  WoodOrderKind,
} from './types.ts';

export const DAY_DURATION_SECONDS = 300; // 1 Day = 5 minutes
export const STARTING_CASH_CENTS = 100; // $1.00 starting pocket cash
export const STARTING_CUPS = 20; // Readi starts with 20 disposable cups
export const STARTING_TEA = 12;
export const STARTING_SUGAR = 12;
export const STARTING_WATER = 12;
export const MAX_WATER_CAPACITY = 20;
export const WATER_TAP_REFILL_AMOUNT = 10;

export const LEVEL2_SERVED_THRESHOLD = 6; // Serve 6 orders (or finish Day 1) to unlock Level 2!
export const RANDOM_TIP_CHANCE = 0.18; // 18% random chance a happy customer leaves an optional tip
export const RANDOM_TIP_AMOUNTS_CENTS = [10, 15, 20, 25] as const;

// Helper Kids (3 Beggar / Helper NPCs across the Street)
export const HELPER_CHARITY_CENTS = 25; // $0.25 charity
export const HELPER_WAGE_CENTS = 15; // $0.15 wage paid per customer served for 1 day
export const SNACKS_HELPER_WAGE_RATE = 0.2; // 20% of Samosa/Pakora price ($0.16 Samosa / $0.14 Pakora)
export const KID_SIT_POS = { x: 9.2, z: -3.08 };
export const HELPER_IDLE_SPOT = { x: -2.2, z: -2.45 };

export interface HelperNpcConfig {
  id: HelperNpcId;
  name: string;
  title: string;
  gender: 'boy' | 'girl';
  role: 'general' | 'snacks_only';
  sitPos: { x: number; z: number };
  idlePos: { x: number; z: number };
  shirtHex: string;
  hairHex: string;
  scale: number;
  locationLabel: string;
  requiresSnacksCart: boolean;
}

export const HELPER_NPCS: Record<HelperNpcId, HelperNpcConfig> = {
  chotu: {
    id: 'chotu',
    name: 'Chotu',
    title: 'Chotu (Boy Outside Market)',
    gender: 'boy',
    role: 'general',
    sitPos: KID_SIT_POS,
    idlePos: HELPER_IDLE_SPOT,
    shirtHex: '#78716C',
    hairHex: '#1C1917',
    scale: 0.68,
    locationLabel: 'Boy Outside Market',
    requiresSnacksCart: false,
  },
  munni: {
    id: 'munni',
    name: 'Munni',
    title: 'Munni (Little Girl Outside Second-Hand Shop)',
    gender: 'girl',
    role: 'snacks_only',
    sitPos: { x: 28.4, z: -4.15 },
    idlePos: { x: -11.4, z: -2.45 },
    shirtHex: '#DB2777',
    hairHex: '#1C1917',
    scale: 0.64,
    locationLabel: 'Girl Outside Second-Hand Shop',
    requiresSnacksCart: true,
  },
  babloo: {
    id: 'babloo',
    name: 'Babloo',
    title: 'Babloo (Boy Outside Bazaar Corner Shop)',
    gender: 'boy',
    role: 'general',
    sitPos: { x: -15.4, z: -4.15 },
    idlePos: { x: -0.2, z: -2.45 },
    shirtHex: '#0F766E',
    hairHex: '#292524',
    scale: 0.67,
    locationLabel: 'Boy Outside Bazaar Shop',
    requiresSnacksCart: false,
  },
};

export const HELPER_NPC_IDS: HelperNpcId[] = ['chotu', 'munni', 'babloo'];

export function getHelperWageCents(
  helperId: HelperNpcId | undefined,
  drinkPriceCents: number
): number {
  if (helperId === 'munni') {
    return Math.max(
      10,
      Math.min(20, Math.round(drinkPriceCents * SNACKS_HELPER_WAGE_RATE))
    );
  }
  return HELPER_WAGE_CENTS;
}

// 1st, 2nd & 3rd Readi Prices + 50% Second-Hand Resale Rate
export const CHAI_STALL_PRICE_CENTS = 1000; // $10.00 value for Main Chai Readi
export const SNACKS_RECIPE_PRICE_CENTS = 350; // $3.50 to learn Samosa & Pakora recipe first
export const SNACKS_CART_PRICE_CENTS = 1200; // $12.00 to order 2nd Readi at Wood Master
export const COLD_RECIPE_PRICE_CENTS = 400; // $4.00 to learn Cold Drinks & Ice Cream recipe
export const COLD_CART_PRICE_CENTS = 1400; // $14.00 to order 3rd Cold Readi at Wood Master
export const SHOP_KITCHEN_PRICE_CENTS = 1800; // $18.00 to build an indoor Shop Kitchen at Wood Master
export const CHAIR_PRICE_CENTS = 150; // $1.50
export const TABLE_PRICE_CENTS = 250; // $2.50
export const RESALE_RATE = 0.5; // -50% resale rate at Second-Hand Buyer Shop
export const FRYING_DURATION = 2.4;
export const CHILLING_DURATION = 2.2;
export const MARKETING_DURATION = 75;

export const KETTLING_DURATION = 2.6;
export const PLAYER_SPEED = 4.9;
export const DASH_SPEED_MULT = 1.95;
export const DASH_DURATION = 0.18;
export const DASH_COOLDOWN = 0.85;

// Expanded Open-Roam World: Sidewalks, Shop Interiors, Side Alleys, Backside Corridors & Full Road!
export const WORLD_BOUNDS = {
  minX: -29.8,
  maxX: 52.5,
  minZ: -19.8, // Walk freely behind every building's backside!
  maxZ: 8.1, // Walk freely onto and across the full road!
};

// Authentic Pakistani 4-Wheel Chai Readi (7.4m long x 1.64m wide/deep, centered at x = -2.2, z = -1.15)
export const CYCLE_ANCHOR = { x: -2.2, z: -1.15 };

// 2nd Readi: Samosa & Pakora Cart on expanded left plaza (4.8m long x 1.64m wide/deep)
export const SNACKS_CART_ANCHOR = { x: -11.4, z: -1.15 };

// 3rd Readi: Cold Drinks & Ice Cream Cart on right plaza in front of Supermarket side (4.8m long x 1.64m wide/deep)
export const COLD_CART_ANCHOR = { x: 9.8, z: -1.15 };

// Every station sits strictly INSIDE the 7.4m x 1.64m Chai Readi deck
// Back row holds prep stations; entire front row holds 4 Free Space mats!
export const STATIONS = {
  kettle: { x: -5.25, z: -1.52, label: 'Boiling Kettle' },
  milk_crate: { x: -4.55, z: -1.52, label: 'Milk Packets' },
  water_jug: { x: -3.85, z: -1.52, label: 'Water Jug' },
  sugar_jar: { x: -3.15, z: -1.52, label: 'Sugar Jar' },
  coffee_jar: { x: -2.45, z: -1.52, label: 'Coffee Beans Jar' },
  tea_tin: { x: -1.75, z: -1.52, label: 'Tea Leaves Tin' },
  cups: { x: -1.05, z: -1.52, label: 'Cup Basket' },
  biscuit_box: { x: -0.35, z: -1.52, label: 'Tea Biscuits Box' },
  cupcake_box: { x: 0.35, z: -1.52, label: 'Mini Cupcakes Box' },
  counter_tray: { x: 0.6, z: -0.72, label: 'Readi Free Space' },
} as const;

export const TRAY_SPOTS = [
  { x: -4.85, z: -0.72, label: 'Front Left Space' },
  { x: -3.05, z: -0.72, label: 'Front Center-Left Space' },
  { x: -1.25, z: -0.72, label: 'Front Center-Right Space' },
  { x: 0.6, z: -0.72, label: 'Front Right Space' },
] as const;

// 2nd Readi (Samosa & Pakora Cart) stations
export const SNACK_STATIONS = {
  kadhai: { x: -13.0, z: -1.48, label: 'Hot Oil Kadhai' },
  samosa_prep: { x: -11.9, z: -1.48, label: 'Aloo Samosa Tray' },
  pakora_prep: { x: -10.8, z: -1.48, label: 'Besan Pakora Bowl' },
  snack_plates: { x: -9.75, z: -1.48, label: 'Serving Paper Plates' },
} as const;

export const SNACK_TRAY_SPOTS = [
  { x: -12.4, z: -0.72, label: 'Snacks Showcase Left' },
  { x: -10.35, z: -0.72, label: 'Snacks Showcase Right' },
] as const;

// 3rd Readi (Cold Drinks & Ice Cream Cart) stations
export const COLD_STATIONS = {
  chiller: { x: 7.95, z: -1.48, label: 'Electric Ice Chiller' },
  ice_box: { x: 8.9, z: -1.48, label: 'Crushed Ice Blocks Box' },
  soda_crate: { x: 9.85, z: -1.48, label: 'Cold Drink Bottles Crate' },
  icecream_tub: { x: 10.75, z: -1.48, label: 'Ice Cream Mix Tub' },
  cone_stack: { x: 11.65, z: -1.48, label: 'Waffle Cones Stack' },
} as const;

export const COLD_TRAY_SPOTS = [
  { x: 8.75, z: -0.72, label: 'Cold Showcase Left' },
  { x: 10.85, z: -0.72, label: 'Cold Showcase Right' },
] as const;

// Free Water Tap & Trash Bin cleanly placed in the alley between Center Shop & Supermarket
export const WATER_TAP_POS = { x: 3.35, z: -5.0 };
export const TRASH_BIN_POS = { x: 2.15, z: -5.0 };

// Open Walk-In Supermarket in the Right-Side Building Row (footprint: x 4.4..12.8, z -8.8..-3.8)
export const SUPERMARKET_BOUNDS = {
  minX: 4.4,
  maxX: 12.8,
  minZ: -8.8,
  maxZ: -3.8,
};

// All Street Buildings are Spacious 3x Larger Open Walk-In Shops (Kitchen + 4 Chairs + 2 Tables fit comfortably!)
export interface RentableBuildingConfig {
  id: 'west_shop' | 'center_shop' | 'east_shop';
  shopName: string;
  ownerName: string;
  weeklyRentCents: number;
  dailyIncomeBonusCents: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  doorMinX: number;
  doorMaxX: number;
  ownerPos: { x: number; z: number };
  counterPos: { x: number; z: number };
  wallHex: number;
  awningHex: number;
  ownerShirtHex: string;
}

export const RENTABLE_BUILDINGS: RentableBuildingConfig[] = [
  {
    id: 'west_shop',
    shopName: 'Bazaar Corner Shop',
    ownerName: 'Tariq Bhai',
    weeklyRentCents: 8000, // $80.00 / week
    dailyIncomeBonusCents: 1400, // +$14/day indoor takeaway revenue when rent paid
    bounds: { minX: -24.2, maxX: -13.4, minZ: -14.8, maxZ: -5.2 },
    doorMinX: -20.5,
    doorMaxX: -17.1,
    ownerPos: { x: -22.1, z: -13.45 },
    counterPos: { x: -22.1, z: -12.45 },
    wallHex: 0xf4e4cd,
    awningHex: 0x15803d,
    ownerShirtHex: '#0F766E',
  },
  {
    id: 'center_shop',
    shopName: 'Chai Bazaar Dukaan',
    ownerName: 'Haji Sahab',
    weeklyRentCents: 10000, // $100.00 / week
    dailyIncomeBonusCents: 1850, // +$18.50/day prime location revenue when rent paid
    bounds: { minX: -11.4, maxX: 0.0, minZ: -14.8, maxZ: -5.2 },
    doorMinX: -7.4,
    doorMaxX: -4.0,
    ownerPos: { x: -9.3, z: -13.45 },
    counterPos: { x: -9.3, z: -12.45 },
    wallHex: 0xead5be,
    awningHex: 0xd97706,
    ownerShirtHex: '#B45309',
  },
  {
    id: 'east_shop',
    shopName: 'East Lane Dukaan',
    ownerName: 'Malik Sahab',
    weeklyRentCents: 8000, // $80.00 / week
    dailyIncomeBonusCents: 1400, // +$14/day indoor takeaway revenue when rent paid
    bounds: { minX: 14.8, maxX: 25.6, minZ: -14.8, maxZ: -5.2 },
    doorMinX: 18.5,
    doorMaxX: 21.9,
    ownerPos: { x: 16.9, z: -13.45 },
    counterPos: { x: 16.9, z: -12.45 },
    wallHex: 0xe6d2bc,
    awningHex: 0x0284c7,
    ownerShirtHex: '#1D4ED8',
  },
];

export function getShopKitchenBounds(b: RentableBuildingConfig) {
  return {
    minX: b.bounds.maxX - 5.9,
    maxX: b.bounds.maxX - 0.4,
    minZ: b.bounds.minZ + 0.5,
    maxZ: b.bounds.minZ + 2.35,
  };
}

export function getShopKitchenStations(b: RentableBuildingConfig) {
  const baseX = b.bounds.maxX - 5.45;
  const stationZ = b.bounds.minZ + 1.15;
  const trayZ = b.bounds.minZ + 2.02;
  const step = 0.59;
  return {
    kettle: { x: baseX + step * 0, z: stationZ },
    milk_crate: { x: baseX + step * 1, z: stationZ },
    water_jug: { x: baseX + step * 2, z: stationZ },
    sugar_jar: { x: baseX + step * 3, z: stationZ },
    coffee_jar: { x: baseX + step * 4, z: stationZ },
    tea_tin: { x: baseX + step * 5, z: stationZ },
    cups: { x: baseX + step * 6, z: stationZ },
    biscuit_box: { x: baseX + step * 7, z: stationZ },
    cupcake_box: { x: baseX + step * 8, z: stationZ },
    trays: [
      { x: baseX + 0.9, z: trayZ },
      { x: baseX + 2.35, z: trayZ },
      { x: baseX + 3.8, z: trayZ },
    ] as const,
    standZ: b.bounds.minZ + 2.95,
  };
}

// Second-Hand Buyer Shop on the Right End of the Street (Sell Stalls, Chairs & Tables at -50%!)
export const BUYER_SHOP = {
  shopName: 'Second-Hand Gear Buyer',
  buyerName: 'Raza Bhai',
  bounds: { minX: 27.6, maxX: 34.6, minZ: -10.2, maxZ: -5.2 },
  doorMinX: 29.6,
  doorMaxX: 32.6,
  buyerPos: { x: 31.1, z: -8.85 },
  counterPos: { x: 31.1, z: -7.85 },
  wallHex: 0xede9fe,
  awningHex: 0x7c3aed,
  buyerShirtHex: '#6D28D9',
} as const;

// Wood Master Carpentry & Cart Workshop (Right side of expanded street)
export const WOOD_MASTER_SHOP = {
  shopName: 'Wood Master Workshop',
  masterName: 'Ustad Karim',
  bounds: { minX: 36.6, maxX: 47.4, minZ: -12.8, maxZ: -5.2 },
  doorMinX: 40.0,
  doorMaxX: 44.0,
  masterPos: { x: 42.0, z: -11.35 },
  counterPos: { x: 42.0, z: -10.25 },
  pickupPos: { x: 38.3, z: -4.45 },
  wallHex: 0xf5e6d3,
  awningHex: 0x92400e,
  masterShirtHex: '#B45309',
} as const;

export interface WoodMasterCatalogItem {
  kind: WoodOrderKind;
  name: string;
  description: string;
  priceCents: number;
  durationSec: number;
}

export const WOOD_MASTER_CATALOG: WoodMasterCatalogItem[] = [
  {
    kind: 'chair',
    name: 'Wooden Cafe Chair',
    description:
      'Sturdy hand-carved cafe chair to place on sidewalks or inside rented shops.',
    priceCents: CHAIR_PRICE_CENTS,
    durationSec: 15,
  },
  {
    kind: 'table',
    name: 'Wooden Cafe Table',
    description:
      'Handcrafted cafe table so guests sit together and relax longer.',
    priceCents: TABLE_PRICE_CENTS,
    durationSec: 30,
  },
  {
    kind: 'shop_kitchen',
    name: 'Shop Kitchen Counter',
    description:
      'Full carpentry & steel cafe kitchen (Kettle, Cups, Trays & Bins) built for an empty rented shop.',
    priceCents: SHOP_KITCHEN_PRICE_CENTS,
    durationSec: 90,
  },
  {
    kind: 'snacks_cart',
    name: '2nd Readi: Samosa & Pakora Cart',
    description:
      'Custom 4-wheel frying Readi with Hot Oil Kadhai, Plate shelf & 2 Showcase trays (+starter Samosa, Pakora & Oil).',
    priceCents: SNACKS_CART_PRICE_CENTS,
    durationSec: 180,
  },
  {
    kind: 'cold_cart',
    name: '3rd Readi: Cold Drinks & Ice Cream Cart',
    description:
      'Chilled 4-wheel freezer Readi with Ice Blocks Box, Soda Crate, Ice Cream Tub, Cones & Chiller (+starter Cold Stock).',
    priceCents: COLD_CART_PRICE_CENTS,
    durationSec: 150,
  },
  {
    kind: 'chai_stall',
    name: 'Main 4-Wheel Chai Readi',
    description:
      'Hand-built roadside Chai Readi cart with Kettle, Cup basket & 4 Free Spaces.',
    priceCents: CHAI_STALL_PRICE_CENTS,
    durationSec: 90,
  },
];

export const SHOP_WEEK_DAYS = 7;

// Interactive spots inside the Supermarket
export const SUPERMARKET_COUNTER_POS = { x: 6.2, z: -7.15 };
export const SUPERMARKET_AISLE_POS = { x: 10.0, z: -6.95 };
export const SUPERMARKET_FURNITURE_POS = { x: 10.6, z: -4.9 };
export const SUPERMARKET_PICKUP_POS = { x: 5.15, z: -4.45 };

// Vehicles on Road / Curb
export const MILKMAN_PARK_POS = { x: -5.6, z: 2.45 };
export const MILKMAN_PARK_DURATION = 52;
export const CAR_PARK_POS = { x: -1.2, z: 3.95 };

// Walk-up customers stand cleanly spaced along front sidewalk (clear of stall items & pedestrians)
export const CUSTOMER_SLOTS = [
  { x: -5.25, z: 1.02 },
  { x: -3.35, z: 1.02 },
  { x: -1.45, z: 1.02 },
  { x: 0.45, z: 1.02 },
  { x: -6.45, z: 1.02 },
  { x: 1.55, z: 1.02 },
] as const;

// Walk-up slots in front of 2nd Readi (Samosa & Pakora Cart)
export const SNACK_CUSTOMER_SLOTS = [
  { x: -12.6, z: 1.02 },
  { x: -10.2, z: 1.02 },
  { x: -13.9, z: 1.02 },
] as const;

// Walk-up slots in front of 3rd Readi (Cold Drinks & Ice Cream Cart)
export const COLD_CUSTOMER_SLOTS = [
  { x: 8.3, z: 1.02 },
  { x: 9.8, z: 1.02 },
  { x: 11.3, z: 1.02 },
] as const;

// Spot where the Supermarket Owner stands when ordering Chai/Doodh Patti/Snacks
export const OWNER_STALL_SPOT = { x: 2.25, z: 1.02 };

// Spots where visiting neighborhood Shop Owners, Gear Buyer & Wood Master stand when ordering
export const SHOP_VISITOR_SLOTS = [
  { x: 3.15, z: 0.95 },
  { x: -7.15, z: 0.95 },
  { x: 4.15, z: 0.95 },
  { x: -8.25, z: 0.95 },
  { x: -14.85, z: 0.95 },
] as const;

// Visiting Poor Beggar Kids (go straight to the matching Readi, wait 2 minutes, then market on sidewalks!)
export const BEGGAR_KID_WAIT_SECONDS = 120; // 2 minutes wait
export const BEGGAR_KID_SALES_BOOST_PER_HELP = 10; // +10% per kid helped
export const BEGGAR_KID_MAX_SALES_BOOST = 50; // Up to +50% sales boost
export const BEGGAR_KID_SLOTS = [
  { x: -4.3, z: 0.36 },
  { x: -0.5, z: 0.36 },
] as const;

export const BEGGAR_SNACK_SLOTS = [
  { x: -12.4, z: 0.36 },
  { x: -10.2, z: 0.36 },
] as const;

export const BEGGAR_COLD_SLOTS = [
  { x: 8.5, z: 0.36 },
  { x: 11.0, z: 0.36 },
] as const;

// Random sidewalk positions (left, right, near, far) where helped poor kids walk and market to passersby
export const BEGGAR_MARKETING_SPOTS = [
  { x: -16.8, z: 0.88, label: 'Far Left Plaza' },
  { x: -14.6, z: 1.12, label: 'Samosa Readi Left' },
  { x: -8.0, z: 0.92, label: 'Between Stalls' },
  { x: -6.4, z: 1.15, label: 'Chai Readi Left' },
  { x: 2.6, z: 1.1, label: 'Chai Readi Right' },
  { x: 5.8, z: 0.95, label: 'Market Front' },
  { x: 13.6, z: 1.08, label: 'Cold Readi Right' },
  { x: 17.5, z: 0.95, label: 'Far Right Lane' },
] as const;

export const DRINK_CATALOG: Record<
  DrinkType,
  {
    id: DrinkType;
    name: string;
    priceCents: number;
    unlockCostCents: number;
    requiresLevel2: boolean;
    isSnack?: boolean;
    isFriedSnack?: boolean;
    isColdItem?: boolean;
    summary: string;
    steps: string[];
  }
> = {
  tea: {
    id: 'tea',
    name: 'Simple Chai',
    priceCents: 50,
    unlockCostCents: 0,
    requiresLevel2: false,
    summary: 'Classic roadside spiced tea brewed with water, tea leaves & sugar.',
    steps: [
      'Take a Disposable Cup from the Cup Basket on Chai Readi (E).',
      'Add Tea Leaves (E) and Sugar (E).',
      'Add Water at the Readi Water Jug (E). (Refill free at the Water Tap on the sidewalk!)',
      'Boil at the Kettle Stove (E) and grab Hot Simple Chai.',
      'Serve to customer or place on Readi Free Space for auto-pickup ($0.50)!',
    ],
  },
  doodh_patti: {
    id: 'doodh_patti',
    name: 'Doodh Patti',
    priceCents: 100, // $1.00!
    unlockCostCents: 300, // $3.00 recipe purchase
    requiresLevel2: true,
    summary: 'Rich creamy milk tea — only Milk, Sugar, Tea Leaves & Cup (no water needed!).',
    steps: [
      'Buy fresh Milk Packets from the Milkman on Motorcycle (E when parked).',
      'Take a Disposable Cup -> Add Tea Leaves -> Add Sugar.',
      'Add a Milk Packet at the Readi Milk Crate (E) — no water needed!',
      'Boil at the Kettle Stove (E) -> Hot Doodh Patti!',
      'Serve to customer or place on Free Space ($1.00)!',
    ],
  },
  coffee: {
    id: 'coffee',
    name: 'Street Coffee',
    priceCents: 110,
    unlockCostCents: 450, // $4.50 recipe purchase
    requiresLevel2: true,
    summary: 'Strong roasted coffee brewed with coffee beans, sugar & hot water.',
    steps: [
      'Walk into the Supermarket on the right and buy Roasted Coffee Beans (E).',
      'Take a Disposable Cup -> Add Coffee Beans (E) -> Add Sugar (E).',
      'Add Water at the Readi Water Jug (E), then Boil on Kettle (E).',
      'Serve to customer or car (E) for $1.10!',
    ],
  },
  biscuit_pack: {
    id: 'biscuit_pack',
    name: 'Tea Biscuits',
    priceCents: 30,
    unlockCostCents: 0,
    requiresLevel2: false,
    isSnack: true,
    summary: 'Crisp chai-time biscuit pack ($0.30). Customers only order this when you stock it!',
    steps: [
      'Buy Tea Biscuit Packs inside the Supermarket (E).',
      'Grab a Biscuit Pack from the Biscuit Box on your Chai Readi (E).',
      'Serve to customer or set on Free Space for self-serve ($0.30)!',
    ],
  },
  cupcake: {
    id: 'cupcake',
    name: 'Mini Cupcake',
    priceCents: 40,
    unlockCostCents: 0,
    requiresLevel2: false,
    isSnack: true,
    summary: 'Soft bakery mini cupcake ($0.40). Customers only order this when you stock it!',
    steps: [
      'Buy Mini Cupcakes inside the Supermarket (E).',
      'Grab a Mini Cupcake from the Cupcake Box on your Chai Readi (E).',
      'Serve to customer or set on Free Space for self-serve ($0.40)!',
    ],
  },
  samosa: {
    id: 'samosa',
    name: 'Aloo Samosa',
    priceCents: 80,
    unlockCostCents: SNACKS_RECIPE_PRICE_CENTS,
    requiresLevel2: false,
    isFriedSnack: true,
    summary: 'Crispy golden potato samosa ($0.80) fried fresh on the 2nd Snacks Readi!',
    steps: [
      'Buy this Samosa & Pakora Recipe first, then order the 2nd Snacks Readi ($12.00) from Wood Master Workshop!',
      'Stock Aloo Samosa Packs & Cooking Oil inside the Supermarket (E).',
      'On the 2nd Readi: Take a Paper Plate (E) -> Add Aloo Samosa Pastry (E).',
      'Fry in the Hot Oil Kadhai (E) until golden, then take Hot Aloo Samosa!',
      'Serve to customer or place in Showcase Free Space for auto-pickup ($0.80)!',
    ],
  },
  pakora: {
    id: 'pakora',
    name: 'Crispy Pakora',
    priceCents: 70,
    unlockCostCents: SNACKS_RECIPE_PRICE_CENTS,
    requiresLevel2: false,
    isFriedSnack: true,
    summary: 'Spiced besan vegetable pakoras ($0.70) fried crisp on the 2nd Snacks Readi!',
    steps: [
      'Unlocked together with the Samosa & Pakora Recipe!',
      'Stock Besan Pakora Mix & Cooking Oil inside the Supermarket (E).',
      'On the 2nd Readi: Take a Paper Plate (E) -> Scoop Besan Pakora Mix (E).',
      'Fry in the Hot Oil Kadhai (E), then serve or place on Showcase ($0.70)!',
    ],
  },
  cold_drink: {
    id: 'cold_drink',
    name: 'Chilled Cold Drink',
    priceCents: 75,
    unlockCostCents: COLD_RECIPE_PRICE_CENTS,
    requiresLevel2: false,
    isColdItem: true,
    summary: 'Ice-cold soda bottle ($0.75) chilled over crushed Ice Blocks on the 3rd Cold Readi!',
    steps: [
      'Buy Cold Drinks & Ice Cream Recipe inside Supermarket, then order 3rd Cold Readi at Wood Master!',
      'Stock Cold Drink Bottles & Ice Blocks inside Supermarket (E).',
      'On 3rd Readi: Take Cold Drink Bottle (E) -> Add Crushed Ice Block (E) -> Chill in Freezer Chiller (E).',
      'Serve to customer or place in Cold Showcase ($0.75)!',
    ],
  },
  ice_cream: {
    id: 'ice_cream',
    name: 'Scoop Ice Cream',
    priceCents: 90,
    unlockCostCents: COLD_RECIPE_PRICE_CENTS,
    requiresLevel2: false,
    isColdItem: true,
    summary: 'Creamy waffle cone Ice Cream ($0.90) churned & frozen with Ice Blocks on the 3rd Cold Readi!',
    steps: [
      'Unlocked together with Cold Drinks & Ice Cream Recipe!',
      'Stock Waffle Cones, Ice Cream Mix & Ice Blocks inside Supermarket (E).',
      'On 3rd Readi: Take Waffle Cone (E) -> Add Ice Cream Mix (E) -> Pack Ice Block (E) -> Freeze in Chiller (E).',
      'Serve to customer or place in Cold Showcase ($0.90)!',
    ],
  },
};

export const HELD_ITEM_LABELS: Record<Exclude<HeldItem, null>, string> = {
  empty_cup: 'Disposable Cup',
  cup_with_tea: 'Cup + Tea Leaves',
  cup_with_tea_sugar: 'Cup + Tea & Sugar',
  cup_with_tea_water: 'Chai Mix + Water (Ready to Boil)',
  cup_with_doodh_patti_mix: 'Doodh Patti Mix (Ready to Boil)',
  cup_with_coffee: 'Cup + Coffee Beans',
  cup_with_coffee_sugar: 'Cup + Coffee & Sugar',
  cup_with_coffee_water: 'Coffee Mix + Water (Ready to Boil)',
  hot_tea: 'Hot Simple Chai ($0.50)',
  hot_doodh_patti: 'Hot Doodh Patti ($1.00)',
  hot_coffee: 'Hot Coffee ($1.10)',
  biscuit_pack: 'Tea Biscuits Pack ($0.30)',
  cupcake: 'Mini Cupcake ($0.40)',
  paper_plate: 'Paper Plate (For Samosa/Pakora)',
  raw_samosa: 'Raw Samosa on Plate (Fry in Kadhai)',
  raw_pakora: 'Raw Pakora Batter (Fry in Kadhai)',
  hot_samosa: 'Hot Aloo Samosa ($0.80)',
  hot_pakora: 'Hot Crispy Pakora ($0.70)',
  cold_bottle: 'Warm Soda Bottle (Add Ice)',
  cold_bottle_iced: 'Bottle + Crushed Ice (Put in Chiller)',
  chilled_cold_drink: 'Chilled Cold Drink ($0.75)',
  empty_cone: 'Waffle Cone (Add Ice Cream Mix)',
  cone_with_mix: 'Cone + Soft Mix (Pack Ice Block)',
  iced_cream_mix: 'Cone + Mix & Ice (Freeze in Chiller)',
  ready_ice_cream: 'Scoop Ice Cream ($0.90)',
  carried_chair: 'Wooden Cafe Chair (Place with E)',
  carried_table: 'Wooden Cafe Table (Place with E)',
};

export function heldHotDrinkType(item: HeldItem): DrinkType | null {
  if (item === 'hot_tea') return 'tea';
  if (item === 'hot_doodh_patti') return 'doodh_patti';
  if (item === 'hot_coffee') return 'coffee';
  if (item === 'biscuit_pack') return 'biscuit_pack';
  if (item === 'cupcake') return 'cupcake';
  if (item === 'hot_samosa') return 'samosa';
  if (item === 'hot_pakora') return 'pakora';
  if (item === 'chilled_cold_drink') return 'cold_drink';
  if (item === 'ready_ice_cream') return 'ice_cream';
  return null;
}

export function heldFurnitureKind(item: HeldItem): FurnitureKind | null {
  if (item === 'carried_chair') return 'chair';
  if (item === 'carried_table') return 'table';
  return null;
}

export function isSwappableCounterItem(item: HeldItem): boolean {
  return item !== null && heldFurnitureKind(item) === null;
}

export function drinkToHotItem(drink: DrinkType): Exclude<HeldItem, null> {
  if (drink === 'doodh_patti') return 'hot_doodh_patti';
  if (drink === 'coffee') return 'hot_coffee';
  if (drink === 'biscuit_pack') return 'biscuit_pack';
  if (drink === 'cupcake') return 'cupcake';
  if (drink === 'samosa') return 'hot_samosa';
  if (drink === 'pakora') return 'hot_pakora';
  if (drink === 'cold_drink') return 'chilled_cold_drink';
  if (drink === 'ice_cream') return 'ready_ice_cream';
  return 'hot_tea';
}

export interface SupermarketItem {
  id: string;
  category: 'supplies' | 'snacks' | 'cups' | 'furniture';
  name: string;
  description: string;
  priceCents: number;
  addCups: number;
  addTea: number;
  addSugar: number;
  addCoffee: number;
  addBiscuits: number;
  addCupcakes: number;
  addSamosaMix?: number;
  addPakoraMix?: number;
  addCookingOil?: number;
  addIceBlocks?: number;
  addColdDrinks?: number;
  addIceCreamMix?: number;
  addIceCreamCones?: number;
  addFurniture?: FurnitureKind;
  requiresCoffeeRecipe?: boolean;
  requiresSnacksRecipe?: boolean;
  requiresColdRecipe?: boolean;
}

export const SUPERMARKET_CATALOG: SupermarketItem[] = [
  // Tea, Sugar & Coffee Ingredients
  {
    id: 'tea_12',
    category: 'supplies',
    name: 'Tea Leaves Tin (+12)',
    description: 'Fragrant loose tea leaves for 12 cups of Chai or Doodh Patti.',
    priceCents: 110,
    addCups: 0,
    addTea: 12,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
  },
  {
    id: 'sugar_12',
    category: 'supplies',
    name: 'Cane Sugar Bag (+12)',
    description: 'Fine sugar for 12 sweet cups.',
    priceCents: 70,
    addCups: 0,
    addTea: 0,
    addSugar: 12,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
  },
  {
    id: 'tea_sugar_combo',
    category: 'supplies',
    name: 'Tea + Sugar Value Pack',
    description: '+15 Tea Leaves and +15 Sugar for busy shifts.',
    priceCents: 195,
    addCups: 0,
    addTea: 15,
    addSugar: 15,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
  },
  {
    id: 'coffee_10',
    category: 'supplies',
    name: 'Roasted Coffee Beans (+10)',
    description: 'Aromatic roasted coffee for 10 Street Coffee cups.',
    priceCents: 150,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 10,
    addBiscuits: 0,
    addCupcakes: 0,
    requiresCoffeeRecipe: true,
  },
  {
    id: 'samosa_10',
    category: 'supplies',
    name: 'Aloo Samosa Pastry Pack (+10)',
    description: 'Spiced potato pastry triangles for your 2nd Readi (sell for $0.80 each!).',
    priceCents: 120,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addSamosaMix: 10,
    requiresSnacksRecipe: true,
  },
  {
    id: 'pakora_10',
    category: 'supplies',
    name: 'Besan Pakora Batter Mix (+10)',
    description: 'Gram-flour & onion spice mix for crispy Pakoras (sell for $0.70 each!).',
    priceCents: 100,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addPakoraMix: 10,
    requiresSnacksRecipe: true,
  },
  {
    id: 'oil_12',
    category: 'supplies',
    name: 'Kadhai Cooking Oil Bottle (+12)',
    description: 'Golden frying oil for 12 batches of Samosas & Pakoras.',
    priceCents: 90,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addCookingOil: 12,
    requiresSnacksRecipe: true,
  },
  // Cold Drinks, Ice Cream & Ice Blocks
  {
    id: 'ice_12',
    category: 'supplies',
    name: 'Crystal Ice Blocks Pack (+12)',
    description: 'Essential crushed & solid Ice Blocks for chilling Cold Drinks and Ice Cream.',
    priceCents: 80,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addIceBlocks: 12,
    requiresColdRecipe: true,
  },
  {
    id: 'soda_10',
    category: 'supplies',
    name: 'Cold Drink Bottles Crate (+10)',
    description: '10 fizzy soda bottles chilled on the 3rd Readi (sell for $0.75 each!).',
    priceCents: 110,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addColdDrinks: 10,
    requiresColdRecipe: true,
  },
  {
    id: 'icecream_mix_10',
    category: 'supplies',
    name: 'Creamy Ice Cream Mix Tub (+10)',
    description: 'Rich vanilla & mango dairy base for 10 Scoop Ice Creams ($0.90 each!).',
    priceCents: 130,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addIceCreamMix: 10,
    requiresColdRecipe: true,
  },
  {
    id: 'cones_12',
    category: 'supplies',
    name: 'Crispy Waffle Cones Sleeve (+12)',
    description: '12 golden waffle cones for Scoop Ice Cream.',
    priceCents: 75,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addIceCreamCones: 12,
    requiresColdRecipe: true,
  },
  // Snacks: Tea Biscuits & Mini Cupcakes
  {
    id: 'biscuit_6',
    category: 'snacks',
    name: '6 Tea Biscuit Packs',
    description: 'Popular Rs.20 style crispy biscuit packs — sell for $0.30 each!',
    priceCents: 90,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 6,
    addCupcakes: 0,
  },
  {
    id: 'biscuit_12',
    category: 'snacks',
    name: '12 Tea Biscuit Packs Box',
    description: 'Value carton of 12 biscuit packs (sell for $0.30 each).',
    priceCents: 165,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 12,
    addCupcakes: 0,
  },
  {
    id: 'cupcake_6',
    category: 'snacks',
    name: '6 Mini Cupcakes',
    description: 'Fresh frosted bakery cupcakes — sell for $0.40 each!',
    priceCents: 120,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 6,
  },
  {
    id: 'cupcake_12',
    category: 'snacks',
    name: '12 Mini Cupcakes Tray',
    description: 'Full bakery tray of 12 mini cupcakes (sell for $0.40 each).',
    priceCents: 220,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 12,
  },
  // Disposable Cups
  {
    id: 'cups_10',
    category: 'cups',
    name: '10 Disposable Cups',
    description: 'Stack of 10 sturdy paper cups for your Readi basket.',
    priceCents: 100,
    addCups: 10,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
  },
  {
    id: 'cups_20',
    category: 'cups',
    name: '20 Disposable Cups',
    description: 'Full sleeve of 20 cups at supermarket discount.',
    priceCents: 180,
    addCups: 20,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
  },
  {
    id: 'cups_40',
    category: 'cups',
    name: '40 Bulk Disposable Cups',
    description: 'Two full sleeves of 40 disposable cups.',
    priceCents: 330,
    addCups: 40,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
  },
];

export interface MilkmanCatalogItem {
  id: 'milk_6' | 'milk_12' | 'milk_20';
  name: string;
  description: string;
  priceCents: number;
  addMilk: number;
}

export const MILKMAN_CATALOG: MilkmanCatalogItem[] = [
  {
    id: 'milk_6',
    name: '6 Fresh Milk Packets',
    description: 'Fresh milk for 6 rich cups of $1.00 Doodh Patti.',
    priceCents: 150,
    addMilk: 6,
  },
  {
    id: 'milk_12',
    name: '12 Fresh Milk Packets',
    description: 'Morning crate of 12 fresh milk packets.',
    priceCents: 260,
    addMilk: 12,
  },
  {
    id: 'milk_20',
    name: '20 Bulk Milk Packets',
    description: 'Full milkman crate for busy Level 2 shifts.',
    priceCents: 400,
    addMilk: 20,
  },
];

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
