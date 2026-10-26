/* Lista di FightCard per UN contenitore <ol> esistente (#creature-list o #player-list).

   Perché non si usa CombatantList del kit
   Quel componente disegna la propria barra filtri e raggruppa internamente
   giocatori e creature in due sezioni. L'app ha invece due <ol> separati, già
   in due sezioni con le loro intestazioni: montarlo due volte darebbe due
   barre filtri e un doppio raggruppamento. CombatantList resta nel repo e
   diventerà utile quando si ristrutturerà la colonna destra — che è un passo
   a sé, non questo.

   Qui vive lo stato che in UI.js stava in variabili di modulo solo per
   sopravvivere alla distruzione del DOM a ogni snapshot Firebase:
   quale carta è aperta (_activeInlineEdit) e quali bersagli sono selezionati
   (_selectedTargets). Adesso il DOM persiste, quindi è normale stato locale. */
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { FightCard } from './FightCard.js';

export function CardList({ combatants, activeId, allCombatants, emptyText, handlers = {} }) {
  const [openId, setOpenId] = useState(null);
  const [targetsByCard, setTargetsByCard] = useState({});

  if (!combatants.length) {
    return html`<li class="cl__empty">${emptyText}</li>`;
  }

  const toggleTarget = (cardId, targetId) => {
    setTargetsByCard((prev) => {
      const cur = prev[cardId] ?? [];
      return { ...prev,
        [cardId]: cur.includes(targetId) ? cur.filter((x) => x !== targetId) : [...cur, targetId] };
    });
  };

  // Bersagli proponibili: sé stesso più chiunque sia ancora in piedi. Stessa
  // regola dell'originale — i PG e i famigli restano selezionabili anche a 0 HP
  // (si curano), le creature a 0 no.
  const targetsFor = (c) => [
    { id: c.id, label: 'Sé stesso' },
    ...allCombatants
      .filter((x) => x.id !== c.id && (!x.dead || x.kind === 'pc'))
      .map((x) => ({ id: x.id, label: x.short })),
  ];

  // Ripulisce le selezioni che puntano a combattenti non più validi, altrimenti
  // un bersaglio rimosso dalla sessione resterebbe selezionato per sempre.
  const validIds = new Set(allCombatants.map((x) => x.id));

  return combatants.map((c) => {
    const sel = (targetsByCard[c.id] ?? []).filter((id) => validIds.has(id));
    return html`<${FightCard}
      key=${c.id}
      c=${c}
      isActive=${c.id === activeId}
      open=${openId === c.id}
      targets=${targetsFor(c)}
      selectedTargets=${sel}
      onToggle=${(id) => setOpenId(openId === id ? null : id)}
      onToggleTarget=${toggleTarget}
      ...${handlers} />`;
  });
}
