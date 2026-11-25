'use client';

import { useCallback, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Coins,
  HeartHandshake,
  Lock,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import {
  HELPER_CHARITY_CENTS,
  HELPER_NPCS,
  HELPER_WAGE_CENTS,
  formatMoney,
} from '@/lib/game/constants';
import type { HelperKidState, HelperNpcId } from '@/lib/game/types';

interface KidHelperModalProps {
  cashCents: number;
  helper: HelperKidState;
  hasSnacksCart: boolean;
  onGiveCharity: (helperId: HelperNpcId) => void;
  onHireHelper: (helperId: HelperNpcId) => void;
  onClose: () => void;
}

export default function KidHelperModal({
  cashCents,
  helper,
  hasSnacksCart,
  onGiveCharity,
  onHireHelper,
  onClose,
}: KidHelperModalProps) {
  const helperId: HelperNpcId = helper.id ?? 'chotu';
  const cfg = HELPER_NPCS[helperId];
  const isMunni = helperId === 'munni';
  const hireLocked = cfg.requiresSnacksCart && !hasSnacksCart;

  const [selectedIdx, setSelectedIdx] = useState(
    helper.charityGivenToday && !hireLocked ? 1 : 0
  );

  const handleMove = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) {
      if (!helper.charityGivenToday && cashCents >= HELPER_CHARITY_CENTS) {
        onGiveCharity(helperId);
      }
    } else if (!hireLocked) {
      onHireHelper(helperId);
    }
  }, [
    selectedIdx,
    helper.charityGivenToday,
    cashCents,
    hireLocked,
    helperId,
    onGiveCharity,
    onHireHelper,
  ]);

  useMenuKeyboard({
    onUp: handleMove,
    onDown: handleMove,
    onLeft: handleMove,
    onRight: handleMove,
    onSelect: handleSelect,
    onClose,
  });

  const canAffordCharity =
    !helper.charityGivenToday && cashCents >= HELPER_CHARITY_CENTS;

  const greetingText = isMunni
    ? `"Bhaiya, please give ${formatMoney(HELPER_CHARITY_CENTS)} help, or let me work at your 2nd Samosa Readi once you own one!"`
    : `"Bhaiya, please give ${formatMoney(HELPER_CHARITY_CENTS)} or let me work as your helper today!"`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div
        className={`w-full max-w-lg rounded-xl bg-[#2A201B] border shadow-2xl text-[#FFFDF9] overflow-hidden ${
          isMunni ? 'border-[#F472B6]/45' : 'border-[#FBBF24]/40'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                isMunni ? 'bg-[#DB2777]' : 'bg-[#D97706]'
              }`}
            >
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                {cfg.title}
              </h2>
              <p className="text-xs text-[#D6C7B5] tabular-nums">
                {greetingText} · Cash:{' '}
                <span className="font-mono font-bold text-[#FBBF24]">
                  {formatMoney(cashCents)}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* Option 1: Give $0.25 Charity */}
          <div
            onMouseEnter={() => setSelectedIdx(0)}
            className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
              selectedIdx === 0
                ? 'bg-[#33261F] border-[#FBBF24] ring-1 ring-[#FBBF24]/50'
                : 'bg-[#221915] border-[#D4A373]/15'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ChevronRight
                className={`w-4 h-4 shrink-0 mt-0.5 transition-opacity ${
                  selectedIdx === 0 ? 'text-[#FBBF24] opacity-100' : 'opacity-0'
                }`}
              />
              <div className="min-w-0">
                <div className="font-display font-bold text-sm">
                  Give {formatMoney(HELPER_CHARITY_CENTS)} Help (Charity)
                </div>
                <p className="text-xs text-[#D6C7B5] mt-0.5">
                  Donate {formatMoney(HELPER_CHARITY_CENTS)} once today to{' '}
                  {cfg.name}. Spreads goodwill and boosts waiting customer
                  patience!
                </p>
              </div>
            </div>

            {helper.charityGivenToday ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#86EFAC] shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>Helped Today</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={!canAffordCharity}
                onClick={() => onGiveCharity(helperId)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  canAffordCharity
                    ? 'bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer'
                    : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Give {formatMoney(HELPER_CHARITY_CENTS)}</span>
              </button>
            )}
          </div>

          {/* Option 2: Hire for 1 Day */}
          <div
            onMouseEnter={() => setSelectedIdx(1)}
            className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
              selectedIdx === 1
                ? hireLocked
                  ? 'bg-[#33261F] border-[#94A3B8] ring-1 ring-[#94A3B8]/40'
                  : 'bg-[#33261F] border-[#86EFAC] ring-1 ring-[#86EFAC]/50'
                : 'bg-[#221915] border-[#D4A373]/15'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ChevronRight
                className={`w-4 h-4 shrink-0 mt-0.5 transition-opacity ${
                  selectedIdx === 1
                    ? hireLocked
                      ? 'text-[#94A3B8] opacity-100'
                      : 'text-[#86EFAC] opacity-100'
                    : 'opacity-0'
                }`}
              />
              <div className="min-w-0">
                <div
                  className={`font-display font-bold text-sm ${
                    hireLocked ? 'text-[#CBD5E1]' : 'text-[#86EFAC]'
                  }`}
                >
                  {isMunni
                    ? 'Hire as Samosa Readi Helper (1 Day Job)'
                    : 'Hire as Readi Helper (1 Day Job)'}
                </div>
                {isMunni ? (
                  <p className="text-xs text-[#D6C7B5] mt-0.5">
                    {hireLocked ? (
                      <>
                        Requires your{' '}
                        <span className="font-semibold text-[#FDE68A]">
                          2nd Snacks Readi (Samosa &amp; Pakora Cart)
                        </span>{' '}
                        built at Wood Master Workshop. She only helps at the
                        Samosa Readi (never Chai Readi).
                      </>
                    ) : (
                      <>
                        {cfg.name} works ONLY at your{' '}
                        <span className="font-semibold text-[#FFFDF9]">
                          2nd Samosa &amp; Pakora Readi
                        </span>{' '}
                        (never Chai Readi). Wage:{' '}
                        <span className="font-mono font-bold text-[#FBBF24]">
                          20% profit share ($0.16 Samosa / $0.14 Pakora)
                        </span>{' '}
                        per order she serves!
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-[#D6C7B5] mt-0.5">
                    {cfg.name} works at your Cafe &amp; Readi carts today — making
                    &amp; serving everything you stock:{' '}
                    <span className="font-semibold text-[#FFFDF9]">
                      Chai, Doodh Patti, Coffee, Biscuits, Cupcakes, Samosa,
                      Pakora, Cold Drinks &amp; Ice Cream
                    </span>
                    ! Wage:{' '}
                    <span className="font-mono font-bold text-[#FBBF24]">
                      {formatMoney(HELPER_WAGE_CENTS)}
                    </span>{' '}
                    per serve. If unhired, hungry kids also ask for a free item and market your stalls in return!
                  </p>
                )}
              </div>
            </div>

            {hireLocked ? (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1B1410] text-[#94A3B8] font-mono text-xs font-semibold shrink-0">
                <Lock className="w-3.5 h-3.5" />
                <span>Need Samosa Cart</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onHireHelper(helperId)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 text-white cursor-pointer transition-colors ${
                  isMunni
                    ? 'bg-[#DB2777] hover:bg-[#BE185D]'
                    : 'bg-[#15803D] hover:bg-[#166534]'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>{isMunni ? 'Hire (20% wage)' : `Hire (${formatMoney(HELPER_WAGE_CENTS)}/order)`}</span>
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Switch Option</span>
          <span className="text-[#FDE68A] font-semibold">
            Space / Enter Confirm · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}

