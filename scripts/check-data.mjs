import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = join(root, 'runtime', 'operations.db');
if (!existsSync(databasePath)) throw new Error('Database is missing. Run npm run db:load first.');
const db = new DatabaseSync(databasePath, { readOnly: true });
const scalar = (sql) => Object.values(db.prepare(sql).get())[0];
const checks = [
  ['daily record count', scalar('SELECT COUNT(*) FROM daily_operations') === 70],
  ['daily primary keys', scalar('SELECT COUNT(*) FROM (SELECT date, city FROM daily_operations GROUP BY date, city HAVING COUNT(*) > 1)') === 0],
  ['subsidy record count', scalar('SELECT COUNT(*) FROM subsidy_dimensions') === 68],
  ['retention channels', scalar('SELECT COUNT(*) FROM channel_retention') === 4],
  ['date range', scalar("SELECT MIN(date) || ':' || MAX(date) FROM daily_operations") === '2026-07-21:2026-08-03'],
  ['completion boundaries', scalar('SELECT COUNT(*) FROM daily_operations WHERE completion_rate_pct < 0 OR completion_rate_pct > 100') === 0],
  ['GMV boundaries', scalar('SELECT COUNT(*) FROM daily_operations WHERE gmv_sar < 0 OR subsidy_sar < 0') === 0]
];
db.close();
const failed = checks.filter(([, passed]) => !passed);
checks.forEach(([name, passed]) => console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`));
if (failed.length) process.exitCode = 1;
