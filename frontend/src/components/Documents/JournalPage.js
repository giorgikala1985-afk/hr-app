import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useExcelTable, ExcelFilterDropdown, ColumnVisibilityMenu, PaginationBar } from '../common/ExcelTable';
import TableSkeleton from '../common/TableSkeleton';

const TYPE_META = {
  hiring:        { labelKey: 'journal.typeHiring',       color: '#3b82f6', icon: 'person-add' },
  firing:        { labelKey: 'journal.typeFiring',       color: '#ef4444', icon: 'person-remove' },
  promotion:     { labelKey: 'journal.typePromotion',    color: '#479c73', icon: 'arrow-up' },
  business_trip: { labelKey: 'journal.typeBusinessTrip', color: '#f59e0b', icon: 'plane' },
  advance:       { labelKey: 'journal.typeAdvance',      color: '#8b5cf6', icon: 'cash' },
  adjustment:    { labelKey: 'journal.typeAdjustment',   color: '#06b6d4', icon: 'sliders' },
};

const ICONS = {
  'person-add': (c) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  'person-remove': (c) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  'arrow-up': (c) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </svg>
  ),
  'plane': (c) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 21 4s-2 0-3.5 1.5L14 9 5.8 6.2C5.2 6 4.5 6.2 4.2 6.7L3 8l5.5 3.1L6 13H4l-1 1 2 2 2 2 1-1v-2l2.5-2.5L12 18l1-.7"/>
    </svg>
  ),
  'cash': (c) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="2"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  ),
  'sliders': (c) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  ),
};

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Badge({ color, typeKey }) {
  const { t } = useLanguage();
  const meta = TYPE_META[typeKey];
  const label = meta ? t(meta.labelKey) : typeKey;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20,
      background: color + '18', border: `1px solid ${color}33`,
      color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {ICONS[meta?.icon || 'sliders']?.(color)}
      {label}
    </span>
  );
}

function SummaryText({ type, row }) {
  const { t } = useLanguage();

  if (type === 'hiring') {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || '—';
    const hiredAs = t('journal.hiredAs');
    return <>{name} {hiredAs} <strong>{row.position || '—'}</strong>{row.department ? ` · ${row.department}` : ''}</>;
  }
  if (type === 'firing') {
    const onWord = t('journal.on');
    const dateStr = row.terminationDate
      ? `${onWord ? ` ${onWord}` : ''} ${formatDate(row.terminationDate)}`
      : '';
    return <>{row.empName || '—'} {t('journal.terminated')}{dateStr}{row.reason ? ` · ${row.reason}` : ''}</>;
  }
  if (type === 'promotion') {
    return <>{row.empName || '—'} → <strong>{row.newPosition || '—'}</strong>{row.oldSalary && row.newSalary ? ` · ${row.oldSalary} → ${row.newSalary}` : ''}</>;
  }
  if (type === 'business_trip') {
    const name = row.isGroup ? (row.groupName || t('journal.group')) : (row.empName || '—');
    return <>{name} · {row.countryName || '—'}{row.cityName ? `, ${row.cityName}` : ''}{row.fromDate ? ` (${formatDate(row.fromDate)}–${formatDate(row.toDate)})` : ''}</>;
  }
  if (type === 'advance') {
    const overWord = t('journal.over');
    return <>{row.empName || '—'} · {row.totalAmount} {row.currency} {overWord ? `${overWord} ` : ''}{row.numMonths} {t('journal.months')}</>;
  }
  if (type === 'adjustment') {
    const dir = row.direction === 'addition' ? '+' : '-';
    const name = row.empName || (row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : '—');
    return <>{name} · {row.type} {dir}{row.amount} USD</>;
  }
  return null;
}

const ALL_TYPES = Object.keys(TYPE_META);

export default function JournalPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  // Orders' local records are namespaced per-tenant (see useLocalOrders in
  // Orders.js) so a browser shared across multiple organizations doesn't
  // bleed one org's hiring/firing/etc. records into another's Journal view.
  const nsKey = useCallback((key) => `${key}_${user?.id || 'anon'}`, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hiring   = readLocal(nsKey('hr_hiring_orders')).map(r => ({ ...r, _type: 'hiring' }));
      const firing   = readLocal(nsKey('hr_firing_orders')).map(r => ({ ...r, _type: 'firing' }));
      const promote  = readLocal(nsKey('hr_promotion_orders')).map(r => ({ ...r, _type: 'promotion' }));
      const trips    = readLocal(nsKey('hr_business_trip_orders')).map(r => ({ ...r, _type: 'business_trip' }));
      const advances = readLocal(nsKey('hr_advance_payment_orders')).map(r => ({ ...r, _type: 'advance' }));

      let adjustments = [];
      try {
        const res = await api.get('/employees/units/all');
        adjustments = (res.data.units || []).map(u => ({ ...u, _type: 'adjustment', createdAt: u.created_at || u.date, createdBy: u.created_by_name }));
      } catch {}

      // Hire/fire/promotion events created by non-browser channels (Telegram/
      // WhatsApp bots) — those have no browser to write the localStorage
      // entries above, so they're logged to a real table instead.
      let botOrders = [];
      try {
        const res = await api.get('/employees/order-log');
        botOrders = (res.data.logs || []).map(l => ({ ...l.payload, _type: l.type, createdAt: l.created_at }));
      } catch {}

      const all = [...hiring, ...firing, ...promote, ...trips, ...advances, ...adjustments, ...botOrders]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setRows(all);
    } finally {
      setLoading(false);
    }
  }, [nsKey]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (filterType !== 'all' && r._type !== filterType) return false;
    return true;
  });

  const JOURNAL_COLUMNS = [
    { key: 'date', label: t('journal.colDate'), getValue: r => formatDate(r.createdAt), getSortValue: r => r.createdAt || '' },
    { key: 'type', label: t('journal.colType'), getValue: r => t(TYPE_META[r._type]?.labelKey || r._type) },
    { key: 'createdBy', label: t('journal.colCreatedBy'), getValue: r => r.createdBy || '—' },
    { key: 'summary', label: t('journal.colSummary'), sortable: false, filterable: false, getValue: () => '' },
    { key: 'notes', label: t('journal.colNotes'), getValue: r => r.notes || r.reason || '—' },
  ];
  const table = useExcelTable({ storageKey: 'journal_list', columns: JOURNAL_COLUMNS, rows: filtered });

  const counts = {};
  ALL_TYPES.forEach(typeKey => { counts[typeKey] = rows.filter(r => r._type === typeKey).length; });

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>{t('journal.title')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{t('journal.subtitle')}</p>
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {ALL_TYPES.map(typeKey => (
          <button
            key={typeKey}
            onClick={() => { setFilterType(filterType === typeKey ? 'all' : typeKey); table.setPage(1); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 13px', borderRadius: 10,
              border: `1.5px solid ${filterType === typeKey ? TYPE_META[typeKey].color : 'var(--border-2)'}`,
              background: filterType === typeKey ? TYPE_META[typeKey].color + '18' : 'var(--surface)',
              color: filterType === typeKey ? TYPE_META[typeKey].color : 'var(--text-3)',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {ICONS[TYPE_META[typeKey].icon](filterType === typeKey ? TYPE_META[typeKey].color : 'var(--text-3)')}
            {t(TYPE_META[typeKey].labelKey)}
            <span style={{
              background: filterType === typeKey ? TYPE_META[typeKey].color : 'var(--border-2)',
              color: filterType === typeKey ? '#fff' : 'var(--text-3)',
              borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800,
            }}>{counts[typeKey]}</span>
          </button>
        ))}
      </div>

      {/* Refresh + filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 9,
          border: '1px solid var(--border-2)', background: 'var(--surface)',
          color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {t('journal.refresh')}
        </button>
        {filterType !== 'all' && (
          <button onClick={() => { setFilterType('all'); table.setPage(1); }} style={{
            padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-2)',
            background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {t('journal.clearFilter')}
          </button>
        )}
        <ColumnVisibilityMenu table={table} t={t} />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
          {table.sortedRows.length} {table.sortedRows.length !== 1 ? t('journal.records') : t('journal.record')}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton
          icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          }
          color="#8b5cf6"
          label={t('journal.loading')}
          cols={[
            { width: '12%' }, { width: '15%' }, { width: '18%' }, { width: '20%' },
            { width: '15%' }, { width: '12%', align: 'right' },
          ]}
        />
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 14, color: 'var(--text-3)',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('journal.noRecords')}</div>
          <div style={{ fontSize: 12 }}>{t('journal.noRecordsHint')}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {table.displayCols.map((key) => {
                  const col = table.colByKey[key];
                  const sortable = col.sortable !== false;
                  const filterable = col.filterable !== false;
                  return (
                    <th key={key} style={{
                      padding: '10px 16px', textAlign: 'left', fontWeight: 700,
                      fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase',
                      letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)',
                      whiteSpace: 'nowrap', position: 'relative',
                    }}>
                      <span
                        onClick={sortable ? () => table.toggleSort(key) : undefined}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: sortable ? 'pointer' : 'default' }}
                      >
                        {col.label}
                        {sortable && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ opacity: table.sortKey === key ? 1 : 0.25, transform: table.sortKey === key && table.sortDir === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        )}
                      </span>
                      {filterable && (
                        <button
                          onClick={e => table.openColumnFilterDropdown(e, key)}
                          title={t('table.filterTooltip')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, padding: 0,
                            marginLeft: 4, border: 'none', borderRadius: 4, cursor: 'pointer', verticalAlign: 'middle',
                            background: table.openFilterCol === key ? 'var(--surface)' : 'transparent',
                            color: table.columnFilters[key] ? '#479c73' : 'var(--text-4)',
                            textTransform: 'none',
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill={table.columnFilters[key] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4"/>
                          </svg>
                        </button>
                      )}
                      {filterable && table.openFilterCol === key && table.filterDropdownPos && (
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
              {table.hasActiveFilters && table.sortedRows.length === 0 && (
                <tr>
                  <td colSpan={table.displayCols.length} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 13 }}>
                    {t('table.noFilterMatches')}
                    <div>
                      <button
                        onClick={table.clearAllColumnFilters}
                        style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {t('table.clear')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {table.pagedRows.map((row, i) => {
                const meta = TYPE_META[row._type] || { color: '#64748b' };
                return (
                  <tr
                    key={row.id || i}
                    style={{ borderBottom: '1px solid var(--border-2)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {table.displayCols.includes('date') && (
                      <td style={{ padding: '12px 16px', color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {formatDate(row.createdAt)}
                      </td>
                    )}
                    {table.displayCols.includes('type') && (
                      <td style={{ padding: '12px 16px' }}>
                        <Badge color={meta.color} typeKey={row._type} />
                      </td>
                    )}
                    {table.displayCols.includes('createdBy') && (
                      <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {row.createdBy || '—'}
                      </td>
                    )}
                    {table.displayCols.includes('summary') && (
                      <td style={{ padding: '12px 16px', color: 'var(--text)', lineHeight: 1.5 }}>
                        <SummaryText type={row._type} row={row} />
                      </td>
                    )}
                    {table.displayCols.includes('notes') && (
                      <td style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12, maxWidth: 200 }}>
                        {row.notes || row.reason || ''}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar table={table} t={t} />
        </div>
      )}
    </div>
  );
}
