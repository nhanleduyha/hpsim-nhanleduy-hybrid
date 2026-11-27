import { Cx } from './Cx';
import { PlantConfig } from './PlantConfig';

export enum GovMode {
  OFF = 'OFF',
  START = 'START',
  SPEED = 'SPEED',
  POWER = 'POWER',
  EMERGENCY = 'EMERGENCY',
}

function coerceIn(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Ngưỡng tự động bơm (từ lệnh YT của SD200 hoặc mặc định) */
export class AutoSp {
  oilAuto = true;
  oilMainStart = 3.7;
  oilStandbyStart = 3.5;
  oilStop = 3.95;
  hcAuto = true;
  hcMainStart = 180.0;
  hcStandbyStart = 240.0;
  hcStop = 80.0;
}

/**
 * Một tổ máy: đường ống – turbine Kaplan – rotor – điều tốc – kích từ – máy phát cực lồi (mô hình 1 trục),
 * mô hình nhiệt (stator, rotor, ổ trục, không khí làm mát, MBA khối) và thiết bị phụ (dầu áp lực HYZ, nước kỹ thuật, nước nắp turbine).
 * Đơn vị tương đối trên 10 MVA; ω = 1 ứng với 214,3 v/ph.
 */
export class HydroUnit {
  readonly no: number;
  private readonly cfg: () => PlantConfig;

  private get c(): PlantConfig {
    return this.cfg();
  }

  constructor(no: number, cfg: () => PlantConfig) {
    this.no = no;
    this.cfg = cfg;
  }

  // ---------------- Thuỷ lực, cơ ----------------
  omega = 0.0; delta = 0.0;
  gv = 0.0; blade = 0.0;
  q = 0.0; h = 1.0; hStatic = 1.0;
  pmMW = 0.0;
  brake = false;
  shearPin = false;
  get flowM3s(): number { return this.q * this.c.ratedFlowM3s; }
  get headM(): number { return this.h * this.c.ratedHeadM; }
  get rpm(): number { return this.omega * this.c.ratedRpm; }

  // ---------------- Điều tốc (Kaplan ZZJK508-LJ-280) ----------------
  govMode: GovMode = GovMode.OFF;
  govAuto = true;                 // true = AUTO (PID), false = MANUAL (mở tay cánh hướng)
  bladeAuto = true;               // true = AUTO (theo đường Cam), false = MANUAL (xoay cánh BXCT tay)
  gvManualTarget = 0.0;           // 0..1 đặt cánh hướng tay khi govAuto = false
  bladeManualDeg = -10.0;         // -10..+12° đặt góc cánh BXCT tay khi bladeAuto = false
  gvLimit = 1.0;                  // hạn chế độ mở cánh hướng (Opening Limiter, 0..1)
  gvTarget = 0.0;
  private govInt = 0.0;
  nref = 1.0;
  pSetMW = 0.0;
  prefMW = 0.0;
  servoLocked = false;
  govFail = false;                // điều tốc kẹt (sự cố giáo viên)
  private islandTimer = 0.0;
  private accelTimer = 0.0;
  private prevOmega = 0.0;
  islanded = false;
  loadRejectActive = false;       // đang đóng nhanh cánh hướng bằng gvEmergencyRate sau sa thải phụ tải
  private loadRejectPeakReached = false;
  private loadRejectTargetGv = 0.0;
  loadRejectBlock81O = false;     // khoá 81O trong quá trình quá độ sa thải phụ tải
  private loadRejectSettleTimer = 0.0;
  loadRejectPrePu = 0.0;          // công suất (pu turbine) ngay trước khi tách lưới
  loadRejectEvent = false;        // cờ 1 lần báo Physics ghi sự kiện & chuyển trình tự sang NOLOAD
  oilPressMPa = 4.0;

  /** Đường đặc tính phối hợp Cam Curve chuẩn hóa (0..1) theo độ mở cánh hướng GV và cột nước H (m) */
  camBladeNorm(gvPu: number, hM: number = this.headM): number {
    const hRef = Math.max(this.c.ratedHeadM, 5.0);
    const headCorr = coerceIn(((hRef - hM) / hRef) * 0.12, -0.08, 0.08);
    return coerceIn((gvPu - 0.15) / 0.75 + headCorr, 0.0, 1.0);
  }

  /** Góc xoay cánh BXCT thực tế (-10,0° đến +12,0°) */
  get bladeAngleDeg(): number { return -10.0 + this.blade * 22.0; }
  /** Góc xoay cánh BXCT tối ưu theo đường Cam hiện tại (°) */
  get bladeCamDeg(): number { return -10.0 + this.camBladeNorm(this.gv, this.headM) * 22.0; }
  /** Độ lệch góc cánh BXCT so với đường Cam (°) */
  get bladeDevDeg(): number { return this.bladeAngleDeg - this.bladeCamDeg; }
  /** Hiệu suất phối hợp Cam tương đối (%) */
  get offCamEffPct(): number {
    const devPu = this.blade - this.camBladeNorm(this.gv, this.headM);
    return coerceIn((1.0 - 0.25 * devPu * devPu) * 100.0, 60.0, 100.0);
  }
  /** Độ đảo / rung trục tuabin (mm) – tăng khi lệch Cam hoặc chạy vùng xoáy tải thấp / vượt tốc */
  get shaftVibMm(): number {
    if (this.omega < 0.05) return 0.0;
    const base = 0.06 + 0.04 * this.omega;
    const offCamVib = Math.abs(this.bladeDevDeg) * 0.018 * this.omega;
    const roughZone = this.gv >= 0.14 && this.gv <= 0.38 && this.omega > 0.7 ? 0.045 : 0.0;
    const overVib = this.omega > 1.05 ? (this.omega - 1.05) * 0.65 : 0.0;
    return coerceIn(base + offCamVib + roughZone + overVib, 0.0, 0.80);
  }

  // ---------------- Kích từ ----------------
  mk = true;                      // máy cắt dập từ Q1 (MK)
  excOn = false;
  private flashT = 0.0;
  efd = 0.0;
  private avrInt = 0.0;
  vref = 1.0;
  qSetMVAr = 0.0;
  qrefMVAr = 0.0;
  qControl = false;               // điều chỉnh Q (khi nối lưới)
  avrFail = 0;                    // 1 mất kích từ, 2 kích từ tăng vọt
  efdMaxTime = 0.0;
  private qWasOn = false;

  // ---------------- Máy phát ----------------
  eqp = 0.0; edp = 0.0;
  iT: Cx = Cx.ZERO; vT: Cx = Cx.ZERO;
  id = 0.0; iq = 0.0;
  pe = 0.0; peTerm = 0.0; qeTerm = 0.0;
  i2 = 0.0;                       // dòng thứ tự nghịch (pu)
  iaPu = 0.0; ibPu = 0.0; icPu = 0.0;
  get ePrime(): Cx {
    return new Cx(this.edp, this.eqp).times(Cx.polar(Math.max(this.omega, 0.0), this.delta - Math.PI / 2));
  }
  get present(): boolean { return this.omega > 0.02 || this.eqp > 0.005; }
  get ySrc(): Cx { return new Cx(this.c.ra, this.c.xd1).inv(); }
  get ifdPu(): number { return this.mk ? Math.max(0.0, this.eqp + (this.c.xd - this.c.xd1) * this.id) : 0.0; }
  get ifA(): number { return this.c.ifNoLoad * this.ifdPu * (1 + 0.07 * Math.max(0.0, this.ifdPu - 1)); }
  get ufV(): number {
    return (this.ifA * this.c.rotorROhm * (235 + coerceIn(this.tRotor, -20.0, 250.0))) / 250.0;
  }

  // ---------------- Nhiệt (°C) ----------------
  tCoil = 30.0; tCore = 30.0; tRotor = 30.0;
  tColdAir = 30.0; tHotAir = 30.0;
  tThrustOil = 30.0; tUpperOil = 30.0; tLowerOil = 30.0; tTurbOil = 30.0;
  tThrustPad = 30.0; tUpperPad = 30.0; tLowerPad = 30.0; tTurbPad = 30.0;
  tTrOil = 30.0; tTrWinding = 30.0;
  thrustFaultK = 1.0;             // hệ số ma sát ổ (sự cố giáo viên)
  coolerFouling = 1.0;            // hệ số trao đổi nhiệt bộ làm mát không khí
  lossStatorKW = 0.0; lossRotorKW = 0.0; lossCoreKW = 0.0;

  // ---------------- Thiết bị phụ ----------------
  oilVol = 0.875;                 // dầu trong bình áp lực (m³)
  oilPump: [boolean, boolean] = [false, false];
  oilPumpFail = false;
  oilLeak = false;
  cwFlow = 0.0;                   // 0..1
  cwPressMPa = 0.0;
  headCoverMM = 100.0;
  hcPump: [boolean, boolean] = [false, false];
  hcForceDrain = false;
  hcPumpFail = false;
  leakFault = false;
  sealAir = true;                 // khí đệm kín sửa chữa (đang cấp)
  heater = false;

  servoStroke = 0.0;
  private pFilt = 0.0;
  private wFilt = 0.0;
  private wSlow = 1.0;
  private govDer = 0.0;
  private gvCmd = 0.0;
  private rampRef = 1.0;
  tmPu = 0.0;
  cwRun = false;
  cwFail = false;

  // =====================================================================
  /** Một bước thuỷ lực – cơ – điều tốc – kích từ – máy phát (dt ≈ 10 ms). gridStiff: tổ máy đang nối với lưới hệ thống. */
  stepFast(dt: number, gridStiff: boolean, connected: boolean, sysFreqPu: number, busFreqPu: number = this.omega): void {
    this.governor(dt, gridStiff, connected);
    this.hydraulics(dt);
    this.machine(dt);      // mô-men điện từ theo dòng vừa giải lưới (không trễ một bước)
    this.rotor(dt, sysFreqPu, busFreqPu);
    this.exciter(dt, gridStiff);
  }

  /** Độ mở cánh hướng cân bằng (pu) ứng với công suất điện đầu cực pePu (pu trên genMVA) tại cột nước tĩnh hh */
  private gateForPower(pePu: number, hh: number): number {
    const h0 = Math.max(hh, 0.3);
    const pTurbPu = Math.max(((Math.max(pePu, 0.0) + this.c.frictionPu) * this.c.genMVA) / this.c.turbineMW, 0.0);
    const q0 = (pTurbPu * (1.0 - this.c.qNoLoad)) / h0 + this.c.qNoLoad;
    const hEff = Math.max(h0 - this.c.headLossCoef * q0 * q0, 0.2);
    const qNeed = (pTurbPu * (1.0 - this.c.qNoLoad)) / hEff + this.c.qNoLoad;
    return coerceIn((qNeed / Math.sqrt(hEff) / this.c.gateFullPu) * this.c.gvMax, 0.0, this.c.gvMax);
  }

  // ---------------- Điều tốc: PID tốc độ (Kp, Ki, Kd) / PI công suất, sa thải phụ tải, chống bão hoà tích phân ----------------
  private governor(dt: number, gridStiff: boolean, connected: boolean): void {
    // tải đặt tăng giảm theo tốc độ nhận tải
    const step = this.c.pRampMWs * dt;
    this.prefMW += coerceIn(this.pSetMW - this.prefMW, -step, step);
    const prefPu = this.prefMW / this.c.turbineMW;
    this.pFilt += (this.pe - this.pFilt) * Math.min(1.0, dt / 1.0);
    const prevWFilt = this.wFilt;
    this.wFilt += (this.omega - this.wFilt) * Math.min(1.0, dt / 0.2);
    const dOmegaDt = dt > 1e-6 && this.prevOmega > 0.0 ? (this.omega - this.prevOmega) / dt : 0.0;
    this.prevOmega = this.omega;
    const pePu = (this.pFilt * this.c.genMVA) / this.c.turbineMW;
    const bp = Math.max(this.c.govBp, 0.005);
    const gvCap = Math.min(this.c.gvMax, coerceIn(this.gvLimit, 0.0, 1.0));

    // Khâu tiền khiển theo cột nước tĩnh và tần số chậm (dùng chung cho POWER & bumpless transfer)
    const hh = Math.max(this.hStatic, 0.3);
    const gNeed = ((((prefPu * (1 - this.c.qNoLoad)) / hh + this.c.qNoLoad) / Math.sqrt(hh)) / this.c.gateFullPu) * this.c.gvMax;
    this.wSlow += (this.omega - this.wSlow) * Math.min(1.0, dt / 2.0);
    const rawDw = 1.0 - this.wSlow;
    const dw = Math.abs(rawDw) < 0.0004 ? 0.0 : rawDw - 0.0004 * Math.sign(rawDw);
    const ePower = (prefPu - pePu) + dw / bp;

    // Khâu vi phân lọc trên tín hiệu đo tốc độ (-dω/dt) tránh derivative kick
    const td = 0.4;
    this.govDer = coerceIn((td * this.govDer - this.c.govKd * (this.wFilt - prevWFilt)) / (td + dt), -0.4, 0.4);

    // Phát hiện SA THẢI PHỤ TẢI khi đang ở chế độ POWER:
    // 1) MC 33x cắt / mất lưới cứng (gridStiff = false)
    // 2) Gia tốc rôto > 1 %/s (0,01 pu/s) kéo dài 0,15 s
    // 3) |Δf| > 0,5 Hz (|ω - 1| > 0,01 pu) trong 0,5 s
    if (this.govMode === GovMode.POWER) {
      if (dOmegaDt > 0.01 && (!gridStiff || this.omega > 1.004)) this.accelTimer += dt;
      else this.accelTimer = 0.0;
      if (Math.abs(this.omega - 1.0) > 0.01) this.islandTimer += dt;
      else this.islandTimer = 0.0;
      if (!gridStiff || this.accelTimer >= 0.15 || this.islandTimer >= 0.5) {
        const peNow = Math.max(this.vT.times(this.iT.conj()).re, 0.0);
        this.loadRejectPrePu = Math.max((this.pFilt * this.c.genMVA) / this.c.turbineMW, 0.0);
        const gNoLoad = coerceIn(this.gateForPower(0.0, hh), 0.0, gvCap);
        const gRem = coerceIn(Math.max(gNoLoad, this.gateForPower(peNow, hh)), 0.0, gvCap);
        this.govMode = GovMode.SPEED;
        this.nref = 1.0; this.rampRef = 1.0;
        this.pSetMW = 0.0; this.prefMW = 0.0;
        this.pFilt = peNow;
        this.islanded = true;
        this.islandTimer = 0.0; this.accelTimer = 0.0;
        this.govInt = gRem;
        this.govDer = 0.0;
        this.loadRejectEvent = true;
        this.loadRejectBlock81O = true;
        this.loadRejectSettleTimer = 0.0;
        this.loadRejectTargetGv = gRem;
        if (this.gv - gRem > 0.15) {
          this.loadRejectActive = true;
          this.loadRejectPeakReached = this.omega >= 1.02;
        } else {
          this.loadRejectActive = false;
          this.loadRejectPeakReached = false;
        }
      }
    } else {
      this.accelTimer = 0.0; this.islandTimer = 0.0;
    }

    if (this.govMode === GovMode.SPEED && gridStiff) {
      // Chuyển không giật (Bumpless Transfer) khi MC 331/332 vừa đóng hòa lưới cứng
      this.govMode = GovMode.POWER;
      this.govInt = coerceIn(this.gv - gNeed - this.c.powerKp * ePower, -0.5, 0.5);
      this.islanded = false;
      this.loadRejectActive = false;
      this.loadRejectPeakReached = false;
      this.loadRejectBlock81O = false;
      this.loadRejectSettleTimer = 0.0;
    }

    // Cập nhật trạng thái đóng nhanh sa thải phụ tải & cửa sổ khoá 81O
    if (this.loadRejectActive) {
      if (this.omega >= 1.02) this.loadRejectPeakReached = true;
      const doneFastClose =
        this.govMode !== GovMode.SPEED ||
        !this.govAuto ||
        (this.omega < 1.02 && (this.loadRejectPeakReached || (this.gv <= this.loadRejectTargetGv + 0.01 && dOmegaDt <= 0.0)));
      if (doneFastClose) {
        this.loadRejectActive = false;
        this.loadRejectPeakReached = false;
      }
    }
    if (this.loadRejectBlock81O) {
      if (this.govMode === GovMode.OFF || this.govMode === GovMode.EMERGENCY || gridStiff) {
        this.loadRejectBlock81O = false; this.loadRejectSettleTimer = 0.0;
      } else if (!this.loadRejectActive && Math.abs(this.omega - 1.0) <= 0.01) {
        this.loadRejectSettleTimer += dt;
        if (this.loadRejectSettleTimer >= 3.0) {
          this.loadRejectBlock81O = false; this.loadRejectSettleTimer = 0.0;
        }
      } else {
        this.loadRejectSettleTimer = 0.0;
      }
    }

    // thiết bị chống vượt tốc điện: > min(110%, overspeed1) đóng nhanh cánh hướng (ưu tiên cao hơn cả MANUAL)
    const overspeed = this.omega > Math.min(1.10, Math.max(this.c.relay.overspeed1, 1.05));

    if (!this.govAuto && this.govMode !== GovMode.EMERGENCY) {
      // Chế độ BẰNG TAY (MANUAL): đặt trực tiếp độ mở cánh hướng, giữ tích phân bám theo chế độ (chuyển MANUAL -> AUTO không giật)
      this.gvTarget = coerceIn(this.gvManualTarget, 0.0, gvCap);
      this.govInt = this.govMode === GovMode.POWER ? coerceIn(this.gv - gNeed, -0.5, 0.5) : coerceIn(this.gv, 0.0, gvCap);
    } else {
      switch (this.govMode) {
        case GovMode.OFF:
        case GovMode.EMERGENCY:
          this.gvTarget = 0.0; this.govInt = 0.0; this.govDer = 0.0;
          this.loadRejectActive = false; this.loadRejectPeakReached = false;
          break;
        case GovMode.START:
          // mở tới độ mở khởi động, gần định mức thì về độ mở không tải
          this.gvTarget = Math.min(
            this.omega < 0.6
              ? this.c.gvStartOpening
              : this.c.gvStartOpening - ((this.omega - 0.6) / 0.25) * (this.c.gvStartOpening - 0.10),
            gvCap,
          );
          if (this.omega >= 0.85) {
            this.govMode = GovMode.SPEED;
            this.govInt = coerceIn(this.gv, 0.0, gvCap);
            this.rampRef = this.omega;
          }
          break;
        case GovMode.SPEED: {
          // PID tốc độ (Kp, Ki, Kd): bỏ droop khi chạy độc lập (islanded)
          const droop = connected && !this.islanded ? bp * (prefPu - pePu) : 0.0;
          this.rampRef = Math.min(this.nref, this.rampRef + 0.02 * dt);
          const e = Math.min(this.nref, this.rampRef) - this.wFilt + droop;
          const kp = this.islanded && this.c.islandKp > 0.0 ? this.c.islandKp : this.c.govKp;
          const ki = this.islanded && this.c.islandKi > 0.0 ? this.c.islandKi : this.c.govKi;
          const rawOut = kp * e + this.govInt + this.govDer;
          // Chống bão hoà tích phân: KHÔNG tích phân khi đầu ra bão hoà, servo bị giới hạn tốc độ cùng chiều sai lệch,
          // vượt tốc 110 % đang ép đóng, hoặc đang đóng nhanh do sa thải phụ tải
          const outSaturated = (rawOut >= gvCap && e > 0.0) || (rawOut <= 0.0 && e < 0.0);
          const rateLimited = Math.abs(this.gvCmd - this.gv) > 0.02 && (this.gvCmd - this.gv) * e > 0.0;
          if (!outSaturated && !rateLimited && !overspeed && !this.loadRejectActive && !this.servoLocked && !this.govFail) {
            this.govInt = coerceIn(this.govInt + ki * e * dt, 0.0, gvCap);
          }
          this.gvTarget = coerceIn(kp * e + this.govInt + this.govDer, 0.0, gvCap);
          if (this.loadRejectActive) {
            const fastFloor =
              this.loadRejectTargetGv <= this.gateForPower(0.0, hh) + 0.03 && this.omega >= 1.02
                ? 0.0
                : this.loadRejectTargetGv;
            this.gvTarget = Math.min(this.gvTarget, fastFloor);
          }
          break;
        }
        case GovMode.POWER: {
          // tiếp dẫn theo cột nước + PI công suất + đáp ứng tần số theo độ dốc tĩnh PlantConfig.govBp
          const rawOut = gNeed + this.c.powerKp * ePower + this.govInt;
          if ((rawOut < gvCap || ePower < 0.0) && (rawOut > 0.0 || ePower > 0.0)) {
            this.govInt = coerceIn(this.govInt + this.c.powerKi * ePower * dt, -0.5, 0.5);
          }
          this.gvTarget = coerceIn(gNeed + this.c.powerKp * ePower + this.govInt, 0.0, gvCap);
          break;
        }
      }
    }
    if (overspeed) this.gvTarget = 0.0;
    if (this.govFail) return;    // điều tốc kẹt: cánh hướng đứng yên
    // servo: phụ thuộc áp lực dầu, khoá cánh hướng (Điều 21 Bước 3 & Điều 25 Bước 6)
    const oilK = coerceIn((this.oilPressMPa - 1.5) / 1.5, 0.0, 1.0);
    if (this.servoLocked) {
      this.gvTarget = 0.0;
      if (this.gv <= 0.005) { this.gv = 0.0; this.gvCmd = 0.0; }
    }
    const fastClose = this.govMode === GovMode.EMERGENCY || overspeed || this.loadRejectActive;
    const up = this.c.gvOpenRate * oilK * dt;
    const dn = (fastClose ? this.c.gvEmergencyRate : this.c.gvCloseRate) * Math.max(oilK, 0.3) * dt;
    this.gvCmd += (this.gvTarget - this.gvCmd) * Math.min(1.0, dt / 0.3);
    if (fastClose && this.gvTarget < this.gvCmd) this.gvCmd = this.gvTarget;
    const old = this.gv;
    this.gv += coerceIn(this.gvCmd - this.gv, -dn, up);
    if (this.servoLocked) this.gv = old <= 0.005 ? 0.0 : Math.min(this.gv, old);
    this.servoStroke += Math.abs(this.gv - old);
    // cánh xoay Kaplan theo đường phối hợp Cam Curve hoặc đặt tay (-10°..+12°)
    const bTarget = this.bladeAuto
      ? this.camBladeNorm(this.gv, this.headM)
      : coerceIn((this.bladeManualDeg + 10.0) / 22.0, 0.0, 1.0);
    const oldBlade = this.blade;
    const bRate = 0.05 * Math.max(oilK, 0.2) * dt;
    this.blade += coerceIn(bTarget - this.blade, -bRate, bRate);
    this.servoStroke += Math.abs(this.blade - oldBlade) * 0.6;
  }

  // ---------------- Cột nước không đàn hồi + turbine (mô hình IEEE phi tuyến) ----------------
  private hydraulics(dt: number): void {
    const g = (this.gv / this.c.gvMax) * this.c.gateFullPu * (this.shearPin ? 0.96 : 1.0);
    if (g < 1e-3) {
      this.q -= this.q * Math.min(1.0, dt / 0.3);
      this.h = this.hStatic;
    } else {
      const a = 1 / (g * g) + this.c.headLossCoef;
      const b = this.c.tw / dt;
      const cc = -(this.c.tw / dt) * this.q - this.hStatic;
      this.q = Math.max((-b + Math.sqrt(b * b - 4 * a * cc)) / (2 * a), 0.0);
      this.h = (this.q / g) * (this.q / g);
    }
    // Kaplan: lệch phối hợp Cam Curve làm giảm hiệu suất thuỷ lực; cột nước dưới minHeadM giảm hiệu suất xâm thực
    const bladeIdeal = this.camBladeNorm(this.gv, this.headM);
    const offCam = 1 - 0.25 * (this.blade - bladeIdeal) * (this.blade - bladeIdeal);
    const hActM = this.hStatic * this.c.ratedHeadM;
    const headEff =
      hActM < this.c.minHeadM && this.c.minHeadM > 1.0
        ? 1.0 - 0.15 * coerceIn((this.c.minHeadM - hActM) / this.c.minHeadM, 0.0, 1.0)
        : 1.0;
    // công suất ở tốc độ định mức (pu turbine), mô-men giảm tuyến tính theo tốc độ tới tốc độ lồng
    const p1 = ((this.h * (this.q - this.c.qNoLoad)) / (1 - this.c.qNoLoad)) * offCam * headEff;
    const wr = Math.max(this.c.runawayRpm / this.c.ratedRpm, 1.2);
    // Mất cột nước (cửa nhận nước đóng, đường ống tháo cạn): bánh xe công tác vẫn ngập nước hạ lưu,
    // quay khuấy nước sinh mô-men cản ~ n² -> tổ máy hút công suất từ lưới (chạy động cơ) -> bảo vệ 32 tác động
    const churn = this.c.churnLossPu * this.omega * this.omega * Math.min(1, Math.max(0, 1 - this.hStatic));
    const tTurb = (p1 * (1 - this.omega / wr)) / (1 - 1 / wr) - churn;
    this.tmPu = (tTurb * this.c.turbineMW) / this.c.genMVA;
    this.pmMW = this.tmPu * this.omega * this.c.genMVA;
  }

  // ---------------- Phương trình chuyển động quay ----------------
  private rotor(dt: number, sysFreqPu: number, busFreqPu: number): void {
    const w = Math.max(this.omega, 0.05);
    // cuộn cản: mô-men cản tỉ lệ độ trượt so với tần số lưới đầu cực
    const vt2 = this.vT.abs() * this.vT.abs();
    let damper = 0.0;
    if (busFreqPu > 0.5 && this.eqp > 0.05) {
      damper = 15.0 * (this.omega - busFreqPu);
    } else if (busFreqPu > 0.5 && vt2 > 0.01) {
      // không từ thông mà stator có điện: mô-men không đồng bộ của cuộn cản (máy chạy như động cơ cảm ứng)
      damper = coerceIn(15.0 * (this.omega - busFreqPu) * vt2, -1.2 * vt2, 1.2 * vt2);
    }
    let torque = this.tmPu - this.pe / w - this.c.frictionPu * this.omega - damper;
    if (this.brake && this.omega > 0) torque -= 0.08;
    this.omega += (torque / (2 * this.c.inertiaH)) * dt;
    if (this.omega < 0) this.omega = 0.0;
    this.delta += 2 * Math.PI * 50 * (this.omega - sysFreqPu) * dt;
    if (this.delta > Math.PI) this.delta -= 2 * Math.PI;
    else if (this.delta < -Math.PI) this.delta += 2 * Math.PI;
  }

  // ---------------- Kích từ tĩnh + AVR (PI), điều chỉnh Q khi nối lưới ----------------
  private exciter(dt: number, gridStiff: boolean): void {
    const vt = this.vT.abs();
    if (!this.mk || !this.excOn) {
      this.efd = 0.0; this.avrInt = 0.0; this.flashT = 0.0; this.efdMaxTime = 0.0;
      return;
    }
    if (this.avrFail === 1) { this.efd = 0.0; return; }
    if (this.avrFail === 2) { this.efd = this.c.efdMax * coerceIn(vt, 0.0, 1.2); this.efdMaxTime += dt; return; }
    // dưới 50 % tốc độ: khoá kích từ (dừng máy); từ 50–90 % kích từ vẫn làm việc, điện áp bị giới hạn V/Hz
    if (this.omega < 0.5) { this.efd = 0.0; this.flashT = 0.0; return; }
    if (this.flashT < this.c.flashSec && this.omega < 0.9) { this.efd = 0.0; return; }   // chỉ mồi từ khi tốc độ đạt 90 %
    // mồi từ ban đầu 15 A trong 3 s
    if (this.flashT < this.c.flashSec) {
      this.flashT += dt;
      this.efd = this.c.ifFlash / this.c.ifNoLoad;
      this.avrInt = this.efd;
      return;
    }
    // điều chỉnh Q: đổi điện áp đặt chậm theo sai lệch Q
    const step = this.c.qRampMVArs * dt;
    this.qrefMVAr += coerceIn(this.qSetMVAr - this.qrefMVAr, -step, step);
    if (this.qControl && gridStiff) {
      if (!this.qWasOn) { this.qrefMVAr = this.qeTerm * this.c.genMVA; this.qWasOn = true; }
      const qNow = this.qeTerm * this.c.genMVA;
      this.vref = coerceIn(this.vref + (this.c.qKi * (this.qrefMVAr - qNow)) / this.c.genMVA * dt, 0.92, 1.10);
      // chống bão hoà: điện áp đặt đã chạm giới hạn thì Q đặt bám theo Q thực (không tích luỹ sai lệch)
      if ((this.vref >= 1.10 && this.qrefMVAr > qNow) || (this.vref <= 0.92 && this.qrefMVAr < qNow)) this.qrefMVAr = qNow;
    } else {
      this.qWasOn = false;
    }
    const vrefEff = Math.min(this.vref, this.omega * 1.10);   // giới hạn V/Hz 1,1 pu
    const e = vrefEff - vt;
    // kích từ tự kích song song: cầu thyristor lấy nguồn qua MBA kích từ từ đầu cực 6,3 kV -> trần kích từ tỉ lệ điện áp đầu cực
    const ceil = this.c.efdMax * coerceIn(vt, 0.0, 1.2);
    this.avrInt = coerceIn(this.avrInt + this.c.avrKi * e * dt, 0.0, ceil);
    this.efd = coerceIn(this.c.avrKp * e + this.avrInt, 0.0, ceil);
    if (vt > 0.8 && this.efd >= ceil - 1e-6) this.efdMaxTime += dt;
    else this.efdMaxTime = 0.0;
  }

  // ---------------- Máy phát cực lồi mô hình 1 trục (E'q, E'd) ----------------
  private machine(dt: number): void {
    const rot = Cx.polar(1.0, -(this.delta - Math.PI / 2));
    const idq = this.iT.times(rot);
    this.id = idq.re; this.iq = idq.im;
    if (this.omega < 0.3 && !this.excOn) {
      // rotor gần đứng yên: hệ trục d-q không còn đồng bộ, bỏ phản ứng phần ứng, từ thông dư tắt dần
      this.eqp -= this.eqp * Math.min(1.0, dt / 0.5);
      this.edp -= this.edp * Math.min(1.0, dt / 0.2);
    } else if (!this.mk) {
      // máy cắt dập từ mở: điện trở dập từ, từ thông tắt nhanh (≈ 0,5 s)
      this.eqp -= this.eqp * Math.min(1.0, dt / 0.5);
      this.edp -= this.edp * Math.min(1.0, dt / 0.2);
    } else {
      this.eqp += ((this.efd - this.eqp - (this.c.xd - this.c.xd1) * this.id) / Math.max(this.c.td0, 0.5)) * dt;
      // mô hình cực lồi 2 trục (Xq, T'q0): phản ánh mô-men từ trở trục ngang, kẹp giới hạn để ổn định số
      this.edp = coerceIn(
        this.edp + ((-this.edp + (this.c.xq - this.c.xd1) * this.iq) / Math.max(this.c.tq0, 0.05)) * dt,
        -0.8,
        0.8,
      );
    }
    // từ dư khi quay không kích từ ≈ 1 %
    if (this.eqp < 0.01 && this.omega > 0.3 && this.mk) this.eqp = 0.01;
    if (this.eqp < 0) this.eqp = 0.0;
    if (this.eqp > 2.5) this.eqp = 2.5;
    this.pe = this.ePrime.times(this.iT.conj()).re;
    const s = this.vT.times(this.iT.conj());
    this.peTerm = s.re; this.qeTerm = s.im;
  }

  // =====================================================================
  /** Nhiệt và thiết bị phụ, dt thật (s); auxOk: có điện tự dùng 0,4 kV */
  stepSlow(dt: number, auxOk: boolean, cwInC: number, ambC: number, autoSp: AutoSp): void {
    // ---- nước kỹ thuật ----
    const cwTarget = this.cwRun && auxOk && !this.cwFail ? 1.0 : 0.0;
    this.cwFlow += (cwTarget - this.cwFlow) * Math.min(1.0, dt / 3.0);
    this.cwPressMPa = 0.32 * this.cwFlow;

    // ---- dầu áp lực HYZ: bình khí – dầu, PV^1,4 = const ----
    const consume = this.servoStroke * 0.0434 + (0.00025 + (this.oilLeak ? 0.002 : 0.0)) * dt;
    this.servoStroke = 0.0;
    if (autoSp.oilAuto && auxOk) {
      if (this.oilPressMPa <= autoSp.oilMainStart) this.oilPump[0] = true;
      if (this.oilPressMPa <= autoSp.oilStandbyStart) this.oilPump[1] = true;
      if (this.oilPressMPa >= autoSp.oilStop) { this.oilPump[0] = false; this.oilPump[1] = false; }
    }
    const pumping =
      (this.oilPump[0] && auxOk && !this.oilPumpFail ? 0.004 : 0.0) +
      (this.oilPump[1] && auxOk && !this.oilPumpFail ? 0.004 : 0.0);
    this.oilVol = coerceIn(this.oilVol + pumping * dt - consume, 0.05, 1.6);
    this.oilPressMPa = 4.0 * Math.pow(1.625 / (2.5 - this.oilVol), 1.4);
    if (this.oilPressMPa > 4.3) { this.oilVol -= 0.002; this.oilPressMPa = 4.3; }   // van an toàn

    // ---- nước nắp turbine ----
    const leakIn =
      0.0006 * Math.sqrt(Math.max(this.hStatic, 0.0)) * (this.omega > 0.05 ? 1.0 : 0.3) +
      (this.leakFault ? 0.006 : 0.0);
    if (this.hcForceDrain) {
      const hcLow = Math.min(autoSp.hcStop, 20.0);
      if (!auxOk || this.headCoverMM <= hcLow) {
        this.hcForceDrain = false;
        this.hcPump[0] = false; this.hcPump[1] = false;
      } else {
        this.hcPump[0] = true; this.hcPump[1] = true;
      }
    } else if (autoSp.hcAuto && auxOk) {
      if (this.headCoverMM >= autoSp.hcMainStart) this.hcPump[0] = true;
      if (this.headCoverMM >= autoSp.hcStandbyStart) this.hcPump[1] = true;
      if (this.headCoverMM <= autoSp.hcStop) { this.hcPump[0] = false; this.hcPump[1] = false; }
    }
    const out =
      (this.hcPump[0] && auxOk && !this.hcPumpFail ? 0.004 : 0.0) +
      (this.hcPump[1] && auxOk && !this.hcPumpFail ? 0.004 : 0.0);
    this.headCoverMM = coerceIn(this.headCoverMM + ((leakIn - out) * dt / 2.0) * 1000, 0.0, 1500.0);

    this.thermal(dt * this.c.thermalSpeed, cwInC, ambC);
  }

  // ---------------- Mô hình nhiệt nhiều khối ----------------
  private thermal(dt: number, cwIn: number, amb: number): void {
    const iA = Math.min(this.iT.abs(), 8.0) * this.c.genA;
    const rs = (this.c.statorROhm * (235 + Math.min(this.tCoil, 250.0))) / 250.0;
    this.lossStatorKW = (3 * iA * iA * rs) / 1000;
    const vt = this.vT.abs();
    const vtC = Math.min(vt, 1.6);
    this.lossCoreKW = this.omega > 0.2 ? 55.0 * (vtC * vtC) * Math.min(this.omega, 2.0) : 0.0;
    const ifC = Math.min(this.ifA, 1200.0);
    const i2C = Math.min(this.i2, 3.0);
    this.lossRotorKW =
      (ifC * ifC * this.c.rotorROhm * (235 + Math.min(this.tRotor, 250.0))) / 250.0 / 1000 +
      400 * (i2C * i2C);
    const windage = 40.0 * this.omega * this.omega * this.omega;
    const genLoss = this.lossStatorKW + this.lossCoreKW + this.lossRotorKW + windage;

    const fc = this.cwFlow * this.coolerFouling;
    const ua = 30.0 * fc + 5.0;
    const coldTarget = cwIn + genLoss / ua;
    this.tColdAir += (coldTarget - this.tColdAir) * Math.min(1.0, dt / 400.0);
    const vent = this.omega > 0.2 ? 15.0 * this.omega : 3.0;
    this.tHotAir = this.tColdAir + genLoss / vent;
    // cuộn dây, lõi thép, rotor (C·dT/dt = P - ΔT/R)
    this.tCoil += ((this.lossStatorKW - (this.tCoil - this.tColdAir) / 1.49) / 600.0) * dt;
    this.tCore += ((this.lossCoreKW - (this.tCore - this.tColdAir) / 0.55) / 3300.0) * dt;
    this.tRotor += ((this.lossRotorKW - (this.tRotor - this.tColdAir) / 1.08) / 555.0) * dt;

    // ổ trục: dầu – nước làm mát, séc măng
    const w2 = this.omega * this.omega;
    const load = Math.max(this.pmMW / this.c.turbineMW, 0.0);
    const pThrust = (25.0 * w2 + 15.0 * load * Math.min(w2, 1.0) + (this.omega > 0.02 ? 3.0 : 0.0)) * this.thrustFaultK;
    const pUpper = 8.0 * w2; const pLower = 8.0 * w2; const pTurb = 10.0 * w2;
    const oil = (t: number, p: number, uaO: number, cap: number) =>
      t + ((p - uaO * this.cwFlow * (t - cwIn) - 0.15 * (t - amb)) / cap) * dt;
    this.tThrustOil = oil(this.tThrustOil, pThrust, 2.67, 3200.0);
    this.tUpperOil = oil(this.tUpperOil, pUpper, 0.53, 900.0);
    this.tLowerOil = oil(this.tLowerOil, pLower, 0.53, 900.0);
    this.tTurbOil = oil(this.tTurbOil, pTurb, 0.77, 1000.0);
    this.tThrustPad = this.tThrustOil + pThrust * 0.25;
    this.tUpperPad = this.tUpperOil + pUpper * 1.0;
    this.tLowerPad = this.tLowerOil + pLower * 1.0;
    this.tTurbPad = this.tTurbOil + pTurb * 0.7;

    // MBA khối ONAN: dầu lớp trên, điểm nóng cuộn dây
    const k = Math.min(this.iT.abs(), 5.0);
    const pTr = this.c.trP0KW * (vt > 0.1 ? 1.0 : 0.0) + this.c.trPkKW * k * k;
    this.tTrOil += ((pTr - (this.tTrOil - amb) / 0.64) / 10180.0) * dt;
    this.tTrWinding = this.tTrOil + 23.0 * Math.pow(k, 1.6);
  }

  coldStart(amb: number): void {
    this.tCoil = amb; this.tCore = amb; this.tRotor = amb; this.tColdAir = amb; this.tHotAir = amb;
    this.tThrustOil = amb; this.tUpperOil = amb; this.tLowerOil = amb; this.tTurbOil = amb;
    this.tThrustPad = amb; this.tUpperPad = amb; this.tLowerPad = amb; this.tTurbPad = amb;
    this.tTrOil = amb; this.tTrWinding = amb;
  }

  /** Đặt tổ máy về trạng thái dừng hoàn toàn (dùng cho kịch bản thực hành) */
  presetStopped(amb = 28.0): void {
    this.omega = 0.0; this.delta = 0.0; this.gv = 0.0; this.gvTarget = 0.0; this.gvCmd = 0.0; this.blade = 0.0;
    this.govAuto = true; this.bladeAuto = true; this.gvManualTarget = 0.0; this.bladeManualDeg = -10.0; this.gvLimit = 1.0;
    this.q = 0.0; this.h = 1.0; this.hStatic = 1.0; this.pmMW = 0.0; this.tmPu = 0.0;
    this.govMode = GovMode.OFF; this.govInt = 0.0; this.govDer = 0.0; this.nref = 1.0; this.pSetMW = 0.0; this.prefMW = 0.0;
    this.pFilt = 0.0; this.wFilt = 0.0; this.wSlow = 1.0; this.rampRef = 1.0; this.islanded = false; this.islandTimer = 0.0;
    this.accelTimer = 0.0; this.prevOmega = 0.0; this.loadRejectActive = false; this.loadRejectPeakReached = false;
    this.loadRejectTargetGv = 0.0; this.loadRejectBlock81O = false; this.loadRejectSettleTimer = 0.0; this.loadRejectEvent = false;
    this.excOn = false; this.flashT = 0.0; this.efd = 0.0; this.avrInt = 0.0; this.vref = 1.0;
    this.qSetMVAr = 0.0; this.qrefMVAr = 0.0; this.qControl = false; this.qWasOn = false; this.efdMaxTime = 0.0;
    this.eqp = 0.0; this.edp = 0.0; this.iT = Cx.ZERO; this.vT = Cx.ZERO; this.id = 0.0; this.iq = 0.0;
    this.pe = 0.0; this.peTerm = 0.0; this.qeTerm = 0.0; this.i2 = 0.0; this.iaPu = 0.0; this.ibPu = 0.0; this.icPu = 0.0;
    this.cwRun = false; this.cwFlow = 0.0; this.cwPressMPa = 0.0;
    this.oilVol = 0.875; this.oilPressMPa = 4.0; this.oilPump[0] = false; this.oilPump[1] = false;
    this.headCoverMM = 100.0; this.hcPump[0] = false; this.hcPump[1] = false; this.hcForceDrain = false;
    this.coldStart(amb);
  }

  /** Đặt tổ máy vào trạng thái xác lập đang quay / phát điện (không thay đổi phương trình nhiệt) */
  presetSteady(pMW: number, qMVAr: number, gridConnected: boolean, excited: boolean, gridAngle: number): void {
    this.omega = 1.0; this.nref = 1.0; this.wFilt = 1.0; this.wSlow = 1.0; this.govDer = 0.0; this.rampRef = 1.0;
    this.govAuto = true; this.bladeAuto = true; this.gvLimit = 1.0;
    this.islanded = false; this.islandTimer = 0.0; this.accelTimer = 0.0; this.prevOmega = 1.0;
    this.loadRejectActive = false; this.loadRejectPeakReached = false; this.loadRejectTargetGv = 0.0;
    this.loadRejectBlock81O = false; this.loadRejectSettleTimer = 0.0; this.loadRejectEvent = false;
    const pPu = coerceIn(pMW / this.c.turbineMW, 0.0, 1.05);
    const gNeed = gridConnected
      ? coerceIn(((pPu * (1 - this.c.qNoLoad) + this.c.qNoLoad) / this.c.gateFullPu) * this.c.gvMax, 0.10, this.c.gvMax)
      : 0.12;
    this.gv = gNeed; this.gvTarget = gNeed; this.gvCmd = gNeed; this.gvManualTarget = gNeed;
    this.blade = this.camBladeNorm(this.gv, this.c.ratedHeadM); this.bladeManualDeg = this.bladeAngleDeg;
    this.q = Math.max((gNeed / this.c.gvMax) * this.c.gateFullPu, 0.0); this.h = 1.0; this.hStatic = 1.0;
    this.pSetMW = pMW; this.prefMW = pMW; this.pFilt = pMW / this.c.genMVA;
    this.pe = pMW / this.c.genMVA; this.peTerm = pMW / this.c.genMVA; this.qeTerm = qMVAr / this.c.genMVA;
    this.pmMW = pMW; this.tmPu = this.pe;
    this.govMode = gridConnected ? GovMode.POWER : GovMode.SPEED;
    this.govInt = gridConnected ? 0.0 : gNeed;
    this.mk = true; this.excOn = excited; this.flashT = excited ? this.c.flashSec + 1.0 : 0.0;
    this.vref = 1.0; this.qSetMVAr = qMVAr; this.qrefMVAr = qMVAr; this.qControl = gridConnected; this.qWasOn = gridConnected;
    this.eqp = excited ? coerceIn(1.0 + (0.12 * qMVAr) / 10.0, 0.95, 1.35) : 0.01;
    this.edp = 0.0;
    this.efd = excited ? coerceIn(this.eqp + 0.12 * pPu, 1.0, 2.2) : 0.0;
    this.avrInt = this.efd; this.efdMaxTime = 0.0;
    this.delta = gridAngle + (gridConnected ? (pMW / 8.0) * 0.36 : 0.20);
    this.vT = Cx.polar(excited ? 1.0 : 0.01, this.delta);
    this.brake = false; this.servoLocked = false; this.sealAir = false;
    this.cwRun = true; this.cwFlow = 1.0; this.cwPressMPa = 0.32;
    this.oilVol = 0.875; this.oilPressMPa = 4.0; this.oilPump[0] = false; this.oilPump[1] = false;
    this.headCoverMM = 90.0; this.hcPump[0] = false; this.hcPump[1] = false; this.hcForceDrain = false;
    const loadF = coerceIn(pMW / 8.0, 0.0, 1.0);
    this.tColdAir = 30.0 + 3.0 * loadF; this.tHotAir = 38.0 + 14.0 * loadF;
    this.tCoil = 40.0 + 28.0 * loadF; this.tCore = 38.0 + 22.0 * loadF; this.tRotor = 42.0 + 30.0 * loadF;
    this.tThrustOil = 33.0 + 6.0 * loadF; this.tUpperOil = 32.0 + 5.0 * loadF;
    this.tLowerOil = 32.0 + 4.5 * loadF; this.tTurbOil = 32.0 + 5.0 * loadF;
    this.tThrustPad = this.tThrustOil + 6.0 + 3.0 * loadF; this.tUpperPad = this.tUpperOil + 6.0;
    this.tLowerPad = this.tLowerOil + 6.0; this.tTurbPad = this.tTurbOil + 5.5;
    this.tTrOil = 34.0 + 12.0 * loadF; this.tTrWinding = this.tTrOil + 12.0 * loadF;
  }

  /** Lưu toàn bộ trạng thái nội bộ để khôi phục khi tải lại trang */
  exportState(): Record<string, unknown> {
    return {
      omega: this.omega, delta: this.delta, gv: this.gv, blade: this.blade,
      q: this.q, h: this.h, hStatic: this.hStatic, pmMW: this.pmMW,
      brake: this.brake, shearPin: this.shearPin,
      govMode: this.govMode, govAuto: this.govAuto, bladeAuto: this.bladeAuto,
      gvManualTarget: this.gvManualTarget, bladeManualDeg: this.bladeManualDeg,
      gvLimit: this.gvLimit, gvTarget: this.gvTarget, govInt: this.govInt,
      nref: this.nref, pSetMW: this.pSetMW, prefMW: this.prefMW,
      servoLocked: this.servoLocked, govFail: this.govFail,
      islandTimer: this.islandTimer, accelTimer: this.accelTimer, prevOmega: this.prevOmega,
      islanded: this.islanded, loadRejectActive: this.loadRejectActive,
      loadRejectPeakReached: this.loadRejectPeakReached, loadRejectTargetGv: this.loadRejectTargetGv,
      loadRejectBlock81O: this.loadRejectBlock81O, loadRejectSettleTimer: this.loadRejectSettleTimer,
      loadRejectPrePu: this.loadRejectPrePu, loadRejectEvent: this.loadRejectEvent,
      oilPressMPa: this.oilPressMPa,
      mk: this.mk, excOn: this.excOn, flashT: this.flashT, efd: this.efd, avrInt: this.avrInt,
      vref: this.vref, qSetMVAr: this.qSetMVAr, qrefMVAr: this.qrefMVAr,
      qControl: this.qControl, avrFail: this.avrFail, efdMaxTime: this.efdMaxTime, qWasOn: this.qWasOn,
      eqp: this.eqp, edp: this.edp,
      iT: [this.iT.re, this.iT.im], vT: [this.vT.re, this.vT.im],
      id: this.id, iq: this.iq, pe: this.pe, peTerm: this.peTerm, qeTerm: this.qeTerm,
      i2: this.i2, iaPu: this.iaPu, ibPu: this.ibPu, icPu: this.icPu,
      tCoil: this.tCoil, tCore: this.tCore, tRotor: this.tRotor,
      tColdAir: this.tColdAir, tHotAir: this.tHotAir,
      tThrustOil: this.tThrustOil, tUpperOil: this.tUpperOil, tLowerOil: this.tLowerOil, tTurbOil: this.tTurbOil,
      tThrustPad: this.tThrustPad, tUpperPad: this.tUpperPad, tLowerPad: this.tLowerPad, tTurbPad: this.tTurbPad,
      tTrOil: this.tTrOil, tTrWinding: this.tTrWinding,
      thrustFaultK: this.thrustFaultK, coolerFouling: this.coolerFouling,
      lossStatorKW: this.lossStatorKW, lossRotorKW: this.lossRotorKW, lossCoreKW: this.lossCoreKW,
      oilVol: this.oilVol, oilPump: [...this.oilPump], oilPumpFail: this.oilPumpFail, oilLeak: this.oilLeak,
      cwFlow: this.cwFlow, cwPressMPa: this.cwPressMPa, headCoverMM: this.headCoverMM,
      hcPump: [...this.hcPump], hcForceDrain: this.hcForceDrain, hcPumpFail: this.hcPumpFail,
      leakFault: this.leakFault, sealAir: this.sealAir, heater: this.heater,
      servoStroke: this.servoStroke, pFilt: this.pFilt, wFilt: this.wFilt, wSlow: this.wSlow,
      govDer: this.govDer, gvCmd: this.gvCmd, rampRef: this.rampRef, tmPu: this.tmPu,
      cwRun: this.cwRun, cwFail: this.cwFail,
    };
  }

  importState(d: Record<string, unknown> | null | undefined): void {
    if (!d) return;
    const num = (k: string, cur: number) => (typeof d[k] === 'number' && Number.isFinite(d[k] as number) ? (d[k] as number) : cur);
    const bool = (k: string, cur: boolean) => (typeof d[k] === 'boolean' ? (d[k] as boolean) : cur);
    this.omega = num('omega', this.omega); this.delta = num('delta', this.delta);
    this.gv = num('gv', this.gv); this.blade = num('blade', this.blade);
    this.q = num('q', this.q); this.h = num('h', this.h); this.hStatic = num('hStatic', this.hStatic);
    this.pmMW = num('pmMW', this.pmMW);
    this.brake = bool('brake', this.brake); this.shearPin = bool('shearPin', this.shearPin);
    if (typeof d.govMode === 'string' && d.govMode in GovMode) this.govMode = d.govMode as GovMode;
    this.govAuto = bool('govAuto', this.govAuto); this.bladeAuto = bool('bladeAuto', this.bladeAuto);
    this.gvManualTarget = num('gvManualTarget', this.gvManualTarget);
    this.bladeManualDeg = num('bladeManualDeg', this.bladeManualDeg);
    this.gvLimit = num('gvLimit', this.gvLimit); this.gvTarget = num('gvTarget', this.gvTarget);
    this.govInt = num('govInt', this.govInt);
    this.nref = num('nref', this.nref); this.pSetMW = num('pSetMW', this.pSetMW); this.prefMW = num('prefMW', this.prefMW);
    this.servoLocked = bool('servoLocked', this.servoLocked); this.govFail = bool('govFail', this.govFail);
    this.islandTimer = num('islandTimer', this.islandTimer); this.accelTimer = num('accelTimer', this.accelTimer);
    this.prevOmega = num('prevOmega', this.prevOmega);
    this.islanded = bool('islanded', this.islanded);
    this.loadRejectActive = bool('loadRejectActive', this.loadRejectActive);
    this.loadRejectPeakReached = bool('loadRejectPeakReached', this.loadRejectPeakReached);
    this.loadRejectTargetGv = num('loadRejectTargetGv', this.loadRejectTargetGv);
    this.loadRejectBlock81O = bool('loadRejectBlock81O', this.loadRejectBlock81O);
    this.loadRejectSettleTimer = num('loadRejectSettleTimer', this.loadRejectSettleTimer);
    this.loadRejectPrePu = num('loadRejectPrePu', this.loadRejectPrePu);
    this.loadRejectEvent = bool('loadRejectEvent', this.loadRejectEvent);
    this.oilPressMPa = num('oilPressMPa', this.oilPressMPa);
    this.mk = bool('mk', this.mk); this.excOn = bool('excOn', this.excOn);
    this.flashT = num('flashT', this.flashT); this.efd = num('efd', this.efd); this.avrInt = num('avrInt', this.avrInt);
    this.vref = num('vref', this.vref); this.qSetMVAr = num('qSetMVAr', this.qSetMVAr); this.qrefMVAr = num('qrefMVAr', this.qrefMVAr);
    this.qControl = bool('qControl', this.qControl); this.avrFail = num('avrFail', this.avrFail);
    this.efdMaxTime = num('efdMaxTime', this.efdMaxTime); this.qWasOn = bool('qWasOn', this.qWasOn);
    this.eqp = num('eqp', this.eqp); this.edp = num('edp', this.edp);
    if (Array.isArray(d.iT) && d.iT.length === 2) this.iT = new Cx(Number(d.iT[0]) || 0, Number(d.iT[1]) || 0);
    if (Array.isArray(d.vT) && d.vT.length === 2) this.vT = new Cx(Number(d.vT[0]) || 0, Number(d.vT[1]) || 0);
    this.id = num('id', this.id); this.iq = num('iq', this.iq);
    this.pe = num('pe', this.pe); this.peTerm = num('peTerm', this.peTerm); this.qeTerm = num('qeTerm', this.qeTerm);
    this.i2 = num('i2', this.i2); this.iaPu = num('iaPu', this.iaPu); this.ibPu = num('ibPu', this.ibPu); this.icPu = num('icPu', this.icPu);
    this.tCoil = num('tCoil', this.tCoil); this.tCore = num('tCore', this.tCore); this.tRotor = num('tRotor', this.tRotor);
    this.tColdAir = num('tColdAir', this.tColdAir); this.tHotAir = num('tHotAir', this.tHotAir);
    this.tThrustOil = num('tThrustOil', this.tThrustOil); this.tUpperOil = num('tUpperOil', this.tUpperOil);
    this.tLowerOil = num('tLowerOil', this.tLowerOil); this.tTurbOil = num('tTurbOil', this.tTurbOil);
    this.tThrustPad = num('tThrustPad', this.tThrustPad); this.tUpperPad = num('tUpperPad', this.tUpperPad);
    this.tLowerPad = num('tLowerPad', this.tLowerPad); this.tTurbPad = num('tTurbPad', this.tTurbPad);
    this.tTrOil = num('tTrOil', this.tTrOil); this.tTrWinding = num('tTrWinding', this.tTrWinding);
    this.thrustFaultK = num('thrustFaultK', this.thrustFaultK); this.coolerFouling = num('coolerFouling', this.coolerFouling);
    this.lossStatorKW = num('lossStatorKW', this.lossStatorKW); this.lossRotorKW = num('lossRotorKW', this.lossRotorKW);
    this.lossCoreKW = num('lossCoreKW', this.lossCoreKW);
    this.oilVol = num('oilVol', this.oilVol);
    if (Array.isArray(d.oilPump) && d.oilPump.length === 2) this.oilPump = [!!d.oilPump[0], !!d.oilPump[1]];
    this.oilPumpFail = bool('oilPumpFail', this.oilPumpFail); this.oilLeak = bool('oilLeak', this.oilLeak);
    this.cwFlow = num('cwFlow', this.cwFlow); this.cwPressMPa = num('cwPressMPa', this.cwPressMPa);
    this.headCoverMM = num('headCoverMM', this.headCoverMM);
    if (Array.isArray(d.hcPump) && d.hcPump.length === 2) this.hcPump = [!!d.hcPump[0], !!d.hcPump[1]];
    this.hcForceDrain = bool('hcForceDrain', this.hcForceDrain); this.hcPumpFail = bool('hcPumpFail', this.hcPumpFail);
    this.leakFault = bool('leakFault', this.leakFault); this.sealAir = bool('sealAir', this.sealAir);
    this.heater = bool('heater', this.heater);
    this.servoStroke = num('servoStroke', this.servoStroke);
    this.pFilt = num('pFilt', this.pFilt); this.wFilt = num('wFilt', this.wFilt); this.wSlow = num('wSlow', this.wSlow);
    this.govDer = num('govDer', this.govDer); this.gvCmd = num('gvCmd', this.gvCmd); this.rampRef = num('rampRef', this.rampRef);
    this.tmPu = num('tmPu', this.tmPu);
    this.cwRun = bool('cwRun', this.cwRun); this.cwFail = bool('cwFail', this.cwFail);
  }
}
