import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pick, promoBlock, promoBlockSync, getCatalog, resetCache, hostOf, bundled, renderHtml } from '../src/index.js';

test('hostOf normalises URLs and www', () => {
  assert.equal(hostOf('https://www.SaaSRow.com/submit'), 'saasrow.com');
  assert.equal(hostOf('built.indie.pit.world'), 'built.indie.pit.world');
  assert.equal(hostOf('localhost:3000'), 'localhost');
});

test('a site never promotes itself', () => {
  const self = { 'saasrow.com': 'saasrow.com', 'saasrow.pwa.pit.world': 'saasrow.com', 'https://pwamart.com': 'pwamart.com', 'built.indie': 'built.indie.pit.world', 'built.indie.pit.world': 'built.indie.pit.world', 'rssamp.com': 'rssamplifier.com' };
  for (const [site, id] of Object.entries(self)) {
    const ids = pick({ site, audience: ['makers', 'publishers'], limit: 99 }).map((i) => i.id);
    assert.ok(!ids.includes(id), `${site}: ${ids}`);
  }
});

test('the three directories promote each other first', () => {
  const ids = (site) => pick({ site, audience: 'makers', limit: 2 }).map((i) => i.id).sort();
  assert.deepEqual(ids('saasrow.com'), ['built.indie.pit.world', 'pwamart.com']);
  assert.deepEqual(ids('pwamart.com'), ['built.indie.pit.world', 'saasrow.com']);
  assert.deepEqual(ids('built.indie.pit.world'), ['pwamart.com', 'saasrow.com']);
});

test('every audience entry exists in properties', () => {
  for (const [k, ids] of Object.entries(bundled.audiences)) for (const id of ids) assert.ok(bundled.properties[id], `${k}: ${id}`);
});

test('no em dashes in copy', () => {
  assert.ok(!JSON.stringify(bundled).includes('—'));
});

test('utm tags added, and can be turned off', () => {
  const [a] = pick({ site: 'saasrow.com', limit: 1 });
  const u = new URL(a.href);
  assert.equal(u.searchParams.get('utm_source'), 'saasrow.com');
  assert.equal(u.searchParams.get('utm_medium'), 'email');
  const [b] = pick({ site: 'saasrow.com', limit: 1, utm: false });
  assert.ok(!b.href.includes('utm_'));
});

test('seed rotates the tail but keeps the pinned head', () => {
  const base = pick({ site: 'saasrow.com', limit: 99 }).map((i) => i.id);
  const seen = new Set();
  for (const seed of ['a@x', 'b@x', 'c@x', 'd@x', 'e@x', 'f@x']) {
    const ids = pick({ site: 'saasrow.com', limit: 99, seed }).map((i) => i.id);
    assert.deepEqual(ids.slice(0, 2), base.slice(0, 2));
    assert.deepEqual([...ids].sort(), [...base].sort());
    seen.add(ids[2]);
  }
  assert.ok(seen.size > 1);
});

test('multiple audiences merge without duplicates; unknown falls back to makers', () => {
  const ids = pick({ audience: ['podcasters', 'publishers'], limit: 99 }).map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(pick({ audience: 'nope', limit: 1 }).length === 1);
});

test('html escapes and renders all formats', async () => {
  const html = renderHtml([{ id: 'x', name: '<b>', pitch: 'a & b', href: 'https://x/?a=1&b=2' }], 'T');
  assert.ok(html.includes('&lt;b&gt;') && html.includes('a &amp; b') && html.includes('a=1&amp;b=2'));
  const b = await promoBlock({ site: 'saasrow.com', audience: 'makers', fetchOptions: { bundled: true } });
  assert.equal(b.items.length, 4);
  assert.match(b.text, /^List it free in more places:/);
  assert.match(b.markdown, /^### List it free/);
  assert.match(b.html, /built\.indie/);
});

test('getCatalog uses the live copy, falls back on failure, never throws', async () => {
  resetCache();
  const live = { properties: { 'z.com': { name: 'Z', pitch: 'zed' } }, audiences: { makers: ['z.com'] } };
  let t = 0;
  const ok = async () => ({ ok: true, json: async () => live });
  assert.equal(await getCatalog({ fetch: ok, now: () => t }), live);
  assert.equal(promoBlockSync({ site: 'a.com' }).items[0].id, 'z.com');
  resetCache();
  const bad = async () => { throw new Error('offline'); };
  assert.equal(await getCatalog({ fetch: bad, now: () => t }), bundled);
  resetCache();
  const junk = async () => ({ ok: true, json: async () => ({ nope: 1 }) });
  assert.equal(await getCatalog({ fetch: junk, now: () => t }), bundled);
  resetCache();
});

test('catalog.json matches src/catalog.js', () => {
  const json = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
  const { version, ...rest } = json;
  assert.deepEqual(rest, JSON.parse(JSON.stringify(bundled)));
});
