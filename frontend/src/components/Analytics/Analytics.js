import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Analytics.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const SALARY_REPORT_WIDTHS = [130, 120, 130, 130, 130];

function Analytics() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(SALARY_REPORT_WIDTHS);
  const [analytics, setAnalytics] = useState(null);
  const [salaryReport, setSalaryReport] = useState([]);
  const [reportMonths, setReportMonths] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchSalaryReport();
  }, [reportMonths]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/analytics');
      setAnalytics(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      console.error('Error fetching analytics:', err);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading">{t('analytics.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="error">{t('analytics.error')}{error}</div>
        <button onClick={fetchAnalytics} className="btn-retry">
          {t('analytics.retry')}
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-container">
        <div className="no-data">{t('analytics.noData')}</div>
      </div>
    );
  }

  const maxNet = salaryReport.length > 0 ? Math.max(...salaryReport.map(r => r.total_accrued)) : 0;

  return (
    <div className="analytics-container">
      <h1>{t('analytics.title')}</h1>

      <div className="analytics-grid">
        <div className="stat-card stat-card-blue">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="stat-value">{analytics.totalEmployees}</div>
          <div className="stat-label">{t('analytics.totalEmployees')}</div>
        </div>

        <div className="stat-card stat-card-green">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="stat-value">${analytics.averageSalary?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">{t('analytics.averageSalary')}</div>
        </div>

        <div className="stat-card stat-card-purple">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
          </div>
          <div className="stat-value">${analytics.totalSalaryExpense?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">{t('analytics.totalMonthlySalary')}</div>
        </div>

        <div className="stat-card stat-card-teal">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
              <polyline points="16,11 17,13 21,9"/>
            </svg>
          </div>
          <div className="stat-value">{analytics.activeEmployees || 0}</div>
          <div className="stat-label">{t('analytics.activeEmployees')}</div>
        </div>
      </div>

      {/* Salary by Months Report */}
      {salaryReport.length > 0 && (
        <div className="section">
          <div className="section-header-row">
            <h2>{t('analytics.salariesByMonth')}</h2>
            <select
              className="report-months-select"
              value={reportMonths}
              onChange={(e) => setReportMonths(Number(e.target.value))}
            >
              <option value={6}>{t('analytics.last6')}</option>
              <option value={12}>{t('analytics.last12')}</option>
              <option value={24}>{t('analytics.last24')}</option>
            </select>
          </div>

          {/* Bar Chart */}
          <div className="salary-chart">
            {salaryReport.map((item) => (
              <div key={item.month} className="chart-col">
                <div className="chart-bar-wrapper">
                  {item.total_deductions > 0 && (
                    <div
                      className="chart-bar chart-bar-deduction"
                      style={{ height: `${maxNet > 0 ? (item.total_deductions / maxNet) * 100 : 0}%` }}
                      title={`Deductions: ${formatCurrency(item.total_deductions)}`}
                    />
                  )}
                  <div
                    className="chart-bar chart-bar-net"
                    style={{ height: `${maxNet > 0 ? (item.net_salary / maxNet) * 100 : 0}%` }}
                    title={`Net: ${formatCurrency(item.net_salary)}`}
                  />
                </div>
                <div className="chart-label">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot legend-net" /> {t('analytics.netSalary')}</span>
            <span className="legend-item"><span className="legend-dot legend-ded" /> {t('analytics.deductionsLabel')}</span>
          </div>

          {/* Table */}
          <div className="salary-report-table">
            <table style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ position: 'relative', width: colWidths[0], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('analytics.month')}<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[1], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('analytics.employees')}<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[2], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('analytics.accrued')}<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[3], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('analytics.deductions')}<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[4], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('analytics.netSalary')}<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                </tr>
              </thead>
              <tbody>
                {salaryReport.map((item) => (
                  <tr key={item.month}>
                    <td className="report-month" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.label}</td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.active_employees}</td>
                    <td className="report-amount" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{formatCurrency(item.total_accrued)}</td>
                    <td className="report-deduction" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.total_deductions > 0 ? `-${formatCurrency(item.total_deductions)}` : '-'}</td>
                    <td className="report-net" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{formatCurrency(item.net_salary)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="report-total-label" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t('analytics.total')}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} />
                  <td className="report-amount" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{formatCurrency(salaryReport.reduce((s, r) => s + r.total_accrued, 0))}</td>
                  <td className="report-deduction" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {salaryReport.reduce((s, r) => s + r.total_deductions, 0) > 0
                      ? `-${formatCurrency(salaryReport.reduce((s, r) => s + r.total_deductions, 0))}`
                      : '-'}
                  </td>
                  <td className="report-net" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{formatCurrency(salaryReport.reduce((s, r) => s + r.net_salary, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Position Breakdown */}
      {analytics.departmentBreakdown && analytics.departmentBreakdown.length > 0 && (
        <div className="section">
          <h2>{t('analytics.byPosition')}</h2>
          <div className="department-table">
            <table>
              <thead>
                <tr>
                  <th>{t('analytics.position')}</th>
                  <th>{t('analytics.count')}</th>
                  <th>{t('analytics.percentage')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.departmentBreakdown.map((dept, index) => (
                  <tr key={index}>
                    <td>{dept.department || t('analytics.notAssigned')}</td>
                    <td>{dept.count}</td>
                    <td>
                      {((dept.count / analytics.totalEmployees) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary Range Distribution */}
      {analytics.salaryRanges && analytics.salaryRanges.length > 0 && (
        <div className="section">
          <h2>{t('analytics.bySalaryRange')}</h2>
          <div className="salary-ranges">
            {analytics.salaryRanges.map((range, index) => (
              <div key={index} className="salary-range-item">
                <div className="range-label">{range.range}</div>
                <div className="range-bar-container">
                  <div
                    className="range-bar"
                    style={{
                      width: `${(range.count / analytics.totalEmployees) * 100}%`,
                    }}
                  />
                </div>
                <div className="range-count">{t('analytics.employeesCount', { count: range.count })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Holidays */}
      {analytics.upcomingHolidays && analytics.upcomingHolidays.length > 0 && (
        <div className="section">
          <h2>{t('analytics.upcomingHolidays')}</h2>
          <div className="holidays-list">
            {analytics.upcomingHolidays.map((holiday, index) => (
              <div key={index} className="holiday-item">
                <div className="holiday-date">
                  {new Date(holiday.date).toLocaleDateString()}
                </div>
                <div className="holiday-name">{holiday.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="refresh-section">
        <button onClick={() => { fetchAnalytics(); fetchSalaryReport(); }} className="btn-refresh">
          {t('analytics.refresh')}
        </button>
      </div>
    </div>
  );
}

export default Analytics;
