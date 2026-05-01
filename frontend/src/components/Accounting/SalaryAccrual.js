import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const COLUMNS = [
  { key: 'date',        labelKey: 'salAccrual.colAccrualDate', label: 'Accrual Date',  align: 'left',  defaultWidth: 120 },
  { key: 'personalId',  labelKey: 'salAccrual.colPersonalId',  label: 'Personal ID',   align: 'left',  defaultWidth: 110 },
  { key: 'firstName',   labelKey: 'salAccrual.colName',        label: 'Name',          align: 'left',  defaultWidth: 110 },
  { key: 'lastName',    labelKey: 'salAccrual.colLastName',     label: 'Last Name',     align: 'left',  defaultWidth: 120 },
  { key: 'netSalary',   labelKey: 'salAccrual.colSalaryNet',   label: 'Salary Net',    align: 'right', defaultWidth: 120 },
  { key: 'fitpass',     labelKey: 'salAccrual.colFitpass',     label: 'Fitpass',       align: 'right', defaultWidth: 100 },
  { key: 'insurance',   labelKey: 'salAccrual.colInsurance',   label: 'Insurance',     align: 'right', defaultWidth: 100 },
  { key: 'totalSum',    labelKey: 'salAccrual.colTotalSum',    label: 'Total Sum',     align: 'right', defaultWidth: 120 },
  { key: 'totalGEL',    labelKey: 'salAccrual.colTotalGEL',   label: 'Total GEL',     align: 'right', defaultWidth: 120 },
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

function SalaryAccrual({ onCreateSalaryFile, onMonthChange }) {
  const { t } = useLanguage();
  const TCOLS = COLUMNS.map(c => ({ ...c, label: t(c.labelKey) }));
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
  const [nbgRate, setNbgRate] = useState(null);
  const [nbgDate, setNbgDate] = useState('');
  const [insuranceList, setInsuranceList] = useState([]);

  const [unitTypes, setUnitTypes] = useState([]);
  const [overtimeRates, setOvertimeRates] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [unitForm, setUnitForm] = useState({ type: '', amount: '', otRate: '', otHours: '', currency: 'GEL' });
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [transferDate, setTransferDate] = useState('');
  const [transferRate, setTransferRate] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);

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

  useEffect(() => {
    load(month); setTransferDate(''); setTransferRate(null);
    if (onMonthChange) onMonthChange(month);
  }, [month]);
  useEffect(() => {
    try { setAccrualDate(localStorage.getItem(`sal_accrual_date_${month}`) || ''); } catch {}
  }, [month]);
  useEffect(() => { loadUnitTypes(); }, []);
  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json()).then(d => { if (d.rates?.GEL) setGelRate(d.rates.GEL); }).catch(() => {});
  }, []);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${today}&lang=en`)
      .then(r => r.json())
      .then(json => {
        const list = json?.[0]?.currencies || [];
        const usd = list.find(c => c.code === 'USD');
        if (usd) { setNbgRate(usd.rate / (usd.quantity || 1)); setNbgDate(today); }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!transferDate) { setTransferRate(null); return; }
    setLoadingRate(true);
    fetch(`https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${transferDate}&lang=en`)
      .then(r => r.json())
      .then(json => {
        const list = json?.[0]?.currencies || [];
        const usd = list.find(c => c.code === 'USD');
        if (usd) setTransferRate(usd.rate / (usd.quantity || 1));
        else setTransferRate(null);
      })
      .catch(() => setTransferRate(null))
      .finally(() => setLoadingRate(false));
  }, [transferDate]);

  const normalizeId = (id) => String(id || '').trim().replace(/\s+/g, '');
  const idsMatch = (a, b) => {
    const na = normalizeId(a), nb = normalizeId(b);
    if (!na || !nb) return false;
    return na === nb || na.replace(/^0+/, '') === nb.replace(/^0+/, '');
  };
  const dateMatchesMonth = (date, m) => {
    if (!date) return false;
    const d = String(date).trim();
    if (d.startsWith(m)) return true;
    try { const p = new Date(d); if (!isNaN(p)) return `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}` === m; } catch {}
    return false;
  };
  const getInsAmount2 = (personalId, m) => {
    if (!personalId) return 0;
    return insuranceList
      .filter(rec => idsMatch(rec.personal_id, personalId) && dateMatchesMonth(rec.period || rec.date, m))
      .reduce((s, rec) => s + parseFloat(rec.amount2 || 0), 0);
  };

  const load = async (m) => {
    setLoading(true); setError('');
    try {
      const [salRes, insRes] = await Promise.all([
        api.get(`/salaries?month=${m}`),
        api.get('/insurance-list'),
      ]);
      setData(salRes.data);
      setInsuranceList(insRes.data?.records || []);
    } catch { setError(t('salAccrual.failedLoad')); }
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
    } catch { setError(t('salAccrual.failedAdd')); }
    finally { setSavingUnit(false); }
  };

  const handleDeleteUnit = async (employeeId, unitId) => {
    if (!window.confirm(t('salAccrual.removeUnit'))) return;
    try {
      await api.delete(`/employees/${employeeId}/units/${unitId}`);
      const res = await api.get(`/salaries?month=${month}`);
      setData(res.data);
      const updated = (res.data.salaries || []).find(r => r.employee.id === employeeId);
      if (updated) setSelectedRow(updated);
    } catch { setError(t('salAccrual.failedRemove')); }
  };

  const closeDrawer = () => { setSelectedRow(null); setUnitDropdownOpen(false); };

  const salaries = data?.salaries || [];
  const active = salaries.filter(r => r.accrued_salary > 0 || r.net_salary > 0 || r.total_additions > 0);

  const totNetSalary = active.reduce((s, r) => s + parseFloat(r.accrued_salary || 0), 0);
  const totFitpass   = active.reduce((s, r) => s + parseFloat(r.fitpass_deduction || 0), 0);
  const totInsurance = active.reduce((s, r) => s + getInsAmount2(r.employee?.personal_id, month), 0);
  const totGross     = active.reduce((s, r) => s + calcGross(r.net_salary, r.employee.pension), 0);
  const totPension   = active.reduce((s, r) => s + (r.employee.pension ? calcGross(r.net_salary, true) * 0.02 : 0), 0);
  const totSum       = active.reduce((s, r) => {
    const ins2 = getInsAmount2(r.employee?.personal_id, month);
    return s + parseFloat(r.net_salary || 0) + parseFloat(r.insurance_deduction || 0) - ins2;
  }, 0);

  // Dynamic unit columns: one column per unit type actually used this month
  const usedTypeNames = new Set(
    active.flatMap(r => (r.deductions || [])
      .filter(u => unitTypes.find(t => t.name === u.type) && u.include_in_salary !== false)
      .map(u => u.type)
    )
  );
  const dynUnitCols = unitTypes.filter(ut => usedTypeNames.has(ut.name));

  const dr = selectedRow;
  const drEmp = dr?.employee;
  const drGross = dr ? calcGross(dr.net_salary, drEmp.pension) : 0;
  const drInsurance = dr ? getInsAmount2(drEmp?.personal_id, month) : 0;
  const drFitpass = parseFloat(dr?.fitpass_deduction || 0);

  // Derive visible columns in order; totalSum/totalGEL/grossSalary always rendered after dynUnitCols
  const TAIL_KEYS = ['totalSum', 'totalGEL', 'grossSalary'];
  const visCols        = TCOLS.filter(c => visibleCols.includes(c.key));
  const visColsMain    = visCols.filter(c => !TAIL_KEYS.includes(c.key));
  const tailCols       = TAIL_KEYS.map(k => visCols.find(c => c.key === k)).filter(Boolean);
  const grossSalaryCol = visCols.find(c => c.key === 'grossSalary') || null;
  const colIdx         = (col) => COLUMNS.findIndex(c => c.key === col.key);
  const tableWidth     = visColsMain.reduce((sum, col) => sum + scaledW(colIdx(col)), 0)
                       + dynUnitCols.length * dynColW
                       + tailCols.reduce((sum, col) => sum + scaledW(colIdx(col)), 0);
  const visTextCols = visColsMain.filter(c => TEXT_KEYS.includes(c.key));
  const visNumCols  = visColsMain.filter(c => !TEXT_KEYS.includes(c.key) && !TAIL_KEYS.includes(c.key));

  // Sticky left positions for text columns
  const stickyLeftMap = {};
  let _stickyLeft = 0;
  visColsMain.forEach(col => {
    if (TEXT_KEYS.includes(col.key)) {
      stickyLeftMap[col.key] = _stickyLeft;
      _stickyLeft += scaledW(colIdx(col));
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
        const activeRate = transferRate || nbgRate || gelRate;
        const totGEL = activeRate ? Math.round(totSum * activeRate * 100) / 100 : null;
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
          return ut != null && u.include_in_salary !== false;
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
      case 'totalSum': {
        const corrected = parseFloat(r.net_salary || 0) + parseFloat(r.insurance_deduction || 0) - insurance;
        return <td key={key} style={{ ...TD_BOLD, fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{moneyTotal(corrected)}</td>;
      }
      case 'totalGEL': {
        const corrected = parseFloat(r.net_salary || 0) + parseFloat(r.insurance_deduction || 0) - insurance;
        const activeRate = transferRate || nbgRate || gelRate;
        const gel = activeRate ? Math.round(corrected * activeRate * 100) / 100 : null;
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
      const insurance  = getInsAmount2(emp?.personal_id, month);
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
          case 'totalSum': {
            const c = parseFloat(r.net_salary || 0) + parseFloat(r.insurance_deduction || 0) - insurance;
            rowData.push(c); break;
          }
          case 'totalGEL': {
            const c = parseFloat(r.net_salary || 0) + parseFloat(r.insurance_deduction || 0) - insurance;
            const activeRate = transferRate || nbgRate || gelRate;
            rowData.push(activeRate ? Math.round(c * activeRate * 100) / 100 : ''); break;
          }
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

  const inlinePill = { display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 7, padding: '4px 10px', whiteSpace: 'nowrap' };
  const pillLabel = { fontSize: 10, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.4px' };
  const pillVal = { fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
        <h2 style={{ margin: 0 }}>{t('sal.title')}</h2>
        {nbgRate && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
            fontSize: 12, fontFamily: FONT_MONO, fontWeight: 700, color: '#f59e0b',
            whiteSpace: 'nowrap',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
            </svg>
            NBG {nbgDate}: 1 USD = ₾{nbgRate.toFixed(4)}
          </span>
        )}
      </div>
      <p className="acc-subtitle">{t('salAccrual.subtitle')}</p>

      {/* Month picker */}
      <div className="sa-month-bar">
        <button className="sa-arrow" onClick={() => setMonth(prevMonth(month))}>‹</button>
        <span className="sa-month-label">{fmtMonth(month)}</span>
        <button className="sa-arrow" onClick={() => setMonth(nextMonth(month))}>›</button>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="sa-month-input" />
        {data && <span className="sa-meta">{data.working_days} {t('salAccrual.workingDays')} · {data.holidays_count} {t('salAccrual.holidays')}</span>}

        {/* Transfer date + Create Salary File — moved into month bar */}
        {data && active.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{t('salAccrual.transferDate')}</span>
            <input
              type="date"
              value={transferDate}
              onChange={e => setTransferDate(e.target.value)}
              style={{ padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1.5px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
            />
            {transferDate && (
              loadingRate
                ? <span style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: FONT_MONO }}>{t('salAccrual.fetchingRate')}</span>
                : transferRate
                  ? <span style={{ fontSize: 12, fontFamily: FONT_MONO, color: '#f59e0b', fontWeight: 700 }}>1 USD = ₾{transferRate.toFixed(4)}</span>
                  : <span style={{ fontSize: 11, color: '#ef4444' }}>{t('salAccrual.rateUnavailable')}</span>
            )}
            <button
              onClick={() => {
                if (!onCreateSalaryFile) return;
                const rate = transferRate || gelRate || 1;
                const rows = active.map(r => {
                  const emp = r.employee;
                  const grossSal = calcGross(r.net_salary, emp.pension);
                  const pensionAmt = emp.pension ? grossSal * 0.02 : 0;
                  const ins2 = getInsAmount2(emp?.personal_id, month);
                  const correctedNet = parseFloat(r.net_salary || 0) + parseFloat(r.insurance_deduction || 0) - ins2;
                  const amountUSD = Math.round((correctedNet - pensionAmt) * 100) / 100;
                  const amountGEL = Math.round(amountUSD * rate * 100) / 100;

                  // Build description
                  const [y, mo] = month.split('-').map(Number);
                  const monthAbbr = new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'short' });
                  const descParts = [
                    `Salary for ${monthAbbr}. $${amountUSD.toFixed(2)}`,
                    `Rate ${rate.toFixed(4)}`,
                  ];
                  const fitpassAmt = parseFloat(r.fitpass_deduction || 0);
                  if (fitpassAmt > 0) descParts.push(`Inc. $${fitpassAmt.toFixed(2)} Fitpass`);
                  (r.deductions || []).forEach(d => {
                    const amt = parseFloat(d.amount || 0);
                    if (amt > 0 && d.type) descParts.push(`Inc. $${amt.toFixed(2)} ${d.type}`);
                  });
                  const description = descParts.join(' | ');

                  return {
                    first_name: emp.first_name,
                    last_name: emp.last_name,
                    iban: emp.account_number || '',
                    amount: amountGEL,
                    description,
                  };
                });
                onCreateSalaryFile({ transferDate, month, rate, rows });
              }}
              disabled={!transferDate || loadingRate || loading}
              style={{
                padding: '6px 16px', background: (transferDate && !loadingRate && !loading) ? '#8b5cf6' : 'var(--surface-3)',
                color: (transferDate && !loadingRate && !loading) ? '#fff' : 'var(--text-4)',
                border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12,
                cursor: (transferDate && !loadingRate && !loading) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {t('salAccrual.createFile')}
            </button>
          </div>
        )}
      </div>


      {/* Summary cards for when transfer date block is hidden */}

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
          {t('salAccrual.excel')}
        </button>
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
            {t('salAccrual.columns')} ({visCols.length}/{TCOLS.length})
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
                {TCOLS.map(col => (
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
                <col key={col.key} style={{ width: scaledW(colIdx(col)) }} />
              ))}
              {dynUnitCols.map(ut => <col key={`dyn-col-${ut.name}`} style={{ width: dynColW }} />)}
              {tailCols.map(col => <col key={col.key} style={{ width: scaledW(colIdx(col)) }} />)}
            </colgroup>
            <thead>
              <tr>
                {visColsMain.map(col => {
                  const idx = colIdx(col);
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
                {tailCols.map(col => {
                  const idx = colIdx(col);
                  return (
                    <th key={col.key} style={{
                      position: 'relative', width: scaledW(idx),
                      overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right',
                    }}>
                      {col.label}
                      <div onMouseDown={e => onResizeMouseDown(e, idx)} style={RESIZE_HANDLE_STYLE}
                        onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const emp         = r.employee;
                const bonus       = unitAmt(r.deductions, 'Bonus');
                const teamBuild   = unitAmt(r.deductions, 'Team Building');
                const reimburse   = unitAmt(r.deductions, 'Reimbursement');
                const fitpass     = parseFloat(r.fitpass_deduction || 0);
                const insurance   = getInsAmount2(emp?.personal_id, month);
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
                    {tailCols.map(col => rowVal(col.key, r, emp, bonus, teamBuild, reimburse, fitpass, insurance, grossSalary, pensionAmt))}
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
                {tailCols.map(col => {
                  const { val, style, cls } = footerVal(col.key);
                  return <td key={`tail-tf-${col.key}`} className={cls || ''} style={{ ...style, borderTop: '2px solid var(--border-2)' }}>{val}</td>;
                })}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

    </div>
  );
}

export default SalaryAccrual;
