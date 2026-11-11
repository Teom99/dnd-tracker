// Updater puri per le runTransaction sul nodo combattente (vedi Combatant.js).
// Stanno qui, senza import Firebase, per poterli testare da soli.

// Applica un nuovo HP massimo.
// - Chi entra in sessione prima che la scheda abbia detto il suo HP max viene
//   creato col segnaposto 1/1 e hpPending: alla prima sincronizzazione parte a
//   piena vita (altrimenti restava a 1 HP su N). Il segnaposto vale una volta.
// - In ogni altro caso gli HP correnti vengono solo limitati al nuovo massimo:
//   alzare il massimo non cura mai (né abbassarlo e rialzarlo).
// Un combattente inesistente (null) resta inesistente: un `?? 0` qui faceva
// rinascere a 0 HP — cioè morto — un combattente già rimosso dalla sessione.
export function applyMaxHp(current, hp) {
  if (current == null) return current;
  const fresh = current.hpPending === true || current.hpCurrent == null;
  current.hpMax     = hp;
  current.hpCurrent = fresh ? hp : Math.min(current.hpCurrent, hp);
  current.hpPending = null;
  return current;
}

// Aggiorna alcuni campi solo se il combattente esiste ancora. Una `set` su un
// path figlio ricreerebbe un combattente parziale (senza type/ownerUid/HP)
// quando l'id è rimasto in mano a un client dopo la rimozione.
export function applyFields(current, fields) {
  if (current == null) return current;
  return Object.assign(current, fields);
}

// Updater della transazione "Fine turno". `expectedTurnId` è il turno che chi clicca vedeva: se nel frattempo è
// già cambiato (doppio clic, due client) la transazione si annulla restituendo undefined, invece di avanzare di due.
// Con expectedTurnId === undefined si avanza comunque (compatibilità).
export function applyNextTurn(session, aliveIds, expectedTurnId) {
  if (session == null) return session;
  const currentId = session.currentTurnId ?? null;
  if (expectedTurnId !== undefined && currentId !== expectedTurnId) return undefined;
  const currentIndex = aliveIds.indexOf(currentId);
  if (currentIndex === -1) {
    session.currentTurnId = aliveIds[0];
    return session;
  }
  const nextIndex = (currentIndex + 1) % aliveIds.length;
  if (nextIndex === 0) session.round = (session.round ?? 1) + 1;
  session.currentTurnId = aliveIds[nextIndex];
  return session;
}
