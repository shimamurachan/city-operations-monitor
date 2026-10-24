(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const asNumber = (value) => Number(value || 0);
  const sum = (rows, field) => rows.reduce((total, row) => total + asNumber(row[field]), 0);
  const unique = (values) => [...new Set(values)].sort();
  const formatNumber = (value) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
  const formatSar = (value) => `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)} SAR`;
  const formatPct = (value) => `${Number(value).toFixed(1)}%`;
  const formatOne = (value) => Number(value).toFixed(1);
  const shortDate = (date) => date ? date.slice(5).replace('-', '/') : '';

  async function loadData(path, apiPath) {
    const isLocalService = ['127.0.0.1', 'localhost'].includes(window.location.hostname) && window.location.port === '8787';
    const response = await fetch(isLocalService && apiPath ? apiPath : path);
    if (!response.ok) throw new Error('数据文件暂时无法加载');
    return response.json();
  }

  function setFeedback(message = '') {
    const feedback = $('#feedback');
    if (feedback) feedback.textContent = message;
  }

  function setText(id, value, note = '') {
    const element = $(`#${id}`);
    const noteElement = $(`#${id}-note`);
    if (element) element.textContent = value;
    if (noteElement) noteElement.textContent = note;
  }

  function activateNav() {
    const page = document.body.dataset.page;
    $$('[data-nav]').forEach((item) => item.classList.toggle('active', item.dataset.nav === page));
  }

  function setDateLimits(start, end, dates) {
    const min = dates[0];
    const max = dates[dates.length - 1];
    [start, end].forEach((input) => {
      input.min = min;
      input.max = max;
    });
    start.value = min;
    end.value = max;
    return { min, max };
  }

  function validateRange(start, end) {
    if (start > end) {
      setFeedback('开始日期不能晚于结束日期，请调整后重新查看。');
      return false;
    }
    setFeedback('');
    return true;
  }

  function createSvg(name, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function renderLineChart(hostSelector, points, options) {
    const host = $(hostSelector);
    if (!host) return;
    host.innerHTML = '';
    if (!points.length) {
      host.innerHTML = '<div class="empty-state">当前筛选条件下没有趋势数据</div>';
      return;
    }

    const width = Math.max(320, Math.floor(host.getBoundingClientRect().width || 720));
    const height = 300;
    const margin = { top: 22, right: 20, bottom: 48, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const values = points.map((point) => asNumber(point.value));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const spread = rawMax - rawMin;
    const padding = spread ? spread * 0.14 : Math.max(Math.abs(rawMax) * 0.12, 1);
    const minimum = options.minZero ? 0 : Math.max(0, rawMin - padding);
    const maximum = rawMax + padding;
    const x = (index) => margin.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = (value) => margin.top + innerHeight - ((value - minimum) / Math.max(maximum - minimum, 1)) * innerHeight;
    const svg = createSvg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': options.label });

    for (let tick = 0; tick <= 4; tick += 1) {
      const value = minimum + ((maximum - minimum) * tick) / 4;
      const position = y(value);
      svg.append(createSvg('line', { x1: margin.left, x2: width - margin.right, y1: position, y2: position, stroke: '#1e3447', 'stroke-width': 1 }));
      const text = createSvg('text', { x: margin.left - 9, y: position + 4, 'text-anchor': 'end', fill: '#8ea7b8', 'font-size': 11 });
      text.textContent = options.format(value);
      svg.append(text);
    }

    const step = Math.max(1, Math.ceil(points.length / 7));
    points.forEach((point, index) => {
      if (index % step !== 0 && index !== points.length - 1) return;
      const text = createSvg('text', { x: x(index), y: height - 17, 'text-anchor': 'middle', fill: '#8ea7b8', 'font-size': 11 });
      text.textContent = shortDate(point.label);
      svg.append(text);
    });

    const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(asNumber(point.value))}`).join(' ');
    svg.append(createSvg('path', { d: path, fill: 'none', stroke: options.color || '#4ed7a5', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    points.forEach((point, index) => svg.append(createSvg('circle', { cx: x(index), cy: y(asNumber(point.value)), r: 3.5, fill: options.color || '#4ed7a5', stroke: '#071320', 'stroke-width': 2 })));
    host.append(svg);
  }

  function renderBars(hostSelector, rows, valueField, formatter) {
    const host = $(hostSelector);
    if (!host) return;
    host.innerHTML = '';
    if (!rows.length) {
      host.innerHTML = '<div class="empty-state">当前筛选条件下没有数据</div>';
      return;
    }
    const max = Math.max(...rows.map((row) => asNumber(row[valueField])), 1);
    rows.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'bar-row';
      item.innerHTML = `<div class="bar-label">${row.label}</div><div class="bar-track"><span style="width:${(asNumber(row[valueField]) / max) * 100}%"></span></div><div class="bar-value">${formatter(asNumber(row[valueField]))}</div>`;
      host.append(item);
    });
  }

  function dailyAggregate(rows) {
    const orders = sum(rows, 'total_orders');
    const completed = sum(rows, 'completed_orders');
    const cancelled = sum(rows, 'cancelled_orders');
    const gmv = sum(rows, 'gmv_sar');
    const subsidy = sum(rows, 'subsidy_sar');
    return {
      orders, completed, cancelled, gmv, subsidy,
      completion: orders ? (completed / orders) * 100 : 0,
      cancellation: orders ? (cancelled / orders) * 100 : 0,
      subsidyRate: gmv ? (subsidy / gmv) * 100 : 0,
      delivery: orders ? rows.reduce((total, row) => total + asNumber(row.avg_delivery_time_min) * asNumber(row.total_orders), 0) / orders : 0,
      riders: rows.length ? sum(rows, 'active_riders') / rows.length : 0,
      rating: orders ? rows.reduce((total, row) => total + asNumber(row.avg_rating) * asNumber(row.total_orders), 0) / orders : 0
    };
  }

  function dailyTrend(rows, city) {
    const grouped = new Map();
    rows.forEach((row) => {
      if (!grouped.has(row.date)) grouped.set(row.date, []);
      grouped.get(row.date).push(row);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => {
      const agg = dailyAggregate(values);
      return { label: date, gmv: agg.gmv, completion: agg.completion, subsidy: agg.subsidyRate, delivery: agg.delivery, cancellation: agg.cancellation, rating: agg.rating };
    });
  }

  function renderAlertTable(rows, bodySelector) {
    const body = $(bodySelector);
    if (!body) return;
    const alerts = rows.filter((row) => asNumber(row.completion_rate_pct) < 85 || asNumber(row.subsidy_rate_pct) > 10 || asNumber(row.avg_delivery_time_min) > 35);
    if (!alerts.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-cell">筛选范围内没有触发预警的城市日数据</td></tr>';
      return;
    }
    body.innerHTML = alerts.map((row) => {
      const rules = [];
      if (asNumber(row.completion_rate_pct) < 85) rules.push('完单率低于 85%');
      if (asNumber(row.subsidy_rate_pct) > 10) rules.push('补贴率高于 10%');
      if (asNumber(row.avg_delivery_time_min) > 35) rules.push('送达时长超过 35 分钟');
      return `<tr><td>${shortDate(row.date)}</td><td>${row.city}</td><td>${formatPct(row.completion_rate_pct)}</td><td>${formatPct(row.subsidy_rate_pct)}</td><td>${formatOne(row.avg_delivery_time_min)} 分钟</td><td><span class="status danger">${rules.join('、')}</span></td></tr>`;
    }).join('');
  }

  async function initDashboard() {
    const rows = await loadData('data/daily_monitoring.json', '/api/daily');
    const cityInput = $('#city-filter');
    const startInput = $('#start-date');
    const endInput = $('#end-date');
    const dates = unique(rows.map((row) => row.date));
    const cities = unique(rows.map((row) => row.city));
    cities.forEach((city) => cityInput.insertAdjacentHTML('beforeend', `<option value="${city}">${city}</option>`));
    const range = setDateLimits(startInput, endInput, dates);
    let metric = 'gmv';

    function update() {
      const start = startInput.value;
      const end = endInput.value;
      if (!validateRange(start, end)) return;
      const filtered = rows.filter((row) => (cityInput.value === '全部城市' || row.city === cityInput.value) && row.date >= start && row.date <= end);
      if (!filtered.length) {
        ['kpi-orders', 'kpi-gmv', 'kpi-completion', 'kpi-subsidy', 'kpi-delivery', 'kpi-riders'].forEach((id) => setText(id, '—', '无匹配数据'));
        renderLineChart('#dashboard-chart', [], { label: '趋势图', format: formatNumber });
        renderAlertTable([], '#alert-body');
        setFeedback('当前筛选范围内没有数据。');
        return;
      }
      const agg = dailyAggregate(filtered);
      const dayCount = unique(filtered.map((row) => row.date)).length;
      setText('kpi-orders', formatNumber(agg.orders), `${dayCount} 天合计`);
      setText('kpi-gmv', formatSar(agg.gmv), '筛选范围内 GMV');
      setText('kpi-completion', formatPct(agg.completion), '完成订单 ÷ 订单量');
      setText('kpi-subsidy', formatPct(agg.subsidyRate), '补贴金额 ÷ GMV');
      setText('kpi-delivery', `${formatOne(agg.delivery)} 分钟`, '按订单量加权');
      setText('kpi-riders', formatOne(agg.riders), '日均活跃骑手');
      const trends = dailyTrend(filtered, cityInput.value);
      const settings = {
        gmv: { label: 'GMV 趋势', format: formatSar, color: '#5b8cff', minZero: true },
        completion: { label: '完单率趋势', format: formatPct, color: '#4ed7a5', minZero: false },
        subsidy: { label: '补贴率趋势', format: formatPct, color: '#fbba47', minZero: true },
        delivery: { label: '送达时长趋势', format: (value) => formatOne(value), color: '#f472b6', minZero: false }
      }[metric];
      renderLineChart('#dashboard-chart', trends.map((row) => ({ label: row.label, value: row[metric] })), settings);
      $('#trend-title').textContent = settings.label;
      renderAlertTable(filtered, '#alert-body');
    }

    $('#monitor-form').addEventListener('submit', (event) => { event.preventDefault(); update(); });
    $$('[data-dashboard-metric]').forEach((button) => button.addEventListener('click', () => {
      metric = button.dataset.dashboardMetric;
      $$('[data-dashboard-metric]').forEach((item) => item.classList.toggle('selected', item === button));
      update();
    }));
    $$('[data-range]').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.range === 'all') {
        startInput.value = range.min;
        endInput.value = range.max;
      } else {
        startInput.value = dates[Math.max(0, dates.length - 7)];
        endInput.value = range.max;
      }
      $$('[data-range]').forEach((item) => item.classList.toggle('selected', item === button));
      update();
    }));
    update();
  }

  async function initFulfillment() {
    const rows = await loadData('data/daily_monitoring.json', '/api/daily');
    const cityInput = $('#fulfillment-city');
    const startInput = $('#fulfillment-start');
    const endInput = $('#fulfillment-end');
    const dates = unique(rows.map((row) => row.date));
    unique(rows.map((row) => row.city)).forEach((city) => cityInput.insertAdjacentHTML('beforeend', `<option value="${city}">${city}</option>`));
    cityInput.value = '吉达';
    setDateLimits(startInput, endInput, dates);
    let metric = 'completion';

    function update() {
      const start = startInput.value;
      const end = endInput.value;
      if (!validateRange(start, end)) return;
      const filtered = rows.filter((row) => row.city === cityInput.value && row.date >= start && row.date <= end);
      if (!filtered.length) {
        ['fulfill-completion', 'fulfill-cancel', 'fulfill-delivery', 'fulfill-rating', 'fulfill-riders'].forEach((id) => setText(id, '—', '无匹配数据'));
        renderLineChart('#fulfillment-chart', [], { label: '履约趋势', format: formatNumber });
        renderAlertTable([], '#fulfillment-alert-body');
        return;
      }
      const agg = dailyAggregate(filtered);
      setText('fulfill-completion', formatPct(agg.completion), '完成订单 ÷ 订单量');
      setText('fulfill-cancel', formatPct(agg.cancellation), '取消订单 ÷ 订单量');
      setText('fulfill-delivery', `${formatOne(agg.delivery)} 分钟`, '按订单量加权');
      setText('fulfill-rating', formatOne(agg.rating), '按订单量加权');
      setText('fulfill-riders', formatOne(agg.riders), '日均活跃骑手');
      const trends = dailyTrend(filtered);
      const settings = {
        completion: { label: '完单率趋势', format: formatPct, color: '#4ed7a5' },
        cancellation: { label: '取消率趋势', format: formatPct, color: '#ff6b6b' },
        delivery: { label: '送达时长趋势', format: (value) => formatOne(value), color: '#f472b6' },
        rating: { label: '用户评分趋势', format: formatOne, color: '#5b8cff' }
      }[metric];
      $('#fulfillment-chart-title').textContent = settings.label;
      renderLineChart('#fulfillment-chart', trends.map((row) => ({ label: row.label, value: row[metric] })), settings);
      renderAlertTable(filtered, '#fulfillment-alert-body');
    }
    $('#fulfillment-form').addEventListener('submit', (event) => { event.preventDefault(); update(); });
    $$('[data-fulfillment-metric]').forEach((button) => button.addEventListener('click', () => {
      metric = button.dataset.fulfillmentMetric;
      $$('[data-fulfillment-metric]').forEach((item) => item.classList.toggle('selected', item === button));
      update();
    }));
    update();
  }

  async function initSubsidy() {
    const rows = (await loadData('data/subsidy_dimension.json', '/api/subsidies')).map((row) => ({ ...row, city: row.city || '利雅得' }));
    const startInput = $('#subsidy-start');
    const endInput = $('#subsidy-end');
    const cityInput = $('#subsidy-city');
    const typeInput = $('#subsidy-type');
    const userInput = $('#subsidy-user');
    const categoryInput = $('#subsidy-category');
    const dates = unique(rows.map((row) => row.date));
    setDateLimits(startInput, endInput, dates);
    unique(rows.map((row) => row.city)).forEach((value) => cityInput.insertAdjacentHTML('beforeend', `<option value="${value}">${value}</option>`));
    [['subsidy_type', typeInput], ['user_type', userInput], ['category', categoryInput]].forEach(([field, input]) => unique(rows.map((row) => row[field])).forEach((value) => input.insertAdjacentHTML('beforeend', `<option value="${value}">${value}</option>`)));
    let groupBy = 'category';

    function update() {
      const start = startInput.value;
      const end = endInput.value;
      if (!validateRange(start, end)) return;
      const filtered = rows.filter((row) => row.date >= start && row.date <= end && (!cityInput.value || row.city === cityInput.value) && (!typeInput.value || row.subsidy_type === typeInput.value) && (!userInput.value || row.user_type === userInput.value) && (!categoryInput.value || row.category === categoryInput.value));
      const subsidy = sum(filtered, 'subsidy_total_sar');
      const gmv = sum(filtered, 'related_gmv_sar');
      const orders = sum(filtered, 'subsidized_orders');
      setText('subsidy-total', filtered.length ? formatSar(subsidy) : '—', '补贴明细汇总');
      setText('subsidy-gmv', filtered.length ? formatSar(gmv) : '—', '关联 GMV');
      setText('subsidy-rate', filtered.length ? formatPct(gmv ? subsidy / gmv * 100 : 0) : '—', '补贴金额 ÷ 关联 GMV');
      setText('subsidy-orders', filtered.length ? formatNumber(orders) : '—', '补贴订单数');
      setText('subsidy-average', filtered.length ? formatSar(orders ? subsidy / orders : 0) : '—', '补贴订单单均');
      const grouped = new Map();
      filtered.forEach((row) => {
        const label = row[groupBy];
        if (!grouped.has(label)) grouped.set(label, { label, subsidy: 0, gmv: 0, orders: 0 });
        const target = grouped.get(label);
        target.subsidy += asNumber(row.subsidy_total_sar);
        target.gmv += asNumber(row.related_gmv_sar);
        target.orders += asNumber(row.subsidized_orders);
      });
      const groupRows = [...grouped.values()].map((row) => ({ ...row, rate: row.gmv ? row.subsidy / row.gmv * 100 : 0 })).sort((a, b) => b.subsidy - a.subsidy);
      renderBars('#subsidy-bars', groupRows, 'subsidy', formatSar);
      $('#subsidy-group-title').textContent = `按${{ category: '品类', subsidy_type: '补贴类型', user_type: '用户类型' }[groupBy]}拆解`;
      const body = $('#subsidy-body');
      body.innerHTML = groupRows.length ? groupRows.map((row) => `<tr><td>${row.label}</td><td>${formatSar(row.subsidy)}</td><td>${formatNumber(row.orders)}</td><td>${formatSar(row.gmv)}</td><td>${formatPct(row.rate)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-cell">当前筛选条件下没有补贴明细</td></tr>';
      if (!filtered.length) setFeedback('当前筛选范围内没有补贴明细。');
    }
    $('#subsidy-form').addEventListener('submit', (event) => { event.preventDefault(); update(); });
    $$('[data-group-by]').forEach((button) => button.addEventListener('click', () => {
      groupBy = button.dataset.groupBy;
      $$('[data-group-by]').forEach((item) => item.classList.toggle('selected', item === button));
      update();
    }));
    update();
  }

  async function initRetention() {
    const rows = await loadData('data/retention_summary.json', '/api/retention');
    const channelInput = $('#channel-filter');
    rows.forEach((row) => channelInput.insertAdjacentHTML('beforeend', `<option value="${row.registration_channel}">${row.registration_channel}</option>`));
    let metric = 'repeat_rate';
    const metrics = {
      repeat_rate: { title: '渠道复购率对比', format: (value) => formatPct(value * 100) },
      ltv_cac: { title: '渠道 LTV/CAC 对比', format: (value) => formatOne(value) },
      avg_spend_14d_sar: { title: '14 天消费金额对比', format: formatSar },
      cac_sar: { title: '获客成本对比', format: formatSar }
    };

    function update() {
      const selected = rows.find((row) => row.registration_channel === channelInput.value) || rows[0];
      setText('channel-active', formatNumber(selected.active_users), '14 天内有下单用户');
      setText('channel-repeat', formatPct(selected.repeat_rate * 100), '复购用户 ÷ 活跃用户');
      setText('channel-spend', formatSar(selected.avg_spend_14d_sar), '14 天消费金额均值');
      setText('channel-ltv', formatOne(selected.ltv_cac), '14 天消费金额代理值 ÷ CAC');
      setText('channel-cac', formatSar(selected.cac_sar), '单个获客成本');
      const config = metrics[metric];
      $('#channel-chart-title').textContent = config.title;
      renderBars('#channel-bars', rows.map((row) => ({ label: row.registration_channel, [metric]: row[metric] })), metric, config.format);
      $('#channel-body').innerHTML = rows.map((row) => `<tr class="${row.registration_channel === selected.registration_channel ? 'highlight' : ''}"><td>${row.registration_channel}</td><td>${formatNumber(row.active_users)}</td><td>${formatPct(row.repeat_rate * 100)}</td><td>${formatSar(row.avg_spend_14d_sar)}</td><td>${formatOne(row.ltv_cac)}</td><td>${formatSar(row.cac_sar)}</td></tr>`).join('');
    }
    channelInput.addEventListener('change', update);
    $$('[data-channel-metric]').forEach((button) => button.addEventListener('click', () => {
      metric = button.dataset.channelMetric;
      $$('[data-channel-metric]').forEach((item) => item.classList.toggle('selected', item === button));
      update();
    }));
    update();
  }

  function initImport() {
    const form = $('#import-form');
    if (!form) return;
    const status = $('#import-status');
    const button = $('#import-button');
    const isLocalService = ['127.0.0.1', 'localhost'].includes(window.location.hostname) && window.location.port === '8787';
    if (!isLocalService) {
      button.disabled = true;
      status.textContent = '数据上传仅在本地服务模式提供。请运行 npm run api 后访问 http://127.0.0.1:8787/data.html。';
      return;
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = $('#workbook-file').files[0];
      if (!file) {
        status.textContent = '请选择一个 .xlsx 文件。';
        return;
      }
      button.disabled = true;
      status.textContent = '正在校验并导入数据，请稍候…';
      try {
        const payload = new FormData();
        payload.append('workbook', file);
        const response = await fetch('/api/import-workbook', { method: 'POST', body: payload });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '导入失败。');
        const { summary } = result;
        status.textContent = `导入完成：${summary.orders.toLocaleString()} 笔订单、${summary.users.toLocaleString()} 名用户、${summary.dailyRecords} 条城市日记录、${summary.subsidyRecords} 条补贴记录，日期范围为 ${summary.dateRange}。刷新其他页面即可查看新数据。`;
        form.reset();
      } catch (error) {
        status.textContent = error.message || '导入失败，请检查文件格式。';
      } finally {
        button.disabled = false;
      }
    });
  }

  async function init() {
    activateNav();
    try {
      const page = document.body.dataset.page;
      if (page === 'dashboard') await initDashboard();
      if (page === 'fulfillment') await initFulfillment();
      if (page === 'subsidy') await initSubsidy();
      if (page === 'retention') await initRetention();
      if (page === 'import') initImport();
    } catch (error) {
      setFeedback('页面数据加载失败，请刷新后重试。');
      console.error(error);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
