import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const TEMPLATE_COLUMNS = [
  'First Name', 'Last Name', 'Personal ID', 'Birthdate',
  'Position', 'Salary', 'OT Rate', 'Start Date', 'End Date', 'Account Number', 'Pension'
];

function ImportEmployees() {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const downloadTemplate = () => {
    const exampleRow = {
      'First Name': 'John', 'Last Name': 'Doe', 'Personal ID': '01234567890',
      'Birthdate': '1990-05-15', 'Position': 'Developer', 'Salary': 3000,
      'OT Rate': 25, 'Start Date': '2025-01-01', 'End Date': '',
      'Account Number': 'GE29TB7894545082100008', 'Pension': 'Yes'
    };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });
    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 14 },
      { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'Employee_Import_Template.xlsx');
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

  const processFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const mapped = data.map((row) => ({
          first_name: row['First Name'] || '',
          last_name: row['Last Name'] || '',
          personal_id: String(row['Personal ID'] || ''),
          birthdate: formatExcelDate(row['Birthdate']),
          position: row['Position'] || '',
          salary: row['Salary'] || '',
          overtime_rate: row['OT Rate'] || '',
          start_date: formatExcelDate(row['Start Date']),
          end_date: formatExcelDate(row['End Date']),
          account_number: row['Account Number'] || '',
          pension: row['Pension'] ? String(row['Pension']).toLowerCase().trim() === 'yes' : false,
          _valid: true
        }));
        mapped.forEach((row) => {
          const missing = [];
          if (!row.first_name) missing.push('First Name');
          if (!row.last_name) missing.push('Last Name');
          if (!row.personal_id) missing.push('Personal ID');
          if (!row.birthdate) missing.push('Birthdate');
          if (!row.position) missing.push('Position');
          if (!row.salary && row.salary !== 0) missing.push('Salary');
          if (!row.overtime_rate && row.overtime_rate !== 0) missing.push('OT Rate');
          if (!row.start_date) missing.push('Start Date');
          if (missing.length > 0) { row._valid = false; row._missing = missing; }
        });
        setRows(mapped);
      } catch (err) {
        setError(t('import.parseFailed') + err.message);
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) processFile(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r._valid).map(({ _valid, _missing, ...rest }) => rest);
    if (validRows.length === 0) { setError(t('import.noValidRows')); return; }
    setImporting(true); setError(''); setResult(null);
    try {
      const response = await api.post('/employees/import', { employees: validRows });
      setResult(response.data);
      if (response.data.imported > 0) {
        setRows([]); setFileName('');
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch (err) {
      setError(err.response?.data?.error || t('import.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header card */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '20px 24px', background: '#fafbfc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{t('import.title')}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{t('import.desc')}</div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}
        {result && (
          <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {t('import.success').replace('{count}', result.imported).replace('{s}', result.imported !== 1 ? 's' : '')}
            {result.errors?.length > 0 && <span style={{ fontWeight: 400, color: '#15803d' }}> · {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped</span>}
          </div>
        )}

        {/* Steps */}
        <div style={{ padding: '8px 0' }}>

          {/* Step 1 */}
          <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', borderBottom: '1px solid #f8fafc' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>1</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{t('import.step1Title')}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{t('import.step1Desc')}</div>
              <button onClick={downloadTemplate} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', background: '#f0fdf4', color: '#16a34a',
                border: '1.5px solid #bbf7d0', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="12" y1="12" x2="12" y2="18"/><polyline points="9,15 12,18 15,15"/>
                </svg>
                {t('import.downloadTemplate')}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', borderBottom: rows.length > 0 ? '1px solid #f8fafc' : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>2</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{t('import.step2Title')}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{t('import.step2Desc')}</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} id="excel-upload" style={{ display: 'none' }} />
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? '#3b82f6' : fileName ? '#86efac' : '#e2e8f0'}`,
                  borderRadius: 10, padding: '20px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#eff6ff' : fileName ? '#f0fdf4' : '#fafbfc',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!dragOver) e.currentTarget.style.borderColor = '#94a3b8'; }}
                onMouseLeave={e => { if (!dragOver) e.currentTarget.style.borderColor = fileName ? '#86efac' : '#e2e8f0'; }}
              >
                {fileName ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{fileName}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>· click to replace</span>
                  </div>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>{t('import.chooseFile')}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>or drag & drop .xlsx / .xls</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Step 3 – preview */}
          {rows.length > 0 && (
            <div style={{ padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>3</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{t('import.step3Title')}</div>

                {/* Stats pills */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 12px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: 12, border: '1px solid #bbf7d0' }}>
                    {validCount} valid
                  </span>
                  {invalidCount > 0 && (
                    <span style={{ padding: '3px 12px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 12, border: '1px solid #fca5a5' }}>
                      {invalidCount} invalid
                    </span>
                  )}
                  <span style={{ padding: '3px 12px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 12 }}>
                    {rows.length} total
                  </span>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['#', t('import.firstName'), t('import.lastName'), t('import.personalId'), t('import.birthdate'), t('import.position'), t('import.salary'), t('import.otRate'), t('import.startDate'), t('import.endDate'), t('import.account'), 'Pension', t('import.status')].map((h, i) => (
                          <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} style={{ background: row._valid ? (i % 2 === 0 ? '#fff' : '#fafbfc') : '#fef2f2' }}>
                          <td style={{ padding: '7px 10px', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</td>
                          <td style={{ padding: '7px 10px', color: !row.first_name ? '#dc2626' : '#1e293b' }}>{row.first_name || '—'}</td>
                          <td style={{ padding: '7px 10px', color: !row.last_name ? '#dc2626' : '#1e293b' }}>{row.last_name || '—'}</td>
                          <td style={{ padding: '7px 10px', color: !row.personal_id ? '#dc2626' : '#1e293b' }}>{row.personal_id || '—'}</td>
                          <td style={{ padding: '7px 10px', color: !row.birthdate ? '#dc2626' : '#1e293b' }}>{row.birthdate || '—'}</td>
                          <td style={{ padding: '7px 10px', color: !row.position ? '#dc2626' : '#1e293b' }}>{row.position || '—'}</td>
                          <td style={{ padding: '7px 10px', color: !row.salary && row.salary !== 0 ? '#dc2626' : '#1e293b' }}>{row.salary}</td>
                          <td style={{ padding: '7px 10px', color: !row.overtime_rate && row.overtime_rate !== 0 ? '#dc2626' : '#1e293b' }}>{row.overtime_rate}</td>
                          <td style={{ padding: '7px 10px', color: !row.start_date ? '#dc2626' : '#1e293b' }}>{row.start_date || '—'}</td>
                          <td style={{ padding: '7px 10px', color: '#64748b' }}>{row.end_date || '—'}</td>
                          <td style={{ padding: '7px 10px', color: '#64748b' }}>{row.account_number || '—'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', color: row.pension ? '#16a34a' : '#94a3b8' }}>{row.pension ? '✔' : '—'}</td>
                          <td style={{ padding: '7px 10px' }}>
                            {row._valid ? (
                              <span style={{ padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: 11, border: '1px solid #bbf7d0' }}>{t('import.ok')}</span>
                            ) : (
                              <span title={`Missing: ${row._missing?.join(', ')}`} style={{ padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 11, border: '1px solid #fca5a5', cursor: 'help' }}>{t('import.missingFields')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Import button */}
                <button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                  style={{
                    marginTop: 16, padding: '10px 24px',
                    background: importing || validCount === 0 ? '#e2e8f0' : '#1e293b',
                    color: importing || validCount === 0 ? '#94a3b8' : '#fff',
                    border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    cursor: importing || validCount === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (validCount > 0 && !importing) e.currentTarget.style.background = '#334155'; }}
                  onMouseLeave={e => { if (validCount > 0 && !importing) e.currentTarget.style.background = '#1e293b'; }}
                >
                  {importing ? t('import.importing') : t('import.importBtn').replace('{count}', validCount).replace('{s}', validCount !== 1 ? 's' : '')}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default ImportEmployees;
