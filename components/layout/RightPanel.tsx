'use client';
import styles from './RightPanel.module.css';
import { useDashboard } from '../../context/DashboardContext';
import { BADGE_COLORS, calculateDaysRemaining, getDaysBadgeStyle, getInitials, formatDate } from '../../lib/utils';

export default function RightPanel() {
  const { data, setSelectedTrademark } = useDashboard();

  const upcomingRenewals = data?.trademarks
    .filter(t => {
      const days = calculateDaysRemaining(t.expiry_date);
      return days > 0 && days <= 365;
    })
    .sort((a, b) => calculateDaysRemaining(a.expiry_date) - calculateDaysRemaining(b.expiry_date))
    .slice(0, 5) ?? [];

  const registryCount = new Set(data?.trademarks.map(t => t.registry_name)).size;
  const class9count = data?.trademarks.filter(t =>
    t.good_and_services?.some(g => g.search_class.number === 9)
  ).length ?? 0;
  const class42count = data?.trademarks.filter(t =>
    t.good_and_services?.some(g => g.search_class.number === 42)
  ).length ?? 0;

  return (
    <aside className={styles.panel}>
      <div className={styles.sectionTitle}>BrandVault Intelligence</div>

      <div>
        <div className={styles.alertTitle}>BrandVault Alert</div>
        <div className={styles.alertCard}>
          <div className={styles.alertText}>
            {upcomingRenewals.length} marks need renewal attention within the next 12 months.
          </div>
        </div>
      </div>

      <div>
        <div className={styles.alertTitle}>Portfolio Insight</div>
        <div className={styles.alertCard}>
          <div className={styles.alertText}>
            {data?.trademarks.filter(t => t.status === 'Registered').length ?? 0} registered marks across {registryCount} registries.
            Strongest coverage in Class {class9count >= class42count ? 9 : 42} and Class {class9count >= class42count ? 42 : 9}.
          </div>
        </div>
      </div>

      <div>
        <div className={styles.alertTitle}>Data Source</div>
        <div className={styles.alertCard}>
          <div className={styles.alertText}>
            Live data from LawPanel Firms API. Last fetched: {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleDateString('en-GB') : '—'}.
            Run lawpanel-fetch-trademarks.js to refresh.
          </div>
        </div>
      </div>

      <div>
        <div className={styles.viewAll}>
          <div className={styles.sectionTitle}>Upcoming Renewals</div>
          <span className={styles.viewAllLink}>View all →</span>
        </div>
        {upcomingRenewals.length > 0 ? (
          <div className={styles.renewalList}>
            {upcomingRenewals.map((t, idx) => {
              const days = calculateDaysRemaining(t.expiry_date);
              const badge = getDaysBadgeStyle(days);
              return (
                <div key={t.id} className={styles.renewalItem} onClick={() => setSelectedTrademark(t)}>
                  <div className={styles.renewalInitials} style={{ background: BADGE_COLORS[idx % BADGE_COLORS.length] }}>
                    {getInitials(t.mark_text)}
                  </div>
                  <div className={styles.renewalInfo}>
                    <div className={styles.renewalTitle}>{t.mark_text}</div>
                    <div className={styles.renewalSub}>{t.registry_name} · {formatDate(t.expiry_date)}</div>
                  </div>
                  <div className={styles.renewalDays} style={{ background: badge.bg, color: badge.color }}>
                    {badge.text}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>No renewals due in the next 12 months</div>
        )}
      </div>

      <div>
        <div className={styles.sectionTitle}>Actionable Deadlines</div>
        <div className={styles.emptyState}>No actionable deadlines in the next 6 months</div>
      </div>
    </aside>
  );
}
