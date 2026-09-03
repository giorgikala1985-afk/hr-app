import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';

// localStorage is scoped per browser origin, not per logged-in company — an
// un-namespaced key here lets one organization's Data Lake tables (and its
// pinned charts) leak into another's view when the same browser is used to
// log into more than one org. Namespace by the current tenant, matching the
// pattern already used by Orders.js's useLocalOrders / SalariesPage.js.
export const DL_TABLES_KEY = 'dl_custom_tables';
export const PINNED_CHARTS_KEY = 'hr_pinned_charts';
// Pastel theme (picked from Admin > Chart Designs); see ChartDesignsGallery.js.
export const CHART_COLORS = ['#5c96e0','#f9916b','#6ac79c','#d59b41','#f68ab2','#4d9a48','#625db2','#f17972'];

export const dlTablesKey = (userId) => `${DL_TABLES_KEY}_${userId || 'anon'}`;
export const pinnedChartsKey = (userId) => `${PINNED_CHARTS_KEY}_${userId || 'anon'}`;

export function loadDataLakeTables(userId) {
  try { return JSON.parse(localStorage.getItem(dlTablesKey(userId))) || []; } catch { return []; }
}

export function loadPinnedCharts(userId) {
  try { return JSON.parse(localStorage.getItem(pinnedChartsKey(userId))) || []; } catch { return []; }
}

export function savePinnedCharts(userId, list) {
  localStorage.setItem(pinnedChartsKey(userId), JSON.stringify(list));
  // Same-tab listeners (e.g. Home already mounted) don't get the native
  // 'storage' event — it only fires in other tabs — so also broadcast one
  // locally that both Analytics and Home listen for.
  window.dispatchEvent(new Event('pinned-charts-changed'));
}

// Same aggregation logic Analytics' Data Lake chart builder uses — pulled out
// so a pinned chart on Home can recompute live from the current table data
// instead of freezing a snapshot.
export function buildChartData(table, { mode, labelColId, valueColId, groupColId }) {
  if (!table || !table.rows?.length) return [];
  if (mode === 'values') {
    if (!valueColId) return [];
    return table.rows
      .map(r => ({ label: labelColId ? String(r[labelColId] || '') : '', value: parseFloat(r[valueColId]) || 0 }))
      .filter(d => d.value !== 0 || d.label);
  }
  if (!groupColId) return [];
  const counts = {};
  table.rows.forEach(r => {
    const key = String(r[groupColId] || 'Empty');
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{payload[0]?.payload?.label}</div>
      <div style={{ color: '#6366f1', fontWeight: 600 }}>{payload[0]?.value}</div>
    </div>
  );
}

// Renders one pinned/configured Data Lake chart from its config, reading the
// live table each time so edits to the underlying data show up automatically
// wherever the chart is pinned.
export default function PinnedChartView({ config, height = 220 }) {
  const { user } = useAuth();
  const [tables, setTables] = useState(() => loadDataLakeTables(user?.id));

  useEffect(() => {
    const reload = () => setTables(loadDataLakeTables(user?.id));
    reload();
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, [user?.id]);

  const table = tables.find(t => t.id === config.tableId);
  if (!table) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>Table no longer available.</div>;
  }

  const chartData = buildChartData(table, config);
  if (chartData.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>No data to display.</div>;
  }

  if (config.chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={Math.min(80, height / 2.6)} innerRadius={Math.min(38, height / 5.5)} paddingAngle={2} labelLine={false}>
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (config.chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 24 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-4)' }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-4)' }} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 24 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-4)' }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-4)' }} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={40}>
          {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
