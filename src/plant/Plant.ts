import { Cx } from './Cx';
import { AutoSp, HydroUnit } from './HydroUnit';
import { Br, Network, Src, Sw } from './Network';
import { PlantConfig, RelaySet } from './PlantConfig';
import { GenMeas, GenProtection, LineProtection, Relay } from './Protection';

function coerceIn(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Sự cố ngắn mạch đặt tại một nút lưới */
export class ShortCircuit {
  readonly id: string;
  readonly node: number;
  readonly type: string;
  remaining: number;
  readonly zf: number;
  readonly internalGen: number;

  constructor(id: string, node: number, type: string, remaining = -1.0, zf = 0.001, internalGen = 0) {
    this.id = id;
    this.node = node;
    this.type = type;
    this.remaining = remaining;
    this.zf = zf;
    this.internalGen = internalGen;
  }
}

/**
 * Mô hình vật lý toàn nhà máy: hồ chứa – 2 tổ máy – lưới 6,3/35 kV giải bằng Y-bus – lưới hệ thống qua đường dây 3,5 km
 * (Sk = 25 MVA) – tự dùng 0,4 kV từ TD61 / TD32 – rơ le bảo vệ. Chu kỳ ngoài 0,1 s, bước nhỏ 10 ms.
 */
export class Plant {
  private readonly cfg: () => PlantConfig;
  private get c(): PlantConfig { return this.cfg(); }

  static readonly G1T = 0; static readonly B61 = 1; static readonly G2T = 2; static readonly B62 = 3; static readonly TDH = 4;
  static readonly N331A = 5; static readonly N331B = 6; static readonly N332A = 7; static readonly N332B = 8;
  static readonly B31 = 9; static readonly B32 = 10;
  static readonly N371A = 11; static readonly N371B = 12; static readonly N371L = 13;
  static readonly N372A = 14; static readonly N372B = 15; static readonly N372L = 16;
  static readonly TBA = 17; static readonly AUX = 18; static readonly TD32H = 19; static readonly TD32L = 20; static readonly TD61L = 21; static readonly DGN = 22;
  static readonly N = 23;
  static readonly HV = new Set<number>([
    Plant.N331A, Plant.N331B, Plant.N332A, Plant.N332B, Plant.B31, Plant.B32,
    Plant.N371A, Plant.N371B, Plant.N371L, Plant.N372A, Plant.N372B, Plant.N372L, Plant.TBA, Plant.TD32H,
  ]);
  static readonly LV6 = new Set<number>([Plant.G1T, Plant.B61, Plant.G2T, Plant.B62, Plant.TDH]);
  static readonly AUXN = new Set<number>([Plant.AUX, Plant.TD32L, Plant.TD61L, Plant.DGN]);
  static readonly NAMES: string[] = [
    'Đầu cực MF1', 'Thanh cái 6,3 kV MF1', 'Đầu cực MF2', 'Thanh cái 6,3 kV MF2', 'TD61 cao áp',
    'Ngăn 331 (331-14)', 'Ngăn 331 (331-15)', 'Ngăn 332 (332-24)', 'Ngăn 332 (332-25)', 'Thanh cái C31', 'Thanh cái C32',
    'Ngăn 371 (371-15)', 'Ngăn 371 (371-75)', 'Đầu đường dây 371', 'Ngăn 372 (372-25)', 'Ngăn 372 (372-75)', 'Đầu đường dây 372',
    'Thanh cái 35 kV TBA', 'Thanh cái 0,4 kV', 'TD32 cao áp', 'TD32 hạ áp', 'TD61 hạ áp', 'Máy phát diesel',
  ];

  readonly u1: HydroUnit;
  readonly u2: HydroUnit;
  readonly units: HydroUnit[];
  readonly net: Network;

  // ---------------- Khoá ----------------
  readonly s601: Sw; readonly s602: Sw;
  readonly s612_1: Sw; readonly s612_2: Sw;
  readonly s331_1: Sw; readonly s331: Sw;
  readonly s332_2: Sw; readonly s332: Sw;
  readonly s312: Sw;
  readonly s371_1: Sw; readonly s371: Sw; readonly s371_7: Sw;
  readonly s372_2: Sw; readonly s372: Sw; readonly s372_7: Sw;
  readonly sFco: Sw;
  readonly sAxt1: Sw; readonly sAxt2: Sw;
  readonly sDG: Sw;

  // ---------------- Nhánh ----------------
  readonly bT1: Br; readonly bT2: Br;
  readonly bL1: Br; readonly bL2: Br;
  readonly bTD61: Br; readonly bTD32: Br;

  // ---------------- Nguồn ----------------
  readonly src1: Src; readonly src2: Src; readonly srcGrid: Src; readonly srcDg: Src;
  /** máy phát diesel tự dùng 0,4 kV (khởi động đen): Physics điều khiển chạy/dừng */
  dgRun = false; dgKW = 0.0; dgKVAr = 0.0;
  readonly tdKW: [number, number] = [0.0, 0.0];
  readonly tdKVAr: [number, number] = [0.0, 0.0];

  // ---------------- Trạng thái ngoài ----------------
  gridAvailable = true;
  tba371 = true; tba372 = true;
  /** dao nối đất đang đóng: tên -> nút */
  readonly earth = new Map<string, number>();
  readonly faults: ShortCircuit[] = [];
  auxLoadKW = 60.0;
  inflowM3s = 60.0;
  gridAngle = 0.0;

  // ---------------- Hồ chứa ----------------
  zUp = 20.0; zTail = 0.5; qSpill = 0.0;
  sumpLevel = 2.0; drainLevel = 3.0; oilLeakLevel = 0.12;
  readonly sumpPump: [boolean, boolean] = [false, false];
  readonly drainPump: [boolean, boolean] = [false, false];
  oilLeakPump = false;
  lpAirMPa = 0.75; hpAirMPa = 6.0;
  readonly lpComp: [boolean, boolean] = [false, false];
  readonly hpComp: [boolean, boolean] = [false, false];
  pubAuto = true;
  sumpSp: [number, number, number] = [2.5, 3.2, 1.0];      // khởi động chính, dự phòng, dừng (m)
  drainSp: [number, number, number] = [5.0, 6.0, 2.0];
  oilLeakSp: [number, number] = [0.30, 0.10];               // khởi động, dừng (m)
  readonly autoSp1 = new AutoSp();
  readonly autoSp2 = new AutoSp();

  // ---------------- Kết quả ----------------
  readonly vkv = new Float64Array(Plant.N);
  readonly fHz = new Float64Array(Plant.N);
  p371 = 0.0; q371 = 0.0; i371 = 0.0; p372 = 0.0; q372 = 0.0; i372 = 0.0;
  iCb331 = 0.0; iCb332 = 0.0;
  readonly u0zone = new Float64Array(Plant.N);
  auxV = 0.0;
  simTime = 0.0;
  readonly genProt: [GenProtection, GenProtection];
  readonly lineProt: [LineProtection, LineProtection];
  /** bảo vệ đường dây phía TBA: cắt đầu TBA khi sự cố trên đường dây (dòng từ lưới chạy vào đường dây) */
  private readonly vMem: Cx[] = [new Cx(1.0, 0.0), new Cx(1.0, 0.0), new Cx(1.0, 0.0), new Cx(1.0, 0.0)];
  readonly tbaProt: [LineProtection, LineProtection];
  /** rơ le vừa tác động (HpsSim lấy ra xử lý) */
  readonly tripped: Array<[number, Relay]> = [];
  private readonly m1 = new GenMeas();
  private readonly m2 = new GenMeas();

  /** độ mở cửa nhận nước 0..1 (nâng/hạ trong 60 s) */
  readonly intake: [number, number] = [1.0, 1.0];
  readonly intakeCmd: [boolean, boolean] = [true, true];

  private gridWas = true;
  private readonly negShunt: Cx[] = Array.from({ length: Plant.N }, () => Cx.ZERO);

  constructor(cfg: () => PlantConfig) {
    this.cfg = cfg;
    this.u1 = new HydroUnit(1, cfg);
    this.u2 = new HydroUnit(2, cfg);
    this.units = [this.u1, this.u2];
    this.net = new Network(Plant.N);

    this.s601 = this.net.sw('601', Plant.G1T, Plant.B61);
    this.s602 = this.net.sw('602', Plant.G2T, Plant.B62);
    this.s612_1 = this.net.sw('612-1', Plant.B61, Plant.TDH);
    this.s612_2 = this.net.sw('612-2', Plant.B62, Plant.TDH);
    this.s331_1 = this.net.sw('331-1', Plant.B31, Plant.N331A);
    this.s331 = this.net.sw('331', Plant.N331A, Plant.N331B);
    this.s332_2 = this.net.sw('332-2', Plant.B32, Plant.N332A);
    this.s332 = this.net.sw('332', Plant.N332A, Plant.N332B);
    this.s312 = this.net.sw('312-1', Plant.B31, Plant.B32);
    this.s371_1 = this.net.sw('371-1', Plant.B31, Plant.N371A);
    this.s371 = this.net.sw('371', Plant.N371A, Plant.N371B);
    this.s371_7 = this.net.sw('371-7', Plant.N371B, Plant.N371L);
    this.s372_2 = this.net.sw('372-2', Plant.B32, Plant.N372A);
    this.s372 = this.net.sw('372', Plant.N372A, Plant.N372B);
    this.s372_7 = this.net.sw('372-7', Plant.N372B, Plant.N372L);
    this.sFco = this.net.sw('FCO TD32', Plant.B32, Plant.TD32H);
    this.sAxt1 = this.net.sw('1AXT', Plant.TD61L, Plant.AUX);
    this.sAxt2 = this.net.sw('2AXT', Plant.TD32L, Plant.AUX);
    this.sDG = this.net.sw('Máy cắt diesel', Plant.DGN, Plant.AUX);

    this.bT1 = this.net.br('T1', Plant.N331B, Plant.B61, this.zTr(10.0, 0.0677, 40.26));
    this.bT2 = this.net.br('T2', Plant.N332B, Plant.B62, this.zTr(10.0, 0.0677, 40.26));
    this.bL1 = this.net.br('Đường dây 371', Plant.N371L, Plant.TBA, Cx.ZERO);
    this.bL2 = this.net.br('Đường dây 372', Plant.N372L, Plant.TBA, Cx.ZERO);
    this.bTD61 = this.net.br('TD61', Plant.TDH, Plant.TD61L, Cx.ZERO);
    this.bTD32 = this.net.br('TD32', Plant.TD32H, Plant.TD32L, Cx.ZERO);

    this.src1 = this.net.src(Plant.G1T);
    this.src2 = this.net.src(Plant.G2T);
    this.srcGrid = this.net.src(Plant.TBA);
    this.srcDg = this.net.src(Plant.DGN);

    this.genProt = [new GenProtection(1), new GenProtection(2)];
    this.lineProt = [new LineProtection('371', 1), new LineProtection('372', 2)];
    this.tbaProt = [new LineProtection('371', 1, true), new LineProtection('372', 2, true)];
  }

  private zTr(mva: number, uk: number, pkKW: number): Cx {
    const zb = (uk * 10.0) / mva;
    const r = ((pkKW / 1000.0) / mva) * (10.0 / mva);
    return new Cx(r, Math.sqrt(Math.max(zb * zb - r * r, 1e-6)));
  }

  nodeOfEarth(name: string): number | null {
    switch (name) {
      case '1QE': return Plant.G1T;
      case '2QE': return Plant.G2T;
      case '1QE1':
      case '2QE1': return Plant.TDH;
      case '331-14': return Plant.N331A;
      case '331-15': return Plant.N331B;
      case '332-24': return Plant.N332A;
      case '332-25': return Plant.N332B;
      case '371-15': return Plant.N371A;
      case '371-75': return Plant.N371B;
      case '371-76': return Plant.N371L;
      case '372-25': return Plant.N372A;
      case '372-75': return Plant.N372B;
      case '372-76': return Plant.N372L;
      default: return null;
    }
  }

  private updateBranches(): void {
    const trUkPu = this.c.trUk > 1.0 ? this.c.trUk / 100.0 : this.c.trUk;
    const zt = this.zTr(Math.max(this.c.trMVA, 1.0), Math.max(trUkPu, 0.005), Math.max(this.c.trPkKW, 0.1));
    this.bT1.z = zt; this.bT2.z = zt;
    const zb = (38.5 * 38.5) / 10.0;
    const zl = new Cx((this.c.lineROhmKm * this.c.lineLengthKm) / zb, (this.c.lineXOhmKm * this.c.lineLengthKm) / zb);
    this.bL1.z = zl; this.bL2.z = zl;
    this.bL1.on = this.tba371; this.bL2.on = this.tba372;
    const tdUkPu = this.c.tdUk > 1.0 ? this.c.tdUk / 100.0 : this.c.tdUk;
    const ztd = this.zTr(Math.max(this.c.tdKVA / 1000.0, 0.05), Math.max(tdUkPu, 0.005), this.c.tdKVA * 0.012);
    this.bTD61.z = ztd; this.bTD32.z = ztd;
    const tdTap = coerceIn(this.c.tdTap > 0.0 ? this.c.tdTap : 1.03, 0.85, 1.25);
    this.bTD61.t = tdTap * (1.0 + this.c.td61TapPct / 100.0);
    this.bTD32.t = tdTap * (1.0 + this.c.td32TapPct / 100.0);
  }

  // =====================================================================
  step(dt: number): void {
    // lưới 110 kV có điện trở lại: máy cắt phía TBA đóng có kiểm tra đồng bộ -> pha lưới trùng pha thanh cái 35 kV đang chạy độc lập
    if (this.gridAvailable && !this.gridWas && this.net.v[Plant.TBA].abs() > 0.5) {
      this.gridAngle = this.net.v[Plant.TBA].arg();
    }
    this.gridWas = this.gridAvailable;
    this.updateBranches();
    const n = 10;
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      this.solveNetwork(h);
      for (const u of this.units) {
        const node = u.no === 1 ? Plant.G1T : Plant.G2T;
        const stiff = this.gridStiff(node);
        const connected = (u.no === 1 ? this.s601 : this.s602).closed && this.islandHasLoad(node);
        const fb = this.fHz[node] / 50.0;
        u.stepFast(h, stiff, connected, 1.0, fb > 0.5 && this.islandHasOtherSource(u) ? fb : u.omega);
      }
      this.gridAngle += 2 * Math.PI * (this.c.gridFreqHz - 50.0) * h;
      for (const f of this.faults) if (f.remaining > 0) f.remaining -= h;
      for (let i = this.faults.length - 1; i >= 0; i--) {
        const rem = this.faults[i].remaining;
        if (rem === 0.0 || (rem < 0 && rem > -1.0)) this.faults.splice(i, 1);
      }
      this.simTime += h;
    }
    this.reservoir(dt);
    const amb = 28.0;
    this.auxV = this.net.v[Plant.AUX].abs();
    const auxOk = this.auxV > 0.85;
    this.u1.stepSlow(dt, auxOk, this.c.riverTempC, amb, this.autoSp1);
    this.u2.stepSlow(dt, auxOk, this.c.riverTempC, amb, this.autoSp2);
    this.pubAux(dt, auxOk);
    this.measure();
    this.protection(dt);
  }

  private islandHasLoad(node: number): boolean {
    const isl = this.net.island[node];
    for (let i = 0; i < Plant.N; i++) {
      if (this.net.island[i] === isl && (i === Plant.TBA || i === Plant.AUX)) return true;
    }
    return false;
  }

  private islandHasOtherSource(u: HydroUnit): boolean {
    const node = u.no === 1 ? Plant.G1T : Plant.G2T;
    const isl = this.net.island[node];
    if (this.gridAvailable && this.net.island[Plant.TBA] === isl) return true;
    const o = u.no === 1 ? this.u2 : this.u1;
    return o.present && this.net.island[o.no === 1 ? Plant.G1T : Plant.G2T] === isl;
  }

  private gridStiff(node: number): boolean {
    return this.gridAvailable && this.net.island[node] === this.net.island[Plant.TBA];
  }

  isUnitGridStiff(no: number): boolean {
    return this.gridStiff(no === 1 ? Plant.G1T : Plant.G2T);
  }

  private solveNetwork(_h: number): void {
    // tải phụ thuộc tần số
    for (let i = 0; i < Plant.N; i++) this.net.shunt[i] = Cx.ZERO;
    const fT = this.fHz[Plant.TBA] > 1 ? this.fHz[Plant.TBA] : 50.0;
    const kf = 1 + this.c.loadFreqCoef * (fT / 50.0 - 1);
    this.net.shunt[Plant.TBA] = new Cx(this.c.tbaLoadMW * kf, -this.c.tbaLoadMVAr).divScalar(10.0);
    const pa = this.auxLoadKW / 1000.0 / 10.0;
    this.net.shunt[Plant.AUX] = new Cx(pa, -pa * 0.6);
    // tổn hao không tải MBA (nhánh từ hoá)
    this.net.shunt[Plant.B61] = this.net.shunt[Plant.B61].plus(new Cx(this.c.trP0KW / 1000.0 / 10.0, -0.0017));
    this.net.shunt[Plant.B62] = this.net.shunt[Plant.B62].plus(new Cx(this.c.trP0KW / 1000.0 / 10.0, -0.0017));
    for (let i = 0; i < Plant.N; i++) this.negShunt[i] = this.net.shunt[i];
    // dao nối đất: nối đất trực tiếp 3 pha
    for (const node of this.earth.values()) {
      this.net.shunt[node] = this.net.shunt[node].plus(new Cx(2000.0, 0.0));
    }
    // nguồn
    const unitSrcs: Array<[HydroUnit, Src]> = [[this.u1, this.src1], [this.u2, this.src2]];
    for (const [u, s] of unitSrcs) {
      // máy phát luôn là phần tử của lưới: đang quay/có từ thông -> nguồn E' sau Xd';
      // đứng yên/không từ thông -> tổng trở siêu quá độ Xd'' (cuộn cản ở độ trượt lớn) không có sức điện động.
      // Nhờ vậy đóng điện nhầm vào máy phát đang dừng sẽ có dòng lớn chạy vào stator như thực tế.
      s.on = true;
      if (u.present) {
        s.y = u.ySrc;
        s.inj = u.ePrime.times(s.y);
      } else {
        s.y = new Cx(this.c.ra + 0.02, this.c.xd2).inv();
        s.inj = Cx.ZERO;
      }
    }
    // diesel: nguồn áp 1,0 pu sau Xd'' 0,15 pu (theo công suất máy), tần số giữ 50 Hz (điều tốc đẳng tốc)
    this.srcDg.on = this.dgRun;
    this.srcDg.y = new Cx(0.01, (0.15 * 10.0) / (this.c.dieselKVA / 1000.0)).inv();
    this.srcDg.inj = new Cx(1.0, 0.0).times(this.srcDg.y);
    this.srcGrid.on = this.gridAvailable;
    const xrHyp = Math.sqrt(1 + this.c.gridXR * this.c.gridXR);
    const zs = new Cx(1.0 / xrHyp, this.c.gridXR / xrHyp).scale(10.0 / this.c.gridSkMVA);
    this.srcGrid.y = zs.inv();
    this.srcGrid.inj = Cx.polar(this.c.gridVoltagePu, this.gridAngle).times(this.srcGrid.y);
    // sự cố: 3 pha -> tổng trở sự cố; 2 pha -> tổng trở thứ tự nghịch Thevenin nối song song
    const f2 = this.faults.filter((it) => it.type === '2P');
    if (f2.length > 0) this.net.solve();
    for (const f of this.faults) {
      if (f.type === '3P') {
        this.net.shunt[f.node] = this.net.shunt[f.node].plus(new Cx(1.0 / f.zf, 0.0));
      } else if (f.type === '2P') {
        const z2 = this.net.thevenin(f.node, (s) => this.negY(s), this.negShunt);
        this.net.shunt[f.node] = this.net.shunt[f.node].plus(z2.plus(new Cx(f.zf, 0.0)).inv());
      }
    }
    this.net.solve();
    // dòng thứ tự nghịch tại máy phát khi có sự cố 2 pha
    this.u1.i2 = 0.0; this.u2.i2 = 0.0;
    for (const f of f2) {
      const z2 = this.net.thevenin(f.node, (s) => this.negY(s), this.negShunt);
      const i1 = this.net.v[f.node].div(z2.plus(new Cx(f.zf, 0.0)));
      const v2 = this.net.solveNeg(f.node, i1.neg(), (s) => this.negY(s), this.negShunt);
      this.u1.i2 += v2[Plant.G1T].times(this.negY(this.src1)).abs() * (this.src1.on ? 1.0 : 0.0);
      this.u2.i2 += v2[Plant.G2T].times(this.negY(this.src2)).abs() * (this.src2.on ? 1.0 : 0.0);
    }
    const sdg = this.net.v[Plant.DGN].times((this.srcDg.on ? this.srcDg.i : Cx.ZERO).conj());
    this.dgKW = sdg.re * 10000.0; this.dgKVAr = sdg.im * 10000.0;
    // công suất qua 1AXT / 2AXT (chiều MBA tự dùng -> thanh cái 0,4 kV)
    const axts = [this.sAxt1, this.sAxt2];
    for (let k = 0; k < 2; k++) {
      const sw = axts[k];
      const st = sw.closed ? this.net.v[Plant.AUX].times(sw.i.conj()) : Cx.ZERO;
      this.tdKW[k] = st.re * 10000.0; this.tdKVAr[k] = st.im * 10000.0;
    }
    const unitTriples: Array<[HydroUnit, Src, number]> = [
      [this.u1, this.src1, Plant.G1T],
      [this.u2, this.src2, Plant.G2T],
    ];
    for (const [u, s, node] of unitTriples) {
      u.iT = s.on ? s.i : Cx.ZERO;
      u.vT = this.net.v[node];
      const i1 = u.iT.abs();
      const ang = u.iT.arg();
      // dòng pha (thành phần đối xứng, giả thiết I2 lệch pha với I1 theo sự cố)
      const a1 = Cx.polar(i1, ang); const a2 = Cx.polar(u.i2, ang);
      u.iaPu = a1.plus(a2).abs();
      u.ibPu = a1.times(Cx.A2).plus(a2.times(Cx.A)).abs();
      u.icPu = a1.times(Cx.A).plus(a2.times(Cx.A2)).abs();
    }
    // tần số từng vùng
    for (let i = 0; i < Plant.N; i++) {
      const isl = this.net.island[i];
      if (this.net.v[i].abs() < 0.05) {
        this.fHz[i] = 0.0;
      } else if (this.gridAvailable && isl === this.net.island[Plant.TBA]) {
        this.fHz[i] = this.c.gridFreqHz;
      } else if (this.dgRun && isl === this.net.island[Plant.DGN]) {
        this.fHz[i] = 50.0;
      } else {
        let sw = 0.0; let sf = 0.0;
        const pairs: Array<[HydroUnit, number]> = [[this.u1, Plant.G1T], [this.u2, Plant.G2T]];
        for (const [u, node] of pairs) {
          if (u.present && this.net.island[node] === isl) { sw += 1.0; sf += u.omega * 50; }
        }
        this.fHz[i] = sw > 0 ? sf / sw : 0.0;
      }
    }
  }

  private negY(s: Src): Cx {
    if (s === this.src1 || s === this.src2) return new Cx(this.c.ra, this.c.x2).inv();
    return s.y;
  }

  // ---------------- Hồ chứa, tràn tự do, mực nước hạ lưu ----------------
  private reservoir(dt: number): void {
    const qT = this.u1.flowM3s + this.u2.flowM3s;
    this.qSpill =
      this.zUp > this.c.crestLevelM
        ? this.c.spillCoef * this.c.spillWidthM * Math.sqrt(2 * 9.81) * Math.pow(this.zUp - this.c.crestLevelM, 1.5)
        : 0.0;
    this.zUp += ((this.inflowM3s - qT - this.qSpill) / this.c.reservoirAreaM2) * dt;
    this.zUp = coerceIn(this.zUp, 5.0, 30.0);
    this.zTail = this.c.tailCoef * Math.pow(Math.max((qT + this.qSpill) / 100.0, 0.0), 0.7);
    const gross = this.zUp - this.zTail;
    for (const u of this.units) u.hStatic = (gross / this.c.ratedHeadM) * this.intake[u.no - 1];
  }

  // ---------------- Thiết bị phụ trạm: giếng, khí nén, dầu rò ----------------
  private pubAux(dt: number, auxOk: boolean): void {
    for (let i = 0; i <= 1; i++) {
      this.intake[i] = coerceIn(this.intake[i] + ((this.intakeCmd[i] ? 1 : -1) * dt) / 60.0, 0.0, 1.0);
    }
    // giếng tiêu (rò rỉ): nước từ nắp turbine bơm ra + thấm (m³/s), diện tích 12 m²
    const hcOut = this.units.reduce((acc, u) => acc + (u.hcPump[0] ? 0.004 : 0.0) + (u.hcPump[1] ? 0.004 : 0.0), 0.0);
    const sumpIn = 0.004 + hcOut;
    if (this.pubAuto && auxOk) {
      if (this.sumpLevel >= this.sumpSp[0]) this.sumpPump[0] = true;
      if (this.sumpLevel >= this.sumpSp[1]) this.sumpPump[1] = true;
      if (this.sumpLevel <= this.sumpSp[2]) { this.sumpPump[0] = false; this.sumpPump[1] = false; }
      if (this.drainLevel >= this.drainSp[0]) this.drainPump[0] = true;
      if (this.drainLevel >= this.drainSp[1]) this.drainPump[1] = true;
      if (this.drainLevel <= this.drainSp[2]) { this.drainPump[0] = false; this.drainPump[1] = false; }
      if (this.oilLeakLevel >= this.oilLeakSp[0]) this.oilLeakPump = true;
      if (this.oilLeakLevel <= this.oilLeakSp[1]) this.oilLeakPump = false;
      if (this.lpAirMPa < 0.60) this.lpComp[0] = true;
      if (this.lpAirMPa < 0.55) this.lpComp[1] = true;
      if (this.lpAirMPa > 0.80) { this.lpComp[0] = false; this.lpComp[1] = false; }
      if (this.hpAirMPa < 5.5) this.hpComp[0] = true;
      if (this.hpAirMPa < 5.2) this.hpComp[1] = true;
      if (this.hpAirMPa > 6.3) { this.hpComp[0] = false; this.hpComp[1] = false; }
    }
    const run = (b: boolean) => (b && auxOk ? 1.0 : 0.0);
    const sumpOut = 0.010 * (run(this.sumpPump[0]) + run(this.sumpPump[1]));
    this.sumpLevel = coerceIn(this.sumpLevel + ((sumpIn - sumpOut) / 12.0) * dt, 0.0, 9.9);
    const drainIn = 0.002;
    this.drainLevel = coerceIn(
      this.drainLevel + ((drainIn - 0.008 * (run(this.drainPump[0]) + run(this.drainPump[1]))) / 20.0) * dt,
      0.0,
      14.9,
    );
    this.oilLeakLevel = coerceIn(
      this.oilLeakLevel + ((0.00001 - 0.0004 * run(this.oilLeakPump)) / 0.5) * dt,
      0.0,
      0.49,
    );
    // khí nén hạ áp: phanh, đệm kín; cao áp: bù khí bình dầu
    const lpUse =
      0.0004 +
      this.units.reduce((acc, it) => acc + (it.brake && it.omega > 0 ? 0.004 : 0.0), 0.0) +
      this.units.reduce((acc, it) => acc + (it.sealAir ? 0.0003 : 0.0), 0.0);
    this.lpAirMPa = coerceIn(
      this.lpAirMPa + (0.003 * (run(this.lpComp[0]) + run(this.lpComp[1])) - lpUse) * dt,
      0.0,
      0.85,
    );
    this.hpAirMPa = coerceIn(
      this.hpAirMPa + (0.004 * (run(this.hpComp[0]) + run(this.hpComp[1])) - 0.0006) * dt,
      0.0,
      6.5,
    );
  }

  // ---------------- Đo lường ----------------
  private measure(): void {
    for (let i = 0; i < Plant.N; i++) {
      const base = Plant.HV.has(i) ? 38.5 : Plant.AUXN.has(i) ? 0.4 : this.c.genKV;
      this.vkv[i] = this.net.v[i].abs() * base;
    }
    const ibHv = 10e6 / (Math.sqrt(3.0) * 38500);
    const flow = (sw: Sw, node: number): [number, number, number] => {
      if (!sw.closed) return [0.0, 0.0, 0.0];
      const s = this.net.v[node].times(sw.i.conj());
      return [s.re * 10, s.im * 10, sw.i.abs() * ibHv];
    };
    const [a, b, cc] = flow(this.s371, Plant.N371A); this.p371 = a; this.q371 = b; this.i371 = cc;
    const [d, e, f] = flow(this.s372, Plant.N372A); this.p372 = d; this.q372 = e; this.i372 = f;
    this.iCb331 = this.s331.i.abs(); this.iCb332 = this.s332.i.abs();
    // 3U0 do chạm đất 1 pha trong lưới trung tính cách ly (có xét X0 nguồn)
    for (let i = 0; i < Plant.N; i++) this.u0zone[i] = 0.0;
    const k0 = coerceIn(1.0 / (1.0 + Math.max(this.c.x0, 0.0) * 0.5), 0.6, 1.0);
    for (const flt of this.faults) {
      if (flt.type === '1PG') {
        const v1 = this.net.v[flt.node].abs() * k0;
        const group = Plant.HV.has(flt.node) ? Plant.HV : Plant.LV6;
        for (let i = 0; i < Plant.N; i++) {
          if (group.has(i) && this.net.island[i] === this.net.island[flt.node] && this.sameGalvanic(i, flt.node)) {
            this.u0zone[i] = Math.max(this.u0zone[i], v1);
          }
        }
      }
    }
  }

  /** cùng vùng điện (qua khoá hoặc đường dây, không qua MBA) */
  private sameGalvanic(a: number, b: number): boolean {
    if (Plant.LV6.has(a) !== Plant.LV6.has(b)) return false;
    return this.net.busOf[a] === this.net.busOf[b] || (Plant.HV.has(a) && Plant.HV.has(b));
  }

  // ---------------- Rơ le ----------------
  private protection(dt: number): void {
    const rs = this.c.relay;
    const pairs: Array<[HydroUnit, GenMeas]> = [[this.u1, this.m1], [this.u2, this.m2]];
    for (const [u, m] of pairs) {
      const tNode = u.no === 1 ? Plant.G1T : Plant.G2T;
      const bNode = u.no === 1 ? Plant.B61 : Plant.B62;
      const hvNode = u.no === 1 ? Plant.N331B : Plant.N332B;
      m.i = u.iT.abs(); m.v = u.vT.abs(); m.fHz = u.omega * 50; m.p = u.peTerm; m.q = u.qeTerm; m.i2 = u.i2;
      m.omega = u.omega; m.cb601 = (u.no === 1 ? this.s601 : this.s602).closed;
      m.cb331 = (u.no === 1 ? this.s331 : this.s332).closed;
      m.iTr = u.no === 1 ? this.iCb331 : this.iCb332;
      m.trOil = u.tTrOil; m.efdMaxTime = u.efdMaxTime; m.ifA = u.ifA; m.ifRated = this.c.ifRated; m.excited = u.excOn;
      m.thrustOil = u.tThrustOil;
      m.bearingPad = Math.max(u.tThrustPad, u.tTurbPad);
      m.guidePad = Math.max(u.tUpperPad, u.tLowerPad);
      m.statorTemp = Math.max(u.tCoil, u.tCore);
      m.hotAir = u.tHotAir;
      m.thermalSpeed = this.c.thermalSpeed;
      m.loadRejecting = u.loadRejectActive || u.loadRejectBlock81O;
      m.islanded = u.islanded && !this.gridStiff(tNode);
      m.u0 = this.u0zone[tNode]; m.u0hv = Math.max(this.u0zone[Plant.B31], this.u0zone[Plant.B32]);
      // so lệch: dòng sự cố chảy ra đất bên trong vùng bảo vệ
      const leak = (nodes: number[]) => nodes.reduce((acc, it) => acc + this.faultCurrent(it), 0.0);
      m.idiffG = leak([tNode]);
      m.idiffT = leak([bNode, hvNode]);
      for (const r of this.genProt[u.no - 1].step(m, rs, dt)) this.tripped.push([u.no, r]);
    }
    const u0hv = Math.max(this.u0zone[Plant.B31], this.u0zone[Plant.B32]);
    // rơ le có hướng dùng điện áp nhớ (điện áp trước sự cố) để xác định chiều khi điện áp sụp
    const mem = (k: number, v: Cx): Cx => {
      if (v.abs() > 0.5) this.vMem[k] = v;
      return this.vMem[k];
    };
    const d371 = mem(0, this.net.v[Plant.N371A]).times(this.s371.i.conj()).im > 0;
    const d372 = mem(1, this.net.v[Plant.N372A]).times(this.s372.i.conj()).im > 0;
    for (const r of this.lineProt[0].step(this.i371, u0hv, this.s371.closed, rs, dt, d371)) this.tripped.push([3, r]);
    for (const r of this.lineProt[1].step(this.i372, u0hv, this.s372.closed, rs, dt, d372)) this.tripped.push([3, r]);
    // phía TBA: dòng tại đầu TBA (chiều TBA -> đường dây = -ib của nhánh đường dây); phối hợp chậm hơn cấp chậm nhất
    // của đầu nhà máy (thuận hoặc ngược hướng) một bậc 0,3 s, để sự cố phía thanh cái do máy cắt ngăn tại nhà máy cắt trước
    const rsT = new RelaySet({
      ...rs,
      lineSec1: Math.max(rs.lineSec1, rs.lineRevSec1) + 0.3,
      lineSec2: Math.max(rs.lineSec2, rs.lineRevSec2) + 0.3,
    });
    const lineBrs = [this.bL1, this.bL2];
    for (let k = 0; k < 2; k++) {
      const br = lineBrs[k];
      const iT = br.ib.scale(-1.0);
      const fwd = mem(2 + k, this.net.v[Plant.TBA]).times(iT.conj()).im > 0;
      const on = k === 0 ? this.tba371 : this.tba372;
      for (const r of this.tbaProt[k].step((iT.abs() * 10e6) / (Math.sqrt(3.0) * 38500), 0.0, on && br.on, rsT, dt, fwd)) {
        this.tripped.push([3, r]);
      }
    }
  }

  /** dòng chạm đất / ngắn mạch tại nút (pu) */
  faultCurrent(node: number): number {
    let y = Cx.ZERO;
    for (const f of this.faults) {
      if (f.node === node && f.type !== '1PG') y = y.plus(new Cx(1.0 / f.zf, 0.0));
    }
    for (const en of this.earth.values()) {
      if (en === node) {
        y = y.plus(new Cx(2000.0, 0.0));
        break;
      }
    }
    return this.net.v[node].times(y).abs();
  }

  nodeName(i: number): string {
    return Plant.NAMES[i] ?? `N${i}`;
  }

  /** Lưu trạng thái Plant để khôi phục qua localStorage */
  exportState(): Record<string, unknown> {
    const serRelays = (arr: Relay[]) => arr.map((r) => ({ code: r.code, t: r.t, picked: r.picked, operated: r.operated }));
    return {
      u1: this.u1.exportState(),
      u2: this.u2.exportState(),
      dgRun: this.dgRun,
      gridAvailable: this.gridAvailable,
      tba371: this.tba371, tba372: this.tba372,
      earth: Array.from(this.earth.entries()),
      faults: this.faults.map((f) => ({ id: f.id, node: f.node, type: f.type, remaining: f.remaining, zf: f.zf, internalGen: f.internalGen })),
      auxLoadKW: this.auxLoadKW, inflowM3s: this.inflowM3s, gridAngle: this.gridAngle,
      zUp: this.zUp, zTail: this.zTail, qSpill: this.qSpill,
      sumpLevel: this.sumpLevel, drainLevel: this.drainLevel, oilLeakLevel: this.oilLeakLevel,
      sumpPump: [...this.sumpPump], drainPump: [...this.drainPump], oilLeakPump: this.oilLeakPump,
      lpAirMPa: this.lpAirMPa, hpAirMPa: this.hpAirMPa,
      lpComp: [...this.lpComp], hpComp: [...this.hpComp],
      pubAuto: this.pubAuto,
      sumpSp: [...this.sumpSp], drainSp: [...this.drainSp], oilLeakSp: [...this.oilLeakSp],
      autoSp1: { ...this.autoSp1 }, autoSp2: { ...this.autoSp2 },
      intake: [...this.intake], intakeCmd: [...this.intakeCmd],
      simTime: this.simTime, gridWas: this.gridWas,
      genProt: [serRelays(this.genProt[0].all), serRelays(this.genProt[1].all)],
      lineProt: [serRelays(this.lineProt[0].all), serRelays(this.lineProt[1].all)],
      tbaProt: [serRelays(this.tbaProt[0].all), serRelays(this.tbaProt[1].all)],
    };
  }

  importState(d: Record<string, unknown> | null | undefined): void {
    if (!d) return;
    const num = (k: string, cur: number) => (typeof d[k] === 'number' && Number.isFinite(d[k] as number) ? (d[k] as number) : cur);
    const bool = (k: string, cur: boolean) => (typeof d[k] === 'boolean' ? (d[k] as boolean) : cur);
    this.u1.importState(d.u1 as Record<string, unknown>);
    this.u2.importState(d.u2 as Record<string, unknown>);
    this.dgRun = bool('dgRun', this.dgRun);
    this.gridAvailable = bool('gridAvailable', this.gridAvailable);
    this.tba371 = bool('tba371', this.tba371);
    this.tba372 = bool('tba372', this.tba372);
    if (Array.isArray(d.earth)) {
      this.earth.clear();
      for (const e of d.earth) {
        if (Array.isArray(e) && e.length === 2) this.earth.set(String(e[0]), Number(e[1]));
      }
    }
    if (Array.isArray(d.faults)) {
      this.faults.length = 0;
      for (const f of d.faults as Array<Record<string, unknown>>) {
        if (f && typeof f.id === 'string') {
          this.faults.push(new ShortCircuit(f.id, Number(f.node) || 0, String(f.type || '3P'), Number(f.remaining ?? -1), Number(f.zf ?? 0.001), Number(f.internalGen ?? 0)));
        }
      }
    }
    this.auxLoadKW = num('auxLoadKW', this.auxLoadKW);
    this.inflowM3s = num('inflowM3s', this.inflowM3s);
    this.gridAngle = num('gridAngle', this.gridAngle);
    this.zUp = num('zUp', this.zUp); this.zTail = num('zTail', this.zTail); this.qSpill = num('qSpill', this.qSpill);
    this.sumpLevel = num('sumpLevel', this.sumpLevel);
    this.drainLevel = num('drainLevel', this.drainLevel);
    this.oilLeakLevel = num('oilLeakLevel', this.oilLeakLevel);
    if (Array.isArray(d.sumpPump) && d.sumpPump.length === 2) { this.sumpPump[0] = !!d.sumpPump[0]; this.sumpPump[1] = !!d.sumpPump[1]; }
    if (Array.isArray(d.drainPump) && d.drainPump.length === 2) { this.drainPump[0] = !!d.drainPump[0]; this.drainPump[1] = !!d.drainPump[1]; }
    this.oilLeakPump = bool('oilLeakPump', this.oilLeakPump);
    this.lpAirMPa = num('lpAirMPa', this.lpAirMPa); this.hpAirMPa = num('hpAirMPa', this.hpAirMPa);
    if (Array.isArray(d.lpComp) && d.lpComp.length === 2) { this.lpComp[0] = !!d.lpComp[0]; this.lpComp[1] = !!d.lpComp[1]; }
    if (Array.isArray(d.hpComp) && d.hpComp.length === 2) { this.hpComp[0] = !!d.hpComp[0]; this.hpComp[1] = !!d.hpComp[1]; }
    this.pubAuto = bool('pubAuto', this.pubAuto);
    if (Array.isArray(d.sumpSp) && d.sumpSp.length === 3) this.sumpSp = [Number(d.sumpSp[0]), Number(d.sumpSp[1]), Number(d.sumpSp[2])];
    if (Array.isArray(d.drainSp) && d.drainSp.length === 3) this.drainSp = [Number(d.drainSp[0]), Number(d.drainSp[1]), Number(d.drainSp[2])];
    if (Array.isArray(d.oilLeakSp) && d.oilLeakSp.length === 2) this.oilLeakSp = [Number(d.oilLeakSp[0]), Number(d.oilLeakSp[1])];
    if (d.autoSp1 && typeof d.autoSp1 === 'object') Object.assign(this.autoSp1, d.autoSp1);
    if (d.autoSp2 && typeof d.autoSp2 === 'object') Object.assign(this.autoSp2, d.autoSp2);
    if (Array.isArray(d.intake) && d.intake.length === 2) { this.intake[0] = Number(d.intake[0]); this.intake[1] = Number(d.intake[1]); }
    if (Array.isArray(d.intakeCmd) && d.intakeCmd.length === 2) { this.intakeCmd[0] = !!d.intakeCmd[0]; this.intakeCmd[1] = !!d.intakeCmd[1]; }
    this.simTime = num('simTime', this.simTime);
    this.gridWas = bool('gridWas', this.gridWas);

    const restoreRelays = (arr: Relay[], saved: unknown) => {
      if (!Array.isArray(saved)) return;
      const byCode = new Map<string, Record<string, unknown>>();
      for (const item of saved as Array<Record<string, unknown>>) if (item && typeof item.code === 'string') byCode.set(item.code, item);
      for (const r of arr) {
        const s = byCode.get(r.code);
        if (s) {
          r.t = Number(s.t) || 0;
          r.picked = !!s.picked;
          r.operated = !!s.operated;
        }
      }
    };
    if (Array.isArray(d.genProt)) {
      restoreRelays(this.genProt[0].all, d.genProt[0]);
      restoreRelays(this.genProt[1].all, d.genProt[1]);
    }
    if (Array.isArray(d.lineProt)) {
      restoreRelays(this.lineProt[0].all, d.lineProt[0]);
      restoreRelays(this.lineProt[1].all, d.lineProt[1]);
    }
    if (Array.isArray(d.tbaProt)) {
      restoreRelays(this.tbaProt[0].all, d.tbaProt[0]);
      restoreRelays(this.tbaProt[1].all, d.tbaProt[1]);
    }
  }
}
