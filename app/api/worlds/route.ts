import { NextResponse } from 'next/server';
import { listWorlds, upsertWorld } from '@/lib/server/worldsStore';
import type { WorldSave } from '@/lib/game/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { worlds: listWorlds() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorldSave;
    if (!body || !body.id || !body.name) {
      return NextResponse.json(
        { error: 'Invalid world payload' },
        { status: 400 }
      );
    }
    const world = upsertWorld(body);
    return NextResponse.json(
      { world },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }
}
