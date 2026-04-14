'use client';
import { useState, useRef } from 'react';
import styles from './ReportPanel.module.css';
import { useDashboard } from '../../context/DashboardContext';
import { formatDate, getStatusStyle } from '../../lib/utils';

const IconPortfolio = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="18" rx="2"/>
    <path d="M9 3v2h6V3"/>
    <line x1="9" y1="10" x2="15" y2="10"/>
    <line x1="9" y1="14" x2="15" y2="14"/>
    <line x1="9" y1="18" x2="12" y2="18"/>
  </svg>
);

const IconRenewals = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="3" x2="8" y2="7"/>
    <line x1="16" y1="3" x2="16" y2="7"/>
    <circle cx="16" cy="16" r="3"/>
    <polyline points="16 14.5 16 16 17 17"/>
  </svg>
);

const IconRegistered = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="8 12 11 15 16 9"/>
  </svg>
);

const IconPending = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3h14v3.5c0 3.5-3 5.5-7 8-4-2.5-7-4.5-7-8V3z"/>
    <line x1="12" y1="14.5" x2="12" y2="17"/>
    <circle cx="12" cy="19" r="0.5" fill="currentColor"/>
  </svg>
);

const IconCSV = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
);

const IconPDF = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M9 13h1.5a1 1 0 0 1 0 2H9v-4h1.5a1 1 0 0 1 0 2"/>
    <path d="M14 11h1a2 2 0 0 1 0 4h-1v-4z"/>
  </svg>
);

const IconJSON = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);

const IconReport = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const PRESETS = [
  { id: 'portfolio',  icon: <IconPortfolio />, name: 'Full Portfolio',      desc: 'All marks across all registries' },
  { id: 'renewals',   icon: <IconRenewals />,  name: 'Renewal Schedule',    desc: 'Upcoming renewals and deadlines' },
  { id: 'registered', icon: <IconRegistered />,name: 'Registered Marks',    desc: 'Active registered trademarks only' },
  { id: 'pending',    icon: <IconPending />,   name: 'Pending Applications',desc: 'In-prosecution marks' },
];

const FORMATS = [
  { id: 'csv',  icon: <IconCSV />,  label: 'CSV',  desc: 'Spreadsheet' },
  { id: 'pdf',  icon: <IconPDF />,  label: 'PDF',  desc: 'Formatted report' },
  { id: 'json', icon: <IconJSON />, label: 'JSON', desc: 'Raw data' },
];

export default function ReportPanel() {
  const { showReport, setShowReport, data } = useDashboard();
  const [preset, setPreset]                 = useState('portfolio');
  const [format, setFormat]                 = useState('csv');
  const [registryFilter, setRegistryFilter] = useState<string[]>([]);
  const [pdfGenerating, setPdfGenerating]   = useState(false);
  const reportRef                           = useRef<HTMLDivElement>(null);

  if (!showReport) return null;

  const registries = Array.from(new Set(data?.trademarks.map(t => t.registry_name) ?? []));

  const getFilteredMarks = () => {
    let marks = data?.trademarks ?? [];
    if (preset === 'renewals')   marks = marks.filter(t => {
      const days = Math.floor((new Date(t.expiry_date || '').getTime() - Date.now()) / 86400000);
      return days > 0 && days <= 365;
    });
    if (preset === 'registered') marks = marks.filter(t => t.status === 'Registered');
    if (preset === 'pending')    marks = marks.filter(t => t.status === 'Pending' || t.status === 'Published');
    if (registryFilter.length > 0) marks = marks.filter(t => registryFilter.includes(t.registry_name));
    return marks;
  };

  const handleDownloadCsvJson = () => {
    const marks = getFilteredMarks();
    if (format === 'csv') {
      const header = ['Mark', 'Registry', 'Application No.', 'Registration No.', 'Status', 'Filing Date', 'Expiry Date'];
      const rows = marks.map(t => [
        t.mark_text, t.registry_name, t.application_number,
        t.registration_number || '', t.status,
        formatDate(t.filing_date), formatDate(t.expiry_date),
      ]);
      const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      triggerDownload(new Blob([csv], { type: 'text/csv' }), `brandvault-${preset}.csv`);
    } else if (format === 'json') {
      triggerDownload(new Blob([JSON.stringify(marks, null, 2)], { type: 'application/json' }), `brandvault-${preset}.json`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setPdfGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF }   = await import('jspdf');
      const canvas  = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const imgW    = pageW - 20;
      const imgH    = (canvas.height * imgW) / canvas.width;
      const margin  = 10;
      if (imgH <= pageH - 20) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
      } else {
        let yOffset = 0;
        while (yOffset < imgH) {
          const sliceH = Math.min(pageH - 20, imgH - yOffset);
          const sc = document.createElement('canvas');
          sc.width  = canvas.width;
          sc.height = (sliceH / imgW) * canvas.width;
          sc.getContext('2d')!.drawImage(canvas, 0, -(yOffset / imgW) * canvas.width);
          pdf.addImage(sc.toDataURL('image/png'), 'PNG', margin, margin, imgW, sliceH);
          yOffset += sliceH;
          if (yOffset < imgH) pdf.addPage();
        }
      }
      pdf.save(`brandvault-${preset}.pdf`);
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownload = () => format === 'pdf' ? handleDownloadPdf() : handleDownloadCsvJson();

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleRegistry = (r: string) =>
    setRegistryFilter(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const previewMarks = getFilteredMarks().slice(0, 8);

  return (
    <div className={`${styles.overlay} ${styles.overlayOpen}`}>
      <div className={styles.backdrop} onClick={() => setShowReport(false)} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerTitle}><IconReport /> Generate Report</div>
          <button className={styles.closeBtn} onClick={() => setShowReport(false)}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Report Type</div>
            <div className={styles.presetList}>
              {PRESETS.map(p => (
                <div key={p.id} className={`${styles.presetItem} ${preset === p.id ? styles.presetItemSelected : ''}`} onClick={() => setPreset(p.id)}>
                  <div className={styles.presetIcon}>{p.icon}</div>
                  <div className={styles.presetInfo}>
                    <div className={styles.presetName}>{p.name}</div>
                    <div className={styles.presetDesc}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Filter by Registry</div>
            <div className={styles.chips}>
              {registries.map(r => (
                <div key={r} className={`${styles.chip} ${registryFilter.includes(r) ? styles.chipActive : ''}`} onClick={() => toggleRegistry(r)}>{r}</div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Format</div>
            <div className={styles.formatRow}>
              {FORMATS.map(f => (
                <div key={f.id} className={`${styles.formatCard} ${format === f.id ? styles.formatCardSelected : ''}`} onClick={() => setFormat(f.id)}>
                  <span className={styles.formatIcon}>{f.icon}</span>
                  <div className={styles.formatLabel}>{f.label}</div>
                  <div className={styles.formatDesc}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Preview · {getFilteredMarks().length} marks</div>
            <div ref={reportRef} className={styles.reportContent}>
              <div className={styles.reportHeader}>
                <div className={styles.reportBrand}>
                  <span className={styles.reportLogo}>AS</span>
                  <div>
                    <div className={styles.reportOrgName}>ASOS plc</div>
                    <div className={styles.reportOrgSub}>BrandVault</div>
                  </div>
                </div>
                <div className={styles.reportMeta}>
                  <div className={styles.reportTitle}>{PRESETS.find(p => p.id === preset)?.name ?? 'Portfolio Report'}</div>
                  <div className={styles.reportDate}>Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              </div>
              <div className={styles.preview}>
                <table>
                  <thead>
                    <tr><th>Mark</th><th>Registry</th><th>Status</th><th>Expiry</th></tr>
                  </thead>
                  <tbody>
                    {previewMarks.map(t => {
                      const s = getStatusStyle(t.status);
                      return (
                        <tr key={t.id}>
                          <td>{t.mark_text}</td>
                          <td>{t.registry_name}</td>
                          <td><span style={{ background: s.bg, color: s.color, padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 500 }}>{t.status}</span></td>
                          <td>{formatDate(t.expiry_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={() => setShowReport(false)}>Cancel</button>
          <button className={styles.btnDownload} onClick={handleDownload} disabled={pdfGenerating}>
            {pdfGenerating ? '⏳ Generating…' : `⬇ Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
