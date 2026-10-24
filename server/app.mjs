import { DatabaseSync } from 'node:sqlite';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import Busboy from 'busboy';
import { WorkbookImportError, importWorkbook } from './import-workbook.mjs';
import { loadDatabase } from '../scripts/load-database.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = join(root, 'runtime', 'operations.db');
const port = Number(process.env.PORT || 8787);
if (!existsSync(databasePath)) throw new Error('Database is missing. Run npm run db:load first.');
let db = new DatabaseSync(databasePath, { readOnly: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const sendJson = (response, payload, status = 200) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
};
const parseWorkbookUpload = (request) => new Promise((resolve, reject) => {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) return reject(new WorkbookImportError('请使用 Excel 文件上传表单。'));
  const parser = Busboy({ headers: request.headers, limits: { files: 1, fileSize: 15 * 1024 * 1024 } });
  const chunks = [];
  let filename = '';
  let rejected = '';
  parser.on('file', (field, file, info) => {
    if (field !== 'workbook' || filename) {
      rejected = '请只上传一个名为 workbook 的文件。';
      file.resume();
      return;
    }
    filename = info.filename || '';
    if (!filename.toLowerCase().endsWith('.xlsx')) rejected = '仅支持 .xlsx 格式工作簿。';
    file.on('data', (chunk) => chunks.push(chunk));
    file.on('limit', () => { rejected = '文件不能超过 15 MB。'; });
  });
  parser.on('error', () => reject(new WorkbookImportError('上传文件解析失败。')));
  parser.on('finish', () => {
    if (rejected) return reject(new WorkbookImportError(rejected));
    if (!filename || !chunks.length) return reject(new WorkbookImportError('未收到 Excel 文件。'));
    resolve(Buffer.concat(chunks));
  });
  request.pipe(parser);
});
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

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (request.method === 'POST' && url.pathname === '/api/import-workbook') {
      const buffer = await parseWorkbookUpload(request);
      const summary = await importWorkbook(buffer);
      loadDatabase();
      db.close();
      db = new DatabaseSync(databasePath, { readOnly: true });
      return sendJson(response, { status: 'ok', summary });
    }
    if (url.pathname === '/api/health') return sendJson(response, { status: 'ok', service: 'operations-data-api' });
    if (url.pathname === '/api/daily') return sendJson(response, filterRows(url, 'daily_operations', '*', [['city', 'city']], 'date, city'));
    if (url.pathname === '/api/subsidies') return sendJson(response, filterRows(url, 'subsidy_dimensions', '*', [['city', 'city'], ['subsidy_type', 'type'], ['user_type', 'user'], ['category', 'category']], 'date, city, subsidy_type, user_type, category'));
    if (url.pathname === '/api/retention') return sendJson(response, db.prepare('SELECT * FROM channel_retention ORDER BY registration_channel').all());
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const filePath = normalize(join(root, 'dist', requested));
    if (!filePath.startsWith(join(root, 'dist')) || !existsSync(filePath)) return sendJson(response, { error: 'Not found' }, 404);
    response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    const message = error instanceof WorkbookImportError ? error.message : '导入失败，请检查工作簿内容后重试。';
    console.error(error);
    return sendJson(response, { error: message }, error instanceof WorkbookImportError ? 400 : 500);
  }
}).listen(port, '127.0.0.1', () => console.log(`Operations data service listening on http://127.0.0.1:${port}`));
