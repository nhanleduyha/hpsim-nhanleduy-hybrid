/** Trị số chỉnh định rơ le (giả định theo nguyên tắc chỉnh định thông dụng) */
export class RelaySet {
  g87Pickup = 0.2;           // pu In
  g51Pickup = 1.2; g51Sec = 5.0;
  g50Pickup = 5.0; g50Sec = 0.1;
  g59Pickup = 1.2; g59Sec = 1.0;
  g27Pickup = 0.7; g27Sec = 3.0;
  g81HiHz = 52.0; g81LoHz = 47.5; g81Sec = 10.0;
  g81oBlockLoadReject = true; // Khoá 81O khi tổ máy đang sa thải phụ tải / chạy không tải tách lưới
  g32Pickup = -0.03; g32Sec1 = 5.0; g32Sec2 = 10.0;
  g40Q = -0.35; g40V = 0.9; g40Sec1 = 1.0; g40Sec2 = 3.0;
  g46Alarm = 0.08; g46Trip = 0.15; g46Sec1 = 2.0; g46Sec2 = 5.0;
  g21Z = 0.25; g21Sec1 = 0.5; g21Sec2 = 1.5;
  g64Alarm = 0.10; g64Trip = 0.25; g64Sec = 2.0;
  g64_100Trip = true;        // 64S-100 tác động: true = CẮT (Act.TRIP_ALL), false = BÁO (Act.ALARM)
  t87Pickup = 0.3;
  t51Pickup = 1.3; t51Sec1 = 3.0; t51Sec2 = 6.0;
  t49Pickup = 1.1; t49Sec = 60.0;
  oilTempAlarm = 60.0; oilTempTrip = 65.0;
  lineI1A = 300.0; lineSec1 = 0.4;
  lineI2A = 600.0; lineSec2 = 0.1;
  // dự phòng hướng ngược đầu nhà máy: chậm hơn cấp thuận một bậc 0,3 s (sự cố trên đường dây kia do ngăn đó cắt trước);
  // đầu TBA phối hợp chậm hơn cấp chậm nhất của đầu nhà máy thêm 0,3 s
  lineRevI1A = 300.0; lineRevSec1 = 0.7;
  lineRevI2A = 600.0; lineRevSec2 = 0.4;
  lineGroundAlarm = 0.15;
  overspeed1 = 1.15; overspeed2 = 1.45; overspeed3 = 1.55;
  bearingAlarm = 60.0; bearingTrip = 65.0;
  thrustOilAlarm = 50.0; thrustOilTrip = 55.0; thrustOilSec = 900.0;
  guideAlarm = 65.0; guideTrip = 70.0;
  statorAlarm = 110.0; statorTrip = 120.0;
  airAlarm = 60.0; airTrip = 65.0;

  constructor(init?: Partial<RelaySet>) {
    if (init) Object.assign(this, init);
  }
}

/**
 * Thông số mô hình nhà máy Đray H'Linh 2.
 * Số liệu có ghi "QT" lấy từ Quy trình vận hành – xử lý sự cố khối tổ máy; các số khác là GIẢ ĐỊNH điển hình, sửa được trong cài đặt.
 * Hệ đơn vị tương đối: Scb = 10 MVA, Ucb = 6,3 kV (phía máy phát) và 38,5 kV (phía 35 kV).
 */
export class PlantConfig {
  // ---------------- Lưới ngoài ----------------
  gridSkMVA = 200.0;          // công suất ngắn mạch tại thanh cái 35 kV TBA 110/35 kV
  gridXR = 10.0;
  gridVoltagePu = 1.0;        // điện áp nguồn hệ thống (1,0 = 38,5 kV)
  gridFreqHz = 50.0;
  lineLengthKm = 1.1;         // đường dây 371, 372: 1,1 km mạch kép, dây AC-185 (nhà máy)
  lineROhmKm = 0.17;
  lineXOhmKm = 0.38;
  tbaLoadMW = 3.0;            // phụ tải địa phương tại TBA (chạy độc lập)
  tbaLoadMVAr = 1.2;
  loadFreqCoef = 1.5;         // %P / %f của phụ tải

  // ---------------- Hồ chứa, tràn tự do ----------------
  inflowM3s = 60.0;
  reservoirAreaM2 = 2.0e5;
  // mực nước quy đổi: mốc 0 = cao trình +273,8 (hạ lưu +275,8 ứng 2,0 m khi chạy 2 tổ máy)
  crestLevelM = 20.03;        // MNDBT +293,828 = ngưỡng tràn tự do
  deadLevelM = 17.03;         // MNC +290,828
  spillWidthM = 480.0;        // chiều dài đập tràn
  spillCoef = 0.42;
  tailCoef = 2.0;             // Zhl = tailCoef·(Q/100)^0,7
  riverTempC = 25.0;

  // ---------------- Turbine Kaplan ZZJK508 (QT) ----------------
  turbineMW = 8.333;
  ratedHeadM = 18.5;
  ratedFlowM3s = 49.213;
  minHeadM = 16.5;
  maxHeadM = 20.9;
  ratedRpm = 214.3;
  runawayRpm = 540.3;
  gateFullPu = 1.2;           // lưu lượng qua cánh hướng mở 100 % (pu lưu lượng định mức) – đủ 8333 kW từ 16,5 m (QT)
  tw = 1.2;                   // hằng số quán tính nước (s)
  qNoLoad = 0.08;
  headLossCoef = 0.02;
  frictionPu = 0.012;         // tổn hao ma sát + quạt gió ở tốc độ định mức (pu 10 MVA)
  churnLossPu = 0.06;         // tổn hao khuấy nước của BXCT khi mất cột nước, ở tốc độ định mức (pu turbine)

  // ---------------- Máy phát SF8000-28/4250 (QT) ----------------
  genMVA = 10.0;
  genKV = 6.3;
  genA = 916.4;
  inertiaH = 2.52;            // từ GD² = 400 T·m², n = 214,3 v/ph
  xd = 0.9; xd1 = 0.2522; xd2 = 0.1904;
  xq = 0.6151; x2 = 0.2038; x0 = 0.0487;
  ra = 0.0037;
  td0 = 5.0;                  // T'd0 (s)
  tq0 = 0.1;
  statorROhm = 0.0148;        // ở 15 °C
  rotorROhm = 0.4476;         // ở 15 °C
  ifNoLoad = 184.2; ifRated = 335.0;
  ifFlash = 15.0; flashSec = 3.0;

  // ---------------- Điều tốc (Kaplan ZZJK508: Kp 0,5~20, Ki 0,05~10, bp 0~1,0 % (QT); Kd không có trong QT, mặc định 0) ----------------
  govKp = 1.6;
  govKi = 0.27;
  govKd = 0.0;
  islandKp = 1.2;             // PID điều tần chạy độc lập (H = 2,52 s, Tw = 1,2 s)
  islandKi = 0.16;
  govBp = 0.01;
  islandDroop = 0.01;         // giữ để tương thích JSON cũ; backend luôn đồng bộ dùng chung govBp
  gvOpenRate = 0.10;          // pu/s
  gvCloseRate = 0.125;        // đóng hết ≈ 8 s
  gvEmergencyRate = 0.25;
  gvStartOpening = 0.25;
  gvMax = 0.95;
  powerKp = 0.05;
  powerKi = 0.05;
  pRampMWs = 0.8;             // tốc độ nhận/giảm tải (MW/s)

  // ---------------- Kích từ SWL-II ----------------
  avrKp = 8.0;
  avrKi = 3.0;
  efdMax = 3.0;
  qRampMVArs = 2.0;           // tốc độ thay đổi Q đặt (MVAr/s)
  qKi = 0.25;                 // hệ số tích phân bộ điều chỉnh Q (pu điện áp đặt / pu sai lệch Q / s)

  // ---------------- MBA nâng 10 MVA 38,5/6,3 kV (QT) ----------------
  trMVA = 10.0; trUk = 0.0677; trPkKW = 40.26; trP0KW = 6.791;
  // MBA tự dùng TD61, TD32: 320 kVA (nhà máy), Uk 4 % giả định
  tdKVA = 320.0; tdUk = 0.04;
  auxBaseKW = 60.0;

  // ---------------- Thời gian, nhiệt ----------------
  tdTap = 1.03;               // nấc phân áp MBA tự dùng (pu, mặc định giữ thanh cái 0,4 kV khoảng 390–400 V khi phát)
  td61TapPct = 2.5;           // nấc phân áp TD61 (nấc 1 = +2,5 %)
  td32TapPct = 0.0;
  dieselKVA = 500.0;          // máy phát diesel tự dùng 0,4 kV
  dieselStartSec = 10.0;      // thời gian khởi động đến khi đủ áp, tần số
  thermalSpeed = 10.0;        // tăng tốc quá trình nhiệt (1 = thời gian thật)

  // ---------------- Hoà đồng bộ (dùng chung cho máy chủ & AssessEngine) ----------------
  syncMaxDfHz = 0.2;          // |Δf| tối đa cho phép khi hoà đồng bộ (Hz)
  syncMaxDvPct = 5.0;         // |ΔU| tối đa cho phép khi hoà đồng bộ (%)
  syncMaxPhaseDeg = 12.0;     // |Δφ| tối đa cho phép khi hoà đồng bộ (độ)

  // ---------------- Liên động thao tác ----------------
  /** "strict": cấm thao tác sai; "natural": cho thao tác, mô phỏng hậu quả */
  interlock = 'natural';

  relay: RelaySet = new RelaySet();

  constructor(init?: Partial<PlantConfig>) {
    if (init) {
      const { relay, ...rest } = init;
      Object.assign(this, rest);
      if (relay) this.relay = new RelaySet(relay);
    }
  }
}
