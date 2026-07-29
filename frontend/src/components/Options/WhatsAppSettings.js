import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function WhatsAppSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null); // { linked, waId, waName, linkedAt }
  const [codeInfo, setCodeInfo] = useState(null); // { code, businessNumber, expiresAt }
  const [generating, setGenerating] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/whatsapp/status');
      setStatus(res.data);
      if (res.data.linked) setCodeInfo(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load WhatsApp status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleConnect = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/whatsapp/link-code');
      setCodeInfo(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate a code.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp from this account?')) return;
    setDisconnecting(true);
    setError('');
    try {
      await api.delete('/whatsapp/link');
      setStatus({ linked: false });
      setCodeInfo(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect.');
    } finally {
      setDisconnecting(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div style={{ maxWidth: 560 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>WhatsApp</h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-3)' }}>
        Connect WhatsApp to hire, fire, promote, adjust, or initiate transfers by chatting with the Finpilot bot.
      </p>

      {error && <div className="msg-error" style={{ marginBottom: 14 }}>{error}</div>}

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</div>
      ) : status?.linked ? (
        <div style={{
          border: '1.5px solid var(--border-2)', borderRadius: 10, padding: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#479c73', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#479c73', display: 'inline-block' }} />
              Connected{status.waName ? ` — ${status.waName}` : status.waId ? ` — ${status.waId}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>Linked {formatDate(status.linkedAt)}</div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-2)',
              background: 'var(--surface)', color: '#dc2626', fontSize: 13, fontWeight: 600,
              cursor: disconnecting ? 'not-allowed' : 'pointer',
            }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : codeInfo ? (
        <div style={{ border: '1.5px solid var(--border-2)', borderRadius: 10, padding: 20 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-2)' }}>
            1. Open{' '}
            {codeInfo.businessNumber ? (
              <a
                href={`https://wa.me/${codeInfo.businessNumber}?text=${encodeURIComponent(`link ${codeInfo.code}`)}`}
                target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600 }}
              >
                the Finpilot WhatsApp number
              </a>
            ) : 'the Finpilot WhatsApp number'}{' '}
            (tapping the link above pre-fills the message below).<br />
            2. Send this message:
          </p>
          <div style={{
            fontFamily: 'monospace', fontSize: 20, fontWeight: 700, letterSpacing: 2,
            background: 'var(--surface-2)', borderRadius: 8, padding: '12px 16px',
            textAlign: 'center', color: 'var(--text)', marginBottom: 12,
          }}>
            link {codeInfo.code}
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-4)' }}>
            This code expires in 15 minutes.
          </p>
          <button
            onClick={loadStatus}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#479c73', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            I've sent it — check connection
          </button>
        </div>
      ) : (
        <div style={{ border: '1.5px solid var(--border-2)', borderRadius: 10, padding: 20, textAlign: 'center' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-3)' }}>Not connected yet.</p>
          <button
            onClick={handleConnect}
            disabled={generating}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#479c73', color: '#fff', fontSize: 13.5, fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Generating…' : 'Connect WhatsApp'}
          </button>
        </div>
      )}
    </div>
  );
}

export default WhatsAppSettings;
