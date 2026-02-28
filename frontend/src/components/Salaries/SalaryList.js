import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import './Salaries.css';
import '../Options/Options.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const SAL_DEFAULT_WIDTHS = [60, 160, 140, 130, 110, 130, 130]; // Photo, Name, Position, Salary, Days, Accrued, Net

function SalaryList() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(SAL_DEFAULT_WIDTHS);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(currentMonth);
  const [salaries, setSalaries] = useState([]);
  const [holidaysCount, setHolidaysCount] = useState(0);
  const [weekendDays, setWeekendDays] = useState(0);
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ name: '', position: '', salary: '', days: '', accrued: '', deductions: '', net: '' });
  const [gelRate, setGelRate] = useState(null);
  const [eurRate, setEurRate] = useState(null);
  const [deletedUnits, setDeletedUnits] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [unitTypes, setUnitTypes] = useState([]);
  const [overtimeRates, setOvertimeRates] = useState([]);
  const [unitForm, setUnitForm] = useState({ type: 'OT', amount: '', date: '', otRate: '', otHours: '', currency: 'USD' });
  const [savingUnit, setSavingUnit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationSettings, setPaginationSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pagination_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: false, pageSize: 50 };
  });

  const onPaginationChange = useCallback(() => {
    try {
      const saved = localStorage.getItem('pagination_settings');
      if (saved) setPaginationSettings(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener('pagination-changed', onPaginationChange);
    return () => window.removeEventListener('pagination-changed', onPaginationChange);
  }, [onPaginationChange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, month, paginationSettings]);

  useEffect(() => {
    loadSalaries(month);
  }, [month]);

  useEffect(() => {
    loadGelRate();
    loadUnitTypes();
  }, []);

  // Set default date for unit form based on selected month
  useEffect(() => {
    const [y, m] = month.split('-');
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    setUnitForm((prev) => ({ ...prev, date: `${month}-${String(lastDay).padStart(2, '0')}` }));
  }, [month]);

  const loadGelRate = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      if (data.rates) {
        if (data.rates.GEL) setGelRate(data.rates.GEL);
        if (data.rates.EUR) setEurRate(data.rates.EUR);
      }
    } catch (err) {
      console.error('Failed to fetch rates:', err);
    }
  };

  const loadUnitTypes = async () => {
    try {
      const unitsRes = await api.get('/units');
      const types = unitsRes.data.unit_types || [];
      setUnitTypes(types);
    } catch (err) {
      console.error('Failed to load unit types:', err);
    }
    try {
      const otRes = await api.get('/overtime-rates');
      const rates = otRes.data.overtime_rates || [];
      setOvertimeRates(rates);
      if (rates.length > 0) {
        setUnitForm(prev => prev.otRate ? prev : { ...prev, otRate: String(rates[0].rate) });
      }
    } catch (err) {
      console.error('Failed to load overtime rates:', err);
    }
  };

  const loadSalaries = async (selectedMonth) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/salaries', { params: { month: selectedMonth } });
      setSalaries(response.data.salaries);
      setHolidaysCount(response.data.holidays_count || 0);
      setWeekendDays(response.data.weekend_days || 0);
      setWorkingDays(response.data.working_days || 0);
    } catch (err) {
      setError(t('sal.loadFailed') + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatGEL = (amount) => {
    return new Intl.NumberFormat('ka-GE', {
      style: 'currency',
      currency: 'GEL'
    }).format(amount);
  };

  const getMonthLabel = (monthStr) => {
    const [year, m] = monthStr.split('-').map(Number);
    return new Date(year, m - 1).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  const getMonthName = (monthStr) => {
    const [year, m] = monthStr.split('-').map(Number);
    return new Date(year, m - 1).toLocaleDateString('en-US', { month: 'long' });
  };

  const getUnitDirection = (type) => {
    if (type === 'OT' || type === 'Overtime') return 'addition';
    const found = unitTypes.find((u) => u.name === type);
    return found ? found.direction : 'deduction';
  };

  const downloadExcel = () => {
    const monthName = getMonthName(month);
    const description = `${monthName} Salary`;

    const rows = filteredEmployees.map((item) => {
      const net = item.net_salary ?? item.accrued_salary;
      return {
        'Account Number': item.employee.account_number || '',
        "Employee's Name": `${item.employee.first_name} ${item.employee.last_name}`,
        'Amount': net,
        'Description': description
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    ws['!cols'] = [
      { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salaries');
    XLSX.writeFile(wb, `Salaries_${month}.xlsx`);
  };

  const handleDeleteDeduction = async (employeeId, unitId, unitData) => {
    if (!window.confirm(t('sal.removeUnit'))) return;
    try {
      await api.delete(`/employees/${employeeId}/units/${unitId}`);
      setDeletedUnits((prev) => [...prev, { employeeId, ...unitData }]);
      loadSalaries(month);
    } catch (err) {
      setError(t('sal.removeFailed'));
    }
  };

  const handleRestoreAll = async () => {
    if (!window.confirm(t('sal.restoreConfirm').replace('{count}', deletedUnits.length))) return;
    setError('');
    try {
      for (const unit of deletedUnits) {
        await api.post(`/employees/${unit.employeeId}/units`, {
          type: unit.type,
          amount: parseFloat(unit.amount),
          date: unit.date,
        });
      }
      setDeletedUnits([]);
      loadSalaries(month);
    } catch (err) {
      setError(t('sal.restoreFailed'));
    }
  };

  const toUSD = (amount, currency) => {
    const val = parseFloat(amount);
    if (currency === 'GEL' && gelRate) return Math.round((val / gelRate) * 100) / 100;
    if (currency === 'EUR' && eurRate) return Math.round((val / eurRate) * 100) / 100;
    return val;
  };

  const handleAddUnit = async (employeeId) => {
    if (!unitForm.type || !unitForm.amount) return;
    const [y, m] = month.split('-');
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    const date = `${month}-${String(lastDay).padStart(2, '0')}`;
    setSavingUnit(true);
    setError('');
    try {
      await api.post(`/employees/${employeeId}/units`, {
        type: unitForm.type,
        amount: toUSD(unitForm.amount, unitForm.currency),
        date,
      });
      setUnitForm((prev) => ({ ...prev, type: 'OT', amount: '', otRate: overtimeRates.length > 0 ? String(overtimeRates[0].rate) : '', otHours: '', currency: 'USD' }));
      loadSalaries(month);
    } catch (err) {
      setError(t('sal.addUnitFailed') + (err.response?.data?.error || err.message));
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDefer = async (employeeId, accruedSalary) => {
    try {
      await api.post('/salary-deferrals', { employee_id: employeeId, month, deferred_amount: accruedSalary });
      loadSalaries(month);
    } catch (err) {
      setError('Failed to defer salary.');
    }
  };

  const handleUndoDefer = async (employeeId) => {
    try {
      await api.delete(`/salary-deferrals/${employeeId}/${month}`);
      loadSalaries(month);
    } catch (err) {
      setError('Failed to undo deferral.');
    }
  };

  const toggleExpand = (empId) => {
    setExpandedId((prev) => (prev === empId ? null : empId));
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ name: '', position: '', salary: '', days: '', accrued: '', deductions: '', net: '' });
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  const activeEmployees = salaries.filter((s) => s.days_worked > 0);

  const filteredEmployees = activeEmployees.filter((item) => {
    const fullName = `${item.employee.first_name} ${item.employee.last_name}`.toLowerCase();
    if (filters.name && !fullName.includes(filters.name.toLowerCase())) return false;
    if (filters.position && !item.employee.position.toLowerCase().includes(filters.position.toLowerCase())) return false;
    if (filters.salary && !String(item.employee.salary).includes(filters.salary)) return false;
    if (filters.days && !String(item.days_worked).includes(filters.days)) return false;
    if (filters.accrued && !String(item.accrued_salary).includes(filters.accrued)) return false;
    if (filters.deductions && !String(item.total_deductions || 0).includes(filters.deductions)) return false;
    if (filters.net && !String(item.net_salary ?? item.accrued_salary).includes(filters.net)) return false;
    return true;
  });

  const totalAccrued = filteredEmployees.reduce((sum, s) => sum + s.accrued_salary, 0);
  const totalDeductions = filteredEmployees.reduce((sum, s) => sum + (s.total_deductions || 0), 0);
  const totalAdditions = filteredEmployees.reduce((sum, s) => sum + (s.total_additions || 0), 0);
  const totalInsurance = filteredEmployees.reduce((sum, s) => sum + (s.insurance_deduction || 0), 0);
  const totalNet = filteredEmployees.reduce((sum, s) => sum + (s.net_salary ?? s.accrued_salary), 0);

  const usePagination = paginationSettings.enabled && paginationSettings.pageSize !== 'all';
  const pageSize = usePagination ? paginationSettings.pageSize : filteredEmployees.length;
  const totalPages = usePagination ? Math.max(1, Math.ceil(filteredEmployees.length / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEmployees = usePagination
    ? filteredEmployees.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredEmployees;

  // Build unit columns: all configured types + any extra types found in data (e.g. OT)
  const configuredTypeNames = new Set(unitTypes.map(u => u.name));
  const extraTypesMap = new Map();
  salaries.forEach(item => {
    (item.deductions || []).forEach(d => {
      if (!configuredTypeNames.has(d.type) && !extraTypesMap.has(d.type)) {
        const dir = (d.type === 'OT' || d.type === 'Overtime') ? 'addition' : 'deduction';
        extraTypesMap.set(d.type, dir);
      }
    });
  });
  const usedUnitTypes = [
    ...Array.from(extraTypesMap.entries()).map(([name, direction]) => ({ name, direction })),
    ...unitTypes.map(ut => ({ name: ut.name, direction: ut.direction })),
  ];

  const getUnitTotal = (item, typeName) =>
    (item.deductions || [])
      .filter(d => d.type === typeName)
      .reduce((s, d) => s + parseFloat(d.amount || 0), 0);

  return (
    <div className="sal-container">
      <div className="sal-header">
        <div>
          <h1>{t('sal.title')}</h1>
          <p>{t('sal.subtitle')}</p>
        </div>
      </div>

      <div className="sal-month-picker">
        <label htmlFor="month">{t('sal.selectMonth')}</label>
        <div className="sal-month-nav">
          <button
            className="sal-month-arrow"
            onClick={() => {
              const [y, m] = month.split('-').map(Number);
              const d = new Date(y, m - 2, 1);
              setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }}
          >&#8249;</button>
          <input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button
            className="sal-month-arrow"
            onClick={() => {
              const [y, m] = month.split('-').map(Number);
              const d = new Date(y, m, 1);
              setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }}
          >&#8250;</button>
        </div>
        <span className="sal-month-label">{getMonthLabel(month)}</span>
        {deletedUnits.length > 0 && (
          <button className="btn-restore" onClick={handleRestoreAll} title="Restore removed units">
            {t('sal.restore').replace('{count}', deletedUnits.length)}
          </button>
        )}
        <button className="btn-excel" onClick={downloadExcel} title="Download Excel File">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9,15 12,18 15,15"/>
          </svg>
          Download Excel File
        </button>
      </div>

      {error && <div className="msg-error">{error}</div>}

      {loading ? (
        <div className="emp-loading">{t('sal.calculating')}</div>
      ) : activeEmployees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>{t('sal.noSalaries').replace('{month}', getMonthLabel(month))}</h3>
          <p>{t('sal.noActive')}</p>
        </div>
      ) : (
        <>
          <div className="sal-summary">
            <div className="sal-summary-card">
              <span className="sal-summary-label">{t('sal.activeEmployees')}</span>
              <span className="sal-summary-value">{filteredEmployees.length}</span>
            </div>
            <div className="sal-summary-card">
              <span className="sal-summary-label">{t('sal.workingDays')}</span>
              <span className="sal-summary-value">{workingDays}</span>
              <span className="sal-summary-note">
                {t('sal.weekends').replace('{count}', weekendDays).replace('{s}', weekendDays !== 1 ? 's' : '')}
                {holidaysCount > 0 && ` + ${t('sal.holidays').replace('{count}', holidaysCount).replace('{s}', holidaysCount !== 1 ? 's' : '')}`}
                {' '}{t('sal.excluded')}
              </span>
            </div>
            <div className="sal-summary-card">
              <span className="sal-summary-label">{t('sal.totalAccrued')}</span>
              <span className="sal-summary-value sal-total">{formatCurrency(totalAccrued)}</span>
            </div>
            {totalAdditions > 0 && (
              <div className="sal-summary-card">
                <span className="sal-summary-label">{t('sal.totalAdditions')}</span>
                <span className="sal-summary-value" style={{ color: '#2a7' }}>+{formatCurrency(totalAdditions)}</span>
              </div>
            )}
            {totalDeductions > 0 && (
              <div className="sal-summary-card">
                <span className="sal-summary-label">{t('sal.totalDeductions')}</span>
                <span className="sal-summary-value" style={{ color: '#e53e3e' }}>-{formatCurrency(totalDeductions)}</span>
              </div>
            )}
            {totalInsurance > 0 && (
              <div className="sal-summary-card">
                <span className="sal-summary-label">Insurance</span>
                <span className="sal-summary-value" style={{ color: '#e53e3e' }}>-{formatCurrency(totalInsurance)}</span>
              </div>
            )}
            <div className="sal-summary-card">
              <span className="sal-summary-label">{t('sal.totalNet')}</span>
              <span className="sal-summary-value sal-total">{formatCurrency(totalNet)}</span>
              {gelRate && <span className="sal-summary-note sal-gel">{formatGEL(totalNet * gelRate)}</span>}
            </div>
            {gelRate && (
              <div className="sal-summary-card">
                <span className="sal-summary-label">{t('sal.usdGelRate')}</span>
                <span className="sal-summary-value">{gelRate.toFixed(4)}</span>
              </div>
            )}
          </div>

          <div className="emp-table-wrapper">
            <table className="emp-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) + usedUnitTypes.length * 120 }}>
              <colgroup>
                {colWidths.slice(0, 6).map((w, i) => <col key={i} style={{ width: w }} />)}
                {usedUnitTypes.map(ut => <col key={`ucol-${ut.name}`} style={{ width: 120 }} />)}
                <col style={{ width: colWidths[6] }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ position: 'relative', width: colWidths[0], overflow: 'hidden', whiteSpace: 'nowrap' }}>Photo<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[1], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('sal.employee')}<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[2], overflow: 'hidden', whiteSpace: 'nowrap' }}>Position<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[3], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('sal.monthlySalary')}<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[4], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('sal.daysWorked')}<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  <th style={{ position: 'relative', width: colWidths[5], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('sal.accruedSalary')}<div onMouseDown={e => onResizeMouseDown(e, 5)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                  {usedUnitTypes.map(ut => (
                    <th key={`uth-${ut.name}`} style={{ width: 120, overflow: 'hidden', whiteSpace: 'nowrap', color: ut.direction === 'addition' ? '#16a34a' : '#e53e3e', textAlign: 'right' }}>
                      {ut.name}
                    </th>
                  ))}
                  <th style={{ position: 'relative', width: colWidths[6], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('sal.netSalary')}<div onMouseDown={e => onResizeMouseDown(e, 6)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                </tr>
                <tr className="filter-row">
                  <th></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.name} onChange={(e) => updateFilter('name', e.target.value)} /></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.position} onChange={(e) => updateFilter('position', e.target.value)} /></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.salary} onChange={(e) => updateFilter('salary', e.target.value)} /></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.days} onChange={(e) => updateFilter('days', e.target.value)} /></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.accrued} onChange={(e) => updateFilter('accrued', e.target.value)} /></th>
                  {usedUnitTypes.map(ut => <th key={`uf-${ut.name}`}></th>)}
                  <th>{hasFilters && <button className="btn-clear-filters" onClick={clearFilters} title="Clear filters">&times;</button>}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((item) => {
                  const isExpanded = expandedId === item.employee.id;
                  const deductions = (item.deductions || []).filter((d) => getUnitDirection(d.type) === 'deduction');
                  const additions = (item.deductions || []).filter((d) => getUnitDirection(d.type) === 'addition');

                  return (
                    <React.Fragment key={item.employee.id}>
                      <tr
                        className={`sal-row-clickable ${isExpanded ? 'sal-row-expanded' : ''}`}
                        onClick={() => toggleExpand(item.employee.id)}
                      >
                        <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          <div className="emp-photo-thumb">
                            {item.employee.photo_url ? (
                              <img src={item.employee.photo_url} alt={`${item.employee.first_name} ${item.employee.last_name}`} />
                            ) : (
                              <span className="no-photo">👤</span>
                            )}
                          </div>
                        </td>
                        <td className="emp-name" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {item.employee.first_name} {item.employee.last_name}
                        </td>
                        <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="position-badge">{item.employee.position}</span></td>
                        <td className="salary" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {formatCurrency(item.employee.salary)}
                          {item.salary_note && <div className="sal-change-note">{t('sal.changed')}</div>}
                        </td>
                        <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          <span className={item.days_worked < item.total_days ? 'days-partial' : 'days-full'}>
                            {item.days_worked} / {item.total_days}
                          </span>
                        </td>
                        <td className="salary sal-accrued" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {item.is_deferred ? (
                            <div>
                              <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontSize: 13 }}>{formatCurrency(item.original_accrued)}</span>
                              <div><span className="sal-defer-badge">→ Next month</span></div>
                            </div>
                          ) : (
                            <>
                              {formatCurrency(item.accrued_salary)}
                              {(item.carry_over || 0) > 0 && (
                                <div style={{ color: '#2a7', fontSize: 12 }}>+{formatCurrency(item.carry_over)} carried</div>
                              )}
                            </>
                          )}
                          {item.is_mid_month_starter && (
                            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
                              {item.is_deferred ? (
                                <button className="sal-defer-undo-btn" onClick={() => handleUndoDefer(item.employee.id)}>↩ Undo</button>
                              ) : (
                                <button className="sal-defer-btn" onClick={() => handleDefer(item.employee.id, item.original_accrued)}>→ Defer to next month</button>
                              )}
                            </div>
                          )}
                        </td>
                        {usedUnitTypes.map(ut => {
                          const total = getUnitTotal(item, ut.name);
                          return (
                            <td key={`utd-${ut.name}`} className="salary" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'right', color: total === 0 ? '#9ca3af' : ut.direction === 'addition' ? '#16a34a' : '#e53e3e' }}>
                              {total === 0 ? '—' : (ut.direction === 'addition' ? '+' : '-') + formatCurrency(total)}
                            </td>
                          );
                        })}
                        <td className="salary sal-accrued" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {formatCurrency(item.net_salary ?? item.accrued_salary)}
                          {gelRate && <div className="sal-gel-inline">{formatGEL((item.net_salary ?? item.accrued_salary) * gelRate)}</div>}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="sal-detail-row">
                          <td colSpan={7 + usedUnitTypes.length}>
                            <div className="sal-detail-panel">
                              <div className="sal-detail-grid">
                                {/* Existing Units */}
                                <div className="sal-detail-units">
                                  <h4>{t('sal.unitsTitle')}</h4>
                                  {(item.deductions || []).length === 0 ? (
                                    <div className="sal-detail-empty">{t('sal.noUnits')}</div>
                                  ) : (
                                    <div className="sal-units-list">
                                      {deductions.length > 0 && (
                                        <div className="sal-units-group">
                                          <span className="sal-units-group-label">{t('sal.deductions')}</span>
                                          {deductions.map((d) => (
                                            <div key={d.id} className="sal-unit-row sal-unit-deduction">
                                              <span className="sal-unit-type">{d.type}</span>
                                              <span className="sal-unit-date">{d.date}</span>
                                              <span className="sal-unit-amount">-{formatCurrency(d.amount)}</span>
                                              <button
                                                className="sal-unit-delete"
                                                onClick={() => handleDeleteDeduction(item.employee.id, d.id, d)}
                                              >&times;</button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {additions.length > 0 && (
                                        <div className="sal-units-group">
                                          <span className="sal-units-group-label">{t('sal.additions')}</span>
                                          {additions.map((d) => (
                                            <div key={d.id} className="sal-unit-row sal-unit-addition">
                                              <span className="sal-unit-type">{d.type}</span>
                                              <span className="sal-unit-date">{d.date}</span>
                                              <span className="sal-unit-amount">+{formatCurrency(d.amount)}</span>
                                              <button
                                                className="sal-unit-delete"
                                                onClick={() => handleDeleteDeduction(item.employee.id, d.id, d)}
                                              >&times;</button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Add Unit Form */}
                                <div className="sal-detail-form">
                                  <h4>{t('sal.addUnit')}</h4>
                                  <div className="sal-add-unit-form">
                                    <div className="sal-add-unit-row">
                                      <select
                                        value={unitForm.type}
                                        onChange={(e) => setUnitForm((prev) => ({ ...prev, type: e.target.value, amount: '', otHours: '' }))}
                                        className="sal-unit-select"
                                      >
                                        <option value="OT">OT (+)</option>
                                        {unitTypes.map((ut) => (
                                          <option key={ut.id} value={ut.name}>
                                            {ut.name} ({ut.direction === 'addition' ? '+' : '-'})
                                          </option>
                                        ))}
                                      </select>
                                      {(unitForm.type === 'OT' || unitForm.type === 'Overtime') && (() => {
                                        const hourlyRate = workingDays > 0 ? item.employee.salary / (workingDays * 8) : 0;
                                        const calcAmount = (rate, hours) =>
                                          hourlyRate > 0 && hours
                                            ? (hourlyRate * (parseFloat(rate) / 100) * parseFloat(hours)).toFixed(2)
                                            : '';
                                        return (
                                          <>
                                            <select
                                              value={unitForm.otRate}
                                              onChange={(e) => {
                                                const rate = e.target.value;
                                                setUnitForm((prev) => ({ ...prev, otRate: rate, amount: calcAmount(rate, prev.otHours) }));
                                              }}
                                              className="sal-unit-select"
                                            >
                                              {overtimeRates.length > 0
                                                ? overtimeRates.map(r => (
                                                    <option key={r.id} value={String(r.rate)}>{r.label} ({r.rate}%)</option>
                                                  ))
                                                : (<><option value="110">110%</option><option value="200">200%</option></>)
                                              }
                                            </select>
                                            <span className="sal-ot-rate-value">
                                              {hourlyRate > 0 ? hourlyRate.toFixed(4) : '—'}
                                            </span>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              placeholder="Hours"
                                              value={unitForm.otHours}
                                              onChange={(e) => {
                                                const hours = e.target.value;
                                                setUnitForm((prev) => ({ ...prev, otHours: hours, amount: calcAmount(prev.otRate, hours) }));
                                              }}
                                              className="sal-unit-input"
                                            />
                                          </>
                                        );
                                      })()}
                                      <div className="sal-amount-group">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          placeholder={t('sal.amountPlaceholder')}
                                          value={unitForm.amount}
                                          onChange={(e) => setUnitForm((prev) => ({ ...prev, amount: e.target.value }))}
                                          className="sal-unit-input"
                                        />
                                        <div className="sal-currency-toggle">
                                          {[{ code: 'USD', symbol: '$', flag: '🇺🇸' }, { code: 'GEL', symbol: '₾', flag: '🇬🇪' }, { code: 'EUR', symbol: '€', flag: '🇪🇺' }].map(({ code, symbol, flag }) => (
                                            <button
                                              key={code}
                                              type="button"
                                              className={`sal-currency-btn${unitForm.currency === code ? ' active' : ''}`}
                                              onClick={() => setUnitForm((prev) => ({ ...prev, currency: code }))}
                                              title={code}
                                            >
                                              <span>{flag}</span> {symbol}
                                            </button>
                                          ))}
                                        </div>
                                        {unitForm.currency !== 'USD' && unitForm.amount && (
                                          <span className="sal-currency-converted">
                                            ≈ ${toUSD(unitForm.amount, unitForm.currency)}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        className="btn-primary btn-sm"
                                        onClick={() => handleAddUnit(item.employee.id)}
                                        disabled={savingUnit || !unitForm.amount}
                                      >
                                        {savingUnit ? t('sal.adding') : t('sal.add')}
                                      </button>
                                    </div>
                                    <div className="sal-unit-hint">
                                      {getUnitDirection(unitForm.type) === 'addition'
                                        ? t('sal.addedToNet')
                                        : t('sal.deductedFromNet')}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Summary */}
                              <div className="sal-detail-summary">
                                <span>{t('sal.accrued')} <strong>{formatCurrency(item.accrued_salary)}</strong></span>
                                {(item.total_additions || 0) > 0 && (
                                  <span style={{ color: '#2a7' }}>{t('sal.additionsLabel')} <strong>{formatCurrency(item.total_additions)}</strong></span>
                                )}
                                {(item.total_deductions || 0) > 0 && (
                                  <span style={{ color: '#e53e3e' }}>{t('sal.deductionsLabel')} <strong>{formatCurrency(item.total_deductions)}</strong></span>
                                )}
                                {(item.insurance_deduction || 0) > 0 && (
                                  <span style={{ color: '#e53e3e' }}>Insurance <strong>-{formatCurrency(item.insurance_deduction)}</strong></span>
                                )}
                                {(item.carry_over || 0) > 0 && (
                                  <span style={{ color: '#2a7' }}>↩ Carried over <strong>+{formatCurrency(item.carry_over)}</strong></span>
                                )}
                                {item.is_deferred && (
                                  <span style={{ color: '#94a3b8' }}>⏭ Deferred <strong>{formatCurrency(item.original_accrued)}</strong> → next month</span>
                                )}
                                <span className="sal-detail-net">{t('sal.netLabel')} <strong>{formatCurrency(item.net_salary ?? item.accrued_salary)}</strong></span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5" className="sal-footer-label">{t('sal.footerTotal')}</td>
                  <td className="salary sal-accrued sal-footer-total">
                    {formatCurrency(totalAccrued)}
                  </td>
                  {usedUnitTypes.map(ut => {
                    const total = filteredEmployees.reduce((sum, item) => sum + getUnitTotal(item, ut.name), 0);
                    return (
                      <td key={`uft-${ut.name}`} className="salary sal-footer-total" style={{ textAlign: 'right', color: ut.direction === 'addition' ? '#16a34a' : '#e53e3e' }}>
                        {total === 0 ? '—' : (ut.direction === 'addition' ? '+' : '-') + formatCurrency(total)}
                      </td>
                    );
                  })}
                  <td className="salary sal-accrued sal-footer-total">
                    {formatCurrency(totalNet)}
                    {gelRate && <div className="sal-gel-inline">{formatGEL(totalNet * gelRate)}</div>}
                  </td>
                </tr>
              </tfoot>
            </table>
          {usePagination && totalPages > 1 && (
            <div className="pagination-controls">
              <button className="pagination-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>&laquo;</button>
              <button className="pagination-btn" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`dot-${i}`} className="pagination-info">...</span>
                  ) : (
                    <button key={p} className={`pagination-btn ${p === safePage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                  )
                )}
              <button className="pagination-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>&rsaquo;</button>
              <button className="pagination-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>&raquo;</button>
              <span className="pagination-info">{filteredEmployees.length} total</span>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

export default SalaryList;
