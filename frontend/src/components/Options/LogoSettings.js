import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { LOGOS, Logo } from './logos';

export default function LogoSettings() {
  const { logo, setLogo } = useTheme();

  return (
    <div style={{ maxWidth: 640, padding: '32px 0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
        App Logo
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 24px' }}>
        Choose the logo shown next to “Finpilot” in the top-left of the header.
      </p>

      {/* Live preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, width: 'fit-content' }}>
        <Logo id={logo} size={24} />
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Finpilot</span>
      </div>

      {/* Logo grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 10 }}>
        {LOGOS.map(({ id, name }) => {
          const isActive = logo === id;
          return (
            <button
              key={id}
              onClick={() => setLogo(id)}
              title={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                aspectRatio: '1 / 1',
                borderRadius: 12,
                border: isActive ? '2px solid var(--accent)' : '1.5px solid var(--border-2)',
                background: isActive ? 'rgba(37,99,235,0.08)' : 'var(--surface)',
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
                boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'border-color 0.15s, box-shadow 0.15s, color 0.15s, background 0.15s',
              }}
            >
              <Logo id={id} size={26} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
