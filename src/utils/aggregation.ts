import {
  addDays,
  endOfMonth,
  format,
  getYear,
  isBefore,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type { Reading, UsagePeriod } from '../types';

export interface AggregatedPoint {
  label: string;
  value: number;
  rawDate: Date;
}

export const aggregateUsage = (
  readings: Reading[],
  period: UsagePeriod,
  options?: { day?: Date; month?: Date; year?: number },
): AggregatedPoint[] => {
  if (period === 'monthly') {
    return aggregateMonthly(readings, options?.month);
  }
  if (period === 'yearly') {
    return aggregateYearly(readings, options?.year);
  }
  return aggregateDaily(readings, options?.day);
};

const aggregateDaily = (readings: Reading[], targetDay = new Date()): AggregatedPoint[] => {
  const dayStart = startOfDay(targetDay);
  const dayEnd = addDays(dayStart, 1);
  const bucketMap = new Map<number, number>();

  readings.forEach((reading) => {
    const date = new Date(reading.timestamp);
    if (isBefore(date, dayStart) || !isBefore(date, dayEnd)) return;
    const bucket = startOfQuarterHour(date);
    const key = bucket.getTime();
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + reading.kwh);
  });

  const points: AggregatedPoint[] = [];
  const stepMs = 15 * 60 * 1000;
  for (let ts = dayStart.getTime(); ts < dayEnd.getTime(); ts += stepMs) {
    const date = new Date(ts);
    const value = bucketMap.get(ts) ?? 0;
    points.push({
      label: format(date, 'HH:mm'),
      value: parseFloat(value.toFixed(2)),
      rawDate: date,
    });
  }

  return points;
};

const aggregateMonthly = (readings: Reading[], targetMonth = new Date()): AggregatedPoint[] => {
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(monthStart);
  const map = new Map<number, number>();

  readings.forEach((reading) => {
    const date = startOfDay(new Date(reading.timestamp));
    if (startOfMonth(date).getTime() !== monthStart.getTime()) return;
    const key = date.getTime();
    map.set(key, (map.get(key) ?? 0) + reading.kwh);
  });

  const points: AggregatedPoint[] = [];
  let cursor = monthStart;
  while (cursor.getTime() <= monthEnd.getTime()) {
    const date = cursor;
    const value = map.get(date.getTime()) ?? 0;
    points.push({
      label: format(date, 'd'),
      value: parseFloat(value.toFixed(2)),
      rawDate: date,
    });
    cursor = addDays(cursor, 1);
  }

  return points;
};

const aggregateYearly = (readings: Reading[], targetYear = getYear(new Date())): AggregatedPoint[] => {
  const monthMap = new Map<number, number>();

  readings.forEach((reading) => {
    const date = new Date(reading.timestamp);
    if (date.getFullYear() !== targetYear) return;
    const monthStart = startOfMonth(date);
    const key = monthStart.getTime();
    monthMap.set(key, (monthMap.get(key) ?? 0) + reading.kwh);
  });

  const points: AggregatedPoint[] = [];
  for (let month = 0; month < 12; month += 1) {
    const monthStart = startOfMonth(new Date(targetYear, month, 1));
    const value = monthMap.get(monthStart.getTime()) ?? 0;
    points.push({
      label: format(monthStart, 'MMM'),
      value: parseFloat(value.toFixed(2)),
      rawDate: endOfMonth(monthStart),
    });
  }

  return points;
};

const startOfQuarterHour = (date: Date): Date => {
  const flooredMinutes = Math.floor(date.getMinutes() / 15) * 15;
  const start = new Date(date);
  start.setMinutes(flooredMinutes, 0, 0);
  return start;
};
