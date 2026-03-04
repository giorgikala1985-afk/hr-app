import React, { useState } from 'react';
import PdfParsingTool from './PdfParsingTool';

const TABS = [
  {
    key: 'pdf',
    label: 'PDF Parsing',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
    ),
  },
];

function ToolsPage() {
  const [activeTab, setActiveTab] = useState('pdf');

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 20px', border: 'none', borderRadius: 7,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#1e293b' : '#64748b',
              boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'pdf' && <PdfParsingTool />}
    </div>
  );
}

export default ToolsPage;
