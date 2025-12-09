import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, format as formatDate, isValid, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import './App.css';
import PlantSelector from './components/PlantSelector';
import MeterList from './components/MeterList';
import MeterDetail from './components/MeterDetail';
import type { Plant, UsagePeriod } from './types';
import { plants as seedPlants } from './data/plants';
import { aggregateUsage } from './utils/aggregation';
import { calculateCost, calculateTotalUsage, filterReadingsByPeriod, getBillingPeriod } from './utils/billing';
import { formatCurrency, formatNumber, formatPeriod } from './utils/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

type View = 'plant' | 'meterList' | 'meterDetail';
type Theme = 'light' | 'dark';

function App() {
  const currencyOptions: Plant['currency'][] = ['THB', 'USD', 'EUR', 'JPY', 'AUD'];
  const [plants, setPlants] = useState<Plant[]>(seedPlants);
  const [selectedPlantId, setSelectedPlantId] = useState<string>(seedPlants[0]?.id ?? '');
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [period, setPeriod] = useState<UsagePeriod>('daily');
  const [dailyDate, setDailyDate] = useState<string>(() => formatDate(new Date(), 'yyyy-MM-dd'));
  const [monthlyMonth, setMonthlyMonth] = useState<string>(() => formatDate(new Date(), 'yyyy-MM'));
  const [yearlyYear, setYearlyYear] = useState<string>(() => formatDate(new Date(), 'yyyy'));
  const [view, setView] = useState<View>('plant');
  const [detailTab, setDetailTab] = useState<'chart' | 'billing'>('chart');
  const [theme, setTheme] = useState<Theme>('light');
  const exportHandlerRef = useRef<(() => void) | null>(null);
  const [exportReady, setExportReady] = useState(false);
  const [customRateOn, setCustomRateOn] = useState<number | ''>(''); // 09:00-22:00
  const [customRateOff, setCustomRateOff] = useState<number | ''>(''); // 22:00-09:00
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const selectedPlant = useMemo(
    () => plants.find((plant) => plant.id === selectedPlantId) ?? plants[0],
    [plants, selectedPlantId],
  );

  const selectedMeter = useMemo(() => {
    if (!selectedPlant) return undefined;
    if (!selectedMeterId) return undefined;
    return selectedPlant.meters.find((m) => m.id === selectedMeterId);
  }, [selectedMeterId, selectedPlant]);

  const billingPeriod = selectedPlant ? getBillingPeriod(selectedPlant.billingStartDay) : null;

  const meterSummaries = useMemo(() => {
    if (!selectedPlant || !billingPeriod) return {};
    return selectedPlant.meters.reduce<Record<string, { usage: number; cost: number }>>((acc, meter) => {
      const readings = filterReadingsByPeriod(meter.readings, billingPeriod);
      const usage = calculateTotalUsage(readings);
      acc[meter.id] = { usage, cost: calculateCost(usage, meter.ratePerKwh) };
      return acc;
    }, {});
  }, [billingPeriod, selectedPlant]);

  const readingsThisPeriod =
    billingPeriod && selectedMeter ? filterReadingsByPeriod(selectedMeter.readings, billingPeriod) : [];
  const usageThisPeriod = selectedMeter && billingPeriod ? calculateTotalUsage(readingsThisPeriod) : 0;
  const costThisPeriod = selectedMeter && billingPeriod ? calculateCost(usageThisPeriod, selectedMeter.ratePerKwh) : 0;

const selectedDailyDate = useMemo(() => {
  const parsed = parseISO(dailyDate);
  return isValid(parsed) ? parsed : new Date();
}, [dailyDate]);

const selectedMonthlyDate = useMemo(() => {
  const parsed = parseISO(`${monthlyMonth}-01`);
  return isValid(parsed) ? startOfMonth(parsed) : startOfMonth(new Date());
}, [monthlyMonth]);

const selectedYear = useMemo(() => {
  const yearNum = Number(yearlyYear);
  const thisYear = new Date().getFullYear();
  if (!Number.isFinite(yearNum)) return thisYear;
  return Math.min(Math.max(yearNum, YEAR_MIN), thisYear);
}, [yearlyYear]);

  const chartPoints = useMemo(
    () => (selectedMeter
      ? aggregateUsage(selectedMeter.readings, period, {
        day: selectedDailyDate,
        month: selectedMonthlyDate,
        year: selectedYear,
      })
      : []),
    [period, selectedMeter, selectedDailyDate, selectedMonthlyDate, selectedYear],
  );

  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    ChartJS.defaults.color = theme === 'dark' ? '#e6edf9' : '#1f2730';
    ChartJS.defaults.borderColor = theme === 'dark' ? '#233456' : '#d8cbb8';
  }, [theme]);

const toDateInputValue = (date: Date) => formatDate(date, 'yyyy-MM-dd');
const toMonthInputValue = (date: Date) => formatDate(date, 'yyyy-MM');
const toYearInputValue = (date: Date) => formatDate(date, 'yyyy');
const todayInputValue = toDateInputValue(new Date());
const currentMonthInputValue = toMonthInputValue(new Date());
const currentYearInputValue = toYearInputValue(new Date());
const YEAR_MIN = 2020;

const handleDailyShift = (delta: number) => {
  setDailyDate((prev) => {
    const parsed = parseISO(prev);
    const base = isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date());
      const next = startOfDay(addDays(base, delta));
    const today = startOfDay(new Date());
    const clamped = next.getTime() > today.getTime() ? today : next;
    return toDateInputValue(clamped);
  });
};

const handleMonthlyShift = (delta: number) => {
  setMonthlyMonth((prev) => {
    const parsed = parseISO(`${prev}-01`);
    const base = isValid(parsed) ? startOfMonth(parsed) : startOfMonth(new Date());
    const next = startOfMonth(addMonths(base, delta));
    const thisMonth = startOfMonth(new Date());
    const clamped = next.getTime() > thisMonth.getTime() ? thisMonth : next;
    return toMonthInputValue(clamped);
  });
};

const handleMonthlyChange = (value: string) => {
  if (!value) {
    setMonthlyMonth(currentMonthInputValue);
    return;
  }
  const parsed = parseISO(`${value}-01`);
  const thisMonth = startOfMonth(new Date());
  if (!isValid(parsed)) {
    setMonthlyMonth(currentMonthInputValue);
    return;
  }
  const next = startOfMonth(parsed);
  const clamped = next.getTime() > thisMonth.getTime() ? thisMonth : next;
  setMonthlyMonth(toMonthInputValue(clamped));
};

const handleYearlyShift = (delta: number) => {
  setYearlyYear((prev) => {
    const parsedYear = Number(prev);
    const base = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
    const next = base + delta;
    const thisYear = new Date().getFullYear();
    const clamped = Math.min(Math.max(next, YEAR_MIN), thisYear);
    return String(clamped);
  });
};

const handleYearlyChange = (value: string) => {
  const next = Number(value);
  const thisYear = new Date().getFullYear();
  if (!Number.isFinite(next)) {
    setYearlyYear(currentYearInputValue);
    return;
  }
  const clamped = Math.min(Math.max(next, YEAR_MIN), thisYear);
  setYearlyYear(String(clamped));
};

  const customPeriod = useMemo(() => {
    if (!billingPeriod) return null;
    const start = customStart ? parseISO(customStart) : billingPeriod.start;
    const end = customEnd ? parseISO(customEnd) : billingPeriod.end;
    if (!isValid(start) || !isValid(end)) return null;
    const startDate = startOfDay(start);
    const endDate = startOfDay(end);
    if (startDate.getTime() > endDate.getTime()) {
      return { start: endDate, end: startDate };
    }
    return { start: startDate, end: endDate };
  }, [billingPeriod, customEnd, customStart]);

  const { offUsage, onUsage } = useMemo(() => {
    if (!customPeriod || !selectedMeter) return { offUsage: 0, onUsage: 0 };
    const readings = filterReadingsByPeriod(selectedMeter.readings, customPeriod);
    return readings.reduce(
      (acc, reading) => {
        const hour = new Date(reading.timestamp).getHours();
        if (hour >= 22 || hour < 9) {
          acc.offUsage += reading.kwh;
        } else {
          acc.onUsage += reading.kwh;
        }
        return acc;
      },
      { offUsage: 0, onUsage: 0 },
    );
  }, [customPeriod, selectedMeter]);
  const customCost =
    offUsage * (Number(customRateOff) || 0) +
    onUsage * (Number(customRateOn) || 0);

  const handleSelectPlant = (plantId: string) => {
    setSelectedPlantId(plantId);
    setSelectedMeterId('');
    setView('meterList');
    setDetailTab('chart');
    setDailyDate(formatDate(new Date(), 'yyyy-MM-dd'));
    setMonthlyMonth(currentMonthInputValue);
    setYearlyYear(currentYearInputValue);
    setTheme('light');
    exportHandlerRef.current = null;
    setExportReady(false);
    setCustomRateOn('');
    setCustomRateOff('');
    setCustomStart('');
    setCustomEnd('');
  };

  const handleUpdatePlant = (updates: Partial<Pick<Plant, 'currency' | 'billingStartDay'>>) => {
    if (!selectedPlant) return;
    setPlants((prev) =>
      prev.map((plant) =>
        plant.id === selectedPlant.id
          ? {
              ...plant,
              ...updates,
              billingStartDay:
                updates.billingStartDay !== undefined ? Math.max(1, Math.min(28, updates.billingStartDay)) : plant.billingStartDay,
            }
          : plant,
      ),
    );
  };

  const handleSelectMeter = (meterId: string) => {
    setSelectedMeterId(meterId);
    setView('meterDetail');
    setDetailTab('chart');
    setDailyDate(formatDate(new Date(), 'yyyy-MM-dd'));
    setMonthlyMonth(currentMonthInputValue);
    setYearlyYear(currentYearInputValue);
    exportHandlerRef.current = null;
    setExportReady(false);
    const meter = selectedPlant?.meters.find((m) => m.id === meterId);
    const nextBillingPeriod = selectedPlant ? getBillingPeriod(selectedPlant.billingStartDay) : null;
    const baseRate = meter ? meter.ratePerKwh : 0;
    setCustomRateOn(baseRate ? Number(baseRate.toFixed(2)) : '');
    setCustomRateOff(baseRate ? Number((baseRate * 0.8).toFixed(2)) : '');
    if (nextBillingPeriod) {
      setCustomStart(toDateInputValue(nextBillingPeriod.start));
      setCustomEnd(toDateInputValue(nextBillingPeriod.end));
    } else {
      setCustomStart('');
      setCustomEnd('');
    }
  };

  const renderPlantSelection = () => (
    <section className="panel">
      <div className="panel-head">
        <div className="step-chip">1</div>
        <div>
          <p className="eyebrow">Plant</p>
          <h3>เลือกโรงไฟฟ้า</h3>
        </div>
        <div className="muted">คลิก Plant เพื่อไปเลือกมิเตอร์</div>
      </div>
      <PlantSelector plants={plants} selectedPlantId={selectedPlant?.id ?? ''} onSelect={handleSelectPlant} />
    </section>
  );

  const renderMeterList = () => {
    if (!selectedPlant) return null;

    return (
      <>
        <section className="panel">
          <div className="panel-head">
            <div className="step-chip">2</div>
            <div>
              <p className="eyebrow">Meters</p>
              <h3>เลือกมิเตอร์ใน {selectedPlant.name}</h3>
            </div>
            <div className="muted">เลือกมิเตอร์ที่ต้องการดูข้อมูล</div>
          </div>
          <MeterList
            meters={selectedPlant.meters}
            selectedMeterId={selectedMeterId}
            onSelect={handleSelectMeter}
            summaries={meterSummaries}
            currency={selectedPlant.currency}
          />
        </section>
      </>
    );
  };

  const renderMeterDetail = () => {
    if (!selectedPlant) return null;
    if (!selectedMeter || !billingPeriod) {
      return (
        <section className="panel">
          <div className="panel-head">
            <div className="step-chip">2</div>
            <div>
              <p className="eyebrow">Meters</p>
              <h3>เลือกมิเตอร์ก่อน</h3>
            </div>
          </div>
          <p className="muted">กลับไปเลือกมิเตอร์เพื่อดูกราฟและออกใบเสร็จ</p>
          <div className="panel-foot">
            <button type="button" className="ghost" onClick={() => setView('meterList')}>
              กลับไปเลือกมิเตอร์
            </button>
          </div>
        </section>
      );
    }

    const isChartView = detailTab === 'chart';

    return (
      <>
        {isChartView ? (
          <section className="panel">
            <div className="panel-head">
              <div className="step-chip">3</div>
              <div>
                <p className="eyebrow">Usage</p>
                <h3>กราฟการใช้ไฟ / มิเตอร์</h3>
              </div>
              <div className="panel-head-actions">
                <div className="inline-tabs">
                  <button
                    type="button"
                    className={isChartView ? 'active' : ''}
                    onClick={() => setDetailTab('chart')}
                  >
                    กราฟ
                  </button>
                  <button
                    type="button"
                    className={!isChartView ? 'active' : ''}
                    onClick={() => setDetailTab('billing')}
                  >
                    ออกบิล
                  </button>
                </div>
              </div>
            </div>
            <MeterDetail
              plant={selectedPlant}
              meter={selectedMeter}
              period={period}
              onPeriodChange={setPeriod}
              dailyDate={dailyDate}
              dailyMaxDate={todayInputValue}
              onDailyDateChange={setDailyDate}
              onDailyDateShift={handleDailyShift}
              monthlyMonth={monthlyMonth}
              monthlyMaxMonth={currentMonthInputValue}
              onMonthlyChange={handleMonthlyChange}
              onMonthlyShift={handleMonthlyShift}
              yearlyYear={yearlyYear}
              yearlyMaxYear={currentYearInputValue}
              yearlyMinYear={String(YEAR_MIN)}
              onYearlyChange={handleYearlyChange}
              onYearlyShift={handleYearlyShift}
              billingPeriod={billingPeriod}
              billingUsage={usageThisPeriod}
              billingCost={costThisPeriod}
              chartPoints={chartPoints}
              theme={theme}
              onRegisterExport={(fn) => {
                exportHandlerRef.current = fn;
                setExportReady(Boolean(fn));
              }}
            />
          </section>
        ) : (
          <section className="panel">
            <div className="panel-head">
              <div className="step-chip">3</div>
              <div>
                <p className="eyebrow">Billing</p>
                <h3>ออกบิล / ตั้งค่ารอบบิล</h3>
              </div>
              <div className="panel-head-actions">
                <div className="inline-tabs">
                  <button
                    type="button"
                    className={isChartView ? 'active' : ''}
                    onClick={() => setDetailTab('chart')}
                  >
                    กราฟ
                  </button>
                  <button
                    type="button"
                    className={!isChartView ? 'active' : ''}
                    onClick={() => setDetailTab('billing')}
                  >
                    ออกบิล
                  </button>
                </div>
              </div>
            </div>
            <div className="stats">
              <div className="stat-card">
                <p className="muted">รอบบิลปัจจุบัน</p>
                <strong>{formatPeriod(billingPeriod)}</strong>
              </div>
              <div className="stat-card">
                <p className="muted">การใช้ไฟรอบบิลนี้</p>
                <strong>{formatNumber(usageThisPeriod)} kWh</strong>
              </div>
              <div className="stat-card">
                <p className="muted">ประมาณการค่าไฟ</p>
                <strong>{formatCurrency(costThisPeriod, selectedPlant.currency)}</strong>
              </div>
            </div>
            <div className="billing-card inline-select-row">
              <label>หน่วยเงิน (Currency)</label>
              <select
                className="inline-select"
                value={selectedPlant.currency}
                onChange={(e) => handleUpdatePlant({ currency: e.target.value as Plant['currency'] })}
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
              <div className="panel-sub">
                <div className="panel-head">
                  <div className="step-chip">4</div>
                  <div>
                    <p className="eyebrow">Custom invoice</p>
                    <h3>ตั้งค่าอัตรา & ช่วงวันที่ออกบิลเอง</h3>
                  </div>
                </div>
              <div className="billing-custom">
                <div className="billing-column">
                  <div className="billing-card">
                    <p className="eyebrow">ตั้งค่าอัตรา</p>
                    <div className="form-grid">
                      <div>
                        <label>อัตราค่าไฟ (09:00 - 22:00)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={customRateOn}
                          onChange={(e) => setCustomRateOn(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <p className="muted">หน่วย {selectedPlant.currency} ต่อ kWh</p>
                      </div>
                      <div>
                        <label>อัตราค่าไฟ (22:00 - 09:00)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={customRateOff}
                          onChange={(e) => setCustomRateOff(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <p className="muted">หน่วย {selectedPlant.currency} ต่อ kWh</p>
                      </div>
                    </div>
                  </div>
                  <div className="billing-card">
                    <p className="eyebrow">ช่วงออกบิล</p>
                    <div className="date-grid">
                      <div>
                        <label>วันที่เริ่ม</label>
                        <input
                          type="date"
                          className="date-input"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                        />
                      </div>
                      <div>
                        <label>วันที่สิ้นสุด</label>
                        <input
                          type="date"
                          className="date-input"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="billing-column">
                  <div className="billing-card highlight">
                    <p className="eyebrow">สรุปบิลที่ตั้งเอง</p>
                    {customPeriod ? (
                      <div className="stats tight">
                        <div className="stat-card">
                          <p className="muted">ช่วงออกบิล</p>
                          <strong>{formatPeriod(customPeriod)}</strong>
                        </div>
                        <div className="stat-card">
                          <p className="muted">ใช้ไฟ 09:00 - 22:00</p>
                          <strong>{formatNumber(onUsage)} kWh</strong>
                        </div>
                        <div className="stat-card">
                          <p className="muted">ใช้ไฟ 22:00 - 09:00</p>
                          <strong>{formatNumber(offUsage)} kWh</strong>
                        </div>
                        <div className="stat-card">
                          <p className="muted">ยอดคำนวณ</p>
                          <strong>{formatCurrency(customCost, selectedPlant.currency)}</strong>
                        </div>
                      </div>
                    ) : (
                      <p className="muted">โปรดกรอกวันที่เริ่มและสิ้นสุดให้ถูกต้อง</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="panel-foot">
              <div className="muted">ต้องการออกใบเสร็จ PDF</div>
              <button type="button" className="primary" onClick={() => exportHandlerRef.current?.()} disabled={!exportReady}>
                Export PDF ใบเสร็จ
              </button>
            </div>
          </section>
        )}
      </>
    );
  };

  return (
    <div className="page">
      <div className={`topbar ${view !== 'plant' ? 'topbar--with-back' : ''}`}>
        <div className="topbar-left">
          {view !== 'plant' ? (
            <button
              type="button"
              className="back-btn"
              onClick={() => (view === 'meterDetail' ? setView('meterList') : setView('plant'))}
            >
              <span className="back-btn__icon">↩︎</span>
              <span>ย้อนกลับ</span>
            </button>
          ) : null}
        </div>
        <div className="topbar-actions">
          <label className="theme-switch">
            <input
              type="checkbox"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
            />
            <span className="slider">
              <span className="label-left" aria-hidden="true">☀</span>
              <span className="label-right" aria-hidden="true">☾</span>
            </span>
          </label>
        </div>
      </div>

      {view === 'plant' || !selectedPlant
        ? renderPlantSelection()
        : view === 'meterList'
          ? renderMeterList()
          : renderMeterDetail()}
    </div>
  );
}

export default App;
