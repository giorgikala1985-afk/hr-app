import React, { useState, useEffect } from 'react';
import SalaryAccrual from './SalaryAccrual';
import SalariesFile from './SalariesFile';
import PersonalIncomeTax from './PersonalIncomeTax';
import Transferred from './Transferred';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../services/api';

const SUBTAB_KEYS = [
  { key: 'accrual',     labelKey: 'salPage.calculation' },
  { key: 'file',        labelKey: 'salPage.salariesFile' },
  { key: 'pit',         labelKey: 'salPage.pit' },
  { key: 'transferred', label: 'Transferred' },
];

const todayMonth = () => new Date().toISOString().slice(0, 7);

// Salary files used to live only in the browser's localStorage (lost on
// device/browser switch, and briefly bled across orgs sharing a browser
// before being namespaced). Now persisted server-side in `salary_files`,
// scoped by user_id the same way every other table in this app is.
const fromApi = (f) => f ? {
  month: f.month, transferDate: f.transfer_date, rate: f.rate, rows: f.rows,
  sentToTransfers: f.sent_to_transfers, sentAt: f.sent_at,
} : null;

async function loadFile(month) {
  try {
    const res = await api.get(`/salaries/file/${month}`);
    return fromApi(res.data.file);
  } catch { return null; }
}

function SalariesPage() {
  const { t } = useLanguage();
  const SUBTABS = SUBTAB_KEYS.map(s => ({ ...s, label: s.label || t(s.labelKey) }));
  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [salaryFile, setSalaryFile] = useState(null);
  const [subTab, setSubTab] = useState('accrual');

  useEffect(() => { loadFile(todayMonth()).then(setSalaryFile); }, []);

  const handleMonthChange = async (month) => {
    setCurrentMonth(month);
    setSalaryFile(await loadFile(month));
  };

  const handleCreateSalaryFile = async (data) => {
    try {
      const res = await api.post('/salaries/file', {
        month: data.month, transfer_date: data.transferDate, rate: data.rate, rows: data.rows,
      });
      setSalaryFile(fromApi(res.data.file));
      setSubTab('file');
    } catch (err) {
      window.alert(err.response?.data?.error || 'Failed to save the salary file.');
    }
  };

  const handleClear = async () => {
    try { await api.delete(`/salaries/file/${currentMonth}`); } catch {}
    setSalaryFile(null);
    setSubTab('accrual');
  };

  const handleSent = async () => {
    if (!salaryFile) return;
    try {
      const res = await api.patch(`/salaries/file/${salaryFile.month}`, { sent_to_transfers: true });
      setSalaryFile(fromApi(res.data.file));
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Subtab bar */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {SUBTABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            style={{
              padding: '6px 20px', border: 'none', borderRadius: 7,
              fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              background: subTab === tab.key ? 'var(--surface)' : 'transparent',
              color: subTab === tab.key ? 'var(--text)' : 'var(--text-3)',
              boxShadow: subTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'accrual' && (
        <SalaryAccrual
          onCreateSalaryFile={handleCreateSalaryFile}
          onMonthChange={handleMonthChange}
        />
      )}
      {subTab === 'file' && (
        <SalariesFile data={salaryFile} onClear={handleClear} onSent={handleSent} />
      )}
      {subTab === 'pit' && (
        <PersonalIncomeTax />
      )}
      {subTab === 'transferred' && (
        <Transferred month={currentMonth} />
      )}
    </div>
  );
}

export default SalariesPage;
