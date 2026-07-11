import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { HugeiconsIcon } from '@hugeicons/react';
import { InboxIcon, AiMagicIcon, Loading03Icon, TaskEdit01Icon, SentIcon, CheckmarkCircle02Icon, Upload01Icon, FileSpreadsheetIcon } from '@hugeicons/core-free-icons';

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
      const uploads = (res.data.uploads || []).map(r => ({
        id: r.id,
        fileName: r.file_name,
        fileType: r.file_type,
        uploadDate: r.upload_date,
        dueDate: r.due_date,
        urgent: r.urgent,
        extracted: r.extracted,
        sent: r.sent || false,
      }));
      setUploadRecords(uploads);
      // Seed sentUploadIds from DB so green badge survives refresh
      setSentUploadIds(new Set(uploads.filter(u => u.sent).map(u => u.id)));
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

  const handleUploadSave = async (onSuccess) => {
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
      setUploadRecords(prev => [{ id: r.id, fileName: r.file_name, fileType: r.file_type, uploadDate: r.upload_date, dueDate: r.due_date, urgent: r.urgent, extracted: r.extracted }, ...prev]);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadForm({ dueDate: '', urgent: false });
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      if (onSuccess) onSuccess();
    } catch {
      setUploadError('ფაილის შენახვა ვერ მოხერხდა.');
    } finally {
      setUploadSaving(false);
    }
  };

  const [rescanningId, setRescanningId] = useState(null);
  const handleUploadRescan = async (id) => {
    setRescanningId(id);
    try {
      const res = await api.post(`/accounting/invoices/uploads/${id}/rescan`);
      const r = res.data.upload;
      setUploadRecords(prev => prev.map(rec => rec.id === id ? { ...rec, extracted: r.extracted } : rec));
    } catch {} finally { setRescanningId(null); }
  };

  const exportRecordsToExcel = (records, filenameSuffix) => {
    const rows = records.map((r, idx) => ({
      '№': idx + 1,
      'ფაილი': r.fileName,
      'გადამხდელი': r.extracted?.payee || '',
      'თანხა': r.extracted?.amount || '',
      'ვალუტა': r.extracted?.currency || '',
      'ინვოისის №': r.extracted?.invoice_number || '',
      'ინვოისის თარიღი': r.extracted?.invoice_date || '',
      'გადახდის ვადა': r.dueDate || r.extracted?.due_date || '',
      'ბანკი': r.extracted?.bank_name || '',
      'ანგარიში/IBAN': r.extracted?.account_number || '',
      'SWIFT/BIC': r.extracted?.swift_bic || '',
      'აღწერა': r.extracted?.description || '',
      'ატვირთვის თარიღი': r.uploadDate,
      'სასწრაფო': r.urgent ? 'დიახ' : 'არა',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices_${filenameSuffix}.xlsx`);
  };
  const handleExportExcel = () => exportRecordsToExcel(filteredUploadRecords, today());

  const [extractingDate, setExtractingDate] = useState(null);
  const handleExtractBlock = async (date, records) => {
    setExtractingDate(date);
    try {
      const results = await Promise.all(records.map(async (rec) => {
        try {
          const res = await api.post(`/accounting/invoices/uploads/${rec.id}/rescan`);
          return { id: rec.id, extracted: res.data.upload.extracted };
        } catch {
          return null;
        }
      }));
      const byId = new Map(results.filter(Boolean).map(r => [r.id, r.extracted]));
      setUploadRecords(prev => prev.map(r => byId.has(r.id) ? { ...r, extracted: byId.get(r.id) } : r));
      const freshRecords = records.map(r => byId.has(r.id) ? { ...r, extracted: byId.get(r.id) } : r);
      exportRecordsToExcel(freshRecords, date);
    } finally {
      setExtractingDate(null);
    }
  };

  // Edit Transactions tab — a block's extracted data, opened as editable rows.
  const [editRecords, setEditRecords] = useState([]);
  const [editSourceLabel, setEditSourceLabel] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  // Persists sent state across tab switches so the green badge doesn't reset
  const [sentUploadIds, setSentUploadIds] = useState(new Set());

  const openEditTransactions = (dateLabel, records) => {
    setEditRecords(records.map(r => ({
      uploadId: r.id,
      fileName: r.fileName,
      payee: r.extracted?.payee || '',
      amount: r.extracted?.amount != null ? String(r.extracted.amount) : '',
      currency: r.extracted?.currency || 'GEL',
      invoiceNumber: r.extracted?.invoice_number || '',
      invoiceDate: r.extracted?.invoice_date || '',
      dueDate: r.dueDate || r.extracted?.due_date || '',
      iban: r.extracted?.account_number || '',
      description: r.extracted?.description || '',
      sent: r.sent || sentUploadIds.has(r.id),
    })));
    setEditSourceLabel(dateLabel);
    setTab('edit');
  };

  const updateEditField = (uploadId, field, value) => {
    setEditRecords(prev => prev.map(r => r.uploadId === uploadId ? { ...r, [field]: value } : r));
  };

  const markSent = (uploadId) => {
    setSentUploadIds(prev => new Set([...prev, uploadId]));
    setEditRecords(prev => prev.map(r => r.uploadId === uploadId ? { ...r, sent: true } : r));
    setUploadRecords(prev => prev.map(r => r.id === uploadId ? { ...r, sent: true } : r));
    api.patch(`/accounting/invoices/uploads/${uploadId}`, { sent: true }).catch(() => {});
  };

  const handleSendToTransfers = async (rec) => {
    if (!rec.payee.trim() || !rec.amount || !rec.dueDate) {
      alert('შეავსეთ გადამხდელი, თანხა და გადახდის ვადა გაგზავნამდე.');
      return false;
    }
    setSendingId(rec.uploadId);
    try {
      await api.post('/accounting/transfers', {
        client_name: rec.payee.trim(),
        agent_id: null,
        amount: parseFloat(rec.amount),
        due_date: rec.dueDate,
        description: rec.description || '',
        iban: rec.iban || null,
        invoice_number: rec.invoiceNumber || null,
        status: 'normal',
      });
      markSent(rec.uploadId);
      return true;
    } catch (err) {
      alert(err.response?.data?.error || 'გაგზავნა ვერ მოხერხდა.');
      return false;
    } finally {
      setSendingId(null);
    }
  };

  const handleSendAllToTransfers = async () => {
    setSendingAll(true);
    try {
      for (const rec of editRecords.filter(r => !r.sent)) {
        // eslint-disable-next-line no-await-in-loop
        await handleSendToTransfers(rec);
      }
    } finally {
      setSendingAll(false);
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
    if (uf.fileName) {
      const q = uf.fileName.toLowerCase();
      const hay = [r.fileName, r.extracted?.payee, r.extracted?.invoice_number].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (uf.uploadDate && r.extracted?.invoice_date !== uf.uploadDate) return false;
    if (uf.dueDate && r.dueDate !== uf.dueDate) return false;
    if (uf.urgent === 'yes' && !r.urgent) return false;
    if (uf.urgent === 'no' && r.urgent) return false;
    return true;
  });
  const setUF = (field, val) => setUploadFilters(p => ({ ...p, [field]: val }));

  // Group uploads into daily, expandable blocks (newest day first).
  const groupedByDate = filteredUploadRecords.reduce((acc, r) => {
    const d = r.uploadDate || 'უცნობი თარიღი';
    (acc[d] = acc[d] || []).push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const didInitExpand = useRef(false);
  useEffect(() => {
    if (!didInitExpand.current && uploadRecords.length > 0) {
      const dates = [...new Set(uploadRecords.map(r => r.uploadDate))].sort((a, b) => b.localeCompare(a));
      if (dates.length) setExpandedDates(new Set([dates[0]]));
      didInitExpand.current = true;
    }
  }, [uploadRecords]);
  const toggleDateGroup = (d) => setExpandedDates(prev => {
    const next = new Set(prev);
    next.has(d) ? next.delete(d) : next.add(d);
    return next;
  });
  const dateGroupLabel = (d) => {
    if (d === today()) return `დღეს · ${d}`;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === yesterday) return `გუშინ · ${d}`;
    return d;
  };

  const toggleUrgent = async (id) => {
    const rec = uploadRecords.find(r => r.id === id);
    if (!rec) return;
    setUploadRecords(prev => prev.map(r => r.id === id ? { ...r, urgent: !r.urgent } : r));
    try { await api.patch(`/accounting/invoices/uploads/${id}`, { urgent: !rec.urgent }); }
    catch { setUploadRecords(prev => prev.map(r => r.id === id ? { ...r, urgent: rec.urgent } : r)); }
  };

  return (
    <>
      <h2>{t('inv.title')}</h2>
      <p className="acc-subtitle">{t('inv.subtitle')}</p>

      {/* Sub-tabs */}
      <div className="docs-inner-tabs" style={{ marginBottom: 24 }}>
        <button className={`docs-inner-tab${tab === 'uploads' ? ' active' : ''}`} onClick={() => setTab('uploads')}>
          <HugeiconsIcon icon={InboxIcon} size={15} color="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Invoice List
        </button>
        <button className={`docs-inner-tab${tab === 'upload' ? ' active' : ''}`} onClick={() => setTab('upload')}>
          <HugeiconsIcon icon={Upload01Icon} size={15} color="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Upload
        </button>
        <button className={`docs-inner-tab${tab === 'edit' ? ' active' : ''}`} onClick={() => setTab('edit')}>
          <HugeiconsIcon icon={TaskEdit01Icon} size={15} color="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Edit Transactions
        </button>
      </div>

      {/* ── UPLOAD TAB ─────────────────────────── */}
      {tab === 'upload' && (
        <div style={{ maxWidth: 640 }}>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={e => handleUploadFile(e.target.files[0])}
          />

          {!uploadFile ? (
            <div
              onClick={() => uploadInputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUploadFile(f); }}
              style={{
                border: '2px dashed var(--border)', borderRadius: 14, padding: '64px 32px',
                textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HugeiconsIcon icon={Upload01Icon} size={28} color="var(--accent, #6366f1)" strokeWidth={1.8} />
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
                Click or drag & drop to upload
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>PDF, JPG, PNG — max 10MB</div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden' }}>
              {uploadPreview && (
                <div style={{ borderBottom: '1px solid var(--border-2)', maxHeight: 260, overflow: 'hidden' }}>
                  <img src={uploadPreview} alt="preview" style={{ width: '100%', objectFit: 'contain', display: 'block', maxHeight: 260 }} />
                </div>
              )}
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <HugeiconsIcon icon={Upload01Icon} size={18} color="var(--accent, #6366f1)" strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadFile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{(uploadFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Due Date</label>
                    <input
                      type="date"
                      value={uploadForm.dueDate}
                      onChange={e => setUploadForm(f => ({ ...f, dueDate: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
                    <input
                      type="checkbox"
                      id="upload-urgent"
                      checked={uploadForm.urgent}
                      onChange={e => setUploadForm(f => ({ ...f, urgent: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="upload-urgent" style={{ fontSize: 13, fontWeight: 600, color: uploadForm.urgent ? '#f87171' : 'var(--text)', cursor: 'pointer' }}>
                      Urgent
                    </label>
                  </div>
                </div>

                {uploadError && <div className="msg-error" style={{ marginBottom: 14 }}>{uploadError}</div>}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-add"
                    onClick={() => handleUploadSave(() => setTab('uploads'))}
                    disabled={uploadSaving}
                    style={{ opacity: uploadSaving ? 0.7 : 1 }}
                  >
                    {uploadSaving ? 'Saving…' : 'Save Invoice'}
                  </button>
                  <button
                    className="btn-secondary-outline"
                    onClick={() => { setUploadFile(null); setUploadPreview(null); setUploadForm({ dueDate: '', urgent: false }); setUploadError(''); if (uploadInputRef.current) uploadInputRef.current.value = ''; }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOADS TAB ─────────────────────────── */}
      {tab === 'uploads' && (
        <div style={{ maxWidth: 1400 }}>
          {/* Uploads — daily blocks */}
          {uploadRecords.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '48px 0', fontSize: 14 }}>
              ატვირთული ინვოისები არ არის
            </div>
          ) : (
            <>
              {/* Filter toolbar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                <input
                  value={uf.fileName}
                  onChange={e => setUF('fileName', e.target.value)}
                  placeholder="ძებნა ფაილში/გადამხდელში..."
                  style={{ flex: '1 1 220px', padding: '7px 10px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                />
                <input
                  type="date"
                  value={uf.uploadDate}
                  onChange={e => setUF('uploadDate', e.target.value)}
                  title="ინვოისის თარიღი"
                  style={{ padding: '7px 8px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                />
                <input
                  type="date"
                  value={uf.dueDate}
                  onChange={e => setUF('dueDate', e.target.value)}
                  title="გადახდის ვადა"
                  style={{ padding: '7px 8px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                />
                <select
                  value={uf.urgent}
                  onChange={e => setUF('urgent', e.target.value)}
                  style={{ padding: '7px 8px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                >
                  <option value="all">ყველა</option>
                  <option value="yes">სასწრაფო</option>
                  <option value="no">ჩვეულებრივი</option>
                </select>
                {(uf.fileName || uf.uploadDate || uf.dueDate || uf.urgent !== 'all') && (
                  <button
                    onClick={() => setUploadFilters({ fileName: '', uploadDate: '', dueDate: '', urgent: 'all' })}
                    style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: 'var(--text-4)' }}
                  >
                    გასუფთავება
                  </button>
                )}
                <button
                  onClick={handleExportExcel}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}
                >
                  <HugeiconsIcon icon={FileSpreadsheetIcon} size={14} color="#fff" strokeWidth={2} />
                  ყველას ექსპორტი
                </button>
              </div>

              {sortedDates.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '32px 0', fontSize: 13 }}>შედეგი არ მოიძებნა</div>
              ) : sortedDates.map(date => {
                const dayRecords = groupedByDate[date];
                const isOpen = expandedDates.has(date);
                return (
                  <div key={date} style={{ border: '1px solid var(--border-2)', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
                    {/* Block header */}
                    <div
                      onClick={() => toggleDateGroup(date)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface-2)', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text-4)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{dateGroupLabel(date)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 20, padding: '2px 10px' }}>
                        {dayRecords.length}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); setTab('upload'); }}
                        title="ინვოისის ატვირთვა"
                        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}
                      >
                        <HugeiconsIcon icon={Upload01Icon} size={14} color="currentColor" strokeWidth={2} />
                        ატვირთვა
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleExtractBlock(date, dayRecords); }}
                        disabled={extractingDate === date}
                        title="ტექსტის ამოღება ყველა ფაილიდან და Excel-ში ჩაწერა"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#2563eb', cursor: extractingDate === date ? 'not-allowed' : 'pointer', opacity: extractingDate === date ? 0.7 : 1 }}
                      >
                        <HugeiconsIcon icon={extractingDate === date ? Loading03Icon : AiMagicIcon} size={14} color="currentColor" strokeWidth={2} />
                        {extractingDate === date ? 'მუშავდება...' : 'Extract'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); exportRecordsToExcel(dayRecords, date); }}
                        title="ამ დღის Excel-ში გატანა"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#16a34a', cursor: 'pointer' }}
                      >
                        <HugeiconsIcon icon={FileSpreadsheetIcon} size={14} color="currentColor" strokeWidth={2} />
                        Excel
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openEditTransactions(date, dayRecords); }}
                        title="მონაცემების რედაქტირება და Transfers-ში გაგზავნა"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}
                      >
                        <HugeiconsIcon icon={TaskEdit01Icon} size={14} color="currentColor" strokeWidth={2} />
                        Edit Transactions
                      </button>
                    </div>

                    {/* Block body */}
                    {isOpen && (
                      <div className="acc-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="acc-table" style={{ minWidth: 1100 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>№</th>
                              <th style={{ width: 200 }}>ფაილი</th>
                              <th style={{ width: 150 }}>გადამხდელი</th>
                              <th style={{ width: 110 }}>თანხა</th>
                              <th style={{ width: 120 }}>ინვოისის №</th>
                              <th style={{ width: 120 }}>ინვოისის თარიღი</th>
                              <th style={{ width: 120 }}>გადახდის ვადა</th>
                              <th style={{ width: 90, textAlign: 'center' }}>სასწრაფო</th>
                              <th style={{ width: 130 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayRecords.map((rec, idx) => {
                              const ex = rec.extracted;
                              const failed = ex?.error;
                              return (
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
                                  {failed ? (
                                    <td colSpan={4}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#dc2626' }}>
                                        <span title={ex.error}>ტექსტი ვერ ამოიცნო</span>
                                        <button
                                          onClick={() => handleUploadRescan(rec.id)}
                                          disabled={rescanningId === rec.id}
                                          style={{ padding: '2px 10px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#dc2626', fontWeight: 600 }}
                                        >
                                          {rescanningId === rec.id ? '...' : 'ხელახლა სკანირება'}
                                        </button>
                                      </div>
                                    </td>
                                  ) : !ex ? (
                                    <td colSpan={4} style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>—</td>
                                  ) : (
                                    <>
                                      <td style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{ex.payee || '—'}</td>
                                      <td style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{ex.amount ? `${ex.amount} ${ex.currency || ''}` : '—'}</td>
                                      <td style={{ fontSize: 13, color: 'var(--text-3)' }}>{ex.invoice_number || '—'}</td>
                                      <td style={{ fontSize: 13, color: 'var(--text-3)' }}>{ex.invoice_date || '—'}</td>
                                    </>
                                  )}
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
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── EDIT TRANSACTIONS TAB ─────────────────── */}
      {tab === 'edit' && (
        <div>
          {editRecords.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '48px 0', fontSize: 14 }}>
              აირჩიეთ დღის ბლოკი "Invoice List"-ში და დააჭირეთ <strong>Edit Transactions</strong>-ს, რომ აქ დაარედაქტიროთ მონაცემები.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>წყარო: <strong style={{ color: 'var(--text)' }}>{editSourceLabel}</strong> · {editRecords.length} ჩანაწერი</span>
                <button
                  onClick={handleSendAllToTransfers}
                  disabled={sendingAll || editRecords.every(r => r.sent)}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: sendingAll ? 'not-allowed' : 'pointer', opacity: sendingAll || editRecords.every(r => r.sent) ? 0.6 : 1 }}
                >
                  <HugeiconsIcon icon={SentIcon} size={14} color="#fff" strokeWidth={2} />
                  {sendingAll ? 'იგზავნება...' : 'ყველას გაგზავნა Transfers-ში'}
                </button>
              </div>

              <div className="acc-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="acc-table" style={{ minWidth: 1300 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 180 }}>ფაილი</th>
                      <th style={{ width: 130 }}></th>
                      <th style={{ width: 170 }}>გადამხდელი</th>
                      <th style={{ width: 110 }}>თანხა</th>
                      <th style={{ width: 90 }}>ვალუტა</th>
                      <th style={{ width: 140 }}>ინვოისის №</th>
                      <th style={{ width: 150 }}>გადახდის ვადა</th>
                      <th style={{ width: 180 }}>IBAN/ანგარიში</th>
                      <th style={{ width: 200 }}>აღწერა</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editRecords.map(rec => (
                      <tr key={rec.uploadId}>
                        <td>
                          <button
                            onClick={() => handleUploadView({ id: rec.uploadId })}
                            title="ფაილის გახსნა"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontSize: 12, color: '#3b82f6', textDecoration: 'underline', wordBreak: 'break-all', fontFamily: 'inherit' }}
                          >
                            {rec.fileName}
                          </button>
                        </td>
                        <td>
                          {rec.sent ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#16a34a" strokeWidth={2.5} />
                              გაგზავნილია
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSendToTransfers(rec)}
                              disabled={sendingId === rec.uploadId || sendingAll}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
                            >
                              <HugeiconsIcon icon={SentIcon} size={13} color="currentColor" strokeWidth={2} />
                              {sendingId === rec.uploadId ? 'იგზავნება...' : 'გაგზავნა'}
                            </button>
                          )}
                        </td>
                        <td>
                          <input value={rec.payee} onChange={e => updateEditField(rec.uploadId, 'payee', e.target.value)} placeholder="გადამხდელი" style={editInpStyle} />
                        </td>
                        <td>
                          <input type="number" min="0" step="0.01" value={rec.amount} onChange={e => updateEditField(rec.uploadId, 'amount', e.target.value)} placeholder="0.00" style={{ ...editInpStyle, fontFamily: 'var(--font-mono)' }} />
                        </td>
                        <td>
                          <select value={rec.currency} onChange={e => updateEditField(rec.uploadId, 'currency', e.target.value)} style={editInpStyle}>
                            <option>GEL</option><option>USD</option><option>EUR</option>
                          </select>
                        </td>
                        <td>
                          <input value={rec.invoiceNumber} onChange={e => updateEditField(rec.uploadId, 'invoiceNumber', e.target.value)} placeholder="INV-0001" style={editInpStyle} />
                        </td>
                        <td>
                          <input type="date" value={rec.dueDate} onChange={e => updateEditField(rec.uploadId, 'dueDate', e.target.value)} style={editInpStyle} />
                        </td>
                        <td>
                          <input value={rec.iban} onChange={e => updateEditField(rec.uploadId, 'iban', e.target.value)} placeholder="GE00XX..." style={{ ...editInpStyle, fontFamily: 'var(--font-mono)' }} />
                        </td>
                        <td>
                          <input value={rec.description} onChange={e => updateEditField(rec.uploadId, 'description', e.target.value)} placeholder="აღწერა" style={editInpStyle} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

    </>
  );
}

const editInpStyle = { width: '100%', padding: '6px 8px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' };
const today = () => new Date().toISOString().split('T')[0];
export default Invoices;
