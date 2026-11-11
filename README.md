# @profullstack/cross-promo

The "more from the network" block for transactional email. When someone submits a
listing, subscribes, signs up or buys on one Profullstack property, the confirmation
email points them at the sister properties that are relevant to *them*, never at the
sending site itself.

One catalog (`src/catalog.js`) is the single source of truth. Sites read it live from
jsDelivr `@latest` (30 min cache, 2.5 s timeout) and fall back to the copy bundled in
their install, so **adding a property is one release here, with no site redeploys**, and
a mail send never waits on or fails because of the CDN.

```js
import { promoBlock } from '@profullstack/cross-promo';

const promo = await promoBlock({
  site: 'pwamart.com',     // the sender: it is never promoted
  audience: 'makers',      // who the reader is
  seed: email,             // optional: stable per-recipient rotation after the top 2
});
send({ to: email, subject, text: body + '\n\n' + promo.text, html: body + promo.html });
```

Returns `{ items, title, text, markdown, html }`. `html` is inline-styled and neutral
(reads on light and dark clients); pass `theme: { accent, text, muted, bg, border, heading }`
to match a branded template. Links carry `utm_source=<site>&utm_medium=email&utm_campaign=cross-promo`
(`utm: false` turns that off). `promoBlockSync()` is the same without awaiting.

Deno / Supabase edge functions: `import { promoBlock } from 'npm:@profullstack/cross-promo@0'`.

## Audiences

| key | reader | first picks |
| --- | --- | --- |
| `makers` | just listed or launched a product | built.indie, pwamart, SaaSRow, demo.movie, myna |
| `publishers` | runs a blog or site | RSS Amplifier, myna, CrawlProof, seo.rank |
| `podcasters` | runs a show | p0dcasters, RSS Amplifier, myna |
| `developers` | builds software | BufferOverride, LogicSRC, built.indie, hqterm |
| `freelancers` | sells their time | ugig.net, pay.agent |
| `merchants` | sells things | CoinPay, pay.agent, ad.network |
| `shoppers` | buys things | pwamart, SaaSRow |

Pass several (`audience: ['podcasters', 'publishers']`) to merge them in order.

## Adding or changing a property

1. Edit `src/catalog.js`: add it under `properties` (bare host as id, `href`, short true
   `pitch`, `aliases` for old domains / Moshpit names) and into each relevant audience list.
2. `npm test` (checks every audience id exists, no em dashes, catalog.json in sync).
3. Bump `version`, merge, and publish a GitHub release `vX.Y.Z`. The workflow publishes to
   npm and purges jsDelivr `@latest`; every site picks it up within 30 minutes.

## CLI

```sh
npx @profullstack/cross-promo show --site saasrow.com --audience makers --format text
npx @profullstack/cross-promo audiences
```

Env: `CROSS_PROMO=bundled` (never fetch), `CROSS_PROMO=off` (empty block),
`CROSS_PROMO_URL` (alternate catalog).

MIT
