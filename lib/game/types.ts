export type DrinkType =
  | 'tea'
  | 'doodh_patti'
  | 'coffee'
  | 'biscuit_pack'
  | 'cupcake'
  | 'samosa'
  | 'pakora'
  | 'cold_drink'
  | 'ice_cream';

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
  | 'cold_bottle'
  | 'cold_bottle_iced'
  | 'chilled_cold_drink'
  | 'empty_cone'
  | 'cone_with_mix'
  | 'iced_cream_mix'
  | 'ready_ice_cream'
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
  iceBlocks: number;
  coldDrinkBottles: number;
  iceCreamMix: number;
  iceCreamCones: number;
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

export interface ChillerState {
  status: 'idle' | 'chilling' | 'ready';
  progress: number; // 0..1
  chillingItem: 'cold_drink' | 'ice_cream' | null;
}

export type HelperTask =
  | 'idle'
  | 'fetching_cup'
  | 'adding_base'
  | 'adding_sugar'
  | 'adding_liquid'
  | 'to_kettle'
  | 'waiting_boil'
  | 'fetching_biscuit'
  | 'fetching_cupcake'
  | 'fetching_plate'
  | 'prepping_snack'
  | 'to_kadhai'
  | 'waiting_fry'
  | 'fetching_soda'
  | 'fetching_cone'
  | 'adding_ic_mix'
  | 'adding_ice'
  | 'to_chiller'
  | 'waiting_chill'
  | 'serving';

export type HelperNpcId = 'chotu' | 'munni' | 'babloo';

export type HelperBeggingState =
  | 'at_mat'
  | 'walking_to_stall'
  | 'begging_at_stall'
  | 'eating_free'
  | 'returning_marketing'
  | 'marketing';

export interface HelperKidState {
  id?: HelperNpcId;
  name?: string;
  role?: 'general' | 'snacks_only';
  x: number;
  z: number;
  yaw: number;
  walkCycle: number;
  status: 'sitting' | 'hired';
  charityGivenToday: boolean;
  task: HelperTask;
  targetDrink: DrinkType | null;
  targetCustomerId: string | null;
  holding: HeldItem;
  actionTimer: number;
  servedCount: number;
  wageEarnedCents: number;
  statusNote: string | null;
  beggingState?: HelperBeggingState;
  beggingDrink?: DrinkType | null;
  beggingPatience?: number;
  beggingMaxPatience?: number;
  beggingEatTimer?: number;
  hungerTimer?: number;
  marketingTimer?: number;
  marketingCallTimer?: number;
  heldByHelperName?: string | null;
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
  orderDrink: DrinkType;
  patience: number;
  maxPatience: number;
  drinkTimer: number;
  walkCycle: number;
}

export type ShopVisitorId =
  | 'west_owner'
  | 'center_owner'
  | 'east_owner'
  | 'gear_buyer'
  | 'wood_master';

export interface ShopVisitorState {
  id: ShopVisitorId;
  name: string;
  roleLabel: string;
  x: number;
  z: number;
  yaw: number;
  homeX: number;
  homeZ: number;
  homeYaw: number;
  doorX: number;
  doorZ: number;
  counterX: number;
  counterZ: number;
  phase:
    | 'at_shop'
    | 'walking_to_stall'
    | 'ordering'
    | 'eating_drinking'
    | 'returning_to_shop';
  targetX: number;
  targetZ: number;
  nextVisitTimer: number;
  orderDrink: DrinkType;
  patience: number;
  maxPatience: number;
  drinkTimer: number;
  walkCycle: number;
  shirtColor: string;
  hairColor: string;
}

export interface BeggarKidCustomer {
  id: string;
  seq: number;
  slotIndex: number;
  x: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  status: 'walking_in' | 'waiting' | 'eating' | 'marketing' | 'walking_out';
  orderDrink: DrinkType;
  patience: number;
  maxPatience: number;
  eatTimer: number;
  walkCycle: number;
  shirtColor: string;
  hairColor: string;
  heldByHelperName?: string | null;
  marketingTimer?: number;
  marketingMoveTimer?: number;
  marketingCallTimer?: number;
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
  | 'soda_crate'
  | 'cone_stack'
  | 'icecream_tub'
  | 'ice_box'
  | 'chiller'
  | 'cold_tray'
  | 'buy_cold_cart'
  | 'helper_kid'
  | 'beggar_helper'
  | 'building_owner'
  | 'gear_buyer'
  | 'trash'
  | 'water_tap'
  | 'supermarket'
  | 'supermarket_pickup'
  | 'wood_master'
  | 'wood_master_pickup'
  | 'furniture_chair'
  | 'furniture_table'
  | 'place_furniture'
  | 'stand_up'
  | 'customer'
  | 'owner_customer'
  | 'shop_visitor'
  | 'beggar_kid'
  | 'car'
  | 'milkman'
  | null;

export type ShopBuildingId = 'west_shop' | 'center_shop' | 'east_shop';

export type WoodOrderKind =
  | 'chair'
  | 'table'
  | 'shop_kitchen'
  | 'snacks_cart'
  | 'cold_cart'
  | 'chai_stall';

export interface WoodMasterOrder {
  id: string;
  kind: WoodOrderKind;
  label: string;
  priceCents: number;
  durationSec: number;
  remainingSec: number;
  status: 'building' | 'ready';
  targetShopId?: ShopBuildingId;
  notified?: boolean;
}

export interface Player2State extends Player3DState {
  active: boolean;
}

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
  player2?: Player2State;
  trayItem: HeldItem;
  trayItems: HeldItem[];
  snackTrayItems: HeldItem[];
  coldTrayItems?: HeldItem[];
  inventory: InventoryState;
  kettle: KettleState;
  fryer: FryerState;
  chiller?: ChillerState;
  helper: HelperKidState;
  helpers?: HelperKidState[];
  milkman: MilkmanState;
  carCustomer: CarCustomerState;
  supermarketOwner: SupermarketOwnerState;
  shopVisitors?: ShopVisitorState[];
  beggarKids?: BeggarKidCustomer[];
  beggarSpawnTimer?: number;
  beggarKidsHelped?: number;
  salesBoostPercent?: number;
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
  disabledMenuItems?: DrinkType[];
  hasTeaStall?: boolean;
  hasSnacksCart: boolean;
  hasColdCart?: boolean;
  rentedShops: RentedShopRecord[];
  shopKitchens?: ShopBuildingId[];
  woodOrders?: WoodMasterOrder[];
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
  openHelperId?: HelperNpcId | null;
  openGearBuyer: boolean;
  openWoodMaster?: boolean;
  openModalActor?: 'p1' | 'p2';
  openBuildingOwnerId: ShopBuildingId | null;
  openCustomerAction: {
    kind:
      | 'customer'
      | 'car'
      | 'owner_customer'
      | 'shop_visitor'
      | 'beggar_kid'
      | 'beggar_helper';
    id: string;
    requestedDrink: DrinkType;
    actorId?: 'p1' | 'p2';
    npcLabel?: string;
    isFreeHelp?: boolean;
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
    | 'shop_visitor'
    | 'beggar_kid'
    | 'helper'
    | 'building_owner'
    | 'gear_buyer'
    | 'wood_master'
    | 'coop_partner'
    | 'car'
    | 'kettle'
    | 'fryer'
    | 'chiller'
    | 'milkman'
    | 'supermarket'
    | 'supermarket_pickup'
    | 'snacks_plot'
    | 'cold_plot'
    | 'water_tap'
    | 'trash'
    | 'counter_tray'
    | 'out_of_stock';
  x: number;
  y: number;
  visible: boolean;
  text: string;
  subText?: string;
  progress?: number;
  urgent?: boolean;
}
