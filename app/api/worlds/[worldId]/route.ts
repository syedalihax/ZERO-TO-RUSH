import { NextResponse } from 'next/server';
import { deleteWorldById, upsertWorld } from '@/lib/server/worldsStore';
import type { WorldSave } from '@/lib/game/types';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  context: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId: rawId } = await context.params;
    const worldId = decodeURIComponent(rawId || '');
    if (!worldId) {
      return NextResponse.json(
        { error: 'Missing world ID' },
        { status: 400 }
      );
    }
    const body = (await request.json()) as WorldSave;
    const world = upsertWorld({
      ...body,
      id: worldId,
      lastPlayedAt: Date.now(),
    });
    return NextResponse.json(
      { world },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ worldId: string }> }
) {
  const { worldId: rawId } = await context.params;
  const worldId = decodeURIComponent(rawId || '');
  if (!worldId) {
    return NextResponse.json(
      { error: 'Missing world ID' },
      { status: 400 }
    );
  }
  deleteWorldById(worldId);
  return NextResponse.json(
    { deleted: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
