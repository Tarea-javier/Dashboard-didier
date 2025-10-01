/* main.js - Dashboard Numismática (auto Excel) */
'use strict';

// =============== Utilidades de formato y fechas ==================
const numberLike = v =>
  v !== null && v !== undefined && v !== '' && !isNaN(+(`${v}`.replace?.(/[, ]/g, '') || v));

const parseNumber = v => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[\s$,MXN]/gi, '').replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

function excelSerialToDate(n) {
  if (typeof n !== 'number' || n <= 0) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d) ? null : d;
}

function parseDateSmart(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'number') {
    const d = excelSerialToDate(v);
    if (d) return d;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const normStr = s =>
  String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const fmtMoney = n =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

const fmtInt = n => (n == null ? '—' : Number(n).toLocaleString('es-MX'));

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNamesES = { Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié', Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb', Sunday: 'Dom' };

// ===================== Autocarga del Excel =======================
window.addEventListener('DOMContentLoaded', autoLoadExcel);

async function autoLoadExcel() {
  try {
    const res = await fetch('data/ventas.xlsx');
    if (!res.ok) throw new Error('No se encontró data/ventas.xlsx');
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const data = normalizeRows(rows);
    renderAll(data);
  } catch (err) {
    console.error(err);
    emptyState(
      'No se pudo cargar <code>data/ventas.xlsx</code>.<br/>Sirve el sitio con un servidor local y confirma que el archivo exista.'
    );
  }
}

function emptyState(msg) {
  const grid = document.querySelector('.grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="card col-12" style="min-height:160px;display:flex;justify-content:center;align-items:center">
      <div style="color:#6b7280;text-align:center">${msg}</div>
    </div>`;
}

// ===================== Normalización de filas ====================
function normalizeRows(rows) {
  const out = [];

  for (const r of rows) {
    const fechaVenta = parseDateSmart(r['Fecha Venta']);
    const fechaCamino = parseDateSmart(r['FechaCamino']);
    const fechaEntrega = parseDateSmart(r['FechaEntrega']);

    const publicidadRaw = normStr(r['Venta por publicidad']);
    const publicidad = {
      si: true,
      'sí': true,
      yes: true,
      true: true,
      '1': true,
      no: false,
      false: false,
      '0': false
    }[publicidadRaw];

    const total = parseNumber(r['Total (MXN)']);
    const ingresosProd = parseNumber(r['Ingresos por productos (MXN)']);
    const unidades = parseNumber(r['Unidades']);
    const precioUnit = parseNumber(r['Precio unitario de venta de la publicación (MXN)']);
    const cargoVentaImp = parseNumber(r['Cargo por venta e impuestos']);
    const costosEnvio = parseNumber(r['Costos de envío']);

    const idProducto = r['IDproducto'] ?? '';
    const estado = r['Estado'] ?? '';
    const municipio = r['Municipio/Alcaldía'] ?? r['Municipio/Alcaldia'] ?? '';

    const ventasAbs = total != null ? Math.abs(total) : null;

    let tiempoEntrega = null;
    if (fechaVenta && fechaEntrega) {
      const days = (fechaEntrega - fechaVenta) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days <= 60) tiempoEntrega = +days.toFixed(2);
    }

    const anoMes = fechaVenta ? `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, '0')}` : null;
    const diaSemana = fechaVenta ? dayNames[fechaVenta.getDay()] : null;
    const mesNombre = fechaVenta ? fechaVenta.toLocaleString('es-MX', { month: 'long' }) : null;

    const margenOperativo = (ingresosProd ?? 0) + (cargoVentaImp ?? 0) + (costosEnvio ?? 0);

    out.push({
      fechaVenta,
      fechaCamino,
      fechaEntrega,
      publicidad,
      total,
      ingresosProd,
      unidades,
      precioUnit,
      cargoVentaImp,
      costosEnvio,
      idProducto,
      estado,
      municipio,
      ventasAbs,
      tiempoEntrega,
      anoMes,
      diaSemana,
      mesNombre,
      margenOperativo,
      fechaCorta: fechaVenta ? fechaVenta.toISOString().slice(0, 10) : null
    });
  }

  const fechas = out.map(d => d.fechaVenta).filter(Boolean).sort((a, b) => a - b);
  const periodo =
    fechas.length ? `${fechas[0].toISOString().slice(0, 10)} a ${fechas[fechas.length - 1].toISOString().slice(0, 10)}` : '—';
  const periodoEl = document.getElementById('periodo');
  if (periodoEl) periodoEl.textContent = `Periodo: ${periodo}`;

  return out;
}

// ================= Helpers de agregación =========================
function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}
const sum = arr => arr.reduce((a, b) => a + (b ?? 0), 0);

// ================== Gráficas (componentes) ======================
const CHART_COLORS = {
  primary: '#4f46e5',
  secondary: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6'
};

function baseChart(el) {
  const dom = document.getElementById(el);
  if (!dom) return null;
  const c = echarts.init(dom, null, { renderer: 'canvas' });
  window.addEventListener('resize', () => c.resize());
  return c;
}

function bar(id, x, y, { rotate = 0, formatter = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' }, 
      valueFormatter: formatter,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 10, bottom: 60, containLabel: true },
    xAxis: { 
      type: 'category', 
      data: x, 
      axisLabel: { rotate, color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: { 
      type: 'value', 
      axisLabel: { formatter, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [{ 
      type: 'bar', 
      data: y, 
      barMaxWidth: 36,
      itemStyle: { color: CHART_COLORS.primary }
    }]
  });
}

function barh(id, yCats, xVals, { formatter = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' }, 
      valueFormatter: formatter,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 10, bottom: 10, containLabel: true },
    xAxis: { 
      type: 'value', 
      axisLabel: { formatter, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    yAxis: { 
      type: 'category', 
      data: yCats,
      axisLabel: { color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    series: [{ 
      type: 'bar', 
      data: xVals, 
      barMaxWidth: 20,
      itemStyle: { color: CHART_COLORS.secondary }
    }]
  });
}

function pie(id, data) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'item', 
      valueFormatter: v => fmtMoney(v),
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        label: { 
          formatter: '{b}\n{d}%',
          color: '#374151'
        },
        data,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        }
      }
    ]
  });
}

function line(id, x, y, { formatter = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'axis', 
      valueFormatter: formatter,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 10, bottom: 30, containLabel: true },
    xAxis: { 
      type: 'category', 
      data: x,
      axisLabel: { color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: { 
      type: 'value', 
      axisLabel: { formatter, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [{ 
      type: 'line', 
      data: y, 
      smooth: true, 
      symbol: 'circle', 
      symbolSize: 8,
      lineStyle: { width: 3, color: CHART_COLORS.primary },
      itemStyle: { color: CHART_COLORS.primary }
    }]
  });
}

function barGrouped(id, x, series, { rotate = 0, formatter = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  const colors = [CHART_COLORS.secondary, CHART_COLORS.primary];
  c.setOption({
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' }, 
      valueFormatter: formatter,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    legend: { 
      top: 0,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 30, bottom: 60, containLabel: true },
    xAxis: { 
      type: 'category', 
      data: x, 
      axisLabel: { rotate, color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: { 
      type: 'value', 
      axisLabel: { formatter, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: series.map((s, i) => ({ 
      type: 'bar', 
      name: s.name, 
      data: s.data, 
      barMaxWidth: 18,
      itemStyle: { color: colors[i % colors.length] }
    }))
  });
}

function dualBar(id, cats, ventas, unidades, { fmtLeft = v => v, fmtRight = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    legend: { 
      top: 0,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 30, bottom: 18, containLabel: true },
    xAxis: { 
      type: 'category', 
      data: cats,
      axisLabel: { color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: [
      { 
        type: 'value', 
        name: 'Ventas', 
        axisLabel: { formatter: fmtLeft, color: '#6b7280' },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
        nameTextStyle: { color: '#374151' }
      },
      { 
        type: 'value', 
        name: 'Unidades', 
        axisLabel: { formatter: fmtRight, color: '#6b7280' },
        splitLine: { show: false },
        nameTextStyle: { color: '#374151' }
      }
    ],
    series: [
      { 
        name: 'Ventas (MXN)', 
        type: 'bar', 
        data: ventas, 
        barMaxWidth: 30,
        itemStyle: { color: CHART_COLORS.primary }
      },
      { 
        name: 'Unidades', 
        type: 'bar', 
        data: unidades, 
        yAxisIndex: 1, 
        barMaxWidth: 30,
        itemStyle: { color: CHART_COLORS.success }
      }
    ]
  });
}

function comboBarLine(id, cats, ventas, unidades, { fmtBar = v => v, fmtLine = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    legend: { 
      top: 0,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 30, bottom: 60, containLabel: true },
    xAxis: { 
      type: 'category', 
      data: cats, 
      axisLabel: { rotate: 45, color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: [
      { 
        type: 'value', 
        name: 'Ventas', 
        axisLabel: { formatter: fmtBar, color: '#6b7280' },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
        nameTextStyle: { color: '#374151' }
      },
      { 
        type: 'value', 
        name: 'Unidades', 
        axisLabel: { formatter: fmtLine, color: '#6b7280' },
        splitLine: { show: false },
        nameTextStyle: { color: '#374151' }
      }
    ],
    series: [
      { 
        name: 'Ventas (MXN)', 
        type: 'bar', 
        data: ventas, 
        barMaxWidth: 24,
        itemStyle: { color: CHART_COLORS.primary }
      },
      { 
        name: 'Unidades', 
        type: 'line', 
        yAxisIndex: 1, 
        data: unidades, 
        smooth: true, 
        symbol: 'circle', 
        symbolSize: 6,
        lineStyle: { width: 3, color: CHART_COLORS.success },
        itemStyle: { color: CHART_COLORS.success }
      }
    ]
  });
}

function area(id, x, y, { formatter = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'axis', 
      valueFormatter: formatter,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 10, bottom: 60, containLabel: true },
    xAxis: { 
      type: 'category', 
      data: x, 
      axisLabel: { rotate: 45, color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: { 
      type: 'value', 
      axisLabel: { formatter, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [{ 
      type: 'line', 
      data: y, 
      smooth: true, 
      symbol: 'circle', 
      symbolSize: 6,
      lineStyle: { width: 3, color: CHART_COLORS.primary },
      itemStyle: { color: CHART_COLORS.primary },
      areaStyle: { color: 'rgba(79, 70, 229, 0.1)' }
    }]
  });
}

function histogram(id, labels, counts, mean, median) {
  const c = baseChart(id);
  if (!c) return;
  c.setOption({
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: { left: 10, right: 10, top: 10, bottom: 60, containLabel: true },
    xAxis: { 
      type: 'category', 
      data: labels, 
      axisLabel: { rotate: 45, color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: { 
      type: 'value',
      axisLabel: { color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [
      { 
        type: 'bar', 
        data: counts, 
        barMaxWidth: 14,
        itemStyle: { color: CHART_COLORS.secondary }
      },
      {
        type: 'line',
        data: [],
        markLine: {
          symbol: 'none',
          lineStyle: { type: 'dashed', color: CHART_COLORS.danger, width: 2 },
          data: [
            { xAxis: mean.toFixed(0), name: `Media ~ ${fmtMoney(mean)}` },
            { xAxis: median.toFixed(0), name: `Mediana ~ ${fmtMoney(median)}` }
          ],
          label: { 
            formatter: p => p.data?.name || '', 
            position: 'insideEndTop',
            color: '#374151'
          }
        }
      }
    ]
  });
}

function scatter(id, xVals, yVals, cats, { fmt = v => v } = {}) {
  const c = baseChart(id);
  if (!c) return;
  const data = xVals.map((x, i) => ({ value: [xVals[i], yVals[i]], name: cats[i] }));
  c.setOption({
    tooltip: {
      trigger: 'item',
      formatter: p => `Día ${p.value[0]} · ${fmt(p.value[1])}<br/>${p.name}`,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    xAxis: { 
      type: 'value', 
      name: 'Día', 
      min: 1, 
      max: 31,
      axisLabel: { color: '#6b7280' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      nameTextStyle: { color: '#374151' }
    },
    yAxis: { 
      type: 'value', 
      name: 'Ventas (MXN)', 
      axisLabel: { formatter: fmt, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      nameTextStyle: { color: '#374151' }
    },
    series: [{ 
      type: 'scatter', 
      data, 
      symbolSize: 10,
      itemStyle: { color: CHART_COLORS.primary }
    }]
  });
}

function emptyMsg(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;">${msg}</div>`;
}

// ================== Render del dashboard (15 vistas) =============
function renderAll(data) {
  const GMV = sum(data.map(d => d.ventasAbs || 0));
  const VNET = sum(data.map(d => d.total || 0));
  const UNITS = sum(data.map(d => d.unidades || 0));
  const ING_PROD = sum(data.map(d => d.ingresosProd || 0));
  const GMV_ads = sum(data.filter(d => d.publicidad === true).map(d => d.ventasAbs || 0));
  const GMV_org = sum(data.filter(d => d.publicidad === false).map(d => d.ventasAbs || 0));
  const shareAds = GMV ? (GMV_ads / GMV) * 100 : 0;

  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setText('kpi-gmv', fmtMoney(GMV));
  setText('kpi-net', fmtMoney(VNET));
  setText('kpi-units', fmtInt(UNITS));
  setText('kpi-prod', fmtMoney(ING_PROD));
  setText('kpi-ads-share', `${shareAds.toFixed(1)}%`);

  const kpiBlock = `
KPIs PRINCIPALES
================
GMV (Ventas Brutas):      ${fmtMoney(GMV)}
Ventas Netas:             ${fmtMoney(VNET)}
Unidades Vendidas:        ${fmtInt(UNITS)}
Ingresos por Productos:   ${fmtMoney(ING_PROD)}
Ventas atribuidas a Ads:  ${fmtMoney(GMV_ads)}
Ventas sin Ads:           ${fmtMoney(GMV_org)}

Participación atribuida a publicidad: ${shareAds.toFixed(1)}%
Ticket Promedio (GMV/tx): ${fmtMoney(GMV / Math.max(1, data.length))}
  `.trim();
  setText('kpi-block', kpiBlock);

  // 1) Top 10 fechas (GMV) - Dashboard y Ventas
  {
    const g = groupBy(data.filter(d => d.fechaCorta), d => d.fechaCorta);
    const arr = [...g.entries()].map(([date, rows]) => [date, sum(rows.map(r => r.ventasAbs || 0))]);
    arr.sort((a, b) => b[1] - a[1]);
    const top = arr.slice(0, 10).reverse();
    bar('chart1', top.map(d => d[0]), top.map(d => d[1]), { rotate: 45, formatter: v => fmtMoney(v) });
    bar('chart1-ventas', top.map(d => d[0]), top.map(d => d[1]), { rotate: 45, formatter: v => fmtMoney(v) });
  }

  // 2) Top 10 productos (unidades)
  {
    const g = groupBy(data, d => d.idProducto);
    const entries = [...g.entries()].map(([k, rows]) => [k, sum(rows.map(r => r.unidades || 0))]);
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 10).reverse();
    barh('chart2', top.map(t => t[0]), top.map(t => t[1]), { formatter: v => fmtInt(v) });
  }

  // 3) Top 10 productos (ingresos por productos)
  {
    const g = groupBy(data, d => d.idProducto);
    const entries = [...g.entries()].map(([k, rows]) => [k, sum(rows.map(r => r.ingresosProd || 0))]);
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 10).reverse();
    barh('chart3', top.map(t => t[0]), top.map(t => t[1]), { formatter: v => fmtMoney(v) });
  }

  // 4) Ventas por estado (GMV)
  {
    const g = groupBy(data, d => d.estado || '—');
    const entries = [...g.entries()].map(([k, rows]) => [k, sum(rows.map(r => r.ventasAbs || 0))]);
    entries.sort((a, b) => a[1] - b[1]);
    barh('chart4', entries.map(e => e[0]), entries.map(e => e[1]), { formatter: v => fmtMoney(v) });
  }

  // 5) Distribución por estado
  {
    const g = groupBy(data, d => d.estado || '—');
    const entries = [...g.entries()].map(([k, rows]) => ({ name: k, value: sum(rows.map(r => r.ventasAbs || 0)) }));
    entries.sort((a, b) => b.value - a.value);
    if (entries.length <= 8) {
      pie('chart5', entries);
    } else {
      const top = entries.slice(0, 15).sort((a, b) => a.value - b.value);
      barh('chart5', top.map(e => e.name), top.map(e => e.value), { formatter: v => fmtMoney(v) });
    }
  }

  // 6) Tiempo de entrega por día de la semana (promedio)
  {
    const g = groupBy(data.filter(d => d.tiempoEntrega != null && d.diaSemana), d => d.diaSemana);
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const x = order.map(k => dayNamesES[k]);
    const y = order.map(k => {
      const rows = g.get(k) || [];
      return rows.length ? sum(rows.map(r => r.tiempoEntrega)) / rows.length : 0;
    });
    line('chart6', x, y, { formatter: v => `${v.toFixed(1)}` });
  }

  // 8) Con vs sin publicidad por día (últimos 30)
  {
    const g = groupBy(
      data.filter(d => d.fechaCorta && (d.publicidad === true || d.publicidad === false)),
      d => d.fechaCorta
    );
    const dates = [...g.keys()].sort();
    const last = dates.slice(-30);
    const x = last;
    const sinAds = last.map(dt => {
      const rows = (g.get(dt) || []).filter(r => r.publicidad === false);
      return sum(rows.map(r => r.ventasAbs || 0));
    });
    const conAds = last.map(dt => {
      const rows = (g.get(dt) || []).filter(r => r.publicidad === true);
      return sum(rows.map(r => r.ventasAbs || 0));
    });
    barGrouped('chart8', x, [
      { name: 'Sin Publicidad', data: sinAds },
      { name: 'Con Publicidad', data: conAds }
    ], { rotate: 45, formatter: v => fmtMoney(v) });
  }

  // 9) Comparación global con/sin publicidad
  {
    const ventasSin = GMV_org;
    const ventasCon = GMV_ads;
    const unidadesSin = sum(data.filter(d => d.publicidad === false).map(d => d.unidades || 0));
    const unidadesCon = sum(data.filter(d => d.publicidad === true).map(d => d.unidades || 0));
    dualBar('chart9', ['Con Publicidad', 'Sin Publicidad'], [ventasCon, ventasSin], [unidadesCon, unidadesSin], {
      fmtLeft: fmtMoney,
      fmtRight: fmtInt
    });
  }

  // 10) Ventas (GMV) + unidades por producto (Top 15)
  {
    const g = groupBy(data, d => d.idProducto);
    const entries = [...g.entries()].map(([k, rows]) => ({
      id: k,
      ventas: sum(rows.map(r => r.ventasAbs || 0)),
      unidades: sum(rows.map(r => r.unidades || 0))
    }));
    entries.sort((a, b) => b.ventas - a.ventas);
    const top = entries.slice(0, 15);
    comboBarLine('chart10', top.map(x => x.id), top.map(x => x.ventas), top.map(x => x.unidades), {
      fmtBar: fmtMoney,
      fmtLine: fmtInt
    });
  }

  // 11) Evolución mensual (GMV) - Dashboard y Ventas
  {
    const g = groupBy(data.filter(d => d.anoMes), d => d.anoMes);
    const entries = [...g.entries()].map(([k, rows]) => [k, sum(rows.map(r => r.ventasAbs || 0))]);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    area('chart11', entries.map(e => e[0]), entries.map(e => e[1]), { formatter: v => fmtMoney(v) });
    area('chart11-ventas', entries.map(e => e[0]), entries.map(e => e[1]), { formatter: v => fmtMoney(v) });
  }

  // 12) Distribución precios unitarios (histograma)
  {
    const vals = data.map(d => d.precioUnit).filter(v => numberLike(v));
    if (vals.length) {
      const bins = 30;
      const min = Math.min(...vals), max = Math.max(...vals);
      const step = (max - min) / bins || 1;
      const edges = Array.from({ length: bins }, (_, i) => min + i * step);
      const hist = Array(bins).fill(0);
      for (const v of vals) {
        let idx = Math.floor((v - min) * 1.0 / step);
        if (idx >= bins) idx = bins - 1;
        if (idx < 0) idx = 0;
        hist[idx]++;
      }
      const labels = edges.map(e => e.toFixed(0));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sorted = [...vals].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      histogram('chart12', labels, hist, mean, median);
    } else {
      emptyMsg('chart12', 'No hay datos de precios disponibles');
    }
  }

  // 13) Top 20 días agregados por mes (scatter)
  {
    const g = groupBy(data.filter(d => d.fechaVenta), d => `${d.mesNombre}|${d.fechaVenta.getDate()}`);
    const entries = [...g.entries()].map(([k, rows]) => {
      const [mes, dia] = k.split('|');
      return { mes, dia: +dia, ventas: sum(rows.map(r => r.ventasAbs || 0)) };
    });
    entries.sort((a, b) => b.ventas - a.ventas);
    const top = entries.slice(0, 20);
    scatter('chart13', top.map(r => r.dia), top.map(r => r.ventas), top.map(r => r.mes), { fmt: fmtMoney });
  }

  // 14) Top 10 municipios (GMV)
  {
    const g = groupBy(data, d => d.municipio || '—');
    const entries = [...g.entries()].map(([k, rows]) => [k, sum(rows.map(r => r.ventasAbs || 0))]);
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 10).reverse();
    barh('chart14', top.map(t => t[0]), top.map(t => t[1]), { formatter: v => fmtMoney(v) });
  }

  // 15) Margen operativo promedio por estado
  {
    const g = groupBy(data, d => d.estado || '—');
    const entries = [...g.entries()].map(([k, rows]) => {
      const vals = rows.map(r => r.margenOperativo).filter(numberLike);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return [k, avg];
    });
    entries.sort((a, b) => a[1] - b[1]);
    barh('chart15', entries.map(e => e[0]), entries.map(e => e[1]), { formatter: v => fmtMoney(v) });
  }
}
