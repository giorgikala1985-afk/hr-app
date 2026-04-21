import React, { useState } from 'react';
import SalaryAccrual from './SalaryAccrual';
import SalariesFile from './SalariesFile';
import PersonalIncomeTax from './PersonalIncomeTax';

const SUBTABS = [
  { key: 'accrual', label: 'Calculation' },
  { key: 'file',    label: 'Salaries File' },
  { key: 'pit',     label: 'Personal Income Tax' },
];

const todayMonth = () => new Date().toISOString().slice(0, 7);
const fileKey = (month) => `salary_file_data_${month}`;

function loadFile(month) {
  try {
    const saved = localStorage.getItem(fileKey(month));
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function SalariesPage() {
  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [salaryFile, setSalaryFile] = useState(() => loadFile(todayMonth()));
  const [subTab, setSubTab] = useState('accrual');

  const handleMonthChange = (month) => {
    setCurrentMonth(month);
    setSalaryFile(loadFile(month));
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
        <SalariesFile data={salaryFile} onClear={handleClear} />
      )}
      {subTab === 'pit' && (
        <PersonalIncomeTax />
      )}
    </div>
  );
}

export default SalariesPage;
