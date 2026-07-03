'use client';
import styles from './Topbar.module.css';
import { useDashboard } from '../../context/DashboardContext';
const IconReport = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block', verticalAlign:'middle', marginRight:4}}>
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
export default function Topbar() {
  const { data, setShowReport } = useDashboard();

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.breadcrumb}>
          <span>BrandVault</span>
          <span>/ {data?.company?.name ?? 'BrandVault'}</span>
          <span>/ Dashboard</span>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.badge}>✓ Live</div>
        <button className={styles.btn} onClick={() => setShowReport(true)}><IconReport /> Report</button>
        <button className={`${styles.btn} ${styles.btnDisabled}`}>⚙ Settings</button>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnDisabled}`}>+ New filing</button>
      </div>
    </header>
  );
}
