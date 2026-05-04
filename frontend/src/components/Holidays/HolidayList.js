import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_WIDTHS = [150, 220, 68];

const HOLIDAY_NAMES = [
  'New Year',
  'Christmas',
  'Easter',
  'Heavy Monday',
  'Didgori Battle',
  "Developer's Birthday / Stalin's Death",
  'Custom',
];

const HOLIDAY_DATES = {
  'New Year': '01-01',
  'Christmas': '01-07',
  'Didgori Battle': '08-12',
  "Developer's Birthday / Stalin's Death": '03-05',
};

// Official Georgian public holidays (fixed dates; Easter is calculated separately)
const GEORGIAN_HOLIDAYS_FIXED = [
  { month: '01', day: '01', name: 'New Year' },
  { month: '01', day: '02', name: "New Year's Holiday" },
  { month: '01', day: '07', name: 'Orthodox Christmas' },
  { month: '01', day: '19', name: 'Orthodox Epiphany' },
  { month: '03', day: '03', name: "Mother's Day" },
  { month: '03', day: '08', name: "International Women's Day" },
  { month: '04', day: '09', name: 'National Unity Day' },
  { month: '05', day: '09', name: 'Victory Day' },
  { month: '05', day: '12', name: 'Saint Andrew the First-Called Day' },
  { month: '05', day: '26', name: 'Independence Day' },
  { month: '08', day: '28', name: 'Saint Mary Day' },
  { month: '10', day: '14', name: 'Svetitskhovloba' },
  { month: '11', day: '23', name: 'Saint George Day' },
];

// Orthodox Easter calculation (Julian calendar → Gregorian)
function getOrthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const f = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // Julian to Gregorian: add 13 days
  const julian = new Date(year, f - 1, day + 13);
  return julian;
}

function getGeorgianHolidaysForYear(year) {
  const holidays = GEORGIAN_HOLIDAYS_FIXED.map(h => ({
    date: `${year}-${h.month}-${h.day}`,
    name: h.name,
  }));
  // Orthodox Easter Sunday
  const easter = getOrthodoxEaster(year);
  const pad = n => String(n).padStart(2, '0');
  holidays.push({
    date: `${easter.getFullYear()}-${pad(easter.getMonth() + 1)}-${pad(easter.getDate())}`,
    name: 'Orthodox Easter',
  });
  // Orthodox Good Friday (2 days before Easter)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({
    date: `${goodFriday.getFullYear()}-${pad(goodFriday.getMonth() + 1)}-${pad(goodFriday.getDate())}`,
    name: 'Good Friday',
  });
  // Orthodox Easter Monday
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({
    date: `${easterMonday.getFullYear()}-${pad(easterMonday.getMonth() + 1)}-${pad(easterMonday.getDate())}`,
    name: 'Easter Monday',
  });
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

const EMPTY_FILTERS = { date: '', name: '' };

const filterInput = {
  width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '3px 6px',
  border: '1px solid #d1d5db', borderRadius: 5, background: '#f9fafb',
  color: '#374151', outline: 'none', marginTop: 4, fontFamily: 'inherit',
};

function HolidayList() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const currentYear = new Date().getFullYear();

  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [formCustomName, setFormCustomName] = useState('');
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [importing, setImporting] = useState(false);

  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) years.push(y);

  useEffect(() => { loadHolidays(year); }, [year]);

  const loadHolidays = async (selectedYear) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/holidays', { params: { year: selectedYear } });
      setHolidays(response.data.holidays);
    } catch (err) {
      setError(t('hol.loadFailed') + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  const filtered = useMemo(() => holidays.filter(hol => {
    if (filters.date && !formatDate(hol.date).toLowerCase().includes(filters.date.toLowerCase())) return false;
    if (filters.name && !hol.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    return true;
  }), [holidays, filters]);

  const hasFilters = Object.values(filters).some(Boolean);

  const openNew = () => {
    setEditId(null);
    setFormDate('');
    setFormName('');
    setFormCustomName('');
    setError('');
    setShowForm(true);
  };

  const openEdit = (hol) => {
    setEditId(hol.id);
    setFormDate(hol.date);
    const isPreset = HOLIDAY_NAMES.filter(n => n !== 'Custom').includes(hol.name);
    setFormName(isPreset ? hol.name : 'Custom');
    setFormCustomName(isPreset ? '' : hol.name);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formDate) { setError('Date is required.'); return; }
    if (!formName) { setError('Name is required.'); return; }
    if (formName === 'Custom' && !formCustomName.trim()) { setError('Custom name is required.'); return; }

    const finalName = formName === 'Custom' ? formCustomName : formName;
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.put(`/holidays/${editId}`, { date: formDate, name: finalName });
        setSuccess(t('hol.updatedSuccess'));
      } else {
        await api.post('/holidays', { date: formDate, name: finalName });
        setSuccess(t('hol.addedSuccess'));
      }
      setShowForm(false);
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || t('hol.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hol) => {
    if (!window.confirm(`Delete "${hol.name}" on ${formatDate(hol.date)}?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/holidays/${hol.id}`);
      setSuccess(t('hol.deletedSuccess'));
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || t('hol.deleteFailed'));
    }
  };

  const handleImportGeorgian = async () => {
    const toImport = getGeorgianHolidaysForYear(year);
    const existing = new Set(holidays.map(h => h.date.slice(0, 10)));
    const newOnes = toImport.filter(h => !existing.has(h.date));
    if (newOnes.length === 0) {
      setSuccess('All Georgian holidays already exist for this year.');
      return;
    }
    if (!window.confirm(`Add ${newOnes.length} Georgian holiday(s) for ${year}?`)) return;
    setImporting(true);
    setError('');
    try {
      await Promise.all(newOnes.map(h => api.post('/holidays', h)));
      setSuccess(`Added ${newOnes.length} Georgian holiday(s) for ${year}.`);
      loadHolidays(year);
    } catch (err) {
      setError('Failed to import some holidays: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  const COLS = [
    { label: t('hol.date'),       key: 'date' },
    { label: t('hol.nameColumn'), key: 'name' },
    { label: '',                  key: null },
  ];

  return (
    <div className="acc-content-narrow">
      <h2>{t('hol.title')}</h2>
      <p className="acc-subtitle">{t('hol.subtitle')}</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total</span>
          <span className="acc-summary-value">
            {filtered.length}{hasFilters && filtered.length !== holidays.length ? ` / ${holidays.length}` : ''}
          </span>
        </div>
      </div>

      <div className="acc-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Year:</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '6px 12px', border: '1.5px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'white', color: '#1e293b', cursor: 'pointer' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 7, fontSize: 12, fontWeight: 500, color: '#92400e', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear filters
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleImportGeorgian}
            disabled={importing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 18px', height: 36, boxSizing: 'border-box', background: importing ? 'var(--surface-3)' : '#dc2626', color: importing ? 'var(--text-3)' : '#fff', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
            title="Import all official Georgian public holidays for the selected year"
          >
            🇬🇪 {importing ? 'Importing…' : 'Import Georgian Holidays'}
          </button>
          <button className="btn-add" onClick={openNew}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('hol.addBtn')}
          </button>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="msg-success" style={{ marginBottom: 12 }}>{success}</div>}

      <div className="acc-table-wrapper holidays-compact">
        {loading ? <div className="acc-empty"><p>{t('hol.loading')}</p></div>
          : holidays.length === 0 ? <div className="acc-empty"><p>{t('hol.noHolidays').replace('{year}', year)}</p></div>
          : filtered.length === 0 ? <div className="acc-empty"><p>No results match your filters.</p></div>
          : (
            <table className="acc-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
              <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead>
                <tr>
                  {COLS.map((col, i) => (
                    <th key={i} style={{ position: 'relative', width: colWidths[i], overflow: 'hidden', verticalAlign: 'top', paddingBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        {col.label}
                      </div>
                      <div onMouseDown={e => onResizeMouseDown(e, i)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(hol => (
                  <tr key={hol.id}>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 500, color: '#0f3460' }}>{formatDate(hol.date)}</td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{hol.name}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openEdit(hol)} title="Edit" style={{ color: '#3b82f6' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="btn-icon btn-delete" onClick={() => handleDelete(hol)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      <style>{`
        .acc-content-narrow { width: fit-content; min-width: 600px; max-width: 100%; }
        .holidays-compact .acc-table { font-size: 13px; }
        .holidays-compact .acc-table th { padding: 8px 12px; }
        .holidays-compact .acc-table td { padding: 7px 12px; }
      `}</style>

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? t('hol.editTitle') : t('hol.addTitle')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group">
                <label>{t('hol.name')} *</label>
                <select
                  value={formName}
                  onChange={e => {
                    const val = e.target.value;
                    setFormName(val);
                    setFormCustomName('');
                    if (HOLIDAY_DATES[val]) setFormDate(`${year}-${HOLIDAY_DATES[val]}`);
                  }}
                >
                  <option value="">— Select reason —</option>
                  {HOLIDAY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="acc-form-group">
                <label>{t('hol.date')} *</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              {formName === 'Custom' && (
                <div className="acc-form-group full">
                  <label>Custom Name *</label>
                  <input
                    type="text"
                    value={formCustomName}
                    onChange={e => setFormCustomName(e.target.value)}
                    placeholder="e.g. Company Anniversary"
                  />
                </div>
              )}
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('hol.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('hol.saving') : editId ? t('hol.update') : t('hol.addBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HolidayList;
