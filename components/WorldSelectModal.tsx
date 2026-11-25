'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, Coffee, Play, Plus, Trash2 } from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';
import { formatMoney } from '@/lib/game/constants';
import { createNewWorldSave } from '@/lib/game/engine';
import { formatRelativeTime } from '@/lib/game/storage';
import type { WorldSave } from '@/lib/game/types';

interface WorldSelectModalProps {
  worlds: WorldSave[];
  onBack: () => void;
  onStartWorld: (world: WorldSave) => void;
  onCreateWorld: (world: WorldSave) => void;
  onDeleteWorld: (worldId: string) => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function WorldSelectModal({
  worlds,
  onBack,
  onStartWorld,
  onCreateWorld,
  onDeleteWorld,
}: WorldSelectModalProps) {
  const [tab, setTab] = useState<'worlds' | 'create'>(
    worlds.length === 0 ? 'create' : 'worlds'
  );
  const [newName, setNewName] = useState('My Roadside Chai');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Navigation state:
  // On 'worlds' tab:
  //   row === -1 -> Header bar (col: 0 = Back, 1 = Saved Worlds, 2 = New World)
  //   row >= 0 -> World card index (col: 0 = Play/Start, 1 = Delete), or Create CTA if 0 worlds
  // On 'create' tab:
  //   row === -1 -> Header bar (col: 0 = Back, 1 = Saved Worlds, 2 = New World)
  //   row === 0  -> World Name text input (Space/Enter focuses it; ArrowDown moves to Start button)
  //   row === 1  -> Start Stage 1 Solo button
  const [row, setRow] = useState<number>(worlds.length === 0 ? 1 : 0);
  const [headerCol, setHeaderCol] = useState<number>(
    worlds.length === 0 ? 2 : 1
  );
  const [cardCol, setCardCol] = useState<0 | 1>(0);

  const worldRefs = useRef<Array<HTMLDivElement | null>>([]);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const safeWorldRow =
    tab === 'worlds'
      ? worlds.length === 0
        ? row <= -1
          ? -1
          : 0
        : row <= -1
          ? -1
          : Math.min(row, worlds.length - 1)
      : row <= -1
        ? -1
        : Math.min(row, 1);

  useEffect(() => {
    if (tab === 'worlds' && safeWorldRow >= 0 && worlds.length > 0) {
      worldRefs.current[safeWorldRow]?.scrollIntoView({ block: 'nearest' });
    }
  }, [tab, safeWorldRow, worlds.length]);

  const switchTab = useCallback((nextTab: 'worlds' | 'create') => {
    setTab(nextTab);
    setConfirmDeleteId(null);
    setCardCol(0);
    setRow(nextTab === 'create' ? 1 : 0);
    setHeaderCol(nextTab === 'create' ? 2 : 1);
  }, []);

  const submitNewWorld = useCallback(() => {
    const trimmed = newName.trim() || 'My Roadside Chai';
    const id = `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const world = createNewWorldSave(id, trimmed);
    onCreateWorld(world);
  }, [newName, onCreateWorld]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitNewWorld();
  };

  const handleUp = useCallback(() => {
    setConfirmDeleteId(null);
    if (tab === 'worlds') {
      const maxRow = Math.max(0, worlds.length - 1);
      if (safeWorldRow === -1) {
        setRow(maxRow);
      } else if (safeWorldRow === 0) {
        setRow(-1);
        setHeaderCol(1);
      } else {
        setRow(safeWorldRow - 1);
      }
    } else {
      if (safeWorldRow === -1) {
        setRow(1);
      } else if (safeWorldRow === 0) {
        nameInputRef.current?.blur();
        setRow(-1);
        setHeaderCol(2);
      } else {
        setRow(0);
      }
    }
  }, [tab, worlds.length, safeWorldRow]);

  const handleDown = useCallback(() => {
    setConfirmDeleteId(null);
    if (tab === 'worlds') {
      const maxRow = Math.max(0, worlds.length - 1);
      if (safeWorldRow === -1) {
        setRow(0);
      } else if (safeWorldRow >= maxRow) {
        setRow(-1);
        setHeaderCol(1);
      } else {
        setRow(safeWorldRow + 1);
      }
    } else {
      if (safeWorldRow === -1) {
        setRow(0);
      } else if (safeWorldRow === 0) {
        nameInputRef.current?.blur();
        setRow(1);
      } else {
        setRow(-1);
        setHeaderCol(2);
      }
    }
  }, [tab, worlds.length, safeWorldRow]);

  const handleLeft = useCallback(() => {
    if (safeWorldRow === -1) {
      const next = (headerCol - 1 + 3) % 3;
      setHeaderCol(next);
      if (next === 1) setTab('worlds');
      if (next === 2) setTab('create');
    } else if (tab === 'worlds' && worlds.length > 0) {
      setCardCol((prev) => (prev === 0 ? 1 : 0));
      setConfirmDeleteId(null);
    } else if (tab === 'create') {
      switchTab('worlds');
    }
  }, [safeWorldRow, headerCol, tab, worlds.length, switchTab]);

  const handleRight = useCallback(() => {
    if (safeWorldRow === -1) {
      const next = (headerCol + 1) % 3;
      setHeaderCol(next);
      if (next === 1) setTab('worlds');
      if (next === 2) setTab('create');
    } else if (tab === 'worlds' && worlds.length > 0) {
      setCardCol((prev) => (prev === 0 ? 1 : 0));
      setConfirmDeleteId(null);
    } else if (tab === 'create') {
      switchTab('worlds');
    }
  }, [safeWorldRow, headerCol, tab, worlds.length, switchTab]);

  const handleSelect = useCallback(() => {
    if (safeWorldRow === -1) {
      if (headerCol === 0) {
        onBack();
      } else if (headerCol === 1) {
        switchTab('worlds');
      } else {
        switchTab('create');
      }
      return;
    }

    if (tab === 'worlds') {
      if (worlds.length === 0) {
        switchTab('create');
        return;
      }
      const w = worlds[safeWorldRow];
      if (!w) return;
      if (cardCol === 0) {
        onStartWorld(w);
      } else {
        if (confirmDeleteId === w.id) {
          onDeleteWorld(w.id);
          setConfirmDeleteId(null);
          setCardCol(0);
        } else {
          setConfirmDeleteId(w.id);
        }
      }
    } else {
      if (safeWorldRow === 0) {
        nameInputRef.current?.focus();
      } else {
        submitNewWorld();
      }
    }
  }, [
    safeWorldRow,
    headerCol,
    tab,
    worlds,
    cardCol,
    confirmDeleteId,
    onBack,
    switchTab,
    onStartWorld,
    onDeleteWorld,
    submitNewWorld,
  ]);

  useMenuKeyboard({
    onUp: handleUp,
    onDown: handleDown,
    onLeft: handleLeft,
    onRight: handleRight,
    onSelect: handleSelect,
    onClose: onBack,
    allowTextInputNavigation: true,
  });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#1B1410]/92 p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl bg-[#2A201B] border border-[#D4A373]/25 shadow-2xl overflow-hidden text-[#FFFDF9]"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#D4A373]/15 bg-[#221915]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onMouseEnter={() => {
                setRow(-1);
                setHeaderCol(0);
              }}
              onClick={onBack}
              className={`flex items-center justify-center w-9 h-9 rounded-lg bg-[#3A2D26] hover:bg-[#4B3B32] text-[#FFFDF9] transition-all cursor-pointer ${
                safeWorldRow === -1 && headerCol === 0
                  ? 'ring-2 ring-[#FDE68A]'
                  : ''
              }`}
              aria-label="Back to title"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-display font-bold text-xl leading-tight">
                Story Worlds (Solo Journey)
              </h2>
              <p className="text-xs text-[#D6C7B5]">
                Start solo on your chai bicycle · Walk into the Open Supermarket &amp; free water tap
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1B1410]">
            <button
              type="button"
              onMouseEnter={() => {
                setRow(-1);
                setHeaderCol(1);
              }}
              onClick={() => switchTab('worlds')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'worlds'
                  ? 'bg-[#EA580C] text-[#FFFDF9]'
                  : 'text-[#D6C7B5] hover:text-[#FFFDF9]'
              } ${
                safeWorldRow === -1 && headerCol === 1
                  ? 'ring-2 ring-[#FDE68A]'
                  : ''
              }`}
            >
              Saved Worlds ({worlds.length})
            </button>
            <button
              type="button"
              onMouseEnter={() => {
                setRow(-1);
                setHeaderCol(2);
              }}
              onClick={() => switchTab('create')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'create'
                  ? 'bg-[#EA580C] text-[#FFFDF9]'
                  : 'text-[#D6C7B5] hover:text-[#FFFDF9]'
              } ${
                safeWorldRow === -1 && headerCol === 2
                  ? 'ring-2 ring-[#FDE68A]'
                  : ''
              }`}
            >
              New World
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'worlds' && (
            <div className="space-y-3">
              {worlds.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <Coffee className="w-10 h-10 text-[#D4A373] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-lg">
                      No Saved Worlds Yet
                    </h3>
                    <p className="text-sm text-[#D6C7B5] max-w-sm mx-auto">
                      Start your solo tea bicycle story! Your cash, cups, recipes, and 5-minute shifts save automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTab('create')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#EA580C] hover:bg-[#DC4E07] text-[#FFFDF9] font-medium text-sm cursor-pointer ${
                      safeWorldRow === 0 ? 'ring-2 ring-[#FDE68A]' : ''
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New World</span>
                  </button>
                </div>
              ) : (
                worlds.map((w, idx) => {
                  const hasMidShift =
                    w.activeShift && w.activeShift.phase === 'playing';
                  const isRowFocused = safeWorldRow === idx;
                  return (
                    <div
                      key={w.id}
                      ref={(el) => {
                        worldRefs.current[idx] = el;
                      }}
                      onMouseEnter={() => setRow(idx)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
                        isRowFocused
                          ? 'bg-[#33261F] border-[#FDBA74] ring-1 ring-[#FDBA74]/50'
                          : 'bg-[#221915] border-[#D4A373]/15'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 mt-1 transition-opacity ${
                            isRowFocused
                              ? 'text-[#FDBA74] opacity-100'
                              : 'opacity-0'
                          }`}
                        />
                        <div className="space-y-1 min-w-0">
                          <h3 className="font-display font-bold text-lg truncate">
                            {w.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#D6C7B5] tabular-nums">
                            <span className="text-[#93C5FD] font-semibold">
                              Level {w.stage}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Day {w.day}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#FBBF24] font-mono">
                              {formatMoney(w.cashCents)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{w.totalServed} Cups Served</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Saved {formatRelativeTime(w.lastPlayedAt)}
                            </span>
                          </div>
                          {hasMidShift && w.activeShift && (
                            <p className="text-xs text-[#FDBA74] tabular-nums">
                              Shift in progress:{' '}
                              {formatClock(w.activeShift.timeLeft)} left ·{' '}
                              {w.activeShift.inventory.cups} Cups ·{' '}
                              {w.activeShift.inventory.teaLeaves} Tea ·{' '}
                              {w.activeShift.inventory.sugar} Sugar ·{' '}
                              {w.activeShift.inventory.water} Water
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onMouseEnter={() => {
                            setRow(idx);
                            setCardCol(0);
                          }}
                          onClick={() => onStartWorld(w)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EA580C] hover:bg-[#DC4E07] text-[#FFFDF9] text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                            isRowFocused && cardCol === 0
                              ? 'ring-2 ring-[#FDE68A]'
                              : ''
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{hasMidShift ? 'Resume World' : 'Start Day'}</span>
                        </button>

                        {confirmDeleteId === w.id ? (
                          <button
                            type="button"
                            onMouseEnter={() => {
                              setRow(idx);
                              setCardCol(1);
                            }}
                            onClick={() => {
                              onDeleteWorld(w.id);
                              setConfirmDeleteId(null);
                            }}
                            className={`px-3 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                              isRowFocused && cardCol === 1
                                ? 'ring-2 ring-[#FCA5A5]'
                                : ''
                            }`}
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onMouseEnter={() => {
                              setRow(idx);
                              setCardCol(1);
                            }}
                            onClick={() => setConfirmDeleteId(w.id)}
                            aria-label={`Delete ${w.name}`}
                            className={`flex items-center justify-center w-9 h-9 rounded-lg bg-[#1B1410] hover:bg-[#3A2D26] text-[#D6C7B5] hover:text-[#FCA5A5] transition-colors cursor-pointer ${
                              isRowFocused && cardCol === 1
                                ? 'ring-2 ring-[#FCA5A5]'
                                : ''
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-5 max-w-lg">
              <div className="space-y-2">
                <label
                  htmlFor="world-name"
                  className="block text-sm font-medium text-[#EAE0D0]"
                >
                  World Name{' '}
                  <span className="text-[11px] font-mono text-[#D4A373]">
                    (Space/Enter to edit)
                  </span>
                </label>
                <input
                  ref={nameInputRef}
                  id="world-name"
                  type="text"
                  maxLength={32}
                  required
                  value={newName}
                  onFocus={() => setRow(0)}
                  onChange={(e) => setNewName(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg bg-[#1B1410] border text-[#FFFDF9] focus:outline-none focus:border-[#EA580C] ${
                    safeWorldRow === 0
                      ? 'border-[#FDBA74] ring-2 ring-[#FDBA74]/50'
                      : 'border-[#D4A373]/30'
                  }`}
                  placeholder="Enter your world name"
                />
              </div>

              <div className="p-4 rounded-lg bg-[#221915] border border-[#D4A373]/15 space-y-2 text-xs text-[#D6C7B5] leading-relaxed">
                <div className="font-semibold text-[#FDBA74] text-sm">
                  Roadside Journey (Stage 1 → Level 2)
                </div>
                <div>· 1 Roadside Chai Bicycle with Free Counter Tray · 20 Cups · $1.00 Cash</div>
                <div>· Walk-in Open Supermarket (Supplies, Recipes, Chairs &amp; Tables) + Free Water Tap</div>
                <div>· Place Cafe Chairs &amp; Tables outside so customers &amp; you can sit!</div>
                <div>· Press F near any customer or car to Offer Another Drink or Reject</div>
              </div>

              <button
                type="submit"
                onMouseEnter={() => setRow(1)}
                className={`px-6 py-3 rounded-lg bg-[#EA580C] hover:bg-[#DC4E07] text-[#FFFDF9] font-display font-bold text-base cursor-pointer transition-all ${
                  safeWorldRow === 1
                    ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#2A201B]'
                    : ''
                }`}
              >
                Start Stage 1 Solo
              </button>
            </form>
          )}
        </div>

        <div className="px-6 py-2.5 bg-[#1B1410] border-t border-[#D4A373]/15 text-[11px] font-mono text-[#D6C7B5] flex flex-wrap items-center justify-between gap-2">
          <span>W / S Move · A / D Switch Tab or Action</span>
          <span className="text-[#FDE68A] font-semibold">
            Space / Enter Select · E / Esc Back
          </span>
        </div>
      </motion.div>
    </div>
  );
}
