// @profullstack/cross-promo: the "more from the network" block for transactional
// email. One catalog (src/catalog.js), served live from jsDelivr @latest, so a
// property added in one release shows up in every site's emails without a
// redeploy. The copy bundled with the install is the fallback: a mail send never
// waits on, or fails because of, the CDN.

import bundledCatalog from './catalog.js';

export const CATALOG_URL = 'https://cdn.jsdelivr.net/npm/@profullstack/cross-promo@latest/catalog.json';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_LIMIT = 4;

const env = (k) => {
  try {
    return globalThis.process?.env?.[k] ?? globalThis.Deno?.env?.get?.(k);
  } catch {
    return undefined; // Deno without --allow-env
  }
};

export const bundled = bundledCatalog;

const cache = { catalog: null, until: 0, pending: null };

function valid(c) {
  return !!c && typeof c === 'object' && c.properties && typeof c.properties === 'object' && c.audiences && typeof c.audiences === 'object';
}

/**
 * The live catalog, cached in memory. Never throws: any failure (timeout, bad
 * JSON, offline) returns the last good copy, else the bundled one.
 * CROSS_PROMO=bundled skips the network; CROSS_PROMO_URL overrides the source.
 * @param {{ url?: string, ttlMs?: number, timeoutMs?: number, fetch?: typeof fetch, now?: () => number, bundled?: boolean }} [opts]
 */
export async function getCatalog(opts = {}) {
  if (opts.bundled || env('CROSS_PROMO') === 'bundled') return bundledCatalog;
  const now = (opts.now ?? Date.now)();
  if (cache.catalog && now < cache.until) return cache.catalog;
  if (cache.pending) return cache.catalog ?? cache.pending;
  const doFetch = opts.fetch ?? globalThis.fetch;
  const url = opts.url ?? env('CROSS_PROMO_URL') ?? CATALOG_URL;
  cache.pending = (async () => {
    try {
      if (!doFetch) throw new Error('no fetch');
      const res = await doFetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const c = await res.json();
      if (!valid(c)) throw new Error('bad catalog');
      cache.catalog = c;
      cache.until = (opts.now ?? Date.now)() + (opts.ttlMs ?? DEFAULT_TTL_MS);
    } catch {
      cache.catalog = cache.catalog ?? bundledCatalog;
      cache.until = (opts.now ?? Date.now)() + FAILURE_TTL_MS;
    } finally {
      cache.pending = null;
    }
    return cache.catalog;
  })();
  return cache.catalog ?? cache.pending;
}

/** Test hook: forget the cached live catalog. */
export function resetCache() {
  cache.catalog = null;
  cache.until = 0;
  cache.pending = null;
}

/** "https://www.SaaSRow.com/x" -> "saasrow.com" */
export function hostOf(site) {
  if (!site) return '';
  let s = String(site).trim().toLowerCase();
  try {
    if (s.includes('://')) s = new URL(s).hostname;
  } catch {
    /* keep s */
  }
  return s.replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
}

/** Same property? Matches the id, its aliases, its link's host, and Moshpit name <-> .pit.world. */
function sameProperty(id, site, p) {
  if (!site) return false;
  const names = [id, ...(p?.aliases ?? []).map(hostOf), hostOf(p?.href)].filter(Boolean);
  return names.some((n) => n === site || n === `${site}.pit.world` || site === `${n}.pit.world`);
}

/** Stable small hash so one recipient always sees the same rotation. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function withUtm(href, site, campaign) {
  try {
    const u = new URL(href);
    if (site) u.searchParams.set('utm_source', site);
    u.searchParams.set('utm_medium', 'email');
    u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    return href;
  }
}

/**
 * The properties to show, most relevant first.
 * @param {{ audience?: string|string[], site?: string, limit?: number, seed?: string, pin?: number, utm?: boolean, campaign?: string, exclude?: string[], catalog?: object }} opts
 *  - audience: one key or several (merged in order, deduped). Unknown -> makers.
 *  - site: the sending site; it never promotes itself.
 *  - seed: e.g. the recipient's email; rotates everything after the first `pin` (default 2).
 */
export function pick(opts = {}) {
  const catalog = valid(opts.catalog) ? opts.catalog : bundledCatalog;
  const site = hostOf(opts.site);
  const exclude = (opts.exclude ?? []).map(hostOf);
  const keys = [].concat(opts.audience ?? 'makers');
  let ids = [];
  for (const k of keys) for (const id of catalog.audiences[k] ?? []) if (!ids.includes(id)) ids.push(id);
  if (!ids.length) ids = [...(catalog.audiences.makers ?? Object.keys(catalog.properties))];
  ids = ids.filter((id) => {
    const p = catalog.properties[id];
    return p && !sameProperty(id, site, p) && !exclude.some((x) => sameProperty(id, x, p));
  });
  if (opts.seed) {
    const pin = Math.max(0, opts.pin ?? 2);
    const head = ids.slice(0, pin);
    const tail = ids.slice(pin);
    const r = tail.length ? hash(String(opts.seed)) % tail.length : 0;
    ids = head.concat(tail.slice(r), tail.slice(0, r));
  }
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const campaign = opts.campaign ?? 'cross-promo';
  return ids.slice(0, limit).map((id) => {
    const p = catalog.properties[id];
    const href = p.href ?? `https://${id}`;
    return { id, name: p.name ?? id, pitch: p.pitch ?? '', href: opts.utm === false ? href : withUtm(href, site, campaign) };
  });
}

function titleFor(catalog, audience, title) {
  if (title) return title;
  const k = [].concat(audience ?? 'makers')[0];
  return catalog.titles?.[k] ?? catalog.titles?.default ?? 'More from the Profullstack network';
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const escapeMd = (s) => String(s).replace(/([\\[\]()*_`])/g, '\\$1');

/** Plain-text block. */
export function renderText(items, title) {
  if (!items.length) return '';
  return [`${title}:`, ...items.map((i) => `- ${i.name}: ${i.pitch}\n  ${i.href}`)].join('\n');
}

/** Markdown block (for templates that render Markdown to HTML). */
export function renderMarkdown(items, title) {
  if (!items.length) return '';
  return [`### ${escapeMd(title)}`, items.map((i) => `- [${escapeMd(i.name)}](${i.href}): ${escapeMd(i.pitch)}`).join('\n')].join('\n\n');
}

/**
 * Inline-styled HTML block. Neutral by default so it reads on light and dark
 * mail clients; pass `theme` to match a branded template.
 * @param {{ accent?: string, text?: string, muted?: string, bg?: string, border?: string, heading?: string }} [theme]
 */
export function renderHtml(items, title, theme = {}) {
  if (!items.length) return '';
  const t = { accent: '#2563eb', text: 'inherit', muted: '#6b7280', bg: 'transparent', border: '#d1d5db', heading: 'inherit', ...theme };
  const li = (i) =>
    `<li style="margin:0 0 8px;"><a href="${escapeHtml(i.href)}" style="color:${t.accent};font-weight:600;text-decoration:none;">${escapeHtml(i.name)}</a>: ${escapeHtml(i.pitch)}</li>`;
  return (
    `<div style="margin-top:24px;padding:16px 20px;border:1px solid ${t.border};border-radius:10px;background:${t.bg};color:${t.text};font-size:14px;line-height:1.5;">` +
    `<p style="margin:0 0 8px;font-weight:700;color:${t.heading};">${escapeHtml(title)}</p>` +
    `<ul style="margin:0;padding-left:20px;">${items.map(li).join('')}</ul>` +
    `<p style="margin:8px 0 0;font-size:12px;color:${t.muted};">From the <a href="https://profullstack.com" style="color:${t.muted};">Profullstack</a> network.</p>` +
    `</div>`
  );
}

function build(catalog, opts) {
  const items = pick({ ...opts, catalog });
  const title = titleFor(catalog, opts.audience, opts.title);
  return {
    items,
    title,
    text: renderText(items, title),
    markdown: renderMarkdown(items, title),
    html: renderHtml(items, title, opts.theme),
  };
}

/**
 * Everything an email needs, from the live catalog.
 * @param {{ site: string, audience?: string|string[], limit?: number, seed?: string, title?: string, theme?: object, utm?: boolean, campaign?: string, exclude?: string[] }} opts
 * @returns {Promise<{ items: Array<{id:string,name:string,pitch:string,href:string}>, title: string, text: string, markdown: string, html: string }>}
 */
export async function promoBlock(opts = {}) {
  if (env('CROSS_PROMO') === 'off') return build(bundledCatalog, { ...opts, limit: 0 });
  return build(await getCatalog(opts.fetchOptions), opts);
}

/** Same as promoBlock without awaiting: last cached live catalog, else bundled. */
export function promoBlockSync(opts = {}) {
  if (env('CROSS_PROMO') === 'off') return build(bundledCatalog, { ...opts, limit: 0 });
  return build(cache.catalog ?? bundledCatalog, opts);
}

/** The audience keys the catalog knows. */
export function audiences(catalog = bundledCatalog) {
  return Object.keys(catalog.audiences);
}
