'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DRINK_CATALOG,
  HELPER_CHARITY_CENTS,
  MILKMAN_CATALOG,
  RENTABLE_BUILDINGS,
  SHOP_WEEK_DAYS,
  SNACKS_CART_PRICE_CENTS,
  SUPERMARKET_CATALOG,
  formatMoney,
} from '@/lib/game/constants';
import { cafeAudio } from '@/lib/game/audio';
import {
  createInitialShift,
  findInteractTarget,
  getAvailableMenuChoices,
  getGuidedHint,
  stepStage1Simulation,
} from '@/lib/game/engine';
import { loadAllWorlds, persistWorld, removeWorld } from '@/lib/game/storage';
import { Chai3DSceneController } from '@/lib/game/threeScene';
import type {
  DrinkType,
  ProjectedLabel,
  ShiftSnapshot,
  ShopBuildingId,
  Stage1Input,
  WorldSave,
} from '@/lib/game/types';
import { useIsMobile } from '@/hooks/use-mobile';
import BuildingRentModal from './BuildingRentModal';
import CustomerActionModal from './CustomerActionModal';
import GameHUD from './GameHUD';
import KidHelperModal from './KidHelperModal';
import MilkmanShopModal from './MilkmanShopModal';
import PauseModal from './PauseModal';
import SupermarketModal from './SupermarketModal';
import TitleScreen from './TitleScreen';
import UpgradeShopModal from './UpgradeShopModal';
import WorldSelectModal from './WorldSelectModal';

type ScreenState = 'TITLE' | 'WORLD_SELECT' | 'PLAYING';

interface CustomerActionState {
  kind: 'customer' | 'car';
  id: string;
  requestedDrink: DrinkType;
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
  const [feedbackBanner, setFeedbackBanner] = useState<{
    text: string;
    color: string;
  } | null>(null);

  const [paused, setPaused] = useState(false);
  const [showSupermarket, setShowSupermarket] = useState(false);
  const [showMilkmanShop, setShowMilkmanShop] = useState(false);
  const [showHelperModal, setShowHelperModal] = useState(false);
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
      showHelperModal ||
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
    showHelperModal,
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
    setShowHelperModal(false);
    setBuildingOwnerId(null);
    setCustomerAction(null);
    setGuidedHint(getGuidedHint(shift, updatedWorld));
    setTargetPrompt(findInteractTarget(shift, updatedWorld)?.prompt || null);
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

    let bannerText = `Bought ${item.name}!`;
    if (item.addFurniture) {
      if (s.player.holding === null) {
        s.player.holding =
          item.addFurniture === 'chair' ? 'carried_chair' : 'carried_table';
        setShowSupermarket(false);
        bannerText = `Picked up ${item.addFurniture === 'chair' ? 'Chair' : 'Table'}! Place outside with E`;
      } else {
        w.pendingFurniture = [...w.pendingFurniture, item.addFurniture];
        bannerText = `Bought ${item.name}! Pick up at Supermarket entrance pad (E)`;
      }
    }

    w.lastPlayedAt = Date.now();
    w.activeShift = s;

    cafeAudio.play('buy');
    setActiveWorld({ ...w });
    setHudShift({ ...s });
    setFeedbackBanner({
      text: bannerText,
      color: '#86EFAC',
    });
    feedbackTimerRef.current = item.addFurniture ? 2.4 : 1.6;
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
          ? 'Unlocked Samosa & Pakora Recipe! Buy the 2nd Snacks Readi next!'
          : `Unlocked ${info.name} Recipe!`,
      color: '#FDE68A',
    });
    feedbackTimerRef.current = 2.4;
    persistWorld(w);
  }, []);

  const handleBuySnacksCart = useCallback(() => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;
    const hasRecipe =
      w.unlockedRecipes.includes('samosa') ||
      w.unlockedRecipes.includes('pakora');
    if (
      !hasRecipe ||
      w.hasSnacksCart ||
      w.cashCents < SNACKS_CART_PRICE_CENTS
    ) {
      return;
    }

    w.cashCents -= SNACKS_CART_PRICE_CENTS;
    w.hasSnacksCart = true;
    s.inventory.samosaMix += 4;
    s.inventory.pakoraMix += 4;
    s.inventory.cookingOil += 8;
    w.lastPlayedAt = Date.now();
    w.activeShift = s;

    cafeAudio.play('level_up');
    setActiveWorld({ ...w });
    setHudShift({ ...s });
    setFeedbackBanner({
      text: '2nd Snacks Readi Unlocked on Left Plaza (+4 Samosa, +4 Pakora, +8 Oil)!',
      color: '#86EFAC',
    });
    feedbackTimerRef.current = 2.8;
    persistWorld(w);
  }, []);

  const handleGiveHelperCharity = useCallback(() => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;
    if (s.helper.charityGivenToday || w.cashCents < HELPER_CHARITY_CENTS) {
      return;
    }

    const nextShift: ShiftSnapshot = {
      ...s,
      helper: {
        ...s.helper,
        charityGivenToday: true,
      },
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

    cafeAudio.play('buy');
    setShowHelperModal(false);
    setActiveWorld(nextWorld);
    setHudShift(nextShift);
    setFeedbackBanner({
      text: `Gave ${formatMoney(HELPER_CHARITY_CENTS)} to Chotu — customer patience boosted!`,
      color: '#FDE68A',
    });
    feedbackTimerRef.current = 2.2;
    persistWorld(nextWorld);
  }, []);

  const handleHireHelper = useCallback(() => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w || !s) return;

    s.helper.status = 'hired';
    s.helper.task = 'idle';
    s.helper.statusNote = 'Ready to Help';
    w.lastPlayedAt = Date.now();
    w.activeShift = s;

    cafeAudio.play('level_up');
    setShowHelperModal(false);
    setActiveWorld({ ...w });
    setHudShift({ ...s });
    setFeedbackBanner({
      text: 'Chotu hired for today! He will make & serve Chai, Doodh Patti & Coffee!',
      color: '#86EFAC',
    });
    feedbackTimerRef.current = 2.6;
    persistWorld(w);
  }, []);

  const handleRentOrPayBuilding = useCallback((id: ShopBuildingId) => {
    const w = worldRef.current;
    const s = shiftRef.current;
    if (!w) return;
    const cfg = RENTABLE_BUILDINGS.find((b) => b.id === id);
    if (!cfg || w.cashCents < cfg.weeklyRentCents) return;

    w.cashCents -= cfg.weeklyRentCents;
    const existing = w.rentedShops.find((r) => r.buildingId === id);
    if (existing) {
      w.rentedShops = w.rentedShops.map((r) =>
        r.buildingId === id
          ? {
              ...r,
              nextRentDueDay: Math.max(w.day, r.nextRentDueDay) + SHOP_WEEK_DAYS,
              weeksPaid: r.weeksPaid + 1,
            }
          : r
      );
    } else {
      w.rentedShops = [
        ...w.rentedShops,
        {
          buildingId: id,
          rentedOnDay: w.day,
          nextRentDueDay: w.day + SHOP_WEEK_DAYS,
          weeksPaid: 1,
        },
      ];
    }

    w.lastPlayedAt = Date.now();
    if (s) w.activeShift = s;

    cafeAudio.play('level_up');
    setBuildingOwnerId(null);
    setActiveWorld({ ...w });
    setFeedbackBanner({
      text: `${existing ? 'Paid weekly rent' : 'Rented'} ${cfg.shopName} (+${formatMoney(cfg.dailyIncomeBonusCents)}/day profit)!`,
      color: '#C4B5FD',
    });
    feedbackTimerRef.current = 2.6;
    persistWorld(w);
  }, []);

  const handleOfferAlternative = useCallback(
    (drink: DrinkType) => {
      const w = worldRef.current;
      const s = shiftRef.current;
      if (!w || !s || !customerAction) return;

      const accepted = Math.random() < 0.78;
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

    if (customerAction.kind === 'customer') {
      const cust = s.customers.find((c) => c.id === customerAction.id);
      if (cust && cust.status === 'waiting') {
        cust.status = 'walking_out';
      }
    } else if (customerAction.kind === 'car') {
      if (s.carCustomer.phase === 'waiting') {
        s.carCustomer.phase = 'leaving';
      }
    }

    cafeAudio.play('pickup');
    setFeedbackBanner({
      text: 'Politely told customer: Sold Out today',
      color: '#D6C7B5',
    });
    feedbackTimerRef.current = 1.8;
    setCustomerAction(null);
    setHudShift({ ...s });
    w.activeShift = s;
    persistWorld(w);
  }, [customerAction]);

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
    setShowHelperModal(false);
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
    setShowHelperModal(false);
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

          let dx = 0;
          let dz = 0;
          if (held.has('KeyW') || held.has('ArrowUp')) dz -= 1;
          if (held.has('KeyS') || held.has('ArrowDown')) dz += 1;
          if (held.has('KeyA') || held.has('ArrowLeft')) dx -= 1;
          if (held.has('KeyD') || held.has('ArrowRight')) dx += 1;

          if (
            Math.abs(touchInputRef.current.dx) > 0.1 ||
            Math.abs(touchInputRef.current.dz) > 0.1
          ) {
            dx += touchInputRef.current.dx;
            dz += touchInputRef.current.dz;
          }

          const input: Stage1Input = {
            dx,
            dz,
            interactJustPressed:
              just.has('KeyE') ||
              just.has('Space') ||
              just.has('Enter') ||
              touchInputRef.current.interactJust,
            offerRejectJustPressed:
              just.has('KeyF') ||
              just.has('KeyX') ||
              touchInputRef.current.offerRejectJust,
            dashJustPressed:
              just.has('KeyQ') ||
              just.has('ShiftLeft') ||
              just.has('ShiftRight') ||
              touchInputRef.current.dashJust,
          };

          justPressedKeysRef.current.clear();
          touchInputRef.current.interactJust = false;
          touchInputRef.current.offerRejectJust = false;
          touchInputRef.current.dashJust = false;

          const simEvents = stepStage1Simulation(shift, world, input, dt);

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
            setShowHelperModal(true);
          }
          if (simEvents.openBuildingOwnerId) {
            setBuildingOwnerId(simEvents.openBuildingOwnerId);
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
            feedbackTimerRef.current = 1.65;
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
            feedbackBanner={feedbackBanner}
            muted={muted}
            saveLabel={saveLabel}
            onToggleMute={handleToggleMute}
            onPause={() => {
              pausedRef.current = true;
              setPaused(true);
            }}
            onQuickSave={() => saveCurrentWorld(false)}
          />

          {isMobile &&
            hudShift.phase === 'playing' &&
            !paused &&
            !showSupermarket &&
            !showMilkmanShop &&
            !showHelperModal &&
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
              onBuySnacksCart={handleBuySnacksCart}
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

          {showHelperModal && hudShift.helper.status === 'sitting' && (
            <KidHelperModal
              cashCents={activeWorld.cashCents}
              helper={hudShift.helper}
              onGiveCharity={handleGiveHelperCharity}
              onHireHelper={handleHireHelper}
              onClose={() => setShowHelperModal(false)}
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

          {customerAction && (
            <CustomerActionModal
              targetKind={customerAction.kind}
              requestedDrink={customerAction.requestedDrink}
              availableChoices={getAvailableMenuChoices(activeWorld, hudShift)}
              holding={hudShift.player.holding}
              onOfferAlternative={handleOfferAlternative}
              onReject={handleRejectCustomer}
              onClose={() => setCustomerAction(null)}
            />
          )}

          {paused &&
            !showSupermarket &&
            !showMilkmanShop &&
            !showHelperModal &&
            !buildingOwnerId &&
            !customerAction &&
            hudShift.phase === 'playing' && (
              <PauseModal
                world={activeWorld}
                onResume={() => {
                  pausedRef.current = false;
                  setPaused(false);
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
