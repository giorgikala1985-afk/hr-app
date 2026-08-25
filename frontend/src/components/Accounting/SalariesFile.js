import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoneyBag01Icon } from '@hugeicons/core-free-icons';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../services/api';

const FONT_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';

function SalariesFile({ data, onClear, onSent }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSummary, setSendSummary] = useState(null);

  useEffect(() => {
    if (data?.rows) setRows(data.rows.map(r => ({ ...r })));
    setSendError(''); setSendSummary(null);
  }, [data]);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const exportToExcel = () => {
    const headersKa = ['მიმღების ანგარიში', 'მიმღების სახელი და გვარი', 'თანხა', 'დანიშნულება'];
    const headersEn = ['Account Number', "Employee's Name", 'Amount', 'Description'];
    const wsData = [
      headersKa,
      headersEn,
      ...rows.map(r => [r.iban, `${r.first_name || ''} ${r.last_name || ''}`.trim(), parseFloat(r.amount || 0), r.description]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary File');
    XLSX.writeFile(wb, data?.month ? `salary-file-${data.month}.xlsx` : 'salary-file.xlsx');
  };

  const sendToTransfers = async () => {
    if (data?.sentToTransfers) {
      if (!window.confirm(t('salFile.resendConfirm'))) return;
    }
    setSending(true); setSendError(''); setSendSummary(null);

    const batchTag = `SALARY-${data.month}`;
    const dueDate = data.transferDate || new Date().toISOString().slice(0, 10);
    const ready = rows.filter(r => parseFloat(r.amount || 0) > 0 && r.iban);
    const skipped = rows.filter(r => parseFloat(r.amount || 0) > 0 && !r.iban);

    if (ready.length === 0) {
      setSendError(t('salFile.noRowsReady'));
      setSending(false);
      return;
    }

    let sentCount = 0;
    try {
      await Promise.all(ready.map(r => api.post('/accounting/transfers', {
        client_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        amount: parseFloat(r.amount || 0),
        due_date: dueDate,
        description: r.description || `Salary — ${data.month}`,
        iban: r.iban,
        invoice_number: batchTag,
      }).then(() => { sentCount += 1; })));
    } catch (err) {
      setSendError(err.response?.data?.error || t('salFile.sendFailed'));
      setSending(false);
      return;
    }

    setSending(false);
    setSendSummary({ sentCount, skipped: skipped.map(r => `${r.first_name} ${r.last_name}`.trim()) });
    onSent?.();
  };

  if (!data) {
    return (
      <div>
        <h2>{t('salFile.title')}</h2>
        <p className="acc-subtitle">{t('salFile.subtitle')}</p>
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-4)' }}>
          <div style={{ marginBottom: 10 }}><HugeiconsIcon icon={MoneyBag01Icon} size={36} color="#cbd5e1" strokeWidth={1.8} /></div>
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {data.sentToTransfers && (
          <span style={{ fontSize: 12, color: '#479c73', fontWeight: 600, marginRight: 4 }}>
            ✓ {t('salFile.sentBadge')}{data.sentAt ? ` — ${new Date(data.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
          </span>
        )}
        <button onClick={sendToTransfers} disabled={sending || rows.length === 0} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          background: data.sentToTransfers ? 'var(--surface)' : '#3b82f6',
          border: data.sentToTransfers ? '1.5px solid var(--border-2)' : 'none', borderRadius: 7,
          fontSize: 13, fontWeight: 600, color: data.sentToTransfers ? 'var(--text-2)' : '#fff',
          cursor: sending || rows.length === 0 ? 'not-allowed' : 'pointer',
          opacity: sending || rows.length === 0 ? 0.6 : 1, fontFamily: 'inherit',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          {sending ? t('salFile.sending') : data.sentToTransfers ? t('salFile.resend') : t('salFile.sendToTransfers')}
        </button>
        <button onClick={exportToExcel} disabled={rows.length === 0} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          background: 'var(--surface)', border: '1.5px solid var(--border-2)', borderRadius: 7,
          fontSize: 13, fontWeight: 500, color: '#479c73',
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

      {(sendError || sendSummary) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          {sendError && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>{sendError}</span>}
          {sendSummary && (
            <span style={{ fontSize: 12, color: '#479c73', fontWeight: 500 }}>
              ✓ {t('salFile.sentCount').replace('{count}', sendSummary.sentCount)}
              {sendSummary.skipped.length > 0 && (
                <span style={{ color: '#f59e0b' }}> · {t('salFile.skippedNoIban').replace('{count}', sendSummary.skipped.length)}: {sendSummary.skipped.join(', ')}</span>
              )}
            </span>
          )}
        </div>
      )}

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
