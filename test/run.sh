#!/bin/bash
# Uso: test/run.sh pagina.html [...]  (senza argomenti: tutte le pagine tranne il campionario)
# Avvia un server statico se serve e apre ogni pagina di test in Chrome headless; legge #summary.
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
curl -s -o /dev/null http://localhost:8000/index.html || { (python3 -m http.server 8000 >/dev/null 2>&1 &); sleep 1; }
pages=("$@"); [ ${#pages[@]} -eq 0 ] && pages=($(cd test && ls *.html | grep -v componenti))
rc=0
for p in "${pages[@]}"; do
  dom=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=8000 --dump-dom "http://localhost:8000/test/$p" 2>/dev/null)
  s=$(echo "$dom" | grep -o '<div id="summary"[^>]*>[^<]*' | sed 's/.*>//')
  echo "$p: ${s:-NESSUN RISULTATO}"
  echo "$dom" | grep -o 'class="t ko">[^<]*' | sed 's/.*>/  FAIL: /'
  case "$s" in "✓"*) ;; *) rc=1;; esac
done
exit $rc
