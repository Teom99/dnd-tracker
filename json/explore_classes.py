#!/usr/bin/env python3
"""
Esploratore interattivo di classes.json per D&D 5e.
Uso: python3 explore_classes.py [classe] [livello]
"""

import json
import sys
import textwrap
from pathlib import Path

DATA_PATH = Path(__file__).parent / 'classes.json'

ORDINAL_TO_INT = {
    '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5,
    '6th': 6, '7th': 7, '8th': 8, '9th': 9, '10th': 10,
    '11th': 11, '12th': 12, '13th': 13, '14th': 14, '15th': 15,
    '16th': 16, '17th': 17, '18th': 18, '19th': 19, '20th': 20,
}

SPELL_LEVEL_COLS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

# ─── Helpers ─────────────────────────────────────────────────────────────────

def load():
    return json.loads(DATA_PATH.read_text())

def find_table(cls_data):
    """Restituisce (table_key, table_dict) dalla sezione Class Features."""
    for k, v in cls_data.get('Class Features', {}).items():
        if isinstance(v, dict) and 'table' in v:
            return k, v['table']
    return None, None

def level_row(table, level_int):
    """Estrae la riga della tabella per un dato livello (intero 1-20)."""
    levels = table.get('Level', [])
    row = {}
    for col, values in table.items():
        if col == 'Level':
            continue
        idx = next((i for i, lv in enumerate(levels) if ORDINAL_TO_INT.get(lv) == level_int), None)
        row[col] = values[idx] if idx is not None and idx < len(values) else '—'
    return row

def features_at_level(table, level_int):
    """Lista di feature guadagnate a questo livello."""
    levels = table.get('Level', [])
    feats_col = table.get('Features', [])
    idx = next((i for i, lv in enumerate(levels) if ORDINAL_TO_INT.get(lv) == level_int), None)
    if idx is None or idx >= len(feats_col):
        return []
    raw = feats_col[idx]
    if raw == '-' or not raw:
        return []
    return [f.strip() for f in raw.split(',')]

def render_content(content, indent=2):
    """Stampa ricorsivamente il contenuto di una feature."""
    pad = ' ' * indent
    if isinstance(content, str):
        for line in textwrap.wrap(content, width=90):
            print(pad + line)
    elif isinstance(content, list):
        for item in content:
            if isinstance(item, list):
                for sub in item:
                    print(pad + '  • ' + sub)
            else:
                print(pad + '• ' + str(item))

def render_feature(name, feat_data, indent=2):
    pad = ' ' * indent
    print(f'\n{pad}◆ {name}')
    if isinstance(feat_data, str):
        render_content(feat_data, indent + 2)
        return
    if not isinstance(feat_data, dict):
        return
    content = feat_data.get('content')
    if content:
        render_content(content, indent + 2)
    for k, v in feat_data.items():
        if k == 'content':
            continue
        if isinstance(v, dict):
            render_feature(k, v, indent + 2)
        elif isinstance(v, str) and v:
            print(f'{pad}  {k}: {v}')

# ─── Comandi ─────────────────────────────────────────────────────────────────

def cmd_list(data):
    """Elenca tutte le classi disponibili."""
    print('\nClassi disponibili:')
    for i, cls in enumerate(sorted(data.keys()), 1):
        print(f'  {i:2}. {cls}')

def cmd_table(data, cls_name):
    """Mostra la tabella completa di una classe."""
    cls_data = data.get(cls_name)
    if not cls_data:
        print(f'Classe "{cls_name}" non trovata.')
        return
    _, table = find_table(cls_data)
    if not table:
        print('Nessuna tabella trovata.')
        return

    levels = table.get('Level', [])
    cols = [c for c in table.keys() if c != 'Level']

    # Calcola larghezze colonne
    widths = {c: max(len(c), max(len(str(v)) for v in table[c])) for c in cols}
    header = f"{'Lv':5} | " + ' | '.join(f'{c:{widths[c]}}' for c in cols)
    sep = '-' * len(header)

    print(f'\n=== {cls_name} ===')
    print(header)
    print(sep)
    for i, lv in enumerate(levels):
        row_vals = []
        for c in cols:
            val = table[c][i] if i < len(table[c]) else '—'
            row_vals.append(f'{str(val):{widths[c]}}')
        print(f'{lv:5} | ' + ' | '.join(row_vals))

def cmd_level(data, cls_name, level_int):
    """Mostra tutto ciò che si guadagna a un dato livello."""
    cls_data = data.get(cls_name)
    if not cls_data:
        print(f'Classe "{cls_name}" non trovata.')
        return

    _, table = find_table(cls_data)
    if not table:
        print('Nessuna tabella trovata.')
        return

    row = level_row(table, level_int)
    feats = features_at_level(table, level_int)
    cf = cls_data['Class Features']

    print(f'\n╔══ {cls_name} — Livello {level_int} ══╗')

    # Statistiche tabella (escludi Features)
    print('\n  Statistiche:')
    for k, v in row.items():
        if k == 'Features':
            continue
        is_spell_slot = k in SPELL_LEVEL_COLS
        label = f'Slot liv.{k}' if is_spell_slot else k
        print(f'    {label}: {v}')

    # Feature guadagnate
    if feats:
        print('\n  Feature guadagnate:')
        for feat_name in feats:
            feat_data = cf.get(feat_name)
            if feat_data:
                render_feature(feat_name, feat_data)
            else:
                print(f'    ◆ {feat_name}')
    else:
        print('\n  Nessuna feature nuova a questo livello.')

def cmd_feature(data, cls_name, feat_name):
    """Mostra il dettaglio di una singola feature."""
    cls_data = data.get(cls_name)
    if not cls_data:
        print(f'Classe "{cls_name}" non trovata.')
        return
    cf = cls_data['Class Features']
    feat = cf.get(feat_name)
    if feat is None:
        # Ricerca case-insensitive parziale
        matches = [k for k in cf if feat_name.lower() in k.lower()]
        if not matches:
            print(f'Feature "{feat_name}" non trovata in {cls_name}.')
            return
        if len(matches) == 1:
            feat_name = matches[0]
            feat = cf[feat_name]
        else:
            print(f'Feature ambigua, possibili: {matches}')
            return
    render_feature(feat_name, feat if isinstance(feat, dict) else {'content': str(feat)})

def cmd_levelup(data, cls_name, from_level, to_level):
    """Mostra le differenze tra due livelli (cosa si guadagna al level up)."""
    print(f'\n🎲 Level Up: {cls_name} {from_level} → {to_level}')
    print('=' * 50)

    cls_data = data.get(cls_name)
    if not cls_data:
        print(f'Classe "{cls_name}" non trovata.')
        return

    _, table = find_table(cls_data)
    if not table:
        return

    cf = cls_data['Class Features']
    row_old = level_row(table, from_level)
    row_new = level_row(table, to_level)

    # Mostra variazioni nelle stat della tabella
    print('\n  Variazioni statistiche:')
    changed = False
    for k in row_new:
        if k == 'Features':
            continue
        old_v = row_old.get(k, '—')
        new_v = row_new.get(k, '—')
        if old_v != new_v:
            is_slot = k in SPELL_LEVEL_COLS
            label = f'Slot liv.{k}' if is_slot else k
            print(f'    {label}: {old_v} → {new_v}')
            changed = True
    if not changed:
        print('    (nessuna variazione nelle stat di tabella)')

    # Feature nuove
    feats = features_at_level(table, to_level)
    if feats:
        print(f'\n  Nuove feature al livello {to_level}:')
        for feat_name in feats:
            feat_data = cf.get(feat_name)
            if feat_data:
                render_feature(feat_name, feat_data)
            else:
                print(f'    ◆ {feat_name}')
    else:
        print(f'\n  Nessuna feature nuova al livello {to_level}.')

    # HP guadagnati (formula standard)
    hp_info = cf.get('Hit Points', {}).get('content', [])
    hit_die = next((s for s in (hp_info if isinstance(hp_info, list) else []) if 'Hit Dice' in s), None)
    if hit_die:
        import re
        m = re.search(r'(d\d+)', hit_die)
        die = m.group(1) if m else '?'
        print(f'\n  HP: tira {die} (o prendi la metà +1) + mod. COS')

# ─── CLI ─────────────────────────────────────────────────────────────────────

def fuzzy_class(data, name):
    """Trova la classe con match case-insensitive parziale."""
    name_l = name.lower()
    exact = next((k for k in data if k.lower() == name_l), None)
    if exact:
        return exact
    matches = [k for k in data if k.lower().startswith(name_l)]
    if len(matches) == 1:
        return matches[0]
    matches2 = [k for k in data if name_l in k.lower()]
    if len(matches2) == 1:
        return matches2[0]
    return None

def usage():
    print("""
Uso:
  python3 explore_classes.py list
  python3 explore_classes.py table  <classe>
  python3 explore_classes.py level  <classe> <livello>
  python3 explore_classes.py feat   <classe> "<nome feature>"
  python3 explore_classes.py levelup <classe> <da> <a>

Esempi:
  python3 explore_classes.py list
  python3 explore_classes.py table wizard
  python3 explore_classes.py level barbarian 5
  python3 explore_classes.py feat wizard "Arcane Recovery"
  python3 explore_classes.py levelup fighter 3 4
""")

def main():
    data = load()
    args = sys.argv[1:]

    if not args or args[0] in ('-h', '--help', 'help'):
        usage()
        return

    cmd = args[0].lower()

    if cmd == 'list':
        cmd_list(data)
        return

    if cmd == 'table':
        if len(args) < 2:
            print('Specifica una classe. Es: python3 explore_classes.py table wizard')
            return
        cls = fuzzy_class(data, args[1])
        if not cls:
            print(f'Classe non trovata: {args[1]}')
            cmd_list(data)
            return
        cmd_table(data, cls)
        return

    if cmd == 'level':
        if len(args) < 3:
            print('Es: python3 explore_classes.py level barbarian 5')
            return
        cls = fuzzy_class(data, args[1])
        if not cls:
            print(f'Classe non trovata: {args[1]}')
            return
        try:
            lv = int(args[2])
        except ValueError:
            print('Il livello deve essere un numero intero (1-20).')
            return
        cmd_level(data, cls, lv)
        return

    if cmd == 'feat':
        if len(args) < 3:
            print('Es: python3 explore_classes.py feat wizard "Arcane Recovery"')
            return
        cls = fuzzy_class(data, args[1])
        if not cls:
            print(f'Classe non trovata: {args[1]}')
            return
        feat_name = ' '.join(args[2:])
        cmd_feature(data, cls, feat_name)
        return

    if cmd == 'levelup':
        if len(args) < 4:
            print('Es: python3 explore_classes.py levelup fighter 3 4')
            return
        cls = fuzzy_class(data, args[1])
        if not cls:
            print(f'Classe non trovata: {args[1]}')
            return
        try:
            from_lv, to_lv = int(args[2]), int(args[3])
        except ValueError:
            print('I livelli devono essere numeri interi (1-20).')
            return
        cmd_levelup(data, cls, from_lv, to_lv)
        return

    print(f'Comando sconosciuto: {cmd}')
    usage()

if __name__ == '__main__':
    main()
