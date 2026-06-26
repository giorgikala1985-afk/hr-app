import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import ImportEmployees from '../Options/ImportEmployees';
import InsuranceImport from '../Options/InsuranceImport';
import AgentsImport from '../Options/AgentsImport';
import FitPassImport from '../Options/FitPassImport';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  TextFontIcon, HashIcon, Calendar03Icon, ArrowDown01Icon,
  CheckmarkSquare01Icon, Image01Icon, Mail01Icon,
} from '@hugeicons/core-free-icons';
import './ct-styles.css';

const typeIcon = (icon) => <HugeiconsIcon icon={icon} size={15} color="currentColor" strokeWidth={1.8} />;

const TBC_STORAGE_KEY = 'tbc_excel_data';
const TABLES_STORAGE_KEY = 'dl_custom_tables';

const CATEGORIES = ['All', 'HR', 'Finance', 'Payroll', 'Insurance', 'Reports'];

const SAMPLE_FILES = [
  { id: 1, name: 'Employee_Master_2024.xlsx', category: 'HR', size: '1.2 MB', uploaded: '2024-11-15', type: 'xlsx' },
  { id: 2, name: 'Payroll_October_2024.csv', category: 'Payroll', size: '340 KB', uploaded: '2024-10-31', type: 'csv' },
  { id: 3, name: 'Insurance_Q3_2024.pdf', category: 'Insurance', size: '2.8 MB', uploaded: '2024-09-30', type: 'pdf' },
  { id: 4, name: 'Finance_Annual_Report_2023.pdf', category: 'Finance', size: '5.1 MB', uploaded: '2024-01-20', type: 'pdf' },
  { id: 5, name: 'Salary_Changes_2024.xlsx', category: 'Payroll', size: '890 KB', uploaded: '2024-12-01', type: 'xlsx' },
];

const FILE_ICONS = {
  pdf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="11" y2="17"/>
    </svg>
  ),
  xlsx: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
    </svg>
  ),
  csv: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

const COL_TYPES = [
  { value: 'text',     label: 'Text',     icon: typeIcon(TextFontIcon) },
  { value: 'number',   label: 'Number',   icon: typeIcon(HashIcon) },
  { value: 'date',     label: 'Date',     icon: typeIcon(Calendar03Icon) },
  { value: 'dropdown', label: 'Dropdown', icon: typeIcon(ArrowDown01Icon) },
  { value: 'checkbox', label: 'Checkbox', icon: typeIcon(CheckmarkSquare01Icon) },
  { value: 'picture',  label: 'Picture',  icon: typeIcon(Image01Icon) },
  { value: 'email',    label: 'Email',    icon: typeIcon(Mail01Icon) },
];

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/* ── TBC Bank ──────────────────────────────────────────────────────── */
function TBCBank() {
  const [tableData, setTableData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TBC_STORAGE_KEY);
      if (stored) {
        const { rows, name, savedAt: ts } = JSON.parse(stored);
        setTableData(rows);
        setFileName(name);
        setSavedAt(ts);
      }
    } catch {}
  }, []);

  const parseExcel = (file) => {
    setLoading(true);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        const nonEmpty = rows.filter(r => r.some(cell => cell !== ''));
        setTableData(nonEmpty);
        setFileName(file.name);
        setSavedAt(null);
        setSaveMsg('');
      } catch {
        setError('Could not parse the file. Please upload a valid Excel file.');
      }
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Please upload an Excel file (.xlsx, .xls) or CSV.');
      return;
    }
    parseExcel(file);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };
  const handleInput = (e) => { handleFile(e.target.files[0]); e.target.value = ''; };

  const handleSave = () => {
    if (!tableData) return;
    const ts = new Date().toISOString();
    localStorage.setItem(TBC_STORAGE_KEY, JSON.stringify({ rows: tableData, name: fileName, savedAt: ts }));
    setSavedAt(ts);
    setSaveMsg('Saved');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleClear = () => {
    setTableData(null); setFileName(''); setSavedAt(null); setSaveMsg(''); setError('');
    localStorage.removeItem(TBC_STORAGE_KEY);
  };

  const headers = tableData ? tableData[0] : [];
  const rows = tableData ? tableData.slice(1) : [];

  return (
    <div className="tbc-page">
      <div className="tbc-header">
        <div className="tbc-header-left">
          <div className="tbc-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a6fa8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div>
            <h3 className="tbc-title">TBC Bank</h3>
            <p className="tbc-subtitle">Upload a TBC Bank Excel statement to view as a table</p>
          </div>
        </div>
        {tableData && (
          <div className="tbc-header-actions">
            <div className="tbc-file-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>{fileName}</span>
            </div>
            <button className="tbc-save-btn" onClick={handleSave}>
              {saveMsg ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save</>
              )}
            </button>
            <button className="tbc-upload-new-btn" onClick={() => fileInputRef.current?.click()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload new
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleInput} />
            <button className="tbc-clear-btn" onClick={handleClear}>✕</button>
          </div>
        )}
      </div>
      {savedAt && <p className="tbc-saved-notice">Last saved: {new Date(savedAt).toLocaleString()}</p>}
      {!tableData && (
        <div
          className={`tbc-drop-zone${dragging ? ' tbc-drop-zone--active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleInput} />
          {loading ? (
            <div className="dl-uploading"><div className="dl-spinner" /><span>Parsing file...</span></div>
          ) : (
            <>
              <div className="tbc-drop-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="dl-drop-text"><strong>Drop your Excel file here</strong> or click to browse</p>
              <p className="dl-drop-hint">Supports .xlsx, .xls, .csv</p>
            </>
          )}
        </div>
      )}
      {error && <p className="tbc-error">{error}</p>}
      {tableData && (
        <div className="tbc-table-wrap">
          <div className="tbc-table-meta"><span>{rows.length} rows · {headers.length} columns</span></div>
          <div className="tbc-table-scroll">
            <table className="tbc-table">
              <thead>
                <tr>{headers.map((h, i) => <th key={i}>{h !== '' ? String(h) : `Col ${i + 1}`}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>{headers.map((_, ci) => <td key={ci}>{row[ci] !== undefined ? String(row[ci]) : ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Create Table Modal ────────────────────────────────────────────── */
function CreateTableModal({ name, setName, columns, setColumns, onCreate, onClose }) {
  const addCol = () => setColumns(prev => [...prev, { id: genId(), name: '', type: 'text', options: '' }]);
  const removeCol = (id) => setColumns(prev => prev.filter(c => c.id !== id));
  const updateCol = (id, field, val) => setColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));

  const canCreate = name.trim() && columns.some(c => c.name.trim());

  return (
    <div className="ct-modal-overlay" onClick={onClose}>
      <div className="ct-modal ct-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="ct-modal-header">
          <h4>Create New Table</h4>
          <button className="ct-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ct-modal-body">
          <label className="ct-label">Table Name</label>
          <input
            className="ct-input"
            placeholder="e.g. Employee Survey"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />

          <div className="ct-cols-header">
            <label className="ct-label">Columns</label>
            <button className="ct-add-col-btn" onClick={addCol}>+ Add Column</button>
          </div>

          <div className="ct-col-list">
            {columns.map((col, i) => (
              <div key={col.id} className="ct-col-row">
                <input
                  className="ct-input ct-col-name"
                  placeholder={`Column ${i + 1} name`}
                  value={col.name}
                  onChange={e => updateCol(col.id, 'name', e.target.value)}
                />
                <select
                  className="ct-select"
                  value={col.type}
                  onChange={e => updateCol(col.id, 'type', e.target.value)}
                >
                  {COL_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
                {col.type === 'dropdown' && (
                  <input
                    className="ct-input ct-col-opts"
                    placeholder="Option 1, Option 2, ..."
                    value={col.options}
                    onChange={e => updateCol(col.id, 'options', e.target.value)}
                  />
                )}
                {columns.length > 1 && (
                  <button className="ct-col-remove" onClick={() => removeCol(col.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="ct-modal-footer">
          <button className="ct-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="ct-btn-primary" onClick={onCreate} disabled={!canCreate}>
            Create Table
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Column Modal ──────────────────────────────────────────────── */
function AddColumnModal({ onAdd, onClose }) {
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState('text');
  const [colOptions, setColOptions] = useState('');

  const handleAdd = () => {
    if (!colName.trim()) return;
    onAdd({ name: colName.trim(), type: colType, options: colOptions });
  };

  return (
    <div className="ct-modal-overlay" onClick={onClose}>
      <div className="ct-modal" onClick={e => e.stopPropagation()}>
        <div className="ct-modal-header">
          <h4>Add Column</h4>
          <button className="ct-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ct-modal-body">
          <label className="ct-label">Column Name</label>
          <input
            className="ct-input"
            placeholder="e.g. Status"
            value={colName}
            onChange={e => setColName(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <label className="ct-label" style={{ marginTop: 14 }}>Type</label>
          <div className="ct-type-grid">
            {COL_TYPES.map(t => (
              <button
                key={t.value}
                className={`ct-type-btn${colType === t.value ? ' active' : ''}`}
                onClick={() => setColType(t.value)}
              >
                <span className="ct-type-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          {colType === 'dropdown' && (
            <>
              <label className="ct-label" style={{ marginTop: 14 }}>Options (comma-separated)</label>
              <input
                className="ct-input"
                placeholder="Option 1, Option 2, Option 3"
                value={colOptions}
                onChange={e => setColOptions(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="ct-modal-footer">
          <button className="ct-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="ct-btn-primary" onClick={handleAdd} disabled={!colName.trim()}>
            Add Column
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Custom Tables ─────────────────────────────────────────────────── */
function CustomTables() {
  const [tables, setTables] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TABLES_STORAGE_KEY)) || []; } catch { return []; }
  });
  const [view, setView] = useState('list');
  const [activeTableId, setActiveTableId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddColModal, setShowAddColModal] = useState(false);
  const [editingCell, setEditingCell] = useState(null);

  const [newTableName, setNewTableName] = useState('');
  const [newColumns, setNewColumns] = useState([{ id: genId(), name: '', type: 'text', options: '' }]);

  const persist = useCallback((updated) => {
    setTables(updated);
    localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const activeTable = tables.find(t => t.id === activeTableId);

  const openTable = (id) => { setActiveTableId(id); setView('table'); };
  const goBack = () => { setView('list'); setActiveTableId(null); setEditingCell(null); };

  const handleCreate = () => {
    const name = newTableName.trim();
    if (!name) return;
    const cols = newColumns
      .filter(c => c.name.trim())
      .map(c => ({
        id: genId(),
        name: c.name.trim(),
        type: c.type,
        options: c.type === 'dropdown' ? c.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      }));
    if (!cols.length) return;
    const table = { id: genId(), name, columns: cols, rows: [] };
    const updated = [...tables, table];
    persist(updated);
    setShowCreateModal(false);
    setNewTableName('');
    setNewColumns([{ id: genId(), name: '', type: 'text', options: '' }]);
    openTable(table.id);
  };

  const deleteTable = (id) => {
    persist(tables.filter(t => t.id !== id));
    if (activeTableId === id) goBack();
  };

  const addRow = () => {
    if (!activeTable) return;
    const row = { id: genId() };
    activeTable.columns.forEach(c => { row[c.id] = c.type === 'checkbox' ? false : ''; });
    persist(tables.map(t => t.id === activeTableId ? { ...t, rows: [...t.rows, row] } : t));
  };

  const deleteRow = (rowId) => {
    persist(tables.map(t => t.id === activeTableId ? { ...t, rows: t.rows.filter(r => r.id !== rowId) } : t));
  };

  const updateCell = useCallback((rowId, colId, value) => {
    setTables(prev => {
      const updated = prev.map(t => {
        if (t.id !== activeTableId) return t;
        return { ...t, rows: t.rows.map(r => r.id === rowId ? { ...r, [colId]: value } : r) };
      });
      localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [activeTableId]);

  const handleAddColumn = ({ name, type, options }) => {
    const col = {
      id: genId(), name, type,
      options: type === 'dropdown' ? options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
    };
    persist(tables.map(t => {
      if (t.id !== activeTableId) return t;
      return {
        ...t,
        columns: [...t.columns, col],
        rows: t.rows.map(r => ({ ...r, [col.id]: col.type === 'checkbox' ? false : '' })),
      };
    }));
    setShowAddColModal(false);
  };

  const deleteColumn = (colId) => {
    persist(tables.map(t => {
      if (t.id !== activeTableId) return t;
      return {
        ...t,
        columns: t.columns.filter(c => c.id !== colId),
        rows: t.rows.map(r => { const copy = { ...r }; delete copy[colId]; return copy; }),
      };
    }));
  };

  const renderCell = (row, col) => {
    const val = row[col.id];
    const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;

    if (col.type === 'checkbox') {
      return (
        <td key={col.id} className="ct-td ct-td--checkbox">
          <input
            type="checkbox"
            className="ct-checkbox"
            checked={!!val}
            onChange={e => updateCell(row.id, col.id, e.target.checked)}
          />
        </td>
      );
    }

    if (col.type === 'dropdown') {
      return (
        <td key={col.id} className="ct-td">
          <select
            className="ct-cell-select"
            value={val || ''}
            onChange={e => updateCell(row.id, col.id, e.target.value)}
          >
            <option value="">—</option>
            {(col.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </td>
      );
    }

    if (col.type === 'picture') {
      return (
        <td key={col.id} className="ct-td ct-td--picture" onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}>
          {isEditing ? (
            <input
              className="ct-cell-input"
              autoFocus
              type="url"
              placeholder="Paste image URL..."
              value={val || ''}
              onChange={e => updateCell(row.id, col.id, e.target.value)}
              onBlur={() => setEditingCell(null)}
            />
          ) : val ? (
            <img src={val} alt="" className="ct-cell-img" onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <span className="ct-cell-empty">Add URL</span>
          )}
        </td>
      );
    }

    const inputType = col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : col.type === 'email' ? 'email' : 'text';

    return (
      <td key={col.id} className="ct-td" onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}>
        {isEditing ? (
          <input
            className="ct-cell-input"
            autoFocus
            type={inputType}
            value={val || ''}
            onChange={e => updateCell(row.id, col.id, e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={e => e.key === 'Enter' && setEditingCell(null)}
          />
        ) : (
          <span className={val ? 'ct-cell-value' : 'ct-cell-empty'}>
            {col.type === 'date' && val ? new Date(val).toLocaleDateString() : (val !== undefined && val !== '' ? String(val) : '—')}
          </span>
        )}
      </td>
    );
  };

  /* List view */
  if (view === 'list') {
    return (
      <div className="ct-page">
        <div className="ct-list-header">
          <div>
            <h3 className="ct-list-title">Custom Tables</h3>
            <p className="ct-list-sub">Create Notion-style tables to organize your data</p>
          </div>
          <button className="ct-btn-primary" onClick={() => setShowCreateModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Table
          </button>
        </div>

        {tables.length === 0 ? (
          <div className="ct-empty">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="9" x2="9" y2="21"/>
              <line x1="15" y1="9" x2="15" y2="21"/>
            </svg>
            <p className="ct-empty-title">No tables yet</p>
            <p className="ct-empty-sub">Create your first table to start organizing data</p>
            <button className="ct-btn-primary" onClick={() => setShowCreateModal(true)}>Create Table</button>
          </div>
        ) : (
          <div className="ct-table-grid">
            {tables.map(t => (
              <div key={t.id} className="ct-table-card" onClick={() => openTable(t.id)}>
                <div className="ct-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="15" x2="21" y2="15"/>
                    <line x1="9" y1="9" x2="9" y2="21"/>
                    <line x1="15" y1="9" x2="15" y2="21"/>
                  </svg>
                </div>
                <div className="ct-card-info">
                  <span className="ct-card-name">{t.name}</span>
                  <span className="ct-card-meta">{t.columns.length} col · {t.rows.length} rows</span>
                </div>
                <div className="ct-card-cols">
                  {t.columns.slice(0, 4).map(c => (
                    <span key={c.id} className="ct-card-col-chip">
                      {COL_TYPES.find(ct => ct.value === c.type)?.icon} {c.name}
                    </span>
                  ))}
                  {t.columns.length > 4 && <span className="ct-card-col-chip">+{t.columns.length - 4}</span>}
                </div>
                <button
                  className="ct-card-delete"
                  onClick={e => { e.stopPropagation(); deleteTable(t.id); }}
                  title="Delete table"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <CreateTableModal
            name={newTableName}
            setName={setNewTableName}
            columns={newColumns}
            setColumns={setNewColumns}
            onCreate={handleCreate}
            onClose={() => { setShowCreateModal(false); setNewTableName(''); setNewColumns([{ id: genId(), name: '', type: 'text', options: '' }]); }}
          />
        )}
      </div>
    );
  }

  /* Table view */
  if (!activeTable) return null;

  return (
    <div className="ct-page">
      <div className="ct-table-topbar">
        <div className="ct-table-topbar-left">
          <button className="ct-back-btn" onClick={goBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Tables
          </button>
          <span className="ct-topbar-sep">/</span>
          <h3 className="ct-table-name">{activeTable.name}</h3>
          <span className="ct-table-rowcount">{activeTable.rows.length} rows</span>
        </div>
        <div className="ct-table-topbar-right">
          <button className="ct-btn-secondary" onClick={() => setShowAddColModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Column
          </button>
          <button className="ct-btn-primary" onClick={addRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Row
          </button>
        </div>
      </div>

      <div className="ct-table-scroll">
        <table className="ct-table">
          <thead>
            <tr>
              <th className="ct-th ct-th--num">#</th>
              {activeTable.columns.map(col => (
                <th key={col.id} className="ct-th">
                  <div className="ct-th-inner">
                    <span className="ct-col-type-icon">{COL_TYPES.find(t => t.value === col.type)?.icon || 'Aa'}</span>
                    <span className="ct-col-name-text">{col.name}</span>
                    <button className="ct-col-del" onClick={() => deleteColumn(col.id)} title="Remove column">×</button>
                  </div>
                </th>
              ))}
              <th className="ct-th ct-th--act" />
            </tr>
          </thead>
          <tbody>
            {activeTable.rows.length === 0 ? (
              <tr>
                <td colSpan={activeTable.columns.length + 2} className="ct-no-rows">
                  No rows yet — click <strong>Add Row</strong> to get started
                </td>
              </tr>
            ) : (
              activeTable.rows.map((row, idx) => (
                <tr key={row.id} className="ct-tr">
                  <td className="ct-td ct-td--num">{idx + 1}</td>
                  {activeTable.columns.map(col => renderCell(row, col))}
                  <td className="ct-td ct-td--act">
                    <button className="ct-row-del" onClick={() => deleteRow(row.id)} title="Delete row">✕</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button className="ct-add-row-inline" onClick={addRow}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Row
      </button>

      {showAddColModal && (
        <AddColumnModal onAdd={handleAddColumn} onClose={() => setShowAddColModal(false)} />
      )}
    </div>
  );
}

/* ── Data Lake (main) ──────────────────────────────────────────────── */
function DataLake() {
  const [activeSubTab, setActiveSubTab] = useState('import');
  const [importView, setImportView] = useState(null);

  const SUBTABS = [
    {
      key: 'import',
      label: 'Import',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    },
    {
      key: 'tbc',
      label: 'TBC Bank',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    },
    {
      key: 'tables',
      label: 'Tables',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>,
    },
  ];

  return (
    <div className="dl-page">
      <div className="dl-header">
        <div className="dl-header-left">
          <div className="dl-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div>
            <h2 className="dl-title">Data Lake</h2>
            <p className="dl-subtitle">Centralized file storage for all company data</p>
          </div>
        </div>
      </div>

      <div className="dl-subtabs">
        {SUBTABS.map(tab => (
          <button
            key={tab.key}
            className={`dl-subtab-btn${activeSubTab === tab.key ? ' active' : ''}`}
            onClick={() => { setActiveSubTab(tab.key); setImportView(null); }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'import' && (
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          {[
            { key: 'employees', label: 'Import Employees', icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            )},
            { key: 'insurance', label: 'Insurance Import', icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
              </svg>
            )},
            { key: 'agents', label: 'Import Coagents', icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>
              </svg>
            )},
            { key: 'fitpass', label: 'FitPass', icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            )}
          ].map(tab => (
            <button key={tab.key} onClick={() => setImportView(tab.key)} style={{
              padding: '7px 16px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              background: importView === tab.key ? 'var(--surface)' : 'transparent',
              color: importView === tab.key ? 'var(--text)' : 'var(--text-3)',
              boxShadow: importView === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s',
            }}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeSubTab === 'import' && (
        <div>
          {importView === 'employees' && <ImportEmployees />}
          {importView === 'insurance' && <InsuranceImport />}
          {importView === 'agents' && <AgentsImport />}
          {importView === 'fitpass' && <FitPassImport />}
          {!importView && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '48px 20px', fontSize: 14 }}>
              Select an import type above to get started.
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'tbc' && <TBCBank />}
      {activeSubTab === 'tables' && <CustomTables />}
    </div>
  );
}

export default DataLake;
