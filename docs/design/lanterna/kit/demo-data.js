/* Dati finti realistici per demo.html e mockup — 5 giocatori, 8 creature, 30 voci di log.
   Campagna: «Le Ceneri di Valdrath». Round 3, tocca ad Aldric (il giocatore che guarda). */
const pc = (o) => ({ kind: 'pc', size: 1, conds: [], temp: 0, insp: false, xp: { pct: 40, ready: false }, ...o });
const mob = (o) => ({ size: 1, conds: [], temp: 0, ...o });

export const COMBATANTS = [
  pc({ id: 'aldric', name: "Aldric Vento-d'Autunno", short: 'Aldric', sub: 'Paladino 5', owner: 'Matteo', init: 22, hp: 41, hpMax: 47, temp: 5, ac: 19, insp: true, xp: { pct: 62, ready: false }, action: 'Colpo divino + Spada lunga', pos: [9, 11] }),
  pc({ id: 'cael', name: 'Cael Ombra-Sottile', short: 'Cael', sub: 'Ladro 5', owner: 'Luca', init: 21, hp: 12, hpMax: 31, ac: 15, conds: [{ id: 'poisoned', label: 'Avvelenato' }], xp: { pct: 48, ready: false }, action: 'Attacco furtivo con arco corto', pos: [6, 13] }),
  mob({ id: 'vexa', kind: 'enemy', name: 'Capitana Vexa', short: 'Vexa', sub: 'Cultista Fanatico · GS 2', init: 17, hp: 33, hpMax: 33, ac: 13, action: 'Lancia Comando', pos: [13, 6] }),
  pc({ id: 'fenrik', name: 'Fenrik Rocca-Rossa', short: 'Fenrik', sub: 'Barbaro 5', owner: 'Davide', init: 16, hp: 52, hpMax: 58, ac: 16, conds: [{ id: 'raging', label: 'Furia' }], xp: { pct: 71, ready: false }, pos: [11, 9] }),
  mob({ id: 'ombra', kind: 'enemy', name: 'Ombra', short: 'Ombra', sub: 'Non morto · GS 1/2', init: 15, hp: 16, hpMax: 16, ac: 12, pos: [7, 5] }),
  pc({ id: 'brenna', name: 'Brenna Mano-di-Pietra', short: 'Brenna', sub: 'Chierica 5', owner: 'Giulia', init: 14, hp: 33, hpMax: 38, ac: 18, xp: { pct: 100, ready: true }, pos: [8, 14] }),
  mob({ id: 'golem', kind: 'enemy', name: "Golem d'Ossa", short: 'Golem', sub: 'Costrutto · GS 6', init: 13, hp: 126, hpMax: 136, ac: 17, size: 3, conds: [{ id: 'frightened', label: 'Spaventato' }], pos: [14, 9] }),
  mob({ id: 'sk1', kind: 'enemy', name: 'Scheletro 1', short: 'Scheletro 1', sub: 'Non morto · GS 1/4', init: 12, hp: 13, hpMax: 13, ac: 13, pos: [10, 4] }),
  mob({ id: 'troll', kind: 'enemy', name: 'Troll delle Cripte', short: 'Troll', sub: 'Gigante · GS 5', init: 11, hp: 61, hpMax: 84, ac: 15, size: 2, conds: [{ id: 'prone', label: 'Prono' }], pos: [4, 8] }),
  pc({ id: 'isolde', name: 'Isolde Canto-di-Brace', short: 'Isolde', sub: 'Maga 5', owner: 'Sara', init: 9, hp: 0, hpMax: 27, ac: 12, conds: [{ id: 'unconscious', label: 'Privo di sensi' }], deathSaves: { ok: 1, ko: 2 }, xp: { pct: 33, ready: false }, pos: [5, 16] }),
  mob({ id: 'sk3', kind: 'enemy', name: 'Scheletro 3', short: 'Scheletro 3', sub: 'Non morto · GS 1/4', init: 7, hp: 4, hpMax: 13, ac: 13, pos: [3, 3] }),
  mob({ id: 'lupo', kind: 'ally', name: 'Lupo Spettrale', short: 'Lupo', sub: 'Evocato da Brenna', init: 5, hp: 11, hpMax: 11, ac: 13, pos: [10, 14] }),
  mob({ id: 'sk2', kind: 'enemy', name: 'Scheletro 2', short: 'Scheletro 2', sub: 'Non morto · GS 1/4', init: 3, hp: 0, hpMax: 13, ac: 13, dead: true, pos: [12, 12] }),
];

export const SESSION = { code: '4829', campaign: 'Le Ceneri di Valdrath', round: 3, activeId: 'aldric', meId: 'aldric', isMaster: false, master: 'Marco', user: 'Matteo' };

const N = (n, k) => ({ n, k });
const V = (v, k) => ({ v, k });
let _i = 0;
const e = (t, type, round, ...parts) => ({ id: 'e' + ++_i, t, type, round, parts });
export const LOG = [
  e('21:02', 'turn', 1, 'Inizia lo scontro — ', V('Round 1', 'turn')),
  e('21:02', 'roll', 1, N('Cael', 'pc'), ' tira iniziativa: ', V('21', 'roll')),
  e('21:03', 'turn', 1, 'Tocca a ', N('Aldric', 'pc')),
  e('21:03', 'dmg', 1, N('Aldric', 'pc'), ' ha colpito ', N('Scheletro 2', 'enemy'), ' infliggendo ', V('9 danni', 'dmg')),
  e('21:04', 'turn', 1, 'Tocca a ', N('Cael', 'pc')),
  e('21:04', 'dmg', 1, N('Cael', 'pc'), ' ha colpito ', N('Ombra', 'enemy'), ' di sorpresa: ', V('14 danni', 'dmg')),
  e('21:05', 'turn', 1, 'Tocca a ', N('Capitana Vexa', 'enemy')),
  e('21:05', 'cond', 1, N('Capitana Vexa', 'enemy'), ' ha lanciato Comando su ', N('Fenrik', 'pc'), ': ', V('Spaventato', 'cond')),
  e('21:06', 'turn', 1, 'Tocca a ', N('Fenrik', 'pc')),
  e('21:06', 'dmg', 1, N('Fenrik', 'pc'), ' ha colpito ', N('Golem d\'Ossa', 'enemy'), ' infliggendo ', V('17 danni', 'dmg')),
  e('21:08', 'dmg', 1, N('Scheletro 1', 'enemy'), ' ha colpito ', N('Brenna', 'pc'), ' infliggendo ', V('5 danni', 'dmg')),
  e('21:09', 'heal', 1, N('Brenna', 'pc'), ' ha curato ', N('Cael', 'pc'), ' di ', V('8 PF', 'heal')),
  e('21:11', 'turn', 2, 'Inizia il ', V('Round 2', 'turn')),
  e('21:12', 'dmg', 2, N('Aldric', 'pc'), ' ha colpito ', N('Scheletro 2', 'enemy'), ' infliggendo ', V('12 danni', 'dmg')),
  e('21:12', 'death', 2, N('Scheletro 2', 'enemy'), ' è stato abbattuto'),
  e('21:14', 'dmg', 2, N('Cael', 'pc'), ' ha colpito ', N('Scheletro 3', 'enemy'), ' infliggendo ', V('9 danni', 'dmg')),
  e('21:16', 'dmg', 2, N('Troll delle Cripte', 'enemy'), ' ha colpito ', N('Isolde', 'pc'), ' infliggendo ', V('13 danni', 'dmg')),
  e('21:17', 'death', 2, N('Isolde', 'pc'), ' è a terra: ', V('0 PF', 'dmg')),
  e('21:18', 'cond', 2, N('Troll delle Cripte', 'enemy'), ' è ', V('Prono', 'cond'), ' (spinto da ', N('Fenrik', 'pc'), ')'),
  e('21:21', 'heal', 2, N('Brenna', 'pc'), ' ha curato ', N('Fenrik', 'pc'), ' di ', V('6 PF', 'heal')),
  e('21:23', 'dmg', 2, N('Ombra', 'enemy'), ' ha drenato ', N('Cael', 'pc'), ': ', V('11 danni', 'dmg')),
  e('21:24', 'cond', 2, N('Cael', 'pc'), ' è ', V('Avvelenato', 'cond')),
  e('21:27', 'roll', 2, N('Isolde', 'pc'), ' tira un tiro salvezza contro morte: ', V('successo', 'heal')),
  e('21:29', 'turn', 3, 'Inizia il ', V('Round 3', 'turn')),
  e('21:30', 'roll', 3, N('Isolde', 'pc'), ' tira un tiro salvezza contro morte: ', V('fallimento', 'dmg')),
  e('21:31', 'dmg', 3, N('Golem d\'Ossa', 'enemy'), ' ha colpito ', N('Fenrik', 'pc'), ' infliggendo ', V('9 danni', 'dmg')),
  e('21:33', 'dmg', 3, N('Brenna', 'pc'), ' ha colpito ', N('Troll delle Cripte', 'enemy'), ' con Fiamma Sacra: ', V('11 danni', 'dmg')),
  e('21:35', 'heal', 3, N('Lupo Spettrale', 'ally'), ' ha ricevuto ', V('+4 PF', 'heal'), ' da ', N('Brenna', 'pc')),
  e('21:36', 'dmg', 3, N('Scheletro 1', 'enemy'), ' ha mancato ', N('Lupo Spettrale', 'ally')),
  e('21:37', 'turn', 3, 'Tocca a ', N('Aldric', 'pc')),
];

export const CONDITIONS = ['Accecato', 'Affascinato', 'Assordato', 'Avvelenato', 'Incapacitato', 'Invisibile', 'Paralizzato', 'Pietrificato', 'Privo di sensi', 'Prono', 'Spaventato', 'Stordito', 'Trattenuto', 'Afferrato'];

export const MENU = [
  { id: 'scene', icon: 'eye', label: 'Scena' },
  { id: 'ship', icon: 'anchor', label: 'Nave «Damselfly»' },
  { id: 'short', icon: 'moon', label: 'Riposo breve' },
  { id: 'long', icon: 'moon', label: 'Riposo lungo' },
  { id: 'theme', icon: 'brush', label: 'Aspetto' },
  { id: 'xp', icon: 'star', label: 'Assegna XP', master: true },
  { id: 'prog', icon: 'book', label: 'Modalità progressione', master: true },
  { id: 'reset', icon: 'alert', label: 'Reset incontro', master: true, danger: true },
];
