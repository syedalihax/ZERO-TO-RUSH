'use client';

import { useCallback, useState } from 'react';
import { LogOut, Play, Save } from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import { DRINK_CATALOG, formatMoney } from '@/lib/game/constants';
import type { WorldSave } from '@/lib/game/types';

interface PauseModalProps {
  world: WorldSave;
  onResume: () => void;
  onSaveNow: () => void;
  onSaveAndExit: () => void;
}

export default function PauseModal({
  world,
  onResume,
  onSaveNow,
  onSaveAndExit,
}: PauseModalProps) {
  // 0 = Resume Shift, 1 = Save World, 2 = Save & Exit
  const [selectedIdx, setSelectedIdx] = useState(0);

  const handleUp = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleDown = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleLeft = useCallback(() => {
    setSelectedIdx((prev) => (prev === 2 ? 1 : prev === 1 ? 2 : 1));
  }, []);

  const handleRight = useCallback(() => {
    setSelectedIdx((prev) => (prev === 1 ? 2 : prev === 2 ? 1 : 2));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) onResume();
    else if (selectedIdx === 1) onSaveNow();
    else onSaveAndExit();
  }, [selectedIdx, onResume, onSaveNow, onSaveAndExit]);

  useMenuKeyboard({
    onUp: handleUp,
    onDown: handleDown,
    onLeft: handleLeft,
    onRight: handleRight,
    onSelect: handleSelect,
    onClose: onResume,
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1B1410]/85 p-4">
      <div className="w-full max-w-md rounded-xl bg-[#2A201B] border border-[#D4A373]/30 shadow-2xl text-[#FFFDF9] p-6 space-y-5">
        <div>
          <p className="text-xs font-mono text-[#FDBA74]">
            {world.name} · Level {world.stage} · Day {world.day} ·{' '}
            {formatMoney(world.cashCents)}
          </p>
          <h2 className="font-display font-bold text-2xl mt-0.5">Paused</h2>
        </div>

        <div className="p-4 rounded-lg bg-[#221915] border border-[#D4A373]/15 space-y-2 text-xs text-[#EAE0D0]">
          <div className="font-semibold text-[#FDBA74]">
            Unlocked Drinks ({world.unlockedRecipes.length}/3)
          </div>
          {world.unlockedRecipes.map((d) => {
            const info = DRINK_CATALOG[d] ?? DRINK_CATALOG.tea;
            return (
              <div key={d} className="flex items-center justify-between">
                <span>· {info.name}</span>
                <span className="font-mono text-[#FBBF24]">
                  {formatMoney(info.priceCents)}
                </span>
              </div>
            );
          })}
          <div className="pt-2 border-t border-[#D4A373]/15 text-[#D6C7B5] leading-relaxed">
            Walk into the{' '}
            <span className="text-[#86EFAC] font-semibold">
              Open Supermarket on the right (E)
            </span>{' '}
            for supplies, recipes, plus{' '}
            <span className="text-[#FDE68A] font-semibold">
              Chairs &amp; Tables
            </span>
            !
          </div>
          <div className="text-[#D6C7B5] font-mono leading-relaxed">
            WASD Move · E Open/Close Menu &amp; Act · F Offer/Pick Up · Q Dash
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onMouseEnter={() => setSelectedIdx(0)}
            onClick={onResume}
            className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#EA580C] hover:bg-[#DC4E07] font-display font-bold text-base cursor-pointer transition-all ${
              selectedIdx === 0
                ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#2A201B]'
                : ''
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Shift</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(1)}
              onClick={onSaveNow}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all ${
                selectedIdx === 1
                  ? 'bg-[#3A2D26] border-[#86EFAC] ring-1 ring-[#86EFAC]/60'
                  : 'bg-[#221915] hover:bg-[#3A2D26] border-[#D4A373]/20'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>Save World</span>
            </button>

            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(2)}
              onClick={onSaveAndExit}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all ${
                selectedIdx === 2
                  ? 'bg-[#7F1D1D] border-[#FCA5A5] ring-1 ring-[#FCA5A5]/60'
                  : 'bg-[#221915] hover:bg-[#7F1D1D] border-[#D4A373]/20'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>Save &amp; Exit</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S / A / D Navigate</span>
          <span className="text-[#FDE68A] font-semibold">
            Space / Enter Select · E / Esc Resume
          </span>
        </div>
      </div>
    </div>
  );
}
