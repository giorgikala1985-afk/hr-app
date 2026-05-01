import React, { useState, useRef } from 'react';

const CATEGORIES = ['All', 'HR', 'Finance', 'Payroll', 'Insurance', 'Reports'];

const SAMPLE_FILES = [
  { id: 1, name: 'Employee_Master_2024.xlsx', category: 'HR', size: '1.2 MB', uploaded: '2024-11-15', type: 'xlsx' },
  { id: 2, name: 'Payroll_October_2024.csv', category: 'Payroll', size: '340 KB', uploaded: '2024-10-31', type: 'csv' },
  { id: 3, name: 'Insurance_Q3_2024.pdf', category: 'Insurance', size: '2.8 MB', uploaded: '2024-09-30', type: 'pdf' },
  { id: 4, name: 'Finance_Annual_Report_2023.pdf', category: 'Finance', size: '5.1 MB', uploaded: '2024-01-20', type: 'pdf' },
  { id: 5, name: 'Salary_Changes_2024.xlsx', category: 'Payroll', size: '890 KB', uploaded: '2024-12-01', type: 'xlsx' },
];

const FILE_ICONS = {
  pdf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="11" y2="17"/>
    </svg>
  ),
  xlsx: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
    </svg>
  ),
  csv: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

function DataLake() {
  const [files, setFiles] = useState(SAMPLE_FILES);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const filtered = files.filter(f => {
    const matchCat = activeCategory === 'All' || f.category === activeCategory;
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  const handleFileInput = (e) => {
    const selected = Array.from(e.target.files);
    addFiles(selected);
    e.target.value = '';
  };

  const addFiles = (rawFiles) => {
    if (!rawFiles.length) return;
    setUploading(true);
    setTimeout(() => {
      const newEntries = rawFiles.map((f, i) => {
        const ext = f.name.split('.').pop().toLowerCase();
        const size = f.size > 1024 * 1024
          ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(f.size / 1024)} KB`;
        return {
          id: Date.now() + i,
          name: f.name,
          category: 'HR',
          size,
          uploaded: new Date().toISOString().slice(0, 10),
          type: ext,
        };
      });
      setFiles(prev => [...newEntries, ...prev]);
      setUploading(false);
    }, 800);
  };

  const handleDelete = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="dl-page">
      {/* Header */}
      <div className="dl-header">
        <div className="dl-header-left">
          <div className="dl-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div>
            <h2 className="dl-title">Data Lake</h2>
            <p className="dl-subtitle">Centralized file storage for all company data</p>
          </div>
        </div>
        <div className="dl-header-stats">
          <div className="dl-stat">
            <span className="dl-stat-value">{files.length}</span>
            <span className="dl-stat-label">Files</span>
          </div>
          <div className="dl-stat-divider" />
          <div className="dl-stat">
            <span className="dl-stat-value">{CATEGORIES.length - 1}</span>
            <span className="dl-stat-label">Categories</span>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={`dl-drop-zone${dragging ? ' dl-drop-zone--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileInput} />
        {uploading ? (
          <div className="dl-uploading">
            <div className="dl-spinner" />
            <span>Uploading...</span>
          </div>
        ) : (
          <>
            <div className="dl-drop-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="dl-drop-text">
              <strong>Drop files here</strong> or click to upload
            </p>
            <p className="dl-drop-hint">PDF, Excel, CSV and more</p>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="dl-filters">
        <div className="dl-category-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`dl-cat-btn${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >{cat}</button>
          ))}
        </div>
        <div className="dl-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="dl-search"
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* File list */}
      <div className="dl-file-list">
        {filtered.length === 0 ? (
          <div className="dl-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <p>No files found</p>
          </div>
        ) : (
          filtered.map(f => (
            <div key={f.id} className="dl-file-row">
              <div className="dl-file-icon">{FILE_ICONS[f.type] || FILE_ICONS.csv}</div>
              <div className="dl-file-info">
                <span className="dl-file-name">{f.name}</span>
                <div className="dl-file-meta">
                  <span className={`dl-file-cat dl-file-cat--${f.category.toLowerCase()}`}>{f.category}</span>
                  <span className="dl-file-size">{f.size}</span>
                  <span className="dl-file-date">{new Date(f.uploaded).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              <div className="dl-file-actions">
                <button className="dl-action-btn" title="Download">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
                <button className="dl-action-btn dl-action-btn--delete" title="Delete" onClick={() => handleDelete(f.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DataLake;
