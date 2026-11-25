'use client';

import { useCallback, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Coffee,
  HeartHandshake,
  Save,
  Sparkles,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import { RENTABLE_BUILDINGS, formatMoney } from '@/lib/game/constants';
import type { ShiftSnapshot, WorldSave } from '@/lib/game/types';

interface UpgradeShopModalProps {
  world: WorldSave;
  shift: ShiftSnapshot;
  onNextDay: () => void;
  onSaveAndExit: () => void;
}

export default function UpgradeShopModal({
  world,
  shift,
  onNextDay,
  onSaveAndExit,
}: UpgradeShopModalProps) {
  const unlockingLv2NextDay = world.day === 1 && world.stage === 1;
  // 0 = Start Day, 1 = Save & Exit
  const [selectedIdx, setSelectedIdx] = useState(0);

  const toggleBtn = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) onNextDay();
    else onSaveAndExit();
  }, [selectedIdx, onNextDay, onSaveAndExit]);

  useMenuKeyboard({
    onUp: toggleBtn,
    onDown: toggleBtn,
    onLeft: toggleBtn,
    onRight: toggleBtn,
    onSelect: handleSelect,
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/88 p-4">
      <div className="w-full max-w-xl rounded-xl bg-[#2A201B] border border-[#D4A373]/30 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="px-6 py-5 bg-[#221915] border-b border-[#D4A373]/15 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-[#FDBA74]">
              {world.name} · Level {world.stage}
            </p>
            <h2 className="font-display font-bold text-2xl mt-0.5">
              Day {world.day} Complete
            </h2>
          </div>
          <Coffee className="w-8 h-8 text-[#EA580C]" />
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 tabular-nums">
            <div className="p-3.5 rounded-lg bg-[#221915] border border-[#D4A373]/15">
              <div className="text-xs text-[#D6C7B5]">Day Earnings</div>
              <div className="font-mono font-bold text-xl text-[#FBBF24] mt-1">
                +{formatMoney(shift.earningsCents)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#221915] border border-[#D4A373]/15">
              <div className="text-xs text-[#D6C7B5]">Cups Served</div>
              <div className="font-mono font-bold text-xl mt-1">
                {shift.servedCount}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#221915] border border-[#D4A373]/15">
              <div className="text-xs text-[#D6C7B5]">Total Cash</div>
              <div className="font-mono font-bold text-xl text-[#86EFAC] mt-1">
                {formatMoney(world.cashCents)}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#1B1410] border border-[#D4A373]/15 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
            <span className="text-[#D6C7B5]">
              Readi Stock Carried to Day {world.day + 1}:
            </span>
            <span className="font-mono font-semibold text-[#FFFDF9]">
              {shift.inventory.cups} Cups · {shift.inventory.teaLeaves} Tea ·{' '}
              {shift.inventory.sugar} Sugar · {shift.inventory.water} Water
              {shift.inventory.milkPackets > 0
                ? ` · ${shift.inventory.milkPackets} Milk`
                : ''}
              {shift.inventory.coffeePowder > 0
                ? ` · ${shift.inventory.coffeePowder} Beans`
                : ''}
              {shift.inventory.biscuits > 0
                ? ` · ${shift.inventory.biscuits} Biscuits`
                : ''}
              {shift.inventory.cupcakes > 0
                ? ` · ${shift.inventory.cupcakes} Cakes`
                : ''}
              {(world.hasSnacksCart || shift.inventory.samosaMix > 0) &&
                ` · ${shift.inventory.samosaMix} Samosa`}
              {(world.hasSnacksCart || shift.inventory.pakoraMix > 0) &&
                ` · ${shift.inventory.pakoraMix} Pakora`}
              {(world.hasSnacksCart || shift.inventory.cookingOil > 0) &&
                ` · ${shift.inventory.cookingOil} Oil`}
            </span>
          </div>

          {shift.helper.status === 'hired' && (
            <div className="p-3.5 rounded-lg bg-[#78350F]/30 border border-[#FBBF24]/40 flex items-start gap-3 text-xs text-[#FEF3C7] tabular-nums">
              <HeartHandshake className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Chotu Helper Shift Summary:</span>{' '}
                Served {shift.helper.servedCount} cup
                {shift.helper.servedCount === 1 ? '' : 's'} today (
                {formatMoney(shift.helper.wageEarnedCents)} wages paid). Chotu
                rests tonight and waits outside the Supermarket tomorrow!
              </div>
            </div>
          )}

          {world.rentedShops.length > 0 && (
            <div className="p-3.5 rounded-lg bg-[#1E1B4B]/40 border border-[#A78BFA]/40 flex items-start gap-3 text-xs text-[#EDE9FE] tabular-nums">
              <Building2 className="w-4 h-4 text-[#C4B5FD] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  Rented Street Shops ({world.rentedShops.length}/
                  {RENTABLE_BUILDINGS.length}):
                </span>{' '}
                {world.rentedShops
                  .map((r) => {
                    const cfg = RENTABLE_BUILDINGS.find(
                      (b) => b.id === r.buildingId
                    );
                    const due = world.day + 1 >= r.nextRentDueDay;
                    return `${cfg?.shopName ?? r.buildingId} (${due ? 'Rent Due Tomorrow!' : `Due Day ${r.nextRentDueDay}`})`;
                  })
                  .join(' · ')}
              </div>
            </div>
          )}

          {(world.stage >= 2 || unlockingLv2NextDay) && (
            <div className="p-4 rounded-lg bg-[#0F766E]/25 border border-[#5EEAD4]/40 flex items-start gap-3 text-xs text-[#CCFBF1]">
              <Sparkles className="w-4 h-4 text-[#5EEAD4] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Level 2 Unlocked!</span> Walk into the{' '}
                <span className="font-semibold">
                  Open Supermarket on the right (E)
                </span>{' '}
                to buy the{' '}
                <span className="font-semibold">Doodh Patti ($1.00)</span>,{' '}
                <span className="font-semibold">Coffee ($1.10)</span> &amp;{' '}
                <span className="font-semibold">Samosa &amp; Pakora</span>{' '}
                recipes, 2nd Snacks Readi, Chairs &amp; Tables, or rent street
                shops from their owners!
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#221915] border-t border-[#D4A373]/15 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onMouseEnter={() => setSelectedIdx(1)}
            onClick={onSaveAndExit}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] text-sm font-medium cursor-pointer transition-all ${
              selectedIdx === 1
                ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#221915]'
                : ''
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Save &amp; Exit to Worlds</span>
          </button>

          <button
            type="button"
            onMouseEnter={() => setSelectedIdx(0)}
            onClick={onNextDay}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#EA580C] hover:bg-[#DC4E07] text-[#FFFDF9] font-display font-bold text-base cursor-pointer transition-all ${
              selectedIdx === 0
                ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#221915]'
                : ''
            }`}
          >
            <span>Start Day {world.day + 1} (5:00)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-2 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>A / D Switch</span>
          <span className="text-[#FDE68A] font-semibold">
            Space / Enter Select
          </span>
        </div>
      </div>
    </div>
  );
}
