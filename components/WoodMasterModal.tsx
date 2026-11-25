'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Hammer,
  Lock,
  PackageCheck,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import {
  RENTABLE_BUILDINGS,
  WOOD_MASTER_CATALOG,
  WOOD_MASTER_SHOP,
  formatMoney,
} from '@/lib/game/constants';
import type {
  HeldItem,
  ShopBuildingId,
  WoodOrderKind,
  WorldSave,
} from '@/lib/game/types';

interface WoodMasterModalProps {
  world: WorldSave;
  holding: HeldItem;
  onPlaceOrder: (kind: WoodOrderKind, targetShopId?: ShopBuildingId) => void;
  onReceiveOrder: (orderId: string) => void;
  onClose: () => void;
}

function formatBuildDuration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins <= 0) return `${rem}s`;
  return `${mins}m ${rem.toString().padStart(2, '0')}s`;
}

export default function WoodMasterModal({
  world,
  holding,
  onPlaceOrder,
  onReceiveOrder,
  onClose,
}: WoodMasterModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [chosenShopId, setChosenShopId] = useState<ShopBuildingId | undefined>(
    undefined
  );
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const orders = useMemo(() => world.woodOrders ?? [], [world.woodOrders]);
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );
  const buildingOrders = useMemo(
    () => orders.filter((o) => o.status === 'building'),
    [orders]
  );

  const unlockedSnacksRecipe =
    world.unlockedRecipes.includes('samosa') ||
    world.unlockedRecipes.includes('pakora');
  const unlockedColdRecipe =
    world.unlockedRecipes.includes('cold_drink') ||
    world.unlockedRecipes.includes('ice_cream');

  const eligibleKitchenShops = useMemo(() => {
    const installed = new Set(world.shopKitchens ?? []);
    const ordered = new Set(
      orders
        .filter((o) => o.kind === 'shop_kitchen' && o.targetShopId)
        .map((o) => o.targetShopId as ShopBuildingId)
    );
    return world.rentedShops
      .filter(
        (r) => !installed.has(r.buildingId) && !ordered.has(r.buildingId)
      )
      .map((r) => RENTABLE_BUILDINGS.find((b) => b.id === r.buildingId))
      .filter((b): b is NonNullable<typeof b> => Boolean(b));
  }, [world.rentedShops, world.shopKitchens, orders]);

  const activeKitchenShopId = eligibleKitchenShops.some(
    (b) => b.id === chosenShopId
  )
    ? chosenShopId
    : eligibleKitchenShops[0]?.id;

  const hasPendingSnacksOrder = orders.some((o) => o.kind === 'snacks_cart');
  const hasPendingColdOrder = orders.some((o) => o.kind === 'cold_cart');
  const hasPendingChaiStallOrder = orders.some((o) => o.kind === 'chai_stall');

  const actionableItems = useMemo(() => {
    const items: Array<
      | { type: 'receive'; orderId: string }
      | {
          type: 'order';
          kind: WoodOrderKind;
          enabled: boolean;
          targetShopId?: ShopBuildingId;
        }
    > = [];

    for (const ro of readyOrders) {
      items.push({ type: 'receive', orderId: ro.id });
    }

    for (const cat of WOOD_MASTER_CATALOG) {
      const canAfford = world.cashCents >= cat.priceCents;
      if (cat.kind === 'chair' || cat.kind === 'table') {
        items.push({ type: 'order', kind: cat.kind, enabled: canAfford });
      } else if (cat.kind === 'shop_kitchen') {
        items.push({
          type: 'order',
          kind: cat.kind,
          enabled: canAfford && Boolean(activeKitchenShopId),
          targetShopId: activeKitchenShopId,
        });
      } else if (cat.kind === 'snacks_cart') {
        items.push({
          type: 'order',
          kind: cat.kind,
          enabled:
            canAfford &&
            unlockedSnacksRecipe &&
            !world.hasSnacksCart &&
            !hasPendingSnacksOrder,
        });
      } else if (cat.kind === 'cold_cart') {
        items.push({
          type: 'order',
          kind: cat.kind,
          enabled:
            canAfford &&
            unlockedColdRecipe &&
            !world.hasColdCart &&
            !hasPendingColdOrder,
        });
      } else if (cat.kind === 'chai_stall') {
        items.push({
          type: 'order',
          kind: cat.kind,
          enabled:
            canAfford &&
            world.hasTeaStall === false &&
            !hasPendingChaiStallOrder,
        });
      }
    }
    return items;
  }, [
    readyOrders,
    world.cashCents,
    world.hasSnacksCart,
    world.hasColdCart,
    world.hasTeaStall,
    activeKitchenShopId,
    unlockedSnacksRecipe,
    unlockedColdRecipe,
    hasPendingSnacksOrder,
    hasPendingColdOrder,
    hasPendingChaiStallOrder,
  ]);

  const itemCount = actionableItems.length;
  const safeIdx = itemCount > 0 ? Math.min(selectedIdx, itemCount - 1) : 0;

  useEffect(() => {
    rowRefs.current[safeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [safeIdx]);

  const handleUp = useCallback(() => {
    if (itemCount <= 0) return;
    setSelectedIdx((prev) => (prev - 1 + itemCount) % itemCount);
  }, [itemCount]);

  const handleDown = useCallback(() => {
    if (itemCount <= 0) return;
    setSelectedIdx((prev) => (prev + 1) % itemCount);
  }, [itemCount]);

  const handleSelect = useCallback(() => {
    const target = actionableItems[safeIdx];
    if (!target) return;
    if (target.type === 'receive') {
      onReceiveOrder(target.orderId);
    } else if (target.enabled) {
      onPlaceOrder(target.kind, target.targetShopId);
    }
  }, [actionableItems, safeIdx, onReceiveOrder, onPlaceOrder]);

  useMenuKeyboard({
    onUp: handleUp,
    onDown: handleDown,
    onLeft: handleUp,
    onRight: handleDown,
    onSelect: handleSelect,
    onClose,
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl bg-[#2A201B] border border-[#D97706]/40 shadow-2xl text-[#FFFDF9] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#92400E] flex items-center justify-center shrink-0">
              <Hammer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                {WOOD_MASTER_SHOP.shopName}
              </h2>
              <p className="text-xs text-[#D6C7B5] tabular-nums">
                Master Carpenter:{' '}
                <span className="font-semibold text-[#FDE68A]">
                  {WOOD_MASTER_SHOP.masterName}
                </span>{' '}
                · Cash:{' '}
                <span className="font-mono font-bold text-[#FBBF24]">
                  {formatMoney(world.cashCents)}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close wood master modal"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="p-3 rounded-lg bg-[#221915] border border-[#D97706]/25 text-xs text-[#FDE68A] leading-relaxed">
            &ldquo;Assalam-o-Alaikum! Place an order for custom Chairs, Tables,
            Indoor Shop Kitchens, or 4-Wheel Readi Carts. Every item takes real
            crafting time — I will notify you as soon as your order is ready to
            collect!&rdquo;
          </div>

          {/* Ready Orders */}
          {readyOrders.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#86EFAC] flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4" />
                <span>Ready to Collect ({readyOrders.length})</span>
              </div>

              {readyOrders.map((order, rIdx) => {
                const isSelected = safeIdx === rIdx;
                const shopName = order.targetShopId
                  ? RENTABLE_BUILDINGS.find((b) => b.id === order.targetShopId)
                      ?.shopName
                  : null;
                return (
                  <div
                    key={order.id}
                    ref={(el) => {
                      rowRefs.current[rIdx] = el;
                    }}
                    onMouseEnter={() => setSelectedIdx(rIdx)}
                    className={`flex items-center justify-between gap-4 p-3.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#14532D]/60 border-[#86EFAC] ring-1 ring-[#86EFAC]/60'
                        : 'bg-[#14532D]/35 border-[#4ADE80]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-[#86EFAC] opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-[#DCFCE7]">
                          {order.label}
                          {shopName ? ` (${shopName})` : ''}
                        </div>
                        <div className="text-xs text-[#86EFAC]/90 mt-0.5">
                          {(order.kind === 'chair' || order.kind === 'table') &&
                          holding !== null
                            ? 'Hands full — clicking Receive puts it on the Pickup Pad outside!'
                            : 'Completed! Receive now to install or carry.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onReceiveOrder(order.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white font-mono text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Receive Order</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Building Orders (Live Countdown) */}
          {buildingOrders.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#FDBA74] flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Currently Crafting ({buildingOrders.length})</span>
              </div>

              {buildingOrders.map((order) => {
                const pct =
                  order.durationSec > 0
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          Math.round(
                            ((order.durationSec - order.remainingSec) /
                              order.durationSec) *
                              100
                          )
                        )
                      )
                    : 100;
                const shopName = order.targetShopId
                  ? RENTABLE_BUILDINGS.find((b) => b.id === order.targetShopId)
                      ?.shopName
                  : null;
                return (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-lg bg-[#221915] border border-[#D97706]/35 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs tabular-nums">
                      <span className="font-display font-bold text-[#FFFDF9]">
                        {order.label}
                        {shopName ? ` (${shopName})` : ''}
                      </span>
                      <span className="font-mono font-bold text-[#FBBF24]">
                        {formatBuildDuration(order.remainingSec)} left ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#1B1410] overflow-hidden">
                      <div
                        className="h-full bg-[#D97706] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Workshop Catalog */}
          <div className="space-y-2.5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#D6C7B5]">
              Order Carpentry &amp; Readi Carts
            </div>

            {WOOD_MASTER_CATALOG.map((cat, cIdx) => {
              const listIdx = readyOrders.length + cIdx;
              const isSelected = safeIdx === listIdx;
              const canAfford = world.cashCents >= cat.priceCents;

              let lockedReason: string | null = null;
              let alreadyDoneLabel: string | null = null;

              if (cat.kind === 'shop_kitchen') {
                if (world.rentedShops.length === 0) {
                  lockedReason = 'Rent an empty Shop Building first!';
                } else if (eligibleKitchenShops.length === 0) {
                  const hasOrdered = orders.some(
                    (o) => o.kind === 'shop_kitchen'
                  );
                  alreadyDoneLabel = hasOrdered
                    ? 'Kitchen Ordered'
                    : 'All Rented Shops Have Kitchens';
                }
              } else if (cat.kind === 'snacks_cart') {
                if (world.hasSnacksCart) {
                  alreadyDoneLabel = 'Owned (Left Plaza)';
                } else if (hasPendingSnacksOrder) {
                  alreadyDoneLabel = 'Order Active';
                } else if (!unlockedSnacksRecipe) {
                  lockedReason = 'Learn Samosa Recipe in Supermarket first';
                }
              } else if (cat.kind === 'cold_cart') {
                if (world.hasColdCart) {
                  alreadyDoneLabel = 'Owned (Right Plaza)';
                } else if (hasPendingColdOrder) {
                  alreadyDoneLabel = 'Order Active';
                } else if (!unlockedColdRecipe) {
                  lockedReason = 'Learn Cold Recipe in Supermarket first';
                }
              } else if (cat.kind === 'chai_stall') {
                if (world.hasTeaStall !== false) {
                  alreadyDoneLabel = 'Already Owned';
                } else if (hasPendingChaiStallOrder) {
                  alreadyDoneLabel = 'Order Active';
                }
              }

              const canOrder =
                canAfford && !lockedReason && !alreadyDoneLabel;

              return (
                <div
                  key={cat.kind}
                  ref={(el) => {
                    rowRefs.current[listIdx] = el;
                  }}
                  onMouseEnter={() => setSelectedIdx(listIdx)}
                  className={`rounded-lg border p-3.5 transition-colors space-y-2.5 ${
                    isSelected
                      ? 'bg-[#33261F] border-[#FBBF24] ring-1 ring-[#FBBF24]/50'
                      : 'bg-[#221915] border-[#D4A373]/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isSelected ? 'text-[#FBBF24] opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display font-bold text-sm text-[#FFFDF9]">
                            {cat.name}
                          </h3>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1B1410] border border-[#D4A373]/20 font-mono text-[11px] text-[#FDBA74]">
                            <Clock className="w-3 h-3" />
                            <span>{formatBuildDuration(cat.durationSec)}</span>
                          </span>
                        </div>
                        <p className="text-xs text-[#D6C7B5] mt-0.5">
                          {cat.description}
                        </p>
                      </div>
                    </div>

                    {alreadyDoneLabel ? (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#86EFAC] shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{alreadyDoneLabel}</span>
                      </div>
                    ) : lockedReason ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1410] text-[#94A3B8] text-xs font-semibold shrink-0">
                        <Lock className="w-3.5 h-3.5" />
                        <span>{lockedReason}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canOrder}
                        onClick={() =>
                          onPlaceOrder(
                            cat.kind,
                            cat.kind === 'shop_kitchen'
                              ? activeKitchenShopId
                              : undefined
                          )
                        }
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          canOrder
                            ? 'bg-[#D97706] hover:bg-[#B45309] text-white'
                            : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                        }`}
                      >
                        <Hammer className="w-3.5 h-3.5" />
                        <span>Order {formatMoney(cat.priceCents)}</span>
                      </button>
                    )}
                  </div>

                  {/* Target shop picker for Shop Kitchen */}
                  {cat.kind === 'shop_kitchen' &&
                    eligibleKitchenShops.length > 0 && (
                      <div className="pl-6 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[#D6C7B5] flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                          <span>Install in shop:</span>
                        </span>
                        {eligibleKitchenShops.map((shop) => (
                          <button
                            key={shop.id}
                            type="button"
                            onClick={() => setChosenShopId(shop.id)}
                            className={`px-2.5 py-1 rounded font-semibold cursor-pointer transition-colors ${
                              activeKitchenShopId === shop.id
                                ? 'bg-[#7C3AED] text-white'
                                : 'bg-[#1B1410] text-[#D6C7B5] hover:text-white'
                            }`}
                          >
                            {shop.shopName}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Navigate Orders</span>
          <span className="text-[#FDE68A] font-semibold">
            Space / Enter Order or Receive · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
