// Dadi: vassoio (#dice-pop, markup statico in index.html, contenuto ridisegnato solo dalle
// interazioni col vassoio, mai dal listener di Firebase) e palco del lancio (#dice-stage,
// figlio di <body>, fuori da ogni contenitore che si ricostruisce).
// La logica (tiro, traiettoria, validazione) sta in src/logic/dice.js.
import { DIE_SIDES, MAX_DICE, addDie, removeDie, poolCount, poolLabel, advApplies,
         critKind, rollFormula, restSlots, throwKeyframes,
         DICE_COLORS, colorOwner, myDiceColor, inkFor } from '../logic/dice.js';
import { icon } from './icons.js';

// ── Forme dei dadi (viewBox 100×100): sagoma, spigoli interni, dove sta il numero ──
const pent = (r, cx = 50, cy = 52) => Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

const SHAPES = {
  4:   { body: '<polygon points="50,6 95,88 5,88"/>', facets: '<polyline points="50,6 50,62 95,88"/><line x1="50" y1="62" x2="5" y2="88"/>', ty: 76, fs: 26 },
  6:   { body: '<rect x="9" y="9" width="82" height="82" rx="13"/>', facets: '<rect x="20" y="20" width="60" height="60" rx="7"/>', ty: 62, fs: 34 },
  8:   { body: '<polygon points="50,3 95,50 50,97 5,50"/>', facets: '<polygon points="50,18 80,62 20,62"/>', ty: 56, fs: 26 },
  10:  { body: '<polygon points="50,3 95,40 50,97 5,40"/>', facets: '<polyline points="5,40 50,58 95,40"/><line x1="50" y1="3" x2="50" y2="58"/>', ty: 50, fs: 24 },
  12:  { body: `<polygon points="${pent(47)}"/>`, facets: `<polygon points="${pent(25)}"/>`, ty: 63, fs: 26 },
  20:  { body: '<polygon points="50,3 92,26 92,74 50,97 8,74 8,26"/>', facets: '<polygon points="50,24 77,70 23,70"/><polyline points="8,26 23,70 8,74"/><polyline points="92,26 77,70 92,74"/><polyline points="50,3 50,24"/><polyline points="23,70 50,97 77,70"/>', ty: 62, fs: 24 },
  100: { body: '<polygon points="50,3 95,40 50,97 5,40"/>', facets: '<polyline points="5,40 50,58 95,40"/><line x1="50" y1="3" x2="50" y2="58"/>', ty: 50, fs: 19 },
};

function dieSvg(sides, value, cls = '') {
  const sh = SHAPES[sides];
  return `<svg class="die-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <g class="die-body-shape">${sh.body}</g><g class="die-facets">${sh.facets}</g>
    <text class="die-num" x="50" y="${sh.ty}" font-size="${sh.fs}" text-anchor="middle">${value}</text></svg>`;
}

// ══════════════════════════════════════════
//  VASSOIO
// ══════════════════════════════════════════
const tray = { pool: {}, mod: 0, adv: 'normal' };
let _onRoll = null;
let _onPickColor = null;
let _colors = {};          // sessions/{code}/diceColors
let _myUid = null;

// Colore e inchiostro come variabili CSS: il dado le legge (styles/dice.css), senza colore resta "carta"
function paintVars(el, color) {
  if (color) {
    el.style.setProperty('--die-fill', color);
    el.style.setProperty('--die-ink', inkFor(color));
  } else {
    el.style.removeProperty('--die-fill');
    el.style.removeProperty('--die-ink');
  }
}

// Dal listener di sessione: tocca solo la riga dei colori, mai il resto del vassoio (campo modificatore compreso)
export function setColors(colors, myUid) {
  _colors = colors || {};
  _myUid = myUid;
  _renderColors();
}

function _renderColors() {
  const pop = document.getElementById('dice-pop');
  const box = pop?.querySelector('.dice-colors');
  if (!box) return;
  const mine = myDiceColor(_colors, _myUid);
  paintVars(pop, mine);
  box.innerHTML = DICE_COLORS.map((c, i) => {
    const owner = colorOwner(_colors, c, _myUid);
    const isMine = c === mine;
    const name = owner ? (_colors[owner]?.name || 'un altro giocatore') : '';
    const label = isMine ? 'Il tuo colore · tocca per lasciarlo' : owner ? `Scelto da ${name}` : 'Scegli questo colore';
    return `<button type="button" class="dice-swatch${isMine ? ' mine' : ''}${owner ? ' taken' : ''}" data-color="${c}"
      style="--sw:${c};--sw-ink:${inkFor(c)}" aria-pressed="${isMine}" aria-label="Colore ${i + 1}: ${escAttr(label)}" title="${escAttr(label)}"${owner ? ' disabled' : ''}>
      ${isMine ? icon('check', { size: 14 }) : owner ? icon('lock', { size: 13 }) : ''}</button>`;
  }).join('');
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ADV_LABELS = { normal: 'Normale', adv: 'Vantaggio', dis: 'Svantaggio' };

export function renderTray() {
  const el = document.getElementById('dice-pop');
  if (!el) return;
  const n = poolCount(tray.pool);
  const advOk = advApplies(tray.pool);
  if (!advOk) tray.adv = 'normal';
  const label = poolLabel(tray.pool, tray.mod);
  el.innerHTML = `
    <div class="pop-head">
      <h4 class="rule-head">${icon('d20', { size: 16 })} Dadi</h4>
      <button type="button" class="btn btn--ghost btn--sm btn--icon" data-dice="close" aria-label="Chiudi dadi" title="Chiudi">${icon('close', { size: 16 })}</button>
    </div>
    <div class="dice-picks" role="group" aria-label="Aggiungi un dado">
      ${DIE_SIDES.map(s => {
        const c = tray.pool[s] || 0;
        return `<button type="button" class="dice-pick${c ? ' on' : ''}" data-die="${s}" aria-label="Aggiungi d${s}" title="Aggiungi d${s} · clic destro per toglierlo"${n >= MAX_DICE ? ' disabled' : ''}>
          ${dieSvg(s, s === 100 ? '%' : s)}<span class="dice-pick-lbl">d${s}</span>${c ? `<span class="dice-count">${c}</span>` : ''}
        </button>`;
      }).join('')}
    </div>
    <div class="dice-pool" aria-live="polite">
      ${n ? DIE_SIDES.filter(s => tray.pool[s]).map(s =>
        `<button type="button" class="chip dice-chip" data-remove="${s}" title="Togli un d${s}" aria-label="Togli un d${s}">${tray.pool[s]}d${s} ${icon('close', { size: 12 })}</button>`).join('')
        : '<span class="empty-hint">Tocca un dado per metterlo nel vassoio</span>'}
    </div>
    <div class="dice-row">
      <span class="opt-lbl">Modificatore</span>
      <button type="button" class="btn btn--sm btn--icon" data-mod="-1" aria-label="Modificatore meno uno" title="−1">${icon('minus', { size: 14 })}</button>
      <input type="number" id="dice-mod" class="input input--sm input--num" value="${tray.mod}" min="-99" max="99" aria-label="Modificatore">
      <button type="button" class="btn btn--sm btn--icon" data-mod="1" aria-label="Modificatore più uno" title="+1">${icon('plus', { size: 14 })}</button>
    </div>
    <div class="dice-adv seg" role="radiogroup" aria-label="Vantaggio">
      ${Object.entries(ADV_LABELS).map(([k, l]) =>
        `<button type="button" class="seg-btn${tray.adv === k ? ' on' : ''}" data-adv="${k}" role="radio" aria-checked="${tray.adv === k}"${advOk || k === 'normal' ? '' : ' disabled'}>${l}</button>`).join('')}
    </div>
    <div class="dice-color-row">
      <span class="opt-lbl">Colore dei tuoi dadi</span>
      <div class="dice-colors" role="group" aria-label="Colore dei tuoi dadi"></div>
    </div>
    <div class="dice-foot">
      <button type="button" class="btn btn--ghost btn--sm" data-dice="clear"${n ? '' : ' disabled'}>Svuota</button>
      <button type="button" class="btn btn--roll grow" data-dice="roll"${n ? '' : ' disabled'}>${icon('d20', { size: 18 })}<span class="lbl">${n ? `Tira ${label}` : 'Tira'}</span></button>
    </div>`;
  _renderColors();
}

export function initTray({ onRoll, onPickColor }) {
  _onRoll = onRoll;
  _onPickColor = onPickColor;
  const el = document.getElementById('dice-pop');
  if (!el || el._diceBound) return;
  el._diceBound = true;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.color) {
      // Il proprio colore si lascia ritoccandolo; quelli degli altri sono disabilitati
      const c = b.dataset.color;
      _onPickColor?.(c === myDiceColor(_colors, _myUid) ? null : c);
      return;
    }
    if (b.dataset.die) tray.pool = addDie(tray.pool, Number(b.dataset.die));
    else if (b.dataset.remove) tray.pool = removeDie(tray.pool, Number(b.dataset.remove));
    else if (b.dataset.mod) tray.mod = Math.max(-99, Math.min(99, tray.mod + Number(b.dataset.mod)));
    else if (b.dataset.adv) tray.adv = b.dataset.adv;
    else if (b.dataset.dice === 'clear') { tray.pool = {}; tray.mod = 0; tray.adv = 'normal'; }
    else if (b.dataset.dice === 'roll') { _onRoll?.({ ...tray, pool: { ...tray.pool } }); return; }
    else return;   // "close" lo gestisce CombatChrome
    renderTray();
  });
  el.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-die]');
    if (!b) return;
    e.preventDefault();
    tray.pool = removeDie(tray.pool, Number(b.dataset.die));
    renderTray();
  });
  // Il campo non si ridisegna mentre si scrive: aggiorna solo lo stato e l'etichetta di "Tira"
  el.addEventListener('input', (e) => {
    if (e.target.id !== 'dice-mod') return;
    tray.mod = Math.max(-99, Math.min(99, Math.trunc(Number(e.target.value) || 0)));
    const lbl = el.querySelector('[data-dice="roll"] .lbl');
    if (lbl && poolCount(tray.pool)) lbl.textContent = `Tira ${poolLabel(tray.pool, tray.mod)}`;
  });
  renderTray();
}

// ══════════════════════════════════════════
//  PALCO DEL LANCIO
// ══════════════════════════════════════════
const FLIGHT_MS = 1500;
const STAGGER_MS = 75;
const HOLD_MS = 2600;      // quanto resta il risultato dopo che l'ultimo dado si è fermato
const MAX_QUEUE = 3;

let _queue = [];
let _playing = null;       // { cancel() }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function stage() {
  let el = document.getElementById('dice-stage');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dice-stage';
    el.className = 'dice-stage';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

// Accoda un tiro (proprio o di un altro giocatore). Se ne arrivano tanti insieme si tengono gli ultimi.
export function play(roll, actor) {
  if (!roll?.dice?.length) return;
  _queue.push({ roll, actor });
  if (_queue.length > MAX_QUEUE) _queue = _queue.slice(-MAX_QUEUE);
  if (!_playing) _next();
}

// Uscita dalla sessione: ferma tutto e pulisce il palco
export function stop() {
  _queue = [];
  _playing?.cancel();
  _playing = null;
  const el = document.getElementById('dice-stage');
  if (el) { el.innerHTML = ''; el.className = 'dice-stage'; }
}

function _next() {
  const item = _queue.shift();
  if (!item) { _playing = null; return; }
  _playing = _run(item.roll, item.actor, () => { _playing = null; _next(); });
}

function _run(roll, actor, done) {
  const st = stage();
  st.innerHTML = '';
  const ck = critKind(roll);
  st.className = `dice-stage show${ck ? ` is-${ck}` : ''}`;
  const W = st.clientWidth || window.innerWidth;
  const H = st.clientHeight || window.innerHeight;
  const size = W < 600 ? 54 : 70;
  const lift = Math.min(220, H * 0.28);
  const still = reducedMotion();

  const timers = [];
  const anims = [];
  let cancelled = false;
  const later = (fn, ms) => timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms));

  const slots = restSlots(roll.dice.length, W < 600 ? 4 : 6);
  roll.dice.forEach((d, i) => {
    const wrap = document.createElement('div');
    wrap.className = `die die-d${d.s}${d.drop ? ' is-drop' : ''}`;
    wrap.style.setProperty('--die', `${size}px`);
    if (roll.color) paintVars(wrap, roll.color);
    wrap.innerHTML = `<div class="die-shadow"></div><div class="die-body">${dieSvg(d.s, '?')}</div>`;
    st.appendChild(wrap);
    const body = wrap.querySelector('.die-body');
    const shadow = wrap.querySelector('.die-shadow');
    const num = wrap.querySelector('.die-num');
    const px = (fx) => fx * W - size / 2;
    const py = (fy) => fy * H - size / 2;
    const delay = i * STAGGER_MS;
    let landed = false;
    const showFinal = () => {
      landed = true;
      num.textContent = d.v;
      wrap.classList.add('landed');
      if (d.s === 20 && !d.drop && (d.v === 20 || d.v === 1)) wrap.classList.add(d.v === 20 ? 'nat20' : 'nat1');
    };

    if (still) {
      wrap.style.transform = `translate(${px(slots[i].x)}px, ${py(slots[i].y)}px)`;
      later(showFinal, 60);
      return;
    }

    const kf = throwKeyframes(slots[i]);
    const opts = { duration: FLIGHT_MS, delay, fill: 'both' };
    // Il percorso sul tavolo è già "frenato" nei keyframe: tra un punto e l'altro va dritto
    anims.push(wrap.animate(kf.map(k => ({ offset: k.t, transform: `translate(${px(k.x)}px, ${py(k.y)}px)` })), { ...opts, easing: 'linear' }));
    // In aria: sale frenando, ricade accelerando — la forma di un rimbalzo vero
    anims.push(body.animate(kf.map(k => ({
      offset: k.t,
      transform: `translateY(${-k.z * lift}px) rotate(${k.rot}deg) scale(${2 - k.sq}, ${k.sq})`,
      easing: k.z > 0 ? 'cubic-bezier(.55,0,1,.45)' : 'cubic-bezier(0,.55,.45,1)',
    })), opts));
    // L'ombra resta a terra: più piccola e chiara quando il dado è in alto
    anims.push(shadow.animate(kf.map(k => ({
      offset: k.t,
      transform: `scale(${1 - k.z * 0.65})`,
      opacity: 0.55 - k.z * 0.45,
      easing: k.z > 0 ? 'cubic-bezier(.55,0,1,.45)' : 'cubic-bezier(0,.55,.45,1)',
    })), opts));

    // Facce che girano in volo, sempre più lente; il numero vero compare all'ultimo rimbalzo
    let tick = 55;
    const spinFace = () => {
      if (landed) return;
      num.textContent = 1 + Math.floor(Math.random() * d.s);
      tick *= 1.13;
      if (tick < 260) later(spinFace, tick);
    };
    later(spinFace, delay + 40);
    later(showFinal, delay + FLIGHT_MS * 0.84);
  });

  // Totale, dopo che l'ultimo dado si è posato
  const settle = still ? 120 : (roll.dice.length - 1) * STAGGER_MS + FLIGHT_MS + 40;
  later(() => _showTotal(st, roll, actor, ck, still), settle);
  later(() => st.classList.add('leaving'), settle + HOLD_MS);
  later(() => { st.innerHTML = ''; st.className = 'dice-stage'; done(); }, settle + HOLD_MS + 380);

  return {
    cancel() {
      cancelled = true;
      timers.forEach(clearTimeout);
      anims.forEach(a => a.cancel());
    },
    // Clic sul risultato: chiude subito e passa al prossimo tiro in coda
    skip() {
      this.cancel();
      st.innerHTML = '';
      st.className = 'dice-stage';
      done();
    },
  };
}

function _showTotal(st, roll, actor, ck, still) {
  const box = document.createElement('button');
  box.type = 'button';
  box.className = 'dice-total';
  box.title = 'Chiudi';
  const who = document.createElement('span');
  who.className = 'dice-who';
  who.textContent = actor || 'Qualcuno';            // nome dai dati: sempre testo
  const formula = document.createElement('span');
  formula.className = 'dice-formula';
  formula.textContent = rollFormula(roll);
  const num = document.createElement('span');
  num.className = 'dice-sum';
  num.textContent = still ? roll.total : '0';
  box.append(who, num, formula);
  if (ck) {
    const tag = document.createElement('span');
    tag.className = 'dice-tag';
    tag.textContent = ck === 'crit' ? 'Critico!' : 'Fallimento critico';
    box.append(tag);
  }
  box.addEventListener('click', () => _playing?.skip());
  st.appendChild(box);
  if (ck === 'crit' && !still) {
    const burst = document.createElement('div');
    burst.className = 'dice-burst';
    st.appendChild(burst);
  }
  if (still) return;
  // Il totale conta fino al valore, rapido e con frenata
  const t0 = performance.now(), dur = 520, target = roll.total;
  const step = (now) => {
    if (!box.isConnected) return;
    const p = Math.min(1, (now - t0) / dur);
    num.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // Con la scheda in background rAF si ferma: il valore giusto arriva comunque
  setTimeout(() => { if (box.isConnected) num.textContent = target; }, dur + 60);
}
