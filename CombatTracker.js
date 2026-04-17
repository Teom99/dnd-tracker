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

  // Avanza al turno successivo. Se currentTurnId è null, parte dal primo combattente.
  async nextTurn(combatants, currentTurnId, currentRound) {
    if (combatants.length === 0) return;

    const currentIndex = combatants.findIndex(c => c.id === currentTurnId);

    if (currentIndex === -1) {
      await this._session.setCurrentTurnId(combatants[0].id);
      return;
    }

    const nextIndex = (currentIndex + 1) % combatants.length;
    if (nextIndex === 0) {
      await this._session.setRound(currentRound + 1);
    }
    await this._session.setCurrentTurnId(combatants[nextIndex].id);
  }

  async reset() {
    await this._session.setRound(1);
    await this._session.setCurrentTurnId(null);
  }
}
