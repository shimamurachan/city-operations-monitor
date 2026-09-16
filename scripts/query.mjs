import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = join(root, 'runtime', 'operations.db');
const sql = process.argv.slice(2).join(' ').trim();

if (!existsSync(databasePath)) throw new Error('数据库尚未生成，请先运行 npm run db:load。');
if (!sql) throw new Error('请在命令后写入查询，例如：npm run sql -- "SELECT * FROM daily_operations LIMIT 5"');
if (!/^(SELECT|PRAGMA|EXPLAIN)\b/i.test(sql) || sql.includes(';')) throw new Error('练习入口只允许单条只读查询（SELECT、PRAGMA 或 EXPLAIN）。');

const db = new DatabaseSync(databasePath, { readOnly: true });
const rows = db.prepare(sql).all();
db.close();
console.table(rows);
console.log(`返回 ${rows.length} 行`);
