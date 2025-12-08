import { format, isBefore, startOfDay, startOfMonth, startOfYear, subDays, subMonths, subYears } from 'date-fns';
import type { Reading, UsagePeriod } from '../types';

export interface AggregatedPoint {
  label: string;
  value: number;
  rawDate: Date;
}

export const aggregateUsage = (readings: Reading[], period: UsagePeriod): AggregatedPoint[] => {
  if (period === 'monthly') {
    return aggregateMonthly(readings);
  }
  if (period === 'yearly') {
    return aggregateYearly(readings);
  }
  return aggregateDaily(readings);
};

const aggregateDaily = (readings: Reading[], days = 30): AggregatedPoint[] => {
  const windowStart = startOfDay(new Date());
  const lookbackStart = startOfDay(subDays(windowStart, days - 1));
  const map = new Map<number, number>();

  readings.forEach((reading) => {
    const date = startOfDay(new Date(reading.timestamp));
    if (isBefore(date, lookbackStart)) return;
    const key = date.getTime();
    map.set(key, (map.get(key) ?? 0) + reading.kwh);
  });

  return toSortedPoints(map, 'MMM d');
};

const aggregateMonthly = (readings: Reading[], months = 12): AggregatedPoint[] => {
  const windowStart = startOfMonth(new Date());
  const lookbackStart = startOfMonth(subMonths(windowStart, months - 1));
  const map = new Map<number, number>();

  readings.forEach((reading) => {
    const date = startOfMonth(new Date(reading.timestamp));
    if (isBefore(date, lookbackStart)) return;
    const key = date.getTime();
    map.set(key, (map.get(key) ?? 0) + reading.kwh);
  });

  return toSortedPoints(map, 'MMM yyyy');
};

const aggregateYearly = (readings: Reading[], years = 5): AggregatedPoint[] => {
  const windowStart = startOfYear(new Date());
  const lookbackStart = startOfYear(subYears(windowStart, years - 1));
  const map = new Map<number, number>();

  readings.forEach((reading) => {
    const date = startOfYear(new Date(reading.timestamp));
    if (isBefore(date, lookbackStart)) return;
    const key = date.getTime();
    map.set(key, (map.get(key) ?? 0) + reading.kwh);
  });

  return toSortedPoints(map, 'yyyy');
};

const toSortedPoints = (map: Map<number, number>, labelPattern: string): AggregatedPoint[] => {
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, value]) => {
      const date = new Date(key);
      return {
        label: format(date, labelPattern),
        value: parseFloat(value.toFixed(2)),
        rawDate: date,
      };
    });
};
