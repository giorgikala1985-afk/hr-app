import React, { useState, useRef } from 'react';
import portalApi from '../../services/portalApi';

export default function PortalScan() {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgFile, setImgFile] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const cameraRef = useRef();

  const handleCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImgFile(file);
    setOcrText('');
    setError('');
    setSuccess('');
    setName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));

    const url = URL.createObjectURL(file);
    setImgSrc(url);

    // OCR via Tesseract.js (dynamic import to keep initial bundle small)
    setOcrLoading(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      setOcrText(text.trim());
    } catch {
      setOcrText('');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!imgFile) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', imgFile);
      fd.append('name', name || imgFile.name);
      await portalApi.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('Document saved successfully!');
      setImgSrc(null);
      setImgFile(null);
      setOcrText('');
      setName('');
      if (cameraRef.current) cameraRef.current.value = '';
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setImgSrc(null);
    setImgFile(null);
    setOcrText('');
    setName('');
    setError('');
    setSuccess('');
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <div>
      <p className="portal-page-title">Scan Document</p>

      {!imgSrc ? (
        <div className="portal-card" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 20, color: '#6b7280', fontSize: 14 }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
            Take a photo of a document to scan and upload it
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            style={{ display: 'none' }}
          />
          <button className="portal-upload-btn" onClick={() => cameraRef.current.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
            Take Photo / Choose Image
          </button>
        </div>
      ) : (
        <div className="portal-card">
          <img src={imgSrc} alt="Document preview" className="portal-scan-preview" />

          {ocrLoading ? (
            <div className="portal-scan-spinner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }}>
                <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
              Reading document text...
            </div>
          ) : ocrText ? (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Extracted text (editable)</p>
              <textarea
                className="portal-ocr-text"
                value={ocrText}
                onChange={e => setOcrText(e.target.value)}
              />
            </>
          ) : (
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>No text extracted from this image</p>
          )}

          <input
            className="portal-text-input"
            placeholder="Document name"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="portal-upload-btn secondary" style={{ flex: 1 }} onClick={reset} disabled={uploading}>
              Retake
            </button>
            <button className="portal-upload-btn" style={{ flex: 2 }} onClick={handleUpload} disabled={uploading || ocrLoading}>
              {uploading ? 'Saving...' : 'Save Document'}
            </button>
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}
          {success && <p style={{ color: '#16a34a', fontSize: 13, marginTop: 10 }}>{success}</p>}
        </div>
      )}
    </div>
  );
}
