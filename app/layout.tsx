import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Rush Hour Cafe — 4-Player Co-Op Kitchen & Persistent Worlds',
  description:
    '4-player co-op cafe cooking & serving game with real-time multiplayer and persistent Minecraft-style cafe worlds.',
  openGraph: {
    title: 'Rush Hour Cafe — 4-Player Co-Op Kitchen & Persistent Worlds',
    description:
      '4-player co-op cafe cooking & serving game with real-time multiplayer and persistent Minecraft-style cafe worlds.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rush Hour Cafe — 4-Player Co-Op Kitchen & Persistent Worlds',
    description:
      '4-player co-op cafe cooking & serving game with real-time multiplayer and persistent Minecraft-style cafe worlds.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body
        className="font-sans antialiased bg-[#1B1410] text-[#FFFDF9] overflow-hidden select-none"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
