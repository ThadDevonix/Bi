export type CurrencyCode = 'THB' | 'USD' | 'EUR' | 'JPY' | 'AUD';

export interface Reading {
  timestamp: string; // ISO string
  kwh: number;
}

export interface Meter {
  id: string;
  name: string;
  ratePerKwh: number;
  readings: Reading[];
}

export interface BillingPeriod {
  start: Date;
  end: Date;
}

export interface Plant {
  id: string;
  name: string;
  location?: string;
  currency: CurrencyCode;
  billingStartDay: number; // 1-28
  meters: Meter[];
}

export type UsagePeriod = 'daily' | 'monthly' | 'yearly';
