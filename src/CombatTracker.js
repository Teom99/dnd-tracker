export class CombatTracker {
  constructor(session) {
    this._session = session;
  }

  // Trasforma l'oggetto Firebase {id: data} in array ordinato per iniziativa decrescente.
  sortedCombatants(combatantsObj) {
    if (!combatantsObj) return [];
    return Object.entries(combatantsObj)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.initiative - a.initiative);
  }

  // Avanza al turno successivo in modo atomico (runTransaction).
  // I player KO restano nel turno per i tiri salvezza; le creature KO vengono saltate.
  async nextTurn(combatants) {
    const active = combatants.filter(c => c.hpCurrent > 0 || c.type === 'player');
    await this._session.nextTurnAtomic(active.map(c => c.id));
  }

  async reset() {
    await this._session.setRound(1);
    await this._session.setCurrentTurnId(null);
  }
}
