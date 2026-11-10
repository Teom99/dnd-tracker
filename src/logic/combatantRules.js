// Updater puri per le runTransaction sul nodo combattente (vedi Combatant.js).
// Stanno qui, senza import Firebase, per poterli testare da soli.

// Applica un nuovo HP massimo. Se il combattente era a piena vita ci resta
// (altrimenti chi entra col placeholder 1/1 e poi riceve l'HP max dalla scheda
// si ritrovava a 1 HP su N); se era ferito, gli HP correnti vengono solo
// limitati al nuovo massimo.
// Un combattente inesistente (null) resta inesistente: un `?? 0` qui faceva
// rinascere a 0 HP — cioè morto — un combattente già rimosso dalla sessione.
export function applyMaxHp(current, hp) {
  if (current == null) return current;
  const oldMax  = current.hpMax ?? 1;
  const wasFull = current.hpCurrent == null || current.hpCurrent >= oldMax;
  current.hpMax     = hp;
  current.hpCurrent = wasFull ? hp : Math.min(current.hpCurrent, hp);
  return current;
}

// Aggiorna alcuni campi solo se il combattente esiste ancora. Una `set` su un
// path figlio ricreerebbe un combattente parziale (senza type/ownerUid/HP)
// quando l'id è rimasto in mano a un client dopo la rimozione.
export function applyFields(current, fields) {
  if (current == null) return current;
  return Object.assign(current, fields);
}
