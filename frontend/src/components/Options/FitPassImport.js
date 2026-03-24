import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const FP_DEFAULT_WIDTHS = [130, 130, 130, 110, 110, 150, 80];
const TEMPLATE_COLUMNS = ['ID', 'Name', 'Last Name', 'Amount', 'Period', 'Note'];

const ACCENT = '#16a34a';

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box', padding: '6px 8px',
  border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12,
  outline: 'none', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
};

function FitPassImport() {
  const { colWidths, onResizeMouseDown } = useColumnResize(FP_DEFAULT_WIDTHS);
  const [subTab, setSubTab] = useState('import');
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [applyDate, setApplyDate] = useState('');
  const [expandedDates, setExpandedDates] = useState(new Set());

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await api.get('/fitpass-list');
      setRecords(res.data.records || []);
    } catch { console.error('Failed to load fitpass records'); }
    finally { setLoadingRecords(false); }
  };

  const filteredRecords = records.filter(rec => {
    const q = search.trim().toLowerCase();
    if (q && !`${rec.name} ${rec.last_name} ${rec.personal_id}`.toLowerCase().includes(q)) return false;
    if (filterPeriod && (!rec.period || !rec.period.startsWith(filterPeriod))) return false;
    return true;
  });

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

  const downloadTemplate = () => {
    const exampleRow = { 'ID': '01234567890', 'Name': 'John', 'Last Name': 'Doe', 'Amount': 50, 'Period': '2026-03-01', 'Note': 'FitPass Standard' };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });
    ws['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FitPass');
    XLSX.writeFile(wb, 'FitPass_Import_Template.xlsx');
  };

  const processFile = (file) => {
    if (!file) return;
    setFileName(file.name); setError(''); setSuccess(''); setRows([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const mapped = data.map((row) => ({
          personal_id: String(row['ID'] || '').trim(),
          name: String(row['Name'] || '').trim(),
          last_name: String(row['Last Name'] || '').trim(),
          amount: row['Amount'] || '',
          period: formatExcelDate(row['Period']),
          note: String(row['Note'] || '').trim(),
          _valid: true,
        }));
        mapped.forEach((row) => {
          const missing = [];
          if (!row.personal_id) missing.push('ID');
          if (!row.name) missing.push('Name');
          if (!row.last_name) missing.push('Last Name');
          if (!row.amount && row.amount !== 0) missing.push('Amount');
          if (!row.period) missing.push('Period');
          if (missing.length > 0) { row._valid = false; row._missing = missing; }
        });
        setRows(mapped);
      } catch (err) {
        setError('Failed to parse file: ' + err.message);
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) processFile(file);
  };

  const handleSave = async () => {
    const valid = rows.filter((r) => r._valid).map(({ _valid, _missing, ...rest }) => rest);
    if (valid.length === 0) { setError('No valid rows to save.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/fitpass-list/bulk', { records: valid });
      setSuccess(`Saved ${res.data.inserted} records successfully.`);
      setRows([]); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      loadRecords();
      setTimeout(() => setSubTab('records'), 800);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save records.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try { await api.delete(`/fitpass-list/${id}`); loadRecords(); }
    catch { setError('Failed to delete record.'); }
  };

  const startEdit = (rec) => {
    setEditId(rec.id);
    setEditForm({ name: rec.name, last_name: rec.last_name, personal_id: rec.personal_id, amount: rec.amount, period: rec.period || '', note: rec.note || '' });
  };

  const handleUpdate = async () => {
    try { await api.put(`/fitpass-list/${editId}`, editForm); setEditId(null); loadRecords(); }
    catch { setError('Failed to update record.'); }
  };

  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>FitPass Import</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>Import FitPass deductions by employee ID</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface-3)', borderRadius: 20, padding: '3px 10px' }}>
            {records.length} records
          </div>
        </div>

        {/* Sub-tab bar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-3)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {[
              { key: 'import', label: 'Import' },
              { key: 'records', label: `Records${records.length ? ` (${records.length})` : ''}` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setSubTab(tab.key)} style={{
                padding: '6px 18px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit',
                background: subTab === tab.key ? 'var(--surface)' : 'transparent',
                color: subTab === tab.key ? 'var(--text)' : 'var(--text-3)',
                boxShadow: subTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>{tab.label}</button>
            ))}
          </div>
        </div>

        {/* Messages */}
        {error && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#f0fdf4', color: ACCENT, border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{success}</div>}

        {/* ── IMPORT TAB ── */}
        {subTab === 'import' && (
          <div style={{ padding: '8px 0' }}>

            {/* Step 1 */}
            <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', borderBottom: '1px solid var(--border-3)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>1</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Download Template</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Columns: ID, Name, Last Name, Amount, Period, Note</div>
                <button onClick={downloadTemplate} className="btn-excel">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="12" y1="12" x2="12" y2="18"/><polyline points="9,15 12,18 15,15"/>
                  </svg>
                  Download Template
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', borderBottom: rows.length > 0 ? '1px solid var(--border-3)' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Upload File</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Upload your filled Excel file (.xlsx or .xls)</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? ACCENT : fileName ? '#86efac' : 'var(--border-2)'}`,
                    borderRadius: 10, padding: '20px 24px', textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? '#f0fdf4' : fileName ? '#f0fdf4' : 'var(--surface-2)',
                    transition: 'all 0.15s',
                  }}
                >
                  {fileName ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>{fileName}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>· click to replace</span>
                    </div>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>Choose file or drag & drop</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>.xlsx / .xls</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3 preview */}
            {rows.length > 0 && (
              <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>3</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Preview & Save</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 12px', borderRadius: 20, background: '#f0fdf4', color: ACCENT, fontWeight: 600, fontSize: 12, border: '1px solid #bbf7d0' }}>{validCount} valid</span>
                    {invalidCount > 0 && <span style={{ padding: '3px 12px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 12, border: '1px solid #fca5a5' }}>{invalidCount} invalid</span>}
                    <span style={{ padding: '3px 12px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-3)', fontWeight: 600, fontSize: 12, border: '1px solid var(--border-2)' }}>{rows.length} total</span>
                  </div>
                  {/* Apply date to all */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Apply date to all entries:</span>
                    <input type="date" value={applyDate} onChange={e => setApplyDate(e.target.value)}
                      style={{ padding: '5px 8px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
                    <button onClick={() => {
                      if (!applyDate) return;
                      setRows(prev => prev.map(r => ({ ...r, period: applyDate })));
                    }} disabled={!applyDate} style={{
                      padding: '5px 14px', background: applyDate ? ACCENT : 'var(--surface-3)', color: applyDate ? '#fff' : 'var(--text-4)',
                      border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: applyDate ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>Apply to all</button>
                    {applyDate && <button onClick={() => setApplyDate('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 11, fontFamily: 'inherit', padding: '4px 6px' }}>✕ Clear</button>}
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-2)', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['#', 'ID', 'Name', 'Last Name', 'Amount', 'Period', 'Note', 'Status'].map((h, i) => (
                            <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} style={{ background: row._valid ? (i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)') : '#fef2f2' }}>
                            <td style={{ padding: '7px 10px', color: 'var(--text-4)' }}>{i + 1}</td>
                            <td style={{ padding: '7px 10px', color: !row.personal_id ? '#dc2626' : 'var(--text)' }}>{row.personal_id || '—'}</td>
                            <td style={{ padding: '7px 10px', color: !row.name ? '#dc2626' : 'var(--text)' }}>{row.name || '—'}</td>
                            <td style={{ padding: '7px 10px', color: !row.last_name ? '#dc2626' : 'var(--text)' }}>{row.last_name || '—'}</td>
                            <td style={{ padding: '7px 10px', color: !row.amount && row.amount !== 0 ? '#dc2626' : 'var(--text)' }}>{row.amount}</td>
                            <td style={{ padding: '7px 10px', color: !row.period ? '#dc2626' : 'var(--text-3)' }}>{row.period || '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{row.note || '—'}</td>
                            <td style={{ padding: '7px 10px' }}>
                              {row._valid
                                ? <span style={{ padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: ACCENT, fontWeight: 600, fontSize: 11, border: '1px solid #bbf7d0' }}>OK</span>
                                : <span title={row._missing?.join(', ')} style={{ padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 11, border: '1px solid #fca5a5', cursor: 'help' }}>Missing</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={handleSave} disabled={saving || validCount === 0} style={{
                    padding: '10px 24px', background: saving || validCount === 0 ? 'var(--surface-3)' : ACCENT,
                    color: saving || validCount === 0 ? 'var(--text-4)' : '#fff',
                    border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    cursor: saving || validCount === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}>
                    {saving ? 'Saving…' : `Save ${validCount} record${validCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RECORDS TAB ── */}
        {subTab === 'records' && (
          <div style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" placeholder="Search name, last name, ID…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}
                  onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'var(--border-2)'} />
              </div>
              <div style={{ position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                  style={{ padding: '8px 10px 8px 30px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
                  onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'var(--border-2)'} />
              </div>
              {(search || filterPeriod) && (
                <button onClick={() => { setSearch(''); setFilterPeriod(''); }} style={{
                  padding: '7px 14px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 8,
                  fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Clear
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-4)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {filteredRecords.length} of {records.length} records
              </span>
            </div>

            {loadingRecords ? (
              <div style={{ padding: '32px 0', color: 'var(--text-4)', fontSize: 13 }}>Loading…</div>
            ) : records.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-4)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏋️</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>No FitPass records yet</div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 14 }}>No records match your search.</div>
            ) : (() => {
              const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
              const fmtMonthKey = (key) => {
                const m = key.match(/^(\d{4})-(\d{2})$/);
                if (m) return `${MONTH_NAMES[parseInt(m[2], 10) - 1]} ${m[1]}`;
                return key;
              };
              const groups = {};
              filteredRecords.forEach(rec => {
                const raw = rec.period || rec.date || '';
                const key = raw ? raw.slice(0, 7) : '—';
                if (!groups[key]) groups[key] = [];
                groups[key].push(rec);
              });
              const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
              const toggleDate = (d) => setExpandedDates(prev => {
                const next = new Set(prev);
                next.has(d) ? next.delete(d) : next.add(d);
                return next;
              });
              const deleteGroup = async (groupRecs) => {
                if (!window.confirm(`Delete all ${groupRecs.length} records in this period?`)) return;
                try {
                  await Promise.all(groupRecs.map(r => api.delete(`/fitpass-list/${r.id}`)));
                  loadRecords();
                } catch { setError('Failed to delete some records.'); }
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sortedKeys.map(dateKey => {
                    const isOpen = expandedDates.has(dateKey);
                    const groupRecs = groups[dateKey];
                    return (
                      <div key={dateKey} style={{ borderRadius: 10, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
                        {/* Group header */}
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--surface-2)', borderBottom: isOpen ? '1px solid var(--border-2)' : 'none' }}>
                          <button onClick={() => toggleDate(dateKey)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1, fontFamily: 'inherit', textAlign: 'left' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                              <polyline points="9,18 15,12 9,6"/>
                            </svg>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{fmtMonthKey(dateKey)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>{groupRecs.length} records</span>
                          </button>
                          <button onClick={() => deleteGroup(groupRecs)} title="Delete all in this period" style={{
                            background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer',
                            color: '#ef4444', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                          }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                            </svg>
                            Delete all
                          </button>
                        </div>

                        {/* Expanded table */}
                        {isOpen && (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
                              <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                              <thead>
                                <tr style={{ background: 'var(--surface-2)' }}>
                                  {[['Name', 0], ['Last Name', 1], ['ID', 2], ['Amount', 3], ['Period', 4], ['Note', 5], ['', 6]].map(([label, idx]) => (
                                    <th key={idx} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-2)', position: 'relative', width: colWidths[idx], overflow: 'hidden' }}>
                                      {label}
                                      <div onMouseDown={e => onResizeMouseDown(e, idx)} style={RESIZE_HANDLE_STYLE}
                                        onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {groupRecs.map((rec, i) => (
                                  <tr key={rec.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                                    {editId === rec.id ? (
                                      <>
                                        <td style={{ padding: '6px 8px', overflow: 'hidden' }}><input style={INPUT_STYLE} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                                        <td style={{ padding: '6px 8px', overflow: 'hidden' }}><input style={INPUT_STYLE} value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} /></td>
                                        <td style={{ padding: '6px 8px', overflow: 'hidden' }}><input style={INPUT_STYLE} value={editForm.personal_id} onChange={e => setEditForm({ ...editForm, personal_id: e.target.value })} /></td>
                                        <td style={{ padding: '6px 8px', overflow: 'hidden' }}><input style={INPUT_STYLE} type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} /></td>
                                        <td style={{ padding: '6px 8px', overflow: 'hidden' }}><input style={INPUT_STYLE} type="date" value={editForm.period} onChange={e => setEditForm({ ...editForm, period: e.target.value })} /></td>
                                        <td style={{ padding: '6px 8px', overflow: 'hidden' }}><input style={INPUT_STYLE} value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} /></td>
                                        <td style={{ padding: '6px 8px', display: 'flex', gap: 6 }}>
                                          <button onClick={handleUpdate} style={{ padding: '5px 10px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                                          <button onClick={() => setEditId(null)} style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td style={{ padding: '8px 10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text)' }}>
                                          {search ? <Highlight text={rec.name} query={search} /> : rec.name}
                                        </td>
                                        <td style={{ padding: '8px 10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text)' }}>
                                          {search ? <Highlight text={rec.last_name} query={search} /> : rec.last_name}
                                        </td>
                                        <td style={{ padding: '8px 10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text-3)' }}>
                                          {search ? <Highlight text={rec.personal_id} query={search} /> : rec.personal_id}
                                        </td>
                                        <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 600 }}>{rec.amount}</td>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-3)' }}>{rec.period || '—'}</td>
                                        <td style={{ padding: '8px 10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text-3)' }}>{rec.note || '—'}</td>
                                        <td style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
                                          <button onClick={() => startEdit(rec)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                                            onMouseEnter={e => e.currentTarget.style.color = ACCENT} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                          </button>
                                          <button onClick={() => handleDelete(rec.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                          </button>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}

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

export default FitPassImport;
