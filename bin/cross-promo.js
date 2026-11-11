#!/usr/bin/env node
// cross-promo show --site saasrow.com --audience makers [--format text|markdown|html|json] [--limit 4] [--seed you@x.com] [--bundled]
// cross-promo audiences
// cross-promo catalog [--bundled]
import { promoBlock, getCatalog, audiences } from '../src/index.js';

const [cmd = 'show', ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) args[a.slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
}

if (cmd === 'audiences') {
  console.log(audiences(await getCatalog({ bundled: !!args.bundled })).join('\n'));
} else if (cmd === 'catalog') {
  console.log(JSON.stringify(await getCatalog({ bundled: !!args.bundled }), null, 2));
} else if (cmd === 'show') {
  const b = await promoBlock({
    site: args.site,
    audience: args.audience ? String(args.audience).split(',') : undefined,
    limit: args.limit ? Number(args.limit) : undefined,
    seed: args.seed,
    utm: args['no-utm'] ? false : undefined,
    fetchOptions: { bundled: !!args.bundled },
  });
  const f = args.format ?? 'text';
  console.log(f === 'json' ? JSON.stringify(b, null, 2) : (b[f] ?? b.text));
} else {
  console.error('usage: cross-promo show --site <host> [--audience makers] [--format text|markdown|html|json] | audiences | catalog');
  process.exit(2);
}
