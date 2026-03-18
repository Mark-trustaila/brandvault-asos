'use client';
import styles from './TabBar.module.css';
import { useDashboard } from '../../context/DashboardContext';
import { calculateDaysRemaining } from '../../lib/utils';

export default function TabBar() {
  const { activeTab, setActiveTab, filteredTrademarks, data } = useDashboard();

  const counts = {
    actions: filteredTrademarks.filter(t => {
      const days = calculateDaysRemaining(t.expiry_date);
      return days > 0 && days <= 365;
    }).length,
    'by-mark': Array.from(new Set(filteredTrademarks.map(t => t.mark_text))).length,
    pipeline: filteredTrademarks.length,
    'by-registry': Array.from(new Set(filteredTrademarks.map(t => t.registry_name))).length,
  };

  const totalCounts = {
    actions: (data?.trademarks ?? []).filter(t => {
      const days = calculateDaysRemaining(t.expiry_date);
      return days > 0 && days <= 365;
    }).length,
    'by-mark': Array.from(new Set((data?.trademarks ?? []).map(t => t.mark_text))).length,
    pipeline: data?.count ?? 0,
    'by-registry': Array.from(new Set((data?.trademarks ?? []).map(t => t.registry_name))).length,
  };

  const TABS = [
    { id: 'actions', label: 'Actions Required' },
    { id: 'by-mark', label: 'By Mark' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'by-registry', label: 'By Registry' },
  ];

  const isSearchActive = filteredTrademarks.length !== (data?.count ?? 0);

  return (
    <div className={styles.tabBar}>
      {TABS.map(tab => {
        const count = counts[tab.id as keyof typeof counts];
        const total = totalCounts[tab.id as keyof typeof totalCounts];
        const showCount = isSearchActive;

        return (
          <div
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {showCount && (
              <span className={count === 0 ? styles.countZero : styles.count}>
                {count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
