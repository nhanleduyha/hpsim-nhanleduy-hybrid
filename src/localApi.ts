import { OpsMonitor } from './ops/OpsMonitor';
import { PlantConfig, RelaySet } from './plant/PlantConfig';
import { HpsSim } from './sim/HpsSim';
import { AssessStore, SoeStore, TrendStore } from './sim/Records';

const LS_PLANT_STATE = 'hps_dhl2_plant_state_v1';
const LS_PLANT_CFG = 'hps_dhl2_plant_cfg_v1';

const CONFIG_SET_KEYS = new Set([
  'INTERLOCK', 'TBALOAD', 'TBALOADQ', 'GRIDV', 'THERMALSPEED',
  'GOVKP', 'GOVKI', 'GOVKD', 'GOVBP', 'ISLANDDROOP', 'POWERKP', 'POWERKI',
  'GVOPENRATE', 'GVCLOSERATE', 'PRAMP', 'GOVRESETCFG',
]);

function coerceIn(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtShiftStamp(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function loadPlantConfig(): PlantConfig {
  const cfg = new PlantConfig();
  try {
    const raw = window.localStorage.getItem(LS_PLANT_CFG);
    if (!raw) return cfg;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      const relayObj = obj.relay;
      Object.assign(cfg, obj);
      const rs = new RelaySet();
      if (relayObj && typeof relayObj === 'object') {
        Object.assign(rs, relayObj);
      }
      cfg.relay = rs;
    }
  } catch {
    // fallback to defaults
  }
  return cfg;
}

function savePlantConfig(cfg: PlantConfig): void {
  try {
    window.localStorage.setItem(LS_PLANT_CFG, JSON.stringify(cfg));
  } catch {
    // ignore storage quota errors
  }
}

function loadSavedPlantState(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(LS_PLANT_STATE);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function savePlantState(sim: HpsSim): void {
  try {
    window.localStorage.setItem(LS_PLANT_STATE, JSON.stringify(sim.exportState()));
  } catch {
    // ignore storage quota errors
  }
}

function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!qs) return out;
  for (const part of qs.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq >= 0 ? part.slice(0, eq) : part;
    const v = eq >= 0 ? part.slice(eq + 1) : '';
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body == null) return {};
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

export interface LocalApi {
  sim: HpsSim;
  cfg: PlantConfig;
  soe: SoeStore;
  trend: TrendStore;
  assess: AssessStore;
  ops: OpsMonitor;
  request(path: string, body?: unknown): Promise<unknown>;
  downloadCsv(filename: string, content: string): void;
  downloadAssessCsv(student?: string): void;
  downloadSoeCsv(from?: number): void;
  downloadTrendCsv(min?: number): void;
  resetPlant(): void;
  saveNow(): void;
  stop(): void;
}

export function createLocalApi(): LocalApi {
  let cfg = loadPlantConfig();
  let cfgRev = 1;
  const soe = new SoeStore();
  const trend = new TrendStore();
  const assess = new AssessStore();
  const ops = new OpsMonitor();

  let sim: HpsSim;
  let secCounter = 0;

  const wireSim = (instance: HpsSim) => {
    ops.onAnomaly = (an) => {
      const u = an.key.startsWith('G1') ? 1 : an.key.startsWith('G2') ? 2 : 3;
      const m = `GIÁM SÁT: ${an.text}`;
      instance.log('WARN', u, m);
      instance.event('msg', m);
    };
    instance.soe = (k, u, t) => soe.add(k, u, t);
    instance.energyStore = () => savePlantState(instance);
    instance.cfgRevProvider = () => cfgRev;
    instance.onSecond = () => {
      secCounter++;
      try { ops.tick(instance.snapshot as Record<string, unknown>); } catch (e) { /* bỏ qua */ }
      if (secCounter % 2 === 0) {
        const snap = instance.snapshot;
        trend.add((k) => {
          const v = snap[k];
          return typeof v === 'number' && Number.isFinite(v) ? v : 0;
        });
        savePlantState(instance);
      }
      if (secCounter % 6 === 0) {
        soe.save();
      }
    };
  };

  sim = new HpsSim(() => cfg);
  wireSim(sim);
  sim.init();

  // Khôi phục trạng thái nhà máy từ localStorage nếu có (tải lại trang không mất trạng thái)
  const saved = loadSavedPlantState();
  if (saved) {
    sim.importState(saved);
  } else {
    // Khởi tạo mẫu xu hướng ban đầu
    const snap = sim.snapshot;
    trend.add((k) => {
      const v = snap[k];
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    });
  }

  // Vòng lặp mô phỏng bước đúng 100 ms như HpsSim.step() (10 bước nhỏ 10 ms trong Plant.step())
  let lastStepWallMs = performance.now();
  let accumMs = 0;
  const STEP_MS = 100;
  const loopId = window.setInterval(() => {
    const now = performance.now();
    // Giới hạn tối đa 500 ms mỗi lần gọi để tránh tụt khung hình khi chuyển tab quay lại
    const dtWall = Math.min(500, Math.max(0, now - lastStepWallMs));
    lastStepWallMs = now;
    accumMs += dtWall;
    let steps = 0;
    while (accumMs >= STEP_MS && steps < 5) {
      sim.step();
      accumMs -= STEP_MS;
      steps++;
    }
  }, STEP_MS);

  const persistAll = () => {
    savePlantState(sim);
    savePlantConfig(cfg);
    soe.save();
  };

  const onUnload = () => persistAll();
  const onVisChange = () => {
    if (document.visibilityState === 'hidden') persistAll();
  };
  window.addEventListener('beforeunload', onUnload);
  window.addEventListener('pagehide', onUnload);
  document.addEventListener('visibilitychange', onVisChange);

  const downloadCsv = (filename: string, content: string): void => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const resetPlant = (): void => {
    try {
      window.localStorage.removeItem(LS_PLANT_STATE);
    } catch {
      // ignore
    }
    soe.clear();
    trend.clear();
    cfg = new PlantConfig();
    savePlantConfig(cfg);
    cfgRev++;
    sim = new HpsSim(() => cfg);
    apiObj.sim = sim;
    apiObj.cfg = cfg;
    wireSim(sim);
    sim.init();
    soe.add('SESSION', 0, 'Khôi phục trạng thái nhà máy mặc định');
    ops.reset();
    persistAll();
  };

  const request = async (rawPath: string, body?: unknown): Promise<unknown> => {
    const clean = rawPath.replace(/^\/?api\//, '').replace(/^\//, '');
    const qIdx = clean.indexOf('?');
    const path = qIdx >= 0 ? clean.slice(0, qIdx) : clean;
    const query = qIdx >= 0 ? parseQuery(clean.slice(qIdx + 1)) : {};
    const method = body === undefined ? 'GET' : 'POST';
    const j = method === 'POST' ? parseBody(body) : {};
    const key = `${method} ${path}`;

    switch (key) {
      case 'POST auth':
        return { ok: true };

      case 'GET info':
        return {
          ips: [],
          port: 0,
          ai: false,
          version: 'Web Standalone',
          build: 1,
          sha: 'browser',
          buildTime: '',
        };

      case 'GET state': {
        const sinceRaw = query.ev !== undefined ? Number.parseInt(query.ev, 10) : -1;
        const since = Number.isFinite(sinceRaw) ? sinceRaw : -1;
        const [seq, evs] = sim.eventsSince(since < 0 ? Number.MAX_SAFE_INTEGER : since);
        return {
          s: sim.snapshot,
          evSeq: seq,
          ev: evs.map((e) => ({
            seq: e.seq,
            t: e.type,
            v: e.value,
            ...(e.meta ?? {}),
          })),
          videoBase: '',
        };
      }

      case 'POST set': {
        const n = typeof j.name === 'string' ? j.name : '';
        if (!n) return { ok: false, error: 'Thiếu name' };
        const v = typeof j.value === 'number' && Number.isFinite(j.value)
          ? j.value
          : (typeof j.value === 'string' && j.value !== '' && Number.isFinite(Number(j.value)) ? Number(j.value) : null);
        const cid = typeof j.cid === 'string' ? j.cid : '';
        sim.hmiSet(n, v, 'Web', cid);
        sim.flushQueue();
        if (CONFIG_SET_KEYS.has(n.toUpperCase())) {
          cfgRev++;
          savePlantConfig(cfg);
        }
        savePlantState(sim);
        return { ok: true };
      }

      case 'POST text': {
        const text = typeof j.text === 'string' ? j.text : '';
        const cid = typeof j.cid === 'string' ? j.cid : '';
        sim.textCommand(text, 'Web', cid);
        sim.flushQueue();
        savePlantState(sim);
        return { ok: true };
      }

      case 'POST sd200': {
        const u = Number(j.unit);
        const fn = Number(j.fn);
        if (!Number.isFinite(u)) return { ok: false, error: 'Thiếu unit' };
        if (!Number.isFinite(fn)) return { ok: false, error: 'Thiếu fn' };
        const data = Number.isFinite(Number(j.data)) ? Number(j.data) : 0;
        const yt = j.yt === true;
        const cid = typeof j.cid === 'string' ? j.cid : '';
        sim.post(() => sim.execute(u, fn, data, 'Web', yt, cid));
        sim.flushQueue();
        savePlantState(sim);
        return { ok: true };
      }

      case 'POST scenario': {
        const id = Number(j.id);
        if (!Number.isInteger(id) || id < 1 || id > 9) {
          return { ok: false, error: `Mã kịch bản không hợp lệ: ${j.id}` };
        }
        sim.applyScenario(id);
        sim.flushQueue();
        savePlantState(sim);
        return { ok: true };
      }

      case 'POST faults/clear': {
        sim.clearFaults();
        sim.flushQueue();
        savePlantState(sim);
        return { ok: true };
      }

      case 'POST plant/reset': {
        resetPlant();
        return { ok: true };
      }

      case 'POST governor/config': {
        if (j.reset === true) {
          cfg.govKp = 1.6;
          cfg.govKi = 0.27;
          cfg.govKd = 0.0;
          cfg.govBp = 0.01;
          cfg.islandDroop = 0.01;
          cfg.powerKp = 0.05;
          cfg.powerKi = 0.05;
          cfg.pRampMWs = 0.8;
          cfgRev++;
          savePlantConfig(cfg);
          soe.add('CMD', 0, "Khôi phục & lưu tham số điều tốc chuẩn Đrây H'Linh 2 (PlantConfig)");
        } else {
          if (typeof j.govKp === 'number' && Number.isFinite(j.govKp)) cfg.govKp = coerceIn(j.govKp, 0.5, 20.0);
          if (typeof j.govKi === 'number' && Number.isFinite(j.govKi)) cfg.govKi = coerceIn(j.govKi, 0.05, 10.0);
          if (typeof j.govKd === 'number' && Number.isFinite(j.govKd)) cfg.govKd = coerceIn(j.govKd, 0.0, 5.0);
          const bpRaw = typeof j.govBp === 'number' && Number.isFinite(j.govBp)
            ? j.govBp
            : (typeof j.islandDroop === 'number' && Number.isFinite(j.islandDroop) ? j.islandDroop : null);
          if (bpRaw !== null) {
            const bp = coerceIn(bpRaw, 0.0, 0.01);
            cfg.govBp = bp;
            cfg.islandDroop = bp;
          }
          if (typeof j.powerKp === 'number' && Number.isFinite(j.powerKp)) cfg.powerKp = coerceIn(j.powerKp, 0.0, 2.0);
          if (typeof j.powerKi === 'number' && Number.isFinite(j.powerKi)) cfg.powerKi = coerceIn(j.powerKi, 0.0, 2.0);
          if (typeof j.pRampMWs === 'number' && Number.isFinite(j.pRampMWs)) cfg.pRampMWs = coerceIn(j.pRampMWs, 0.1, 3.0);
          cfgRev++;
          savePlantConfig(cfg);
          soe.add(
            'CMD',
            0,
            `Cập nhật & lưu tham số điều tốc PlantConfig (Kp=${cfg.govKp.toFixed(2)}, Ki=${cfg.govKi.toFixed(2)}, Kd=${cfg.govKd.toFixed(2)}, bp=${(cfg.govBp * 100).toFixed(2)}%, P-Kp=${cfg.powerKp.toFixed(2)}, P-Ki=${cfg.powerKi.toFixed(2)})`,
          );
        }
        sim.flushQueue();
        return {
          ok: true,
          cfgRev,
          cfg: {
            govKp: cfg.govKp,
            govKi: cfg.govKi,
            govKd: cfg.govKd,
            govBp: cfg.govBp,
            islandDroop: cfg.govBp,
            powerKp: cfg.powerKp,
            powerKi: cfg.powerKi,
            pRampMWs: cfg.pRampMWs,
          },
        };
      }

      case 'GET relay':
        return { ...cfg.relay };

      case 'POST relay': {
        const rs = new RelaySet();
        Object.assign(rs, cfg.relay);
        for (const [k, v] of Object.entries(j)) {
          if (k in rs) {
            (rs as unknown as Record<string, unknown>)[k] = v;
          }
        }
        if (!('g64_100Trip' in j)) rs.g64_100Trip = cfg.relay.g64_100Trip;
        if (!('g81oBlockLoadReject' in j)) rs.g81oBlockLoadReject = cfg.relay.g81oBlockLoadReject;
        cfg.relay = rs;
        cfgRev++;
        savePlantConfig(cfg);
        soe.add('SESSION', 0, 'Thay đổi trị số chỉnh định rơ le bảo vệ');
        sim.flushQueue();
        return { ok: true, cfgRev };
      }

      case 'GET shift': {
        const sh = sim.phys.shift;
        return {
          startedAt: sh.startedAt,
          now: Date.now(),
          chief: sh.chief,
          operator: sh.operator,
          dispatcher: sh.dispatcher,
          cbNormal: { ...sh.cbNormal },
          cbFault: { ...sh.cbFault },
          mwh: [...sh.mwh],
          pMax: sh.pMax,
          pMin: sh.pMin === Number.MAX_VALUE ? 0.0 : sh.pMin,
          runH: [...sh.runH],
          tripH: [...sh.tripH],
          standbyH: [...sh.standbyH],
          notes: [...sh.notes],
          a371: sim.a371,
          a372: sim.a372,
        };
      }

      case 'POST shift': {
        const chief = typeof j.chief === 'string' ? j.chief : '';
        const operator = typeof j.operator === 'string' ? j.operator : '';
        const dispatcher = typeof j.dispatcher === 'string' ? j.dispatcher : '';
        sim.post(() => {
          const prevLabel = fmtShiftStamp(sim.phys.shift.startedAt) + (sim.phys.shift.chief.trim() ? ` – ${sim.phys.shift.chief}` : '');
          sim.meters.closeShift(prevLabel);
          sim.phys.shift.reset(chief, operator, dispatcher);
        });
        sim.flushQueue();
        soe.add('SESSION', 0, `Nhận ca: trưởng ca ${chief}`);
        savePlantState(sim);
        return { ok: true };
      }

      case 'POST shift/note': {
        const text = typeof j.text === 'string' ? j.text : '';
        sim.post(() => sim.phys.shift.note(text));
        sim.flushQueue();
        savePlantState(sim);
        return { ok: true };
      }

      case 'GET energy': {
        const names: Record<string, string> = {};
        for (const m of sim.meters.meters) names[m.id] = m.name;
        return {
          ...sim.meters.toJson(),
          now: Date.now(),
          names,
        };
      }

      case 'GET soe': {
        const since = Number.parseInt(query.since ?? '0', 10) || 0;
        const recs = soe.since(since, 1000).map((r) => ({
          seq: r.seq,
          ts: r.ts,
          k: r.kind,
          u: soe.unitName(r.unit),
          t: r.text,
        }));
        return {
          recs,
          sessionStart: soe.sessionStart,
          sessionName: soe.sessionName,
          files: [],
        };
      }

      case 'POST session': {
        const start = j.start !== false;
        if (start) {
          soe.sessionStart = Date.now();
          soe.sessionName = typeof j.name === 'string' ? j.name : '';
          soe.add('SESSION', 0, `Bắt đầu buổi thực hành: ${soe.sessionName}`);
        } else {
          soe.add('SESSION', 0, `Kết thúc buổi thực hành: ${soe.sessionName}`);
        }
        soe.save();
        return { ok: true };
      }

      case 'GET trend': {
        const min = Number.parseInt(query.min ?? '15', 10) || 15;
        const { t, v } = trend.query(min);
        return {
          keys: trend.keys,
          t,
          v,
          files: [],
        };
      }

      case 'GET assess/active':
        return assess.loadActive();

      case 'POST assess/active':
        assess.saveActive(j);
        return { ok: true };

      case 'POST assess/report': {
        const id = assess.saveReport(j);
        return { ok: true, id, verified: true };
      }

      case 'GET assess/reports':
        return assess.listReports(query.student ?? '');

      case 'GET assess/report': {
        const id = query.id ?? '';
        if (!id) return { ok: false, error: 'Thiếu id' };
        const rep = assess.getReport(id);
        return rep ?? { ok: false, error: 'Không tìm thấy biên bản' };
      }

      case 'POST assess/delete': {
        const id = typeof j.id === 'string' ? j.id : '';
        if (id) assess.deleteReport(id);
        return { ok: true };
      }

      case 'POST assess/clear':
        assess.clearReports();
        return { ok: true };

      case 'GET alarms':
        return [];

      case 'GET ops/stats':
        return ops.summary();

      case 'GET ops/series': {
        const k = query.key ?? '';
        const sec = Math.min(7200, Math.max(10, (Number.parseFloat(query.min ?? '10') || 10) * 60));
        const s = ops.series(k, sec);
        const step = Math.max(1, Math.ceil(s.length / 120));
        const pts: number[] = [];
        for (let i = 0; i < s.length; i += step) pts.push(+s[i].toFixed(3));
        return { key: k, stepS: step, points: pts, stats: ops.tagStats(k, sec), osc: ops.oscillation(k, Math.min(sec, 300)) };
      }

      default:
        return { ok: false, error: `Không có API ${path}` };
    }
  };

  const apiObj: LocalApi = {
    sim,
    cfg,
    soe,
    trend,
    assess,
    ops,
    request,
    downloadCsv,
    downloadAssessCsv: (student = '') => downloadCsv('lich-su-tu-cham-diem.csv', assess.toCsv(student)),
    downloadSoeCsv: (from = 0) => downloadCsv('su-kien-soe.csv', soe.csv(from)),
    downloadTrendCsv: (min = 1440) => downloadCsv('xu-huong-he-thong.csv', trend.csv(min)),
    resetPlant,
    saveNow: persistAll,
    stop: () => {
      window.clearInterval(loopId);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
      document.removeEventListener('visibilitychange', onVisChange);
    },
  };

  return apiObj;
}
