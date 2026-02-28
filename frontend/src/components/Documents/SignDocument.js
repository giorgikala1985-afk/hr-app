import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import './Documents.css';

function SignDocument() {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/documents/sign/${token}`)
      .then((res) => { setDoc(res.data.document); setSignerName(res.data.document.employee_name || ''); })
      .catch(() => setError('Document not found or link has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!signerName.trim() || !agreed) return;
    setSigning(true);
    try {
      await api.put(`/documents/sign/${token}`, { signer_name: signerName });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Loading document…</div>;
  if (error) return <div style={{ padding: 60, textAlign: 'center', color: '#e53e3e' }}>{error}</div>;

  const c = doc.content || {};

  if (done || doc.status === 'signed') {
    return (
      <div className="sign-page">
        <div className="sign-done">
          <div style={{ fontSize: 48 }}>✅</div>
          <h2>Document Signed</h2>
          <p>Thank you, <strong>{doc.signer_name || signerName}</strong>. Your signature has been recorded.</p>
          {doc.signed_at && <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Signed on {new Date(doc.signed_at).toLocaleString()}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="sign-page">
      <div className="sign-page-header">
        <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
        <h1>Employment Agreement</h1>
        <p>Please review the document below and sign to confirm your acceptance.</p>
      </div>

      {/* Document */}
      <div className="docs-preview-doc">
        <h1>EMPLOYMENT AGREEMENT</h1>
        <p className="doc-subtitle">Please read carefully before signing</p>

        <div className="doc-section">
          <div className="doc-section-title">Parties</div>
          <div className="doc-row"><strong>Employee:</strong> <span>{doc.employee_name}</span></div>
        </div>

        <div className="doc-section">
          <div className="doc-section-title">Position & Terms</div>
          <div className="doc-row"><strong>Job Title:</strong> <span>{c.job_title}</span></div>
          {c.department && <div className="doc-row"><strong>Department:</strong> <span>{c.department}</span></div>}
          <div className="doc-row"><strong>Start Date:</strong> <span>{c.start_date}</span></div>
          <div className="doc-row"><strong>Weekly Hours:</strong> <span>{c.work_hours} hours</span></div>
          {c.probation_months > 0 && <div className="doc-row"><strong>Probation Period:</strong> <span>{c.probation_months} months</span></div>}
        </div>

        {c.salary && (
          <div className="doc-section">
            <div className="doc-section-title">Compensation</div>
            <div className="doc-row"><strong>Monthly Salary:</strong> <span>{Number(c.salary).toLocaleString()} {c.currency}</span></div>
          </div>
        )}

        <div className="doc-section">
          <div className="doc-section-title">General Terms</div>
          <p style={{ fontSize: 13, margin: 0 }}>
            The Employee agrees to perform their duties diligently and in accordance with the Company's policies.
            Either party may terminate this agreement with a notice period as required by applicable law.
            This agreement is governed by the laws of the applicable jurisdiction.
          </p>
          {c.notes && <p style={{ fontSize: 13, marginTop: 8 }}>{c.notes}</p>}
        </div>
      </div>

      {/* Sign actions */}
      <div className="sign-actions">
        <label>Your Full Name</label>
        <input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Type your full name to sign"
        />
        <label className="sign-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I have read and agree to all terms in this employment agreement.
        </label>
        <button
          className="btn-primary"
          onClick={handleSign}
          disabled={!signerName.trim() || !agreed || signing}
          style={{ alignSelf: 'flex-start' }}
        >
          {signing ? 'Signing…' : '✍️ Sign & Confirm'}
        </button>
        {error && <div className="msg-error">{error}</div>}
      </div>
    </div>
  );
}

export default SignDocument;
