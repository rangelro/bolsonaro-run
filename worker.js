// ============================================================
// worker.js — entry-point do Worker (site estático + API do ranking)
// Deploy é via `wrangler deploy` (não Cloudflare Pages "clássico"), então
// tudo que era functions/api/leaderboard.js foi consolidado aqui: rotas de
// API são tratadas manualmente e o resto cai pro binding ASSETS (arquivos
// estáticos do jogo, configurado em wrangler.toml via [assets]).
// ============================================================
const KEY = 'top10';
const MAX_ENTRIES = 10;
const MAX_NICK_LEN = 14;
const MAX_SANE_SCORE = 10_000_000; // teto de sanidade — bloqueia abuso óbvio via API, não é anti-cheat real

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

async function handleLeaderboardGet(env) {
  if (!env.LEADERBOARD_KV) return json({ top10: [] }); // KV ainda não vinculado — degrada, não quebra
  try {
    const top10 = (await env.LEADERBOARD_KV.get(KEY, { type: 'json' })) || [];
    return json({ top10 });
  } catch {
    return json({ top10: [] });
  }
}

async function handleLeaderboardPost(request, env) {
  if (!env.LEADERBOARD_KV) return json({ error: 'not_configured' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const nick = String(body.nick || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NICK_LEN);
  const score = Math.floor(Number(body.score));

  if (!nick) return json({ error: 'invalid_nick' }, 400);
  if (!Number.isFinite(score) || score < 0 || score > MAX_SANE_SCORE) {
    return json({ error: 'invalid_score' }, 400);
  }

  try {
    const top10 = (await env.LEADERBOARD_KV.get(KEY, { type: 'json' })) || [];
    const existing = top10.find((e) => e.nick === nick);
    if (existing) {
      if (score > existing.score) existing.score = score;
    } else {
      top10.push({ nick, score });
    }
    top10.sort((a, b) => b.score - a.score);
    const trimmed = top10.slice(0, MAX_ENTRIES);

    await env.LEADERBOARD_KV.put(KEY, JSON.stringify(trimmed));

    const idx = trimmed.findIndex((e) => e.nick === nick);
    return json({ top10: trimmed, rank: idx === -1 ? null : idx + 1 });
  } catch {
    return json({ error: 'internal_error' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/leaderboard') {
      if (request.method === 'GET') return handleLeaderboardGet(env);
      if (request.method === 'POST') return handleLeaderboardPost(request, env);
      return json({ error: 'method_not_allowed' }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};
