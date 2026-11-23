// Weekly 장바구니 지도 data + HTML fragments.
// Compares last complete Mon–Sun week with the week before, using aT 일별 도·소매 가격정보
// (data.go.kr B552845/perDay/price), 중도매 prices only. For each item the change is the
// median of per-series changes (series = market × variety × grade × unit).
// Output: out/jangbaguni.json (data + meta + html fragments for the Ghost post).
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = (process.env.DATA_GO_KR_KEY || '').trim();
if (!KEY) { console.error('DATA_GO_KR_KEY missing'); process.exit(1); }

// name, emoji, ctgry, item, unit label, season, extra tip
const ITEMS = [
  ['배추', '🥬', '200', '211', '10kg(3포기)', '김장철 제철', ''],
  ['양배추', '🥗', '200', '212', '8kg', '겨울', '샐러드나 볶음 재료로 두루 쓰기 좋아요.'],
  ['시금치', '🍃', '200', '213', '4kg', '겨울 제철', ''],
  ['오이', '🥒', '200', '223', '10kg', '여름 채소', ''],
  ['호박', '🎃', '200', '224', '20개', '사계절', ''],
  ['토마토', '🍅', '200', '225', '5kg', '겨울 하우스', ''],
  ['무', '🤍', '200', '231', '20kg', '김장철 제철', ''],
  ['당근', '🥕', '200', '232', '20kg', '겨울 제철', ''],
  ['양파', '🧅', '200', '245', '15kg', '사계절', ''],
  ['대파', '🌿', '200', '246', '1kg', '사계절', '넉넉히 사서 송송 썰어 냉동해 두면 오래 써요.'],
  ['가지', '🍆', '200', '251', '5kg', '여름 채소', ''],
  ['고구마', '🍠', '100', '151', '10kg', '가을·겨울', ''],
  ['감자', '🥔', '100', '152', '20kg', '사계절', ''],
  ['사과', '🍎', '400', '411', '10kg', '가을 제철', ''],
  ['배', '🍐', '400', '412', '15kg', '가을 제철', ''],
];
const FLAT = 3; // |change| below this is 보합

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);

// "today" in KST, then last complete Mon–Sun
const nowKst = new Date(Date.now() + 9 * 3600e3);
const todayKst = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()));
const dow = (todayKst.getUTCDay() + 6) % 7; // Mon=0
const thisStart = addDays(todayKst, -dow - 7), thisEnd = addDays(thisStart, 6);
const prevStart = addDays(thisStart, -7), prevEnd = addDays(thisStart, -1);

async function fetchItem(ct, it) {
  const rows = [];
  for (let page = 1; page < 30; page++) {
    const u = new URL('https://apis.data.go.kr/B552845/perDay/price');
    u.searchParams.set('serviceKey', KEY);
    u.searchParams.set('pageNo', page); u.searchParams.set('numOfRows', 1000); u.searchParams.set('returnType', 'json');
    u.searchParams.set('cond[exmn_ymd::GTE]', ymd(prevStart)); u.searchParams.set('cond[exmn_ymd::LTE]', ymd(thisEnd));
    u.searchParams.set('cond[se_cd::EQ]', '02');
    u.searchParams.set('cond[ctgry_cd::EQ]', ct); u.searchParams.set('cond[item_cd::EQ]', it);
    let j;
    for (let a = 0; a < 3; a++) {
      try {
        const r = await fetch(u); const t = await r.text();
        j = JSON.parse(t); break;
      } catch (e) { if (a === 2) throw new Error(`${it} p${page}: ${String(e).slice(0, 80)}`); await new Promise(s => setTimeout(s, 2000)); }
    }
    const b = j?.response?.body; const items = b?.items?.item || [];
    rows.push(...(Array.isArray(items) ? items : [items]));
    if (!b || rows.length >= (b.totalCount || 0) || items.length === 0) break;
  }
  return rows;
}

const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const out = [];
for (const [name, emoji, ct, it, unit, season, extra] of ITEMS) {
  const rows = await fetchItem(ct, it);
  const ser = new Map();
  for (const r of rows) {
    const p = +r.exmn_dd_prc; if (!(p > 0)) continue;
    const k = [r.mrkt_cd, r.vrty_cd, r.grd_cd, r.unit, r.unit_sz].join('|');
    if (!ser.has(k)) ser.set(k, { a: [], b: [] });
    const d = r.exmn_ymd; (d >= ymd(thisStart) ? ser.get(k).a : ser.get(k).b).push(p);
  }
  const ch = [];
  for (const { a, b } of ser.values()) {
    if (a.length >= 2 && b.length >= 2) {
      const av = a.reduce((x, y) => x + y, 0) / a.length, bv = b.reduce((x, y) => x + y, 0) / b.length;
      ch.push((av / bv - 1) * 100);
    }
  }
  if (ch.length < 3) { console.log(`${name}: too few series (${ch.length}), skipped`); continue; }
  const v = Math.round(median(ch) * 10) / 10 || 0;
  out.push({ name, emoji, unit, season, extra, v, n: ch.length, rows: rows.length });
  console.log(name, v, 'series', ch.length, 'rows', rows.length);
}
if (out.length < 10) { console.error('too few items', out.length); process.exit(1); }

// ---------- text helpers
const fmt = v => v === 0 ? '0%' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace(/\.0$/, '') + '%';
const abs = v => Math.abs(v).toFixed(1).replace(/\.0$/, '');
const jong = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const iga = w => w + (jong(w) ? '이' : '가');
const eunneun = w => w + (jong(w) ? '은' : '는');
const kind = v => v <= -FLAT ? 'down' : v >= FLAT ? 'up' : 'flat';
const flowKo = { down: '내림', up: '오름', flat: '보합' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

out.sort((x, y) => x.v - y.v);
for (const d of out) {
  d.k = kind(d.v);
  let t;
  if (d.v <= -10) t = `${iga(d.name)} 한 주 사이 ${abs(d.v)}% 내렸어요. 이번 주 장보기 목록에 넣어 볼 만해요.`;
  else if (d.k === 'down') t = `지난주보다 ${abs(d.v)}% 내렸어요.`;
  else if (d.v >= 10) t = `한 주 사이 ${abs(d.v)}% 올랐어요. 필요한 만큼만 사고 다음 주 흐름을 지켜보는 게 좋아요.`;
  else if (d.k === 'up') t = `지난주보다 ${abs(d.v)}% 올랐어요.`;
  else t = Math.abs(d.v) < 0.5 ? '변동 없음. 평소처럼 사도 되는 주예요.' : '거의 그대로예요. 평소처럼 사도 되는 주예요.';
  d.tip = d.extra ? `${t} ${d.extra}` : t;
}
const downs = out.filter(d => d.k === 'down'), ups = out.filter(d => d.k === 'up').reverse(), flats = out.filter(d => d.k === 'flat');
const topDown = downs[0], topUp = ups[0];

const M = thisEnd.getUTCMonth() + 1, Y = thisEnd.getUTCFullYear();
const wk = ['첫째', '둘째', '셋째', '넷째', '다섯째'][Math.ceil(thisEnd.getUTCDate() / 7) - 1];
const weekLabel = `${Y}년 ${M}월 ${wk} 주`, weekShort = `${M}월 ${Math.ceil(thisEnd.getUTCDate() / 7)}주`;
const range = `${iso(thisStart)}~${pad(thisEnd.getUTCDate())} 평균 vs ${pad(prevStart.getUTCMonth() + 1)}-${pad(prevStart.getUTCDate())}~${pad(prevEnd.getUTCDate())} 평균`;
const rangeKo = `${M}월 ${thisStart.getUTCDate()}~${thisEnd.getUTCDate()}일 평균과 ${prevStart.getUTCMonth() + 1}월 ${prevStart.getUTCDate()}~${prevEnd.getUTCDate()}일 평균`;
const C = { down: 'var(--jd)', up: 'var(--ju)', flat: 'var(--jf)' }, CS = { down: 'var(--jds)', up: 'var(--jus)', flat: 'var(--jfs)' };
const HEX = { down: '#14a05a', up: '#e2493a', flat: '#14a05a' };
const join = a => a.map(d => d.name).join('·');
const topic = (shown, total) => total > shown.length ? ' 등은' : (jong(shown[shown.length - 1].name) ? '은' : '는');
// "배추(−11.7%)·토마토(−9.9%)는 내렸고, 오이(+34.5%)·호박 등은 올랐어요."
function movement(dl, dn, ul, un, withPct) {
  const dt = dl.length ? dl.map(d => withPct ? `${d.name}(${fmt(d.v)})` : d.name).join('·') + topic(dl, dn) : '';
  const ut = ul.length ? ul.map((d, i) => withPct && i === 0 ? `${d.name}(${fmt(d.v)})` : d.name).join('·') + topic(ul, un) : '';
  if (dt && ut) return `${dt} 내렸고, ${ut} 올랐어요.`;
  if (dt) return `${dt} 내렸어요. 나머지는 지난주와 비슷해요.`;
  if (ut) return `${ut} 올랐어요. 나머지는 지난주와 비슷해요.`;
  return '대부분 지난주와 비슷해요.';
}

// ---------- hero
const lead = topDown || topUp || out[0];
let h1, heroP;
if (topDown) h1 = `${iga(topDown.name)}<br><em>내렸어요</em>`;
else if (topUp) h1 = `${iga(topUp.name)}<br><em>올랐어요</em>`;
else h1 = `이번 주는<br><em>잔잔해요</em>`;
heroP = `전국 도매시장 ${out.length}개 재료를 지난주와 비교했어요. ` + movement(downs.slice(0, 2), downs.length, ups.slice(0, 4), ups.length, true);

const chip = (d, i) => `<button type='button' class='ch' data-i='${i}'><i aria-hidden='true'>${d.emoji}</i>${d.name} <span style='color:${C[d.k]}'>${fmt(d.v)}</span></button>`;
const idx = d => out.indexOf(d);
const trio = `<section class="trio" aria-label="재료 분류"><div class='bn bdown'><h3>지금 사세요<span>내림 ${downs.length}개</span></h3><div class='cs'>${downs.map(d => chip(d, idx(d))).join('')}</div></div><div class='bn bflat'><h3>평소처럼<span>보합 ${flats.length}개</span></h3><div class='cs'>${flats.map(d => chip(d, idx(d))).join('')}</div></div><div class='bn bup'><h3>잠깐 쉬어요<span>오름 ${ups.length}개</span></h3><div class='cs'>${[...ups].reverse().map(d => chip(d, idx(d))).join('')}</div></div></section>`;

// ---------- scale
const lo = Math.min(-5, Math.floor(Math.min(...out.map(d => d.v)) / 5) * 5 - 5); // extra room for the left-side label
const hi = Math.max(5, Math.ceil(Math.max(...out.map(d => d.v)) / 5) * 5);
const pos = v => (v - lo) / (hi - lo) * 100, z = pos(0), f2 = x => x.toFixed(2);
const row = (d, i) => {
  let inner = `<span class='z' style='left:calc(${f2(z)}% - 1px)'></span>`;
  if (Math.abs(d.v) < 0.5) inner += `<span class='fd' style='left:${f2(z)}%'></span><span class='lb' style='left:calc(${f2(z)}% + 12px);color:var(--jm)'>${fmt(d.v)}</span>`;
  else if (d.v < 0) { const l = pos(d.v); inner += `<span class='br' style='left:${f2(l)}%;width:${f2(z - l)}%;background:${C[d.k]}'></span><span class='lb' style='right:calc(${f2(100 - l)}% + 6px);color:${C[d.k]}'>${fmt(d.v)}</span>`; }
  else { const r = pos(d.v); inner += `<span class='br' style='left:${f2(z)}%;width:${f2(r - z)}%;background:${C[d.k]}'></span><span class='lb' style='left:calc(${f2(r)}% + 6px);color:${C[d.k]}'>${fmt(d.v)}</span>`; }
  return `<button type='button' class='rw' data-i='${i}' aria-pressed='${i === 0 ? 'true' : 'false'}'><span class='nm'><i aria-hidden='true'>${d.emoji}</i>${d.name}</span><span class='tr'>${inner}</span></button>`;
};
const scale = `<section><div class="sh"><h2>가격 저울</h2><p>가운데 선이 지난주. 왼쪽 초록은 내림, 오른쪽 빨강은 오름. 재료를 누르면 장보기 팁이 열려요.</p></div>\n<div class="sc"><div class="ax"><span></span><div style="position:relative"><span>${fmt(lo)}</span><span style="position:absolute;left:${f2(z)}%;transform:translateX(-50%)">0</span><span>${fmt(hi)}</span></div></div><div id="jbg-rows">${out.map(row).join('')}</div></div></section>`;
const d0 = out[0];
const detail = `<section class="dt" id="jbg-dt" aria-live="polite"><div class="bv" style="background:${CS[d0.k]}">${d0.emoji}</div><div><h3>${d0.name} <span style="color:${C[d0.k]}">${fmt(d0.v)}</span></h3><p class="m">지난주 대비 도매가 · 거래 단위 ${d0.unit} · ${d0.season}</p><p>${esc(d0.tip)}</p></div></section>`;

// ---------- cards
const src = 'aT 공공데이터 · 전국 도매시장';
const k1 = topDown
  ? `<div class="cd k1"><div class="t"><span>이번 주 장바구니</span><span>${weekShort}</span></div><span class="v" aria-hidden="true">${topDown.emoji}</span><h4>이번 주는<br><em>${topDown.name}</em><br>사는 주</h4><span class="s">${src}</span></div>`
  : `<div class="cd k1"><div class="t"><span>이번 주 장바구니</span><span>${weekShort}</span></div><span class="v" aria-hidden="true">🧺</span><h4>이번 주는<br><em>평소처럼</em><br>사는 주</h4><span class="s">${src}</span></div>`;
const k2 = topDown ? `<div class="cd k2"><div class="t"><span>가장 많이 내렸어요</span><span>${topDown.emoji}</span></div><div><div class="g">${fmt(topDown.v)}</div><h4>${topDown.name},<br>한 주 만에 ${topDown.v <= -10 ? '뚝' : '내림'}</h4></div><span class="s">${M}/${thisStart.getUTCDate()}~${thisEnd.getUTCDate()} 평균, 지난주 대비 도매가</span></div>` : '';
const k3list = [...out.slice(0, 3), ...[...out].reverse().slice(0, 2)].filter((d, i, a) => a.indexOf(d) === i);
const k3 = `<div class="cd k3"><div class="t"><span>이번 주 가격 저울</span><span>지난주 대비</span></div><h4>내린 것, 오른 것<br>한눈에</h4><ol>${k3list.map(d => `<li><span>${d.emoji}</span><span>${d.name}</span><span style='color:${d.v < 0 ? '#14a05a' : d.v > 0 ? '#e2493a' : '#5d6e63'}'>${fmt(d.v)}</span></li>`).join('')}</ol><span class="s">aT 일별 도·소매 가격정보</span></div>`;
const k4 = ups.length ? `<div class="cd k4"><div class="t"><span>잠깐 쉬어요</span><span>오름</span></div><div class="vs" aria-hidden="true">${ups.slice(0, 4).map(d => d.emoji).join('')}</div><div><h4>이번 주는<br>조금 미뤄요</h4><div class="pl">${ups.slice(0, 4).map(d => `<span>${d.name} ${fmt(d.v)}</span>`).join('')}</div></div><span class="s">대신 초록 재료로 바꿔 보세요</span></div>` : '';
const cards = `<section><div class="sh"><h2>이번 주 카드뉴스</h2><p>쉐어하우스 SNS에서 매주 같은 데이터로 나가요</p></div><div class="cards">\n${[k1, k2, k3, k4].filter(Boolean).join('\n')}\n</div></section>`;

// ---------- FAQ
const faq = [];
if (downs.length) faq.push([`이번 주(${M}월 ${wk} 주) 값이 내린 채소·과일은 무엇인가요?`, `${downs.map(d => `${d.name} ${abs(d.v)}%`).join(', ')} 내렸습니다. 전국 도매시장 가격을 ${Y}년 ${rangeKo}으로 비교한 값입니다.`]);
else faq.push([`이번 주(${M}월 ${wk} 주) 값이 내린 채소·과일이 있나요?`, `${FLAT}% 넘게 내린 재료는 없습니다. 전국 도매시장 가격을 ${Y}년 ${rangeKo}으로 비교한 값입니다.`]);
if (ups.length) faq.push(['이번 주 가장 많이 오른 재료는 무엇인가요?', `${ups[0].name}${jong(ups[0].name) ? '이' : '가'} ${abs(ups[0].v)}%로 가장 많이 올랐${ups.length > 1 ? `고, ${ups.slice(1, 4).map(d => `${d.name} ${abs(d.v)}%`).join(', ')} 순입니다.` : '습니다.'}`]);
if (M === 11 || M === 12) {
  const b = out.find(d => d.name === '배추'), m = out.find(d => d.name === '무');
  if (b && m) faq.push(['김장 재료는 지금 사도 되나요?', `배추는 지난주보다 ${b.v === 0 ? '변동이 없고' : `${abs(b.v)}% ${b.v < 0 ? '내렸고' : '올랐고'}`}, 무는 ${m.k === 'flat' ? '보합입니다' : `${abs(m.v)}% ${m.v < 0 ? '내렸습니다' : '올랐습니다'}`}. 도매가 흐름이라 동네 가게 값과는 차이가 날 수 있어요.`]);
}
faq.push(['가격은 어디서 가져오나요?', "한국농수산식품유통공사(aT)가 공공데이터포털로 제공하는 '일별 도·소매 가격정보'를 씁니다. 도매시장·품종·등급별로 이번 주와 지난주 평균을 비교해 변동률을 구하고, 그 가운데값을 재료의 대표값으로 삼았습니다."]);
faq.push(['얼마나 자주 업데이트되나요?', '매주 월요일에 지난주(월~일) 데이터로 새로 계산합니다.']);
const faqHtml = `<section class="faq"><div class="sh"><h2>자주 묻는 질문</h2></div>${faq.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`;

const table = `<section><div class="sh"><h2>이번 주 전체 표</h2><p>${range}</p></div><div class="tb"><table><thead><tr><th>재료</th><th>지난주 대비</th><th>흐름</th><th>도매 거래 단위</th></tr></thead><tbody>${out.map(d => `<tr><td>${d.name}</td><td>${fmt(d.v)}</td><td>${flowKo[d.k]}</td><td>${d.unit}</td></tr>`).join('')}</tbody></table></div></section>`;
const srcP = `<p class="src">출처: 한국농수산식품유통공사(aT) 일별 도·소매 가격정보, 공공데이터포털(<a href="https://www.data.go.kr/data/15156057/openapi.do" rel="nofollow noopener" target="_blank">data.go.kr</a>). 전국 도매시장·품종·등급별로 이번 주와 지난주 평균을 비교한 변동률의 중간값입니다. 소매가와 차이가 있을 수 있어요. 기준일 ${Y}년 ${M}월 ${thisEnd.getUTCDate()}일, 쉐어하우스 편집부 정리.</p>`;

const hero = `<section class="hero" aria-label="이번 주 요약"><div><span class="eb"><b>${weekLabel}</b>이번 주 장바구니</span><h1>${h1}</h1><p>${esc(heroP)}</p></div><div class="stp" aria-hidden="true"><span class="v">${lead.emoji}</span><span class="p">${fmt(lead.v)}</span><small>${lead.name} · 지난주 대비</small></div></section>`;
const body = `<div id="jbg">\n${hero}\n${trio}\n${scale}\n${detail}\n${cards}\n${faqHtml}\n${table}\n${srcP}\n</div>\n`;

// ---------- tail (JSON-LD + interaction script)
const desc = `전국 도매시장 가격으로 지난주와 비교한 채소·과일 ${out.length}개 재료 시세. ${weekLabel}: ` + [topDown && `${topDown.name} ${fmt(topDown.v)}`, topUp && `${topUp.name} ${fmt(topUp.v)}`].filter(Boolean).join(', ') + '.';
const ld = [
  { '@context': 'https://schema.org', '@type': 'WebPage', name: '이번 주 장바구니 지도', url: 'https://www.sharehows.com/jangbaguni/', inLanguage: 'ko', datePublished: '2026-11-18', dateModified: iso(todayKst), description: desc, publisher: { '@type': 'Organization', name: '쉐어하우스', url: 'https://www.sharehows.com/' } },
  { '@context': 'https://schema.org', '@type': 'Dataset', name: `이번 주 장바구니: 채소·과일 주간 도매가 변동률 (${weekLabel})`, description: `aT 일별 도·소매 가격정보를 바탕으로 ${iso(thisStart)}~${pad(thisEnd.getUTCDate())} 평균과 ${iso(prevStart)}~${pad(prevEnd.getUTCDate())} 평균을 도매시장·품종·등급별로 비교한 변동률의 중간값.`, temporalCoverage: `${iso(prevStart)}/${iso(thisEnd)}`, spatialCoverage: '대한민국', isBasedOn: 'https://www.data.go.kr/data/15156057/openapi.do', creator: { '@type': 'Organization', name: '쉐어하우스' }, license: 'https://www.data.go.kr/', variableMeasured: '지난주 대비 도매가 변동률(%)' },
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
];
const T = out.map(d => [d.name, d.emoji, fmt(d.v), d.k, d.unit, d.season, d.tip]);
const tail = `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n<script>\n(function(){var T=${JSON.stringify(T).replace(/</g, '\\u003c')};var root=document.getElementById("jbg");if(!root)return;\nvar C={down:["var(--jd)","var(--jds)"],up:["var(--ju)","var(--jus)"],flat:["var(--jm)","var(--jfs)"]};\nroot.addEventListener("click",function(e){var b=e.target.closest("[data-i]");if(!b)return;var d=T[+b.dataset.i];\n[].forEach.call(document.querySelectorAll("#jbg-rows .rw"),function(r){r.setAttribute("aria-pressed",r.dataset.i==b.dataset.i?"true":"false")});\ndocument.getElementById("jbg-dt").innerHTML="<div class='bv' style='background:"+C[d[3]][1]+"'>"+d[1]+"</div><div><h3>"+d[0]+" <span style='color:"+C[d[3]][0]+"'>"+d[2]+"</span></h3><p class='m'>지난주 대비 도매가 · 거래 단위 "+d[4]+" · "+d[5]+"</p><p>"+d[6]+"</p></div>";\nif(b.classList.contains("ch"))document.getElementById("jbg-dt").scrollIntoView({behavior:"smooth",block:"center"});});})();\n</script>\n<script>(function(){var a=document.getElementById("jbg-app");if(a&&a.parentNode!==document.body)document.body.appendChild(a);})();</script>\n`;

// ---------- meta
const wkShortTitle = `${M}월 ${wk} 주`;
const meta = {
  meta_title: `이번 주 장바구니 지도: ${wkShortTitle} ` + ([topDown && `${topDown.name} ${abs(topDown.v)}% 내림`, topUp && `${topUp.name} ${abs(topUp.v)}% 오름`].filter(Boolean).join(', ') || '큰 변동 없음'),
  meta_description: `전국 도매시장 가격으로 채소·과일 ${out.length}개 재료를 지난주와 비교했어요. ` + movement(downs.slice(0, 3), downs.length, ups.slice(0, 4), ups.length, false).replace(' 나머지는 지난주와 비슷해요.', '') + ' 매주 월요일 업데이트.',
  og_title: topDown ? `이번 주는 ${topDown.name} 사는 주 (${fmt(topDown.v)})` : `이번 주 장바구니: ${wkShortTitle}`,
  og_description: `전국 도매시장 ${out.length}개 재료 시세를 초록(내림)·빨강(오름)으로 한눈에. 매주 월요일 업데이트.`,
};
meta.twitter_title = meta.og_title; meta.twitter_description = meta.og_description;

const res = { generated_at: new Date().toISOString(), week: { label: weekLabel, this: [iso(thisStart), iso(thisEnd)], prev: [iso(prevStart), iso(prevEnd)] }, items: out.map(({ extra, ...d }) => d), meta, body, tail };
mkdirSync('out', { recursive: true });
writeFileSync('out/jangbaguni.json', JSON.stringify(res));
console.log(weekLabel, meta.meta_title);
