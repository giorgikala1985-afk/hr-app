import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Sun01Icon,
  SunCloud01Icon,
  CloudyIcon,
  CloudFogIcon,
  CloudDrizzleIcon,
  CloudRainIcon,
  CloudRainWindIcon,
  CloudSnowIcon,
  CloudLightningIcon,
  Location01Icon,
} from '@hugeicons/core-free-icons';

// Default location when geolocation is unavailable / denied (Tbilisi, Georgia).
const DEFAULT = { lat: 41.6938, lon: 44.8015, city: 'Tbilisi' };

// WMO weather code → icon, accent color, label.
function codeToInfo(code) {
  if (code === 0) return { icon: Sun01Icon, color: '#f59e0b', label: 'Clear sky' };
  if (code === 1) return { icon: SunCloud01Icon, color: '#f59e0b', label: 'Mainly clear' };
  if (code === 2) return { icon: SunCloud01Icon, color: '#eab308', label: 'Partly cloudy' };
  if (code === 3) return { icon: CloudyIcon, color: '#64748b', label: 'Overcast' };
  if (code === 45 || code === 48) return { icon: CloudFogIcon, color: '#94a3b8', label: 'Fog' };
  if (code >= 51 && code <= 57) return { icon: CloudDrizzleIcon, color: '#3b82f6', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { icon: CloudRainIcon, color: '#2563eb', label: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: CloudSnowIcon, color: '#38bdf8', label: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: CloudRainWindIcon, color: '#2563eb', label: 'Rain showers' };
  if (code === 85 || code === 86) return { icon: CloudSnowIcon, color: '#38bdf8', label: 'Snow showers' };
  if (code >= 95) return { icon: CloudLightningIcon, color: '#7c3aed', label: 'Thunderstorm' };
  return { icon: CloudyIcon, color: '#64748b', label: 'Cloudy' };
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather');
  const data = await res.json();
  return data.current;
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (!res.ok) return null;
    const d = await res.json();
    return d.city || d.locality || d.principalSubdivision || d.countryName || null;
  } catch {
    return null;
  }
}

function WeatherWidget() {
  const { theme } = useTheme();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let active = true;

    const loadFor = async (lat, lon, fallbackCity) => {
      try {
        const [current, city] = await Promise.all([
          fetchWeather(lat, lon),
          reverseGeocode(lat, lon),
        ]);
        if (!active) return;
        setState({ status: 'ok', current, city: city || fallbackCity });
      } catch {
        if (active) setState({ status: 'error' });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadFor(pos.coords.latitude, pos.coords.longitude, null),
        () => loadFor(DEFAULT.lat, DEFAULT.lon, DEFAULT.city),
        { timeout: 8000, maximumAge: 30 * 60 * 1000 }
      );
    } else {
      loadFor(DEFAULT.lat, DEFAULT.lon, DEFAULT.city);
    }

    return () => { active = false; };
  }, []);

  if (state.status === 'error') return null;

  const iconBg = theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#f0f9ff';

  if (state.status === 'loading') {
    return (
      <div className="home-stat-card">
        <div className="home-stat-icon" style={{ background: iconBg, color: '#38bdf8' }}>
          <HugeiconsIcon icon={CloudyIcon} size={22} color="#38bdf8" strokeWidth={1.8} />
        </div>
        <div>
          <div className="home-stat-value" style={{ fontSize: '1.1rem' }}>—</div>
          <div className="home-stat-label">Loading weather…</div>
        </div>
      </div>
    );
  }

  const { current, city } = state;
  const info = codeToInfo(current.weather_code);
  const temp = Math.round(current.temperature_2m);
  const feels = Math.round(current.apparent_temperature);

  return (
    <div className="home-stat-card" title={`Feels like ${feels}°C · Humidity ${current.relative_humidity_2m}% · Wind ${Math.round(current.wind_speed_10m)} km/h`}>
      <div className="home-stat-icon" style={{ background: iconBg, color: info.color }}>
        <HugeiconsIcon icon={info.icon} size={22} color={info.color} strokeWidth={1.8} />
      </div>
      <div>
        <div className="home-stat-value">{temp}°C</div>
        <div className="home-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {info.label}
          {city && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <HugeiconsIcon icon={Location01Icon} size={12} color="currentColor" strokeWidth={1.8} />
              {city}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;
