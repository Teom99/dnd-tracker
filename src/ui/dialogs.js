// Fogli di dialogo "Manuale": al posto di confirm()/prompt() del browser (che non seguono il tema).
// Tutto è una Promise; un solo foglio alla volta (le chiamate successive aspettano in coda).
// Il testo passa SEMPRE da textContent: nomi di personaggi o creature non diventano HTML.
import { icon } from './icons.js';

let _queue = Promise.resolve();
let _epoch = 0;          // closeAllSheets() lo incrementa: i fogli già in coda si risolvono a null senza aprirsi
let _current = null;     // finish() del foglio aperto, se c'è

// Chiude il foglio aperto e scarta quelli in coda (tutti risolti a null): serve quando la sessione finisce
// sotto un foglio ancora aperto (es. espulsione del giocatore mentre conferma un riposo).
export function closeAllSheets() {
  _epoch++;
  _current?.(null);
}

export function openSheet(opts) {
  const epoch = _epoch;
  const run = () => (epoch === _epoch ? _show(opts) : Promise.resolve(null));
  const p = _queue.then(run, run);
  _queue = p.catch(() => {});
  return p;
}

// Per ~300 ms dopo la chiusura un velo trasparente assorbe i clic: il secondo clic di un doppio clic sul
// bottone di conferma non deve arrivare all'elemento che sta sotto (una cella della griglia, un token…).
function _shield() {
  const s = document.createElement('div');
  s.className = 'sheet-dialog-shield';
  s.style.cssText = 'position:fixed;inset:0;z-index:95;background:transparent;';
  document.body.append(s);
  setTimeout(() => s.remove(), 300);
}

function _show({ title, text = '', field = null, buttons = [], cancelId = null }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const uid = 'sd' + Math.random().toString(36).slice(2, 8);

    const veil = document.createElement('div');
    veil.className = 'veil sheet-dialog';
    const frame = document.createElement('div');
    frame.className = 'modal-frame sheet-dialog-frame';
    frame.setAttribute('role', 'dialog');
    frame.setAttribute('aria-modal', 'true');
    frame.setAttribute('aria-labelledby', uid + '-t');

    const head = document.createElement('div');
    head.className = 'ds-heading';
    const h = document.createElement('span');
    h.id = uid + '-t';
    h.textContent = title;
    head.append(h);
    frame.append(head);

    if (text) {
      const p = document.createElement('p');
      p.className = 'sheet-dialog-text';
      p.textContent = text;
      frame.append(p);
    }

    let input = null;
    if (field) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lab = document.createElement('label');
      lab.htmlFor = uid + '-f';
      lab.textContent = field.label ?? '';
      input = document.createElement('input');
      input.type = 'text';
      input.id = uid + '-f';
      input.className = 'input';
      input.value = field.value ?? '';
      if (field.placeholder) input.placeholder = field.placeholder;
      input.maxLength = field.maxLength ?? 60;
      wrap.append(lab, input);
      frame.append(wrap);
    }

    const row = document.createElement('div');
    row.className = 'sheet-dialog-actions';
    const all = [...buttons];
    const cancel = all.find(b => b.id === cancelId) ?? [...all].reverse().find(b => b.kind === 'plain');
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (_current === finish) _current = null;
      document.removeEventListener('keydown', onKey, true);
      veil.remove();
      _shield();
      try { previous?.focus?.(); } catch { /* l'elemento può non esistere più */ }
      resolve(result);
    };

    const els = all.map((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn' + (b.kind === 'primary' ? ' btn--primary' : b.kind === 'danger' ? ' btn--danger btn--solid' : '');
      if (b.icon) el.insertAdjacentHTML('afterbegin', icon(b.icon, { size: 16 }));
      el.append(document.createTextNode(b.label));
      el.addEventListener('click', () => {
        if (b === cancel) { finish(null); return; }
        finish({ id: b.id, value: input ? input.value : null });
      });
      row.append(el);
      return el;
    });
    frame.append(row);
    veil.append(frame);

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); finish(null); return; }
      if (e.key === 'Enter' && input && e.target === input) {
        e.preventDefault();
        const main = all.find(b => b.kind === 'primary') ?? all.find(b => b !== cancel);
        if (main) finish({ id: main.id, value: input.value });
        return;
      }
      if (e.key === 'Tab') {
        const f = [...frame.querySelectorAll('input, button')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (!frame.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    _current = finish;
    document.addEventListener('keydown', onKey, true);
    // Un doppio clic su una voce di menu non deve chiudere subito il foglio appena aperto: il secondo clic cade sul velo
    const openedAt = Date.now();
    veil.addEventListener('click', (e) => { if (e.target === veil && Date.now() - openedAt > 350) finish(null); });

    document.body.append(veil);
    // Foco: sul campo; su un'azione distruttiva su Annulla (un Invio distratto non deve cancellare)
    const danger = all.some(b => b.kind === 'danger');
    const main = els[all.findIndex(b => b.kind === 'primary')] ?? els[0];
    (input ?? (danger ? els[all.indexOf(cancel)] : main) ?? els[0])?.focus();
  });
}

export async function askConfirm({ title, text = '', confirmLabel = 'Conferma', danger = false, cancelLabel = 'Annulla' }) {
  const r = await openSheet({
    title, text,
    buttons: [{ id: 'ok', label: confirmLabel, kind: danger ? 'danger' : 'primary' }, { id: 'no', label: cancelLabel, kind: 'plain' }],
  });
  return r?.id === 'ok';
}

export async function askText({ title, label, value = '', confirmLabel = 'Conferma', cancelLabel = 'Annulla' }) {
  const r = await openSheet({
    title, field: { label, value },
    buttons: [{ id: 'ok', label: confirmLabel, kind: 'primary' }, { id: 'no', label: cancelLabel, kind: 'plain' }],
  });
  const v = (r?.value ?? '').trim();
  return r && v ? v : null;
}

export async function askChoice({ title, text = '', primaryLabel, secondaryLabel, cancelLabel = 'Annulla' }) {
  const r = await openSheet({
    title, text,
    buttons: [
      { id: 'primary', label: primaryLabel, kind: 'primary' },
      { id: 'secondary', label: secondaryLabel, kind: 'plain-action' },
      { id: 'no', label: cancelLabel, kind: 'plain' },
    ],
  });
  return r?.id === 'primary' || r?.id === 'secondary' ? r.id : null;
}
