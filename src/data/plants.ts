import { formatISO, setHours, setMinutes, subDays } from 'date-fns';
import type { Meter, Plant } from '../types';

const generateReadings = (days: number, base: number, variance: number): Meter['readings'] => {
  const readings = Array.from({ length: days }, (_, index) => {
    const hour = Math.floor(Math.random() * 24); // กระจายเวลาให้มีทั้งช่วง 22:00-09:00 และ 09:00-22:00
    const date = setHours(setMinutes(subDays(new Date(), index), 0), hour);
    const swing = Math.sin(index / 5) * variance;
    const noise = Math.random() * variance * 0.8;
    const kwh = Math.max(8, base + swing + noise);
    return {
      timestamp: formatISO(date),
      kwh: parseFloat(kwh.toFixed(2)),
    };
  });

  return readings.reverse();
};

const createMeter = (id: string, name: string, base: number, variance: number, ratePerKwh: number): Meter => ({
  id,
  name,
  ratePerKwh,
  readings: generateReadings(210, base, variance),
});

export const plants: Plant[] = [
  {
    id: 'plant-1',
    name: 'Bangkok Solar Farm',
    location: 'Chachoengsao',
    currency: 'THB',
    billingStartDay: 10,
    meters: [
      createMeter('p1-m1', 'Inverter 01', 120, 35, 4.2),
      createMeter('p1-m2', 'Inverter 02', 95, 22, 4),
      createMeter('p1-m3', 'Office Panel', 45, 18, 4.5),
    ],
  },
  {
    id: 'plant-2',
    name: 'Rayong Rooftop',
    location: 'Rayong',
    currency: 'USD',
    billingStartDay: 15,
    meters: [
      createMeter('p2-m1', 'Factory Line A', 160, 40, 0.12),
      createMeter('p2-m2', 'Factory Line B', 140, 32, 0.11),
      createMeter('p2-m3', 'Warehouse', 70, 20, 0.1),
    ],
  },
];
