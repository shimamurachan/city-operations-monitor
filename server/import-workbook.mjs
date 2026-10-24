import ExcelJS from 'exceljs';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'dist', 'data');

const sheets = {
  orders: '订单明细',
  users: '用户表',
  daily: '日度经营汇总',
  subsidies: '补贴汇总明细'
};

const requiredColumns = {
  [sheets.orders]: ['订单ID', '日期', '城市', '订单状态', '商品金额(SAR)'],
  [sheets.users]: ['用户ID', '注册渠道', '14天内订单数', '14天内消费(SAR)', '14天内复购', '获客成本(SAR)'],
  [sheets.daily]: ['日期', '城市', '订单总量', '完成订单', '取消订单', '总GMV(SAR)', '总补贴(SAR)', '完单率(%)', '补贴率(%)', '平均送达时长(分钟)', '新增用户数', '活跃骑手数', '平均评价'],
  [sheets.subsidies]: ['日期', '城市', '补贴类型', '用户类型', '商户品类', '补贴总金额(SAR)', '补贴订单数', '完成订单数', '关联GMV(SAR)']
};

export class WorkbookImportError extends Error {}

const text = (value) => String(value ?? '').trim();
const number = (value, label) => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(parsed)) throw new WorkbookImportError(`${label} 必须为有效数字。`);
  return parsed;
};
const isTruthy = (value) => ['是', 'yes', 'true', '1'].includes(text(value).toLowerCase());

function formatDate(value, label) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (!Number.isNaN(date.valueOf())) return date.toISOString().slice(0, 10);
  }
  const matched = text(value).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (matched) return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
  throw new WorkbookImportError(`${label} 必须为 YYYY-MM-DD 格式的日期。`);
}

function cellValue(value) {
  if (value && typeof value === 'object' && 'result' in value) return value.result;
  if (value && typeof value === 'object' && 'richText' in value) return value.richText.map((part) => part.text).join('');
  return value;
}

function getSheetRows(workbook, sheetName) {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) throw new WorkbookImportError(`缺少必需的 Sheet：${sheetName}。`);
  const headers = worksheet.getRow(1).values.slice(1).map((value) => text(cellValue(value)));
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    headers.forEach((header, index) => { if (header) item[header] = cellValue(row.getCell(index + 1).value); });
    if (Object.values(item).some((value) => value !== null && value !== undefined && text(value) !== '')) rows.push(item);
  });
  if (!rows.length) throw new WorkbookImportError(`${sheetName} 没有可导入的数据。`);
  const missing = requiredColumns[sheetName].filter((column) => !headers.includes(column));
  if (missing.length) throw new WorkbookImportError(`${sheetName} 缺少字段：${missing.join('、')}。`);
  return rows;
}

function uniqueKeys(rows, key, label) {
  const seen = new Set();
  rows.forEach((row) => {
    const value = key(row);
    if (seen.has(value)) throw new WorkbookImportError(`${label} 存在重复记录：${value}。`);
    seen.add(value);
  });
}

function buildDaily(rows) {
  const output = rows.map((row, index) => {
    const date = formatDate(row['日期'], `日度经营汇总第 ${index + 2} 行日期`);
    const city = text(row['城市']);
    if (!city) throw new WorkbookImportError(`日度经营汇总第 ${index + 2} 行缺少城市。`);
    const totalOrders = number(row['订单总量'], `日度经营汇总第 ${index + 2} 行订单总量`);
    const completedOrders = number(row['完成订单'], `日度经营汇总第 ${index + 2} 行完成订单`);
    const cancelledOrders = number(row['取消订单'], `日度经营汇总第 ${index + 2} 行取消订单`);
    if (totalOrders <= 0 || completedOrders < 0 || cancelledOrders < 0 || completedOrders + cancelledOrders > totalOrders) throw new WorkbookImportError(`日度经营汇总第 ${index + 2} 行订单状态数据不合理。`);
    return {
      date,
      city,
      total_orders: totalOrders,
      completed_orders: completedOrders,
      cancelled_orders: cancelledOrders,
      gmv_sar: number(row['总GMV(SAR)'], `日度经营汇总第 ${index + 2} 行总GMV`),
      subsidy_sar: number(row['总补贴(SAR)'], `日度经营汇总第 ${index + 2} 行总补贴`),
      completion_rate_pct: number(row['完单率(%)'], `日度经营汇总第 ${index + 2} 行完单率`),
      subsidy_rate_pct: number(row['补贴率(%)'], `日度经营汇总第 ${index + 2} 行补贴率`),
      avg_delivery_time_min: number(row['平均送达时长(分钟)'], `日度经营汇总第 ${index + 2} 行送达时长`),
      active_riders: number(row['活跃骑手数'], `日度经营汇总第 ${index + 2} 行活跃骑手数`),
      new_users: number(row['新增用户数'], `日度经营汇总第 ${index + 2} 行新增用户数`),
      avg_rating: number(row['平均评价'], `日度经营汇总第 ${index + 2} 行平均评价`)
    };
  });
  uniqueKeys(output, (row) => `${row.date}|${row.city}`, '日度经营汇总');
  return output.sort((a, b) => a.date.localeCompare(b.date) || a.city.localeCompare(b.city));
}

function buildSubsidies(rows) {
  const grouped = new Map();
  rows.forEach((row, index) => {
    const date = formatDate(row['日期'], `补贴汇总明细第 ${index + 2} 行日期`);
    const city = text(row['城市']);
    const subsidyType = text(row['补贴类型']);
    const userType = text(row['用户类型']);
    const category = text(row['商户品类']);
    if (![city, subsidyType, userType, category].every(Boolean)) throw new WorkbookImportError(`补贴汇总明细第 ${index + 2} 行存在空维度字段。`);
    const key = `${date}|${city}|${subsidyType}|${userType}|${category}`;
    const item = grouped.get(key) || { date, city, subsidy_type: subsidyType, user_type: userType, category, subsidy_total_sar: 0, subsidized_orders: 0, completed_orders: 0, related_gmv_sar: 0 };
    item.subsidy_total_sar += number(row['补贴总金额(SAR)'], `补贴汇总明细第 ${index + 2} 行补贴金额`);
    item.subsidized_orders += number(row['补贴订单数'], `补贴汇总明细第 ${index + 2} 行补贴订单数`);
    item.completed_orders += number(row['完成订单数'], `补贴汇总明细第 ${index + 2} 行完成订单数`);
    item.related_gmv_sar += number(row['关联GMV(SAR)'], `补贴汇总明细第 ${index + 2} 行关联GMV`);
    grouped.set(key, item);
  });
  return [...grouped.values()].map((row) => ({
    ...row,
    avg_subsidy_sar: row.subsidized_orders ? row.subsidy_total_sar / row.subsidized_orders : 0,
    subsidy_gmv_ratio: row.related_gmv_sar ? row.subsidy_total_sar / row.related_gmv_sar : 0
  })).sort((a, b) => a.date.localeCompare(b.date) || a.city.localeCompare(b.city));
}

function buildRetention(rows) {
  const grouped = new Map();
  rows.forEach((row, index) => {
    const channel = text(row['注册渠道']);
    if (!channel) throw new WorkbookImportError(`用户表第 ${index + 2} 行缺少注册渠道。`);
    const orders = number(row['14天内订单数'], `用户表第 ${index + 2} 行14天内订单数`);
    if (orders <= 0) return;
    const item = grouped.get(channel) || { registration_channel: channel, active_users: 0, repeat_users: 0, total_orders: 0, total_spend: 0, total_subsidy: 0, total_cac: 0, first_order_subsidy_users: 0 };
    item.active_users += 1;
    item.repeat_users += isTruthy(row['14天内复购']) ? 1 : 0;
    item.total_orders += orders;
    item.total_spend += number(row['14天内消费(SAR)'], `用户表第 ${index + 2} 行14天内消费`);
    item.total_subsidy += number(row['14天内补贴(SAR)'], `用户表第 ${index + 2} 行14天内补贴`);
    item.total_cac += number(row['获客成本(SAR)'], `用户表第 ${index + 2} 行获客成本`);
    item.first_order_subsidy_users += isTruthy(row['首单是否补贴']) ? 1 : 0;
    grouped.set(channel, item);
  });
  if (!grouped.size) throw new WorkbookImportError('用户表中没有14天内订单数大于0的活跃用户。');
  return [...grouped.values()].map((row) => {
    const avgSpend = row.total_spend / row.active_users;
    const cac = row.total_cac / row.active_users;
    const ltvCac = cac ? avgSpend / cac : 0;
    return {
      registration_channel: row.registration_channel,
      active_users: row.active_users,
      repeat_users: row.repeat_users,
      avg_orders_14d: row.total_orders / row.active_users,
      avg_spend_14d_sar: avgSpend,
      avg_subsidy_14d_sar: row.total_subsidy / row.active_users,
      cac_sar: cac,
      first_order_subsidy_rate: row.first_order_subsidy_users / row.active_users,
      repeat_rate: row.repeat_users / row.active_users,
      ltv_cac: ltvCac,
      rating: ltvCac >= 1 ? '健康' : '亏损'
    };
  }).sort((a, b) => a.registration_channel.localeCompare(b.registration_channel, 'zh-CN'));
}

function writeJson(name, data) {
  mkdirSync(outputDir, { recursive: true });
  const target = join(outputDir, name);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  renameSync(temporary, target);
}

export async function importWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new WorkbookImportError('无法读取工作簿，请上传未加密的 .xlsx 文件。');
  }
  const orders = getSheetRows(workbook, sheets.orders);
  const users = getSheetRows(workbook, sheets.users);
  const daily = buildDaily(getSheetRows(workbook, sheets.daily));
  const subsidies = buildSubsidies(getSheetRows(workbook, sheets.subsidies));
  const retention = buildRetention(users);
  const orderIds = orders.map((row) => text(row['订单ID']));
  if (orderIds.some((id) => !id)) throw new WorkbookImportError('订单明细存在空订单ID。');
  if (new Set(orderIds).size !== orderIds.length) throw new WorkbookImportError('订单明细存在重复订单ID。');

  writeJson('daily_monitoring.json', daily);
  writeJson('subsidy_dimension.json', subsidies);
  writeJson('retention_summary.json', retention);
  return {
    orders: orders.length,
    users: users.length,
    dailyRecords: daily.length,
    subsidyRecords: subsidies.length,
    channels: retention.length,
    dateRange: `${daily[0].date} 至 ${daily[daily.length - 1].date}`
  };
}
