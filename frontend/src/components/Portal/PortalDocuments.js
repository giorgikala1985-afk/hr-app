import React, { useState, useEffect, useRef } from 'react';
import portalApi from '../../services/portalApi';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocIcon({ type }) {
  const isPdf = type?.includes('pdf');
  return (
    <div className="portal-doc-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {isPdf
          ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /></>
          : <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>
        }
      </svg>
    </div>
  );
}

export default function PortalDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();

  const fetchDocs = () => {
    setLoading(true);
    portalApi.get('/documents').then(r => setDocs(r.data.documents)).catch(() => setError('Failed to load documents')).finally(() => setLoading(false));
  };

  useEffect(fetchDocs, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^/.]+$/, ''));
    setError('');
    setSuccess('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name);
      await portalApi.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('Document uploaded successfully');
      setFile(null);
      setName('');
      if (fileRef.current) fileRef.current.value = '';
      fetchDocs();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p className="portal-page-title">My Documents</p>

      {/* Upload */}
      <div className="portal-card">
        <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#374151' }}>Upload Document</p>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
        <button className="portal-upload-btn secondary" style={{ marginBottom: 10 }} onClick={() => fileRef.current.click()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {file ? file.name : 'Choose file'}
        </button>
        {file && (
          <>
            <input className="portal-text-input" placeholder="Document name" value={name} onChange={e => setName(e.target.value)} />
            <button className="portal-upload-btn" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </>
        )}
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
        {success && <p style={{ color: '#16a34a', fontSize: 13, marginTop: 8 }}>{success}</p>}
      </div>

      {/* List */}
      <div className="portal-card">
        {loading ? (
          <div className="portal-spinner">Loading...</div>
        ) : docs.length === 0 ? (
          <div className="portal-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            No documents yet
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc.id} className="portal-doc-item">
              <DocIcon type={doc.file_type} />
              <div className="portal-doc-info">
                <div className="portal-doc-name">{doc.name}</div>
                <div className="portal-doc-meta">
                  {new Date(doc.created_at).toLocaleDateString('en-GB')}
                  {doc.file_size ? ` · ${formatSize(doc.file_size)}` : ''}
                </div>
              </div>
              <a href={doc.file_url} target="_blank" rel="noreferrer" className="portal-doc-download">View</a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
