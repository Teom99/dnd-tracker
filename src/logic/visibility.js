// Cosa può vedere e modificare ciascun utente di ciascun combattente. Una
// sola fonte per la card (UI.renderCombatantList) e per la riga dell'iniziativa
// (GridUI.renderInitiativeList): prima le regole stavano dentro il renderer
// della card e un secondo renderer le avrebbe duplicate. Nessun accesso al DOM.

export function combatantView(c, myUid, masterUid, acMap = {}) {
  const isMaster   = myUid === masterUid;
  const isCreature = c.type === 'creature';
  const isPet      = c.type === 'pet';
  const isOwnCard  = myUid === c.ownerUid && c.type === 'player';
  const isOwnPet   = myUid === c.ownerUid && isPet;
  return {
    isMaster, isCreature, isPet, isOwnCard, isOwnPet,
    canEdit:      myUid === c.ownerUid || myUid === masterUid,
    showFullHp:   isMaster || isOwnCard || !isCreature,
    showHint:     !isOwnCard && !isMaster && isCreature && !!c.showHealthHint,
    canEditMaxHp: isOwnCard || isOwnPet || (isMaster && (isCreature || isPet)),
    canEditAc:    isOwnPet || (isMaster && isCreature),
    ac:           isPet ? (c.armorClass ?? null) : (acMap[c.ownerUid] ?? c.armorClass ?? null),
    acVisible:    !isCreature || isMaster || (c.showAC === true),
  };
}

// Barra della vita con i PV temporanei: verde = vita attuale, azzurro = PV temporanei ancorati
// all'estremità destra. La scala è HP max, e si allarga solo se vita + temporanei la superano:
// così l'azzurro non copre mai la vita. Frazioni 0..1 della barra. Card, dock e iniziativa usano questo.
export function hpBarSegments(hpCurrent, hpMax, tempHp) {
  const n = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
  const hp = n(hpCurrent), max = n(hpMax), temp = n(tempHp);
  const scale = Math.max(max, hp + temp);
  if (scale <= 0) return { hp: 0, temp: 0 };
  return { hp: Math.min(1, hp / scale), temp: temp / scale };
}

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
