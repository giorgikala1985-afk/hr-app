import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const TEMPLATE_COLUMNS = ['Name', 'Last Name', 'ID', 'Amount 1', 'Amount 2', 'Date'];

function InsuranceImport() {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await api.get('/insurance-list');
      setRecords(res.data.records || []);
    } catch (err) {
      console.error('Failed to load insurance records');
    } finally {
      setLoadingRecords(false);
    }
  };

  const downloadTemplate = () => {
    const exampleRow = {
      'Name': 'John', 'Last Name': 'Doe', 'ID': '01234567890',
      'Amount 1': 100, 'Amount 2': 50, 'Date': '2026-02-01'
    };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
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
    setError('');
    setSuccess('');
    setRows([]);
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
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/insurance-list/bulk', { records: valid });
      setSuccess(t('insImport.saved').replace('{count}', res.data.inserted));
      setRows([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      loadRecords();
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
    } catch (err) {
      setError(t('insImport.deleteFailed'));
    }
  };

  const startEdit = (rec) => {
    setEditId(rec.id);
    setEditForm({ name: rec.name, last_name: rec.last_name, personal_id: rec.personal_id, amount1: rec.amount1, amount2: rec.amount2 || '', date: rec.date });
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/insurance-list/${editId}`, editForm);
      setEditId(null);
      loadRecords();
    } catch (err) {
      setError(t('insImport.updateFailed'));
    }
  };

  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>{t('insImport.title')}</h3>
        <p>{t('insImport.desc')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

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

      {/* Saved Records */}
      <div style={{ marginTop: 32 }}>
        <h4 style={{ marginBottom: 12 }}>{t('insImport.savedTitle')}</h4>
        {loadingRecords ? (
          <div style={{ color: '#888' }}>{t('insImport.loading')}</div>
        ) : records.length === 0 ? (
          <div className="ut-empty">{t('insImport.noRecords')}</div>
        ) : (
          <div className="import-preview-wrapper">
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>{t('insImport.colName')}</th>
                  <th>{t('insImport.colLastName')}</th>
                  <th>{t('insImport.colId')}</th>
                  <th>{t('insImport.colAmount1')}</th>
                  <th>{t('insImport.colAmount2')}</th>
                  <th>{t('insImport.colDate')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    {editId === rec.id ? (
                      <>
                        <td><input className="ut-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                        <td><input className="ut-input" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></td>
                        <td><input className="ut-input" value={editForm.personal_id} onChange={(e) => setEditForm({ ...editForm, personal_id: e.target.value })} /></td>
                        <td><input className="ut-input" type="number" value={editForm.amount1} onChange={(e) => setEditForm({ ...editForm, amount1: e.target.value })} /></td>
                        <td><input className="ut-input" type="number" value={editForm.amount2} onChange={(e) => setEditForm({ ...editForm, amount2: e.target.value })} /></td>
                        <td><input className="ut-input" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-primary btn-sm" onClick={handleUpdate}>{t('insImport.save')}</button>
                          <button className="ut-cancel-btn" onClick={() => setEditId(null)}>{t('insImport.cancel')}</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{rec.name}</td>
                        <td>{rec.last_name}</td>
                        <td>{rec.personal_id}</td>
                        <td>{rec.amount1}</td>
                        <td>{rec.amount2 || '—'}</td>
                        <td>{rec.date}</td>
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
      </div>
    </div>
  );
}

export default InsuranceImport;
