/* Lanterna — Aspetto: applica data-palette / data-ornament / data-typeface su <html> e li persiste in localStorage.
   Classic script, nessuna dipendenza. Ogni pulsante con data-set="asse:valore" (es. data-set="palette:ambra") agisce da solo. */
(function () {
  var KEY = 'lanterna.aspetto', root = document.documentElement;
  var DEF = { palette: 'cenere', ornament: 'standard', typeface: 'cormorant' };
  var s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
  function sync() {
    var btns = document.querySelectorAll('[data-set]');
    for (var i = 0; i < btns.length; i++) {
      var p = btns[i].getAttribute('data-set').split(':');
      var on = (s[p[0]] || DEF[p[0]]) === p[1];
      btns[i].classList.toggle('is-on', on); btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  function apply() { for (var k in DEF) root.setAttribute('data-' + k, s[k] || DEF[k]); sync(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-set]') : null; if (!b) return;
    var p = b.getAttribute('data-set').split(':'); s[p[0]] = p[1];
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (err) { /* privato: resta in memoria */ }
    apply();
  });
  apply();
})();
