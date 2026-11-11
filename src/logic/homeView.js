// Logica pura della home: ordine delle sessioni, filtro e sottotitolo della libreria, "ultimo accesso".

const seen = (s) => (typeof s?.lastSeen === 'number' && Number.isFinite(s.lastSeen) ? s.lastSeen : 0);

// La sessione più recente va in primo piano ("Riprendi"), le altre in elenco.
export function splitSessions(list) {
  const sorted = (Array.isArray(list) ? [...list] : []).sort((a, b) => seen(b) - seen(a));
  return { resume: sorted[0] ?? null, others: sorted.slice(1) };
}

// entries = [id, scheda][]. Un tipo mancante o corrotto conta come personaggio (come il picker di ingresso).
export function filterLibrary(entries, filter) {
  const list = Array.isArray(entries) ? entries : [];
  if (filter === 'player')   return list.filter(([, c]) => c?.type !== 'creature');
  if (filter === 'creature') return list.filter(([, c]) => c?.type === 'creature');
  return list;
}

const SIZES = { tiny: 'Minuscola', small: 'Piccola', medium: 'Media', large: 'Grande', huge: 'Enorme', gargantuan: 'Mastodontica' };

export function libraryMeta(c) {
  const t = (v) => String(v ?? '').trim();
  if (c?.type === 'creature') {
    const bits = ['Creatura', SIZES[c.size], t(c.armorClass) ? `CA ${t(c.armorClass)}` : ''].filter(Boolean);
    return bits.join(' · ');
  }
  const bits = [t(c?.class), c?.class && c?.level ? `Livello ${c.level}` : '', t(c?.race)].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Personaggio';
}

const dayStart = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

export function lastSeenLabel(ts, now = Date.now()) {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return '';
  if (now - ts < 60000) return 'adesso';
  const days = Math.round((dayStart(now) - dayStart(ts)) / 86400000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  return `${days} giorni fa`;
}
