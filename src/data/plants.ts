import { addDays, addMinutes, differenceInCalendarDays, formatISO, startOfDay } from 'date-fns';
import type { Meter, Plant } from '../types';

const QUARTER_MINUTES = 15;
const QUARTERS_PER_DAY = (24 * 60) / QUARTER_MINUTES;
const START_YEAR = 2020;

const generateQuarterHourReadings = (dayStart: Date, dailyTarget: number): Meter['readings'] => {
  const basePerSlot = dailyTarget / QUARTERS_PER_DAY;
  return Array.from({ length: QUARTERS_PER_DAY }, (_, slot) => {
    const timestamp = addMinutes(dayStart, slot * QUARTER_MINUTES);
    const peakWave = Math.sin((slot / QUARTERS_PER_DAY) * Math.PI * 2) * basePerSlot * 0.6;
    const noise = (Math.random() - 0.5) * basePerSlot * 0.35;
    const kwh = Math.max(0.05, basePerSlot + peakWave + noise);
    return {
      timestamp: formatISO(timestamp),
      kwh: parseFloat(kwh.toFixed(2)),
    };
  });
};

const generateReadings = (base: number, variance: number): Meter['readings'] => {
  const startDate = startOfDay(new Date(START_YEAR, 0, 1));
  const today = startOfDay(new Date());
  const totalDays = differenceInCalendarDays(today, startDate) + 1;
  const readings: Meter['readings'] = [];

  for (let index = 0; index < totalDays; index += 1) {
    const day = addDays(startDate, index);
    const swing = Math.sin(index / 5) * variance;
    const noise = Math.random() * variance * 0.6;
    const dailyTarget = Math.max(12, base + swing + noise);
    const isMostRecentDay = differenceInCalendarDays(day, today) === 0;

    if (isMostRecentDay) {
      readings.push(...generateQuarterHourReadings(day, dailyTarget));
    } else {
      const hour = 8 + Math.floor(Math.random() * 10); // แรนดอมช่วงกลางวัน
      const timestamp = addMinutes(day, hour * 60);
      readings.push({
        timestamp: formatISO(timestamp),
        kwh: parseFloat(dailyTarget.toFixed(2)),
      });
    }
  }

  return readings;
};

const createMeter = (id: string, name: string, base: number, variance: number, ratePerKwh: number): Meter => ({
  id,
  name,
  ratePerKwh,
  readings: generateReadings(base, variance),
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
