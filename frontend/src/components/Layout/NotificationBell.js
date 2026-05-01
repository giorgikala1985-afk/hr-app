import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const TYPE_ICON = {
  transfer_submitted: '📤',
  transfer_approved:  '✅',
  transfer_rejected:  '❌',
  transfer_partial:   '½',
  transfer_wait:      '⏸',
  transfer_archived:  '📦',
};

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); } catch {}
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    try { await api.put('/notifications/read-all'); } catch {}
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    setUnread(0);
    setLoading(false);
  };

  const handleClick = (n) => {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    navigate('/accounting');
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: 'relative', background: open ? 'var(--surface-2)' : 'none',
          border: 'none', cursor: 'pointer', color: 'var(--text-3)',
          padding: '6px 8px', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
        onMouseLeave={e => !open && (e.currentTarget.style.background = 'none')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            background: '#ef4444', color: '#fff', borderRadius: '50%',
            fontSize: 9, fontWeight: 800,
            minWidth: 15, height: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 2px', lineHeight: 1,
            boxShadow: '0 0 0 2px var(--surface)',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340, minWidth: 280,
          background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          zIndex: 300, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              Notifications {unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginLeft: 4 }}>
                  ({unread} new)
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent, #6366f1)', padding: 0 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                No notifications yet
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border-2)',
                  cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.07)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = n.is_read ? 'var(--surface-2)' : 'rgba(99,102,241,0.13)'}
                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(99,102,241,0.07)'}
              >
                <span style={{ fontSize: 20, lineHeight: '1.3', flexShrink: 0 }}>
                  {TYPE_ICON[n.type] || '🔔'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: n.is_read ? 500 : 700, fontSize: 13,
                    color: 'var(--text)', marginBottom: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-3)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#6366f1', flexShrink: 0, marginTop: 6,
                  }} />
                )}
              </div>
            ))}
          </div>

          {notifications.length > 0 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-2)', textAlign: 'center' }}>
              <button
                onClick={() => { setOpen(false); navigate('/accounting'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent, #6366f1)' }}
              >
                Go to Transfers →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
