import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { AggregatedPoint } from '../utils/aggregation';
import type { BillingPeriod, Meter, Plant, UsagePeriod } from '../types';
import { formatCurrency, formatNumber, formatPeriod } from '../utils/format';
import PeriodTabs from './PeriodTabs';

interface MeterDetailProps {
  plant: Plant;
  meter: Meter;
  period: UsagePeriod;
  onPeriodChange: (period: UsagePeriod) => void;
  billingPeriod: BillingPeriod;
  billingUsage: number;
  billingCost: number;
  chartPoints: AggregatedPoint[];
  dailyDate: string;
  dailyMaxDate: string;
  onDailyDateChange: (value: string) => void;
  onDailyDateShift: (delta: number) => void;
  monthlyMonth: string;
  monthlyMaxMonth: string;
  onMonthlyChange: (value: string) => void;
  onMonthlyShift: (delta: number) => void;
  yearlyYear: string;
  yearlyMaxYear: string;
  yearlyMinYear: string;
  onYearlyChange: (value: string) => void;
  onYearlyShift: (delta: number) => void;
  onRegisterExport?: (exporter: () => void) => void;
  theme: 'light' | 'dark';
}

const MeterDetail = ({
  plant,
  meter,
  period,
  onPeriodChange,
  billingPeriod,
  billingUsage,
  billingCost,
  chartPoints,
  dailyDate,
  dailyMaxDate,
  onDailyDateChange,
  onDailyDateShift,
  monthlyMonth,
  monthlyMaxMonth,
  onMonthlyChange,
  onMonthlyShift,
  yearlyYear,
  yearlyMaxYear,
  yearlyMinYear,
  onYearlyChange,
  onYearlyShift,
  onRegisterExport,
  theme,
}: MeterDetailProps) => {
  const chartType = period === 'daily' ? 'line' : 'bar';
  const receiptRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  // Use explicit palette to avoid stale CSS variable reads when toggling theme
  const chartBackground = isDark ? '#121c32' : '#f3f6fb';
  const chartGrid = isDark ? '#223455' : '#d5dce7';
  const chartTicks = isDark ? '#d7e4ff' : '#4f5966';
  const tooltipText = isDark ? '#eaf1ff' : '#1f2730';
  const xTickLimit = period === 'daily' ? 12 : period === 'monthly' ? 12 : 12;
  const yearlyTotal = useMemo(
    () => (period === 'yearly' ? chartPoints.reduce((sum, p) => sum + p.value, 0) : 0),
    [chartPoints, period],
  );

  const chartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        titleColor: tooltipText,
        bodyColor: tooltipText,
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed.y ?? 0;
            return `${value.toFixed(2)} kWh`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: chartGrid },
        ticks: {
          callback: (value) => `${value} kWh`,
          color: chartTicks,
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: chartTicks,
          autoSkip: true,
          maxTicksLimit: xTickLimit,
          maxRotation: 0,
          minRotation: 0,
        },
      },
    },
  };

  const chartData = useMemo(
    () => ({
      labels: chartPoints.map((point) => point.label),
      datasets: [
        {
          label: 'พลังงาน (kWh)',
          data: chartPoints.map((point) => point.value),
          borderColor: period === 'daily' ? '#60a5fa' : '#34d399',
          backgroundColor: period === 'daily'
            ? isDark
              ? 'rgba(96, 165, 250, 0.15)'
              : 'rgba(37, 99, 235, 0.12)'
            : isDark
              ? 'rgba(52, 211, 153, 0.18)'
              : 'rgba(22, 163, 74, 0.2)',
          borderWidth: 2,
          tension: 0.35,
        },
      ],
    }),
    [chartPoints, isDark, period],
  );

  const chartPlugins = useMemo(
    () => [
      {
        id: 'canvas-bg',
        beforeDraw: (chart: any) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          if (chart.canvas) {
            chart.canvas.style.backgroundColor = chartBackground;
          }
          ctx.save();
          ctx.fillStyle = chartBackground;
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
          ctx.restore();
        },
      },
    ],
    [chartBackground],
  );

  const handleExportPdf = useCallback(async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: chartBackground });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 24;
    const usableWidth = pageWidth - margin * 2;
    const ratio = usableWidth / canvas.width;
    const imgHeight = canvas.height * ratio;

    pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, imgHeight);
    pdf.save(`${plant.name}-${meter.name}-invoice.pdf`);
  }, [chartBackground, meter.name, plant.name]);

  useEffect(() => {
    if (onRegisterExport) {
      onRegisterExport(handleExportPdf);
    }
  }, [onRegisterExport, handleExportPdf]);

  const ChartComponent = chartType === 'line' ? Line : Bar;
  const chartKey = `${meter.id}-${chartType}-${theme}-${
    period === 'daily' ? dailyDate : period === 'monthly' ? monthlyMonth : yearlyYear
  }`;

  return (
    <div className="meter-detail">
      <div className="meter-detail__header">
        <div className="meter-detail__title">
          <div>
            <p className="muted">มิเตอร์</p>
            <h2>{meter.name}</h2>
          </div>
        </div>
        <div className="detail-actions"></div>
      </div>

      <div className="detail-body" ref={receiptRef}>
        <div className="stats">
          <div className="stat-card">
            <p className="muted">รอบบิลปัจจุบัน</p>
            <strong>{formatPeriod(billingPeriod)}</strong>
          </div>
          <div className="stat-card">
            <p className="muted">การใช้ไฟรอบบิลนี้</p>
            <strong>{formatNumber(billingUsage)} kWh</strong>
          </div>
          <div className="stat-card">
            <p className="muted">ประมาณการค่าไฟ</p>
            <strong>{formatCurrency(billingCost, plant.currency)}</strong>
          </div>
        </div>

        <PeriodTabs value={period} onChange={onPeriodChange} />

        {period === 'daily' ? (
          <div className="inline-select-row date-shift-row">
            <label htmlFor="daily-date">เลือกวัน</label>
            <div className="date-shift-controls">
              <button
                type="button"
                className="ghost shift-btn"
                aria-label="วันก่อนหน้า"
                onClick={() => onDailyDateShift(-1)}
              >
                ‹
              </button>
              <input
                id="daily-date"
                type="date"
                className="date-input date-input--compact"
                value={dailyDate}
                max={dailyMaxDate}
                onChange={(e) => onDailyDateChange(e.target.value)}
              />
              <button
                type="button"
                className="ghost shift-btn"
                aria-label="วันถัดไป"
                onClick={() => onDailyDateShift(1)}
                disabled={dailyDate >= dailyMaxDate}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}

        {period === 'monthly' ? (
          <div className="inline-select-row date-shift-row">
            <label htmlFor="monthly-month">เลือกเดือน</label>
            <div className="date-shift-controls">
              <button
                type="button"
                className="ghost shift-btn"
                aria-label="เดือนก่อนหน้า"
                onClick={() => onMonthlyShift(-1)}
              >
                ‹
              </button>
              <input
                id="monthly-month"
                type="month"
                className="date-input date-input--compact"
                value={monthlyMonth}
                max={monthlyMaxMonth}
                onChange={(e) => onMonthlyChange(e.target.value)}
              />
              <button
                type="button"
                className="ghost shift-btn"
                aria-label="เดือนถัดไป"
                onClick={() => onMonthlyShift(1)}
                disabled={monthlyMonth >= monthlyMaxMonth}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}

        {period === 'yearly' ? (
          <div className="inline-select-row date-shift-row">
            <label htmlFor="yearly-year">เลือกปี</label>
            <div className="date-shift-controls">
              <button
                type="button"
                className="ghost shift-btn"
                aria-label="ปีก่อนหน้า"
                onClick={() => onYearlyShift(-1)}
                disabled={Number(yearlyYear) <= Number(yearlyMinYear)}
              >
                ‹
              </button>
              <input
                id="yearly-year"
                type="number"
                className="date-input date-input--compact"
                value={yearlyYear}
                min={yearlyMinYear}
                max={yearlyMaxYear}
                onChange={(e) => onYearlyChange(e.target.value)}
              />
              <button
                type="button"
                className="ghost shift-btn"
                aria-label="ปีถัดไป"
                onClick={() => onYearlyShift(1)}
                disabled={Number(yearlyYear) >= Number(yearlyMaxYear)}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}

        {period === 'yearly' ? (
          <div className="inline-select-row">
            <div>
              <p className="muted">รวมพลังงานปี {yearlyYear}</p>
              <strong>{formatNumber(yearlyTotal)} kWh</strong>
            </div>
          </div>
        ) : null}

        <div className="chart-wrapper">
          <ChartComponent key={chartKey} data={chartData} options={chartOptions} plugins={chartPlugins} />
        </div>

        <div className="breakdown">
          <div>
            <p className="muted">หน่วยเงิน</p>
            <strong>{plant.currency}</strong>
          </div>
          <div>
            <p className="muted">อัตราต่อ kWh</p>
            <strong>{formatCurrency(meter.ratePerKwh, plant.currency)} / kWh</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeterDetail;
