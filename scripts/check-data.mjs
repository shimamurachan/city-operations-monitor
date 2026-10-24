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
  ['daily records exist', scalar('SELECT COUNT(*) FROM daily_operations') > 0],
  ['daily primary keys', scalar('SELECT COUNT(*) FROM (SELECT date, city FROM daily_operations GROUP BY date, city HAVING COUNT(*) > 1)') === 0],
  ['subsidy records exist', scalar('SELECT COUNT(*) FROM subsidy_dimensions') > 0],
  ['subsidy primary keys', scalar('SELECT COUNT(*) FROM (SELECT date, city, subsidy_type, user_type, category FROM subsidy_dimensions GROUP BY date, city, subsidy_type, user_type, category HAVING COUNT(*) > 1)') === 0],
  ['retention channels exist', scalar('SELECT COUNT(*) FROM channel_retention') > 0],
  ['valid date range', Boolean(scalar('SELECT MIN(date) FROM daily_operations')) && Boolean(scalar('SELECT MAX(date) FROM daily_operations'))],
  ['completion boundaries', scalar('SELECT COUNT(*) FROM daily_operations WHERE completion_rate_pct < 0 OR completion_rate_pct > 100') === 0],
  ['GMV boundaries', scalar('SELECT COUNT(*) FROM daily_operations WHERE gmv_sar < 0 OR subsidy_sar < 0') === 0],
  ['subsidy boundaries', scalar('SELECT COUNT(*) FROM subsidy_dimensions WHERE subsidy_total_sar < 0 OR related_gmv_sar < 0') === 0]
];
db.close();
const failed = checks.filter(([, passed]) => !passed);
checks.forEach(([name, passed]) => console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`));
if (failed.length) process.exitCode = 1;
