// Paste into the signed-in sharehows.com/ghost/ admin tab (JS console or javascript tool).
// Copies the latest jangbaguni.json (built by the jangbaguni-weekly Action) into the
// 장바구니 지도 post: replaces the data part of the HTML card (#jbg ... footer, JSON-LD and
// item script) and the meta/OG fields. The page CSS, header and footer stay as they are.
// Returns [errors, week, meta_title]. Ghost keeps a revision of every save for rollback.
(async () => {
  const POST_ID = '6b0445c249c8e400010c8948';
  const H = { 'Accept-Version': 'v5.0', 'Content-Type': 'application/json' };
  const j = await fetch('https://api.github.com/repos/sociallog/sharehows-data/contents/jangbaguni.json?ref=jangbaguni',
    { headers: { Accept: 'application/vnd.github.raw+json' } }).then(r => r.json());
  const p = (await fetch(`/ghost/api/admin/posts/${POST_ID}/?formats=lexical`, { headers: H, credentials: 'include' }).then(r => r.json())).posts[0];
  const L = JSON.parse(p.lexical);
  const card = L.root.children.find(c => c.type === 'html');
  const h = card.html;
  const a = h.indexOf('<div id="jbg">'), f = h.indexOf('<footer class="jft">'), t = h.indexOf('<script type="application/ld+json">');
  if (!(a > 0 && a < f && f < t)) throw new Error('page markers not found; post layout changed');
  card.html = h.slice(0, a) + j.body + h.slice(f, t) + j.tail;
  const r = await fetch(`/ghost/api/admin/posts/${POST_ID}/`, {
    method: 'PUT', headers: H, credentials: 'include',
    body: JSON.stringify({ posts: [{ updated_at: p.updated_at, lexical: JSON.stringify(L), ...j.meta }] }),
  }).then(r => r.json());
  return [r.errors || null, j.week, j.meta.meta_title];
})();
