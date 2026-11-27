/**
 * Sổ sự kiện (SOE), xu hướng (Trend), và lưu trữ tự chấm điểm (AssessStore) chạy hoàn toàn trên trình duyệt (localStorage).
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function fmtIdTs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}_${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function safeLSGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLSSet(key: string, val: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, val);
  } catch {
    // ignore quota errors
  }
}

function safeLSRemove(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export interface SoeRec {
  seq: number;
  ts: number;
  kind: string;
  unit: number;
  text: string;
}

/** Sổ sự kiện (SOE): lưu 5000 dòng trong RAM + lưu 500 dòng gần nhất trong localStorage */
export class SoeStore {
  private static readonly LS_KEY = 'hps_dhl2_soe_v1';
  private readonly recs: SoeRec[] = [];
  private seq = 0;
  sessionStart = 0;
  sessionName = '';

  constructor() {
    this.load();
  }

  add(kind: string, unit: number, text: string): void {
    this.seq++;
    this.recs.push({ seq: this.seq, ts: Date.now(), kind, unit, text });
    while (this.recs.length > 5000) this.recs.shift();
  }

  since(s: number, max = 500): SoeRec[] {
    const f = this.recs.filter((r) => r.seq > s);
    return f.length > max ? f.slice(f.length - max) : f;
  }

  range(from: number): SoeRec[] {
    return this.recs.filter((r) => r.ts >= from);
  }

  unitName(u: number): string {
    return u === 1 ? 'LCU1' : u === 2 ? 'LCU2' : u === 3 ? 'PUB' : 'TRẠM';
  }

  csv(from: number): string {
    let out = '\uFEFFThời gian,Loại,Thiết bị,Nội dung\n';
    for (const r of this.range(from)) {
      out += `${fmtDateTime(r.ts)},${r.kind},${this.unitName(r.unit)},"${r.text.replace(/"/g, "'")}"\n`;
    }
    return out;
  }

  save(): void {
    const tail = this.recs.length > 400 ? this.recs.slice(this.recs.length - 400) : this.recs;
    safeLSSet(
      SoeStore.LS_KEY,
      JSON.stringify({ seq: this.seq, sessionStart: this.sessionStart, sessionName: this.sessionName, recs: tail }),
    );
  }

  private load(): void {
    try {
      const raw = safeLSGet(SoeStore.LS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (typeof obj.seq === 'number') this.seq = obj.seq;
      if (typeof obj.sessionStart === 'number') this.sessionStart = obj.sessionStart;
      if (typeof obj.sessionName === 'string') this.sessionName = obj.sessionName;
      if (Array.isArray(obj.recs)) {
        for (const r of obj.recs) {
          if (r && typeof r.seq === 'number') this.recs.push(r);
        }
      }
    } catch {
      // ignore
    }
  }

  clear(): void {
    this.recs.length = 0;
    this.seq = 0;
    this.sessionStart = 0;
    this.sessionName = '';
    safeLSRemove(SoeStore.LS_KEY);
  }
}

/** Lưu xu hướng trong RAM (mẫu 2 giây, tối đa 43200 mẫu = 24 giờ) */
export class TrendStore {
  readonly keys = [
    'VbusZone1', 'VbusZone2', 'FreqZone1', 'FreqZone2', 'G1.freq', 'G2.freq', 'G1.Pload', 'G2.Pload',
    'P371', 'P372', 'G1.GV', 'G2.GV', 'G1.stator', 'G2.stator', 'G1.thrust', 'G2.thrust', 'G1.cwTemp', 'G2.cwTemp',
    'G1.oilPress', 'G2.oilPress', 'HeadHigh', 'V400',
  ];
  private readonly cap = 43200;
  private readonly ts = new Float64Array(43200);
  private readonly data: Float32Array[];
  private n = 0;
  private head = 0;

  constructor() {
    this.data = Array.from({ length: this.cap }, () => new Float32Array(this.keys.length));
  }

  add(get: (key: string) => number): void {
    const now = Date.now();
    this.ts[this.head] = now;
    const row = this.data[this.head];
    for (let i = 0; i < this.keys.length; i++) row[i] = get(this.keys[i]);
    this.head = (this.head + 1) % this.cap;
    if (this.n < this.cap) this.n++;
  }

  query(minutes: number, maxPts = 900): { t: number[]; v: number[][] } {
    const from = Date.now() - minutes * 60_000;
    const idx: number[] = [];
    for (let i = 0; i < this.n; i++) {
      const j = (this.head - this.n + i + this.cap) % this.cap;
      if (this.ts[j] >= from) idx.push(j);
    }
    const step = Math.max(1, Math.floor(idx.length / maxPts));
    const t: number[] = [];
    const v: number[][] = [];
    for (let i = 0; i < idx.length; i += step) {
      const j = idx[i];
      t.push(this.ts[j]);
      const row = this.data[j];
      const outRow: number[] = new Array(row.length);
      for (let k = 0; k < row.length; k++) outRow[k] = Math.round(row[k] * 100) / 100.0;
      v.push(outRow);
    }
    return { t, v };
  }

  csv(minutes = 1440): string {
    const q = this.query(minutes, 10000);
    let out = `\uFEFFtime,${this.keys.join(',')}\n`;
    for (let i = 0; i < q.t.length; i++) {
      out += `${fmtTime(q.t[i])},${q.v[i].map((x) => x.toFixed(3)).join(',')}\n`;
    }
    return out;
  }

  clear(): void {
    this.n = 0;
    this.head = 0;
  }
}

/** Lưu trữ tự chấm điểm & biên bản đánh giá trong localStorage + xuất CSV */
export class AssessStore {
  private static readonly LS_ACTIVE = 'hps_dhl2_assess_active_v1';
  private static readonly LS_REPORTS = 'hps_dhl2_assess_reports_v1';

  saveActive(state: Record<string, unknown>): void {
    if (!state || !state.active) {
      safeLSRemove(AssessStore.LS_ACTIVE);
      return;
    }
    safeLSSet(AssessStore.LS_ACTIVE, JSON.stringify({ ...state, serverSavedAt: Date.now() }));
  }

  loadActive(): Record<string, unknown> {
    try {
      const raw = safeLSGet(AssessStore.LS_ACTIVE);
      if (!raw) return { active: false };
      const obj = JSON.parse(raw);
      if (obj && obj.active) return obj;
    } catch {
      // ignore
    }
    return { active: false };
  }

  private readRawReports(): Array<Record<string, unknown>> {
    try {
      const raw = safeLSGet(AssessStore.LS_REPORTS);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  private writeRawReports(arr: Array<Record<string, unknown>>): void {
    // giữ tối đa 200 biên bản để không vượt hạn mức localStorage
    const trimmed = arr.length > 200 ? arr.slice(0, 200) : arr;
    safeLSSet(AssessStore.LS_REPORTS, JSON.stringify(trimmed));
  }

  saveReport(report: Record<string, unknown>): string {
    const now = Date.now();
    const endMs = typeof report.endMs === 'number' ? report.endMs : now;
    const rawId = typeof report.id === 'string' ? report.id.trim() : '';
    const safeIdRe = /^[A-Za-z0-9_-]{1,80}$/;
    let id = rawId && safeIdRe.test(rawId) ? rawId : fmtIdTs(endMs);
    const list = this.readRawReports();
    const existing = new Set(list.map((x) => String(x.id ?? '')));
    let suffix = 1;
    while (existing.has(id)) {
      id = `${fmtIdTs(endMs)}_${suffix++}`;
    }
    const copy = {
      ...report,
      id,
      savedAt: typeof report.savedAt === 'number' ? report.savedAt : now,
      endMs,
      verified: true,
    };
    list.unshift(copy);
    this.writeRawReports(list);
    return id;
  }

  private readAllReports(studentFilter = ''): Array<Record<string, unknown>> {
    const q = studentFilter.trim().toLowerCase();
    const list = this.readRawReports().filter((obj) => {
      if (!q) return true;
      return String(obj.student ?? '').toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      const ta = Number(a.endMs ?? a.savedAt ?? 0);
      const tb = Number(b.endMs ?? b.savedAt ?? 0);
      return tb - ta;
    });
    return list;
  }

  listReports(studentFilter = ''): Array<Record<string, unknown>> {
    return this.readAllReports(studentFilter).map((obj) => {
      const cps = Array.isArray(obj.checkpoints) ? (obj.checkpoints as Array<Record<string, unknown>>) : [];
      const cpTotal = cps.length;
      const cpDone = cps.filter((c) => c && c.done === true).length;
      const violations = Array.isArray(obj.violations) ? (obj.violations as Array<Record<string, unknown>>) : null;
      let vCount = 0;
      if (violations) {
        vCount = violations.length;
      } else if (Array.isArray(obj.audit)) {
        vCount = (obj.audit as Array<Record<string, unknown>>).filter(
          (a) => a && (a.isViolation === true || a.ok === false),
        ).length;
      }
      return {
        id: String(obj.id ?? ''),
        student: String(obj.student ?? ''),
        scenarioId: Number(obj.scenarioId ?? 0),
        scenarioName: String(obj.scenarioName ?? ''),
        mode: String(obj.mode ?? 'practice'),
        verified: obj.verified !== false,
        startMs: Number(obj.startMs ?? 0),
        endMs: Number(obj.endMs ?? 0),
        durationSec: Number(obj.durationSec ?? 0),
        score: Number(obj.score ?? 0),
        penalty: Number(obj.penalty ?? 0),
        passed: obj.passed === true,
        fatalReason: String(obj.fatalReason ?? ''),
        checkpointDone: cpDone,
        checkpointTotal: cpTotal,
        violationCount: vCount,
      };
    });
  }

  getReport(id: string): Record<string, unknown> | null {
    const clean = id.trim();
    return this.readRawReports().find((r) => String(r.id ?? '') === clean) ?? null;
  }

  deleteReport(id: string): void {
    const clean = id.trim();
    this.writeRawReports(this.readRawReports().filter((r) => String(r.id ?? '') !== clean));
  }

  clearReports(): void {
    safeLSRemove(AssessStore.LS_REPORTS);
  }

  private csvEsc(s: string): string {
    return `"${s.replace(/"/g, '""').replace(/\r/g, ' ').replace(/\n/g, ' | ')}"`;
  }

  toCsv(studentFilter = ''): string {
    const lines: string[] = [
      'ID,Thời gian,Học viên,Kịch bản,Chế độ,Thời lượng (s),Điểm,Trừ điểm,Kết quả,Lỗi điểm liệt,Tiêu chí đạt,Số vi phạm,Nhật ký vi phạm',
    ];
    for (const obj of this.readAllReports(studentFilter)) {
      const id = String(obj.id ?? '');
      const endMs = Number(obj.endMs ?? obj.savedAt ?? 0);
      const timeStr = endMs > 0 ? fmtDateTime(endMs) : '';
      const student = String(obj.student ?? '');
      const scName = String(obj.scenarioName ?? `KB ${obj.scenarioId ?? 0}`);
      const mode = obj.mode === 'exam' ? 'Thi thử' : 'Luyện tập';
      const dur = Math.trunc(Number(obj.durationSec ?? 0));
      const score = Math.trunc(Number(obj.score ?? 0));
      const penalty = Math.trunc(Number(obj.penalty ?? 0));
      const passed = obj.passed === true ? 'ĐẠT' : 'KHÔNG ĐẠT';
      const fatal = String(obj.fatalReason ?? '');
      const cps = Array.isArray(obj.checkpoints) ? (obj.checkpoints as Array<Record<string, unknown>>) : [];
      const cpTotal = cps.length;
      const cpDone = cps.filter((c) => c && c.done === true).length;

      const violMsgs: string[] = [];
      if (Array.isArray(obj.violations)) {
        for (const v of obj.violations as Array<Record<string, unknown>>) {
          const t = String(v?.t ?? '');
          const m = String(v?.msg ?? '');
          if (m) violMsgs.push(t ? `[${t}] ${m}` : m);
        }
      } else if (Array.isArray(obj.audit)) {
        for (const v of obj.audit as Array<Record<string, unknown>>) {
          if (v && (v.isViolation === true || v.ok === false)) {
            const t = String(v.t ?? '');
            const m = String(v.msg ?? '');
            if (m) violMsgs.push(t ? `[${t}] ${m}` : m);
          }
        }
      }

      lines.push(
        [
          this.csvEsc(id), this.csvEsc(timeStr), this.csvEsc(student), this.csvEsc(scName), this.csvEsc(mode),
          String(dur), String(score), String(penalty), this.csvEsc(passed), this.csvEsc(fatal),
          this.csvEsc(`${cpDone}/${cpTotal}`), String(violMsgs.length), this.csvEsc(violMsgs.join('; ')),
        ].join(','),
      );
    }
    return '\uFEFF' + lines.join('\n') + '\n';
  }
}
