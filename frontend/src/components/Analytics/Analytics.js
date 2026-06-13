import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Analytics.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';

const DL_TABLES_KEY = 'dl_custom_tables';
const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#ec4899','#14b8a6','#f87171','#818cf8','#34d399'];

function DataLakeCharts() {
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [mode, setMode] = useState('values');
  const [labelColId, setLabelColId] = useState('');
  const [valueColId, setValueColId] = useState('');
  const [groupColId, setGroupColId] = useState('');
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    const load = () => {
      try { setTables(JSON.parse(localStorage.getItem(DL_TABLES_KEY)) || []); } catch {}
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const table = tables.find(t => t.id === selectedTableId);
  const numericCols = table ? table.columns.filter(c => c.type === 'number') : [];
  const allCols = table ? table.columns : [];

  useEffect(() => {
    if (!table) return;
    const firstNum = numericCols[0];
    const firstAny = allCols[0];
    if (mode === 'values') {
      setLabelColId(allCols.find(c => c.type === 'text' || c.type === 'dropdown')?.id || allCols[0]?.id || '');
      setValueColId(firstNum?.id || '');
    } else {
      setGroupColId(firstAny?.id || '');
    }
    setChartType('bar');
  }, [selectedTableId, mode]);

  const buildChartData = () => {
    if (!table || !table.rows.length) return [];
    if (mode === 'values') {
      if (!valueColId) return [];
      return table.rows
        .map(r => ({
          label: labelColId ? String(r[labelColId] || '') : '',
          value: parseFloat(r[valueColId]) || 0,
        }))
        .filter(d => d.value !== 0 || d.label);
    } else {
      if (!groupColId) return [];
      const counts = {};
      table.rows.forEach(r => {
        const key = String(r[groupColId] || 'Empty');
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.entries(counts).map(([label, value]) => ({ label, value }));
    }
  };

  const chartData = buildChartData();
  const maxVal = chartData.length ? Math.max(...chartData.map(d => d.value)) : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{payload[0]?.payload?.label}</div>
        <div style={{ color: '#6366f1', fontWeight: 600 }}>{payload[0]?.value}</div>
      </div>
    );
  };

  if (tables.length === 0) {
    return (
      <div className="an-section">
        <div className="an-section-head">
          <div className="an-section-title">Data Lake Charts</div>
        </div>
        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-4)', fontSize: 13 }}>
          No tables yet. Go to <strong>Data Lake → Tables</strong> to create one.
        </div>
      </div>
    );
  }

  return (
    <div className="an-section">
      <div className="an-section-head">
        <div className="an-section-title">Data Lake Charts</div>
        <select
          className="an-select"
          value={selectedTableId}
          onChange={e => setSelectedTableId(e.target.value)}
        >
          <option value="">Select table...</option>
          {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {!selectedTableId && (
        <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--text-4)', fontSize: 13 }}>
          Select a table to build a chart
        </div>
      )}

      {table && (
        <>
          <div className="dl-chart-controls">
            <div className="dl-chart-control-group">
              <span className="dl-chart-label">Mode</span>
              <div className="dl-chart-toggle">
                <button className={`dl-chart-toggle-btn${mode === 'values' ? ' active' : ''}`} onClick={() => setMode('values')}>Values per row</button>
                <button className={`dl-chart-toggle-btn${mode === 'count' ? ' active' : ''}`} onClick={() => setMode('count')}>Count by field</button>
              </div>
            </div>

            {mode === 'values' && (
              <>
                <div className="dl-chart-control-group">
                  <span className="dl-chart-label">Label (X axis)</span>
                  <select className="an-select" value={labelColId} onChange={e => setLabelColId(e.target.value)}>
                    <option value="">None</option>
                    {allCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="dl-chart-control-group">
                  <span className="dl-chart-label">Value (Y axis)</span>
                  <select className="an-select" value={valueColId} onChange={e => setValueColId(e.target.value)}>
                    <option value="">Select column...</option>
                    {numericCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </>
            )}

            {mode === 'count' && (
              <div className="dl-chart-control-group">
                <span className="dl-chart-label">Group by</span>
                <select className="an-select" value={groupColId} onChange={e => setGroupColId(e.target.value)}>
                  <option value="">Select column...</option>
                  {allCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="dl-chart-control-group">
              <span className="dl-chart-label">Chart type</span>
              <div className="dl-chart-toggle">
                <button className={`dl-chart-toggle-btn${chartType === 'bar' ? ' active' : ''}`} onClick={() => setChartType('bar')}>Bar</button>
                <button className={`dl-chart-toggle-btn${chartType === 'line' ? ' active' : ''}`} onClick={() => setChartType('line')}>Line</button>
                <button className={`dl-chart-toggle-btn${chartType === 'pie' ? ' active' : ''}`} onClick={() => setChartType('pie')}>Pie</button>
              </div>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-4)', fontSize: 13 }}>
              {mode === 'values' && !valueColId ? 'Select a numeric column to visualize.' : 'No data to display.'}
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              {chartType === 'bar' && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 32 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-4)' }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-4)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartType === 'line' && (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 32 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-4)' }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-4)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {chartType === 'pie' && (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={48}
                      paddingAngle={2}
                      label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              <div className="dl-chart-summary">
                {chartData.map((d, i) => (
                  <div key={i} className="dl-chart-summary-item">
                    <span className="dl-chart-summary-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="dl-chart-summary-label">{d.label || '—'}</span>
                    <span className="dl-chart-summary-val">{d.value}</span>
                    <div className="dl-chart-summary-bar">
                      <div style={{ width: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%`, background: CHART_COLORS[i % CHART_COLORS.length], height: '100%', borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SALARY_REPORT_WIDTHS = [130, 120, 130, 130, 130];

const fmt = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

function Analytics() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(SALARY_REPORT_WIDTHS);
  const [analytics, setAnalytics] = useState(null);
  const [salaryReport, setSalaryReport] = useState([]);
  const [reportMonths, setReportMonths] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchAnalytics(); }, []);
  useEffect(() => { fetchSalaryReport(); }, [reportMonths]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/analytics');
      setAnalytics(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalaryReport = async () => {
    try {
      const response = await api.get('/analytics/salary-report', { params: { months: reportMonths } });
      setSalaryReport(response.data.report || []);
    } catch (err) {
      console.error('Error fetching salary report:', err);
    }
  };

  const refresh = () => { fetchAnalytics(); fetchSalaryReport(); };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="an-loading">
          <div className="an-spinner" />
          {t('analytics.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="an-error">{t('analytics.error')}{error}</div>
        <button onClick={fetchAnalytics} className="an-retry-btn">{t('analytics.retry')}</button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-container">
        <div className="an-loading">{t('analytics.noData')}</div>
      </div>
    );
  }

  const maxNet = salaryReport.length > 0 ? Math.max(...salaryReport.map(r => r.total_accrued)) : 0;

  const STATS = [
    {
      cls: 'an-stat--indigo',
      value: analytics.totalEmployees,
      label: t('analytics.totalEmployees'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      cls: 'an-stat--emerald',
      value: `$${analytics.averageSalary?.toFixed(2) || '0.00'}`,
      label: t('analytics.averageSalary'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      cls: 'an-stat--violet',
      value: `$${analytics.totalSalaryExpense?.toFixed(2) || '0.00'}`,
      label: t('analytics.totalMonthlySalary'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>
          <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
        </svg>
      ),
    },
    {
      cls: 'an-stat--cyan',
      value: analytics.activeEmployees || 0,
      label: t('analytics.activeEmployees'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
          <polyline points="16,11 17,13 21,9"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="analytics-container">

      {/* Header */}
      <div className="an-page-header">
        <div className="an-title-block">
          <div className="an-eyebrow">Insights</div>
          <h1 className="an-title">{t('analytics.title')}</h1>
          <p className="an-subtitle">Workforce & payroll overview</p>
        </div>
        <button className="an-refresh-btn" onClick={refresh}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {t('analytics.refresh')}
        </button>
      </div>

      {/* Stat cards */}
      <div className="an-stat-grid">
        {STATS.map((s, i) => (
          <div key={i} className={`an-stat-card ${s.cls}`}>
            <div className="an-stat-icon">{s.icon}</div>
            <div className="an-stat-value">{s.value}</div>
            <div className="an-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Salary by month */}
      {salaryReport.length > 0 && (
        <div className="an-section">
          <div className="an-section-head">
            <div className="an-section-title">{t('analytics.salariesByMonth')}</div>
            <select
              className="an-select"
              value={reportMonths}
              onChange={e => setReportMonths(Number(e.target.value))}
            >
              <option value={6}>{t('analytics.last6')}</option>
              <option value={12}>{t('analytics.last12')}</option>
              <option value={24}>{t('analytics.last24')}</option>
            </select>
          </div>

          {/* Bar chart */}
          <div className="an-chart">
            {salaryReport.map((item) => (
              <div key={item.month} className="an-chart-col">
                <div className="an-chart-bars">
                  {item.total_deductions > 0 && (
                    <div
                      className="an-bar an-bar--ded"
                      style={{ height: `${maxNet > 0 ? (item.total_deductions / maxNet) * 100 : 0}%` }}
                      title={`Deductions: ${fmt(item.total_deductions)}`}
                    />
                  )}
                  <div
                    className="an-bar an-bar--net"
                    style={{ height: `${maxNet > 0 ? (item.net_salary / maxNet) * 100 : 0}%` }}
                    title={`Net: ${fmt(item.net_salary)}`}
                  />
                </div>
                <div className="an-chart-lbl">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="an-legend">
            <span className="an-legend-item">
              <span className="an-legend-dot an-legend-dot--net" />
              {t('analytics.netSalary')}
            </span>
            <span className="an-legend-item">
              <span className="an-legend-dot an-legend-dot--ded" />
              {t('analytics.deductionsLabel')}
            </span>
          </div>

          {/* Table */}
          <div className="an-table-wrap">
            <table style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr>
                  {[t('analytics.month'), t('analytics.employees'), t('analytics.accrued'), t('analytics.deductions'), t('analytics.netSalary')].map((h, i) => (
                    <th key={i} style={{ position: 'relative', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {h}
                      <div
                        onMouseDown={e => onResizeMouseDown(e, i)}
                        style={RESIZE_HANDLE_STYLE}
                        onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salaryReport.map((item) => (
                  <tr key={item.month}>
                    <td className="an-td-month"  style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.label}</td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.active_employees}</td>
                    <td className="an-td-amount" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fmt(item.total_accrued)}</td>
                    <td className="an-td-ded"    style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.total_deductions > 0 ? `-${fmt(item.total_deductions)}` : '—'}</td>
                    <td className="an-td-net"    style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fmt(item.net_salary)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="an-tfoot-lbl"  style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t('analytics.total')}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} />
                  <td className="an-td-amount"  style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fmt(salaryReport.reduce((s, r) => s + r.total_accrued, 0))}</td>
                  <td className="an-td-ded"     style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {salaryReport.reduce((s, r) => s + r.total_deductions, 0) > 0
                      ? `-${fmt(salaryReport.reduce((s, r) => s + r.total_deductions, 0))}`
                      : '—'}
                  </td>
                  <td className="an-td-net"     style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fmt(salaryReport.reduce((s, r) => s + r.net_salary, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Position breakdown */}
      {analytics.departmentBreakdown && analytics.departmentBreakdown.length > 0 && (
        <div className="an-section">
          <div className="an-section-head">
            <div className="an-section-title">{t('analytics.byPosition')}</div>
          </div>
          <div className="an-pos-table">
            <table>
              <thead>
                <tr>
                  <th>{t('analytics.position')}</th>
                  <th>{t('analytics.count')}</th>
                  <th>{t('analytics.percentage')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.departmentBreakdown.map((dept, i) => (
                  <tr key={i}>
                    <td>{dept.department || t('analytics.notAssigned')}</td>
                    <td>{dept.count}</td>
                    <td>{((dept.count / analytics.totalEmployees) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary ranges */}
      {analytics.salaryRanges && analytics.salaryRanges.length > 0 && (
        <div className="an-section">
          <div className="an-section-head">
            <div className="an-section-title">{t('analytics.bySalaryRange')}</div>
          </div>
          <div className="an-ranges">
            {analytics.salaryRanges.map((range, i) => (
              <div key={i} className="an-range-item">
                <div className="an-range-label">{range.range}</div>
                <div className="an-range-track">
                  <div
                    className="an-range-bar"
                    style={{ width: `${(range.count / analytics.totalEmployees) * 100}%` }}
                  />
                </div>
                <div className="an-range-count">{t('analytics.employeesCount', { count: range.count })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming holidays */}
      {analytics.upcomingHolidays && analytics.upcomingHolidays.length > 0 && (
        <div className="an-section">
          <div className="an-section-head">
            <div className="an-section-title">{t('analytics.upcomingHolidays')}</div>
          </div>
          <div className="an-holidays">
            {analytics.upcomingHolidays.map((holiday, i) => (
              <div key={i} className="an-holiday-card">
                <div className="an-holiday-date">
                  {new Date(holiday.date).toLocaleDateString()}
                </div>
                <div className="an-holiday-name">{holiday.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataLakeCharts />

    </div>
  );
}

export default Analytics;
