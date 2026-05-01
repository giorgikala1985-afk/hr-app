import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/LanguageContext';

const FONT_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';

function SalariesFile({ data, onClear }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (data?.rows) setRows(data.rows.map(r => ({ ...r })));
  }, [data]);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const exportToExcel = () => {
    const headers = [t('salFile.colName'), t('salFile.colLastName'), t('salFile.colIban'), t('salFile.colAmount'), t('salFile.colDescription')];
    const wsData = [
      headers,
      ...rows.map(r => [r.first_name, r.last_name, r.iban, parseFloat(r.amount || 0), r.description]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary File');
    XLSX.writeFile(wb, data?.month ? `salary-file-${data.month}.xlsx` : 'salary-file.xlsx');
  };

  if (!data) {
    return (
      <div>
        <h2>{t('salFile.title')}</h2>
        <p className="acc-subtitle">{t('salFile.subtitle')}</p>
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{t('salFile.noFile')}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{t('salFile.hint')}</div>
        </div>
      </div>
    );
  }

  const totalAmount = rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('salFile.title')}</h2>
        {data.transferDate && (
          <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>
            {t('salFile.transferDate')} <strong style={{ color: 'var(--text)' }}>{data.transferDate}</strong>
          </span>
        )}
        {data.rate && (
          <span style={{ fontSize: 12, fontFamily: FONT_MONO, color: '#f59e0b', fontWeight: 700 }}>
            1 USD = ₾{data.rate.toFixed(4)}
          </span>
        )}
        {data.month && (
          <span style={{ fontSize: 12, color: 'var(--text-4)', background: 'var(--surface-2)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border-2)' }}>
            {data.month}
          </span>
        )}
      </div>
      <p className="acc-subtitle">{t('salFile.rateNote')}</p>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        <button onClick={exportToExcel} disabled={rows.length === 0} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          background: 'var(--surface)', border: '1.5px solid var(--border-2)', borderRadius: 7,
          fontSize: 13, fontWeight: 500, color: '#16a34a',
          cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
          opacity: rows.length === 0 ? 0.5 : 1, fontFamily: 'inherit',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {t('salFile.excel')}
        </button>
        {onClear && (
          <button onClick={() => { if (window.confirm(t('salFile.clearConfirm'))) onClear(); }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'var(--surface)', border: '1.5px solid #fca5a5', borderRadius: 7,
            fontSize: 13, fontWeight: 500, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            {t('salFile.clear')}
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-2)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 140 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 220 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {[[t('salFile.colName'), 'left'], [t('salFile.colLastName'), 'left'], [t('salFile.colIban'), 'left'], [t('salFile.colAmount'), 'right'], [t('salFile.colDescription'), 'left']].map(([h, align], i) => (
                <th key={i} style={{ padding: '10px 14px', textAlign: align, fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-3)' }}>
                {/* Name — read-only */}
                <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {r.first_name}
                </td>
                {/* Last Name — read-only */}
                <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {r.last_name}
                </td>
                {/* IBAN — editable inline */}
                <td style={{ padding: '4px 8px', overflow: 'hidden' }}>
                  <input
                    value={r.iban}
                    onChange={e => updateRow(idx, 'iban', e.target.value)}
                    placeholder="GE00 0000 0000 0000 0000 00"
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '5px 8px',
                      border: r.iban ? '1px solid var(--border-2)' : '1px dashed var(--border-2)',
                      borderRadius: 5, fontSize: 12, outline: 'none',
                      fontFamily: FONT_MONO, background: 'transparent', color: 'var(--text)',
                      letterSpacing: '0.3px',
                    }}
                  />
                </td>
                {/* Amount — read-only */}
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: FONT_MONO, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  ₾{parseFloat(r.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                {/* Description — editable inline */}
                <td style={{ padding: '4px 8px', overflow: 'hidden' }}>
                  <input
                    value={r.description}
                    onChange={e => updateRow(idx, 'description', e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '5px 8px',
                      border: '1px solid var(--border-2)', borderRadius: 5, fontSize: 12,
                      outline: 'none', fontFamily: 'inherit', background: 'transparent', color: 'var(--text)',
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-2)' }}>
              <td colSpan={3} style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', fontWeight: 700 }}>{t('salFile.total')}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                ₾{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default SalariesFile;
