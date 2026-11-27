import { RelaySet } from './PlantConfig';

/** Hành động khi rơ le tác động */
/** ALARM báo tín hiệu; TRIP331 cắt máy cắt khối; TRIP_ALL hư hỏng trong khối: cắt 601+331+MK, dừng sự cố;
 *  TRIP_NOLOAD sự cố bên ngoài (59, 21G, 51): cắt 601+331+MK, tổ máy chạy không tải chờ hoà lại (QT Điều 47–49);
 *  STOP1/STOP2 dừng sự cố loại 1/2 (cắt 601+MK, không cắt 331 – QT Điều 26–27); TRIP_LINE cắt máy cắt đường dây */
export enum Act {
  ALARM = 'ALARM',
  TRIP331 = 'TRIP331',
  TRIP_ALL = 'TRIP_ALL',
  TRIP_NOLOAD = 'TRIP_NOLOAD',
  STOP1 = 'STOP1',
  STOP2 = 'STOP2',
  TRIP_LINE = 'TRIP_LINE',
}

/**
 * Một chức năng bảo vệ: điều kiện + thời gian trễ, chốt khi tác động.
 * key: đoạn chữ thường trùng mô tả tín hiệu trong bảng tag SD200 (để bật đúng coil YXX); rỗng nếu SD200 không có tín hiệu riêng.
 */
export class Relay {
  readonly code: string;
  readonly key: string;
  readonly name: string;
  act: Act;
  t = 0.0;
  picked = false;
  operated = false;

  constructor(code: string, key: string, name: string, act: Act) {
    this.code = code;
    this.key = key;
    this.name = name;
    this.act = act;
  }

  step(cond: boolean, delay: number, dt: number): boolean {
    this.picked = cond;
    this.t = cond ? this.t + dt : 0.0;
    if (cond && this.t >= delay && !this.operated) {
      this.operated = true;
      return true;
    }
    return false;
  }

  reset(): void {
    this.operated = false;
    this.t = 0.0;
    this.picked = false;
  }
}

/** Số đo đưa vào bảo vệ tổ máy (pu trên 10 MVA trừ khi ghi khác) */
export class GenMeas {
  i = 0.0; v = 0.0; fHz = 0.0; p = 0.0; q = 0.0; i2 = 0.0;
  idiffG = 0.0; idiffT = 0.0; u0 = 0.0; u0hv = 0.0;
  omega = 0.0; cb331 = false; cb601 = false; iTr = 0.0; trOil = 0.0;
  efdMaxTime = 0.0; ifA = 0.0; ifRated = 335.0; excited = false;
  thrustOil = 30.0; bearingPad = 30.0; guidePad = 30.0;
  statorTemp = 30.0; hotAir = 30.0; thermalSpeed = 10.0;
  loadRejecting = false; islanded = false;
}

export class GenProtection {
  readonly no: number;
  readonly r87 = new Relay('87G', 'generator differential protection tripping', 'Bảo vệ so lệch dọc máy phát (87G)', Act.TRIP_ALL);
  readonly r87a = new Relay('87G-A', 'differential current over-limit', 'Dòng so lệch vượt ngưỡng', Act.ALARM);
  readonly r5027 = new Relay('50/27', 'generator impedance protection tripping t1', 'Đóng điện nhầm vào máy phát đang dừng (50/27, khối bảo vệ tổng trở)', Act.TRIP_ALL);
  readonly r87T = new Relay('87T', 'block differential protection tripping', 'Bảo vệ so lệch khối máy phát – MBA (87T)', Act.TRIP_ALL);
  readonly r64a = new Relay('64S-100', '100% stator grounding protection tripping', 'Bảo vệ chạm đất stator 100 % (64S)', Act.TRIP_ALL);
  readonly r64 = new Relay('64S-95', '95% stator grounding protection tripping', 'Bảo vệ chạm đất stator 95 % (3U0)', Act.TRIP_ALL);
  readonly r46a = new Relay('46-A', '', 'Quá tải thứ tự nghịch (46G) báo tín hiệu', Act.ALARM);
  readonly r46t1 = new Relay('46-t1', 'negative-sequence over-current t 1', 'Quá dòng thứ tự nghịch t1 (46G)', Act.TRIP331);
  readonly r46t2 = new Relay('46-t2', 'negative-sequence over-current t 2', 'Quá dòng thứ tự nghịch t2 (46G)', Act.TRIP_ALL);
  readonly r40t1 = new Relay('40-t1', 'loss-of-field protection tripping t1', 'Bảo vệ mất kích từ t1 (40)', Act.TRIP331);
  readonly r40t2 = new Relay('40-t2', 'loss-of-field protection tripping t2', 'Bảo vệ mất kích từ t2 (40)', Act.TRIP_ALL);
  readonly r32t1 = new Relay('32-t1', 'reverse-power protection tripping t1', 'Bảo vệ công suất ngược t1 (32)', Act.TRIP331);
  readonly r32t2 = new Relay('32-t2', 'reverse-power protection tripping t2', 'Bảo vệ công suất ngược t2 (32)', Act.TRIP_ALL);
  readonly r51 = new Relay('51G', 'generator over-load protection tripping', 'Bảo vệ quá dòng stato (51G)', Act.TRIP_NOLOAD);
  readonly r50 = new Relay('50G', '', 'Bảo vệ quá dòng cắt nhanh (50G)', Act.TRIP_ALL);
  readonly r21t1 = new Relay('21G-t1', 'generator impedance protection tripping t1', 'Bảo vệ khoảng cách tổ máy t1 (21G)', Act.TRIP_NOLOAD);
  readonly r21t2 = new Relay('21G-t2', 'generator impedance protection tripping t2', 'Bảo vệ khoảng cách tổ máy t2 (21G)', Act.TRIP_NOLOAD);
  readonly r59 = new Relay('59', 'generator over-voltage protection tripping', 'Bảo vệ quá điện áp máy phát (59)', Act.TRIP_NOLOAD);
  readonly r27 = new Relay('27', '', 'Bảo vệ kém áp (27)', Act.TRIP_ALL);
  readonly r81h = new Relay('81O', '', 'Bảo vệ tần số cao (81O)', Act.TRIP_ALL);
  readonly r81l = new Relay('81U', '', 'Bảo vệ tần số thấp (81U)', Act.TRIP_ALL);
  readonly rT51t1 = new Relay('T51-t1', 'main transformer over-current protection tripping t1', 'Quá dòng MBA khối t1', Act.TRIP331);
  readonly rT51t2 = new Relay('T51-t2', 'main transformer over-current protection tripping t2', 'Quá dòng MBA khối t2', Act.TRIP_ALL);
  readonly rT49 = new Relay('T49', 'main transformer over-load protection tripping', 'Quá tải MBA khối', Act.ALARM);
  readonly rT26a = new Relay('T26-A', 'main transformer oil temperature rise', 'Nhiệt độ dầu MBA cao (26T – báo)', Act.ALARM);
  readonly rT26 = new Relay('T26', 'main transformer oil temperature highest tripping', 'Nhiệt độ dầu MBA rất cao – cắt (26T)', Act.TRIP_ALL);
  readonly rOx = new Relay('OXL', 'excitation system over excitation limit tripping', 'Kích từ quá giới hạn', Act.TRIP_ALL);
  readonly rIfx = new Relay('EXC-OC', 'excitation circuit over-current protection tripping', 'Quá dòng mạch kích từ', Act.TRIP_ALL);
  readonly r12w = new Relay('12-115', '115% rated speed', 'Vượt tốc cấp 1 (12 – báo tín hiệu)', Act.ALARM);
  readonly r12a = new Relay('12-145', '145% rated speed', 'Lồng tốc cấp 2 – dừng sự cố loại 1 (12)', Act.STOP1);
  readonly r12b = new Relay('12-155', '', 'Vượt tốc cấp 3 – dừng sự cố loại 2 (12)', Act.STOP2);
  readonly rLineGnd = new Relay('59N-35', 'transmission line one-point grounding alarming', 'Chạm đất một pha lưới 35 kV', Act.ALARM);
  // Bảo vệ nhiệt độ phụ trợ (đọc trực tiếp ngưỡng từ PlantConfig.relay)
  readonly r38Oa = new Relay('38O-A', '', 'Nhiệt độ dầu ổ đỡ cao (38 – báo)', Act.ALARM);
  readonly r38O = new Relay('38O', '', 'Nhiệt độ dầu ổ đỡ cao kéo dài – dừng sự cố loại 1 (38)', Act.STOP1);
  readonly r38Ba = new Relay('38B-A', '', 'Nhiệt độ bạc ổ đỡ / hướng turbine cao (38 – báo)', Act.ALARM);
  readonly r38B = new Relay('38B', '', 'Nhiệt độ bạc ổ đỡ / hướng turbine rất cao – cắt (38)', Act.STOP1);
  readonly r38Ga = new Relay('38G-A', '', 'Nhiệt độ bạc hướng trên/dưới MF cao (38 – báo)', Act.ALARM);
  readonly r38G = new Relay('38G', '', 'Nhiệt độ bạc hướng trên/dưới MF rất cao – cắt (38)', Act.STOP1);
  readonly r49Sa = new Relay('49S-A', '', 'Nhiệt độ cuộn dây / lõi stator cao (49S – báo)', Act.ALARM);
  readonly r49S = new Relay('49S', '', 'Nhiệt độ cuộn dây / lõi stator rất cao – cắt (49S)', Act.TRIP_ALL);
  readonly r26Aa = new Relay('26A-A', '', 'Nhiệt độ gió nóng bộ làm mát cao (26A – báo)', Act.ALARM);
  readonly r26A = new Relay('26A', '', 'Nhiệt độ gió nóng bộ làm mát rất cao – cắt (26A)', Act.STOP1);

  readonly all: Relay[];

  constructor(no: number) {
    this.no = no;
    this.all = [
      this.r87, this.r5027, this.r87a, this.r87T, this.r64a, this.r64, this.r46a, this.r46t1, this.r46t2,
      this.r40t1, this.r40t2, this.r32t1, this.r32t2, this.r51, this.r50, this.r21t1, this.r21t2,
      this.r59, this.r27, this.r81h, this.r81l, this.rT51t1, this.rT51t2, this.rT49, this.rT26a, this.rT26,
      this.rOx, this.rIfx, this.r12w, this.r12a, this.r12b, this.rLineGnd,
      this.r38Oa, this.r38O, this.r38Ba, this.r38B, this.r38Ga, this.r38G, this.r49Sa, this.r49S, this.r26Aa, this.r26A,
    ];
  }

  /** Trả về các rơ le vừa tác động trong bước này */
  step(m: GenMeas, s: RelaySet, dt: number): Relay[] {
    const out: Relay[] = [];
    const f = (r: Relay, cond: boolean, delay: number, stepDt: number = dt) => {
      if (r.step(cond, delay, stepDt)) out.push(r);
    };
    const online = m.cb601 && m.cb331;
    f(this.r87, m.idiffG > s.g87Pickup, 0.03);
    f(this.r87a, m.idiffG > s.g87Pickup * 0.5, 2.0);
    f(this.r87T, m.idiffT > s.t87Pickup, 0.04);
    this.r64a.act = s.g64_100Trip ? Act.TRIP_ALL : Act.ALARM;
    f(this.r64a, m.u0 > s.g64Alarm, 5.0);
    f(this.r64, m.u0 > s.g64Trip, s.g64Sec);
    f(this.r46a, m.i2 > s.g46Alarm, 5.0);
    f(this.r46t1, m.i2 > s.g46Trip, s.g46Sec1);
    f(this.r46t2, m.i2 > s.g46Trip, s.g46Sec2);
    const lof = m.cb601 && m.q < s.g40Q && m.v < s.g40V && m.omega > 0.9;
    f(this.r40t1, lof, s.g40Sec1);
    f(this.r40t2, lof, s.g40Sec2);
    const rev = online && m.p < s.g32Pickup;
    f(this.r32t1, rev, s.g32Sec1);
    f(this.r32t2, rev, s.g32Sec2);
    // đóng điện nhầm: máy chưa đạt tốc độ / chưa kích từ mà stator có dòng lớn
    f(this.r5027, m.cb601 && m.omega < 0.9 && !m.excited && m.i > 0.5, 0.1);
    f(this.r51, m.i > s.g51Pickup, s.g51Sec);
    f(this.r50, m.i > s.g50Pickup, s.g50Sec);
    const z = m.i > 0.05 ? m.v / m.i : 99.0;
    f(this.r21t1, m.cb601 && m.i > 1.0 && z < s.g21Z, s.g21Sec1);
    f(this.r21t2, m.cb601 && m.i > 1.0 && z < s.g21Z, s.g21Sec2);
    f(this.r59, m.v > s.g59Pickup, s.g59Sec);
    f(this.r27, online && m.v < s.g27Pickup && m.omega > 0.9, s.g27Sec);
    const block81O = s.g81oBlockLoadReject && (m.loadRejecting || (m.islanded && m.p < 0.05));
    f(this.r81h, online && !block81O && m.fHz > s.g81HiHz, s.g81Sec);
    f(this.r81l, online && m.fHz >= 40.0 && m.fHz <= s.g81LoHz, s.g81Sec);
    f(this.rT51t1, m.iTr > s.t51Pickup, s.t51Sec1);
    f(this.rT51t2, m.iTr > s.t51Pickup, s.t51Sec2);
    f(this.rT49, m.iTr > s.t49Pickup, s.t49Sec);
    f(this.rT26a, m.trOil > s.oilTempAlarm, 2.0);
    f(this.rT26, m.trOil > s.oilTempTrip, 2.0);
    f(this.rOx, m.efdMaxTime > 10.0, 0.0);
    f(this.rIfx, m.ifA > 1.3 * Math.max(m.ifRated, 50.0), 10.0);
    f(this.r12w, m.omega > s.overspeed1, 0.1);
    f(this.r12a, m.omega > s.overspeed2, 0.1);
    f(this.r12b, m.omega > s.overspeed3, 0.1);
    f(this.rLineGnd, m.u0hv > s.lineGroundAlarm, 2.0);
    // Nhiệt độ dầu ổ đỡ (QT Điều 12): thời gian trễ tính theo tốc độ mô phỏng nhiệt (thermalSpeed)
    f(this.r38Oa, m.thrustOil > s.thrustOilAlarm, 1.0);
    f(this.r38O, m.thrustOil > s.thrustOilTrip && m.omega > 0.1, s.thrustOilSec, dt * m.thermalSpeed);
    // Nhiệt độ bạc ổ đỡ / bạc hướng tuabin, bạc hướng trên/dưới MF, stator, gió nóng
    f(this.r38Ba, m.bearingPad > s.bearingAlarm, 2.0);
    f(this.r38B, m.bearingPad > s.bearingTrip && m.omega > 0.05, 2.0);
    f(this.r38Ga, m.guidePad > s.guideAlarm, 2.0);
    f(this.r38G, m.guidePad > s.guideTrip && m.omega > 0.05, 2.0);
    f(this.r49Sa, m.statorTemp > s.statorAlarm, 2.0);
    f(this.r49S, m.statorTemp > s.statorTrip && (m.omega > 0.05 || m.cb601), 2.0);
    f(this.r26Aa, m.hotAir > s.airAlarm, 2.0);
    f(this.r26A, m.hotAir > s.airTrip && m.omega > 0.05, 2.0);
    // báo hiệu (không chốt) tự giải trừ khi hết điều kiện
    for (const r of [
      this.r87a, this.r64a, this.r46a, this.r12w, this.rT49, this.rT26a, this.rLineGnd,
      this.r38Oa, this.r38Ba, this.r38Ga, this.r49Sa, this.r26Aa,
    ]) {
      if (r.act === Act.ALARM && !r.picked && r.t === 0.0) r.operated = false;
    }
    return out;
  }

  reset(): void {
    for (const r of this.all) r.reset();
  }

  active(key: string): boolean {
    return this.all.some((it) => it.operated && it.key.length > 0 && key.includes(it.key));
  }
}

/** Bảo vệ đường dây đặt tại ngăn lộ nhà máy (tba = false) hoặc đầu TBA 110/35 kV (tba = true, không có tín hiệu SD200) */
export class LineProtection {
  readonly name: string;
  readonly l: number;
  readonly tba: boolean;
  readonly r51: Relay;
  readonly r50: Relay;
  readonly rGnd: Relay;
  /** Dự phòng hướng ngược (chỉ đầu nhà máy): sự cố phía thanh cái được lưới cấp qua đường dây vào */
  readonly r51R: Relay;
  readonly r50R: Relay;
  readonly all: Relay[];

  constructor(name: string, l: number, tba = false) {
    this.name = name;
    this.l = l;
    this.tba = tba;
    const pre = tba ? 'TBA ' : '';
    const r51Key = tba ? '' : l === 1 ? 'line l1 line protection tripping' : 'line l2 protection tripping';
    const rGndKey = tba ? '' : l === 1 ? 'line l1 35 kv grounding fault alarming' : 'line l2 35kv grounding fault alarming';
    this.r51 = new Relay(`${pre}51-${name}`, r51Key, `${tba ? 'TBA: ' : ''}Quá dòng đường dây ${name}`, Act.TRIP_LINE);
    this.r50 = new Relay(`${pre}50-${name}`, '', `${tba ? 'TBA: ' : ''}Cắt nhanh đường dây ${name}`, Act.TRIP_LINE);
    this.rGnd = new Relay(`${pre}59N-${name}`, rGndKey, `Chạm đất 35 kV đường dây ${name}`, Act.ALARM);
    this.r51R = new Relay(`51R-${name}`, this.r51.key, `Quá dòng hướng ngược (dự phòng) ${name}`, Act.TRIP_LINE);
    this.r50R = new Relay(`50R-${name}`, this.r51.key, `Cắt nhanh hướng ngược (dự phòng) ${name}`, Act.TRIP_LINE);
    this.all = tba ? [this.r51, this.r50, this.rGnd] : [this.r51, this.r50, this.r51R, this.r50R, this.rGnd];
  }

  /** fwd: dòng sự cố hướng từ thanh cái nhà máy ra đường dây (bảo vệ có hướng – không cắt khi lưới cấp dòng vào sự cố trong nhà máy) */
  step(iA: number, u0: number, closed: boolean, s: RelaySet, dt: number, fwd = true): Relay[] {
    const out: Relay[] = [];
    if (this.r51.step(closed && fwd && iA > s.lineI1A, s.lineSec1, dt)) out.push(this.r51);
    if (this.r50.step(closed && fwd && iA > s.lineI2A, s.lineSec2, dt)) out.push(this.r50);
    if (!this.tba) {
      if (this.r51R.step(closed && !fwd && iA > s.lineRevI1A, s.lineRevSec1, dt)) out.push(this.r51R);
      if (this.r50R.step(closed && !fwd && iA > s.lineRevI2A, s.lineRevSec2, dt)) out.push(this.r50R);
    }
    if (this.rGnd.step(u0 > s.lineGroundAlarm, 2.0, dt)) out.push(this.rGnd);
    if (!this.rGnd.picked) this.rGnd.operated = false;
    return out;
  }

  reset(): void {
    for (const r of this.all) r.reset();
  }

  active(key: string): boolean {
    return this.all.some((it) => it.operated && it.key.length > 0 && key.includes(it.key));
  }
}
