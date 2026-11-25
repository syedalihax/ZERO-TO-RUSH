export type DrinkType =
  | 'tea'
  | 'doodh_patti'
  | 'coffee'
  | 'biscuit_pack'
  | 'cupcake'
  | 'samosa'
  | 'pakora';

export type FurnitureKind = 'chair' | 'table';

export interface CafeFurniture {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  rotationY: number;
}

export type HeldItem =
  | 'empty_cup'
  | 'cup_with_tea'
  | 'cup_with_tea_sugar'
  | 'cup_with_tea_water'
  | 'cup_with_doodh_patti_mix'
  | 'cup_with_coffee'
  | 'cup_with_coffee_sugar'
  | 'cup_with_coffee_water'
  | 'hot_tea'
  | 'hot_doodh_patti'
  | 'hot_coffee'
  | 'biscuit_pack'
  | 'cupcake'
  | 'paper_plate'
  | 'raw_samosa'
  | 'raw_pakora'
  | 'hot_samosa'
  | 'hot_pakora'
  | 'carried_chair'
  | 'carried_table'
  | null;

export interface InventoryState {
  cups: number;
  teaLeaves: number;
  sugar: number;
  water: number;
  milkPackets: number;
  coffeePowder: number;
  biscuits: number;
  cupcakes: number;
  samosaMix: number;
  pakoraMix: number;
  cookingOil: number;
}

export interface KettleState {
  status: 'idle' | 'brewing' | 'ready';
  progress: number; // 0..1
  brewingDrink: DrinkType | null;
}

export interface FryerState {
  status: 'idle' | 'frying' | 'ready';
  progress: number; // 0..1
  fryingSnack: 'samosa' | 'pakora' | null;
}

export type HelperTask =
  | 'idle'
  | 'fetching_cup'
  | 'adding_base'
  | 'adding_sugar'
  | 'adding_liquid'
  | 'to_kettle'
  | 'waiting_boil'
  | 'serving';

export interface HelperKidState {
  x: number;
  z: number;
  yaw: number;
  walkCycle: number;
  status: 'sitting' | 'hired';
  charityGivenToday: boolean;
  task: HelperTask;
  targetDrink: 'tea' | 'doodh_patti' | 'coffee' | null;
  targetCustomerId: string | null;
  holding: HeldItem;
  actionTimer: number;
  servedCount: number;
  wageEarnedCents: number;
  statusNote: string | null;
}

export interface MilkmanState {
  phase: 'away' | 'arriving' | 'parked' | 'departing';
  timer: number;
  x: number;
  z: number;
  nextArrivalElapsed: number;
}

export interface CarCustomerState {
  phase: 'away' | 'arriving' | 'waiting' | 'leaving';
  x: number;
  z: number;
  orderDrink: DrinkType;
  qtyTotal: 1 | 2;
  qtyServed: number;
  patience: number;
  maxPatience: number;
  nextArrivalElapsed: number;
  carColor: string;
}

export interface SupermarketOwnerState {
  x: number;
  z: number;
  yaw: number;
  phase:
    | 'patrol_inside'
    | 'stroll_outside'
    | 'walking_to_stall'
    | 'ordering_chai'
    | 'drinking_chai'
    | 'returning_to_store';
  targetX: number;
  targetZ: number;
  waitTimer: number;
  nextVisitTimer: number;
  orderDrink: 'tea' | 'doodh_patti';
  patience: number;
  maxPatience: number;
  drinkTimer: number;
  walkCycle: number;
}

export interface TeaCustomer {
  id: string;
  seq: number;
  slotIndex: number;
  x: number;
  z: number;
  yaw?: number;
  targetX: number;
  targetZ: number;
  status: 'walking_in' | 'waiting' | 'drinking' | 'walking_out';
  orderDrink: DrinkType;
  patience: number;
  maxPatience: number;
  drinkTimer: number;
  walkCycle: number;
  shirtColor: string;
  hairColor: string;
  targetChairId?: string | null;
  seatedChairId?: string | null;
  selfServeWait?: number;
}

export interface FootpathPedestrian {
  id: string;
  seq: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  yaw: number;
  speed: number;
  walkCycle: number;
  shirtColor: string;
  hairColor: string;
  hasBag: boolean;
}

export interface Player3DState {
  x: number;
  z: number;
  yaw: number;
  holding: HeldItem;
  walkCycle: number;
  dashCooldown: number;
  dashTimer: number;
  isMoving: boolean;
  sittingChairId?: string | null;
}

export type InteractTargetKind =
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
  | 'buy_snacks_cart'
  | 'helper_kid'
  | 'building_owner'
  | 'trash'
  | 'water_tap'
  | 'supermarket'
  | 'supermarket_pickup'
  | 'furniture_chair'
  | 'furniture_table'
  | 'place_furniture'
  | 'stand_up'
  | 'customer'
  | 'owner_customer'
  | 'car'
  | 'milkman'
  | null;

export type ShopBuildingId = 'west_shop' | 'center_shop' | 'east_shop';

export interface RentedShopRecord {
  buildingId: ShopBuildingId;
  rentedOnDay: number;
  nextRentDueDay: number;
  weeksPaid: number;
}

export interface ShiftSnapshot {
  stage: 1 | 2;
  day: number;
  timeLeft: number; // 300s = 5 min
  shiftDuration: number;
  earningsCents: number;
  servedCount: number;
  missedCount: number;
  player: Player3DState;
  trayItem: HeldItem;
  trayItems: HeldItem[];
  snackTrayItems: HeldItem[];
  inventory: InventoryState;
  kettle: KettleState;
  fryer: FryerState;
  helper: HelperKidState;
  milkman: MilkmanState;
  carCustomer: CarCustomerState;
  supermarketOwner: SupermarketOwnerState;
  customers: TeaCustomer[];
  pedestrians: FootpathPedestrian[];
  spawnTimer: number;
  pedestrianSpawnTimer: number;
  nextCustomerSeq: number;
  phase: 'playing' | 'day_complete';
}

export interface WorldSave {
  id: string;
  name: string;
  stage: 1 | 2;
  createdAt: number;
  lastPlayedAt: number;
  day: number;
  cashCents: number;
  totalServed: number;
  unlockedRecipes: DrinkType[];
  hasSnacksCart: boolean;
  rentedShops: RentedShopRecord[];
  furniture: CafeFurniture[];
  pendingFurniture: FurnitureKind[];
  activeShift: ShiftSnapshot | null;
}

export interface Stage1Input {
  dx: number;
  dz: number;
  interactJustPressed: boolean;
  offerRejectJustPressed: boolean;
  dashJustPressed: boolean;
}

export type SoundEventType =
  | 'pickup'
  | 'pour'
  | 'boil_done'
  | 'serve'
  | 'buy'
  | 'car_horn'
  | 'bike_bell'
  | 'level_up'
  | 'angry'
  | 'dash'
  | 'day_end'
  | 'error';

export interface SimStepEvents {
  sounds: SoundEventType[];
  openSupermarket: boolean;
  openMilkmanShop: boolean;
  openHelperModal: boolean;
  openBuildingOwnerId: ShopBuildingId | null;
  openCustomerAction: {
    kind: 'customer' | 'car';
    id: string;
    requestedDrink: DrinkType;
  } | null;
  feedbackText: string | null;
  feedbackColor: string;
  leveledUpTo2: boolean;
}

export interface ProjectedLabel {
  id: string;
  kind:
    | 'customer'
    | 'owner'
    | 'helper'
    | 'building_owner'
    | 'car'
    | 'kettle'
    | 'fryer'
    | 'milkman'
    | 'supermarket'
    | 'supermarket_pickup'
    | 'snacks_plot'
    | 'water_tap'
    | 'trash'
    | 'counter_tray';
  x: number;
  y: number;
  visible: boolean;
  text: string;
  subText?: string;
  progress?: number;
  urgent?: boolean;
}
