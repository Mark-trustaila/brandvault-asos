'use client';

export interface CoveredCountry {
  code: string;
  status: 'Registered' | 'Pending' | 'Published' | 'mixed';
}

// Flag emoji from ISO 2-letter code
function flag(code: string): string {
  if (code === 'EU') return '🇪🇺';
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('');
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',  GB: 'United Kingdom', EU: 'European Union',
  AU: 'Australia',      SG: 'Singapore',       JP: 'Japan',
  CA: 'Canada',         IN: 'India',           FR: 'France',
  DE: 'Germany',        IT: 'Italy',           ES: 'Spain',
  NL: 'Netherlands',    SE: 'Sweden',          PL: 'Poland',
  CH: 'Switzerland',    NO: 'Norway',          KR: 'South Korea',
  CN: 'China',          BR: 'Brazil',          MX: 'Mexico',
  ZA: 'South Africa',   TR: 'Turkey',          EG: 'Egypt',
  NG: 'Nigeria',
};

const REGIONS: { label: string; icon: string; codes: string[] }[] = [
  { label: 'Americas',      icon: '🌎', codes: ['US', 'CA', 'BR', 'MX'] },
  { label: 'Europe',        icon: '🌍', codes: ['EU', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'SE', 'PL', 'CH', 'NO'] },
  { label: 'Asia-Pacific',  icon: '🌏', codes: ['JP', 'AU', 'SG', 'IN', 'KR', 'CN'] },
  { label: 'Africa & Middle East', icon: '🌍', codes: ['ZA', 'TR', 'EG', 'NG'] },
];

interface Props {
  coveredCountries: CoveredCountry[];
}

export default function TerritoryMap({ coveredCountries }: Props) {
  const coverageMap = new Map(coveredCountries.map(c => [c.code, c.status]));
  const coveredCodes = new Set(coveredCountries.map(c => c.code));

  const statusStyle = (status: CoveredCountry['status'] | undefined) => {
    if (!status) return { bg: 'transparent', border: 'transparent', text: '#94a3b8', badge: null };
    if (status === 'Registered')  return { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badge: { bg: '#dbeafe', color: '#1d4ed8', label: 'Registered' } };
    if (status === 'mixed')       return { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', badge: { bg: '#ede9fe', color: '#6d28d9', label: 'Mixed'      } };
    return                               { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: { bg: '#fef3c7', color: '#d97706', label: 'Pending'    } };
  };

  // Only show regions that have at least one covered country, plus show uncovered as ghosts
  const regionsWithData = REGIONS.map(r => {
    const covered   = r.codes.filter(c => coveredCodes.has(c));
    const uncovered = r.codes.filter(c => !coveredCodes.has(c));
    return { ...r, covered, uncovered };
  }).filter(r => r.covered.length > 0);

  const totalTerritories = coveredCountries.length;

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Summary strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'Total territories', value: totalTerritories, color: '#37352f' },
            { label: 'Registered',        value: coveredCountries.filter(c => c.status === 'Registered').length,                              color: '#1d4ed8' },
            { label: 'Pending',           value: coveredCountries.filter(c => c.status === 'Pending' || c.status === 'Published').length,      color: '#d97706' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {[
            { dot: '#3b82f6', label: 'Registered' },
            { dot: '#f59e0b', label: 'Pending' },
            { dot: '#8b5cf6', label: 'Mixed' },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Regional sections */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {regionsWithData.map(region => (
          <div key={region.label}>
            {/* Region header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>{region.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{region.label}</span>
              <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', borderRadius: 10, padding: '1px 7px' }}>{region.covered.length}</span>
            </div>

            {/* Country tiles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {region.covered.map(code => {
                const status  = coverageMap.get(code);
                const s       = statusStyle(status);
                const name    = COUNTRY_NAMES[code] ?? code;
                return (
                  <div
                    key={code}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 10px',
                      background: s.bg,
                      border: `1px solid ${s.border}`,
                      borderRadius: 8,
                      minWidth: 130,
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{flag(code)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      {s.badge && (
                        <div style={{ fontSize: 10, color: s.badge.color, marginTop: 1 }}>{s.badge.label}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
