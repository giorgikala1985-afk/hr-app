import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const COLUMNS = [
  { key: 'date',        label: 'Accrual Date',  align: 'left',  defaultWidth: 120 },
  { key: 'personalId',  label: 'Personal ID',   align: 'left',  defaultWidth: 110 },
  { key: 'firstName',   label: 'Name',          align: 'left',  defaultWidth: 110 },
  { key: 'lastName',    label: 'Last Name',      align: 'left',  defaultWidth: 120 },
  { key: 'netSalary',   label: 'Salary Net',    align: 'right', defaultWidth: 120 },
  { key: 'adjustment',  label: 'Adjustments',   align: 'left',  defaultWidth: 200 },
  { key: 'fitpass',     label: 'Fitpass',        align: 'right', defaultWidth: 100 },
  { key: 'insurance',   label: 'Insurance',     align: 'right', defaultWidth: 100 },
  { key: 'pension',     label: 'Pension',        align: 'right', defaultWidth: 100 },
  { key: 'totalSum',    label: 'Total Sum',     align: 'right', defaultWidth: 120 },
  { key: 'totalGEL',   label: 'Total GEL',     align: 'right', defaultWidth: 120 },
  { key: 'grossSalary', label: 'Gross Salary',  align: 'right', defaultWidth: 120 },
];

const DEFAULT_WIDTHS = COLUMNS.map(c => c.defaultWidth);
const TEXT_KEYS = ['date', 'personalId', 'firstName', 'lastName'];
const COL_STORAGE_KEY = 'hr_salary_columns';

const todayMonth = () => new Date().toISOString().slice(0, 7);

function prevMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function unitAmt(units, typeName) {
  return (units || [])
    .filter(u => u.type?.toLowerCase().trim() === typeName.toLowerCase().trim())
    .reduce((s, u) => s + parseFloat(u.amount || 0), 0);
}

function calcGross(netSalary, pensionOn) {
  const net = parseFloat(netSalary || 0);
  if (net === 0) return 0;
  return pensionOn ? net / 0.95 / 0.98 : net / 0.95;
}

const HARDCODED_UNIT_NAMES = new Set(['Bonus', 'Team Building', 'Reimbursement', 'Fitpass', 'ფიზკულტურის მასწავლებელი']);

const UNIT_CURRENCIES = [
  { code: 'GEL', symbol: '₾', flag: '🇬🇪' },
  { code: 'USD', symbol: '$',  flag: '🇺🇸' },
];
const currSymbol = (code) => UNIT_CURRENCIES.find(c => c.code === code)?.symbol || code;

const money = (n) => {
  const v = parseFloat(n || 0);
  if (v === 0) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};
const moneyTotal = (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const moneySign = (n, dir) => {
  const v = parseFloat(n || 0);
  if (v === 0) return '—';
  const sign = dir === 'addition' ? '+' : '−';
  return `${sign}$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};
const moneyTotalSign = (n, dir) => {
  const v = parseFloat(n || 0);
  const sign = dir === 'addition' ? '+' : '−';
  return `${sign}$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};

const FONT_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", "Fira Mono", Menlo, Consolas, monospace';
const TD_NUM = { textAlign: 'right', fontFamily: FONT_MONO, fontSize: 13, padding: '11px 14px' };
const TD_BOLD = { ...TD_NUM, fontWeight: 700, color: 'var(--text)' };

function SalaryAccrual() {
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [month, setMonth] = useState(todayMonth());
  const [accrualDate, setAccrualDate] = useState(() => {
    const m = todayMonth();
    try { return localStorage.getItem(`sal_accrual_date_${m}`) || ''; } catch { return ''; }
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gelRate, setGelRate] = useState(null);

  const [unitTypes, setUnitTypes] = useState([]);
  const [overtimeRates, setOvertimeRates] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [unitForm, setUnitForm] = useState({ type: '', amount: '', otRate: '', otHours: '', currency: 'GEL' });
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(COL_STORAGE_KEY);
      if (!saved) return COLUMNS.map(c => c.key);
      const parsed = JSON.parse(saved);
      // always include new columns not yet in saved list
      const allKeys = COLUMNS.map(c => c.key);
      const newKeys = allKeys.filter(k => !parsed.includes(k));
      return [...parsed.filter(k => allKeys.includes(k)), ...newKeys];
    } catch { return COLUMNS.map(c => c.key); }
  });
  const [showColChooser, setShowColChooser] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  const [fontSize, setFontSize] = useState(() => {
    try { return parseFloat(localStorage.getItem('sal_font_size')) || 13; } catch { return 13; }
  });

  const zoomIn  = () => setFontSize(v => { const n = Math.min(22, Math.round((v + 1) * 10) / 10); localStorage.setItem('sal_font_size', n); return n; });
  const zoomOut = () => setFontSize(v => { const n = Math.max(9,  Math.round((v - 1) * 10) / 10); localStorage.setItem('sal_font_size', n); return n; });
  const zoomReset = () => { setFontSize(13); localStorage.setItem('sal_font_size', 13); };
  const zoomScale = fontSize / 13;
  const scaledW = (idx) => Math.round(colWidths[idx] * zoomScale);
  const dynColW = Math.round(120 * zoomScale);

  useEffect(() => {
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => { load(month); }, [month]);
  useEffect(() => {
    try { setAccrualDate(localStorage.getItem(`sal_accrual_date_${month}`) || ''); } catch {}
  }, [month]);
  useEffect(() => { loadUnitTypes(); }, []);
  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json()).then(d => { if (d.rates?.GEL) setGelRate(d.rates.GEL); }).catch(() => {});
  }, []);

  const load = async (m) => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/salaries?month=${m}`);
      setData(res.data);
    } catch { setError('Failed to load salary data.'); }
    finally { setLoading(false); }
  };

  const loadUnitTypes = async () => {
    try {
      const unitsRes = await api.get('/units');
      const types = unitsRes.data.unit_types || [];
      setUnitTypes(types);
      if (types.length > 0) setUnitForm(prev => prev.type ? prev : { ...prev, type: types[0].name });
    } catch {}
    try {
      const otRes = await api.get('/overtime-rates');
      const rates = otRes.data.overtime_rates || [];
      setOvertimeRates(rates);
      if (rates.length > 0) setUnitForm(prev => prev.otRate ? prev : { ...prev, otRate: String(rates[0].rate) });
    } catch {}
  };

  const getDirection = (typeName) => {
    if (typeName === 'OT' || typeName === 'Overtime') return 'addition';
    const found = unitTypes.find(u => u.name === typeName);
    return found ? found.direction : 'deduction';
  };

  const toggleCol = (key) => {
    setVisibleCols(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleAddUnit = async (employeeId) => {
    if (!unitForm.type || !unitForm.amount) return;
    const [y, m] = month.split('-');
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    const date = `${month}-${String(lastDay).padStart(2, '0')}`;
    setSavingUnit(true);
    try {
      await api.post(`/employees/${employeeId}/units`, {
        type: unitForm.type,
        amount: parseFloat(unitForm.amount),
        date,
        currency: unitForm.currency,
      });
      setUnitForm({ type: '', amount: '', otRate: overtimeRates.length > 0 ? String(overtimeRates[0].rate) : '', otHours: '', currency: unitForm.currency });
      const res = await api.get(`/salaries?month=${month}`);
      setData(res.data);
      const updated = (res.data.salaries || []).find(r => r.employee.id === employeeId);
      if (updated) setSelectedRow(updated);
    } catch { setError('Failed to add unit.'); }
    finally { setSavingUnit(false); }
  };

  const handleDeleteUnit = async (employeeId, unitId) => {
    if (!window.confirm('Remove this unit?')) return;
    try {
      await api.delete(`/employees/${employeeId}/units/${unitId}`);
      const res = await api.get(`/salaries?month=${month}`);
      setData(res.data);
      const updated = (res.data.salaries || []).find(r => r.employee.id === employeeId);
      if (updated) setSelectedRow(updated);
    } catch { setError('Failed to remove unit.'); }
  };

  const closeDrawer = () => { setSelectedRow(null); setUnitDropdownOpen(false); };

  const salaries = data?.salaries || [];
  const active = salaries.filter(r => r.accrued_salary > 0 || r.net_salary > 0 || r.total_additions > 0);

  const totNetSalary = active.reduce((s, r) => s + parseFloat(r.accrued_salary || 0), 0);
  const totFitpass   = active.reduce((s, r) => s + parseFloat(r.fitpass_deduction || 0), 0);
  const totInsurance = active.reduce((s, r) => s + parseFloat(r.insurance_deduction || 0), 0);
  const totGross     = active.reduce((s, r) => s + calcGross(r.net_salary, r.employee.pension), 0);
  const totPension   = active.reduce((s, r) => s + (r.employee.pension ? calcGross(r.net_salary, true) * 0.02 : 0), 0);
  const totSum       = active.reduce((s, r) => s + parseFloat(r.net_salary || 0), 0) - totPension;

  // Dynamic unit columns: only show unit types that still exist in settings
  const dynUnitCols = [];

  const dr = selectedRow;
  const drEmp = dr?.employee;
  const drGross = dr ? calcGross(dr.net_salary, drEmp.pension) : 0;
  const drInsurance = parseFloat(dr?.insurance_deduction || 0);
  const drFitpass = parseFloat(dr?.fitpass_deduction || 0);

  // Derive visible columns in order; grossSalary is always rendered last
  const visCols       = COLUMNS.filter(c => visibleCols.includes(c.key));
  const visColsMain   = visCols.filter(c => c.key !== 'grossSalary');
  const grossSalaryCol = visCols.find(c => c.key === 'grossSalary') || null;
  const tableWidth    = visColsMain.reduce((sum, col) => sum + scaledW(COLUMNS.indexOf(col)), 0)
                      + dynUnitCols.length * dynColW
                      + (grossSalaryCol ? scaledW(COLUMNS.indexOf(grossSalaryCol)) : 0);
  const visTextCols = visColsMain.filter(c => TEXT_KEYS.includes(c.key));
  const visNumCols  = visColsMain.filter(c => !TEXT_KEYS.includes(c.key));

  // Sticky left positions for text columns
  const stickyLeftMap = {};
  let _stickyLeft = 0;
  visColsMain.forEach(col => {
    if (TEXT_KEYS.includes(col.key)) {
      stickyLeftMap[col.key] = _stickyLeft;
      _stickyLeft += scaledW(COLUMNS.indexOf(col));
    }
  });
  const lastStickyKey = [...visColsMain].reverse().find(c => TEXT_KEYS.includes(c.key))?.key;

  const footerVal = (key) => {
    switch (key) {
      case 'netSalary':   return { val: moneyTotal(totNetSalary), style: TD_BOLD };
      case 'adjustment':  return { val: '', style: TD_NUM };
      case 'fitpass':     return { val: moneyTotalSign(totFitpass,   'deduction'), cls: 'cell-deduction', style: { ...TD_NUM, fontWeight: 700 } };
      case 'insurance':   return { val: moneyTotalSign(totInsurance, 'deduction'), cls: 'cell-deduction', style: { ...TD_NUM, fontWeight: 700 } };
      case 'totalSum':    return { val: moneyTotal(totSum),       style: { ...TD_BOLD, fontSize: 14 } };
      case 'totalGEL': {
        const totGEL = gelRate ? Math.round(totSum * gelRate * 100) / 100 : null;
        return { val: totGEL != null ? `₾${totGEL.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—', style: { ...TD_BOLD, fontSize: 14, color: '#f59e0b' } };
      }
      case 'grossSalary': return { val: moneyTotal(totGross),     style: { ...TD_BOLD, fontSize: 14, color: '#3b82f6' } };
      case 'pension':     return { val: moneyTotal(totPension),   style: { ...TD_NUM, color: '#8b5cf6', fontWeight: 700 } };
      default:            return { val: '', style: TD_NUM };
    }
  };

  const rowVal = (key, r, emp, bonus, teamBuild, reimburse, fitpass, insurance, grossSalary, pensionAmt) => {
    switch (key) {
      case 'date':        return <td key={key} style={{ color: 'var(--text-3)', fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{accrualDate || fmtMonth(month)}</td>;
      case 'personalId':  return <td key={key} style={{ fontFamily: FONT_MONO, fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.personal_id || '—'}</td>;
      case 'firstName':   return <td key={key} style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.first_name}</td>;
      case 'lastName':    return <td key={key} style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.last_name}</td>;
      case 'netSalary':   return <td key={key} style={{ ...TD_BOLD, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneyTotal(r.accrued_salary)}</td>;
      case 'adjustment': {
        const units = (r.deductions || []).filter(u => {
          const ut = unitTypes.find(t => t.name === u.type);
          return ut != null;
        });
        if (units.length === 0) return <td key={key} style={{ ...TD_NUM, color: 'var(--text-4)' }}>—</td>;
        return (
          <td key={key} style={{ padding: '6px 10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {units.map((u, i) => {
                const ut = unitTypes.find(t => t.name === u.type);
                const isAdd = ut?.direction === 'addition';
                const sym = currSymbol(u.currency || 'GEL');
                return (
                  <span key={i} title={`${u.type}: ${isAdd ? '+' : '-'}${sym}${parseFloat(u.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: isAdd ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                    color: isAdd ? '#4ade80' : '#f87171',
                    border: `1px solid ${isAdd ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
                    whiteSpace: 'nowrap', cursor: 'default',
                  }}>
                    {isAdd ? '+' : '-'}{sym}{parseFloat(u.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                );
              })}
            </div>
          </td>
        );
      }
      case 'fitpass':     return <td key={key} className={fitpass > 0 ? 'cell-deduction' : 'cell-muted'} style={{ ...TD_NUM, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneySign(fitpass, 'deduction')}</td>;
      case 'insurance':   return <td key={key} className={insurance > 0 ? 'cell-deduction' : 'cell-muted'} style={{ ...TD_NUM, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneySign(insurance, 'deduction')}</td>;
      case 'totalSum':    return <td key={key} style={{ ...TD_BOLD, fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneyTotal(parseFloat(r.net_salary || 0) - pensionAmt)}</td>;
      case 'totalGEL': {
        const netAfterPension = parseFloat(r.net_salary || 0) - pensionAmt;
        const gel = gelRate ? Math.round(netAfterPension * gelRate * 100) / 100 : null;
        return <td key={key} style={{ ...TD_BOLD, fontSize: 14, color: '#f59e0b', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{gel != null ? `₾${gel.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>;
      }
      case 'grossSalary': return <td key={key} style={{ ...TD_BOLD, fontSize: 14, color: '#3b82f6', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneyTotal(grossSalary)}</td>;
      case 'pension':     return <td key={key} style={{ ...TD_NUM, color: emp.pension ? '#8b5cf6' : 'var(--text-4)', fontWeight: emp.pension ? 700 : 400, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.pension ? moneyTotal(pensionAmt) : '—'}</td>;
      default:            return null;
    }
  };

  const exportToExcel = () => {
    // Header row
    const headers = [];
    visColsMain.forEach(col => headers.push(col.label));
    dynUnitCols.forEach(ut => headers.push(ut.name));
    if (grossSalaryCol) headers.push(grossSalaryCol.label);

    // Data rows
    const rows = active.map(r => {
      const emp        = r.employee;

      const fitpass    = parseFloat(r.fitpass_deduction || 0);
      const insurance  = parseFloat(r.insurance_deduction || 0);
      const grossSalary = calcGross(r.net_salary, emp.pension);
      const pensionAmt = emp.pension ? grossSalary * 0.02 : 0;
      const rowData = [];
      visColsMain.forEach(col => {
        switch (col.key) {
          case 'date':        rowData.push(accrualDate || fmtMonth(month)); break;
          case 'personalId':  rowData.push(emp.personal_id || ''); break;
          case 'firstName':   rowData.push(emp.first_name); break;
          case 'lastName':    rowData.push(emp.last_name); break;
          case 'netSalary':   rowData.push(parseFloat(r.accrued_salary || 0)); break;
          case 'adjustment':  rowData.push((r.deductions || []).filter(u => unitTypes.find(t => t.name === u.type)).map(u => { const ut = unitTypes.find(t => t.name === u.type); return `${ut?.direction === 'addition' ? '+' : '-'}${u.type}`; }).join(', ')); break;
          case 'fitpass':     rowData.push(fitpass || ''); break;
          case 'insurance':   rowData.push(insurance || ''); break;
          case 'totalSum':    rowData.push(parseFloat(r.net_salary || 0) - pensionAmt); break;
          case 'totalGEL':    rowData.push(gelRate ? Math.round((parseFloat(r.net_salary || 0) - pensionAmt) * gelRate * 100) / 100 : ''); break;
          case 'pension':     rowData.push(emp.pension ? pensionAmt : ''); break;
          default:            rowData.push('');
        }
      });
      dynUnitCols.forEach(ut => rowData.push(unitAmt(r.deductions, ut.name) || ''));
      if (grossSalaryCol) rowData.push(grossSalary);
      return rowData;
    });

    // Totals row
    const totalsRow = [];
    visColsMain.forEach(col => {
      switch (col.key) {
        case 'date':        totalsRow.push('TOTALS'); break;
        case 'personalId':  totalsRow.push(''); break;
        case 'firstName':   totalsRow.push(''); break;
        case 'lastName':    totalsRow.push(''); break;
        case 'netSalary':   totalsRow.push(totNetSalary); break;
        case 'fitpass':     totalsRow.push(totFitpass); break;
        case 'insurance':   totalsRow.push(totInsurance); break;
        case 'totalSum':    totalsRow.push(totSum); break;
        case 'pension':     totalsRow.push(totPension); break;
        default:            totalsRow.push('');
      }
    });
    dynUnitCols.forEach(ut => totalsRow.push(active.reduce((s, r) => s + unitAmt(r.deductions, ut.name), 0)));
    if (grossSalaryCol) totalsRow.push(totGross);

    const wsData = [headers, ...rows, totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths hint for Excel
    ws['!cols'] = headers.map((_, i) => ({ wch: i < 4 ? 18 : 14 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salaries');
    XLSX.writeFile(wb, `salaries-${month}.xlsx`);
  };

  return (
    <div>
      <h2>Salaries</h2>
      <p className="acc-subtitle">Monthly payroll accrual breakdown per employee. Click a row to manage units.</p>

      {/* Month picker */}
      <div className="sa-month-bar">
        <button className="sa-arrow" onClick={() => setMonth(prevMonth(month))}>‹</button>
        <span className="sa-month-label">{fmtMonth(month)}</span>
        <button className="sa-arrow" onClick={() => setMonth(nextMonth(month))}>›</button>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="sa-month-input" />
        {data && <span className="sa-meta">{data.working_days} working days · {data.holidays_count} holidays</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Accrual Date:</span>
          <input
            type="text"
            placeholder="e.g. 31.03.2026"
            value={accrualDate}
            onChange={e => {
              const val = e.target.value;
              setAccrualDate(val);
              try { localStorage.setItem(`sal_accrual_date_${month}`, val); } catch {}
            }}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 6,
              border: '1.5px solid var(--border-2)', background: 'var(--surface)',
              color: 'var(--text)', fontFamily: FONT_MONO, width: 110,
            }}
          />
        </span>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="acc-summary">
          <div className="acc-summary-card">
            <span className="acc-summary-label">Employees</span>
            <span className="acc-summary-value">{active.length}</span>
          </div>
          <div className="acc-summary-card">
            <span className="acc-summary-label">Net Payroll</span>
            <span className="acc-summary-value">{moneyTotal(totNetSalary)}</span>
          </div>
          {totFitpass > 0 && (
            <div className="acc-summary-card">
              <span className="acc-summary-label">Total Fitpass</span>
              <span className="acc-summary-value red">{moneyTotal(totFitpass)}</span>
            </div>
          )}
          {totInsurance > 0 && (
            <div className="acc-summary-card">
              <span className="acc-summary-label">Total Insurance</span>
              <span className="acc-summary-value red">{moneyTotal(totInsurance)}</span>
            </div>
          )}
        </div>
      )}

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Column chooser toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}>
        {/* Excel export */}
        <button
          onClick={exportToExcel}
          disabled={!data || active.length === 0}
          title="Download as Excel"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', background: 'var(--surface)',
            border: '1.5px solid var(--border-2)', borderRadius: 7,
            fontSize: 13, fontWeight: 500, color: '#16a34a',
            cursor: (!data || active.length === 0) ? 'not-allowed' : 'pointer',
            opacity: (!data || active.length === 0) ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Excel
        </button>
        {/* Font size controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface)', border: '1.5px solid var(--border-2)', borderRadius: 7, overflow: 'hidden' }}>
          <button onClick={zoomOut} title="Decrease font size" style={{ padding: '5px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text-2)', lineHeight: 1, display: 'flex', alignItems: 'center' }}>−</button>
          <span onClick={zoomReset} title="Reset font size" style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 32, textAlign: 'center', cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>{fontSize}px</span>
          <button onClick={zoomIn}  title="Increase font size" style={{ padding: '5px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text-2)', lineHeight: 1, display: 'flex', alignItems: 'center' }}>+</button>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColChooser(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: showColChooser ? (isDark ? '#1e3a5f' : '#eff6ff') : 'var(--surface)',
              border: `1.5px solid ${showColChooser ? '#3185FC' : 'var(--border-2)'}`,
              borderRadius: 7, fontSize: 13, fontWeight: 500,
              color: showColChooser ? '#3185FC' : 'var(--text-2)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Columns ({visCols.length}/{COLUMNS.length})
          </button>

          {showColChooser && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowColChooser(false)} />
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20,
                background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '8px 0', minWidth: 200,
              }}>
                <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-4)', borderBottom: '1px solid var(--border-3)' }}>
                  Visible Columns
                </div>
                {COLUMNS.map(col => (
                  <label key={col.key} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-2)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(col.key)}
                      onChange={() => toggleCol(col.key)}
                      style={{ accentColor: '#3185FC', width: 14, height: 14 }}
                    />
                    {col.label}
                  </label>
                ))}
                <div style={{ borderTop: '1px solid var(--border-3)', padding: '6px 14px 2px' }}>
                  <button
                    onClick={() => setVisibleCols(COLUMNS.map(c => c.key))}
                    style={{ background: 'none', border: 'none', color: '#3185FC', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                  >
                    Show all
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="acc-table-wrapper" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div className="acc-empty"><p>Loading…</p></div>
        ) : !data || active.length === 0 ? (
          <div className="acc-empty">
            <div className="acc-empty-icon">📊</div>
            <p>No salary data for this month.</p>
          </div>
        ) : visCols.length === 0 ? (
          <div className="acc-empty"><p>No columns selected. Use the Columns button to show columns.</p></div>
        ) : (
          <table className="acc-table" style={{ tableLayout: 'fixed', width: tableWidth, fontSize }}>
            <colgroup>
              {visColsMain.map(col => (
                <col key={col.key} style={{ width: scaledW(COLUMNS.indexOf(col)) }} />
              ))}
              {dynUnitCols.map(ut => <col key={`dyn-col-${ut.name}`} style={{ width: dynColW }} />)}
              {grossSalaryCol && <col style={{ width: scaledW(COLUMNS.indexOf(grossSalaryCol)) }} />}
            </colgroup>
            <thead>
              <tr>
                {visColsMain.map(col => {
                  const idx = COLUMNS.indexOf(col);
                  const isSticky = TEXT_KEYS.includes(col.key);
                  const isLastSticky = col.key === lastStickyKey;
                  return (
                    <th key={col.key} style={{
                      position: isSticky ? 'sticky' : 'relative',
                      left: isSticky ? stickyLeftMap[col.key] : undefined,
                      zIndex: isSticky ? 3 : undefined,
                      background: isSticky ? 'var(--surface-2)' : undefined,
                      boxShadow: isLastSticky ? '2px 0 5px rgba(0,0,0,0.08)' : undefined,
                      width: scaledW(idx),
                      overflow: 'hidden', whiteSpace: 'nowrap',
                      textAlign: col.align === 'right' ? 'right' : undefined,
                    }}>
                      {col.label}
                      <div
                        onMouseDown={e => onResizeMouseDown(e, idx)}
                        style={RESIZE_HANDLE_STYLE}
                        onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      />
                    </th>
                  );
                })}
                {dynUnitCols.map(ut => (
                  <th key={`dyn-th-${ut.name}`} style={{
                    width: dynColW, overflow: 'hidden', whiteSpace: 'nowrap',
                    textAlign: 'right', padding: '12px 14px',
                    color: ut.direction === 'addition' ? '#16a34a' : '#e53e3e',
                  }}>
                    {ut.name}
                  </th>
                ))}
                {grossSalaryCol && (() => {
                  const idx = COLUMNS.indexOf(grossSalaryCol);
                  return (
                    <th key="grossSalary" style={{
                      position: 'relative', width: scaledW(idx),
                      overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right',
                    }}>
                      {grossSalaryCol.label}
                      <div onMouseDown={e => onResizeMouseDown(e, idx)} style={RESIZE_HANDLE_STYLE}
                        onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                    </th>
                  );
                })()}
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const emp         = r.employee;
                const bonus       = unitAmt(r.deductions, 'Bonus');
                const teamBuild   = unitAmt(r.deductions, 'Team Building');
                const reimburse   = unitAmt(r.deductions, 'Reimbursement');
                const fitpass     = parseFloat(r.fitpass_deduction || 0);
                const insurance   = parseFloat(r.insurance_deduction || 0);
                const grossSalary = calcGross(r.net_salary, emp.pension);
                const pensionAmt  = emp.pension ? grossSalary * 0.02 : 0;
                const isSelected  = selectedRow?.employee?.id === emp.id;

                return (
                  <tr
                    key={emp.id}
                    style={{ transition: 'background 0.15s' }}
                  >
                    {visColsMain.map(col => {
                      const cell = rowVal(col.key, r, emp, bonus, teamBuild, reimburse, fitpass, insurance, grossSalary, pensionAmt);
                      if (!cell) return null;
                      if (TEXT_KEYS.includes(col.key)) {
                        return React.cloneElement(cell, {
                          style: {
                            ...cell.props.style,
                            position: 'sticky',
                            left: stickyLeftMap[col.key],
                            zIndex: 1,
                            background: isSelected ? (isDark ? '#1e2a45' : '#eff6ff') : 'var(--surface)',
                            boxShadow: col.key === lastStickyKey ? '2px 0 5px rgba(0,0,0,0.08)' : undefined,
                          }
                        });
                      }
                      return cell;
                    })}
                    {dynUnitCols.map(ut => {
                      const amt = unitAmt(r.deductions, ut.name);
                      return (
                        <td key={`dyn-td-${ut.name}`} className={amt > 0 ? (ut.direction === 'addition' ? 'cell-addition' : 'cell-deduction') : 'cell-muted'} style={{ ...TD_NUM, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {moneySign(amt, ut.direction)}
                        </td>
                      );
                    })}
                    {grossSalaryCol && rowVal('grossSalary', r, emp, bonus, teamBuild, reimburse, fitpass, insurance, grossSalary, pensionAmt)}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                {visTextCols.length > 0 && (
                  <td
                    colSpan={visTextCols.length}
                    style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface-2)', boxShadow: '2px 0 5px rgba(0,0,0,0.08)', padding: '12px 16px', textAlign: 'right', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}
                  >
                    Totals
                  </td>
                )}
                {visNumCols.map(col => {
                  const { val, style, cls } = footerVal(col.key);
                  return (
                    <td key={col.key} className={cls || ''} style={{ ...style, borderTop: '2px solid var(--border-2)' }}>{val}</td>
                  );
                })}
                {dynUnitCols.map(ut => {
                  const total = active.reduce((sum, r) => sum + unitAmt(r.deductions, ut.name), 0);
                  return (
                    <td key={`dyn-tf-${ut.name}`} className={ut.direction === 'addition' ? 'cell-addition' : 'cell-deduction'} style={{ ...TD_NUM, fontWeight: 700, borderTop: '2px solid var(--border-2)' }}>
                      {moneyTotalSign(total, ut.direction)}
                    </td>
                  );
                })}
                {grossSalaryCol && (() => {
                  const { val, style } = footerVal('grossSalary');
                  return <td key="gross-tf" style={{ ...style, borderTop: '2px solid var(--border-2)' }}>{val}</td>;
                })()}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

    </div>
  );
}

export default SalaryAccrual;
