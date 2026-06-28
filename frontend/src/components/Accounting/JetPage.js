import React from 'react';

function JetPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
        <path d="M22 2L11 13"/>
        <path d="M22 2L15 22 11 13 2 9l20-7z"/>
      </svg>
      <p style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-2)' }}>JET</p>
      <p style={{ fontSize: 13, marginTop: 6 }}>Coming soon</p>
    </div>
  );
}

export default JetPage;
