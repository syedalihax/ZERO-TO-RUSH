'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHAI_STALL_PRICE_CENTS,
  CHAIR_PRICE_CENTS,
  DRINK_CATALOG,
  HELPER_CHARITY_CENTS,
  HELPER_NPCS,
  MILKMAN_CATALOG,
  RENTABLE_BUILDINGS,
  RESALE_RATE,
  SHOP_WEEK_DAYS,
  SNACKS_CART_PRICE_CENTS,
  SUPERMARKET_CATALOG,
  TABLE_PRICE_CENTS,
  WOOD_MASTER_CATALOG,
  formatMoney,
} from '@/lib/game/constants';
import { cafeAudio } from '@/lib/game/audio';
import {
  createInitialShift,
  findInteractTarget,
  findInteractTargetForPlayer,
  getAvailableMenuChoices,
  getGuidedHint,
  getShiftBeggarKids,
  getShiftHelpers,
  getShiftShopVisitors,
  isMenuItemEnabled,
  stepStage1Simulation,
} from '@/lib/game/engine';
import { loadAllWorlds, persistWorld, removeWorld } from '@/lib/game/storage';
import { Chai3DSceneController } from '@/lib/game/threeScene';
import type {
  DrinkType,
  HelperNpcId,
  ProjectedLabel,
  ShiftSnapshot,
  ShopBuildingId,
  Stage1Input,
  WoodMasterOrder,
  WoodOrderKind,
  WorldSave,
} from '@/lib/game/types';
import { useIsMobile } from '@/hooks/use-mobile';
import BuildingRentModal from './BuildingRentModal';
import CoopInviteModal from './CoopInviteModal';
import CustomerActionModal from './CustomerActionModal';
import GameHUD from './GameHUD';
import GearBuyerModal from './GearBuyerModal';
import KidHelperModal from './KidHelperModal';
import MilkmanShopModal from './MilkmanShopModal';
import PauseModal from './PauseModal';
import SalesMenuModal from './SalesMenuModal';
import SupermarketModal from './SupermarketModal';
import TitleScreen from './TitleScreen';
import UpgradeShopModal from './UpgradeShopModal';
import WoodMasterModal from './WoodMasterModal';
import WorldSelectModal from './WorldSelectModal';

type ScreenState = 'TITLE' | 'WORLD_SELECT' | 'PLAYING';

interface CustomerActionState {
  kind: 'customer' | 'car' | 'owner_customer' | 'shop_visitor' | 'beggar_kid';
  id: string;
  requestedDrink: DrinkType;
  actorId?: 'p1' | 'p2';
  npcLabel?: string;
  isFreeHelp?: boolean;
}

export default function RushHourCafeApp() {
  const isMobile = useIsMobile();

  const [screen, setScreen] = useState<ScreenState>('TITLE');
  const [worlds, setWorlds] = useState<WorldSave[]>([]);
  const [muted, setMuted] = useState(false);

  const [activeWorld, setActiveWorld] = useState<WorldSave | null>(null);
  const [hudShift, setHudShift] = useState<ShiftSnapshot | null>(null);
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);
  const [guidedHint, setGuidedHint] = useState('');
  const [targetPrompt, setTargetPrompt] = useState<string | null>(null);
  const [p2TargetPrompt, setP2TargetPrompt] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    text: string;
    color: string;
  } | null>(null);

  const [paused, setPaused] = useState(false);
  const [showSupermarket, setShowSupermarket] = useState(false);
  const [showMilkmanShop, setShowMilkmanShop] = useState(false);
  const [activeHelperId, setActiveHelperId] = useState<HelperNpcId | null>(
    null
  );
  const [showGearBuyer, setShowGearBuyer] = useState(false);
  const [showWoodMaster, setShowWoodMaster] = useState(false);
  const [woodMasterActor, setWoodMasterActor] = useState<'p1' | 'p2'>('p1');
  const [showCoopModal, setShowCoopModal] = useState(false);
  const [showSalesMenu, setShowSalesMenu] = useState(false);
  const [buildingOwnerId, setBuildingOwnerId] = useState<ShopBuildingId | null>(
    null
  );
  const [customerAction, setCustomerAction] =
    useState<CustomerActionState | null>(null);
  const [saveLabel, setSaveLabel] = useState('Auto-Save');

  // Refs for isolated 3D WebGL loop
  const mountRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<WorldSave | null>(null);
  const shiftRef = useRef<ShiftSnapshot | null>(null);
  const pausedRef = useRef(false);
  const modalOpenRef = useRef(false);
  const showMilkmanShopRef = useRef(false);
  const feedbackTimerRef = useRef(0);

  const heldKeysRef = useRef<Set<string>>(new Set());
  const justPressedKeysRef = useRef<Set<string>>(new Set());
  const touchInputRef = useRef<{
    dx: number;
    dz: number;
    interactJust: boolean;
    offerRejectJust: boolean;
    dashJust: boolean;
  }>({
    dx: 0,
    dz: 0,
    interactJust: false,
    offerRejectJust: false,
    dashJust: false,
  });

  useEffect(() => {
    const anyModal =
      paused ||
      showSupermarket ||
      showMilkmanShop ||
      activeHelperId !== null ||
      showGearBuyer ||
      showWoodMaster ||
      showCoopModal ||
      showSalesMenu ||
      buildingOwnerId !== null ||
      customerAction !== null;
    modalOpenRef.current = anyModal;
    showMilkmanShopRef.current = showMilkmanShop;
    heldKeysRef.current.clear();
    justPressedKeysRef.current.clear();
  }, [
    paused,
    showSupermarket,
    showMilkmanShop,
    activeHelperId,
    showGearBuyer,
    showWoodMaster,
    showCoopModal,
    showSalesMenu,
    buildingOwnerId,
    customerAction,
  ]);

  // Load saved worlds on startup
  useEffect(() => {
    loadAllWorlds().then((list) => setWorlds(list));
  }, []);

  const refreshWorldList = useCallback(async () => {
    const list = await loadAllWorlds();
    setWorlds(list);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      cafeAudio.setMuted(next);
      return next;
    });
  }, []);

  const saveCurrentWorld = useCallback(async (keepalive = false) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w) return;

    const snapshotWorld: WorldSave = {
      ...w,
      lastPlayedAt: Date.now(),
      activeShift: s && s.phase === 'playing' ? s : null,
    };
    worldRef.current = snapshotWorld;
    setActiveWorld(snapshotWorld);
    await persistWorld(snapshotWorld, keepalive);

    if (!keepalive) {
      setSaveLabel('Saved');
      setTimeout(() => setSaveLabel('Auto-Save'), 1500);
    }
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (screen === 'PLAYING' && worldRef.current) {
        const snapshotWorld: WorldSave = {
          ...worldRef.current,
          lastPlayedAt: Date.now(),
          activeShift:
            shiftRef.current && shiftRef.current.phase === 'playing'
              ? shiftRef.current
              : null,
        };
        persistWorld(snapshotWorld, true);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [screen]);

  const startWorldSession = useCallback(async (world: WorldSave) => {
    const shift: ShiftSnapshot = world.activeShift
      ? JSON.parse(JSON.stringify(world.activeShift))
      : createInitialShift(world);

    const updatedWorld: WorldSave = {
      ...world,
      lastPlayedAt: Date.now(),
      activeShift: shift,
    };
    await persistWorld(updatedWorld);

    worldRef.current = updatedWorld;
    shiftRef.current = shift;
    pausedRef.current = false;

    setActiveWorld(updatedWorld);
    setHudShift(shift);
    setPaused(false);
    setShowSupermarket(false);
    setShowMilkmanShop(false);
    setActiveHelperId(null);
    setShowGearBuyer(false);
    setShowWoodMaster(false);
    setShowCoopModal(false);
    setShowSalesMenu(false);
    setBuildingOwnerId(null);
    setCustomerAction(null);
    setGuidedHint(getGuidedHint(shift, updatedWorld));
    setTargetPrompt(findInteractTarget(shift, updatedWorld)?.prompt || null);
    setP2TargetPrompt(
      shift.player2?.active
        ? findInteractTargetForPlayer(shift.player2, shift, updatedWorld)
            ?.prompt || null
        : null
    );
    setScreen('PLAYING');
  }, []);

  const handleDeleteWorld = useCallback(async (worldId: string) => {
    await removeWorld(worldId);
    setWorlds((prev) => prev.filter((w) => w.id !== worldId));
  }, []);

  const handleBuyFromSupermarket = useCallback((itemId: string) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;
    const item = SUPERMARKET_CATALOG.find((t) => t.id === itemId);
    if (!item || w.cashCents < item.priceCents) return;

    w.cashCents -= item.priceCents;
    s.inventory.cups += item.addCups;
    s.inventory.teaLeaves += item.addTea;
    s.inventory.sugar += item.addSugar;
    s.inventory.coffeePowder += item.addCoffee;
    s.inventory.biscuits += item.addBiscuits;
    s.inventory.cupcakes += item.addCupcakes;
    s.inventory.samosaMix += item.addSamosaMix ?? 0;
    s.inventory.pakoraMix += item.addPakoraMix ?? 0;
    s.inventory.cookingOil += item.addCookingOil ?? 0;

    w.lastPlayedAt = Date.now();
    w.activeShift = s;

    cafeAudio.play('buy');
    setActiveWorld({ ...w });
    setHudShift({ ...s });
    setFeedbackBanner({
      text: `Bought ${item.name}!`,
      color: '#86EFAC',
    });
    feedbackTimerRef.current = 1.6;
    persistWorld(w);
  }, []);

  const handleBuyFromMilkman = useCallback(
    (itemId: (typeof MILKMAN_CATALOG)[number]['id']) => {
      const w = worldRef.current;
      const s = shiftRef.current;
      if (!w || !s) return;
      const item = MILKMAN_CATALOG.find((m) => m.id === itemId);
      if (!item || w.cashCents < item.priceCents) return;

      w.cashCents -= item.priceCents;
      s.inventory.milkPackets += item.addMilk;
      w.lastPlayedAt = Date.now();
      w.activeShift = s;

      cafeAudio.play('buy');
      setActiveWorld({ ...w });
      setHudShift({ ...s });
      setFeedbackBanner({
        text: `Bought ${item.name}!`,
        color: '#7DD3FC',
      });
      feedbackTimerRef.current = 1.6;
      persistWorld(w);
    },
    []
  );

  const handleBuyRecipe = useCallback((drink: DrinkType) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w) return;
    const info = DRINK_CATALOG[drink] ?? DRINK_CATALOG.tea;
    if (
      w.unlockedRecipes.includes(drink) ||
      (info.requiresLevel2 && w.stage < 2) ||
      w.cashCents < info.unlockCostCents
    ) {
      return;
    }

    w.cashCents -= info.unlockCostCents;
    if (drink === 'samosa' || drink === 'pakora') {
      const next = new Set(w.unlockedRecipes);
      next.add('samosa');
      next.add('pakora');
      w.unlockedRecipes = Array.from(next);
    } else {
      w.unlockedRecipes = [...w.unlockedRecipes, drink];
    }
    w.lastPlayedAt = Date.now();
    if (s) w.activeShift = s;

    cafeAudio.play('level_up');
    setActiveWorld({ ...w });
    setFeedbackBanner({
      text:
        drink === 'samosa' || drink === 'pakora'
          ? 'Unlocked Samosa & Pakora Recipe! Order the 2nd Snacks Readi at Wood Master Workshop!'
          : `Unlocked ${info.name} Recipe!`,
      color: '#FDE68A',
    });
    feedbackTimerRef.current = 2.6;
    persistWorld(w);
  }, []);

  const handleGiveHelperCharity = useCallback((helperId: HelperNpcId) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;
    const helpers = getShiftHelpers(s);
    const target = helpers.find((h) => (h.id ?? 'chotu') === helperId);
    if (
      !target ||
      target.charityGivenToday ||
      w.cashCents < HELPER_CHARITY_CENTS
    ) {
      return;
    }

    const updatedHelpers = helpers.map((h) =>
      (h.id ?? 'chotu') === helperId ? { ...h, charityGivenToday: true } : h
    );
    const nextShift: ShiftSnapshot = {
      ...s,
      helpers: updatedHelpers,
      helper: updatedHelpers[0],
      customers: s.customers.map((c) =>
        c.status === 'waiting'
          ? { ...c, patience: Math.min(c.maxPatience, c.patience + 15) }
          : c
      ),
    };
    const nextWorld: WorldSave = {
      ...w,
      cashCents: w.cashCents - HELPER_CHARITY_CENTS,
      lastPlayedAt: Date.now(),
      activeShift: nextShift,
    };

    worldRef.current = nextWorld;
    shiftRef.current = nextShift;

    const cfg = HELPER_NPCS[helperId];
    cafeAudio.play('buy');
    setActiveHelperId(null);
    setActiveWorld(nextWorld);
    setHudShift(nextShift);
    setFeedbackBanner({
      text: `Gave ${formatMoney(HELPER_CHARITY_CENTS)} to ${cfg.name} — customer patience boosted!`,
      color: '#FDE68A',
    });
    feedbackTimerRef.current = 2.2;
    persistWorld(nextWorld);
  }, []);

  const handleHireHelper = useCallback((helperId: HelperNpcId) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;

    const cfg = HELPER_NPCS[helperId];
    if (cfg.requiresSnacksCart && !w.hasSnacksCart) {
      return;
    }

    const helpers = getShiftHelpers(s);
    const updatedHelpers = helpers.map((h) =>
      (h.id ?? 'chotu') === helperId
        ? {
            ...h,
            status: 'hired' as const,
            task: 'idle' as const,
            statusNote: 'Ready to Help',
          }
        : h
    );
    const nextShift: ShiftSnapshot = {
      ...s,
      helpers: updatedHelpers,
      helper: updatedHelpers[0],
    };
    const nextWorld: WorldSave = {
      ...w,
      lastPlayedAt: Date.now(),
      activeShift: nextShift,
    };

    worldRef.current = nextWorld;
    shiftRef.current = nextShift;

    cafeAudio.play('level_up');
    setActiveHelperId(null);
    setActiveWorld(nextWorld);
    setHudShift(nextShift);
    setFeedbackBanner({
      text:
        helperId === 'munni'
          ? 'Munni hired for 1 day at your 2nd Samosa Readi (20% wage per serve)!'
          : `${cfg.name} hired for today! Will serve Chai, Coffee, Biscuits, Cupcakes, Samosa & Pakora!`,
      color: '#86EFAC',
    });
    feedbackTimerRef.current = 2.6;
    persistWorld(nextWorld);
  }, []);

  const handleRentOrPayBuilding = useCallback((id: ShopBuildingId) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w) return;
    const cfg = RENTABLE_BUILDINGS.find((b) => b.id === id);
    if (!cfg || w.cashCents < cfg.weeklyRentCents) return;

    const existing = w.rentedShops.find((r) => r.buildingId === id);
    const nextRentedShops = existing
      ? w.rentedShops.map((r) =>
          r.buildingId === id
            ? {
                ...r,
                nextRentDueDay:
                  Math.max(w.day, r.nextRentDueDay) + SHOP_WEEK_DAYS,
                weeksPaid: r.weeksPaid + 1,
              }
            : r
        )
      : [
          ...w.rentedShops,
          {
            buildingId: id,
            rentedOnDay: w.day,
            nextRentDueDay: w.day + SHOP_WEEK_DAYS,
            weeksPaid: 1,
          },
        ];

    const nextWorld: WorldSave = {
      ...w,
      cashCents: w.cashCents - cfg.weeklyRentCents,
      rentedShops: nextRentedShops,
      lastPlayedAt: Date.now(),
      activeShift: s ?? w.activeShift,
    };
    worldRef.current = nextWorld;

    cafeAudio.play('level_up');
    setBuildingOwnerId(null);
    setActiveWorld(nextWorld);
    setFeedbackBanner({
      text: existing
        ? `Paid weekly rent for ${cfg.shopName}!`
        : `Rented empty ${cfg.shopName}! Order a Shop Kitchen, Chairs & Tables at Wood Master!`,
      color: '#C4B5FD',
    });
    feedbackTimerRef.current = 2.8;
    persistWorld(nextWorld);
  }, []);

  const handlePlaceWoodOrder = useCallback(
    (kind: WoodOrderKind, targetShopId?: ShopBuildingId) => {
      const w = worldRef.current;
      const s = shiftRef.current;
      if (!w || !s) return;
      const cat = WOOD_MASTER_CATALOG.find((c) => c.kind === kind);
      if (!cat || w.cashCents < cat.priceCents) return;

      const existingOrders = w.woodOrders ?? [];
      if (kind === 'shop_kitchen') {
        if (!targetShopId) return;
        const alreadyInstalled = (w.shopKitchens ?? []).includes(targetShopId);
        const alreadyOrdered = existingOrders.some(
          (o) => o.kind === 'shop_kitchen' && o.targetShopId === targetShopId
        );
        if (alreadyInstalled || alreadyOrdered) return;
      } else if (kind === 'snacks_cart') {
        const hasRecipe =
          w.unlockedRecipes.includes('samosa') ||
          w.unlockedRecipes.includes('pakora');
        if (
          !hasRecipe ||
          w.hasSnacksCart ||
          existingOrders.some((o) => o.kind === 'snacks_cart')
        ) {
          return;
        }
      } else if (kind === 'chai_stall') {
        if (
          w.hasTeaStall !== false ||
          existingOrders.some((o) => o.kind === 'chai_stall')
        ) {
          return;
        }
      }

      const newOrder: WoodMasterOrder = {
        id: `wo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind,
        label: cat.name,
        priceCents: cat.priceCents,
        durationSec: cat.durationSec,
        remainingSec: cat.durationSec,
        status: 'building',
        targetShopId,
        notified: false,
      };

      const nextWorld: WorldSave = {
        ...w,
        cashCents: w.cashCents - cat.priceCents,
        woodOrders: [...existingOrders, newOrder],
        lastPlayedAt: Date.now(),
        activeShift: s,
      };
      worldRef.current = nextWorld;

      cafeAudio.play('buy');
      setActiveWorld(nextWorld);
      setFeedbackBanner({
        text: `Ordered ${cat.name}! Ustad Karim will finish it in ${cat.durationSec}s.`,
        color: '#FDE68A',
      });
      feedbackTimerRef.current = 2.4;
      persistWorld(nextWorld);
    },
    []
  );

  const handleReceiveWoodOrder = useCallback((orderId: string) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;
    const existingOrders = w.woodOrders ?? [];
    const order = existingOrders.find(
      (o) => o.id === orderId && o.status === 'ready'
    );
    if (!order) return;

    const remainingOrders = existingOrders.filter((o) => o.id !== orderId);
    const nextWorld: WorldSave = {
      ...w,
      woodOrders: remainingOrders,
      lastPlayedAt: Date.now(),
    };
    let nextShift: ShiftSnapshot = { ...s };
    let bannerText = `Received ${order.label}!`;
    let closeWorkshop = false;

    if (order.kind === 'chair' || order.kind === 'table') {
      const carriedItem =
        order.kind === 'chair' ? 'carried_chair' : 'carried_table';
      const label = order.kind === 'chair' ? 'Chair' : 'Table';
      const preferP2 =
        woodMasterActor === 'p2' && Boolean(nextShift.player2?.active);
      if (preferP2 && nextShift.player2 && nextShift.player2.holding === null) {
        nextShift = {
          ...nextShift,
          player2: { ...nextShift.player2, holding: carriedItem },
        };
        bannerText = `Partner P2 picked up crafted ${label}!`;
        closeWorkshop = true;
      } else if (!preferP2 && nextShift.player.holding === null) {
        nextShift = {
          ...nextShift,
          player: { ...nextShift.player, holding: carriedItem },
        };
        bannerText = `Picked up crafted ${label}! Place anywhere with E`;
        closeWorkshop = true;
      } else if (
        preferP2 &&
        nextShift.player.holding === null
      ) {
        nextShift = {
          ...nextShift,
          player: { ...nextShift.player, holding: carriedItem },
        };
        bannerText = `P1 picked up crafted ${label}! Place anywhere with E`;
        closeWorkshop = true;
      } else if (
        nextShift.player2?.active &&
        nextShift.player2.holding === null
      ) {
        nextShift = {
          ...nextShift,
          player2: { ...nextShift.player2, holding: carriedItem },
        };
        bannerText = `Partner P2 picked up crafted ${label}!`;
        closeWorkshop = true;
      } else {
        nextWorld.pendingFurniture = [...w.pendingFurniture, order.kind];
        bannerText = `${label} placed on Pickup Pad outside Wood Master (E)!`;
      }
    } else if (order.kind === 'shop_kitchen' && order.targetShopId) {
      const prevKitchens = w.shopKitchens ?? [];
      if (!prevKitchens.includes(order.targetShopId)) {
        nextWorld.shopKitchens = [...prevKitchens, order.targetShopId];
      }
      const shopName =
        RENTABLE_BUILDINGS.find((b) => b.id === order.targetShopId)?.shopName ??
        order.targetShopId;
      bannerText = `Shop Kitchen installed inside ${shopName}!`;
      closeWorkshop = true;
    } else if (order.kind === 'snacks_cart') {
      nextWorld.hasSnacksCart = true;
      nextShift = {
        ...nextShift,
        inventory: {
          ...nextShift.inventory,
          samosaMix: nextShift.inventory.samosaMix + 4,
          pakoraMix: nextShift.inventory.pakoraMix + 4,
          cookingOil: nextShift.inventory.cookingOil + 8,
        },
      };
      bannerText =
        '2nd Snacks Readi set up on Left Plaza (+4 Samosa, +4 Pakora, +8 Oil)!';
      closeWorkshop = true;
    } else if (order.kind === 'chai_stall') {
      nextWorld.hasTeaStall = true;
      bannerText = 'Main 4-Wheel Chai Readi restored on the street!';
      closeWorkshop = true;
    }

    nextWorld.activeShift = nextShift;
    worldRef.current = nextWorld;
    shiftRef.current = nextShift;

    cafeAudio.play('level_up');
    if (closeWorkshop) setShowWoodMaster(false);
    setActiveWorld(nextWorld);
    setHudShift(nextShift);
    setFeedbackBanner({
      text: bannerText,
      color: '#86EFAC',
    });
    feedbackTimerRef.current = 2.6;
    persistWorld(nextWorld);
  }, [woodMasterActor]);

  const handleToggleCoop = useCallback(() => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;

    const currentlyActive = Boolean(s.player2?.active);
    let nextPending = w.pendingFurniture;

    let nextP2 = s.player2 ?? {
      x: s.player.x + 1.15,
      z: s.player.z,
      yaw: 0,
      holding: null,
      walkCycle: 0,
      dashCooldown: 0,
      dashTimer: 0,
      isMoving: false,
      sittingChairId: null,
      active: false,
    };

    if (!currentlyActive) {
      nextP2 = {
        ...nextP2,
        x: Math.min(51, Math.max(-28, s.player.x + 1.15)),
        z: s.player.z,
        yaw: s.player.yaw,
        holding: null,
        sittingChairId: null,
        active: true,
      };
    } else {
      if (nextP2.holding === 'carried_chair') {
        nextPending = [...nextPending, 'chair'];
      } else if (nextP2.holding === 'carried_table') {
        nextPending = [...nextPending, 'table'];
      }
      nextP2 = {
        ...nextP2,
        holding: null,
        sittingChairId: null,
        active: false,
      };
    }

    const nextShift: ShiftSnapshot = {
      ...s,
      player2: nextP2,
    };
    const nextWorld: WorldSave = {
      ...w,
      pendingFurniture: nextPending,
      lastPlayedAt: Date.now(),
      activeShift: nextShift,
    };

    worldRef.current = nextWorld;
    shiftRef.current = nextShift;

    cafeAudio.play(currentlyActive ? 'pickup' : 'level_up');
    setShowCoopModal(false);
    setActiveWorld(nextWorld);
    setHudShift(nextShift);
    setFeedbackBanner({
      text: currentlyActive
        ? '2-Player Co-Op disabled — switched to Solo Mode.'
        : '2-Player Co-Op Enabled! P2 Partner uses Arrow Keys + Enter!',
      color: '#5EEAD4',
    });
    feedbackTimerRef.current = 2.6;
    persistWorld(nextWorld);
  }, []);

  const handleSellTeaStall = useCallback(() => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;
    if (
      w.hasTeaStall === false ||
      w.rentedShops.length === 0 ||
      (w.shopKitchens ?? []).length === 0
    ) {
      return;
    }

    const payout = Math.round(CHAI_STALL_PRICE_CENTS * RESALE_RATE);
    const updatedHelpers = getShiftHelpers(s).map((h) =>
      h.status === 'hired'
        ? {
            ...h,
            task: 'idle' as const,
            holding: null,
            targetCustomerId: null,
            actionTimer: 0,
          }
        : h
    );
    const nextShift: ShiftSnapshot = {
      ...s,
      helpers: updatedHelpers,
      helper: updatedHelpers[0],
    };
    const nextWorld: WorldSave = {
      ...w,
      cashCents: w.cashCents + payout,
      hasTeaStall: false,
      lastPlayedAt: Date.now(),
      activeShift: nextShift,
    };
    worldRef.current = nextWorld;
    shiftRef.current = nextShift;

    cafeAudio.play('buy');
    setActiveWorld(nextWorld);
    setHudShift(nextShift);
    setFeedbackBanner({
      text: `Sold Chai Readi Stall for +${formatMoney(payout)} (-50%)! Cook in your built Shop Kitchen!`,
      color: '#C4B5FD',
    });
    feedbackTimerRef.current = 2.8;
    persistWorld(nextWorld);
  }, []);

  const handleSellSnacksCart = useCallback(() => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s || !w.hasSnacksCart) return;

    const payout = Math.round(SNACKS_CART_PRICE_CENTS * RESALE_RATE);
    w.cashCents += payout;
    w.hasSnacksCart = false;
    s.fryer = { status: 'idle', progress: 0, fryingSnack: null };
    s.snackTrayItems = [null, null];
    w.lastPlayedAt = Date.now();
    w.activeShift = s;

    cafeAudio.play('buy');
    setActiveWorld({ ...w });
    setHudShift({ ...s });
    setFeedbackBanner({
      text: `Sold 2nd Snacks Readi for +${formatMoney(payout)} (-50% rate)!`,
      color: '#C4B5FD',
    });
    feedbackTimerRef.current = 2.4;
    persistWorld(w);
  }, []);

  const handleSellFurniture = useCallback(
    (kind: 'chair' | 'table', sellAll: boolean) => {
      const w = worldRef.current;
      const s = shiftRef.current;
      if (!w || !s) return;

      const carriedKind = kind === 'chair' ? 'carried_chair' : 'carried_table';
      const unitPayout = Math.round(
        (kind === 'chair' ? CHAIR_PRICE_CENTS : TABLE_PRICE_CENTS) * RESALE_RATE
      );
      const removedChairIds = new Set<string>();
      let soldCount = 0;

      if (sellAll) {
        if (s.player.holding === carriedKind) {
          s.player.holding = null;
          soldCount += 1;
        }
        if (s.player2?.holding === carriedKind) {
          s.player2.holding = null;
          soldCount += 1;
        }
        const remainingPending = w.pendingFurniture.filter((k) => {
          if (k === kind) {
            soldCount += 1;
            return false;
          }
          return true;
        });
        w.pendingFurniture = remainingPending;

        w.furniture = w.furniture.filter((f) => {
          if (f.kind === kind) {
            if (kind === 'chair') removedChairIds.add(f.id);
            soldCount += 1;
            return false;
          }
          return true;
        });
      } else {
        if (s.player.holding === carriedKind) {
          s.player.holding = null;
          soldCount = 1;
        } else if (s.player2?.holding === carriedKind) {
          s.player2.holding = null;
          soldCount = 1;
        } else {
          const pIdx = w.pendingFurniture.lastIndexOf(kind);
          if (pIdx !== -1) {
            w.pendingFurniture = w.pendingFurniture.filter(
              (_, i) => i !== pIdx
            );
            soldCount = 1;
          } else {
            const occupied = new Set<string>();
            if (s.player.sittingChairId) occupied.add(s.player.sittingChairId);
            if (s.player2?.sittingChairId)
              occupied.add(s.player2.sittingChairId);
            for (const c of s.customers) {
              if (c.seatedChairId) occupied.add(c.seatedChairId);
              if (c.targetChairId) occupied.add(c.targetChairId);
            }
            const candidate =
              w.furniture.find((f) => f.kind === kind && !occupied.has(f.id)) ??
              w.furniture.find((f) => f.kind === kind);
            if (candidate) {
              if (kind === 'chair') removedChairIds.add(candidate.id);
              w.furniture = w.furniture.filter((f) => f.id !== candidate.id);
              soldCount = 1;
            }
          }
        }
      }

      if (soldCount === 0) return;

      if (removedChairIds.size > 0) {
        if (
          s.player.sittingChairId &&
          removedChairIds.has(s.player.sittingChairId)
        ) {
          s.player.sittingChairId = null;
        }
        if (
          s.player2?.sittingChairId &&
          removedChairIds.has(s.player2.sittingChairId)
        ) {
          s.player2.sittingChairId = null;
        }
        s.customers = s.customers.map((c) => {
          const clearSeated =
            typeof c.seatedChairId === 'string' &&
            removedChairIds.has(c.seatedChairId);
          const clearTarget =
            typeof c.targetChairId === 'string' &&
            removedChairIds.has(c.targetChairId);
          if (!clearSeated && !clearTarget) return c;
          return {
            ...c,
            seatedChairId: clearSeated ? null : c.seatedChairId,
            targetChairId: clearTarget ? null : c.targetChairId,
          };
        });
      }

      const totalPayout = soldCount * unitPayout;
      w.cashCents += totalPayout;
      w.lastPlayedAt = Date.now();
      w.activeShift = s;

      const label = kind === 'chair' ? 'Chair' : 'Table';
      cafeAudio.play('buy');
      setActiveWorld({ ...w });
      setHudShift({ ...s });
      setFeedbackBanner({
        text: `Sold ${soldCount} ${label}${soldCount > 1 ? 's' : ''} for +${formatMoney(totalPayout)} (-50%)!`,
        color: '#C4B5FD',
      });
      feedbackTimerRef.current = 2.0;
      persistWorld(w);
    },
    []
  );

  const handleOfferAlternative = useCallback(
    (drink: DrinkType) => {
      const w = worldRef.current;
      const s = shiftRef.current;
      if (!w || !s || !customerAction) return;

      const accepted =
        customerAction.kind === 'beggar_kid' ? true : Math.random() < 0.8;
      const info = DRINK_CATALOG[drink] ?? DRINK_CATALOG.tea;

      if (customerAction.kind === 'customer') {
        const cust = s.customers.find((c) => c.id === customerAction.id);
        if (cust && cust.status === 'waiting') {
          if (accepted) {
            cust.orderDrink = drink;
            cust.patience = Math.min(cust.maxPatience, cust.patience + 18);
            cafeAudio.play('pickup');
            setFeedbackBanner({
              text: `Customer agreed to ${info.name}!`,
              color: '#86EFAC',
            });
          } else {
            cust.status = 'walking_out';
            cafeAudio.play('pickup');
            setFeedbackBanner({
              text: `Customer declined ${info.name} and left politely`,
              color: '#FDE68A',
            });
          }
        }
      } else if (customerAction.kind === 'car') {
        const car = s.carCustomer;
        if (car.phase === 'waiting') {
          if (accepted) {
            car.orderDrink = drink;
            car.patience = Math.min(car.maxPatience, car.patience + 20);
            cafeAudio.play('car_horn');
            setFeedbackBanner({
              text: `Car driver switched order to ${info.name}!`,
              color: '#86EFAC',
            });
          } else {
            car.phase = 'leaving';
            cafeAudio.play('pickup');
            setFeedbackBanner({
              text: 'Car driver declined alternative and drove off',
              color: '#FDE68A',
            });
          }
        }
      } else if (customerAction.kind === 'owner_customer') {
        const owner = s.supermarketOwner;
        if (owner.phase === 'ordering_chai') {
          if (accepted) {
            owner.orderDrink = drink;
            owner.patience = Math.min(owner.maxPatience, owner.patience + 22);
            cafeAudio.play('pickup');
            setFeedbackBanner({
              text: `Mart Owner agreed to ${info.name}!`,
              color: '#86EFAC',
            });
          } else {
            owner.phase = 'returning_to_store';
            cafeAudio.play('pickup');
            setFeedbackBanner({
              text: `Mart Owner declined ${info.name} and returned to store`,
              color: '#FDE68A',
            });
          }
        }
      } else if (customerAction.kind === 'shop_visitor') {
        const vis = getShiftShopVisitors(s).find(
          (v) => v.id === customerAction.id
        );
        if (vis && vis.phase === 'ordering') {
          if (accepted) {
            vis.orderDrink = drink;
            vis.patience = Math.min(vis.maxPatience, vis.patience + 22);
            cafeAudio.play('pickup');
            setFeedbackBanner({
              text: `${vis.name} agreed to ${info.name}!`,
              color: '#86EFAC',
            });
          } else {
            vis.phase = 'returning_to_shop';
            cafeAudio.play('pickup');
            setFeedbackBanner({
              text: `${vis.name} declined ${info.name} and headed back`,
              color: '#FDE68A',
            });
          }
        }
      } else if (customerAction.kind === 'beggar_kid') {
        const bk = getShiftBeggarKids(s).find(
          (k) => k.id === customerAction.id
        );
        if (bk && bk.status === 'waiting') {
          bk.orderDrink = drink;
          bk.patience = Math.min(bk.maxPatience, bk.patience + 25);
          cafeAudio.play('pickup');
          setFeedbackBanner({
            text: `Poor Kid happily agreed to free ${info.name}!`,
            color: '#86EFAC',
          });
        }
      }

      feedbackTimerRef.current = 2.0;
      setCustomerAction(null);
      setHudShift({ ...s });
      w.activeShift = s;
      persistWorld(w);
    },
    [customerAction]
  );

  const handleRejectCustomer = useCallback(() => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s || !customerAction) return;

    let msg = 'Politely told customer: Sold Out today';
    if (customerAction.kind === 'customer') {
      const cust = s.customers.find((c) => c.id === customerAction.id);
      if (cust && cust.status === 'waiting') {
        cust.status = 'walking_out';
      }
    } else if (customerAction.kind === 'car') {
      if (s.carCustomer.phase === 'waiting') {
        s.carCustomer.phase = 'leaving';
        msg = 'Rejected Car order — Car drove off';
      }
    } else if (customerAction.kind === 'owner_customer') {
      if (s.supermarketOwner.phase === 'ordering_chai') {
        s.supermarketOwner.phase = 'returning_to_store';
        msg = 'Rejected Mart Owner order — he headed back to his store';
      }
    } else if (customerAction.kind === 'shop_visitor') {
      const vis = getShiftShopVisitors(s).find(
        (v) => v.id === customerAction.id
      );
      if (vis && vis.phase === 'ordering') {
        vis.phase = 'returning_to_shop';
        msg = `Rejected ${vis.name}'s order — headed back to shop`;
      }
    } else if (customerAction.kind === 'beggar_kid') {
      const bk = getShiftBeggarKids(s).find((k) => k.id === customerAction.id);
      if (bk && bk.status === 'waiting') {
        bk.status = 'walking_out';
        msg = 'Turned away Poor Kid politely';
      }
    }

    cafeAudio.play('pickup');
    setFeedbackBanner({
      text: msg,
      color: '#D6C7B5',
    });
    feedbackTimerRef.current = 1.8;
    setCustomerAction(null);
    setHudShift({ ...s });
    w.activeShift = s;
    persistWorld(w);
  }, [customerAction]);

  const handleToggleMenuItem = useCallback((drink: DrinkType) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w) return;

    const isBaseDrink =
      drink === 'tea' || drink === 'doodh_patti' || drink === 'coffee';
    if (isBaseDrink && !w.unlockedRecipes.includes(drink)) return;
    if (
      (drink === 'samosa' || drink === 'pakora') &&
      (!w.unlockedRecipes.includes(drink) || !w.hasSnacksCart)
    ) {
      return;
    }

    const currentlyEnabled = isMenuItemEnabled(w, drink);
    if (currentlyEnabled && isBaseDrink) {
      const otherEnabledDrink = (
        ['tea', 'doodh_patti', 'coffee'] as const
      ).some(
        (d) =>
          d !== drink &&
          w.unlockedRecipes.includes(d) &&
          isMenuItemEnabled(w, d)
      );
      if (!otherEnabledDrink) {
        setFeedbackBanner({
          text: 'Keep at least 1 drink enabled on your Sales Menu!',
          color: '#FDE68A',
        });
        feedbackTimerRef.current = 1.8;
        return;
      }
    }

    const prevDisabled = w.disabledMenuItems ?? [];
    const nextDisabled = currentlyEnabled
      ? Array.from(new Set([...prevDisabled, drink]))
      : prevDisabled.filter((d) => d !== drink);

    const nextWorld: WorldSave = {
      ...w,
      disabledMenuItems: nextDisabled,
      lastPlayedAt: Date.now(),
      activeShift: s && s.phase === 'playing' ? s : w.activeShift,
    };
    worldRef.current = nextWorld;

    const info = DRINK_CATALOG[drink] ?? DRINK_CATALOG.tea;
    cafeAudio.play('pickup');
    setActiveWorld(nextWorld);
    setFeedbackBanner({
      text: currentlyEnabled
        ? `${info.name} disabled from Sales Menu`
        : `${info.name} enabled for sale!`,
      color: currentlyEnabled ? '#FDBA74' : '#86EFAC',
    });
    feedbackTimerRef.current = 1.8;
    persistWorld(nextWorld);
  }, []);

  const handleNextDay = useCallback(() => {
    const w = worldRef.current;
    const prevShift = shiftRef.current;
    if (!w || !prevShift) return;

    const nextDay = w.day + 1;
    const nextStage: 1 | 2 = nextDay >= 2 ? 2 : w.stage;
    const nextWorld: WorldSave = {
      ...w,
      stage: nextStage,
      day: nextDay,
      lastPlayedAt: Date.now(),
    };
    const freshShift = createInitialShift(nextWorld, prevShift.inventory);
    nextWorld.activeShift = freshShift;

    worldRef.current = nextWorld;
    shiftRef.current = freshShift;
    pausedRef.current = false;

    setActiveWorld(nextWorld);
    setHudShift(freshShift);
    setPaused(false);
    setShowSupermarket(false);
    setShowMilkmanShop(false);
    setActiveHelperId(null);
    setShowGearBuyer(false);
    setShowWoodMaster(false);
    setShowCoopModal(false);
    setShowSalesMenu(false);
    setBuildingOwnerId(null);
    setCustomerAction(null);
    persistWorld(nextWorld);
  }, []);

  const handleSaveAndExit = useCallback(async () => {
    await saveCurrentWorld(false);
    worldRef.current = null;
    shiftRef.current = null;
    setActiveWorld(null);
    setHudShift(null);
    setPaused(false);
    setShowSupermarket(false);
    setShowMilkmanShop(false);
    setActiveHelperId(null);
    setShowGearBuyer(false);
    setShowWoodMaster(false);
    setShowCoopModal(false);
    setShowSalesMenu(false);
    setBuildingOwnerId(null);
    setCustomerAction(null);
    await refreshWorldList();
    setScreen('WORLD_SELECT');
  }, [refreshWorldList, saveCurrentWorld]);

  // Keyboard Controls (yields cleanly to active menu/modal keyboard navigation)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'PLAYING') return;

      if (modalOpenRef.current || shiftRef.current?.phase !== 'playing') {
        return;
      }

      if (e.key === 'Escape') {
        if (e.repeat) return;
        e.preventDefault();
        pausedRef.current = true;
        setPaused(true);
        return;
      }

      if (e.code === 'KeyM') {
        if (e.repeat) return;
        e.preventDefault();
        setShowSalesMenu(true);
        return;
      }

      if (e.code === 'KeyP') {
        if (e.repeat) return;
        e.preventDefault();
        setShowCoopModal(true);
        return;
      }

      if (!heldKeysRef.current.has(e.code)) {
        justPressedKeysRef.current.add(e.code);
      }
      heldKeysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    const onBlur = () => {
      heldKeysRef.current.clear();
      justPressedKeysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [screen]);

  // Isolated Three.js 3D WebGL Game Loop (strictly [screen] dependency)
  useEffect(() => {
    if (screen !== 'PLAYING' || !mountRef.current) return;

    const controller = new Chai3DSceneController(mountRef.current);
    let lastMs = performance.now();
    let elapsedTotal = 0;
    let hudAcc = 0;
    let labelAcc = 0;
    let autoSaveAcc = 0;
    let disposed = false;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastMs) / 1000;
      lastMs = now;
      const dt = Math.min(rawDt, 0.05);
      elapsedTotal += dt;

      const shift = shiftRef.current;
      const world = worldRef.current;

      if (shift && world) {
        if (!modalOpenRef.current && shift.phase === 'playing') {
          const held = heldKeysRef.current;
          const just = justPressedKeysRef.current;
          const coopActive = Boolean(shift.player2?.active);

          let dx1 = 0;
          let dz1 = 0;
          if (held.has('KeyW') || (!coopActive && held.has('ArrowUp'))) dz1 -= 1;
          if (held.has('KeyS') || (!coopActive && held.has('ArrowDown'))) dz1 += 1;
          if (held.has('KeyA') || (!coopActive && held.has('ArrowLeft'))) dx1 -= 1;
          if (held.has('KeyD') || (!coopActive && held.has('ArrowRight'))) dx1 += 1;

          if (
            Math.abs(touchInputRef.current.dx) > 0.1 ||
            Math.abs(touchInputRef.current.dz) > 0.1
          ) {
            dx1 += touchInputRef.current.dx;
            dz1 += touchInputRef.current.dz;
          }

          const input1: Stage1Input = {
            dx: dx1,
            dz: dz1,
            interactJustPressed:
              just.has('KeyE') ||
              just.has('Space') ||
              (!coopActive && just.has('Enter')) ||
              touchInputRef.current.interactJust,
            offerRejectJustPressed:
              just.has('KeyF') ||
              (!coopActive && just.has('KeyX')) ||
              touchInputRef.current.offerRejectJust,
            dashJustPressed:
              just.has('KeyQ') ||
              just.has('ShiftLeft') ||
              (!coopActive && just.has('ShiftRight')) ||
              touchInputRef.current.dashJust,
          };

          let input2: Stage1Input | undefined;
          if (coopActive) {
            let dx2 = 0;
            let dz2 = 0;
            if (held.has('ArrowUp')) dz2 -= 1;
            if (held.has('ArrowDown')) dz2 += 1;
            if (held.has('ArrowLeft')) dx2 -= 1;
            if (held.has('ArrowRight')) dx2 += 1;
            input2 = {
              dx: dx2,
              dz: dz2,
              interactJustPressed:
                just.has('Enter') ||
                just.has('NumpadEnter') ||
                just.has('Slash'),
              offerRejectJustPressed:
                just.has('Period') || just.has('Backspace'),
              dashJustPressed: just.has('ShiftRight') || just.has('Comma'),
            };
          }

          justPressedKeysRef.current.clear();
          touchInputRef.current.interactJust = false;
          touchInputRef.current.offerRejectJust = false;
          touchInputRef.current.dashJust = false;

          const simEvents = stepStage1Simulation(
            shift,
            world,
            input1,
            dt,
            input2
          );

          for (const snd of simEvents.sounds) {
            cafeAudio.play(snd);
          }

          if (simEvents.openSupermarket) {
            setShowSupermarket(true);
          }
          if (simEvents.openMilkmanShop) {
            setShowMilkmanShop(true);
          }
          if (simEvents.openHelperModal) {
            setActiveHelperId(simEvents.openHelperId ?? 'chotu');
          }
          if (simEvents.openBuildingOwnerId) {
            setBuildingOwnerId(simEvents.openBuildingOwnerId);
          }
          if (simEvents.openGearBuyer) {
            setShowGearBuyer(true);
          }
          if (simEvents.openWoodMaster) {
            setWoodMasterActor(simEvents.openModalActor ?? 'p1');
            setShowWoodMaster(true);
          }
          if (simEvents.openCustomerAction) {
            setCustomerAction(simEvents.openCustomerAction);
          }

          if (simEvents.leveledUpTo2) {
            setFeedbackBanner({
              text: 'LEVEL 2 UNLOCKED! Walk into the Open Supermarket (E) for Doodh Patti & Coffee Recipes!',
              color: '#5EEAD4',
            });
            feedbackTimerRef.current = 3.2;
          } else if (simEvents.feedbackText) {
            setFeedbackBanner({
              text: simEvents.feedbackText,
              color: simEvents.feedbackColor,
            });
            feedbackTimerRef.current = 2.0;
          }

          if (shift.milkman.phase !== 'parked' && showMilkmanShopRef.current) {
            setShowMilkmanShop(false);
          }

          if (shift.timeLeft <= 0) {
            const nextStage: 1 | 2 = world.stage < 2 ? 2 : world.stage;
            const finalized: WorldSave = {
              ...world,
              stage: nextStage,
              activeShift: null,
              lastPlayedAt: Date.now(),
            };
            worldRef.current = finalized;
            setActiveWorld(finalized);
            setHudShift({ ...shift });
            persistWorld(finalized);
          }

          autoSaveAcc += dt;
          if (autoSaveAcc >= 4.0) {
            autoSaveAcc = 0;
            const snap: WorldSave = {
              ...world,
              lastPlayedAt: Date.now(),
              activeShift: shift.timeLeft > 0 ? shift : null,
            };
            worldRef.current = snap;
            persistWorld(snap);
          }
        } else {
          justPressedKeysRef.current.clear();
        }

        if (feedbackTimerRef.current > 0) {
          feedbackTimerRef.current = Math.max(0, feedbackTimerRef.current - dt);
          if (feedbackTimerRef.current === 0) {
            setFeedbackBanner(null);
          }
        }

        const currentTarget = findInteractTarget(shift, world);
        const p2Target = shift.player2?.active
          ? findInteractTargetForPlayer(shift.player2, shift, world)
          : null;
        const labels = controller.syncAndRender(
          shift,
          world,
          currentTarget,
          dt,
          elapsedTotal
        );

        labelAcc += dt;
        if (labelAcc >= 0.033) {
          labelAcc = 0;
          setProjectedLabels(labels);
        }

        hudAcc += dt;
        if (hudAcc >= 0.1) {
          hudAcc = 0;
          setActiveWorld({ ...world });
          setHudShift({ ...shift });
          setGuidedHint(getGuidedHint(shift, world));
          setTargetPrompt(currentTarget?.prompt || null);
          setP2TargetPrompt(p2Target?.prompt || null);
        }
      }

      controller.scheduleNextFrame(tick);
    };

    controller.scheduleNextFrame(tick);

    return () => {
      disposed = true;
      controller.dispose();
    };
  }, [screen]);

  const activeSittingHelper =
    activeHelperId && hudShift
      ? getShiftHelpers(hudShift).find(
          (h) => (h.id ?? 'chotu') === activeHelperId && h.status === 'sitting'
        ) ?? null
      : null;

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#1B1410]">
      {screen === 'TITLE' && (
        <TitleScreen
          active
          onPlayWorlds={() => setScreen('WORLD_SELECT')}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {screen === 'WORLD_SELECT' && (
        <>
          <TitleScreen
            active={false}
            onPlayWorlds={() => setScreen('WORLD_SELECT')}
            muted={muted}
            onToggleMute={handleToggleMute}
          />
          <WorldSelectModal
            worlds={worlds}
            onBack={() => setScreen('TITLE')}
            onStartWorld={startWorldSession}
            onCreateWorld={startWorldSession}
            onDeleteWorld={handleDeleteWorld}
          />
        </>
      )}

      {screen === 'PLAYING' && activeWorld && hudShift && (
        <div className="relative w-full h-full">
          <div ref={mountRef} className="w-full h-full" />

          <GameHUD
            world={activeWorld}
            shift={hudShift}
            projectedLabels={projectedLabels}
            guidedHint={guidedHint}
            targetPrompt={targetPrompt}
            p2TargetPrompt={p2TargetPrompt}
            feedbackBanner={feedbackBanner}
            muted={muted}
            saveLabel={saveLabel}
            onToggleMute={handleToggleMute}
            onPause={() => {
              pausedRef.current = true;
              setPaused(true);
            }}
            onQuickSave={() => saveCurrentWorld(false)}
            onOpenSalesMenu={() => setShowSalesMenu(true)}
            onOpenCoop={() => setShowCoopModal(true)}
          />

          {isMobile &&
            hudShift.phase === 'playing' &&
            !paused &&
            !showSupermarket &&
            !showMilkmanShop &&
            !activeHelperId &&
            !showGearBuyer &&
            !showWoodMaster &&
            !showCoopModal &&
            !showSalesMenu &&
            !buildingOwnerId &&
            !customerAction && (
              <div className="fixed bottom-16 inset-x-4 z-30 flex items-end justify-between pointer-events-none">
                <div className="pointer-events-auto grid grid-cols-3 gap-1 w-32 h-32">
                  <div />
                  <button
                    type="button"
                    onTouchStart={() => (touchInputRef.current.dz = -1)}
                    onTouchEnd={() => (touchInputRef.current.dz = 0)}
                    className="rounded-lg bg-[#2A201B]/90 border border-[#D4A373]/30 text-white font-bold text-sm"
                  >
                    ▲
                  </button>
                  <div />
                  <button
                    type="button"
                    onTouchStart={() => (touchInputRef.current.dx = -1)}
                    onTouchEnd={() => (touchInputRef.current.dx = 0)}
                    className="rounded-lg bg-[#2A201B]/90 border border-[#D4A373]/30 text-white font-bold text-sm"
                  >
                    ◀
                  </button>
                  <div />
                  <button
                    type="button"
                    onTouchStart={() => (touchInputRef.current.dx = 1)}
                    onTouchEnd={() => (touchInputRef.current.dx = 0)}
                    className="rounded-lg bg-[#2A201B]/90 border border-[#D4A373]/30 text-white font-bold text-sm"
                  >
                    ▶
                  </button>
                  <div />
                  <button
                    type="button"
                    onTouchStart={() => (touchInputRef.current.dz = 1)}
                    onTouchEnd={() => (touchInputRef.current.dz = 0)}
                    className="rounded-lg bg-[#2A201B]/90 border border-[#D4A373]/30 text-white font-bold text-sm"
                  >
                    ▼
                  </button>
                  <div />
                </div>

                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    type="button"
                    onTouchStart={() =>
                      (touchInputRef.current.offerRejectJust = true)
                    }
                    className="w-12 h-12 rounded-full bg-[#7F1D1D]/95 border border-[#FCA5A5]/40 text-white font-bold text-[11px]"
                  >
                    Alt
                  </button>
                  <button
                    type="button"
                    onTouchStart={() => (touchInputRef.current.dashJust = true)}
                    className="w-12 h-12 rounded-full bg-[#3A2D26]/95 border border-[#D4A373]/40 text-white font-bold text-xs"
                  >
                    Dash
                  </button>
                  <button
                    type="button"
                    onTouchStart={() =>
                      (touchInputRef.current.interactJust = true)
                    }
                    className="w-16 h-16 rounded-full bg-[#EA580C]/95 border border-[#FDBA74]/50 text-white font-bold text-sm"
                  >
                    Act
                  </button>
                </div>
              </div>
            )}

          {showSupermarket && (
            <SupermarketModal
              world={activeWorld}
              inventory={hudShift.inventory}
              onBuyItem={handleBuyFromSupermarket}
              onBuyRecipe={handleBuyRecipe}
              onClose={() => setShowSupermarket(false)}
            />
          )}

          {showMilkmanShop && hudShift.milkman.phase === 'parked' && (
            <MilkmanShopModal
              cashCents={activeWorld.cashCents}
              inventory={hudShift.inventory}
              milkmanTimeLeft={hudShift.milkman.timer}
              onBuy={handleBuyFromMilkman}
              onClose={() => setShowMilkmanShop(false)}
            />
          )}

          {activeSittingHelper && (
            <KidHelperModal
              cashCents={activeWorld.cashCents}
              helper={activeSittingHelper}
              hasSnacksCart={activeWorld.hasSnacksCart}
              onGiveCharity={handleGiveHelperCharity}
              onHireHelper={handleHireHelper}
              onClose={() => setActiveHelperId(null)}
            />
          )}

          {buildingOwnerId && (
            <BuildingRentModal
              world={activeWorld}
              buildingId={buildingOwnerId}
              onRentOrPay={handleRentOrPayBuilding}
              onClose={() => setBuildingOwnerId(null)}
            />
          )}

          {showGearBuyer && (
            <GearBuyerModal
              world={activeWorld}
              holding={hudShift.player.holding}
              p2Holding={
                hudShift.player2?.active ? hudShift.player2.holding : null
              }
              onSellTeaStall={handleSellTeaStall}
              onSellSnacksCart={handleSellSnacksCart}
              onSellFurniture={handleSellFurniture}
              onClose={() => setShowGearBuyer(false)}
            />
          )}

          {showWoodMaster && (
            <WoodMasterModal
              world={activeWorld}
              holding={
                woodMasterActor === 'p2' && hudShift.player2?.active
                  ? hudShift.player2.holding
                  : hudShift.player.holding
              }
              onPlaceOrder={handlePlaceWoodOrder}
              onReceiveOrder={handleReceiveWoodOrder}
              onClose={() => setShowWoodMaster(false)}
            />
          )}

          {showCoopModal && (
            <CoopInviteModal
              coopActive={Boolean(hudShift.player2?.active)}
              p1Holding={hudShift.player.holding}
              p2Holding={hudShift.player2?.holding ?? null}
              onToggleCoop={handleToggleCoop}
              onClose={() => setShowCoopModal(false)}
            />
          )}

          {customerAction && (
            <CustomerActionModal
              targetKind={customerAction.kind}
              requestedDrink={customerAction.requestedDrink}
              npcLabel={customerAction.npcLabel}
              isFreeHelp={customerAction.isFreeHelp}
              availableChoices={getAvailableMenuChoices(activeWorld, hudShift)}
              holding={
                customerAction.actorId === 'p2' && hudShift.player2?.active
                  ? hudShift.player2.holding
                  : hudShift.player.holding
              }
              onOfferAlternative={handleOfferAlternative}
              onReject={handleRejectCustomer}
              onClose={() => setCustomerAction(null)}
            />
          )}

          {showSalesMenu && (
            <SalesMenuModal
              world={activeWorld}
              shift={hudShift}
              onToggleItem={handleToggleMenuItem}
              onClose={() => setShowSalesMenu(false)}
            />
          )}

          {paused &&
            !showSupermarket &&
            !showMilkmanShop &&
            !activeHelperId &&
            !showGearBuyer &&
            !showWoodMaster &&
            !showCoopModal &&
            !showSalesMenu &&
            !buildingOwnerId &&
            !customerAction &&
            hudShift.phase === 'playing' && (
              <PauseModal
                world={activeWorld}
                coopActive={Boolean(hudShift.player2?.active)}
                onResume={() => {
                  pausedRef.current = false;
                  setPaused(false);
                }}
                onOpenCoop={() => {
                  pausedRef.current = false;
                  setPaused(false);
                  setShowCoopModal(true);
                }}
                onSaveNow={() => saveCurrentWorld(false)}
                onSaveAndExit={handleSaveAndExit}
              />
            )}

          {hudShift.phase === 'day_complete' && (
            <UpgradeShopModal
              world={activeWorld}
              shift={hudShift}
              onNextDay={handleNextDay}
              onSaveAndExit={handleSaveAndExit}
            />
          )}
        </div>
      )}
    </main>
  );
}
