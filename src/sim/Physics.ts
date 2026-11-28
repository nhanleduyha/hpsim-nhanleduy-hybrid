import { Act, Relay } from '../plant/Protection';
import { GovMode, HydroUnit } from '../plant/HydroUnit';
import { Sw } from '../plant/Network';
import { Plant, ShortCircuit } from '../plant/Plant';
import { PlantConfig } from '../plant/PlantConfig';
import { Gen } from './Gen';
import type { HpsSim } from './HpsSim';

function coerceIn(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function fmt1(v: number): string { return v.toFixed(1); }
function fmt2(v: number): string { return v.toFixed(2); }
function fmt0(v: number): string { return v.toFixed(0); }

function timeHMS(ms = Date.now()): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export interface StartCond {
  t: string;
  ok: boolean;
  key?: string;
}

/** Số liệu sổ nhật ký vận hành trưởng ca (mẫu B7) */
export class ShiftLog {
  startedAt: number = Date.now();
  chief = ''; operator = ''; dispatcher = '';
  cbNormal: Record<string, number> = {};
  cbFault: Record<string, number> = {};
  mwh: [number, number] = [0.0, 0.0];
  pMax = 0.0; pMin = Number.MAX_VALUE;
  runH: [number, number] = [0.0, 0.0];
  tripH: [number, number] = [0.0, 0.0];
  standbyH: [number, number] = [0.0, 0.0];
  notes: string[] = [];
  private last = new Map<string, number>();

  reset(chief: string, operator: string, dispatcher: string): void {
    this.startedAt = Date.now();
    this.chief = chief; this.operator = operator; this.dispatcher = dispatcher;
    this.cbNormal = {}; this.cbFault = {};
    this.mwh = [0.0, 0.0]; this.pMax = 0.0; this.pMin = Number.MAX_VALUE;
    this.runH = [0.0, 0.0]; this.tripH = [0.0, 0.0]; this.standbyH = [0.0, 0.0];
    this.notes = [];
  }

  cbTrip(cb: string): void {
    this.cbFault[cb] = (this.cbFault[cb] ?? 0) + 1;
    this.last.set(cb, 0.0);
  }

  note(t: string): void {
    const ts = timeHMS();
    this.notes.push(`${ts}  ${t}`);
    while (this.notes.length > 200) this.notes.shift();
  }

  tick(s: HpsSim, _ph: Physics, dt: number): void {
    const cbs: Record<string, number> = {
      '331': s.g1.cb33, '332': s.g2.cb33, '371': s.cb371, '372': s.cb372,
      '601': s.g1.cb60, '602': s.g2.cb60, 'TD61 (1AXT)': s.axt1, 'TD32 (2AXT)': s.axt2,
    };
    for (const [k, v] of Object.entries(cbs)) {
      const p = this.last.get(k);
      if (p !== undefined && p !== v) this.cbNormal[k] = (this.cbNormal[k] ?? 0) + 1;
      this.last.set(k, v);
    }
    let ptot = 0.0;
    const gens = [s.g1, s.g2];
    for (let i = 0; i < 2; i++) {
      const g = gens[i];
      const pmw = g.pload / 100;
      ptot += pmw;
      this.mwh[i] += (pmw * dt) / 3600;
      const h = dt / 3600;
      if (g.cb33 !== 0.0 && pmw > 0.1) this.runH[i] += h;
      else if (g.tripped) this.tripH[i] += h;
      else this.standbyH[i] += h;
    }
    if (ptot > this.pMax) this.pMax = ptot;
    if (ptot < this.pMin) this.pMin = ptot;
  }

  exportState(): Record<string, unknown> {
    return {
      startedAt: this.startedAt, chief: this.chief, operator: this.operator, dispatcher: this.dispatcher,
      cbNormal: { ...this.cbNormal }, cbFault: { ...this.cbFault },
      mwh: [...this.mwh], pMax: this.pMax, pMin: this.pMin === Number.MAX_VALUE ? null : this.pMin,
      runH: [...this.runH], tripH: [...this.tripH], standbyH: [...this.standbyH],
      notes: [...this.notes],
    };
  }

  importState(d: Record<string, unknown> | null | undefined): void {
    if (!d) return;
    if (typeof d.startedAt === 'number') this.startedAt = d.startedAt;
    if (typeof d.chief === 'string') this.chief = d.chief;
    if (typeof d.operator === 'string') this.operator = d.operator;
    if (typeof d.dispatcher === 'string') this.dispatcher = d.dispatcher;
    if (d.cbNormal && typeof d.cbNormal === 'object') this.cbNormal = { ...(d.cbNormal as Record<string, number>) };
    if (d.cbFault && typeof d.cbFault === 'object') this.cbFault = { ...(d.cbFault as Record<string, number>) };
    if (Array.isArray(d.mwh) && d.mwh.length === 2) this.mwh = [Number(d.mwh[0]) || 0, Number(d.mwh[1]) || 0];
    if (typeof d.pMax === 'number') this.pMax = d.pMax;
    this.pMin = typeof d.pMin === 'number' ? d.pMin : Number.MAX_VALUE;
    if (Array.isArray(d.runH) && d.runH.length === 2) this.runH = [Number(d.runH[0]) || 0, Number(d.runH[1]) || 0];
    if (Array.isArray(d.tripH) && d.tripH.length === 2) this.tripH = [Number(d.tripH[0]) || 0, Number(d.tripH[1]) || 0];
    if (Array.isArray(d.standbyH) && d.standbyH.length === 2) this.standbyH = [Number(d.standbyH[0]) || 0, Number(d.standbyH[1]) || 0];
    if (Array.isArray(d.notes)) this.notes = d.notes.map(String);
  }
}

// =========================================================================
// Trình tự khởi động / dừng máy theo Quy trình vận hành khối tổ máy Đray H'Linh 2 (Điều 21, 25, 26, 27)
// =========================================================================
export class UnitSeq {
  private readonly s: HpsSim;
  private readonly ph: Physics;
  readonly g: Gen;
  private readonly u: HydroUnit;

  state = 'IDLE';
  stepText = 'Dừng dự phòng';
  target = 0; // 1 phát điện, 2 không tải, 3 chạy không kích từ
  private t = 0.0;
  private lastLogged = '';
  private cb33Prev = false;

  constructor(s: HpsSim, ph: Physics, g: Gen, u: HydroUnit) {
    this.s = s;
    this.ph = ph;
    this.g = g;
    this.u = u;
  }

  private on(v: number): boolean { return v !== 0.0; }

  private go(st: string, text: string): void {
    this.state = st;
    this.stepText = text;
    this.t = 0.0;
    if (text !== this.lastLogged) {
      this.s.log('SEQ', this.g.no, `MF${this.g.no}: ${text}`);
      this.lastLogged = text;
    }
  }

  forceState(st: string, tgt: number, text: string): void {
    this.state = st;
    this.target = tgt;
    this.stepText = text;
    this.t = 0.0;
    this.lastLogged = text;
    this.cb33Prev = this.on(this.g.cb33);
  }

  /** Sa thải phụ tải: chuyển trình tự về NOLOAD, giữ kích từ, không dừng máy */
  private lowSpdSince = -1.0;
  onLoadRejection(text = 'Sa thải phụ tải – chạy không tải (giữ kích từ)'): void {
    if (this.state === 'IDLE' || this.state.startsWith('STOP')) return;
    this.target = 2; this.g.generating = 2.0;
    this.g.p = 0.0; this.g.q = 0.0;
    this.u.pSetMW = 0.0; this.u.prefMW = 0.0; this.u.qControl = false;
    this.u.excOn = true;
    this.cb33Prev = this.on(this.g.cb33);
    this.go('NOLOAD', text);
  }

  private fail(text: string, stop = true): void {
    this.s.log('ERR', this.g.no, `MF${this.g.no}: ${text}`);
    this.s.event('msg', `MF${this.g.no}: ${text}`);
    this.s.alarm();
    if (stop) this.normalStop(`Thoát trình tự: ${text}`);
    else {
      this.state = 'IDLE'; this.stepText = text; this.target = 0; this.g.generating = 0.0;
    }
  }

  start(mode: number): void {
    if (this.g.tripped) {
      this.s.event('msg', `MF${this.g.no}: bảo vệ đã cắt máy (${this.g.tripReason}) – giải trừ trước khi khởi động`);
      return;
    }
    this.target = mode;
    this.g.generating = mode;
    if (['RUN', 'NOLOAD', 'FREE', 'SYNC', 'LOAD'].includes(this.state) && mode !== 0) { // đổi chế độ khi đang quay
      if (mode === 1) {
        if (this.state !== 'RUN') this.go('EXCITE', 'Bước 8: đưa kích từ vào làm việc');
      } else if (mode === 2) {
        if (this.on(this.g.cb33)) this.go('UNLOAD', 'Giảm tải về không tải');
        else { this.u.excOn = true; this.go('NOLOAD', 'Chạy không tải'); }
      } else if (mode === 3) {
        if (this.on(this.g.cb33)) this.go('UNLOAD', 'Giảm tải về không tải');
        else { this.u.excOn = false; this.go('FREE', 'Chạy không kích từ'); }
      }
      return;
    }
    if (this.state !== 'IDLE' && !this.state.startsWith('STOP')) return;
    // QT Điều 21 Bước 3: Chốt khóa cánh hướng (Locking Pin) phải được MỞ trước khi khởi động
    if (this.on(this.g.servoLock)) {
      this.target = 0; this.g.generating = 0.0;
      const m = `MF${this.g.no}: CHẶN KHỞI ĐỘNG – Chốt khóa cánh hướng (Locking Pin) ĐANG ĐÓNG (0%)! Phải MỞ chốt khóa cánh hướng trước khi khởi động (Điều 21 Bước 3).`;
      this.s.log('ERR', this.g.no, m); this.s.event('msg', m); this.s.alarm(); this.s.incident(m, 1);
      return;
    }
    // QT Điều 20: điều kiện sẵn sàng khởi động (đèn "G ok")
    const miss = this.startMissing();
    if (miss.length > 0) {
      this.target = 0; this.g.generating = 0.0;
      const m = `MF${this.g.no} chưa đủ điều kiện khởi động: ${miss.join('; ')}`;
      this.s.log('ERR', this.g.no, m); this.s.event('msg', m);
      return;
    }
    // QT Điều 10: không khởi động, hoà hai tổ máy cùng lúc (liên động chế độ Cấm)
    const other = this.ph.seq[this.g.no === 1 ? 1 : 0];
    if (
      this.ph.cfg().interlock === 'strict' &&
      ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'EXCITE', 'SYNC', 'LOAD'].includes(other.state)
    ) {
      this.target = 0; this.g.generating = 0.0;
      const m = `LIÊN ĐỘNG: MF${other.g.no} đang khởi động/hoà – không khởi động hai tổ máy cùng lúc (QT Điều 10)`;
      this.s.log('ERR', this.g.no, m); this.s.event('msg', m);
      return;
    }
    this.go('S1', 'Bước 1: kiểm tra cửa nhận nước');
  }

  /** Điều kiện khởi động theo QT vận hành Điều 20 (mục 1 "G ok" = tất cả các mục còn lại đạt). key = lệnh HMI để thao tác nhanh */
  startConds(): StartCond[] {
    const n = this.g.no;
    const oils = [this.u.tThrustOil, this.u.tUpperOil, this.u.tLowerOil, this.u.tTurbOil];
    const oilMax = Math.max(...oils);
    const oilMin = Math.min(...oils);
    return [
      { t: `2. Có nguồn tự dùng tổ máy (0,4 kV: ${fmt0(this.ph.plant.auxV * 400)} V)`, ok: this.ph.plant.auxV >= 0.85 },
      { t: `3. Máy cắt khối 35 kV 33${n} cắt`, ok: !this.on(this.g.cb33), key: `CB33${n}` },
      { t: `3. Máy cắt đầu cực 60${n} đóng, lò xo đã căng`, ok: this.on(this.g.cb60), key: `CB60${n}` },
      { t: '4. Nguồn kích từ ban đầu sẵn sàng (máy cắt diệt từ MK đóng)', ok: this.on(this.g.fieldDischarge), key: `GEN${n}.FIELDDISCHARGE` },
      { t: `5. Áp lực dầu điều khiển đủ (${fmt2(this.u.oilPressMPa)} MPa ≥ 3,3)`, ok: this.u.oilPressMPa >= 3.3 && !this.u.oilLeak },
      { t: '6. Mức dầu ổ đỡ, ổ hướng tuabin, ổ hướng máy phát bình thường', ok: true },
      { t: `6. Điều tốc ở chế độ TỰ ĐỘNG (đang ${this.on(this.g.govAuto) ? 'TỰ ĐỘNG' : 'BẰNG TAY'})`, ok: this.on(this.g.govAuto), key: `GEN${n}.GOVAUTO` },
      { t: '7. Van nước, dầu, khí đúng vị trí – nước làm mát sẵn sàng', ok: !this.g.wpFail && !this.u.cwFail && this.on(this.s.intakeGate) },
      { t: '8. Không có sự cố ở phanh (phanh đã giải trừ)', ok: this.on(this.g.airBrake), key: `GEN${n}.AIRBRAKE` },
      { t: `9. Nhiệt độ dầu các ổ 10–35 °C (${fmt1(oilMin)}–${fmt1(oilMax)} °C)`, ok: oilMin >= 10.0 && oilMax <= 35.0 },
      { t: '10. Không có sự cố hệ thống đo nhiệt', ok: true },
      { t: '11. Bề mặt vành góp không bị cháy', ok: true },
      { t: '12. Tín hiệu sự cố đã giải trừ' + (this.g.tripped ? ` (${this.g.tripReason})` : ''), ok: !this.g.tripped, key: `GEN${n}.RESET` },
      { t: `13. Không còn dao tiếp đất trên khối tổ máy (${n}QE, 33${n}-${n}4, 33${n}-${n}5)`, ok: !this.on(this.g.gsQE) && !this.on(this.g.gs14) && !this.on(this.g.gs15) },
      { t: '14. Khu vực tổ máy đã dọn dẹp, kết thúc công tác', ok: true },
    ];
  }

  startMissing(): string[] {
    return this.startConds().filter((it) => !it.ok).map((it) => it.t);
  }

  normalStop(reason = 'Lệnh dừng máy'): void {
    this.target = 0; this.g.generating = 0.0;
    if (this.state === 'IDLE') return;
    this.s.log('SEQ', this.g.no, `MF${this.g.no}: ${reason}`);
    // Nhắc chuyển tự dùng: tự dùng 0,4 kV đang lấy từ TD61 qua dao 612 của chính tổ máy này -> dừng máy sẽ mất TD61, ATS phải chuyển
    const own612 = this.on(this.g.no === 1 ? this.s.is612_1 : this.s.is612_2);
    const other612 = this.on(this.g.no === 1 ? this.s.is612_2 : this.s.is612_1);
    if (this.on(this.g.cb33) && this.on(this.s.axt1) && own612 && !other612) {
      const m = `MF${this.g.no}: Tự dùng đang lấy từ TD61 (qua 612-${this.g.no}) – nên chuyển sang TD32 (đóng 2AXT, cắt 1AXT) trước khi dừng tổ máy, nếu không ATS sẽ tự chuyển và báo mất nguồn`;
      this.s.log('WARN', this.g.no, m); this.s.event('msg', m);
    }
    this.go(
      this.on(this.g.cb33) ? 'UNLOAD' : 'STOP_EXC',
      this.on(this.g.cb33) ? 'Dừng – Bước 2: giảm tải về không tải' : 'Dừng – Bước 4: cắt kích từ',
    );
  }

  /** Sự cố bên ngoài (59, 21G, 51 – QT Điều 47–49): cắt 601, 331, MK; tổ máy giữ tốc độ định mức chạy không kích từ chờ hoà lại */
  tripToNoLoad(reason: string): void {
    if (this.state === 'IDLE' || this.state.startsWith('STOP')) {
      this.ph.tripAll(this.g); this.g.tripped = true; this.g.tripReason = reason;
      return;
    }
    this.ph.tripAll(this.g);
    this.g.tripped = true; this.g.tripReason = reason;
    this.target = 3; this.g.generating = 3.0; this.g.p = 0.0; this.g.q = 0.0;
    this.u.excOn = false; this.u.pSetMW = 0.0; this.u.prefMW = 0.0; this.u.qSetMVAr = 0.0; this.u.qControl = false;
    if (this.u.govMode !== GovMode.START) { this.u.govMode = GovMode.SPEED; this.u.nref = 1.0; }
    this.go('FREE', `Bảo vệ cắt 60${this.g.no}, 33${this.g.no}, MK – tổ máy chạy không tải chờ lệnh hoà lại`);
  }

  /** Dừng sự cố. tripHv = true: hư hỏng trong khối (87G, 87T, 46…) cắt cả 331/332; dừng sự cố loại 1/2 phần cơ chỉ cắt 601/602 và MK (QT Điều 26–27) */
  emergency(kind: number, reason: string, tripHv = false): void {
    this.target = 0; this.g.generating = 0.0;
    this.g.tripped = true; this.g.tripReason = reason;
    if (tripHv) this.ph.tripAll(this.g);
    else {
      if (this.on(this.g.cb60)) { this.g.cb60 = 0.0; this.ph.shift.cbTrip(this.g.no === 1 ? '601' : '602'); }
      this.g.fieldDischarge = 0.0;
    }
    this.u.excOn = false;
    this.u.govMode = GovMode.EMERGENCY;
    this.g.emValve = 1.0;
    if (kind === 2) {
      this.s.intakeGate = 0.0;
      this.s.log('TRIP', this.g.no, `MF${this.g.no}: dừng sự cố loại 2 – hạ cửa nhận nước`);
    }
    this.go('STOP_GV', `Dừng sự cố loại ${kind}: ${reason} – đóng cánh hướng`);
    if (this.u.omega > 0.02) this.s.unitStopVideo(this.g);
  }

  step(dt: number): void {
    this.t += dt;
    const c = this.ph.cfg();
    const g = this.g;
    const u = this.u;
    switch (this.state) {
      case 'IDLE':
        if (u.omega < 0.01 && u.govMode !== GovMode.OFF) u.govMode = GovMode.OFF;
        break;
      // ---------------- Khởi động (Điều 21) ----------------
      case 'S1':
        if (!this.on(this.s.intakeGate)) { this.s.intakeGate = 1.0; this.s.log('SEQ', g.no, `MF${g.no}: nâng cửa nhận nước`); }
        if (this.ph.plant.intake[g.no - 1] >= 0.99) this.go('S2', 'Bước 2: kiểm tra máy cắt dập từ MK');
        else if (this.t > 90) this.fail('Cửa nhận nước chưa mở hoàn toàn', false);
        break;
      case 'S2':
        if (this.on(g.fieldDischarge)) this.go('S3', 'Bước 3: mở chốt khoá cánh hướng');
        else if (this.t > 1) this.fail('Máy cắt dập từ MK chưa đóng', false);
        break;
      case 'S3':
        if (!this.on(g.airBrake)) g.airBrake = 1.0;
        if (!this.on(g.servoLock) && this.t > 3) this.go('S4', 'Bước 4: đưa hệ thống nước kỹ thuật vào làm việc');
        else if (this.t > 25) this.fail('Chốt khóa cánh hướng chưa được mở khóa (Điều 21 Bước 3)', false);
        break;
      case 'S4':
        if (this.on(g.auxAuto)) {
          if (!this.on(g.cwValve)) g.cwValve = 1.0;
          if (!this.on(g.waterPump1) && !this.on(g.waterPump2)) g.waterPump1 = 1.0;
        }
        if (u.cwFlow > 0.8) this.go('S5', 'Bước 5: xả khí đệm kín sửa chữa');
        else if (this.t > 20) this.fail('Hệ thống nước kỹ thuật không làm việc', false);
        break;
      case 'S5':
        g.maintSeal = 0.0;
        if (this.t > 5) this.go('S6', 'Bước 6: kiểm tra áp lực nước chèn trục');
        break;
      case 'S6':
        if (u.cwPressMPa > 0.2) this.go('S7', 'Bước 7: mở cánh hướng tới độ mở khởi động');
        else if (this.t > 5) this.fail('Không có áp lực nước chèn trục', false);
        break;
      case 'S7':
        if (this.t < dt * 1.5) { u.govMode = GovMode.START; u.nref = 1.0; u.pSetMW = 0.0; u.prefMW = 0.0; }
        if (u.omega > 0.95) {
          if (this.target === 3) this.go('FREE', 'Chạy không kích từ (tốc độ định mức)');
          else this.go('EXCITE', 'Bước 8: đưa kích từ vào làm việc');
        } else if (this.t > 120) this.fail('Tốc độ không đạt 95 % định mức' + (!this.on(this.g.govAuto) ? ' (điều tốc đang ở chế độ BẰNG TAY)' : ''));
        break;
      case 'EXCITE':
        if (this.t >= 3.0 && !u.excOn) { u.excOn = true; u.vref = 1.0; } // giữ 3 s ở trạng thái chạy không kích từ (Free running) như sơ đồ SD200
        if (u.excOn && u.vT.abs() > 0.95) {
          if (this.target === 2) this.go('NOLOAD', 'Chạy không tải');
          else this.go('SYNC', 'Bước 9: hoà đồng bộ');
        } else if (this.t > 40) this.fail('Điện áp máy phát không đạt 95 % định mức');
        break;
      case 'NOLOAD': {
        u.pSetMW = 0.0; u.prefMW = 0.0; u.qControl = false; u.nref = 1.0 + g.spTrim / 50; u.vref = 1.0 + g.vTrim / 100;
        const cb33Now = this.on(g.cb33);
        if ((cb33Now && !this.cb33Prev) || (cb33Now && this.ph.plant.isUnitGridStiff(g.no))) {
          this.target = 1; g.generating = 1.0; this.go('LOAD', `Đóng máy cắt 33${g.no} – nhận tải`);
        }
        // Không giữ được tốc độ không tải (mất cột nước: cửa nhận nước đóng, đường ống cạn): tốc độ < 90 % quá 10 s -> dừng máy
        const simT = this.ph.plant.simTime;
        if (!cb33Now && u.omega < 0.90) { if (this.lowSpdSince < 0) this.lowSpdSince = simT; } else this.lowSpdSince = -1.0;
        if (this.lowSpdSince >= 0 && simT - this.lowSpdSince > 10.0) {
          this.lowSpdSince = -1.0;
          this.fail(`Tốc độ không giữ được (< 90 % quá 10 s, cột nước ${(u.hStatic * 100).toFixed(0)} %) – dừng máy`);
        }
        break;
      }
      case 'FREE':
        u.excOn = false;
        break;
      case 'SYNC': {
        if (this.on(g.cb33)) { this.go('LOAD', 'Bước 10: thiết lập công suất ban đầu'); return; }
        const busV = (g.no === 1 ? this.s.vbusZone1 : this.s.vbusZone2) / 38.5;
        if (!g.autoSync) {
          // hoà tay: người vận hành chỉnh tần số, điện áp rồi đóng máy cắt trên trang Hoà đồng bộ
          u.pSetMW = 0.0; u.prefMW = 0.0; u.qControl = false;
          u.nref = 1.0 + g.spTrim / 50; u.vref = 1.0 + g.vTrim / 100;
          return;
        }
        // đóng vào thanh cái không điện (khởi động đen / chế độ độc lập): thanh cái 35 kV chết, không nối đất
        const earthHv = this.s.gs371_15 + this.s.gs371_75 + this.s.gs372_25 + this.s.gs372_75 + g.gs14 + g.gs15 !== 0.0;
        if (busV < 0.1 && this.on(g.cb60) && this.on(g.is33) && !earthHv && u.vT.abs() > 0.95 && this.t > 5) {
          g.cb33 = 1.0;
          this.s.log('CMD', g.no, `MF${g.no}: thanh cái 35 kV không điện – đóng ${g.no === 1 ? '331' : '332'} cấp điện thanh cái (Isolate mode closing)`);
          u.nref = 1.0;
          this.go('LOAD', 'Bước 10: chạy độc lập – cấp điện thanh cái 35 kV');
          return;
        }
        if (busV < 0.8 || !this.on(g.cb60) || !this.on(g.is33)) {
          if (this.t > 30) this.fail(`Chưa đủ điều kiện hoà: MC 60${g.no}, dao 33${g.no}-${g.no}, thanh cái 35 kV`, false);
          return;
        }
        // bộ hoà SDQ200: trượt dương 0,1 Hz, điện áp bám thanh cái
        const busF = g.no === 1 ? this.s.freqZone1 : this.s.freqZone2;
        u.nref = busF / 50 + 0.002;
        u.vref = coerceIn((busV * 38.5) / 38.5 * (6.3 / 6.3), 0.9, 1.1);
        const df = g.freq - busF;
        const dv = (u.vT.abs() - busV) / Math.max(busV, 0.1);
        // đóng trước góc (bù thời gian đóng máy cắt 0,08 s), tuân thủ ngưỡng chung trong PlantConfig
        const lead = 360 * df * 0.08;
        const maxPhAuto = Math.min(c.syncMaxPhaseDeg, 6.0);
        if (
          Math.abs(df) <= c.syncMaxDfHz &&
          Math.abs(dv) * 100.0 <= c.syncMaxDvPct &&
          Math.abs(g.phase + lead) <= maxPhAuto &&
          Math.abs(g.phase) <= c.syncMaxPhaseDeg
        ) {
          g.cb33 = 1.0;
          this.s.log('CMD', g.no, `MF${g.no}: bộ hoà tự động đóng ${g.no === 1 ? '331' : '332'} (Δf=${fmt2(df)} Hz, ΔU=${fmt1(dv * 100)} %, Δφ=${fmt0(g.phase)}°)`);
          u.nref = 1.0;
          this.go('LOAD', 'Bước 10: thiết lập công suất ban đầu');
        } else if (this.t > 180) this.fail('Hoà đồng bộ không thành công (Synchronizing failure)');
        break;
      }
      case 'LOAD':
        if (this.t < dt * 1.5) { if (g.p < 1.0) g.p = 1.0; if (g.q < 0.5) g.q = 0.5; }
        u.pSetMW = g.p; u.qSetMVAr = g.q; u.qControl = true;
        if (u.peTerm * 10 > 0.8) this.go('RUN', 'Bước 11: kết thúc khởi động – tổ máy phát điện');
        // lưới độc lập: tổ máy điều tần, công suất do phụ tải và độ dốc quyết định -> không chờ công suất ban đầu
        else if (u.govMode === GovMode.SPEED && this.t > 10) this.go('RUN', 'Bước 11: kết thúc khởi động – tổ máy chạy độc lập (điều tần)');
        else if (this.t > 120) { this.fail('Tăng công suất ban đầu không thành công sau 2 phút', false); this.state = 'RUN'; }
        if (!this.on(g.cb33)) this.go('SYNC', 'Máy cắt cắt – hoà lại');
        break;
      case 'RUN':
        u.pSetMW = g.p; u.qSetMVAr = g.q; u.qControl = true;
        if (!this.on(g.cb33)) {
          // mất nối lưới (bảo vệ cắt 33x): về không tải
          u.pSetMW = 0.0; g.p = 0.0;
          this.go('NOLOAD', `Máy cắt 33${g.no} cắt – tổ máy về không tải`);
        }
        break;
      // ---------------- Dừng bình thường (Điều 25) ----------------
      case 'UNLOAD':
        g.p = 0.0; g.q = 0.0; u.pSetMW = 0.0; u.qSetMVAr = 0.0;
        if (u.peTerm * 10 < 0.3 || !this.on(g.cb33)) {
          if (this.on(g.cb33)) { g.cb33 = 0.0; }
          if (this.target === 2) { this.go('NOLOAD', 'Chạy không tải'); return; }
          if (this.target === 3) { u.excOn = false; this.go('FREE', 'Chạy không kích từ'); return; }
          this.go('STOP_EXC', 'Dừng – Bước 3, 4: cắt máy cắt, cắt kích từ');
        } else if (this.t > 60) {
          // không giảm được P, Q về min (thường do tổ máy đang cấp điện độc lập cho phụ tải): huỷ lệnh dừng, máy tiếp tục phát
          this.s.log(
            'ERR',
            g.no,
            `MF${g.no}: Active and reactive power not decreased to the minimum – huỷ lệnh dừng` +
              (u.islanded || !this.ph.plant.gridAvailable
                ? ' (tổ máy đang cấp điện độc lập: chuyển phụ tải sang nguồn khác hoặc cắt phụ tải trước khi dừng)'
                : ''),
          );
          this.s.event('msg', `MF${g.no}: không giảm được tải về không tải – huỷ lệnh dừng`); this.s.alarm();
          g.p = Math.max(0.0, u.peTerm * 10); u.pSetMW = g.p; this.target = 1; g.generating = 1.0;
          this.go('RUN', 'Huỷ dừng – tổ máy tiếp tục phát điện');
        }
        break;
      case 'STOP_EXC':
        u.excOn = false;
        if (u.vT.abs() < 0.2 || this.t > 10) { u.govMode = GovMode.OFF; this.go('STOP_GV', 'Dừng – Bước 5, 6: dừng điều tốc, đóng cánh hướng'); }
        break;
      case 'STOP_GV':
        if (u.govMode !== GovMode.EMERGENCY) u.govMode = GovMode.OFF;
        if (u.gv < 0.005) this.go('STOP_SPD', 'Dừng – Bước 7: chờ tốc độ giảm dưới 30 %');
        else if (this.t > 40) this.fail('Cánh hướng không đóng hoàn toàn', false);
        break;
      case 'STOP_SPD':
        if (u.omega < 0.30) { g.airBrake = 0.0; this.go('STOP_BRAKE', 'Dừng – phanh tổ máy'); }
        break;
      case 'STOP_BRAKE':
        if (u.omega < 0.005) this.go('STOP_AUX', 'Dừng – tốc độ bằng 0: đưa khoá cánh hướng vào');
        break;
      case 'STOP_AUX': // theo sơ đồ dừng SD200: khoá cánh hướng → giải trừ phanh → cắt nước làm mát → đưa khí đệm kín sửa chữa
        if (this.t > 0) g.servoLock = 1.0;
        if (this.t > 3 && !this.on(g.airBrake)) { g.airBrake = 1.0; this.stepText = 'Dừng – giải trừ phanh'; this.s.log('SEQ', g.no, `MF${g.no}: ${this.stepText}`); }
        if (this.t > 6 && this.on(g.cwValve) && this.on(g.auxAuto)) { g.waterPump1 = 0.0; g.waterPump2 = 0.0; g.cwValve = 0.0; this.stepText = 'Dừng – cắt hệ thống nước làm mát'; this.s.log('SEQ', g.no, `MF${g.no}: ${this.stepText}`); }
        if (this.t > 9 && !this.on(g.maintSeal)) { g.maintSeal = 1.0; this.stepText = 'Dừng – đưa khí vào đệm kín sửa chữa'; this.s.log('SEQ', g.no, `MF${g.no}: ${this.stepText}`); }
        if (this.t > 11) { u.govMode = GovMode.OFF; this.go('IDLE', 'Bước 8: kết thúc dừng máy – tổ máy dừng dự phòng'); }
        break;
    }
    // giữ chế độ điều tốc
    if ((this.state === 'NOLOAD' || this.state === 'FREE') && u.govMode === GovMode.OFF) u.govMode = GovMode.SPEED;
    this.cb33Prev = this.on(g.cb33);
  }

  exportState(): Record<string, unknown> {
    return {
      state: this.state, stepText: this.stepText, target: this.target,
      t: this.t, lastLogged: this.lastLogged, cb33Prev: this.cb33Prev,
    };
  }

  importState(d: Record<string, unknown> | null | undefined): void {
    if (!d) return;
    if (typeof d.state === 'string') this.state = d.state;
    if (typeof d.stepText === 'string') this.stepText = d.stepText;
    if (typeof d.target === 'number') this.target = d.target;
    if (typeof d.t === 'number') this.t = d.t;
    if (typeof d.lastLogged === 'string') this.lastLogged = d.lastLogged;
    if (typeof d.cb33Prev === 'boolean') this.cb33Prev = d.cb33Prev;
  }
}

/**
 * Cầu nối giữa mô hình vật lý (gói plant) và bộ mô phỏng SD200 (HpsSim):
 * đồng bộ trạng thái khoá/thiết bị, chạy trình tự khởi động – dừng máy, xử lý rơ le tác động, đưa số đo ra các biến cũ.
 */
export class Physics {
  private intakeWarned = false;
  private readonly s: HpsSim;
  readonly cfg: () => PlantConfig;
  readonly plant: Plant;
  readonly seq: [UnitSeq, UnitSeq];
  gridLost = false;
  fcoBlown = false;
  inflowFactor = 1.0;
  readonly shift = new ShiftLog();

  // ---------------- Máy phát diesel tự dùng 0,4 kV ----------------
  dgAuto = true; dgCb = false; dgEngine = false; dgFail = false;
  dgT = 0.0; private deadT = 0.0; private coolT = 0.0; private dgOverT = 0.0;
  private upT = 0.0; private dgAutoStart = false;

  // ---------------- Bộ tự động chuyển nguồn tự dùng 0,4 kV ----------------
  private lost1T = 0.0; private lost2T = 0.0; private back61T = 0.0; private backTdT = 0.0; private noneT = 0.0;

  // ---------------- Hồ quang dao cách ly, ngắn mạch qua dao nối đất ----------------
  readonly dsSw: Array<[string, Sw]>;
  private readonly arcBreakPu = 0.02;
  private readonly arcMakePu = 0.05;
  private readonly pendingMake: Array<[string, Sw]> = [];
  private readonly arcClearT = new Map<string, number>();
  private readonly earthHot = new Set<string>();
  private lastOp = ''; private lastOpT = -10.0;

  private readonly lastCmd = new Map<string, number>();
  private readonly lastPub = new Map<string, boolean>();
  private lowLevel = false;
  private headRangeAlarm = 0;

  constructor(s: HpsSim, cfg: () => PlantConfig) {
    this.s = s;
    this.cfg = cfg;
    this.plant = new Plant(cfg);
    this.seq = [new UnitSeq(s, this, s.g1, this.plant.u1), new UnitSeq(s, this, s.g2, this.plant.u2)];
    this.dsSw = [
      ['IS371_7', this.plant.s371_7], ['IS371_1', this.plant.s371_1],
      ['IS372_7', this.plant.s372_7], ['IS372_2', this.plant.s372_2],
      ['IS331_1', this.plant.s331_1], ['IS332_2', this.plant.s332_2],
      ['IS312_1', this.plant.s312], ['IS612_1', this.plant.s612_1], ['IS612_2', this.plant.s612_2],
    ];
  }

  private on(v: number): boolean { return v !== 0.0; }
  private b(v: boolean): number { return v ? 1.0 : 0.0; }

  init(): void {
    for (const u of this.plant.units) u.coldStart(28.0);
    this.plant.zUp = this.cfg().crestLevelM + 0.2;
  }

  // =====================================================================
  step(dt: number): void {
    this.inputs();
    this.ats(dt);
    this.diesel(dt);
    for (const q of this.seq) q.step(dt);
    this.plant.step(dt);
    this.afterSolve(dt);
    this.relays(dt);
    this.cwHydraulics(dt);
    this.outputs();
    this.shift.tick(this.s, this, dt);
  }

  /** Thủy lực trước van điện nước làm mát (cwPreMPa): khi bơm chạy mà van đóng, áp trước van tăng lên cột áp chặn ~0,48 MPa trong khi sau van = 0 MPa */
  private cwHydraulics(dt: number): void {
    const auxLive = this.plant.auxV > 0.75;
    for (const g of [this.s.g1, this.s.g2]) {
      const pumpRunning = (this.on(g.waterPump1) || this.on(g.waterPump2)) && auxLive && !g.wpFail;
      const preTarget = !pumpRunning ? 0.0 : !this.on(g.cwValve) ? 0.48 : 0.34;
      g.cwPreMPa += (preTarget - g.cwPreMPa) * Math.min(1.0, dt / 1.0);
    }
  }

  // ---------------- Máy phát diesel tự dùng 0,4 kV (nguồn khởi động đen) ----------------
  private diesel(dt: number): void {
    const p = this.plant;
    const busDead =
      p.auxV < 0.3 &&
      !(this.on(this.s.axt1) && p.vkv[Plant.TD61L] > 0.3) &&
      !(this.on(this.s.axt2) && p.vkv[Plant.TD32L] > 0.3);
    this.deadT = busDead && !this.dgCb ? this.deadT + dt : 0.0;
    this.upT += dt;
    // bỏ qua 10 s đầu sau khi mở app (đường dây 371/372 đóng sau 5 s khởi tạo)
    if (this.dgAuto && !this.on(this.s.standbyInput400) && this.deadT > 5.0 && !this.dgFail && this.upT > 10.0) {
      this.s.standbyInput400 = 1.0; this.dgAutoStart = true;
      this.s.log('CMD', 3, 'Tự dùng 0,4 kV mất điện – tự động khởi động máy phát diesel');
    }
    // nguồn tự dùng có lại (ATS đã đóng 1AXT/2AXT) trước khi diesel hoà vào thanh cái -> huỷ lệnh tự khởi động
    if (this.dgAutoStart && !this.dgCb && !busDead && this.on(this.s.standbyInput400)) {
      this.s.standbyInput400 = 0.0; this.dgAutoStart = false;
      this.s.log('CMD', 3, 'Tự dùng 0,4 kV có điện trở lại – huỷ tự khởi động máy phát diesel');
    }
    if (this.on(this.s.standbyInput400) && !this.dgFail) {
      if (!this.dgEngine) { this.dgEngine = true; this.dgT = 0.0; this.s.log('POS', 3, 'Máy phát diesel: khởi động'); }
      this.dgT += dt; this.coolT = 0.0;
      if (!this.dgCb && this.dgT >= this.cfg().dieselStartSec) {
        if (this.on(this.s.axt1) || this.on(this.s.axt2)) {
          this.s.axt1 = 0.0; this.s.axt2 = 0.0;
          this.s.log('POS', 3, 'ATS: cắt 1AXT, 2AXT trước khi đóng máy cắt diesel');
        }
        this.dgCb = true; this.dgAutoStart = false;
        this.s.log('POS', 3, 'Đóng máy cắt máy phát diesel – cấp điện thanh cái 0,4 kV');
      }
    } else {
      if (this.dgCb) { this.dgCb = false; this.s.log('POS', 3, 'Cắt máy cắt máy phát diesel'); }
      if (this.dgEngine) {
        this.coolT += dt;
        if (this.coolT > 30.0 || this.dgFail) { this.dgEngine = false; this.s.log('POS', 3, 'Máy phát diesel: dừng'); }
      }
    }
    // khoá liên động phần cứng: không cho diesel làm việc song song với MBA tự dùng
    if (this.dgCb && (this.on(this.s.axt1) || this.on(this.s.axt2))) {
      this.dgCb = false; this.s.standbyInput400 = 0.0;
      this.s.log('ERR', 3, 'Liên động: đóng 1AXT/2AXT khi diesel đang cấp điện – cắt máy cắt diesel');
    }
    // quá tải diesel 110 % trong 10 s -> cắt
    const kva = Math.hypot(p.dgKW, p.dgKVAr);
    this.dgOverT = this.dgCb && kva > 1.1 * this.cfg().dieselKVA ? this.dgOverT + dt : 0.0;
    if (this.dgOverT > 10.0) {
      this.dgCb = false; this.s.standbyInput400 = 0.0;
      this.s.log('TRIP', 3, 'Máy phát diesel quá tải – cắt máy cắt diesel');
      this.s.alarm(true);
    }
    p.dgRun = this.dgEngine && this.dgT >= this.cfg().dieselStartSec * 0.8;
  }

  // ---------------- Bộ tự động chuyển nguồn tự dùng 0,4 kV (theo QT vận hành Điều 2) ----------------
  private ats(dt: number): void {
    const p = this.plant;
    const av1 = p.vkv[Plant.TD61L] > 0.34; const av2 = p.vkv[Plant.TD32L] > 0.34;
    if (this.on(this.s.axt1) && this.on(this.s.axt2)) {
      this.s.axt2 = 0.0;
      this.s.log('ERR', 3, 'Liên động: không được hoà TD61 với TD32 – cắt 2AXT');
    }
    if (!this.dgAuto) return;
    if (this.dgCb) {
      this.backTdT = av1 || av2 ? this.backTdT + dt : 0.0;
      if (this.backTdT > 10.0 && this.on(this.s.standbyInput400)) {
        this.s.standbyInput400 = 0.0;
        this.s.log('CMD', 3, 'ATS: MBA tự dùng có điện trở lại – cắt máy phát diesel');
      }
      return;
    }
    this.lost1T = this.on(this.s.axt1) && !av1 ? this.lost1T + dt : 0.0;
    this.lost2T = this.on(this.s.axt2) && !av2 ? this.lost2T + dt : 0.0;
    if (this.lost1T > 2.0) {
      this.s.axt1 = 0.0; this.lost1T = 0.0; this.s.log('POS', 3, 'ATS: TD61 mất điện – cắt 1AXT');
      if (av2) { this.s.axt2 = 1.0; this.s.log('POS', 3, 'ATS: đóng 2AXT – tự dùng lấy từ TD32'); }
    }
    if (this.lost2T > 2.0) {
      this.s.axt2 = 0.0; this.lost2T = 0.0; this.s.log('POS', 3, 'ATS: TD32 mất điện – cắt 2AXT');
      if (av1) { this.s.axt1 = 1.0; this.s.log('POS', 3, 'ATS: đóng 1AXT – tự dùng lấy từ TD61'); }
    }
    this.noneT = !this.on(this.s.axt1) && !this.on(this.s.axt2) && (av1 || av2) ? this.noneT + dt : 0.0;
    if (this.noneT > 1.0) {
      this.noneT = 0.0;
      if (av1) { this.s.axt1 = 1.0; this.s.log('POS', 3, 'ATS: đóng 1AXT – tự dùng lấy từ TD61'); }
      else { this.s.axt2 = 1.0; this.s.log('POS', 3, 'ATS: đóng 2AXT – tự dùng lấy từ TD32'); }
    }
    this.back61T = this.on(this.s.axt2) && av1 ? this.back61T + dt : 0.0;
    if (this.back61T > 30.0) {
      this.back61T = 0.0; this.s.axt2 = 0.0; this.s.axt1 = 1.0;
      this.s.log('POS', 3, 'ATS: TD61 có điện ổn định – chuyển tự dùng về TD61 (ưu tiên)');
    }
  }

  // ---------------- Trạng thái thiết bị -> mô hình ----------------
  private inputs(): void {
    const p = this.plant;
    // máy cắt
    const cbs: Array<[string, Sw, number]> = [
      ['MC 601', p.s601, this.s.g1.cb60], ['MC 602', p.s602, this.s.g2.cb60],
      ['MC 331', p.s331, this.s.g1.cb33], ['MC 332', p.s332, this.s.g2.cb33],
      ['MC 371', p.s371, this.s.cb371], ['MC 372', p.s372, this.s.cb372],
    ];
    for (const [k, sw, v] of cbs) {
      if (sw.closed !== this.on(v)) {
        this.lastOp = (this.on(v) ? 'Đóng ' : 'Cắt ') + k;
        this.lastOpT = p.simTime;
      }
      sw.closed = this.on(v);
    }
    // dao cách ly: thao tác khi đang có dòng / đóng vào điểm có dòng lớn -> hồ quang
    for (const [key, sw] of this.dsSw) this.operateDs(key, sw, this.on(this.dsVal(key)));
    p.sFco.closed = !this.fcoBlown;
    p.sAxt1.closed = this.on(this.s.axt1); p.sAxt2.closed = this.on(this.s.axt2);
    p.sDG.closed = this.dgCb;
    const prevEarth = new Set(p.earth.keys());
    p.earth.clear();
    const e = (name: string, v: number) => {
      if (!this.on(v)) return;
      const node = p.nodeOfEarth(name);
      if (node === null) return;
      p.earth.set(name, node);
      // vừa đóng dao nối đất vào phần thiết bị còn điện: ngắn mạch 3 pha ngay tại dao
      if (!prevEarth.has(name) && p.simTime > 2.0 && p.net.v[node].abs() > 0.1) {
        this.earthHot.add(name);
        this.lastOp = `Đóng dao nối đất ${name}`; this.lastOpT = p.simTime;
        const m = `Đóng dao nối đất ${name} vào ${p.nodeName(node)} đang có điện (${fmt1(p.vkv[node])} kV) – ngắn mạch 3 pha tại dao`;
        this.s.video('dson_fire.mp4'); this.s.log('ERR', 3, m); this.s.event('msg', m); this.s.alarm(true); this.s.incident(m);
      }
    };
    e('1QE', this.s.g1.gsQE); e('2QE', this.s.g2.gsQE); e('1QE1', this.s.g1.gsQE1); e('2QE1', this.s.g2.gsQE1);
    e('331-14', this.s.g1.gs14); e('331-15', this.s.g1.gs15); e('332-24', this.s.g2.gs14); e('332-25', this.s.g2.gs15);
    e('371-15', this.s.gs371_15); e('371-75', this.s.gs371_75); e('371-76', this.s.gs371_76);
    e('372-25', this.s.gs372_25); e('372-75', this.s.gs372_75); e('372-76', this.s.gs372_76);
    p.gridAvailable = !this.gridLost;
    p.inflowM3s = this.cfg().inflowM3s * this.s.inflow;
    p.intakeCmd[0] = this.on(this.s.intakeGate); p.intakeCmd[1] = this.on(this.s.intakeGate);
    // Cảnh báo: cửa nhận nước đang đóng khi có tổ máy quay (không phải dừng sự cố loại 2)
    const unitRunning = p.units.some(x => x.omega > 0.3);
    if (!this.on(this.s.intakeGate) && unitRunning && p.intake[0] < 0.999) {
      if (!this.intakeWarned) {
        this.intakeWarned = true;
        const m = 'CẢNH BÁO: cửa nhận nước đang ĐÓNG khi tổ máy đang quay – cột nước giảm, tổ máy sẽ mất công suất và chạy động cơ (bảo vệ 32)';
        this.s.log('WARN', 3, m); this.s.event('msg', m); this.s.alarm();
      }
    } else if (this.on(this.s.intakeGate) || !unitRunning) this.intakeWarned = false;

    const pairs: Array<[Gen, HydroUnit]> = [[this.s.g1, p.u1], [this.s.g2, p.u2]];
    const runStates = new Set(['S5', 'S6', 'S7', 'EXCITE', 'NOLOAD', 'FREE', 'SYNC', 'LOAD', 'RUN']);
    for (const [g, u] of pairs) {
      const autoAux = this.on(g.auxAuto);
      const sp = g.no === 1 ? p.autoSp1 : p.autoSp2;
      sp.oilAuto = autoAux;
      sp.hcAuto = autoAux;
      // Chế độ AUTO: giữ nước làm mát hoạt động khi tổ máy đang vận hành (sau bước S4); chế độ MANUAL không tự ghi đè bơm/van
      if (autoAux && p.auxV > 0.75 && !g.tripped && runStates.has(this.seq[g.no - 1].state)) {
        if (!this.on(g.cwValve)) g.cwValve = 1.0;
        if (!this.on(g.waterPump1) && !this.on(g.waterPump2) && !g.wpFail) g.waterPump1 = 1.0;
      }
      u.servoLocked = this.on(g.servoLock);
      u.govAuto = this.on(g.govAuto);
      u.bladeAuto = this.on(g.bladeAuto);
      u.gvManualTarget = coerceIn(g.gvManual / 100.0, 0.0, 1.0);
      u.bladeManualDeg = coerceIn(g.bladeManual, -10.0, 12.0);
      u.gvLimit = coerceIn(g.gvLimit / 100.0, 0.0, 1.0);
      u.mk = this.on(g.fieldDischarge);
      u.brake = !this.on(g.airBrake);
      u.cwRun = this.on(g.cwValve) && (this.on(g.waterPump1) || this.on(g.waterPump2));
      u.cwFail = g.wpFail;
      u.oilPumpFail = g.opFail;
      u.hcPumpFail = g.hcFail;
      u.leakFault = g.leakFault;
      u.thrustFaultK = g.bearingFault ? 3.0 : 1.0;
      u.coolerFouling = g.statorFault ? 0.15 : 1.0;
      u.sealAir = this.on(g.maintSeal);
      u.heater = this.on(g.heater);
      // lệnh bơm từ SD200/HMI -> thiết bị
      this.syncCmd(`op1${g.no}`, g.oilPump1, (v) => { u.oilPump[0] = v; });
      this.syncCmd(`op2${g.no}`, g.oilPump2, (v) => { u.oilPump[1] = v; });
      this.syncCmd(`hc1${g.no}`, g.hc1, (v) => { u.hcPump[0] = v; });
      this.syncCmd(`hc2${g.no}`, g.hc2, (v) => { u.hcPump[1] = v; });
    }
    this.syncPub('leak1', (v) => { p.sumpPump[0] = v; }); this.syncPub('leak2', (v) => { p.sumpPump[1] = v; });
    this.syncPub('drain1', (v) => { p.drainPump[0] = v; }); this.syncPub('drain2', (v) => { p.drainPump[1] = v; });
    this.syncPub('lpc1', (v) => { p.lpComp[0] = v; }); this.syncPub('lpc2', (v) => { p.lpComp[1] = v; });
    this.syncPub('hpc1', (v) => { p.hpComp[0] = v; }); this.syncPub('hpc2', (v) => { p.hpComp[1] = v; });
    this.syncPub('oilleak', (v) => { p.oilLeakPump = v; });

    // phụ tải tự dùng 0,4 kV (kW) theo thiết bị đang chạy
    let kw = this.cfg().auxBaseKW;
    for (const u of p.units) {
      kw += (u.oilPump[0] ? 37.0 : 0.0) + (u.oilPump[1] ? 37.0 : 0.0);
      kw += u.cwRun ? 15.0 : 0.0;
      kw += (u.hcPump[0] ? 7.5 : 0.0) + (u.hcPump[1] ? 7.5 : 0.0);
      kw += u.heater ? 10.0 : 0.0;
      kw += u.excOn ? 8.0 : 0.0;
    }
    kw += (p.sumpPump[0] ? 22.0 : 0.0) + (p.sumpPump[1] ? 22.0 : 0.0);
    kw += (p.drainPump[0] ? 30.0 : 0.0) + (p.drainPump[1] ? 30.0 : 0.0);
    kw += (p.lpComp[0] ? 15.0 : 0.0) + (p.lpComp[1] ? 15.0 : 0.0);
    kw += (p.hpComp[0] ? 11.0 : 0.0) + (p.hpComp[1] ? 11.0 : 0.0);
    p.auxLoadKW = kw;
  }

  private dsVal(key: string): number {
    switch (key) {
      case 'IS371_7': return this.s.is371_7;
      case 'IS371_1': return this.s.is371_1;
      case 'IS372_7': return this.s.is372_7;
      case 'IS372_2': return this.s.is372_2;
      case 'IS331_1': return this.s.g1.is33;
      case 'IS332_2': return this.s.g2.is33;
      case 'IS312_1': return this.s.is312_1;
      case 'IS612_1': return this.s.is612_1;
      case 'IS612_2': return this.s.is612_2;
      default: return 0.0;
    }
  }

  private ampsAt(node: number, pu: number): number {
    if (Plant.HV.has(node)) return pu * (10e6 / (Math.sqrt(3.0) * 38500));
    if (Plant.AUXN.has(node)) return pu * (10e6 / (Math.sqrt(3.0) * 400));
    return pu * (10e6 / (Math.sqrt(3.0) * Math.max(this.cfg().genKV * 1000.0, 100.0)));
  }

  private dsName(key: string): string {
    return key.replace(/^IS/, '').replace(/_/g, '-');
  }

  private operateDs(key: string, sw: Sw, want: boolean): void {
    if (sw.closed === want) return;
    this.lastOp = (want ? 'Đóng dao ' : 'Cắt dao ') + this.dsName(key);
    this.lastOpT = this.plant.simTime;
    if (this.plant.simTime > 2.0) {
      if (!want) {
        const i = sw.i.abs();
        if (i > this.arcBreakPu) this.startArc(key, sw, false, i);
      } else {
        this.pendingMake.push([key, sw]);
      }
    }
    sw.closed = want;
  }

  private startArc(key: string, sw: Sw, closing: boolean, i: number): void {
    const p = this.plant;
    // hồ quang phát triển thành ngắn mạch 3 pha tại phía dao còn nguồn (điện áp cao hơn)
    const node = p.net.v[sw.a].abs() >= p.net.v[sw.b].abs() ? sw.a : sw.b;
    const id = `arc.${key}`;
    for (let idx = p.faults.length - 1; idx >= 0; idx--) {
      if (p.faults[idx].id === id) p.faults.splice(idx, 1);
    }
    p.faults.push(new ShortCircuit(id, node, '3P', -1.0, 0.02));
    this.arcClearT.set(id, 0.0);
    const m =
      (closing ? 'Đóng' : 'Cắt') +
      ` dao cách ly ${this.dsName(key)} khi ` +
      (closing ? `có dòng xung (${fmt0(this.ampsAt(node, i))} A)` : `đang mang dòng ${fmt0(this.ampsAt(node, i))} A`) +
      ` – hồ quang, ngắn mạch 3 pha tại ${p.nodeName(node)}`;
    this.s.arcEvent(key, closing, m);
    this.shift.note(m);
  }

  /** Sau khi giải lưới: dòng đóng dao, dòng sự cố qua dao nối đất */
  private afterSolve(_dt: number): void {
    const p = this.plant;
    for (const [key, sw] of this.pendingMake) {
      if (sw.closed && sw.i.abs() > this.arcMakePu) this.startArc(key, sw, true, sw.i.abs());
    }
    this.pendingMake.length = 0;
    for (const [name, node] of p.earth.entries()) {
      const i = p.faultCurrent(node);
      if (i > 0.3 && !this.earthHot.has(name)) {
        this.earthHot.add(name);
        const cause = p.simTime - this.lastOpT < 2.0 && this.lastOp.length > 0 ? `${this.lastOp} → ` : '';
        const m = `${cause}ngắn mạch 3 pha qua dao nối đất ${name} (${p.nodeName(node)}), I ≈ ${fmt2(this.ampsAt(node, i) / 1000)} kA`;
        this.s.log('ERR', 3, m); this.s.event('msg', m); this.s.alarm(true); this.s.incident(m);
      } else if (i < 0.05) {
        this.earthHot.delete(name);
      }
    }
    for (const k of Array.from(this.earthHot)) if (!p.earth.has(k)) this.earthHot.delete(k);

    // Xử lý sự kiện sa thải phụ tải do điều tốc kích hoạt: ghi nhật ký, chuyển trình tự về NOLOAD, giữ kích từ
    for (let i = 0; i < p.units.length; i++) {
      const u = p.units[i];
      if (u.loadRejectEvent) {
        u.loadRejectEvent = false;
        const g = i === 0 ? this.s.g1 : this.s.g2;
        const st = this.seq[i].state;
        // Trình tự dừng máy đã giảm tải về không tải rồi mới cắt MC 33x: thao tác bình thường, không phải sa thải
        if (st === 'UNLOAD' || st.startsWith('STOP')) continue;
        if (u.loadRejectPrePu < 0.2) {
          // tách lưới khi tải nhỏ (< 20 % định mức): điều tốc chuyển điều tần, chạy không tải – không báo sa thải
          this.s.log('SEQ', g.no, `MF${g.no}: tách lưới khi tải nhỏ (${fmt0(u.loadRejectPrePu * 100)} % định mức) – điều tốc chuyển điều tần, chạy không tải`);
          this.seq[i].onLoadRejection('Tách lưới khi tải nhỏ – chạy không tải (giữ kích từ)');
          continue;
        }
        const m = `MF${g.no}: SA THẢI PHỤ TẢI (${fmt1(u.loadRejectPrePu * this.cfg().turbineMW)} MW) – điều tốc đưa tổ máy về không tải`;
        this.s.log('WARN', g.no, m);
        this.s.event('msg', m);
        this.s.incident(m, 1);
        this.shift.note(m);
        this.seq[i].onLoadRejection();
      }
    }
  }

  private syncCmd(key: string, v: number, set: (b: boolean) => void): void {
    if (this.lastCmd.get(key) !== v) {
      set(this.on(v));
      this.lastCmd.set(key, v);
    }
  }

  private syncPub(key: string, set: (b: boolean) => void): void {
    const v = this.s.pubDev[key] ?? false;
    if (this.lastPub.get(key) !== v) {
      set(v);
      this.lastPub.set(key, v);
    }
  }

  // ---------------- Rơ le tác động ----------------
  private relays(dt: number): void {
    for (const [unit, r] of this.plant.tripped) this.onRelay(unit, r);
    this.plant.tripped.length = 0;
    // hồ quang tắt khi nguồn cấp vào điểm sự cố đã bị cắt (dòng sự cố về 0)
    const arcs = this.plant.faults.filter((f) => f.id.startsWith('arc.'));
    for (const f of arcs) {
      const t = this.plant.faultCurrent(f.node) < 0.01 ? (this.arcClearT.get(f.id) ?? 0.0) + dt : 0.0;
      this.arcClearT.set(f.id, t);
      if (t > 0.3) {
        const idx = this.plant.faults.indexOf(f);
        if (idx >= 0) this.plant.faults.splice(idx, 1);
        this.arcClearT.delete(f.id);
        const m = `Hồ quang tại dao ${this.dsName(f.id.replace(/^arc\./, ''))} đã tắt – nguồn cấp vào ${this.plant.nodeName(f.node)} bị cắt`;
        this.s.log('POS', 3, m); this.s.incident(m);
      }
    }
    // sự cố đường dây thoáng qua: hết khi máy cắt đường dây đã cắt
    const rmId = (id: string) => {
      for (let i = this.plant.faults.length - 1; i >= 0; i--) {
        if (this.plant.faults[i].id === id) this.plant.faults.splice(i, 1);
      }
    };
    if (!this.on(this.s.cb371)) rmId('line371');
    if (!this.on(this.s.cb372)) rmId('line372');
    if (!this.on(this.s.g1.cb60)) rmId('g1.fire');
    if (!this.on(this.s.g2.cb60)) rmId('g2.fire');
    if (!this.on(this.s.g1.cb33)) rmId('g1.tr');
    if (!this.on(this.s.g2.cb33)) rmId('g2.tr');
  }

  private onRelay(unit: number, r: Relay): void {
    const trip = r.act !== Act.ALARM;
    this.s.log(trip ? 'TRIP' : 'ALM', unit, `${r.code}: ${r.name}`);
    this.s.event('msg', `${this.s.unitName(unit)}: ${r.name}`);
    this.s.alarm(trip);
    this.shift.note(`${this.s.unitName(unit)} – ${r.name}`);
    if (trip) this.s.incident(`${this.s.unitName(unit)}: ${r.code} ${r.name}`);
    if (unit === 3) {
      if (r.act === Act.TRIP_LINE && r.code.startsWith('TBA')) {
        if (r.code.includes('371')) this.plant.tba371 = false; else this.plant.tba372 = false;
        this.s.log('TRIP', 3, `TBA 110/35 kV cắt máy cắt đầu đường dây ${r.code.includes('371') ? '371' : '372'} phía TBA`);
        return;
      }
      if (r.act === Act.TRIP_LINE) {
        if (r.code.includes('371')) { if (this.on(this.s.cb371)) { this.s.cb371 = 0.0; this.shift.cbTrip('371'); } }
        else { if (this.on(this.s.cb372)) { this.s.cb372 = 0.0; this.shift.cbTrip('372'); } }
      }
      return;
    }
    const g = unit === 1 ? this.s.g1 : this.s.g2;
    const q = this.seq[unit - 1];
    switch (r.act) {
      case Act.TRIP331:
        if (this.on(g.cb33)) { g.cb33 = 0.0; this.shift.cbTrip(unit === 1 ? '331' : '332'); }
        break;
      case Act.TRIP_ALL:
        q.emergency(1, r.name, true);
        break;
      case Act.TRIP_NOLOAD:
        q.tripToNoLoad(r.name);
        break;
      case Act.STOP1:
        q.emergency(1, r.name);
        break;
      case Act.STOP2:
        q.emergency(2, r.name);
        break;
      default:
        break;
    }
  }

  /** Tín hiệu cắt máy: phân loại theo rơ le tương ứng, không có thì coi là dừng sự cố loại 1 phần cơ */
  tripBySignal(g: Gen, desc: string): void {
    const d = desc.toLowerCase();
    const prot = this.plant.genProt[g.no - 1];
    prot.r64a.act = this.cfg().relay.g64_100Trip ? Act.TRIP_ALL : Act.ALARM;
    const r = prot.all.find((it) => it !== prot.r5027 && it.key.length > 0 && d.includes(it.key));
    const q = this.seq[g.no - 1];
    switch (r?.act) {
      case Act.ALARM: break;
      case Act.TRIP_NOLOAD: q.tripToNoLoad(desc); break;
      case Act.TRIP_ALL: q.emergency(1, desc, true); break;
      case Act.STOP2: q.emergency(2, desc); break;
      case Act.TRIP331:
        if (this.on(g.cb33)) { g.cb33 = 0.0; this.shift.cbTrip(g.no === 1 ? '331' : '332'); }
        break;
      default:
        q.emergency(1, desc);
        break;
    }
  }

  tripAll(g: Gen): void {
    if (this.on(g.cb33)) { g.cb33 = 0.0; this.shift.cbTrip(g.no === 1 ? '331' : '332'); }
    if (this.on(g.cb60)) { g.cb60 = 0.0; this.shift.cbTrip(g.no === 1 ? '601' : '602'); }
    g.fieldDischarge = 0.0;
  }

  // ---------------- Mô hình -> biến cũ (SD200, HMI) ----------------
  private outputs(): void {
    const p = this.plant;
    const pairs: Array<[Gen, HydroUnit]> = [[this.s.g1, p.u1], [this.s.g2, p.u2]];
    const off = [0.0, 0.6, 1.1, -0.4, 0.9, 0.3];
    for (const [g, u] of pairs) {
      const tNode = g.no === 1 ? Plant.G1T : Plant.G2T;
      const bNode = g.no === 1 ? Plant.B61 : Plant.B62;
      g.speed = u.rpm;
      g.freq = u.omega > 0.005 ? u.omega * 50 : 0.0;
      g.freqOut = g.freq;
      g.running = this.b(u.omega > 0.02);
      g.guideValve = u.gv * 100;
      g.blade = u.blade * 100;
      if (u.govAuto) g.gvManual = g.guideValve;
      if (u.bladeAuto) g.bladeManual = u.bladeAngleDeg;
      g.flow = u.flowM3s; g.head = u.headM;
      g.vgen = p.vkv[tNode];
      g.pload = u.peTerm * 10 * 100; g.qload = u.qeTerm * 10 * 100;
      const iBase = Math.max(this.cfg().genA, 10.0);
      g.ia = u.iaPu * iBase; g.ib = u.ibPu * iBase; g.ic = u.icPu * iBase;
      g.i60 = g.ia;
      g.iexc = u.ifA; g.vexc = u.mk && u.excOn ? u.ufV : 0.0;
      g.excitedEnable = this.b(u.excOn);
      g.v60 = p.vkv[bNode]; g.f60 = p.fHz[bNode];
      g.oilMPa = u.oilPressMPa; g.oilPress = u.oilPressMPa * 25;
      g.cwMPa = u.cwPressMPa; g.cwPress = (u.cwPressMPa / 0.32) * 100;
      g.cwTemp = this.cfg().riverTempC + 1.5 * u.cwFlow;
      g.airPress = p.lpAirMPa * 125;
      g.headCoverMM = u.headCoverMM; g.leakage = u.headCoverMM / 20.0;
      g.oilPump1 = this.b(u.oilPump[0]); g.oilPump2 = this.b(u.oilPump[1]);
      this.lastCmd.set(`op1${g.no}`, g.oilPump1); this.lastCmd.set(`op2${g.no}`, g.oilPump2);
      g.hc1 = this.b(u.hcPump[0]); g.hc2 = this.b(u.hcPump[1]);
      this.lastCmd.set(`hc1${g.no}`, g.hc1); this.lastCmd.set(`hc2${g.no}`, g.hc2);
      g.leakReset = this.b(u.hcForceDrain);
      for (let i = 0; i <= 5; i++) {
        g.upper[i] = u.tUpperPad + off[i]; g.lower[i] = u.tLowerPad + off[(i + 2) % 6];
        g.thrust[i] = u.tThrustPad + off[(i + 4) % 6]; g.stator[i] = u.tCoil + off[(i + 1) % 6] * 2;
        g.core[i] = u.tCore + off[(i + 3) % 6];
      }
      for (let i = 0; i <= 3; i++) g.coldAir[i] = u.tColdAir + off[i] * 0.5;
      for (let i = 0; i <= 1; i++) g.hotAir[i] = u.tHotAir + off[i];
      g.upperOil = u.tUpperOil; g.lowerOil = u.tLowerOil; g.thrustOil = u.tThrustOil;
      g.turbPad = u.tTurbPad; g.turbOil = u.tTurbOil; g.trOil = u.tTrOil; g.trWinding = u.tTrWinding;
      // góc lệch pha máy phát – thanh cái 35 kV (cho đồng bộ kế)
      const vg = p.net.v[tNode];
      const vb = p.net.v[g.no === 1 ? Plant.N331A : Plant.N332A];
      g.phase =
        vg.abs() > 0.1 && vb.abs() > 0.1
          ? (((((vg.arg() - vb.arg()) * 180) / Math.PI + 540) % 360) + 360) % 360 - 180
          : 180.0;
      g.speedSetting = u.nref * 50;
    }
    this.s.vbusZone1 = p.vkv[Plant.B31]; this.s.vbusZone2 = p.vkv[Plant.B32];
    this.s.freqZone1 = p.fHz[Plant.B31]; this.s.freqZone2 = p.fHz[Plant.B32];
    this.s.v371 = p.vkv[Plant.N371L]; this.s.v372 = p.vkv[Plant.N372L];
    this.s.p371 = p.p371; this.s.q371 = p.q371; this.s.i371 = p.i371;
    this.s.p372 = p.p372; this.s.q372 = p.q372; this.s.i372 = p.i372;
    this.s.vaux6 = p.vkv[Plant.TDH];
    this.s.v400Zone1 = p.vkv[Plant.TD61L]; this.s.v400Zone2 = p.vkv[Plant.TD32L]; this.s.v400 = p.vkv[Plant.AUX];
    this.s.headHigh = p.zUp - p.zTail;
    const low = p.zUp < this.cfg().deadLevelM;
    if (low !== this.lowLevel) {
      this.lowLevel = low;
      if (low) {
        this.s.log('ALARM', 0, 'Mực nước thượng lưu dưới MNC (+290,83)');
        this.s.event('msg', 'Mực nước hồ dưới mực nước chết');
      }
    }
    const hState =
      p.simTime <= 5.0
        ? 0
        : this.s.headHigh < this.cfg().minHeadM
        ? -1
        : this.s.headHigh > this.cfg().maxHeadM
        ? 1
        : 0;
    if (hState !== this.headRangeAlarm) {
      this.headRangeAlarm = hState;
      if (hState < 0) {
        this.s.log('ALM', 0, `Cột nước làm việc thấp (${fmt2(this.s.headHigh)} m < min ${fmt1(this.cfg().minHeadM)} m)`);
        this.s.event('msg', 'Cột nước thấp hơn ngưỡng tối thiểu');
      } else if (hState > 0) {
        this.s.log('ALM', 0, `Cột nước làm việc cao (${fmt2(this.s.headHigh)} m > max ${fmt1(this.cfg().maxHeadM)} m)`);
        this.s.event('msg', 'Cột nước cao hơn ngưỡng tối đa');
      }
    }
    this.s.pubDev.leak1 = p.sumpPump[0]; this.s.pubDev.leak2 = p.sumpPump[1];
    this.s.pubDev.drain1 = p.drainPump[0]; this.s.pubDev.drain2 = p.drainPump[1];
    this.s.pubDev.lpc1 = p.lpComp[0]; this.s.pubDev.lpc2 = p.lpComp[1];
    this.s.pubDev.hpc1 = p.hpComp[0]; this.s.pubDev.hpc2 = p.hpComp[1];
    this.s.pubDev.oilleak = p.oilLeakPump;
    for (const k of ['leak1', 'leak2', 'drain1', 'drain2', 'lpc1', 'lpc2', 'hpc1', 'hpc2', 'oilleak']) {
      this.lastPub.set(k, this.s.pubDev[k] ?? false);
    }
  }

  // =====================================================================
  // Liên động thao tác (chế độ "strict"): trả về lý do cấm, null nếu cho phép
  // =====================================================================
  interlock(name: string, closing: boolean): string | null {
    if (this.cfg().interlock !== 'strict') return null;
    const p = this.plant;
    const live = (node: number) => p.net.v[node].abs() > 0.1;
    const n = name.toUpperCase();
    // dao cách ly: máy cắt nối tiếp phải cắt
    const dsCb: Record<string, () => number> = {
      IS371_7: () => this.s.cb371, IS371_1: () => this.s.cb371,
      IS372_7: () => this.s.cb372, IS372_2: () => this.s.cb372,
      IS331_1: () => this.s.g1.cb33, IS332_2: () => this.s.g2.cb33,
    };
    if (dsCb[n] && this.on(dsCb[n]())) {
      return `Máy cắt nối tiếp đang đóng – phải cắt máy cắt trước khi thao tác dao ${this.dsName(n)}`;
    }
    const dsEntry = this.dsSw.find((it) => it[0] === n);
    if (!closing && dsEntry) {
      const sw = dsEntry[1];
      if (sw.closed && sw.i.abs() > this.arcBreakPu) {
        return `Dao ${this.dsName(n)} đang mang dòng ${fmt0(this.ampsAt(sw.a, sw.i.abs()))} A – cắt dao sẽ phát sinh hồ quang`;
      }
    }
    // đóng dao cách ly nối phần có điện với chỗ đang nối đất
    if (closing && dsEntry) {
      const sw = dsEntry[1];
      const earths = this.earthsAfterClosing(sw);
      const grp = this.groupAfterClosing(sw);
      if (earths.length > 0 && Array.from(grp).some((it) => live(it))) {
        return `Đóng dao ${this.dsName(n)} sẽ nối phần có điện vào dao nối đất ${earths.join(', ')} đang đóng`;
      }
    }
    if (n === 'IS312_1' && !closing && p.s312.closed && p.s312.i.abs() > 0.02) {
      return 'Dao phân đoạn 312-1 đang mang dòng tải';
    }
    // đóng dao cách ly chỉ khi không làm phát sinh dòng: hai phía cùng một hệ (đẳng thế) hoặc một phía hoàn toàn cô lập
    if (closing && dsEntry) {
      const sw = dsEntry[1];
      const la = live(sw.a); const lb = live(sw.b);
      if (la && lb && p.net.island[sw.a] !== p.net.island[sw.b]) {
        return `Hai phía dao ${this.dsName(n)} có nguồn độc lập (không cùng hệ) – đóng dao sẽ gây dòng xung và hồ quang`;
      }
      if (la !== lb) {
        const dead = la ? sw.b : sw.a;
        const isl = p.net.island[dead];
        const names: Array<[number, string]> = [
          [Plant.G1T, 'MF1'], [Plant.G2T, 'MF2'], [Plant.TBA, 'lưới TBA'],
          [Plant.AUX, 'tự dùng 0,4 kV'], [Plant.DGN, 'máy phát diesel'],
        ];
        const hit = names.filter(([nd]) => p.net.island[nd] === isl).map(([, nm]) => nm);
        if (hit.length > 0) {
          return `Phía không điện của dao ${this.dsName(n)} còn nối với ${hit.join(', ')} – đóng dao sẽ mang dòng, phải cắt máy cắt phía đó trước`;
        }
      }
    }
    if ((n === 'IS612_1' && closing && this.on(this.s.is612_2)) || (n === 'IS612_2' && closing && this.on(this.s.is612_1))) {
      return 'Không được đóng đồng thời 612-1 và 612-2';
    }
    // dao nối đất: phần thiết bị phải không điện
    if (n.startsWith('GS') && closing) {
      const key = n.replace(/^GS/, '').replace(/_/g, '-');
      const node = p.nodeOfEarth(key);
      if (node !== null && live(node)) {
        return `Phần thiết bị tại dao nối đất ${key} còn điện (${fmt1(p.vkv[node])} kV)`;
      }
    }
    // máy cắt: không đóng khi còn dao nối đất trong vùng
    if (n.startsWith('CB') && closing) {
      const k = n.replace(/^CB/, '');
      const sw = this.cbSw(k);
      if (sw) {
        const earths = this.earthsAfterClosing(sw);
        if (earths.length > 0) return `Còn dao nối đất ${earths.join(', ')} đang đóng trong vùng máy cắt ${k}`;
      }
      if (k === '331' || k === '332') {
        const g = k === '331' ? this.s.g1 : this.s.g2;
        const pc = this.cfg();
        const zoneV = k === '331' ? this.s.vbusZone1 : this.s.vbusZone2;
        const busF = k === '331' ? this.s.freqZone1 : this.s.freqZone2;
        const busV = (zoneV * pc.genKV) / 38.5;
        if (zoneV > 10 && this.on(g.is33)) {
          if (g.speed < 180 || g.vgen < 3.0) {
            return `MF${g.no} chưa đạt tốc độ / điện áp định mức – cấm đóng MC ${k} vào thanh cái 35 kV đang có điện`;
          }
          const df = Math.abs(g.freq - busF);
          const dv = busV > 0.1 ? (Math.abs(g.vgen - busV) / busV) * 100.0 : 100.0;
          const ph = Math.abs(g.phase);
          if (df > pc.syncMaxDfHz || dv > pc.syncMaxDvPct || ph > pc.syncMaxPhaseDeg) {
            return `Chưa đủ điều kiện hoà (Δf = ${fmt2(df)} Hz, ΔU = ${fmt1(dv)} %, Δφ = ${fmt0(ph)}°; ngưỡng Δf≤${fmt2(pc.syncMaxDfHz)} Hz, ΔU≤${fmt1(pc.syncMaxDvPct)} %, Δφ≤${fmt0(pc.syncMaxPhaseDeg)}°) – dùng bộ hoà tự động hoặc trang Hoà đồng bộ`;
          }
        }
      }
    }
    return null;
  }

  private cbSw(k: string): Sw | null {
    switch (k) {
      case '371': return this.plant.s371;
      case '372': return this.plant.s372;
      case '331': return this.plant.s331;
      case '332': return this.plant.s332;
      case '601': return this.plant.s601;
      case '602': return this.plant.s602;
      default: return null;
    }
  }

  /** Các nút nối điện với khoá sw (qua khoá đang đóng, coi sw đã đóng) – không đi qua MBA, đường dây */
  private groupAfterClosing(sw: Sw): Set<number> {
    const seen = new Set<number>();
    const stack: number[] = [sw.a, sw.b];
    while (stack.length > 0) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      for (const o of this.plant.net.sws) {
        if ((o.closed || o === sw) && (o.a === x || o.b === x)) {
          stack.push(o.a === x ? o.b : o.a);
        }
      }
    }
    return seen;
  }

  private earthsAfterClosing(sw: Sw): string[] {
    const g = this.groupAfterClosing(sw);
    const out: string[] = [];
    for (const [k, v] of this.plant.earth.entries()) if (g.has(v)) out.push(k);
    return out.sort();
  }

  // =====================================================================
  // Sự cố vật lý
  // =====================================================================
  applyFault(id: string, active: boolean): boolean {
    const p = this.plant;
    const parts = id.split('.');
    const sc = (fid: string, node: number, type: string, sec = -1.0) => {
      for (let i = p.faults.length - 1; i >= 0; i--) if (p.faults[i].id === fid) p.faults.splice(i, 1);
      if (active) p.faults.push(new ShortCircuit(fid, node, type, sec));
    };
    if (parts.length === 2 && (parts[0] === 'g1' || parts[0] === 'g2')) {
      const no = parts[0] === 'g1' ? 1 : 2;
      const u = no === 1 ? p.u1 : p.u2;
      const g = no === 1 ? this.s.g1 : this.s.g2;
      const tNode = no === 1 ? Plant.G1T : Plant.G2T;
      switch (parts[1]) {
        case 'fire': sc(id, tNode, '3P'); return true;
        case 'sgnd': sc(id, tNode, '1PG'); return true;
        case 'tr': sc(id, no === 1 ? Plant.N331B : Plant.N332B, '3P'); return true;
        case 'excloss': u.avrFail = active ? 1 : 0; return true;
        case 'avrhigh': u.avrFail = active ? 2 : 0; return true;
        case 'gov': u.govFail = active; return true;
        case 'shear': u.shearPin = active; if (active) this.seq[no - 1].emergency(2, 'Gãy chốt cắt cánh hướng'); return true;
        case 'oilpump': g.opFail = active; u.oilLeak = active; return true;
      }
      return false;
    }
    switch (id) {
      case 'line371': sc(id, Plant.N371L, '3P'); return true;
      case 'line372': sc(id, Plant.N372L, '3P'); return true;
      case 'line371g': sc(id, Plant.N371L, '1PG'); return true;
      case 'line372g': sc(id, Plant.N372L, '1PG'); return true;
      case 'bus31': sc(id, Plant.B31, '2P', 1.5); return true;
      case 'grid': this.gridLost = active; return true;
      case 'aux': this.fcoBlown = active; if (active) { this.s.axt1 = 0.0; this.s.axt2 = 0.0; } return true;
      case 'dry': this.s.inflow = active ? 0.4 : 1.0; return true;
      case 'flood': this.s.inflow = active ? 3.5 : 1.0; return true;
    }
    return false;
  }

  clearAll(): void {
    this.plant.faults.length = 0;
    this.gridLost = false; this.fcoBlown = false;
    this.arcClearT.clear(); this.earthHot.clear(); this.pendingMake.length = 0;
    for (const u of this.plant.units) { u.avrFail = 0; u.govFail = false; u.shearPin = false; u.oilLeak = false; }
    for (const gp of this.plant.genProt) gp.reset();
    for (const lp of this.plant.lineProt) lp.reset();
    for (const lp of this.plant.tbaProt) lp.reset();
    this.plant.tba371 = true; this.plant.tba372 = true; // điều độ cho đóng lại đầu TBA
  }

  /**
   * Nút XOÁ CẢNH BÁO (giải trừ tín hiệu): reset các rơ le đã chốt mà điều kiện tác động đã hết,
   * điều độ cho đóng lại máy cắt đầu TBA nếu rơ le phía TBA đã trở về.
   */
  resetRelays(): string[] {
    const stuck: string[] = [];
    const rs = (list: Relay[], owner: string) => {
      for (const r of list) {
        if (r.picked) { if (r.operated) stuck.push(`${owner} ${r.code}`); }
        else r.reset();
      }
    };
    this.plant.genProt.forEach((gp, k) => rs(gp.all, `MF${k + 1}`));
    this.plant.lineProt.forEach((lp) => rs(lp.all, 'Ngăn'));
    this.plant.tbaProt.forEach((lp, k) => {
      rs(lp.all, 'TBA');
      const back = lp.all.every((it) => !it.operated);
      if (k === 0 && !this.plant.tba371 && back) {
        this.plant.tba371 = true;
        this.s.log('CMD', 3, 'Điều độ đóng lại máy cắt đầu đường dây 371 phía TBA');
      }
      if (k === 1 && !this.plant.tba372 && back) {
        this.plant.tba372 = true;
        this.s.log('CMD', 3, 'Điều độ đóng lại máy cắt đầu đường dây 372 phía TBA');
      }
    });
    for (const k of Array.from(this.earthHot)) {
      const n = this.plant.earth.get(k);
      if (n === undefined || this.plant.faultCurrent(n) < 0.3) this.earthHot.delete(k);
    }
    return stuck;
  }

  resetUnit(no: number): void {
    this.plant.genProt[no - 1].reset();
  }

  exportState(): Record<string, unknown> {
    return {
      plant: this.plant.exportState(),
      seq: [this.seq[0].exportState(), this.seq[1].exportState()],
      shift: this.shift.exportState(),
      gridLost: this.gridLost, fcoBlown: this.fcoBlown, inflowFactor: this.inflowFactor,
      dgAuto: this.dgAuto, dgCb: this.dgCb, dgEngine: this.dgEngine, dgFail: this.dgFail,
      dgT: this.dgT, deadT: this.deadT, coolT: this.coolT, dgOverT: this.dgOverT,
      upT: this.upT, dgAutoStart: this.dgAutoStart,
      lost1T: this.lost1T, lost2T: this.lost2T, back61T: this.back61T, backTdT: this.backTdT, noneT: this.noneT,
      lowLevel: this.lowLevel, headRangeAlarm: this.headRangeAlarm,
    };
  }

  importState(d: Record<string, unknown> | null | undefined): void {
    if (!d) return;
    this.plant.importState(d.plant as Record<string, unknown>);
    if (Array.isArray(d.seq)) {
      this.seq[0].importState(d.seq[0] as Record<string, unknown>);
      this.seq[1].importState(d.seq[1] as Record<string, unknown>);
    }
    this.shift.importState(d.shift as Record<string, unknown>);
    const bool = (k: string, cur: boolean) => (typeof d[k] === 'boolean' ? (d[k] as boolean) : cur);
    const num = (k: string, cur: number) => (typeof d[k] === 'number' && Number.isFinite(d[k] as number) ? (d[k] as number) : cur);
    this.gridLost = bool('gridLost', this.gridLost);
    this.fcoBlown = bool('fcoBlown', this.fcoBlown);
    this.inflowFactor = num('inflowFactor', this.inflowFactor);
    this.dgAuto = bool('dgAuto', this.dgAuto);
    this.dgCb = bool('dgCb', this.dgCb);
    this.dgEngine = bool('dgEngine', this.dgEngine);
    this.dgFail = bool('dgFail', this.dgFail);
    this.dgT = num('dgT', this.dgT); this.deadT = num('deadT', this.deadT);
    this.coolT = num('coolT', this.coolT); this.dgOverT = num('dgOverT', this.dgOverT);
    this.upT = num('upT', this.upT); this.dgAutoStart = bool('dgAutoStart', this.dgAutoStart);
    this.lost1T = num('lost1T', this.lost1T); this.lost2T = num('lost2T', this.lost2T);
    this.back61T = num('back61T', this.back61T); this.backTdT = num('backTdT', this.backTdT);
    this.noneT = num('noneT', this.noneT);
    this.lowLevel = bool('lowLevel', this.lowLevel);
    this.headRangeAlarm = num('headRangeAlarm', this.headRangeAlarm);
    // đồng bộ vị trí khoá hiện tại để tránh phát hiện thay đổi giả ở bước đầu sau khi nạp
    this.plant.s601.closed = this.on(this.s.g1.cb60);
    this.plant.s602.closed = this.on(this.s.g2.cb60);
    this.plant.s331.closed = this.on(this.s.g1.cb33);
    this.plant.s332.closed = this.on(this.s.g2.cb33);
    this.plant.s371.closed = this.on(this.s.cb371);
    this.plant.s372.closed = this.on(this.s.cb372);
    for (const [key, sw] of this.dsSw) sw.closed = this.on(this.dsVal(key));
  }
}
