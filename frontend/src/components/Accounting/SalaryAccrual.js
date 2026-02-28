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
  { key: 'bonus',       label: 'Bonus',          align: 'right', defaultWidth: 100 },
  { key: 'teamBuild',   label: 'Team Building', align: 'right', defaultWidth: 120 },
  { key: 'reimburse',   label: 'Reimbursement', align: 'right', defaultWidth: 120 },
  { key: 'fitpass',     label: 'Fitpass',        align: 'right', defaultWidth: 100 },
  { key: 'insurance',   label: 'Insurance',     align: 'right', defaultWidth: 100 },
  { key: 'totalSum',    label: 'Total Sum',     align: 'right', defaultWidth: 120 },
  { key: 'grossSalary', label: 'Gross Salary',  align: 'right', defaultWidth: 120 },
  { key: 'pension',     label: 'Pension',        align: 'right', defaultWidth: 100 },
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

const HARDCODED_UNIT_NAMES = new Set(['Bonus', 'Team Building', 'Reimbursement', 'Fitpass']);

const money = (n) => {
  const v = parseFloat(n || 0);
  if (v === 0) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};
const moneyTotal = (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const FONT_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", "Fira Mono", Menlo, Consolas, monospace';
const TD_NUM = { textAlign: 'right', fontFamily: FONT_MONO, fontSize: 13, padding: '11px 14px' };
const TD_BOLD = { ...TD_NUM, fontWeight: 700, color: '#111827' };

function SalaryAccrual() {
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [month, setMonth] = useState(todayMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [unitTypes, setUnitTypes] = useState([]);
  const [overtimeRates, setOvertimeRates] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [unitForm, setUnitForm] = useState({ type: '', amount: '', otRate: '', otHours: '' });
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(COL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : COLUMNS.map(c => c.key);
    } catch { return COLUMNS.map(c => c.key); }
  });
  const [showColChooser, setShowColChooser] = useState(false);
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
  useEffect(() => { loadUnitTypes(); }, []);

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
      });
      setUnitForm({ type: '', amount: '', otRate: overtimeRates.length > 0 ? String(overtimeRates[0].rate) : '', otHours: '' });
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

  const totNetSalary = active.reduce((s, r) => s + parseFloat(r.net_salary || 0), 0);
  const totBonus     = active.reduce((s, r) => s + unitAmt(r.deductions, 'Bonus'), 0);
  const totTeam      = active.reduce((s, r) => s + unitAmt(r.deductions, 'Team Building'), 0);
  const totReimburse = active.reduce((s, r) => s + unitAmt(r.deductions, 'Reimbursement'), 0);
  const totFitpass   = active.reduce((s, r) => s + unitAmt(r.deductions, 'Fitpass'), 0);
  const totInsurance = active.reduce((s, r) => s + parseFloat(r.insurance_deduction || 0), 0);
  const totSum       = active.reduce((s, r) => s + parseFloat(r.net_salary || 0), 0);
  const totGross     = active.reduce((s, r) => s + calcGross(r.net_salary, r.employee.pension), 0);
  const totPension   = active.reduce((s, r) => s + (r.employee.pension ? calcGross(r.net_salary, true) * 0.02 : 0), 0);

  // Dynamic unit columns: any unit type used this month that isn't already a hardcoded column
  const dynUnitCols = (() => {
    const map = new Map();
    active.forEach(r => {
      (r.deductions || []).forEach(d => {
        if (!HARDCODED_UNIT_NAMES.has(d.type) && !map.has(d.type)) {
          const ut = unitTypes.find(u => u.name === d.type);
          const dir = ut ? ut.direction : (d.type === 'OT' || d.type === 'Overtime' ? 'addition' : 'deduction');
          map.set(d.type, dir);
        }
      });
    });
    return Array.from(map.entries()).map(([name, direction]) => ({ name, direction }));
  })();

  const dr = selectedRow;
  const drEmp = dr?.employee;
  const drGross = dr ? calcGross(dr.net_salary, drEmp.pension) : 0;
  const drInsurance = parseFloat(dr?.insurance_deduction || 0);

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
      case 'bonus':       return { val: moneyTotal(totBonus),     style: { ...TD_NUM, color: '#16a34a', fontWeight: 700 } };
      case 'teamBuild':   return { val: moneyTotal(totTeam),      style: { ...TD_NUM, color: '#16a34a', fontWeight: 700 } };
      case 'reimburse':   return { val: moneyTotal(totReimburse), style: { ...TD_NUM, color: '#16a34a', fontWeight: 700 } };
      case 'fitpass':     return { val: moneyTotal(totFitpass),   style: { ...TD_NUM, color: '#e53e3e', fontWeight: 700 } };
      case 'insurance':   return { val: moneyTotal(totInsurance), style: { ...TD_NUM, color: '#e53e3e', fontWeight: 700 } };
      case 'totalSum':    return { val: moneyTotal(totSum),       style: { ...TD_BOLD, fontSize: 14 } };
      case 'grossSalary': return { val: moneyTotal(totGross),     style: { ...TD_BOLD, fontSize: 14, color: '#2563eb' } };
      case 'pension':     return { val: moneyTotal(totPension),   style: { ...TD_NUM, color: '#7c3aed', fontWeight: 700 } };
      default:            return { val: '', style: TD_NUM };
    }
  };

  const rowVal = (key, r, emp, bonus, teamBuild, reimburse, fitpass, insurance, grossSalary, pensionAmt) => {
    switch (key) {
      case 'date':        return <td key={key} style={{ color: '#6b7280', fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fmtMonth(month)}</td>;
      case 'personalId':  return <td key={key} style={{ fontFamily: FONT_MONO, fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.personal_id || '—'}</td>;
      case 'firstName':   return <td key={key} style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.first_name}</td>;
      case 'lastName':    return <td key={key} style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.last_name}</td>;
      case 'netSalary':   return <td key={key} style={{ ...TD_BOLD, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneyTotal(r.net_salary)}</td>;
      case 'bonus':       return <td key={key} style={{ ...TD_NUM, color: bonus > 0 ? '#16a34a' : '#9ca3af', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{money(bonus)}</td>;
      case 'teamBuild':   return <td key={key} style={{ ...TD_NUM, color: teamBuild > 0 ? '#16a34a' : '#9ca3af', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{money(teamBuild)}</td>;
      case 'reimburse':   return <td key={key} style={{ ...TD_NUM, color: reimburse > 0 ? '#16a34a' : '#9ca3af', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{money(reimburse)}</td>;
      case 'fitpass':     return <td key={key} style={{ ...TD_NUM, color: fitpass > 0 ? '#e53e3e' : '#9ca3af', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{money(fitpass)}</td>;
      case 'insurance':   return <td key={key} style={{ ...TD_NUM, color: insurance > 0 ? '#e53e3e' : '#9ca3af', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{money(insurance)}</td>;
      case 'totalSum':    return <td key={key} style={{ ...TD_BOLD, fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneyTotal(r.net_salary)}</td>;
      case 'grossSalary': return <td key={key} style={{ ...TD_BOLD, fontSize: 14, color: '#2563eb', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneyTotal(grossSalary)}</td>;
      case 'pension':     return <td key={key} style={{ ...TD_NUM, color: emp.pension ? '#7c3aed' : '#9ca3af', fontWeight: emp.pension ? 700 : 400, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.pension ? moneyTotal(pensionAmt) : '—'}</td>;
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
      const bonus      = unitAmt(r.deductions, 'Bonus');
      const teamBuild  = unitAmt(r.deductions, 'Team Building');
      const reimburse  = unitAmt(r.deductions, 'Reimbursement');
      const fitpass    = unitAmt(r.deductions, 'Fitpass');
      const insurance  = parseFloat(r.insurance_deduction || 0);
      const grossSalary = calcGross(r.net_salary, emp.pension);
      const pensionAmt = emp.pension ? grossSalary * 0.02 : 0;
      const rowData = [];
      visColsMain.forEach(col => {
        switch (col.key) {
          case 'date':        rowData.push(fmtMonth(month)); break;
          case 'personalId':  rowData.push(emp.personal_id || ''); break;
          case 'firstName':   rowData.push(emp.first_name); break;
          case 'lastName':    rowData.push(emp.last_name); break;
          case 'netSalary':   rowData.push(parseFloat(r.net_salary || 0)); break;
          case 'bonus':       rowData.push(bonus || ''); break;
          case 'teamBuild':   rowData.push(teamBuild || ''); break;
          case 'reimburse':   rowData.push(reimburse || ''); break;
          case 'fitpass':     rowData.push(fitpass || ''); break;
          case 'insurance':   rowData.push(insurance || ''); break;
          case 'totalSum':    rowData.push(parseFloat(r.net_salary || 0)); break;
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
        case 'bonus':       totalsRow.push(totBonus); break;
        case 'teamBuild':   totalsRow.push(totTeam); break;
        case 'reimburse':   totalsRow.push(totReimburse); break;
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
          <div className="acc-summary-card">
            <span className="acc-summary-label">Total Bonus</span>
            <span className="acc-summary-value" style={{ color: '#16a34a' }}>{moneyTotal(totBonus)}</span>
          </div>
          <div className="acc-summary-card">
            <span className="acc-summary-label">Total Fitpass</span>
            <span className="acc-summary-value red">{moneyTotal(totFitpass)}</span>
          </div>
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
            padding: '6px 14px', background: 'white',
            border: '1.5px solid #e5e7eb', borderRadius: 7,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 7, overflow: 'hidden' }}>
          <button onClick={zoomOut} title="Decrease font size" style={{ padding: '5px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: '#374151', lineHeight: 1, display: 'flex', alignItems: 'center' }}>−</button>
          <span onClick={zoomReset} title="Reset font size" style={{ fontSize: 12, color: '#6b7280', minWidth: 32, textAlign: 'center', cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>{fontSize}px</span>
          <button onClick={zoomIn}  title="Increase font size" style={{ padding: '5px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: '#374151', lineHeight: 1, display: 'flex', alignItems: 'center' }}>+</button>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColChooser(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: showColChooser ? '#eff6ff' : 'white',
              border: `1.5px solid ${showColChooser ? '#3185FC' : '#e5e7eb'}`,
              borderRadius: 7, fontSize: 13, fontWeight: 500,
              color: showColChooser ? '#3185FC' : '#374151',
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
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '8px 0', minWidth: 200,
              }}>
                <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>
                  Visible Columns
                </div>
                {COLUMNS.map(col => (
                  <label key={col.key} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: '#374151',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
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
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '6px 14px 2px' }}>
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
                      background: isSticky ? '#f8f9fa' : undefined,
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
                const fitpass     = unitAmt(r.deductions, 'Fitpass');
                const insurance   = parseFloat(r.insurance_deduction || 0);
                const grossSalary = calcGross(r.net_salary, emp.pension);
                const pensionAmt  = emp.pension ? grossSalary * 0.02 : 0;
                const isSelected  = selectedRow?.employee?.id === emp.id;

                return (
                  <tr
                    key={emp.id}
                    style={{ cursor: 'pointer', background: isSelected ? '#eff6ff' : undefined, transition: 'background 0.15s' }}
                    onClick={() => setSelectedRow(isSelected ? null : r)}
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
                            background: isSelected ? '#eff6ff' : 'white',
                            boxShadow: col.key === lastStickyKey ? '2px 0 5px rgba(0,0,0,0.08)' : undefined,
                          }
                        });
                      }
                      return cell;
                    })}
                    {dynUnitCols.map(ut => {
                      const amt = unitAmt(r.deductions, ut.name);
                      return (
                        <td key={`dyn-td-${ut.name}`} style={{ ...TD_NUM, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: amt > 0 ? (ut.direction === 'addition' ? '#16a34a' : '#e53e3e') : '#9ca3af' }}>
                          {money(amt)}
                        </td>
                      );
                    })}
                    {grossSalaryCol && rowVal('grossSalary', r, emp, bonus, teamBuild, reimburse, fitpass, insurance, grossSalary, pensionAmt)}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                {visTextCols.length > 0 && (
                  <td
                    colSpan={visTextCols.length}
                    style={{ position: 'sticky', left: 0, zIndex: 1, background: '#f9fafb', boxShadow: '2px 0 5px rgba(0,0,0,0.08)', padding: '12px 16px', textAlign: 'right', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px' }}
                  >
                    Totals
                  </td>
                )}
                {visNumCols.map(col => {
                  const { val, style } = footerVal(col.key);
                  return (
                    <td key={col.key} style={{ ...style, borderTop: '2px solid #e5e7eb' }}>{val}</td>
                  );
                })}
                {dynUnitCols.map(ut => {
                  const total = active.reduce((sum, r) => sum + unitAmt(r.deductions, ut.name), 0);
                  return (
                    <td key={`dyn-tf-${ut.name}`} style={{ ...TD_NUM, fontWeight: 700, borderTop: '2px solid #e5e7eb', color: ut.direction === 'addition' ? '#16a34a' : '#e53e3e' }}>
                      {moneyTotal(total)}
                    </td>
                  );
                })}
                {grossSalaryCol && (() => {
                  const { val, style } = footerVal('grossSalary');
                  return <td key="gross-tf" style={{ ...style, borderTop: '2px solid #e5e7eb' }}>{val}</td>;
                })()}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Side drawer */}
      {dr && (
        <>
          <div className="sa-drawer-backdrop" onClick={closeDrawer} />
          <div className="sa-drawer">
            <div className="sa-drawer-header">
              <div>
                <div className="sa-drawer-title">{drEmp.first_name} {drEmp.last_name}</div>
                <div className="sa-drawer-subtitle">{fmtMonth(month)} · {drEmp.pension ? 'Pension on' : 'Pension off'}</div>
              </div>
              <button className="sa-drawer-close" onClick={closeDrawer}>&times;</button>
            </div>

            <div className="sa-drawer-body">
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Units / Adjustments</h4>
                {(dr.deductions || []).length === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>No units this month.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(dr.deductions || []).map(d => {
                      const isAdd = getDirection(d.type) === 'addition';
                      return (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: isAdd ? '#f0fff4' : '#fff5f5' }}>
                          <span style={{ fontWeight: 600, color: '#333', flex: 1 }}>{d.type}</span>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>{d.date}</span>
                          <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: isAdd ? '#16a34a' : '#e53e3e' }}>
                            {isAdd ? '+' : '−'}${parseFloat(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <button
                            style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
                            onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
                            onClick={() => handleDeleteUnit(drEmp.id, d.id)}
                            title="Remove"
                          >&times;</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add Unit</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    {unitDropdownOpen && (
                      <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setUnitDropdownOpen(false)} />
                    )}
                    <button
                      type="button"
                      onClick={() => setUnitDropdownOpen(v => !v)}
                      style={{
                        width: '100%', padding: '9px 12px', border: `1.5px solid ${unitDropdownOpen ? '#3185FC' : '#e0e0e0'}`,
                        borderRadius: 7, fontSize: 13, background: 'white', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit',
                      }}
                    >
                      {unitForm.type ? (
                        <span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{unitForm.type}</span>
                          {' '}
                          <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: getDirection(unitForm.type) === 'addition' ? '#16a34a' : '#e53e3e' }}>
                            ({getDirection(unitForm.type) === 'addition' ? '+' : '−'})
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Select unit type…</span>
                      )}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: unitDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </button>
                    {unitDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
                        background: 'white', border: '1.5px solid #e0e0e0', borderRadius: 7,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.1)', overflow: 'hidden',
                      }}>
                        {unitTypes.map(ut => {
                          const isAdd = ut.direction === 'addition';
                          const isSelected = unitForm.type === ut.name;
                          return (
                            <div
                              key={ut.id}
                              onClick={() => { setUnitForm({ type: ut.name, amount: '', otRate: '110', otHours: '' }); setUnitDropdownOpen(false); }}
                              style={{
                                padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: isSelected ? '#eff6ff' : 'white', fontSize: 13,
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white'; }}
                            >
                              <span style={{ fontWeight: isSelected ? 700 : 500, color: '#111827' }}>{ut.name}</span>
                              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: isAdd ? '#16a34a' : '#e53e3e' }}>
                                {isAdd ? '(+)' : '(−)'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {(unitForm.type === 'OT' || unitForm.type === 'Overtime') && (() => {
                    const workingDays = data?.working_days || 0;
                    const hourlyRate = workingDays > 0 ? drEmp.salary / (workingDays * 8) : 0;
                    const calcAmount = (rate, hours) =>
                      hourlyRate > 0 && hours
                        ? (hourlyRate * (parseFloat(rate) / 100) * parseFloat(hours)).toFixed(2)
                        : '';
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select
                            value={unitForm.otRate}
                            onChange={e => {
                              const rate = e.target.value;
                              setUnitForm(prev => ({ ...prev, otRate: rate, amount: calcAmount(rate, prev.otHours) }));
                            }}
                            style={{ padding: '9px 12px', border: '1.5px solid #e0e0e0', borderRadius: 7, fontSize: 13, flex: 1 }}
                          >
                            {overtimeRates.length > 0
                              ? overtimeRates.map(r => (
                                  <option key={r.id} value={String(r.rate)}>{r.label} ({r.rate}%)</option>
                                ))
                              : (<><option value="110">110%</option><option value="200">200%</option></>)
                            }
                          </select>
                          <div style={{ padding: '9px 12px', background: '#f0f4ff', border: '1.5px solid #e0e0e0', borderRadius: 7, fontSize: 12, fontFamily: FONT_MONO, color: '#374151', whiteSpace: 'nowrap' }}>
                            {hourlyRate > 0 ? `$${hourlyRate.toFixed(4)}/hr` : '—'}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Hours"
                          value={unitForm.otHours}
                          onChange={e => {
                            const hours = e.target.value;
                            setUnitForm(prev => ({ ...prev, otHours: hours, amount: calcAmount(prev.otRate, hours) }));
                          }}
                          style={{ padding: '9px 12px', border: '1.5px solid #e0e0e0', borderRadius: 7, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    );
                  })()}

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={unitForm.amount}
                    onChange={e => setUnitForm(prev => ({ ...prev, amount: e.target.value }))}
                    style={{ padding: '9px 12px', border: '1.5px solid #e0e0e0', borderRadius: 7, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                    {getDirection(unitForm.type) === 'addition' ? 'Will be added to net salary' : 'Will be deducted from net salary'}
                  </div>
                  <button
                    className="btn-primary"
                    disabled={savingUnit || !unitForm.amount || !unitForm.type}
                    onClick={() => handleAddUnit(drEmp.id)}
                    style={{ width: '100%' }}
                  >
                    {savingUnit ? 'Adding…' : 'Add Unit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SalaryAccrual;
