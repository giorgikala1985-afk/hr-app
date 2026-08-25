import React, { useState } from 'react';
import SalaryAccrual from './SalaryAccrual';
import SalariesFile from './SalariesFile';
import PersonalIncomeTax from './PersonalIncomeTax';
import Transferred from './Transferred';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

const SUBTAB_KEYS = [
  { key: 'accrual',     labelKey: 'salPage.calculation' },
  { key: 'file',        labelKey: 'salPage.salariesFile' },
  { key: 'pit',         labelKey: 'salPage.pit' },
  { key: 'transferred', label: 'Transferred' },
];

const todayMonth = () => new Date().toISOString().slice(0, 7);

function loadFile(fileKey, month) {
  try {
    const saved = localStorage.getItem(fileKey(month));
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function SalariesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  // localStorage is scoped per browser origin, not per logged-in company —
  // an un-namespaced key here let one organization's cached salary file leak
  // into another's view when the same browser is used to log into more than
  // one org. Namespace by the current tenant so each org only ever sees its
  // own generated file (same fix already applied to Orders.js's local orders).
  const fileKey = (month) => `salary_file_data_${user?.id || 'anon'}_${month}`;
  const SUBTABS = SUBTAB_KEYS.map(s => ({ ...s, label: s.label || t(s.labelKey) }));
  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [salaryFile, setSalaryFile] = useState(() => loadFile(fileKey, todayMonth()));
  const [subTab, setSubTab] = useState('accrual');

  const handleMonthChange = (month) => {
    setCurrentMonth(month);
    setSalaryFile(loadFile(fileKey, month));
  };

  const handleCreateSalaryFile = (data) => {
    setSalaryFile(data);
    localStorage.setItem(fileKey(data.month), JSON.stringify(data));
    setSubTab('file');
  };

  const handleClear = () => {
    setSalaryFile(null);
    localStorage.removeItem(fileKey(currentMonth));
    setSubTab('accrual');
  };

  const handleSent = () => {
    setSalaryFile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, sentToTransfers: true, sentAt: new Date().toISOString() };
      localStorage.setItem(fileKey(updated.month), JSON.stringify(updated));
      return updated;
    });
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
