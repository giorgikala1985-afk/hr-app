import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const INS_IMPORT_DEFAULT_WIDTHS = [130, 130, 110, 110, 110, 110, 90, 80];
const TEMPLATE_COLUMNS = ['Name', 'Last Name', 'ID', 'Amount 1', 'Amount 2', 'Date', 'Pension'];

function InsuranceImport() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(INS_IMPORT_DEFAULT_WIDTHS);

  // Sub-tab
  const [subTab, setSubTab] = useState('import');

  // Import state
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef(null);

  // Records state
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Search / filter
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await api.get('/insurance-list');
      setRecords(res.data.records || []);
    } catch {
      console.error('Failed to load insurance records');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Filtered records
  const filteredRecords = records.filter(rec => {
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = `${rec.name} ${rec.last_name} ${rec.personal_id}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filterMonth) {
      // rec.date is YYYY-MM-DD; filterMonth is YYYY-MM
      if (!rec.date || !rec.date.startsWith(filterMonth)) return false;
    }
    return true;
  });

  const downloadTemplate = () => {
    const exampleRow = {
      'Name': 'John', 'Last Name': 'Doe', 'ID': '01234567890',
      'Amount 1': 100, 'Amount 2': 50, 'Date': '2026-02-01', 'Pension': 'Yes'
    };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Insurance');
    XLSX.writeFile(wb, 'Insurance_Import_Template.xlsx');
  };

  const formatExcelDate = (value) => {
    if (!value) return '';
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
    return str;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError(''); setSuccess(''); setRows([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const mapped = data.map((row) => ({
          name: row['Name'] || '',
          last_name: row['Last Name'] || '',
          personal_id: String(row['ID'] || ''),
          amount1: row['Amount 1'] || '',
          amount2: row['Amount 2'] || '',
          date: formatExcelDate(row['Date']),
          pension: row['Pension'] ? String(row['Pension']).toLowerCase().trim() === 'yes' : false,
          _valid: true
        }));
        mapped.forEach((row) => {
          const missing = [];
          if (!row.name) missing.push('Name');
          if (!row.last_name) missing.push('Last Name');
          if (!row.personal_id) missing.push('ID');
          if (!row.amount1 && row.amount1 !== 0) missing.push('Amount 1');
          if (!row.date) missing.push('Date');
          if (missing.length > 0) { row._valid = false; row._missing = missing; }
        });
        setRows(mapped);
      } catch (err) {
        setError(t('insImport.parseFailed') + err.message);
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    const valid = rows.filter((r) => r._valid).map(({ _valid, _missing, ...rest }) => rest);
    if (valid.length === 0) { setError(t('insImport.noValid')); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/insurance-list/bulk', { records: valid });
      setSuccess(t('insImport.saved').replace('{count}', res.data.inserted));
      setRows([]); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      loadRecords();
      // Switch to records tab after successful import
      setTimeout(() => setSubTab('records'), 800);
    } catch (err) {
      setError(err.response?.data?.error || t('insImport.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('insImport.deleteConfirm'))) return;
    try {
      await api.delete(`/insurance-list/${id}`);
      loadRecords();
    } catch {
      setError(t('insImport.deleteFailed'));
    }
  };

  const startEdit = (rec) => {
    setEditId(rec.id);
    setEditForm({ name: rec.name, last_name: rec.last_name, personal_id: rec.personal_id, amount1: rec.amount1, amount2: rec.amount2 || '', date: rec.date, pension: !!rec.pension });
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/insurance-list/${editId}`, editForm);
      setEditId(null);
      loadRecords();
    } catch {
      setError(t('insImport.updateFailed'));
    }
  };

  const validCount   = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;

  const SUB_TABS = [
    {
      key: 'import', label: t('insImport.title'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
    },
    {
      key: 'records',
      label: `${t('insImport.savedTitle')}${records.length ? ` (${records.length})` : ''}`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="tab-panel">
      {/* Header */}
      <div className="tab-panel-header">
        <h3>{t('insImport.title')}</h3>
        <p>{t('insImport.desc')}</p>
      </div>

      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#f3f4f6', borderRadius: 10, padding: 4,
        width: 'fit-content',
      }}>
        {SUB_TABS.map(tab => {
          const isActive = subTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 18px',
                background: isActive ? 'white' : 'none',
                border: 'none',
                borderRadius: 7,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                color: isActive ? '#111827' : '#6b7280',
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {error   && <div className="msg-error"   style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="msg-success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* ── IMPORT SUB-TAB ── */}
      {subTab === 'import' && (
        <>
          {/* Step 1 */}
          <div className="import-step">
            <div className="import-step-num">1</div>
            <div className="import-step-content">
              <h4>{t('insImport.step1Title')}</h4>
              <p>{t('insImport.step1Desc')}</p>
              <button className="btn-excel" onClick={downloadTemplate}>
                <span className="excel-icon">&#x1F4E5;</span> {t('insImport.downloadTemplate')}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="import-step">
            <div className="import-step-num">2</div>
            <div className="import-step-content">
              <h4>{t('insImport.step2Title')}</h4>
              <p>{t('insImport.step2Desc')}</p>
              <div className="import-file-input">
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} id="insurance-excel-upload" />
                <label htmlFor="insurance-excel-upload" className="btn-upload">{t('insImport.chooseFile')}</label>
                {fileName && <span className="import-filename">{fileName}</span>}
              </div>
            </div>
          </div>

          {/* Step 3: Preview & Save */}
          {rows.length > 0 && (
            <div className="import-step">
              <div className="import-step-num">3</div>
              <div className="import-step-content">
                <h4>{t('insImport.step3Title')}</h4>
                <div className="import-stats">
                  <span className="import-stat-valid">{t('insImport.valid').replace('{count}', validCount)}</span>
                  {invalidCount > 0 && <span className="import-stat-invalid">{t('insImport.invalid').replace('{count}', invalidCount)}</span>}
                  <span className="import-stat-total">{t('insImport.totalRows').replace('{count}', rows.length)}</span>
                </div>
                <div className="import-preview-wrapper">
                  <table className="import-preview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('insImport.colName')}</th>
                        <th>{t('insImport.colLastName')}</th>
                        <th>{t('insImport.colId')}</th>
                        <th>{t('insImport.colAmount1')}</th>
                        <th>{t('insImport.colAmount2')}</th>
                        <th>{t('insImport.colDate')}</th>
                        <th>Pension</th>
                        <th>{t('insImport.colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={row._valid ? '' : 'import-row-invalid'}>
                          <td>{i + 1}</td>
                          <td className={!row.name ? 'import-cell-missing' : ''}>{row.name}</td>
                          <td className={!row.last_name ? 'import-cell-missing' : ''}>{row.last_name}</td>
                          <td className={!row.personal_id ? 'import-cell-missing' : ''}>{row.personal_id}</td>
                          <td className={!row.amount1 && row.amount1 !== 0 ? 'import-cell-missing' : ''}>{row.amount1}</td>
                          <td>{row.amount2 || '—'}</td>
                          <td className={!row.date ? 'import-cell-missing' : ''}>{row.date}</td>
                          <td style={{ textAlign: 'center' }}>{row.pension ? '✔' : '—'}</td>
                          <td>
                            {row._valid
                              ? <span className="import-badge-ok">{t('insImport.ok')}</span>
                              : <span className="import-badge-err" title={row._missing?.join(', ')}>{t('insImport.missing')}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn-primary btn-import" onClick={handleSave} disabled={saving || validCount === 0}>
                  {saving ? t('insImport.saving') : t('insImport.saveBtn').replace('{count}', validCount)}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── RECORDS SUB-TAB ── */}
      {subTab === 'records' && (
        <>
          {/* Search & Filter bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            {/* Search box */}
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search name, last name, ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px 8px 32px',
                  border: '1.5px solid #e5e7eb', borderRadius: 8,
                  fontSize: 13, color: '#111827', fontFamily: 'inherit',
                  outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = '#3185FC'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Month filter */}
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                style={{
                  padding: '8px 10px 8px 30px',
                  border: '1.5px solid #e5e7eb', borderRadius: 8,
                  fontSize: 13, color: filterMonth ? '#111827' : '#9ca3af',
                  fontFamily: 'inherit', outline: 'none', background: 'white',
                }}
                onFocus={e => e.target.style.borderColor = '#3185FC'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Clear filters */}
            {(search || filterMonth) && (
              <button
                onClick={() => { setSearch(''); setFilterMonth(''); }}
                style={{
                  padding: '7px 14px', background: 'none',
                  border: '1.5px solid #e5e7eb', borderRadius: 8,
                  fontSize: 13, color: '#6b7280', cursor: 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear
              </button>
            )}

            {/* Count badge */}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {filteredRecords.length} of {records.length} records
            </span>
          </div>

          {loadingRecords ? (
            <div style={{ color: '#888', padding: '20px 0' }}>{t('insImport.loading')}</div>
          ) : records.length === 0 ? (
            <div className="ut-empty">{t('insImport.noRecords')}</div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              No records match your search.
            </div>
          ) : (
            <div className="import-preview-wrapper">
              <table className="import-preview-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {[
                      [t('insImport.colName'), 0],
                      [t('insImport.colLastName'), 1],
                      [t('insImport.colId'), 2],
                      [t('insImport.colAmount1'), 3],
                      [t('insImport.colAmount2'), 4],
                      [t('insImport.colDate'), 5],
                      ['Pension', 6],
                      ['', 7],
                    ].map(([label, idx]) => (
                      <th key={idx} style={{ position: 'relative', width: colWidths[idx], overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {label}
                        <div onMouseDown={e => onResizeMouseDown(e, idx)} style={RESIZE_HANDLE_STYLE}
                          onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id}>
                      {editId === rec.id ? (
                        <>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}><input className="ut-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}><input className="ut-input" value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} /></td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}><input className="ut-input" value={editForm.personal_id} onChange={e => setEditForm({ ...editForm, personal_id: e.target.value })} /></td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}><input className="ut-input" type="number" value={editForm.amount1} onChange={e => setEditForm({ ...editForm, amount1: e.target.value })} /></td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}><input className="ut-input" type="number" value={editForm.amount2} onChange={e => setEditForm({ ...editForm, amount2: e.target.value })} /></td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}><input className="ut-input" type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} /></td>
                          <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!editForm.pension} onChange={e => setEditForm({ ...editForm, pension: e.target.checked })} /></td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-primary btn-sm" onClick={handleUpdate}>{t('insImport.save')}</button>
                            <button className="ut-cancel-btn" onClick={() => setEditId(null)}>{t('insImport.cancel')}</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {search ? <Highlight text={rec.name} query={search} /> : rec.name}
                          </td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {search ? <Highlight text={rec.last_name} query={search} /> : rec.last_name}
                          </td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {search ? <Highlight text={rec.personal_id} query={search} /> : rec.personal_id}
                          </td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{rec.amount1}</td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{rec.amount2 || '—'}</td>
                          <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{rec.date}</td>
                          <td style={{ textAlign: 'center' }}>{rec.pension ? '✔' : '—'}</td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button className="ut-edit-btn" onClick={() => startEdit(rec)}>&#9998;</button>
                            <button className="ut-delete-btn" onClick={() => handleDelete(rec.id)}>&times;</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Highlights matching query text in yellow
function Highlight({ text, query }) {
  if (!query || !text) return text || null;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  const str = String(text);
  return (
    <>
      {str.slice(0, idx)}
      <mark style={{ background: '#fef08a', color: '#111827', borderRadius: 2, padding: '0 1px' }}>
        {str.slice(idx, idx + query.length)}
      </mark>
      {str.slice(idx + query.length)}
    </>
  );
}

export default InsuranceImport;
