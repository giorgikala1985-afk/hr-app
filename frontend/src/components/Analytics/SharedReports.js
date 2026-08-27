import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { ChartBlock } from '../Accounting/FinBotsPage';
import TableSkeleton from '../common/TableSkeleton';

export default function SharedReports() {
  const { t } = useLanguage();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shared-reports');
      setReports(res.data.reports || []);
    } catch (err) {
      console.error('Error fetching shared reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    setReports(prev => prev.filter(r => r.id !== id));
    try {
      await api.delete(`/shared-reports/${id}`);
    } catch (err) {
      console.error('Error removing shared report:', err);
      load();
    }
  };

  if (loading) {
    return (
      <TableSkeleton
        icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        }
        color="#06b6d4"
        label=""
        rows={4}
        cols={[{ width: '40%' }, { width: '35%' }, { size: 18 }]}
      />
    );
  }

  if (reports.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>
        {t('analytics.sharedEmpty')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {reports.map(report => (
        <div key={report.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {report.title || report.bot_name || t('analytics.sharedUntitled')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {t('analytics.sharedBy')} {report.shared_by_name || report.shared_by_email} · {new Date(report.created_at).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => remove(report.id)}
              title={t('analytics.sharedRemove')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <ChartBlock chartData={report.chart_data} shareable={false} />
        </div>
      ))}
    </div>
  );
}
