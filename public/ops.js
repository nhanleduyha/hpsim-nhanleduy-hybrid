/* HPS – Giám sát vận hành & Trợ lý AI. Tác giả: Lê Duy Nhân
 * Trang "Giám sát": thống kê bơm/máy nén, thông số, phát hiện bất thường (OpsMonitor – tính toán xác định).
 * Trang "Trợ lý AI": học viên tự nhập API key Gemini; key chỉ lưu trong trình duyệt, gửi thẳng tới Google.
 * Trợ lý đọc dữ liệu nhà máy qua các hàm (trạng thái, thống kê, xu hướng, sự kiện, quy trình vận hành).
 */
'use strict';
(function () {
  const LS_KEY = 'hpsAiKey', LS_MODEL = 'hpsAiModel', LS_HINT = 'hpsAiHint';
  const lsGet = (k, d = '') => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const DEF_MODEL = 'gemini-3.5-flash-lite';
  // mô hình cũ Google đã ngừng cho người dùng mới -> tự chuyển sang mặc định mới
  const getModel = () => { const m = lsGet(LS_MODEL, ''); return !m || m === 'gemini-2.5-flash' ? DEF_MODEL : m; };
  /** Lấy danh sách mô hình Gemini mà key này dùng được (để chọn, khỏi gõ sai tên) */
  async function listModels(key) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || ('Lỗi HTTP ' + r.status));
    return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name))
      .map(m => m.name.replace(/^models\//, '')).sort().reverse();
  }
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const f1 = (v, d = 1) => (v == null || !isFinite(v) ? '-' : (+v).toFixed(d));
  const api = p => window.localApi.request(p);
  const snap = () => (window.__hpsSim && window.__hpsSim.snapshot) || {};

  // ====================================================== trang Giám sát
  function monitor(root) {
    const ce = (tag, attrs, parent, html) => window.h(tag, attrs, parent, html);
    const top = ce('div', { class: 'card pad' }, root);
    const r = ce('div', { class: 'row' }, top);
    ce('h3', { style: 'margin:0 12px 0 0' }, r, 'Giám sát – thống kê công tác vận hành');
    const info = ce('span', { style: 'color:#666' }, r, '');
    ce('button', { class: 'btn', style: 'margin-left:auto', onclick: () => askAi('Có thiết bị hay thông số nào đang bất thường không? Phân tích nguyên nhân có thể và việc người vận hành cần làm theo quy trình.') }, r, '🤖 Hỏi trợ lý AI về các bất thường');
    const an = ce('div', { style: 'margin-top:8px' }, top);
    const c2 = ce('div', { class: 'card pad', style: 'margin-top:10px' }, root);
    ce('h3', { style: 'margin:0 0 6px' }, c2, 'Bơm, máy nén – số lần chạy, thời gian chạy (so với mức nền tự học)');
    const tdev = ce('div', { style: 'overflow:auto' }, c2);
    const c3 = ce('div', { class: 'card pad', style: 'margin-top:10px' }, root);
    ce('h3', { style: 'margin:0 0 6px' }, c3, 'Thông số – 30 phút gần nhất');
    const ttag = ce('div', { style: 'overflow:auto' }, c3);
    ce('p', { style: 'color:#666;font-size:12px' }, root,
      'Mức nền được tự học từ các lần chạy trước đó (cần ≥ 6 lần chạy). Cảnh báo khi: chạy liên tục quá lâu, khoảng nghỉ giữa 2 lần chạy < 50 % mức nền, ' +
      'mỗi lần chạy > 2 lần mức nền, nhiệt độ tăng liên tục trong 30 phút, công suất/tần số/cánh hướng dao động. Thống kê bắt đầu lại khi tải lại trang.');
    let last = 0;
    window.U(async () => {
      if (Date.now() - last < 2000) return; last = Date.now();
      const s = await api('ops/stats');
      info.textContent = `– theo dõi từ ${s.since} (${s.sampledMin} phút dữ liệu)`;
      an.innerHTML = s.anomalies.length
        ? s.anomalies.map(a => `<div style="padding:6px 8px;margin:3px 0;border-left:4px solid ${a.level === 1 ? '#c92a2a' : '#e8590c'};background:${a.level === 1 ? '#fff5f5' : '#fff9db'}">⚠ <b>${esc(a.sinceText)}</b> ${esc(a.text)}</div>`).join('')
        : '<div style="padding:6px 8px;border-left:4px solid #2b8a3e;background:#ebfbee">✓ Không phát hiện bất thường</div>';
      if (s.history.length > s.anomalies.length) an.innerHTML += `<details style="margin-top:4px"><summary>Lịch sử bất thường (${s.history.length})</summary>${s.history.slice().reverse().map(a => `<div style="font-size:12px">${esc(a.sinceText)} – ${esc(a.text)}</div>`).join('')}</details>`;
      const base = (v, b) => b > 0 ? `${f1(v, 0)} <span style="color:#888">(${f1(b, 0)})</span>` : f1(v, 0);
      let hh = '<table class="t"><tr><th>Thiết bị</th><th>Trạng thái</th><th>Khởi động/giờ</th><th>Hệ số làm việc %</th><th>TB mỗi lần chạy, s (nền)</th><th>TB nghỉ, s (nền)</th><th>Tổng chạy, phút</th></tr>';
      let grp = '';
      for (const d of s.devices) {
        if (d.group !== grp) { grp = d.group; hh += `<tr><td colspan="7" style="background:#f1f3f5;font-weight:600">${esc(grp)}</td></tr>`; }
        const bad = s.anomalies.some(a => a.key === d.key);
        hh += `<tr style="${bad ? 'background:#fff9db' : ''}"><td>${esc(d.name.replace(/^H\d – /, ''))}</td><td>${d.on ? `<b style="color:#2b8a3e">CHẠY</b> ${Math.floor(d.curS / 60)}:${String(d.curS % 60).padStart(2, '0')}` : '<span style="color:#888">dừng</span>'}</td><td>${d.startsLastHour}</td><td>${d.dutyPctLastHour}</td><td>${base(d.avgRunS, d.baseRunS)}</td><td>${base(d.avgGapS, d.baseGapS)}</td><td>${d.totalRunMin}</td></tr>`;
      }
      tdev.innerHTML = hh + '</table>';
      hh = '<table class="t"><tr><th>Thông số</th><th>Hiện tại</th><th>Nhỏ nhất</th><th>Lớn nhất</th><th>Trung bình</th><th>Xu hướng /phút</th></tr>';
      for (const t of s.tags) {
        if (t.now == null) continue;
        const bad = s.anomalies.some(a => a.key === t.key);
        const sl = t.slopePerMin || 0;
        hh += `<tr style="${bad ? 'background:#fff9db' : ''}"><td>${esc(t.name)}${t.unit ? ' (' + esc(t.unit) + ')' : ''}</td><td>${f1(t.now, 2)}</td><td>${f1(t.min, 2)}</td><td>${f1(t.max, 2)}</td><td>${f1(t.avg, 2)}</td><td>${Math.abs(sl) < 0.005 ? '–' : (sl > 0 ? '▲ ' : '▼ ') + f1(Math.abs(sl), 3)}</td></tr>`;
      }
      ttag.innerHTML = hh + '</table>';
    });
  }

  // ====================================================== quy trình vận hành (tìm kiếm)
  let QT = null;
  const LS_QT = 'hpsQt';
  async function loadQt() {
    if (QT) return QT;
    try { const j = JSON.parse(lsGet(LS_QT) || 'null'); if (Array.isArray(j) && j.length) return (QT = j); } catch (e) { }
    try { const r = await fetch('./qt.json'); QT = r.ok ? await r.json() : []; } catch (e) { QT = []; }
    if (!Array.isArray(QT)) QT = [];
    return QT;
  }
  /** Nạp file quy trình (qt.json do giáo viên phát) vào trình duyệt – không đưa lên mạng */
  function importQt(file, done) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        if (!Array.isArray(j) || !j.length || !j.every(c => c && typeof c.t === 'string' && typeof c.x === 'string')) throw new Error('sai định dạng');
        lsSet(LS_QT, JSON.stringify(j)); QT = j; done(true, j.length);
      } catch (e) { done(false, 0); }
    };
    rd.readAsText(file, 'utf-8');
  }
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  async function searchQt(query) {
    const qt = await loadQt();
    if (!qt.length) return { error: 'Chưa nạp Quy trình vận hành vào trang (thiếu file qt.json). Trả lời theo kiến thức chung và nói rõ điều đó.' };
    const words = norm(query).split(/[^a-z0-9]+/).filter(w => w.length > 1);
    const dieu = (query.match(/điều\s*(\d+)/i) || [])[1];
    const scored = qt.map((c, i) => {
      const t = norm(c.t + ' ' + c.x);
      let sc = 0; for (const w of words) { const m = t.split(w).length - 1; sc += Math.min(m, 5) * (w.length > 3 ? 2 : 1); }
      if (dieu && new RegExp('^dieu ' + dieu + '\\b').test(norm(c.t))) sc += 100;
      const tt = norm(c.t); if (tt.includes(norm(query).trim())) sc += 50; for (const w of words) if (tt.includes(w)) sc += 3;
      return { i, sc };
    }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 3);
    return { results: scored.map(x => ({ title: qt[x.i].t, text: qt[x.i].x.slice(0, 2600) })) };
  }

  // ====================================================== các hàm cho trợ lý
  function plantState() {
    const S = snap();
    const sw = ['CB371', 'CB372', 'CB331', 'CB332', 'CB601', 'CB602', 'IS371_1', 'IS371_7', 'IS372_2', 'IS372_7', 'IS312_1', 'IS331_1', 'IS332_2', 'IS612_1', 'IS612_2', 'AXT1', 'AXT2'];
    const gs = ['GS371_15', 'GS371_75', 'GS371_76', 'GS372_25', 'GS372_75', 'GS372_76', 'GS331_14', 'GS331_15', 'GS332_24', 'GS332_25', 'GS1QE', 'GS1QE1', 'GS2QE', 'GS2QE1'];
    const o = { thoi_gian: new Date().toLocaleString('vi-VN'), may_cat_dao: {}, dao_noi_dat_dang_dong: [], luoi: {}, to_may: {} };
    for (const k of sw) o.may_cat_dao[k] = S[k] ? 'ĐÓNG' : 'CẮT';
    o.dao_noi_dat_dang_dong = gs.filter(k => !!S[k]);
    o.luoi = { U_C31_kV: S.VbusZone1, U_C32_kV: S.VbusZone2, f_Hz: S.FreqZone1, P371_MW: S.P371, P372_MW: S.P372, U_tu_dung_04kV: S.V400, luoi_he_thong: S.gridOk ? 'có' : 'MẤT', cua_nhan_nuoc: S.IntakeGate ? 'MỞ' : 'ĐÓNG', muc_nuoc_thuong_luu_m: S.zUp, lien_dong: S.interlock };
    for (const n of [1, 2]) {
      const g = k => S[`G${n}.${k}`];
      const conds = g('startConds');
      o.to_may['H' + n] = {
        trinh_tu: g('seqState'), buoc: g('seq'), che_do_dieu_toc: g('gov'), P_MW: g('Pload'), Q_MVAr: g('Qload'), U_kV: g('Vgen'), f_Hz: g('freq'),
        toc_do_v_ph: g('speed'), do_mo_canh_huong_pct: g('GV'), canh_BXCT_pct: g('blade'), cot_nuoc_m: g('head'), ap_luc_dau_MPa: g('oilMPa'),
        chot_khoa_canh_huong: g('servoLock') ? 'ĐANG KHOÁ' : 'đã mở', bao_ve_da_cat: g('tripped') ? (g('tripReason') || 'có') : 'không',
        nhiet_do_C: { o_huong_tren: g('upper'), o_huong_duoi: g('lower'), o_do: g('thrust'), o_huong_turbine: g('turbPad'), stator: g('stator'), dau_MBA: g('trOil') },
        dieu_kien_khoi_dong_chua_dat: Array.isArray(conds) ? conds.filter(c => c && c.ok === false).map(c => c.t) : conds,
      };
    }
    o.su_co_hien_tai = S.incident || '';
    return o;
  }
  function events(args) {
    const min = Math.min(480, Math.max(1, +args.minutes || 30));
    const from = Date.now() - min * 60000;
    const q = norm(args.contains || '');
    const kinds = (args.kinds || '').toUpperCase().split(/[ ,]+/).filter(Boolean);
    let recs = window.localApi.soe.since(0, 5000).filter(r => r.ts >= from && (!q || norm(r.text).includes(q)) && (!kinds.length || kinds.includes(r.kind)));
    const total = recs.length;
    if (recs.length > 120) recs = recs.slice(-120);
    return { tong_so: total, hien_thi: recs.length, su_kien: recs.map(r => `${new Date(r.ts).toLocaleTimeString('vi-VN')} ${r.kind} ${window.localApi.soe.unitName(r.unit)} ${r.text}`) };
  }
  const TAG_KEYS = ['G1.Pload', 'G1.freq', 'G1.GV', 'G1.oilMPa', 'G1.cwMPa', 'G1.headCover', 'G1.upper', 'G1.lower', 'G1.thrust', 'G1.turbPad', 'G1.stator', 'G1.trOil', 'G1.shaftVib',
    'G2.Pload', 'G2.freq', 'G2.GV', 'G2.oilMPa', 'G2.cwMPa', 'G2.headCover', 'G2.upper', 'G2.lower', 'G2.thrust', 'G2.turbPad', 'G2.stator', 'G2.trOil', 'G2.shaftVib',
    'sump', 'drain', 'oilLeak', 'lpAir', 'hpAir', 'zUp', 'FreqZone1', 'VbusZone1'];
  const TOOLS = [
    { name: 'get_plant_state', description: 'Trạng thái hiện tại của nhà máy: máy cắt, dao, dao nối đất, lưới, từng tổ máy (trình tự, công suất, điều tốc, chốt khoá, nhiệt độ, bảo vệ đã cắt, điều kiện khởi động chưa đạt), sự cố hiện tại.', parameters: { type: 'object', properties: {} } },
    { name: 'get_anomalies', description: 'Các bất thường đang có và lịch sử bất thường do bộ giám sát tự phát hiện (bơm chạy lâu, khởi động dày, nhiệt độ tăng, dao động).', parameters: { type: 'object', properties: {} } },
    { name: 'get_equipment_stats', description: 'Thống kê bơm/máy nén: số lần khởi động trong giờ, hệ số làm việc, thời gian mỗi lần chạy, khoảng nghỉ, so với mức nền; 5 lần chạy gần nhất.', parameters: { type: 'object', properties: { name_contains: { type: 'string', description: 'Lọc theo tên, ví dụ "dầu điều tốc", "H1", "máy nén". Bỏ trống = tất cả.' } } } },
    { name: 'get_trend', description: 'Xu hướng một thông số: chuỗi giá trị (tối đa 120 điểm), min/max/trung bình, độ dốc mỗi phút, phân tích dao động.', parameters: { type: 'object', properties: { tag: { type: 'string', enum: TAG_KEYS, description: 'Mã thông số. G1=H1, G2=H2. Pload=P (MW), GV=độ mở cánh hướng %, oilMPa=áp lực dầu điều tốc, headCover=mức nước nắp turbine, upper/lower/thrust/turbPad=nhiệt độ ổ, sump=hố nước rò, drain=hố tiêu nước, oilLeak=thùng dầu rò, lpAir/hpAir=áp lực khí.' }, minutes: { type: 'number', description: 'Số phút gần nhất (1–120)' } }, required: ['tag'] } },
    { name: 'get_events', description: 'Sổ sự kiện SOE trong N phút gần nhất (tối đa 120 dòng mới nhất). Loại: ALM cảnh báo, TRIP cắt máy, ERR lỗi/liên động, WARN, SEQ trình tự, CMD lệnh, POS vị trí thiết bị, RTN hết báo.', parameters: { type: 'object', properties: { minutes: { type: 'number' }, contains: { type: 'string', description: 'Lọc theo nội dung (không phân biệt dấu)' }, kinds: { type: 'string', description: 'Danh sách loại, ví dụ "ALM,TRIP,ERR"' } } } },
    { name: 'search_procedure', description: 'Tra cứu Quy trình vận hành và xử lý sự cố khối tổ máy NMTĐ Đray H\'Linh 2 (theo từ khoá hoặc "Điều N"). Trả về tối đa 3 đoạn.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  ];
  async function callTool(name, args) {
    switch (name) {
      case 'get_plant_state': return plantState();
      case 'get_anomalies': { const s = await api('ops/stats'); return { dang_co: s.anomalies.map(a => `${a.sinceText} ${a.text}`), lich_su: s.history.map(a => `${a.sinceText} ${a.text}`) }; }
      case 'get_equipment_stats': { const s = await api('ops/stats'); const q = norm(args.name_contains || ''); return { thiet_bi: s.devices.filter(d => !q || norm(d.name + ' ' + d.group).includes(q)) }; }
      case 'get_trend': return await api(`ops/series?key=${encodeURIComponent(args.tag)}&min=${Math.min(120, Math.max(1, +args.minutes || 30))}`);
      case 'get_events': return events(args || {});
      case 'search_procedure': return await searchQt(args.query || '');
    }
    return { error: 'Không có hàm ' + name };
  }

  const SYS = hint => `Bạn là trợ lý vận hành cho học viên tập vận hành NMTĐ Đray H'Linh 2 (2 × 8 MW, turbine Kaplan) trên phần mềm mô phỏng HPS.
Nguyên tắc:
- Luôn gọi hàm để lấy dữ liệu thật trước khi nói về tình trạng nhà máy, thống kê hay sự kiện. Không bịa số liệu.
- Về thao tác và xử lý sự cố: tra search_procedure và trả lời theo Quy trình của nhà máy, nêu số Điều. Nếu quy trình không đề cập thì nói rõ là kiến thức chung.
- Khi phân tích bất thường: nêu hiện tượng (kèm số liệu), các nguyên nhân có thể theo thứ tự khả năng, cách kiểm tra/xác nhận, việc cần làm theo quy trình.
- Trả lời tiếng Việt, ngắn gọn, rõ ràng; dùng gạch đầu dòng khi liệt kê.
- Viết số và đơn vị dạng chữ thường (ví dụ: 40,4 °C; 1,00 MW; 214,3 v/ph). TUYỆT ĐỐI không dùng LaTeX, ký hiệu $, \\text, công thức toán hay dấu nháy ngược bao quanh tên biến; gọi thiết bị bằng tên tiếng Việt thay vì mã biến.
- Báo cáo cuối ca: gồm tình trạng vận hành, sản lượng/công suất, thao tác chính, sự cố/bất thường, thống kê thiết bị phụ, kiến nghị.
- Đây là mô phỏng phục vụ đào tạo; nhắc học viên đối chiếu quy trình gốc khi cần.
${hint ? '- CHẾ ĐỘ GỢI Ý (học viên đang làm bài): KHÔNG đưa đáp án hay trình tự thao tác chi tiết; chỉ đặt câu hỏi gợi mở, chỉ ra chỗ cần kiểm tra và điều quy trình liên quan để học viên tự tìm.' : ''}`;

  let history = [];
  async function gemini(contents, hint) {
    const key = lsGet(LS_KEY), model = getModel();
    if (!key) throw new Error('Chưa nhập API key Gemini.');
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS(hint) }] }, contents, tools: [{ functionDeclarations: TOOLS }], generationConfig: { temperature: 0.3 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || ('Lỗi HTTP ' + r.status));
    const c = j.candidates && j.candidates[0];
    if (!c || !c.content) throw new Error('Không có trả lời (' + ((c && c.finishReason) || 'rỗng') + ')');
    return c.content;
  }

  let ui = null;
  function addMsg(role, html) {
    if (!ui) return;
    const d = document.createElement('div');
    d.style.cssText = `margin:6px 0;padding:8px 10px;border-radius:8px;white-space:pre-wrap;line-height:1.45;${role === 'user' ? 'background:#e7f5ff;margin-left:15%' : role === 'tool' ? 'color:#888;font-size:12px;padding:2px 10px' : 'background:#f8f9fa;margin-right:5%'}`;
    d.innerHTML = html; ui.log.appendChild(d); ui.log.scrollTop = ui.log.scrollHeight; return d;
  }
  // gỡ LaTeX/markdown mà mô hình hay chèn vào: $P = 1\text{ MW}$, ^\circ, \approx, `mã`
  const unTex = s => String(s)
    .replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\^\{?\\circ\}?/g, '°').replace(/\\circ/g, '°').replace(/\\approx/g, '≈').replace(/\\times/g, '×')
    .replace(/\\le(q)?/g, '≤').replace(/\\ge(q)?/g, '≥').replace(/\\pm/g, '±').replace(/\\Delta/g, 'Δ').replace(/\\%/g, '%')
    .replace(/\\cdot/g, '·').replace(/\\,|\\;|\\ /g, ' ')
    .replace(/\$\$?([^$\n]+?)\$\$?/g, '$1').replace(/`([^`\n]+)`/g, '$1');
  const md = s => esc(unTex(s)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#+\s*(.+)$/gm, '<b>$1</b>').replace(/^\s*[\*-]\s+/gm, '• ');
  let busy = false;
  async function send(text) {
    if (busy || !text.trim()) return;
    busy = true; if (ui) ui.btn.disabled = true;
    addMsg('user', esc(text));
    history.push({ role: 'user', parts: [{ text }] });
    const wait = addMsg('tool', '… đang hỏi trợ lý');
    const hint = lsGet(LS_HINT) === '1';
    try {
      for (let round = 0; round < 6; round++) {
        const content = await gemini(history, hint);
        history.push(content);
        const calls = (content.parts || []).filter(p => p.functionCall);
        if (!calls.length) {
          const txt = (content.parts || []).filter(p => p.text).map(p => p.text).join('\n').trim();
          addMsg('model', md(txt || '(không có nội dung)'));
          break;
        }
        const resp = [];
        for (const p of calls) {
          addMsg('tool', `↳ đọc dữ liệu: ${esc(p.functionCall.name)} ${esc(JSON.stringify(p.functionCall.args || {}))}`);
          let out; try { out = await callTool(p.functionCall.name, p.functionCall.args || {}); } catch (e) { out = { error: String(e.message || e) }; }
          resp.push({ functionResponse: { name: p.functionCall.name, response: { result: out } } });
        }
        history.push({ role: 'user', parts: resp });
      }
    } catch (e) {
      addMsg('model', '<span style="color:#c92a2a">Lỗi: ' + esc(e.message || e) + '</span>');
      history.pop();
    }
    if (wait) wait.remove();
    if (history.length > 40) history = history.slice(-40);
    busy = false; if (ui) ui.btn.disabled = false;
  }

  function ai(root) {
    const ce = (tag, attrs, parent, html) => window.h(tag, attrs, parent, html);
    const c = ce('div', { class: 'card pad', style: 'max-width:1100px' }, root);
    ce('h3', { style: 'margin:0 0 6px' }, c, 'Trợ lý AI vận hành');
    const set = ce('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, c);
    ce('span', {}, set, 'API key Gemini:');
    const key = ce('input', { type: 'password', placeholder: 'dán API key của bạn', style: 'width:300px' }, set); key.value = lsGet(LS_KEY);
    ce('span', {}, set, 'Mô hình:');
    const model = ce('input', { type: 'text', style: 'width:200px', list: 'hpsAiModels' }, set); model.value = getModel();
    const dl = ce('datalist', { id: 'hpsAiModels' }, set);
    const fillModels = async () => {
      const k = key.value.trim(); if (!k) return;
      try { const ms = await listModels(k); dl.innerHTML = ms.map(m => `<option value="${esc(m)}">`).join('');
        if (ms.length && !ms.includes(model.value.trim())) { model.value = ms.find(m => /flash-lite/.test(m)) || ms.find(m => /flash/.test(m)) || ms[0]; lsSet(LS_MODEL, model.value); window.toast && window.toast('Đã chọn mô hình ' + model.value); } }
      catch (e) { window.toast && window.toast('Không lấy được danh sách mô hình: ' + e.message, true); }
    };
    fillModels();
    ce('button', { class: 'btn primary', onclick: () => { lsSet(LS_KEY, key.value.trim()); lsSet(LS_MODEL, model.value.trim() || DEF_MODEL); window.toast && window.toast('Đã lưu cài đặt trợ lý'); fillModels(); } }, set, 'Lưu');
    ce('a', { href: 'https://aistudio.google.com/app/apikey', target: '_blank', rel: 'noopener', style: 'margin-left:6px' }, set, 'Lấy API key miễn phí');
    const lbl = ce('label', { style: 'margin-left:auto' }, set);
    const hint = ce('input', { type: 'checkbox' }, lbl); hint.checked = lsGet(LS_HINT) === '1';
    hint.onchange = () => lsSet(LS_HINT, hint.checked ? '1' : '0');
    lbl.appendChild(document.createTextNode(' Chế độ gợi ý (đang làm bài)'));
    const qr = ce('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, c);
    ce('span', {}, qr, 'Quy trình vận hành:');
    const qst = ce('b', {}, qr, '…');
    const fin = ce('input', { type: 'file', accept: '.json,application/json', style: 'display:none' }, qr);
    ce('button', { class: 'btn', onclick: () => fin.click() }, qr, '📂 Nạp quy trình (qt.json)');
    const qdel = ce('button', { class: 'btn', onclick: () => { try { localStorage.removeItem(LS_QT); } catch (e) { } QT = null; showQt(); } }, qr, 'Gỡ');
    async function showQt() {
      const n = (await loadQt()).length;
      qst.textContent = n ? `đã nạp (${n} đoạn)` : 'chưa nạp – trợ lý trả lời theo kiến thức chung';
      qst.style.color = n ? '#2b8a3e' : '#c92a2a'; qdel.style.display = n ? '' : 'none';
    }
    fin.onchange = () => { const f = fin.files[0]; if (!f) return; importQt(f, (ok, n) => { window.toast && window.toast(ok ? `Đã nạp quy trình: ${n} đoạn` : 'File quy trình không đúng định dạng', !ok); showQt(); }); fin.value = ''; };
    showQt();
    ce('div', { style: 'color:#888;font-size:12px;margin:4px 0 8px' }, c, 'File quy trình chỉ lưu trong trình duyệt này, không đưa lên mạng. API key chỉ lưu trong trình duyệt này và gửi thẳng tới Google. Trợ lý có thể sai – luôn đối chiếu Quy trình vận hành. Trợ lý chỉ đọc dữ liệu, không thao tác thay bạn.');
    const q = ce('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, c);
    for (const [t, p] of [
      ['Tình trạng nhà máy?', 'Tóm tắt tình trạng nhà máy hiện tại và các điểm cần chú ý.'],
      ['Có gì bất thường?', 'Có thiết bị hay thông số nào đang bất thường không? Phân tích nguyên nhân có thể và việc cần làm theo quy trình.'],
      ['Vì sao không khởi động được?', 'Tổ máy không khởi động được. Kiểm tra trạng thái, điều kiện khởi động và sự kiện gần đây để tìm nguyên nhân.'],
      ['Thống kê thiết bị phụ', 'Thống kê hoạt động các bơm, máy nén trong giờ qua, so với mức nền, chỉ ra thiết bị nào khác thường.'],
      ['Báo cáo cuối ca', 'Viết báo cáo cuối ca dựa trên trạng thái hiện tại, sự kiện 8 giờ qua (hoặc từ đầu buổi) và thống kê thiết bị.'],
    ]) ce('button', { class: 'btn', onclick: () => send(p) }, q, t);
    ce('button', { class: 'btn', style: 'margin-left:auto', onclick: () => { history = []; ui.log.innerHTML = ''; } }, q, 'Xoá hội thoại');
    const log = ce('div', { style: 'height:calc(100vh - 330px);min-height:260px;overflow:auto;border:1px solid #dee2e6;border-radius:6px;padding:6px;margin-top:8px;background:#fff' }, c);
    const row = ce('div', { class: 'row', style: 'margin-top:6px;gap:6px' }, c);
    const inp = ce('textarea', { rows: '2', placeholder: 'Hỏi trợ lý… (Enter để gửi, Shift+Enter xuống dòng)', style: 'flex:1;resize:vertical' }, row);
    const btn = ce('button', { class: 'btn primary', onclick: () => { const t = inp.value; inp.value = ''; send(t); } }, row, 'Gửi');
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); btn.click(); } };
    ui = { log, btn };
    for (const m of history) {
      const t = (m.parts || []).filter(p => p.text).map(p => p.text).join('\n');
      if (t) addMsg(m.role === 'user' ? 'user' : 'model', m.role === 'user' ? esc(t) : md(t));
    }
    if (pending) { const p = pending; pending = null; send(p); }
  }

  let pending = null;
  function askAi(text) {
    if (typeof window.showPage === 'function') {
      if (ui) { window.showPage('ai'); send(text); } else { pending = text; window.showPage('ai'); }
    }
  }

  window.HpsOps = { monitor, ai, askAi, searchQt, plantState };
})();
