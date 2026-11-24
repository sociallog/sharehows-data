#!/usr/bin/env python3
"""Make k101/registry.json from the 101 master data (stories.json + guides).
Run after every 101 change:  python3 scripts/k101_registry.py /mnt/project-files/korea-101
"""
import json, sys, pathlib, datetime
root = pathlib.Path(sys.argv[1])
D = json.loads((root / 'data/stories.json').read_text())
guides = {}
for g in (root / 'guides').glob('*.json'):
    G = json.loads(g.read_text())
    guides[G['n']] = 'https://www.sharehows.com/' + G['slug']['en'] + '/'
items = {}
for it in D['items']:
    vids = []
    for v in [it.get('yt'), it.get('yt2')] + [b.get('id') for b in it.get('mid', []) if b.get('t') == 'video'] + [m[0] for m in it.get('more', [])] + it.get('retired', []):
        if v and v not in vids: vids.append(v)
    items[f"{it['n']:03d}"] = {'en': it['en'][0], 'ko': it['ko'][0], 'videos': vids, 'guide': guides.get(it['n'])}
out = {'updated': datetime.date.today().isoformat(),
       'rule': 'One number = the 101 number. Videos show "Seoul 101 · NNN" and put "📘 Seoul 101 · NNN" + link in the description. No series episode numbers.',
       'items': items}
p = pathlib.Path(__file__).resolve().parent.parent / 'k101/registry.json'
p.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print('registry', len(items), 'items ->', p)
