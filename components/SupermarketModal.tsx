'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Armchair,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cookie,
  Lock,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import {
  DRINK_CATALOG,
  LEVEL2_SERVED_THRESHOLD,
  SNACKS_CART_PRICE_CENTS,
  SUPERMARKET_CATALOG,
  formatMoney,
} from '@/lib/game/constants';
import type {
  DrinkType,
  InventoryState,
  WorldSave,
} from '@/lib/game/types';

interface SupermarketModalProps {
  world: WorldSave;
  inventory: InventoryState;
  onBuyItem: (itemId: string) => void;
  onBuyRecipe: (drink: DrinkType) => void;
  onBuySnacksCart: () => void;
  onClose: () => void;
}

type SupermarketTab = 'supplies' | 'snacks' | 'furniture' | 'recipes';

const DRINK_ORDER: DrinkType[] = ['tea', 'doodh_patti', 'coffee', 'samosa'];
const TABS: SupermarketTab[] = ['supplies', 'snacks', 'furniture', 'recipes'];

export default function SupermarketModal({
  world,
  inventory,
  onBuyItem,
  onBuyRecipe,
  onBuySnacksCart,
  onClose,
}: SupermarketModalProps) {
  const [tab, setTab] = useState<SupermarketTab>('supplies');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const unlockedCoffee = world.unlockedRecipes.includes('coffee');
  const unlockedSnacksRecipe =
    world.unlockedRecipes.includes('samosa') ||
    world.unlockedRecipes.includes('pakora');

  const supplyItems = SUPERMARKET_CATALOG.filter(
    (item) =>
      (item.category === 'supplies' || item.category === 'cups') &&
      (!item.requiresCoffeeRecipe || unlockedCoffee) &&
      (!item.requiresSnacksRecipe || unlockedSnacksRecipe)
  );
  const snackItems = SUPERMARKET_CATALOG.filter(
    (item) => item.category === 'snacks'
  );
  const furnitureItems = SUPERMARKET_CATALOG.filter(
    (item) => item.category === 'furniture'
  );

  // Recipes tab includes DRINK_ORDER + 1 card for buying the 2nd Readi Cart
  const recipesTabCount = DRINK_ORDER.length + 1;

  const activeCount =
    tab === 'supplies'
      ? supplyItems.length
      : tab === 'snacks'
        ? snackItems.length
        : tab === 'furniture'
          ? furnitureItems.length
          : recipesTabCount;

  const safeIndex =
    activeCount > 0 ? Math.min(selectedIdx, activeCount - 1) : 0;

  useEffect(() => {
    itemRefs.current[safeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [safeIndex, tab]);

  const switchTab = useCallback((nextTab: SupermarketTab) => {
    setTab(nextTab);
    setSelectedIdx(0);
  }, []);

  const handleUp = useCallback(() => {
    if (activeCount <= 0) return;
    setSelectedIdx((prev) => (prev - 1 + activeCount) % activeCount);
  }, [activeCount]);

  const handleDown = useCallback(() => {
    if (activeCount <= 0) return;
    setSelectedIdx((prev) => (prev + 1) % activeCount);
  }, [activeCount]);

  const handleLeft = useCallback(() => {
    const idx = TABS.indexOf(tab);
    switchTab(TABS[(idx - 1 + TABS.length) % TABS.length]);
  }, [tab, switchTab]);

  const handleRight = useCallback(() => {
    const idx = TABS.indexOf(tab);
    switchTab(TABS[(idx + 1) % TABS.length]);
  }, [tab, switchTab]);

  const handleSelect = useCallback(() => {
    if (tab === 'supplies') {
      const item = supplyItems[safeIndex];
      if (item && world.cashCents >= item.priceCents) {
        onBuyItem(item.id);
      }
    } else if (tab === 'snacks') {
      const item = snackItems[safeIndex];
      if (item && world.cashCents >= item.priceCents) {
        onBuyItem(item.id);
      }
    } else if (tab === 'furniture') {
      const item = furnitureItems[safeIndex];
      if (item && world.cashCents >= item.priceCents) {
        onBuyItem(item.id);
      }
    } else {
      if (safeIndex === DRINK_ORDER.length) {
        if (
          unlockedSnacksRecipe &&
          !world.hasSnacksCart &&
          world.cashCents >= SNACKS_CART_PRICE_CENTS
        ) {
          onBuySnacksCart();
        }
        return;
      }
      const drinkId = DRINK_ORDER[safeIndex];
      const info = drinkId ? DRINK_CATALOG[drinkId] : undefined;
      if (
        drinkId &&
        info &&
        !world.unlockedRecipes.includes(drinkId) &&
        !(info.requiresLevel2 && world.stage < 2) &&
        world.cashCents >= info.unlockCostCents
      ) {
        onBuyRecipe(drinkId);
      }
    }
  }, [
    tab,
    safeIndex,
    supplyItems,
    snackItems,
    furnitureItems,
    world.cashCents,
    world.unlockedRecipes,
    world.stage,
    world.hasSnacksCart,
    unlockedSnacksRecipe,
    onBuyItem,
    onBuyRecipe,
    onBuySnacksCart,
  ]);

  useMenuKeyboard({
    onUp: handleUp,
    onDown: handleDown,
    onLeft: handleLeft,
    onRight: handleRight,
    onSelect: handleSelect,
    onClose,
  });

  const chairCount = world.furniture.filter((f) => f.kind === 'chair').length;
  const tableCount = world.furniture.filter((f) => f.kind === 'table').length;
  const learnedCount = DRINK_ORDER.filter((d) =>
    world.unlockedRecipes.includes(d)
  ).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl bg-[#2A201B] border border-[#D4A373]/30 shadow-2xl text-[#FFFDF9] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#15803D] flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                Chai Supermarket
              </h2>
              <p className="text-xs text-[#D6C7B5] tabular-nums">
                Tea, Sugar, Snacks, Recipes &amp; 2nd Readi · Cash:{' '}
                <span className="font-mono font-bold text-[#FBBF24]">
                  {formatMoney(world.cashCents)}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close supermarket"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stock & Tabs */}
        <div className="px-6 py-3 bg-[#1B1410] border-b border-[#D4A373]/15 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex flex-wrap items-center gap-2 font-mono font-semibold text-[#EAE0D0]">
            <span>Cups: {inventory.cups}</span>
            <span>·</span>
            <span>Tea: {inventory.teaLeaves}</span>
            <span>·</span>
            <span>Sugar: {inventory.sugar}</span>
            <span>·</span>
            <span className="text-[#FCA5A5]">
              Biscuits: {inventory.biscuits}
            </span>
            <span>·</span>
            <span className="text-[#F9A8D4]">Cakes: {inventory.cupcakes}</span>
            {unlockedCoffee && (
              <>
                <span>·</span>
                <span className="text-[#FDE68A]">
                  Beans: {inventory.coffeePowder}
                </span>
              </>
            )}
            {(unlockedSnacksRecipe || world.hasSnacksCart) && (
              <>
                <span>·</span>
                <span className="text-[#FDBA74]">
                  Samosa: {inventory.samosaMix} / Pakora: {inventory.pakoraMix} / Oil:{' '}
                  {inventory.cookingOil}
                </span>
              </>
            )}
            <span>·</span>
            <span className="text-[#86EFAC]">
              Chairs: {chairCount} / Tables: {tableCount}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#2A201B]">
            <button
              type="button"
              onClick={() => switchTab('supplies')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                tab === 'supplies'
                  ? 'bg-[#15803D] text-white'
                  : 'text-[#D6C7B5] hover:text-white'
              }`}
            >
              Supplies &amp; Cups
            </button>
            <button
              type="button"
              onClick={() => switchTab('snacks')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                tab === 'snacks'
                  ? 'bg-[#DB2777] text-white'
                  : 'text-[#F9A8D4] hover:text-white'
              }`}
            >
              <Cookie className="w-3.5 h-3.5" />
              <span>Biscuits &amp; Cakes</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab('furniture')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                tab === 'furniture'
                  ? 'bg-[#D97706] text-white'
                  : 'text-[#FDE68A] hover:text-white'
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>Chairs &amp; Tables</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab('recipes')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                tab === 'recipes'
                  ? 'bg-[#EA580C] text-white'
                  : 'text-[#FDBA74] hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Recipes &amp; 2nd Readi ({learnedCount}/4)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {tab === 'supplies' &&
            supplyItems.map((item, idx) => {
              const canAfford = world.cashCents >= item.priceCents;
              const isSelected = safeIndex === idx;
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`flex items-center justify-between gap-4 p-3.5 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-[#33261F] border-[#86EFAC] ring-1 ring-[#86EFAC]/50'
                      : 'bg-[#221915] border-[#D4A373]/15'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-opacity ${
                        isSelected
                          ? 'text-[#86EFAC] opacity-100'
                          : 'opacity-0'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm">
                        {item.name}
                      </div>
                      <div className="text-xs text-[#D6C7B5] mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyItem(item.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                      canAfford
                        ? 'bg-[#EA580C] hover:bg-[#DC4E07] text-white cursor-pointer'
                        : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{formatMoney(item.priceCents)}</span>
                  </button>
                </div>
              );
            })}

          {tab === 'snacks' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#221915] border border-[#F472B6]/25 text-xs text-[#FBCFE8] leading-relaxed">
                Stock Rs.20-style Tea Biscuits ($0.30) &amp; Mini Cupcakes ($0.40)! Customers will ONLY order biscuits or cupcakes when you have them in stock on your Chai Readi.
              </div>

              {snackItems.map((item, idx) => {
                const canAfford = world.cashCents >= item.priceCents;
                const isSelected = safeIndex === idx;
                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`flex items-center justify-between gap-4 p-3.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#33261F] border-[#F9A8D4] ring-1 ring-[#F9A8D4]/50'
                        : 'bg-[#221915] border-[#D4A373]/15'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-opacity ${
                          isSelected
                            ? 'text-[#F9A8D4] opacity-100'
                            : 'opacity-0'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#D6C7B5] mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyItem(item.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        canAfford
                          ? 'bg-[#DB2777] hover:bg-[#BE185D] text-white cursor-pointer'
                          : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                      }`}
                    >
                      <Cookie className="w-3.5 h-3.5" />
                      <span>{formatMoney(item.priceCents)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'furniture' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#221915] border border-[#D4A373]/20 text-xs text-[#FDE68A] leading-relaxed">
                Buy Chairs &amp; Tables to carry outside or inside your rented shops and place with <span className="font-mono font-bold">E</span>! Customers relax longer on chairs &amp; may leave random tips!
              </div>

              {furnitureItems.map((item, idx) => {
                const canAfford = world.cashCents >= item.priceCents;
                const isSelected = safeIndex === idx;
                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#33261F] border-[#FDBA74] ring-1 ring-[#FDBA74]/50'
                        : 'bg-[#221915] border-[#D4A373]/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-opacity ${
                          isSelected
                            ? 'text-[#FDBA74] opacity-100'
                            : 'opacity-0'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#D6C7B5] mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyItem(item.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        canAfford
                          ? 'bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer'
                          : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                      }`}
                    >
                      <Armchair className="w-3.5 h-3.5" />
                      <span>Buy {formatMoney(item.priceCents)}</span>
                    </button>
                  </div>
                );
              })}

              {world.pendingFurniture.length > 0 && (
                <div className="p-3 rounded-lg bg-[#1E293B] border border-[#38BDF8]/30 text-xs text-[#BAE6FD]">
                  <span className="font-bold">{world.pendingFurniture.length} item(s)</span> waiting at the Supermarket Pickup Pad by the entrance! Empty your hands and press <span className="font-mono font-bold">E</span> there to pick up.
                </div>
              )}
            </div>
          )}

          {tab === 'recipes' && (
            <div className="space-y-3">
              {world.stage < 2 && (
                <div className="p-3 rounded-lg bg-[#1E293B] border border-[#38BDF8]/30 text-xs text-[#BAE6FD]">
                  Stage 1: Serve{' '}
                  <span className="font-mono font-bold">
                    {Math.max(0, LEVEL2_SERVED_THRESHOLD - world.totalServed)}
                  </span>{' '}
                  more orders (or finish Day 1) to unlock Level 2 recipes! You can already learn the Samosa &amp; Pakora Recipe below anytime!
                </div>
              )}

              {DRINK_ORDER.map((drinkId, idx) => {
                const info = DRINK_CATALOG[drinkId];
                const isUnlocked = world.unlockedRecipes.includes(drinkId);
                const stageBlocked = info.requiresLevel2 && world.stage < 2;
                const canAfford = world.cashCents >= info.unlockCostCents;
                const isSelected = safeIndex === idx;
                const title =
                  drinkId === 'samosa'
                    ? 'Samosa & Pakora Recipe (Combo)'
                    : info.name;
                const priceTag =
                  drinkId === 'samosa'
                    ? `Samosa $0.80 · Pakora $0.70`
                    : `Sells ${formatMoney(info.priceCents)}/cup`;

                return (
                  <div
                    key={drinkId}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`rounded-lg border p-4 space-y-2.5 transition-colors ${
                      isSelected
                        ? 'bg-[#33261F] border-[#FDBA74] ring-1 ring-[#FDBA74]/50'
                        : 'bg-[#221915] border-[#D4A373]/25'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 mt-0.5 transition-opacity ${
                            isSelected
                              ? 'text-[#FDBA74] opacity-100'
                              : 'opacity-0'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display font-bold text-sm text-[#FFFDF9]">
                              {title}
                            </h3>
                            <span className="font-mono text-xs font-bold text-[#FBBF24]">
                              {priceTag}
                            </span>
                          </div>
                          <p className="text-xs text-[#D6C7B5] mt-0.5">
                            {info.summary}
                          </p>
                        </div>
                      </div>

                      {isUnlocked ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#86EFAC]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Learned</span>
                        </div>
                      ) : stageBlocked ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1410] text-[#94A3B8] text-xs font-semibold">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Requires Level 2</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuyRecipe(drinkId)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold cursor-pointer ${
                            canAfford
                              ? 'bg-[#EA580C] hover:bg-[#DC4E07] text-white'
                              : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Buy Recipe {formatMoney(info.unlockCostCents)}</span>
                        </button>
                      )}
                    </div>

                    {isUnlocked ? (
                      <ol className="space-y-1.5 pt-2 border-t border-[#D4A373]/15">
                        {info.steps.map((stepText, stepIdx) => (
                          <li
                            key={stepIdx}
                            className="flex items-start gap-2 text-xs text-[#EAE0D0]"
                          >
                            <span className="w-5 h-5 rounded bg-[#EA580C] text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                              {stepIdx + 1}
                            </span>
                            <span className="pt-0.5">{stepText}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="pt-2 border-t border-[#D4A373]/10 text-xs text-[#A89885] italic flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Buy this recipe slip at the Supermarket counter to learn {title}.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Buy 2nd Readi: Samosa & Pakora Cart */}
              {(() => {
                const idx = DRINK_ORDER.length;
                const isSelected = safeIndex === idx;
                const canAffordCart = world.cashCents >= SNACKS_CART_PRICE_CENTS;
                return (
                  <div
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`rounded-lg border p-4 space-y-2 transition-colors ${
                      isSelected
                        ? 'bg-[#33261F] border-[#FCA5A5] ring-1 ring-[#FCA5A5]/50'
                        : 'bg-[#221915] border-[#B91C1C]/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 mt-0.5 transition-opacity ${
                            isSelected
                              ? 'text-[#FCA5A5] opacity-100'
                              : 'opacity-0'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-sm text-[#FFFDF9]">
                              2nd Readi: Samosa &amp; Pakora Cart
                            </h3>
                            <span className="font-mono text-xs font-bold text-[#FBBF24]">
                              {formatMoney(SNACKS_CART_PRICE_CENTS)}
                            </span>
                          </div>
                          <p className="text-xs text-[#D6C7B5] mt-0.5">
                            Sets up a 4-wheel frying Readi on the left plaza with a Hot Oil Kadhai, Paper Plates &amp; 2 Showcase trays (+starter Samosa, Pakora &amp; Oil included!).
                          </p>
                        </div>
                      </div>

                      {world.hasSnacksCart ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#86EFAC]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Owned (Left Plaza)</span>
                        </div>
                      ) : !unlockedSnacksRecipe ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1410] text-[#94A3B8] text-xs font-semibold">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Buy Samosa &amp; Pakora Recipe First</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAffordCart}
                          onClick={onBuySnacksCart}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold cursor-pointer ${
                            canAffordCart
                              ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white'
                              : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Buy 2nd Readi {formatMoney(SNACKS_CART_PRICE_CENTS)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Keyboard Controls Legend */}
        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Up &amp; Down · A / D Switch Tab</span>
          <span className="text-[#86EFAC] font-semibold">
            Space / Enter Buy · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
