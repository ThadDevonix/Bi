import type { Plant } from '../types';

interface PlantSettingsProps {
  plant: Plant;
  onUpdate: (updates: { currency?: Plant['currency']; billingStartDay?: number }) => void;
}

const currencyOptions: Plant['currency'][] = ['THB', 'USD', 'EUR', 'JPY', 'AUD'];

const PlantSettings = ({ plant, onUpdate }: PlantSettingsProps) => {
  return (
    <div className="settings">
      <div>
        <label htmlFor="currency">หน่วยเงิน (Currency)</label>
        <select
          id="currency"
          value={plant.currency}
          onChange={(e) => onUpdate({ currency: e.target.value as Plant['currency'] })}
        >
          {currencyOptions.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <p className="muted">กำหนดหน่วยเงินที่ใช้คำนวณค่าไฟของ Plant นี้</p>
      </div>
    </div>
  );
};

export default PlantSettings;
