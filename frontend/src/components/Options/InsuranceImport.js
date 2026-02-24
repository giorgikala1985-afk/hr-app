import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/LanguageContext';

const TEMPLATE_COLUMNS = ['Name', 'Last Name', 'ID', 'Amount 1', 'Amount 2', 'Date'];

function InsuranceImport() {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const downloadTemplate = () => {
    const exampleRow = {
      'Name': 'John',
      'Last Name': 'Doe',
      'ID': '01234567890',
      'Amount 1': 100,
      'Amount 2': 50,
      'Date': '2026-02-01'
    };

    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });
    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Insurance');
    XLSX.writeFile(wb, 'Insurance_Import_Template.xlsx');
  };

  const formatExcelDate = (value) => {
    if (!value) return '';
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
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
          id: String(row['ID'] || ''),
          amount1: row['Amount 1'] || '',
          amount2: row['Amount 2'] || '',
          date: formatExcelDate(row['Date']),
          _valid: true
        }));

        mapped.forEach((row) => {
          const missing = [];
          if (!row.name) missing.push('Name');
          if (!row.last_name) missing.push('Last Name');
          if (!row.id) missing.push('ID');
          if (!row.amount1 && row.amount1 !== 0) missing.push('Amount 1');
          if (!row.date) missing.push('Date');
          if (missing.length > 0) {
            row._valid = false;
            row._missing = missing;
          }
        });

        setRows(mapped);
      } catch (err) {
        setError(t('insImport.parseFailed') + err.message);
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
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

      {/* Step 1: Download Template */}
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

      {/* Step 2: Upload File */}
      <div className="import-step">
        <div className="import-step-num">2</div>
        <div className="import-step-content">
          <h4>{t('insImport.step2Title')}</h4>
          <p>{t('insImport.step2Desc')}</p>
          <div className="import-file-input">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              id="insurance-excel-upload"
            />
            <label htmlFor="insurance-excel-upload" className="btn-upload">
              {t('insImport.chooseFile')}
            </label>
            {fileName && <span className="import-filename">{fileName}</span>}
          </div>
        </div>
      </div>

      {/* Step 3: Preview */}
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
                      <td className={!row.id ? 'import-cell-missing' : ''}>{row.id}</td>
                      <td className={!row.amount1 && row.amount1 !== 0 ? 'import-cell-missing' : ''}>{row.amount1}</td>
                      <td>{row.amount2 || '—'}</td>
                      <td className={!row.date ? 'import-cell-missing' : ''}>{row.date}</td>
                      <td>
                        {row._valid ? (
                          <span className="import-badge-ok">{t('insImport.ok')}</span>
                        ) : (
                          <span className="import-badge-err" title={row._missing?.join(', ')}>{t('insImport.missing')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InsuranceImport;
