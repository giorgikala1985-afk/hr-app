import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';

const TEMPLATE_COLUMNS = ['Name', 'Type', 'Add Date', 'Account Number', 'Address', 'Phone'];
const AGENT_TYPES = ['LLC', 'IS', 'JSC', 'Other'];

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box', padding: '6px 8px',
  border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12,
  outline: 'none', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
};

function AgentsImport() {
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

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await api.get('/accounting/agents');
      setRecords(res.data.records || []);
    } catch { }
    finally { setLoadingRecords(false); }
  };

  const filteredRecords = records.filter(rec => {
    const q = search.trim().toLowerCase();
    if (q && !`${rec.name} ${rec.type} ${rec.phone || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const downloadTemplate = () => {
    const exampleRow = {
      'Name': 'Acme LLC', 'Type': 'LLC', 'Add Date': '2026-01-01',
      'Account Number': 'GE29TB...', 'Address': '123 Main St', 'Phone': '+995 555 000000'
    };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agents');
    XLSX.writeFile(wb, 'Agents_Import_Template.xlsx');
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
    if (!isNaN(parsed.getTime()))
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    return str;
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
          name: String(row['Name'] || '').trim(),
          type: String(row['Type'] || 'Other').trim(),
          add_date: formatExcelDate(row['Add Date']),
          account_number: String(row['Account Number'] || '').trim(),
          address: String(row['Address'] || '').trim(),
          phone: String(row['Phone'] || '').trim(),
          _valid: true,
        }));
        mapped.forEach((row) => {
          if (!row.name) { row._valid = false; row._missing = ['Name']; }
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
    const valid = rows.filter(r => r._valid).map(({ _valid, _missing, ...rest }) => rest);
    if (valid.length === 0) { setError('No valid rows to import.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/accounting/agents/bulk', { records: valid });
      setSuccess(`Successfully imported ${res.data.inserted} agent(s).`);
      setRows([]); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      loadRecords();
      setTimeout(() => setSubTab('records'), 800);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save agents.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this agent?')) return;
    try { await api.delete(`/accounting/agents/${id}`); loadRecords(); }
    catch { setError('Failed to delete.'); }
  };

  const startEdit = (rec) => {
    setEditId(rec.id);
    setEditForm({ name: rec.name || '', type: rec.type || 'LLC', add_date: rec.add_date || '', account_number: rec.account_number || '', address: rec.address || '', phone: rec.phone || '' });
  };

  const handleUpdate = async () => {
    try { await api.put(`/accounting/agents/${editId}`, editForm); setEditId(null); loadRecords(); }
    catch { setError('Failed to update.'); }
  };

  const validCount = rows.filter(r => r._valid).length;
  const invalidCount = rows.filter(r => !r._valid).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Import Agents</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>Bulk import agent records from an Excel file</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface-3)', borderRadius: 20, padding: '3px 10px' }}>
            {records.length} records
          </div>
        </div>

        {/* Sub-tab bar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-3)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {[
              { key: 'import', label: 'Import Agents' },
              { key: 'records', label: `Saved Records${records.length ? ` (${records.length})` : ''}` },
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

        {error && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{success}</div>}

        {/* ── IMPORT TAB ── */}
        {subTab === 'import' && (
          <div style={{ padding: '8px 0' }}>
            {/* Step 1 */}
            <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', borderBottom: '1px solid var(--border-3)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>1</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Download Template</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Get the Excel template with the correct column format.</div>
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
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Upload your file</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Fill in the template and upload it here.</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? '#0369a1' : fileName ? '#7dd3fc' : 'var(--border-2)'}`,
                    borderRadius: 10, padding: '20px 24px', textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? '#f0f9ff' : fileName ? '#f0f9ff' : 'var(--surface-2)',
                    transition: 'all 0.15s',
                  }}
                >
                  {fileName ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>{fileName}</span>
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
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>3</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Review & Import</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 12px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: 12, border: '1px solid #bbf7d0' }}>{validCount} valid</span>
                    {invalidCount > 0 && <span style={{ padding: '3px 12px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 12, border: '1px solid #fca5a5' }}>{invalidCount} invalid</span>}
                    <span style={{ padding: '3px 12px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-3)', fontWeight: 600, fontSize: 12, border: '1px solid var(--border-2)' }}>{rows.length} total</span>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-2)', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['#', 'Name', 'Type', 'Add Date', 'Account Number', 'Address', 'Phone', 'Status'].map((h, i) => (
                            <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} style={{ background: row._valid ? (i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)') : '#fef2f2' }}>
                            <td style={{ padding: '7px 10px', color: 'var(--text-4)' }}>{i + 1}</td>
                            <td style={{ padding: '7px 10px', color: !row.name ? '#dc2626' : 'var(--text)', fontWeight: 600 }}>{row.name || '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{row.type || '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{row.add_date || '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{row.account_number || '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{row.address || '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{row.phone || '—'}</td>
                            <td style={{ padding: '7px 10px' }}>
                              {row._valid
                                ? <span style={{ padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: 11, border: '1px solid #bbf7d0' }}>OK</span>
                                : <span title={row._missing?.join(', ')} style={{ padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 11, border: '1px solid #fca5a5', cursor: 'help' }}>Missing: {row._missing?.join(', ')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={handleSave} disabled={saving || validCount === 0} style={{
                    padding: '10px 24px', background: saving || validCount === 0 ? 'var(--surface-3)' : '#0369a1',
                    color: saving || validCount === 0 ? 'var(--text-4)' : '#fff',
                    border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    cursor: saving || validCount === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}>
                    {saving ? 'Saving…' : `Import ${validCount} Agent${validCount !== 1 ? 's' : ''}`}
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
                <input type="text" placeholder="Search name, type, phone…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}
                  onFocus={e => e.target.style.borderColor = '#0369a1'} onBlur={e => e.target.style.borderColor = 'var(--border-2)'} />
              </div>
              {search && (
                <button onClick={() => setSearch('')} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
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
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>No agents imported yet</div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 14 }}>No records match your search.</div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Name', 'Type', 'Add Date', 'Account Number', 'Address', 'Phone', ''].map((h, i) => (
                        <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((rec, i) => (
                      <tr key={rec.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        {editId === rec.id ? (
                          <>
                            <td style={{ padding: '6px 8px' }}><input style={INPUT_STYLE} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                            <td style={{ padding: '6px 8px' }}>
                              <select style={INPUT_STYLE} value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                                {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '6px 8px' }}><input style={INPUT_STYLE} type="date" value={editForm.add_date} onChange={e => setEditForm({ ...editForm, add_date: e.target.value })} /></td>
                            <td style={{ padding: '6px 8px' }}><input style={INPUT_STYLE} value={editForm.account_number} onChange={e => setEditForm({ ...editForm, account_number: e.target.value })} /></td>
                            <td style={{ padding: '6px 8px' }}><input style={INPUT_STYLE} value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></td>
                            <td style={{ padding: '6px 8px' }}><input style={INPUT_STYLE} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                            <td style={{ padding: '6px 8px', display: 'flex', gap: 6 }}>
                              <button onClick={handleUpdate} style={{ padding: '5px 10px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                              <button onClick={() => setEditId(null)} style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text)' }}>{rec.name}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-3)' }}>{rec.type}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-3)' }}>{rec.add_date || '—'}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-3)', fontSize: 11 }}>{rec.account_number || '—'}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-3)' }}>{rec.address || '—'}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-3)' }}>{rec.phone || '—'}</td>
                            <td style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
                              <button onClick={() => startEdit(rec)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#0369a1'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>
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
        )}

      </div>
    </div>
  );
}

export default AgentsImport;
