import fs from 'node:fs';
import path from 'node:path';
import type { WorldSave } from '@/lib/game/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const WORLDS_FILE = path.join(DATA_DIR, 'worlds.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadWorldsFromDisk(): Record<string, WorldSave> {
  ensureDataDir();
  if (!fs.existsSync(WORLDS_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(WORLDS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, WorldSave>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const globalForWorlds = globalThis as unknown as {
  __rushHourWorldsStore?: Record<string, WorldSave>;
  __rushHourSavePending?: boolean;
};

const worldsStore: Record<string, WorldSave> =
  globalForWorlds.__rushHourWorldsStore ?? loadWorldsFromDisk();
globalForWorlds.__rushHourWorldsStore = worldsStore;

function saveWorldsToDisk(): void {
  ensureDataDir();
  try {
    const tmpFile = `${WORLDS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(worldsStore, null, 2), 'utf-8');
    fs.renameSync(tmpFile, WORLDS_FILE);
  } catch (err) {
    console.error('Failed to persist worlds:', err);
  }
}

function scheduleDiskSave(): void {
  if (globalForWorlds.__rushHourSavePending) return;
  globalForWorlds.__rushHourSavePending = true;
  setTimeout(() => {
    globalForWorlds.__rushHourSavePending = false;
    saveWorldsToDisk();
  }, 600);
}

export function listWorlds(): WorldSave[] {
  return Object.values(worldsStore).sort(
    (a, b) => b.lastPlayedAt - a.lastPlayedAt
  );
}

export function upsertWorld(world: WorldSave): WorldSave {
  const saved: WorldSave = {
    ...world,
    lastPlayedAt: world.lastPlayedAt || Date.now(),
  };
  worldsStore[saved.id] = saved;
  scheduleDiskSave();
  return saved;
}

export function deleteWorldById(worldId: string): void {
  delete worldsStore[worldId];
  scheduleDiskSave();
}
