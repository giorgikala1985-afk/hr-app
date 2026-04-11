import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Analytics.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

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

    </div>
  );
}

export default Analytics;
