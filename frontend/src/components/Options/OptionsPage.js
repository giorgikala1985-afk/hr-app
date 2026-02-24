import React, { useState } from 'react';
import ImportEmployees from './ImportEmployees';
import HolidayList from '../Holidays/HolidayList';
import PaginationSettings from './PaginationSettings';
import UnitTypesSettings from './UnitTypesSettings';
import PositionsSettings from './PositionsSettings';
import LanguageSettings from './LanguageSettings';
import TaxSettings from './TaxSettings';
import { useLanguage } from '../../contexts/LanguageContext';
import './Options.css';

function OptionsPage() {
  const [activeTab, setActiveTab] = useState('import');
  const { t } = useLanguage();

  const tabs = [
    { key: 'import', label: t('options.import'), icon: '📥' },
    { key: 'holidays', label: t('options.holidays'), icon: '📅' },
    { key: 'positions', label: t('options.positions'), icon: '💼' },
    { key: 'units', label: t('options.unitTypes'), icon: '📊' },
    { key: 'pagination', label: t('options.pagination'), icon: '📄' },
    { key: 'tax', label: t('options.tax'), icon: '🧾' },
    { key: 'language', label: t('options.language'), icon: '🌐' }
  ];

  return (
    <div className="options-container">
      <div className="options-header">
        <h1>{t('options.title')}</h1>
        <p>{t('options.subtitle')}</p>
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
          {activeTab === 'positions' && <PositionsSettings />}
          {activeTab === 'units' && <UnitTypesSettings />}
          {activeTab === 'pagination' && <PaginationSettings />}
          {activeTab === 'tax' && <TaxSettings />}
          {activeTab === 'language' && <LanguageSettings />}
        </div>
      </div>
    </div>
  );
}

export default OptionsPage;
