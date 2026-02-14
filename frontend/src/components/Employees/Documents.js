import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

function Documents({ employeeId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/employees/${employeeId}/documents`);
      setDocuments(response.data.documents);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File must be less than 5MB');
        return;
      }
      setDocFile(file);
      if (!docName) {
        setDocName(file.name.replace(/\.[^.]+$/, ''));
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!docFile) {
      setError('Please select a file');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const data = new FormData();
      data.append('file', docFile);
      data.append('name', docName || docFile.name);

      await api.post(`/employees/${employeeId}/documents`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Document uploaded successfully');
      setDocName('');
      setDocFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadDocuments();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/documents/${doc.id}`);
      setSuccess('Document deleted');
      loadDocuments();
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getFileIcon = (type) => {
    if (type === 'application/pdf') return 'PDF';
    if (type?.startsWith('image/')) return 'IMG';
    return 'FILE';
  };

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>Documents</h3>
        <p>Upload and manage employee documents</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* Upload Form */}
      <div className="doc-upload-card">
        <h4>Upload Document</h4>
        <form onSubmit={handleUpload}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>Document Name</label>
              <input type="text" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Employment Contract" />
            </div>
            <div className="form-group">
              <label>File * (PDF, JPEG, PNG, WebP - max 5MB)</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={uploading || !docFile}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="emp-loading">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="sc-empty">No documents uploaded yet.</div>
      ) : (
        <div className="doc-list">
          {documents.map((doc) => (
            <div key={doc.id} className="doc-item">
              <div className="doc-icon">
                <span className={`doc-badge ${doc.file_type === 'application/pdf' ? 'doc-pdf' : 'doc-img'}`}>
                  {getFileIcon(doc.file_type)}
                </span>
              </div>
              <div className="doc-info">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="doc-name">
                  {doc.name}
                </a>
                <span className="doc-meta">{formatSize(doc.file_size)} &middot; {formatDate(doc.created_at)}</span>
              </div>
              <div className="doc-actions">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-icon" title="View/Download">
                  ⬇️
                </a>
                <button onClick={() => handleDelete(doc)} className="btn-icon btn-delete" title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Documents;
