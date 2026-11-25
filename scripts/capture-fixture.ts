// Usage: npm run capture -- <promiedos path> <fixture name>
// Freezes a real promiedos payload as a test fixture.
import { writeFileSync } from 'node:fs';
import { fetchNextData } from '../src/server/promiedos/fetch.js';

const [path, name] = process.argv.slice(2);
if (!path || !name) {
  console.error('Usage: npm run capture -- <path> <name>');
  process.exit(1);
}

const props = await fetchNextData(path);
const data = path.startsWith('/game/') ? props.initialData.game : /^\/(team|league)\//.test(path) ? props.data : null;
if (!data) throw new Error(`Don't know what to keep from ${path} (expected /game/..., /team/... or /league/...)`);

const file = new URL(`../src/server/promiedos/__fixtures__/${name}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Saved ${file.pathname}`);
