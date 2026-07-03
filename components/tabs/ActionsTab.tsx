'use client';
import styles from './ActionsTab.module.css';
import { useDashboard } from '../../context/DashboardContext';
import { BADGE_COLORS, calculateDaysRemaining, getDaysBadgeStyle, getInitials } from '../../lib/utils';

export default function ActionsTab() {
  const { filteredTrademarks, setSelectedTrademark, selectedTrademark } = useDashboard();

  const actionMarks = filteredTrademarks
    .filter(t => {
      const days = calculateDaysRemaining(t.expiry_date);
      return days > 0 && days <= 365;
    })
    .sort((a, b) => calculateDaysRemaining(a.expiry_date) - calculateDaysRemaining(b.expiry_date));

  // Live marks with no expiry date can't have a renewal deadline computed, so
  // they never surface in the action list above. Rather than silently drop them,
  // flag them as "needs data" (dead marks don't need renewal tracking).
  const needsData = filteredTrademarks
    .filter(t => !t.expiry_date && t.status !== 'Expired' && t.status !== 'Abandoned')
    .sort((a, b) => a.mark_text.localeCompare(b.mark_text));

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.dot} />
        <span className={styles.title}>Action required</span>
        <span className={styles.count}>{actionMarks.length}</span>
      </div>

      {actionMarks.length === 0 ? (
        <div className={styles.empty}>No actions required</div>
      ) : (
        <div className={styles.list}>
          {actionMarks.map((mark, idx) => {
            const days = calculateDaysRemaining(mark.expiry_date);
            const badge = getDaysBadgeStyle(days);
            const isSelected = selectedTrademark?.id === mark.id;

            return (
              <div
                key={mark.id}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                onClick={() => setSelectedTrademark(mark)}
              >
                <div
                  className={styles.initials}
                  style={{ backgroundColor: BADGE_COLORS[idx % BADGE_COLORS.length] }}
                >
                  {getInitials(mark.mark_text)}
                </div>
                <div className={styles.info}>
                  <div className={styles.markName}>{mark.mark_text}</div>
                  <div className={styles.sub}>Renewal due in {days} days</div>
                </div>
                <div
                  className={styles.daysBadge}
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                >
                  {badge.text}
                </div>
                <span className={styles.officeLabel}>{mark.registry_name}</span>
              </div>
            );
          })}
        </div>
      )}

      {needsData.length > 0 && (
        <>
          <div className={`${styles.header} ${styles.needsDataHeader}`}>
            <div className={`${styles.dot} ${styles.needsDataDot}`} />
            <span className={styles.title}>Needs data</span>
            <span className={`${styles.count} ${styles.needsDataCount}`}>{needsData.length}</span>
          </div>
          <div className={styles.list}>
            {needsData.map((mark, idx) => {
              const isSelected = selectedTrademark?.id === mark.id;

              return (
                <div
                  key={mark.id}
                  className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                  onClick={() => setSelectedTrademark(mark)}
                >
                  <div
                    className={styles.initials}
                    style={{ backgroundColor: BADGE_COLORS[idx % BADGE_COLORS.length] }}
                  >
                    {getInitials(mark.mark_text)}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.markName}>{mark.mark_text}</div>
                    <div className={styles.sub}>No expiry date — renewal deadline can’t be tracked</div>
                  </div>
                  <div className={`${styles.daysBadge} ${styles.needsDataBadge}`}>Add date</div>
                  <span className={styles.officeLabel}>{mark.registry_name}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
