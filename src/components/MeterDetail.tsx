import { useCallback, useEffect, useMemo, useRef } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
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
    const rows: { date: Date; value: number }[] = [];
    for (
      let cursor = startOfDay(customPeriod.start);
      cursor.getTime() <= startOfDay(customPeriod.end).getTime();
      cursor = addDays(cursor, 1)
    ) {
      const key = cursor.getTime();
      const val = map.get(key) ?? 0;
      rows.push({ date: new Date(key), value: parseFloat(val.toFixed(2)) });
    }
    return rows;
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
    if (mode === 'preview') {
      if (!customPeriod) return;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const margin = 28;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const tableWidth = pageWidth - margin * 2;
      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = margin;

      const colorPrimary: [number, number, number] = [32, 70, 153];
      const colorAccent: [number, number, number] = [92, 184, 156];
      const colorMuted: [number, number, number] = [102, 112, 133];
      const headerBg: [number, number, number] = [236, 240, 245];
      const zebraBg: [number, number, number] = [247, 250, 253];
      const textColor: [number, number, number] = [26, 32, 44];
      const reservedTop = 72 + 60; // header + summary
      const reservedBottom = 22; // footer bar
      const availableForTable = pageHeight - margin - reservedBottom - (margin + reservedTop);
      const estimatedRows = Math.max(1, dailyRows.length + 2); // header + footer
      const rowHeight = Math.max(12, Math.min(20, availableForTable / estimatedRows));
      const rowScale = rowHeight / 20;
      const valueColWidth = tableWidth * 0.35;
      const dateColWidth = tableWidth - valueColWidth;
      const valueColX = margin + dateColWidth;
      const totalKwh = dailyRows.reduce((sum, row) => sum + row.value, 0);
      const dayCount = dailyRows.length || 1;
      const avgKwh = totalKwh / dayCount;
      const peak = dailyRows.reduce<{ date: Date | null; value: number }>(
        (acc, row) => (row.value > acc.value ? { date: row.date, value: row.value } : acc),
        { date: null, value: 0 },
      );
      const drawCard = (label: string, value: string, x: number, width: number) => {
        const cardHeight = 46;
        pdf.setFillColor(247, 250, 253);
        pdf.rect(x, y, width, cardHeight, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(x, y, width, cardHeight);
        pdf.setTextColor(...colorMuted);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, x + 10, y + 16);
        pdf.setTextColor(...textColor);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text(value, x + 10, y + 32);
      };

      // Header ribbon
      pdf.setFillColor(...colorPrimary);
      pdf.rect(margin, y, tableWidth, 56, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('PPA Daily Summary', margin + 12, y + 22);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${plant.name} • ${meter.name}`, margin + 12, y + 38);
      pdf.setFontSize(10);
      pdf.text(
        `${format(customPeriod.start, 'd MMM yyyy')} - ${format(customPeriod.end, 'd MMM yyyy')}`,
        margin + tableWidth - 12,
        y + 24,
        { align: 'right' },
      );
      pdf.text(`ช่วงบิล: ${customRateOn === '' && customRateOff === '' ? 'default' : 'custom'}`, margin + tableWidth - 12, y + 38, {
        align: 'right',
      });

      y += 72;

      // Summary cards
      const cardWidth = (tableWidth - 16) / 3;
      drawCard('พลังงานรวม (kWh)', totalKwh.toFixed(2), margin, cardWidth);
      drawCard('ค่าเฉลี่ยต่อวัน (kWh)', avgKwh.toFixed(2), margin + cardWidth + 8, cardWidth);
      drawCard(
        'วันที่ใช้สูงสุด',
        peak.date ? `${format(peak.date, 'd MMM')} • ${peak.value.toFixed(2)} kWh` : '-',
        margin + (cardWidth + 8) * 2,
        cardWidth,
      );
      y += 60;

      // Table
      pdf.setTextColor(...textColor);
      pdf.setFont('helvetica', 'bold');
      const renderTableHeader = () => {
        pdf.setFillColor(...headerBg);
        pdf.rect(margin, y, tableWidth, rowHeight, 'F');
        pdf.setTextColor(45, 55, 72);
        pdf.setFontSize(10 * rowScale);
        const textY = y + rowHeight / 2 + 3 * rowScale;
        pdf.text('วันที่', margin + 6, textY);
        pdf.text('พลังงาน (kWh)', valueColX + valueColWidth - 6, textY, { align: 'right' });
        pdf.setTextColor(...textColor);
        y += rowHeight;
      };

      renderTableHeader();

      dailyRows.forEach(({ date, value }, index) => {
        const isZebra = index % 2 === 0;
        if (isZebra) {
          pdf.setFillColor(...zebraBg);
          pdf.rect(margin, y, tableWidth, rowHeight, 'F');
        }
        const textY = y + rowHeight / 2 + 3 * rowScale;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10 * rowScale);
        pdf.text(format(date, 'd MMM yyyy'), margin + 6, textY);
        pdf.text(value.toFixed(2), valueColX + valueColWidth - 6, textY, { align: 'right' });
        y += rowHeight;
      });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10 * rowScale);
      pdf.setFillColor(...colorAccent);
      pdf.rect(margin, y, tableWidth, rowHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      const footerY = y + rowHeight / 2 + 3;
      pdf.text('รวมทั้งช่วง', margin + 6, footerY);
      pdf.text(totalKwh.toFixed(2), valueColX + valueColWidth - 6, footerY, { align: 'right' });

      const url = pdf.output('bloburl');
      window.open(url, '_blank');
      return;
    }

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
  }, [chartBackground, customPeriod, dailyRows, meter.name, plant.name]);

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
