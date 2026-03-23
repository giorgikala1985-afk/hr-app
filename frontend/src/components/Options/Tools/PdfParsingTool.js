import React, { useState, useRef } from 'react';
import api from '../../../services/api';

const FORMAT_OPTIONS = [
  {
    key: 'word',
    label: 'Word Document',
    ext: '.docx',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.4)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
        <line x1="8" y1="9" x2="10" y2="9"/>
      </svg>
    ),
  },
  {
    key: 'excel',
    label: 'Excel Spreadsheet',
    ext: '.xlsx',
    color: '#4ade80',
    bg: 'rgba(22,163,74,0.12)',
    border: 'rgba(22,163,74,0.4)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="12" y2="17"/>
      </svg>
    ),
  },
];

function PdfParsingTool() {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState('word');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }
    setFile(f);
    setError('');
    setSuccess('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleConvert = async () => {
    if (!file) return;
    setConverting(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/tools/pdf-convert?format=${format}`, formData, {
        responseType: 'blob',
      });

      const ext = format === 'excel' ? '.xlsx' : '.docx';
      const baseName = file.name.replace(/\.pdf$/i, '');
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccess(`Converted successfully → ${baseName}${ext}`);
    } catch (err) {
      let msg = 'Conversion failed.';
      if (err.response?.data) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.error || msg;
        } catch {}
      }
      setError(msg);
    } finally {
      setConverting(false);
    }
  };

  const selectedFormat = FORMAT_OPTIONS.find(f => f.key === format);

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="16" y2="17"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>PDF Parsing</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Upload a PDF and convert it to Word or Excel</div>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Messages */}
        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            {success}
          </div>
        )}

        {/* Step 1 – Upload PDF */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--text)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>1</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Upload PDF File</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Select or drag & drop your PDF. Max size 30 MB.</div>

            <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? '#f87171' : file ? 'rgba(220,38,38,0.4)' : 'var(--border-2)'}`,
                borderRadius: 12, padding: '28px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(220,38,38,0.08)' : file ? 'rgba(220,38,38,0.06)' : 'var(--surface-2)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!dragOver) e.currentTarget.style.borderColor = 'var(--text-3)'; }}
              onMouseLeave={e => { if (!dragOver) e.currentTarget.style.borderColor = file ? 'rgba(220,38,38,0.4)' : 'var(--border-2)'; }}
            >
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                    </svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{(file.size / 1024 / 1024).toFixed(2)} MB · click to replace</div>
                  </div>
                </div>
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>Click to choose PDF</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>or drag & drop here</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Step 2 – Choose output format */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--text)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>2</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Choose Output Format</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Select the format you want to convert to.</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setFormat(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 20px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${format === opt.key ? opt.border : 'var(--border-2)'}`,
                    background: format === opt.key ? opt.bg : 'var(--surface-2)',
                    transition: 'all 0.15s', minWidth: 180,
                  }}
                  onMouseEnter={e => { if (format !== opt.key) e.currentTarget.style.borderColor = 'var(--text-3)'; }}
                  onMouseLeave={e => { if (format !== opt.key) e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                >
                  {opt.icon}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: format === opt.key ? opt.color : 'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{opt.ext}</div>
                  </div>
                  {format === opt.key && (
                    <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 3 – Convert */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--text)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>3</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Convert & Download</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              The file will be processed on the server and downloaded automatically.
            </div>
            <button
              onClick={handleConvert}
              disabled={!file || converting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 28px',
                background: !file || converting ? 'var(--surface-2)' : selectedFormat.color,
                color: !file || converting ? 'var(--text-3)' : '#fff',
                border: `1px solid ${!file || converting ? 'var(--border-2)' : 'transparent'}`,
                borderRadius: 9, fontWeight: 700, fontSize: 14,
                cursor: !file || converting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', boxShadow: !file || converting ? 'none' : `0 2px 8px ${selectedFormat.color}40`,
              }}
            >
              {converting ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Converting…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Convert to {selectedFormat?.label}
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default PdfParsingTool;
