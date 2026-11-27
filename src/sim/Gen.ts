/** Trạng thái một tổ máy (MF1 / MF2). Tên biến giữ gần với file DAQ để dễ đối chiếu. */
export class Gen {
  readonly no: number;

  constructor(no: number) {
    this.no = no;
  }

  // Chế độ chạy: 0 dừng, 1 phát điện, 2 không tải, 3 chạy tự do
  generating = 0.0;
  emValve = 0.0;              // van phân phối sự cố (dừng sự cố) đã tác động
  auto = 0.0;                 // Auto331 / Auto332: cho phép hoà đồng bộ tự động
  fieldDischarge = 0.0;       // máy cắt diệt từ
  excitedEnable = 0.0;
  fault = 0.0;
  readonly status: boolean[] = new Array(128).fill(false); // Gen1Status[] -> CS_0..CS_4
  remote = 0.0;               // 0 = Remote (SD200 điều khiển), 1 = Local

  // Máy cắt / dao phía tổ máy
  cb33 = 0.0;   // CB331 / CB332
  is33 = 0.0;   // IS331_1 / IS332_2
  cb60 = 0.0;   // CB601 / CB602
  gs14 = 0.0;   // GS331_14 / GS332_24
  gs15 = 0.0;   // GS331_15 / GS332_25
  gsQE = 0.0;   // GS1QE / GS2QE
  gsQE1 = 0.0;  // GS1QE1 / GS2QE1

  // Điện
  p = 0.0;       // Pgen (MW) đặt
  q = 0.0;       // Qgen (MVAr) đặt
  pload = 0.0;   // PloadGen = Pgen*100
  qload = 0.0;
  vgen = 0.0;
  iexc = 0.0;
  vexc = 0.0;
  ia = 0.0; ib = 0.0; ic = 0.0;
  v60 = 0.0; f60 = 0.0; i60 = 0.0; phase60 = 0.0;
  freqOut = 0.0;

  // Thuỷ lực, điều tốc (Kaplan ZZJK508-LJ-280)
  guideValve = 0.0;
  speed = 0.0;
  freq = 0.0;
  speedSetting = 0.0;
  running = 0.0;
  servoLock = 0.0;
  airBrake = 0.0;       // AirBreakGenXInput: 1 = phanh đã nhả (đủ điều kiện)
  govAuto = 1.0;        // 1 = AUTO (PID), 0 = MANUAL (mở tay cánh hướng)
  bladeAuto = 1.0;      // 1 = AUTO (Cam Curve), 0 = MANUAL (xoay cánh BXCT tay)
  gvManual = 0.0;       // % mở tay cánh hướng (0..100)
  bladeManual = -10.0;  // góc đặt tay cánh BXCT (-10..+12°)
  gvLimit = 100.0;      // hạn chế độ mở cánh hướng (Opening Limiter, 0..100%)

  // Hệ thống phụ
  auxAuto = 1.0;              // 1 = TỰ ĐỘNG (AUTO), 0 = BẰNG TAY (MANUAL)
  waterPump1 = 0.0; waterPump2 = 0.0;
  cwValve = 0.0;
  cwTemp = 30.0;
  cwPress = 0.0;
  cwPreMPa = 0.0;             // áp lực nước làm mát TRƯỚC van điện cwValve (MPa)
  cwLevel = 0.0;
  hc1 = 0.0; hc2 = 0.0;       // bơm thoát nước nắp turbine
  oilPump1 = 0.0; oilPump2 = 0.0;
  airComp1 = 0.0; airComp2 = 0.0;
  oilPress = 0.0; airPress = 0.0;
  oilLevel = 0.0;
  leakage = 0.0;
  leakReset = 0.0;
  maintSeal = 1.0; shaftSeal = 1.0;

  // Nhiệt độ
  readonly stator: number[] = new Array(6).fill(30.0);
  readonly upper: number[] = new Array(6).fill(30.0);
  readonly lower: number[] = new Array(6).fill(30.0);
  readonly thrust: number[] = new Array(6).fill(30.0);

  // Co-simulation
  controlP = 0.0;
  controlQ = 0.0;
  schedule = 100;       // StartUpScheduleGen

  // Hoà đồng bộ
  autoSync = true;      // false = học viên hoà tay trên trang đồng bộ
  spTrim = 0.0;         // chỉnh tần số đặt quanh 50 Hz (Hz)
  vTrim = 0.0;          // chỉnh điện áp máy phát (%)
  phase = 0.0;          // góc lệch pha máy phát - lưới (độ)

  // Sự cố / bảo vệ
  tripped = false;      // bảo vệ đã cắt tổ máy, phải giải trừ mới khởi động lại
  tripReason = '';
  wpFail = false;       // hỏng bơm nước làm mát
  opFail = false;       // hỏng bơm dầu điều tốc
  hcFail = false;       // hỏng bơm thoát nước nắp turbine
  leakFault = false;    // rò nước nắp turbine lớn
  bearingFault = false; // quá nhiệt ổ trục
  statorFault = false;  // quá nhiệt stator

  // ---- bổ sung cho mô hình vật lý ----
  heater = 0.0;
  readonly core: number[] = new Array(6).fill(30.0);
  readonly coldAir: number[] = new Array(4).fill(30.0);
  readonly hotAir: number[] = new Array(2).fill(30.0);
  upperOil = 30.0; lowerOil = 30.0; thrustOil = 30.0;
  turbPad = 30.0; turbOil = 30.0; trOil = 30.0; trWinding = 30.0;
  blade = 0.0; flow = 0.0; head = 0.0; oilMPa = 4.0; cwMPa = 0.0;
  headCoverMM = 100.0;

  exportState(): Record<string, unknown> {
    return {
      generating: this.generating, emValve: this.emValve, auto: this.auto,
      fieldDischarge: this.fieldDischarge, excitedEnable: this.excitedEnable, fault: this.fault,
      status: [...this.status], remote: this.remote,
      cb33: this.cb33, is33: this.is33, cb60: this.cb60,
      gs14: this.gs14, gs15: this.gs15, gsQE: this.gsQE, gsQE1: this.gsQE1,
      p: this.p, q: this.q, pload: this.pload, qload: this.qload,
      vgen: this.vgen, iexc: this.iexc, vexc: this.vexc,
      ia: this.ia, ib: this.ib, ic: this.ic,
      v60: this.v60, f60: this.f60, i60: this.i60, phase60: this.phase60, freqOut: this.freqOut,
      guideValve: this.guideValve, speed: this.speed, freq: this.freq,
      speedSetting: this.speedSetting, running: this.running, servoLock: this.servoLock,
      airBrake: this.airBrake, govAuto: this.govAuto, bladeAuto: this.bladeAuto,
      gvManual: this.gvManual, bladeManual: this.bladeManual, gvLimit: this.gvLimit,
      auxAuto: this.auxAuto, waterPump1: this.waterPump1, waterPump2: this.waterPump2,
      cwValve: this.cwValve, cwTemp: this.cwTemp, cwPress: this.cwPress, cwPreMPa: this.cwPreMPa,
      cwLevel: this.cwLevel, hc1: this.hc1, hc2: this.hc2,
      oilPump1: this.oilPump1, oilPump2: this.oilPump2, airComp1: this.airComp1, airComp2: this.airComp2,
      oilPress: this.oilPress, airPress: this.airPress, oilLevel: this.oilLevel,
      leakage: this.leakage, leakReset: this.leakReset, maintSeal: this.maintSeal, shaftSeal: this.shaftSeal,
      stator: [...this.stator], upper: [...this.upper], lower: [...this.lower], thrust: [...this.thrust],
      controlP: this.controlP, controlQ: this.controlQ, schedule: this.schedule,
      autoSync: this.autoSync, spTrim: this.spTrim, vTrim: this.vTrim, phase: this.phase,
      tripped: this.tripped, tripReason: this.tripReason,
      wpFail: this.wpFail, opFail: this.opFail, hcFail: this.hcFail,
      leakFault: this.leakFault, bearingFault: this.bearingFault, statorFault: this.statorFault,
      heater: this.heater, core: [...this.core], coldAir: [...this.coldAir], hotAir: [...this.hotAir],
      upperOil: this.upperOil, lowerOil: this.lowerOil, thrustOil: this.thrustOil,
      turbPad: this.turbPad, turbOil: this.turbOil, trOil: this.trOil, trWinding: this.trWinding,
      blade: this.blade, flow: this.flow, head: this.head, oilMPa: this.oilMPa, cwMPa: this.cwMPa,
      headCoverMM: this.headCoverMM,
    };
  }

  importState(d: Record<string, unknown> | null | undefined): void {
    if (!d) return;
    const copyArr = (dst: number[], src: unknown) => {
      if (Array.isArray(src)) {
        for (let i = 0; i < Math.min(dst.length, src.length); i++) dst[i] = Number(src[i]) || 0;
      }
    };
    const scalarKeys = [
      'generating', 'emValve', 'auto', 'fieldDischarge', 'excitedEnable', 'fault', 'remote',
      'cb33', 'is33', 'cb60', 'gs14', 'gs15', 'gsQE', 'gsQE1',
      'p', 'q', 'pload', 'qload', 'vgen', 'iexc', 'vexc', 'ia', 'ib', 'ic',
      'v60', 'f60', 'i60', 'phase60', 'freqOut',
      'guideValve', 'speed', 'freq', 'speedSetting', 'running', 'servoLock', 'airBrake',
      'govAuto', 'bladeAuto', 'gvManual', 'bladeManual', 'gvLimit',
      'auxAuto', 'waterPump1', 'waterPump2', 'cwValve', 'cwTemp', 'cwPress', 'cwPreMPa',
      'cwLevel', 'hc1', 'hc2', 'oilPump1', 'oilPump2', 'airComp1', 'airComp2',
      'oilPress', 'airPress', 'oilLevel', 'leakage', 'leakReset', 'maintSeal', 'shaftSeal',
      'controlP', 'controlQ', 'schedule', 'spTrim', 'vTrim', 'phase', 'heater',
      'upperOil', 'lowerOil', 'thrustOil', 'turbPad', 'turbOil', 'trOil', 'trWinding',
      'blade', 'flow', 'head', 'oilMPa', 'cwMPa', 'headCoverMM',
    ] as const;
    for (const k of scalarKeys) {
      if (typeof d[k] === 'number' && Number.isFinite(d[k] as number)) {
        (this as Record<string, unknown>)[k] = d[k];
      }
    }
    const boolKeys = [
      'autoSync', 'tripped', 'wpFail', 'opFail', 'hcFail', 'leakFault', 'bearingFault', 'statorFault',
    ] as const;
    for (const k of boolKeys) {
      if (typeof d[k] === 'boolean') (this as Record<string, unknown>)[k] = d[k];
    }
    if (typeof d.tripReason === 'string') this.tripReason = d.tripReason;
    if (Array.isArray(d.status)) {
      for (let i = 0; i < Math.min(this.status.length, d.status.length); i++) this.status[i] = !!d.status[i];
    }
    copyArr(this.stator, d.stator);
    copyArr(this.upper, d.upper);
    copyArr(this.lower, d.lower);
    copyArr(this.thrust, d.thrust);
    copyArr(this.core, d.core);
    copyArr(this.coldAir, d.coldAir);
    copyArr(this.hotAir, d.hotAir);
  }
}
