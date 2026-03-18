'use client';
import { useState } from 'react';
import styles from './ByRegistryTab.module.css';
import { useDashboard } from '../../context/DashboardContext';
import { BADGE_COLORS, getStatusStyle } from '../../lib/utils';

export default function ByRegistryTab() {
  const { filteredTrademarks, setSelectedTrademark } = useDashboard();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const byRegistry: Record<string, typeof filteredTrademarks> = {};
  filteredTrademarks.forEach(t => {
    if (!byRegistry[t.registry_name]) byRegistry[t.registry_name] = [];
    byRegistry[t.registry_name].push(t);
  });

  const toggle = (name: string) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.dot} />
        <span className={styles.title}>By Registry</span>
        <span className={styles.count}>{Object.keys(byRegistry).length} registries</span>
      </div>

      {Object.entries(byRegistry).map(([registry, marks], idx) => {
        const registered = marks.filter(m => m.status === 'Registered').length;
        const isExpanded = expanded[registry] ?? false;

        return (
          <div key={registry} className={styles.officeCard}>
            <div className={styles.officeHeader} onClick={() => toggle(registry)}>
              <div
                className={styles.officeInitials}
                style={{ backgroundColor: BADGE_COLORS[idx % BADGE_COLORS.length] }}
              >
                {registry.replace(/[^A-Z]/g, '').slice(0, 3) || registry.slice(0, 3).toUpperCase()}
              </div>
              <div className={styles.officeInfo}>
                <div className={styles.officeName}>{registry}</div>
                <div className={styles.officeMeta}>{registered} registered · {marks.length} total</div>
              </div>
              <div className={styles.officeCount}>{marks.length} marks</div>
              <div className={styles.toggle}>{isExpanded ? '▲' : '▼'}</div>
            </div>

            <div className={`${styles.officeBody} ${isExpanded ? styles.officeBodyExpanded : ''}`}>
              {marks.map(mark => {
                const statusStyle = getStatusStyle(mark.status);
                return (
                  <div key={mark.id} className={styles.markRow} onClick={() => setSelectedTrademark(mark)}>
                    <div className={styles.markText}>{mark.mark_text}</div>
                    <div className={styles.markNumber}>
                      {mark.registration_number || mark.application_number}
                    </div>
                    <div
                      className={styles.statusBadge}
                      style={{ background: statusStyle.bg, color: statusStyle.color }}
                    >
                      {mark.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
