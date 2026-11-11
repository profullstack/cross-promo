// Writes catalog.json (what jsDelivr serves as @latest) from src/catalog.js.
import { writeFileSync } from 'node:fs';
import catalog from '../src/catalog.js';
import pkg from '../package.json' with { type: 'json' };

writeFileSync(new URL('../catalog.json', import.meta.url), JSON.stringify({ version: pkg.version, ...catalog }, null, 2) + '\n');
