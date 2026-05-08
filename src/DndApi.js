const BASE  = 'https://www.dnd5eapi.co/api';
const _cache = new Map();

async function _get(path) {
  if (_cache.has(path)) return _cache.get(path);
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`D&D API ${res.status}: ${path}`);
  const data = await res.json();
  _cache.set(path, data);
  return data;
}

export async function getMonsterList() {
  const d = await _get('/monsters?limit=500');
  return d.results ?? [];
}

export async function getMonster(index) {
  return _get(`/monsters/${index}`);
}

export async function getSpellList() {
  const d = await _get('/spells?limit=500');
  return d.results ?? [];
}

// Ritorna Map<nome_italiano, descrizione_stringa>
export async function getConditionDescriptions() {
  const MAP = {
    'Avvelenato':   'poisoned',
    'Stordito':     'stunned',
    'Spaventato':   'frightened',
    'Bloccato':     'restrained',
    'Accecato':     'blinded',
    'Assordato':    'deafened',
    'Assordata':    'deafened',
    'Prono':        'prone',
    'Invisibile':   'invisible',
    'Incapacitato': 'incapacitated',
    'Paralizzato':  'paralyzed',
    'Pietrificato': 'petrified',
    'Affascinato':  'charmed',
    'Esausto':      'exhaustion',
  };
  const result = new Map();
  await Promise.all(Object.entries(MAP).map(async ([ita, idx]) => {
    try {
      const d = await _get(`/conditions/${idx}`);
      result.set(ita, d.desc?.join(' ') ?? '');
    } catch { /* condizione non presente nella SRD */ }
  }));
  return result;
}
