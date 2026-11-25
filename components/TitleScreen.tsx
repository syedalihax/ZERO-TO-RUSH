'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/use-menu-keyboard';

interface TitleScreenProps {
  active?: boolean;
  onPlayWorlds: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export default function TitleScreen({
  active = true,
  onPlayWorlds,
  muted,
  onToggleMute,
}: TitleScreenProps) {
  const [selectedIdx, setSelectedIdx] = useState(0); // 0 = Play Story Worlds, 1 = Mute Audio

  const toggleFocus = useCallback(() => {
    setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleSelect = useCallback(() => {
    if (selectedIdx === 0) {
      onPlayWorlds();
    } else {
      onToggleMute();
    }
  }, [selectedIdx, onPlayWorlds, onToggleMute]);

  useMenuKeyboard({
    enabled: active,
    onUp: toggleFocus,
    onDown: toggleFocus,
    onLeft: toggleFocus,
    onRight: toggleFocus,
    onSelect: handleSelect,
  });

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#1B1410] text-[#FFFDF9]">
      {/* Animated key-art backdrop */}
      <motion.div
        initial={{ scale: 1.05, x: 0 }}
        animate={{ scale: 1.0, x: -8 }}
        transition={{
          duration: 14,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
        className="absolute inset-0 w-full h-full"
      >
        <Image
          src="/images/title_chai_cycle.jpg"
          alt="Roadside chai vendor bicycle and delivery supply truck in warm sunlight"
          fill
          priority
          referrerPolicy="no-referrer"
          className="object-cover object-center"
        />
      </motion.div>

      {/* Left calm scrim for crisp contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(27,20,16,0.94) 0%, rgba(27,20,16,0.82) 38%, rgba(27,20,16,0.22) 72%, rgba(27,20,16,0.34) 100%)',
        }}
      />

      {/* Mute toggle top-right */}
      <button
        type="button"
        onMouseEnter={() => setSelectedIdx(1)}
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        className={`absolute top-6 right-6 z-20 flex items-center justify-center w-11 h-11 rounded-lg bg-[#2A201B]/90 border text-[#FFFDF9] hover:bg-[#3A2D26] transition-all cursor-pointer ${
          selectedIdx === 1
            ? 'border-[#FDBA74] ring-2 ring-[#FDBA74]/70 scale-105'
            : 'border-[#D4A373]/30'
        }`}
      >
        {muted ? (
          <VolumeX className="w-5 h-5" />
        ) : (
          <Volume2 className="w-5 h-5" />
        )}
      </button>

      {/* Left Title Lockup */}
      <div className="relative z-10 h-full flex flex-col justify-between px-8 py-10 md:px-16 md:py-14 max-w-2xl">
        <div />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="flex items-center gap-4">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect width="64" height="64" rx="14" fill="#EA580C" />
              <path
                d="M19 29H41V40C41 46.0751 36.0751 51 30 51C23.9249 51 19 46.0751 19 40V29Z"
                fill="#FFFDF9"
              />
              <path
                d="M41 32H45C47.7614 32 50 34.2386 50 37C50 39.7614 47.7614 42 45 42H41"
                stroke="#FFFDF9"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M24 22C24 19.5 26 18 26 15.5M30 21C30 18 32 16.5 32 13.5M36 22C36 19.5 38 18 38 15.5"
                stroke="#FDE68A"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-[#FDBA74] tracking-wide">
                3D Story Mode · Stage 1: Roadside Chai Cycle
              </p>
              <h1
                className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl tracking-tight text-[#FFFDF9] leading-[1.02]"
                style={{ textWrap: 'balance' }}
              >
                Rush Hour Cafe
              </h1>
            </div>
          </div>

          <p className="text-base sm:text-lg text-[#EAE0D0] max-w-md leading-relaxed">
            Begin your journey from a humble roadside tea bicycle with 20 disposable cups. Brew hot chai, doodh patti, and coffee, walk inside the Open Supermarket for supplies, chairs &amp; tables, and save your world anytime.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onMouseEnter={() => setSelectedIdx(0)}
              onClick={onPlayWorlds}
              className={`flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-[#EA580C] hover:bg-[#DC4E07] text-[#FFFDF9] font-display font-bold text-lg shadow-lg transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
                selectedIdx === 0
                  ? 'ring-2 ring-[#FDE68A] ring-offset-2 ring-offset-[#1B1410]'
                  : ''
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Play Story Worlds</span>
            </button>
          </div>
        </motion.div>

        <div className="text-xs sm:text-sm text-[#D6C7B5] font-mono">
          W/S/A/D Navigate · Space/Enter Select · In-Game: E Open/Close Menu · F Offer/Pick Up · Q Dash
        </div>
      </div>
    </div>
  );
}
