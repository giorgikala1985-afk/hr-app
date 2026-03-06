import React, { useState, useRef, useEffect } from 'react';
import api from '../../../services/api';

function AiAgentTool() {
  const [pdfLibrary, setPdfLibrary] = useState([]); // array of File objects
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (newFiles.length === 0) return;
    setPdfLibrary(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const unique = newFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...unique];
    });
  };

  const removeFile = (name) => {
    setPdfLibrary(prev => prev.filter(f => f.name !== name));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (pdfLibrary.length === 0 || !question.trim() || loading) return;

    const q = question.trim();
    setMessages(m => [...m, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);

    try {
      const formData = new FormData();
      pdfLibrary.forEach(f => formData.append('files', f));
      formData.append('question', q);

      const res = await api.post('/tools/pdf-ask', formData);
      setMessages(m => [...m, { role: 'assistant', text: res.data.answer }]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to get answer.';
      setMessages(m => [...m, { role: 'error', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const hasFiles = pdfLibrary.length > 0;

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px', background: '#fafbfc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
            <path d="M12 8v4l3 3"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>AI Document Agent</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
            {hasFiles ? `${pdfLibrary.length} PDF${pdfLibrary.length > 1 ? 's' : ''} loaded · ask anything across all documents` : 'Upload PDFs and ask questions across all of them'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* PDF Library sidebar */}
        <div style={{ width: 220, borderRight: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PDF Library</span>
            <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>{pdfLibrary.length}</span>
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {pdfLibrary.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, marginBottom: 2, background: '#fff', border: '1px solid #f1f5f9' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
                <span style={{ fontSize: 11, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</span>
                <button
                  onClick={() => removeFile(f.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 0, fontSize: 15, lineHeight: 1, flexShrink: 0 }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>

          {/* Add PDF button / drop zone */}
          <div style={{ padding: '10px 8px 14px' }}>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? '#16a34a' : '#e2e8f0'}`,
                borderRadius: 10, padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? '#f0fdf4' : '#fff', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!dragOver) e.currentTarget.style.borderColor = '#94a3b8'; }}
              onMouseLeave={e => { if (!dragOver) e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#16a34a' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 4 }}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <div style={{ fontSize: 11, fontWeight: 600, color: dragOver ? '#16a34a' : '#64748b' }}>Add PDFs</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>click or drop</div>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Messages */}
          <div style={{ flex: 1, minHeight: 320, maxHeight: 480, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!hasFiles && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingTop: 60 }}>
                Add PDFs to the library on the left, then ask questions about them.
              </div>
            )}
            {hasFiles && messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingTop: 60 }}>
                Ask anything across your {pdfLibrary.length} document{pdfLibrary.length > 1 ? 's' : ''}.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4, paddingLeft: msg.role !== 'user' ? 2 : 0 }}>
                  {msg.role === 'user' ? 'You' : msg.role === 'error' ? 'Error' : 'AI Agent'}
                </div>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? '#1e293b' : msg.role === 'error' ? '#fef2f2' : '#f8fafc',
                  color: msg.role === 'user' ? '#fff' : msg.role === 'error' ? '#dc2626' : '#1e293b',
                  border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                  fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: `bounce 1.2s ${d * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleAsk} style={{ borderTop: '1px solid #f1f5f9', padding: '16px 24px', display: 'flex', gap: 10 }}>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={hasFiles ? 'Ask a question across all PDFs...' : 'Add PDFs first...'}
              disabled={loading || !hasFiles}
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 9,
                fontSize: 13, color: '#1e293b', outline: 'none', background: (loading || !hasFiles) ? '#f8fafc' : '#fff',
              }}
              onFocus={e => e.target.style.borderColor = '#64748b'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <button
              type="submit"
              disabled={!question.trim() || loading || !hasFiles}
              style={{
                padding: '10px 20px', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 13,
                background: !question.trim() || loading || !hasFiles ? '#e2e8f0' : '#1e293b',
                color: !question.trim() || loading || !hasFiles ? '#94a3b8' : '#fff',
                cursor: !question.trim() || loading || !hasFiles ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              }}
            >
              Ask
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

export default AiAgentTool;
