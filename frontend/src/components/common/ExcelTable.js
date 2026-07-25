import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Shared "Excel-style" list-table controls: click-to-sort headers, per-column
// filter dropdowns (searchable checkbox list, cascading against the other
// active column filters), and a hideable/draggable column order — all
// persisted to localStorage under `${storageKey}_col_order` / `_col_visible`.
//
// Usage:
//   const columns = [
//     { key: 'name', label: t('x.name'), getValue: row => row.name },
//     { key: 'amount', label: t('x.amount'), right: true, getValue: row => fmt(row.amount), getSortValue: row => row.amount },
//   ];
//   const table = useExcelTable({ storageKey: 'x_list', columns, rows: baseFilteredRows });
//   <thead><TableHeaderRow table={table} t={t} extraCols={[{ label: '', right: true }]} /></thead>
//   <tbody>{table.sortedRows.map(row => ...)}</tbody>
//   <ColumnVisibilityMenu table={table} t={t} />

function loadOrder(storageKey, allKeys) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${storageKey}_col_order`));
    if (Array.isArray(saved) && saved.length) {
      const filtered = saved.filter(k => allKeys.includes(k));
      const missing = allKeys.filter(k => !filtered.includes(k));
      return [...filtered, ...missing];
    }
  } catch {}
  return allKeys;
}
function loadVisible(storageKey, allKeys, defaultVisible) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${storageKey}_col_visible`));
    if (Array.isArray(saved)) return saved.filter(k => allKeys.includes(k));
  } catch {}
  return defaultVisible || allKeys;
}
const PAGE_SIZE_OPTIONS = [50, 100, 200];
function loadPageSize(storageKey, defaultPageSize) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${storageKey}_page_size`));
    if (saved === 'all' || PAGE_SIZE_OPTIONS.includes(saved)) return saved;
  } catch {}
  return defaultPageSize || PAGE_SIZE_OPTIONS[0];
}

export function useExcelTable({ storageKey, columns, rows, defaultVisible, defaultPageSize }) {
  const allKeys = columns.map(c => c.key);
  const colByKey = Object.fromEntries(columns.map(c => [c.key, c]));

  const [colOrder, setColOrder] = useState(() => loadOrder(storageKey, allKeys));
  const [visibleCols, setVisibleCols] = useState(() => loadVisible(storageKey, allKeys, defaultVisible));
  const [showColMenu, setShowColMenu] = useState(false);
  const dragColIdx = useRef(null);
  const [dragOverColIdx, setDragOverColIdx] = useState(null);

  useEffect(() => { localStorage.setItem(`${storageKey}_col_order`, JSON.stringify(colOrder)); }, [storageKey, colOrder]);
  useEffect(() => { localStorage.setItem(`${storageKey}_col_visible`, JSON.stringify(visibleCols)); }, [storageKey, visibleCols]);

  const toggleColVisible = (key) => setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const moveCol = (from, to) => {
    if (from === to) return;
    setColOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const resetCols = () => { setColOrder(allKeys); setVisibleCols(defaultVisible || allKeys); };
  const displayCols = colOrder.filter(k => visibleCols.includes(k));

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(() => loadPageSize(storageKey, defaultPageSize));
  const setPageSize = (size) => {
    setPageSizeState(size);
    setPage(1);
    try { localStorage.setItem(`${storageKey}_page_size`, JSON.stringify(size)); } catch {}
  };

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (key) => {
    setPage(1);
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const emptyFilters = () => Object.fromEntries(allKeys.map(k => [k, null]));
  const [columnFilters, setColumnFilters] = useState(emptyFilters);
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const filterDropdownRef = useRef(null);

  // Close the filter dropdown on outside click, Escape, or scroll outside it
  useEffect(() => {
    if (!openFilterCol) return;
    const close = () => { setOpenFilterCol(null); setFilterDropdownPos(null); };
    const onDocClick = (e) => { if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) close(); };
    const onKeyDown = (e) => { if (e.key === 'Escape') close(); };
    const onScroll = (e) => {
      if (filterDropdownRef.current && filterDropdownRef.current.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [openFilterCol]);

  // `except` skips one column's own filter so its dropdown can offer cascading options
  const applyColumnFilters = (list, except) => list.filter(row => allKeys.every(k => {
    if (k === except) return true;
    const sel = columnFilters[k];
    return !sel || sel.has(colByKey[k].getValue(row));
  }));
  const filteredRows = applyColumnFilters(rows, null);
  const getColumnFilterOptions = (key) => {
    const getValue = colByKey[key].getValue;
    const values = applyColumnFilters(rows, key).map(getValue);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };
  // values/checked covers both a single checkbox toggle and "select all [visible]"
  const setColumnFilterValues = (key, allOptions, values, checked) => {
    setPage(1);
    setColumnFilters(prev => {
      const current = prev[key] ?? new Set(allOptions);
      const next = new Set(current);
      values.forEach(v => (checked ? next.add(v) : next.delete(v)));
      return { ...prev, [key]: next.size === allOptions.length ? null : next };
    });
  };
  const clearColumnFilter = (key) => { setPage(1); setColumnFilters(prev => ({ ...prev, [key]: null })); };
  const clearAllColumnFilters = () => { setPage(1); setColumnFilters(emptyFilters()); };
  const openColumnFilterDropdown = (e, key) => {
    e.stopPropagation();
    if (openFilterCol === key) { setOpenFilterCol(null); setFilterDropdownPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const DROPDOWN_WIDTH = 230;
    setFilterDropdownPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left - 100, window.innerWidth - DROPDOWN_WIDTH - 16),
    });
    setFilterSearch('');
    setOpenFilterCol(key);
  };

  const sortedRows = (() => {
    if (!sortKey || !colByKey[sortKey]) return filteredRows;
    const getSort = colByKey[sortKey].getSortValue || colByKey[sortKey].getValue;
    return [...filteredRows].sort((a, b) => {
      const av = getSort(a); const bv = getSort(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  })();

  const hasActiveFilters = allKeys.some(k => columnFilters[k] !== null);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = pageSize === 'all' ? sortedRows : sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    columns, colByKey, allKeys,
    colOrder, visibleCols, displayCols, showColMenu, setShowColMenu, toggleColVisible, moveCol, resetCols,
    dragColIdx, dragOverColIdx, setDragOverColIdx,
    sortKey, sortDir, toggleSort,
    columnFilters, openFilterCol, filterDropdownPos, filterSearch, filterDropdownRef, setFilterSearch,
    getColumnFilterOptions, setColumnFilterValues, clearColumnFilter, clearAllColumnFilters, openColumnFilterDropdown,
    filteredRows, sortedRows, hasActiveFilters,
    page: safePage, setPage, pageSize, setPageSize, pageSizeOptions: PAGE_SIZE_OPTIONS, totalPages, pagedRows,
  };
}

// Searchable checkbox-list dropdown, portaled to <body> so it isn't clipped
// by a table wrapper's overflow:hidden.
export function ExcelFilterDropdown({ dropdownRef, pos, options, selected, search, onSearchChange, onToggleValue, onToggleAll, onClear, t }) {
  const activeSet = selected ?? new Set(options);
  const visibleOptions = search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;
  const allVisibleChecked = visibleOptions.length > 0 && visibleOptions.every(o => activeSet.has(o));

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 200,
        width: 230, maxHeight: 320, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)', overflow: 'hidden',
        fontWeight: 400, textTransform: 'none', letterSpacing: 'normal',
      }}
    >
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-3)' }}>
        <input
          autoFocus
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          placeholder={t('table.filterSearchPlaceholder')}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12, borderRadius: 6,
            border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)', outline: 'none',
          }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', borderBottom: '1px solid var(--border-3)' }}>
        <input type="checkbox" checked={allVisibleChecked} onChange={e => onToggleAll(visibleOptions, e.target.checked)} style={{ accentColor: '#479c73', width: 13, height: 13 }} />
        {t('table.selectAll')}
      </label>
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {visibleOptions.length === 0 ? (
          <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-4)' }}>{t('table.noFilterOptions')}</div>
        ) : visibleOptions.map(opt => (
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={activeSet.has(opt)} onChange={() => onToggleValue(opt)} style={{ accentColor: '#479c73', width: 13, height: 13, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
          </label>
        ))}
      </div>
      {selected !== null && (
        <div style={{ borderTop: '1px solid var(--border-3)', padding: '6px 10px' }}>
          <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#3185FC', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            {t('table.clearFilter')}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

// One <tr> of <th>s for `table.displayCols`, each with sort-on-click + a
// filter funnel that opens ExcelFilterDropdown. `extraCols` appends static,
// non-sortable/non-filterable trailing columns (e.g. an Actions column).
export function TableHeaderRow({ table, t, extraCols = [], trStyle }) {
  const cells = [
    ...table.displayCols.map(key => ({
      key, label: table.colByKey[key].label, right: !!table.colByKey[key].right,
      sortable: table.colByKey[key].sortable !== false,
      filterable: table.colByKey[key].filterable !== false,
    })),
    ...extraCols.map((c, i) => ({ extraKey: `extra-${i}`, key: null, label: c.label || '', right: c.right !== false, sortable: false, filterable: false })),
  ];
  return (
    <tr style={{ background: 'var(--surface-2)', ...trStyle }}>
      {cells.map((c, i) => (
        <th
          key={c.key || c.extraKey || i}
          style={{
            padding: '9px 16px 8px', textAlign: c.right ? 'right' : 'left', fontWeight: 600, fontSize: 11,
            color: table.sortKey === c.key ? 'var(--text)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap', verticalAlign: 'top',
          }}
        >
          <span style={{ display: 'flex', width: '100%', boxSizing: 'border-box', alignItems: 'center', gap: 3, justifyContent: c.right ? 'flex-end' : 'flex-start', flexDirection: c.right ? 'row-reverse' : 'row', userSelect: 'none' }}>
            <span onClick={c.key && c.sortable ? () => table.toggleSort(c.key) : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: c.key && c.sortable ? 'pointer' : 'default' }}>
              {c.label}
              {c.key && c.sortable && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ opacity: table.sortKey === c.key ? 1 : 0.25, transform: table.sortKey === c.key && table.sortDir === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </span>
            {c.key && c.filterable && (
              <button
                onClick={e => table.openColumnFilterDropdown(e, c.key)}
                title={t('table.filterTooltip')}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, padding: 0,
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                  background: table.openFilterCol === c.key ? 'var(--surface-3, rgba(0,0,0,0.08))' : 'transparent',
                  color: table.columnFilters[c.key] ? '#479c73' : 'var(--text-4)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={table.columnFilters[c.key] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4"/>
                </svg>
              </button>
            )}
          </span>
          {c.key && table.openFilterCol === c.key && table.filterDropdownPos && (
            <ExcelFilterDropdown
              dropdownRef={table.filterDropdownRef}
              pos={table.filterDropdownPos}
              options={table.getColumnFilterOptions(c.key)}
              selected={table.columnFilters[c.key]}
              search={table.filterSearch}
              onSearchChange={table.setFilterSearch}
              onToggleValue={(value) => {
                const opts = table.getColumnFilterOptions(c.key);
                const activeSet = table.columnFilters[c.key] ?? new Set(opts);
                table.setColumnFilterValues(c.key, opts, [value], !activeSet.has(value));
              }}
              onToggleAll={(visible, checked) => table.setColumnFilterValues(c.key, table.getColumnFilterOptions(c.key), visible, checked)}
              onClear={() => table.clearColumnFilter(c.key)}
              t={t}
            />
          )}
        </th>
      ))}
    </tr>
  );
}

// Page-size picker (50/100/200/All) + prev/next page navigation. Renders
// nothing when there's only one page's worth of rows and size is default.
export function PaginationBar({ table, t }) {
  const { page, setPage, pageSize, setPageSize, pageSizeOptions, totalPages, sortedRows } = table;
  if (sortedRows.length === 0) return null;

  const pageBtnStyle = (active, disabled) => ({
    minWidth: 28, height: 28, padding: '0 6px', borderRadius: 6,
    border: '1px solid var(--border-2)', cursor: disabled ? 'default' : 'pointer',
    background: active ? '#479c73' : 'var(--surface)',
    color: active ? '#fff' : disabled ? 'var(--text-4)' : 'var(--text-2)',
    fontWeight: 600, fontSize: 12, opacity: disabled ? 0.5 : 1,
  });
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  const from = sortedRows.length === 0 ? 0 : (page - 1) * (pageSize === 'all' ? sortedRows.length : pageSize) + 1;
  const to = pageSize === 'all' ? sortedRows.length : Math.min(page * pageSize, sortedRows.length);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '10px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
        <span>{t('table.rowsPerPage')}</span>
        {pageSizeOptions.map(size => (
          <button key={size} onClick={() => setPageSize(size)} style={pageBtnStyle(pageSize === size)}>{size}</button>
        ))}
        <button onClick={() => setPageSize('all')} style={pageBtnStyle(pageSize === 'all')}>{t('table.all')}</button>
      </div>

      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
        {t('table.showingRows', { from, to, total: sortedRows.length })}
      </span>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button disabled={page <= 1} onClick={() => setPage(1)} style={pageBtnStyle(false, page <= 1)}>&laquo;</button>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={pageBtnStyle(false, page <= 1)}>&lsaquo;</button>
          {pageNumbers.map((p, i) => p === '...' ? (
            <span key={`dot-${i}`} style={{ fontSize: 12, color: 'var(--text-4)', padding: '0 4px' }}>...</span>
          ) : (
            <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page)}>{p}</button>
          ))}
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={pageBtnStyle(false, page >= totalPages)}>&rsaquo;</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={pageBtnStyle(false, page >= totalPages)}>&raquo;</button>
        </div>
      )}
    </div>
  );
}

// The "Columns (x/y)" toolbar button + show/hide + drag-to-reorder dropdown
export function ColumnVisibilityMenu({ table, t, buttonStyle }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => table.setShowColMenu(v => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: table.showColMenu ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', ...buttonStyle }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        {t('table.columns')} ({table.displayCols.length}/{table.allKeys.length})
      </button>
      {table.showColMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => table.setShowColMenu(false)} />
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '8px 0', minWidth: 220 }}>
            <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-4)', borderBottom: '1px solid var(--border-3)' }}>
              {t('table.columnsDragToReorder')}
            </div>
            {table.colOrder.map((key, idx) => (
              <label
                key={key}
                draggable
                onDragStart={() => { table.dragColIdx.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); table.setDragOverColIdx(idx); }}
                onDragLeave={() => table.setDragOverColIdx(cur => cur === idx ? null : cur)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (table.dragColIdx.current !== null) table.moveCol(table.dragColIdx.current, idx);
                  table.dragColIdx.current = null;
                  table.setDragOverColIdx(null);
                }}
                onDragEnd={() => { table.dragColIdx.current = null; table.setDragOverColIdx(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', cursor: 'grab', fontSize: 13, color: 'var(--text-2)',
                  background: table.dragOverColIdx === idx ? 'var(--surface-2)' : 'transparent',
                  borderTop: table.dragOverColIdx === idx ? '2px solid #3185FC' : '2px solid transparent',
                }}
              >
                <span style={{ color: 'var(--text-4)', fontSize: 12, lineHeight: 1 }}>⠿</span>
                <input type="checkbox" checked={table.visibleCols.includes(key)} onChange={() => table.toggleColVisible(key)} style={{ accentColor: '#3185FC', width: 14, height: 14 }} />
                {table.colByKey[key].label}
              </label>
            ))}
            <div style={{ borderTop: '1px solid var(--border-3)', padding: '6px 14px 2px' }}>
              <button onClick={table.resetCols} style={{ background: 'none', border: 'none', color: '#3185FC', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                {t('table.resetToDefault')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
