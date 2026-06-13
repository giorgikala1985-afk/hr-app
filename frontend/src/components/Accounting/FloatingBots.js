import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { BotChat, BotAvatar, mapBot } from './FinBotsPage';
import { loadFloatingIds, setFloating, FLOATING_EVENT, FLOATING_KEY } from './floatingStore';

// Global widget: renders pinned FinBots as launcher bubbles in the bottom-right
// corner, expandable into a chat window from any page in the app.
function FloatingBots() {
  const { user } = useAuth();
  const userId = user?.id;
  const [ids, setIds] = useState(loadFloatingIds);
  const [bots, setBots] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Keep the floating id list in sync with toggles + other tabs.
  useEffect(() => {
    const refresh = () => setIds(loadFloatingIds());
    const onStorage = (e) => { if (!e.key || e.key === FLOATING_KEY) refresh(); };
    window.addEventListener(FLOATING_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(FLOATING_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Load bot definitions whenever the user or the set of pinned ids changes.
  const idsKey = ids.join(',');
  useEffect(() => {
    if (!userId || ids.length === 0) { setBots([]); return; }
    let cancelled = false;
    api.get('/finbots')
      .then(res => { if (!cancelled) setBots((res.data.bots || []).map(mapBot)); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, idsKey]);

  const floatingBots = bots.filter(b => ids.includes(b.id));

  // If the open bot got unpinned, close the window.
  useEffect(() => {
    if (openId && !ids.includes(openId)) setOpenId(null);
  }, [ids, openId]);

  if (!userId || floatingBots.length === 0) return null;

  const openBot = floatingBots.find(b => b.id === openId) || null;

  return (
    <div className="fbf-root">
      {openBot && (
        <div className={`fbf-window${expanded ? ' expanded' : ''}`} key={openBot.id}>
          <div className="fbf-window-head" style={{ background: openBot.color }}>
            <BotAvatar color="#ffffff" icon={openBot.icon} size={30} />
            <div className="fbf-window-title">{openBot.name}</div>
            <button
              className="fbf-head-btn"
              title={expanded ? 'Shrink' : 'Expand'}
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
            <button
              className="fbf-head-btn"
              title="Minimize"
              onClick={() => setOpenId(null)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              className="fbf-head-btn"
              title="Unpin from screen"
              onClick={() => { setFloating(openBot.id, false); setOpenId(null); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="fbf-window-body">
            <BotChat bot={openBot} showHeader={false} />
          </div>
        </div>
      )}

      <div className="fbf-bubbles">
        {floatingBots.map(b => (
          <button
            key={b.id}
            className={`fbf-bubble${openId === b.id ? ' active' : ''}`}
            title={b.name}
            onClick={() => setOpenId(id => (id === b.id ? null : b.id))}
            style={{ outlineColor: b.color }}
          >
            <BotAvatar color={b.color} icon={b.icon} size={54} />
          </button>
        ))}
      </div>

      <style>{`
        .fbf-root {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 900;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 14px;
          pointer-events: none;
        }
        .fbf-root > * { pointer-events: auto; }
        .fbf-window {
          width: 384px;
          height: 560px;
          max-width: calc(100vw - 44px);
          max-height: calc(100vh - 130px);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.28);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: fbfSlideUp 0.22s ease both;
          transition: width 0.2s ease, height 0.2s ease;
        }
        .fbf-window.expanded {
          width: 760px;
          height: 82vh;
          max-height: calc(100vh - 60px);
        }
        .fbf-window-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px 11px 14px;
          color: #fff;
          flex-shrink: 0;
        }
        .fbf-window-title {
          flex: 1;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fbf-head-btn {
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 8px;
          background: rgba(255,255,255,0.18);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .fbf-head-btn:hover { background: rgba(255,255,255,0.32); }
        .fbf-window-body { flex: 1; min-height: 0; display: flex; }
        .fbf-window-body .fb-chat { width: 100%; }
        .fbf-bubbles {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: flex-end;
        }
        .fbf-bubble {
          border: none;
          background: transparent;
          padding: 0;
          border-radius: 16px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(0,0,0,0.20);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          line-height: 0;
        }
        .fbf-bubble:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 10px 26px rgba(0,0,0,0.26); }
        .fbf-bubble.active { outline: 3px solid; outline-offset: 2px; }
        @keyframes fbfSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default FloatingBots;
