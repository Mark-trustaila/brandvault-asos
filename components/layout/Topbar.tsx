'use client';
import styles from './Topbar.module.css';
import { useDashboard } from '../../context/DashboardContext';

export default function Topbar() {
  const { setShowReport } = useDashboard();

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.breadcrumb}>
          <span>BrandVault</span>
          <span>/ ASOS plc</span>
          <span>/ Dashboard</span>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.badge}>✓ LawPanel Live</div>
        <button className={styles.btn} onClick={() => setShowReport(true)}>📊 Report</button>
        <button className={`${styles.btn} ${styles.btnDisabled}`}>⚙ Settings</button>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnDisabled}`}>+ New filing</button>
      </div>
    </header>
  );
}
