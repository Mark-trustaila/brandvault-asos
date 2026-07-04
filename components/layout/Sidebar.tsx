'use client';
import styles from './Sidebar.module.css';
import { useDashboard } from '../../context/DashboardContext';

export default function Sidebar() {
  const { data, setActiveTab, setFocusedMark } = useDashboard();

  const marksByName: Record<string, number> = {};
  data?.trademarks.forEach(t => {
    marksByName[t.mark_text] = (marksByName[t.mark_text] || 0) + 1;
  });

  return (
    <nav className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logoMark}>Ai</div>
        <div>
          <div className={styles.orgName}>{data?.company?.name ?? 'BrandVault'}</div>
        </div>
      </div>

      <div className={styles.sectionLabel}>BRANDVAULT</div>

      <div className={`${styles.navItem} ${styles.active}`}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span>Dashboard</span>
      </div>

      <div className={`${styles.navItem} ${styles.dimmed}`}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>Matters</span>
      </div>

      <div className={`${styles.navItem} ${styles.dimmed}`}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>Search</span>
      </div>

      <div className={styles.sectionLabel}>TRADEMARK MARKS</div>

      {Object.entries(marksByName).map(([mark, count]) => (
        <div
          key={mark}
          className={styles.navItem}
          onClick={() => { setActiveTab('by-mark'); setFocusedMark(mark); }}
        >
          <div className={styles.dot} />
          <span className={styles.markLabel} title={mark}>{mark}</span>
          <span className={styles.badge}>{count}</span>
        </div>
      ))}

      <div className={styles.sectionLabel}>INNOVAULT</div>

      <div className={`${styles.navItem} ${styles.disabled}`}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M9 21h6"/><path d="M9 18h6"/>
          <circle cx="12" cy="10" r="4"/>
          <path d="M12 2v2"/>
        </svg>
        <span>Patents</span>
      </div>

      <div className={styles.footer}>
        <div className={styles.navItem} style={{ cursor: 'default' }}>
          <div className={styles.avatar}>MK</div>
          <div>
            <div className={styles.orgName}>Mark Kingsley-Williams</div>
            <div className={styles.orgSub}>BrandVault</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
