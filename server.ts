import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parse } from 'node:url';
import next from 'next';
import type { WorldSave } from './lib/game/types.ts';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

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

const worldsStore: Record<string, WorldSave> = loadWorldsFromDisk();
let savePending = false;

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
  if (savePending) return;
  savePending = true;
  setTimeout(() => {
    savePending = false;
    saveWorldsToDisk();
  }, 600);
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function sendApiJson(
  res: http.ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === '/api/worlds' && req.method === 'GET') {
    const list = Object.values(worldsStore).sort(
      (a, b) => b.lastPlayedAt - a.lastPlayedAt
    );
    sendApiJson(res, 200, { worlds: list });
    return true;
  }

  if (pathname === '/api/worlds' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readRequestBody(req)) as WorldSave;
      if (!body || !body.id || !body.name) {
        sendApiJson(res, 400, { error: 'Invalid world payload' });
        return true;
      }
      body.lastPlayedAt = body.lastPlayedAt || Date.now();
      worldsStore[body.id] = body;
      scheduleDiskSave();
      sendApiJson(res, 200, { world: body });
    } catch {
      sendApiJson(res, 400, { error: 'Malformed JSON' });
    }
    return true;
  }

  if (pathname.startsWith('/api/worlds/')) {
    const worldId = decodeURIComponent(pathname.slice('/api/worlds/'.length));
    if (!worldId) {
      sendApiJson(res, 400, { error: 'Missing world ID' });
      return true;
    }

    if (req.method === 'PUT') {
      try {
        const body = JSON.parse(await readRequestBody(req)) as WorldSave;
        body.id = worldId;
        body.lastPlayedAt = Date.now();
        worldsStore[worldId] = body;
        scheduleDiskSave();
        sendApiJson(res, 200, { world: body });
      } catch {
        sendApiJson(res, 400, { error: 'Malformed JSON' });
      }
      return true;
    }

    if (req.method === 'DELETE') {
      delete worldsStore[worldId];
      scheduleDiskSave();
      sendApiJson(res, 200, { deleted: true });
      return true;
    }
  }

  return false;
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '/', true);
      const pathname = parsedUrl.pathname || '/';
      if (pathname.startsWith('/api/')) {
        const handled = await handleApi(req, res, pathname);
        if (handled) return;
      }
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('HTTP request error:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Rush Hour Cafe 3D server running on http://0.0.0.0:${port}`);
  });
});
