import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const MEMBER_TYPES = ['Gym', 'Insurance', 'Pension', 'Custom'];

function MemberBenefits({ employeeId }) {
  const { t } = useLanguage();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [type, setType] = useState('Gym');
  const [customName, setCustomName] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Bulk import state
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/employees/${employeeId}/members`);
      setMembers(response.data.members);
    } catch (err) {
      setError(t('mb.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.post(`/employees/${employeeId}/members`, {
        type,
        custom_name: type === 'Custom' ? customName : null,
        amount: parseFloat(amount),
        effective_date: effectiveDate
      });
      setSuccess(t('mb.success'));
      setCustomName('');
      setAmount('');
      setEffectiveDate('');
      setType('Gym');
      loadMembers();
    } catch (err) {
      setError(err.response?.data?.error || t('mb.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memberId) => {
    if (!window.confirm(t('mb.deleteConfirm'))) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/members/${memberId}`);
      setSuccess(t('mb.deleted'));
      loadMembers();
    } catch (err) {
      setError(t('mb.deleteFailed'));
    }
  };

  // ===== Bulk Import =====
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

  const downloadTemplate = () => {
    const exampleRows = [
      { 'Type': 'Gym', 'Custom Name': '', 'Amount': 50, 'Date': '2025-01-01' },
      { 'Type': 'Insurance', 'Custom Name': '', 'Amount': 120, 'Date': '2025-01-01' },
      { 'Type': 'Custom', 'Custom Name': 'Parking', 'Amount': 30, 'Date': '2025-02-01' },
    ];
    const ws = XLSX.utils.json_to_sheet(exampleRows, { header: ['Type', 'Custom Name', 'Amount', 'Date'] });
    ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'Members_Import_Template.xlsx');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const mapped = data.map((row) => {
          const rowType = String(row['Type'] || '').trim();
          const rowCustomName = String(row['Custom Name'] || '').trim();
          const rowAmount = row['Amount'];
          const rowDate = formatExcelDate(row['Date']);

          const missing = [];
          if (!rowType) missing.push('Type');
          if (rowAmount === '' || rowAmount === undefined || rowAmount === null) missing.push('Amount');
          if (!rowDate) missing.push('Date');
          if (rowType === 'Custom' && !rowCustomName) missing.push('Custom Name');

          return {
            type: rowType,
            custom_name: rowCustomName,
            amount: rowAmount,
            effective_date: rowDate,
            _valid: missing.length === 0,
            _missing: missing,
          };
        });

        setImportRows(mapped);
      } catch (err) {
        setError(t('mb.parseFailed') + err.message);
        setImportRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const validRows = importRows
      .filter((r) => r._valid)
      .map(({ _valid, _missing, ...rest }) => rest);

    if (validRows.length === 0) {
      setError(t('mb.noValidRows'));
      return;
    }

    setImporting(true);
    setError('');
    setImportResult(null);

    try {
      const response = await api.post(`/employees/${employeeId}/members/import`, { members: validRows });
      setImportResult(response.data);
      if (response.data.imported > 0) {
        setImportRows([]);
        setImportFileName('');
        if (fileRef.current) fileRef.current.value = '';
        loadMembers();
      }
    } catch (err) {
      setError(err.response?.data?.error || t('mb.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const importValidCount = importRows.filter((r) => r._valid).length;
  const importInvalidCount = importRows.filter((r) => !r._valid).length;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  const getDisplayName = (member) => {
    if (member.type === 'Custom' && member.custom_name) {
      return member.custom_name;
    }
    return member.type;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getTypeIcon = (memberType) => {
    switch (memberType) {
      case 'Gym': return '🏋️';
      case 'Insurance': return '🛡️';
      case 'Pension': return '🏦';
      default: return '📌';
    }
  };

  const totalAmount = members.reduce((sum, m) => sum + parseFloat(m.amount), 0);

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>{t('mb.title')}</h3>
        <p>{t('mb.subtitle')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* Add Member Form */}
      <div className="sc-form-card">
        <h4>{t('mb.addNew')}</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>{t('mb.type')}</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="form-select">
                {MEMBER_TYPES.map((mt) => (
                  <option key={mt} value={mt}>{mt}</option>
                ))}
              </select>
            </div>
            {type === 'Custom' && (
              <div className="form-group">
                <label>{t('mb.customName')}</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={t('mb.customPlaceholder')}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>{t('mb.amount')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50.00"
                required
              />
            </div>
            <div className="form-group">
              <label>{t('mb.date')}</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? t('mb.adding') : t('mb.addBtn')}
          </button>
        </form>
      </div>

      {/* Bulk Import */}
      <div className="sc-form-card" style={{ marginTop: '16px' }}>
        <h4>{t('mb.bulkImport')}</h4>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '14px' }}>
          {t('mb.bulkDesc')}
        </p>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
          <button className="btn-secondary btn-sm" onClick={downloadTemplate} type="button">
            {t('mb.downloadTemplate')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            id={`member-excel-upload-${employeeId}`}
            style={{ display: 'none' }}
          />
          <label htmlFor={`member-excel-upload-${employeeId}`} className="btn-primary btn-sm" style={{ cursor: 'pointer' }}>
            {t('mb.chooseFile')}
          </label>
          {importFileName && <span style={{ fontSize: '13px', color: '#444' }}>{importFileName}</span>}
        </div>

        {importResult && (
          <div className="msg-success" style={{ marginBottom: '14px' }}>
            {t('mb.imported', { count: importResult.imported, s: importResult.imported !== 1 ? 's' : '' })}
            {importResult.errors?.length > 0 && (
              <span> {t('mb.rowsSkipped', { count: importResult.errors.length, s: importResult.errors.length !== 1 ? 's' : '' })}</span>
            )}
          </div>
        )}

        {importRows.length > 0 && (
          <>
            <div className="import-stats" style={{ marginBottom: '12px' }}>
              <span className="import-stat-valid">{t('mb.valid', { count: importValidCount })}</span>
              {importInvalidCount > 0 && <span className="import-stat-invalid">{t('mb.invalid', { count: importInvalidCount })}</span>}
              <span className="import-stat-total">{t('mb.totalRows', { count: importRows.length })}</span>
            </div>

            <div className="import-preview-wrapper" style={{ marginBottom: '14px' }}>
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Custom Name</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className={row._valid ? '' : 'import-row-invalid'}>
                      <td>{i + 1}</td>
                      <td className={!row.type ? 'import-cell-missing' : ''}>{row.type}</td>
                      <td>{row.custom_name || '—'}</td>
                      <td className={row.amount === '' || row.amount === undefined ? 'import-cell-missing' : ''}>{row.amount}</td>
                      <td className={!row.effective_date ? 'import-cell-missing' : ''}>{row.effective_date}</td>
                      <td>
                        {row._valid ? (
                          <span className="import-badge-ok">{t('mb.ok')}</span>
                        ) : (
                          <span className="import-badge-err" title={`Missing: ${row._missing.join(', ')}`}>{t('mb.missing')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              className="btn-primary btn-sm"
              onClick={handleImport}
              disabled={importing || importValidCount === 0}
            >
              {importing ? t('mb.importing') : t('mb.importBtn', { count: importValidCount, s: importValidCount !== 1 ? 's' : '' })}
            </button>
          </>
        )}
      </div>

      {/* Members List */}
      {loading ? (
        <div className="emp-loading">{t('mb.loading')}</div>
      ) : members.length === 0 ? (
        <div className="sc-empty">{t('mb.noMembers')}</div>
      ) : (
        <>
          <div className="members-list">
            {members.map((member) => (
              <div key={member.id} className="member-card">
                <div className="member-icon">{getTypeIcon(member.type)}</div>
                <div className="member-info">
                  <span className="member-name">{getDisplayName(member)}</span>
                  {member.type === 'Custom' && <span className="member-type-badge">{t('mb.custom')}</span>}
                  {member.effective_date && <span className="member-date">{formatDate(member.effective_date)}</span>}
                </div>
                <div className="member-amount">{formatCurrency(member.amount)}</div>
                <button
                  onClick={() => handleDelete(member.id)}
                  className="btn-icon btn-delete"
                  title={t('action.delete')}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <div className="members-total">
            <span>{t('mb.total')}</span>
            <span className="members-total-amount">{formatCurrency(totalAmount)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default MemberBenefits;
