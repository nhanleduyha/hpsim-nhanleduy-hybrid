import { GovMode } from '../plant/HydroUnit';
import { Plant } from '../plant/Plant';
import { PlantConfig } from '../plant/PlantConfig';
import { Cmd } from './Cmd';
import { EnergyMeters } from './EnergyMeters';
import { Gen } from './Gen';
import { Physics, UnitSeq } from './Physics';

function coerceIn(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000.0;
}

function r4(v: number): number {
  return Math.round(v * 10000) / 10000.0;
}

function avg(a: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return a.length > 0 ? s / a.length : 0;
}

function fmt0(v: number): string { return v.toFixed(0); }
function fmt1(v: number): string { return v.toFixed(1); }
function fmt2(v: number): string { return v.toFixed(2); }
function fmt3(v: number): string { return v.toFixed(3); }

export interface SimEvent {
  seq: number;
  type: string;
  value: string;
  meta?: Record<string, unknown>;
}

const PUB_CMD_NAMES = new Set<string>([
  'Close371', 'Trip371', 'Close372', 'Trip372', 'V400StandbyInput', 'V400StandbyReset',
  'Close371_1', 'Trip371_1', 'Close371_7', 'Trip371_7', 'Close372_2', 'Trip372_2',
  'Close372_7', 'Trip372_7', 'Close312_1', 'Trip312_1', 'Close1AXT', 'Trip1AXT', 'Close2AXT', 'Trip2AXT',
]);

/**
 * Bộ mô phỏng nhà máy thuỷ điện Đray H'Linh 2 (chế độ Simulation thuần trình duyệt).
 * Chu kỳ bước: 100 ms (0,1 s), bước nhỏ trong Plant.step(): 10 ms.
 */
export class HpsSim {
  static readonly LCU1 = 1;
  static readonly LCU2 = 2;
  static readonly PUB = 3;

  readonly g1 = new Gen(1);
  readonly g2 = new Gen(2);
  readonly gens: [Gen, Gen];
  readonly phys: Physics;

  // ---------------- Biến toàn trạm ----------------
  simulationMode = 1.0;
  remotePub = 0.0;        // 0 = Remote/Auto, 1 = Local/Manual
  cb371 = 0.0; cb372 = 0.0;
  gs371_76 = 0.0; is371_7 = 0.0; gs371_75 = 0.0; gs371_15 = 0.0; is371_1 = 0.0;
  gs372_76 = 0.0; is372_7 = 0.0; gs372_75 = 0.0; gs372_25 = 0.0; is372_2 = 0.0;
  is312_1 = 0.0;
  istd35 = 0.0; remoteNt = 0.0;

  vbusZone1 = 0.0; vbusZone2 = 0.0;
  freqZone1 = 0.0; freqZone2 = 0.0;
  v371 = 38.5; v372 = 38.5;
  p371 = 0.0; p372 = 0.0; q371 = 0.0; q372 = 0.0; i371 = 0.0; i372 = 0.0;
  v331 = 0.0; v332 = 0.0; f331 = 0.0; f332 = 0.0; phase331 = 0.0; phase332 = 0.0;

  vaux6 = 0.0; v400Zone1 = 0.0; v400Zone2 = 0.0; v400 = 0.0;
  axt1 = 0.0; axt2 = 0.0;
  is612_1 = 0.0; is612_2 = 0.0;
  readonly auxMcb: number[] = [0, 0, 0, 0, 0];
  readonly vAuxLoad: number[] = [0, 0, 0, 0, 0];
  standbyInput400 = 0.0;

  headHigh = 30.0;
  inflow = 1.0; // lưu lượng về hồ (1.0 ≈ một tổ máy mở 100 %)
  pubDev: Record<string, boolean> = {
    leak1: true, drain1: true, lpc1: true, hpc1: true, oilleak: true,
  };
  readonly activeFaults = new Set<string>();
  /** Khóa giải trừ bảo vệ khi sự cố vẫn đang ép (như KB 9 – 87G) */
  readonly forcedTripUnits = new Set<number>();
  auxLost = false;
  soe: ((kind: string, unit: number, text: string) => void) | null = null;
  intakeGate = 1.0;

  // ---------------- Mô tả sự cố thật ----------------
  incidentText = '';
  incidentLast = '';
  incidentLevel = 0;
  incidentTs = 0;

  // Điện năng (kWh)
  a371 = 0.0; a372 = 0.0;
  readonly meters = new EnergyMeters();
  energyStore: (() => void) | null = null;
  cfgRevProvider: () => number = () => 1;

  // Lần trạng thái trước để phát hiện thao tác
  private readonly last = new Map<string, number>();

  // Hàng đợi, lịch (chạy theo đồng hồ mô phỏng 100 ms/bước), sự kiện
  private readonly queue: Array<() => void> = [];
  private readonly timers: Array<{ dueMs: number; action: () => void }> = [];
  private simClockMs = 0;
  tick = 0;

  private readonly events: SimEvent[] = [];
  private eventSeq = 0;
  autoPage = true;

  snapshot: Record<string, unknown> = {};
  onSecond: (() => void) | null = null;

  private readonly arcShown = new Set<string>();
  private readonly stopShown: [boolean, boolean] = [false, false];
  private energySaveCount = 0;
  private readonly syncTicks: [number, number] = [0, 0];
  private readonly syncPeak: [number, number] = [0.0, 0.0];

  constructor(plantCfg: () => PlantConfig = () => new PlantConfig()) {
    this.gens = [this.g1, this.g2];
    this.phys = new Physics(this, plantCfg);
  }

  log(kind: string, unit: number, text: string): void {
    try {
      this.soe?.(kind, unit, text);
    } catch {
      // ignore
    }
  }

  /** Ghi một mục mô tả sự cố. Mức 2 (sự cố) giữ nguyên nguyên nhân gốc, các mục sau là hậu quả; mức 1 chỉ hiện khi chưa có sự cố. */
  incident(text: string, level = 2): void {
    if (level >= 2 && this.incidentLevel >= 2) {
      this.incidentLast = text;
    } else if (level >= this.incidentLevel || this.incidentLevel < 2) {
      this.incidentText = text;
      this.incidentLast = '';
      this.incidentLevel = level;
    }
    this.incidentTs = Date.now();
  }

  clearIncident(): void {
    this.incidentText = '';
    this.incidentLast = '';
    this.incidentLevel = 0;
  }

  /** Nút XOÁ CẢNH BÁO: xoá mô tả sự cố, giải trừ rơ le đã trở về, cho phép sự cố lần sau báo lại */
  clearAlarm(): void {
    this.clearIncident();
    const stuck = this.phys.resetRelays();
    this.log('CMD', 0, 'Xoá cảnh báo, giải trừ rơ le' + (stuck.length === 0 ? '' : ` (còn khởi động: ${stuck.join(', ')})`));
    if (stuck.length > 0) {
      this.incident(`Chưa giải trừ được: ${stuck.join(', ')} – điều kiện sự cố vẫn còn`, 1);
    }
  }

  post(action: () => void): void {
    this.queue.push(action);
  }

  /** Thực thi ngay hàng đợi lệnh và cập nhật snapshot (dùng cho localApi đồng bộ trên trình duyệt) */
  flushQueue(): void {
    while (this.queue.length > 0) {
      const a = this.queue.shift();
      if (a) a();
    }
    this.snapshot = this.buildSnapshot();
  }

  later(ms: number, action: () => void): void {
    this.timers.push({ dueMs: this.simClockMs + ms, action });
  }

  eventsSince(s: number): [number, SimEvent[]] {
    return [this.eventSeq, this.events.filter((e) => e.seq > s)];
  }

  event(type: string, value: string, meta?: Record<string, unknown>): void {
    this.eventSeq++;
    this.events.push({ seq: this.eventSeq, type, value, meta });
    while (this.events.length > 200) this.events.shift();
  }

  cmdEvent(
    name: string,
    value: number | null,
    source: string,
    text = '',
    clientId = '',
    toast = false,
    pre?: Record<string, unknown> | null,
  ): void {
    const m: Record<string, unknown> = { name, source };
    if (value !== null && Number.isFinite(value)) m.value = r4(value);
    if (clientId.length > 0) m.cid = clientId;
    if (toast) m.toast = true;
    if (pre) m.pre = pre;
    this.event('cmd', text, m);
  }

  private isUnitStartingOrSyncing(g: Gen): boolean {
    return ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'EXCITE', 'SYNC', 'LOAD'].includes(this.seqOf(g).state);
  }

  capturePreCmdMeta(name: string, _value: number | null): Record<string, unknown> | null {
    const u = name.toUpperCase();
    if (u === 'AXT1' || u === 'AXT2') {
      return {
        prevClosed: u === 'AXT1' ? this.on(this.axt1) : this.on(this.axt2),
        otherAux: (u === 'AXT1' ? this.on(this.axt2) : this.on(this.axt1)) || this.phys.dgCb,
      };
    }
    if (u === 'GEN1.MODE' || u === 'G1.MODE' || u === 'GEN2.MODE' || u === 'G2.MODE') {
      const gn = u.includes('2') ? 2 : 1;
      const g = gn === 1 ? this.g1 : this.g2;
      const other = gn === 1 ? this.g2 : this.g1;
      return {
        otherStarting: this.isUnitStartingOrSyncing(other),
        servoLock: this.on(g.servoLock),
      };
    }
    if (u === 'GEN1.AIRBRAKE' || u === 'G1.AIRBRAKE' || u === 'GEN2.AIRBRAKE' || u === 'G2.AIRBRAKE') {
      const g = u.includes('2') ? this.g2 : this.g1;
      return {
        prevAirBrake: this.on(g.airBrake),
        speed: r3(g.speed),
      };
    }
    if (u.endsWith('.GOVERNOR') || u.endsWith('.GVMAN') || u.endsWith('.GVSTEP')) {
      const g = u.startsWith('GEN2') || u.startsWith('G2.') ? this.g2 : this.g1;
      return {
        servoLock: this.on(g.servoLock),
        govAuto: this.on(g.govAuto),
        pid: this.phys.plant.units[g.no - 1].govMode !== GovMode.OFF,
        speed: r3(g.speed),
      };
    }
    if (u.startsWith('GS')) {
      const curMap: Record<string, number> = {
        GS371_76: this.gs371_76, GS371_75: this.gs371_75, GS371_15: this.gs371_15,
        GS372_76: this.gs372_76, GS372_75: this.gs372_75, GS372_25: this.gs372_25,
        GS331_14: this.g1.gs14, GS331_15: this.g1.gs15, GS332_24: this.g2.gs14, GS332_25: this.g2.gs15,
        GS1QE: this.g1.gsQE, GS1QE1: this.g1.gsQE1, GS2QE: this.g2.gsQE, GS2QE1: this.g2.gsQE1,
      };
      const cur = curMap[u] ?? 0.0;
      const key = u.replace(/^GS/, '').replace(/_/g, '-');
      const node = this.phys.plant.nodeOfEarth(key);
      const live = node !== null && this.phys.plant.net.v[node].abs() > 0.1;
      return { prevClosed: this.on(cur), live };
    }
    if (
      u === 'CB331' || u === 'CB332' ||
      u === 'GEN1.SYNCCLOSE' || u === 'GEN2.SYNCCLOSE' ||
      u === 'G1.SYNCCLOSE' || u === 'G2.SYNCCLOSE'
    ) {
      const gn = u.includes('2') ? 2 : 1;
      const g = gn === 1 ? this.g1 : this.g2;
      const pc = this.phys.cfg();
      const zoneV = gn === 1 ? this.vbusZone1 : this.vbusZone2;
      const busF = gn === 1 ? this.freqZone1 : this.freqZone2;
      const busV = (zoneV * pc.genKV) / 38.5;
      const df = Math.abs(g.freq - busF);
      const dv = busV > 0.1 ? (Math.abs(g.vgen - busV) / busV) * 100.0 : 100.0;
      const ph = Math.abs(g.phase);
      return {
        prevClosed: this.on(g.cb33),
        busV35: r3(zoneV),
        isClosed: this.on(g.is33),
        speed: r3(g.speed),
        vgen: r3(g.vgen),
        df: r3(df),
        dv: r3(dv),
        ph: r3(ph),
      };
    }
    return null;
  }

  private ykCanonical(u: number, fn: number): [string, number | null] {
    if (u === HpsSim.PUB) {
      switch (fn) {
        case Cmd.Close371: return ['CB371', 1.0]; case Cmd.Trip371: return ['CB371', 0.0];
        case Cmd.Close372: return ['CB372', 1.0]; case Cmd.Trip372: return ['CB372', 0.0];
        case Cmd.Close371_7: return ['IS371_7', 1.0]; case Cmd.Trip371_7: return ['IS371_7', 0.0];
        case Cmd.Close371_1: return ['IS371_1', 1.0]; case Cmd.Trip371_1: return ['IS371_1', 0.0];
        case Cmd.Close372_7: return ['IS372_7', 1.0]; case Cmd.Trip372_7: return ['IS372_7', 0.0];
        case Cmd.Close372_2: return ['IS372_2', 1.0]; case Cmd.Trip372_2: return ['IS372_2', 0.0];
        case Cmd.Close312_1: return ['IS312_1', 1.0]; case Cmd.Trip312_1: return ['IS312_1', 0.0];
        case Cmd.V400StandbyInput: return ['STANDBYINPUT400', 1.0];
        case Cmd.V400StandbyReset: return ['STANDBYINPUT400', 0.0];
        case Cmd.Close1AXT: return ['AXT1', 1.0]; case Cmd.Trip1AXT: return ['AXT1', 0.0];
        case Cmd.Close2AXT: return ['AXT2', 1.0]; case Cmd.Trip2AXT: return ['AXT2', 0.0];
        case 0x1901: return ['PUB.leak1', 1.0]; case 0x1a01: return ['PUB.leak1', 0.0];
        case 0x1b01: return ['PUB.leak2', 1.0]; case 0x1c01: return ['PUB.leak2', 0.0];
        case 0x1d01: return ['PUB.drain1', 1.0]; case 0x1e01: return ['PUB.drain1', 0.0];
        case 0x1f01: return ['PUB.drain2', 1.0]; case 0x2001: return ['PUB.drain2', 0.0];
        case 0x2401: return ['PUB.lpc1', 1.0]; case 0x1101: return ['PUB.lpc1', 0.0];
        case 0x2301: return ['PUB.lpc2', 1.0]; case 0x1201: return ['PUB.lpc2', 0.0];
        case 0x2501: return ['PUB.hpc1', 1.0]; case 0x2601: return ['PUB.hpc1', 0.0];
        case 0x2701: return ['PUB.hpc2', 1.0]; case 0x2801: return ['PUB.hpc2', 0.0];
        case 0x2901: return ['PUB.oilleak', 1.0]; case 0x2a01: return ['PUB.oilleak', 0.0];
        default: return [`PUB.${this.cmdName(u, fn)}`, 1.0];
      }
    }
    const n = u === HpsSim.LCU2 ? 2 : 1;
    const g = n === 1 ? this.g1 : this.g2;
    switch (fn) {
      case Cmd.FieldDischargeClose: return [`GEN${n}.FIELDDISCHARGE`, 1.0];
      case Cmd.FieldDischargeOpen: return [`GEN${n}.FIELDDISCHARGE`, 0.0];
      case Cmd.Close601: return [`CB60${n}`, 1.0];
      case Cmd.Trip601: return [`CB60${n}`, 0.0];
      case Cmd.AddP: return [`GEN${n}.P`, Math.min(8.5, g.p + 0.1)];
      case Cmd.SubP: return [`GEN${n}.P`, Math.max(0.0, g.p - 0.1)];
      case Cmd.AddQ: return [`GEN${n}.Q`, Math.min(6.0, g.q + 0.1)];
      case Cmd.SubQ: return [`GEN${n}.Q`, Math.max(-3.0, g.q - 0.1)];
      case Cmd.Generating:
      case Cmd.UnitOpen: return [`GEN${n}.MODE`, 1.0];
      case Cmd.Noload: return [`GEN${n}.MODE`, 2.0];
      case Cmd.FreeRunning: return [`GEN${n}.MODE`, 3.0];
      case Cmd.ShutDown:
      case Cmd.UnitShutDown: return [`GEN${n}.MODE`, 0.0];
      case Cmd.EShutDown:
      case Cmd.EmergencyShutdown:
      case Cmd.UnitElectricalFault: return [`GEN${n}.EMSTOP`, 1.0];
      case Cmd.EshutDownReset:
      case Cmd.CancelOper: return [`GEN${n}.RESET`, 1.0];
      case Cmd.HeaterOpen: return [`GEN${n}.HEATER`, 1.0];
      case Cmd.SealValveOn: return [`GEN${n}.MAINTSEAL`, 1.0];
      case Cmd.SealValveOff: return [`GEN${n}.MAINTSEAL`, 0.0];
      case Cmd.Close331_1: return [n === 1 ? 'IS331_1' : 'IS332_2', 1.0];
      case Cmd.Trip331_1: return [n === 1 ? 'IS331_1' : 'IS332_2', 0.0];
      case Cmd.CoolingWaterOpen: return [`GEN${n}.CWVALVE`, 1.0];
      case Cmd.CoolingWaterClose: return [`GEN${n}.CWVALVE`, 0.0];
      case Cmd.CoolingPump1Start: return [`GEN${n}.WATERPUMP1`, 1.0];
      case Cmd.CoolingPump1Stop:
      case Cmd.FireStopPump1: return [`GEN${n}.WATERPUMP1`, 0.0];
      case Cmd.CoolingPump2Start:
      case Cmd.FireStartPump2: return [`GEN${n}.WATERPUMP2`, 1.0];
      case Cmd.CoolingPump2Stop:
      case Cmd.FireStopPump2: return [`GEN${n}.WATERPUMP2`, 0.0];
      case Cmd.GovernorPump1Start: return [`GEN${n}.OILPUMP1`, 1.0];
      case Cmd.GovernorPump1Stop: return [`GEN${n}.OILPUMP1`, 0.0];
      case Cmd.GovernorPump2Start: return [`GEN${n}.OILPUMP2`, 1.0];
      case Cmd.GovernorPump2Stop: return [`GEN${n}.OILPUMP2`, 0.0];
      case Cmd.AirBreakOn: return [`GEN${n}.AIRBRAKE`, 0.0];
      case Cmd.AirBreakOff: return [`GEN${n}.AIRBRAKE`, 1.0];
      case Cmd.HeadCoverPump1Start: return [`GEN${n}.HC1`, 1.0];
      case Cmd.HeadCoverPump1Stop: return [`GEN${n}.HC1`, 0.0];
      case Cmd.HeadCoverPump2Start: return [`GEN${n}.HC2`, 1.0];
      case Cmd.HeadCoverPump2Stop: return [`GEN${n}.HC2`, 0.0];
      case Cmd.IntakeGateOpen: return ['INTAKEGATE', 1.0];
      case Cmd.IntakeGateClose:
      case Cmd.EmergencyIntakeGateClose:
      case 0x3601:
      case 0x3701: return ['INTAKEGATE', 0.0];
      case Cmd.ServoMotorLock:
      case Cmd.ServoMotorLock2: return [`GEN${n}.SERVOLOCK`, 1.0];
      case Cmd.ServoMotorRelease:
      case Cmd.ServoMotorRelease2: return [`GEN${n}.SERVOLOCK`, 0.0];
      case Cmd.OpenExcitation: return [`GEN${n}.EXCITE`, 1.0];
      case Cmd.ShutdownExcitation:
      case Cmd.OverspeedDeexcitation: return [`GEN${n}.EXCITE`, 0.0];
      default: return [`${this.unitName(u)}.${this.cmdName(u, fn)}`, 1.0];
    }
  }

  video(file: string): void { this.event('video', file); }
  alarm(trip = false): void { this.event('alarm', trip ? 'trip' : 'on'); }
  page(p: string): void { if (this.autoPage) this.event('page', p); }

  // =====================================================================
  init(): void {
    this.variableInit();
    this.phys.step(0.05);
    this.snapshot = this.buildSnapshot();
  }

  /** Chạy một bước mô phỏng chuẩn 100 ms (0,1 s) đúng như HpsSim.step() */
  step(): void {
    this.tick++;
    this.simClockMs += 100;
    while (this.queue.length > 0) {
      const a = this.queue.shift()!;
      try { a(); } catch (e) { console.error('[SIM] Lệnh lỗi:', e); }
    }
    if (this.timers.length > 0) {
      const due: Array<() => void> = [];
      for (let i = this.timers.length - 1; i >= 0; i--) {
        if (this.timers[i].dueMs <= this.simClockMs) {
          due.push(this.timers[i].action);
          this.timers.splice(i, 1);
        }
      }
      due.reverse().forEach((fn) => fn());
    }
    this.phys.step(0.1);
    this.syncWatch();
    this.deviceVideos();
    if (this.tick % 10 === 0) {
      this.energy();
      this.onSecond?.();
    }
    if (this.tick % 2 === 0) this.snapshot = this.buildSnapshot();
  }

  b(v: boolean): number { return v ? 1.0 : 0.0; }
  on(v: number): boolean { return v !== 0.0; }

  // =====================================================================
  // VariableInit: khởi động nhanh hai tổ máy (giống DAQ / HpsSim.kt)
  // =====================================================================
  variableInit(): void {
    this.is372_7 = 1.0; this.is372_2 = 1.0; this.is312_1 = 1.0; this.is371_7 = 1.0; this.is371_1 = 1.0;
    this.g1.is33 = 1.0; this.g2.is33 = 1.0;
    for (const g of this.gens) {
      g.airComp1 = 1.0;
      g.cwLevel = 50.0; g.oilLevel = 50.0;
      // tổ máy dừng dự phòng: MC đầu cực đóng, MK đóng, khoá cánh hướng, phanh nhả, cấp khí đệm kín sửa chữa
      g.cb60 = 1.0; g.fieldDischarge = 1.0; g.airBrake = 1.0; g.servoLock = 1.0; g.maintSeal = 1.0;
      g.cwValve = 0.0; g.waterPump1 = 0.0; g.waterPump2 = 0.0;
    }
    this.phys.init();
    this.g2.cwTemp = 31.0;
    this.axt1 = 0.0; this.axt2 = 1.0;
    this.v371 = 38.5; this.v372 = 38.5;
    this.is612_1 = 1.0; this.is612_2 = 0.0;
    this.later(5000, () => { this.cb372 = 1.0; this.cb371 = 1.0; });
    this.later(6000, () => { for (let i = 0; i <= 4; i++) this.auxMcb[i] = 1.0; });
  }

  /** Bảo vệ tác động: phân loại và dừng tổ máy theo mô hình vật lý */
  tripGen(g: Gen, reason: string): void {
    if (g.tripped) return;
    this.log('TRIP', g.no, `MF${g.no} BẢO VỆ CẮT MÁY: ${reason}`);
    this.event('msg', `MF${g.no} bảo vệ cắt máy: ${reason}`);
    this.alarm(true);
    this.incident(`MF${g.no} bảo vệ cắt máy: ${reason}`);
    this.phys.tripBySignal(g, reason);
  }

  /** Tổ máy làm việc song song với lưới hệ thống (Parallel); false = chạy độc lập (Isolate) hoặc không nối thanh cái */
  parallel(g: Gen): boolean {
    if (!this.on(g.cb60) || !this.on(g.cb33) || !this.on(g.is33)) return false;
    const p = this.phys.plant;
    const node = g.no === 1 ? Plant.G1T : Plant.G2T;
    return p.gridAvailable && p.net.island[node] === p.net.island[Plant.TBA];
  }

  // ---------------- Video theo sự kiện vật lý ----------------
  private dsVideoList(): Array<[string, number, string]> {
    return [
      ['IS371_7', this.is371_7, 'ds'], ['IS371_1', this.is371_1, 'ds'],
      ['IS372_7', this.is372_7, 'ds'], ['IS372_2', this.is372_2, 'ds'],
      ['IS331_1', this.g1.is33, 'ds1'], ['IS332_2', this.g2.is33, 'ds1'], ['IS312_1', this.is312_1, 'ds1'],
    ];
  }

  /** Hồ quang tại dao (Physics gọi): phát video *_fire và ghi mô tả sự cố */
  arcEvent(key: string, closing: boolean, text: string): void {
    const pre = this.dsVideoList().find((it) => it[0] === key)?.[2] ?? 'ds1';
    this.video(`${pre}${closing ? 'on' : 'off'}_fire.mp4`);
    this.arcShown.add(key);
    this.log('ERR', 3, text); this.event('msg', text); this.alarm(true);
    this.incident(text);
  }

  /** Dừng sự cố tổ máy: phát video dừng ngay lúc bảo vệ tác động */
  unitStopVideo(g: Gen): void {
    if (this.stopShown[g.no - 1]) return;
    this.video(g.no === 1 ? 'tbstop.mp4' : 'tb2stop.mp4');
    this.stopShown[g.no - 1] = true;
  }

  private deviceVideos(): void {
    const chg = (key: string, v: number): boolean => {
      const p = this.last.get(key);
      this.last.set(key, v);
      return p !== undefined && p !== v;
    };
    const cbs: Array<[string, number, string]> = [
      ['CB371', this.cb371, 'cb1'], ['CB372', this.cb372, 'cb1'],
      ['CB601', this.g1.cb60, 'cb1'], ['CB602', this.g2.cb60, 'cb1'],
      ['CB331', this.g1.cb33, 'cb'], ['CB332', this.g2.cb33, 'cb1'],
    ];
    for (const [k, v, f] of cbs) if (chg(k, v)) this.video(`${f}${this.on(v) ? 'on' : 'off'}.mp4`);
    for (const [k, v, f] of this.dsVideoList()) {
      if (chg(k, v) && !this.arcShown.has(k)) this.video(`${f}${this.on(v) ? 'on' : 'off'}.mp4`);
    }
    this.arcShown.clear();
    for (const g of this.gens) {
      const run = this.on(g.running);
      if (chg(`RUN${g.no}`, this.b(run))) {
        if (run) { this.video(g.no === 1 ? 'tbrun.mp4' : 'tb2run.mp4'); this.stopShown[g.no - 1] = false; }
        else this.unitStopVideo(g);
      }
    }
  }

  // =====================================================================
  // Điện năng
  // =====================================================================
  private energy(): void {
    const pl = this.phys.plant;
    this.meters.integrate(1.0, {
      MF1: [this.g1.pload / 100, this.g1.qload / 100],
      MF2: [this.g2.pload / 100, this.g2.qload / 100],
      L371: [this.p371, this.q371],
      L372: [this.p372, this.q372],
      TD61: [pl.tdKW[0] / 1000, pl.tdKVAr[0] / 1000],
      TD32: [pl.tdKW[1] / 1000, pl.tdKVAr[1] / 1000],
      DG: [pl.dgKW / 1000, pl.dgKVAr / 1000],
    });
    this.a371 = this.meters.get('L371')[0] - this.meters.get('L371')[1];
    this.a372 = this.meters.get('L372')[0] - this.meters.get('L372')[1];
    if (++this.energySaveCount >= 60) { this.energySaveCount = 0; this.energyStore?.(); }
  }

  unitName(u: number): string {
    return u === 1 ? 'LCU1' : u === 2 ? 'LCU2' : u === 3 ? 'PUB' : `U${u}`;
  }

  // =====================================================================
  // SD200ExecuteCommand
  // =====================================================================
  execute(u: number, fn: number, data: number, source: string, yt = false, clientId = ''): void {
    if (source !== 'Web' && this.on(u === HpsSim.LCU1 ? this.g1.remote : u === HpsSim.LCU2 ? this.g2.remote : this.remotePub)) {
      this.log('ERR', u, `${source}: ${this.unitName(u)} đang ở LOCAL – từ chối lệnh từ xa`);
      this.event('msg', `${this.unitName(u)} đang ở LOCAL – lệnh ${source} bị từ chối`);
      return;
    }
    if (yt) {
      const obj = fn >> 8;
      const sp = u === HpsSim.PUB && obj >= 1 && obj <= 8 ? 31 + obj : u !== HpsSim.PUB && obj >= 3 && obj <= 8 ? 29 + obj : -1;
      if (sp > 0 && (fn & 0xff) === 1) {
        const raw = coerceIn(data - 1, 0.0, 65535.0);
        // cập nhật trực tiếp ngưỡng tự động bơm
        if (u === HpsSim.LCU1 || u === HpsSim.LCU2) {
          const asp = u === HpsSim.LCU1 ? this.phys.plant.autoSp1 : this.phys.plant.autoSp2;
          if (sp === 32) asp.oilMainStart = (raw / 32000.0) * 4.0;
          else if (sp === 33) asp.oilStandbyStart = (raw / 32000.0) * 4.0;
          else if (sp === 34) asp.oilStop = (raw / 32000.0) * 4.0;
          else if (sp === 35) asp.hcMainStart = (raw / 32000.0) * 1000.0;
          else if (sp === 36) asp.hcStandbyStart = (raw / 32000.0) * 1000.0;
          else if (sp === 37) asp.hcStop = (raw / 32000.0) * 1000.0;
        } else {
          const pl = this.phys.plant;
          if (sp === 32) pl.sumpSp[0] = (raw / 32000.0) * 10.0;
          else if (sp === 33) pl.sumpSp[1] = (raw / 32000.0) * 10.0;
          else if (sp === 34) pl.sumpSp[2] = (raw / 32000.0) * 10.0;
          else if (sp === 35) pl.drainSp[0] = (raw / 32000.0) * 15.0;
          else if (sp === 36) pl.drainSp[1] = (raw / 32000.0) * 15.0;
          else if (sp === 37) pl.drainSp[2] = (raw / 32000.0) * 15.0;
          else if (sp === 38) pl.oilLeakSp[0] = (raw / 32000.0) * 0.5;
          else if (sp === 39) pl.oilLeakSp[1] = (raw / 32000.0) * 0.5;
        }
        this.log('CMD', u, `${source}: ${this.unitName(u)} đặt ngưỡng AI_${sp} = ${Math.trunc(raw)}`);
        this.cmdEvent(`${this.unitName(u)}.AI_${sp}`, raw, source, `${source} ${this.unitName(u)} đặt ngưỡng AI_${sp} = ${Math.trunc(raw)}`, clientId, true);
        return;
      }
      if (u === HpsSim.LCU1 || u === HpsSim.LCU2) {
        const g = u === HpsSim.LCU1 ? this.g1 : this.g2;
        if (fn === Cmd.PAdjust && data > 0) g.p = data / 79.1;
        if (fn === Cmd.QAdjust && data > 0) g.q = data / 79.1;
      }
      const canonName =
        (u === HpsSim.LCU1 || u === HpsSim.LCU2) && fn === Cmd.PAdjust
          ? `GEN${u}.P`
          : (u === HpsSim.LCU1 || u === HpsSim.LCU2) && fn === Cmd.QAdjust
          ? `GEN${u}.Q`
          : `${this.unitName(u)}.YT_0x${fn.toString(16).toUpperCase().padStart(4, '0')}`;
      const canonVal = (u === HpsSim.LCU1 || u === HpsSim.LCU2) && (fn === Cmd.PAdjust || fn === Cmd.QAdjust) ? data / 79.1 : data;
      const txt = `${source} ${this.unitName(u)} ${u !== HpsSim.PUB && fn === Cmd.PAdjust ? 'P-adjust' : u !== HpsSim.PUB && fn === Cmd.QAdjust ? 'Q-adjust' : `YT 0x${fn.toString(16).toUpperCase().padStart(4, '0')}`} = ${Math.trunc(data)}`;
      this.log('CMD', u, `${source}: ${this.unitName(u)} YT ${fn === Cmd.PAdjust ? 'P' : 'Q'}-adjust = ${Math.trunc(data)}`);
      this.cmdEvent(canonName, canonVal, source, txt, clientId, true);
      return;
    }
    const [canonName, canonVal] = this.ykCanonical(u, fn);
    const pre = this.capturePreCmdMeta(canonName, canonVal);
    this.executeSim(u, fn);
    this.pageFor(u, fn);
    this.cmdEvent(canonName, canonVal, source, `${source} ${this.unitName(u)} ${this.cmdName(u, fn)}`, clientId, true, pre);
    this.log('CMD', u, `${source}: ${this.unitName(u)} ${this.cmdName(u, fn)}`);
  }

  private pageFor(u: number, fn: number): void {
    if (u === 1 || u === 2) {
      if (fn === Cmd.IntakeGateOpen || fn === Cmd.IntakeGateClose) this.page('intake');
      else if (fn >= Cmd.CoolingWaterOpen && fn <= Cmd.CoolingPump2Stop) this.page(`aux${u}`);
      else if (fn === Cmd.ServoMotorLock || fn === Cmd.ServoMotorRelease) this.page('governor');
      else this.page(`turbine${u}`);
    } else if (u === 3) {
      this.page([Cmd.Close1AXT, Cmd.Close2AXT, Cmd.Trip1AXT, Cmd.Trip2AXT].includes(fn as never) ? 'auxpower' : 'main');
    }
  }

  seqOf(g: Gen): UnitSeq {
    return this.phys.seq[g.no - 1];
  }

  private ykSwitch(u: number, fn: number): [string, boolean] | null {
    if (u === HpsSim.PUB) {
      switch (fn) {
        case Cmd.Close371: return ['CB371', true]; case Cmd.Trip371: return ['CB371', false];
        case Cmd.Close372: return ['CB372', true]; case Cmd.Trip372: return ['CB372', false];
        case Cmd.Close371_1: return ['IS371_1', true]; case Cmd.Trip371_1: return ['IS371_1', false];
        case Cmd.Close371_7: return ['IS371_7', true]; case Cmd.Trip371_7: return ['IS371_7', false];
        case Cmd.Close372_2: return ['IS372_2', true]; case Cmd.Trip372_2: return ['IS372_2', false];
        case Cmd.Close372_7: return ['IS372_7', true]; case Cmd.Trip372_7: return ['IS372_7', false];
        case Cmd.Close312_1: return ['IS312_1', true]; case Cmd.Trip312_1: return ['IS312_1', false];
        default: return null;
      }
    }
    if (fn === Cmd.Close331_1) return [u === 1 ? 'IS331_1' : 'IS332_2', true];
    if (fn === Cmd.Trip331_1) return [u === 1 ? 'IS331_1' : 'IS332_2', false];
    return null;
  }

  executeSim(u: number, fn: number): void {
    const sw = this.ykSwitch(u, fn);
    if (sw) {
      const why = this.phys.interlock(sw[0], sw[1]);
      if (why) { this.blocked(sw[0], why); return; }
    }
    if (u === HpsSim.LCU1 || u === HpsSim.LCU2) {
      const g = u === HpsSim.LCU1 ? this.g1 : this.g2;
      switch (fn) {
        case Cmd.FieldDischargeClose: g.fieldDischarge = 1.0; break;
        case Cmd.FieldDischargeOpen: g.fieldDischarge = 0.0; break;
        case Cmd.Close601: g.cb60 = 1.0; break;
        case Cmd.Trip601: g.cb60 = 0.0; break;
        case Cmd.AddP: if (g.p < 8.5) g.p = Math.min(8.5, g.p + 0.1); break;
        case Cmd.SubP: if (g.p > 0) g.p = Math.max(0.0, g.p - 0.1); break;
        case Cmd.AddQ: if (g.q < 6.0) g.q += 0.1; break;
        case Cmd.SubQ: if (g.q > -3.0) g.q -= 0.1; break;
        case Cmd.Generating:
        case Cmd.UnitOpen: g.auto = 1.0; this.seqOf(g).start(1); break;
        case Cmd.EshutDownReset:
        case Cmd.CancelOper: this.resetProtection(g); break;
        case Cmd.ShutDown:
        case Cmd.UnitShutDown: this.seqOf(g).normalStop(); break;
        case Cmd.EShutDown:
        case Cmd.EmergencyShutdown: this.seqOf(g).emergency(1, 'Dừng khẩn cấp bằng tay'); break;
        case Cmd.UnitElectricalFault: this.seqOf(g).emergency(1, 'Sự cố phần điện tổ máy (lệnh)'); break;
        case Cmd.Noload: this.seqOf(g).start(2); break;
        case Cmd.FreeRunning: this.seqOf(g).start(3); break;
        case Cmd.HeaterOpen: g.heater = 1.0; break;
        case Cmd.SealValveOn: g.maintSeal = 1.0; break;
        case Cmd.SealValveOff: g.maintSeal = 0.0; break;
        case Cmd.FireStartPump2: g.waterPump2 = 1.0; g.cwValve = 1.0; break;
        case Cmd.FireStopPump1: g.waterPump1 = 0.0; break;
        case Cmd.FireStopPump2: g.waterPump2 = 0.0; break;
        case Cmd.OpenExcitation: if (g.freq > 45) this.phys.plant.units[g.no - 1].excOn = true; break;
        case Cmd.ShutdownExcitation:
        case Cmd.OverspeedDeexcitation: this.phys.plant.units[g.no - 1].excOn = false; break;
        case Cmd.Close331_1: g.is33 = 1.0; break;
        case Cmd.Trip331_1: g.is33 = 0.0; break;
        case Cmd.CoolingWaterOpen: g.cwValve = 1.0; break;
        case Cmd.CoolingWaterClose: g.cwValve = 0.0; break;
        case Cmd.CoolingPump1Start: g.waterPump1 = 1.0; break;
        case Cmd.CoolingPump1Stop: g.waterPump1 = 0.0; break;
        case Cmd.CoolingPump2Start: g.waterPump2 = 1.0; break;
        case Cmd.CoolingPump2Stop: g.waterPump2 = 0.0; break;
        case Cmd.GovernorPump1Start: g.oilPump1 = 1.0; break;
        case Cmd.GovernorPump1Stop: g.oilPump1 = 0.0; break;
        case Cmd.GovernorPump2Start: g.oilPump2 = 1.0; break;
        case Cmd.GovernorPump2Stop: g.oilPump2 = 0.0; break;
        case Cmd.AirBreakOn: g.airBrake = 0.0; break;
        case Cmd.AirBreakOff: g.airBrake = 1.0; break;
        case Cmd.HeadCoverPump1Start: g.hc1 = 1.0; break;
        case Cmd.HeadCoverPump1Stop: g.hc1 = 0.0; break;
        case Cmd.HeadCoverPump2Start: g.hc2 = 1.0; break;
        case Cmd.HeadCoverPump2Stop: g.hc2 = 0.0; break;
        case Cmd.IntakeGateOpen: this.intakeGate = 1.0; break;
        case Cmd.IntakeGateClose:
        case Cmd.EmergencyIntakeGateClose:
        case 0x3601:
        case 0x3701: this.intakeGate = 0.0; break;
        case Cmd.ServoMotorLock:
        case Cmd.ServoMotorLock2: g.servoLock = 1.0; break;
        case Cmd.ServoMotorRelease:
        case Cmd.ServoMotorRelease2: g.servoLock = 0.0; break;
      }
    } else if (u === HpsSim.PUB) {
      switch (fn) {
        case Cmd.Close371: this.cb371 = 1.0; break;
        case Cmd.Trip371: this.cb371 = 0.0; break;
        case Cmd.Close372: this.cb372 = 1.0; break;
        case Cmd.Trip372: this.cb372 = 0.0; break;
        case Cmd.Close371_7: this.is371_7 = 1.0; break;
        case Cmd.Trip371_7: this.is371_7 = 0.0; break;
        case Cmd.Close371_1: this.is371_1 = 1.0; break;
        case Cmd.Trip371_1: this.is371_1 = 0.0; break;
        case Cmd.Close372_7: this.is372_7 = 1.0; break;
        case Cmd.Trip372_7: this.is372_7 = 0.0; break;
        case Cmd.Close372_2: this.is372_2 = 1.0; break;
        case Cmd.Trip372_2: this.is372_2 = 0.0; break;
        case Cmd.Close312_1: this.is312_1 = 1.0; break;
        case Cmd.Trip312_1: this.is312_1 = 0.0; break;
        case Cmd.V400StandbyInput: this.standbyInput400 = 1.0; break;
        case Cmd.V400StandbyReset: this.standbyInput400 = 0.0; break;
        case 0x1901: this.pubDev.leak1 = true; break; case 0x1a01: this.pubDev.leak1 = false; break;
        case 0x1b01: this.pubDev.leak2 = true; break; case 0x1c01: this.pubDev.leak2 = false; break;
        case 0x1d01: this.pubDev.drain1 = true; break; case 0x1e01: this.pubDev.drain1 = false; break;
        case 0x1f01: this.pubDev.drain2 = true; break; case 0x2001: this.pubDev.drain2 = false; break;
        case 0x2401: this.pubDev.lpc1 = true; break; case 0x1101: this.pubDev.lpc1 = false; break;
        case 0x2301: this.pubDev.lpc2 = true; break; case 0x1201: this.pubDev.lpc2 = false; break;
        case 0x2501: this.pubDev.hpc1 = true; break; case 0x2601: this.pubDev.hpc1 = false; break;
        case 0x2701: this.pubDev.hpc2 = true; break; case 0x2801: this.pubDev.hpc2 = false; break;
        case 0x2901: this.pubDev.oilleak = true; break; case 0x2a01: this.pubDev.oilleak = false; break;
        case Cmd.Close1AXT: this.axt1 = 1.0; this.axt2 = 0.0; break;
        case Cmd.Trip1AXT: this.axt1 = 0.0; this.axt2 = 1.0; break;
        case Cmd.Close2AXT: this.axt2 = 1.0; this.axt1 = 0.0; break;
        case Cmd.Trip2AXT: this.axt2 = 0.0; this.axt1 = 1.0; break;
      }
    }
  }

  clearFaults(): void {
    this.post(() => {
      for (const id of Array.from(this.activeFaults)) {
        this.phys.applyFault(id, false);
        this.activeFaults.delete(id);
      }
      this.forcedTripUnits.clear();
      this.auxLost = false;
      this.phys.clearAll();
      for (const g of this.gens) {
        g.tripped = false; g.tripReason = ''; g.fault = 0.0;
        g.wpFail = false; g.opFail = false; g.hcFail = false;
        g.leakFault = false; g.bearingFault = false; g.statorFault = false;
      }
      this.clearIncident();
      this.log('FAULT', 0, 'Xoá toàn bộ sự cố, giải trừ bảo vệ');
    });
  }

  /** Thiết lập nhanh 9 kịch bản thực hành chuẩn NMTĐ Đrây H'Linh 2 (KB 1..9) */
  applyScenario(id: number): void {
    this.post(() => {
      // 1. Dọn sạch sự cố, hẹn giờ, rơ le, sự kiện cũ
      this.timers.length = 0;
      this.activeFaults.clear();
      this.forcedTripUnits.clear();
      this.auxLost = false;
      this.phys.clearAll();
      this.clearIncident();
      this.simulationMode = 1.0;
      this.phys.gridLost = false; this.phys.fcoBlown = false; this.phys.dgFail = false;
      this.phys.dgAuto = true; this.phys.dgCb = false; this.phys.dgEngine = false; this.phys.dgT = 0.0;
      this.standbyInput400 = 0.0;
      this.phys.plant.zUp = this.phys.cfg().crestLevelM + 0.2; this.phys.plant.zTail = 0.5;
      this.phys.plant.tba371 = true; this.phys.plant.tba372 = true; this.phys.plant.gridAvailable = true;
      this.phys.plant.lpAirMPa = 0.75; this.phys.plant.hpAirMPa = 4.0;
      this.inflow = 1.0; this.remotePub = 0.0;
      // Reset dao nối đất & sơ đồ 35 kV chuẩn
      this.gs371_76 = 0.0; this.gs371_75 = 0.0; this.gs371_15 = 0.0;
      this.gs372_76 = 0.0; this.gs372_75 = 0.0; this.gs372_25 = 0.0;
      this.is371_7 = 1.0; this.is371_1 = 1.0; this.is372_7 = 1.0; this.is372_2 = 1.0; this.is312_1 = 1.0;
      this.cb371 = 1.0; this.cb372 = 1.0;
      this.is612_1 = 1.0; this.is612_2 = 0.0;
      for (let i = 0; i <= 4; i++) this.auxMcb[i] = 1.0;
      this.intakeGate = 1.0; this.phys.plant.intake[0] = 1.0; this.phys.plant.intake[1] = 1.0;

      const resetUnitStandby = (g: Gen, idx: number) => {
        const u = this.phys.plant.units[idx];
        u.presetStopped(28.0);
        g.generating = 0.0; g.emValve = 0.0; g.auto = 0.0; g.fault = 0.0; g.remote = 0.0;
        g.tripped = false; g.tripReason = '';
        g.wpFail = false; g.opFail = false; g.hcFail = false; g.leakFault = false; g.bearingFault = false; g.statorFault = false;
        g.autoSync = true; g.spTrim = 0.0; g.vTrim = 0.0; g.auxAuto = 1.0;
        g.govAuto = 1.0; g.bladeAuto = 1.0; g.gvManual = 0.0; g.bladeManual = -10.0; g.gvLimit = 100.0;
        g.is33 = 1.0; g.cb33 = 0.0; g.cb60 = 1.0; g.fieldDischarge = 1.0;
        g.gs14 = 0.0; g.gs15 = 0.0; g.gsQE = 0.0; g.gsQE1 = 0.0;
        g.p = 0.0; g.q = 0.0; g.airBrake = 1.0; g.servoLock = 1.0; g.maintSeal = 1.0;
        g.cwValve = 0.0; g.waterPump1 = 0.0; g.waterPump2 = 0.0; g.cwPreMPa = 0.0; g.cwLevel = 65.0;
        g.oilPump1 = 0.0; g.oilPump2 = 0.0; g.oilLevel = 65.0; g.hc1 = 0.0; g.hc2 = 0.0;
        g.airComp1 = 1.0; g.airComp2 = 0.0; g.heater = 0.0;
        this.phys.seq[idx].forceState('IDLE', 0, 'Dừng dự phòng chuẩn (14/14)');
      };

      const setUnitGenerating = (g: Gen, idx: number, pMW: number, qMVAr: number) => {
        const u = this.phys.plant.units[idx];
        resetUnitStandby(g, idx);
        g.generating = 1.0; g.p = pMW; g.q = qMVAr;
        g.cb60 = 1.0; g.cb33 = 1.0; g.is33 = 1.0; g.fieldDischarge = 1.0;
        g.airBrake = 1.0; g.servoLock = 0.0; g.maintSeal = 0.0;
        g.cwValve = 1.0; g.waterPump1 = 1.0; g.cwPreMPa = 0.34;
        u.presetSteady(pMW, qMVAr, true, true, this.phys.plant.gridAngle);
        this.phys.seq[idx].forceState('RUN', 1, `Đang phát điện ${fmt1(pMW)} MW / ${fmt1(qMVAr)} MVAr`);
      };

      resetUnitStandby(this.g1, 0);
      resetUnitStandby(this.g2, 1);
      this.axt1 = 0.0; this.axt2 = 1.0;

      let label = `Kịch bản ${id}`;
      switch (id) {
        case 1:
          label = 'KB 1 – Dừng dự phòng chuẩn (14/14)';
          break;
        case 2:
          this.intakeGate = 0.0; this.phys.plant.intake[0] = 0.0; this.phys.plant.intake[1] = 0.0;
          this.axt1 = 0.0; this.axt2 = 0.0; this.phys.dgAuto = false;
          this.gens.forEach((g, idx) => {
            const u = this.phys.plant.units[idx];
            g.auxAuto = 0.0;
            g.is33 = 0.0; g.cb33 = 0.0; g.cb60 = 0.0; g.fieldDischarge = 0.0;
            g.gsQE = 1.0; g.gs14 = 1.0; g.gs15 = 1.0;
            g.airBrake = 0.0; g.servoLock = 1.0; g.maintSeal = 1.0;
            g.cwValve = 0.0; g.waterPump1 = 0.0; g.waterPump2 = 0.0;
            g.oilPump1 = 0.0; g.oilPump2 = 0.0;
            u.oilVol = 0.45; u.oilPressMPa = 2.38;
            this.phys.seq[idx].forceState('IDLE', 0, 'Sau đại tu – ĐK khởi động về 0');
          });
          label = 'KB 2 – Đưa ĐK khởi động về 0 (Sau đại tu)';
          break;
        case 3:
          this.g1.generating = 1.0; this.g1.autoSync = false; this.g1.spTrim = 0.06; this.g1.vTrim = 0.0;
          this.g1.cb60 = 1.0; this.g1.is33 = 1.0; this.g1.cb33 = 0.0; this.g1.fieldDischarge = 1.0;
          this.g1.airBrake = 1.0; this.g1.servoLock = 0.0; this.g1.maintSeal = 0.0;
          this.g1.cwValve = 1.0; this.g1.waterPump1 = 1.0; this.g1.cwPreMPa = 0.34;
          this.phys.plant.u1.presetSteady(0.0, 0.0, false, true, this.phys.plant.gridAngle);
          this.phys.seq[0].forceState('SYNC', 1, 'Không tải 6,3 kV / 50 Hz – sẵn sàng hoà lưới');
          this.axt1 = 1.0; this.axt2 = 0.0;
          label = 'KB 3 – Không tải – Sẵn sàng Hòa lưới';
          break;
        case 4:
          this.is312_1 = 1.0;
          setUnitGenerating(this.g1, 0, 8.0, 4.0);
          setUnitGenerating(this.g2, 1, 8.0, 4.0);
          this.gens.forEach((g, idx) => {
            const u = this.phys.plant.units[idx];
            g.auxAuto = 1.0;
            g.waterPump1 = 1.0; g.waterPump2 = 0.0; g.cwValve = 1.0;
            g.cwPreMPa = 0.34; g.cwMPa = 0.32; g.cwTemp = 27.5;
            u.cwRun = true; u.cwFlow = 1.0; u.cwPressMPa = 0.32;
            u.tThrustOil = 44.5; u.tThrustPad = 55.25;
            u.tUpperOil = 39.0; u.tUpperPad = 47.0;
            u.tLowerOil = 38.5; u.tLowerPad = 46.5;
            u.tTurbOil = 39.0; u.tTurbPad = 46.0;
            u.tCoil = 78.0; u.tCore = 62.0; u.tRotor = 74.0;
            u.tColdAir = 33.5; u.tHotAir = 52.0;
            g.thrustOil = 44.5;
          });
          this.axt1 = 1.0; this.axt2 = 0.0;
          label = 'KB 4 – Phát định mức 2 tổ máy (2×8 MW)';
          break;
        case 5:
          this.phys.gridLost = true; this.phys.plant.gridAvailable = false;
          this.cb371 = 0.0; this.cb372 = 0.0;
          this.axt1 = 0.0; this.axt2 = 0.0; this.phys.dgAuto = false;
          this.phys.dgCb = false; this.phys.dgEngine = false; this.standbyInput400 = 0.0;
          label = 'KB 5 – Khởi động đen (Mất điện toàn trạm)';
          break;
        case 6:
          setUnitGenerating(this.g1, 0, 6.0, 2.5);
          this.is612_1 = 1.0; this.is612_2 = 0.0;
          this.axt1 = 1.0; this.axt2 = 0.0;
          this.phys.dgAuto = false;
          label = 'KB 6 – Chuyển đổi nguồn Tự dùng (TD 61 → TD 32)';
          break;
        case 7:
          setUnitGenerating(this.g1, 0, 7.0, 3.0);
          this.axt1 = 1.0; this.axt2 = 0.0;
          this.g1.auxAuto = 0.0;
          this.g1.waterPump1 = 1.0; this.g1.waterPump2 = 0.0;
          this.g1.cwValve = 0.0; this.g1.cwPreMPa = 0.48;
          this.phys.plant.u1.cwRun = false; this.phys.plant.u1.cwFlow = 0.0; this.phys.plant.u1.cwPressMPa = 0.0;
          this.phys.plant.u1.tThrustOil = 45.0; this.phys.plant.u1.tThrustPad = 53.0; this.phys.plant.u1.tCoil = 68.0;
          this.incident('KB 7: Mất lưu lượng nước làm mát MF1 (van điện CW đóng, áp chặn trước van 0,48 MPa) – xử lý trước khi T dầu ổ đỡ > 55 °C!', 2);
          this.alarm(false);
          label = 'KB 7 – Sự cố mất nước làm mát (MF1)';
          break;
        case 8:
          setUnitGenerating(this.g1, 0, 7.0, 3.0);
          setUnitGenerating(this.g2, 1, 7.0, 3.0);
          this.axt1 = 1.0; this.axt2 = 0.0;
          this.phys.step(0.05);
          this.cb371 = 0.0; this.cb372 = 0.0;
          this.incident('KB 8: Mất tải đột ngột 35 kV – cắt đồng thời MC 371 & MC 372 khi 2 tổ máy phát 14 MW (Điều 48)!', 2);
          this.alarm(true);
          label = 'KB 8 – Mất tải đột ngột 35 kV (14 MW)';
          break;
        case 9:
          setUnitGenerating(this.g1, 0, 7.0, 3.0);
          setUnitGenerating(this.g2, 1, 6.0, 2.5);
          this.is612_1 = 0.0; this.is612_2 = 1.0;
          this.axt1 = 1.0; this.axt2 = 0.0;
          this.phys.plant.genProt[0].r87.operated = true;
          this.phys.plant.genProt[0].r87.picked = true;
          this.activeFaults.add('g1.fire');
          this.forcedTripUnits.add(1);
          this.g1.fault = 1.0;
          this.phys.seq[0].emergency(1, '87G – Bảo vệ so lệch dọc máy phát (DGT 801, Điều 45)', true);
          this.incident('KB 9: Tác động bảo vệ so lệch dọc 87G tổ máy 1 (cắt MC 601, 331, MK Q1 – HL10 G fault sáng, Điều 45)!', 2);
          this.alarm(true);
          label = 'KB 9 – Tác động bảo vệ 87G tổ máy 1';
          break;
      }
      // Đồng bộ trạng thái công tắc & chạy 1 bước ngắn để snapshot cập nhật ngay lập tức
      this.phys.step(0.05);
      this.snapshot = this.buildSnapshot();
      this.log('SESSION', 0, `Thiết lập kịch bản thực hành: ${label}`);
      this.event('msg', `Đã thiết lập ${label}`);
    });
  }

  private blocked(name: string, why: string): void {
    this.log('ERR', 0, `LIÊN ĐỘNG cấm thao tác ${name}: ${why}`);
    this.event('msg', `Liên động: cấm thao tác ${name} – ${why}`);
    this.incident(`Cấm thao tác ${name}: ${why}`, 1);
  }

  private resetProtection(g: Gen): void {
    if (this.forcedTripUnits.has(g.no)) {
      this.event('msg', `MF${g.no}: còn tín hiệu bảo vệ, chưa giải trừ được`);
      return;
    }
    if (g.tripped) this.log('CMD', g.no, `Giải trừ bảo vệ MF${g.no}`);
    g.tripped = false; g.tripReason = ''; g.emValve = 0.0;
    this.phys.resetUnit(g.no);
  }

  // =====================================================================
  // Lệnh từ HMI web
  // =====================================================================
  private genOf(n: string): Gen {
    return n.endsWith('2') ? this.g2 : this.g1;
  }

  textCommand(t: string, source: string, clientId = ''): void {
    this.post(() => {
      const s = t.trim();
      const sl = s.toLowerCase();
      if (sl === 'sim mode') {
        this.simulationMode = 1.0; this.page('main');
        this.cmdEvent('SIMULATIONMODE', 1.0, source, `${source}: Sim Mode`, clientId, source !== 'Web');
      } else if (sl.startsWith('close cb') || sl.startsWith('open cb')) {
        const close = sl.startsWith('close');
        const idx = s.toUpperCase().lastIndexOf('CB');
        const cb = idx >= 0 ? s.slice(idx + 2).trim() : '';
        this.hmiBreaker(cb, close, source, clientId);
      } else if (sl.startsWith('run gen')) {
        const g = this.genOf(s);
        const cname = `GEN${g.no}.MODE`;
        const pre = this.capturePreCmdMeta(cname, 1.0);
        g.auto = 1.0; this.seqOf(g).start(1);
        this.cmdEvent(cname, 1.0, source, `${source}: ${s}`, clientId, source !== 'Web', pre);
      } else if (sl.startsWith('stop gen')) {
        const g = this.genOf(s);
        const cname = `GEN${g.no}.MODE`;
        const pre = this.capturePreCmdMeta(cname, 0.0);
        this.seqOf(g).normalStop();
        this.cmdEvent(cname, 0.0, source, `${source}: ${s}`, clientId, source !== 'Web', pre);
      }
    });
  }

  hmiBreaker(cb: string, close: boolean, source = 'Web', clientId = ''): void {
    const v = close ? 1.0 : 0.0;
    const pre = this.capturePreCmdMeta(`CB${cb}`, v);
    const why = this.phys.interlock(`CB${cb}`, close);
    if (why) { this.blocked(`CB${cb}`, why); return; }
    if (close && (cb === '331' || cb === '332')) {
      const g = cb === '331' ? this.g1 : this.g2;
      const pc = this.phys.cfg();
      const zoneV = cb === '331' ? this.vbusZone1 : this.vbusZone2;
      const busF = cb === '331' ? this.freqZone1 : this.freqZone2;
      const busV = (zoneV * pc.genKV) / 38.5;
      if (zoneV > 10 && this.on(g.is33) && g.freq > 40) {
        const df = g.freq - busF;
        const dv = busV > 0.1 ? ((g.vgen - busV) / busV) * 100.0 : 100.0;
        const ph = g.phase;
        if (Math.abs(df) > pc.syncMaxDfHz || Math.abs(dv) > pc.syncMaxDvPct || Math.abs(ph) > pc.syncMaxPhaseDeg) {
          const m = `Đóng MC ${cb} MF${g.no} sai điều kiện đồng bộ (Δf = ${fmt2(df)} Hz, ΔU = ${fmt1(dv)} %, Δφ = ${fmt0(ph)}°; ngưỡng Δf≤${fmt2(pc.syncMaxDfHz)} Hz, ΔU≤${fmt1(pc.syncMaxDvPct)}%, Δφ≤${fmt0(pc.syncMaxPhaseDeg)}°)`;
          this.log('ERR', g.no, m); this.event('msg', m); this.incident(m);
          this.syncTicks[g.no - 1] = 10; this.syncPeak[g.no - 1] = 0.0;
        }
      }
    }
    switch (cb) {
      case '371': this.cb371 = v; break;
      case '372': this.cb372 = v; break;
      case '331': this.g1.cb33 = v; break;
      case '332': this.g2.cb33 = v; break;
      case '601': this.g1.cb60 = v; break;
      case '602': this.g2.cb60 = v; break;
    }
    const tag = source === 'Web' ? 'HMI' : source;
    this.cmdEvent(`CB${cb}`, v, source, `${tag} ${close ? 'đóng' : 'cắt'} CB${cb}`, clientId, true, pre);
    this.log('CMD', 0, `${tag} ${close ? 'đóng' : 'cắt'} máy cắt ${cb}`);
  }

  /** Thao tác trên HMI: đổi một biến (bật/tắt hoặc đặt giá trị). */
  hmiSet(name: string, value: number | null, source = 'Web', clientId = ''): void {
    this.post(() => {
      const tog = (cur: number) => (value !== null ? value : this.on(cur) ? 0.0 : 1.0);
      const n = name.toUpperCase();
      if (n.startsWith('CB')) {
        const k = n.slice(2);
        const curMap: Record<string, number> = {
          '371': this.cb371, '372': this.cb372,
          '331': this.g1.cb33, '332': this.g2.cb33,
          '601': this.g1.cb60, '602': this.g2.cb60,
        };
        if (!(k in curMap)) return;
        this.hmiBreaker(k, this.on(tog(curMap[k])), source, clientId);
        return;
      }
      const pre = this.capturePreCmdMeta(n, value);
      let effVal: number | null = value;
      let handled = true;
      if (n === 'SIMULATIONMODE') {
        this.simulationMode = 1.0; effVal = 1.0;
      } else if (n === 'CLEARALARM') {
        effVal = 1.0; this.clearAlarm();
      } else if (n === 'INTAKEGATE') {
        const nv = tog(this.intakeGate); this.intakeGate = nv; effVal = nv;
      } else if (n === 'INFLOW') {
        if (value !== null) { this.inflow = coerceIn(value, 0.0, 2.5); effVal = this.inflow; }
      } else if (n.startsWith('PUB.')) {
        const k = name.slice(name.indexOf('.') + 1);
        const nv = !(this.pubDev[k] ?? false);
        this.pubDev[k] = nv; effVal = this.b(nv);
      } else if (n === 'HEADHIGH') {
        if (value !== null) { this.headHigh = coerceIn(value, 0.0, 60.0); effVal = this.headHigh; }
      } else if (n === 'IS612_1') {
        const nv = tog(this.is612_1);
        const why = this.phys.interlock(n, this.on(nv));
        if (why) { this.blocked(n, why); return; }
        this.is612_1 = nv; effVal = nv;
      } else if (n === 'IS612_2') {
        const nv = tog(this.is612_2);
        const why = this.phys.interlock(n, this.on(nv));
        if (why) { this.blocked(n, why); return; }
        this.is612_2 = nv; effVal = nv;
      } else if (n === 'PUBREMOTE') {
        const nv = tog(this.remotePub); this.remotePub = nv; effVal = nv;
        this.log('CMD', HpsSim.PUB, `PUB LCU chuyển ${this.on(this.remotePub) ? 'LOCAL (Manual)' : 'REMOTE (Auto)'}`);
      } else if (n === 'INTERLOCK') {
        this.phys.cfg().interlock =
          value !== null
            ? this.on(value) ? 'strict' : 'natural'
            : this.phys.cfg().interlock === 'strict' ? 'natural' : 'strict';
        effVal = this.phys.cfg().interlock === 'strict' ? 1.0 : 0.0;
        this.event(
          'msg',
          'Liên động thao tác: ' +
            (this.phys.cfg().interlock === 'strict' ? 'CẤM thao tác sai' : 'TỰ NHIÊN (cho thao tác sai, mô phỏng hậu quả)'),
        );
      } else if (n === 'DGAUTO') {
        this.phys.dgAuto = !this.phys.dgAuto; effVal = this.b(this.phys.dgAuto);
      } else if (n === 'DGCB') {
        const nv = this.phys.dgCb || this.on(this.standbyInput400) ? 0.0 : 1.0;
        this.standbyInput400 = nv; effVal = nv;
      } else if (n === 'GRIDLOST') {
        const nv = tog(this.b(this.phys.gridLost)); this.phys.gridLost = nv === 1.0; effVal = nv;
      } else if (n === 'TBALOAD') {
        if (value !== null) { this.phys.cfg().tbaLoadMW = coerceIn(value, 0.0, 20.0); effVal = this.phys.cfg().tbaLoadMW; }
      } else if (n === 'TBALOADQ') {
        if (value !== null) { this.phys.cfg().tbaLoadMVAr = coerceIn(value, 0.0, 10.0); effVal = this.phys.cfg().tbaLoadMVAr; }
      } else if (n === 'GRIDV') {
        if (value !== null) { this.phys.cfg().gridVoltagePu = coerceIn(value, 0.9, 1.1); effVal = this.phys.cfg().gridVoltagePu; }
      } else if (n === 'THERMALSPEED') {
        if (value !== null) { this.phys.cfg().thermalSpeed = coerceIn(value, 1.0, 60.0); effVal = this.phys.cfg().thermalSpeed; }
      } else if (n === 'GOVKP') {
        if (value !== null) { this.phys.cfg().govKp = coerceIn(value, 0.5, 20.0); effVal = this.phys.cfg().govKp; this.log('CMD', 0, `Đặt hệ số điều tốc Kp = ${fmt2(this.phys.cfg().govKp)}`); }
      } else if (n === 'GOVKI') {
        if (value !== null) { this.phys.cfg().govKi = coerceIn(value, 0.05, 10.0); effVal = this.phys.cfg().govKi; this.log('CMD', 0, `Đặt hệ số tích phân điều tốc Ki = ${fmt2(this.phys.cfg().govKi)}`); }
      } else if (n === 'GOVKD') {
        if (value !== null) { this.phys.cfg().govKd = coerceIn(value, 0.0, 5.0); effVal = this.phys.cfg().govKd; this.log('CMD', 0, `Đặt hệ số vi phân điều tốc Kd = ${fmt2(this.phys.cfg().govKd)}`); }
      } else if (n === 'GOVBP' || n === 'ISLANDDROOP') {
        if (value !== null) {
          const bp = coerceIn(value, 0.0, 0.01);
          this.phys.cfg().govBp = bp; this.phys.cfg().islandDroop = bp; effVal = bp;
          this.log('CMD', 0, `Đặt độ dốc tĩnh điều tốc bp = ${fmt2(bp * 100)}%`);
        }
      } else if (n === 'GVOPENRATE') {
        if (value !== null) { this.phys.cfg().gvOpenRate = coerceIn(value, 0.02, 0.30); effVal = this.phys.cfg().gvOpenRate; this.log('CMD', 0, `Đặt tốc độ mở cánh hướng = ${fmt3(this.phys.cfg().gvOpenRate)} pu/s`); }
      } else if (n === 'GVCLOSERATE') {
        if (value !== null) { this.phys.cfg().gvCloseRate = coerceIn(value, 0.05, 0.30); effVal = this.phys.cfg().gvCloseRate; this.log('CMD', 0, `Đặt tốc độ đóng cánh hướng = ${fmt3(this.phys.cfg().gvCloseRate)} pu/s`); }
      } else if (n === 'PRAMP') {
        if (value !== null) { this.phys.cfg().pRampMWs = coerceIn(value, 0.1, 3.0); effVal = this.phys.cfg().pRampMWs; this.log('CMD', 0, `Đặt tốc độ nhận/giảm tải = ${fmt2(this.phys.cfg().pRampMWs)} MW/s`); }
      } else if (n === 'POWERKP') {
        if (value !== null) { this.phys.cfg().powerKp = coerceIn(value, 0.0, 2.0); effVal = this.phys.cfg().powerKp; this.log('CMD', 0, `Đặt Điều chỉnh P – Kp = ${fmt3(this.phys.cfg().powerKp)}`); }
      } else if (n === 'POWERKI') {
        if (value !== null) { this.phys.cfg().powerKi = coerceIn(value, 0.0, 2.0); effVal = this.phys.cfg().powerKi; this.log('CMD', 0, `Đặt Điều chỉnh P – Ki = ${fmt3(this.phys.cfg().powerKi)}`); }
      } else if (n === 'GOVRESETCFG') {
        const c = this.phys.cfg();
        c.govKp = 1.6; c.govKi = 0.27; c.govKd = 0.0; c.govBp = 0.01; c.islandDroop = 0.01;
        c.powerKp = 0.05; c.powerKi = 0.05;
        c.gvOpenRate = 0.10; c.gvCloseRate = 0.125; c.gvEmergencyRate = 0.25; c.pRampMWs = 0.8;
        effVal = 1.0;
        this.log('CMD', 0, "Khôi phục tham số điều tốc chuẩn Đrây H'Linh 2 (Kp=1,60; Ki=0,27; Kd=0,00; bp=1,00%; P-Kp=0,05; P-Ki=0,05)");
        this.event('msg', "Đã khôi phục thông số điều tốc chuẩn Đrây H'Linh 2");
      } else if (n === 'AXT1') {
        const nv = tog(this.axt1); this.axt1 = nv; if (this.on(this.axt1)) this.axt2 = 0.0; effVal = nv;
      } else if (n === 'AXT2') {
        const nv = tog(this.axt2); this.axt2 = nv; if (this.on(this.axt2)) this.axt1 = 0.0; effVal = nv;
      } else if (n === 'STANDBYINPUT400') {
        const nv = tog(this.standbyInput400); this.standbyInput400 = nv; effVal = nv;
      } else if (n.startsWith('AUXMCB')) {
        const i = Number.parseInt(n.slice(6), 10);
        if (i >= 1 && i <= 5) { const nv = tog(this.auxMcb[i - 1]); this.auxMcb[i - 1] = nv; effVal = nv; }
      } else if (n.startsWith('IS') || n.startsWith('GS')) {
        const getCur = (): number => {
          switch (n) {
            case 'IS371_7': return this.is371_7; case 'IS371_1': return this.is371_1;
            case 'IS372_7': return this.is372_7; case 'IS372_2': return this.is372_2;
            case 'IS312_1': return this.is312_1;
            case 'IS331_1': return this.g1.is33; case 'IS332_2': return this.g2.is33;
            case 'GS371_76': return this.gs371_76; case 'GS371_75': return this.gs371_75; case 'GS371_15': return this.gs371_15;
            case 'GS372_76': return this.gs372_76; case 'GS372_75': return this.gs372_75; case 'GS372_25': return this.gs372_25;
            case 'GS331_14': return this.g1.gs14; case 'GS331_15': return this.g1.gs15;
            case 'GS332_24': return this.g2.gs14; case 'GS332_25': return this.g2.gs15;
            case 'GS1QE': return this.g1.gsQE; case 'GS1QE1': return this.g1.gsQE1;
            case 'GS2QE': return this.g2.gsQE; case 'GS2QE1': return this.g2.gsQE1;
            default: return 0.0;
          }
        };
        const nv = tog(getCur());
        effVal = nv;
        const why = this.phys.interlock(n, this.on(nv));
        if (why) { this.blocked(n, why); return; }
        switch (n) {
          case 'IS371_7': this.is371_7 = nv; break; case 'IS371_1': this.is371_1 = nv; break;
          case 'IS372_7': this.is372_7 = nv; break; case 'IS372_2': this.is372_2 = nv; break;
          case 'IS312_1': this.is312_1 = nv; break;
          case 'IS331_1': this.g1.is33 = nv; break; case 'IS332_2': this.g2.is33 = nv; break;
          case 'GS371_76': this.gs371_76 = nv; break; case 'GS371_75': this.gs371_75 = nv; break; case 'GS371_15': this.gs371_15 = nv; break;
          case 'GS372_76': this.gs372_76 = nv; break; case 'GS372_75': this.gs372_75 = nv; break; case 'GS372_25': this.gs372_25 = nv; break;
          case 'GS331_14': this.g1.gs14 = nv; break; case 'GS331_15': this.g1.gs15 = nv; break;
          case 'GS332_24': this.g2.gs14 = nv; break; case 'GS332_25': this.g2.gs15 = nv; break;
          case 'GS1QE': this.g1.gsQE = nv; break; case 'GS1QE1': this.g1.gsQE1 = nv; break;
          case 'GS2QE': this.g2.gsQE = nv; break; case 'GS2QE1': this.g2.gsQE1 = nv; break;
        }
      } else if (n.startsWith('GEN') || n.startsWith('G1.') || n.startsWith('G2.')) {
        const g = n.startsWith('GEN2') || n.startsWith('G2.') ? this.g2 : this.g1;
        const dot = n.indexOf('.');
        const f = dot >= 0 ? n.slice(dot + 1) : '';
        this.genSet(g, f, value);
        switch (f) {
          case 'AIRBRAKE': effVal = g.airBrake; break;
          case 'SERVOLOCK':
          case 'GVLOCKPIN': effVal = g.servoLock; break;
          case 'FIELDDISCHARGE': effVal = g.fieldDischarge; break;
          case 'AUXAUTO': effVal = g.auxAuto; break;
          case 'GOVAUTO': effVal = g.govAuto; break;
          case 'BLADEAUTO': effVal = g.bladeAuto; break;
          case 'AUTOSYNC': effVal = this.b(g.autoSync); break;
          case 'HEATER': effVal = g.heater; break;
          case 'MAINTSEAL': effVal = g.maintSeal; break;
          case 'WATERPUMP1': effVal = g.waterPump1; break;
          case 'WATERPUMP2': effVal = g.waterPump2; break;
          case 'CWVALVE': effVal = g.cwValve; break;
          case 'HC1': effVal = g.hc1; break;
          case 'HC2': effVal = g.hc2; break;
          case 'OILPUMP1': effVal = g.oilPump1; break;
          case 'OILPUMP2': effVal = g.oilPump2; break;
          default: effVal = value; break;
        }
      } else {
        handled = false;
      }
      if (handled) {
        const txt = `${source} ${name}` + (effVal !== null ? ` = ${r3(effVal)}` : '');
        this.cmdEvent(name, effVal, source, txt, clientId, source !== 'Web', pre);
      }
    });
  }

  private manualSync(g: Gen): void {
    const zoneV = g.no === 1 ? this.vbusZone1 : this.vbusZone2;
    const busF = g.no === 1 ? this.freqZone1 : this.freqZone2;
    const busV = (zoneV * this.phys.cfg().genKV) / 38.5;
    if (!(g.generating === 1.0 && this.on(g.cb60) && this.on(g.is33) && !this.on(g.cb33) && zoneV > 32)) {
      this.event('msg', `MF${g.no}: chưa đủ điều kiện hoà (phải đang PHÁT ĐIỆN, MC 60${g.no} đóng, dao 33${g.no} đóng, thanh cái có điện)`);
      return;
    }
    const df = g.freq - busF;
    const dv = busV > 0 ? ((g.vgen - busV) / busV) * 100 : 100.0;
    const ph = g.phase;
    const info = `Δf = ${fmt2(df)} Hz, ΔU = ${fmt1(dv)} %, Δφ = ${fmt0(ph)}°`;
    const cbName = g.no === 1 ? '331' : '332';
    const why = this.phys.interlock(`CB${cbName}`, true);
    if (why) { this.blocked(`CB${cbName}`, why); return; }
    // đóng máy cắt thật: dòng xung kích theo góc lệch pha do mô hình lưới tính, bảo vệ quyết định hậu quả
    g.cb33 = 1.0; g.auto = 0.0;
    const pc = this.phys.cfg();
    if (Math.abs(df) <= pc.syncMaxDfHz && Math.abs(dv) <= pc.syncMaxDvPct && Math.abs(ph) <= pc.syncMaxPhaseDeg) {
      this.log('CMD', g.no, `Hoà tay MF${g.no} THÀNH CÔNG: ${info}`);
      this.event('msg', `MF${g.no} hoà đồng bộ thành công (${info})`);
    } else {
      const m = `Hoà tay MF${g.no} sai điều kiện (${info}; ngưỡng Δf≤${fmt2(pc.syncMaxDfHz)} Hz, ΔU≤${fmt1(pc.syncMaxDvPct)}%, Δφ≤${fmt0(pc.syncMaxPhaseDeg)}°) – đóng MC ${cbName} khi chưa đồng bộ`;
      this.log('ERR', g.no, m); this.event('msg', m); this.incident(m);
      this.syncTicks[g.no - 1] = 10; this.syncPeak[g.no - 1] = 0.0;
    }
  }

  /** Đo dòng xung kích 1 s sau khi hoà tay sai, ghi số đo thật vào mô tả sự cố */
  private syncWatch(): void {
    for (const g of this.gens) {
      const k = g.no - 1;
      if (this.syncTicks[k] <= 0) continue;
      this.syncPeak[k] = Math.max(this.syncPeak[k], g.ia);
      if (--this.syncTicks[k] === 0) {
        const m = `MF${g.no}: dòng xung kích khi hoà sai đạt ${fmt0(this.syncPeak[k])} A (${fmt1(this.syncPeak[k] / Math.max(this.phys.cfg().genA, 10.0))} lần định mức)`;
        this.log('ERR', g.no, m); this.event('msg', m); this.incident(m);
      }
    }
  }

  private genSet(g: Gen, f: string, value: number | null): void {
    const tog = (cur: number) => (value !== null ? value : this.on(cur) ? 0.0 : 1.0);
    switch (f) {
      case 'MODE': {
        if (value === null) return;
        const m = value;
        if (m === 0.0) { this.seqOf(g).normalStop(); return; }
        if (g.tripped) { this.event('msg', `MF${g.no}: bảo vệ đã cắt máy (${g.tripReason}) – giải trừ trước khi khởi động`); return; }
        if (m === 1.0) g.auto = 1.0;
        this.seqOf(g).start(Math.trunc(m));
        break;
      }
      case 'P': if (value !== null) g.p = coerceIn(value, 0.0, 8.5); break;
      case 'Q': if (value !== null) g.q = coerceIn(value, -3.0, 6.0); break;
      case 'HEATER': g.heater = tog(g.heater); break;
      case 'MAINTSEAL': g.maintSeal = tog(g.maintSeal); break;
      case 'REMOTE':
        g.remote = tog(g.remote);
        this.log('CMD', g.no, `LCU${g.no} chuyển ${this.on(g.remote) ? 'LOCAL' : 'REMOTE'}`);
        break;
      case 'AUXAUTO': {
        g.auxAuto = tog(g.auxAuto);
        const modeTxt = this.on(g.auxAuto) ? 'TỰ ĐỘNG (AUTO)' : 'BẰNG TAY (MANUAL)';
        this.log('CMD', g.no, `Phụ trợ MF${g.no} chuyển sang chế độ ${modeTxt}`);
        this.event('msg', `Phụ trợ MF${g.no}: ${modeTxt}`);
        break;
      }
      case 'WATERPUMP1':
      case 'WATERPUMP2':
      case 'CWVALVE':
      case 'HC1':
      case 'HC2':
      case 'OILPUMP1':
      case 'OILPUMP2':
      case 'AIRCOMP1':
      case 'AIRCOMP2': {
        if (this.on(g.auxAuto)) {
          this.event('msg', `Phụ trợ MF${g.no} đang ở TỰ ĐỘNG (AUTO) – hãy chuyển sang BẰNG TAY (MANUAL) để thao tác bơm/van!`);
          return;
        }
        const curMap: Record<string, number> = {
          WATERPUMP1: g.waterPump1, WATERPUMP2: g.waterPump2, CWVALVE: g.cwValve,
          HC1: g.hc1, HC2: g.hc2, OILPUMP1: g.oilPump1, OILPUMP2: g.oilPump2,
          AIRCOMP1: g.airComp1, AIRCOMP2: g.airComp2,
        };
        const nextVal = tog(curMap[f] ?? 0.0);
        if ((this.on(nextVal) || f === 'CWVALVE') && this.v400 <= 0.3) {
          this.event('msg', `MF${g.no}: mất nguồn tự dùng 0,4 kV (V400 ≤ 300 V) – không thể thao tác bơm/van điện!`);
          return;
        }
        if (f === 'WATERPUMP1') g.waterPump1 = nextVal;
        else if (f === 'WATERPUMP2') g.waterPump2 = nextVal;
        else if (f === 'CWVALVE') g.cwValve = nextVal;
        else if (f === 'HC1') g.hc1 = nextVal;
        else if (f === 'HC2') g.hc2 = nextVal;
        else if (f === 'OILPUMP1') g.oilPump1 = nextVal;
        else if (f === 'OILPUMP2') g.oilPump2 = nextVal;
        else if (f === 'AIRCOMP1') g.airComp1 = nextVal;
        else if (f === 'AIRCOMP2') g.airComp2 = nextVal;
        break;
      }
      case 'FIELDDISCHARGE': g.fieldDischarge = tog(g.fieldDischarge); break;
      case 'AIRBRAKE': g.airBrake = tog(g.airBrake); break;
      case 'SERVOLOCK':
      case 'GVLOCKPIN': {
        const nextLock = tog(g.servoLock);
        if (this.on(nextLock) && g.guideValve > 1.5) {
          this.event('msg', `MF${g.no}: chỉ được ĐÓNG chốt khóa khi cánh hướng đã đóng về 0% (GV hiện tại = ${fmt1(g.guideValve)}% — Điều 25 Bước 6)!`);
          return;
        }
        g.servoLock = nextLock;
        if (this.on(g.servoLock)) g.gvManual = 0.0;
        this.log('CMD', g.no, `MF${g.no}: ${this.on(g.servoLock) ? 'ĐÓNG chốt khóa cánh hướng (Điều 25 Bước 6)' : 'MỞ chốt khóa cánh hướng (Điều 21 Bước 3)'}`);
        this.event('msg', `MF${g.no}: ${this.on(g.servoLock) ? 'Đã ĐÓNG chốt khóa cánh hướng (khóa cứng 0%)' : 'Đã MỞ chốt khóa cánh hướng – sẵn sàng mở cánh hướng'}`);
        break;
      }
      case 'GOVAUTO': {
        const nextAuto = tog(g.govAuto);
        const u = this.phys.plant.units[g.no - 1];
        g.govAuto = nextAuto;
        if (!this.on(nextAuto)) {
          g.gvManual = g.guideValve;
          g.bladeManual = u.bladeAngleDeg;
        } else {
          g.bladeAuto = 1.0;
        }
        this.log('CMD', g.no, `Điều tốc MF${g.no} chuyển sang ${this.on(nextAuto) ? 'TỰ ĐỘNG (AUTO PID + ON-CAM)' : 'BẰNG TAY (MANUAL – Điều 23)'}`);
        this.event('msg', `Điều tốc MF${g.no}: ${this.on(nextAuto) ? 'TỰ ĐỘNG (AUTO)' : `BẰNG TAY (MANUAL – GV ${fmt1(u.gv * 100)}%)`}`);
        break;
      }
      case 'BLADEAUTO': {
        const nextAuto = tog(g.bladeAuto);
        const u = this.phys.plant.units[g.no - 1];
        g.bladeAuto = nextAuto;
        if (!this.on(nextAuto)) g.bladeManual = u.bladeAngleDeg;
        this.log('CMD', g.no, `Phối hợp Cam BXCT MF${g.no} chuyển sang ${this.on(nextAuto) ? 'TỰ ĐỘNG (ON-CAM)' : 'BẰNG TAY (OFF-CAM)'}`);
        this.event('msg', `Cánh BXCT MF${g.no}: ${this.on(nextAuto) ? 'TỰ ĐỘNG THEO ĐƯỜNG CAM' : `CHỈNH TAY (${fmt1(u.bladeAngleDeg)}°)`}`);
        break;
      }
      case 'GVMAN':
        if (value !== null) {
          if (this.on(g.govAuto)) {
            this.event('msg', `Điều tốc MF${g.no} đang ở TỰ ĐỘNG (AUTO) – chuyển sang BẰNG TAY (MANUAL) để chỉnh cánh hướng!`);
            return;
          }
          if (this.on(g.servoLock) && value > 0.5) {
            this.event('msg', `MF${g.no}: Chốt khóa cánh hướng ĐANG ĐÓNG (Điều 21 Bước 3) – hãy MỞ chốt khóa trước khi mở cánh hướng!`);
            return;
          }
          g.gvManual = coerceIn(value, 0.0, g.gvLimit);
        }
        break;
      case 'GVSTEP':
        if (value !== null) {
          if (this.on(g.govAuto)) {
            this.event('msg', `Điều tốc MF${g.no} đang ở TỰ ĐỘNG (AUTO) – chuyển sang BẰNG TAY (MANUAL) để nhấn INC/DEC!`);
            return;
          }
          if (this.on(g.servoLock) && value > 0.0) {
            this.event('msg', `MF${g.no}: Chốt khóa cánh hướng ĐANG ĐÓNG (Điều 21 Bước 3) – hãy MỞ chốt khóa trước khi tăng độ mở cánh hướng!`);
            return;
          }
          g.gvManual = coerceIn(g.gvManual + value, 0.0, g.gvLimit);
        }
        break;
      case 'BLADEMAN':
        if (value !== null) {
          if (this.on(g.govAuto) && this.on(g.bladeAuto)) {
            this.event('msg', `Điều tốc MF${g.no} đang ở TỰ ĐỘNG (AUTO) – chuyển sang BẰNG TAY (MANUAL) để chỉnh góc cánh BXCT!`);
            return;
          }
          if (this.on(g.bladeAuto)) g.bladeAuto = 0.0;
          g.bladeManual = coerceIn(value, -10.0, 12.0);
        }
        break;
      case 'BLADESTEP':
        if (value !== null) {
          if (this.on(g.govAuto) && this.on(g.bladeAuto)) {
            this.event('msg', `Điều tốc MF${g.no} đang ở TỰ ĐỘNG (AUTO) – chuyển sang BẰNG TAY (MANUAL) để nhấn INC/DEC cánh BXCT!`);
            return;
          }
          const u = this.phys.plant.units[g.no - 1];
          if (this.on(g.bladeAuto)) { g.bladeAuto = 0.0; g.bladeManual = u.bladeAngleDeg; }
          const deltaDeg = value * 0.22; // 100% <-> 22° (-10° .. +12°)
          g.bladeManual = coerceIn(g.bladeManual + deltaDeg, -10.0, 12.0);
        }
        break;
      case 'GVLIMIT':
        if (value !== null) {
          g.gvLimit = coerceIn(value, 0.0, 100.0);
          if (!this.on(g.govAuto) && g.gvManual > g.gvLimit) g.gvManual = g.gvLimit;
          this.log('CMD', g.no, `MF${g.no}: đặt hạn chế độ mở cánh hướng = ${fmt0(g.gvLimit)}%`);
        }
        break;
      case 'EMSTOP':
        g.govAuto = 1.0; g.bladeAuto = 1.0; g.gvManual = 0.0;
        this.seqOf(g).emergency(1, 'Dừng sự cố khẩn cấp tại tủ điều tốc (Điều 29)');
        this.event('msg', `MF${g.no}: KÍCH HOẠT EMERGENCY STOP – đóng nhanh cánh hướng 0,25/s và cắt tổ máy (Điều 29)!`);
        break;
      case 'GOVERNOR':
        if (this.seqOf(g).state === 'IDLE') this.seqOf(g).start(2);
        else this.seqOf(g).normalStop();
        break;
      case 'LEAKRESET': {
        const u = this.phys.plant.units[g.no - 1];
        if (value === null || this.on(value)) {
          if (this.phys.plant.auxV <= 0.85) {
            u.hcForceDrain = false; g.leakReset = 0.0;
            this.log('ALM', g.no, `Không thể xả nước rò nắp tuabin MF${g.no}: mất nguồn tự dùng 0,4 kV`);
            this.event('msg', `MF${g.no}: Mất nguồn tự dùng 0,4 kV – không thể xả nước rò nắp tuabin!`);
          } else {
            u.hcForceDrain = true; u.hcPump[0] = true; u.hcPump[1] = true;
            g.hc1 = 1.0; g.hc2 = 1.0; g.leakReset = 1.0;
            this.log('CMD', g.no, `Chạy cưỡng bức 2 bơm xả nước rò nắp tuabin MF${g.no} (mực hiện tại ${fmt0(u.headCoverMM)} mm)`);
            this.event('msg', `MF${g.no}: Đang chạy cưỡng bức 2 bơm xả nước rò nắp tuabin (${fmt0(u.headCoverMM)} mm)`);
          }
        } else {
          u.hcForceDrain = false; g.leakReset = 0.0;
        }
        break;
      }
      case 'AUTOSYNC': g.autoSync = value !== null ? this.on(value) : !g.autoSync; break;
      case 'SPTRIM': if (value !== null) g.spTrim = coerceIn(value, -2.0, 2.0); break;
      case 'VTRIM': if (value !== null) g.vTrim = coerceIn(value, -15.0, 15.0); break;
      case 'RESET': this.resetProtection(g); break;
      case 'SYNCCLOSE': this.manualSync(g); break;
      case 'FAULT': g.fault = tog(g.fault); break;
      case 'STATORFAULT': g.statorFault = value !== null ? this.on(value) : !g.statorFault; break;
      case 'BEARINGFAULT': g.bearingFault = value !== null ? this.on(value) : !g.bearingFault; break;
    }
  }

  // =====================================================================
  // Ảnh chụp trạng thái cho HMI (đúng cấu trúc JSON WebServer.kt)
  // =====================================================================
  buildSnapshot(): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    const p = (k: string, v: number) => { o[k] = r3(v); };
    p('sim', this.simulationMode);
    p('CB371', this.cb371); p('CB372', this.cb372); p('CB331', this.g1.cb33); p('CB332', this.g2.cb33);
    p('CB601', this.g1.cb60); p('CB602', this.g2.cb60);
    p('IS371_7', this.is371_7); p('IS371_1', this.is371_1); p('IS372_7', this.is372_7); p('IS372_2', this.is372_2);
    p('IS312_1', this.is312_1);
    p('IS331_1', this.g1.is33); p('IS332_2', this.g2.is33);
    p('GS371_76', this.gs371_76); p('GS371_75', this.gs371_75); p('GS371_15', this.gs371_15);
    p('GS372_76', this.gs372_76); p('GS372_75', this.gs372_75); p('GS372_25', this.gs372_25);
    p('GS331_14', this.g1.gs14); p('GS331_15', this.g1.gs15); p('GS332_24', this.g2.gs14); p('GS332_25', this.g2.gs15);
    p('GS1QE', this.g1.gsQE); p('GS1QE1', this.g1.gsQE1); p('GS2QE', this.g2.gsQE); p('GS2QE1', this.g2.gsQE1);
    p('IS612_1', this.is612_1); p('IS612_2', this.is612_2); p('AXT1', this.axt1); p('AXT2', this.axt2);
    for (let i = 0; i <= 4; i++) p(`AUXMCB${i + 1}`, this.auxMcb[i]);
    p('StandbyInput400', this.standbyInput400);
    p('V371', this.v371); p('V372', this.v372); p('P371', this.p371); p('P372', this.p372);
    p('Q371', this.q371); p('Q372', this.q372);
    p('I371', this.i371); p('I372', this.i372); p('FreqZone1', this.freqZone1); p('FreqZone2', this.freqZone2);
    p('VbusZone1', this.vbusZone1); p('VbusZone2', this.vbusZone2);
    p('Vaux6', this.vaux6); p('V400', this.v400); p('V400Zone1', this.v400Zone1); p('V400Zone2', this.v400Zone2);
    p('A371', this.a371); p('A372', this.a372);
    for (const m of this.meters.meters) {
      this.meters.REG.forEach((r, i) => p(`E.${m.id}.${r}`, m.r[i]));
    }
    p('IntakeGate', this.intakeGate); p('HeadHigh', this.headHigh);
    o.incident = this.incidentText; o.incidentLast = this.incidentLast; p('incidentLevel', this.incidentLevel);
    for (const g of this.gens) {
      const k = `G${g.no}.`;
      p(`${k}mode`, g.generating); p(`${k}remote`, g.remote);
      p('pubRemote', this.remotePub);
      p(`${k}P`, g.p); p(`${k}Q`, g.q); p(`${k}Pload`, g.pload / 100); p(`${k}Qload`, g.qload / 100);
      p(`${k}Vgen`, g.vgen); p(`${k}V60`, g.v60); p(`${k}F60`, g.f60);
      p(`${k}Ia`, g.ia); p(`${k}Ib`, g.ib); p(`${k}Ic`, g.ic);
      p(`${k}Iexc`, g.iexc); p(`${k}Vexc`, g.vexc); p(`${k}freq`, g.freq); p(`${k}speed`, g.speed);
      const uu = this.phys.plant.units[g.no - 1];
      p(`${k}GV`, g.guideValve); p(`${k}SP`, g.speedSetting); p(`${k}pid`, this.b(uu.govMode !== GovMode.OFF)); p(`${k}running`, g.running);
      p(`${k}fieldDischarge`, g.fieldDischarge); p(`${k}airBrake`, g.airBrake);
      p(`${k}servoLock`, g.servoLock); p(`${k}gvLockPin`, g.servoLock);
      p(`${k}auxAuto`, g.auxAuto);
      p(`${k}waterPump1`, g.waterPump1); p(`${k}waterPump2`, g.waterPump2); p(`${k}cwValve`, g.cwValve);
      p(`${k}cwTemp`, g.cwTemp); p(`${k}cwPress`, g.cwPress); p(`${k}cwPreMPa`, g.cwPreMPa); p(`${k}cwLevel`, g.cwLevel);
      p(`${k}hc1`, g.hc1); p(`${k}hc2`, g.hc2); p(`${k}leakage`, g.leakage); p(`${k}leakReset`, g.leakReset);
      p(`${k}oilPump1`, g.oilPump1); p(`${k}oilPump2`, g.oilPump2); p(`${k}oilPress`, g.oilPress); p(`${k}oilLevel`, g.oilLevel);
      p(`${k}airComp1`, g.airComp1); p(`${k}airComp2`, g.airComp2); p(`${k}airPress`, g.airPress);
      p(`${k}upper`, avg(g.upper)); p(`${k}lower`, avg(g.lower)); p(`${k}thrust`, avg(g.thrust));
      p(`${k}stator`, avg(g.stator)); p(`${k}statorMax`, Math.max(...g.stator));
      p(`${k}fault`, g.fault); p(`${k}schedule`, g.schedule);
      p(`${k}autoSync`, this.b(g.autoSync)); p(`${k}spTrim`, g.spTrim); p(`${k}vTrim`, g.vTrim); p(`${k}phase`, g.phase);
      p(`${k}busF`, g.no === 1 ? this.freqZone1 : this.freqZone2);
      p(`${k}busV`, ((g.no === 1 ? this.vbusZone1 : this.vbusZone2) * this.phys.cfg().genKV) / 38.5);
      p(`${k}tripped`, this.b(g.tripped)); o[`${k}tripReason`] = g.tripReason;
      p(`${k}grid`, this.b(this.parallel(g)));
      o[`${k}seq`] = this.phys.seq[g.no - 1].stepText;
      o[`${k}seqState`] = this.phys.seq[g.no - 1].state;
      o[`${k}gov`] = uu.govMode;
      p(`${k}blade`, g.blade); p(`${k}flow`, g.flow); p(`${k}head`, g.head);
      p(`${k}oilMPa`, g.oilMPa); p(`${k}cwMPa`, g.cwMPa); p(`${k}cwFlow`, uu.cwFlow);
      p(`${k}govAuto`, g.govAuto); p(`${k}bladeAuto`, g.bladeAuto); p(`${k}gvLimit`, g.gvLimit);
      p(`${k}gvManual`, g.gvManual); p(`${k}bladeManual`, g.bladeManual);
      p(`${k}bladeDeg`, uu.bladeAngleDeg); p(`${k}bladeCamDeg`, uu.bladeCamDeg); p(`${k}bladeDevDeg`, uu.bladeDevDeg);
      p(`${k}offCamEff`, uu.offCamEffPct); p(`${k}shaftVib`, uu.shaftVibMm); p(`${k}overspeedPct`, uu.omega * 100.0);
      p(`${k}headCover`, g.headCoverMM); p(`${k}coldAir`, g.coldAir[0]); p(`${k}hotAir`, g.hotAir[0]); p(`${k}core`, avg(g.core));
      p(`${k}thrustOil`, g.thrustOil); p(`${k}turbPad`, g.turbPad); p(`${k}trOil`, g.trOil); p(`${k}trWinding`, g.trWinding);
      p(`${k}Pm`, uu.pmMW); p(`${k}efd`, uu.efd); p(`${k}Pset`, uu.prefMW); p(`${k}Qset`, uu.qrefMVAr);
      p(`${k}i2`, uu.i2 * this.phys.cfg().genA);
      o[`${k}startConds`] = this.phys.seq[g.no - 1].startConds();
      p(`${k}heater`, g.heater); p(`${k}maintSeal`, g.maintSeal); p(`${k}mk`, g.fieldDischarge);
      p(`${k}lossCu`, uu.lossStatorKW); p(`${k}lossFe`, uu.lossCoreKW); p(`${k}lossRotor`, uu.lossRotorKW);
      o[`${k}relays`] = this.phys.plant.genProt[g.no - 1].all.filter((r) => r.operated).map((r) => `${r.code} ${r.name}`);
    }
    const pl = this.phys.plant;
    const pc = this.phys.cfg();
    p('zUp', pl.zUp); p('zTail', pl.zTail); p('qSpill', pl.qSpill); p('inflowM3s', pl.inflowM3s);
    p('sump', pl.sumpLevel); p('drain', pl.drainLevel); p('oilLeak', pl.oilLeakLevel);
    p('lpAir', pl.lpAirMPa); p('hpAir', pl.hpAirMPa);
    p('dgEngine', this.b(this.phys.dgEngine)); p('dgCb', this.b(this.phys.dgCb)); p('dgAuto', this.b(this.phys.dgAuto));
    p('dgKW', pl.dgKW); p('dgKVAr', pl.dgKVAr);
    p('auxKW', pl.auxLoadKW); p('gridOk', this.b(pl.gridAvailable));
    p('tbaKV', pl.vkv[Plant.TBA]); p('tbaHz', pl.fHz[Plant.TBA]);
    p('tbaLoad', pc.tbaLoadMW); p('tbaLoadQ', pc.tbaLoadMVAr); p('thermalSpeed', pc.thermalSpeed);
    p('cfg.govKp', pc.govKp); p('cfg.govKi', pc.govKi); p('cfg.govKd', pc.govKd);
    p('cfg.govBp', pc.govBp); p('cfg.islandDroop', pc.govBp);
    p('cfg.powerKp', pc.powerKp); p('cfg.powerKi', pc.powerKi);
    p('cfg.gvOpenRate', pc.gvOpenRate); p('cfg.gvCloseRate', pc.gvCloseRate); p('cfg.gvEmergencyRate', pc.gvEmergencyRate);
    p('cfg.inertiaH', pc.inertiaH); p('cfg.pRampMWs', pc.pRampMWs); p('cfg.gvMax', pc.gvMax); p('cfg.ratedHeadM', pc.ratedHeadM);
    p('cfg.syncMaxDfHz', pc.syncMaxDfHz); p('cfg.syncMaxDvPct', pc.syncMaxDvPct); p('cfg.syncMaxPhaseDeg', pc.syncMaxPhaseDeg);
    o.cfgRev = this.cfgRevProvider();
    o.interlock = pc.interlock;
    o.lineRelays = [...pl.lineProt, ...pl.tbaProt].flatMap((lp) => lp.all.filter((r) => r.operated).map((r) => `${r.code} ${r.name}`));
    o.scFaults = pl.faults.map((f) => `${f.type} tại ${pl.nodeName(f.node)}`);
    p('V6_1', pl.vkv[Plant.B61]); p('V6_2', pl.vkv[Plant.B62]);
    p('inflow', this.inflow); p('auxLost', this.b(this.auxLost));
    o.faults = Array.from(this.activeFaults);
    o.pending = {};
    for (const [k, v] of Object.entries(this.pubDev)) p(`PUB.${k}`, this.b(v));
    o.ts = Date.now();
    return o;
  }

  cmdName(u: number, fn: number): string {
    for (const [name, val] of Object.entries(Cmd)) {
      if (!name.startsWith('R_') && val === fn && (u === HpsSim.PUB) === PUB_CMD_NAMES.has(name)) {
        return name;
      }
    }
    return `0x${fn.toString(16).toUpperCase().padStart(4, '0')}`;
  }

  /** Xuất toàn bộ trạng thái nhà máy để lưu vào localStorage */
  exportState(): Record<string, unknown> {
    return {
      v: 1,
      simClockMs: this.simClockMs,
      tick: this.tick,
      g1: this.g1.exportState(),
      g2: this.g2.exportState(),
      phys: this.phys.exportState(),
      meters: this.meters.toJson(),
      remotePub: this.remotePub,
      cb371: this.cb371, cb372: this.cb372,
      gs371_76: this.gs371_76, is371_7: this.is371_7, gs371_75: this.gs371_75, gs371_15: this.gs371_15, is371_1: this.is371_1,
      gs372_76: this.gs372_76, is372_7: this.is372_7, gs372_75: this.gs372_75, gs372_25: this.gs372_25, is372_2: this.is372_2,
      is312_1: this.is312_1, istd35: this.istd35, remoteNt: this.remoteNt,
      axt1: this.axt1, axt2: this.axt2, is612_1: this.is612_1, is612_2: this.is612_2,
      auxMcb: [...this.auxMcb], standbyInput400: this.standbyInput400,
      headHigh: this.headHigh, inflow: this.inflow, intakeGate: this.intakeGate,
      pubDev: { ...this.pubDev },
      activeFaults: Array.from(this.activeFaults),
      forcedTripUnits: Array.from(this.forcedTripUnits),
      auxLost: this.auxLost,
      incidentText: this.incidentText, incidentLast: this.incidentLast,
      incidentLevel: this.incidentLevel, incidentTs: this.incidentTs,
      a371: this.a371, a372: this.a372,
    };
  }

  importState(d: Record<string, unknown> | null | undefined): boolean {
    if (!d || typeof d !== 'object') return false;
    this.timers.length = 0;
    this.last.clear();
    const num = (k: string, cur: number) => (typeof d[k] === 'number' && Number.isFinite(d[k] as number) ? (d[k] as number) : cur);
    this.simClockMs = num('simClockMs', this.simClockMs);
    this.tick = num('tick', this.tick);
    this.g1.importState(d.g1 as Record<string, unknown>);
    this.g2.importState(d.g2 as Record<string, unknown>);
    this.remotePub = num('remotePub', this.remotePub);
    this.cb371 = num('cb371', this.cb371); this.cb372 = num('cb372', this.cb372);
    this.gs371_76 = num('gs371_76', this.gs371_76); this.is371_7 = num('is371_7', this.is371_7);
    this.gs371_75 = num('gs371_75', this.gs371_75); this.gs371_15 = num('gs371_15', this.gs371_15);
    this.is371_1 = num('is371_1', this.is371_1);
    this.gs372_76 = num('gs372_76', this.gs372_76); this.is372_7 = num('is372_7', this.is372_7);
    this.gs372_75 = num('gs372_75', this.gs372_75); this.gs372_25 = num('gs372_25', this.gs372_25);
    this.is372_2 = num('is372_2', this.is372_2);
    this.is312_1 = num('is312_1', this.is312_1); this.istd35 = num('istd35', this.istd35);
    this.remoteNt = num('remoteNt', this.remoteNt);
    this.axt1 = num('axt1', this.axt1); this.axt2 = num('axt2', this.axt2);
    this.is612_1 = num('is612_1', this.is612_1); this.is612_2 = num('is612_2', this.is612_2);
    if (Array.isArray(d.auxMcb)) {
      for (let i = 0; i < Math.min(5, d.auxMcb.length); i++) this.auxMcb[i] = Number(d.auxMcb[i]) || 0;
    }
    this.standbyInput400 = num('standbyInput400', this.standbyInput400);
    this.headHigh = num('headHigh', this.headHigh);
    this.inflow = num('inflow', this.inflow);
    this.intakeGate = num('intakeGate', this.intakeGate);
    if (d.pubDev && typeof d.pubDev === 'object') {
      this.pubDev = { ...(d.pubDev as Record<string, boolean>) };
    }
    this.activeFaults.clear();
    if (Array.isArray(d.activeFaults)) for (const x of d.activeFaults) this.activeFaults.add(String(x));
    this.forcedTripUnits.clear();
    if (Array.isArray(d.forcedTripUnits)) for (const x of d.forcedTripUnits) this.forcedTripUnits.add(Number(x));
    this.auxLost = !!d.auxLost;
    if (typeof d.incidentText === 'string') this.incidentText = d.incidentText;
    if (typeof d.incidentLast === 'string') this.incidentLast = d.incidentLast;
    this.incidentLevel = num('incidentLevel', this.incidentLevel);
    this.incidentTs = num('incidentTs', this.incidentTs);
    this.a371 = num('a371', this.a371); this.a372 = num('a372', this.a372);
    this.meters.load(d.meters as Record<string, unknown>);
    this.phys.importState(d.phys as Record<string, unknown>);
    this.phys.step(0.05);
    this.snapshot = this.buildSnapshot();
    return true;
  }
}
