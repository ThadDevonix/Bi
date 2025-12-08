import type React from 'react';
import type { Plant } from '../types';

interface PlantSelectorProps {
  plants: Plant[];
  selectedPlantId: string;
  onSelect: (plantId: string) => void;
}

const PlantSelector = ({ plants, selectedPlantId, onSelect }: PlantSelectorProps) => {
  return (
    <div className="plant-grid">
      {plants.map((plant) => {
        const active = plant.id === selectedPlantId;
        const handleSelect = () => onSelect(plant.id);
        const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
          }
        };
        return (
          <div
            key={plant.id}
            className={`card plant-card clickable ${active ? 'active' : ''}`}
            onClick={handleSelect}
            onKeyDown={handleKey}
            role="button"
            tabIndex={0}
          >
            <div className="card-title">
              <span>{plant.name}</span>
              {plant.location ? <span className="pill">{plant.location}</span> : null}
            </div>
            <div className="card-row">
              <span>Currency</span>
              <strong>{plant.currency}</strong>
            </div>
            <div className="card-row">
              <span>Billing start day</span>
              <strong>Day {plant.billingStartDay}</strong>
            </div>
            <div className="card-row">
              <span>Meters</span>
              <strong>{plant.meters.length}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlantSelector;
