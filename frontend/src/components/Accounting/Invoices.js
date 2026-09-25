import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { HugeiconsIcon } from '@hugeicons/react';
import { InboxIcon, TaskEdit01Icon, SentIcon, CheckmarkCircle02Icon, Upload01Icon, FileSpreadsheetIcon, Calendar03Icon } from '@hugeicons/core-free-icons';
import { fmtExcelDate } from '../../utils/formatDate';

function Invoices() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('uploads');

  // Upload tab state
  const [uploadRecords, setUploadRecords] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const uploadInputRef = useRef();

  // Multi-upload -> extract -> one-by-one review flow.
  // pendingFiles: uploaded (stored) but not yet extracted, this session.
  // reviewRecords: null until extraction finishes, then the editable
  // one-by-one review queue; reviewIndex is the current position in it.
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingMulti, setUploadingMulti] = useState(false);
  const [multiUploadError, setMultiUploadError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });
  const [reviewRecords, setReviewRecords] = useState(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewSendingId, setReviewSendingId] = useState(null);
  const [reviewRetryingId, setReviewRetryingId] = useState(null);

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

  // Upload one or more files, stored immediately without AI extraction --
  // extraction is a separate step (handleExtractAll) so a batch of many
  // files doesn't block on the AI call for each one before the next can
  // even start uploading.
  const handleMultiFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    const tooBig = files.filter(f => f.size > 10 * 1024 * 1024);
    const okFiles = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (tooBig.length) setMultiUploadError(`${tooBig.length} ფაილი გამოტოვებულია (10MB-ზე მეტია).`);
    else setMultiUploadError('');
    if (okFiles.length === 0) return;

    setUploadingMulti(true);
    const uploaded = [];
    for (const file of okFiles) {
      try {
        const fileData = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = (e) => resolve(e.target.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const res = await api.post('/accounting/invoices/uploads', {
          file_name: file.name,
          file_type: file.type,
          file_data: fileData,
          upload_date: today(),
          skip_extract: true,
        });
        const r = res.data.upload;
        uploaded.push({ id: r.id, fileName: r.file_name, fileType: r.file_type });
      } catch {
        setMultiUploadError(prev => prev || `ვერ აიტვირთა: ${file.name}`);
      }
    }
    setPendingFiles(prev => [...prev, ...uploaded]);
    setUploadRecords(prev => [
      ...uploaded.map(u => ({ id: u.id, fileName: u.fileName, fileType: u.fileType, uploadDate: today(), dueDate: null, urgent: false, extracted: null, sent: false })),
      ...prev,
    ]);
    setUploadingMulti(false);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  // Extract every pending file one at a time; a failure on one doesn't stop
  // the rest -- it's recorded with an error and the batch moves on.
  const handleExtractAll = async () => {
    const queue = pendingFiles;
    if (queue.length === 0) return;
    setExtracting(true);
    setExtractProgress({ current: 0, total: queue.length });
    const results = [];
    for (let i = 0; i < queue.length; i++) {
      const pf = queue[i];
      setExtractProgress({ current: i + 1, total: queue.length });
      let extracted;
      try {
        const res = await api.post(`/accounting/invoices/uploads/${pf.id}/rescan`);
        extracted = res.data.upload.extracted;
      } catch {
        extracted = { error: 'ვერ მოხერხდა ამოცნობა' };
      }
      results.push({ ...pf, extracted });
      setUploadRecords(prev => prev.map(r => r.id === pf.id ? { ...r, extracted } : r));
    }
    setExtracting(false);
    setPendingFiles([]);
    setReviewRecords(results.map(r => ({
      uploadId: r.id,
      fileName: r.fileName,
      fileType: r.fileType,
      extractFailed: !!r.extracted?.error,
      payee: r.extracted?.payee || '',
      amount: r.extracted?.amount != null ? String(r.extracted.amount) : '',
      currency: r.extracted?.currency || 'GEL',
      invoiceNumber: r.extracted?.invoice_number || '',
      dueDate: r.extracted?.due_date || '',
      iban: r.extracted?.account_number || '',
      description: r.extracted?.description || '',
      matchedAgent: r.extracted?.matched_agent || null,
      agentId: null,
      sent: false,
    })));
    setReviewIndex(0);
  };

  const handleReviewRetry = async (uploadId) => {
    setReviewRetryingId(uploadId);
    try {
      const res = await api.post(`/accounting/invoices/uploads/${uploadId}/rescan`);
      const ex = res.data.upload.extracted;
      setUploadRecords(prev => prev.map(r => r.id === uploadId ? { ...r, extracted: ex } : r));
      setReviewRecords(prev => prev.map(r => r.uploadId !== uploadId ? r : {
        ...r,
        extractFailed: !!ex?.error,
        payee: ex?.payee || r.payee,
        amount: ex?.amount != null ? String(ex.amount) : r.amount,
        currency: ex?.currency || r.currency,
        invoiceNumber: ex?.invoice_number || r.invoiceNumber,
        dueDate: ex?.due_date || r.dueDate,
        iban: ex?.account_number || r.iban,
        description: ex?.description || r.description,
        matchedAgent: ex?.matched_agent || r.matchedAgent,
      }));
    } catch {} finally { setReviewRetryingId(null); }
  };

  const updateReviewField = (uploadId, field, value) => {
    setReviewRecords(prev => prev.map(r => r.uploadId === uploadId ? { ...r, [field]: value } : r));
  };

  const applyReviewMatchedAgent = (uploadId) => {
    setReviewRecords(prev => prev.map(r => {
      if (r.uploadId !== uploadId || !r.matchedAgent) return r;
      return { ...r, payee: r.matchedAgent.name, iban: r.matchedAgent.account_number || r.iban, agentId: r.matchedAgent.id, matchedAgent: null };
    }));
  };

  const handleSendReview = async (rec) => {
    if (!rec.payee.trim() || !rec.amount || !rec.dueDate) {
      alert('შეავსეთ მიმღები, თანხა და გადახდის ვადა გაგზავნამდე.');
      return;
    }
    setReviewSendingId(rec.uploadId);
    try {
      await api.post('/accounting/transfers', {
        client_name: rec.payee.trim(),
        agent_id: rec.agentId || null,
        amount: parseFloat(rec.amount),
        due_date: rec.dueDate,
        description: rec.description || '',
        iban: rec.iban || null,
        invoice_number: rec.invoiceNumber || null,
        status: 'normal',
      });
      setReviewRecords(prev => prev.map(r => r.uploadId === rec.uploadId ? { ...r, sent: true } : r));
      setUploadRecords(prev => prev.map(r => r.id === rec.uploadId ? { ...r, sent: true } : r));
      setSentUploadIds(prev => new Set([...prev, rec.uploadId]));
      api.patch(`/accounting/invoices/uploads/${rec.uploadId}`, { sent: true }).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.error || 'გაგზავნა ვერ მოხერხდა.');
    } finally {
      setReviewSendingId(null);
    }
  };

  const reviewNext = () => setReviewIndex(i => Math.min(i + 1, (reviewRecords?.length || 1) - 1));
  const reviewPrev = () => setReviewIndex(i => Math.max(i - 1, 0));
  const closeReview = () => { setReviewRecords(null); setReviewIndex(0); setTab('uploads'); };

  const [rescanningId, setRescanningId] = useState(null);
  const handleUploadRescan = async (id) => {
    setRescanningId(id);
    try {
      const res = await api.post(`/accounting/invoices/uploads/${id}/rescan`);
      const r = res.data.upload;
      setUploadRecords(prev => prev.map(rec => rec.id === id ? { ...rec, extracted: r.extracted } : rec));
    } catch {} finally { setRescanningId(null); }
  };

  // Send straight from the Invoice List row using whatever was already
  // extracted -- for rows still missing something, direct to Edit
  // Transactions instead of allowing a half-filled transfer.
  const [quickSendingId, setQuickSendingId] = useState(null);
  const handleQuickSend = async (rec) => {
    const payee = rec.extracted?.payee || '';
    const amount = rec.extracted?.amount;
    const dueDate = rec.dueDate || rec.extracted?.due_date || '';
    if (!payee.trim() || !amount || !dueDate) {
      alert('მიმღები, თანხა ან გადახდის ვადა არ არის ამოცნობილი — გამოიყენეთ "Edit Transactions" ხელით შესავსებად.');
      return;
    }
    setQuickSendingId(rec.id);
    try {
      await api.post('/accounting/transfers', {
        client_name: payee.trim(),
        agent_id: rec.extracted?.matched_agent?.id || null,
        amount: parseFloat(amount),
        due_date: dueDate,
        description: rec.extracted?.description || '',
        iban: rec.extracted?.account_number || null,
        invoice_number: rec.extracted?.invoice_number || null,
        status: 'normal',
      });
      markSent(rec.id);
    } catch (err) {
      alert(err.response?.data?.error || 'გაგზავნა ვერ მოხერხდა.');
    } finally {
      setQuickSendingId(null);
    }
  };

  const exportRecordsToExcel = (records, filenameSuffix) => {
    const rows = records.map((r, idx) => ({
      '№': idx + 1,
      'ფაილი': r.fileName,
      'მიმღები': r.extracted?.payee || '',
      'თანხა': r.extracted?.amount || '',
      'ვალუტა': r.extracted?.currency || '',
      'ინვოისის №': r.extracted?.invoice_number || '',
      'ინვოისის თარიღი': fmtExcelDate(r.extracted?.invoice_date),
      'გადახდის ვადა': fmtExcelDate(r.dueDate || r.extracted?.due_date),
      'ბანკი': r.extracted?.bank_name || '',
      'ანგარიში/IBAN': r.extracted?.account_number || '',
      'SWIFT/BIC': r.extracted?.swift_bic || '',
      'აღწერა': r.extracted?.description || '',
      'ატვირთვის თარიღი': fmtExcelDate(r.uploadDate),
      'სასწრაფო': r.urgent ? 'დიახ' : 'არა',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices_${filenameSuffix}.xlsx`);
  };
  const handleExportExcel = () => exportRecordsToExcel(filteredUploadRecords, today());

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
      agentId: null,
      matchedAgent: r.extracted?.matched_agent || null,
    })));
    setEditSourceLabel(dateLabel);
    setTab('edit');
  };

  const updateEditField = (uploadId, field, value) => {
    setEditRecords(prev => prev.map(r => r.uploadId === uploadId ? { ...r, [field]: value } : r));
  };

  // Accept the suggested counterparty match: use their exact name/IBAN and
  // link the transfer to the real agent record instead of a free-typed name.
  const applyMatchedAgent = (uploadId) => {
    setEditRecords(prev => prev.map(r => {
      if (r.uploadId !== uploadId || !r.matchedAgent) return r;
      return {
        ...r,
        payee: r.matchedAgent.name,
        iban: r.matchedAgent.account_number || r.iban,
        agentId: r.matchedAgent.id,
        matchedAgent: null,
      };
    }));
  };

  const markSent = (uploadId) => {
    setSentUploadIds(prev => new Set([...prev, uploadId]));
    setEditRecords(prev => prev.map(r => r.uploadId === uploadId ? { ...r, sent: true } : r));
    setUploadRecords(prev => prev.map(r => r.id === uploadId ? { ...r, sent: true } : r));
    api.patch(`/accounting/invoices/uploads/${uploadId}`, { sent: true }).catch(() => {});
  };

  const handleSendToTransfers = async (rec) => {
    if (!rec.payee.trim() || !rec.amount || !rec.dueDate) {
      alert('შეავსეთ მიმღები, თანხა და გადახდის ვადა გაგზავნამდე.');
      return false;
    }
    setSendingId(rec.uploadId);
    try {
      await api.post('/accounting/transfers', {
        client_name: rec.payee.trim(),
        agent_id: rec.agentId || null,
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

  const handleExportEditRecordsToExcel = () => {
    const headersKa = ['მიმღების ანგარიში', 'მიმღების სახელი და გვარი', 'თანხა', 'დანიშნულება'];
    const headersEn = ['Account Number', "Employee's Name", 'Amount', 'Description'];
    const wsData = [
      headersKa,
      headersEn,
      ...editRecords.map(r => [r.iban || '', r.payee || '', parseFloat(r.amount || 0), r.description || '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `transactions_${editSourceLabel || today()}.xlsx`);
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

  const [uploadFilters, setUploadFilters] = useState({ fileName: '', period: 'all', periodFrom: '', periodTo: '', urgent: 'all' });
  const uf = uploadFilters;

  // "period" filters by upload date — the same date the day-blocks below are
  // grouped by — either a quick preset (last N days / this month) or a
  // custom from/to range, replacing what used to be two separate exact-date
  // filters (invoice date, due date) that couldn't express a range at all.
  const PERIOD_PRESETS = [
    { key: 'all',   label: 'ყველა დრო' },
    { key: '7d',    label: 'ბოლო 7 დღე' },
    { key: '14d',   label: 'ბოლო 2 კვირა' },
    { key: '30d',   label: 'ბოლო 30 დღე' },
    { key: 'month', label: 'ეს თვე' },
    { key: 'custom', label: 'მორგებული პერიოდი' },
  ];
  const periodRange = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // Local calendar date, not toISOString()'s UTC conversion — that shifts
    // the date back a day (excluding "today") in any UTC+ timezone.
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (uf.period === '7d') { const from = new Date(today); from.setDate(from.getDate() - 6); return { from: iso(from), to: iso(today) }; }
    if (uf.period === '14d') { const from = new Date(today); from.setDate(from.getDate() - 13); return { from: iso(from), to: iso(today) }; }
    if (uf.period === '30d') { const from = new Date(today); from.setDate(from.getDate() - 29); return { from: iso(from), to: iso(today) }; }
    if (uf.period === 'month') { const from = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(from), to: iso(today) }; }
    if (uf.period === 'custom') return { from: uf.periodFrom || null, to: uf.periodTo || null };
    return null;
  })();

  const filteredUploadRecords = uploadRecords.filter(r => {
    if (uf.fileName) {
      const q = uf.fileName.toLowerCase();
      const hay = [r.fileName, r.extracted?.payee, r.extracted?.invoice_number].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (periodRange) {
      if (periodRange.from && (!r.uploadDate || r.uploadDate < periodRange.from)) return false;
      if (periodRange.to && (!r.uploadDate || r.uploadDate > periodRange.to)) return false;
    }
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

  // ── Calendar tab — transfers by due date ──────────────────
  const [calTransfers, setCalTransfers] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const calToday = new Date();
  const [calYear, setCalYear] = useState(calToday.getFullYear());
  const [calMonth, setCalMonth] = useState(calToday.getMonth());
  const [calSelectedDay, setCalSelectedDay] = useState(null);
  const loadCalTransfers = async () => {
    setCalLoading(true);
    try {
      const res = await api.get('/accounting/transfers');
      setCalTransfers(res.data.records || []);
    } catch {} finally { setCalLoading(false); }
  };
  const CAL_STATUS = {
    pending:  { label: 'მოლოდინში', color: '#d97706' },
    approved: { label: 'დამტკიცებული', color: '#479c73' },
    rejected: { label: 'უარყოფილი', color: '#dc2626' },
    partial:  { label: 'ნაწილობრივი', color: '#2563eb' },
  };
  const calEventsByDate = {};
  calTransfers.forEach(tr => {
    const d = (tr.due_date || '').slice(0, 10);
    if (!d) return;
    (calEventsByDate[d] = calEventsByDate[d] || []).push(tr);
  });
  const CAL_DAYS = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
  const CAL_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const calPrevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); setCalSelectedDay(null); };
  const calNextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); setCalSelectedDay(null); };
  const calGoToday = () => { setCalYear(calToday.getFullYear()); setCalMonth(calToday.getMonth()); setCalSelectedDay(null); };
  const calFirstDay = new Date(calYear, calMonth, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calDaysInPrev = new Date(calYear, calMonth, 0).getDate();
  const calCells = [];
  for (let i = calFirstDay - 1; i >= 0; i--) calCells.push({ day: calDaysInPrev - i, cur: false });
  for (let d = 1; d <= calDaysInMonth; d++) calCells.push({ day: d, cur: true });
  const calTrailing = 42 - calCells.length;
  for (let d = 1; d <= calTrailing; d++) calCells.push({ day: d, cur: false });
  const calTodayKey = today();
  const calDayKey = (d) => `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const calSelectedEvents = calSelectedDay ? (calEventsByDate[calDayKey(calSelectedDay)] || []) : [];

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
        <button className={`docs-inner-tab${tab === 'calendar' ? ' active' : ''}`} onClick={() => { setTab('calendar'); loadCalTransfers(); }}>
          <HugeiconsIcon icon={Calendar03Icon} size={15} color="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Calendar
        </button>
      </div>

      {/* ── UPLOAD TAB: multi-upload -> extract -> one-by-one review ── */}
      {tab === 'upload' && (
        <div style={{ maxWidth: reviewRecords ? 720 : 640 }}>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleMultiFiles(e.target.files)}
          />

          {reviewRecords ? (() => {
            const rec = reviewRecords[reviewIndex];
            return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>ინვოისი {reviewIndex + 1} / {reviewRecords.length}</div>
                    <button onClick={() => handleUploadView({ id: rec.uploadId })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: '#3b82f6', textDecoration: 'underline', fontFamily: 'inherit' }}>
                      {rec.fileName}
                    </button>
                  </div>
                  <button onClick={closeReview} title="დახურვა" style={{ width: 28, height: 28, border: '1px solid var(--border-2)', background: 'var(--surface)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
                </div>

                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginBottom: 14, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 9 }}>
                    <span style={{ fontSize: 14, lineHeight: '16px' }}>⚠️</span>
                    <span style={{ fontSize: 12, color: '#b45309' }}>მონაცემები ამოღებულია AI-ს დახმარებით და შეიძლება არასწორი იყოს — გთხოვთ გადაამოწმოთ გაგზავნამდე.</span>
                  </div>
                  {rec.extractFailed && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', marginBottom: 16, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 9 }}>
                      <span style={{ fontSize: 12, color: '#dc2626' }}>ტექსტი ვერ ამოიცნო — შეავსეთ ხელით ან სცადეთ ხელახლა.</span>
                      <button onClick={() => handleReviewRetry(rec.uploadId)} disabled={reviewRetryingId === rec.uploadId} style={{ padding: '4px 10px', background: 'var(--surface)', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {reviewRetryingId === rec.uploadId ? '...' : 'ხელახლა სკანირება'}
                      </button>
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={reviewLbl}>მიმღები</label>
                    <input value={rec.payee} onChange={e => updateReviewField(rec.uploadId, 'payee', e.target.value)} placeholder="მიმღები" style={reviewInp} disabled={rec.sent} />
                    {rec.matchedAgent && (
                      <button type="button" onClick={() => applyReviewMatchedAgent(rec.uploadId)} title={rec.matchedAgent.account_number || ''}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, padding: '3px 8px', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' }}>
                        🔎 {rec.matchedAgent.name}{rec.matchedAgent.account_number ? ` · ${rec.matchedAgent.account_number}` : ''}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={reviewLbl}>თანხა</label>
                      <input type="number" min="0" step="0.01" value={rec.amount} onChange={e => updateReviewField(rec.uploadId, 'amount', e.target.value)} placeholder="0.00" style={{ ...reviewInp, fontFamily: 'var(--font-mono)' }} disabled={rec.sent} />
                    </div>
                    <div>
                      <label style={reviewLbl}>ვალუტა</label>
                      <select value={rec.currency} onChange={e => updateReviewField(rec.uploadId, 'currency', e.target.value)} style={reviewInp} disabled={rec.sent}>
                        <option>GEL</option><option>USD</option><option>EUR</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={reviewLbl}>ინვოისის №</label>
                      <input value={rec.invoiceNumber} onChange={e => updateReviewField(rec.uploadId, 'invoiceNumber', e.target.value)} placeholder="INV-0001" style={reviewInp} disabled={rec.sent} />
                    </div>
                    <div>
                      <label style={reviewLbl}>გადახდის ვადა</label>
                      <input type="date" value={rec.dueDate} onChange={e => updateReviewField(rec.uploadId, 'dueDate', e.target.value)} style={reviewInp} disabled={rec.sent} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={reviewLbl}>IBAN/ანგარიში</label>
                    <input value={rec.iban} onChange={e => updateReviewField(rec.uploadId, 'iban', e.target.value)} placeholder="GE00XX..." style={{ ...reviewInp, fontFamily: 'var(--font-mono)' }} disabled={rec.sent} />
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <label style={reviewLbl}>აღწერა</label>
                    <input value={rec.description} onChange={e => updateReviewField(rec.uploadId, 'description', e.target.value)} placeholder="აღწერა" style={reviewInp} disabled={rec.sent} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderTop: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={reviewPrev} disabled={reviewIndex === 0} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: reviewIndex === 0 ? 'not-allowed' : 'pointer', opacity: reviewIndex === 0 ? 0.5 : 1 }}>‹ წინა</button>
                    <button onClick={reviewNext} disabled={reviewIndex === reviewRecords.length - 1} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: reviewIndex === reviewRecords.length - 1 ? 'not-allowed' : 'pointer', opacity: reviewIndex === reviewRecords.length - 1 ? 0.5 : 1 }}>შემდეგი ›</button>
                  </div>
                  {rec.sent ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#479c73' }}>
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#479c73" strokeWidth={2.5} /> გაგზავნილია
                    </span>
                  ) : (
                    <button onClick={() => handleSendReview(rec)} disabled={reviewSendingId === rec.uploadId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: reviewSendingId === rec.uploadId ? 0.6 : 1 }}>
                      <HugeiconsIcon icon={SentIcon} size={13} color="#fff" strokeWidth={2} />
                      {reviewSendingId === rec.uploadId ? 'იგზავნება...' : 'Send to Transfer'}
                    </button>
                  )}
                </div>
              </div>
            );
          })() : extracting ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                ტექსტის ამოცნობა — {extractProgress.current} / {extractProgress.total}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-4)' }}>წარუმატებელი ფაილები გამოტოვდება და გაგრძელდება შემდეგზე.</div>
            </div>
          ) : (
            <>
              <div
                onClick={() => uploadInputRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleMultiFiles(e.dataTransfer.files); }}
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
                  {uploadingMulti ? 'იტვირთება…' : 'დააჭირეთ ან ჩააგდეთ რამდენიმე ინვოისი'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>PDF, JPG, PNG — თითო ფაილი მაქს. 10MB, ერთდროულად რამდენიმე</div>
              </div>

              {multiUploadError && <div className="msg-error" style={{ marginTop: 14 }}>{multiUploadError}</div>}

              {pendingFiles.length > 0 && (
                <div style={{ marginTop: 18, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-2)', fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>
                    ატვირთულია, მზადაა ამოსაცნობად ({pendingFiles.length})
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {pendingFiles.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border-3)' }}>
                        <span style={{ fontSize: 16 }}>📄</span>
                        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.fileName}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 14 }}>
                    <button onClick={handleExtractAll} className="btn-add" style={{ width: '100%' }}>
                      ტექსტის ამოცნობა ({pendingFiles.length})
                    </button>
                  </div>
                </div>
              )}
            </>
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
                <select
                  value={uf.period}
                  onChange={e => setUF('period', e.target.value)}
                  title="პერიოდი"
                  style={{ padding: '7px 8px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                >
                  {PERIOD_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                {uf.period === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={uf.periodFrom}
                      onChange={e => setUF('periodFrom', e.target.value)}
                      title="დან"
                      style={{ padding: '7px 8px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                    />
                    <input
                      type="date"
                      value={uf.periodTo}
                      onChange={e => setUF('periodTo', e.target.value)}
                      title="მდე"
                      style={{ padding: '7px 8px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                    />
                  </>
                )}
                <select
                  value={uf.urgent}
                  onChange={e => setUF('urgent', e.target.value)}
                  style={{ padding: '7px 8px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                >
                  <option value="all">ყველა</option>
                  <option value="yes">სასწრაფო</option>
                  <option value="no">ჩვეულებრივი</option>
                </select>
                {(uf.fileName || uf.period !== 'all' || uf.urgent !== 'all') && (
                  <button
                    onClick={() => setUploadFilters({ fileName: '', period: 'all', periodFrom: '', periodTo: '', urgent: 'all' })}
                    style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: 'var(--text-4)' }}
                  >
                    გასუფთავება
                  </button>
                )}
                <button
                  onClick={handleExportExcel}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#479c73', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}
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
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--surface-2)', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text-4)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{dateGroupLabel(date)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 20, padding: '2px 10px' }}>
                        {dayRecords.length}
                      </span>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={e => { e.stopPropagation(); exportRecordsToExcel(dayRecords, date); }}
                          title="ამ დღის Excel-ში გატანა"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#479c73', cursor: 'pointer' }}
                        >
                          <HugeiconsIcon icon={FileSpreadsheetIcon} size={12} color="currentColor" strokeWidth={2} />
                          Excel
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); openEditTransactions(date, dayRecords); }}
                          title="მონაცემების რედაქტირება და Transfers-ში გაგზავნა"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}
                        >
                          <HugeiconsIcon icon={TaskEdit01Icon} size={12} color="currentColor" strokeWidth={2} />
                          Edit Transactions
                        </button>
                      </div>
                    </div>

                    {/* Block body */}
                    {isOpen && (
                      <div className="acc-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="acc-table" style={{ minWidth: 1200 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>№</th>
                              <th style={{ width: 200 }}>ფაილი</th>
                              <th style={{ width: 150 }}>მიმღები</th>
                              <th style={{ width: 110 }}>თანხა</th>
                              <th style={{ width: 120 }}>ინვოისის №</th>
                              <th style={{ width: 120 }}>ინვოისის თარიღი</th>
                              <th style={{ width: 120 }}>გადახდის ვადა</th>
                              <th style={{ width: 90, textAlign: 'center' }}>სასწრაფო</th>
                              <th style={{ width: 220 }}></th>
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
                                    <td colSpan={4}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-4)' }}>
                                        <span style={{ fontStyle: 'italic' }}>ტექსტი ჯერ არ ამოცნობილა</span>
                                        <button
                                          onClick={() => handleUploadRescan(rec.id)}
                                          disabled={rescanningId === rec.id}
                                          style={{ padding: '2px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}
                                        >
                                          {rescanningId === rec.id ? '...' : 'ტექსტის ამოცნობა'}
                                        </button>
                                      </div>
                                    </td>
                                  ) : (
                                    <>
                                      <td style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{ex.payee || '—'}</td>
                                      <td style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{ex.amount ? `${ex.amount} ${ex.currency || ''}` : '—'}</td>
                                      <td style={{ fontSize: 13, color: 'var(--text-3)' }}>{ex.invoice_number || '—'}</td>
                                      <td style={{ fontSize: 13, color: 'var(--text-3)' }}>{fmtDate(ex.invoice_date)}</td>
                                    </>
                                  )}
                                  <td style={{ fontSize: 13, color: 'var(--text-3)' }}>{fmtDate(rec.dueDate)}</td>
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
                                      {rec.sent ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(71,156,115,0.15)', border: '1px solid rgba(71,156,115,0.3)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#479c73', whiteSpace: 'nowrap' }}>
                                          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color="#479c73" strokeWidth={2.5} />
                                          გაგზავნილია
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleQuickSend(rec)}
                                          disabled={quickSendingId === rec.id}
                                          title="გაგზავნა Transfers-ში"
                                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#2563eb', fontWeight: 600, whiteSpace: 'nowrap' }}
                                        >
                                          <HugeiconsIcon icon={SentIcon} size={12} color="#2563eb" strokeWidth={2} />
                                          {quickSendingId === rec.id ? '...' : 'გაგზავნა'}
                                        </button>
                                      )}
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
                  onClick={handleExportEditRecordsToExcel}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'var(--surface)', color: '#479c73', border: '1.5px solid var(--border-2)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <HugeiconsIcon icon={FileSpreadsheetIcon} size={14} color="#479c73" strokeWidth={2} />
                  Excel-ში შენახვა
                </button>
                <button
                  onClick={handleSendAllToTransfers}
                  disabled={sendingAll || editRecords.every(r => r.sent)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: sendingAll ? 'not-allowed' : 'pointer', opacity: sendingAll || editRecords.every(r => r.sent) ? 0.6 : 1 }}
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
                      <th style={{ width: 170 }}>მიმღები</th>
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(71,156,115,0.15)', border: '1px solid rgba(71,156,115,0.3)', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#479c73' }}>
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#479c73" strokeWidth={2.5} />
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
                          <input value={rec.payee} onChange={e => updateEditField(rec.uploadId, 'payee', e.target.value)} placeholder="მიმღები" style={editInpStyle} />
                          {rec.matchedAgent && (
                            <button
                              type="button"
                              onClick={() => applyMatchedAgent(rec.uploadId)}
                              title={rec.matchedAgent.account_number || ''}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, padding: '3px 8px', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' }}
                            >
                              🔎 {rec.matchedAgent.name}{rec.matchedAgent.account_number ? ` · ${rec.matchedAgent.account_number}` : ''}
                            </button>
                          )}
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

      {/* ── CALENDAR TAB — transfers by due date ─────── */}
      {tab === 'calendar' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden', minWidth: 320 }}>
            <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={calPrevMonth} style={calNavBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg></button>
              <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{CAL_MONTHS[calMonth]} {calYear}</div>
              <button onClick={calNextMonth} style={calNavBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg></button>
              <button onClick={calGoToday} style={{ padding: '5px 12px', border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563eb' }}>დღეს</button>
              {calLoading && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>იტვირთება…</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px', gap: 2, marginBottom: 4 }}>
              {CAL_DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-4)', padding: '4px 0' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px 16px', gap: 2 }}>
              {calCells.map((cell, idx) => {
                if (!cell.cur) return <div key={idx} style={{ minHeight: 56, padding: '6px 4px', opacity: 0.3 }}><div style={{ fontSize: 12, color: 'var(--text-4)' }}>{cell.day}</div></div>;
                const key = calDayKey(cell.day);
                const isToday = key === calTodayKey;
                const isSelected = calSelectedDay === cell.day;
                const evs = calEventsByDate[key] || [];
                const dayTotal = evs.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                return (
                  <div key={idx} onClick={() => setCalSelectedDay(isSelected ? null : cell.day)}
                    style={{
                      minHeight: 56, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      background: isSelected ? 'var(--surface-2)' : isToday ? 'var(--surface-2)' : 'transparent',
                      border: isSelected ? '2px solid #2563eb' : isToday ? '2px solid var(--border-2)' : '2px solid transparent',
                    }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isToday || isSelected ? 700 : 500, color: isToday ? '#2563eb' : 'var(--text)' }}>{cell.day}</div>
                    {evs.length > 0 && (
                      <>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {evs.slice(0, 4).map((e, i) => (
                            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: (CAL_STATUS[e.approval_status || 'pending'] || CAL_STATUS.pending).color }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{dayTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--border-3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {Object.entries(CAL_STATUS).map(([key, s]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            {calSelectedDay ? (
              <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-3)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{CAL_MONTHS[calMonth]} {calSelectedDay}, {calYear}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>{calSelectedEvents.length} გადარიცხვა</div>
                </div>
                {calSelectedEvents.length === 0 ? (
                  <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>ამ დღეს გადარიცხვები არ არის.</div>
                ) : (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {calSelectedEvents.map(tr => {
                      const st = CAL_STATUS[tr.approval_status || 'pending'] || CAL_STATUS.pending;
                      return (
                        <div key={tr.id} style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 9, borderLeft: `3px solid ${st.color}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: st.color, textTransform: 'uppercase' }}>{st.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{parseFloat(tr.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>{tr.client_name || '—'}</div>
                          {tr.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{tr.description}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', padding: '28px 20px', textAlign: 'center', fontSize: 12, color: 'var(--text-4)' }}>
                დააჭირეთ თარიღს, რომ ნახოთ იმ დღის გადარიცხვები.
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}

const editInpStyle = { width: '100%', padding: '6px 8px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' };
const reviewLbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.03em' };
const reviewInp = { width: '100%', padding: '9px 11px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' };
const calNavBtn = { width: 30, height: 30, border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' };
const today = () => new Date().toISOString().split('T')[0];
const fmtDate = (d) => {
  if (!d) return '—';
  const parsed = new Date(d);
  return isNaN(parsed) ? '—' : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export default Invoices;
