// Checks the How To Seoul YouTube feed against the 101 numbering and writes out/k101-sync.json.
// Public RSS, no key. Rule (k101/RULES.md): one number = the 101 number (e.g. 001). The -k order is internal only.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const CH = 'UCcy7MdZMFuoZJrbn7mKih7Q';
const reg = JSON.parse(readFileSync(new URL('../k101/registry.json', import.meta.url)));
const codes = JSON.parse(readFileSync(new URL('../k101/videos.json', import.meta.url))).videos;
const onCard = {}; for (const [n, it] of Object.entries(reg.items)) for (const v of it.videos) onCard[v] = n;
const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const label = t => { const m = t.match(/101\s*[·.\-–#]\s*(\d{3})/i); return m ? m[1] : null; };
const legacy = t => { const m = t.match(/#s(\d{3})\b/) || t.match(/tip #(\d{3})/i); return m ? m[1] : null; };
mkdirSync('out', { recursive: true });
const out = { updated: new Date().toISOString(), videos: [], todo: [] };
try {
  const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + CH, { headers: { 'User-Agent': 'sharehows-data' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const x = await r.text();
  for (const e of x.split('<entry>').slice(1)) {
    const id = (e.match(/<yt:videoId>([^<]+)/) || [])[1];
    const title = dec((e.match(/<title>([^<]*)/) || [])[1] || '');
    const published = (e.match(/<published>([^<]+)/) || [])[1];
    const desc = dec((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');
    const shown = label(title + '\n' + desc), old = legacy(desc), code = codes[id] || null, card = onCard[id] || null;
    const want = code ? code.slice(0, 3) : null;
    let status;
    if (!code) status = (shown || old) ? 'give_code' : 'not_linked';    // new video: give it the next NNN-k (or decide it's not 101)
    else if (card !== want) status = 'add_to_101_card';                   // code given, but the 101 card doesn't show the video
    else if ((shown || old) !== want) status = 'fix_youtube_label';   // description has no 101 number/link, or a different one                // description/title lacks "Seoul 101 · NNN-k"
    else status = 'ok';
    const v = { id, title, published, code, shown, legacy: old, card, status };
    out.videos.push(v); if (status !== 'ok') out.todo.push(v);
  }
  out.counts = out.videos.reduce((a, v) => (a[v.status] = (a[v.status] || 0) + 1, a), {});
} catch (e) { out.error = String(e.message); }
writeFileSync('out/k101-sync.json', JSON.stringify(out, null, 1));
console.log('k101 sync', JSON.stringify(out.counts || out.error));
