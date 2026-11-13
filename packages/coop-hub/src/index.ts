import { MAX_REQUEST_BYTES, validateGuestPayload } from './validate.js';

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

interface AssetsFetcherLike {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1DatabaseLike;
  ASSETS: AssetsFetcherLike;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

function rawJsonResponse(rawJson: string, status = 200): Response {
  return new Response(rawJson, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM guests').first<{ cnt: number }>();
      return jsonResponse({ ok: true, count: row?.cnt ?? 0 });
    }

    if (url.pathname === '/api/guests' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT agent_id, agent_name, title, target_axis, outcome, reached_floor, epitaph, avatar_base64, updated_at
         FROM guests
         ORDER BY updated_at DESC
         LIMIT 50`
      ).all();
      return jsonResponse({ ok: true, guests: results });
    }

    if (url.pathname === '/api/guests/random' && request.method === 'GET') {
      const exclude = url.searchParams.get('exclude')?.trim() ?? '';
      let row: { guest_json: string } | null = null;

      if (exclude.length > 0) {
        row = await env.DB.prepare(
          `SELECT guest_json FROM guests WHERE agent_id != ? ORDER BY RANDOM() LIMIT 1`
        )
          .bind(exclude)
          .first<{ guest_json: string }>();
      } else {
        row = await env.DB.prepare(
          `SELECT guest_json FROM guests ORDER BY RANDOM() LIMIT 1`
        ).first<{ guest_json: string }>();
      }

      if (!row) {
        return jsonResponse(
          { ok: false, error: 'No matching companion available yet.' },
          404
        );
      }

      return rawJsonResponse(row.guest_json, 200);
    }

    if (url.pathname === '/api/guests' && request.method === 'POST') {
      const contentLengthHeader = request.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_REQUEST_BYTES) {
        return jsonResponse({ ok: false, error: 'Payload too large (max 64KB).' }, 413);
      }

      const rawText = await request.text();
      if (new TextEncoder().encode(rawText).byteLength > MAX_REQUEST_BYTES) {
        return jsonResponse({ ok: false, error: 'Payload too large (max 64KB).' }, 413);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        return jsonResponse({ ok: false, error: 'Invalid JSON syntax.' }, 400);
      }

      const validation = validateGuestPayload(parsed);
      if (!validation.ok) {
        return jsonResponse(
          { ok: false, error: 'Validation failed', details: validation.errors },
          400
        );
      }

      const s = validation.summary;
      const existing = await env.DB.prepare(
        `SELECT exported_at FROM guests WHERE agent_id = ?`
      )
        .bind(s.agent_id)
        .first<{ exported_at: string }>();

      if (existing && existing.exported_at) {
        const existingTs = Date.parse(existing.exported_at);
        const incomingTs = Date.parse(s.exported_at);
        if (!Number.isNaN(existingTs) && !Number.isNaN(incomingTs) && incomingTs < existingTs) {
          return jsonResponse(
            {
              ok: false,
              error: `Newer companion record already exists on the hub (${existing.exported_at} > ${s.exported_at}).`,
              existing_exported_at: existing.exported_at,
              incoming_exported_at: s.exported_at,
            },
            409
          );
        }
      }

      await env.DB.prepare(
        `INSERT INTO guests (
           agent_id, agent_name, title, target_axis, outcome, reached_floor, epitaph, avatar_base64, exported_at, guest_json, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(agent_id) DO UPDATE SET
           agent_name = excluded.agent_name,
           title = excluded.title,
           target_axis = excluded.target_axis,
           outcome = excluded.outcome,
           reached_floor = excluded.reached_floor,
           epitaph = excluded.epitaph,
           avatar_base64 = excluded.avatar_base64,
           exported_at = excluded.exported_at,
           guest_json = excluded.guest_json,
           updated_at = datetime('now')`
      )
        .bind(
          s.agent_id,
          s.agent_name,
          s.title,
          s.target_axis,
          s.outcome,
          s.reached_floor,
          s.epitaph,
          s.avatar_base64,
          s.exported_at,
          s.normalized_json
        )
        .run();

      const countRow = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM guests').first<{ cnt: number }>();

      return jsonResponse(
        {
          ok: true,
          message: 'Companion registered successfully.',
          agent_id: s.agent_id,
          agent_name: s.agent_name,
          title: s.title,
          target_axis: s.target_axis,
          count: countRow?.cnt ?? 1,
        },
        201
      );
    }

    return env.ASSETS.fetch(request);
  },
};
