import { DatabaseSync } from 'node:sqlite';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = join(root, 'runtime', 'operations.db');
const port = Number(process.env.PORT || 8787);
if (!existsSync(databasePath)) throw new Error('Database is missing. Run npm run db:load first.');
const db = new DatabaseSync(databasePath, { readOnly: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const sendJson = (response, payload, status = 200) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
};
const filterRows = (url, table, columns, filters, orderBy) => {
  const clauses = [];
  const params = [];
  filters.forEach(([field, parameter]) => {
    const value = url.searchParams.get(parameter);
    if (value) { clauses.push(`${field} = ?`); params.push(value); }
  });
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (start) { clauses.push('date >= ?'); params.push(start); }
  if (end) { clauses.push('date <= ?'); params.push(end); }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT ${columns} FROM ${table}${where} ORDER BY ${orderBy}`).all(...params);
};

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/health') return sendJson(response, { status: 'ok', service: 'operations-data-api' });
  if (url.pathname === '/api/daily') return sendJson(response, filterRows(url, 'daily_operations', '*', [['city', 'city']], 'date, city'));
  if (url.pathname === '/api/subsidies') return sendJson(response, filterRows(url, 'subsidy_dimensions', '*', [['subsidy_type', 'type'], ['user_type', 'user'], ['category', 'category']], 'date, subsidy_type, user_type, category'));
  if (url.pathname === '/api/retention') return sendJson(response, db.prepare('SELECT * FROM channel_retention ORDER BY registration_channel').all());
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const filePath = normalize(join(root, 'dist', requested));
  if (!filePath.startsWith(join(root, 'dist')) || !existsSync(filePath)) return sendJson(response, { error: 'Not found' }, 404);
  response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Operations data service listening on http://127.0.0.1:${port}`));
