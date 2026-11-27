/* HPS Droid Server – HMI web. Tác giả: Lê Duy Nhân */
'use strict';
const S = {};               // trạng thái mô phỏng (snapshot)
let evSeq = -1, lastEvSeqDone = -1, pollBusy = false, assessRestored = false, videoBase = '', online = false;
const CLIENT_ID = 'w' + Math.random().toString(36).slice(2, 10);
const NS = 'http://www.w3.org/2000/svg';
const pages = [];           // {id, title, el, upd:[], frame:[]}
let cur = null;
let lastCfgRev = 0;
const cfgListeners = [];
function notifyCfgChanged(rev) {
  if (rev && rev > lastCfgRev) lastCfgRev = rev;
  cfgListeners.forEach(fn => { try { fn(); } catch (e) { } });
}

// ------------------------------------------------------------------ tiện ích
const n = k => +(S[k] || 0);
const on = k => n(k) !== 0;
const fx = (v, d = 1) => (isFinite(v) ? (+v).toFixed(d) : '-');
const $ = id => document.getElementById(id);
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function h(tag, attrs, parent, html) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e[k] = attrs[k]; else e.setAttribute(k, attrs[k]); }
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
function txt(p, x, y, s, cls = 'lbl', anchor = 'start') { return el('text', { x, y, class: cls, 'text-anchor': anchor }, p, s); }
async function api(path, body) {
  if (!window.localApi) throw new Error('localApi chưa khởi tạo');
  const j = await window.localApi.request(path, body);
  if (j && j.ok === false && j.error) toast(j.error, true);
  return j;
}
window.api = api;
function syncLimits() {
  const df = n('cfg.syncMaxDfHz') > 0 ? n('cfg.syncMaxDfHz') : 0.2;
  const dv = n('cfg.syncMaxDvPct') > 0 ? n('cfg.syncMaxDvPct') : 5.0;
  const ph = n('cfg.syncMaxPhaseDeg') > 0 ? n('cfg.syncMaxPhaseDeg') : 12.0;
  return { df, dv, ph };
}
function set(name, value) {
  if (!online) {
    if (window.AssessEngine && window.AssessEngine.onCommand) {
      try { window.AssessEngine.onCommand(name, value, 'Web'); } catch (e) { }
    }
    if (window.HpsSim3D && typeof window.HpsSim3D.sendDemoCmd === 'function') {
      window.HpsSim3D.sendDemoCmd(name, value);
      return Promise.resolve({ ok: true });
    }
  }
  const payload = value === undefined ? { name, cid: CLIENT_ID } : { name, value, cid: CLIENT_ID };
  const p = api('set', payload);
  if (window.AssessEngine && window.AssessEngine.getState && window.AssessEngine.getState().active) {
    p.then(() => setTimeout(poll, 120)).catch(() => { });
  }
  return p;
}
function toast(msg, err) {
  const t = h('div', { class: 'toast' + (err ? ' err' : '') }, $('toasts'), msg);
  setTimeout(() => t.remove(), 4500);
}
function ask(msg, fn) {
  $('dlgText').textContent = msg; $('dlg').classList.remove('hidden');
  $('dlgOk').onclick = () => { $('dlg').classList.add('hidden'); fn(); };
  $('dlgNo').onclick = () => $('dlg').classList.add('hidden');
}
let curPage = null;
function addPage(id, title, build) { pages.push({ id, title, build, upd: [], frame: [], built: false }); }
const U = fn => curPage.upd.push(fn);           // cập nhật theo dữ liệu
const F = fn => curPage.frame.push(fn);         // cập nhật theo khung hình (hoạt hình)
function svgRoot(parent, w, hgt, fit) {
  const wrap = h('div', { class: 'card svgwrap' + (fit ? ' fit' : '') }, parent);
  return el('svg', { viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'xMidYMid meet' }, wrap);
}

// ------------------------------------------------------------------ màu
const C = { live: '#d9480f', live6: '#9c36b5', live04: '#2b8a3e', dead: '#9aa5b1', on: '#FF0000', off: '#00FF00' };

// ------------------------------------------------------------------ ký hiệu
function wire(p, pts, liveFn, color = C.live, w = 5) {
  const pl = el('polyline', { points: pts.map(q => q.join(',')).join(' '), fill: 'none', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, p);
  U(() => pl.setAttribute('stroke', liveFn() ? color : C.dead));
  return pl;
}
/** Máy cắt: đỏ = đóng, xanh = cắt */
function breaker(p, x, y, key, label, side = 1, horiz = false) {
  const g = el('g', { class: 'clk' }, p);
  const r = horiz ? el('rect', { x: x - 24, y: y - 14, width: 48, height: 28, rx: 3, stroke: '#333', 'stroke-width': 1.5 }, g)
    : el('rect', { x: x - 14, y: y - 24, width: 28, height: 48, rx: 3, stroke: '#333', 'stroke-width': 1.5 }, g);
  txt(p, x + side * (horiz ? 0 : 24), horiz ? y - 22 : y + 5, label, 'lblb', horiz ? 'middle' : side > 0 ? 'start' : 'end');
  U(() => r.setAttribute('fill', on(key) ? C.on : C.off));
  g.onclick = () => ask(`${on(key) ? 'Cắt' : 'Đóng'} máy cắt ${label}?`, () => set(key));
  return g;
}
/** Dao cách ly: thanh dọc theo đường dây = đóng, vuông góc = mở */
function disc(p, x, y, key, label, side = 1, horiz = false, ground = false) {
  const g = el('g', { class: 'clk' }, p);
  el('circle', { cx: x, cy: y, r: 16, fill: '#fff', stroke: '#222', 'stroke-width': 2 }, g);
  const bar = el('rect', { x: x - 3.5, y: y - 13, width: 7, height: 26, rx: 2, fill: '#111' }, g);
  if (label) txt(p, x + side * 22, y + (horiz ? -20 : 5), label, 'lbl', horiz ? 'middle' : side > 0 ? 'start' : 'end');
  U(() => {
    const closed = on(key);
    const ang = (closed ? 0 : 90) + (horiz ? 90 : 0);
    bar.setAttribute('transform', `rotate(${ang} ${x} ${y})`);
    bar.setAttribute('fill', ground && closed ? '#e8590c' : '#111');
  });
  g.onclick = () => ask(`${on(key) ? 'Mở' : 'Đóng'} ${ground ? 'dao nối đất' : 'dao cách ly'} ${label}?`, () => set(key));
  return g;
}
/** Dao nối đất rẽ nhánh từ (x,y) theo hướng dir */
function gsw(p, x, y, key, label, dir, liveFn) {
  const x2 = x + dir * 58;
  wire(p, [[x, y], [x2 - dir * 16, y]], liveFn, C.live, 3);
  disc(p, x2, y, key, label, dir, true, true);
  wire(p, [[x2 + dir * 16, y], [x2 + dir * 32, y]], () => false, C.live, 3);
  const gx = x2 + dir * 32;
  el('line', { x1: gx, y1: y - 12, x2: gx, y2: y + 12, stroke: '#333', 'stroke-width': 2.5 }, p);
  el('line', { x1: gx + dir * 5, y1: y - 8, x2: gx + dir * 5, y2: y + 8, stroke: '#333', 'stroke-width': 2 }, p);
  el('line', { x1: gx + dir * 10, y1: y - 4, x2: gx + dir * 10, y2: y + 4, stroke: '#333', 'stroke-width': 2 }, p);
}
function trafo(p, x, y, topFn, botFn, c1 = C.live, c2 = C.live6) {
  const a = el('circle', { cx: x, cy: y - 14, r: 24, fill: 'none', 'stroke-width': 3 }, p);
  const b = el('circle', { cx: x, cy: y + 14, r: 24, fill: 'none', 'stroke-width': 3 }, p);
  U(() => { a.setAttribute('stroke', topFn() ? c1 : C.dead); b.setAttribute('stroke', botFn() ? c2 : C.dead); });
}
function genSym(p, x, y, runFn, label) {
  const c = el('circle', { cx: x, cy: y, r: 30, fill: '#fff', 'stroke-width': 3.5 }, p);
  el('path', { d: `M${x - 17} ${y} q8.5 -14 17 0 t17 0`, fill: 'none', 'stroke-width': 3.5, stroke: '#1c7ed6' }, p);
  if (label) txt(p, x, y + 50, label, 'lblb', 'middle');
  U(() => c.setAttribute('stroke', runFn() ? '#e03131' : '#1c7ed6'));
}
function arrowOut(p, x, y, label) {
  el('path', { d: `M${x - 9} ${y + 12} L${x} ${y - 4} L${x + 9} ${y + 12}`, fill: 'none', stroke: C.live, 'stroke-width': 3 }, p);
  txt(p, x, y - 12, label, 'lblb', 'middle');
}
/** Bảng số liệu kiểu DAQ (đầu vàng) */
function table(p, x, y, cols, w = 70) {
  cols.forEach((c, i) => {
    el('rect', { x: x + i * w, y, width: w, height: 22, class: 'hcell' }, p);
    txt(p, x + i * w + w / 2, y + 16, c[0], 'lblb', 'middle');
    el('rect', { x: x + i * w, y: y + 22, width: w, height: 24, class: 'cell' }, p);
    const t = txt(p, x + i * w + w / 2, y + 39, '-', 'val', 'middle');
    U(() => { t.textContent = c[1](); });
  });
}
function button(p, x, y, w, hgt, label, fn, activeFn) {
  const g = el('g', { class: 'clk' }, p);
  const r = el('rect', { x, y, width: w, height: hgt, class: 'btnr' }, g);
  el('text', { x: x + w / 2, y: y + hgt / 2 + 1, class: 'btnt' }, g, label);
  g.onclick = fn;
  if (activeFn) U(() => r.setAttribute('class', 'btnr' + (activeFn() ? ' on' : '')));
  return g;
}
function gauge(p, cx, cy, r, max, label, valFn, unit = '', warn = 0.8, opts) {
  const o = opts || {};
  const dec = o.dec !== undefined ? o.dec : 1;
  const tickDec = o.tickDec !== undefined ? o.tickDec : (max < 10 ? 1 : 0);
  const subH = o.subText ? 14 : 0;
  const box = el('rect', { x: cx - r - 16, y: cy - r - 16, width: 2 * r + 32, height: 2 * r + 48 + subH, rx: 8, fill: '#e9ecef', stroke: '#adb5bd', 'stroke-width': 1.5 }, p);
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const pt = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const arc = (from, to, rr, col, w) => {
    if (to <= from) return;
    const [x1, y1] = pt(from, rr), [x2, y2] = pt(to, rr);
    el('path', { d: `M${x1} ${y1} A${rr} ${rr} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2} ${y2}`, fill: 'none', stroke: col, 'stroke-width': w }, p);
  };
  if (o.zones && o.zones.length) {
    o.zones.forEach(([f0, f1, col]) => arc(a0 + (a1 - a0) * Math.max(0, f0), a0 + (a1 - a0) * Math.min(1, f1), r - 4, col, 6));
  } else {
    arc(a0, a0 + (a1 - a0) * warn, r - 4, '#2f9e44', 6);
    arc(a0 + (a1 - a0) * warn, a1, r - 4, '#e03131', 6);
  }
  const ticks = o.ticks || 10;
  for (let i = 0; i <= ticks; i++) {
    const a = a0 + (a1 - a0) * i / ticks, [x1, y1] = pt(a, r - 10), [x2, y2] = pt(a, r - 17);
    el('line', { x1, y1, x2, y2, stroke: '#333', 'stroke-width': i % 2 ? 1 : 2 }, p);
    if (i % 2 === 0) {
      const [tx, ty] = pt(a, r - 27);
      const val = max * i / ticks;
      txt(p, tx, ty + 3.5, tickDec > 0 ? val.toFixed(tickDec) : String(Math.round(val)), 'lbl', 'middle').setAttribute('font-size', r < 48 ? '8.5' : '10');
    }
  }
  const nd = el('line', { x1: cx, y1: cy, x2: cx, y2: cy - r + 15, stroke: '#111', 'stroke-width': r < 48 ? 2.5 : 3, 'stroke-linecap': 'round' }, p);
  el('circle', { cx, cy, r: r < 48 ? 4 : 5, fill: '#111' }, p);
  const lb = txt(p, cx, cy + r + 3, label, 'lbl', 'middle');
  if (r < 48) lb.setAttribute('font-size', '11');
  const vt = txt(p, cx, cy + r + 21, '-', 'lblb', 'middle');
  if (r < 48) vt.setAttribute('font-size', '12');
  let st = null;
  if (o.subText) {
    st = txt(p, cx, cy + r + 35, o.subText, 'lbl', 'middle');
    st.setAttribute('font-size', '10');
    st.setAttribute('fill', '#495057');
  }
  U(() => {
    const v = valFn(), f = Math.max(0, Math.min(1, v / max));
    const deg = (a0 + (a1 - a0) * f) * 180 / Math.PI + 90;
    nd.setAttribute('transform', `rotate(${deg} ${cx} ${cy})`);
    vt.textContent = fx(v, dec) + (unit ? ' ' + unit : '');
    const alm = o.alarmFn ? o.alarmFn(v) : false;
    vt.setAttribute('fill', alm ? '#e03131' : '');
    box.setAttribute('stroke', alm ? '#e03131' : '#adb5bd');
    box.setAttribute('stroke-width', alm ? 2.5 : 1.5);
  });
}
function isUnitStartingOrSyncing(gn) {
  const g = 'G' + gn;
  const st = String(S[g + '.seqState'] || '');
  if (st && st !== 'IDLE' && st !== 'RUNNING' && !st.startsWith('STOP') && !st.startsWith('EMERG')) return true;
  return n(g + '.mode') === 1 && !on(g + '.grid');
}
function auxCmdKey(key) {
  const m = /^G([12])\.(.+)$/.exec(key);
  return m ? `GEN${m[1]}.${m[2].toUpperCase()}` : key;
}
function checkAuxAutoLock(key, label) {
  const m = /^G([12])\.(waterPump1|waterPump2|cwValve|oilPump1|oilPump2|hc1|hc2|airComp1|airComp2)$/.exec(key);
  if (!m) return false;
  const gn = m[1], autoKey = `G${gn}.auxAuto`;
  const isAuto = S[autoKey] === undefined ? true : n(autoKey) !== 0;
  if (isAuto) {
    toast(`Phụ trợ MF${gn} đang ở chế độ TỰ ĐỘNG (AUTO). Hãy chuyển công tắc sang BẰNG TAY (MANUAL) ở đầu trang trước khi thao tác "${label}"!`, true);
    return true;
  }
  return false;
}
function pump(p, x, y, key, label, size = 26) {
  const g = el('g', { class: 'clk' }, p);
  const c = el('circle', { cx: x, cy: y, r: size, stroke: '#333', 'stroke-width': 2 }, g);
  const imp = el('g', {}, g);
  for (let i = 0; i < 3; i++) el('path', { d: `M${x} ${y} Q${x + size * 0.5} ${y - size * 0.3} ${x + size * 0.75} ${y}`, fill: 'none', stroke: '#fff', 'stroke-width': 3, transform: `rotate(${i * 120} ${x} ${y})` }, imp);
  txt(p, x, y + size + 18, label, 'lbl', 'middle');
  let a = 0;
  U(() => c.setAttribute('fill', on(key) ? '#e03131' : '#868e96'));
  F(dt => { if (on(key)) { a = (a + dt * 360) % 360; imp.setAttribute('transform', `rotate(${a} ${x} ${y})`); } });
  g.onclick = () => {
    if (checkAuxAutoLock(key, label)) return;
    ask(`${on(key) ? 'Dừng' : 'Chạy'} ${label}?`, () => set(auxCmdKey(key)));
  };
}
function valve(p, x, y, key, label, vertical = false, left = false) {
  const g = el('g', { class: 'clk' }, p);
  const d = vertical ? `M${x - 14} ${y - 14} L${x + 14} ${y - 14} L${x - 14} ${y + 14} L${x + 14} ${y + 14} Z` : `M${x - 14} ${y - 14} L${x + 14} ${y + 14} L${x + 14} ${y - 14} L${x - 14} ${y + 14} Z`;
  const v = el('path', { d, stroke: '#333', 'stroke-width': 2 }, g);
  txt(p, x + (left ? -22 : 22), y + 5, label, 'lbl', left ? 'end' : 'start');
  U(() => v.setAttribute('fill', on(key) ? '#40c057' : '#fff'));
  g.onclick = () => {
    if (checkAuxAutoLock(key, label)) return;
    ask(`${on(key) ? 'Đóng' : 'Mở'} ${label}?`, () => set(auxCmdKey(key)));
  };
}
function tank(p, x, y, w, hgt, label, levelFn, color) {
  el('rect', { x, y, width: w, height: hgt, rx: 14, fill: '#dee2e6', stroke: '#868e96', 'stroke-width': 2 }, p);
  const lv = el('rect', { x: x + 6, y: y + 6, width: w - 12, height: 0, rx: 8, fill: color, opacity: 0.8 }, p);
  txt(p, x + w / 2, y + hgt / 2, label, 'lblb', 'middle');
  const t = txt(p, x + w / 2, y + hgt / 2 + 20, '', 'val', 'middle');
  U(() => { const f = Math.max(0, Math.min(1, levelFn() / 100)); const hh = (hgt - 12) * f; lv.setAttribute('y', y + hgt - 6 - hh); lv.setAttribute('height', hh); t.textContent = fx(levelFn(), 0) + ' %'; });
}
function pipe(p, pts, flowFn, color = '#4dabf7', w = 10) {
  el('polyline', { points: pts.map(q => q.join(',')).join(' '), fill: 'none', stroke: '#adb5bd', 'stroke-width': w + 4, 'stroke-linejoin': 'round' }, p);
  const f = el('polyline', { points: pts.map(q => q.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-dasharray': '14 10' }, p);
  let off = 0;
  F(dt => { if (flowFn()) { off = (off - dt * 40) % 24; f.setAttribute('stroke-dashoffset', off); f.setAttribute('opacity', 1); } else f.setAttribute('opacity', 0.25); });
}

// ------------------------------------------------------------------ mô tả sự cố
/** Cắt chuỗi cho vừa khung SVG (đủ nội dung đặt ở tooltip) */
const clip = (t, k) => !t ? '' : t.length > k ? t.slice(0, k - 1) + '…' : t;

// ================================================================== TRANG 1: SƠ ĐỒ NỐI ĐIỆN
addPage('main', 'Sơ đồ nối điện', root => {
  // Local / Remote của 3 LCU (header SD200: điểm 222 LCU1/LCU2, điểm 127 Auto/manual PUB)
  const lr = h('div', { class: 'row', style: 'gap:8px;margin-bottom:6px' }, root);
  for (const [k, name, cmd] of [['G1.remote', 'LCU1', 'GEN1.REMOTE'], ['G2.remote', 'LCU2', 'GEN2.REMOTE'], ['pubRemote', 'PUB', 'PUBREMOTE']]) {
    const bt = h('button', { class: 'btn', onclick: () => ask(`Chuyển ${name} sang ${on(k) ? 'REMOTE (SD200 điều khiển)' : 'LOCAL (chặn lệnh SD200/IEC 104)'}?`, () => set(cmd)) }, lr, '');
    U(() => { bt.textContent = name + ': ' + (on(k) ? 'LOCAL' : 'REMOTE'); bt.className = 'btn' + (on(k) ? ' on' : ''); });
  }
  // chế độ liên động đang dùng – bấm để đổi
  const il = h('button', { class: 'btn', style: 'margin-left:auto', onclick: () => ask('Đổi chế độ liên động thao tác?', () => set('INTERLOCK')) }, lr, '');
  U(() => { const st = S.interlock === 'strict'; il.textContent = 'Liên động: ' + (st ? 'CẤM thao tác sai' : 'TỰ NHIÊN (mô phỏng hậu quả)'); il.className = 'btn' + (st ? ' on' : ''); });
  const p = svgRoot(root, 1600, 1010, true);
  txt(p, 800, 34, 'SƠ ĐỒ NỐI ĐIỆN CHÍNH – NMTĐ ĐRÂY H\'LINH 2 (2 × 8 MW)', 'ttl', 'middle');
  const z1 = () => n('VbusZone1') > 1, z2 = () => n('VbusZone2') > 1;
  const L = 430, R = 1170;
  for (const [X, ln, dir, zone, g, other] of [[L, '371', 1, z1, 'G1', '331'], [R, '372', -1, z2, 'G2', '332']]) {
    const v = () => n('V' + ln) > 1;
    const isTop = 'IS' + ln + '_7', isBot = 'IS' + ln + (ln === '371' ? '_1' : '_2');
    const segMid = () => (on(isTop) && v() && on('CB' + ln)) || (on(isBot) && zone());
    arrowOut(p, X, 62, 'Đường dây ' + ln);
    wire(p, [[X, 66], [X, 124]], v);
    gsw(p, X, 100, 'GS' + ln + '_76', ln + '-76', dir, v);
    disc(p, X, 140, isTop, ln + '-7', -dir);
    wire(p, [[X, 156], [X, 231]], () => on(isTop) && v());
    gsw(p, X, 196, 'GS' + ln + '_75', ln + '-75', dir, () => on(isTop) && v());
    breaker(p, X, 255, 'CB' + ln, ln, -dir);
    wire(p, [[X, 279], [X, 359]], segMid);
    gsw(p, X, 320, 'GS' + ln + (ln === '371' ? '_15' : '_25'), ln + (ln === '371' ? '-15' : '-25'), dir, segMid);
    disc(p, X, 375, isBot, ln + (ln === '371' ? '-1' : '-2'), -dir);
    wire(p, [[X, 391], [X, 430]], zone);
    // ngăn máy biến áp
    const isT = 'IS' + other + (other === '331' ? '_1' : '_2');
    const gA = other === '331' ? ['GS331_14', '331-14'] : ['GS332_24', '332-24'];
    const gB = other === '331' ? ['GS331_15', '331-15'] : ['GS332_25', '332-25'];
    const t1 = () => n(g + '.V60') > 0.5;
    wire(p, [[X, 430], [X, 474]], zone);
    disc(p, X, 490, isT, other + (other === '331' ? '-1' : '-2'), -dir);
    const s2 = () => (on(isT) && zone()) || (on('CB' + other) && t1());
    wire(p, [[X, 506], [X, 576]], s2);
    gsw(p, X, 540, gA[0], gA[1], dir, s2);
    breaker(p, X, 600, 'CB' + other, other, -dir);
    wire(p, [[X, 624], [X, 676]], t1);
    gsw(p, X, 655, gB[0], gB[1], dir, t1);
    trafo(p, X, 714, t1, t1);
    txt(p, X - dir * 40, 718, g === 'G1' ? 'T1 (10 MVA)' : 'T2 (10 MVA)', 'lblb', dir > 0 ? 'end' : 'start');
    wire(p, [[X, 752], [X, 800]], t1, C.live6);
    wire(p, [[X - dir * 100, 800], [X + dir * 130, 800]], t1, C.live6, 6);
    wire(p, [[X, 800], [X, 826]], t1, C.live6);
    breaker(p, X, 850, 'CB' + (g === 'G1' ? '601' : '602'), g === 'G1' ? '601' : '602', -dir);
    const gl = () => n(g + '.Vgen') > 0.5;
    wire(p, [[X, 874], [X, 920]], gl, C.live6);
    gsw(p, X, 900, g === 'G1' ? 'GS1QE' : 'GS2QE', g === 'G1' ? '1QE' : '2QE', dir, gl);
    genSym(p, X, 952, () => on(g + '.running'), '');
    txt(p, X + dir * 48, 958, g === 'G1' ? 'MF1 (8 MW)' : 'MF2 (8 MW)', 'lblb', dir > 0 ? 'start' : 'end');
    // bảng số liệu
    const tx = dir > 0 ? 30 : 1245;
    txt(p, tx, 150, 'Xuất tuyến ' + ln, 'lblb');
    table(p, tx, 158, [['P(MW)', () => fx(n('P' + ln), 2)], ['Q(MVAr)', () => fx(n('Q' + ln), 2)], ['U(kV)', () => fx(n('V' + ln), 1)], ['I(A)', () => fx(n('I' + ln), 0)], ['kWh', () => fx(n('A' + ln), 0)]], 66);
    txt(p, tx, 830, g === 'G1' ? 'Tổ máy 1' : 'Tổ máy 2', 'lblb');
    table(p, tx, 838, [['P(MW)', () => fx(n(g + '.Pload'), 2)], ['Q(MVAr)', () => fx(n(g + '.Qload'), 2)], ['U(kV)', () => fx(n(g + '.Vgen'), 2)], ['I(A)', () => fx(n(g + '.Ia'), 0)], ['F(Hz)', () => fx(n(g + '.freq'), 2)]], 66);
    txt(p, tx, 508, 'Thanh cái 35 kV – ' + (dir > 0 ? 'TC 31' : 'TC 32'), 'lblb');
    const bv = txt(p, tx, 530, '', 'val');
    U(() => { bv.textContent = `U = ${fx(n(dir > 0 ? 'VbusZone1' : 'VbusZone2'), 1)} kV   f = ${fx(n(dir > 0 ? 'FreqZone1' : 'FreqZone2'), 2)} Hz`; });
  }
  // thanh cái TC 31 / TC 32 + DCL liên lạc 321-1 (giữ key IS312_1)
  wire(p, [[250, 430], [784, 430]], z1, C.live, 8);
  txt(p, 290, 416, 'TC 31 (35 kV)', 'lblb', 'start');
  wire(p, [[816, 430], [1350, 430]], z2, C.live, 8);
  txt(p, 1310, 416, 'TC 32 (35 kV)', 'lblb', 'end');
  disc(p, 800, 430, 'IS312_1', 'DCL 321-1', 1, true);
  // tự dùng 6,3 kV qua 612-1 / 612-2 -> TD 61
  const aux = () => n('Vaux6') > 0.5;
  const td61LvMain = () => S.V400Zone1 !== undefined ? n('V400Zone1') > 0.05 : aux();
  wire(p, [[L + 130, 800], [L + 130, 836]], () => n('G1.V60') > 0.5, C.live6);
  disc(p, L + 130, 852, 'IS612_1', '612-1', 1);
  wire(p, [[L + 130, 868], [L + 130, 900], [R - 130, 900], [R - 130, 868]], aux, C.live6);
  disc(p, R - 130, 852, 'IS612_2', '612-2', -1);
  wire(p, [[R - 130, 836], [R - 130, 800]], () => n('G2.V60') > 0.5, C.live6);
  wire(p, [[800, 900], [800, 908]], aux, C.live6);
  trafo(p, 800, 946, aux, td61LvMain, C.live6, C.live04);
  txt(p, 840, 950, 'TD 61 → tự dùng 0,4 kV', 'lblb');
  const v6 = txt(p, 800, 890, '', 'val', 'middle');
  U(() => { v6.textContent = fx(n('Vaux6'), 2) + ' kV'; });

  // khung mô tả sự cố thật: nguyên nhân gốc (dòng 1), hậu quả mới nhất (dòng 2), ngắn mạch / rơ le đang tác động (dòng dưới nút)
  const fb = el('rect', { x: 560, y: 70, width: 480, height: 92, rx: 10, 'stroke-width': 2 }, p);
  const ftip = el('title', {}, fb, '');
  const ft = txt(p, 800, 102, '', 'lblb', 'middle'); ft.setAttribute('font-size', '15');
  const fd = txt(p, 800, 130, '', 'lbl', 'middle'); fd.setAttribute('font-size', '13');
  U(() => {
    const lv = n('incidentLevel'), sc = (S.scFaults || []).length;
    const bad = lv >= 2 || sc > 0, warn = !bad && lv === 1;
    fb.setAttribute('fill', bad ? '#ffe3e3' : warn ? '#fff4e6' : '#e6fcf5');
    fb.setAttribute('stroke', bad ? '#e03131' : warn ? '#f08c00' : '#12b886');
    const head = lv >= 2 ? 'SỰ CỐ: ' + S.incident : lv === 1 ? 'LIÊN ĐỘNG: ' + S.incident : sc ? 'NGẮN MẠCH: ' + S.scFaults.join(', ') : 'VẬN HÀNH BÌNH THƯỜNG';
    ft.textContent = clip(head, 62);
    ft.setAttribute('fill', bad ? '#c92a2a' : warn ? '#d9480f' : '#087f5b');
    fd.textContent = clip(S.incidentLast ? '→ ' + S.incidentLast : '', 78);
    ftip.textContent = [head, S.incidentLast].filter(x => x).join('\n');
  });
  button(p, 690, 175, 220, 34, 'XOÁ CẢNH BÁO', () => set('ClearAlarm', 0));
  const cs = txt(p, 800, 236, '', 'lbl', 'middle');
  U(() => {
    const rl = [...(S['G1.relays'] || []).map(x => 'MF1 ' + x), ...(S['G2.relays'] || []).map(x => 'MF2 ' + x), ...(S.lineRelays || [])];
    const sc = S.scFaults || [];
    cs.textContent = clip([sc.length ? 'Ngắn mạch: ' + sc.join(', ') : '', rl.length ? 'Rơ le: ' + rl.join(', ') : ''].filter(x => x).join(' · '), 90);
  });
  // chú thích
  const lg = [[C.on, 'Máy cắt đóng'], [C.off, 'Máy cắt cắt'], [C.live, '35 kV có điện'], [C.live6, '6,3 kV có điện'], [C.dead, 'Mất điện']];
  lg.forEach((l, i) => { el('rect', { x: 600 + (i % 3) * 140, y: 262 + Math.floor(i / 3) * 24, width: 16, height: 12, fill: l[0] }, p); txt(p, 622 + (i % 3) * 140, 273 + Math.floor(i / 3) * 24, l[1], 'lbl'); });
});

// ================================================================== TRANG: TURBINE – MÁY PHÁT (TÍCH HỢP MẶT CẮT CHI TIẾT)
let _cutawaySvgPromise = null;
function loadCutawaySvgText() {
  if (!_cutawaySvgPromise) _cutawaySvgPromise = fetch('cutaway.svg').then(r => r.text());
  return _cutawaySvgPromise;
}

function turbinePage(gn) {
  return root => {
    const g = 'G' + gn;
    const otherGn = gn === 1 ? 2 : 1;
    const suf = '-g' + gn;

    // Tiêu đề trang tổ máy
    const hdr = h('div', { class: 'card turb-hdr' }, root);
    h('h2', {}, hdr, `TUABIN KAPLAN ZZJK508-LJ-280 – MÁY PHÁT SF8000-28/4250 (TỔ MÁY ${gn})`);
    const hdrSub = h('span', { style: 'font-size:13px;font-weight:700;font-variant-numeric:tabular-nums' }, hdr, '');

    // Bố cục 2 cột phía trên: Trái = Mặt cắt chi tiết có chú thích + Nhiệt độ/Vận hành; Phải = Mặt bằng 24 cánh hướng + Nút chế độ + Bảng điện
    const topGrid = h('div', { class: 'turb-top' }, root);

    // ==================== KHUNG TRÁI: MẶT CẮT CHI TIẾT TỔ MÁY ====================
    const cutCard = h('div', { class: 'turb-cut-card' }, topGrid);
    const cutBar = h('div', { class: 'turb-cut-bar' }, cutCard);
    const cutTitleWrap = h('div', { class: 'turb-cut-title' }, cutBar);
    h('span', {}, cutTitleWrap, `MẶT CẮT CHI TIẾT TỔ MÁY ${gn}`);
    const cutSeqBadge = h('span', { class: 'turb-cut-seq' }, cutTitleWrap, 'Sẵn sàng');
    let lang = 'VI', cutPhase = 0, hoverItem = null;
    const langBtn = h('button', {
      class: 'turb-cut-lang',
      onclick: () => { lang = lang === 'VI' ? 'EN' : 'VI'; applyLang(); }
    }, cutBar, 'Chú thích: Tiếng Việt');

    const cutStage = h('div', { class: 'turb-cut-stage' }, cutCard);
    const insp = h('div', { class: 'turb-cut-insp' }, cutStage);
    const hotBanner = h('div', { class: 'turb-hot-banner' }, cutStage);
    const cutHost = h('div', { class: 'cut-host' }, cutStage, 'Đang tải bản vẽ mặt cắt chi tiết…');

    // Khung hiển thị trực tiếp Nhiệt độ & Thông số Cơ – Thủy lực – Phanh ngay trong khung mặt cắt
    const telem = h('div', { class: 'turb-cut-telem' }, cutCard);
    h('div', { class: 'turb-sec-lbl' }, telem,
      '<span>GIÁM SÁT NHIỆT ĐỘ TỔ MÁY (ĐIỀU 12)</span><span style="color:#94a3b8;font-weight:600;text-transform:none">Cam: Báo động · Đỏ: Quá nhiệt sự cố</span>');
    const tempGrid = h('div', { class: 'turb-temp-grid' }, telem);
    const mkCell = (par, lbl) => {
      const box = h('div', { class: 'turb-tcell' }, par);
      h('span', {}, box, lbl);
      const val = h('b', {}, box, '--');
      return { box, val };
    };
    const tcStator = mkCell(tempGrid, 'Stator (>105 / >120°C)');
    const tcRotor = mkCell(tempGrid, 'Rotor (>130°C)');
    const tcThrust = mkCell(tempGrid, 'Ổ đỡ (>50 / >55°C)');
    const tcGuideU = mkCell(tempGrid, 'Ổ hướng trên');
    const tcGuideL = mkCell(tempGrid, 'Ổ hướng dưới');
    const tcTurbG = mkCell(tempGrid, 'Ổ hướng tuabin');
    const tcAirHot = mkCell(tempGrid, 'Không khí nóng');
    const tcCwTemp = mkCell(tempGrid, 'Nước làm mát');

    h('div', { class: 'turb-sec-lbl', style: 'margin-top:2px' }, telem, '<span>THÔNG SỐ CƠ – THỦY LỰC & PHANH KHÍ NÉN</span>');
    const mechGrid = h('div', { class: 'turb-mech-grid' }, telem);
    const mcSpeed = mkCell(mechGrid, 'Tốc độ (nđm 214,3)');
    const mcGV = mkCell(mechGrid, '24 Cánh hướng');
    const mcBlade = mkCell(mechGrid, 'Góc cánh BXCT');
    const mcFlow = mkCell(mechGrid, 'Lưu lượng nước');
    const mcHead = mkCell(mechGrid, 'Cột nước');
    const mcBrake = mkCell(mechGrid, 'Phanh khí nén');

    // Tham chiếu phần tử động trong cutaway.svg (đã đặt hậu tố -g1/-g2 để không đụng ID giữa 2 tổ máy)
    let cSvg = null, cGates = [], cLinks = [], cPoles = [], cBladesB = [], cBladesF = [], cParts = [];
    let cHcw = null, cSpec = null, cTtl = null, cBrake = null;
    const NS_SVG = 'http://www.w3.org/2000/svg';
    const mkSvg = (tag, at, par) => { const e = document.createElementNS(NS_SVG, tag); for (const kk in at) e.setAttribute(kk, at[kk]); par.appendChild(e); return e; };
    const byId = id => cSvg ? cSvg.getElementById(id + suf) : null;
    const gv = x => n(g + '.' + x);
    const isBraking = () => S[g + '.airBrake'] !== undefined && !on(g + '.airBrake');

    // Hàm đọc nhiệt độ tương thích cả key mở rộng (guideU, guideL, turbGuide, airHot, rotor) lẫn key backend Kotlin (upper, lower, turbPad, hotAir)
    function readTemps() {
      const stator = gv('stator');
      const hotAir = S[g + '.airHot'] !== undefined ? gv('airHot') : gv('hotAir');
      const coldAir = gv('coldAir') || 28;
      const rotor = S[g + '.rotor'] !== undefined
        ? gv('rotor')
        : ((on(g + '.running') || gv('Iexc') > 10)
          ? Math.max(hotAir + 6, stator * 0.96 + gv('lossRotor') * 0.22)
          : Math.max(coldAir, stator));
      const thrust = gv('thrust');
      const thrustOil = S[g + '.thrustOil'] !== undefined ? gv('thrustOil') : thrust;
      const guideU = S[g + '.guideU'] !== undefined ? gv('guideU') : gv('upper');
      const guideL = S[g + '.guideL'] !== undefined ? gv('guideL') : gv('lower');
      const turbGuide = S[g + '.turbGuide'] !== undefined ? gv('turbGuide') : gv('turbPad');
      const cwTemp = gv('cwTemp');
      return { stator, rotor, thrust, thrustOil, guideU, guideL, turbGuide, airHot: hotAir, cwTemp };
    }

    const LIVE_PART = {
      'part-stator': () => { const t = readTemps(); return `Cuộn dây Stator: <b>${fx(t.stator, 1)} °C</b> (Max ${fx(gv('statorMax') || t.stator, 1)} °C) · Lõi thép ${fx(gv('core'), 1)} °C<br>U = ${fx(gv('Vgen'), 2)} kV · I = ${fx(gv('Ia'), 0)} A`; },
      'part-rotor': () => { const t = readTemps(); return `Nhiệt độ Rotor: <b>${fx(t.rotor, 1)} °C</b> · Tốc độ ${fx(gv('speed'), 1)} / 214,3 v/ph<br>Ikt = ${fx(gv('Iexc'), 0)} A · Ukt = ${fx(gv('Vexc'), 0)} V · MK ${on(g + '.fieldDischarge') ? 'đóng' : 'cắt'}`; },
      'part-upper-bracket': () => { const t = readTemps(); return `Bạc ổ đỡ: <b>${fx(t.thrust, 1)} °C</b> · Dầu ổ đỡ ${fx(gv('thrustOil'), 1)} °C<br>Ổ hướng trên: <b>${fx(t.guideU, 1)} °C</b>`; },
      'part-lower-bracket': () => { const t = readTemps(); return `Bạc ổ hướng dưới: <b>${fx(t.guideL, 1)} °C</b>`; },
      'part-brake': () => isBraking() ? '<b style="color:#f87171">⚠ ĐANG PHANH (Khí nén 0,75 MPa &lt; 30% nđm)</b>' : '<b style="color:#4ade80">Đã giải trừ phanh</b>',
      'part-air-housing': () => { const t = readTemps(); return `Khí nóng: <b>${fx(t.airHot, 1)} °C</b> · Khí lạnh ${fx(gv('coldAir'), 1)} °C · Nước LM ${fx(t.cwTemp, 1)} °C`; },
      'part-head-cover': () => { const t = readTemps(); return `Mực nước nắp TB: <b>${fx(gv('headCover'), 0)} mm</b> · Bơm 1 ${on(g + '.hc1') ? 'chạy' : 'dừng'} / Bơm 2 ${on(g + '.hc2') ? 'chạy' : 'dừng'}<br>Ổ hướng tuabin: <b>${fx(t.turbGuide, 1)} °C</b>`; },
      'part-operating-ring': () => `24 cánh hướng mở <b>${fx(gv('GV'), 1)} %</b> · 02 Servo · Khoá: ${on(g + '.servoLock') ? 'ĐANG KHOÁ' : 'đã mở'}<br>Áp lực dầu HYZ: ${fx(gv('oilMPa'), 2)} MPa`,
      'part-wicket-gates': () => `24 cánh hướng dòng: <b>${fx(gv('GV'), 1)} %</b> · Lưu lượng ${fx(gv('flow'), 2)} m³/s`,
      'part-runner-hub': () => `Góc cánh BXCT Kaplan (5 cánh): <b>${fx(gv('blade'), 1)} %</b> · ${fx(gv('speed'), 1)} v/ph<br>Pcơ = ${fx(gv('Pm'), 2)} MW`,
      'part-stay-ring': () => `Cột nước: <b>${fx(gv('head'), 1)} m</b> · Lưu lượng ${fx(gv('flow'), 2)} m³/s`,
      'part-discharge-ring': () => `Lưu lượng xả: <b>${fx(gv('flow'), 2)} m³/s</b> · MN hạ lưu ${fx(n('zTail'), 2)} m`
    };

    function applyLang() {
      langBtn.textContent = 'Chú thích: ' + (lang === 'VI' ? 'Tiếng Việt' : 'English');
      if (!cSvg) return;
      cSvg.querySelectorAll('.callout-label').forEach(e => { e.textContent = lang === 'EN' ? e.dataset.en : e.dataset.vi; });
      cSvg.querySelectorAll('.callout-label-sub').forEach(e => { e.textContent = lang === 'EN' ? e.dataset.en : e.dataset.vi; });
    }

    loadCutawaySvgText().then(raw => {
      // Đổi tên toàn bộ id và url(#...) theo hậu tố -g1 / -g2 để tránh xung đột gradient & phần tử giữa Turbine 1 và Turbine 2
      const nsHtml = raw
        .replace(/\bid="([^"]+)"/g, (_, id) => `id="${id}${suf}"`)
        .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}${suf})`);
      cutHost.innerHTML = nsHtml;
      cSvg = cutHost.querySelector('svg');
      if (!cSvg) return;
      // Mở rộng nhẹ 2 mép viewBox để chữ chú thích Tiếng Việt dài không bị cắt sát viền
      cSvg.setAttribute('viewBox', '-38 0 996 860');
      cSvg.style.maxHeight = '580px';

      // 12 cánh hướng nhìn mặt cắt phía trước (đại diện cho vành 24 cánh hướng dòng ZZJK508-LJ-280)
      const ga = byId('wicket-gates-array'), la = byId('operating-linkages');
      [286, 316, 346, 376, 406, 434, 486, 514, 544, 574, 604, 634].forEach(x => {
        cGates.push(Object.assign(mkSvg('polygon', { fill: `url(#wicketGoldGrad${suf})`, stroke: '#fef08a', 'stroke-width': 1.0 }, ga), { bx: x }));
        cLinks.push(Object.assign(mkSvg('line', { stroke: '#fbbf24', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, la), { bx: x }));
      });
      // 14 cực từ mặt trước (đại diện cho Rotor 28 cực đồng bộ SF8000-28/4250)
      const pd = byId('rotor-poles-dynamic');
      for (let i = 0; i < 14; i++) {
        cPoles.push(mkSvg('rect', { y: 184, height: 54, rx: 2, fill: i % 2 ? '#475569' : '#1e293b', stroke: '#94a3b8', 'stroke-width': 0.7 }, pd));
      }
      // 5 cánh bánh xe công tác Kaplan 3D
      const bb = byId('runner-blades-back'), bf = byId('runner-blades-front');
      for (let i = 0; i < 5; i++) {
        cBladesB.push(mkSvg('path', { fill: `url(#runnerBladeShadow${suf})`, stroke: '#64748b', 'stroke-width': 1.1 }, bb));
        cBladesF.push(mkSvg('path', { fill: `url(#runnerBlade3D${suf})`, stroke: '#f1f5f9', 'stroke-width': 1.3 }, bf));
      }
      // 56 hạt dòng chảy thủy lực qua buồng xoắn -> cánh hướng -> bánh xe công tác -> buồng xả
      const wl = byId('water-particles-layer');
      for (let i = 0; i < 56; i++) {
        cParts.push({
          el: mkSvg('circle', { r: (2.1 + Math.random() * 2.2).toFixed(1), fill: '#bae6fd' }, wl),
          side: i % 2 ? 1 : -1, p: Math.random(), off: (Math.random() - .5) * 36, sv: .8 + Math.random() * .4
        });
      }
      cHcw = byId('hc-water'); cSpec = byId('shaft-specular'); cTtl = byId('cut-title'); cBrake = byId('part-brake');
      cSvg.querySelectorAll('.callout-item').forEach(it => {
        it.style.cursor = 'pointer';
        const showInsp = () => {
          hoverItem = it;
          const pe = byId(it.dataset.part);
          if (pe) pe.classList.add('part-hover');
          insp.style.display = 'block';
          const fn = LIVE_PART[it.dataset.part];
          insp.innerHTML = `<b style="color:#22d3ee">${it.dataset.vi}</b><div style="color:#94a3b8;font-size:11.5px;margin:2px 0 6px">${it.dataset.en}</div>` + (fn ? fn() : '');
        };
        const hideInsp = () => {
          const pe = byId(it.dataset.part);
          if (pe) pe.classList.remove('part-hover');
          if (hoverItem === it) { hoverItem = null; insp.style.display = 'none'; }
        };
        it.addEventListener('mouseenter', showInsp);
        it.addEventListener('mouseleave', hideInsp);
        it.addEventListener('click', () => hoverItem === it ? hideInsp() : showInsp());
      });
      applyLang();
    }).catch(() => { cutHost.textContent = 'Không tải được cutaway.svg'; });

    function setTempCell(cell, val, warnLim, critLim) {
      cell.val.textContent = fx(val, 1) + ' °C';
      cell.box.classList.remove('ok', 'warn', 'crit');
      if (val > critLim) cell.box.classList.add('crit');
      else if (val > warnLim) cell.box.classList.add('warn');
      else cell.box.classList.add('ok');
    }
    function setHotClass(partId, level) {
      const pe = byId(partId);
      if (!pe) return;
      pe.classList.toggle('hot-warn', level === 1);
      pe.classList.toggle('hot-crit', level === 2);
    }

    F(dt => {
      if (!cSvg) return;
      const rpm = gv('speed'), rated = 214.3;
      cutPhase = (cutPhase + (rpm / rated) * 6.6 * dt) % (Math.PI * 2);
      // Rotor 28 cực quay mượt (14 cực hiển thị phía trước di chuyển từ phải sang trái)
      cPoles.forEach((pl, i) => {
        const a = (i / cPoles.length) * Math.PI + (cutPhase % Math.PI);
        const w = Math.max(2.5, Math.sin(a) * 14);
        pl.setAttribute('x', (460 + Math.cos(a) * 144 - w / 2).toFixed(1));
        pl.setAttribute('width', w.toFixed(1));
      });
      if (cSpec) cSpec.setAttribute('x', (458 + Math.sin(cutPhase * 2) * 13).toFixed(1));
      // 5 cánh bánh xe công tác Kaplan quay mượt & đổi góc nghiêng theo % cánh BXCT
      const pitch = Math.max(0, Math.min(1, gv('blade') / 100)) * 32, pr = (pitch / 32) * 0.72;
      for (let i = 0; i < 5; i++) {
        const th = -cutPhase + i * Math.PI * 2 / 5, sn = Math.sin(th), cs = Math.cos(th);
        const rx = 460 + sn * 36, ry = 682 + cs * 8, tx = 460 + sn * 138, ty = 682 + cs * 24 + Math.sin(pr) * sn * 18;
        const ch = 14 + (pitch / 32) * 26, tl = cs * 14 + (pitch / 32) * 12, mx = rx + (tx - rx) * 0.45;
        const dd = `M${rx} ${ry - ch * 0.45} C${mx} ${ry - ch * 0.85 - tl},${tx - sn * 10} ${ty - ch * 0.55 - tl * 0.5},${tx} ${ty} C${tx - sn * 8} ${ty + ch * 0.65},${mx} ${ry + ch * 0.75},${rx} ${ry + ch * 0.45}Z`;
        const front = cs >= -0.05;
        (front ? cBladesF : cBladesB)[i].setAttribute('d', dd);
        cBladesF[i].style.display = front ? '' : 'none';
        cBladesB[i].style.display = front ? 'none' : '';
      }
      // Hạt dòng nước xanh chảy qua buồng xoắn & buồng xả theo lưu lượng thực
      const fl = gv('flow'), sp = Math.min(1.25, (fl / 49.2) * 0.92);
      cParts.forEach(q => {
        if (sp < 0.01) { q.el.setAttribute('opacity', '0.1'); return; }
        q.p = (q.p + sp * q.sv * dt) % 1;
        const t = q.p; let x, y;
        if (t < 0.38) { const u = t / 0.38; x = 460 + q.side * (285 - u * 125) + q.off * 0.35; y = 565 + q.off * 0.8 + u * 25; }
        else if (t < 0.62) { const u = (t - 0.38) / 0.24; x = 460 + q.side * (160 - u * 65); y = 590 + u * 90; }
        else { const u = (t - 0.62) / 0.38; x = 460 + q.side * (95 - u * 10) + Math.sin(u * Math.PI * 3 - cutPhase) * (rpm / rated) * 18 + q.off * 0.5; y = 680 + u * 120; }
        q.el.setAttribute('cx', x.toFixed(1)); q.el.setAttribute('cy', y.toFixed(1));
        q.el.setAttribute('opacity', (0.35 + sp * 0.52).toFixed(2));
      });
    });

    U(() => {
      const t = readTemps();
      const rpm = gv('speed'), pctSpd = (rpm / 214.3) * 100;
      const brk = isBraking();
      const seqTxt = S[g + '.seq'] || 'Sẵn sàng';
      cutSeqBadge.textContent = seqTxt;
      hdrSub.innerHTML = `${seqTxt} · ${fx(gv('Pload'), 2)} MW · ${fx(rpm, 1)} v/ph (${fx(pctSpd, 1)}%)`;

      // Cập nhật bảng 8 nhiệt độ (Điều 12 & PlantConfig: Stator 110/120°C, Bạc ổ 60/65°C, Dầu ổ đỡ 50/55°C)
      setTempCell(tcStator, t.stator, 110, 120);
      setTempCell(tcRotor, t.rotor, 115, 130);
      setTempCell(tcThrust, t.thrust, 60, 65);
      if (t.thrustOil >= 55) tcThrust.box.className = 'turb-tcell crit';
      else if (t.thrustOil >= 50 && tcThrust.box.className === 'turb-tcell ') tcThrust.box.className = 'turb-tcell warn';
      setTempCell(tcGuideU, t.guideU, 60, 65);
      setTempCell(tcGuideL, t.guideL, 60, 65);
      setTempCell(tcTurbG, t.turbGuide, 60, 65);
      setTempCell(tcAirHot, t.airHot, 55, 65);
      setTempCell(tcCwTemp, t.cwTemp, 30, 35);

      // Cập nhật 6 thông số cơ – thủy lực & phanh
      mcSpeed.val.textContent = `${fx(rpm, 1)} v/ph (${fx(pctSpd, 1)}%)`;
      mcSpeed.box.className = 'turb-tcell ' + (rpm >= 332.2 ? 'crit' : rpm >= 310.7 ? 'warn' : '');
      mcGV.val.textContent = fx(gv('GV'), 1) + ' %';
      mcBlade.val.textContent = fx(gv('blade'), 1) + ' %';
      mcFlow.val.textContent = fx(gv('flow'), 2) + ' m³/s';
      mcHead.val.textContent = fx(gv('head'), 1) + ' m';
      mcBrake.val.innerHTML = brk
        ? '<span class="turb-brk-on">⚠ ĐANG PHANH</span>'
        : '<span class="turb-brk-off">Đã giải trừ phanh</span>';

      // Tự động tô sáng đỏ / cam vị trí quá nhiệt ngay trên hình mặt cắt SVG
      const hotMsgs = [];
      const lvStator = t.stator >= 120 ? 2 : t.stator >= 110 ? 1 : 0;
      if (lvStator) hotMsgs.push(`Stator ${fx(t.stator, 1)}°C`);
      const lvRotor = t.rotor >= 130 ? 2 : t.rotor >= 115 ? 1 : 0;
      if (lvRotor) hotMsgs.push(`Rotor ${fx(t.rotor, 1)}°C`);
      const lvUpper = (t.thrustOil >= 55 || t.thrust >= 65 || t.guideU >= 65) ? 2 : (t.thrustOil >= 50 || t.thrust >= 60 || t.guideU >= 60) ? 1 : 0;
      if (t.thrustOil >= 50) hotMsgs.push(`Dầu ổ đỡ ${fx(t.thrustOil, 1)}°C`);
      else if (t.thrust >= 60) hotMsgs.push(`Bạc ổ đỡ ${fx(t.thrust, 1)}°C`);
      if (t.guideU >= 60) hotMsgs.push(`Ổ hướng trên ${fx(t.guideU, 1)}°C`);
      const lvLower = t.guideL >= 65 ? 2 : t.guideL >= 60 ? 1 : 0;
      if (lvLower) hotMsgs.push(`Ổ hướng dưới ${fx(t.guideL, 1)}°C`);
      const lvTurb = t.turbGuide >= 65 ? 2 : t.turbGuide >= 60 ? 1 : 0;
      if (lvTurb) hotMsgs.push(`Ổ hướng TB ${fx(t.turbGuide, 1)}°C`);
      const lvAir = t.airHot >= 65 ? 2 : t.airHot >= 55 ? 1 : 0;
      if (lvAir) hotMsgs.push(`Khí nóng ${fx(t.airHot, 1)}°C`);

      if (hotMsgs.length) {
        hotBanner.style.display = 'block';
        hotBanner.innerHTML = `🔥 CẢNH BÁO PHÁT NÓNG: ${hotMsgs.join(' · ')}`;
      } else {
        hotBanner.style.display = 'none';
      }

      if (!cSvg) return;
      setHotClass('part-stator', lvStator);
      setHotClass('part-rotor', lvRotor);
      setHotClass('part-upper-bracket', lvUpper);
      setHotClass('part-lower-bracket', lvLower);
      setHotClass('turbine-guide-bearing', lvTurb);
      setHotClass('part-air-housing', lvAir);

      if (cTtl) cTtl.textContent = `TỔ MÁY ${gn} – KAPLAN ZZJK508-LJ-280 – ${S[g + '.seqState'] || ''}`;
      if (hoverItem) {
        const fn = LIVE_PART[hoverItem.dataset.part];
        insp.innerHTML = `<b style="color:#22d3ee">${hoverItem.dataset.vi}</b><div style="color:#94a3b8;font-size:11.5px;margin:2px 0 6px">${hoverItem.dataset.en}</div>` + (fn ? fn() : '');
      }
      // 24 cánh hướng mở/đóng theo GV thực
      const o = Math.max(0, Math.min(1, gv('GV') / 100));
      cGates.forEach((gt, i) => {
        const hw = 14 - o * 9, sk = (1 - o) * (gt.bx < 460 ? 10 : -10);
        gt.setAttribute('points', `${gt.bx - hw},556 ${gt.bx + hw},556 ${gt.bx + hw + sk},631 ${gt.bx - hw + sk},631`);
        cLinks[i].setAttribute('x1', gt.bx + (o - 0.5) * 16); cLinks[i].setAttribute('y1', 512);
        cLinks[i].setAttribute('x2', gt.bx); cLinks[i].setAttribute('y2', 554);
      });
      // Mực nước nắp tuabin (0–400 mm -> 0–150 px)
      if (cHcw) {
        const hh = Math.max(0, Math.min(150, (gv('headCover') / 400) * 150));
        cHcw.setAttribute('y', 485 - hh); cHcw.setAttribute('height', hh);
      }
      // Má phanh khí nén đổi màu cảnh báo nhấp nháy đỏ khi ĐANG PHANH
      if (cBrake) {
        cBrake.querySelectorAll('rect').forEach(r => r.setAttribute('fill', brk ? (Date.now() % 900 < 450 ? '#ef4444' : '#f59e0b') : '#64748b'));
        cBrake.classList.toggle('hot-crit', brk);
      }
    });

    // ==================== KHUNG PHẢI: MẶT BẰNG 24 CÁNH HƯỚNG + CHẾ ĐỘ + BẢNG ĐIỆN ====================
    const rightCard = h('div', { class: 'card turb-right-card' }, topGrid);
    const p = el('svg', { viewBox: '0 0 580 555', class: 'turb-plan-svg' }, rightCard);
    const px = 290, py = 278, R = 216;
    el('rect', { x: 10, y: 8, width: 560, height: 538, rx: 12, fill: '#f8f9fa', stroke: '#ced4da' }, p);
    txt(p, px, 34, '24 Cánh hướng dòng, 02 Xi-lanh Servo & BXCT Kaplan', 'lblb', 'middle');
    // buồng xoắn
    let d = '';
    for (let a = 0; a <= 2 * Math.PI * 0.95; a += 0.1) { const rr = R - 10 - 26 * (a / (2 * Math.PI)); d += (d ? 'L' : 'M') + (px + rr * Math.cos(a - Math.PI / 2)) + ' ' + (py + rr * Math.sin(a - Math.PI / 2)); }
    el('path', { d, fill: 'none', stroke: '#1c7ed6', 'stroke-width': 13, opacity: 0.32 }, p);
    el('circle', { cx: px, cy: py, r: 164, fill: '#d0ebff', stroke: '#74c0fc', 'stroke-width': 2 }, p);
    // vành điều chỉnh cánh hướng (Operating Ring) xoay theo lực kéo 2 servo
    const opRingG = el('g', {}, p);
    el('circle', { cx: px, cy: py, r: 172, fill: 'none', stroke: '#f08c00', 'stroke-width': 8, opacity: 0.85 }, opRingG);
    el('circle', { cx: px, cy: py, r: 172, fill: 'none', stroke: '#ffd43b', 'stroke-width': 2, 'stroke-dasharray': '12 8' }, opRingG);
    // 02 xi-lanh servo thủy lực đối xứng tiếp tuyến kéo vành điều chỉnh
    const servoRods = [];
    for (const [sx, sy, dirX, lbl, ly] of [[px - 216, py - 178, 1, 'Servo 1', py - 193], [px + 216, py + 178, -1, 'Servo 2', py + 202]]) {
      const cx0 = dirX > 0 ? sx : sx - 92;
      el('rect', { x: cx0, y: sy - 11, width: 92, height: 22, rx: 5, fill: '#2b8a3e', stroke: '#1b5e20', 'stroke-width': 2 }, p);
      el('rect', { x: dirX > 0 ? cx0 + 10 : cx0 + 62, y: sy - 6, width: 20, height: 12, rx: 2, fill: '#8ce99a', opacity: 0.55 }, p);
      const rod = el('line', { x1: dirX > 0 ? cx0 + 92 : cx0, y1: sy, x2: px, y2: sy, stroke: '#495057', 'stroke-width': 7, 'stroke-linecap': 'round' }, p);
      const pin = el('circle', { cx: px, cy: sy, r: 5.5, fill: '#e8590c', stroke: '#fff', 'stroke-width': 1.5 }, p);
      txt(p, cx0 + 46, ly, lbl, 'lblb', 'middle').setAttribute('font-size', '11');
      servoRods.push({ rod, pin, dirX, sy });
    }
    // dòng nước xoáy
    const flow = el('circle', { cx: px, cy: py, r: 122, fill: 'none', stroke: '#339af0', 'stroke-width': 6, 'stroke-dasharray': '18 26', opacity: 0.6 }, p);
    // 24 cánh hướng dòng (ZZJK508-LJ-280)
    const vanes = [];
    for (let i = 0; i < 24; i++) {
      const a = i * 2 * Math.PI / 24, vx = px + 143 * Math.cos(a), vy = py + 143 * Math.sin(a);
      const rx = px + 172 * Math.cos(a), ry = py + 172 * Math.sin(a);
      el('line', { x1: rx, y1: ry, x2: vx, y2: vy, stroke: '#e67700', 'stroke-width': 2 }, opRingG);
      const v = el('path', { d: `M${vx - 18} ${vy} Q${vx} ${vy - 6.5} ${vx + 18} ${vy} Q${vx} ${vy + 4.5} ${vx - 18} ${vy} Z`, fill: '#1864ab', stroke: '#0b3d6b', 'stroke-width': 1 }, p);
      el('circle', { cx: vx, cy: vy, r: 2.2, fill: '#fff' }, p);
      vanes.push([v, vx, vy, a]);
    }
    // bánh xe công tác Kaplan 5 cánh
    const run = el('g', {}, p);
    for (let i = 0; i < 5; i++) el('path', { d: `M${px} ${py} C${px + 34} ${py - 27} ${px + 84} ${py - 21} ${px + 100} ${py + 8} C${px + 71} ${py + 17} ${px + 34} ${py + 15} ${px} ${py} Z`, fill: '#e03131', stroke: '#a51111', 'stroke-width': 1.5, transform: `rotate(${i * 72} ${px} ${py})` }, run);
    el('circle', { cx: px, cy: py, r: 27, fill: '#c8a165', stroke: '#8d6e3f', 'stroke-width': 2 }, p);
    const gvT = txt(p, px, 532, '', 'lblb', 'middle'); gvT.setAttribute('font-size', '15');
    let ra = 0, fo = 0;
    F(dt => {
      const rpm = n(g + '.speed');
      ra = (ra + dt * 360 * (rpm / 214.3) * 1.2) % 360;
      run.setAttribute('transform', `rotate(${ra} ${px} ${py})`);
      if (n(g + '.GV') > 1 && on('IntakeGate')) { fo = (fo - dt * 60 * (0.3 + n(g + '.GV') / 50)) % 44; flow.setAttribute('stroke-dashoffset', fo); flow.setAttribute('opacity', 0.6); }
      else flow.setAttribute('opacity', 0.1);
    });
    U(() => {
      const o = n(g + '.GV');
      vanes.forEach(([v, vx, vy, a]) => v.setAttribute('transform', `rotate(${a * 180 / Math.PI + 90 - 6 + o * 0.45} ${vx} ${vy})`));
      const ringDeg = (o / 100) * 16;
      opRingG.setAttribute('transform', `rotate(${ringDeg} ${px} ${py})`);
      const strokeDx = (o / 100) * 44;
      servoRods.forEach(sr => {
        const endX = px + sr.dirX * (-22 + strokeDx);
        sr.rod.setAttribute('x2', endX);
        sr.pin.setAttribute('cx', endX);
      });
      gvT.textContent = `Độ mở 24 cánh hướng: ${fx(o, 1)} % · Cánh BXCT: ${fx(n(g + '.blade'), 1)} %`;
    });

    // 4 nút chế độ vận hành + cảnh báo Điều 10
    const modesWrap = h('div', { class: 'turb-modes' }, rightCard);
    const modes = [['DỪNG MÁY', 0], ['CHẠY TỰ DO', 3], ['KHÔNG TẢI', 2], ['PHÁT ĐIỆN', 1]];
    modes.forEach(([l, m]) => {
      const b = h('button', {
        class: 'btn',
        onclick: () => {
          if (m > 0 && isUnitStartingOrSyncing(otherGn)) {
            toast(`CẢNH BÁO ĐIỀU 10: Tổ máy ${otherGn} đang khởi động / chưa hòa lưới – quy trình cấm khởi động đồng thời 2 tổ máy!`, true);
            ask(`⚠ CẢNH BÁO ĐIỀU 10: Tổ máy H${otherGn} đang khởi động/chờ hòa lưới!\nQuy trình cấm khởi động đồng thời 2 tổ máy.\nBạn vẫn muốn chuyển MF${gn} sang ${l}?`, () => set(`GEN${gn}.MODE`, m));
          } else {
            ask(`MF${gn}: ${l}?`, () => set(`GEN${gn}.MODE`, m));
          }
        }
      }, modesWrap, l);
      U(() => b.classList.toggle('on', n(g + '.mode') === m));
    });

    // Bảng thông số điện đầy đủ (P, Q, S, U, I, f, cos φ, Iktt, Uktt)
    const elecGrid = h('div', { class: 'turb-elec-grid' }, rightCard);
    const mkECell = lbl => {
      const d0 = h('div', { class: 'turb-ecell' }, elecGrid);
      h('span', {}, d0, lbl);
      const b0 = h('b', {}, d0, '--');
      return { box: d0, val: b0 };
    };
    const ecP = mkECell('P (MW)');
    const ecQ = mkECell('Q (MVAr)');
    const ecS = mkECell('S (MVA)');
    const ecU = mkECell('U (kV)');
    const ecI = mkECell('I (A)');
    const ecF = mkECell('f (Hz)');
    const ecPF = mkECell('cos φ');
    const ecIexc = mkECell('Iktt (A)');
    const ecVexc = mkECell('Uktt (V)');
    U(() => {
      const P = n(g + '.Pload'), Q = n(g + '.Qload'), Sval = Math.hypot(P, Q);
      const pf = Sval > 0.05 ? Math.min(1, Math.abs(P) / Sval).toFixed(3) : '—';
      ecP.val.textContent = fx(P, 2);
      ecQ.val.textContent = fx(Q, 2);
      ecS.val.textContent = fx(Sval, 2);
      ecS.box.classList.toggle('over', Sval > 10.001);
      ecU.val.textContent = fx(n(g + '.Vgen'), 2);
      ecI.val.textContent = fx(n(g + '.Ia'), 0);
      ecF.val.textContent = fx(n(g + '.freq'), 2);
      ecPF.val.textContent = pf;
      ecIexc.val.textContent = fx(n(g + '.Iexc'), 0);
      ecVexc.val.textContent = fx(n(g + '.Vexc'), 0);
    });

    // ----- Thanh mốc tốc độ & ngưỡng bảo vệ Đrây H'Linh 2 (Chương I & Điều 26, 27) -----
    const spdCard = h('div', { class: 'card pad', style: 'margin-top:10px' }, root);
    const spdHdr = h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:6px' }, spdCard);
    h('b', { style: 'color:#1864ab;font-size:13.5px' }, spdHdr, `Thang tốc độ & Ngưỡng cắt bảo vệ – Tuabin ZZJK508-LJ-280 (Tổ máy ${gn})`);
    const spdNowLbl = h('span', { style: 'font-weight:700;font-size:13px;font-variant-numeric:tabular-nums' }, spdHdr, '');
    const spdBar = h('div', { style: 'position:relative;height:26px;background:#e9ecef;border-radius:6px;overflow:hidden;border:1px solid #ced4da' }, spdCard);
    const spdFill = h('div', { style: 'height:100%;width:0%;background:linear-gradient(90deg,#339af0,#2b8a3e);transition:width .15s' }, spdBar);
    const spdMarks = [
      { rpm: 64.3, lbl: 'Phanh <30% (64,3)', col: '#1971c2' },
      { rpm: 214.3, lbl: 'nđm 100% (214,3)', col: '#2b8a3e' },
      { rpm: 310.7, lbl: 'SC Loại 1: 145% (310,7)', col: '#f08c00' },
      { rpm: 332.2, lbl: 'SC Loại 2: 155% (332,2)', col: '#e03131' },
      { rpm: 540.3, lbl: 'Lồng 540,3 v/ph', col: '#862e9c' }
    ];
    spdMarks.forEach(m => {
      const pct = (m.rpm / 560) * 100;
      h('div', { style: `position:absolute;top:0;bottom:0;left:${pct.toFixed(2)}%;width:2px;background:${m.col}` }, spdBar);
    });
    const spdLeg = h('div', { class: 'row', style: 'margin-top:6px;font-size:12px;gap:10px;justify-content:space-between' }, spdCard);
    spdMarks.forEach(m => h('span', { style: `color:${m.col};font-weight:600` }, spdLeg, `│ ${m.lbl}`));
    U(() => {
      const rpm = n(g + '.speed');
      const pctBar = Math.min(100, (rpm / 560) * 100);
      spdFill.style.width = pctBar.toFixed(1) + '%';
      spdFill.style.background = rpm >= 332.2 ? '#c92a2a' : rpm >= 310.7 ? '#f08c00' : (rpm > 1 && rpm < 64.3) ? '#1971c2' : 'linear-gradient(90deg,#339af0,#2b8a3e)';
      const zoneTxt = rpm >= 332.2 ? '⚠ DỪNG SỰ CỐ LOẠI 2 (HẠ CỬA NHẬN NƯỚC)' : rpm >= 310.7 ? '⚠ DỪNG SỰ CỐ LOẠI 1 (145%)' : (rpm > 1 && rpm < 64.3 && n(g + '.mode') === 0) ? 'Vùng phanh cơ khí (<30%)' : rpm >= 200 ? 'Tốc độ định mức' : 'Dừng / Khởi động';
      spdNowLbl.innerHTML = `${fx(rpm, 1)} v/ph (${fx(rpm / 214.3 * 100, 1)}% nđm) · <span style="color:${rpm >= 310.7 ? '#c92a2a' : '#2b8a3e'}">${zoneTxt}</span>`;
    });

    // ----- HTML: đặt P/Q + cảnh báo 10 MVA, điều kiện khởi động -----
    const box = h('div', { class: 'grid2', style: 'margin-top:10px' }, root);
    const c1 = h('div', { class: 'card pad' }, box);
    h('h3', {}, c1, 'Đặt công suất & chế độ điều khiển (SF8000-28/4250 · 8 MW / 10 MVA)');
    const slRefs = {};
    const sMeter = h('div', { style: 'margin-top:8px;padding:7px 10px;border-radius:7px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;border:1px solid #ced4da;background:#f8f9fa' }, c1, '');
    function refreshApparentS() {
      const pSet = slRefs.P ? +slRefs.P.inp.value : n(g + '.P');
      const qSet = slRefs.Q ? +slRefs.Q.inp.value : n(g + '.Q');
      const sSet = Math.hypot(pSet, qSet);
      const sAct = Math.hypot(n(g + '.Pload'), n(g + '.Qload'));
      const over = sSet > 10.001 || sAct > 10.001;
      sMeter.style.background = over ? '#ffe3e3' : '#e6fcf5';
      sMeter.style.borderColor = over ? '#e03131' : '#12b886';
      sMeter.style.color = over ? '#c92a2a' : '#087f5b';
      sMeter.innerHTML = over
        ? `⚠ VƯỢT CÔNG SUẤT ĐỊNH MỨC 10 MVA! S đặt = √(${fx(pSet, 1)}² + ${fx(qSet, 1)}²) = ${fx(sSet, 2)} MVA (S thực = ${fx(sAct, 2)} MVA) > 10,00 MVA`
        : `Công suất biểu kiến S = √(P² + Q²): Đặt = ${fx(sSet, 2)} MVA · Thực = ${fx(sAct, 2)} MVA / 10,00 MVA (An toàn)`;
    }
    for (const [k, lbl, min, max] of [['P', 'Đặt P (MW)', 0, 8.5], ['Q', 'Đặt Q (MVAr)', -3, 7]]) {
      const r = h('div', { class: 'row' }, c1);
      h('span', { style: 'width:110px' }, r, lbl);
      const inp = h('input', { type: 'range', min, max, step: 0.1, style: 'flex:1' }, r);
      const vv = h('b', { style: 'width:60px;text-align:right' }, r, '0');
      let editing = false;
      slRefs[k] = { inp, vv };
      inp.oninput = () => { editing = true; vv.textContent = (+inp.value).toFixed(1); refreshApparentS(); };
      inp.onchange = () => { set(`GEN${gn}.${k}`, +inp.value); refreshApparentS(); setTimeout(() => editing = false, 1500); };
      U(() => { if (!editing) { inp.value = n(g + '.' + k); vv.textContent = fx(n(g + '.' + k), 1); } });
    }
    c1.appendChild(sMeter);
    U(refreshApparentS);
    const rr = h('div', { class: 'row', style: 'margin-top:10px' }, c1);
    const rb = h('button', { class: 'btn', onclick: () => set(`GEN${gn}.REMOTE`) }, rr, '');
    U(() => { rb.textContent = on(g + '.remote') ? 'Đang ở LOCAL – bấm chuyển REMOTE' : 'Đang ở REMOTE (SD200) – bấm chuyển LOCAL'; });
    const st = h('div', { style: 'margin-top:10px;color:#495057' }, c1);
    U(() => { st.innerHTML = `Tốc độ đặt: <b>${fx(n(g + '.SP'), 0)} Hz</b> · Điều tốc: <b>${on(g + '.pid') ? 'đang chạy' : 'dừng'}</b> · Nước làm mát: <b>${fx(n(g + '.cwTemp'), 1)} °C</b> · Nước rò nắp TB: <b>${fx(n(g + '.headCover'), 0)} mm</b>`; });

    const trip = h('div', { class: 'row', style: 'margin-top:10px;color:#c92a2a;font-weight:700' }, c1, '');
    U(() => {
      trip.innerHTML = on(g + '.tripped') ? `⚠ BẢO VỆ ĐÃ CẮT TỔ MÁY: ${S[g + '.tripReason'] || ''} ` : '';
      if (on(g + '.tripped')) h('button', { class: 'btn danger', onclick: () => set(`GEN${gn}.RESET`) }, trip, 'GIẢI TRỪ BẢO VỆ');
    });
    const c2 = h('div', { class: 'card pad' }, box);
    const chkT = h('h3', {}, c2, '');
    // Điều kiện khởi động theo QT vận hành khối tổ máy – Điều 20 (do mô hình tính, cập nhật trực tiếp)
    const tb = h('table', { class: 't' }, c2);
    let sig = '';
    U(() => {
      const L = S[g + '.startConds'] || [];
      const ok = L.filter(x => x.ok).length;
      chkT.innerHTML = `Điều kiện khởi động (QT Điều 20): ${ok} / ${L.length} &nbsp;<span style="padding:2px 10px;border-radius:10px;font-size:13px;background:${ok === L.length ? '#2b8a3e' : '#868e96'};color:#fff">1. G ok</span>`;
      const k2 = L.map(x => x.t + x.ok).join('|');
      if (k2 === sig) return; sig = k2;
      tb.innerHTML = '';
      L.forEach(x => {
        const tr = h('tr', {}, tb);
        h('td', { style: `width:34px;text-align:center;font-size:18px;color:${x.ok ? '#2b8a3e' : '#e03131'}` }, tr, x.ok ? '✔' : '✖');
        h('td', {}, tr, x.t);
        const td = h('td', { style: 'width:110px' }, tr);
        if (x.key) h('button', { class: 'btn', onclick: () => ask(`Thao tác: ${x.t}?`, () => set(x.key)) }, td, 'Đổi');
      });
    });

    // ----- Biểu đồ Đường cong khả năng P–Q (SF8000-28/4250: 10 MVA, 8 MW, Xd=0.90) -----
    const pqCard = h('div', { class: 'card pad', style: 'margin-top:10px' }, root);
    const pqHdr = h('div', { class: 'row', style: 'justify-content:space-between' }, pqCard);
    h('h3', { style: 'margin:0' }, pqHdr, `Đường cong khả năng P–Q – Tổ máy ${gn} (SF8000-28/4250 · 10 MVA)`);
    const pqMeta = h('span', { style: 'font-size:13px;font-weight:600;font-variant-numeric:tabular-nums' }, pqHdr, '');
    const pqCv = h('canvas', { width: 760, height: 360, style: 'width:100%;max-width:780px;display:block;margin:8px auto 0;border-radius:8px;border:1px solid var(--line)' }, pqCard);
    U(() => {
      const stPQ = drawPQCurve(pqCv, gn);
      pqMeta.innerHTML = `P = <b>${fx(stPQ.P, 2)} MW</b> · Q = <b>${fx(stPQ.Q, 2)} MVAr</b> · S = <b>${fx(stPQ.S, 2)} MVA</b> · cosφ = <b>${stPQ.pf}</b> · <span style="color:${stPQ.ok ? '#2b8a3e' : '#e03131'}">${stPQ.status}</span>`;
    });
  };
}

/**
 * Vẽ Biểu đồ Đường cong khả năng P–Q chuẩn vật lý máy điện đồng bộ cực lồi (SF8000-28/4250):
 *  - S_đm = 10,0 MVA, P_đm = 8,0 MW (cosφ = 0,80), P_max tuabin = 8,33 MW, Xd = 0,90 pu
 *  1) Cung tròn giới hạn dòng kích từ rotor phía trên: tâm (0, -U²/Xd·S) = (0, -11,11), R = 18,89 MVA
 *  2) Cung tròn giới hạn dòng stator: P² + Q² = 10²
 *  3) Đường thẳng đứng giới hạn công suất cơ tuabin: P = 8,33 MW
 *  4) Cung cong giới hạn thiếu kích từ / ổn định tĩnh phía dưới: hút Q thu hẹp dần khi P tăng
 */
function drawPQCurve(cv, gn, forceDark) {
  const g = 'G' + gn;
  const P = n(g + '.Pload'), Q = n(g + '.Qload');
  const Sval = Math.hypot(P, Q);
  const pfNum = Sval > 0.05 ? Math.min(1, Math.abs(P) / Sval) : 1;
  const pf = Sval > 0.05 ? pfNum.toFixed(3) : '-';

  // Các thông số vật lý biên giới hạn
  const Sdm = 10.0, Pmax = 8.33, Prated = 8.0;
  const QcRot = -11.111, Rrot = Math.hypot(Prated, 6.0 - QcRot); // ~18.888 MVA
  const QcUel = 6.8, Ruel = 11.4; // tại P=0: Q=-4.60; P=8.33: Q=-0.98

  const qRotor = p => QcRot + Math.sqrt(Math.max(0, Rrot * Rrot - p * p));
  const qStator = p => Math.sqrt(Math.max(0, Sdm * Sdm - p * p));
  const qUel = p => QcUel - Math.sqrt(Math.max(0, Ruel * Ruel - p * p));
  const qUpper = p => Math.min(qRotor(p), qStator(p));

  const inP = P >= -0.05 && P <= Pmax + 0.05;
  const inUp = Q <= qUpper(Math.max(0, Math.min(Pmax, P))) + 0.08;
  const inLo = Q >= qUel(Math.max(0, Math.min(Pmax, P))) - 0.08;
  const inS = Sval <= Sdm + 0.08;
  const ok = inP && inUp && inLo && inS;
  const status = !ok ? 'VƯỢT GIỚI HẠN' : (Sval > 9.4 || P > 8.1 || Q < qUel(Math.max(0, P)) + 0.45 ? 'GẦN BIÊN' : 'TRONG VÙNG AN TOÀN');

  if (!cv) return { P, Q, S: Sval, pf, ok, status };
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const dark = forceDark != null ? forceDark : document.body.classList.contains('dark');

  // Khung đồ thị: P từ 0 đến 10.6 MW (trục ngang), Q từ -6.0 đến +9.0 MVAr (trục đứng)
  const padL = 58, padR = 175, padT = 26, padB = 38;
  const pw = W - padL - padR, ph = H - padT - padB;
  const pMin = 0, pMaxAxis = 10.5, qMin = -6.0, qMaxAxis = 9.0;
  const sx = p => padL + ((p - pMin) / (pMaxAxis - pMin)) * pw;
  const sy = q => padT + ((qMaxAxis - q) / (qMaxAxis - qMin)) * ph;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = dark ? '#0b1522' : '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Lưới tọa độ
  ctx.strokeStyle = dark ? '#1e3044' : '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.font = '11px system-ui,sans-serif';
  ctx.fillStyle = dark ? '#94a3b8' : '#475569';
  for (let p = 0; p <= 10; p += 1) {
    const x = sx(p);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText(String(p), x, H - padB + 15);
  }
  for (let q = -6; q <= 9; q += 2) {
    const y = sy(q);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText((q > 0 ? '+' : '') + q, padL - 7, y + 4);
  }
  // Trục Q = 0 đậm
  ctx.strokeStyle = dark ? '#475569' : '#64748b';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(padL, sy(0)); ctx.lineTo(W - padR, sy(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx(0), padT); ctx.lineTo(sx(0), H - padB); ctx.stroke();

  // Nhãn trục
  ctx.fillStyle = dark ? '#cbd5e1' : '#1e293b';
  ctx.font = 'bold 12px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Công suất tác dụng P (MW)', padL + pw / 2, H - 8);
  ctx.save(); ctx.translate(16, padT + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('Công suất phản kháng Q (MVAr)', 0, 0); ctx.restore();

  // Vùng vận hành an toàn tô bóng
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(qUpper(0)));
  for (let p = 0; p <= Pmax; p += 0.1) ctx.lineTo(sx(p), sy(qUpper(p)));
  ctx.lineTo(sx(Pmax), sy(qUpper(Pmax)));
  ctx.lineTo(sx(Pmax), sy(qUel(Pmax)));
  for (let p = Pmax; p >= 0; p -= 0.1) ctx.lineTo(sx(p), sy(qUel(p)));
  ctx.closePath();
  ctx.fillStyle = dark ? 'rgba(14,165,233,0.16)' : 'rgba(14,165,233,0.14)';
  ctx.fill();
  ctx.restore();

  // Các tia hệ số công suất cosφ = 0.80, 0.90, 0.95 (cả chiều phát +Q và nhận -Q nhẹ)
  const pfs = [0.80, 0.90, 0.95];
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = dark ? 'rgba(148,163,184,0.42)' : 'rgba(100,116,139,0.45)';
  ctx.lineWidth = 1.1;
  ctx.font = '10.5px system-ui,sans-serif';
  ctx.fillStyle = dark ? '#94a3b8' : '#475569';
  pfs.forEach(c => {
    const phi = Math.acos(c);
    const pEnd = Sdm * c, qEnd = Sdm * Math.sin(phi);
    ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(pEnd), sy(qEnd)); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillText(`cosφ=${c.toFixed(2)}`, sx(pEnd) + 4, sy(qEnd) - 2);
  });
  ctx.restore();

  // Cung tròn tham chiếu Stator đầy đủ Sđm = 10 MVA (nét đứt mảnh)
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = dark ? 'rgba(56,189,248,0.35)' : 'rgba(2,132,199,0.32)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let a = -0.64; a <= Math.PI / 2; a += 0.03) {
    const px = Sdm * Math.cos(a), qy = Sdm * Math.sin(a);
    if (qy < qMin || px > pMaxAxis) continue;
    a === -0.64 ? ctx.moveTo(sx(px), sy(qy)) : ctx.lineTo(sx(px), sy(qy));
  }
  ctx.stroke();
  ctx.restore();

  // (1) Cung tròn giới hạn dòng kích từ rotor phía trên (0 <= P <= 8.0 MW)
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let p = 0; p <= Prated; p += 0.08) {
    p === 0 ? ctx.moveTo(sx(p), sy(qRotor(p))) : ctx.lineTo(sx(p), sy(qRotor(p)));
  }
  ctx.lineTo(sx(Prated), sy(qRotor(Prated)));
  ctx.stroke();

  // (2) Cung tròn giới hạn dòng stator S_đm = 10 MVA (từ P = 8.0 đến P = 8.33 MW)
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  for (let p = Prated; p <= Pmax; p += 0.03) {
    p === Prated ? ctx.moveTo(sx(p), sy(qStator(p))) : ctx.lineTo(sx(p), sy(qStator(p)));
  }
  ctx.lineTo(sx(Pmax), sy(qStator(Pmax)));
  ctx.stroke();

  // (3) Đường thẳng đứng giới hạn công suất cơ tuabin P_max = 8.33 MW
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx(Pmax), sy(qStator(Pmax)));
  ctx.lineTo(sx(Pmax), sy(qUel(Pmax)));
  ctx.stroke();

  // (4) Cung cong giới hạn thiếu kích từ / ổn định tĩnh phía dưới (0 <= P <= 8.33 MW)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let p = 0; p <= Pmax; p += 0.08) {
    p === 0 ? ctx.moveTo(sx(p), sy(qUel(p))) : ctx.lineTo(sx(p), sy(qUel(p)));
  }
  ctx.lineTo(sx(Pmax), sy(qUel(Pmax)));
  ctx.stroke();

  // Điểm định mức (8.0 MW, 6.0 MVAr)
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.arc(sx(Prated), sy(6.0), 4, 0, Math.PI * 2); ctx.fill();

  // Véctơ công suất & Điểm làm việc thời gian thực (P, Q)
  const pxCur = sx(Math.max(0, Math.min(pMaxAxis, P)));
  const pyCur = sy(Math.max(qMin, Math.min(qMaxAxis, Q)));
  ctx.save();
  ctx.strokeStyle = ok ? '#38bdf8' : '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(pxCur, pyCur); ctx.stroke();
  ctx.fillStyle = ok ? 'rgba(56,189,248,0.28)' : 'rgba(239,68,68,0.34)';
  ctx.beginPath(); ctx.arc(pxCur, pyCur, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ok ? '#0284c7' : '#dc2626';
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(pxCur, pyCur, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  // Chú thích bên phải
  const lx = W - padR + 14;
  let ly = padT + 14;
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px system-ui,sans-serif';
  ctx.fillStyle = dark ? '#e2e8f0' : '#0f172a';
  ctx.fillText(`TỔ MÁY H${gn}`, lx, ly); ly += 20;
  const legend = [
    ['#f59e0b', 'Giới hạn kích từ rotor'],
    ['#0ea5e9', 'Giới hạn dòng stator (10 MVA)'],
    ['#22c55e', 'Giới hạn Pmax tuabin (8,33 MW)'],
    ['#ef4444', 'Giới hạn thiếu kích từ / UEL']
  ];
  ctx.font = '11px system-ui,sans-serif';
  legend.forEach(([col, txtLbl]) => {
    ctx.fillStyle = col; ctx.fillRect(lx, ly - 8, 12, 4);
    ctx.fillStyle = dark ? '#cbd5e1' : '#334155';
    ctx.fillText(txtLbl, lx + 17, ly - 2);
    ly += 19;
  });
  ly += 10;
  ctx.fillStyle = dark ? '#112236' : '#eef2f6';
  ctx.fillRect(lx - 4, ly - 14, padR - 18, 92);
  ctx.strokeStyle = dark ? '#2a4159' : '#cbd5e1';
  ctx.strokeRect(lx - 4, ly - 14, padR - 18, 92);
  ctx.fillStyle = dark ? '#e2e8f0' : '#0f172a';
  ctx.font = 'bold 11.5px monospace';
  ctx.fillText(`P = ${fx(P, 2)} MW`, lx + 4, ly + 4);
  ctx.fillText(`Q = ${fx(Q, 2)} MVAr`, lx + 4, ly + 22);
  ctx.fillText(`S = ${fx(Sval, 2)} MVA`, lx + 4, ly + 40);
  ctx.fillText(`cosφ = ${pf}`, lx + 4, ly + 58);
  ctx.fillStyle = ok ? '#22c55e' : '#ef4444';
  ctx.fillText(status, lx + 4, ly + 74);

  return { P, Q, S: Sval, pf, ok, status };
}
window.drawPQCurve = drawPQCurve;

addPage('turbine1', 'Turbine 1', turbinePage(1));
addPage('turbine2', 'Turbine 2', turbinePage(2));

// ================================================================== TRANG: ĐIỀU TỐC KAPLAN ZZJK508-LJ-280
const trendBuf = { 1: [], 2: [] };
const govCfgSyncers = [];
addPage('governor', 'Điều tốc', root => {
  const box = h('div', { class: 'grid2' }, root);

  async function saveGovCfg(payload) {
    if (online) {
      const r = await api('governor/config', payload);
      if (r && r.ok) {
        if (r.cfg) {
          S['cfg.govKp'] = r.cfg.govKp; S['cfg.govKi'] = r.cfg.govKi; S['cfg.govKd'] = r.cfg.govKd;
          S['cfg.govBp'] = r.cfg.govBp; S['cfg.islandDroop'] = r.cfg.govBp;
          S['cfg.powerKp'] = r.cfg.powerKp; S['cfg.powerKi'] = r.cfg.powerKi;
          S['cfg.pRampMWs'] = r.cfg.pRampMWs;
        }
        govCfgSyncers.forEach(fn => fn(true));
        notifyCfgChanged(r.cfgRev);
        toast(payload.reset ? 'Đã khôi phục & lưu tham số điều tốc chuẩn Đrây H\'Linh 2!' : 'Đã áp dụng & lưu tham số điều tốc vào PlantConfig!');
      }
      return r;
    } else {
      if (payload.reset) {
        S['cfg.govKp'] = 1.6; S['cfg.govKi'] = 0.27; S['cfg.govKd'] = 0.0; S['cfg.govBp'] = 0.01; S['cfg.islandDroop'] = 0.01;
        S['cfg.powerKp'] = 0.05; S['cfg.powerKi'] = 0.05; S['cfg.pRampMWs'] = 0.8;
      } else {
        if (payload.govKp !== undefined) S['cfg.govKp'] = payload.govKp;
        if (payload.govKi !== undefined) S['cfg.govKi'] = payload.govKi;
        if (payload.govKd !== undefined) S['cfg.govKd'] = payload.govKd;
        if (payload.govBp !== undefined) { S['cfg.govBp'] = payload.govBp; S['cfg.islandDroop'] = payload.govBp; }
        if (payload.powerKp !== undefined) S['cfg.powerKp'] = payload.powerKp;
        if (payload.powerKi !== undefined) S['cfg.powerKi'] = payload.powerKi;
        if (payload.pRampMWs !== undefined) S['cfg.pRampMWs'] = payload.pRampMWs;
      }
      govCfgSyncers.forEach(fn => fn(true));
      toast('Đã cập nhật tham số điều tốc (chế độ cục bộ)');
      return { ok: true };
    }
  }
  cfgListeners.push(() => govCfgSyncers.forEach(fn => fn(false)));

  for (const gn of [1, 2]) {
    const g = 'G' + gn;
    const cmd = f => `GEN${gn}.${f}`;
    const card = h('div', { class: 'card gov-card' }, box);

    // ---- 1. Header tủ điều tốc ----
    const hdr = h('div', { class: 'gov-hdr' }, card);
    const ht = h('div', { class: 'gov-hdr-title' }, hdr);
    h('h3', {}, ht, `Tủ Điều tốc Kaplan ZZJK508-LJ-280 — Tổ máy ${gn}`);
    const seqSub = h('div', { class: 'gov-seq-sub' }, ht, 'Dừng dự phòng');
    const badges = h('div', { class: 'gov-badges' }, hdr);
    const modePill = h('span', { class: 'gov-mode-pill m-off' }, badges, 'OFF');
    const camPill = h('span', { class: 'gov-mode-pill m-speed', style: 'font-size:11px' }, badges, 'ON-CAM');

    // ---- 2. Chỉ thị thông số vận hành trực tiếp trên mặt tủ (6 KPI) ----
    const kpis = h('div', { class: 'gov-kpis' }, card);
    const mkKpi = (title, initVal, initSub) => {
      const d = h('div', { class: 'gov-kpi' }, kpis);
      h('span', {}, d, title);
      const b = h('b', {}, d, initVal);
      const sm = h('small', {}, d, initSub || '');
      return { el: d, val: b, sub: sm };
    };
    const kMode = mkKpi('Chế độ điều tốc', 'OFF', 'Tự động (AUTO)');
    const kSpd = mkKpi('Tốc độ · Tần số', '0,0 v/ph · 0,00 Hz', 'Đặt: 50,00 Hz (214,3 v/ph)');
    const kGv = mkKpi('Độ mở cánh hướng', '0,0 %', 'Hạn chế: 100%');
    const gvBarWrap = h('div', { class: 'gov-gv-bar' }, kGv.el);
    const gvFill = h('div', { class: 'gov-gv-fill', style: 'width:0%' }, gvBarWrap);
    const gvLimMark = h('div', { class: 'gov-gv-lim', style: 'left:100%' }, gvBarWrap);
    const kBlade = mkKpi('Cánh xoay BXCT', '0,0 % · -10,0°', 'Cam: -10,0° (Δ 0,0°)');
    const kPow = mkKpi('Công suất Pcơ / Pđặt', '0,00 / 0,00 MW', 'Pđiện: 0,00 MW · Q: 0,0 m³/s');
    const kOil = mkKpi('Áp lực dầu HYZ', '4,00 MPa', 'Bình áp lực 2,5 m³ (3,7–4,0)');

    // ---- 3. Cụm thao tác chuẩn (Điều 21, 23, 25, 29) ----
    const ctrl = h('div', { class: 'gov-ctrl-box' }, card);
    const topRow = h('div', { class: 'gov-ctrl-top' }, ctrl);

    // 3a. Khóa chọn AUTO / MANUAL
    const seg = h('div', { class: 'aux-seg', title: 'Chuyển chế độ TỰ ĐỘNG (PID) ↔ BẰNG TAY (Điều 23)' }, topRow);
    const btnAuto = h('button', { onclick: () => { if (!on(g + '.govAuto')) set(cmd('GOVAUTO'), 1); } }, seg, '⚙ AUTO');
    const btnMan = h('button', { onclick: () => { if (on(g + '.govAuto')) set(cmd('GOVAUTO'), 0); } }, seg, '✋ MANUAL');

    // 3b. Nút MỞ / ĐÓNG Chốt khóa cánh hướng (Locking Pin – Điều 21 Bước 3 & Điều 25 Bước 6)
    const btnPin = h('button', {
      class: 'gov-pin-btn locked',
      title: 'Điều 21 Bước 3 & Điều 25 Bước 6: Phải MỞ chốt khóa trước khi khởi động; chỉ ĐÓNG khi cánh hướng = 0%',
      onclick: () => {
        const locked = on(g + '.gvLockPin') || on(g + '.servoLock');
        ask(locked
          ? `MỞ Chốt khóa cánh hướng (Locking Pin) MF${gn} theo Điều 21 Bước 3?`
          : `ĐÓNG Chốt khóa cánh hướng (Locking Pin) MF${gn} theo Điều 25 Bước 6? (Yêu cầu cánh hướng = 0%)`,
          () => set(cmd('GVLOCKPIN'), locked ? 0 : 1));
      }
    }, topRow, '🔒 CHỐT KHÓA: ĐÓNG');

    // 3c. Nút START / STOP điều tốc & nút ON-CAM
    const btnStartStop = h('button', {
      class: 'btn primary',
      onclick: () => ask(`${on(g + '.pid') ? 'Dừng' : 'Khởi động'} tổ máy ${gn} từ tủ điều tốc?`, () => set(cmd('GOVERNOR')))
    }, topRow, '▶ START');
    const btnCam = h('button', {
      class: 'btn',
      title: 'Bật/tắt phối hợp tự động đường Cam Kaplan (ON-CAM / OFF-CAM)',
      onclick: () => set(cmd('BLADEAUTO'), on(g + '.bladeAuto') ? 0 : 1)
    }, topRow, '↺ Khớp Cam');

    // 3d. Cụm nút nhấn chỉnh tay trực tiếp (Điều 23 – hoạt động khi MANUAL)
    const manPanel = h('div', { class: 'gov-man-panel dim' }, ctrl);
    const manHdr = h('div', { class: 'gov-man-hdr' }, manPanel);
    const manTitle = h('span', {}, manHdr, '✋ CHỈNH TAY TRỰC TIẾP (ĐIỀU 23) — Chuyển sang MANUAL để kích hoạt');
    const manHint = h('span', {}, manHdr, '');

    // Hàng chỉnh tay Cánh hướng (0 – 100%)
    const gvRow = h('div', { class: 'gov-step-row' }, manPanel);
    h('span', { class: 'gov-step-lbl' }, gvRow, 'Cánh hướng (GV):');
    const gvDec = h('div', { class: 'gov-step-btns' }, gvRow);
    const bGvM5 = h('button', { class: 'btn', title: 'Giảm cánh hướng 5% (DEC)', onclick: () => set(cmd('GVSTEP'), -5) }, gvDec, '▼ -5%');
    const bGvM1 = h('button', { class: 'btn', title: 'Giảm cánh hướng 1% (DEC)', onclick: () => set(cmd('GVSTEP'), -1) }, gvDec, '−1%');
    const gvValBox = h('div', { class: 'gov-step-val' }, gvRow, '0,0 %');
    const gvInc = h('div', { class: 'gov-step-btns' }, gvRow);
    const bGvP1 = h('button', { class: 'btn', title: 'Tăng cánh hướng 1% (INC)', onclick: () => set(cmd('GVSTEP'), 1) }, gvInc, '+1%');
    const bGvP5 = h('button', { class: 'btn', title: 'Tăng cánh hướng 5% (INC)', onclick: () => set(cmd('GVSTEP'), 5) }, gvInc, '▲ +5%');

    // Hàng chỉnh tay Cánh xoay BXCT (0 – 100% / -10° ~ +12°)
    const blRow = h('div', { class: 'gov-step-row' }, manPanel);
    h('span', { class: 'gov-step-lbl' }, blRow, 'Cánh BXCT (Kaplan):');
    const blDec = h('div', { class: 'gov-step-btns' }, blRow);
    const bBlM5 = h('button', { class: 'btn', title: 'Giảm góc cánh BXCT 5% (-1,1°)', onclick: () => set(cmd('BLADESTEP'), -5) }, blDec, '▼ -5%');
    const bBlM1 = h('button', { class: 'btn', title: 'Giảm góc cánh BXCT 1% (-0,22°)', onclick: () => set(cmd('BLADESTEP'), -1) }, blDec, '−1%');
    const blValBox = h('div', { class: 'gov-step-val' }, blRow, '0,0 % (-10,0°)');
    const blInc = h('div', { class: 'gov-step-btns' }, blRow);
    const bBlP1 = h('button', { class: 'btn', title: 'Tăng góc cánh BXCT 1% (+0,22°)', onclick: () => set(cmd('BLADESTEP'), 1) }, blInc, '+1%');
    const bBlP5 = h('button', { class: 'btn', title: 'Tăng góc cánh BXCT 5% (+1,1°)', onclick: () => set(cmd('BLADESTEP'), 5) }, blInc, '▲ +5%');

    // Thanh Hạn chế độ mở cánh hướng (Opening Limiter)
    const limRow = h('div', { class: 'gov-lim-row' }, manPanel);
    h('span', { style: 'font-weight:700' }, limRow, 'Hạn chế độ mở GV (Limiter):');
    const limRng = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 100 }, limRow);
    const limTxt = h('b', { style: 'min-width:44px;text-align:right;font-variant-numeric:tabular-nums' }, limRow, '100%');
    let limDragging = false;
    limRng.oninput = () => { limDragging = true; limTxt.textContent = limRng.value + '%'; };
    limRng.onchange = () => { limDragging = false; set(cmd('GVLIMIT'), +limRng.value); };

    // 3e. Nút EMERGENCY STOP viền cảnh báo (Điều 29) + nút Giải trừ bảo vệ khi bị trip
    const estopRow = h('div', { class: 'gov-estop-row' }, ctrl);
    const estopFrame = h('div', { class: 'gov-estop-frame' }, estopRow);
    h('button', {
      class: 'gov-estop',
      onclick: () => ask(`KÍCH HOẠT DỪNG KHẨN CẤP (EMERGENCY STOP) Tổ máy ${gn} tại tủ điều tốc?\nCánh hướng đóng nhanh 0,25/s và cắt tổ máy về trạng thái dừng khẩn cấp (Điều 29).`, () => set(cmd('EMSTOP')))
    }, estopFrame, '🛑 EMERGENCY STOP — DỪNG KHẨN CẤP (ĐIỀU 29)');
    const btnTripRst = h('button', {
      class: 'btn danger hidden',
      style: 'font-weight:800',
      onclick: () => set(cmd('RESET'))
    }, estopRow, '↺ Giải trừ bảo vệ');

    // ---- 4. Bảng tham số cài đặt điều tốc đồng bộ hai chiều PlantConfig & saveSettings() ----
    const cfgBox = h('div', { class: 'gov-cfg-box' }, card);
    const cfgHdr = h('div', { class: 'gov-cfg-hdr' }, cfgBox);
    h('b', {}, cfgHdr, '⚙ Tham số Điều tốc (Đồng bộ trực tiếp PlantConfig.kt)');
    const syncBadge = h('span', { class: 'gov-cfg-sync' }, cfgHdr, '✓ Đã đồng bộ');
    const cfgGrid = h('div', { class: 'gov-cfg-grid' }, cfgBox);
    const fields = [
      { key: 'govKp', label: 'Điều tốc Kp', step: '0.1', min: 0.5, max: 20, scale: 1, dec: 2, def: 1.6 },
      { key: 'govKi', label: 'Điều tốc Ki', step: '0.01', min: 0.05, max: 10, scale: 1, dec: 2, def: 0.27 },
      { key: 'govKd', label: 'Điều tốc Kd', step: '0.05', min: 0, max: 5, scale: 1, dec: 2, def: 0.0 },
      { key: 'govBp', label: 'Độ dốc tĩnh govBp (%)', step: '0.05', min: 0, max: 1.0, scale: 100, dec: 2, def: 0.01 },
      { key: 'powerKp', label: 'Điều chỉnh P – Kp', step: '0.01', min: 0, max: 2, scale: 1, dec: 2, def: 0.05 },
      { key: 'powerKi', label: 'Điều chỉnh P – Ki', step: '0.01', min: 0, max: 2, scale: 1, dec: 2, def: 0.05 },
      { key: 'pRampMWs', label: 'Tốc độ tăng P (MW/s)', step: '0.1', min: 0.1, max: 3, scale: 1, dec: 2, def: 0.8 }
    ];
    const inputs = {};
    let dirty = false;
    fields.forEach(f => {
      const it = h('div', { class: 'gov-cfg-item' }, cfgGrid);
      h('label', {}, it, f.label);
      const inp = h('input', { type: 'number', step: f.step, min: f.min, max: f.max }, it);
      inp.value = (f.def * f.scale).toFixed(f.dec);
      inp.oninput = () => { dirty = true; syncBadge.className = 'gov-cfg-sync dirty'; syncBadge.textContent = '● Chưa lưu'; };
      inputs[f.key] = inp;
    });
    const syncFromState = force => {
      if (!force && dirty) return;
      fields.forEach(f => {
        const inp = inputs[f.key];
        if (!force && document.activeElement === inp) return;
        const raw = S['cfg.' + f.key] !== undefined ? +S['cfg.' + f.key] : f.def;
        inp.value = (raw * f.scale).toFixed(f.dec);
      });
      if (force) {
        dirty = false;
        syncBadge.className = 'gov-cfg-sync';
        syncBadge.textContent = '✓ Đã đồng bộ';
      }
    };
    govCfgSyncers.push(syncFromState);

    const cfgFoot = h('div', { class: 'gov-cfg-ref' }, cfgBox);
    const refTxt = h('span', {}, cfgFoot, 'H = 2,52 s · Mở: 0,10/s · Đóng: 0,125/s (8s) · Sự cố: 0,25/s');
    const cfgBtns = h('div', { class: 'row', style: 'gap:6px' }, cfgFoot);
    h('button', {
      class: 'btn',
      onclick: () => ask('Khôi phục tham số điều tốc chuẩn Đrây H\'Linh 2 (Kp=1,6; Ki=0,27; Kd=0; bp=1,0%; P-Kp=0,05; P-Ki=0,05) và lưu?', () => saveGovCfg({ reset: true }))
    }, cfgBtns, '↺ Mặc định ĐHL2');
    h('button', {
      class: 'btn primary',
      style: 'font-weight:700',
      onclick: () => {
        const payload = {};
        fields.forEach(f => {
          const val = parseFloat(inputs[f.key].value);
          if (isFinite(val)) {
            const clamped = Math.max(f.min, Math.min(f.max, val));
            if (clamped !== val) inputs[f.key].value = clamped.toFixed(f.dec);
            payload[f.key] = clamped / f.scale;
          }
        });
        saveGovCfg(payload);
      }
    }, cfgBtns, '💾 Áp dụng & Lưu');

    // ---- 5. Biểu đồ 1: Phối hợp Cánh hướng – Cánh xoay Kaplan (Cam Curve 2D) ----
    const camCard = h('div', { class: 'gov-chart-card' }, card);
    const camHdr = h('div', { class: 'gov-chart-hdr' }, camCard);
    h('b', {}, camHdr, `📈 Đường đặc tuyến Cam Curve 2D (Kaplan ZZJK508) — Tổ máy ${gn}`);
    const camMeta = h('span', { style: 'font-size:12px;font-weight:700;font-variant-numeric:tabular-nums' }, camHdr, '');
    const camCv = h('canvas', { width: 680, height: 270 }, camCard);
    const camWarn = h('div', { class: 'gov-cam-warn' }, camCard, '');

    // ---- 6. Biểu đồ 2: Đáp ứng quá độ 2 phút (2 trục tung) ----
    const trCard = h('div', { class: 'gov-chart-card' }, card);
    const trHdr = h('div', { class: 'gov-chart-hdr' }, trCard);
    h('b', {}, trHdr, `📉 Đồ thị đáp ứng quá độ 2 phút (2 trục tung) — Tổ máy ${gn}`);
    const trLegend = h('div', { class: 'gov-legend' }, trCard);
    const trCv = h('canvas', { width: 680, height: 265 }, trCard);

    // ---- Cập nhật thời gian thực ----
    const manBtns = [bGvM5, bGvM1, bGvP1, bGvP5, bBlM5, bBlM1, bBlP1, bBlP5];
    U(() => {
      const govAuto = S[g + '.govAuto'] === undefined ? true : on(g + '.govAuto');
      const bladeAuto = S[g + '.bladeAuto'] === undefined ? true : on(g + '.bladeAuto');
      const locked = on(g + '.gvLockPin') || on(g + '.servoLock');
      const rawGov = String(S[g + '.gov'] || 'OFF').toUpperCase();
      const dispMode = rawGov === 'EMERGENCY' ? 'EMERGENCY' : (!govAuto ? 'MANUAL' : rawGov);

      // Header & Mode pills
      seqSub.textContent = S[g + '.seq'] || 'Dừng dự phòng';
      modePill.textContent = dispMode;
      modePill.className = 'gov-mode-pill ' + (
        dispMode === 'EMERGENCY' ? 'm-emerg' :
        dispMode === 'MANUAL' ? 'm-manual' :
        dispMode === 'POWER' ? 'm-power' :
        dispMode === 'SPEED' ? 'm-speed' :
        dispMode === 'START' ? 'm-start' : 'm-off'
      );
      camPill.textContent = bladeAuto ? 'ON-CAM' : 'OFF-CAM (TAY)';
      camPill.className = 'gov-mode-pill ' + (bladeAuto ? 'm-power' : 'm-manual');

      // Telemetry KPIs
      const freq = n(g + '.freq'), spHz = n(g + '.SP') || 50, rpm = n(g + '.speed');
      const gvPct = n(g + '.GV'), gvLim = S[g + '.gvLimit'] !== undefined ? n(g + '.gvLimit') : 100;
      const bladePct = n(g + '.blade');
      const bladeDeg = S[g + '.bladeDeg'] !== undefined ? n(g + '.bladeDeg') : (-10 + bladePct * 0.22);
      const bladeCamDeg = S[g + '.bladeCamDeg'] !== undefined ? n(g + '.bladeCamDeg') : (-10 + kaplanCamNorm(gvPct / 100, n(g + '.head') || 18.5) * 22);
      const bladeDev = S[g + '.bladeDevDeg'] !== undefined ? n(g + '.bladeDevDeg') : (bladeDeg - bladeCamDeg);
      const offCamEff = S[g + '.offCamEff'] !== undefined ? n(g + '.offCamEff') : 100;
      const vibMm = n(g + '.shaftVib');
      const pmMW = n(g + '.Pm'), pSetMW = S[g + '.Pset'] !== undefined ? n(g + '.Pset') : n(g + '.P'), peMW = n(g + '.Pload');
      const oilMPa = S[g + '.oilMPa'] !== undefined ? n(g + '.oilMPa') : (n(g + '.oilPress') / 25);

      kMode.val.textContent = dispMode;
      kMode.sub.textContent = govAuto ? `Tự động PID (${rawGov})` : 'Chỉnh tay trực tiếp (Đ.23)';
      kMode.el.className = 'gov-kpi' + (dispMode === 'EMERGENCY' ? ' crit' : (!govAuto ? ' warn' : ''));

      kSpd.val.textContent = `${fx(rpm, 1)} v/ph · ${fx(freq, 2)} Hz`;
      kSpd.sub.textContent = `Đặt: ${fx(spHz, 2)} Hz · ${fx(n(g + '.overspeedPct') || (rpm / 214.3 * 100), 1)}% nđm`;
      const overSpd = rpm > 214.3 * 1.10;
      const outBand = on(g + '.running') && rpm > 180 && Math.abs(freq - 50) > 0.5;
      kSpd.el.className = 'gov-kpi' + (overSpd ? ' crit' : (outBand ? ' warn' : ''));

      kGv.val.textContent = `${fx(gvPct, 1)} %`;
      kGv.sub.textContent = locked ? '🔒 KHÓA CỨNG 0% (Locking Pin)' : `Hạn chế: ${fx(gvLim, 0)}% · Q=${fx(n(g + '.flow'), 1)} m³/s`;
      kGv.el.className = 'gov-kpi' + (locked ? ' warn' : '');
      gvFill.style.width = Math.max(0, Math.min(100, gvPct)) + '%';
      gvLimMark.style.left = Math.max(0, Math.min(100, gvLim)) + '%';

      const offCamBad = Math.abs(bladeDev) > 2.0 && (gvPct > 2 || on(g + '.running'));
      kBlade.val.textContent = `${fx(bladePct, 1)} % · ${bladeDeg >= 0 ? '+' : ''}${fx(bladeDeg, 1)}°`;
      kBlade.sub.textContent = `Cam: ${bladeCamDeg >= 0 ? '+' : ''}${fx(bladeCamDeg, 1)}° · Δ=${bladeDev >= 0 ? '+' : ''}${fx(bladeDev, 1)}°`;
      kBlade.el.className = 'gov-kpi' + (Math.abs(bladeDev) > 4.5 && on(g + '.running') ? ' crit' : (offCamBad ? ' warn' : ''));

      kPow.val.textContent = `${fx(pmMW, 2)} / ${fx(pSetMW, 2)} MW`;
      kPow.sub.textContent = `Pđiện: ${fx(peMW, 2)} MW · H=${fx(n(g + '.head') || n('HeadHigh') || 18.5, 1)} m`;

      kOil.val.textContent = `${fx(oilMPa, 2)} MPa`;
      kOil.sub.textContent = `Bơm dầu: ${on(g + '.oilPump1') || on(g + '.oilPump2') ? 'ĐANG BƠM' : 'Dự phòng'} (3,7–4,0)`;
      kOil.el.className = 'gov-kpi' + (oilMPa < 3.3 ? ' crit' : (oilMPa < 3.55 ? ' warn' : ''));

      // Control buttons state
      btnAuto.className = govAuto ? 'act-auto' : '';
      btnMan.className = !govAuto ? 'act-man' : '';
      btnPin.className = 'gov-pin-btn ' + (locked ? 'locked' : 'unlocked');
      btnPin.textContent = locked ? '🔒 CHỐT KHÓA: ĐANG ĐÓNG (0%)' : '🔓 CHỐT KHÓA: ĐÃ MỞ';

      const pidOn = on(g + '.pid');
      btnStartStop.textContent = pidOn ? '⏹ STOP' : '▶ START';
      btnStartStop.className = 'btn ' + (pidOn ? 'danger' : 'primary');
      btnCam.className = 'btn ' + (bladeAuto ? '' : 'on');
      btnCam.textContent = bladeAuto ? '✓ Đang khớp Cam' : '↺ Khớp đường Cam';
      btnTripRst.classList.toggle('hidden', !on(g + '.tripped'));

      // Manual panel active/dim
      manPanel.className = 'gov-man-panel ' + (!govAuto ? 'active' : 'dim');
      manTitle.textContent = !govAuto
        ? '✋ CHỈNH TAY TRỰC TIẾP ĐANG HOẠT ĐỘNG (MANUAL – ĐIỀU 23)'
        : '✋ CHỈNH TAY TRỰC TIẾP (ĐIỀU 23) — Chuyển sang MANUAL để kích hoạt';
      manHint.textContent = locked ? '⚠ Đang khóa chốt GV (0%)' : (!govAuto ? `Rung trục: ${fx(vibMm, 2)} mm` : '');
      manBtns.forEach(bt => { bt.disabled = govAuto; });
      if (!govAuto && locked) { bGvP1.disabled = true; bGvP5.disabled = true; }
      const gvMan = S[g + '.gvManual'] !== undefined ? n(g + '.gvManual') : gvPct;
      const blManDeg = S[g + '.bladeManual'] !== undefined ? n(g + '.bladeManual') : bladeDeg;
      const blManPct = Math.max(0, Math.min(100, (blManDeg + 10) / 22 * 100));
      gvValBox.textContent = !govAuto ? `Đặt ${fx(gvMan, 1)}% · Thực ${fx(gvPct, 1)}%` : `Thực ${fx(gvPct, 1)} %`;
      blValBox.textContent = !bladeAuto
        ? `Đặt ${fx(blManPct, 0)}% (${blManDeg >= 0 ? '+' : ''}${fx(blManDeg, 1)}°) · Thực ${bladeDeg >= 0 ? '+' : ''}${fx(bladeDeg, 1)}°`
        : `${fx(bladePct, 1)}% (${bladeDeg >= 0 ? '+' : ''}${fx(bladeDeg, 1)}°)`;
      if (!limDragging) {
        limRng.value = Math.round(gvLim);
        limTxt.textContent = Math.round(gvLim) + '%';
      }

      // Sync PlantConfig inputs & reference strip
      syncFromState(false);
      const cfgVal = (k, def) => (S[k] !== undefined ? Number(S[k]) : def);
      refTxt.textContent = `H = ${fx(cfgVal('cfg.inertiaH', 2.52), 2)} s · Mở: ${fx(cfgVal('cfg.gvOpenRate', 0.10), 2)}/s · Đóng: ${fx(cfgVal('cfg.gvCloseRate', 0.125), 3)}/s · Sự cố: ${fx(cfgVal('cfg.gvEmergencyRate', 0.25), 2)}/s`;

      // Cam Curve 2D + Off-cam alert
      camMeta.innerHTML = `H = <b>${fx(n(g + '.head') || 18.5, 1)} m</b> · η<sub>cam</sub> = <b style="color:${offCamEff < 95 ? '#e8590c' : '#2b8a3e'}">${fx(offCamEff, 1)}%</b> · Rung = <b>${fx(vibMm, 2)} mm</b>`;
      drawCamCurve(camCv, gn);
      if (Math.abs(bladeDev) > 2.0) {
        camWarn.classList.add('show');
        camWarn.textContent = `⚠ CẢNH BÁO LỆCH ĐƯỜNG CAM KAPLAN (OFF-CAM): Độ lệch Δβ = ${bladeDev >= 0 ? '+' : ''}${fx(bladeDev, 1)}° · Hiệu suất thủy lực giảm còn ${fx(offCamEff, 1)}% · Rung trục tăng ${fx(vibMm, 2)} mm! Hãy chỉnh cánh BXCT bám đường Cam hoặc bấm "Khớp đường Cam".`;
      } else {
        camWarn.classList.remove('show');
      }

      // Dual-Axis 2-min Transient Chart + Live Legend
      trLegend.innerHTML =
        `<span class="gov-leg-item"><i class="gov-leg-sw" style="background:#e03131"></i> f thực: <b>${fx(freq, 2)} Hz</b></span>` +
        `<span class="gov-leg-item"><i class="gov-leg-sw dash"></i> f đặt: <b>${fx(spHz, 2)} Hz</b></span>` +
        `<span class="gov-leg-item"><i class="gov-leg-sw" style="background:#2b8a3e"></i> Cánh hướng: <b>${fx(gvPct, 1)}%</b></span>` +
        `<span class="gov-leg-item"><i class="gov-leg-sw" style="background:#e8590c"></i> Cánh BXCT: <b>${fx(bladePct, 1)}%</b> (${bladeDeg >= 0 ? '+' : ''}${fx(bladeDeg, 1)}°)</span>`;
      drawGovTrend(trCv, trendBuf[gn], gn);
    });
  }
});

/** Công thức đường phối hợp Cam Curve chuẩn hóa khớp 100% HydroUnit.camBladeNorm() */
function kaplanCamNorm(gvPu, headM) {
  const hRef = Math.max(5.0, +(S['cfg.ratedHeadM'] || 18.5));
  const hCur = headM > 1 ? headM : hRef;
  const headCorr = Math.max(-0.08, Math.min(0.08, ((hRef - hCur) / hRef) * 0.12));
  return Math.max(0, Math.min(1, (gvPu - 0.15) / 0.75 + headCorr));
}

/** Biểu đồ 1: Phối hợp Cánh hướng (0–100%) – Cánh xoay BXCT (0–100% / -10° ~ +12°) */
function drawCamCurve(cv, gn) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height;
  const dk = document.body.classList.contains('dark');
  x.clearRect(0, 0, W, H);
  x.fillStyle = dk ? '#0b141d' : '#fbfcfd';
  x.fillRect(0, 0, W, H);

  const g = 'G' + gn;
  const gvPct = Math.max(0, Math.min(100, n(g + '.GV')));
  const bladePct = Math.max(0, Math.min(100, n(g + '.blade')));
  const headM = n(g + '.head') || +(S['cfg.ratedHeadM'] || 18.5);
  const bladeDeg = S[g + '.bladeDeg'] !== undefined ? n(g + '.bladeDeg') : (-10 + bladePct * 0.22);
  const camPct = kaplanCamNorm(gvPct / 100, headM) * 100;
  const bladeDev = S[g + '.bladeDevDeg'] !== undefined ? n(g + '.bladeDevDeg') : (bladeDeg - (-10 + camPct * 0.22));

  const padL = 52, padR = 56, padT = 22, padB = 38;
  const pw = W - padL - padR, ph = H - padT - padB;
  const mx = v => padL + (v / 100) * pw;
  const my = v => padT + ph - (v / 100) * ph;

  // Grid
  x.strokeStyle = dk ? '#1c2b3a' : '#e9ecef'; x.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const gx = mx(i * 10), gy = my(i * 10);
    x.beginPath(); x.moveTo(gx, padT); x.lineTo(gx, padT + ph); x.stroke();
    x.beginPath(); x.moveTo(padL, gy); x.lineTo(padL + pw, gy); x.stroke();
  }

  // Optimal tolerance band (±7% ~ ±1.5°) around Cam Curve
  x.beginPath();
  for (let i = 0; i <= 100; i += 2) {
    const yHi = Math.min(100, kaplanCamNorm(i / 100, headM) * 100 + 7);
    i === 0 ? x.moveTo(mx(i), my(yHi)) : x.lineTo(mx(i), my(yHi));
  }
  for (let i = 100; i >= 0; i -= 2) {
    const yLo = Math.max(0, kaplanCamNorm(i / 100, headM) * 100 - 7);
    x.lineTo(mx(i), my(yLo));
  }
  x.closePath();
  x.fillStyle = dk ? 'rgba(43,138,62,0.22)' : 'rgba(64,192,87,0.16)';
  x.fill();

  // Optimal Cam Curve line
  x.strokeStyle = dk ? '#40c057' : '#2b8a3e';
  x.lineWidth = 2.8;
  x.beginPath();
  for (let i = 0; i <= 100; i += 2) {
    const cy = kaplanCamNorm(i / 100, headM) * 100;
    i === 0 ? x.moveTo(mx(i), my(cy)) : x.lineTo(mx(i), my(cy));
  }
  x.stroke();

  // Label along curve
  x.fillStyle = dk ? '#69db7c' : '#2b8a3e';
  x.font = 'bold 11.5px sans-serif';
  x.textAlign = 'left';
  x.fillText(`Đường Cam tối ưu (H=${fx(headM, 1)} m)`, mx(36), my(kaplanCamNorm(0.36, headM) * 100) - 12);

  // Axes borders & ticks
  x.strokeStyle = dk ? '#495057' : '#868e96'; x.lineWidth = 1.2;
  x.strokeRect(padL, padT, pw, ph);
  x.fillStyle = dk ? '#9fb0c0' : '#495057'; x.font = '11px sans-serif';
  for (let i = 0; i <= 5; i++) {
    const v = i * 20;
    x.textAlign = 'center';
    x.fillText(v + '%', mx(v), padT + ph + 15);
    x.textAlign = 'right';
    x.fillText(v + '%', padL - 6, my(v) + 4);
    const deg = -10 + v * 0.22;
    x.textAlign = 'left';
    x.fillText((deg >= 0 ? '+' : '') + deg.toFixed(0) + '°', padL + pw + 6, my(v) + 4);
  }
  // Axis titles
  x.fillStyle = dk ? '#cfd8e0' : '#2c3e50'; x.font = 'bold 11.5px sans-serif';
  x.textAlign = 'center';
  x.fillText('Độ mở cánh hướng GV (%)', padL + pw / 2, H - 6);
  x.save(); x.translate(14, padT + ph / 2); x.rotate(-Math.PI / 2);
  x.fillText('Cánh BXCT (%)', 0, 0); x.restore();
  x.save(); x.translate(W - 11, padT + ph / 2); x.rotate(Math.PI / 2);
  x.fillText('Góc cánh (-10° ~ +12°)', 0, 0); x.restore();

  // Crosshair & off-cam deviation line
  const px = mx(gvPct), py = my(bladePct), pyCam = my(camPct);
  x.save();
  x.setLineDash([4, 4]);
  x.strokeStyle = dk ? 'rgba(148,163,184,0.55)' : 'rgba(73,80,87,0.45)';
  x.lineWidth = 1;
  x.beginPath(); x.moveTo(px, padT + ph); x.lineTo(px, py); x.lineTo(padL, py); x.stroke();
  if (Math.abs(bladeDev) > 0.8) {
    x.strokeStyle = '#f76707'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px, pyCam); x.stroke();
    // Cam target hollow circle
    x.setLineDash([]);
    x.fillStyle = dk ? '#0b141d' : '#fff';
    x.strokeStyle = '#2b8a3e'; x.lineWidth = 2;
    x.beginPath(); x.arc(px, pyCam, 4.5, 0, Math.PI * 2); x.fill(); x.stroke();
  }
  x.restore();

  // Operating point red dot with halo
  const offCam = Math.abs(bladeDev) > 2.0;
  x.fillStyle = offCam ? 'rgba(224,49,49,0.28)' : 'rgba(224,49,49,0.18)';
  x.beginPath(); x.arc(px, py, offCam ? 13 : 10, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#e03131';
  x.strokeStyle = '#fff'; x.lineWidth = 2;
  x.beginPath(); x.arc(px, py, 6, 0, Math.PI * 2); x.fill(); x.stroke();

  // Callout pill near operating point
  const tagTxt = `(${fx(gvPct, 1)}%, ${bladeDeg >= 0 ? '+' : ''}${fx(bladeDeg, 1)}°)` + (offCam ? ` Δ${bladeDev >= 0 ? '+' : ''}${fx(bladeDev, 1)}°` : ' ON-CAM');
  x.font = 'bold 11px sans-serif';
  const tw = x.measureText(tagTxt).width + 12;
  const tx = px + 12 + tw > padL + pw ? px - tw - 12 : px + 12;
  const ty = Math.max(padT + 4, Math.min(padT + ph - 22, py - 10));
  x.fillStyle = offCam ? (dk ? 'rgba(153,27,27,0.92)' : 'rgba(201,42,42,0.92)') : (dk ? 'rgba(15,23,42,0.9)' : 'rgba(24,100,171,0.9)');
  x.beginPath(); x.roundRect ? x.roundRect(tx, ty, tw, 20, 5) : x.rect(tx, ty, tw, 20); x.fill();
  x.fillStyle = '#fff'; x.textAlign = 'left';
  x.fillText(tagTxt, tx + 6, ty + 14);
}

/** Biểu đồ 2: Đáp ứng quá độ 2 phút (Trục trái 48,0–52,0 Hz · Trục phải 0–100%) */
function drawGovTrend(cv, buf, gn) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height;
  const dk = document.body.classList.contains('dark');
  x.clearRect(0, 0, W, H);
  x.fillStyle = dk ? '#0b141d' : '#fbfcfd';
  x.fillRect(0, 0, W, H);

  const padL = 56, padR = 50, padT = 22, padB = 34;
  const pw = W - padL - padR, ph = H - padT - padB;
  const fMin = 48.0, fMax = 52.0;
  const yf = f => padT + ph - ((f - fMin) / (fMax - fMin)) * ph;
  const yp = p => padT + ph - (Math.max(0, Math.min(100, p)) / 100) * ph;
  const xi = i => padL + (i / 239) * pw;

  // Shaded normal operating band 50 ± 0.5 Hz (49.5 – 50.5 Hz, Điều 13)
  const yHi = yf(50.5), yLo = yf(49.5), y50 = yf(50.0);
  x.fillStyle = dk ? 'rgba(43,138,62,0.18)' : 'rgba(64,192,87,0.13)';
  x.fillRect(padL, yHi, pw, yLo - yHi);

  // Horizontal grid (every 0.5 Hz / 12.5% or 25% aligned: 8 steps -> 48.0, 48.5, 49.0, 49.5, 50.0, 50.5, 51.0, 51.5, 52.0)
  for (let s = 0; s <= 8; s++) {
    const f = fMin + s * 0.5;
    const gy = yf(f);
    x.strokeStyle = dk ? '#1c2b3a' : '#e9ecef';
    x.lineWidth = (f === 50.0) ? 1.4 : 1;
    x.beginPath(); x.moveTo(padL, gy); x.lineTo(padL + pw, gy); x.stroke();
  }
  // Vertical grid (every 30s = 60 samples)
  for (let s = 0; s <= 4; s++) {
    const gx = padL + (s / 4) * pw;
    x.strokeStyle = dk ? '#1c2b3a' : '#e9ecef'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(gx, padT); x.lineTo(gx, padT + ph); x.stroke();
  }

  // Dashed limit lines for 50 ± 0.5 Hz (Điều 13)
  x.save();
  x.setLineDash([5, 4]);
  x.strokeStyle = dk ? '#51cf66' : '#2b8a3e';
  x.lineWidth = 1.2;
  x.beginPath(); x.moveTo(padL, yHi); x.lineTo(padL + pw, yHi); x.moveTo(padL, yLo); x.lineTo(padL + pw, yLo); x.stroke();
  x.restore();
  x.fillStyle = dk ? '#69db7c' : '#2b8a3e';
  x.font = 'bold 10.5px sans-serif'; x.textAlign = 'right';
  x.fillText('50 ± 0,5 Hz (Điều 13)', padL + pw - 6, yHi - 4);

  // Plot curves clipped to plot box
  x.save();
  x.beginPath(); x.rect(padL, padT, pw, ph); x.clip();

  const offset = 240 - buf.length;
  // Right axis: GV (%) green
  x.strokeStyle = dk ? '#51cf66' : '#2b8a3e'; x.lineWidth = 2;
  x.beginPath();
  buf.forEach((pt, idx) => {
    const px = xi(offset + idx), py = yp(pt[2] || 0);
    idx === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  });
  x.stroke();

  // Right axis: Blade BXCT (%) orange
  x.strokeStyle = dk ? '#ffa94d' : '#e8590c'; x.lineWidth = 2;
  x.beginPath();
  buf.forEach((pt, idx) => {
    const px = xi(offset + idx), py = yp(pt[3] || 0);
    idx === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  });
  x.stroke();

  // Left axis: Setpoint frequency f_set (Hz) blue dashed
  x.save();
  x.setLineDash([6, 4]);
  x.strokeStyle = dk ? '#4dabf7' : '#1971c2'; x.lineWidth = 2;
  x.beginPath();
  buf.forEach((pt, idx) => {
    const fv = Math.max(fMin, Math.min(fMax, pt[1] || 50));
    const px = xi(offset + idx), py = yf(fv);
    idx === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  });
  x.stroke();
  x.restore();

  // Left axis: Actual frequency f (Hz) bold red (skip segments when unit stopped < 45 Hz)
  x.strokeStyle = dk ? '#ff6b6b' : '#e03131'; x.lineWidth = 2.6;
  x.beginPath();
  let penDown = false;
  buf.forEach((pt, idx) => {
    const rawF = pt[0] || 0;
    if (rawF < 45.0) { penDown = false; return; }
    const clampedF = Math.max(fMin, Math.min(fMax, rawF));
    const px = xi(offset + idx), py = yf(clampedF);
    if (!penDown) { x.moveTo(px, py); penDown = true; } else x.lineTo(px, py);
  });
  x.stroke();
  x.restore();

  // Axes borders & labels
  x.strokeStyle = dk ? '#495057' : '#868e96'; x.lineWidth = 1.2;
  x.strokeRect(padL, padT, pw, ph);

  // Left Y labels (48.0 – 52.0 Hz)
  x.font = '11px sans-serif'; x.textAlign = 'right';
  for (let s = 0; s <= 4; s++) {
    const f = fMin + s * 1.0;
    x.fillStyle = (f === 50.0) ? (dk ? '#ff8787' : '#c92a2a') : (dk ? '#9fb0c0' : '#495057');
    x.fillText(f.toFixed(1), padL - 6, yf(f) + 4);
  }
  // Right Y labels (0 – 100%)
  x.textAlign = 'left'; x.fillStyle = dk ? '#69db7c' : '#2b8a3e';
  for (let s = 0; s <= 4; s++) {
    const p = s * 25;
    x.fillText(p + '%', padL + pw + 6, yp(p) + 4);
  }
  // X labels (-120s .. 0s)
  x.textAlign = 'center'; x.fillStyle = dk ? '#9fb0c0' : '#495057';
  const tLbls = ['-120s', '-90s', '-60s', '-30s', '0s'];
  tLbls.forEach((tl, i) => x.fillText(tl, padL + (i / 4) * pw, padT + ph + 15));

  // Axis Titles
  x.font = 'bold 11px sans-serif';
  x.fillStyle = dk ? '#ff8787' : '#c92a2a'; x.textAlign = 'left';
  x.fillText('Tần số (Hz)', 4, 14);
  x.fillStyle = dk ? '#69db7c' : '#2b8a3e'; x.textAlign = 'right';
  x.fillText('Độ mở (%)', W - 4, 14);

  // Out-of-range frequency indicator pill when unit is stopped/ramping or overspeed
  const curF = n(`G${gn}.freq`);
  if (curF < 48.0 || curF > 52.0) {
    const msg = curF < 48.0 ? `f hiện tại: ${fx(curF, 2)} Hz (dưới thang 48,0 Hz)` : `⚠ VƯỢT TẦN SỐ: ${fx(curF, 2)} Hz (> 52,0 Hz)`;
    x.font = 'bold 11px sans-serif';
    const mw = x.measureText(msg).width + 14;
    x.fillStyle = curF > 52.0 ? 'rgba(201,42,42,0.92)' : (dk ? 'rgba(30,41,59,0.88)' : 'rgba(73,80,87,0.85)');
    x.beginPath(); x.roundRect ? x.roundRect(padL + 8, padT + ph - 24, mw, 19, 4) : x.rect(padL + 8, padT + ph - 24, mw, 19); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'left';
    x.fillText(msg, padL + 15, padT + ph - 11);
  }
}

// ================================================================== TRANG: HỆ THỐNG PHỤ (NƯỚC – DẦU HYZ – KHÍ NÉN – Ổ TRỤC)
function auxPage(gn) {
  return root => {
    const g = 'G' + gn, k = s => `GEN${gn}.${s}`;
    const pw = () => n('V400') > 0.3;
    const isAuxAuto = () => S[g + '.auxAuto'] === undefined ? true : on(g + '.auxAuto');

    // Thanh chuyển chế độ phụ trợ TỰ ĐỘNG (AUTO) / BẰNG TAY (MANUAL) + Cảnh báo mất lưu lượng CW
    const modeBar = h('div', { class: 'aux-mode-bar' }, root);
    const ml = h('div', { class: 'aux-mode-left' }, modeBar);
    h('span', { class: 'aux-mode-title' }, ml, `PHỤ TRỢ MF${gn}:`);
    const seg = h('div', { class: 'aux-seg' }, ml);
    const btnAuto = h('button', { onclick: () => { if (!isAuxAuto()) set(k('AUXAUTO'), 1); } }, seg, '⚙ TỰ ĐỘNG (AUTO)');
    const btnMan = h('button', { onclick: () => { if (isAuxAuto()) set(k('AUXAUTO'), 0); } }, seg, '✋ BẰNG TAY (MANUAL)');
    const modeDesc = h('span', { class: 'aux-mode-desc' }, ml, '');
    const cwLossBar = h('div', { class: 'aux-cw-alarm' }, modeBar, '');

    const p = svgRoot(root, 1600, 860);
    txt(p, 800, 34, `TỔ MÁY ${gn} – HỆ THỐNG NƯỚC KỸ THUẬT, DẦU HYZ, KHÍ NÉN & Ổ TRỤC (ĐRÂY H'LINH 2)`, 'ttl', 'middle');

    // =================== 1. NƯỚC KỸ THUẬT / LÀM MÁT (CW – Điều 12 & 36) ===================
    el('rect', { x: 20, y: 54, width: 510, height: 656, rx: 12, fill: '#f8f9fa', stroke: '#dee2e6' }, p);
    txt(p, 275, 80, 'NƯỚC KỸ THUẬT / LÀM MÁT (CW – ĐIỀU 12 & 36)', 'lblb', 'middle');

    const cwPump1 = () => on(g + '.waterPump1') && pw();
    const cwPump2 = () => on(g + '.waterPump2') && pw();
    const cwAnyPump = () => cwPump1() || cwPump2();
    const cwFlowOn = () => on(g + '.cwValve') && cwAnyPump();
    const getCwMPa = () => S[g + '.cwMPa'] !== undefined ? n(g + '.cwMPa') : (cwFlowOn() ? n(g + '.cwPress') * 0.32 / 100 : 0);
    const getCwPreMPa = () => S[g + '.cwPreMPa'] !== undefined ? n(g + '.cwPreMPa') : (cwAnyPump() ? (on(g + '.cwValve') ? 0.34 : 0.48) : 0);
    const getCwFlowM3h = () => S[g + '.cwFlow'] !== undefined ? n(g + '.cwFlow') * 105 : (cwFlowOn() ? Math.max(12, (getCwMPa() / 0.32) * 105) : 0);

    // Đường ống hút nối trực tiếp từ đáy BỂ NƯỚC vào cửa hút của Bơm 1 và Bơm 2
    pipe(p, [[432, 656], [432, 684], [96, 684], [96, 616]], cwAnyPump, '#339af0', 9);
    pipe(p, [[196, 684], [196, 616]], cwPump2, '#339af0', 9);
    // Đoạn 1: Từ cửa đẩy Bơm 1 & Bơm 2 đến TRƯỚC Van điện cwValve (có áp chặn ~0,48 MPa khi bơm chạy mà van đóng!)
    pipe(p, [[96, 564], [96, 468], [268, 468], [268, 424]], cwAnyPump, '#228be6', 10);
    pipe(p, [[196, 564], [196, 512], [96, 512]], cwPump2, '#228be6', 10);
    // Đoạn 2: Từ SAU Van điện cwValve đi tiếp tới các bộ làm mát tổ máy (chỉ chảy khi van MỞ)
    pipe(p, [[268, 396], [268, 304], [505, 304]], cwFlowOn, '#4dabf7', 10);
    txt(p, 498, 292, '→ Làm mát MF & Ổ trục', 'lbl', 'end').setAttribute('font-size', '11.5');

    // Ô hiển thị áp lực TRƯỚC van điện CW (tách biệt với áp lực SAU van cấp cho tổ máy)
    const preVBox = el('rect', { x: 40, y: 422, width: 176, height: 38, rx: 7, fill: '#e7f5ff', stroke: '#339af0', 'stroke-width': 1.5 }, p);
    const preVVal = txt(p, 128, 438, '', 'lblb', 'middle'); preVVal.setAttribute('font-size', '11.5');
    const preVTag = txt(p, 128, 454, '', 'lblb', 'middle'); preVTag.setAttribute('font-size', '10.5');
    U(() => {
      const auto = isAuxAuto();
      btnAuto.className = auto ? 'act-auto' : '';
      btnMan.className = !auto ? 'act-man' : '';
      modeDesc.textContent = auto
        ? 'TỰ ĐỘNG: Hệ thống tự điều khiển bơm dầu HYZ, bơm nắp TB & nước làm mát theo ngưỡng vận hành.'
        : 'BẰNG TAY: Tự do bật/tắt bơm & đóng/mở van điện độc lập khi có nguồn tự dùng 0,4 kV (V400 > 300 V).';

      const preP = getCwPreMPa(), postP = getCwMPa(), fl = getCwFlowM3h();
      const deadHead = cwAnyPump() && !on(g + '.cwValve');
      const lossWhileRun = on(g + '.running') && fl < 10;
      preVVal.textContent = `P trước van: ${fx(preP, 2)} MPa`;
      if (deadHead) {
        preVBox.setAttribute('fill', '#fff4e6'); preVBox.setAttribute('stroke', '#e8590c');
        preVVal.setAttribute('fill', '#c92a2a');
        preVTag.textContent = '⚠ ÁP CHẶN TRƯỚC VAN!'; preVTag.setAttribute('fill', '#e8590c');
      } else if (cwFlowOn()) {
        preVBox.setAttribute('fill', '#e7f5ff'); preVBox.setAttribute('stroke', '#1971c2');
        preVVal.setAttribute('fill', '#1864ab');
        preVTag.textContent = 'Đang cấp nước KT'; preVTag.setAttribute('fill', '#1971c2');
      } else {
        preVBox.setAttribute('fill', '#f1f3f5'); preVBox.setAttribute('stroke', '#adb5bd');
        preVVal.setAttribute('fill', '#495057');
        preVTag.textContent = 'Bơm dừng'; preVTag.setAttribute('fill', '#868e96');
      }
      if (deadHead || lossWhileRun) {
        cwLossBar.classList.add('show');
        cwLossBar.innerHTML = `🚨 CẢNH BÁO MẤT LƯU LƯỢNG NƯỚC LÀM MÁT CW MF${gn}! ` +
          (deadHead ? `Bơm đang chạy nhưng Van điện CW đang ĐÓNG · P trước van = <b>${fx(preP, 2)} MPa</b> · P sau van = <b>${fx(postP, 2)} MPa</b>` : `Tổ máy đang vận hành nhưng mất nước CW · P sau van = <b>${fx(postP, 2)} MPa</b>`) +
          ` · Lưu lượng = <b>${fx(fl, 0)} m³/h</b> · T dầu ổ đỡ = <b>${fx(n(g + '.thrustOil') || n(g + '.thrust'), 1)} °C</b> (Báo 50°C / Cắt 55°C)`;
      } else {
        cwLossBar.classList.remove('show');
      }
    });

    pump(p, 96, 590, g + '.waterPump1', 'Bơm CW 1', 24);
    pump(p, 196, 590, g + '.waterPump2', 'Bơm CW 2', 24);
    valve(p, 268, 410, g + '.cwValve', 'Van điện CW', true, true);
    // Nhãn chữ MỞ / ĐÓNG rõ ràng ngay cạnh Van điện cwValve
    const cwVBox = el('rect', { x: 290, y: 396, width: 58, height: 24, rx: 6, stroke: '#333', 'stroke-width': 1.2 }, p);
    const cwVTxt = txt(p, 319, 412, '', 'lblb', 'middle'); cwVTxt.setAttribute('font-size', '12'); cwVTxt.setAttribute('fill', '#fff');
    U(() => {
      const op = on(g + '.cwValve');
      cwVBox.setAttribute('fill', op ? '#2b8a3e' : '#c92a2a');
      cwVTxt.textContent = op ? 'MỞ' : 'ĐÓNG';
    });

    tank(p, 368, 488, 128, 168, 'BỂ NƯỚC', () => n(g + '.cwLevel'), '#74c0fc');
    // 3 Đồng hồ nước kỹ thuật: Áp lực SAU van (0-0.6 MPa), Lưu lượng (m³/h), Nhiệt độ (cảnh báo > 30°C)
    gauge(p, 108, 178, 52, 0.6, 'P sau van (cấp TM)', getCwMPa, 'MPa', 0.8, {
      dec: 2, tickDec: 1, ticks: 6,
      zones: [[0, 0.15 / 0.6, '#e03131'], [0.15 / 0.6, 0.20 / 0.6, '#f59f00'], [0.20 / 0.6, 0.45 / 0.6, '#2f9e44'], [0.45 / 0.6, 1, '#e03131']],
      alarmFn: v => (cwAnyPump() || on(g + '.running')) && v < 0.15, subText: 'đm 0,32 · 0 khi van đóng'
    });
    gauge(p, 276, 178, 52, 150, 'Lưu lượng CW', getCwFlowM3h, 'm³/h', 0.85, {
      dec: 0, ticks: 6,
      zones: [[0, 0.05, '#868e96'], [0.05, 0.85, '#2f9e44'], [0.85, 1, '#e03131']],
      alarmFn: v => (cwAnyPump() || on(g + '.running')) && v < 10, subText: '0 khi van ĐÓNG'
    });
    gauge(p, 444, 178, 52, 50, 'Nhiệt độ nước', () => n(g + '.cwTemp'), '°C', 0.6, {
      dec: 1, ticks: 10,
      zones: [[0, 30 / 50, '#2f9e44'], [30 / 50, 1, '#e03131']],
      alarmFn: v => v > 30, subText: 'Báo > 30 °C (Đ.12)'
    });
    const cwAlmTxt = txt(p, 444, 276, '', 'lblb', 'middle'); cwAlmTxt.setAttribute('font-size', '11');
    U(() => {
      const hot = n(g + '.cwTemp') > 30;
      cwAlmTxt.textContent = hot ? '⚠ NƯỚC NÓNG > 30°C!' : '';
      cwAlmTxt.setAttribute('fill', '#e03131');
    });

    // =================== 2. DẦU ÁP LỰC ĐIỀU TỐC (HYZ – Mục 1.3.3) ===================
    el('rect', { x: 544, y: 54, width: 512, height: 656, rx: 12, fill: '#f8f9fa', stroke: '#dee2e6' }, p);
    txt(p, 800, 80, 'DẦU ÁP LỰC ĐIỀU TỐC (HYZ 2,5 m³ – MỤC 1.3.3)', 'lblb', 'middle');

    const oilP1 = () => on(g + '.oilPump1') && pw();
    const oilP2 = () => on(g + '.oilPump2') && pw();
    const oilAny = () => oilP1() || oilP2();
    const getOilMPa = () => S[g + '.oilMPa'] !== undefined ? n(g + '.oilMPa') : (n(g + '.oilPress') / 25);
    const getOilVolM3 = () => {
      const mp = Math.max(1.2, getOilMPa());
      return Math.max(0.05, Math.min(1.6, 2.5 - 1.625 / Math.pow(mp / 4.0, 1 / 1.4)));
    };
    const getOilTempC = () => {
      const th = n(g + '.thrustOil') || n(g + '.thrust') || 30;
      const cwT = n(g + '.cwTemp') || 28;
      return Math.max(25, Math.min(65, cwT + 5.5 + Math.max(0, th - 28) * 0.35 + (oilAny() ? 1.5 : 0)));
    };

    // Đường hút từ THÙNG DẦU XẢ -> Bơm dầu trục vít 1 & 2
    pipe(p, [[972, 636], [972, 684], [614, 684], [614, 616]], oilAny, '#f59f00', 9);
    pipe(p, [[714, 684], [714, 616]], oilP2, '#f59f00', 9);
    // Đường đẩy từ 2 bơm dầu trục vít -> Bình tích năng HYZ (2,5 m³)
    pipe(p, [[614, 564], [614, 494], [800, 494], [800, 466]], oilAny, '#fab005', 10);
    pipe(p, [[714, 564], [714, 524], [614, 524]], oilP2, '#fab005', 10);
    // Đường dầu cao áp từ đáy Bình tích năng -> Điều tốc (Servo)
    pipe(p, [[762, 434], [575, 434], [575, 342]], () => getOilMPa() > 1.8, '#e67700', 9);
    txt(p, 578, 334, '→ Điều tốc (Servo)', 'lblb', 'start').setAttribute('font-size', '11');
    // Đường khí cao áp nạp đỉnh Bình tích năng HYZ
    pipe(p, [[820, 260], [820, 224], [1056, 224]], () => (S.hpAir !== undefined ? n('hpAir') : 4.0) > 2.5, '#adb5bd', 7);
    txt(p, 945, 215, '← Khí cao áp HYZ (4,0 MPa)', 'lbl', 'middle').setAttribute('font-size', '10.5');

    // Bình tích năng dầu – khí nén (2,5 m³) đặt sau 2 bơm dầu trục vít
    const accX = 762, accY = 260, accW = 116, accH = 206;
    el('rect', { x: accX, y: accY, width: accW, height: accH, rx: 38, fill: '#dee2e6', stroke: '#495057', 'stroke-width': 2.5 }, p);
    const accClipId = 'accClip' + gn;
    const accDefs = el('defs', {}, p);
    const accClip = el('clipPath', { id: accClipId }, accDefs);
    el('rect', { x: accX + 3, y: accY + 3, width: accW - 6, height: accH - 6, rx: 35 }, accClip);
    const accOilRect = el('rect', { x: accX + 3, y: accY + accH - 70, width: accW - 6, height: 67, fill: '#fab005', opacity: 0.92, 'clip-path': `url(#${accClipId})` }, p);
    txt(p, accX + accW / 2, accY + 48, 'KHÍ NÉN', 'lblb', 'middle').setAttribute('font-size', '11.5');
    txt(p, accX + accW / 2, accY + 66, 'HYZ 2,5 m³', 'lbl', 'middle').setAttribute('font-size', '10.5');
    txt(p, accX + accW / 2, accY + accH - 22, 'DẦU ÁP LỰC', 'lblb', 'middle').setAttribute('font-size', '11');

    // Cột thủy báo mức dầu bình tích năng (định mức 35% = 0,875 / 2,5 m³)
    const sgX = 900, sgY = 276, sgW = 24, sgH = 174;
    el('rect', { x: sgX, y: sgY, width: sgW, height: sgH, rx: 4, fill: '#e9ecef', stroke: '#495057', 'stroke-width': 1.5 }, p);
    const sgFill = el('rect', { x: sgX + 3, y: sgY + sgH - 60, width: sgW - 6, height: 60, fill: '#f59f00' }, p);
    const nomY = sgY + sgH * (1 - 0.35);
    el('line', { x1: sgX - 5, y1: nomY, x2: sgX + sgW + 5, y2: nomY, stroke: '#2b8a3e', 'stroke-width': 2.2 }, p);
    txt(p, sgX + sgW + 10, sgY + 14, 'Cột thủy mức dầu', 'lblb').setAttribute('font-size', '11.5');
    txt(p, sgX + sgW + 10, nomY + 4, '35% đm (0,875 m³)', 'lbl').setAttribute('font-size', '10.5');
    const sgVal1 = txt(p, sgX + sgW + 10, sgY + 44, '', 'val'); sgVal1.setAttribute('font-size', '12');
    const sgVal2 = txt(p, sgX + sgW + 10, sgY + 62, '', 'val'); sgVal2.setAttribute('font-size', '11.5');
    U(() => {
      const vol = getOilVolM3();
      const frac = Math.max(0.05, Math.min(0.85, vol / 2.5));
      const hAcc = (accH - 8) * frac;
      accOilRect.setAttribute('y', accY + accH - 4 - hAcc);
      accOilRect.setAttribute('height', hAcc);
      const hSg = (sgH - 4) * frac;
      sgFill.setAttribute('y', sgY + sgH - 2 - hSg);
      sgFill.setAttribute('height', hSg);
      sgVal1.textContent = `Mức: ${fx(frac * 100, 1)} %`;
      sgVal2.textContent = `${fx(vol, 3)} / 2,5 m³`;
    });

    pump(p, 614, 590, g + '.oilPump1', 'Bơm dầu 1', 24);
    pump(p, 714, 590, g + '.oilPump2', 'Bơm dầu 2', 24);
    tank(p, 902, 488, 138, 148, 'THÙNG DẦU XẢ', () => n(g + '.oilLevel'), '#ffd43b');
    // Ô hiển thị nhiệt độ dầu thùng dầu xả (°C)
    el('rect', { x: 902, y: 642, width: 138, height: 32, rx: 6, fill: '#fff4e6', stroke: '#f08c00', 'stroke-width': 1.4 }, p);
    const oilTempTxt = txt(p, 971, 663, '', 'lblb', 'middle'); oilTempTxt.setAttribute('font-size', '12');
    U(() => {
      const ot = getOilTempC();
      oilTempTxt.textContent = `T dầu xả: ${fx(ot, 1)} °C`;
      oilTempTxt.setAttribute('fill', ot > 50 ? '#c92a2a' : '#d9480f');
    });

    // Đồng hồ áp suất dầu HYZ (0 – 6,0 MPa; xanh 3,8–4,2 MPa; báo động < 3,2 MPa)
    gauge(p, 650, 192, 60, 6.0, 'Áp suất dầu HYZ', getOilMPa, 'MPa', 0.7, {
      dec: 2, tickDec: 1, ticks: 6,
      zones: [[0, 3.2 / 6, '#e03131'], [3.2 / 6, 3.8 / 6, '#f59f00'], [3.8 / 6, 4.2 / 6, '#2f9e44'], [4.2 / 6, 1, '#e03131']],
      alarmFn: v => v < 3.2 || v > 4.3, subText: 'Xanh 3,8–4,2 · Thấp <3,2'
    });
    const oilAlmTxt = txt(p, 650, 304, '', 'lblb', 'middle'); oilAlmTxt.setAttribute('font-size', '11.5');
    U(() => {
      const mp = getOilMPa();
      oilAlmTxt.textContent = mp < 3.2 ? '⚠ BÁO ĐỘNG ÁP DẦU THẤP (<3,2 MPa)!' : '';
      oilAlmTxt.setAttribute('fill', '#e03131');
    });

    // =================== 3. KHÍ NÉN, ĐỆM KÍN TRỤC & THOÁT NƯỚC NẮP TUABIN (Điều 21, 33, 36) ===================
    el('rect', { x: 1070, y: 54, width: 510, height: 656, rx: 12, fill: '#f8f9fa', stroke: '#dee2e6' }, p);
    txt(p, 1325, 80, 'KHÍ NÉN, ĐỆM KÍN TRỤC & NẮP TUABIN', 'lblb', 'middle');

    const getHpAir = () => S.hpAir !== undefined ? n('hpAir') : 4.0;
    const getLpAir = () => S.lpAir !== undefined ? n('lpAir') : (n(g + '.airPress') / 125);
    const getMaintSealP = () => on(g + '.maintSeal') ? getLpAir() : 0.0;
    const getShaftSealP = () => cwFlowOn() ? Math.min(0.6, getCwMPa() * 0.94) : 0.0;

    // 2 Áp kế khí tách biệt: Cao áp HYZ (0-6,0 MPa, đm 4,0) & Hạ áp (0-1,0 MPa, đm 0,75)
    gauge(p, 1185, 174, 52, 6.0, 'Khí cao áp HYZ', getHpAir, 'MPa', 0.8, {
      dec: 2, tickDec: 1, ticks: 6,
      zones: [[0, 3.5 / 6, '#e03131'], [3.5 / 6, 3.8 / 6, '#f59f00'], [3.8 / 6, 4.3 / 6, '#2f9e44'], [4.3 / 6, 1, '#e03131']],
      alarmFn: v => v < 3.5, subText: 'đm 4,0 MPa → Bình HYZ'
    });
    gauge(p, 1465, 174, 52, 1.0, 'Khí hạ áp (Phanh)', getLpAir, 'MPa', 0.8, {
      dec: 2, tickDec: 1, ticks: 5,
      zones: [[0, 0.55, '#e03131'], [0.55, 0.62, '#f59f00'], [0.62, 0.82, '#2f9e44'], [0.82, 1, '#e03131']],
      alarmFn: v => v < 0.55, subText: 'đm 0,75 MPa · Phanh & ĐK'
    });
    // Máy nén khí 1 & 2 ở giữa hàng trên
    pump(p, 1290, 175, g + '.airComp1', 'MNK 1', 20);
    pump(p, 1360, 175, g + '.airComp2', 'MNK 2', 20);

    // Cụm 2 áp kế nhỏ tại cổ trục tuabin (Điều 21 Bước 5 & Bước 6)
    el('rect', { x: 1088, y: 278, width: 474, height: 178, rx: 10, fill: '#eef2f6', stroke: '#cbd5e1' }, p);
    txt(p, 1325, 298, 'CỔ TRỤC TUABIN – ĐỆM KÍN SỬA CHỮA & CHÈN TRỤC (ĐIỀU 21 B5–B6)', 'lblb', 'middle').setAttribute('font-size', '11.5');
    gauge(p, 1185, 362, 42, 1.0, 'P khí đệm kín SC', getMaintSealP, 'MPa', 0.85, {
      dec: 2, tickDec: 1, ticks: 5,
      zones: [[0, 0.05, '#2f9e44'], [0.05, 0.5, '#f59f00'], [0.5, 0.85, '#1971c2'], [0.85, 1, '#e03131']],
      alarmFn: v => on(g + '.running') && v > 0.05, subText: '0,00 khi chạy (Đ.21 B5)'
    });
    button(p, 1272, 344, 106, 34, 'Đệm kín SC', () => ask(`${on(g + '.maintSeal') ? 'Xả khí (0,00 MPa)' : 'Cấp khí nén'} đệm kín sửa chữa MF${gn}?`, () => set(k('MAINTSEAL'))), () => on(g + '.maintSeal'));
    const msSt = txt(p, 1325, 398, '', 'lblb', 'middle'); msSt.setAttribute('font-size', '11');
    U(() => {
      msSt.textContent = on(g + '.maintSeal') ? 'ĐANG CẤP KHÍ SC' : 'Đã xả (Vận hành)';
      msSt.setAttribute('fill', on(g + '.maintSeal') ? '#e8590c' : '#2b8a3e');
    });
    gauge(p, 1465, 362, 42, 0.6, 'P nước chèn trục', getShaftSealP, 'MPa', 0.8, {
      dec: 2, tickDec: 1, ticks: 6,
      zones: [[0, 0.18 / 0.6, '#e03131'], [0.18 / 0.6, 0.42 / 0.6, '#2f9e44'], [0.42 / 0.6, 1, '#e03131']],
      alarmFn: v => on(g + '.running') && v < 0.18, subText: 'đm 0,30 MPa (Đ.21 B6)'
    });

    // Thoát nước nắp tuabin: Đường ống hút từ ĐÁY cột mực nước rò -> 2 bơm hc1, hc2 -> Đường ống xả
    txt(p, 1325, 480, 'THOÁT NƯỚC NẮP TUABIN (HEAD COVER)', 'lblb', 'middle').setAttribute('font-size', '12.5');
    const hc1On = () => on(g + '.hc1') && pw();
    const hc2On = () => on(g + '.hc2') && pw();
    const hcAny = () => hc1On() || hc2On();
    // Ống hút từ đáy cột mực nước rò (x=1128, y=648) sang 2 bơm thoát nước nắp tuabin
    pipe(p, [[1128, 648], [1128, 678], [1258, 678], [1258, 616]], hcAny, '#339af0', 8);
    pipe(p, [[1358, 678], [1358, 616]], hc2On, '#339af0', 8);
    // Ống xả từ cửa đẩy 2 bơm nắp tuabin ra đường ống xả hạ lưu
    pipe(p, [[1258, 566], [1258, 514], [1565, 514]], hcAny, '#1c7ed6', 9);
    pipe(p, [[1358, 566], [1358, 514]], hc2On, '#1c7ed6', 9);
    txt(p, 1560, 504, '→ Ống xả hạ lưu', 'lbl', 'end').setAttribute('font-size', '11');

    // Cột mực nước rò nắp tuabin (headCover mm)
    el('rect', { x: 1100, y: 498, width: 56, height: 150, fill: '#e9ecef', stroke: '#495057', 'stroke-width': 1.5 }, p);
    const lk = el('rect', { x: 1104, y: 644, width: 48, height: 0, fill: '#339af0' }, p);
    txt(p, 1170, 535, 'Mực nắp TB', 'lblb').setAttribute('font-size', '11.5');
    const lkT = txt(p, 1170, 556, '', 'val');
    U(() => {
      const mm = S[g + '.headCover'] !== undefined ? n(g + '.headCover') : n(g + '.leakage') * 20;
      const f = Math.max(0, Math.min(1, mm / 400));
      lk.setAttribute('y', 644 - 142 * f); lk.setAttribute('height', 142 * f);
      lk.setAttribute('fill', mm >= 240 ? '#e03131' : mm >= 180 ? '#f08c00' : '#339af0');
      lkT.textContent = fx(mm, 0) + ' mm';
    });
    pump(p, 1258, 592, g + '.hc1', 'Bơm nắp TB 1', 22);
    pump(p, 1358, 592, g + '.hc2', 'Bơm nắp TB 2', 22);
    button(p, 1445, 578, 118, 30, 'Xả nước rò', () => set(k('LEAKRESET'), 1));

    // =================== 4. BẢNG CHỈ THỊ MỨC DẦU CÁC Ổ TRỤC (Điều 20 mục 6 & Điều 36) ===================
    el('rect', { x: 20, y: 722, width: 1560, height: 96, rx: 10, fill: '#f1f3f5', stroke: '#adb5bd', 'stroke-width': 1.5 }, p);
    txt(p, 38, 744, 'BẢNG CHỈ THỊ MỨC DẦU CÁC Ổ TRỤC (ĐIỀU 20 MỤC 6 & ĐIỀU 36)', 'lblb', 'start');
    const brgSpecs = [
      { x: 38, w: 492, name: '1. Ổ đỡ & Ổ hướng trên', tempFn: () => `T ổ đỡ: ${fx(n(g + '.thrust'), 1)} °C · T dầu ổ đỡ: ${fx(n(g + '.thrustOil') || n(g + '.thrust'), 1)} °C · Hướng trên: ${fx(n(g + '.upper'), 1)} °C`, lowFn: () => n(g + '.oilLevel') < 25 || n(g + '.thrustOil') >= 50 || n(g + '.thrust') >= 60 || n(g + '.upper') >= 60 || (S.faults || []).some(f => f.includes('g' + gn + '.bearing')) },
      { x: 554, w: 492, name: '2. Ổ hướng dưới', tempFn: () => `T bạc ổ hướng dưới: ${fx(n(g + '.lower'), 1)} °C`, lowFn: () => n(g + '.oilLevel') < 25 || n(g + '.lower') > 65 || (S.faults || []).some(f => f.includes('g' + gn + '.bearing')) },
      { x: 1070, w: 492, name: '3. Ổ hướng tuabin', tempFn: () => `T bạc ổ hướng tuabin: ${fx(n(g + '.turbPad') || n(g + '.lower'), 1)} °C`, lowFn: () => n(g + '.oilLevel') < 25 || n(g + '.turbPad') > 65 || (S.faults || []).some(f => f.includes('g' + gn + '.bearing')) }
    ];
    brgSpecs.forEach(b => {
      const card = el('rect', { x: b.x, y: 754, width: b.w, height: 52, rx: 8, fill: '#fff', stroke: '#ced4da', 'stroke-width': 1.5 }, p);
      const lamp = el('circle', { cx: b.x + 22, cy: 780, r: 9, fill: '#2f9e44', stroke: '#333', 'stroke-width': 1.2 }, p);
      txt(p, b.x + 40, 774, b.name, 'lblb', 'start').setAttribute('font-size', '13');
      const stT = txt(p, b.x + b.w - 14, 774, 'BÌNH THƯỜNG', 'lblb', 'end'); stT.setAttribute('font-size', '12.5');
      const tmT = txt(p, b.x + 40, 796, '', 'lbl', 'start'); tmT.setAttribute('font-size', '11.5');
      U(() => {
        const low = b.lowFn();
        lamp.setAttribute('fill', low ? '#e03131' : '#2f9e44');
        card.setAttribute('stroke', low ? '#e03131' : '#2f9e44');
        stT.textContent = low ? '⚠ MỨC DẦU THẤP / CẢNH BÁO' : '✔ MỨC DẦU BÌNH THƯỜNG';
        stT.setAttribute('fill', low ? '#c92a2a' : '#2b8a3e');
        tmT.textContent = b.tempFn();
      });
    });

    const pwT = txt(p, 800, 845, '', 'lblb', 'middle');
    U(() => { pwT.textContent = pw() ? `Nguồn tự dùng 0,4 kV: ${fx(n('V400') * 1000, 0)} V` : '⚠ MẤT NGUỒN TỰ DÙNG 0,4 kV – bơm và máy nén không chạy'; pwT.setAttribute('fill', pw() ? '#2b8a3e' : '#e03131'); });
  };
}
addPage('aux1', 'Phụ trợ MF1', auxPage(1));
addPage('aux2', 'Phụ trợ MF2', auxPage(2));

// ================================================================== TRANG: TỰ DÙNG 0,4 kV (ĐIỀU 1 & ĐIỀU 2)
addPage('auxpower', 'Tự dùng 0,4kV', root => {
  const p = svgRoot(root, 1600, 780);
  txt(p, 800, 34, 'NGUỒN TỰ DÙNG 0,4 kV – TD 61, TD 32 & LIÊN ĐỘNG ATS (ĐIỀU 1 & 2)', 'ttl', 'middle');
  const v1 = () => n('G1.V60') > 0.5, v2 = () => n('G2.V60') > 0.5;
  const aux = () => n('Vaux6') > 0.5;
  const z2 = () => n('VbusZone2') > 1;
  // Kiểm tra đúng điều kiện cấp nguồn thực tế phía hạ áp sau TD 61 và TD 32
  const td61Lv = () => S.V400Zone1 !== undefined ? n('V400Zone1') > 0.05 : aux();
  const td32Lv = () => S.V400Zone2 !== undefined ? n('V400Zone2') > 0.05 : z2();
  const v4 = () => n('V400') > 0.05 && ((on('AXT1') && td61Lv()) || (on('AXT2') && td32Lv()) || (on('dgCb') && on('dgEngine')) || S.V400Zone1 === undefined);

  let atsAlertMsg = '', atsAlertUntil = 0;
  function triggerAtsWarn(msg) {
    atsAlertMsg = msg;
    atsAlertUntil = Date.now() + 6000;
    toast(msg, true);
    if (window.AssessEngine && window.AssessEngine.onBlockedAttempt) {
      window.AssessEngine.onBlockedAttempt('AUX_PARALLEL', msg);
    }
  }

  // Nguồn 6,3 kV -> DCL 612-1 / 612-2 -> TD 61 (Ưu tiên vận hành thường xuyên)
  wire(p, [[170, 90], [400, 90]], v1, C.live6, 6); txt(p, 170, 76, 'Thanh cái 6,3 kV MF1', 'lblb');
  const t1 = txt(p, 410, 95, '', 'val'); U(() => { t1.textContent = fx(n('G1.V60'), 2) + ' kV'; });
  wire(p, [[520, 90], [740, 90]], v2, C.live6, 6); txt(p, 520, 76, 'Thanh cái 6,3 kV MF2', 'lblb');
  const t2 = txt(p, 750, 95, '', 'val'); U(() => { t2.textContent = fx(n('G2.V60'), 2) + ' kV'; });
  wire(p, [[320, 90], [320, 134]], v1, C.live6); disc(p, 320, 150, 'IS612_1', 'DCL 612-1', -1);
  wire(p, [[600, 90], [600, 134]], v2, C.live6); disc(p, 600, 150, 'IS612_2', 'DCL 612-2', 1);
  wire(p, [[320, 166], [320, 210], [600, 210], [600, 166]], aux, C.live6);
  wire(p, [[460, 210], [460, 272]], aux, C.live6);
  trafo(p, 460, 310, aux, td61Lv, C.live6, C.live04);
  txt(p, 502, 304, 'TD 61 (6,3/0,4 kV)', 'lblb');
  txt(p, 502, 324, 'Ưu tiên vận hành thường xuyên', 'lbl').setAttribute('fill', '#2b8a3e');
  const td61V = txt(p, 502, 344, '', 'val');
  U(() => { td61V.textContent = `Hạ áp: ${fx((S.V400Zone1 !== undefined ? n('V400Zone1') : (aux() ? 0.4 : 0)) * 1000, 0)} V`; });
  wire(p, [[460, 348], [460, 426]], td61Lv, C.live04);

  // Máy cắt 1AXT kèm liên động chống đóng song song TD 61 – TD 32 / Diesel
  const bAxt1 = breaker(p, 460, 450, 'AXT1', '1AXT (TD 61)', -1);
  bAxt1.onclick = () => {
    if (!on('AXT1') && on('AXT2')) {
      triggerAtsWarn('CẤM ĐÓNG SONG SONG TD 61 VÀ TD 32 (Điều 2)! Phải cắt 2AXT trước khi đóng 1AXT.');
      return;
    }
    if (!on('AXT1') && on('dgCb')) {
      triggerAtsWarn('CẤM ĐÓNG SONG SONG TD 61 VỚI MÁY PHÁT DIESEL! Phải cắt MC Diesel trước khi đóng 1AXT.');
      return;
    }
    ask(`${on('AXT1') ? 'Cắt' : 'Đóng'} máy cắt 1AXT (nguồn TD 61)?`, () => set('AXT1'));
  };
  wire(p, [[460, 474], [460, 570]], () => v4() || (on('AXT1') && td61Lv()), C.live04);

  // Nguồn 35 kV TC 32 -> TD 32
  wire(p, [[980, 90], [1400, 90]], z2, C.live, 6); txt(p, 980, 76, 'Thanh cái 35 kV – TC 32', 'lblb');
  const t3 = txt(p, 1410, 95, '', 'val'); U(() => { t3.textContent = fx(n('VbusZone2'), 1) + ' kV'; });
  wire(p, [[1140, 90], [1140, 272]], z2);
  trafo(p, 1140, 310, z2, td32Lv, C.live, C.live04);
  txt(p, 1182, 304, 'TD 32 (35/0,4 kV)', 'lblb');
  txt(p, 1182, 324, 'Nguồn dự phòng từ TC 32', 'lbl');
  const td32V = txt(p, 1182, 344, '', 'val');
  U(() => { td32V.textContent = `Hạ áp: ${fx((S.V400Zone2 !== undefined ? n('V400Zone2') : (z2() ? 0.4 : 0)) * 1000, 0)} V`; });
  wire(p, [[1140, 348], [1140, 426]], td32Lv, C.live04);

  // Máy cắt 2AXT kèm liên động chống đóng song song TD 32 – TD 61 / Diesel
  const bAxt2 = breaker(p, 1140, 450, 'AXT2', '2AXT (TD 32)', -1);
  bAxt2.onclick = () => {
    if (!on('AXT2') && on('AXT1')) {
      triggerAtsWarn('CẤM ĐÓNG SONG SONG TD 32 VÀ TD 61 (Điều 2)! Phải cắt 1AXT trước khi đóng 2AXT.');
      return;
    }
    if (!on('AXT2') && on('dgCb')) {
      triggerAtsWarn('CẤM ĐÓNG SONG SONG TD 32 VỚI MÁY PHÁT DIESEL! Phải cắt MC Diesel trước khi đóng 2AXT.');
      return;
    }
    ask(`${on('AXT2') ? 'Cắt' : 'Đóng'} máy cắt 2AXT (nguồn TD 32)?`, () => set('AXT2'));
  };
  wire(p, [[1140, 474], [1140, 570]], () => v4() || (on('AXT2') && td32Lv()), C.live04);

  // Đường nét đứt liên động cơ – điện giữa 1AXT ↔ 2AXT ↔ MC Diesel
  el('line', { x1: 476, y1: 450, x2: 1124, y2: 450, stroke: '#e8590c', 'stroke-width': 2, 'stroke-dasharray': '7 5' }, p);
  el('line', { x1: 1156, y1: 450, x2: 1404, y2: 450, stroke: '#e8590c', 'stroke-width': 2, 'stroke-dasharray': '7 5' }, p);
  el('rect', { x: 675, y: 436, width: 280, height: 26, rx: 6, fill: '#fff4e6', stroke: '#f08c00', 'stroke-width': 1.5 }, p);
  txt(p, 815, 453, 'LIÊN ĐỘNG ATS: CẤM ĐÓNG SONG SONG', 'lblb', 'middle').setAttribute('font-size', '11.5');

  // Khung hiển thị trạng thái ATS & Cảnh báo liên động
  const atsBox = el('rect', { x: 645, y: 120, width: 390, height: 126, rx: 10, fill: '#e6fcf5', stroke: '#12b886', 'stroke-width': 2 }, p);
  const atsHdr = txt(p, 840, 145, 'TRẠNG THÁI ATS & LIÊN ĐỘNG NGUỒN 0,4 kV', 'lblb', 'middle'); atsHdr.setAttribute('font-size', '12.5');
  const atsSrc = txt(p, 840, 170, '', 'lblb', 'middle'); atsSrc.setAttribute('font-size', '13.5');
  const atsDetail = txt(p, 840, 194, '', 'lbl', 'middle'); atsDetail.setAttribute('font-size', '12');
  const atsWarnT = txt(p, 840, 222, '', 'lblb', 'middle'); atsWarnT.setAttribute('font-size', '11.5');
  U(() => {
    const a1 = on('AXT1'), a2 = on('AXT2'), dg = on('dgCb');
    const parallelErr = (a1 && a2) || (dg && (a1 || a2));
    const recentWarn = Date.now() < atsAlertUntil;
    const srcName = parallelErr ? '⚠ LỖI ĐÓNG SONG SONG NGUỒN TỰ DÙNG!'
      : a1 && td61Lv() ? 'Nguồn đang cấp: TD 61 (1AXT – Ưu tiên)'
      : a2 && td32Lv() ? 'Nguồn đang cấp: TD 32 (2AXT – Từ TC 32)'
      : dg && on('dgEngine') ? 'Nguồn đang cấp: Máy phát Diesel 500 kVA'
      : '⚠ MẤT ĐIỆN THANH CÁI TỰ DÙNG 0,4 kV';
    atsSrc.textContent = srcName;
    atsDetail.textContent = `1AXT: ${a1 ? 'ĐÓNG' : 'CẮT'} · 2AXT: ${a2 ? 'ĐÓNG' : 'CẮT'} · MC Diesel: ${dg ? 'ĐÓNG' : 'CẮT'} · ATS: ${on('dgAuto') ? 'TỰ ĐỘNG' : 'TAY'}`;
    if (parallelErr || recentWarn) {
      atsBox.setAttribute('fill', '#ffe3e3'); atsBox.setAttribute('stroke', '#e03131');
      atsSrc.setAttribute('fill', '#c92a2a');
      atsWarnT.textContent = clip(parallelErr ? 'CẤM ĐÓNG SONG SONG TD 61 / TD 32 / DIESEL!' : atsAlertMsg, 54);
      atsWarnT.setAttribute('fill', '#c92a2a');
    } else if (!v4()) {
      atsBox.setAttribute('fill', '#fff4e6'); atsBox.setAttribute('stroke', '#f08c00');
      atsSrc.setAttribute('fill', '#d9480f');
      atsWarnT.textContent = 'Thanh cái 0,4 kV mất điện – kiểm tra nguồn hoặc ATS Diesel';
      atsWarnT.setAttribute('fill', '#d9480f');
    } else {
      atsBox.setAttribute('fill', '#e6fcf5'); atsBox.setAttribute('stroke', '#12b886');
      atsSrc.setAttribute('fill', '#087f5b');
      atsWarnT.textContent = 'Liên động: Chỉ cho phép 1 trong 3 nguồn (TD 61 / TD 32 / Diesel)';
      atsWarnT.setAttribute('fill', '#087f5b');
    }
  });

  // Thanh cái 0,4 kV & Đồng hồ điện áp 0,4 kV
  wire(p, [[170, 570], [1420, 570]], v4, C.live04, 8); txt(p, 170, 556, 'Thanh cái tự dùng 0,4 kV', 'lblb');
  gauge(p, 815, 340, 62, 550, 'Điện áp 0,4 kV', () => n('V400') * 1000, 'V', 0.85, {
    dec: 0, zones: [[0, 360 / 550, '#e03131'], [360 / 550, 440 / 550, '#2f9e44'], [440 / 550, 1, '#e03131']],
    alarmFn: v => v < 360 || v > 440
  });

  const loads = ['Cấp cho đập', 'Phụ trợ MF1', 'Phụ trợ MF2', 'Máy nén khí', 'Tự dùng khác'];
  loads.forEach((l, i) => {
    const x = 250 + i * 260;
    wire(p, [[x, 570], [x, 620]], v4, C.live04);
    const g = el('g', { class: 'clk' }, p);
    el('rect', { x: x - 28, y: 620, width: 56, height: 80, rx: 6, fill: '#e9ecef', stroke: '#868e96', 'stroke-width': 2 }, g);
    const lev = el('rect', { x: x - 10, y: 0, width: 20, height: 30, rx: 4, fill: '#495057' }, g);
    txt(p, x, 725, l, 'lblb', 'middle');
    const key = 'AUXMCB' + (i + 1);
    U(() => { lev.setAttribute('y', on(key) ? 628 : 662); lev.setAttribute('fill', on(key) ? '#e03131' : '#495057'); });
    g.onclick = () => ask(`${on(key) ? 'Cắt' : 'Đóng'} aptomat "${l}"?`, () => set(key));
  });

  // Máy phát Diesel 500 kVA nối thanh cái 0,4 kV (cấm đóng khi thanh cái đang có điện từ lưới!)
  wire(p, [[1420, 570], [1420, 474]], v4, C.live04);
  const bDg = breaker(p, 1420, 450, 'dgCb', 'MC Diesel', 1);
  bDg.onclick = () => {
    const gridEnergized = (on('AXT1') && td61Lv()) || (on('AXT2') && td32Lv()) || (!on('dgCb') && v4());
    if (!on('dgCb') && gridEnergized) {
      triggerAtsWarn('NGHIÊM CẤM ĐÓNG MC DIESEL KHI THANH CÁI 0,4 kV ĐANG CÓ ĐIỆN TỪ LƯỚI! Phải cắt 1AXT/2AXT trước.');
      return;
    }
    ask(`${on('dgCb') ? 'Cắt' : 'Đóng'} máy cắt MC Diesel 500 kVA?`, () => set('dgCb'));
  };
  wire(p, [[1420, 426], [1420, 372]], () => on('dgEngine'), C.live04);
  genSym(p, 1420, 340, () => on('dgEngine'), '');
  txt(p, 1420, 272, 'Máy phát Diesel 500 kVA', 'lblb', 'middle');
  const dgt = txt(p, 1420, 294, '', 'val', 'middle');
  U(() => { dgt.textContent = (on('dgEngine') ? 'đang chạy' : 'dừng') + (on('dgCb') ? ` · ${fx(n('dgKW'), 0)} kW ${fx(n('dgKVAr'), 0)} kVAr` : ''); });
  button(p, 1270, 150, 290, 36, 'Lệnh chạy Diesel (400V standby)', () => {
    if (!on('StandbyInput400') && ((on('AXT1') && td61Lv()) || (on('AXT2') && td32Lv()))) {
      toast('Lưu ý liên động ATS: Thanh cái 0,4 kV đang có điện từ lưới – khi Diesel đủ áp ATS sẽ tự cắt 1AXT/2AXT trước khi đóng MC Diesel.');
    }
    set('StandbyInput400');
  }, () => on('StandbyInput400'));
  button(p, 1270, 194, 290, 36, 'Tự động chuyển nguồn (ATS + Diesel)', () => set('DGAUTO'), () => on('dgAuto'));
});

// ================================================================== TRANG: CỬA NHẬN NƯỚC (THÊM LƯỚI CHẮN RÁC & GIẾNG THÔNG HƠI)
addPage('intake', 'Cửa nhận nước', root => {
  const p = svgRoot(root, 1600, 760);
  txt(p, 800, 36, 'CỬA NHẬN NƯỚC – LƯỚI CHẮN RÁC – GIẾNG THÔNG HƠI – NHÀ MÁY ĐRÂY H\'LINH 2', 'ttl', 'middle');
  el('rect', { x: 40, y: 60, width: 1520, height: 660, rx: 12, fill: '#e7f5ff' }, p);
  // hồ chứa thượng lưu
  const res = el('path', { fill: '#4dabf7', opacity: 0.85 }, p);
  // đập bê tông trọng lực
  el('path', { d: 'M420 720 L515 220 L635 220 L790 720 Z', fill: '#e9d8a6', stroke: '#b08d57', 'stroke-width': 2 }, p);

  // Lưới chắn rác (Trash Rack) nghiêng phía trước khe cửa van phẳng
  const rackG = el('g', {}, p);
  el('polygon', { points: '442,616 468,480 482,480 456,616', fill: '#ced4da', opacity: 0.45, stroke: '#343a40', 'stroke-width': 2.5 }, rackG);
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const x1 = 444 + t * 24, y1 = 612 - t * 126;
    el('line', { x1: x1 - 2, y1, x2: x1 + 12, y2: y1, stroke: '#212529', 'stroke-width': 2.4 }, rackG);
  }
  el('line', { x1: 449, y1: 616, x2: 475, y2: 480, stroke: '#212529', 'stroke-width': 2 }, rackG);
  el('line', { x1: 456, y1: 495, x2: 330, y2: 455, stroke: '#212529', 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }, rackG);
  el('rect', { x: 185, y: 432, width: 168, height: 38, rx: 6, fill: '#fff', stroke: '#495057', 'stroke-width': 1.2 }, rackG);
  txt(p, 269, 449, 'Lưới chắn rác', 'lblb', 'middle').setAttribute('font-size', '12.5');
  txt(p, 269, 464, '(Trash Rack)', 'lbl', 'middle').setAttribute('font-size', '11');

  // đường ống áp lực
  pipe(p, [[466, 560], [568, 560], [700, 640], [980, 640]], () => on('IntakeGate') && (n('G1.GV') > 1 || n('G2.GV') > 1), '#1c7ed6', 26);

  // khe cửa van phẳng
  el('rect', { x: 500, y: 150, width: 40, height: 430, fill: 'none', stroke: '#495057', 'stroke-width': 3 }, p);
  const gate = el('rect', { x: 504, y: 500, width: 32, height: 90, fill: '#495057' }, p);
  el('rect', { x: 490, y: 120, width: 60, height: 30, fill: '#868e96' }, p);
  txt(p, 520, 110, 'Tời cửa van', 'lbl', 'middle');

  // Giếng ống thông hơi đứng (Air Vent) ngay phía sau cửa van trên thân đập
  const ventG = el('g', {}, p);
  el('rect', { x: 564, y: 192, width: 20, height: 356, fill: '#e7f5ff', stroke: '#343a40', 'stroke-width': 2.5 }, ventG);
  // Chụp che mưa hình chữ U ngược trên đỉnh giếng thông hơi
  el('path', { d: 'M556 196 Q574 170 592 196', fill: 'none', stroke: '#343a40', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, ventG);
  el('line', { x1: 574, y1: 198, x2: 574, y2: 540, stroke: '#339af0', 'stroke-width': 3, 'stroke-dasharray': '8 8', opacity: 0.75 }, ventG);
  el('line', { x1: 584, y1: 270, x2: 650, y2: 270, stroke: '#212529', 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }, ventG);
  el('rect', { x: 650, y: 248, width: 175, height: 40, rx: 6, fill: '#fff', stroke: '#495057', 'stroke-width': 1.2 }, ventG);
  txt(p, 738, 265, 'Giếng thông hơi đứng', 'lblb', 'middle').setAttribute('font-size', '12.5');
  txt(p, 738, 281, '(Air Vent – sau cửa van)', 'lbl', 'middle').setAttribute('font-size', '11');

  // nhà máy
  el('rect', { x: 940, y: 470, width: 360, height: 250, fill: '#f1f3f5', stroke: '#868e96', 'stroke-width': 2 }, p);
  el('path', { d: 'M930 470 L1120 400 L1310 470 Z', fill: '#adb5bd' }, p);
  txt(p, 1120, 500, 'NHÀ MÁY ĐRÂY H\'LINH 2', 'lblb', 'middle');
  for (const x of [1040, 1200]) el('circle', { cx: x, cy: 640, r: 40, fill: '#ffe066', stroke: '#e67700', 'stroke-width': 3 }, p);
  const tb1 = el('g', {}, p), tb2 = el('g', {}, p);
  for (const [tg, x] of [[tb1, 1040], [tb2, 1200]]) {
    for (let i = 0; i < 4; i++) el('line', { x1: x, y1: 640, x2: x + 36, y2: 640, stroke: '#e8590c', 'stroke-width': 7, 'stroke-linecap': 'round', transform: `rotate(${i * 90} ${x} 640)` }, tg);
  }
  txt(p, 1040, 700, 'MF1', 'lblb', 'middle'); txt(p, 1200, 700, 'MF2', 'lblb', 'middle');
  // hạ lưu
  el('path', { d: 'M1300 660 L1560 660 L1560 720 L1300 720 Z', fill: '#4dabf7', opacity: 0.85 }, p);
  pipe(p, [[1240, 690], [1420, 690]], () => on('G1.running') || on('G2.running'), '#74c0fc', 16);
  let a1 = 0, a2 = 0;
  F(dt => {
    a1 = (a1 + dt * 360 * n('G1.speed') / 214.3 * 1.2) % 360; a2 = (a2 + dt * 360 * n('G2.speed') / 214.3 * 1.2) % 360;
    tb1.setAttribute('transform', `rotate(${a1} 1040 640)`); tb2.setAttribute('transform', `rotate(${a2} 1200 640)`);
  });
  let gy = 500;
  F(dt => { const target = on('IntakeGate') ? 170 : 500; gy += Math.sign(target - gy) * Math.min(Math.abs(target - gy), dt * 120); gate.setAttribute('y', gy); });
  const hT = txt(p, 160, 200, '', 'lblb'); hT.setAttribute('font-size', '18');
  U(() => {
    const lvl = 560 - n('HeadHigh') * 10;
    res.setAttribute('d', `M40 ${lvl} L${420 + (720 - lvl) * 0.2} ${lvl} L420 720 L40 720 Z`);
    hT.textContent = `Cột nước H = ${fx(n('HeadHigh'), 1)} m`;
  });
  button(p, 620, 126, 230, 40, 'MỞ / ĐÓNG CỬA NHẬN NƯỚC', () => ask(`${on('IntakeGate') ? 'Đóng' : 'Mở'} cửa nhận nước?`, () => set('IntakeGate')), () => on('IntakeGate'));
  const st = txt(p, 620, 192, '', 'lblb');
  U(() => { st.textContent = on('IntakeGate') ? 'Cửa nhận nước: MỞ' : 'Cửa nhận nước: ĐÓNG'; st.setAttribute('fill', on('IntakeGate') ? '#2b8a3e' : '#e03131'); });
  const c = h('div', { class: 'card pad row', style: 'margin-top:10px' }, root);
  h('span', {}, c, 'Cột nước (m):');
  const inp = h('input', { type: 'range', min: 10, max: 50, step: 0.5, style: 'width:300px' }, c);
  const vv = h('b', {}, c, '');
  let ed = false;
  inp.oninput = () => { ed = true; vv.textContent = inp.value + ' m'; };
  inp.onchange = () => { set('HeadHigh', +inp.value); setTimeout(() => ed = false, 1500); };
  U(() => { if (!ed) { inp.value = n('HeadHigh'); vv.textContent = fx(n('HeadHigh'), 1) + ' m'; } });
});

// ================================================================== TRANG: XU HƯỚNG
const sysTrend = [];
addPage('trend', 'Xu hướng', root => {
  const c = h('div', { class: 'card pad' }, root);
  const r = h('div', { class: 'row' }, c);
  h('h3', { style: 'margin:0 10px 0 0' }, r, 'XU HƯỚNG HỆ THỐNG');
  const rng = h('select', {}, r, '<option value=15>15 phút</option><option value=60>1 giờ</option><option value=240>4 giờ</option><option value=1440>24 giờ</option>');
  h('button', { class: 'btn', onclick: () => window.localApi && window.localApi.downloadTrendCsv(+rng.value) }, r, '⬇ Xuất CSV xu hướng');
  const cv = h('canvas', { width: 1500, height: 520, style: 'width:100%;background:#fff;margin-top:6px' }, c);
  const series = [['VbusZone1', 'U PĐ I (kV)', '#e03131', 1, true], ['VbusZone2', 'U PĐ II (kV)', '#7048e8', 1, true], ['FreqZone1', 'f PĐ I (Hz)', '#000', 1, true],
    ['G1.freq', 'f MF1 (Hz)', '#f08c00', 1, true], ['G2.freq', 'f MF2 (Hz)', '#2b8a3e', 1, false], ['G1.Pload', 'P MF1 ×10 (MW)', '#1c7ed6', 10, true], ['G2.Pload', 'P MF2 ×10 (MW)', '#0ca678', 10, false],
    ['G1.GV', 'Cánh hướng MF1 (%)', '#5c940d', 1, false], ['G2.GV', 'Cánh hướng MF2 (%)', '#a61e4d', 1, false], ['G1.stator', 'Stator MF1 (°C)', '#d6336c', 1, false],
    ['G1.thrust', 'Ổ đỡ MF1 (°C)', '#862e9c', 1, false], ['G1.cwTemp', 'Nước làm mát MF1 (°C)', '#1971c2', 1, false], ['G1.oilPress', 'Áp lực dầu MF1 (%)', '#e67700', 1, false],
    ['HeadHigh', 'Cột nước (m)', '#0b7285', 1, false]];
  const lg = h('div', { class: 'row', style: 'margin-top:6px' }, c);
  series.forEach(sr => { const l = h('label', { style: `color:${sr[2]};font-weight:600;margin-right:10px;cursor:pointer` }, lg); const cb = h('input', { type: 'checkbox' }, l); cb.checked = sr[4]; cb.onchange = () => { sr[4] = cb.checked; draw(); }; l.appendChild(document.createTextNode(' ' + sr[1])); });
  let data = null;
  function draw() {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height, l = 50;
    const dk = document.body.classList.contains('dark'); x.clearRect(0, 0, W, H); x.strokeStyle = dk ? '#1f2d3a' : '#dee2e6'; x.fillStyle = dk ? '#9fb0c0' : '#495057'; x.font = '13px sans-serif';
    for (let i = 0; i <= 10; i++) { const y = 10 + (H - 40) * i / 10; x.beginPath(); x.moveTo(l, y); x.lineTo(W - 10, y); x.stroke(); x.fillText(String(100 - i * 10), 10, y + 4); }
    if (!data || !data.t.length) return;
    const t0 = Date.now() - rng.value * 60000, t1 = Date.now();
    series.filter(sr => sr[4]).forEach(([k, , col, mul]) => {
      const ix = data.keys.indexOf(k); if (ix < 0) return;
      x.strokeStyle = col; x.lineWidth = 2; x.beginPath();
      data.t.forEach((t, i) => { const px = l + (W - l - 10) * (t - t0) / (t1 - t0), py = 10 + (H - 40) * (1 - Math.max(0, Math.min(100, data.v[i][ix] * mul)) / 100); i ? x.lineTo(px, py) : x.moveTo(px, py); });
      x.stroke();
    });
    x.fillStyle = dk ? '#9fb0c0' : '#495057'; x.fillText(new Date(t0).toLocaleTimeString('vi-VN'), l, H - 8); x.fillText(new Date(t1).toLocaleTimeString('vi-VN'), W - 80, H - 8);
  }
  async function load() { if (cur !== 'trend') return; data = await api('trend?min=' + rng.value); draw(); }
  rng.onchange = load; setInterval(load, 3000); setTimeout(load, 100);
});

// ================================================================== TRANG: HOÀ ĐỒNG BỘ (ĐIỀU 9, 10, 21 & 23)
addPage('sync', 'Hoà đồng bộ', root => {
  // Cảnh báo quy trình Điều 10: Chống khởi động / hòa lưới đồng thời 2 tổ máy
  const warn10 = h('div', { class: 'card pad', style: 'margin-bottom:10px;display:none;background:#ffe3e3;border:2px solid #e03131;color:#c92a2a;font-weight:700;font-size:14px' }, root,
    '⚠ CẢNH BÁO QUY TRÌNH (ĐIỀU 10): NGHIÊM CẤM KHỞI ĐỘNG / HÒA LƯỚI ĐỒNG THỜI CẢ 2 TỔ MÁY H1 & H2 CÙNG LÚC! Phải hoàn tất hòa 1 tổ máy ổn định rồi mới thao tác tổ máy còn lại.');
  U(() => {
    const both = isUnitStartingOrSyncing(1) && isUnitStartingOrSyncing(2);
    warn10.style.display = both ? 'block' : 'none';
  });

  const box = h('div', { class: 'grid2' }, root);
  for (const gn of [1, 2]) {
    const g = 'G' + gn, otherGn = gn === 1 ? 2 : 1, K = s => `GEN${gn}.${s}`;
    const cbNum = gn === 1 ? '331' : '332';
    const tcName = gn === 1 ? 'TC 31' : 'TC 32';
    const trName = gn === 1 ? 'T1' : 'T2';
    const c = h('div', { class: 'card pad' }, box);
    h('h3', {}, c, `Hoà đồng bộ tổ máy ${gn} – MC ${cbNum} (${tcName} · 35 kV)`);
    const sv = el('svg', { viewBox: '0 0 700 330', style: 'width:100%' }, c);
    // đồng bộ kế
    const cx = 165, cy = 165, R = 128;
    el('circle', { cx, cy, r: R + 8, fill: '#212529' }, sv);
    el('circle', { cx, cy, r: R, fill: '#f8f9fa' }, sv);
    el('path', { d: `M${cx} ${cy} L${cx + R * Math.sin(-0.21)} ${cy - R * Math.cos(-0.21)} A${R} ${R} 0 0 1 ${cx + R * Math.sin(0.21)} ${cy - R * Math.cos(0.21)} Z`, fill: '#b2f2bb' }, sv);
    for (let i = 0; i < 36; i++) { const a = i * Math.PI / 18; el('line', { x1: cx + (R - 4) * Math.sin(a), y1: cy - (R - 4) * Math.cos(a), x2: cx + (R - (i % 3 ? 12 : 22)) * Math.sin(a), y2: cy - (R - (i % 3 ? 12 : 22)) * Math.cos(a), stroke: '#333', 'stroke-width': i % 3 ? 1 : 2 }, sv); }
    txt(sv, cx - 68, cy + 5, 'CHẬM', 'lblb', 'middle'); txt(sv, cx + 68, cy + 5, 'NHANH', 'lblb', 'middle');
    const nd = el('line', { x1: cx, y1: cy + 20, x2: cx, y2: cy - R + 18, stroke: '#e03131', 'stroke-width': 5, 'stroke-linecap': 'round' }, sv);
    el('circle', { cx, cy, r: 9, fill: '#212529' }, sv);
    txt(sv, cx, cy + 58, 'ĐỒNG BỘ KẾ', 'lbl', 'middle');
    // Đồng bộ cấp điện áp so sánh phía cao áp 35 kV (MC 331 / MC 332)
    const rows = [
      ['ΔU', ''],
      ['Δf', ''],
      ['Δφ', ''],
      [`U cao áp MBA ${trName} (35 kV)`, ''],
      [`U thanh cái ${tcName} (35 kV)`, ''],
      ['f máy phát', ''],
      [`f thanh cái ${tcName}`, '']
    ];
    const tv = rows.map((r, i) => { txt(sv, 316, 42 + i * 32, r[0], 'lbl'); return txt(sv, 520, 42 + i * 32, '', 'lblb'); });
    const lamp = el('circle', { cx: 646, cy: 62, r: 26, stroke: '#333', 'stroke-width': 2 }, sv);
    txt(sv, 646, 106, 'Rơle KĐB', 'lbl', 'middle');
    const lampSt = txt(sv, 646, 124, '', 'lblb', 'middle'); lampSt.setAttribute('font-size', '11');

    const r1 = h('div', { class: 'row', style: 'margin-top:6px' }, c);
    const am = h('button', { class: 'btn', onclick: () => set(K('AUTOSYNC')) }, r1, '');
    const r2 = h('div', { class: 'row', style: 'margin-top:8px' }, c);
    h('span', { style: 'width:90px' }, r2, 'Tần số:');
    const bFm = h('button', { class: 'btn', onclick: () => set(K('SPTRIM'), n(g + '.spTrim') - 0.05) }, r2, '− 0,05 Hz');
    const bFp = h('button', { class: 'btn', onclick: () => set(K('SPTRIM'), n(g + '.spTrim') + 0.05) }, r2, '+ 0,05 Hz');
    const st = h('b', {}, r2, '');
    const r3 = h('div', { class: 'row', style: 'margin-top:6px' }, c);
    h('span', { style: 'width:90px' }, r3, 'Điện áp:');
    const bUm = h('button', { class: 'btn', onclick: () => set(K('VTRIM'), n(g + '.vTrim') - 0.5) }, r3, '− 0,5 %');
    const bUp = h('button', { class: 'btn', onclick: () => set(K('VTRIM'), n(g + '.vTrim') + 0.5) }, r3, '+ 0,5 %');
    const vt = h('b', {}, r3, '');
    const trimBtns = [bFm, bFp, bUm, bUp];

    const r4 = h('div', { class: 'row', style: 'margin-top:10px' }, c);
    const closeBtn = h('button', {
      class: 'btn danger',
      style: 'font-size:15px;padding:10px 20px;font-weight:700',
      onclick: () => {
        if (closeBtn.disabled) return;
        if (isUnitStartingOrSyncing(otherGn)) {
          toast(`CẢNH BÁO ĐIỀU 10: Tổ máy ${otherGn} đang khởi động/chờ hòa lưới – cấm hòa đồng thời 2 tổ máy!`, true);
          ask(`⚠ CẢNH BÁO ĐIỀU 10: Tổ máy H${otherGn} đang trong quá trình khởi động/hòa lưới!\nBạn vẫn muốn đóng MC ${cbNum} hòa MF${gn} vào ${tcName}?`, () => set(K('SYNCCLOSE'), 1));
        } else {
          ask(`Đóng máy cắt ${cbNum} hoà MF${gn} vào thanh cái ${tcName} (35 kV)?`, () => set(K('SYNCCLOSE'), 1));
        }
      }
    }, r4, `ĐÓNG MC ${cbNum}`);
    const info = h('span', { style: 'color:#495057;font-size:12.5px' }, r4, '');

    let ang = 0;
    F(() => { ang = n(g + '.phase'); nd.setAttribute('transform', `rotate(${on(g + '.grid') ? 0 : ang} ${cx} ${cy})`); });
    U(() => {
      const df = n(g + '.freq') - n(g + '.busF');
      const bv = n(g + '.busV');
      const uGen35 = n(g + '.Vgen') * 38.5 / 6.3;
      const uBus35 = n(gn === 1 ? 'VbusZone1' : 'VbusZone2') || (bv * 38.5 / 6.3);
      const dv = uBus35 > 1 ? (uGen35 - uBus35) / uBus35 * 100 : 0;
      const ph = n(g + '.phase');
      const vals = [fx(dv, 1) + ' %', fx(df, 2) + ' Hz', fx(ph, 0) + '°', fx(uGen35, 2) + ' kV', fx(uBus35, 2) + ' kV', fx(n(g + '.freq'), 2) + ' Hz', fx(n(g + '.busF'), 2) + ' Hz'];
      tv.forEach((t, i) => t.textContent = vals[i]);
      const synced = on(g + '.grid');
      const auto = on(g + '.autoSync');
      const strict = S.interlock === 'strict';
      const lim = syncLimits();
      const okk = Math.abs(df) <= lim.df && Math.abs(dv) <= lim.dv && Math.abs(ph) <= lim.ph && !synced && n(g + '.mode') === 1 && uBus35 > 10;
      lamp.setAttribute('fill', synced ? '#228be6' : okk ? '#40c057' : '#495057');
      lampSt.textContent = synced ? 'ĐÃ HÒA' : okk ? 'CHO PHÉP' : 'KHÓA';
      lampSt.setAttribute('fill', synced ? '#1971c2' : okk ? '#2b8a3e' : '#868e96');
      [0, 1, 2].forEach(i => tv[i].setAttribute('fill', [Math.abs(dv) <= lim.dv, Math.abs(df) <= lim.df, Math.abs(ph) <= lim.ph][i] ? '#2b8a3e' : '#c92a2a'));

      am.textContent = auto ? 'Đang HOÀ TỰ ĐỘNG (SDQ200) – bấm chuyển HOÀ TAY' : 'Đang HOÀ TAY – bấm chuyển HOÀ TỰ ĐỘNG (SDQ200)';
      am.className = 'btn' + (auto ? '' : ' on');
      st.textContent = 'đặt ' + fx(50 + n(g + '.spTrim'), 2) + ' Hz';
      vt.textContent = 'chỉnh ' + fx(n(g + '.vTrim'), 1) + ' %';

      // Khóa thao tác tay khi đang hòa tự động SDQ200 & khóa liên động chặt khi hòa tay
      const disableTrims = auto || synced;
      trimBtns.forEach(b => { b.disabled = disableTrims; b.style.opacity = disableTrims ? '0.45' : '1'; b.style.cursor = disableTrims ? 'not-allowed' : 'pointer'; });

      if (synced) {
        closeBtn.disabled = true;
        closeBtn.textContent = `ĐÃ HÒA LƯỚI (MC ${cbNum} ĐÓNG)`;
        closeBtn.className = 'btn';
        closeBtn.style.opacity = '0.55'; closeBtn.style.cursor = 'not-allowed';
      } else if (auto) {
        closeBtn.disabled = true;
        closeBtn.textContent = 'Đang hòa tự động (SDQ200)…';
        closeBtn.className = 'btn';
        closeBtn.style.opacity = '0.6'; closeBtn.style.cursor = 'not-allowed';
      } else if (strict && !okk) {
        closeBtn.disabled = true;
        closeBtn.textContent = `🔒 KHÓA LIÊN ĐỘNG – MC ${cbNum}`;
        closeBtn.className = 'btn';
        closeBtn.style.opacity = '0.6'; closeBtn.style.cursor = 'not-allowed';
      } else {
        closeBtn.disabled = false;
        closeBtn.textContent = (okk ? '✔ ĐÓNG MC ' : 'ĐÓNG MC ') + cbNum;
        closeBtn.className = 'btn ' + (okk ? 'primary' : 'danger');
        closeBtn.style.opacity = '1'; closeBtn.style.cursor = 'pointer';
      }

      info.textContent = synced ? 'Tổ máy đã nối lưới – chỉnh P/Q tại trang Turbine'
        : n(g + '.mode') !== 1 ? 'Tổ máy chưa ở chế độ PHÁT ĐIỆN'
        : auto ? 'Chế độ SDQ200 tự động đang chạy – nút đóng tay đã khóa'
        : (strict && !okk) ? 'Liên động chặt (strict): chỉ mở khóa ĐÓNG MC khi rơle KĐB sáng xanh'
        : `Điều kiện đồng bộ: |ΔU| ≤ ${fx(lim.dv, 1)}%, |Δf| ≤ ${fx(lim.df, 2)} Hz, |Δφ| ≤ ${fx(lim.ph, 0)}°`;
    });
  }
  h('div', { class: 'card pad', style: 'margin-top:10px;color:#495057' }, root,
    'Quy trình hoà đồng bộ (Điều 9, 10, 21 & 23): Không hòa đồng thời 2 tổ máy. Ở chế độ HOÀ TỰ ĐỘNG (SDQ200), nút đóng tay bị khóa. Khi HOÀ TAY: chỉnh tần số để kim quay chậm theo chiều NHANH, cân bằng điện áp phía 35 kV (U MBA T1/T2 so với U TC 31/TC 32), khi rơle kiểm tra đồng bộ sáng xanh (theo ngưỡng cấu hình |ΔU| ≤ 5%, |Δf| ≤ 0,2 Hz, |Δφ| ≤ 12°) thì bấm ĐÓNG MC 331/332.');
});

// ================================================================== TRANG: SỰ KIỆN (SOE)
let soeSeq = 0;
const soeRows = [];
addPage('events', 'Sự kiện', root => {
  const c = h('div', { class: 'card pad' }, root);
  const r = h('div', { class: 'row' }, c);
  h('h3', { style: 'margin:0 12px 0 0' }, r, 'Sổ sự kiện (SOE)');
  const flt = h('select', {}, r, '<option value="">Tất cả</option><option value="ALM">Cảnh báo</option><option value="TRIP">Cắt máy</option><option value="CMD">Thao tác</option><option value="ERR">Thao tác sai / liên động</option><option value="FAULT">Sự cố GV</option><option value="POS">Vị trí thiết bị</option>');
  const q = h('input', { type: 'text', placeholder: 'Tìm…', style: 'width:200px' }, r);
  let soeSessionStart = 0;
  h('button', { class: 'btn', onclick: () => window.localApi && window.localApi.downloadSoeCsv(0) }, r, '⬇ Xuất CSV (tất cả)');
  h('button', { class: 'btn', onclick: () => window.localApi && window.localApi.downloadSoeCsv(soeSessionStart) }, r, '⬇ Xuất CSV buổi thực hành');
  const tb = h('div', { style: 'margin-top:8px;max-height:calc(100vh - 170px);overflow:auto' }, c);
  const colors = { ALM: '#c92a2a', TRIP: '#c92a2a', ERR: '#e8590c', FAULT: '#7048e8', CMD: '#1864ab', POS: '#495057', RTN: '#2b8a3e', SESSION: '#000', MODE: '#000' };
  function render() {
    const f = flt.value, s = q.value.toLowerCase();
    const list = soeRows.filter(x => (!f || x.k === f || (f === 'ALM' && x.k === 'RTN')) && (!s || x.t.toLowerCase().includes(s))).slice(-600).reverse();
    tb.innerHTML = '<table class="t"><tr><th style="width:150px">Thời gian</th><th style="width:70px">Loại</th><th style="width:60px">TB</th><th>Nội dung</th></tr>' +
      list.map(x => `<tr style="color:${colors[x.k] || '#000'}"><td>${new Date(x.ts).toLocaleString('vi-VN')}</td><td>${x.k}</td><td>${x.u}</td><td>${x.t.replace(/</g, '&lt;')}</td></tr>`).join('') + '</table>';
  }
  flt.onchange = render; q.oninput = render;
  async function load() {
    if (cur !== 'events') return;
    const d = await api('soe?since=' + soeSeq);
    if (d.recs.length) { d.recs.forEach(x => soeRows.push(x)); soeSeq = d.recs[d.recs.length - 1].seq; if (soeRows.length > 5000) soeRows.splice(0, soeRows.length - 5000); render(); }
    soeSessionStart = d.sessionStart || 0;
  }
  setInterval(load, 2000); setTimeout(load, 100);
});

// ================================================================== PHẦN B & C: 9 KỊCH BẢN THỰC HÀNH & HỘP ĐEN CHẤM ĐIỂM TỰ ĐỘNG
const SCENARIOS = [
  { id: 1, group: 1, short: 'KB 1 – Dừng dự phòng chuẩn (14/14)', desc: 'Cửa nhận nước mở, áp dầu HYZ 4,0 MPa, mở hết dao tiếp địa, MC 601/602 đóng, MC 331/332 cắt, đèn G ok xanh sẵn sàng khởi động.', page: 'turbine1' },
  { id: 2, group: 1, short: 'KB 2 – Đưa ĐK khởi động về 0 (Sau đại tu)', desc: 'Đóng cửa nhận nước, đóng dao tiếp địa tổ máy, phanh tác động, khoá cánh hướng, cấp khí đệm kín SC, mất tự dùng 0,4 kV.', page: 'main' },
  { id: 3, group: 1, short: 'KB 3 – Không tải – Sẵn sàng Hòa lưới', desc: 'Tổ máy 1 quay ổn định 214,3 v/ph (50 Hz), kích từ 6,3 kV, MC 601 đóng, MC 331 cắt, sẵn sàng hoà đồng bộ SDQ200 hoặc hoà tay.', page: 'sync' },
  { id: 4, group: 2, short: 'KB 4 – Phát định mức 2 tổ máy (2×8 MW)', desc: '2 tổ máy phát 8,0 MW / 4,0 MVAr mỗi tổ, DCL 321-1 đóng liên lạc TC 31 – TC 32. Thực hành dừng máy bình thường (Đ.25, Đ.28).', page: 'turbine1' },
  { id: 5, group: 2, short: 'KB 5 – Khởi động đen (Mất điện toàn trạm)', desc: 'Mất lưới 35 kV, mất tự dùng 0,4 kV, 2 tổ máy dừng. Thực hành khởi động Diesel 500 kVA & khởi động đen tổ máy.', page: 'auxpower' },
  { id: 6, group: 2, short: 'KB 6 – Chuyển đổi nguồn Tự dùng', desc: 'MF1 phát 6 MW dùng TD 61 (1AXT đóng), TD 32 dự phòng nóng (2AXT cắt). Chuyển nguồn sang TD 32 không hoà song song (Đ.2).', page: 'auxpower' },
  { id: 7, group: 3, short: 'KB 7 – Sự cố mất nước làm mát', desc: 'MF1 phát 7 MW, chuyển phụ trợ sang MANUAL & đóng van điện CW (áp chặn 0,48 MPa). Xử lý trước khi T dầu ổ đỡ > 55°C (Đ.12).', page: 'aux1' },
  { id: 8, group: 3, short: 'KB 8 – Mất tải đột ngột 35 kV', desc: 'Cắt đồng thời MC 371 & MC 372 khi 2 tổ máy đang phát 14 MW. Ổn định tốc độ, điện áp & tự dùng (Điều 48).', page: 'main' },
  { id: 9, group: 3, short: 'KB 9 – Tác động bảo vệ 87G tổ máy 1', desc: 'Sự cố so lệch dọc 87G MF1 (cắt 601, 331, MK Q1, HL10 G fault sáng, rơ le DGT 801 tác động). Xử lý & cô lập an toàn (Đ.45).', page: 'main' }
];

let activeScenarioId = 0;
async function applyScenario(id, silent) {
  activeScenarioId = id;
  const sc = SCENARIOS.find(x => x.id === id);
  if (online) {
    const r = await api('scenario', { id });
    if (r && r.ok !== false) {
      await poll();
      if (!silent && sc) toast('Đã nạp: ' + sc.short);
      return true;
    }
    return false;
  }
  if (window.HpsSim3D && typeof window.HpsSim3D.applyDemoScenario === 'function') {
    window.HpsSim3D.applyDemoScenario(id);
    runUpd();
    if (!silent && sc) toast('[Preview] Đã nạp: ' + sc.short);
    return true;
  }
  toast('Không kết nối được máy chủ mô phỏng', true);
  return false;
}

const AssessEngine = (() => {
  const st = {
    active: false, finished: false, mode: 'practice', student: '', scenarioId: 1,
    startMs: 0, endMs: 0, score: 0, penalty: 0, passed: false, fatalReason: '',
    checkpoints: [], audit: [], flags: {}, prevTripped: [false, false],
    prevRelays: [[], []], prevScCount: 0, timer: null, lastWarnText: '', finishPending: false,
    lastCmdSeq: -1, lastActiveSyncMs: 0, activeSyncTimer: null
  };

  let hudEl = null, hudPill = null, hudStudent = null, hudSc = null, hudTime = null,
    hudScoreBox = null, hudExamLock = null, hudScore = null, hudBar = null, hudWarn = null, hudWarnTxt = null,
    modalEl = null, authModalEl = null;

  function ensureUI() {
    if (!hudEl) {
      hudEl = h('div', { id: 'assessHud' }, null);
      const main = h('div', { class: 'ahud-main' }, hudEl);
      hudPill = h('span', { class: 'ahud-pill' }, main, '● ĐANG ĐÁNH GIÁ');
      const kv1 = h('div', { class: 'ahud-kv' }, main, '<span>Học viên:</span>');
      hudStudent = h('b', {}, kv1, '-');
      const kv2 = h('div', { class: 'ahud-kv' }, main, '<span>Kịch bản:</span>');
      hudSc = h('b', {}, kv2, '-');
      const kv3 = h('div', { class: 'ahud-kv' }, main, '<span>⏱</span>');
      hudTime = h('b', {}, kv3, '00:00');
      hudScoreBox = h('div', { class: 'ahud-score' }, main);
      hudScore = h('b', {}, hudScoreBox, '0 / 100');
      const bar = h('span', { class: 'ahud-bar' }, hudScoreBox);
      hudBar = h('i', { style: 'width:0%' }, bar);
      hudExamLock = h('span', { class: 'ahud-exam-lock' }, main, '🔒 Đang ghi Hộp đen — Ẩn điểm');
      h('span', { style: 'flex:1' }, main);
      h('button', { class: 'btn danger', style: 'padding:5px 11px;font-weight:700', onclick: () => requestFinish() }, main, '⏹ Kết thúc & Chấm điểm');
      hudWarn = h('div', { class: 'ahud-warn' }, hudEl);
      hudWarnTxt = h('span', {}, hudWarn, '');
      h('button', { class: 'btn', style: 'padding:2px 8px;font-size:11.5px', onclick: () => hudWarn.classList.remove('show') }, hudWarn, 'Ẩn');
      const hdr = document.querySelector('header');
      if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(hudEl, hdr.nextSibling);
      else document.body.insertBefore(hudEl, document.body.firstChild);
    }
    if (!modalEl) {
      modalEl = h('div', { id: 'assessModal', class: 'assess-modal hidden' }, document.body);
    }
    if (!authModalEl) {
      authModalEl = h('div', { id: 'assessAuthModal', class: 'assess-modal hidden' }, document.body);
    }
  }

  function requestFinish() {
    if (!st.active || st.finished) return;
    if (st.mode === 'exam') {
      ask('Kết thúc phiên Thi thử và xem biên bản chấm điểm?', () => finish(false));
    } else {
      finish(false);
    }
  }

  const fmtTime = sec => {
    const s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const elapsedSec = () => ((st.endMs || Date.now()) - st.startMs) / 1000;

  function logAudit(msg, ok = true, isViolation = false) {
    st.audit.push({ t: fmtTime(elapsedSec()), msg, ok, isViolation });
    if (isViolation && st.mode === 'practice' && hudWarn) {
      st.lastWarnText = msg;
      hudWarnTxt.textContent = '⚠ CẢNH BÁO VI PHẠM (CHẾ ĐỘ LUYỆN TẬP): ' + msg;
      hudWarn.classList.add('show');
    }
  }

  function buildCheckpoints(id) {
    const mk = (cid, name, pts, check) => ({ id: cid, name, pts, done: false, doneAt: '', check });
    const noEarth = gn => !on(`GS${gn}QE`) && !on(`GS33${gn}_${gn}4`) && !on(`GS33${gn}_${gn}5`);
    const u35Ok = () => Math.max(n('VbusZone1'), n('VbusZone2')) <= 38.65;
    switch (id) {
      case 1: return [
        mk('c1', 'Kiểm tra mở hết dao tiếp địa & xả khí đệm kín sửa chữa (Điều 20–21)', 20,
          () => (noEarth(1) && !on('G1.maintSeal')) || (noEarth(2) && !on('G2.maintSeal'))),
        mk('c2', 'Nguồn tự dùng 0,4 kV, dầu HYZ ≥ 3,5 MPa, nước làm mát CW & cửa nhận nước sẵn sàng', 20,
          () => n('V400') > 0.35 && on('IntakeGate') && ((n('G1.oilMPa') >= 3.5 && on('G1.cwValve')) || (n('G2.oilMPa') >= 3.5 && on('G2.cwValve')))),
        mk('c3', 'Đóng MC đầu cực 601/602, khởi động đạt 214,3 v/ph & kích từ đạt ~6,3 kV', 20,
          () => (on('CB601') && n('G1.speed') >= 204 && n('G1.Vgen') >= 5.9) || (on('CB602') && n('G2.speed') >= 204 && n('G2.Vgen') >= 5.9)),
        mk('c4', 'Hòa đồng bộ & đóng máy cắt khối 331/332 lên lưới an toàn (Điều 23)', 25,
          () => (on('CB331') && on('G1.grid')) || (on('CB332') && on('G2.grid'))),
        mk('c5', 'Tăng tải phát điện ổn định (P ≥ 2,0 MW) & giữ U thanh cái 35 kV ≤ 38,5 kV', 15,
          () => ((on('G1.grid') && n('G1.Pload') >= 1.8) || (on('G2.grid') && n('G2.Pload') >= 1.8)) && u35Ok())
      ];
      case 2: return [
        mk('c1', 'Mở hết dao nối đất tổ máy (1QE, 331-14, 331-15 / MF2), đóng DCL 331-1 & xả đệm kín SC', 20,
          () => (noEarth(1) && on('IS331_1') && !on('G1.maintSeal')) || (noEarth(2) && on('IS332_2') && !on('G2.maintSeal'))),
        mk('c2', 'Khôi phục tự dùng 0,4 kV, bơm dầu HYZ ≥ 3,5 MPa, mở cửa nhận nước & chuẩn bị nước CW', 20,
          () => n('V400') > 0.35 && on('IntakeGate') && ((n('G1.oilMPa') >= 3.5 && on('G1.cwValve')) || (n('G2.oilMPa') >= 3.5 && on('G2.cwValve')))),
        mk('c3', 'Nhả phanh, đóng MC 601/602 + MK, khởi động đạt 214,3 v/ph & kích từ ~6,3 kV', 20,
          () => (on('G1.airBrake') && on('CB601') && on('G1.fieldDischarge') && n('G1.speed') >= 204 && n('G1.Vgen') >= 5.9) ||
                (on('G2.airBrake') && on('CB602') && on('G2.fieldDischarge') && n('G2.speed') >= 204 && n('G2.Vgen') >= 5.9)),
        mk('c4', 'Hòa đồng bộ & đóng máy cắt khối 331/332 lên lưới an toàn (Điều 23)', 25,
          () => (on('CB331') && on('G1.grid')) || (on('CB332') && on('G2.grid'))),
        mk('c5', 'Tăng tải phát điện ổn định (P ≥ 2,0 MW) & giữ U thanh cái 35 kV ≤ 38,5 kV', 15,
          () => ((on('G1.grid') && n('G1.Pload') >= 1.8) || (on('G2.grid') && n('G2.Pload') >= 1.8)) && u35Ok())
      ];
      case 3: {
        const lim0 = syncLimits();
        return [
          mk('c1', `Điều chỉnh tần số MF1 vào dải đồng bộ (|Δf| ≤ ${fx(lim0.df, 2)} Hz)`, 20,
            () => on('CB331') || (n('G1.freq') > 45 && Math.abs(n('G1.freq') - (n('G1.busF') || 50)) <= syncLimits().df)),
          mk('c2', `Điều chỉnh điện áp MF1 vào dải đồng bộ (|ΔU| ≤ ${fx(lim0.dv, 1)}%)`, 20,
            () => { const bv = n('G1.busV') || 6.3; return on('CB331') || (n('G1.Vgen') > 4 && Math.abs(n('G1.Vgen') - bv) / bv * 100 <= syncLimits().dv); }),
          mk('c3', `Đóng máy cắt khối MC 331 đồng bộ an toàn (SDQ200 hoặc hòa tay |Δφ| ≤ ${fx(lim0.ph, 0)}°)`, 40,
            () => on('CB331') && on('G1.grid')),
          mk('c4', 'Nhận tải ổn định sau hòa lưới (P ≥ 2,0 MW) & giữ U_35kV ≤ 38,5 kV', 20,
            () => on('G1.grid') && n('G1.Pload') >= 1.8 && u35Ok())
        ];
      }
      case 4: return [
        mk('c1', 'Giảm công suất P, Q ít nhất 1 tổ máy về gần không tải (P ≤ 0,6 MW, |Q| ≤ 0,6 MVAr)', 25,
          () => (n('G1.Pload') <= 0.6 && Math.abs(n('G1.Qload')) <= 0.6) || (n('G2.Pload') <= 0.6 && Math.abs(n('G2.Qload')) <= 0.6)),
        mk('c2', 'Cắt máy cắt khối 331/332 & cắt kích từ tách tổ máy khỏi lưới (Điều 25)', 25,
          () => (!on('CB331') && n('G1.Vgen') < 1.5) || (!on('CB332') && n('G2.Vgen') < 1.5)),
        mk('c3', 'Đóng hoàn toàn cánh hướng về 0% (GV ≤ 1%) & đưa chốt khóa cánh hướng', 25,
          () => (!on('CB331') && n('G1.GV') <= 1.0 && on('G1.servoLock')) || (!on('CB332') && n('G2.GV') <= 1.0 && on('G2.servoLock'))),
        mk('c4', 'Dừng hẳn (n = 0 v/ph), giải trừ phanh, cấp khí đệm kín sửa chữa & cắt nước làm mát CW (Điều 28)', 25,
          () => (n('G1.speed') < 2 && on('G1.airBrake') && on('G1.maintSeal') && !on('G1.cwValve')) ||
                (n('G2.speed') < 2 && on('G2.airBrake') && on('G2.maintSeal') && !on('G2.cwValve')))
      ];
      case 5: return [
        mk('c1', 'Khởi động máy phát Diesel 500 kVA & đóng MC Diesel cấp điện thanh cái 0,4 kV', 30,
          () => on('dgEngine') && on('dgCb') && n('V400') > 0.35),
        mk('c2', 'Kiểm tra & chuẩn bị dầu áp lực HYZ ≥ 3,5 MPa, nước làm mát & cửa nhận nước sẵn sàng', 25,
          () => n('V400') > 0.35 && on('IntakeGate') && (n('G1.oilMPa') >= 3.5 || n('G2.oilMPa') >= 3.5)),
        mk('c3', 'Khởi động tổ máy đạt 214,3 v/ph (50 Hz) & kích từ đạt ~6,3 kV', 25,
          () => (n('G1.speed') >= 204 && n('G1.Vgen') >= 5.9) || (n('G2.speed') >= 204 && n('G2.Vgen') >= 5.9)),
        mk('c4', 'Đóng MC 331/332 cấp điện lên thanh cái 35 kV (chế độ độc lập khởi động đen)', 20,
          () => (on('CB331') || on('CB332')) && Math.max(n('VbusZone1'), n('VbusZone2')) > 32)
      ];
      case 6: return [
        mk('c1', 'Cắt máy cắt 1AXT (nguồn TD 61) trước – tuyệt đối không đóng song song với TD 32 (Điều 2)', 40,
          () => !on('AXT1') && !on('AXT2') ? (st.flags.cutAxt1 = true) : !!st.flags.cutAxt1),
        mk('c2', 'Đóng máy cắt 2AXT khôi phục nguồn tự dùng 0,4 kV ổn định từ TD 32 (V400 > 350 V)', 60,
          () => !!st.flags.cutAxt1 && !on('AXT1') && on('AXT2') && n('V400') > 0.35)
      ];
      case 7: return [
        mk('c1', 'Phát hiện sự cố mất nước làm mát CW & tác động trước khi dầu ổ đỡ đạt báo động 50°C', 25,
          () => (on('G1.cwValve') || on('G1.auxAuto')) && (n('G1.thrustOil') || n('G1.thrust')) < 50.5),
        mk('c2', 'Mở van điện CW (hoặc chuyển AUTO / chạy bơm) khôi phục áp & lưu lượng CW trước 55°C cắt máy', 45,
          () => on('G1.cwValve') && (on('G1.waterPump1') || on('G1.waterPump2')) && n('G1.cwMPa') >= 0.22 && !on('G1.tripped')),
        mk('c3', 'Duy trì tổ máy 1 phát điện liên tục an toàn sau khi khôi phục nước làm mát', 30,
          () => on('G1.cwValve') && n('G1.cwMPa') >= 0.28 && on('G1.grid') && n('G1.Pload') >= 2.0 && !on('G1.tripped'))
      ];
      case 8: return [
        mk('c1', 'Giám sát tốc độ sau mất tải 35 kV – không vượt tốc 145% cắt máy, tần số ổn định (48,5–51,5 Hz)', 25,
          () => elapsedSec() >= 3 && !on('G1.tripped') && !on('G2.tripped') && ((n('G1.freq') >= 48.5 && n('G1.freq') <= 51.5) || !on('G1.running'))),
        mk('c2', 'Ổn định điện áp thanh cái 35 kV (≤ 38,5 kV) & duy trì nguồn tự dùng 0,4 kV liên tục', 25,
          () => elapsedSec() >= 3 && u35Ok() && n('V400') > 0.34),
        mk('c3', 'Chủ động điều chỉnh / đưa tổ máy về chế độ không tải hoặc dừng bớt tổ máy an toàn (Điều 48)', 25,
          () => !!st.flags.actedKb8 && (n('G1.Pload') < 1.5 || n('G2.Pload') < 1.5 || !on('CB331') || !on('CB332'))),
        mk('c4', 'Khôi phục nối lưới 35 kV (đóng lại MC 371/372 an toàn) & giữ tổ máy vận hành ổn định', 25,
          () => (on('CB371') || on('CB372')) && n('V400') > 0.35 && !on('G1.tripped') && !on('G2.tripped'))
      ];
      case 9: return [
        mk('c1', 'Xác nhận tổ máy 1 đã dừng sự cố hoàn toàn (MC 601, 331, MK cắt; tốc độ giảm về 0 v/ph)', 25,
          () => !on('CB601') && !on('CB331') && !on('G1.fieldDischarge') && n('G1.speed') < 5),
        mk('c2', 'Duy trì tổ máy 2 & nguồn tự dùng 0,4 kV vận hành ổn định, không gây sự cố lan truyền', 25,
          () => elapsedSec() >= 4 && on('G2.grid') && !on('G2.tripped') && n('V400') > 0.35),
        mk('c3', 'Cô lập mạch nhất thứ tổ máy 1 bị sự cố 87G (mở DCL khối 331-1 sau khi MC 331 đã cắt)', 25,
          () => !on('CB331') && !on('IS331_1') && !on('CB601')),
        mk('c4', 'Đóng dao tiếp địa bảo vệ khối tổ máy 1 không điện (1QE hoặc 331-15) theo Điều 45', 25,
          () => !on('IS331_1') && !on('CB331') && !on('CB601') && (on('GS1QE') || on('GS331_15') || on('GS331_14')))
      ];
      default: return [];
    }
  }

  function serializeActive() {
    return {
      active: !!st.active,
      mode: st.mode,
      student: st.student,
      scenarioId: st.scenarioId,
      startMs: st.startMs,
      score: st.score,
      penalty: st.penalty || 0,
      fatalReason: st.fatalReason || '',
      checkpoints: st.checkpoints.map(c => ({ id: c.id, name: c.name, pts: c.pts, done: !!c.done, doneAt: c.doneAt || '' })),
      audit: st.audit.slice(-300),
      flags: st.flags || {},
      prevTripped: st.prevTripped,
      prevRelays: st.prevRelays,
      prevScCount: st.prevScCount,
      lastWarnText: st.lastWarnText || ''
    };
  }

  function syncActiveToServer(immediate = false) {
    if (!online) return;
    const doSend = () => {
      st.lastActiveSyncMs = Date.now();
      if (st.activeSyncTimer) { clearTimeout(st.activeSyncTimer); st.activeSyncTimer = null; }
      const payload = st.active ? serializeActive() : { active: false };
      api('assess/active', payload).catch(() => { });
    };
    if (immediate) { doSend(); return; }
    const wait = 1500 - (Date.now() - st.lastActiveSyncMs);
    if (wait <= 0) doSend();
    else if (!st.activeSyncTimer) st.activeSyncTimer = setTimeout(doSend, wait);
  }

  function applyHudVisuals(sc) {
    ensureUI();
    hudPill.className = 'ahud-pill' + (st.mode === 'exam' ? ' exam' : '');
    hudPill.textContent = st.mode === 'exam' ? '● THI SÁT HẠCH' : '● LUYỆN TẬP';
    hudStudent.textContent = st.student;
    hudSc.textContent = sc.short;
    hudTime.textContent = fmtTime(elapsedSec());
    if (st.mode === 'exam') {
      hudScoreBox.style.display = 'none';
      hudExamLock.style.display = 'inline-flex';
    } else {
      hudScoreBox.style.display = 'inline-flex';
      hudExamLock.style.display = 'none';
      hudScore.textContent = `${st.score} / 100`;
      hudBar.style.width = st.score + '%';
    }
    if (st.lastWarnText && st.mode === 'practice') {
      hudWarnTxt.textContent = '⚠ CẢNH BÁO VI PHẠM (CHẾ ĐỘ LUYỆN TẬP): ' + st.lastWarnText;
      hudWarn.classList.add('show');
    } else {
      hudWarn.classList.remove('show');
    }
    hudEl.classList.add('show');
    modalEl.classList.add('hidden');
    if (authModalEl) authModalEl.classList.add('hidden');
  }

  async function restoreFromServer() {
    if (!online || st.active) return;
    try {
      const d = await api('assess/active');
      if (!d || !d.active || !d.startMs) return;
      stopTimer();
      const sc = SCENARIOS.find(x => x.id === +d.scenarioId) || SCENARIOS[0];
      st.active = true; st.finished = false; st.finishPending = false;
      st.scenarioId = sc.id;
      st.student = d.student || 'Học viên thực hành';
      st.mode = d.mode === 'exam' ? 'exam' : 'practice';
      st.startMs = +d.startMs || Date.now();
      st.endMs = 0;
      st.score = +d.score || 0;
      st.penalty = +d.penalty || 0;
      st.passed = false;
      st.fatalReason = d.fatalReason || '';
      st.audit = Array.isArray(d.audit) ? d.audit : [];
      st.flags = (d.flags && typeof d.flags === 'object') ? d.flags : {};
      st.prevTripped = Array.isArray(d.prevTripped) && d.prevTripped.length === 2 ? d.prevTripped : [on('G1.tripped'), on('G2.tripped')];
      st.prevRelays = Array.isArray(d.prevRelays) && d.prevRelays.length === 2 ? d.prevRelays : [[...(S['G1.relays'] || [])], [...(S['G2.relays'] || [])]];
      st.prevScCount = typeof d.prevScCount === 'number' ? d.prevScCount : (S.scFaults || []).length;
      st.lastWarnText = d.lastWarnText || '';
      const savedMap = {};
      (d.checkpoints || []).forEach(c => { savedMap[c.id] = c; });
      st.checkpoints = buildCheckpoints(sc.id).map(cp => {
        const sv = savedMap[cp.id];
        if (sv && sv.done) { cp.done = true; cp.doneAt = sv.doneAt || ''; }
        return cp;
      });
      applyHudVisuals(sc);
      st.timer = setInterval(tick, 250);
      toast(`↻ Đã khôi phục phiên đánh giá: ${st.student} – ${sc.short}`);
    } catch (e) { }
  }

  function triggerFatal(reason) {
    if (!st.active || st.finished) return;
    st.fatalReason = reason;
    st.score = 0;
    st.passed = false;
    logAudit('LỖI NGHIÊM TRỌNG (ĐIỂM LIỆT): ' + reason, false, true);
    if (hudPill) { hudPill.className = 'ahud-pill fail'; hudPill.textContent = '✖ LỖI NGHIÊM TRỌNG'; }
    finish(true);
  }

  function onBlockedAttempt(kind, detail) {
    if (!st.active || st.finished) return;
    if (kind === 'AUX_PARALLEL') {
      triggerFatal('Đóng song song 2 nguồn Tự dùng (TD 61 / TD 32 / Diesel) – vi phạm Điều 2 QT: ' + detail);
    }
  }

  function onServerCommand(ev) {
    if (!ev || !ev.name) return;
    if (ev.seq != null && ev.seq <= st.lastCmdSeq) return;
    if (ev.seq != null) st.lastCmdSeq = ev.seq;
    if (!st.active || st.finished) return;
    onCommand(ev.name, ev.value, ev.source || 'Web', ev.pre || null);
  }

  function onCommand(name, value, source = 'Web', pre = null) {
    if (!st.active || st.finished) return;
    const u = String(name || '').toUpperCase();
    if (u === 'INTERLOCK') return;
    const srcTag = source || 'Web';
    const label = value !== undefined && value !== null ? `${name} = ${value}` : name;
    st.flags.actedKb8 = true;

    // 1. Bẫy 3: Đóng song song 2 MBA tự dùng TD 61 (1AXT) & TD 32 (2AXT) (Điều 2)
    if (u === 'AXT1') {
      const prevClosed = pre ? !!pre.prevClosed : on('AXT1');
      const otherAux = pre ? !!pre.otherAux : (on('AXT2') || on('dgCb'));
      if (!prevClosed && otherAux && (value === undefined || value === null || +value !== 0)) {
        triggerFatal(`[${srcTag}] Đóng MC 1AXT (TD 61) khi 2AXT (TD 32) hoặc Diesel đang đóng – vi phạm cấm đóng song song nguồn Tự dùng (Điều 2)!`);
        return;
      }
    }
    if (u === 'AXT2') {
      const prevClosed = pre ? !!pre.prevClosed : on('AXT2');
      const otherAux = pre ? !!pre.otherAux : (on('AXT1') || on('dgCb'));
      if (!prevClosed && otherAux && (value === undefined || value === null || +value !== 0)) {
        triggerFatal(`[${srcTag}] Đóng MC 2AXT (TD 32) khi 1AXT (TD 61) hoặc Diesel đang đóng – vi phạm cấm đóng song song nguồn Tự dùng (Điều 2)!`);
        return;
      }
    }

    // 2. Bẫy 4: Khởi động / hòa lưới đồng thời 2 tổ máy (Điều 10)
    if ((u === 'GEN1.MODE' || u === 'G1.MODE') && (+value === 1 || +value === 2 || +value === 3)) {
      const otherSt = pre ? !!pre.otherStarting : isUnitStartingOrSyncing(2);
      if (otherSt) {
        triggerFatal(`[${srcTag}] Ra lệnh khởi động / hoà tổ máy 1 trong khi tổ máy 2 đang khởi động/hoà lưới – vi phạm Điều 10 QT!`);
        return;
      }
    }
    if ((u === 'GEN2.MODE' || u === 'G2.MODE') && (+value === 1 || +value === 2 || +value === 3)) {
      const otherSt = pre ? !!pre.otherStarting : isUnitStartingOrSyncing(1);
      if (otherSt) {
        triggerFatal(`[${srcTag}] Ra lệnh khởi động / hoà tổ máy 2 trong khi tổ máy 1 đang khởi động/hoà lưới – vi phạm Điều 10 QT!`);
        return;
      }
    }

    // 3. Bẫy 5: Tác động phanh cơ khi tốc độ > 30% nđm (> 64,3 v/ph)
    if (u === 'GEN1.AIRBRAKE' || u === 'G1.AIRBRAKE') {
      const prevAb = pre ? !!pre.prevAirBrake : on('G1.airBrake');
      const spd = pre ? +pre.speed : n('G1.speed');
      const willApply = (value !== undefined && value !== null) ? (+value === 0) : prevAb;
      if (willApply && spd > 64.3) {
        triggerFatal(`[${srcTag}] Tác động phanh cơ khí MF1 khi tốc độ đang là ${fx(spd, 1)} v/ph (> 30% nđm = 64,3 v/ph) – nguy cơ phá hỏng guốc phanh & vành trượt!`);
        return;
      }
    }
    if (u === 'GEN2.AIRBRAKE' || u === 'G2.AIRBRAKE') {
      const prevAb = pre ? !!pre.prevAirBrake : on('G2.airBrake');
      const spd = pre ? +pre.speed : n('G2.speed');
      const willApply = (value !== undefined && value !== null) ? (+value === 0) : prevAb;
      if (willApply && spd > 64.3) {
        triggerFatal(`[${srcTag}] Tác động phanh cơ khí MF2 khi tốc độ đang là ${fx(spd, 1)} v/ph (> 30% nđm = 64,3 v/ph) – nguy cơ phá hỏng guốc phanh & vành trượt!`);
        return;
      }
    }

    // 4. Bẫy 2a: Đóng dao tiếp địa vào thiết bị đang có điện
    if (u.startsWith('GS')) {
      const prevClosed = pre ? !!pre.prevClosed : on(u);
      if (!prevClosed && (value === undefined || value === null || +value !== 0)) {
        const liveMap = {
          GS371_76: n('V371') > 1, GS371_75: on('IS371_7') && n('V371') > 1,
          GS371_15: (on('IS371_1') && n('VbusZone1') > 1) || (on('CB371') && on('IS371_7') && n('V371') > 1),
          GS372_76: n('V372') > 1, GS372_75: on('IS372_7') && n('V372') > 1,
          GS372_25: (on('IS372_2') && n('VbusZone2') > 1) || (on('CB372') && on('IS372_7') && n('V372') > 1),
          GS331_14: (on('IS331_1') && n('VbusZone1') > 1) || (on('CB331') && n('G1.V60') > 0.5),
          GS331_15: n('G1.V60') > 0.5 || (on('CB331') && on('IS331_1') && n('VbusZone1') > 1),
          GS332_24: (on('IS332_2') && n('VbusZone2') > 1) || (on('CB332') && n('G2.V60') > 0.5),
          GS332_25: n('G2.V60') > 0.5 || (on('CB332') && on('IS332_2') && n('VbusZone2') > 1),
          GS1QE: n('G1.Vgen') > 0.5 || n('G1.V60') > 0.5,
          GS2QE: n('G2.Vgen') > 0.5 || n('G2.V60') > 0.5
        };
        const isLive = pre ? !!pre.live : !!liveMap[u];
        if (isLive) {
          triggerFatal(`[${srcTag}] Đóng dao nối đất ${u.replace('GS', '').replace('_', '-')} vào phần thiết bị ĐANG MANG ĐIỆN – gây ngắn mạch 3 pha trực tiếp!`);
          return;
        }
      }
    }

    // 5. Bẫy 2b: Đóng máy cắt hòa lưới khi sai điều kiện đồng bộ (dùng chung ngưỡng PlantConfig)
    const isSyncCmd = (u === 'GEN1.SYNCCLOSE' || u === 'GEN2.SYNCCLOSE' || u === 'G1.SYNCCLOSE' || u === 'G2.SYNCCLOSE');
    const isCb33Close = (u === 'CB331' || u === 'CB332') && !(pre ? !!pre.prevClosed : on(u)) && (value === undefined || value === null || +value !== 0);
    if (isSyncCmd || isCb33Close) {
      const gn = (u.includes('2') ? 2 : 1);
      const gk = 'G' + gn + '.';
      const busV35 = pre ? +pre.busV35 : (gn === 1 ? n('VbusZone1') : n('VbusZone2'));
      const isClosed = pre ? !!pre.isClosed : on(`IS33${gn}_${gn}`);
      if (busV35 > 10 && isClosed) {
        const spd = pre ? +pre.speed : n(gk + 'speed');
        const vgen = pre ? +pre.vgen : n(gk + 'Vgen');
        const busF = n(gk + 'busF') || 50;
        const busV = n(gk + 'busV') || 6.3;
        const df = pre ? Math.abs(+pre.df) : Math.abs(n(gk + 'freq') - busF);
        const dv = pre ? Math.abs(+pre.dv) : (busV > 0.1 ? Math.abs(vgen - busV) / busV * 100 : 100);
        const ph = pre ? Math.abs(+pre.ph) : Math.abs(n(gk + 'phase'));
        if (spd < 180 || vgen < 3.0) {
          triggerFatal(`[${srcTag}] Đóng MC 33${gn} vào thanh cái 35 kV đang có điện khi MF${gn} chưa đạt tốc độ / chưa kích từ (đóng điện nhầm vào máy phát – bảo vệ 50/27)!`);
          return;
        }
        const lim = syncLimits();
        if (df > lim.df || dv > lim.dv || ph > lim.ph) {
          triggerFatal(`[${srcTag}] Hòa đồng bộ sai điều kiện MF${gn} (Δf=${fx(df, 2)} Hz, ΔU=${fx(dv, 1)}%, Δφ=${fx(ph, 0)}°; ngưỡng Δf≤${fx(lim.df, 2)} Hz, ΔU≤${fx(lim.dv, 1)}%, Δφ≤${fx(lim.ph, 0)}°) – gây dòng xung kích phá hỏng tổ máy!`);
          return;
        }
      }
    }

    // 6. KB 9 riêng: Cấm đóng lại MC 601 / MC 331 hoặc khởi động lại MF1 khi bảo vệ 87G chưa xử lý sự cố
    if (st.scenarioId === 9 && (u === 'CB601' || u === 'CB331' || u === 'GEN1.MODE' || u === 'G1.MODE' || u === 'GEN1.SYNCCLOSE') && (value === undefined || value === null || +value !== 0)) {
      triggerFatal(`[${srcTag}] Tự ý đóng lại máy cắt / khởi động lại MF1 khi bảo vệ so lệch dọc 87G vừa tác động chưa xử lý sự cố (vi phạm nghiêm trọng Điều 45)!`);
      return;
    }

    // 7. Liên động Điều 21 Bước 3: Bấm khởi động tổ máy hoặc mở cánh hướng khi chưa MỞ chốt khóa cánh hướng (Locking Pin)
    for (const gn of [1, 2]) {
      const locked = pre && pre.servoLock !== undefined ? !!pre.servoLock : (on(`G${gn}.gvLockPin`) || on(`G${gn}.servoLock`));
      const govAuto = pre && pre.govAuto !== undefined ? !!pre.govAuto : on(`G${gn}.govAuto`);
      const pidOn = pre && pre.pid !== undefined ? !!pre.pid : on(`G${gn}.pid`);
      const spd = pre && pre.speed !== undefined ? +pre.speed : n(`G${gn}.speed`);
      const isStartMode = (u === `GEN${gn}.MODE` || u === `G${gn}.MODE`) && (+value === 1 || +value === 2 || +value === 3);
      const isGovStart = (u === `GEN${gn}.GOVERNOR` || u === `G${gn}.GOVERNOR`) && !pidOn && spd < 5;
      const isManOpen = (u === `GEN${gn}.GVMAN` || u === `G${gn}.GVMAN`) && (+value > 0.5) && !govAuto;
      const isManInc = (u === `GEN${gn}.GVSTEP` || u === `G${gn}.GVSTEP`) && (+value > 0) && !govAuto;
      if ((isStartMode || isGovStart || isManOpen || isManInc) && locked) {
        st.penalty = (st.penalty || 0) + 10;
        logAudit(`VI PHẠM QUY TRÌNH (-10đ · Điều 21 Bước 3 · ${srcTag}): Khởi động / mở cánh hướng MF${gn} khi Chốt khóa cánh hướng (Locking Pin) ĐANG ĐÓNG!`, false, true);
        syncActiveToServer(true);
        return;
      }
    }

    logAudit(`Thao tác [${srcTag}]: ${label}`, true, false);
    syncActiveToServer(false);
  }

  function tick() {
    if (!st.active || st.finished) return;
    if (hudTime) hudTime.textContent = fmtTime(elapsedSec());
    const dtStart = elapsedSec();

    // Kiểm tra liên tục các bẫy điểm liệt vật lý (bỏ qua 1.2s đầu khi kịch bản vừa nạp)
    if (dtStart > 1.2) {
      // Đóng song song 1AXT & 2AXT
      if (on('AXT1') && on('AXT2')) {
        triggerFatal('Phát hiện 1AXT (TD 61) và 2AXT (TD 32) đóng song song – vi phạm Điều 2 QT!');
        return;
      }
      // Khởi động / hoà 2 tổ máy cùng lúc
      if (isUnitStartingOrSyncing(1) && isUnitStartingOrSyncing(2)) {
        triggerFatal('Hai tổ máy đang khởi động / hoà lưới đồng thời – vi phạm Điều 10 QT!');
        return;
      }
      // Ngắn mạch mới phát sinh do thao tác sai (đóng dao tiếp địa, hồ quang DCL)
      const scNow = (S.scFaults || []).length;
      if (scNow > st.prevScCount) {
        triggerFatal('Thao tác sai gây ngắn mạch / hồ quang điện: ' + (S.scFaults || []).join(', '));
        return;
      }
      // Bảo vệ rơ le tác động cắt máy mới phát sinh (87G, 50/51, 59, 40G, 46G, 12-145/155, dầu ổ đỡ >55°C...)
      for (const gn of [1, 2]) {
        const idx = gn - 1;
        const trNow = on(`G${gn}.tripped`);
        const relNow = S[`G${gn}.relays`] || [];
        const newRel = relNow.filter(r => !st.prevRelays[idx].includes(r) && !r.includes('-A ') && !r.startsWith('59N'));
        if ((trNow && !st.prevTripped[idx]) || newRel.length > 0) {
          const reason = newRel.length ? newRel.join(', ') : (S[`G${gn}.tripReason`] || 'Bảo vệ rơ le cắt tổ máy');
          triggerFatal(`Bảo vệ rơ le tác động cắt MF${gn} trong quá trình thao tác: ${reason}`);
          return;
        }
      }
    }

    // Đánh giá các Checkpoint (tổng 100 điểm)
    let pts = 0, changed = false;
    st.checkpoints.forEach(cp => {
      if (!cp.done) {
        let hit = false;
        try { hit = !!cp.check(); } catch (e) { }
        if (hit) {
          cp.done = true;
          cp.doneAt = fmtTime(elapsedSec());
          changed = true;
          logAudit(`Đạt tiêu chí (+${cp.pts}đ): ${cp.name}`, true, false);
          if (st.mode === 'practice') toast(`✔ +${cp.pts}đ: ${cp.name}`);
        }
      }
      if (cp.done) pts += cp.pts;
    });
    st.score = Math.max(0, pts - (st.penalty || 0));
    if (changed) syncActiveToServer(true);
    if (st.mode !== 'exam') {
      if (hudScore) hudScore.textContent = `${st.score} / 100`;
      if (hudBar) hudBar.style.width = st.score + '%';
      if (st.score >= 100 && !st.finishPending) {
        st.finishPending = true;
        setTimeout(() => { if (st.active && !st.finished) finish(false); }, 1100);
      }
    }
  }

  async function start(scenarioId, studentName, mode) {
    const targetMode = mode === 'exam' ? 'exam' : 'practice';
    ensureUI();
    stopTimer();
    const sc = SCENARIOS.find(x => x.id === +scenarioId) || SCENARIOS[0];
    st.active = false; st.finished = false; st.finishPending = false;
    st.scenarioId = sc.id;
    st.student = (studentName || '').trim() || 'Học viên thực hành';
    st.mode = targetMode;
    st.score = 0; st.penalty = 0; st.passed = false; st.fatalReason = '';
    st.audit = []; st.flags = {}; st.lastWarnText = '';
    st.checkpoints = buildCheckpoints(sc.id);

    // Tự động tải kịch bản & chuyển INTERLOCK sang chế độ TỰ NHIÊN (vật lý thực tế)
    await applyScenario(sc.id, true);
    if (online) await api('set', { name: 'INTERLOCK', value: 0, cid: CLIENT_ID });
    else S.interlock = 'natural';
    if (online) await poll();

    st.active = true;
    st.startMs = Date.now(); st.endMs = 0;
    st.prevTripped = [on('G1.tripped'), on('G2.tripped')];
    st.prevRelays = [[...(S['G1.relays'] || [])], [...(S['G2.relays'] || [])]];
    st.prevScCount = (S.scFaults || []).length;

    logAudit(`Bắt đầu phiên đánh giá [${st.mode === 'exam' ? 'THI SÁT HẠCH' : 'LUYỆN TẬP'}] – ${sc.short} (Liên động: TỰ NHIÊN)`, true, false);
    if (online) api('session', { start: true, name: `${st.student} – ${sc.short}` }).catch(() => { });
    syncActiveToServer(true);

    applyHudVisuals(sc);

    st.timer = setInterval(tick, 250);
    toast(`▶ Bắt đầu đánh giá: ${sc.short}`);
    if (sc.page) show(sc.page);
  }

  function stopTimer() {
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    if (st.activeSyncTimer) { clearTimeout(st.activeSyncTimer); st.activeSyncTimer = null; }
  }

  function buildReportObject() {
    const sc = SCENARIOS.find(x => x.id === st.scenarioId) || { short: 'KB ' + st.scenarioId };
    const endMs = st.endMs || Date.now();
    const violations = st.audit.filter(a => a.isViolation || !a.ok);
    return {
      student: st.student,
      scenarioId: st.scenarioId,
      scenarioName: sc.short,
      mode: st.mode,
      startMs: st.startMs,
      endMs,
      durationSec: Math.max(0, Math.round((endMs - st.startMs) / 1000)),
      score: st.score,
      penalty: st.penalty || 0,
      passed: st.passed,
      fatalReason: st.fatalReason || '',
      checkpoints: st.checkpoints.map(c => ({ id: c.id, name: c.name, pts: c.pts, done: !!c.done, doneAt: c.doneAt || '' })),
      audit: st.audit.slice(),
      violations
    };
  }

  function buildPlainReport(rep) {
    const r = rep || buildReportObject();
    const scName = r.scenarioName || ((SCENARIOS.find(x => x.id === r.scenarioId) || { short: 'KB ' + r.scenarioId }).short);
    const dur = r.durationSec != null ? fmtTime(r.durationSec) : fmtTime(elapsedSec());
    const lines = [
      '====================================================',
      'BIÊN BẢN ĐÁNH GIÁ THỰC HÀNH VẬN HÀNH NMTĐ ĐRÂY H\'LINH 2',
      '====================================================',
      `Học viên / Nhóm : ${r.student || '-'}`,
      `Kịch bản        : ${scName}`,
      `Chế độ          : ${r.mode === 'exam' ? 'Thi sát hạch (Ghi log âm thầm)' : (r.verified === false ? 'Luyện tập – không xác thực' : 'Luyện tập (Có cảnh báo nhắc lỗi)')}`,
      ...(r.endMs ? [`Thời điểm       : ${new Date(r.endMs).toLocaleString('vi-VN')}`] : []),
      `Thời gian       : ${dur}`,
      `Kết quả         : ${r.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'} (${r.score} / 100 điểm${r.penalty ? `, trừ ${r.penalty}đ lỗi quy trình` : ''})`,
      ...(r.fatalReason ? [`LỖI ĐIỂM LIỆT   : ${r.fatalReason}`] : []),
      '',
      '--- CHI TIẾT TIÊU CHÍ CHẤM ĐIỂM ---',
      ...(r.checkpoints || []).map((c, i) => `${i + 1}. [${c.done ? '✔ +' + c.pts + 'đ @ ' + (c.doneAt || '') : '✖ 0/' + c.pts + 'đ'}] ${c.name}`),
      '',
      '--- NHẬT KÝ THAO TÁC (AUDIT LOG) ---',
      ...(r.audit || []).map(a => `[${a.t}] ${a.ok ? '✔' : '✖'} ${a.msg}`)
    ];
    return lines.join('\n');
  }

  function finish(fromFatal) {
    if (!st.active && st.finished) return;
    stopTimer();
    st.active = false;
    st.finished = true;
    st.endMs = Date.now();
    if (fromFatal || st.fatalReason) {
      st.score = 0;
      st.passed = false;
    } else {
      st.passed = st.score >= 70;
    }
    logAudit(`Kết thúc phiên đánh giá: ${st.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'} – Tổng điểm ${st.score}/100`, st.passed, !st.passed);
    if (hudEl) hudEl.classList.remove('show');
    if (authModalEl) authModalEl.classList.add('hidden');
    const rep = buildReportObject();
    if (online) {
      api('session', { start: false }).catch(() => { });
      syncActiveToServer(true);
      api('assess/report', rep).then(j => {
        if (j && j.ok) {
          rep.id = j.id;
          rep.verified = true;
          if (typeof window._refreshAssessHistory === 'function') window._refreshAssessHistory();
        }
      }).catch(() => { });
    }
    renderModal(rep);
  }

  function renderModal(rep) {
    ensureUI();
    const r = rep || buildReportObject();
    const scName = r.scenarioName || ((SCENARIOS.find(x => x.id === r.scenarioId) || { short: 'KB ' + r.scenarioId }).short);
    const durStr = r.durationSec != null ? fmtTime(r.durationSec) : fmtTime(elapsedSec());
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cps = r.checkpoints || [];
    const aud = r.audit || [];
    const cpRows = cps.map((c, i) => `
      <tr>
        <td style="width:36px;text-align:center">${i + 1}</td>
        <td>${esc(c.name)}</td>
        <td style="width:110px;text-align:center;font-weight:700;color:${c.done ? '#2b8a3e' : '#c92a2a'}">${c.done ? '✔ Đạt (' + esc(c.doneAt) + ')' : '✖ Chưa đạt'}</td>
        <td class="n" style="width:74px"><b>${c.done ? c.pts : 0} / ${c.pts}</b></td>
      </tr>`).join('');
    const logRows = aud.map(a => `
      <tr class="${a.ok ? 'ok-row' : 'err-row'}">
        <td style="width:66px;text-align:center">${esc(a.t)}</td>
        <td>${esc(a.msg)}</td>
        <td style="width:52px;text-align:center">${a.ok ? '✔' : '✖'}</td>
      </tr>`).join('');

    modalEl.innerHTML = `<div class="assess-box">
      <div class="assess-hdr">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="assess-verdict ${r.passed ? 'pass' : 'fail'}">${r.passed ? '✔ ĐẠT' : '✖ KHÔNG ĐẠT'}</span>
          <div>
            <div style="font-weight:800;font-size:15px">${esc(scName)}</div>
            <div style="font-size:12.5px;color:#cbd5e1">Học viên: <b>${esc(r.student)}</b> · Thời gian: <b>${esc(durStr)}</b> · Chế độ: ${r.mode === 'exam' ? 'Thi sát hạch' : (r.verified === false ? 'Luyện tập – không xác thực' : 'Luyện tập')}${r.endMs ? ' · ' + esc(new Date(r.endMs).toLocaleString('vi-VN')) : ''}</div>
          </div>
        </div>
        <div class="assess-score-big">${r.score} / 100 điểm</div>
      </div>
      <div class="assess-body">
        <div id="amSaveErr" class="assess-fatal" style="display:none"></div>
        ${r.fatalReason ? `<div class="assess-fatal">🚨 LỖI NGHIÊM TRỌNG (ĐIỂM LIỆT – 0 ĐIỂM): ${esc(r.fatalReason)}</div>` : ''}
        <div>
          <h3 style="margin:0 0 6px">Bảng chi tiết điểm theo tiêu chí quy trình</h3>
          <table class="t"><tr><th>#</th><th>Tiêu chí đánh giá</th><th>Trạng thái</th><th>Điểm</th></tr>${cpRows}</table>
        </div>
        <div>
          <h3 style="margin:0 0 6px">Nhật ký thao tác theo thời gian thực (Audit Log – ${aud.length} mục)</h3>
          <div class="assess-log"><table class="t"><tr><th>Thời gian</th><th>Nội dung thao tác / sự kiện</th><th>KQ</th></tr>${logRows}</table></div>
        </div>
      </div>
      <div class="assess-foot">
        <button id="amCopy" class="btn">📋 Sao chép biên bản</button>
        <button id="amCsv" class="btn primary">⬇ Xuất CSV lịch sử</button>
        <button id="amClose" class="btn">Đóng</button>
      </div>
    </div>`;
    modalEl.classList.remove('hidden');

    $('amCopy').onclick = () => {
      const txtReport = buildPlainReport(r);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txtReport).then(() => toast('Đã sao chép biên bản đánh giá vào bộ nhớ tạm!')).catch(() => fallbackCopy(txtReport));
      } else fallbackCopy(txtReport);
    };
    $('amCsv').onclick = () => {
      if (window.localApi) window.localApi.downloadAssessCsv('');
    };
    $('amClose').onclick = () => modalEl.classList.add('hidden');
  }

  function fallbackCopy(txtReport) {
    const ta = document.createElement('textarea');
    ta.value = txtReport; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Đã sao chép biên bản đánh giá!'); } catch (e) { toast('Không thể sao chép tự động', true); }
    ta.remove();
  }

  return { start, finish, onCommand, onServerCommand, onBlockedAttempt, restoreFromServer, showReport: renderModal, getState: () => st };
})();
window.AssessEngine = AssessEngine;

// ================================================================== TRANG: TỰ CHẤM ĐIỂM & KỊCH BẢN THỰC HÀNH
addPage('assess', 'Tự chấm điểm', root => {
  // ---- PHẦN B: THIẾT LẬP NHANH 9 KỊCH BẢN THỰC HÀNH (QUICK SCENARIOS) ----
  const scCard = h('div', { class: 'card pad' }, root);
  const scHdr = h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:8px' }, scCard);
  h('h3', { style: 'margin:0' }, scHdr, '⚡ Thiết lập nhanh kịch bản thực hành (9 Quick Scenarios – Đrây H\'Linh 2)');
  const scAct = h('div', { class: 'row', style: 'gap:6px' }, scHdr);
  h('button', { class: 'btn danger', onclick: () => ask('Xoá toàn bộ sự cố, giải trừ bảo vệ hai tổ máy?', () => api('faults/clear', {}).then(r => r.ok && toast('Đã xoá sự cố'))) }, scAct, 'XOÁ TẤT CẢ SỰ CỐ');
  h('button', { class: 'btn', onclick: () => ask('Khôi phục toàn bộ trạng thái nhà máy về mặc định ban đầu? (Lịch sử tự chấm điểm vẫn được giữ lại)', () => api('plant/reset', {}).then(r => { if (r.ok) { soeRows.length = 0; soeSeq = 0; toast('Đã khôi phục nhà máy về mặc định'); poll(); } })) }, scAct, '↺ Khôi phục nhà máy mặc định');

  const scGrid = h('div', { class: 'sc-grid' }, scCard);
  const scBtns = {};
  const scGroups = [
    { id: 1, cls: 'g1', title: '▶ Nhóm 1: Khởi động & Hòa lưới' },
    { id: 2, cls: 'g2', title: '⚡ Nhóm 2: Vận hành & Phương thức lưới' },
    { id: 3, cls: 'g3', title: '🚨 Nhóm 3: Diễn tập Sự cố (Đrây H\'Linh 2)' }
  ];
  scGroups.forEach(gr => {
    const box = h('div', { class: 'sc-group' }, scGrid);
    h('div', { class: 'sc-gtitle ' + gr.cls }, box, gr.title);
    SCENARIOS.filter(s => s.group === gr.id).forEach(sc => {
      const b = h('button', { class: 'sc-btn' }, box, `<b>${sc.short}</b><small>${sc.desc}</small>`);
      b.onclick = () => {
        applyScenario(sc.id, false).then(ok => {
          if (ok) Object.entries(scBtns).forEach(([k, elBtn]) => elBtn.classList.toggle('act', +k === sc.id));
        });
      };
      scBtns[sc.id] = b;
    });
  });

  // ---- PHẦN C: HỆ THỐNG HỘP ĐEN GIÁM SÁT & TỰ CHẤM ĐIỂM ----
  const asCard = h('div', { class: 'card pad assess-cfg' }, root);
  h('h3', { style: 'margin:0 0 8px' }, asCard, '🎯 Hộp đen Giám sát & Tự chấm điểm thực hành (Black-Box Assessment)');
  const asRow = h('div', { class: 'row' }, asCard);
  const asSel = h('select', { style: 'min-width:290px;font-weight:600' }, asRow,
    SCENARIOS.map(sc => `<option value="${sc.id}">${sc.short}</option>`).join(''));
  const asNm = h('input', { type: 'text', placeholder: 'Tên học viên / Nhóm thực hành', style: 'width:240px' }, asRow);
  const asModes = h('div', { class: 'assess-modes' }, asRow);
  const lbPrac = h('label', { class: 'assess-radio' }, asModes, '<input type="radio" name="asMode" value="practice" checked> 🎓 Luyện tập (Có cảnh báo nhắc lỗi)');
  const lbExam = h('label', { class: 'assess-radio' }, asModes, '<input type="radio" name="asMode" value="exam"> 📝 Thi thử (Ghi log âm thầm)');
  h('button', {
    class: 'btn primary', style: 'font-weight:800;padding:8px 16px',
    onclick: () => {
      const modeVal = lbExam.querySelector('input').checked ? 'exam' : 'practice';
      AssessEngine.start(+asSel.value, asNm.value, modeVal);
    }
  }, asRow, '▶ BẮT ĐẦU TỰ CHẤM ĐIỂM');
  h('div', { style: 'font-size:12px;color:var(--muted);margin-top:6px' }, asCard,
    'Khi bắt đầu: hệ thống tự nạp kịch bản, chuyển Liên động sang chế độ TỰ NHIÊN (thao tác sai gây sự cố thật), bật thanh HUD theo dõi 250ms & chấm điểm thang 100 kèm bẫy điểm liệt (0 điểm). Kết quả được lưu cục bộ trên trình duyệt (localStorage).');

  // ---- LỊCH SỬ TỰ CHẤM ĐIỂM (LƯU TRONG LOCALSTORAGE) ----
  const histCard = h('div', { class: 'card pad', style: 'margin-top:10px' }, root);
  const histHdr = h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:8px' }, histCard);
  h('h3', { style: 'margin:0' }, histHdr, '📋 Lịch sử tự chấm điểm (lưu trên trình duyệt)');
  const histCtrl = h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, histHdr);
  const histQ = h('input', { type: 'text', placeholder: 'Lọc theo tên học viên…', style: 'width:220px' }, histCtrl);
  h('button', { class: 'btn', onclick: () => loadAssessHistory() }, histCtrl, '🔄 Tải lại');
  h('button', { class: 'btn primary', onclick: () => downloadAssessCsv() }, histCtrl, '⬇ Xuất CSV');
  h('button', { class: 'btn danger', onclick: () => ask('Xoá toàn bộ lịch sử tự chấm điểm lưu trên trình duyệt?', () => api('assess/clear', {}).then(() => { toast('Đã xoá lịch sử tự chấm điểm'); loadAssessHistory(); })) }, histCtrl, '🗑 Xoá lịch sử');
  const histWrap = h('div', { style: 'margin-top:8px;max-height:300px;overflow:auto' }, histCard, 'Đang tải…');

  const escHist = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtDur = sec => { const s = Math.max(0, Math.floor(+sec || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function downloadAssessCsv() {
    if (!window.localApi) { toast('Bộ mô phỏng chưa sẵn sàng', true); return; }
    window.localApi.downloadAssessCsv(histQ.value.trim());
  }
  async function loadAssessHistory() {
    try {
      const qv = histQ.value.trim();
      const rows = await api('assess/reports' + (qv ? '?student=' + encodeURIComponent(qv) : ''));
      if (!Array.isArray(rows) || !rows.length) {
        histWrap.innerHTML = '<div style="color:#6b7785;padding:6px">Chưa có biên bản tự chấm điểm nào.</div>';
        return;
      }
      histWrap.innerHTML = '';
      const tb = h('table', { class: 't' }, histWrap);
      h('tr', {}, tb, '<th>Thời gian</th><th>Học viên</th><th>Kịch bản</th><th>Chế độ</th><th>Thời lượng</th><th>Điểm</th><th>Kết quả</th><th style="width:92px">Biên bản</th>');
      rows.forEach(item => {
        const tr = h('tr', {}, tb);
        const dtStr = item.endMs ? new Date(item.endMs).toLocaleString('vi-VN') : '-';
        h('td', { style: 'white-space:nowrap' }, tr, escHist(dtStr));
        h('td', {}, tr, '<b>' + escHist(item.student || '-') + '</b>');
        h('td', {}, tr, escHist(item.scenarioName || ('KB ' + item.scenarioId)));
        const modeHtml = item.mode === 'exam' ? 'Thi thử' : 'Luyện tập';
        h('td', {}, tr, modeHtml);
        h('td', { class: 'n' }, tr, fmtDur(item.durationSec));
        h('td', { class: 'n' }, tr, `<b>${item.score}/100</b>` + (item.checkpointTotal ? ` <small style="color:#6b7785">(${item.checkpointDone}/${item.checkpointTotal})</small>` : ''));
        h('td', { style: `font-weight:700;color:${item.passed ? '#2b8a3e' : '#c92a2a'}` }, tr, item.passed ? '✔ ĐẠT' : '✖ KHÔNG ĐẠT');
        const tdAct = h('td', { style: 'text-align:center' }, tr);
        h('button', {
          class: 'btn',
          onclick: async () => {
            const full = await api('assess/report?id=' + encodeURIComponent(item.id));
            if (full && !full.error) AssessEngine.showReport(full);
          }
        }, tdAct, 'Xem lại');
      });
    } catch (e) {
      histWrap.innerHTML = '<div style="color:#c92a2a;padding:6px">Không tải được lịch sử tự chấm điểm.</div>';
    }
  }
  let histTimer = null;
  histQ.oninput = () => { clearTimeout(histTimer); histTimer = setTimeout(loadAssessHistory, 250); };
  window._refreshAssessHistory = loadAssessHistory;
  setTimeout(loadAssessHistory, 200);

  // ---- ĐIỀU KIỆN LƯỚI, LIÊN ĐỘNG & LƯU LƯỢNG NƯỚC ----
  const c2 = h('div', { class: 'card pad', style: 'margin-top:10px' }, root);
  h('h3', { style: 'margin:0 0 8px' }, c2, 'Mô hình vật lý – điều kiện lưới, liên động & lưu lượng nước');
  const pc = h('div', {}, c2);
  const r1 = h('div', { class: 'row' }, pc);
  const bIl = h('button', { class: 'btn', onclick: () => set('INTERLOCK') }, r1, '');
  const bGr = h('button', { class: 'btn', onclick: () => ask(on('gridOk') ? 'Mô phỏng mất điện lưới 110 kV phía TBA (nhà máy phải chạy độc lập)?' : 'Khôi phục lưới?', () => set('GRIDLOST')) }, r1, '');
  const rr = h('div', { class: 'row', style: 'margin-top:8px' }, pc);
  h('span', { style: 'width:190px' }, rr, 'Lưu lượng nước về hồ');
  const inf = h('input', { type: 'range', min: 0, max: 2.5, step: 0.05, style: 'width:200px' }, rr);
  const iv = h('b', {}, rr, '');
  let edInf = false;
  inf.oninput = () => { edInf = true; iv.textContent = (+inf.value).toFixed(2); };
  inf.onchange = () => { set('INFLOW', +inf.value); setTimeout(() => edInf = false, 1500); };
  U(() => { if (!edInf) { inf.value = n('inflow'); iv.textContent = fx(n('inflow'), 2) + ' – cột nước ' + fx(n('HeadHigh'), 1) + ' m'; } });
  function slider(label, key, min, max, step, unit) {
    const r = h('div', { class: 'row' }, pc); h('span', { style: 'width:190px' }, r, label);
    const i = h('input', { type: 'range', min, max, step, style: 'width:200px' }, r); const v = h('b', {}, r, ''); let e = false;
    i.oninput = () => { e = true; v.textContent = (+i.value).toFixed(2) + ' ' + unit; };
    i.onchange = () => { set(key.toUpperCase(), +i.value); setTimeout(() => e = false, 1500); };
    U(() => { if (!e) { const x = n(key); i.value = x; v.textContent = fx(x, 2) + ' ' + unit; } });
  }
  slider('Phụ tải TBA 35 kV (P)', 'tbaLoad', 0, 20, 0.1, 'MW');
  slider('Phụ tải TBA 35 kV (Q)', 'tbaLoadQ', 0, 10, 0.1, 'MVAr');
  slider('Tăng tốc quá trình nhiệt', 'thermalSpeed', 1, 60, 1, 'lần');
  const ps = h('div', { style: 'font-size:13px;margin-top:6px' }, pc);
  U(() => {
    bIl.textContent = 'Liên động: ' + (S.interlock === 'strict' ? 'CẤM thao tác sai' : 'TỰ NHIÊN (mô phỏng hậu quả)'); bIl.className = 'btn' + (S.interlock === 'strict' ? ' on' : '');
    bGr.textContent = on('gridOk') ? 'Lưới 110 kV: CÓ ĐIỆN' : 'Lưới 110 kV: MẤT ĐIỆN'; bGr.className = 'btn' + (on('gridOk') ? '' : ' danger');
    ps.innerHTML = `TBA: <b>${fx(n('tbaKV'), 2)} kV – ${fx(n('tbaHz'), 2)} Hz</b> · Tự dùng ${fx(n('auxKW'), 0)} kW · Ngắn mạch đang có: ${(S.scFaults || []).join(', ') || 'không'} · Rơ le đường dây: ${(S.lineRelays || []).join(', ') || 'không'}`;
  });
});

// ================================================================== TRANG: THÔNG SỐ VẬT LÝ
addPage('physics', 'Thông số vật lý', root => {
  const g = h('div', { class: 'grid2' }, root);
  [1, 2].forEach(u => {
    const c = h('div', { class: 'card pad' }, g); h('h3', {}, c, 'Tổ máy ' + u);
    const d = h('div', {}, c); const k = 'G' + u + '.';
    const row = (a, b) => `<tr><th style="width:46%">${a}</th><td>${b}</td></tr>`;
    U(() => {
      const rl = S[k + 'relays'] || [];
      d.innerHTML = '<table class="t">' +
        row('Bước trình tự', `<b>${S[k + 'seq'] || ''}</b> (${S[k + 'seqState'] || ''})`) +
        row('Chế độ điều tốc', S[k + 'gov'] || '') +
        row('Tốc độ / cánh hướng / cánh BXCT', `${fx(n(k + 'speed'), 1)} v/ph · ${fx(n(k + 'GV'), 1)} % · ${fx(n(k + 'blade'), 1)} %`) +
        row('Cột nước / lưu lượng', `${fx(n(k + 'head'), 1)} m · ${fx(n(k + 'flow'), 2)} m³/s`) +
        row('Pcơ / Pđặt / Qđặt', `${fx(n(k + 'Pm'), 2)} MW · ${fx(n(k + 'Pset'), 2)} MW · ${fx(n(k + 'Qset'), 2)} MVAr`) +
        row('Efd (pu) / dòng thứ tự nghịch', `${fx(n(k + 'efd'), 2)} · ${fx(n(k + 'i2'), 0)} A`) +
        row('Áp lực dầu HYZ / nước kỹ thuật', `${fx(n(k + 'oilMPa'), 2)} MPa · ${fx(n(k + 'cwMPa'), 2)} MPa`) +
        row('Mực nước nắp turbine', `${fx(n(k + 'headCover'), 0)} mm`) +
        row('Gió lạnh / gió nóng / lõi thép stator', `${fx(n(k + 'coldAir'), 1)} · ${fx(n(k + 'hotAir'), 1)} · ${fx(n(k + 'core'), 1)} °C`) +
        row('Dầu ổ đỡ / bạc hướng turbine', `${fx(n(k + 'thrustOil'), 1)} · ${fx(n(k + 'turbPad'), 1)} °C`) +
        row('MBA chính: dầu / cuộn dây', `${fx(n(k + 'trOil'), 1)} · ${fx(n(k + 'trWinding'), 1)} °C`) +
        row('Tổn hao đồng / sắt / rotor', `${fx(n(k + 'lossCu'), 1)} · ${fx(n(k + 'lossFe'), 1)} · ${fx(n(k + 'lossRotor'), 1)} kW`) +
        row('Rơ le đã tác động', rl.length ? '<b style="color:#c92a2a">' + rl.join('<br>') + '</b>' : 'không') + '</table>';
    });
  });
  const c = h('div', { class: 'card pad', style: 'margin-top:10px' }, root); h('h3', {}, c, 'Hồ chứa – trạm bơm – khí nén – lưới');
  const d = h('div', {}, c);
  U(() => {
    d.innerHTML = `<table class="t"><tr><th>MN thượng lưu / hạ lưu</th><td>${fx(n('zUp'), 2)} / ${fx(n('zTail'), 2)} m <span class="muted">(+${fx(n('zUp') + 273.8, 2)} / +${fx(n('zTail') + 273.8, 2)})</span></td><th>Nước về / tràn tự do</th><td>${fx(n('inflowM3s'), 2)} / ${fx(n('qSpill'), 2)} m³/s</td></tr>
      <tr><th>Hố tập trung / hố thoát nước</th><td>${fx(n('sump'), 2)} / ${fx(n('drain'), 2)} m</td><th>Thùng dầu rò</th><td>${fx(n('oilLeak'), 3)} m</td></tr>
      <tr><th>Khí nén hạ áp / cao áp</th><td>${fx(n('lpAir'), 2)} / ${fx(n('hpAir'), 2)} MPa</td><th>Phụ tải tự dùng</th><td>${fx(n('auxKW'), 0)} kW</td></tr>
      <tr><th>Thanh cái 6,3 kV MF1 / MF2</th><td>${fx(n('V6_1'), 2)} / ${fx(n('V6_2'), 2)} kV</td><th>TBA 110/35 kV</th><td>${fx(n('tbaKV'), 2)} kV · ${fx(n('tbaHz'), 2)} Hz · ${on('gridOk') ? 'có lưới' : '<b style="color:#c92a2a">mất lưới</b>'}</td></tr></table>`;
  });
});

// (Trang Mặt cắt tổ máy đã được gộp trực tiếp vào Turbine 1 & Turbine 2)

// ================================================================== TRANG: BẢO VỆ RƠ LE (trị số chỉnh định, áp dụng ngay)
const RELAY_ROWS = [
  ['Máy phát', '87G', 'So lệch dọc máy phát', [['g87Pickup', 'Ngưỡng dòng so lệch', 'pu In']]],
  ['Máy phát', '87GT', 'So lệch khối máy phát – MBA', [['t87Pickup', 'Ngưỡng dòng so lệch', 'pu In']]],
  ['Máy phát', '50G', 'Quá dòng cắt nhanh', [['g50Pickup', 'Dòng khởi động', 'pu In'], ['g50Sec', 'Thời gian', 's']]],
  ['Máy phát', '51G', 'Quá dòng có thời gian / quá tải', [['g51Pickup', 'Dòng khởi động', 'pu In'], ['g51Sec', 'Thời gian', 's']]],
  ['Máy phát', '21G', 'Bảo vệ khoảng cách (tổng trở)', [['g21Z', 'Tổng trở khởi động', 'pu'], ['g21Sec1', 't1', 's'], ['g21Sec2', 't2', 's']]],
  ['Máy phát', '46G', 'Quá dòng thứ tự nghịch', [['g46Alarm', 'Ngưỡng báo tín hiệu I2', 'pu'], ['g46Trip', 'Ngưỡng cắt I2', 'pu'], ['g46Sec1', 't1', 's'], ['g46Sec2', 't2', 's']]],
  ['Máy phát', '40G', 'Mất kích từ', [['g40Q', 'Q nhận từ lưới', 'pu'], ['g40V', 'Điện áp kém', 'pu'], ['g40Sec1', 't1', 's'], ['g40Sec2', 't2', 's']]],
  ['Máy phát', '32G', 'Công suất ngược', [['g32Pickup', 'P ngược', 'pu'], ['g32Sec1', 't1', 's'], ['g32Sec2', 't2', 's']]],
  ['Máy phát', '59G', 'Quá điện áp', [['g59Pickup', 'Điện áp khởi động', 'pu'], ['g59Sec', 'Thời gian', 's']]],
  ['Máy phát', '27G', 'Kém điện áp', [['g27Pickup', 'Điện áp khởi động', 'pu'], ['g27Sec', 'Thời gian', 's']]],
  ['Máy phát', '81G', 'Tần số cao / thấp (khi nối lưới)', [['g81HiHz', 'Tần số cao', 'Hz'], ['g81LoHz', 'Tần số thấp', 'Hz'], ['g81Sec', 'Thời gian', 's'], ['g81oBlockLoadReject', 'Khoá 81O khi sa thải phụ tải / chạy không tải tách lưới', '', [[true, 'BẬT'], [false, 'TẮT']]]]],
  ['Máy phát', '64G', 'Chạm đất stator 95 % / 100 %', [['g64Alarm', 'Ngưỡng báo 3U0', 'pu'], ['g64Trip', 'Ngưỡng cắt 3U0', 'pu'], ['g64Sec', 'Thời gian', 's'], ['g64_100Trip', '64S-100 tác động', '', [[true, 'CẮT'], [false, 'BÁO']]]]],
  ['Máy phát', '12', 'Vượt tốc 115 % / 145 % (dừng loại 1) / 155 % (loại 2)', [['overspeed1', 'Cấp 1', 'pu'], ['overspeed2', 'Cấp 2', 'pu'], ['overspeed3', 'Cấp 3', 'pu']]],
  ['MBA chính', '51T', 'Quá dòng MBA', [['t51Pickup', 'Dòng khởi động', 'pu In'], ['t51Sec1', 't1', 's'], ['t51Sec2', 't2', 's']]],
  ['MBA chính', '49T', 'Quá tải MBA', [['t49Pickup', 'Dòng khởi động', 'pu In'], ['t49Sec', 'Thời gian', 's']]],
  ['MBA chính', '26T', 'Nhiệt độ dầu MBA', [['oilTempAlarm', 'Báo tín hiệu', '°C'], ['oilTempTrip', 'Cắt', '°C']]],
  ['Đường dây', '51L', 'Quá dòng có thời gian 371/372', [['lineI1A', 'Dòng khởi động', 'A'], ['lineSec1', 'Thời gian', 's']]],
  ['Đường dây', '50L', 'Quá dòng cắt nhanh 371/372', [['lineI2A', 'Dòng khởi động', 'A'], ['lineSec2', 'Thời gian', 's']]],
  ['Đường dây', '51R', 'Quá dòng hướng ngược 371/372 – dự phòng sự cố phía thanh cái; đầu TBA tự phối hợp chậm hơn 0,3 s', [['lineRevI1A', 'Dòng khởi động', 'A'], ['lineRevSec1', 'Thời gian', 's']]],
  ['Đường dây', '50R', 'Cắt nhanh hướng ngược 371/372 – dự phòng; đầu TBA tự phối hợp chậm hơn 0,3 s', [['lineRevI2A', 'Dòng khởi động', 'A'], ['lineRevSec2', 'Thời gian', 's']]],
  ['Đường dây', '59N', 'Chạm đất một pha lưới 35 kV (báo tín hiệu)', [['lineGroundAlarm', 'Ngưỡng 3U0', 'pu']]],
  ['Nhiệt độ', '38', 'Dầu ổ đỡ (QT Điều 12: 50 °C báo, 55 °C kéo dài 15 phút dừng sự cố)', [['thrustOilAlarm', 'Báo tín hiệu', '°C'], ['thrustOilTrip', 'Dừng sự cố', '°C'], ['thrustOilSec', 'Thời gian', 's']], '38O'],
  ['Nhiệt độ', '38', 'Bạc ổ đỡ / bạc hướng turbine', [['bearingAlarm', 'Báo tín hiệu', '°C'], ['bearingTrip', 'Cắt máy', '°C']], '38B'],
  ['Nhiệt độ', '38', 'Bạc hướng trên / dưới máy phát', [['guideAlarm', 'Báo tín hiệu', '°C'], ['guideTrip', 'Cắt máy', '°C']], '38G'],
  ['Nhiệt độ', '49S', 'Cuộn dây / lõi thép stator', [['statorAlarm', 'Báo tín hiệu', '°C'], ['statorTrip', 'Cắt máy', '°C']], '49S'],
  ['Nhiệt độ', '26A', 'Gió nóng bộ làm mát không khí', [['airAlarm', 'Báo tín hiệu', '°C'], ['airTrip', 'Cắt máy', '°C']], '26A']
];
const RELAY_MATCH = {
  '87G': ['87G'], '87GT': ['87T'], '50G': ['50G'], '51G': ['51G'], '21G': ['21G'], '46G': ['46-'], '40G': ['40-'],
  '32G': ['32-'], '59G': ['59='], '27G': ['27='], '81G': ['81'], '64G': ['64S'], '12': ['12-'], '51T': ['T51'],
  '49T': ['T49'], '26T': ['T26'], '51L': ['51-3'], '50L': ['50-3'], '51R': ['51R-'], '50R': ['50R-'], '59N': ['59N'],
  '38O': ['38O'], '38B': ['38B'], '38G': ['38G'], '49S': ['49S'], '26A': ['26A']
};
addPage('protection', 'Bảo vệ rơ le', root => {
  const top = h('div', { class: 'card pad row' }, root);
  h('h3', { style: 'margin:0 10px 0 0' }, top, 'Trị số chỉnh định rơ le bảo vệ');
  let rs = null;
  const body = h('div', { class: 'card pad', style: 'margin-top:10px' }, root, 'Bấm "Tải trị số"');
  const draw = () => {
    body.innerHTML = ''; cells.length = 0;
    const tb = h('table', { class: 't' }, body);
    h('tr', {}, tb, '<th style="width:90px">Phần tử</th><th style="width:60px">Mã</th><th>Chức năng bảo vệ</th><th>Trị số chỉnh định</th><th style="width:180px">Trạng thái</th>');
    RELAY_ROWS.forEach(([grp, code, name, pars, matchKey]) => {
      const tr = h('tr', {}, tb);
      h('td', { style: 'color:#6b7785' }, tr, grp); h('td', {}, tr, '<b>' + code + '</b>'); h('td', {}, tr, name);
      const td = h('td', {}, tr);
      pars.forEach(([k, lb, unit, opts]) => {
        const sp = h('span', { style: 'display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0;font-size:13px' }, td, lb);
        if (opts) {
          const sel = h('select', { style: 'width:auto' }, sp, opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''));
          sel.value = String(rs[k] === undefined ? opts[0][0] : rs[k]);
          sel.onchange = () => rs[k] = typeof opts[0][0] === 'boolean' ? sel.value === 'true' : sel.value;
        } else {
          const i = h('input', { type: 'number', step: 'any', style: 'width:80px' }, sp); i.value = rs[k]; i.onchange = () => rs[k] = +i.value;
          h('span', { style: 'color:#6b7785' }, sp, unit);
        }
      });
      cells.push([matchKey || code, h('td', {}, tr)]);
    });
  };
  const cells = [];
  U(() => { const all = [...(S['G1.relays'] || []).map(x => 'MF1 ' + x), ...(S['G2.relays'] || []).map(x => 'MF2 ' + x), ...(S.lineRelays || [])];
    cells.forEach(([code, st]) => { const pf = RELAY_MATCH[code]; const hit = pf ? all.filter(x => { const c = x.replace(/^MF\d /, '').split(' ')[0]; return pf.some(p => p.endsWith('=') ? c === p.slice(0, -1) : c.startsWith(p)); }) : []; st.innerHTML = hit.length ? '<b style="color:#c92a2a">' + hit.join('<br>') + '</b>' : '<span style="color:#2b8a3e">bình thường</span>'; }); });
  async function loadRelay(silent = false) {
    if (silent && body.contains(document.activeElement)) return;
    try {
      const r = await api('relay');
      if (r && !r.auth && !r.error) { rs = r; draw(); }
    } catch (e) { }
  }
  cfgListeners.push(() => loadRelay(true));
  h('button', { class: 'btn', onclick: () => loadRelay(false) }, top, 'Tải trị số');
  h('button', { class: 'btn primary', onclick: () => rs && ask('Áp dụng trị số chỉnh định mới? (có hiệu lực ngay, lưu trong trình duyệt, không reset mô phỏng)', async () => { const r = await api('relay', JSON.stringify(rs)); if (r && r.ok) { notifyCfgChanged(r.cfgRev); toast('Đã áp dụng & lưu trị số rơ le ngay!'); } else if (r && r.error) toast(r.error, true); }) }, top, 'Áp dụng');
  h('span', { style: 'font-size:12px;color:#6b7785' }, top, 'pu In: bội số dòng định mức máy phát (đọc từ PlantConfig.genA). Lưu trực tiếp vào trình duyệt.');
  loadRelay(false);
});

// ================================================================== TRANG: GIAO CA (nhật ký vận hành theo mẫu B7)
addPage('shift', 'Giao ca', root => {
  const top = h('div', { class: 'card pad row' }, root);
  h('h3', { style: 'margin:0 10px 0 0' }, top, 'Nhận ca');
  const ch = h('input', { type: 'text', placeholder: 'Trưởng ca', style: 'width:170px' }, top);
  const op = h('input', { type: 'text', placeholder: 'Trực chính', style: 'width:170px' }, top);
  const dp = h('input', { type: 'text', placeholder: 'Điều độ A3 / B?', style: 'width:150px' }, top);
  h('button', { class: 'btn primary', onclick: () => ask('Bắt đầu ca mới (xoá số liệu ca cũ)?', () => api('shift', { chief: ch.value, operator: op.value, dispatcher: dp.value }).then(r => r.ok && (toast('Đã nhận ca'), load()))) }, top, 'Nhận ca');
  const nt = h('input', { type: 'text', placeholder: 'Ghi sổ: nội dung công việc, lệnh điều độ…', style: 'flex:1;min-width:240px' }, top);
  h('button', { class: 'btn', onclick: () => { if (nt.value) api('shift/note', { text: nt.value }).then(() => { nt.value = ''; setTimeout(load, 300); }); } }, top, 'Ghi');
  h('button', { class: 'btn', onclick: () => window.print() }, top, 'In sổ');
  const doc = h('div', { class: 'card pad', style: 'margin-top:10px;font-size:14px' }, root);
  const t = ms => ms ? new Date(ms).toLocaleString('vi-VN') : '';
  const hh = x => (x || 0).toFixed(2);
  async function load() {
    if (cur !== 'shift') return;
    const d = await api('shift');
    doc.innerHTML = `<div style="text-align:center"><b>NHÀ MÁY THUỶ ĐIỆN ĐRAY H'LINH 2</b><br><b style="font-size:17px">SỔ NHẬT KÝ VẬN HÀNH CA</b></div>
      <p>Ca từ <b>${t(d.startedAt)}</b> đến <b>${t(d.now)}</b> · Trưởng ca: <b>${d.chief || '…'}</b> · Trực chính: <b>${d.operator || '…'}</b> · Điều độ: <b>${d.dispatcher || '…'}</b></p>
      <table class="t"><tr><th></th><th>Tổ máy 1</th><th>Tổ máy 2</th></tr>
      <tr><th>Điện năng phát trong ca (MWh)</th><td>${(d.mwh[0] || 0).toFixed(3)}</td><td>${(d.mwh[1] || 0).toFixed(3)}</td></tr>
      <tr><th>Giờ vận hành / dự phòng / sự cố (h)</th><td>${hh(d.runH[0])} / ${hh(d.standbyH[0])} / ${hh(d.tripH[0])}</td><td>${hh(d.runH[1])} / ${hh(d.standbyH[1])} / ${hh(d.tripH[1])}</td></tr>
      </table><h3>Thao tác máy cắt trong ca</h3><table class="t"><tr><th>Máy cắt</th>${[...new Set([...Object.keys(d.cbNormal || {}), ...Object.keys(d.cbFault || {})])].map(k => `<td><b>${k}</b></td>`).join('')}</tr>
      <tr><th>Số lần thao tác</th>${[...new Set([...Object.keys(d.cbNormal || {}), ...Object.keys(d.cbFault || {})])].map(k => `<td>${d.cbNormal[k] || 0}</td>`).join('')}</tr>
      <tr><th>Số lần cắt sự cố</th>${[...new Set([...Object.keys(d.cbNormal || {}), ...Object.keys(d.cbFault || {})])].map(k => `<td>${d.cbFault[k] || 0}</td>`).join('')}</tr></table>
      <p>Công suất nhà máy lớn nhất <b>${(d.pMax || 0).toFixed(2)} MW</b>, nhỏ nhất <b>${(d.pMin || 0).toFixed(2)} MW</b> · Công tơ 371: ${(d.a371 || 0).toFixed(1)} · 372: ${(d.a372 || 0).toFixed(1)}</p>
      <h3>Diễn biến trong ca</h3><table class="t"><tr><th style="width:170px">Thời gian</th><th>Nội dung</th></tr>${(d.notes || []).map(x => `<tr><td>${x.slice(0, 8)}</td><td>${x.slice(10).replace(/</g, '&lt;')}</td></tr>`).join('') || '<tr><td colspan=2>chưa có</td></tr>'}</table>
      <div style="display:flex;justify-content:space-around;margin-top:30px;text-align:center"><div><b>Trưởng ca giao</b><br><br><br>${d.chief || ''}</div><div><b>Trưởng ca nhận</b><br><br><br></div></div>`;
  }
  setInterval(load, 5000); setTimeout(load, 100);
});

// ================================================================== TRANG: ĐIỆN NĂNG
addPage('energy', 'Điện năng', root => {
  const REG = ['kWhGiao', 'kWhNhan', 'kVArhGiao', 'kVArhNhan'], HD = ['kWh giao', 'kWh nhận', 'kVArh giao', 'kVArh nhận'];
  const top = h('div', { class: 'card pad row' }, root);
  h('h3', { style: 'margin:0 10px 0 0' }, top, 'Công tơ điện năng');
  const info = h('span', { class: 'muted' }, top, '');
  h('button', { class: 'btn', style: 'margin-left:auto', onclick: () => window.print() }, top, 'In');
  const box = h('div', {}, root);
  const f0 = x => Math.round(x || 0).toLocaleString('vi-VN');
  const t = ms => ms ? new Date(ms).toLocaleString('vi-VN') : '';
  const hdr = '<tr><th></th>' + HD.map(x => `<th>${x}</th>`).join('') + '</tr>';
  const rows = (d, f) => Object.keys(d.names).map(id => `<tr><th>${d.names[id]}</th>${[0, 1, 2, 3].map(i => `<td style="text-align:right">${f0(f(id, i))}</td>`).join('')}</tr>`).join('');
  const diff = (a, b) => (id, i) => ((a[id] || [])[i] || 0) - ((b[id] || [])[i] || 0);
  const hist = (d, list, title, col) => `<div class="card pad" style="margin-top:10px"><h3>${title}</h3><table class="t"><tr><th>${col}</th><th>Công tơ</th>${HD.map(x => `<th>${x}</th>`).join('')}</tr>` +
    (list.length ? list.map(c => Object.keys(d.names).map((id, k) => `<tr>${k ? '' : `<td rowspan="${Object.keys(d.names).length}">${c.label}${c.from ? '<br><span class=muted>' + t(c.from) + ' → ' + t(c.to) + '</span>' : ''}</td>`}<th>${d.names[id]}</th>${[0, 1, 2, 3].map(i => `<td style="text-align:right">${f0(diff(c.end, c.start)(id, i))}</td>`).join('')}</tr>`).join('')).join('') : '<tr><td colspan=6>chưa có</td></tr>') + '</table></div>';
  async function load() {
    if (cur !== 'energy') return;
    const d = await api('energy');
    info.textContent = 'Cập nhật ' + t(d.now) + ' · đầu ca ' + t(d.shiftStartMs) + ' · ngày ' + d.dayDate;
    box.innerHTML = `<div class="grid2" style="margin-top:10px">
      <div class="card pad"><h3>Chỉ số hiện tại (tổng tích luỹ)</h3><table class="t">${hdr}${rows(d, (id, i) => d.meters[id][i])}</table></div>
      <div class="card pad"><h3>Sản lượng trong ngày ${d.dayDate}</h3><table class="t">${hdr}${rows(d, diff(d.meters, d.dayStart))}</table>
      <h3 style="margin-top:12px">Sản lượng trong ca (từ ${t(d.shiftStartMs)})</h3><table class="t">${hdr}${rows(d, diff(d.meters, d.shiftStart))}</table>
      <p class="muted">Chốt ca tự động khi bấm "Nhận ca" ở trang Giao ca; chốt ngày lúc 0 giờ. Giao: tổ máy phát ra / thanh cái ra đường dây / nguồn vào thanh cái 0,4 kV.</p></div></div>` +
      hist(d, d.days, 'Chốt số theo ngày', 'Ngày') + hist(d, d.shifts, 'Chốt số theo ca', 'Ca');
  }
  setInterval(load, 5000); setTimeout(load, 100);
});

// ------------------------------------------------------------------ khởi tạo trang
const NAV = ['main', 'turbine1', 'turbine2', 'view3d', 'governor', 'sync', 'aux1', 'aux2', 'auxpower', 'intake', 'physics', 'trend', 'events', 'shift', 'energy', 'assess', 'protection'];
// ---- Chế độ tủ điều khiển (màn hình cảm ứng 1920×1080 gắn tủ / TV + chuột bay): nền tối, nút to, tự xoay trang
const KIOSK_HIDE = ['protection'];
const KIOSK_CYCLE = ['main', 'turbine1', 'turbine2', 'view3d', 'aux1', 'aux2', 'auxpower', 'intake', 'physics'];
let kiosk = false, rotateSec = 30;
try { const k = localStorage.getItem('hpsKiosk'); kiosk = k === null ? !!(window.HpsApp && HpsApp.isApp && HpsApp.isApp()) : k === '1'; rotateSec = +(localStorage.getItem('hpsRotate') ?? 30); } catch (e) { }
if (/[?&]kiosk=1/.test(location.search)) kiosk = true;
if (/[?&]kiosk=0/.test(location.search)) kiosk = false;
document.body.classList.toggle('kiosk', kiosk);
document.body.classList.toggle('dark', kiosk || (() => { try { return localStorage.getItem('hpsDark') === '1'; } catch (e) { return false; } })());
let lastAct = Date.now(), holdUntil = 0;
['pointerdown', 'keydown', 'wheel'].forEach(ev => window.addEventListener(ev, () => lastAct = Date.now(), true));
const SHORT = { main: 'Sơ đồ', aux1: 'Phụ trợ 1', aux2: 'Phụ trợ 2', auxpower: 'Tự dùng', intake: 'Cửa nhận nước', assess: 'Tự chấm điểm', protection: 'Bảo vệ rơ le' };
const ADMIN_PAGES = [];
let navDdBtn = null;
function buildNav() {
  const nav = $('nav'), main = $('pages');
  pages.sort((a, b) => NAV.indexOf(a.id) - NAV.indexOf(b.id));
  pages.forEach(pg => { if (SHORT[pg.id]) pg.title = SHORT[pg.id]; });
  pages.forEach(pg => {
    pg.el = h('section', { class: 'page', id: 'pg-' + pg.id }, main);
    pg.btn = h('button', { onclick: () => show(pg.id) }, nav, pg.title);
    if (kiosk && KIOSK_HIDE.includes(pg.id)) pg.btn.classList.add('hidden');
  });
}
function show(id) {
  const pg = pages.find(x => x.id === id) || pages[0];
  if (!pg.built) { curPage = pg; pg.build(pg.el); pg.built = true; }
  pages.forEach(x => { x.el.classList.toggle('show', x === pg); x.btn.classList.toggle('act', x === pg); });
  cur = pg.id;
  if (pg.id === 'assess' && typeof window._refreshAssessHistory === 'function') window._refreshAssessHistory();
  try { localStorage.setItem('hpsPage', pg.id); } catch (e) { }
  if (location.hash !== '#' + pg.id) history.replaceState(null, '', '#' + pg.id);
  runUpd();
}
function runUpd() { const pg = pages.find(x => x.id === cur); if (pg) pg.upd.forEach(f => { try { f(); } catch (e) { } }); }

let videoOn = false, autoPage = true;
try { autoPage = localStorage.getItem('hpsAutoPage') !== '0'; } catch (e) { }
let soundOn = false;
try { soundOn = localStorage.getItem('hpsSound') === '1'; } catch (e) { }
function playVideo() { /* Bản web tĩnh không đính kèm video mp4 máy chủ */ }
function playMedia() { }
const cbTrip = { currentTime: 0, play: () => Promise.resolve() };
const plant = { paused: true, volume: 0.35, play: () => Promise.resolve(), pause: () => { } };
let hornOn = false, hornKind = '', actx = null, hornTimer = null;
function tone(f, dur, vol = 0.25) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur - 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch (e) { }
}
function hornStart(kind) {
  if (!soundOn) return;
  if (kind === 'trip') { cbTrip.currentTime = 0; cbTrip.play().catch(() => { }); }
  if (hornOn && (hornKind === 'trip' || kind !== 'trip')) return;
  hornStop(); hornOn = true; hornKind = kind === 'trip' ? 'trip' : 'alarm';
  if (kiosk) { holdUntil = Date.now() + 120000; if (cur !== 'events') show(kind === 'trip' ? 'main' : 'events'); }
  let k = 0;
  const beat = () => { if (hornKind === 'trip') tone(k++ % 2 ? 660 : 880, 0.5, 0.22); else if (k++ % 2 === 0) tone(800, 0.6, 0.18); };
  beat(); hornTimer = setInterval(beat, hornKind === 'trip' ? 500 : 600);
  $('hornBtn').classList.remove('hidden');
}
function hornStop() { hornOn = false; hornKind = ''; if (hornTimer) clearInterval(hornTimer); hornTimer = null; $('hornBtn').classList.add('hidden'); }
$('vid').onclick = () => { $('vidEl').pause(); $('vid').classList.add('hidden'); };

async function poll() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const r = await api('state?ev=' + evSeq);
    const prevEvSeq = evSeq;
    const evs = Array.isArray(r.ev) ? r.ev : [];
    // Xử lý sự kiện cmd trước khi ghi đè S để fallback trạng thái trước lệnh còn nguyên vẹn
    if (prevEvSeq >= 0) evs.forEach(e => {
      if (e.seq != null && e.seq <= lastEvSeqDone) return;
      if (e.seq != null) lastEvSeqDone = e.seq;
      if (e.t === 'cmd') {
        if (window.AssessEngine && window.AssessEngine.onServerCommand) {
          try { window.AssessEngine.onServerCommand(e); } catch (err) { }
        }
        if (e.v && (e.source !== 'Web' || e.toast)) toast(e.v, false);
      } else if (e.t === 'video') playVideo(e.v);
      else if (e.t === 'alarm') hornStart(e.v);
      else if (e.t === 'page') { if (autoPage) show(e.v); }
      else toast(e.v, e.t === 'msg');
    });
    Object.assign(S, r.s);
    const rev = +(S.cfgRev || 0);
    if (rev > 0 && lastCfgRev > 0 && rev !== lastCfgRev) notifyCfgChanged(rev);
    else if (rev > 0 && lastCfgRev === 0) lastCfgRev = rev;
    videoBase = r.videoBase;
    evSeq = r.evSeq;
    if (r.evSeq > lastEvSeqDone) lastEvSeqDone = r.evSeq;
    online = true;
    if (!assessRestored) {
      assessRestored = true;
      if (window.AssessEngine && window.AssessEngine.restoreFromServer) {
        AssessEngine.restoreFromServer();
      }
      if (cur === 'assess' && typeof window._refreshAssessHistory === 'function') {
        window._refreshAssessHistory();
      }
    }
  } catch (e) { online = false; } finally { pollBusy = false; }
  $('conn').className = 'dot' + (online ? ' ok' : '');
  const mb = $('modeBtn');
  mb.textContent = 'SIMULATION';
  mb.className = 'mode';
  runUpd();
}

// nút trên thanh tiêu đề: tự chuyển trang, âm thanh, chế độ tủ điều khiển, nền tối, tắt còi
(function () {
  const hs = document.querySelector('.hstat');
  const mk = (icon, title, get, setv) => {
    const b = document.createElement('button'); b.className = 'hb'; b.title = title; b.textContent = icon;
    const upd = () => b.classList.toggle('on', get()); upd();
    b.onclick = () => { setv(!get()); upd(); toast(title + ': ' + (get() ? 'BẬT' : 'TẮT')); };
    hs.insertBefore(b, hs.firstChild);
  };
  mk('📄', 'Tự chuyển trang theo lệnh', () => autoPage, v => { autoPage = v; try { localStorage.setItem('hpsAutoPage', v ? '1' : '0'); } catch (e) { } });
  mk('🔊', 'Âm thanh còi báo động', () => soundOn, v => { soundOn = v; if (!v) hornStop(); try { localStorage.setItem('hpsSound', v ? '1' : '0'); } catch (e) { } });
  mk('🖥', 'Chế độ tủ điều khiển (nền tối, nút to, tự xoay trang)', () => kiosk, v => {
    try { localStorage.setItem('hpsKiosk', v ? '1' : '0'); } catch (e) { }
    location.reload();
  });
  if (kiosk) mk('⟳', 'Tự xoay trang 30 giây khi không thao tác', () => rotateSec > 0, v => { rotateSec = v ? 30 : 0; try { localStorage.setItem('hpsRotate', rotateSec); } catch (e) { } });
  if (!kiosk) mk('🌙', 'Giao diện nền tối', () => document.body.classList.contains('dark'), v => { document.body.classList.toggle('dark', v); try { localStorage.setItem('hpsDark', v ? '1' : '0'); } catch (e) { } });
  const hb = document.createElement('button'); hb.id = 'hornBtn'; hb.className = 'mode hidden'; hb.style.background = '#e03131'; hb.textContent = '🔔 TẮT CÒI'; hb.onclick = hornStop;
  hs.insertBefore(hb, hs.firstChild);
  if (window.HpsApp) {
    const ex = document.createElement('button'); ex.className = 'hb'; ex.title = 'Thoát hoàn toàn'; ex.textContent = '⏻';
    ex.onclick = () => ask('Thoát hoàn toàn HPS Droid Server? (SD200, IEC 104, HMI sẽ ngừng hoạt động)', () => window.HpsApp.exitApp());
    hs.appendChild(ex);
  }
})();

// đồng hồ, xu hướng
setInterval(() => {
  $('clock').textContent = new Date().toLocaleTimeString('vi-VN');
  for (const gn of [1, 2]) {
    const b = trendBuf[gn];
    b.push([n(`G${gn}.freq`), n(`G${gn}.SP`) || 50, n(`G${gn}.GV`), n(`G${gn}.blade`)]);
    if (b.length > 240) b.shift();
  }
}, 500);
setInterval(() => {
  const o = {}; ['VbusZone1', 'VbusZone2', 'FreqZone1', 'G1.freq', 'G2.freq', 'P371', 'P372'].forEach(k => o[k] = n(k));
  sysTrend.push(o); if (sysTrend.length > 900) sysTrend.shift();
}, 1000);

// vòng hoạt hình
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  const pg = pages.find(x => x.id === cur);
  if (pg) pg.frame.forEach(f => { try { f(dt); } catch (e) { } });
  requestAnimationFrame(frame);
}

buildNav();
function fitHeader() { document.documentElement.style.setProperty('--hh', document.querySelector('header').offsetHeight + 'px'); }
window.addEventListener('resize', fitHeader); setTimeout(fitHeader, 50); fitHeader();
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== cur) show(id); });
let first = (location.hash || '').slice(1);
try { first = first || localStorage.getItem('hpsPage') || 'main'; } catch (e) { first = first || 'main'; }
if (kiosk && KIOSK_HIDE.includes(first)) first = 'main';
show(first);
poll(); setInterval(poll, 300);
// tự xoay trang khi không ai thao tác; phím trái/phải (chuột bay, điều khiển TV) chuyển trang
setInterval(() => {
  if (!kiosk || rotateSec <= 0 || hornOn || Date.now() < holdUntil || Date.now() - lastAct < rotateSec * 1000) return;
  if (document.querySelector('.dlg:not(.hidden)') || !$('vid').classList.contains('hidden')) return;
  const i = KIOSK_CYCLE.indexOf(cur); show(KIOSK_CYCLE[(i + 1) % KIOSK_CYCLE.length]); lastAct = Date.now();
}, 1000);
window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const vis = pages.filter(x => !x.btn.classList.contains('hidden')); const i = vis.findIndex(x => x.id === cur);
  show(vis[(i + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length].id); e.preventDefault();
});
requestAnimationFrame(frame);
