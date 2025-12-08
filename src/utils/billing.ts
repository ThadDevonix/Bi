import { addDays, addMonths, isAfter, isBefore, isEqual, set, startOfDay } from 'date-fns';
import type { BillingPeriod, Reading } from '../types';

export const getBillingPeriod = (startDay: number, referenceDate = new Date()): BillingPeriod => {
  const clampedDay = Math.min(Math.max(Math.floor(startDay), 1), 28);
  const tentativeStart = start(referenceDate, clampedDay);
  const startDate = referenceDate.getDate() < clampedDay ? addMonths(tentativeStart, -1) : tentativeStart;
  const endDate = addDays(addMonths(startDate, 1), -1);

  return { start: startOfDay(startDate), end: endDate };
};

const start = (referenceDate: Date, day: number): Date => set(referenceDate, { date: day });

export const filterReadingsByPeriod = (readings: Reading[], period: BillingPeriod): Reading[] => {
  const inclusiveEnd = addDays(period.end, 1);
  return readings.filter(({ timestamp }) => {
    const date = new Date(timestamp);
    const afterStart = isAfter(date, period.start) || isEqual(date, period.start);
    const beforeEnd = isBefore(date, inclusiveEnd);
    return afterStart && beforeEnd;
  });
};

export const calculateTotalUsage = (readings: Reading[]): number =>
  readings.reduce((sum, reading) => sum + reading.kwh, 0);

export const calculateCost = (usageKwh: number, ratePerKwh: number): number =>
  parseFloat((usageKwh * ratePerKwh).toFixed(2));

export type { BillingPeriod };
