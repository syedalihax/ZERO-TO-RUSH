'use client';

import {
  Bike,
  Building2,
  HeartHandshake,
  Pause,
  Save,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  HELD_ITEM_LABELS,
  LEVEL2_SERVED_THRESHOLD,
  MAX_WATER_CAPACITY,
  formatMoney,
} from '@/lib/game/constants';
import type {
  ProjectedLabel,
  ShiftSnapshot,
  WorldSave,
} from '@/lib/game/types';

interface GameHUDProps {
  world: WorldSave;
  shift: ShiftSnapshot;
  projectedLabels: ProjectedLabel[];
  guidedHint: string;
  targetPrompt: string | null;
  feedbackBanner: { text: string; color: string } | null;
  muted: boolean;
  saveLabel: string;
  onToggleMute: () => void;
  onPause: () => void;
  onQuickSave: () => void;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export default function GameHUD({
  world,
  shift,
  projectedLabels,
  guidedHint,
  targetPrompt,
  feedbackBanner,
  muted,
  saveLabel,
  onToggleMute,
  onPause,
  onQuickSave,
}: GameHUDProps) {
  const milkman = shift.milkman;
  const showMilk =
    world.stage >= 2 || world.unlockedRecipes.includes('doodh_patti');
  const showCoffee = world.unlockedRecipes.includes('coffee');
  const showSnacksCartStock =
    world.hasSnacksCart ||
    world.unlockedRecipes.includes('samosa') ||
    world.unlockedRecipes.includes('pakora') ||
    shift.inventory.samosaMix > 0 ||
    shift.inventory.pakoraMix > 0 ||
    shift.inventory.cookingOil > 0;
  const overdueRentShops = world.rentedShops.filter(
    (r) => world.day >= r.nextRentDueDay
  );

  return (
    <div className="fixed inset-0 z-20 pointer-events-none">
      {/* 3D-Projected Crisp World Labels */}
      {projectedLabels.map((lbl) => {
        if (!lbl.visible) return null;
        return (
          <div
            key={lbl.id}
            style={{
              transform: `translate3d(${Math.round(lbl.x)}px, ${Math.round(lbl.y)}px, 0) translate(-50%, -100%)`,
            }}
            className="absolute top-0 left-0 pointer-events-none"
          >
            <div
              className={`px-2 py-0.5 rounded-md bg-[#1B1410]/88 border text-[#FFFDF9] shadow-md text-center whitespace-nowrap ${
                lbl.urgent
                  ? 'border-[#EF4444]'
                  : lbl.kind === 'milkman' || lbl.kind === 'water_tap'
                    ? 'border-[#38BDF8]'
                    : lbl.kind === 'supermarket' ||
                        lbl.kind === 'supermarket_pickup' ||
                        lbl.kind === 'owner'
                      ? 'border-[#86EFAC]/70'
                      : lbl.kind === 'helper'
                        ? 'border-[#FBBF24]'
                        : lbl.kind === 'building_owner'
                          ? 'border-[#A78BFA]'
                          : lbl.kind === 'car' ||
                              lbl.kind === 'counter_tray' ||
                              lbl.kind === 'fryer' ||
                              lbl.kind === 'snacks_plot'
                            ? 'border-[#F59E0B]'
                            : lbl.kind === 'trash'
                              ? 'border-[#94A3B8]/60'
                              : 'border-[#D4A373]/40'
              }`}
            >
              <div className="text-[10px] font-semibold flex items-center justify-center gap-1">
                <span>{lbl.text}</span>
                {lbl.subText && (
                  <span
                    className={`font-mono font-bold ${
                      lbl.urgent ? 'text-[#FCA5A5]' : 'text-[#93C5FD]'
                    }`}
                  >
                    {lbl.subText}
                  </span>
                )}
              </div>
              {typeof lbl.progress === 'number' && (
                <div className="mt-0.5 h-1 w-16 mx-auto rounded-sm bg-[#2A201B] overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(lbl.progress * 100)}%`,
                      backgroundColor:
                        lbl.kind === 'fryer'
                          ? '#EA580C'
                          : lbl.kind === 'kettle'
                            ? '#F59E0B'
                            : lbl.progress > 0.5
                              ? '#16A34A'
                              : lbl.progress > 0.28
                                ? '#F59E0B'
                                : '#DC2626',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Perimeter HUD */}
      <div className="h-full flex flex-col justify-between p-3 sm:p-4">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left: Cycle Stock + Milkman Alert (Recipes moved to Building Shopkeeper) */}
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            <div className="px-3 py-2 rounded-lg bg-[#1B1410]/90 border border-[#D4A373]/30 text-[#FFFDF9] shadow-md flex flex-wrap items-center gap-2.5 text-xs tabular-nums">
              <span
                className={
                  shift.inventory.cups <= 3
                    ? 'text-[#FCA5A5] font-bold'
                    : 'text-[#FFFDF9] font-medium'
                }
              >
                Cups: {shift.inventory.cups}
                {shift.inventory.cups === 0 ? ' (EMPTY)' : ''}
              </span>
              <span aria-hidden="true" className="text-[#D4A373]/40">
                ·
              </span>
              <span
                className={
                  shift.inventory.teaLeaves <= 2
                    ? 'text-[#FCA5A5] font-bold'
                    : 'text-[#FFFDF9] font-medium'
                }
              >
                Tea: {shift.inventory.teaLeaves}
              </span>
              <span aria-hidden="true" className="text-[#D4A373]/40">
                ·
              </span>
              <span
                className={
                  shift.inventory.sugar <= 2
                    ? 'text-[#FCA5A5] font-bold'
                    : 'text-[#FFFDF9] font-medium'
                }
              >
                Sugar: {shift.inventory.sugar}
              </span>
              <span aria-hidden="true" className="text-[#D4A373]/40">
                ·
              </span>
              <span
                className={
                  shift.inventory.water <= 2
                    ? 'text-[#7DD3FC] font-bold'
                    : 'text-[#BAE6FD] font-medium'
                }
              >
                Water: {shift.inventory.water}/{MAX_WATER_CAPACITY}
              </span>

              {showMilk && (
                <>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span
                    className={
                      shift.inventory.milkPackets <= 1
                        ? 'text-[#93C5FD] font-bold'
                        : 'text-[#E0F2FE] font-medium'
                    }
                  >
                    Milk: {shift.inventory.milkPackets}
                  </span>
                </>
              )}

              {showCoffee && (
                <>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span
                    className={
                      shift.inventory.coffeePowder <= 1
                        ? 'text-[#FCA5A5] font-bold'
                        : 'text-[#FDE68A] font-medium'
                    }
                  >
                    Beans: {shift.inventory.coffeePowder}
                  </span>
                </>
              )}

              {shift.inventory.biscuits > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span className="text-[#FCA5A5] font-medium">
                    Biscuits: {shift.inventory.biscuits}
                  </span>
                </>
              )}

              {shift.inventory.cupcakes > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span className="text-[#F9A8D4] font-medium">
                    Cakes: {shift.inventory.cupcakes}
                  </span>
                </>
              )}

              {showSnacksCartStock && (
                <>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span
                    className={
                      shift.inventory.samosaMix <= 1
                        ? 'text-[#FCA5A5] font-bold'
                        : 'text-[#FDE68A] font-medium'
                    }
                  >
                    Samosa: {shift.inventory.samosaMix}
                  </span>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span
                    className={
                      shift.inventory.pakoraMix <= 1
                        ? 'text-[#FCA5A5] font-bold'
                        : 'text-[#FDBA74] font-medium'
                    }
                  >
                    Pakora: {shift.inventory.pakoraMix}
                  </span>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span
                    className={
                      shift.inventory.cookingOil <= 1
                        ? 'text-[#FCA5A5] font-bold'
                        : 'text-[#FDE047] font-medium'
                    }
                  >
                    Oil: {shift.inventory.cookingOil}
                  </span>
                </>
              )}
            </div>

            {milkman.phase !== 'away' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F766E]/95 border border-[#5EEAD4]/50 text-xs font-semibold text-[#CCFBF1] tabular-nums">
                <Bike className="w-3.5 h-3.5" />
                <span>
                  {milkman.phase === 'parked'
                    ? `Milkman Parked (${Math.ceil(milkman.timer)}s)`
                    : milkman.phase === 'arriving'
                      ? 'Milkman Approaching'
                      : 'Milkman Leaving'}
                </span>
              </div>
            )}

            {shift.helper.status === 'hired' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#78350F]/95 border border-[#FBBF24]/50 text-xs font-semibold text-[#FEF3C7] tabular-nums">
                <HeartHandshake className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>
                  Chotu Working · Served {shift.helper.servedCount} (
                  {formatMoney(shift.helper.wageEarnedCents)} wage)
                  {shift.helper.statusNote
                    ? ` · ${shift.helper.statusNote}`
                    : ''}
                </span>
              </div>
            )}

            {overdueRentShops.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7F1D1D]/95 border border-[#FCA5A5]/60 text-xs font-semibold text-[#FEE2E2] tabular-nums">
                <Building2 className="w-3.5 h-3.5 text-[#FCA5A5]" />
                <span>
                  Shop Rent Due ({overdueRentShops.length})! Meet Owner Inside
                  (E)
                </span>
              </div>
            )}
          </div>

          {/* Top-Center: Level, Day, 5:00 Clock, Cash, Served */}
          <div className="px-4 py-2 rounded-lg bg-[#1B1410]/90 border border-[#D4A373]/30 text-[#FFFDF9] shadow-md flex items-center gap-3 text-sm tabular-nums shrink-0">
            <span className="font-mono text-xs font-bold text-[#93C5FD]">
              {world.stage >= 2
                ? 'Lv 2'
                : `Lv 1 (${Math.min(world.totalServed, LEVEL2_SERVED_THRESHOLD)}/${LEVEL2_SERVED_THRESHOLD})`}
            </span>
            <span aria-hidden="true" className="text-[#D4A373]/40">
              ·
            </span>
            <span className="font-display font-bold text-[#FDBA74]">
              Day {world.day}
            </span>
            <span aria-hidden="true" className="text-[#D4A373]/40">
              ·
            </span>
            <span
              className={`font-mono font-bold text-base ${
                shift.timeLeft <= 20 ? 'text-[#FCA5A5]' : 'text-[#FFFDF9]'
              }`}
            >
              {formatClock(shift.timeLeft)}
            </span>
            <span aria-hidden="true" className="text-[#D4A373]/40">
              ·
            </span>
            <span className="font-mono font-bold text-[#FBBF24]">
              {formatMoney(world.cashCents)}
            </span>
            <span
              aria-hidden="true"
              className="text-[#D4A373]/40 hidden sm:inline"
            >
              ·
            </span>
            <span className="text-xs text-[#D6C7B5] hidden sm:inline">
              Served: {shift.servedCount}
            </span>
          </div>

          {/* Top-Right: Save, Mute, Pause */}
          <div className="pointer-events-auto flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onQuickSave}
              title="Save World Now"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1B1410]/90 hover:bg-[#2A201B] border border-[#D4A373]/25 text-xs font-medium text-[#D6C7B5] hover:text-[#FFFDF9] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveLabel}</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1B1410]/90 hover:bg-[#2A201B] border border-[#D4A373]/25 text-[#FFFDF9] cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onPause}
              aria-label="Pause game"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1B1410]/90 hover:bg-[#2A201B] border border-[#D4A373]/25 text-[#FFFDF9] cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Center Guided Prompt & Feedback */}
        <div className="flex flex-col items-center gap-2 mb-1">
          {feedbackBanner && (
            <div
              className="px-3.5 py-1 rounded-md bg-[#1B1410]/92 border border-[#D4A373]/30 font-display font-bold text-sm shadow-lg"
              style={{ color: feedbackBanner.color }}
            >
              {feedbackBanner.text}
            </div>
          )}

          <div className="px-4 py-2 rounded-lg bg-[#1B1410]/90 border border-[#D4A373]/30 text-xs sm:text-sm text-[#FFFDF9] shadow-lg flex flex-wrap items-center justify-center gap-3 max-w-4xl">
            <span className="font-semibold text-[#FDBA74]">
              Holding:{' '}
              {shift.player.holding && HELD_ITEM_LABELS[shift.player.holding]
                ? HELD_ITEM_LABELS[shift.player.holding]
                : 'Empty Hands'}
            </span>
            {(() => {
              const placedItems = (
                shift.trayItems ?? [shift.trayItem ?? null]
              ).filter((item): item is NonNullable<typeof item> => Boolean(item));
              if (placedItems.length === 0) return null;
              const summary =
                placedItems.length === 1
                  ? HELD_ITEM_LABELS[placedItems[0]]
                  : `${placedItems.length} items on Readi`;
              return (
                <>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span className="text-[#FDE68A]">
                    Readi Space: {summary}
                  </span>
                </>
              );
            })()}
            {(() => {
              const snackItems = (shift.snackTrayItems ?? []).filter(
                (item): item is NonNullable<typeof item> => Boolean(item)
              );
              if (snackItems.length === 0) return null;
              const summary =
                snackItems.length === 1
                  ? HELD_ITEM_LABELS[snackItems[0]]
                  : `${snackItems.length} items on Snacks Cart`;
              return (
                <>
                  <span aria-hidden="true" className="text-[#D4A373]/40">
                    ·
                  </span>
                  <span className="text-[#FDBA74]">Showcase: {summary}</span>
                </>
              );
            })()}
            <span aria-hidden="true" className="text-[#D4A373]/40">
              ·
            </span>
            <span
              className={
                targetPrompt
                  ? 'text-[#86EFAC] font-semibold'
                  : 'text-[#D6C7B5]'
              }
            >
              {targetPrompt || guidedHint}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
