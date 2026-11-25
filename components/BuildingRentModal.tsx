'use client';

import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Coins,
  TrendingUp,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import {
  RENTABLE_BUILDINGS,
  SHOP_WEEK_DAYS,
  formatMoney,
} from '@/lib/game/constants';
import type { ShopBuildingId, WorldSave } from '@/lib/game/types';

interface BuildingRentModalProps {
  world: WorldSave;
  buildingId: ShopBuildingId;
  onRentOrPay: (buildingId: ShopBuildingId) => void;
  onClose: () => void;
}

export default function BuildingRentModal({
  world,
  buildingId,
  onRentOrPay,
  onClose,
}: BuildingRentModalProps) {
  const building =
    RENTABLE_BUILDINGS.find((b) => b.id === buildingId) ??
    RENTABLE_BUILDINGS[0];
  const record = world.rentedShops.find((r) => r.buildingId === building.id);
  const isOverdue = Boolean(record && world.day >= record.nextRentDueDay);
  const canAfford = world.cashCents >= building.weeklyRentCents;
  const daysRemaining = record
    ? Math.max(0, record.nextRentDueDay - world.day)
    : 0;

  const [selectedIdx, setSelectedIdx] = useState(0);

  const toggleIdx = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) {
      if (canAfford) onRentOrPay(building.id);
    } else {
      onClose();
    }
  }, [selectedIdx, canAfford, onRentOrPay, building.id, onClose]);

  useMenuKeyboard({
    onUp: toggleIdx,
    onDown: toggleIdx,
    onLeft: toggleIdx,
    onRight: toggleIdx,
    onSelect: handleSelect,
    onClose,
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[#2A201B] border border-[#D4A373]/35 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `#${building.awningHex.toString(16).padStart(6, '0')}`,
              }}
            >
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                {building.shopName}
              </h2>
              <p className="text-xs text-[#D6C7B5] tabular-nums">
                Owner: <span className="font-semibold">{building.ownerName}</span>{' '}
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
            aria-label="Close building owner modal"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status Banner */}
          {!record ? (
            <div className="p-3.5 rounded-lg bg-[#221915] border border-[#D4A373]/20 text-xs text-[#EAE0D0] leading-relaxed">
              &ldquo;Assalam-o-Alaikum! You can rent this shop weekly for{' '}
              <span className="font-mono font-bold text-[#FBBF24]">
                {formatMoney(building.weeklyRentCents)} / week
              </span>{' '}
              ({SHOP_WEEK_DAYS} days). Come back and meet me inside whenever
              weekly rent is due!&rdquo;
            </div>
          ) : isOverdue ? (
            <div className="p-3.5 rounded-lg bg-[#7F1D1D]/45 border border-[#EF4444]/60 flex items-start gap-2.5 text-xs text-[#FECACA]">
              <AlertTriangle className="w-4 h-4 text-[#FCA5A5] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Weekly Rent Due Today!</span> Pay{' '}
                {building.ownerName} {formatMoney(building.weeklyRentCents)} to
                keep earning your daily shop profit bonus.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-[#14532D]/40 border border-[#4ADE80]/40 flex items-start gap-2.5 text-xs text-[#DCFCE7]">
              <CheckCircle2 className="w-4 h-4 text-[#86EFAC] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Lease Active!</span> Next weekly
                rent due on <span className="font-mono font-bold">Day {record.nextRentDueDay}</span>{' '}
                ({daysRemaining} day{daysRemaining === 1 ? '' : 's'} left ·{' '}
                {record.weeksPaid} week{record.weeksPaid === 1 ? '' : 's'} paid).
              </div>
            </div>
          )}

          {/* Lease Terms & Perks */}
          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <div className="p-3.5 rounded-lg bg-[#221915] border border-[#D4A373]/15">
              <div className="flex items-center gap-1.5 text-xs text-[#D6C7B5]">
                <CalendarClock className="w-3.5 h-3.5 text-[#FDBA74]" />
                <span>Weekly Rent</span>
              </div>
              <div className="font-mono font-bold text-lg text-[#FBBF24] mt-1">
                {formatMoney(building.weeklyRentCents)}
                <span className="text-xs font-normal text-[#D6C7B5]">
                  {' '}
                  / {SHOP_WEEK_DAYS} days
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#221915] border border-[#D4A373]/15">
              <div className="flex items-center gap-1.5 text-xs text-[#D6C7B5]">
                <TrendingUp className="w-3.5 h-3.5 text-[#86EFAC]" />
                <span>Daily Shop Profit</span>
              </div>
              <div className="font-mono font-bold text-lg text-[#86EFAC] mt-1">
                +{formatMoney(building.dailyIncomeBonusCents)}
                <span className="text-xs font-normal text-[#D6C7B5]">
                  {' '}
                  / day
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-[#D6C7B5] bg-[#1B1410] border border-[#D4A373]/15 rounded-lg p-3 leading-relaxed">
            Spacious 3x larger{' '}
            <span className="font-semibold text-[#FFFDF9]">empty shop floor</span>{' '}
            with space for a Shop Kitchen, 4 Chairs &amp; 2 Tables (+12% street
            customer traffic &amp; daily profit bonus!). Order your{' '}
            <span className="font-semibold text-[#FDE68A]">
              Shop Kitchen, Chairs &amp; Tables
            </span>{' '}
            from <span className="font-semibold text-[#FDE68A]">Wood Master Workshop (Ustad Karim)</span>.
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={!canAfford}
              onMouseEnter={() => setSelectedIdx(0)}
              onClick={() => onRentOrPay(building.id)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg font-display font-bold text-sm transition-all ${
                canAfford
                  ? isOverdue
                    ? 'bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer'
                    : 'bg-[#15803D] hover:bg-[#166534] text-white cursor-pointer'
                  : 'bg-[#1B1410] text-[#78716C] cursor-not-allowed'
              } ${
                selectedIdx === 0
                  ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#2A201B]'
                  : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <ChevronRight
                  className={`w-4 h-4 ${
                    selectedIdx === 0 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Coins className="w-4 h-4" />
                <span>
                  {!record
                    ? `Rent ${building.shopName} (1 Week)`
                    : isOverdue
                      ? `Pay Weekly Rent to ${building.ownerName}`
                      : 'Pay Another Week in Advance'}
                </span>
              </span>
              <span className="font-mono">
                {formatMoney(building.weeklyRentCents)}
              </span>
            </button>

            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(1)}
              onClick={onClose}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] text-xs font-semibold cursor-pointer transition-all ${
                selectedIdx === 1
                  ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#2A201B]'
                  : ''
              }`}
            >
              <span>Leave Counter</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Switch</span>
          <span className="text-[#86EFAC] font-semibold">
            Space / Enter Confirm · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
