'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Coffee,
  Cookie,
  Lock,
  Power,
  Snowflake,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import { DRINK_CATALOG, formatMoney } from '@/lib/game/constants';
import { getDrinkStockStatus, isMenuItemEnabled } from '@/lib/game/engine';
import type { DrinkType, ShiftSnapshot, WorldSave } from '@/lib/game/types';

interface SalesMenuModalProps {
  world: WorldSave;
  shift: ShiftSnapshot;
  onToggleItem: (drink: DrinkType) => void;
  onClose: () => void;
}

const DRINK_KEYS: DrinkType[] = ['tea', 'doodh_patti', 'coffee'];
const SNACK_KEYS: DrinkType[] = ['biscuit_pack', 'cupcake', 'samosa', 'pakora'];
const COLD_KEYS: DrinkType[] = ['cold_drink', 'ice_cream'];
const ALL_MENU_KEYS: DrinkType[] = [...DRINK_KEYS, ...SNACK_KEYS, ...COLD_KEYS];

export default function SalesMenuModal({
  world,
  shift,
  onToggleItem,
  onClose,
}: SalesMenuModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const unlockedEnabledDrinks = useMemo(
    () =>
      DRINK_KEYS.filter(
        (d) => world.unlockedRecipes.includes(d) && isMenuItemEnabled(world, d)
      ),
    [world]
  );

  const isItemOwnedOrUnlocked = useCallback(
    (drink: DrinkType) => {
      if (drink === 'biscuit_pack' || drink === 'cupcake') {
        return true;
      }
      if (drink === 'samosa' || drink === 'pakora') {
        return world.unlockedRecipes.includes(drink) && world.hasSnacksCart;
      }
      if (drink === 'cold_drink' || drink === 'ice_cream') {
        return (
          world.unlockedRecipes.includes(drink) && Boolean(world.hasColdCart)
        );
      }
      return world.unlockedRecipes.includes(drink);
    },
    [world.hasSnacksCart, world.hasColdCart, world.unlockedRecipes]
  );

  const moveUp = useCallback(() => {
    setSelectedIdx(
      (prev) => (prev - 1 + ALL_MENU_KEYS.length) % ALL_MENU_KEYS.length
    );
  }, []);

  const moveDown = useCallback(() => {
    setSelectedIdx((prev) => (prev + 1) % ALL_MENU_KEYS.length);
  }, []);

  const handleSelect = useCallback(() => {
    const key = ALL_MENU_KEYS[selectedIdx];
    if (!key || !isItemOwnedOrUnlocked(key)) return;
    onToggleItem(key);
  }, [isItemOwnedOrUnlocked, onToggleItem, selectedIdx]);

  useMenuKeyboard({
    onUp: moveUp,
    onDown: moveDown,
    onSelect: handleSelect,
    onClose,
  });

  useEffect(() => {
    const onKeyM = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyM);
    return () => window.removeEventListener('keydown', onKeyM);
  }, [onClose]);

  const activeDrinkCount = unlockedEnabledDrinks.length;

  const renderRow = (drink: DrinkType, idx: number) => {
    const info = DRINK_CATALOG[drink];
    const unlocked = isItemOwnedOrUnlocked(drink);
    const enabled = isMenuItemEnabled(world, drink);
    const stock = getDrinkStockStatus(drink, shift);
    const isDrink = DRINK_KEYS.includes(drink);
    const isLastActiveDrink =
      isDrink && unlocked && enabled && activeDrinkCount <= 1;
    const isSelected = selectedIdx === idx;

    let lockReason = 'Unlock at Supermarket';
    if (drink === 'samosa' || drink === 'pakora') {
      if (!world.unlockedRecipes.includes(drink)) {
        lockReason = 'Buy Samosa & Pakora Recipe at Supermarket';
      } else if (!world.hasSnacksCart) {
        lockReason = 'Order 2nd Snacks Readi at Wood Master Workshop';
      }
    } else if (drink === 'cold_drink' || drink === 'ice_cream') {
      if (!world.unlockedRecipes.includes(drink)) {
        lockReason = 'Buy Cold Drinks & Ice Cream Recipe at Supermarket';
      } else if (!world.hasColdCart) {
        lockReason = 'Order 3rd Cold Readi at Wood Master Workshop';
      }
    }

    return (
      <div
        key={drink}
        onMouseEnter={() => setSelectedIdx(idx)}
        className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
          isSelected
            ? 'ring-2 ring-[#FDE68A] ring-offset-1 ring-offset-[#2A201B]'
            : ''
        } ${
          !unlocked
            ? 'bg-[#1E1612] border-[#D4A373]/10 opacity-65'
            : enabled
              ? 'bg-[#221915] border-[#D4A373]/25'
              : 'bg-[#1B1410] border-[#D4A373]/15'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold text-sm text-[#FFFDF9]">
              {info.name}
            </span>
            <span className="font-mono text-xs font-semibold text-[#FBBF24]">
              {formatMoney(info.priceCents)}
            </span>
            {unlocked && enabled && !stock.inStock && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#7F1D1D] border border-[#EF4444]/60 text-[10px] font-bold text-[#FEE2E2]">
                <AlertTriangle className="w-3 h-3" />
                OUT OF STOCK ({stock.missing.join(', ')})
              </span>
            )}
            {unlocked && enabled && stock.inStock && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#14532D]/70 border border-[#4ADE80]/40 text-[10px] font-semibold text-[#BBF7D0]">
                <CheckCircle2 className="w-3 h-3" />
                In Stock
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#D6C7B5] mt-0.5 truncate">
            {!unlocked
              ? lockReason
              : isLastActiveDrink
                ? 'Active on Menu · Keep at least 1 drink enabled'
                : enabled
                  ? 'Customers can order this item during the shift'
                  : 'Paused from Sales Menu — customers will not order this'}
          </p>
        </div>

        {unlocked ? (
          <button
            type="button"
            disabled={isLastActiveDrink}
            onClick={() => onToggleItem(drink)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              isLastActiveDrink
                ? 'bg-[#14532D]/50 border border-[#4ADE80]/30 text-[#BBF7D0]/80 cursor-not-allowed'
                : enabled
                  ? 'bg-[#15803D] hover:bg-[#16A34A] text-white cursor-pointer'
                  : 'bg-[#3A2D26] hover:bg-[#4B3B32] border border-[#D4A373]/25 text-[#D6C7B5] cursor-pointer'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{enabled ? 'SELLING' : 'DISABLED'}</span>
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-lg bg-[#2A201B] border border-[#D4A373]/15 text-[11px] font-medium text-[#A89885] flex items-center gap-1.5 shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Locked</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl bg-[#2A201B] border border-[#D4A373]/30 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EA580C]/20 border border-[#EA580C]/40 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-[#FDBA74]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">
                Cafe Sales Menu
              </h2>
              <p className="text-xs text-[#D6C7B5]">
                Choose which unlocked items customers can order (e.g. disable
                Chai and sell only Coffee &amp; Doodh Patti)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sales Menu"
            className="w-8 h-8 rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] flex items-center justify-center text-[#D6C7B5] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FDBA74] flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5" />
                Hot Drinks ({activeDrinkCount} Active)
              </h3>
              <span className="text-[11px] text-[#D6C7B5]">
                At least 1 unlocked drink must stay enabled
              </span>
            </div>
            <div className="space-y-2">
              {DRINK_KEYS.map((d, i) => renderRow(d, i))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FDBA74] flex items-center gap-1.5">
              <Cookie className="w-3.5 h-3.5" />
              Snacks &amp; Fried Items
            </h3>
            <div className="space-y-2">
              {SNACK_KEYS.map((d, i) => renderRow(d, DRINK_KEYS.length + i))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#7DD3FC] flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5" />
              Cold Drinks &amp; Ice Cream (3rd Readi)
            </h3>
            <div className="space-y-2">
              {COLD_KEYS.map((d, i) =>
                renderRow(d, DRINK_KEYS.length + SNACK_KEYS.length + i)
              )}
            </div>
          </section>
        </div>

        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Navigate · Space / Enter Toggle</span>
          <span className="text-[#FDE68A] font-semibold">
            M / E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
