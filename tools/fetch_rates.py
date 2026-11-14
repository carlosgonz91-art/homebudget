"""Weekly: fetch the US average 30-year and 15-year mortgage rates (Freddie Mac PMMS) and write rates.json.
Run by .github/workflows/rates.yml. The app reads rates.json from its own site, so the phone never calls another server.
Source order: Freddie Mac's history file, then FRED's copy of the same series."""
import csv, io, json, sys, datetime, urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (HomeBudget weekly rate check)'}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return r.read().decode('utf-8', 'replace')

def day(s):
    s = s.strip()
    for f in ('%m/%d/%Y', '%Y-%m-%d', '%m/%d/%y'):
        try: return datetime.datetime.strptime(s, f).date().isoformat()
        except ValueError: pass
    return None

def num(s):
    try:
        v = float(str(s).strip())
        return v if 0 < v < 25 else None
    except ValueError:
        return None

def freddie():
    rows = list(csv.reader(io.StringIO(get('https://www.freddiemac.com/pmms/docs/PMMS_history.csv'))))
    h = [c.strip().lower() for c in rows[0]]
    i30, i15 = h.index('pmms30'), h.index('pmms15')
    out = []
    for r in rows[1:]:
        if len(r) <= max(i30, i15): continue
        d, a = day(r[0]), num(r[i30])
        if d and a: out.append({'d': d, 'r30': a, 'r15': num(r[i15])})
    return out

def fred():
    rows = list(csv.reader(io.StringIO(get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US,MORTGAGE15US'))))
    out = []
    for r in rows[1:]:
        d, a = day(r[0]), num(r[1])
        if d and a: out.append({'d': d, 'r30': a, 'r15': num(r[2]) if len(r) > 2 else None})
    return out

def main():
    pts, src = None, None
    for name, fn in (('Freddie Mac PMMS', freddie), ('Freddie Mac PMMS via FRED', fred)):
        try:
            pts = fn(); src = name
            if pts: break
        except Exception as e:
            print(name, 'failed:', e, file=sys.stderr)
    if not pts:
        print('no rates fetched; keeping the old file', file=sys.stderr); return
    pts.sort(key=lambda x: x['d'])
    last = pts[-1]
    data = {'asOf': last['d'], 'r30': last['r30'], 'r15': last['r15'], 'src': src + ' (US weekly average)',
            'hist': [{'d': p['d'], 'r30': p['r30']} for p in pts[-104:]]}
    try:
        old = json.load(open('rates.json'))
    except Exception:
        old = None
    if old and old.get('asOf') == data['asOf'] and len(old.get('hist', [])) >= len(data['hist']):
        print('no new week'); return
    json.dump(data, open('rates.json', 'w'), separators=(',', ':'))
    print('rates.json updated', data['asOf'], data['r30'])

main()
