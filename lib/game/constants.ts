import type { DrinkType, FurnitureKind, HeldItem } from './types.ts';

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

// Helper Kid ("Chotu") sitting outside Supermarket
export const HELPER_CHARITY_CENTS = 25; // $0.25 charity
export const HELPER_WAGE_CENTS = 15; // $0.15 wage paid per customer served for 1 day
export const KID_SIT_POS = { x: 9.2, z: -3.08 };
export const HELPER_IDLE_SPOT = { x: -2.2, z: -2.45 };

// 2nd Readi: Samosa & Pakora Cart on expanded left plaza
export const SNACKS_RECIPE_PRICE_CENTS = 350; // $3.50 to learn Samosa & Pakora recipe first
export const SNACKS_CART_PRICE_CENTS = 1200; // $12.00 to buy 2nd Readi
export const FRYING_DURATION = 2.4;

export const KETTLING_DURATION = 2.6;
export const PLAYER_SPEED = 4.9;
export const DASH_SPEED_MULT = 1.95;
export const DASH_DURATION = 0.18;
export const DASH_COOLDOWN = 0.85;

// Expanded outdoor sidewalk + Walk-in Buildings & Open Supermarket interior bounds
export const WORLD_BOUNDS = {
  minX: -17.2,
  maxX: 20.0,
  minZ: -9.2, // Allows walking inside ALL open street buildings & Open Supermarket
  maxZ: 5.2,
};

// Authentic Pakistani 4-Wheel Chai Readi (7.4m long x 1.64m wide/deep, centered at x = -2.2, z = -1.15)
export const CYCLE_ANCHOR = { x: -2.2, z: -1.15 };

// 2nd Readi: Samosa & Pakora Cart on expanded left plaza (4.8m long x 1.64m wide/deep)
export const SNACKS_CART_ANCHOR = { x: -11.4, z: -1.15 };

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

// All Street Buildings are Open Walk-In Shops with Owners who rent them weekly!
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
    bounds: { minX: -16.2, maxX: -9.6, minZ: -9.6, maxZ: -5.2 },
    doorMinX: -14.2,
    doorMaxX: -11.4,
    ownerPos: { x: -12.8, z: -8.15 },
    counterPos: { x: -12.8, z: -7.25 },
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
    bounds: { minX: -6.4, maxX: 1.2, minZ: -9.6, maxZ: -5.2 },
    doorMinX: -4.2,
    doorMaxX: -1.0,
    ownerPos: { x: -2.6, z: -8.15 },
    counterPos: { x: -2.6, z: -7.25 },
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
    bounds: { minX: 13.6, maxX: 19.6, minZ: -9.6, maxZ: -5.2 },
    doorMinX: 15.1,
    doorMaxX: 18.1,
    ownerPos: { x: 16.6, z: -8.15 },
    counterPos: { x: 16.6, z: -7.25 },
    wallHex: 0xe6d2bc,
    awningHex: 0x0284c7,
    ownerShirtHex: '#1D4ED8',
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

// Walk-up customers stand cleanly spaced along front sidewalk (1.9m apart, clear of stall items & pedestrians)
export const CUSTOMER_SLOTS = [
  { x: -5.25, z: 1.02 },
  { x: -3.35, z: 1.02 },
  { x: -1.45, z: 1.02 },
  { x: 0.45, z: 1.02 },
] as const;

// Walk-up slots in front of 2nd Readi (Samosa & Pakora Cart)
export const SNACK_CUSTOMER_SLOTS = [
  { x: -12.6, z: 1.02 },
  { x: -10.2, z: 1.02 },
] as const;

// Spot where the Supermarket Owner stands when ordering Chai/Doodh Patti
export const OWNER_STALL_SPOT = { x: 2.05, z: 1.02 };

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
      'Buy this Samosa & Pakora Recipe first, then buy the 2nd Snacks Readi ($12.00)!',
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
  addFurniture?: FurnitureKind;
  requiresCoffeeRecipe?: boolean;
  requiresSnacksRecipe?: boolean;
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
  // Cafe Chairs & Tables
  {
    id: 'chair_wood',
    category: 'furniture',
    name: 'Wooden Cafe Chair',
    description:
      'Carry & place anywhere on the sidewalk! Customers & you can sit on it (+longer patience).',
    priceCents: 150,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addFurniture: 'chair',
  },
  {
    id: 'table_wood',
    category: 'furniture',
    name: 'Wooden Cafe Table',
    description:
      'Carry & place beside chairs for a cozy cafe seating corner!',
    priceCents: 250,
    addCups: 0,
    addTea: 0,
    addSugar: 0,
    addCoffee: 0,
    addBiscuits: 0,
    addCupcakes: 0,
    addFurniture: 'table',
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
