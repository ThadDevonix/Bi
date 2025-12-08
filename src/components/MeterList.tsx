import type React from 'react';
import type { CurrencyCode, Meter } from '../types';
import { formatCurrency, formatNumber } from '../utils/format';

interface MeterListProps {
  meters: Meter[];
  selectedMeterId: string;
  onSelect: (meterId: string) => void;
  summaries: Record<string, { usage: number; cost: number }>;
  currency: CurrencyCode;
}

const MeterList = ({ meters, selectedMeterId, onSelect, summaries, currency }: MeterListProps) => (
  <div className="meter-list">
    {meters.map((meter) => {
      const summary = summaries[meter.id] ?? { usage: 0, cost: 0 };
      const active = meter.id === selectedMeterId;
      const handleSelect = () => onSelect(meter.id);
      const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      };

      return (
        <div
          key={meter.id}
          className={`card meter-card clickable ${active ? 'active' : ''}`}
          onClick={handleSelect}
          onKeyDown={handleKey}
          role="button"
          tabIndex={0}
        >
          <div className="card-title">
            <span>{meter.name}</span>
            <span className="pill muted">Rate {meter.ratePerKwh} / kWh</span>
          </div>
          <div className="card-row">
            <span>การใช้ไฟรอบบิลนี้</span>
            <strong>{formatNumber(summary.usage)} kWh</strong>
          </div>
          <div className="card-row">
            <span>ประเมินค่าไฟ</span>
            <strong>{formatCurrency(summary.cost, currency)}</strong>
          </div>
        </div>
      );
    })}
  </div>
);

export default MeterList;
