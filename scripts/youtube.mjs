// Checks the How To Seoul YouTube feed against the 101 numbering and writes out/k101-sync.json.
// Public RSS, no key. Rule (k101/RULES.md): one number = the 101 number (e.g. 001). The 101 card (registry.json) is the only ledger.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const CH = 'UCcy7MdZMFuoZJrbn7mKih7Q';
const reg = JSON.parse(readFileSync(new URL('../k101/registry.json', import.meta.url)));
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
    const num = label(title + '\n' + desc) || legacy(desc), card = onCard[id] || null;
    let status;
    if (num && card === num) status = 'ok';
    else if (num && card !== num) status = 'add_to_101_card';   // video says 101 · NNN, card NNN doesn't have it -> Claude adds it
    else if (card) status = 'add_101_line_on_youtube';         // on a 101 card, but the video has no 101 line
    else status = 'not_linked';                                // no number, not on 101 -> ask YunShik which number (or none)
    const v = { id, title, published, num, card, status };
    out.videos.push(v); if (status !== 'ok') out.todo.push(v);
  }
  out.counts = out.videos.reduce((a, v) => (a[v.status] = (a[v.status] || 0) + 1, a), {});
} catch (e) { out.error = String(e.message); }
writeFileSync('out/k101-sync.json', JSON.stringify(out, null, 1));
console.log('k101 sync', JSON.stringify(out.counts || out.error));
