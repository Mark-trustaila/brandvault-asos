'use client';
import { useState, useRef } from 'react';
import styles from './ReportPanel.module.css';
import { useDashboard } from '../../context/DashboardContext';
import { formatDate, getStatusStyle } from '../../lib/utils';

const PRESETS = [
  { id: 'portfolio',  icon: '📋', name: 'Full Portfolio',      desc: 'All marks across all registries' },
  { id: 'renewals',   icon: '⏰', name: 'Renewal Schedule',     desc: 'Upcoming renewals and deadlines' },
  { id: 'registered', icon: '✅', name: 'Registered Marks',     desc: 'Active registered trademarks only' },
  { id: 'pending',    icon: '⏳', name: 'Pending Applications', desc: 'In-prosecution marks' },
];

const FORMATS = [
  { id: 'csv',  icon: '📄', label: 'CSV',  desc: 'Spreadsheet' },
  { id: 'pdf',  icon: '📕', label: 'PDF',  desc: 'Formatted report' },
  { id: 'json', icon: '{ }', label: 'JSON', desc: 'Raw data' },
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
          <div className={styles.headerTitle}>📊 Generate Report</div>
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
