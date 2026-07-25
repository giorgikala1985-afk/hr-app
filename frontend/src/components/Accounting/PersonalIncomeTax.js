import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useExcelTable, ExcelFilterDropdown, ColumnVisibilityMenu } from '../common/ExcelTable';

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

function isBizTrip(type) {
  const t = (type || '').toLowerCase();
  return t.includes('business trip') || t.includes('business_trip') || t.includes('სამივლინებო');
}

function bizTripSum(r) {
  return (r.deductions || [])
    .filter(u => isBizTrip(u.type))
    .reduce((s, u) => s + parseFloat(u.amount || 0), 0);
}

function fmt(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

export default function PersonalIncomeTax() {
  const { t } = useLanguage();
  const [month, setMonth] = useState(todayMonth());
  const [rows, setRows] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(month); }, [month]);

  const load = async (m) => {
    setLoading(true); setError('');
    try {
      const [salRes, insRes] = await Promise.all([
        api.get(`/salaries?month=${m}`),
        api.get('/insurance-list'),
      ]);
      setRows(salRes.data?.salaries || []);
      setInsurance(insRes.data?.records || []);
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  };

  const normalizeId = (id) => String(id || '').trim().replace(/\s+/g, '');

  const idsMatch = (a, b) => {
    const na = normalizeId(a);
    const nb = normalizeId(b);
    if (!na || !nb) return false;
    return na === nb || na.replace(/^0+/, '') === nb.replace(/^0+/, '');
  };

  const dateMatchesMonth = (date, m) => {
    if (!date) return false;
    const d = String(date).trim();
    if (d.startsWith(m)) return true;
    // try parsing in case format is different
    try {
      const parsed = new Date(d);
      if (!isNaN(parsed)) {
        const y = parsed.getFullYear();
        const mo = String(parsed.getMonth() + 1).padStart(2, '0');
        return `${y}-${mo}` === m;
      }
    } catch {}
    return false;
  };

  // Get insurance amount2 for a personal_id in the selected month
  const getInsAmount2 = (personalId) => {
    if (!personalId) return 0;
    const matches = insurance.filter(rec => {
      if (!idsMatch(rec.personal_id, personalId)) return false;
      // check period first (explicit payroll month), then fall back to date
      const dateToCheck = rec.period || rec.date;
      return dateMatchesMonth(dateToCheck, month);
    });
    return matches.reduce((s, rec) => s + parseFloat(rec.amount2 || 0), 0);
  };

  const totalBizTrip = rows.reduce((s, r) => s + bizTripSum(r), 0);
  const totalIns2 = rows.reduce((s, r) => s + getInsAmount2(r.employee?.personal_id), 0);
  const totalBizTripPct = rows.reduce((s, r) => {
    const rate = r.employee?.pit_rate ?? 20;
    return s + bizTripSum(r) * rate / 100;
  }, 0);
  const totalIns2Pct = rows.reduce((s, r) => {
    const rate = r.employee?.pit_rate ?? 20;
    return s + getInsAmount2(r.employee?.personal_id) * rate / 100;
  }, 0);
  const totalPit = totalBizTripPct + totalIns2Pct;

  const rowStats = (r) => {
    const trip = bizTripSum(r);
    const ins2 = getInsAmount2(r.employee?.personal_id);
    const empRate = r.employee?.pit_rate ?? 20;
    const tripPct = trip * empRate / 100;
    const ins2Pct = ins2 * empRate / 100;
    return { trip, ins2, tripPct, ins2Pct, rowPit: tripPct + ins2Pct };
  };

  const PIT_COLUMNS = [
    { key: 'personalId', label: t('pit.personalId'), getValue: r => r.employee?.personal_id || '—' },
    { key: 'name', label: t('pit.name'), getValue: r => r.employee?.first_name || '—' },
    { key: 'lastName', label: t('pit.lastName'), getValue: r => r.employee?.last_name || '—' },
    { key: 'businessTrip', label: t('pit.businessTrip'), right: true, getValue: r => rowStats(r).trip ? `$${fmt(rowStats(r).trip)}` : '—', getSortValue: r => rowStats(r).trip },
    { key: 'btPit', label: t('pit.btPit'), right: true, getValue: r => rowStats(r).tripPct ? `$${fmt(rowStats(r).tripPct)}` : '—', getSortValue: r => rowStats(r).tripPct },
    { key: 'insAmount2', label: t('pit.insAmount2'), right: true, getValue: r => rowStats(r).ins2 ? fmt(rowStats(r).ins2) : '—', getSortValue: r => rowStats(r).ins2 },
    { key: 'insPit', label: t('pit.insPit'), right: true, getValue: r => rowStats(r).ins2Pct ? fmt(rowStats(r).ins2Pct) : '—', getSortValue: r => rowStats(r).ins2Pct },
    { key: 'totalPit', label: t('pit.totalPit'), right: true, getValue: r => rowStats(r).rowPit ? fmt(rowStats(r).rowPit) : '—', getSortValue: r => rowStats(r).rowPit },
  ];
  const table = useExcelTable({ storageKey: 'pit_list', columns: PIT_COLUMNS, rows });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Month nav + rate badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', minWidth: 160, textAlign: 'center' }}>{fmtMonth(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}>›</button>
        <span style={{ marginLeft: 8, padding: '4px 12px', background: 'var(--accent)', color: '#fff', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{t('pit.badge')}</span>
        <div style={{ marginLeft: 'auto' }}><ColumnVisibilityMenu table={table} t={t} buttonStyle={{ padding: '6px 14px' }} /></div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>{t('pit.loading')}</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {table.displayCols.map((key) => {
                  const col = table.colByKey[key];
                  return (
                    <th key={key} style={{ ...thStyle, textAlign: col.right ? 'right' : 'left', position: 'relative' }}>
                      <span onClick={() => table.toggleSort(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
                        {col.label}
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ opacity: table.sortKey === key ? 1 : 0.25, transform: table.sortKey === key && table.sortDir === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </span>
                      <button
                        onClick={e => table.openColumnFilterDropdown(e, key)}
                        title={t('table.filterTooltip')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, padding: 0,
                          marginLeft: 4, border: 'none', borderRadius: 4, cursor: 'pointer', verticalAlign: 'middle',
                          background: table.openFilterCol === key ? 'var(--surface)' : 'transparent',
                          color: table.columnFilters[key] ? '#479c73' : 'var(--text-4)',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={table.columnFilters[key] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4"/>
                        </svg>
                      </button>
                      {table.openFilterCol === key && table.filterDropdownPos && (
                        <ExcelFilterDropdown
                          dropdownRef={table.filterDropdownRef}
                          pos={table.filterDropdownPos}
                          options={table.getColumnFilterOptions(key)}
                          selected={table.columnFilters[key]}
                          search={table.filterSearch}
                          onSearchChange={table.setFilterSearch}
                          onToggleValue={(value) => {
                            const opts = table.getColumnFilterOptions(key);
                            const activeSet = table.columnFilters[key] ?? new Set(opts);
                            table.setColumnFilterValues(key, opts, [value], !activeSet.has(value));
                          }}
                          onToggleAll={(visible, checked) => table.setColumnFilterValues(key, table.getColumnFilterOptions(key), visible, checked)}
                          onClear={() => table.clearColumnFilter(key)}
                          t={t}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table.hasActiveFilters && table.sortedRows.length === 0 ? (
                <tr><td colSpan={table.displayCols.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>
                  {t('table.noFilterMatches')}
                  <div><button onClick={table.clearAllColumnFilters} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('table.clear')}</button></div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={table.displayCols.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>{t('pit.noData')}</td></tr>
              ) : table.sortedRows.map((r, i) => {
                const { trip, ins2, tripPct, ins2Pct, rowPit } = rowStats(r);
                const empRate = r.employee?.pit_rate ?? 20;
                return (
                  <tr key={r.employee?.id || i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    {table.displayCols.includes('personalId') && <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{r.employee?.personal_id || '—'}</td>}
                    {table.displayCols.includes('name') && <td style={{ ...tdStyle, fontWeight: 600 }}>{r.employee?.first_name || '—'}</td>}
                    {table.displayCols.includes('lastName') && <td style={{ ...tdStyle, fontWeight: 600 }}>{r.employee?.last_name || '—'}</td>}
                    {table.displayCols.includes('businessTrip') && (
                      <td style={{ ...tdStyle, textAlign: 'right', color: trip ? 'var(--text)' : 'var(--text-3)', fontWeight: trip ? 600 : 400 }}>
                        {trip ? `$${fmt(trip)}` : '—'}
                      </td>
                    )}
                    {table.displayCols.includes('btPit') && (
                      <td style={{ ...tdStyle, textAlign: 'right', color: tripPct ? 'var(--accent)' : 'var(--text-3)', fontWeight: tripPct ? 600 : 400 }}>
                        {tripPct ? <span title={`${empRate}%`}>${fmt(tripPct)}</span> : '—'}
                      </td>
                    )}
                    {table.displayCols.includes('insAmount2') && (
                      <td style={{ ...tdStyle, textAlign: 'right', color: ins2 ? 'var(--text)' : 'var(--text-3)', fontWeight: ins2 ? 600 : 400 }}>
                        {ins2 ? fmt(ins2) : '—'}
                      </td>
                    )}
                    {table.displayCols.includes('insPit') && (
                      <td style={{ ...tdStyle, textAlign: 'right', color: ins2Pct ? 'var(--accent)' : 'var(--text-3)', fontWeight: ins2Pct ? 600 : 400 }}>
                        {ins2Pct ? <span title={`${empRate}%`}>{fmt(ins2Pct)}</span> : '—'}
                      </td>
                    )}
                    {table.displayCols.includes('totalPit') && (
                      <td style={{ ...tdStyle, textAlign: 'right', color: rowPit ? '#f59e0b' : 'var(--text-3)', fontWeight: rowPit ? 700 : 400 }}>
                        {rowPit ? fmt(rowPit) : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {(totalBizTrip > 0 || totalIns2 > 0) && (() => {
              const TEXT_KEYS = ['personalId', 'name', 'lastName'];
              const FOOT_VALUES = {
                businessTrip: { val: totalBizTrip ? `$${fmt(totalBizTrip)}` : '—', color: 'var(--text)' },
                btPit: { val: totalBizTripPct ? `$${fmt(totalBizTripPct)}` : '—', color: 'var(--accent)' },
                insAmount2: { val: totalIns2 ? fmt(totalIns2) : '—', color: 'var(--text)' },
                insPit: { val: totalIns2Pct ? fmt(totalIns2Pct) : '—', color: 'var(--accent)' },
                totalPit: { val: totalPit ? fmt(totalPit) : '—', color: '#f59e0b' },
              };
              const visibleTextCols = table.displayCols.filter(k => TEXT_KEYS.includes(k));
              const visibleNumCols = table.displayCols.filter(k => !TEXT_KEYS.includes(k));
              return (
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                    {visibleTextCols.length > 0 && (
                      <td colSpan={visibleTextCols.length} style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('pit.total')}</td>
                    )}
                    {visibleNumCols.map(key => (
                      <td key={key} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: FOOT_VALUES[key].color }}>{FOOT_VALUES[key].val}</td>
                    ))}
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '9px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '11px 14px',
  color: 'var(--text)',
};
