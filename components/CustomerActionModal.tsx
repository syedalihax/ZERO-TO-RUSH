'use client';

import { useCallback, useState } from 'react';
import {
  Ban,
  Car,
  ChevronRight,
  Coffee,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import {
  DRINK_CATALOG,
  formatMoney,
  heldHotDrinkType,
} from '@/lib/game/constants';
import type { DrinkType, HeldItem } from '@/lib/game/types';

interface CustomerActionModalProps {
  targetKind: 'customer' | 'car';
  requestedDrink: DrinkType;
  availableChoices: DrinkType[];
  holding: HeldItem;
  onOfferAlternative: (drink: DrinkType) => void;
  onReject: () => void;
  onClose: () => void;
}

export default function CustomerActionModal({
  targetKind,
  requestedDrink,
  availableChoices,
  holding,
  onOfferAlternative,
  onReject,
  onClose,
}: CustomerActionModalProps) {
  const reqInfo = DRINK_CATALOG[requestedDrink] ?? DRINK_CATALOG.tea;
  const alternatives = availableChoices.filter((d) => d !== requestedDrink);
  const heldDrink = heldHotDrinkType(holding);

  const totalOptions = alternatives.length + 1; // offers + reject button
  const [selectedIdx, setSelectedIdx] = useState(0);
  const safeIndex = Math.min(selectedIdx, totalOptions - 1);

  const handleUp = useCallback(() => {
    setSelectedIdx((prev) => (prev - 1 + totalOptions) % totalOptions);
  }, [totalOptions]);

  const handleDown = useCallback(() => {
    setSelectedIdx((prev) => (prev + 1) % totalOptions);
  }, [totalOptions]);

  const handleSelect = useCallback(() => {
    if (safeIndex < alternatives.length) {
      onOfferAlternative(alternatives[safeIndex]);
    } else {
      onReject();
    }
  }, [safeIndex, alternatives, onOfferAlternative, onReject]);

  useMenuKeyboard({
    onUp: handleUp,
    onDown: handleDown,
    onSelect: handleSelect,
    onClose,
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-md rounded-xl bg-[#2A201B] border border-[#D4A373]/30 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-2.5">
            {targetKind === 'car' ? (
              <Car className="w-5 h-5 text-[#FDBA74]" />
            ) : (
              <User className="w-5 h-5 text-[#FDBA74]" />
            )}
            <div>
              <h2 className="font-display font-bold text-base leading-tight">
                {targetKind === 'car' ? 'Car Customer Order' : 'Customer Order'}
              </h2>
              <p className="text-xs text-[#D6C7B5]">
                Requested:{' '}
                <span className="font-semibold text-[#FDE68A]">
                  {reqInfo.name}
                </span>{' '}
                ({formatMoney(reqInfo.priceCents)})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close order action"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#EAE0D0] leading-relaxed">
            Out of ingredients or prefer not to make {reqInfo.name}? Offer another unlocked drink instead, or politely turn down the order.
          </p>

          {alternatives.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4A373]">
                Offer Another Drink
              </div>
              {alternatives.map((alt, idx) => {
                const info = DRINK_CATALOG[alt] ?? DRINK_CATALOG.tea;
                const isHoldingThis = heldDrink === alt;
                const isSelected = safeIndex === idx;
                return (
                  <button
                    key={alt}
                    type="button"
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => onOfferAlternative(alt)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#33261F] border-[#86EFAC] ring-1 ring-[#86EFAC]/50'
                        : 'bg-[#221915] hover:bg-[#3A2D26] border-[#D4A373]/25'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-opacity ${
                          isSelected ? 'text-[#86EFAC] opacity-100' : 'opacity-0'
                        }`}
                      />
                      <RefreshCw className="w-4 h-4 text-[#86EFAC] shrink-0" />
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          <span>Offer {info.name}</span>
                          {isHoldingThis && (
                            <span className="text-[11px] font-mono text-[#86EFAC]">
                              (In Hand!)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#D6C7B5]">
                          {formatMoney(info.priceCents)} · Most customers accept
                        </div>
                      </div>
                    </div>
                    <Coffee className="w-4 h-4 text-[#FDBA74] shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#221915] border border-[#D4A373]/15 text-xs text-[#D6C7B5]">
              Buy Doodh Patti or Coffee recipes inside the Open Supermarket on the right (E) to offer alternative drinks!
            </div>
          )}

          <button
            type="button"
            onMouseEnter={() => setSelectedIdx(alternatives.length)}
            onClick={onReject}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold text-[#FEE2E2] cursor-pointer transition-all ${
              safeIndex === alternatives.length
                ? 'bg-[#991B1B] border-[#FCA5A5] ring-2 ring-[#FCA5A5]/60'
                : 'bg-[#7F1D1D]/85 hover:bg-[#991B1B] border-[#EF4444]/40'
            }`}
          >
            <Ban className="w-4 h-4" />
            <span>Reject Order (Sold Out / No Ingredients)</span>
          </button>
        </div>

        <div className="px-5 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Up &amp; Down</span>
          <span className="text-[#FDE68A] font-semibold">
            Space / Enter Confirm · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
