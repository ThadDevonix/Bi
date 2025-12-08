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
  onRegisterExport?: (exporter: () => void) => void;
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
  onRegisterExport,
}: MeterDetailProps) => {
  const chartType = period === 'daily' ? 'line' : 'bar';
  const receiptRef = useRef<HTMLDivElement>(null);

  const chartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
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
        grid: { color: '#e2e8f0' },
        ticks: { callback: (value) => `${value} kWh` },
      },
      x: { grid: { display: false } },
    },
  };

  const chartData = useMemo(
    () => ({
      labels: chartPoints.map((point) => point.label),
      datasets: [
        {
          label: 'พลังงาน (kWh)',
          data: chartPoints.map((point) => point.value),
          borderColor: period === 'daily' ? '#2563eb' : '#16a34a',
          backgroundColor: period === 'daily' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(22, 163, 74, 0.2)',
          borderWidth: 2,
          tension: 0.35,
        },
      ],
    }),
    [chartPoints, period],
  );

  const handleExportPdf = useCallback(async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 24;
    const usableWidth = pageWidth - margin * 2;
    const ratio = usableWidth / canvas.width;
    const imgHeight = canvas.height * ratio;

    pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, imgHeight);
    pdf.save(`${plant.name}-${meter.name}-invoice.pdf`);
  }, [meter.name, plant.name]);

  useEffect(() => {
    if (onRegisterExport) {
      onRegisterExport(handleExportPdf);
    }
  }, [onRegisterExport, handleExportPdf]);

  const ChartComponent = chartType === 'line' ? Line : Bar;

  return (
    <div className="meter-detail">
      <div className="meter-detail__header">
        <div className="meter-detail__title">
          <div>
            <p className="muted">มิเตอร์</p>
            <h2>{meter.name}</h2>
            {plant.location ? <span className="pill muted">{plant.location}</span> : <span className="muted">{plant.name}</span>}
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

        <div className="chart-wrapper">
          <ChartComponent data={chartData} options={chartOptions} />
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
