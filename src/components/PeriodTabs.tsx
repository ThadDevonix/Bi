import type { UsagePeriod } from '../types';

interface PeriodTabsProps {
  value: UsagePeriod;
  onChange: (period: UsagePeriod) => void;
}

const labels: Record<UsagePeriod, string> = {
  daily: 'รายวัน',
  monthly: 'รายเดือน',
  yearly: 'รายปี',
};

const PeriodTabs = ({ value, onChange }: PeriodTabsProps) => {
  return (
    <div className="tabs">
      {(Object.keys(labels) as UsagePeriod[]).map((period) => (
        <button
          key={period}
          type="button"
          className={`tab ${value === period ? 'active' : ''}`}
          onClick={() => onChange(period)}
        >
          {labels[period]}
        </button>
      ))}
    </div>
  );
};

export default PeriodTabs;
