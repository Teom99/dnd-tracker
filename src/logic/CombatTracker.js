import { safeCombatant } from '../utils/sanitize.js';

export class CombatTracker {
  constructor(session) {
    this._session = session;
  }

  // Trasforma l'oggetto Firebase {id: data} in array ordinato per iniziativa decrescente.
  sortedCombatants(combatantsObj) {
    if (!combatantsObj) return [];
    // safeCombatant: id nella forma delle push-key e campi numerici davvero numerici
    // (le rules permettono a chiunque di scrivere qui; questo array finisce in HTML)
    return Object.entries(combatantsObj)
      .map(([id, data]) => safeCombatant({ ...data, id }))
      .filter(Boolean)
      .sort((a, b) => b.initiative - a.initiative);
  }

  // Avanza al turno successivo in modo atomico (runTransaction).
  // I player KO restano nel turno per i tiri salvezza; le creature KO vengono saltate.
  async nextTurn(combatants) {
    const active = combatants.filter(c => c.hpCurrent > 0 || c.type === 'player');
    await this._session.nextTurnAtomic(active.map(c => c.id));
    // Le traiettorie durano un turno: si cancellano qui, da un'azione utente (mai dal listener)
    await this._session.clearAllTrajectories();
  }

  async reset() {
    await this._session.setRound(1);
    await this._session.setCurrentTurnId(null);
    await this._session.clearAllTrajectories();
  }
}
