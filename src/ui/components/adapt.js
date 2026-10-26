/* ==========================================================================
   adapt.js — dal modello dati dell'app al modello che si aspetta il kit «Lanterna»

   Esiste perché i due modelli non condividono un solo nome di campo:
   l'app ha hpCurrent/tempHp/armorClass/inspiration/initiative e un `type`
   player|creature|pet con una `faction`, il kit vuole hp/temp/ac/insp/init e
   un `kind` pc|ally|enemy.

   Qui dentro, e in nessun altro posto, vive anche LA REGOLA DI VISIBILITÀ:
   chi può vedere gli HP e la CA di chi. I componenti del kit non la conoscono,
   ricevono già i dati filtrati. Se finisse nei componenti si sparpaglierebbe su
   ognuno di essi e basterebbe dimenticarla una volta per mostrare ai giocatori
   gli HP di tutti i mostri.

   NOTA ONESTA sulla visibilità: questo è un filtro di presentazione, non una
   barriera di sicurezza. Le security rules danno `.read: true` sull'intero nodo
   della sessione, quindi gli HP delle creature arrivano comunque al browser di
   tutti — era già così prima, con l'HTML generato a stringhe. Nascondere qui
   significa "non finiscono nel DOM", non "il client non li ha".

   Funzione pura: nessun accesso al DOM, nessuna scrittura su Firebase.
   Si può provare dalla console senza aprire una sessione.
   ========================================================================== */

import { footprintOf } from '../GridUI.js';

/* Quanto è malmesso un bersaglio di cui non puoi vedere i numeri.
   Spostate qui da UI.js (dov'erano private) perché servono all'adattatore e
   l'import contrario — adapt.js che importa UI.js — creerebbe un ciclo. */
export function healthHintKey(percent) {
  if (percent === 100) return 'full';
  if (percent >= 75)   return 'good';
  if (percent >= 50)   return 'hurt';
  if (percent >= 25)   return 'bad';
  if (percent > 0)     return 'critical';
  return 'ko';
}

export function healthHintText(percent) {
  if (percent === 100) return 'Nel pieno delle forze';
  if (percent >= 75)   return 'Leggermente ferito';
  if (percent >= 50)   return 'Ferito';
  if (percent >= 20)   return 'Gravemente ferito';
  if (percent > 0)     return 'In fin di vita';
  return 'A terra';
}

/* Soglie XP per livello (5e). Spostate qui da UI.js, dove erano private: le usa
   l'adattatore e le usa ancora il dock, quindi devono stare nel modulo che
   entrambi possono importare senza creare un ciclo. */
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
                              85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** Stato XP di un PG: percentuale 0-100 per la cornice del ritratto, + se il
 *  level-up è pronto. Il kit vuole la percentuale, non la frazione 0-1. */
export function xpStateFor(combatant, progression = {}) {
  if (combatant.type !== 'player') return null;
  const { mode = 'xp', xp = {}, levelUpGranted = {} } = progression;
  const combXp = xp[combatant.id] ?? 0;
  const level  = combatant.level ?? 1;
  const ready  = mode === 'xp'
    ? (level < 20 && combXp >= XP_THRESHOLDS[level])
    : levelUpGranted[combatant.id] === true;

  let pct = 0, title = '';
  if (mode === 'xp') {
    if (level >= 20) {
      pct = 100;
      title = `XP: ${combXp.toLocaleString('it')} — Livello massimo`;
    } else {
      const hi = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[19];
      pct   = Math.round(Math.min(1, Math.max(0, combXp / hi)) * 100) || 0;
      title = `XP: ${combXp.toLocaleString('it')} / ${hi.toLocaleString('it')} per Lv.${level + 1}`;
    }
  }
  return { pct, ready, title, mode };
}

/**
 * @param {object} c    combattente come arriva da Firebase, con `id` aggiunto
 * @param {object} ctx
 *   viewerUid       chi sta guardando
 *   masterUid       chi è il master della sessione
 *   acMap           { ownerUid: armorClass } — CA sincronizzata dalle schede
 *   deathSaves      { successes, failures } del PG di chi guarda, o null
 *   xp              { pct, ready } già calcolati, o null
 *   conditionColor  (nome) => colore CSS, opzionale
 * @returns modello per FightCard / CombatantList / InitiativeRail
 */
export function toCardModel(c, ctx = {}) {
  const { viewerUid = null, masterUid = null, acMap = {}, deathSaves = null,
          progression = {}, conditionColor = null } = ctx;
  const xp = xpStateFor(c, progression);

  const isMaster   = viewerUid != null && viewerUid === masterUid;
  const isCreature = c.type === 'creature';
  const isPet      = c.type === 'pet';
  const isOwnCard  = viewerUid === c.ownerUid && c.type === 'player';

  // ── Regola di visibilità — copia fedele di UI.js:369-374 ────────────────
  const showFullHp = isMaster || isOwnCard || !isCreature;
  const showHint   = !isOwnCard && !isMaster && isCreature && c.showHealthHint === true;
  const acVisible  = !isCreature || isMaster || c.showAC === true;

  const hpMax    = c.hpMax ?? 1;
  const hpCur    = c.hpCurrent ?? 0;
  const hpPct    = hpMax > 0 ? (hpCur / hpMax) * 100 : 0;
  const rawAc    = isPet ? (c.armorClass ?? null) : (acMap[c.ownerUid] ?? c.armorClass ?? null);

  // `pet`: reso come alleato (anello tratteggiato), ma trattato come giocatore
  // per la visibilità — sta nella lista dei giocatori e il riposo lo cura.
  const kind = c.type === 'player' ? 'pc'
             : isPet               ? 'ally'
             : c.faction === 'good' ? 'ally'
             : 'enemy';

  const conds = Object.keys(c.conditions ?? {}).map((name) => ({
    id: name,
    label: name,
    color: conditionColor ? conditionColor(name) : undefined,
  }));

  return {
    id:   c.id,
    name: c.name ?? '',
    // Il kit usa `short` nei punti stretti (rail, log). Il modello non ha un
    // nome breve: si prende la prima parola, che per "Aldric Vento-d'Autunno"
    // dà "Aldric" e per "Scheletro 1" dà "Scheletro" — accettabile.
    short: String(c.name ?? '').split(/\s+/)[0] || '',
    // `sub` nel design è "Paladino 5" / "Non morto · GS 1/4". La CLASSE non è
    // nello snapshot di sessione (sta nella scheda) e le creature non hanno un
    // campo GS, quindi si ricostruisce solo ciò che esiste davvero: tipo e,
    // per i PG, il livello. Niente dati inventati.
    sub: [isCreature ? 'Creatura' : isPet ? 'Famiglio' : 'PG',
          c.type === 'player' && c.level ? `Lv.${c.level}` : null].filter(Boolean).join(' · '),
    // Il kit mostra il nome del giocatore; l'app ha solo l'uid e nessuna mappa
    // uid → nome nello snapshot di sessione.
    owner: null,

    kind,
    size: footprintOf(c.size),

    // Avatar caricato dall'utente. Validato come nell'originale: solo data URL
    // di immagine, perché le security rules lasciano scrivere su sessions/{code}
    // a qualunque utente autenticato e questo finisce in un attributo src.
    avatar: typeof c.avatarThumb === 'string' && c.avatarThumb.startsWith('data:image/')
      ? c.avatarThumb : null,
    level:   c.level ?? null,
    charId:  c.charId ?? null,
    faction: c.faction ?? 'evil',
    monsterApiIndex: c.monsterApiIndex ?? null,

    // Interruttori del master: non sono "la creatura ha gli HP visibili" ma
    // "il master ha deciso di rivelarli". Servono alla card per accendere il
    // bottone corrispondente, e sono già letti sopra dalla regola di visibilità.
    showHealthHint: c.showHealthHint === true,
    showAC:         c.showAC === true,

    // HP: quando non sono visibili NON escono come numero. Il componente
    // riceve null e il flag, e disegna l'hint al posto della barra.
    hp:       showFullHp ? hpCur : null,
    hpMax:    showFullHp ? hpMax : null,
    temp:     showFullHp ? (c.tempHp ?? 0) : null,
    hpHidden: !showFullHp,
    hint:     showHint ? healthHintText(hpPct) : null,
    hintKey:  showHint ? healthHintKey(hpPct)  : null,

    ac:   acVisible ? rawAc : null,
    init: c.initiative ?? 0,
    insp: c.inspiration === true,
    conds,
    action: c.currentAction ?? '',

    // Un PG a 0 HP non è morto: sta tirando i tiri salvezza contro morte.
    // Creature e famigli a 0 sono fuori combattimento.
    dead: hpCur === 0 && kind !== 'pc',
    deathSaves: deathSaves
      ? { ok: deathSaves.successes ?? 0, ko: deathSaves.failures ?? 0 }
      : null,

    xp,

    // Permessi, calcolati qui una volta sola invece che in ogni componente.
    canEdit:         viewerUid === c.ownerUid || isMaster,
    canEditMaxHp:    isOwnCard || (viewerUid === c.ownerUid && isPet) || (isMaster && (isCreature || isPet)),
    canEditAc:       (viewerUid === c.ownerUid && isPet) || (isMaster && isCreature),
    canUploadAvatar: (viewerUid === c.ownerUid || isMaster) && !!c.charId,
    // Il master concede il level-up a mano solo in modalità milestone, e solo
    // a chi non l'ha già ricevuto.
    canGrantLevelUp: isMaster && c.type === 'player'
                     && (progression.mode ?? 'xp') === 'milestone'
                     && (progression.levelUpGranted ?? {})[c.id] !== true,
    canEndTurn:      isOwnCard || (viewerUid === c.ownerUid && isPet),
    canSetAction:    (viewerUid === c.ownerUid || isMaster) && !isMaster,
    isMine:          isOwnCard,
    isCreature,
    isPet,
    isMaster,
  };
}

/** Comodità: converte una lista intera mantenendo l'ordine di iniziativa. */
export function toCardModels(list, ctx) {
  return list.map((c) => toCardModel(c, ctx));
}
