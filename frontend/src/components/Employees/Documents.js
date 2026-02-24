import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function Documents({ employeeId }) {
  const { t } = useLanguage();
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
      setError(t('doc.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError(t('doc.sizeError'));
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
      setError(t('doc.selectFile'));
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

      setSuccess(t('doc.success'));
      setDocName('');
      setDocFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadDocuments();
    } catch (err) {
      setError(err.response?.data?.error || t('doc.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(t('doc.deleteConfirm').replace('{name}', doc.name))) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/documents/${doc.id}`);
      setSuccess(t('doc.deleted'));
      loadDocuments();
    } catch (err) {
      setError(t('doc.deleteFailed'));
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
        <h3>{t('doc.title')}</h3>
        <p>{t('doc.subtitle')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* Upload Form */}
      <div className="doc-upload-card">
        <h4>{t('doc.uploadTitle')}</h4>
        <form onSubmit={handleUpload}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>{t('doc.docName')}</label>
              <input type="text" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder={t('doc.docNamePlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('doc.fileLabel')}</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={uploading || !docFile}>
            {uploading ? t('doc.uploading') : t('doc.upload')}
          </button>
        </form>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="emp-loading">{t('doc.loading')}</div>
      ) : documents.length === 0 ? (
        <div className="sc-empty">{t('doc.noDocuments')}</div>
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
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-icon" title={t('doc.viewDownload')}>
                  ⬇️
                </a>
                <button onClick={() => handleDelete(doc)} className="btn-icon btn-delete" title={t('action.delete')}>
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
