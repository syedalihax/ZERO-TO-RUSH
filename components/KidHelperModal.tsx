'use client';

import { useCallback, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Coins,
  HeartHandshake,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import {
  HELPER_CHARITY_CENTS,
  HELPER_WAGE_CENTS,
  formatMoney,
} from '@/lib/game/constants';
import type { HelperKidState } from '@/lib/game/types';

interface KidHelperModalProps {
  cashCents: number;
  helper: HelperKidState;
  onGiveCharity: () => void;
  onHireHelper: () => void;
  onClose: () => void;
}

export default function KidHelperModal({
  cashCents,
  helper,
  onGiveCharity,
  onHireHelper,
  onClose,
}: KidHelperModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(
    helper.charityGivenToday ? 1 : 0
  );

  const handleMove = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) {
      if (!helper.charityGivenToday && cashCents >= HELPER_CHARITY_CENTS) {
        onGiveCharity();
      }
    } else {
      onHireHelper();
    }
  }, [
    selectedIdx,
    helper.charityGivenToday,
    cashCents,
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[#2A201B] border border-[#FBBF24]/40 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#D97706] flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                Chotu (Boy Outside Market)
              </h2>
              <p className="text-xs text-[#D6C7B5] tabular-nums">
                &ldquo;Bhaiya, please give {formatMoney(HELPER_CHARITY_CENTS)}{' '}
                or let me work at your Chai Readi!&rdquo; · Cash:{' '}
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
                  Donate {formatMoney(HELPER_CHARITY_CENTS)} once today. Spreads
                  goodwill and calms waiting customers (+patience boost!).
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
                onClick={onGiveCharity}
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

          {/* Option 2: Hire for 1 Day @ $0.15 per serve */}
          <div
            onMouseEnter={() => setSelectedIdx(1)}
            className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
              selectedIdx === 1
                ? 'bg-[#33261F] border-[#86EFAC] ring-1 ring-[#86EFAC]/50'
                : 'bg-[#221915] border-[#D4A373]/15'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ChevronRight
                className={`w-4 h-4 shrink-0 mt-0.5 transition-opacity ${
                  selectedIdx === 1 ? 'text-[#86EFAC] opacity-100' : 'opacity-0'
                }`}
              />
              <div className="min-w-0">
                <div className="font-display font-bold text-sm text-[#86EFAC]">
                  Hire as Readi Helper (1 Day Job)
                </div>
                <p className="text-xs text-[#D6C7B5] mt-0.5">
                  Chotu works at your Chai Readi today — making &amp; serving{' '}
                  <span className="font-semibold text-[#FFFDF9]">
                    Simple Chai, Doodh Patti &amp; Coffee
                  </span>{' '}
                  to customers and cars! Wage:{' '}
                  <span className="font-mono font-bold text-[#FBBF24]">
                    {formatMoney(HELPER_WAGE_CENTS)}
                  </span>{' '}
                  deducted per cup he serves.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onHireHelper}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 bg-[#15803D] hover:bg-[#166534] text-white cursor-pointer transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Hire ({formatMoney(HELPER_WAGE_CENTS)}/cup)</span>
            </button>
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
