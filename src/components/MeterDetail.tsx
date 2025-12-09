import { useCallback, useEffect, useMemo, useRef } from 'react';
import { format, startOfDay } from 'date-fns';
import { Bar, Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { AggregatedPoint } from '../utils/aggregation';
import type { BillingPeriod, Meter, Plant, UsagePeriod } from '../types';
import { filterReadingsByPeriod } from '../utils/billing';
import { formatCurrency, formatNumber } from '../utils/format';
import PeriodTabs from './PeriodTabs';

interface MeterDetailProps {
  plant: Plant;
  meter: Meter;
  period: UsagePeriod;
  onPeriodChange: (period: UsagePeriod) => void;
  summaryLabel: string;
  summaryUsage: number;
  summaryCost: number;
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
  customPeriod: BillingPeriod | null;
  customRateOn: number | '';
  customRateOff: number | '';
  onRegisterExport?: (exporter: (mode?: 'download' | 'preview') => void) => void;
  theme: 'light' | 'dark';
}

const MeterDetail = ({
  plant,
  meter,
  period,
  onPeriodChange,
  summaryLabel,
  summaryUsage,
  summaryCost,
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
  customPeriod,
  customRateOn,
  customRateOff,
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
  const displayRate = (value: number | '') => (value === '' ? '—' : formatCurrency(value, plant.currency));

  const dailyRows = useMemo(() => {
    if (!customPeriod) return [];
    const readings = filterReadingsByPeriod(meter.readings, customPeriod);
    const map = new Map<number, number>();
    readings.forEach((r) => {
      const day = startOfDay(new Date(r.timestamp)).getTime();
      map.set(day, (map.get(day) ?? 0) + r.kwh);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, val]) => ({ date: new Date(ts), value: parseFloat(val.toFixed(2)) }));
  }, [customPeriod, meter.readings]);

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

  const handleExportPdf = useCallback(async (mode: 'download' | 'preview' = 'download') => {
    if (!receiptRef.current) return;
    if (mode === 'preview') {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const margin = 28;
      let y = margin;
      pdf.setFontSize(14);
      pdf.text(`${plant.name} - ${meter.name}`, margin, y);
      y += 18;
      pdf.setFontSize(12);
      pdf.text('สรุปการใช้ไฟรายวัน', margin, y);
      y += 12;
      pdf.setFontSize(10);
      dailyRows.forEach(({ date, value }, idx) => {
        if (y > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        const label = format(date, 'd MMM yyyy');
        pdf.text(`${idx + 1}. ${label}`, margin, y);
        pdf.text(`${value.toFixed(2)} kWh`, margin + 220, y);
        y += 14;
      });
      const url = pdf.output('bloburl');
      window.open(url, '_blank');
      return;
    }

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
  }, [chartBackground, dailyRows, meter.name, plant.name]);

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
            <p className="muted">ช่วงที่เลือก</p>
            <strong>{summaryLabel}</strong>
          </div>
          <div className="stat-card">
            <p className="muted">การใช้ไฟ</p>
            <strong>{formatNumber(summaryUsage)} kWh</strong>
          </div>
          <div className="stat-card">
            <p className="muted">ประมาณการค่าไฟ</p>
            <strong>{formatCurrency(summaryCost, plant.currency)}</strong>
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
                <svg className="shift-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z" />
                </svg>
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
                <svg className="shift-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.3 18.7a1 1 0 0 1 0-1.4L14.6 12 9.3 6.7A1 1 0 0 1 10.7 5.3l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0Z" />
                </svg>
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
                <svg className="shift-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z" />
                </svg>
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
                <svg className="shift-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.3 18.7a1 1 0 0 1 0-1.4L14.6 12 9.3 6.7A1 1 0 0 1 10.7 5.3l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0Z" />
                </svg>
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
                <svg className="shift-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z" />
                </svg>
              </button>
              <input
                id="yearly-year"
                type="number"
                className="date-input date-input--compact date-input--year"
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
                <svg className="shift-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.3 18.7a1 1 0 0 1 0-1.4L14.6 12 9.3 6.7A1 1 0 1 1 10.7 5.3l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0Z" />
                </svg>
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
            <p className="muted">อัตรา 09:00 - 22:00</p>
            <strong>{displayRate(customRateOn)} / kWh</strong>
          </div>
          <div>
            <p className="muted">อัตรา 22:00 - 09:00</p>
            <strong>{displayRate(customRateOff)} / kWh</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeterDetail;
