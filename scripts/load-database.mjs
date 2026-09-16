import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = join(root, 'runtime', 'operations.db');
const readJson = (name) => JSON.parse(readFileSync(join(root, 'dist', 'data', name), 'utf8'));
const daily = readJson('daily_monitoring.json');
const subsidy = readJson('subsidy_dimension.json');
const retention = readJson('retention_summary.json');

mkdirSync(dirname(databasePath), { recursive: true });
rmSync(databasePath, { force: true });
const db = new DatabaseSync(databasePath);
db.exec(readFileSync(join(root, 'server', 'schema.sql'), 'utf8'));

const dailyInsert = db.prepare(`INSERT INTO daily_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const subsidyInsert = db.prepare(`INSERT INTO subsidy_dimensions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const retentionInsert = db.prepare(`INSERT INTO channel_retention VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
db.exec('BEGIN');
try {
  daily.forEach((row) => dailyInsert.run(row.date, row.city, row.total_orders, row.completed_orders, row.cancelled_orders, row.gmv_sar, row.subsidy_sar, row.completion_rate_pct, row.subsidy_rate_pct, row.avg_delivery_time_min, row.active_riders, row.new_users, row.avg_rating));
  subsidy.forEach((row) => subsidyInsert.run(row.date, row.subsidy_type, row.user_type, row.category, row.subsidy_total_sar, row.subsidized_orders, row.completed_orders, row.related_gmv_sar, row.avg_subsidy_sar, row.subsidy_gmv_ratio));
  retention.forEach((row) => retentionInsert.run(row.registration_channel, row.active_users, row.repeat_users, row.avg_orders_14d, row.avg_spend_14d_sar, row.avg_subsidy_14d_sar, row.cac_sar, row.first_order_subsidy_rate, row.repeat_rate, row.ltv_cac, row.rating));
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
db.exec('PRAGMA optimize');
db.close();
console.log(`Loaded ${daily.length} city-day records, ${subsidy.length} subsidy records and ${retention.length} channel records.`);
