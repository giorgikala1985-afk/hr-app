import React, { useState } from 'react';
import ImportEmployees from './ImportEmployees';
import HolidayList from '../Holidays/HolidayList';
import './Options.css';

const tabs = [
  { key: 'import', label: 'Import Employees', icon: '📥' },
  { key: 'holidays', label: 'Holidays', icon: '📅' }
];

function OptionsPage() {
  const [activeTab, setActiveTab] = useState('import');

  return (
    <div className="options-container">
      <div className="options-header">
        <h1>Options</h1>
        <p>Application settings and tools</p>
      </div>

      <div className="emp-edit-layout">
        <div className="emp-sidebar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`emp-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="emp-tab-content">
          {activeTab === 'import' && <ImportEmployees />}
          {activeTab === 'holidays' && <HolidayList />}
        </div>
      </div>
    </div>
  );
}

export default OptionsPage;
