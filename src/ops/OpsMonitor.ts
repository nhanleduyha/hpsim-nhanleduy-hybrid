/**
 * Giám sát – thống kê công tác vận hành (tính toán xác định, không dùng AI).
 *  - Thiết bị chạy/dừng (bơm, máy nén): số lần khởi động, thời gian chạy, khoảng nghỉ, hệ số làm việc,
 *    so sánh với mức nền tự học -> phát hiện chạy liên tục, khởi động dày, chạy lâu bất thường.
 *  - Thông số tương tự: min/max/trung bình, xu hướng (độ dốc) trong cửa sổ thời gian.
 *  - Phát hiện dao động công suất / tần số / độ mở cánh hướng.
 * Lấy mẫu 1 lần/giây từ sim.snapshot (gọi trong onSecond của localApi).
 */

export interface DevDef { key: string; name: string; group: string; maxRunS: number }
export interface TagDef { key: string; name: string; unit: string; riseAlarm?: number }

const UNIT_DEVS = (n: number): DevDef[] => [
  { key: `G${n}.oilPump1`, name: `H${n} – Bơm dầu điều tốc số 1`, group: `Tổ máy H${n}`, maxRunS: 180 },
  { key: `G${n}.oilPump2`, name: `H${n} – Bơm dầu điều tốc số 2`, group: `Tổ máy H${n}`, maxRunS: 180 },
  { key: `G${n}.hc1`, name: `H${n} – Bơm tiêu nước nắp turbine số 1`, group: `Tổ máy H${n}`, maxRunS: 600 },
  { key: `G${n}.hc2`, name: `H${n} – Bơm tiêu nước nắp turbine số 2`, group: `Tổ máy H${n}`, maxRunS: 600 },
  { key: `G${n}.waterPump1`, name: `H${n} – Bơm nước làm mát số 1`, group: `Tổ máy H${n}`, maxRunS: 0 },
  { key: `G${n}.waterPump2`, name: `H${n} – Bơm nước làm mát số 2`, group: `Tổ máy H${n}`, maxRunS: 0 },
];
export const DEVICES: DevDef[] = [
  ...UNIT_DEVS(1), ...UNIT_DEVS(2),
  { key: 'PUB.leak1', name: 'Bơm nước rò số 1', group: 'Phụ trợ chung', maxRunS: 3600 },
  { key: 'PUB.leak2', name: 'Bơm nước rò số 2', group: 'Phụ trợ chung', maxRunS: 3600 },
  { key: 'PUB.drain1', name: 'Bơm tiêu nước số 1', group: 'Phụ trợ chung', maxRunS: 3600 },
  { key: 'PUB.drain2', name: 'Bơm tiêu nước số 2', group: 'Phụ trợ chung', maxRunS: 3600 },
  { key: 'PUB.lpc1', name: 'Máy nén khí hạ áp số 1', group: 'Phụ trợ chung', maxRunS: 600 },
  { key: 'PUB.lpc2', name: 'Máy nén khí hạ áp số 2', group: 'Phụ trợ chung', maxRunS: 600 },
  { key: 'PUB.hpc1', name: 'Máy nén khí cao áp số 1', group: 'Phụ trợ chung', maxRunS: 600 },
  { key: 'PUB.hpc2', name: 'Máy nén khí cao áp số 2', group: 'Phụ trợ chung', maxRunS: 600 },
  { key: 'PUB.oilleak', name: 'Bơm dầu rò', group: 'Phụ trợ chung', maxRunS: 600 },
];
const UNIT_TAGS = (n: number): TagDef[] => [
  { key: `G${n}.Pload`, name: `H${n} – Công suất P`, unit: 'MW' },
  { key: `G${n}.freq`, name: `H${n} – Tần số`, unit: 'Hz' },
  { key: `G${n}.GV`, name: `H${n} – Độ mở cánh hướng`, unit: '%' },
  { key: `G${n}.oilMPa`, name: `H${n} – Áp lực dầu điều tốc`, unit: 'MPa' },
  { key: `G${n}.cwMPa`, name: `H${n} – Áp lực nước làm mát`, unit: 'MPa' },
  { key: `G${n}.headCover`, name: `H${n} – Mức nước nắp turbine`, unit: 'mm' },
  { key: `G${n}.upper`, name: `H${n} – Nhiệt độ ổ hướng trên`, unit: '°C', riseAlarm: 0.2 },
  { key: `G${n}.lower`, name: `H${n} – Nhiệt độ ổ hướng dưới`, unit: '°C', riseAlarm: 0.2 },
  { key: `G${n}.thrust`, name: `H${n} – Nhiệt độ ổ đỡ`, unit: '°C', riseAlarm: 0.2 },
  { key: `G${n}.turbPad`, name: `H${n} – Nhiệt độ ổ hướng turbine`, unit: '°C', riseAlarm: 0.2 },
  { key: `G${n}.stator`, name: `H${n} – Nhiệt độ cuộn dây stator`, unit: '°C', riseAlarm: 0.3 },
  { key: `G${n}.trOil`, name: `H${n} – Nhiệt độ dầu MBA`, unit: '°C', riseAlarm: 0.3 },
  { key: `G${n}.shaftVib`, name: `H${n} – Rung đảo trục`, unit: '' },
];
export const TAGS: TagDef[] = [
  ...UNIT_TAGS(1), ...UNIT_TAGS(2),
  { key: 'sump', name: 'Mức nước hố thu nước rò', unit: '' },
  { key: 'drain', name: 'Mức nước hố tiêu nước', unit: '' },
  { key: 'oilLeak', name: 'Mức dầu thùng dầu rò', unit: '' },
  { key: 'lpAir', name: 'Áp lực khí hạ áp', unit: 'MPa' },
  { key: 'hpAir', name: 'Áp lực khí cao áp', unit: 'MPa' },
  { key: 'zUp', name: 'Mực nước thượng lưu', unit: 'm' },
  { key: 'FreqZone1', name: 'Tần số thanh cái C31', unit: 'Hz' },
  { key: 'VbusZone1', name: 'Điện áp thanh cái C31', unit: 'kV' },
];
const OSC_TAGS = ['G1.Pload', 'G1.freq', 'G1.GV', 'G2.Pload', 'G2.freq', 'G2.GV'];

interface Run { a: number; b: number }   // thời điểm bật / tắt (ms)
interface DevSt { on: boolean; since: number; runs: Run[]; starts: number; runS: number; alarmLong: boolean; alarmFreq: boolean }
export interface Anomaly { key: string; kind: string; text: string; since: number; level: 1 | 2 }

const HIST_S = 7200;          // giữ 2 giờ mẫu 1 s

export class OpsMonitor {
  t0 = Date.now();
  private dev = new Map<string, DevSt>();
  private buf = new Map<string, Float32Array>();
  private head = 0;           // vị trí ghi tiếp theo trong vòng đệm
  private count = 0;          // số mẫu đã có (≤ HIST_S)
  private lastT = 0;
  anomalies: Anomaly[] = [];
  history: Anomaly[] = [];
  onAnomaly: ((a: Anomaly) => void) | null = null;

  constructor() {
    for (const t of TAGS) this.buf.set(t.key, new Float32Array(HIST_S));
  }

  reset(): void {
    this.t0 = Date.now(); this.dev.clear(); this.head = 0; this.count = 0; this.anomalies = []; this.history = [];
    for (const t of TAGS) this.buf.get(t.key)!.fill(0);
  }

  tick(snap: Record<string, unknown>, now = Date.now()): void {
    this.lastT = now;
    const num = (k: string) => { const v = snap[k]; return typeof v === 'number' && Number.isFinite(v) ? v : (v === true ? 1 : 0); };
    // --- thiết bị chạy/dừng
    for (const d of DEVICES) {
      const isOn = num(d.key) !== 0;
      let st = this.dev.get(d.key);
      if (!st) { st = { on: isOn, since: now, runs: [], starts: 0, runS: 0, alarmLong: false, alarmFreq: false }; this.dev.set(d.key, st); continue; }
      if (isOn) st.runS += 1;
      if (isOn !== st.on) {
        if (isOn) st.starts++;
        else { st.runs.push({ a: st.since, b: now }); if (st.runs.length > 300) st.runs.shift(); }
        st.on = isOn; st.since = now;
      }
    }
    // --- thông số tương tự
    for (const t of TAGS) this.buf.get(t.key)![this.head] = num(t.key);
    this.head = (this.head + 1) % HIST_S; this.count = Math.min(HIST_S, this.count + 1);
    if (this.count % 5 === 0) this.evaluate(now);
  }

  /** Chuỗi mẫu của một thông số trong `sec` giây gần nhất (cũ -> mới) */
  series(key: string, sec: number): number[] {
    const b = this.buf.get(key); if (!b) return [];
    const n = Math.min(this.count, Math.max(1, Math.floor(sec)));
    const out: number[] = new Array(n);
    for (let i = 0; i < n; i++) out[i] = b[(this.head - n + i + HIST_S) % HIST_S];
    return out;
  }

  tagStats(key: string, sec: number) {
    const s = this.series(key, sec); const n = s.length;
    if (!n) return null;
    let mn = Infinity, mx = -Infinity, sum = 0;
    for (const v of s) { if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
    const avg = sum / n;
    // độ dốc bình phương tối thiểu, đơn vị/phút
    let sxy = 0, sxx = 0; const xm = (n - 1) / 2;
    for (let i = 0; i < n; i++) { sxy += (i - xm) * (s[i] - avg); sxx += (i - xm) * (i - xm); }
    const slopeMin = sxx > 0 ? (sxy / sxx) * 60 : 0;
    return { now: s[n - 1], min: mn, max: mx, avg, slopePerMin: slopeMin, samples: n };
  }

  /** Dao động: đếm số lần cắt qua giá trị trung bình (có vùng trễ) và biên độ đỉnh-đỉnh trong 120 s */
  oscillation(key: string, sec = 120) {
    const s = this.series(key, sec); const n = s.length;
    if (n < 30) return null;
    const avg = s.reduce((a, b) => a + b, 0) / n;
    let mn = Infinity, mx = -Infinity; for (const v of s) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    const p2p = mx - mn;
    const band = p2p * 0.2;
    let side = 0, cross = 0;
    for (const v of s) {
      const d = v - avg;
      if (d > band && side <= 0) { if (side < 0) cross++; side = 1; }
      else if (d < -band && side >= 0) { if (side > 0) cross++; side = -1; }
    }
    const periodS = cross >= 2 ? (2 * n) / cross : 0;
    return { p2p, crossings: cross, periodS, avg };
  }

  devStats(key: string) {
    const st = this.dev.get(key); const def = DEVICES.find(d => d.key === key);
    if (!st || !def) return null;
    const now = this.lastT || Date.now();
    const hourAgo = now - 3600_000;
    const runs = st.runs;
    const startsLastHour = runs.filter(r => r.a >= hourAgo).length + (st.on && st.since >= hourAgo ? 1 : 0);
    let onLastHour = 0;
    for (const r of runs) if (r.b > hourAgo) onLastHour += r.b - Math.max(r.a, hourAgo);
    if (st.on) onLastHour += now - Math.max(st.since, hourAgo);
    const span = Math.min(3600_000, now - this.t0);
    const durs = runs.map(r => (r.b - r.a) / 1000);
    const gaps: number[] = []; for (let i = 1; i < runs.length; i++) gaps.push((runs[i].a - runs[i - 1].b) / 1000);
    const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const recentGap = mean(gaps.slice(-3)), baseGap = gaps.length >= 6 ? mean(gaps.slice(0, -3).slice(-20)) : 0;
    const recentDur = mean(durs.slice(-3)), baseDur = durs.length >= 6 ? mean(durs.slice(0, -3).slice(-20)) : 0;
    return {
      key, name: def.name, group: def.group,
      on: st.on, curS: Math.round((now - st.since) / 1000),
      starts: st.starts, totalRunMin: +(st.runS / 60).toFixed(1),
      startsLastHour, dutyPctLastHour: span > 0 ? +(100 * onLastHour / span).toFixed(1) : 0,
      avgRunS: +recentDur.toFixed(1), baseRunS: +baseDur.toFixed(1),
      avgGapS: +recentGap.toFixed(1), baseGapS: +baseGap.toFixed(1),
      lastRuns: runs.slice(-5).map(r => ({ start: new Date(r.a).toLocaleTimeString('vi-VN'), durS: Math.round((r.b - r.a) / 1000) })),
    };
  }

  private raise(key: string, kind: string, text: string, level: 1 | 2, now: number) {
    if (this.anomalies.some(a => a.key === key && a.kind === kind)) return;
    const a: Anomaly = { key, kind, text, since: now, level };
    this.anomalies.push(a); this.history.push(a); if (this.history.length > 200) this.history.shift();
    if (this.onAnomaly) this.onAnomaly(a);
  }
  private clear(key: string, kind: string) { this.anomalies = this.anomalies.filter(a => !(a.key === key && a.kind === kind)); }

  private evaluate(now: number) {
    for (const d of DEVICES) {
      const s = this.devStats(d.key); if (!s) continue;
      // 1) chạy liên tục quá lâu
      if (d.maxRunS > 0) {
        if (s.on && s.curS > d.maxRunS) this.raise(d.key, 'long', `${d.name} chạy liên tục ${Math.round(s.curS / 60)} phút (bình thường < ${Math.round(d.maxRunS / 60)} phút)`, 2, now);
        else if (!s.on) this.clear(d.key, 'long');
      }
      // 2) khởi động dày hơn mức nền (khoảng nghỉ gần đây < 50 % mức nền)
      if (s.baseGapS > 0 && s.avgGapS > 0) {
        if (s.avgGapS < 0.5 * s.baseGapS) this.raise(d.key, 'freq', `${d.name} khởi động dày bất thường: nghỉ trung bình ${s.avgGapS.toFixed(0)} s giữa 2 lần chạy (mức nền ${s.baseGapS.toFixed(0)} s)`, 2, now);
        else if (s.avgGapS > 0.7 * s.baseGapS) this.clear(d.key, 'freq');
      }
      // 3) mỗi lần chạy lâu hơn hẳn mức nền
      if (s.baseRunS > 0 && s.avgRunS > 0) {
        if (s.avgRunS > 2 * s.baseRunS) this.raise(d.key, 'dur', `${d.name} mỗi lần chạy lâu bất thường: ${s.avgRunS.toFixed(0)} s (mức nền ${s.baseRunS.toFixed(0)} s)`, 2, now);
        else if (s.avgRunS < 1.5 * s.baseRunS) this.clear(d.key, 'dur');
      }
    }
    // 4) thông số nhiệt độ tăng liên tục (30 phút)
    for (const t of TAGS) {
      if (!t.riseAlarm || this.count < 600) continue;
      const st = this.tagStats(t.key, 1800); if (!st) continue;
      if (st.slopePerMin > t.riseAlarm) this.raise(t.key, 'rise', `${t.name} tăng liên tục ${st.slopePerMin.toFixed(2)} ${t.unit}/phút (hiện ${st.now.toFixed(1)} ${t.unit})`, 2, now);
      else if (st.slopePerMin < t.riseAlarm * 0.5) this.clear(t.key, 'rise');
    }
    // 5) dao động
    for (const k of OSC_TAGS) {
      const o = this.oscillation(k, 120); if (!o) continue;
      const def = TAGS.find(t => t.key === k)!;
      const lim = k.endsWith('freq') ? 0.15 : k.endsWith('GV') ? 3 : 0.3;   // Hz, %, MW
      const running = o.avg > (k.endsWith('freq') ? 45 : k.endsWith('GV') ? 5 : 0.3);
      if (running && o.p2p > lim && o.crossings >= 6) this.raise(k, 'osc', `${def.name} dao động: biên độ đỉnh-đỉnh ${o.p2p.toFixed(2)} ${def.unit}, chu kỳ ~${o.periodS.toFixed(0)} s`, 1, now);
      else if (o.p2p < lim * 0.5 || o.crossings < 3) this.clear(k, 'osc');
    }
  }

  summary() {
    return {
      since: new Date(this.t0).toLocaleString('vi-VN'),
      sampledMin: +(this.count / 60).toFixed(1),
      anomalies: this.anomalies.map(a => ({ ...a, sinceText: new Date(a.since).toLocaleTimeString('vi-VN') })),
      history: this.history.slice(-30).map(a => ({ ...a, sinceText: new Date(a.since).toLocaleTimeString('vi-VN') })),
      devices: DEVICES.map(d => this.devStats(d.key)).filter(Boolean),
      tags: TAGS.map(t => ({ key: t.key, name: t.name, unit: t.unit, ...(this.tagStats(t.key, 1800) || {}) })),
    };
  }
}
