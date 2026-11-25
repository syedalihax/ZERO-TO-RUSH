'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Armchair,
  ChevronRight,
  Coins,
  Hammer,
  Store,
  Table2,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import {
  BUYER_SHOP,
  CHAI_STALL_PRICE_CENTS,
  CHAIR_PRICE_CENTS,
  COLD_CART_PRICE_CENTS,
  RESALE_RATE,
  SNACKS_CART_PRICE_CENTS,
  TABLE_PRICE_CENTS,
  formatMoney,
} from '@/lib/game/constants';
import type { HeldItem, WorldSave } from '@/lib/game/types';

interface GearBuyerModalProps {
  world: WorldSave;
  holding: HeldItem;
  p2Holding?: HeldItem;
  onSellTeaStall: () => void;
  onSellSnacksCart: () => void;
  onSellColdCart?: () => void;
  onSellFurniture: (kind: 'chair' | 'table', sellAll: boolean) => void;
  onClose: () => void;
}

interface BuyerActionItem {
  id: string;
  label: string;
  sublabel: string;
  priceLabel: string;
  originalLabel?: string;
  enabled: boolean;
  tone: 'sell' | 'close';
  icon: 'stall' | 'snacks' | 'chair' | 'table' | 'close';
  onTrigger: () => void;
}

export default function GearBuyerModal({
  world,
  holding,
  p2Holding = null,
  onSellTeaStall,
  onSellSnacksCart,
  onSellColdCart,
  onSellFurniture,
  onClose,
}: GearBuyerModalProps) {
  const hasTeaStall = world.hasTeaStall !== false;
  const hasRentedShop = world.rentedShops.length > 0;

  const chairCount =
    world.furniture.filter((f) => f.kind === 'chair').length +
    world.pendingFurniture.filter((k) => k === 'chair').length +
    (holding === 'carried_chair' ? 1 : 0) +
    (p2Holding === 'carried_chair' ? 1 : 0);

  const tableCount =
    world.furniture.filter((f) => f.kind === 'table').length +
    world.pendingFurniture.filter((k) => k === 'table').length +
    (holding === 'carried_table' ? 1 : 0) +
    (p2Holding === 'carried_table' ? 1 : 0);

  const teaStallResale = Math.round(CHAI_STALL_PRICE_CENTS * RESALE_RATE);
  const snacksCartResale = Math.round(SNACKS_CART_PRICE_CENTS * RESALE_RATE);
  const coldCartResale = Math.round(COLD_CART_PRICE_CENTS * RESALE_RATE);
  const chairResale = Math.round(CHAIR_PRICE_CENTS * RESALE_RATE);
  const tableResale = Math.round(TABLE_PRICE_CENTS * RESALE_RATE);

  const actions = useMemo<BuyerActionItem[]>(() => {
    const list: BuyerActionItem[] = [];

    if (hasTeaStall) {
      const hasAnyShopKitchen = (world.shopKitchens ?? []).length > 0;
      list.push({
        id: 'sell_tea_stall',
        label: 'Sell Main Chai Readi Stall',
        sublabel: hasAnyShopKitchen
          ? '50% resale value · You can cook in your built Shop Kitchen!'
          : 'Build a Shop Kitchen in a rented shop at Wood Master first!',
        priceLabel: `+${formatMoney(teaStallResale)}`,
        originalLabel: `Orig ${formatMoney(CHAI_STALL_PRICE_CENTS)}`,
        enabled: hasRentedShop && hasAnyShopKitchen,
        tone: 'sell',
        icon: 'stall',
        onTrigger: onSellTeaStall,
      });
    }

    list.push({
      id: 'sell_snacks_cart',
      label: 'Sell 2nd Snacks Readi (Samosa & Pakora)',
      sublabel: world.hasSnacksCart
        ? '50% resale value · Removes 2nd Readi cart from left plaza'
        : 'Not currently owned',
      priceLabel: `+${formatMoney(snacksCartResale)}`,
      originalLabel: `Orig ${formatMoney(SNACKS_CART_PRICE_CENTS)}`,
      enabled: world.hasSnacksCart,
      tone: 'sell',
      icon: 'snacks',
      onTrigger: onSellSnacksCart,
    });

    list.push({
      id: 'sell_cold_cart',
      label: 'Sell 3rd Cold Readi (Cold Drinks & Ice Cream)',
      sublabel: world.hasColdCart
        ? '50% resale value · Removes 3rd Cold Readi cart from right plaza'
        : 'Not currently owned',
      priceLabel: `+${formatMoney(coldCartResale)}`,
      originalLabel: `Orig ${formatMoney(COLD_CART_PRICE_CENTS)}`,
      enabled: Boolean(world.hasColdCart && onSellColdCart),
      tone: 'sell',
      icon: 'snacks',
      onTrigger: () => onSellColdCart?.(),
    });

    list.push({
      id: 'sell_one_chair',
      label:
        chairCount > 0
          ? `Sell 1 Wooden Chair (${chairCount} owned)`
          : 'Sell Wooden Chair (None owned)',
      sublabel: 'Sells 1 placed, pending, or carried chair at -50% rate',
      priceLabel: `+${formatMoney(chairResale)}`,
      originalLabel: `Orig ${formatMoney(CHAIR_PRICE_CENTS)}`,
      enabled: chairCount > 0,
      tone: 'sell',
      icon: 'chair',
      onTrigger: () => onSellFurniture('chair', false),
    });

    if (chairCount > 1) {
      list.push({
        id: 'sell_all_chairs',
        label: `Sell All ${chairCount} Wooden Chairs`,
        sublabel: `Bulk cash out all chairs at ${formatMoney(chairResale)} each`,
        priceLabel: `+${formatMoney(chairResale * chairCount)}`,
        enabled: true,
        tone: 'sell',
        icon: 'chair',
        onTrigger: () => onSellFurniture('chair', true),
      });
    }

    list.push({
      id: 'sell_one_table',
      label:
        tableCount > 0
          ? `Sell 1 Wooden Table (${tableCount} owned)`
          : 'Sell Wooden Table (None owned)',
      sublabel: 'Sells 1 placed, pending, or carried table at -50% rate',
      priceLabel: `+${formatMoney(tableResale)}`,
      originalLabel: `Orig ${formatMoney(TABLE_PRICE_CENTS)}`,
      enabled: tableCount > 0,
      tone: 'sell',
      icon: 'table',
      onTrigger: () => onSellFurniture('table', false),
    });

    if (tableCount > 1) {
      list.push({
        id: 'sell_all_tables',
        label: `Sell All ${tableCount} Wooden Tables`,
        sublabel: `Bulk cash out all tables at ${formatMoney(tableResale)} each`,
        priceLabel: `+${formatMoney(tableResale * tableCount)}`,
        enabled: true,
        tone: 'sell',
        icon: 'table',
        onTrigger: () => onSellFurniture('table', true),
      });
    }

    list.push({
      id: 'close_buyer',
      label: 'Leave Counter',
      sublabel: 'Keep your gear and return to street',
      priceLabel: 'Close',
      enabled: true,
      tone: 'close',
      icon: 'close',
      onTrigger: onClose,
    });

    return list;
  }, [
    hasTeaStall,
    hasRentedShop,
    world.shopKitchens,
    teaStallResale,
    onSellTeaStall,
    world.hasSnacksCart,
    snacksCartResale,
    onSellSnacksCart,
    world.hasColdCart,
    coldCartResale,
    onSellColdCart,
    chairCount,
    chairResale,
    tableCount,
    tableResale,
    onSellFurniture,
    onClose,
  ]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const safeIdx = Math.min(selectedIdx, Math.max(0, actions.length - 1));

  const moveUp = useCallback(() => {
    setSelectedIdx((prev) => (prev <= 0 ? actions.length - 1 : prev - 1));
  }, [actions.length]);

  const moveDown = useCallback(() => {
    setSelectedIdx((prev) => (prev >= actions.length - 1 ? 0 : prev + 1));
  }, [actions.length]);

  const triggerSelected = useCallback(() => {
    const item = actions[safeIdx];
    if (item && item.enabled) {
      item.onTrigger();
    }
  }, [actions, safeIdx]);

  useMenuKeyboard({
    onUp: moveUp,
    onDown: moveDown,
    onLeft: moveUp,
    onRight: moveDown,
    onSelect: triggerSelected,
    onClose,
  });

  const renderIcon = (icon: BuyerActionItem['icon']) => {
    switch (icon) {
      case 'stall':
      case 'snacks':
        return <Store className="w-4 h-4 shrink-0" />;
      case 'chair':
        return <Armchair className="w-4 h-4 shrink-0" />;
      case 'table':
        return <Table2 className="w-4 h-4 shrink-0" />;
      case 'close':
        return <X className="w-4 h-4 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-xl rounded-xl bg-[#2A201B] border border-[#C084FC]/40 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#7C3AED] flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                {BUYER_SHOP.shopName}
              </h2>
              <p className="text-xs text-[#D6C7B5] tabular-nums">
                Buyer: <span className="font-semibold">{BUYER_SHOP.buyerName}</span>{' '}
                · Rate: <span className="text-[#C4B5FD] font-semibold">-50% Buyback</span>{' '}
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
            aria-label="Close second-hand buyer modal"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3 max-h-[72vh] overflow-y-auto">
          <div className="p-3 rounded-lg bg-[#221915] border border-[#C084FC]/25 text-xs text-[#EAE0D0] leading-relaxed">
            &ldquo;Assalam-o-Alaikum! Rented a shop and want to cash out your
            old Tea Stall, Snacks Cart, Chairs, or Tables? I buy all used cafe
            gear on the spot at <span className="font-bold text-[#C4B5FD]">50% (-50% rate)</span>!&rdquo;
          </div>

          {!hasTeaStall && (
            <div className="p-3 rounded-lg bg-[#221915] border border-[#D97706]/35 flex items-start gap-2.5 text-xs text-[#FDE68A]">
              <Hammer className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
              <div>
                Want a new Main Chai Readi? Order one from{' '}
                <span className="font-semibold text-[#FFFDF9]">
                  Wood Master Workshop (Ustad Karim)
                </span>{' '}
                for {formatMoney(CHAI_STALL_PRICE_CENTS)} (1m 30s build time).
              </div>
            </div>
          )}

          <div className="space-y-2">
            {actions.map((item, idx) => {
              const isSelected = idx === safeIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.enabled}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={item.onTrigger}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    item.tone === 'close'
                      ? 'bg-[#3A2D26] hover:bg-[#4B3B32] text-[#FFFDF9] cursor-pointer'
                      : !item.enabled
                        ? 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                        : 'bg-[#5B21B6]/75 hover:bg-[#6D28D9] text-white cursor-pointer'
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#2A201B]'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    {renderIcon(item.icon)}
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm truncate">
                        {item.label}
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          item.enabled ? 'text-[#E9D5FF]' : 'text-[#78716C]'
                        }`}
                      >
                        {item.sublabel}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    <div
                      className={`font-mono font-bold text-sm ${
                        item.tone === 'close'
                          ? 'text-[#D6C7B5]'
                          : item.enabled
                            ? 'text-[#86EFAC]'
                            : 'text-[#78716C]'
                      }`}
                    >
                      {item.priceLabel}
                    </div>
                    {item.originalLabel && (
                      <div className="text-[10px] font-mono opacity-75">
                        {item.originalLabel}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Navigate</span>
          <span className="text-[#86EFAC] font-semibold">
            Space / Enter Confirm · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
