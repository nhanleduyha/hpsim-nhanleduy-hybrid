export class Meter {
  readonly id: string;
  readonly name: string;
  readonly r: [number, number, number, number] = [0, 0, 0, 0]; // 0 kWh giao, 1 kWh nhận, 2 kVArh giao, 3 kVArh nhận

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

export interface EnergyClose {
  label: string;
  from: number;
  to: number;
  start: Record<string, number[]>;
  end: Record<string, number[]>;
}

/**
 * Bộ công tơ điện năng 4 thanh ghi (kWh giao, kWh nhận, kVArh giao, kVArh nhận) cho tổ máy, đường dây và tự dùng.
 * Quy ước chiều "giao": tổ máy phát ra lưới; đường dây từ thanh cái nhà máy ra đường dây; tự dùng từ nguồn vào thanh cái 0,4 kV.
 * Lưu bền dạng JSON; chốt số đầu ca (nhận ca) và đầu ngày (0 giờ), giữ lịch sử 31 ngày, 30 ca.
 */
export class EnergyMeters {
  readonly meters: Meter[] = [
    new Meter('MF1', 'Tổ máy 1'),
    new Meter('MF2', 'Tổ máy 2'),
    new Meter('L371', 'Đường dây 371'),
    new Meter('L372', 'Đường dây 372'),
    new Meter('TD61', 'Tự dùng TD61 (1AXT)'),
    new Meter('TD32', 'Tự dùng TD32 (2AXT)'),
    new Meter('DG', 'Máy phát diesel'),
  ];
  readonly REG = ['kWhGiao', 'kWhNhan', 'kVArhGiao', 'kVArhNhan'] as const;

  dayDate: string;
  dayStart: Record<string, number[]>;
  shiftStartMs: number;
  shiftStart: Record<string, number[]>;
  readonly days: EnergyClose[] = [];
  readonly shifts: EnergyClose[] = [];

  constructor() {
    this.dayDate = this.today();
    this.dayStart = this.snap();
    this.shiftStartMs = Date.now();
    this.shiftStart = this.snap();
  }

  private today(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private snap(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const m of this.meters) out[m.id] = [...m.r];
    return out;
  }

  /** dt giây; P (MW), Q (MVAr) theo từng công tơ */
  integrate(dt: number, pq: Record<string, [number, number]>): void {
    for (const m of this.meters) {
      const pair = pq[m.id];
      if (!pair) continue;
      const [p, q] = pair;
      const e = (dt / 3600.0) * 1000.0;
      if (p >= 0) m.r[0] += p * e;
      else m.r[1] += -p * e;
      if (q >= 0) m.r[2] += q * e;
      else m.r[3] += -q * e;
    }
    const d = this.today();
    if (d !== this.dayDate) {
      this.days.unshift({ label: this.dayDate, from: 0, to: Date.now(), start: this.dayStart, end: this.snap() });
      while (this.days.length > 31) this.days.pop();
      this.dayDate = d;
      this.dayStart = this.snap();
    }
  }

  /** chốt ca (khi nhận ca mới) */
  closeShift(label: string): void {
    const now = Date.now();
    this.shifts.unshift({ label, from: this.shiftStartMs, to: now, start: this.shiftStart, end: this.snap() });
    while (this.shifts.length > 30) this.shifts.pop();
    this.shiftStartMs = now;
    this.shiftStart = this.snap();
  }

  get(id: string): [number, number, number, number] {
    const m = this.meters.find((it) => it.id === id);
    if (!m) throw new Error(`Unknown meter ${id}`);
    return m.r;
  }

  private rd(o: Record<string, unknown> | null | undefined): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const m of this.meters) {
      const a = o && Array.isArray(o[m.id]) ? (o[m.id] as unknown[]) : null;
      out[m.id] = a && a.length >= 4 ? [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0, Number(a[3]) || 0] : [...m.r];
    }
    return out;
  }

  toJson(): Record<string, unknown> {
    const e1 = this.get('L371');
    const e2 = this.get('L372');
    return {
      meters: this.snap(),
      dayDate: this.dayDate,
      dayStart: this.dayStart,
      shiftStartMs: this.shiftStartMs,
      shiftStart: this.shiftStart,
      days: this.days.map((c) => ({ label: c.label, from: c.from, to: c.to, start: c.start, end: c.end })),
      shifts: this.shifts.map((c) => ({ label: c.label, from: c.from, to: c.to, start: c.start, end: c.end })),
      A371: e1[0] - e1[1],
      A372: e2[0] - e2[1],
    };
  }

  load(o: Record<string, unknown> | null | undefined): void {
    if (!o) return;
    const ms = o.meters as Record<string, unknown> | undefined;
    if (!ms) {
      this.get('L371')[0] = Math.max(0.0, Number(o.A371) || 0.0);
      this.get('L372')[0] = Math.max(0.0, Number(o.A372) || 0.0);
      this.dayStart = this.snap();
      this.shiftStart = this.snap();
      return;
    }
    const loaded = this.rd(ms);
    for (const [k, v] of Object.entries(loaded)) {
      const dst = this.get(k);
      for (let i = 0; i < 4; i++) dst[i] = v[i];
    }
    this.dayDate = typeof o.dayDate === 'string' ? o.dayDate : this.today();
    this.dayStart = this.rd(o.dayStart as Record<string, unknown>);
    this.shiftStartMs = typeof o.shiftStartMs === 'number' ? o.shiftStartMs : Date.now();
    this.shiftStart = this.rd(o.shiftStart as Record<string, unknown>);
    this.days.length = 0;
    if (Array.isArray(o.days)) {
      for (const it of o.days as Array<Record<string, unknown>>) {
        this.days.push({
          label: String(it.label ?? ''),
          from: Number(it.from) || 0,
          to: Number(it.to) || 0,
          start: this.rd(it.start as Record<string, unknown>),
          end: this.rd(it.end as Record<string, unknown>),
        });
      }
    }
    this.shifts.length = 0;
    if (Array.isArray(o.shifts)) {
      for (const it of o.shifts as Array<Record<string, unknown>>) {
        this.shifts.push({
          label: String(it.label ?? ''),
          from: Number(it.from) || 0,
          to: Number(it.to) || 0,
          start: this.rd(it.start as Record<string, unknown>),
          end: this.rd(it.end as Record<string, unknown>),
        });
      }
    }
  }
}
