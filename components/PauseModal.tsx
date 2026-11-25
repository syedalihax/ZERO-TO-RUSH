'use client';

import { useCallback, useState } from 'react';
import { LogOut, Play, Save, Users } from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import { DRINK_CATALOG, formatMoney } from '@/lib/game/constants';
import type { WorldSave } from '@/lib/game/types';

interface PauseModalProps {
  world: WorldSave;
  coopActive: boolean;
  onResume: () => void;
  onOpenCoop: () => void;
  onSaveNow: () => void;
  onSaveAndExit: () => void;
}

export default function PauseModal({
  world,
  coopActive,
  onResume,
  onOpenCoop,
  onSaveNow,
  onSaveAndExit,
}: PauseModalProps) {
  // 0 = Resume Shift, 1 = Co-Op, 2 = Save World, 3 = Save & Exit
  const [selectedIdx, setSelectedIdx] = useState(0);

  const handleUp = useCallback(() => {
    setSelectedIdx((prev) => (prev <= 0 ? 2 : prev === 1 ? 0 : 1));
  }, []);

  const handleDown = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : prev === 1 ? 2 : 0));
  }, []);

  const handleLeft = useCallback(() => {
    setSelectedIdx((prev) => (prev === 3 ? 2 : prev === 2 ? 3 : prev));
  }, []);

  const handleRight = useCallback(() => {
    setSelectedIdx((prev) => (prev === 2 ? 3 : prev === 3 ? 2 : prev));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) onResume();
    else if (selectedIdx === 1) onOpenCoop();
    else if (selectedIdx === 2) onSaveNow();
    else onSaveAndExit();
  }, [selectedIdx, onResume, onOpenCoop, onSaveNow, onSaveAndExit]);

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
            Unlocked Menu ({world.unlockedRecipes.length})
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
            Visit the{' '}
            <span className="text-[#86EFAC] font-semibold">
              Open Supermarket (E)
            </span>{' '}
            for supplies &amp; recipes, and{' '}
            <span className="text-[#FDE68A] font-semibold">
              Wood Master Workshop (E)
            </span>{' '}
            to craft Chairs, Tables, Shop Kitchens &amp; Readi Carts!
          </div>
          <div className="text-[#D6C7B5] font-mono leading-relaxed">
            {coopActive
              ? 'P1: WASD Move · E Act · F Alt · Q Dash | P2: Arrows · Enter Act · . Alt · R-Shift Dash'
              : 'WASD/Arrows Move · E Act · F Offer/Pick Up · Q Dash · P 2P Co-Op'}
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

          <button
            type="button"
            onMouseEnter={() => setSelectedIdx(1)}
            onClick={onOpenCoop}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold cursor-pointer transition-all ${
              coopActive
                ? 'bg-[#0D9488]/30 hover:bg-[#0D9488]/45 border-[#5EEAD4]/50 text-[#5EEAD4]'
                : 'bg-[#221915] hover:bg-[#3A2D26] border-[#14B8A6]/40 text-[#CCFBF1]'
            } ${
              selectedIdx === 1
                ? 'ring-2 ring-[#5EEAD4] ring-offset-2 ring-offset-[#2A201B]'
                : ''
            }`}
          >
            <Users className="w-4 h-4" />
            <span>
              {coopActive
                ? '2-Player Co-Op Active (Manage / Leave)'
                : 'Invite Partner (2-Player Co-Op)'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(2)}
              onClick={onSaveNow}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all ${
                selectedIdx === 2
                  ? 'bg-[#3A2D26] border-[#86EFAC] ring-1 ring-[#86EFAC]/60'
                  : 'bg-[#221915] hover:bg-[#3A2D26] border-[#D4A373]/20'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>Save World</span>
            </button>

            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(3)}
              onClick={onSaveAndExit}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all ${
                selectedIdx === 3
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

