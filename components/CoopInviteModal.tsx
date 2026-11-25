'use client';

import { useCallback, useState } from 'react';
import {
  Handshake,
  Keyboard,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import { HELD_ITEM_LABELS } from '@/lib/game/constants';
import type { HeldItem } from '@/lib/game/types';

interface CoopInviteModalProps {
  coopActive: boolean;
  p1Holding: HeldItem;
  p2Holding: HeldItem;
  onToggleCoop: () => void;
  onClose: () => void;
}

export default function CoopInviteModal({
  coopActive,
  p1Holding,
  p2Holding,
  onToggleCoop,
  onClose,
}: CoopInviteModalProps) {
  // 0 = Toggle Co-Op, 1 = Close
  const [selectedIdx, setSelectedIdx] = useState(0);

  const toggleIdx = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) onToggleCoop();
    else onClose();
  }, [selectedIdx, onToggleCoop, onClose]);

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
      <div className="w-full max-w-2xl rounded-xl bg-[#2A201B] border border-[#14B8A6]/45 shadow-2xl text-[#FFFDF9] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#221915] border-b border-[#D4A373]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0D9488] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                Same-PC 2-Player Co-Op Mode
              </h2>
              <p className="text-xs text-[#D6C7B5]">
                Shared Business Partners · Cash, Stock, Readi Carts &amp; Shops
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close co-op modal"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-lg bg-[#0F766E]/25 border border-[#5EEAD4]/35 flex items-start gap-2.5 text-xs text-[#CCFBF1] leading-relaxed">
            <Handshake className="w-4 h-4 text-[#5EEAD4] shrink-0 mt-0.5" />
            <div>
              Play together on one keyboard as equal business partners with{' '}
              <span className="font-semibold text-[#FFFDF9]">
                automatic Split-Screen cameras
              </span>{' '}
              (Left screen follows Player 1 · Right screen follows Player 2)! Walk anywhere apart — one partner can buy Milk, Ice, &amp; Supplies or order from Wood Master while the other cooks &amp; serves at any Readi.
            </div>
          </div>

          {/* Two-Column Controls Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-[#221915] border border-[#EA580C]/45 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-[#FDBA74]">
                  Player 1 (Orange Apron)
                </span>
                <span className="px-2 py-0.5 rounded bg-[#EA580C]/20 text-[#FDBA74] font-mono text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>
              <div className="space-y-1 text-xs font-mono text-[#EAE0D0]">
                <div className="flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-[#FDBA74]" />
                  <span>Move: W A S D</span>
                </div>
                <div>Interact / Serve: E or Space</div>
                <div>Offer Alt / Pick Furn: F</div>
                <div>Dash: Q or Left Shift</div>
              </div>
              <div className="pt-1.5 border-t border-[#D4A373]/15 text-[11px] text-[#D6C7B5] truncate">
                Holding:{' '}
                <span className="text-[#FFFDF9] font-semibold">
                  {p1Holding ? HELD_ITEM_LABELS[p1Holding] : 'Empty Hands'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#221915] border border-[#14B8A6]/45 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-[#5EEAD4]">
                  Player 2 (Teal Apron)
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    coopActive
                      ? 'bg-[#0D9488]/30 text-[#5EEAD4]'
                      : 'bg-[#1B1410] text-[#94A3B8]'
                  }`}
                >
                  {coopActive ? 'JOINED' : 'OFFLINE'}
                </span>
              </div>
              <div className="space-y-1 text-xs font-mono text-[#EAE0D0]">
                <div className="flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-[#5EEAD4]" />
                  <span>Move: Arrow Keys</span>
                </div>
                <div>Interact / Serve: Enter or /</div>
                <div>Offer Alt / Pick Furn: . or Backspace</div>
                <div>Dash: Right Shift or ,</div>
              </div>
              <div className="pt-1.5 border-t border-[#D4A373]/15 text-[11px] text-[#D6C7B5] truncate">
                Holding:{' '}
                <span className="text-[#FFFDF9] font-semibold">
                  {coopActive
                    ? p2Holding
                      ? HELD_ITEM_LABELS[p2Holding]
                      : 'Empty Hands'
                    : 'Not Joined'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(1)}
              onClick={onClose}
              className={`px-4 py-2.5 rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] text-xs font-semibold cursor-pointer transition-all ${
                selectedIdx === 1
                  ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#2A201B]'
                  : ''
              }`}
            >
              Back to Shift
            </button>

            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(0)}
              onClick={onToggleCoop}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-display font-bold text-sm cursor-pointer transition-all ${
                coopActive
                  ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white'
                  : 'bg-[#0D9488] hover:bg-[#0F766E] text-white'
              } ${
                selectedIdx === 0
                  ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#2A201B]'
                  : ''
              }`}
            >
              {coopActive ? (
                <>
                  <UserMinus className="w-4 h-4" />
                  <span>Leave Co-Op (Solo Mode)</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Invite Partner (Enable 2P Co-Op)</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S / A / D Switch</span>
          <span className="text-[#5EEAD4] font-semibold">
            Space / Enter Confirm · E / Esc Close
          </span>
        </div>
      </div>
    </div>
  );
}
