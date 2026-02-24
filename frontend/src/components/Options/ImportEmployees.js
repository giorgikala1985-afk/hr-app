import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const TEMPLATE_COLUMNS = [
  'First Name', 'Last Name', 'Personal ID', 'Birthdate',
  'Position', 'Salary', 'OT Rate', 'Start Date', 'End Date', 'Account Number'
];

const REQUIRED_FIELDS = ['First Name', 'Last Name', 'Personal ID', 'Birthdate', 'Position', 'Salary', 'OT Rate', 'Start Date'];

function ImportEmployees() {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const downloadTemplate = () => {
    const exampleRow = {
      'First Name': 'John',
      'Last Name': 'Doe',
      'Personal ID': '01234567890',
      'Birthdate': '1990-05-15',
      'Position': 'Developer',
      'Salary': 3000,
      'OT Rate': 25,
      'Start Date': '2025-01-01',
      'End Date': '',
      'Account Number': 'GE29TB7894545082100008'
    };

    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });

    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 14 },
      { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 28 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'Employee_Import_Template.xlsx');
  };

  const formatExcelDate = (value) => {
    if (!value) return '';
    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        const y = date.y;
        const m = String(date.m).padStart(2, '0');
        const d = String(date.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    // If it's already a string, try to normalize
    const str = String(value).trim();
    // Check if it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // Try parsing as Date
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return str;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
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
          _valid: true
        }));

        // Validate
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
          if (missing.length > 0) {
            row._valid = false;
            row._missing = missing;
          }
        });

        setRows(mapped);
      } catch (err) {
        setError(t('import.parseFailed') + err.message);
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r._valid).map(({ _valid, _missing, ...rest }) => rest);

    if (validRows.length === 0) {
      setError(t('import.noValidRows'));
      return;
    }

    setImporting(true);
    setError('');
    setResult(null);

    try {
      const response = await api.post('/employees/import', { employees: validRows });
      setResult(response.data);
      if (response.data.imported > 0) {
        setRows([]);
        setFileName('');
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
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>{t('import.title')}</h3>
        <p>{t('import.desc')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {result && (
        <div className="msg-success">
          {t('import.success').replace('{count}', result.imported).replace('{s}', result.imported !== 1 ? 's' : '')}
          {result.errors && result.errors.length > 0 && (
            <span> {t('import.rowsSkipped').replace('{count}', result.errors.length).replace('{s}', result.errors.length !== 1 ? 's' : '')}</span>
          )}
        </div>
      )}

      {/* Step 1: Download Template */}
      <div className="import-step">
        <div className="import-step-num">1</div>
        <div className="import-step-content">
          <h4>{t('import.step1Title')}</h4>
          <p>{t('import.step1Desc')}</p>
          <button className="btn-excel" onClick={downloadTemplate}>
            <span className="excel-icon">&#x1F4E5;</span> {t('import.downloadTemplate')}
          </button>
        </div>
      </div>

      {/* Step 2: Upload File */}
      <div className="import-step">
        <div className="import-step-num">2</div>
        <div className="import-step-content">
          <h4>{t('import.step2Title')}</h4>
          <p>{t('import.step2Desc')}</p>
          <div className="import-file-input">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              id="excel-upload"
            />
            <label htmlFor="excel-upload" className="btn-upload">
              {t('import.chooseFile')}
            </label>
            {fileName && <span className="import-filename">{fileName}</span>}
          </div>
        </div>
      </div>

      {/* Step 3: Preview & Import */}
      {rows.length > 0 && (
        <div className="import-step">
          <div className="import-step-num">3</div>
          <div className="import-step-content">
            <h4>{t('import.step3Title')}</h4>
            <div className="import-stats">
              <span className="import-stat-valid">{t('import.valid').replace('{count}', validCount)}</span>
              {invalidCount > 0 && <span className="import-stat-invalid">{t('import.invalid').replace('{count}', invalidCount)}</span>}
              <span className="import-stat-total">{t('import.totalRows').replace('{count}', rows.length)}</span>
            </div>

            <div className="import-preview-wrapper">
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('import.firstName')}</th>
                    <th>{t('import.lastName')}</th>
                    <th>{t('import.personalId')}</th>
                    <th>{t('import.birthdate')}</th>
                    <th>{t('import.position')}</th>
                    <th>{t('import.salary')}</th>
                    <th>{t('import.otRate')}</th>
                    <th>{t('import.startDate')}</th>
                    <th>{t('import.endDate')}</th>
                    <th>{t('import.account')}</th>
                    <th>{t('import.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={row._valid ? '' : 'import-row-invalid'}>
                      <td>{i + 1}</td>
                      <td className={!row.first_name ? 'import-cell-missing' : ''}>{row.first_name}</td>
                      <td className={!row.last_name ? 'import-cell-missing' : ''}>{row.last_name}</td>
                      <td className={!row.personal_id ? 'import-cell-missing' : ''}>{row.personal_id}</td>
                      <td className={!row.birthdate ? 'import-cell-missing' : ''}>{row.birthdate}</td>
                      <td className={!row.position ? 'import-cell-missing' : ''}>{row.position}</td>
                      <td className={!row.salary && row.salary !== 0 ? 'import-cell-missing' : ''}>{row.salary}</td>
                      <td className={!row.overtime_rate && row.overtime_rate !== 0 ? 'import-cell-missing' : ''}>{row.overtime_rate}</td>
                      <td className={!row.start_date ? 'import-cell-missing' : ''}>{row.start_date}</td>
                      <td>{row.end_date || '—'}</td>
                      <td>{row.account_number || '—'}</td>
                      <td>
                        {row._valid ? (
                          <span className="import-badge-ok">{t('import.ok')}</span>
                        ) : (
                          <span className="import-badge-err" title={`${t('import.missingFields')}: ${row._missing.join(', ')}`}>{t('import.missingFields')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              className="btn-primary btn-import"
              onClick={handleImport}
              disabled={importing || validCount === 0}
            >
              {importing ? t('import.importing') : t('import.importBtn').replace('{count}', validCount).replace('{s}', validCount !== 1 ? 's' : '')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportEmployees;
