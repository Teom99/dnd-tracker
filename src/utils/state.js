export const state = {
  db:                     null,
  auth:                   null,
  session:                null,
  combatantManager:       null,
  tracker:                null,
  myUid:                  null,
  myCombatantId:          null,
  myCurrentCharId:        null,
  snapshot:               null,
  sheet:                  null,
  sheetData:              null,
  acMap:                  {},
  lastKnownHp:            null,
  seenLogIds:             null, // Set<string> | null — null finché non è stato processato il primo snapshot di logs
  library:                null,
  selectedJoinCharId:     null,
  selectedCreatureCharId: null,
  sheetReturnView:        'view-combat',
  selectedGridTokenId:    null,
  selectedDockId:         null,
  gridEditMode:           false,
  templatePlacingShape:   null,  // 'circle' | 'cone' | 'line' mentre si sta piazzando un template area
  templateOrigin:         null,  // { col, row } una volta fissata l'origine, in attesa della conferma
  drawMode:               false, // true quando la modalità "disegna sulla mappa" è attiva
  drawColor:              '#e74c3c', // colore correntemente selezionato per il disegno; null = gomma
  ship:                   null,
  shipData:               null,
  shipPanelOpen:          false,
  _selectedShipToken:     null,
};
