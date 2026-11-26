// 소미 프로그램(똑똑이 소미, 이름은 바뀔 수 있음) 영상 목록을 쉐어하우스 유튜브 공개 RSS에서 모아 out/somi-episodes.json 으로 씁니다. 키 없음.
// 찾는 기준(프로그램 이름과 무관): 영상 설명에 "sharehows.com/somi" 링크가 있으면 소미 편. 이 링크는 설명란의 '소미한테 맡기기' 안내 줄이기도 합니다.
// 설명에서 읽는 것: "🙋 ○○님이 맡긴 질문" → by, sharehows.com 다른 글 링크 → post (첫 번째 것).
// RSS는 최근 15편만 주므로 지난번 결과(data 브랜치)와 합쳐서 오래된 편도 남깁니다. /somi/ 허브(sh/somi-request.hbs)가 읽습니다.
import { writeFileSync, mkdirSync } from 'node:fs';
const CH = 'UCXXBlFfsU0KpJQFdiZygqXA';
const PREV = 'https://raw.githubusercontent.com/sociallog/sharehows-data/data/somi-episodes.json';
const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
mkdirSync('out', { recursive: true });
let prev = [];
try { const r = await fetch(PREV + '?t=' + Date.now()); if (r.ok) prev = (await r.json()).episodes || []; } catch {}
const out = { updated: new Date().toISOString(), episodes: prev };
try {
  const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + CH, { headers: { 'User-Agent': 'sharehows-data' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const x = await r.text(), seen = new Map(prev.map(e => [e.id, e]));
  for (const e of x.split('<entry>').slice(1)) {
    const desc = dec((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');
    if (!/sharehows\.com\/somi\b/i.test(desc)) continue;
    const id = (e.match(/<yt:videoId>([^<]+)/) || [])[1];
    if (!id) continue;
    const by = ((desc.match(/🙋\s*([^\n]{1,20}?)\s*님이\s*맡긴/) || [])[1] || '').trim();
    const post = (desc.match(/https?:\/\/(?:www\.)?sharehows\.com\/(?!somi\b)[^\s)]+/i) || [])[0] || '';
    seen.set(id, {
      id,
      title: dec((e.match(/<title>([^<]*)/) || [])[1] || ''),
      published: (e.match(/<published>([^<]+)/) || [])[1] || '',
      by, post,
      views: +((e.match(/<media:statistics views="(\d+)"/) || [])[1] || 0),
    });
  }
  out.episodes = [...seen.values()].sort((a, b) => (b.published || '').localeCompare(a.published || ''));
} catch (e) { out.error = String(e.message); }
writeFileSync('out/somi-episodes.json', JSON.stringify(out, null, 1));
console.log('somi episodes', out.episodes.length, out.error || '');
