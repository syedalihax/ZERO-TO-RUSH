'use client';

import { useCallback, useState } from 'react';
import { Bike, ChevronRight, Milk, ShoppingBag, X } from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import { MILKMAN_CATALOG, formatMoney } from '@/lib/game/constants';
import type { InventoryState } from '@/lib/game/types';

interface MilkmanShopModalProps {
  cashCents: number;
  inventory: InventoryState;
  milkmanTimeLeft: number;
  onBuy: (itemId: (typeof MILKMAN_CATALOG)[number]['id']) => void;
  onClose: () => void;
}

export default function MilkmanShopModal({
  cashCents,
  inventory,
  milkmanTimeLeft,
  onBuy,
  onClose,
}: MilkmanShopModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const handleUp = useCallback(() => {
    setSelectedIdx(
      (prev) => (prev - 1 + MILKMAN_CATALOG.length) % MILKMAN_CATALOG.length
    );
  }, []);

  const handleDown = useCallback(() => {
    setSelectedIdx((prev) => (prev + 1) % MILKMAN_CATALOG.length);
  }, []);

  const handleSelect = useCallback(() => {
    const item = MILKMAN_CATALOG[selectedIdx];
    if (item && cashCents >= item.priceCents) {
      onBuy(item.id);
    }
  }, [selectedIdx, cashCents, onBuy]);

  useMenuKeyboard({
    onUp: handleUp,
    onDown: handleDown,
    onSelect: handleSelect,
    onClose,
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-xl rounded-xl bg-[#2A201B] border border-[#38BDF8]/40 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E293B] border-b border-[#38BDF8]/25">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0284C7] flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                Milkman on Motorcycle (Doodh Wala)
              </h2>
              <p className="text-xs text-[#BAE6FD] tabular-nums">
                Riding away in {Math.max(0, Math.ceil(milkmanTimeLeft))}s · Cash:{' '}
                <span className="font-mono font-bold text-[#FBBF24]">
                  {formatMoney(cashCents)}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close milkman shop"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#334155] hover:bg-[#475569] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-[#1B1410] border-b border-[#D4A373]/15 flex items-center justify-between text-xs tabular-nums">
          <span className="text-[#D6C7B5] flex items-center gap-1.5">
            <Milk className="w-3.5 h-3.5 text-[#7DD3FC]" />
            <span>Cycle Milk Crate Stock:</span>
          </span>
          <span className="font-mono font-bold text-[#E0F2FE]">
            {inventory.milkPackets} Milk Packets
          </span>
        </div>

        <div className="p-6 space-y-2.5">
          {MILKMAN_CATALOG.map((item, idx) => {
            const canAfford = cashCents >= item.priceCents;
            const isSelected = selectedIdx === idx;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`flex items-center justify-between gap-4 p-3.5 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-[#1E293B] border-[#7DD3FC] ring-1 ring-[#7DD3FC]/50'
                    : 'bg-[#221915] border-[#D4A373]/15'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-opacity ${
                      isSelected ? 'text-[#7DD3FC] opacity-100' : 'opacity-0'
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
                  onClick={() => onBuy(item.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    canAfford
                      ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white cursor-pointer'
                      : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{formatMoney(item.priceCents)}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Up &amp; Down</span>
          <span className="text-[#7DD3FC] font-semibold">
            Space / Enter Buy · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
