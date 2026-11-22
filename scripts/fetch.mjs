// Fetches live data for ShareHows pages and writes out/live.json.
// Keys come only from environment variables (GitHub Secrets). Never log URLs that contain a key.
import { writeFileSync, mkdirSync } from 'node:fs';

const out = { updated: new Date().toISOString(), sources: {} };

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'sharehows-data' } });
  if (!r.ok) { const b = (await r.text()).slice(0, 120).replace(/serviceKey=[^&\s]+/g, 'serviceKey=***').replace(/\s+/g, ' '); throw new Error('HTTP ' + r.status + ' ' + b); }
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error('not JSON: ' + t.slice(0, 80).replace(/serviceKey=[^&\s]+/g, 'serviceKey=***')); }
}

// 1) Exchange rates (no key). 1,000 KRW in other currencies + USD/KRW.
try {
  const quotes = ['KRW', 'EUR', 'JPY', 'CNY', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', 'BRL'];
  const rows = await getJSON('https://api.frankfurter.dev/v2/rates?base=USD&quotes=' + quotes.join(','));
  const perUSD = { USD: 1 };
  for (const x of rows) perUSD[x.quote] = x.rate;
  const krw = perUSD.KRW;
  const per1000 = {};
  for (const [c, v] of Object.entries(perUSD)) {
    if (c === 'KRW') continue;
    const n = (1000 / krw) * v;
    per1000[c] = Number(n.toFixed(n < 10 ? 3 : 1));
  }
  out.fx = { date: rows[0] && rows[0].date, usd_krw: krw, per_1000_krw: per1000 };
  out.sources.fx = 'Frankfurter (central bank reference rates)';
} catch (e) { out.fx = { error: String(e.message) }; }

// 2) Keyed public data (data.go.kr). Skipped until the DATA_GO_KR_KEY secret exists.
const RAW = (process.env.DATA_GO_KR_KEY || '').trim();
const KEY = RAW.includes('%') ? RAW : encodeURIComponent(RAW); // accept either key form
console.log('key info: length', RAW.length, 'has%', RAW.includes('%'), 'endsWith==', RAW.endsWith('=='));

if (RAW) {
  // KMA ultra-short-term observation, Seoul (Jung-gu grid nx=60, ny=127)
  try {
    const kst = new Date(Date.now() + 9 * 3600e3 - 45 * 60e3); // data for hour H appears ~H:40
    const d = kst.toISOString().slice(0, 10).replace(/-/g, '');
    const h = String(kst.getUTCHours()).padStart(2, '0') + '00';
    const j = await getJSON(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${KEY}&pageNo=1&numOfRows=20&dataType=JSON&base_date=${d}&base_time=${h}&nx=60&ny=127`);
    const v = {};
    for (const i of j.response.body.items.item) v[i.category] = Number(i.obsrValue);
    out.weather = { at: d + h, temp_c: v.T1H, rain_1h_mm: v.RN1, humidity: v.REH, wind_ms: v.WSD, precip_type: v.PTY };
    out.sources.weather = 'Korea Meteorological Administration, ultra-short-term observation (Seoul)';
  } catch (e) { out.weather = { error: String(e.message) }; }

  // AirKorea, Seoul real-time station average
  try {
    const j = await getJSON(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${KEY}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent('서울')}&ver=1.0`);
    const it = j.response.body.items;
    const avg = (k) => { const a = it.map((x) => Number(x[k])).filter((n) => Number.isFinite(n)); return a.length ? Math.round(a.reduce((s, n) => s + n, 0) / a.length) : null; };
    out.air = { at: it[0] && it[0].dataTime, pm10: avg('pm10Value'), pm25: avg('pm25Value'), stations: it.length };
    out.sources.air = 'AirKorea (Korea Environment Corporation), Seoul station average';
  } catch (e) { out.air = { error: String(e.message) }; }
}

mkdirSync('out', { recursive: true });
writeFileSync('out/live.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
