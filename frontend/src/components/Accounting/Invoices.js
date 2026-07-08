import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { HugeiconsIcon } from '@hugeicons/react';
import { FileScanIcon, InboxIcon } from '@hugeicons/core-free-icons';

function Invoices() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('uploads');

  // Upload tab state
  const [uploadRecords, setUploadRecords] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadForm, setUploadForm] = useState({ dueDate: '', urgent: false });
  const [uploadError, setUploadError] = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);
  const uploadInputRef = useRef();

  const loadUploadRecords = async () => {
    setUploadLoading(true);
    try {
      const res = await api.get('/accounting/invoices/uploads');
      setUploadRecords((res.data.uploads || []).map(r => ({
        id: r.id,
        fileName: r.file_name,
        fileType: r.file_type,
        uploadDate: r.upload_date,
        dueDate: r.due_date,
        urgent: r.urgent,
      })));
    } catch {} finally { setUploadLoading(false); }
  };

  useEffect(() => { loadUploadRecords(); }, []);

  const handleUploadFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadError('ფაილი 10MB-ზე მეტია.'); return; }
    setUploadFile(file);
    setUploadError('');
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = (ev) => setUploadPreview(ev.target.result);
      r.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }
  };

  const handleUploadSave = async () => {
    if (!uploadFile) return;
    setUploadSaving(true);
    setUploadError('');
    try {
      const fileData = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result);
        r.onerror = reject;
        r.readAsDataURL(uploadFile);
      });
      const res = await api.post('/accounting/invoices/uploads', {
        file_name: uploadFile.name,
        file_type: uploadFile.type,
        file_data: fileData,
        upload_date: today(),
        due_date: uploadForm.dueDate || null,
        urgent: uploadForm.urgent,
      });
      const r = res.data.upload;
      setUploadRecords(prev => [{ id: r.id, fileName: r.file_name, fileType: r.file_type, uploadDate: r.upload_date, dueDate: r.due_date, urgent: r.urgent }, ...prev]);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadForm({ dueDate: '', urgent: false });
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    } catch {
      setUploadError('ფაილის შენახვა ვერ მოხერხდა.');
    } finally {
      setUploadSaving(false);
    }
  };

  const handleUploadDelete = async (id) => {
    if (!window.confirm('ჩანაწერი წაიშლება. გაგრძელება?')) return;
    try {
      await api.delete(`/accounting/invoices/uploads/${id}`);
      setUploadRecords(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  const handleUploadView = async (rec) => {
    try {
      const res = await api.get(`/accounting/invoices/uploads/${rec.id}/file`);
      const { file_data, file_type } = res.data;
      const win = window.open('', '_blank');
      if (file_type === 'application/pdf') {
        win.document.write(`<html><body style="margin:0"><embed src="${file_data}" width="100%" height="100%" type="application/pdf"/></body></html>`);
      } else {
        win.document.write(`<html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${file_data}" style="max-width:100%;max-height:100vh"/></body></html>`);
      }
      win.document.close();
    } catch {}
  };

  const [uploadFilters, setUploadFilters] = useState({ fileName: '', uploadDate: '', dueDate: '', urgent: 'all' });
  const uf = uploadFilters;
  const filteredUploadRecords = uploadRecords.filter(r => {
    if (uf.fileName && !r.fileName.toLowerCase().includes(uf.fileName.toLowerCase())) return false;
    if (uf.uploadDate && r.uploadDate !== uf.uploadDate) return false;
    if (uf.dueDate && r.dueDate !== uf.dueDate) return false;
    if (uf.urgent === 'yes' && !r.urgent) return false;
    if (uf.urgent === 'no' && r.urgent) return false;
    return true;
  });
  const setUF = (field, val) => setUploadFilters(p => ({ ...p, [field]: val }));

  const toggleUrgent = async (id) => {
    const rec = uploadRecords.find(r => r.id === id);
    if (!rec) return;
    setUploadRecords(prev => prev.map(r => r.id === id ? { ...r, urgent: !r.urgent } : r));
    try { await api.patch(`/accounting/invoices/uploads/${id}`, { urgent: !rec.urgent }); }
    catch { setUploadRecords(prev => prev.map(r => r.id === id ? { ...r, urgent: rec.urgent } : r)); }
  };

  // Scanner state
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanSaving, setScanSaving] = useState(false);
  const [scanSaved, setScanSaved] = useState(false);
  const scanInputRef = useRef();

  const handleScanFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanFile(file);
    setScanResult(null);
    setScanError('');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setScanPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setScanPreview(null);
    }
  };

  const handleScan = async () => {
    if (!scanFile) return;
    setScanning(true);
    setScanError('');
    setScanResult(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(scanFile);
      });
      const res = await api.post('/accounting/invoices/scan', {
        data: base64,
        mimeType: scanFile.type,
      });
      setScanResult(res.data.result);
    } catch (err) {
      setScanError(err.response?.data?.error || err.message);
    } finally {
      setScanning(false);
    }
  };

  const resetScan = () => {
    setScanFile(null);
    setScanPreview(null);
    setScanResult(null);
    setScanError('');
    setScanSaved(false);
    if (scanInputRef.current) scanInputRef.current.value = '';
  };

  const handleSaveScanned = async () => {
    if (!scanResult) return;
    setScanSaving(true);
    setScanError('');
    try {
      const bankDetails = [
        scanResult.bank_name && `Bank: ${scanResult.bank_name}`,
        scanResult.account_number && `Account: ${scanResult.account_number}`,
        scanResult.swift_bic && `SWIFT/BIC: ${scanResult.swift_bic}`,
        scanResult.notes,
      ].filter(Boolean).join('\n');

      const num = scanResult.invoice_number || `INV-${Date.now().toString().slice(-6)}`;
      const items = [{ description: scanResult.description || 'Invoice payment', qty: 1, unit_price: parseFloat(scanResult.amount) || 0 }];
      const total = parseFloat(scanResult.amount) || 0;

      await api.post('/accounting/invoices', {
        client: scanResult.payee || 'Unknown',
        client_email: '',
        invoice_number: num,
        date: scanResult.invoice_date || today(),
        due_date: scanResult.due_date || null,
        currency: scanResult.currency || 'USD',
        status: 'draft',
        notes: bankDetails,
        account_number: scanResult.account_number || null,
        items,
        total,
      });
      setScanSaved(true);
    } catch (err) {
      setScanError(err.response?.data?.error || err.message);
    } finally {
      setScanSaving(false);
    }
  };

  return (
    <>
      <h2>{t('inv.title')}</h2>
      <p className="acc-subtitle">{t('inv.subtitle')}</p>

      {/* Sub-tabs */}
      <div className="docs-inner-tabs" style={{ marginBottom: 24 }}>
        <button className={`docs-inner-tab${tab === 'uploads' ? ' active' : ''}`} onClick={() => setTab('uploads')}>
          <HugeiconsIcon icon={InboxIcon} size={15} color="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          ატვირთული
        </button>
        <button className={`docs-inner-tab${tab === 'scanner' ? ' active' : ''}`} onClick={() => setTab('scanner')}>
          <HugeiconsIcon icon={FileScanIcon} size={15} color="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {t('inv.scanner')}
        </button>
      </div>

      {/* ── SCANNER TAB ─────────────────────────── */}
      {tab === 'scanner' && (
        <div style={{ maxWidth: 780 }}>
          {/* Upload area */}
          {!scanResult && (
            <div
              onClick={() => scanInputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setScanFile(f); setScanResult(null); setScanError(''); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setScanPreview(ev.target.result); r.readAsDataURL(f); } else setScanPreview(null); } }}
              style={{
                border: '2px dashed var(--border)', borderRadius: 14, padding: '48px 32px',
                textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)',
                transition: 'border-color 0.2s', marginBottom: 20,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <input ref={scanInputRef} type="file" accept="image/*,.pdf" onChange={handleScanFile} style={{ display: 'none' }} />
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
                {scanFile ? scanFile.name : t('inv.dropHere')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('inv.supports')}</div>
            </div>
          )}

          {/* Image preview */}
          {scanPreview && !scanResult && (
            <div style={{ marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', maxHeight: 320 }}>
              <img src={scanPreview} alt="Invoice preview" style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
            </div>
          )}

          {/* Action buttons */}
          {scanFile && !scanResult && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                className="btn-add"
                onClick={handleScan}
                disabled={scanning}
                style={{ opacity: scanning ? 0.7 : 1 }}
              >
                {scanning ? t('inv.analyzing') : t('inv.analyze')}
              </button>
              <button className="btn-secondary-outline" onClick={resetScan}>{t('inv.clearScan')}</button>
            </div>
          )}

          {scanError && (
            <div className="msg-error" style={{ marginBottom: 16 }}>{scanError}</div>
          )}

          {/* Scanning spinner */}
          {scanning && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 15 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚙️</div>
              {t('inv.geminiReading')}
            </div>
          )}

          {/* Results */}
          {scanResult && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{t('inv.analyzed')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{t('inv.extractedDetails')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {scanSaved ? (
                    <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>{t('inv.savedToInvoices')}</span>
                  ) : (
                    <button className="btn-add" onClick={handleSaveScanned} disabled={scanSaving} style={{ fontSize: 13 }}>
                      {scanSaving ? t('inv.saving') : t('inv.saveToInvoices')}
                    </button>
                  )}
                  <button className="btn-secondary-outline" onClick={resetScan} style={{ fontSize: 13 }}>{t('inv.scanAnother')}</button>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Amount highlight */}
                <div style={{ gridColumn: '1 / -1', background: 'rgba(37,99,235,0.08)', border: '1.5px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ fontSize: 36 }}>💰</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 4 }}>{t('inv.amountToTransfer')}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      {scanResult.amount ? `${scanResult.amount} ${scanResult.currency || ''}` : '—'}
                    </div>
                  </div>
                </div>

                {[
                  { icon: '🏢', label: t('inv.payTo'), value: scanResult.payee },
                  { icon: '📅', label: t('inv.dueDate'), value: scanResult.due_date },
                  { icon: '📋', label: t('inv.invoiceDate'), value: scanResult.invoice_date },
                  { icon: '🔢', label: t('inv.invoiceNo'), value: scanResult.invoice_number },
                  { icon: '🏦', label: t('inv.bank'), value: scanResult.bank_name },
                  { icon: '💳', label: t('inv.accountIban'), value: scanResult.account_number },
                  { icon: '🌐', label: t('inv.swiftBic'), value: scanResult.swift_bic },
                  { icon: '📝', label: t('inv.description'), value: scanResult.description },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-4)' }}>{icon} {label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: value ? 'var(--text)' : 'var(--text-4)', fontStyle: value ? 'normal' : 'italic' }}>
                      {value || t('inv.notFound')}
                    </div>
                  </div>
                ))}

                {scanResult.notes && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-2)', paddingTop: 16, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-4)', marginBottom: 6 }}>{t('inv.notes')}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{scanResult.notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOADS TAB ─────────────────────────── */}
      {tab === 'uploads' && (
        <div style={{ maxWidth: 900 }}>
          {/* Drop zone */}
          <div
            onClick={() => uploadInputRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleUploadFile(f);
            }}
            style={{
              border: '2px dashed var(--border)', borderRadius: 14, padding: '36px 32px',
              textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)',
              marginBottom: 20, transition: 'border-color 0.2s',
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 8 }}>📎</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>
              PDF / JPG / PNG ატვირთვა
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
              გადმოიტანეთ ან დააჭირეთ ასარჩევად &middot; მაქს. 10MB
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={e => handleUploadFile(e.target.files[0])}
            />
          </div>

          {uploadError && (
            <div className="msg-error" style={{ marginBottom: 12 }}>{uploadError}</div>
          )}

          {/* Selected file + form */}
          {uploadFile && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12,
              padding: 20, marginBottom: 20, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap',
            }}>
              {uploadPreview ? (
                <img src={uploadPreview} alt="preview" style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 100, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0, fontSize: 32,
                }}>📄</div>
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>{uploadFile.name}</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>გადარიცხვის თარიღი</label>
                    <input
                      type="date"
                      value={uploadForm.dueDate}
                      onChange={e => setUploadForm(p => ({ ...p, dueDate: e.target.value }))}
                      style={{ padding: '7px 10px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text)', fontWeight: 600, paddingBottom: 7 }}>
                    <input
                      type="checkbox"
                      checked={uploadForm.urgent}
                      onChange={e => setUploadForm(p => ({ ...p, urgent: e.target.checked }))}
                      style={{ width: 16, height: 16 }}
                    />
                    სასწრაფო
                  </label>
                  <button
                    onClick={handleUploadSave}
                    disabled={uploadSaving}
                    style={{
                      padding: '8px 22px', background: '#3b82f6', color: '#fff', border: 'none',
                      borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: uploadSaving ? 'not-allowed' : 'pointer',
                      opacity: uploadSaving ? 0.7 : 1, marginBottom: 0,
                    }}
                  >
                    {uploadSaving ? 'შენახვა...' : 'შენახვა'}
                  </button>
                  <button
                    onClick={() => { setUploadFile(null); setUploadPreview(null); setUploadError(''); if (uploadInputRef.current) uploadInputRef.current.value = ''; }}
                    style={{
                      padding: '8px 14px', background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border-2)',
                      borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 0,
                    }}
                  >
                    გაუქმება
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Uploads table */}
          {uploadRecords.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '48px 0', fontSize: 14 }}>
              ატვირთული ინვოისები არ არის
            </div>
          ) : (
            <div className="acc-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="acc-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>№</th>
                    <th>ფაილი</th>
                    <th style={{ width: 140 }}>ატვირთვის თარიღი</th>
                    <th style={{ width: 140 }}>გადარიცხვის თარიღი</th>
                    <th style={{ width: 90, textAlign: 'center' }}>სასწრაფო</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th></th>
                    <th style={{ padding: '4px 6px' }}>
                      <input
                        value={uf.fileName}
                        onChange={e => setUF('fileName', e.target.value)}
                        placeholder="ძებნა..."
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                      />
                    </th>
                    <th style={{ padding: '4px 6px' }}>
                      <input
                        type="date"
                        value={uf.uploadDate}
                        onChange={e => setUF('uploadDate', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                      />
                    </th>
                    <th style={{ padding: '4px 6px' }}>
                      <input
                        type="date"
                        value={uf.dueDate}
                        onChange={e => setUF('dueDate', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                      />
                    </th>
                    <th style={{ padding: '4px 6px' }}>
                      <select
                        value={uf.urgent}
                        onChange={e => setUF('urgent', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                      >
                        <option value="all">ყველა</option>
                        <option value="yes">სასწრაფო</option>
                        <option value="no">ჩვეულებრივი</option>
                      </select>
                    </th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>
                      {(uf.fileName || uf.uploadDate || uf.dueDate || uf.urgent !== 'all') && (
                        <button
                          onClick={() => setUploadFilters({ fileName: '', uploadDate: '', dueDate: '', urgent: 'all' })}
                          style={{ padding: '3px 8px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: 'var(--text-4)' }}
                        >
                          გასუფთავება
                        </button>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUploadRecords.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '32px 0', fontSize: 13 }}>შედეგი არ მოიძებნა</td></tr>
                  )}
                  {filteredUploadRecords.map((rec, idx) => (
                    <tr key={rec.id}>
                      <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {rec.fileType.startsWith('image/') ? (
                            <img src={rec.fileData} alt="" style={{ width: 36, height: 28, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border)', flexShrink: 0 }} />
                          ) : (
                            <span style={{ fontSize: 22, flexShrink: 0 }}>📄</span>
                          )}
                          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-all' }}>{rec.fileName}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-3)' }}>{rec.uploadDate}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-3)' }}>{rec.dueDate || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => toggleUrgent(rec.id)}
                          style={{
                            padding: '3px 12px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                            background: rec.urgent ? '#fee2e2' : 'var(--surface-2)',
                            color: rec.urgent ? '#dc2626' : 'var(--text-4)',
                          }}
                        >
                          {rec.urgent ? 'სასწრაფო' : '—'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleUploadView(rec)}
                            style={{ padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-3)' }}
                          >
                            ნახვა
                          </button>
                          <button
                            onClick={() => handleUploadDelete(rec.id)}
                            style={{ padding: '4px 10px', background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 600 }}
                          >
                            წაშლა
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Invoices;
