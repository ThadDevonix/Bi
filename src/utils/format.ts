import { format } from 'date-fns';
import type { BillingPeriod, CurrencyCode } from '../types';

export const formatCurrency = (value: number, currency: CurrencyCode): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export const formatPeriod = (period: BillingPeriod): string =>
  `${format(period.start, 'dd MMM yyyy')} – ${format(period.end, 'dd MMM yyyy')}`;

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
