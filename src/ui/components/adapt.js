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
          xp = null, conditionColor = null } = ctx;

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
    // `sub` nel design è "Paladino 5" / "Non morto · GS 1/4". Quei dati NON
    // esistono nel modello: classe e livello stanno nella scheda del
    // personaggio (non nello snapshot di sessione) e le creature non hanno un
    // campo GS. Resta vuoto finché non si decide di portarli nel combattente.
    sub: '',
    // Il kit mostra il nome del giocatore; l'app ha solo l'uid e nessuna mappa
    // uid → nome nello snapshot di sessione.
    owner: null,

    kind,
    size: footprintOf(c.size),

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
    canEdit:      viewerUid === c.ownerUid || isMaster,
    canEditMaxHp: isOwnCard || (viewerUid === c.ownerUid && isPet) || (isMaster && (isCreature || isPet)),
    canEditAc:    (viewerUid === c.ownerUid && isPet) || (isMaster && isCreature),
    isMine:       isOwnCard,
    isMaster,
  };
}

/** Comodità: converte una lista intera mantenendo l'ordine di iniziativa. */
export function toCardModels(list, ctx) {
  return list.map((c) => toCardModel(c, ctx));
}
