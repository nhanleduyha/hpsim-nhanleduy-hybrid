/* HPS Droid Server – Sa bàn số 3D ban ngày (Daylight Isometric Industrial Digital Twin – Three.js r128) */
(function () {
  'use strict';

  // =========================================================================
  // 1. CSS ĐỘC LẬP CHO KHUNG 3D, NHÃN NỔI & POPUP BIỂU ĐỒ P–Q
  // =========================================================================
  (function injectCss() {
    if (document.getElementById('hps-sim3d-style')) return;
    const st = document.createElement('style');
    st.id = 'hps-sim3d-style';
    st.textContent = `
      .s3d-wrap{
        position:relative;width:100%;height:calc(100vh - var(--hh, 48px) - 22px);min-height:560px;
        border-radius:12px;overflow:hidden;background:#dbeafe;border:1px solid #93c5fd;
        box-shadow:0 8px 28px rgba(15,23,42,.22);user-select:none;touch-action:none;
        font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#e6f1fa;
      }
      .s3d-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}
      .s3d-canvas:active{cursor:grabbing}
      .s3d-canvas.s3d-pointer{cursor:pointer !important}
      .s3d-tooltip{
        position:absolute;z-index:22;pointer-events:none;display:none;max-width:310px;
        background:rgba(9,20,36,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
        border:1px solid #38bdf8;border-radius:9px;padding:7px 11px;color:#f8fafc;
        font-size:12px;line-height:1.38;box-shadow:0 10px 28px rgba(0,0,0,.48);
      }
      .s3d-tooltip b{color:#7dd3fc;font-size:12.5px;display:block;margin-bottom:2px}
      .s3d-tooltip .tt-st{font-weight:700}
      .s3d-tooltip .tt-st.on{color:#ff6b6b}
      .s3d-tooltip .tt-st.off{color:#4ade80}
      .s3d-tooltip .tt-st.warn{color:#fbbf24}
      .s3d-tooltip .tt-act{display:block;color:#bae6fd;font-size:11px;margin-top:2px}

      /* Popup điều khiển nhanh Tổ máy / Diesel / Tự dùng khi bấm trực tiếp trong 3D */
      .s3d-quick-modal{
        position:absolute;inset:0;z-index:26;background:rgba(7,16,28,.62);
        backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
        display:flex;align-items:center;justify-content:center;padding:16px;
      }
      .s3d-quick-modal.hidden{display:none}
      .s3d-quick-box{
        width:min(460px,95%);max-height:92%;overflow-y:auto;padding:14px 16px;
        background:rgba(10,22,38,.96);border:1px solid rgba(125,211,252,.48);border-radius:14px;
        box-shadow:0 20px 52px rgba(0,0,0,.62);color:#e2e8f0;font-size:13px;
      }
      .s3d-quick-hdr{
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        padding-bottom:9px;margin-bottom:11px;border-bottom:1px solid rgba(125,211,252,.22);
      }
      .s3d-quick-hdr h4{margin:0;font-size:15px;color:#7dd3fc}
      .s3d-quick-stats{
        display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;
        background:rgba(15,32,54,.72);border:1px solid rgba(125,211,252,.18);
        border-radius:9px;padding:8px 10px;margin-bottom:10px;font-size:12.5px;
      }
      .s3d-quick-stats div{display:flex;justify-content:space-between;gap:6px}
      .s3d-quick-stats span{color:#94a3b8}
      .s3d-quick-stats b{color:#f8fafc;font-variant-numeric:tabular-nums}
      .s3d-quick-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}
      .s3d-quick-sliders{
        background:rgba(15,32,54,.65);border:1px solid rgba(125,211,252,.16);
        border-radius:9px;padding:9px 10px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;
      }
      .s3d-sl-row{display:flex;align-items:center;gap:8px}
      .s3d-sl-row span{width:96px;color:#cbd5e1;font-size:12px}
      .s3d-sl-row input[type=range]{flex:1;accent-color:#38bdf8}
      .s3d-sl-row b{width:54px;text-align:right;font-variant-numeric:tabular-nums;color:#7dd3fc}
      .s3d-quick-foot{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      .s3d-quick-foot .s3d-act{flex:1;min-width:120px}

      /* Banner cảnh báo sự cố ngắn mạch / quá nhiệt trong không gian 3D (mép dưới giữa – không che thanh camera phía trên) */
      .s3d-fault-banner{
        position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:18;
        display:none;align-items:center;gap:8px;padding:7px 14px;border-radius:10px;
        background:rgba(153,27,27,.92);border:1.5px solid #fca5a5;color:#fff;
        font-size:12.5px;font-weight:700;box-shadow:0 8px 28px rgba(220,38,38,.55);
        animation:s3dFaultPulse 1s infinite alternate;pointer-events:none;white-space:nowrap;
        max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis;
      }
      @keyframes s3dFaultPulse{from{box-shadow:0 0 12px rgba(239,68,68,.55)}to{box-shadow:0 0 26px rgba(254,202,202,.95)}}
      .s3d-arc-tag{
        position:absolute;transform:translate(-50%,-100%);z-index:15;pointer-events:none;display:none;
        max-width:340px;white-space:normal;padding:6px 10px;border-radius:9px;
        background:rgba(127,29,29,.93);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        border:1.5px solid #fca5a5;color:#fff;font-size:12px;line-height:1.35;
        box-shadow:0 8px 26px rgba(220,38,38,.58);
      }
      .s3d-arc-tag::after{
        content:"";position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);
        border:7px solid transparent;border-top-color:#fca5a5;border-bottom:0;
      }
      .s3d-arc-tag b{display:block;color:#fef08a;font-size:12px;margin-bottom:2px;letter-spacing:.2px}


      /* Đồng bộ kế nổi (Mini Synchroscope) góc dưới phải khi tổ máy sẵn sàng hòa lưới */
      .s3d-sync-box{
        position:absolute;right:12px;bottom:12px;z-index:16;width:278px;padding:9px 11px;
        background:rgba(10,22,38,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
        border:1.5px solid rgba(56,189,248,.62);border-radius:12px;
        box-shadow:0 12px 32px rgba(0,0,0,.52);color:#e2e8f0;font-size:12px;
      }
      .s3d-sync-box.hidden{display:none}
      .s3d-sync-hdr{
        display:flex;align-items:center;justify-content:space-between;gap:6px;
        margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(125,211,252,.22);
      }
      .s3d-sync-hdr b{color:#7dd3fc;font-size:12.5px}
      .s3d-sync-tabs{display:flex;gap:4px}
      .s3d-sync-tab{
        background:rgba(24,47,74,.8);color:#cbd5e1;border:1px solid rgba(125,211,252,.3);
        border-radius:5px;padding:2px 7px;font-size:11px;font-weight:700;cursor:pointer;
      }
      .s3d-sync-tab.act{background:#0284c7;color:#fff;border-color:#7dd3fc}
      .s3d-sync-body{display:flex;align-items:center;gap:10px}
      .s3d-sync-svg{width:116px;height:116px;flex-shrink:0}
      .s3d-sync-metrics{flex:1;display:flex;flex-direction:column;gap:4px;font-variant-numeric:tabular-nums}
      .s3d-sync-row{display:flex;justify-content:space-between;align-items:center;background:rgba(15,32,54,.72);padding:3px 7px;border-radius:6px}
      .s3d-sync-row span{color:#94a3b8;font-size:11px}
      .s3d-sync-row b{font-size:12px}
      .s3d-sync-ok{color:#4ade80 !important}
      .s3d-sync-bad{color:#ff6b6b !important}
      .s3d-sync-trims{display:flex;gap:4px;margin-top:6px}
      .s3d-sync-trims button{
        flex:1;background:rgba(24,47,74,.86);color:#e2eef8;border:1px solid rgba(125,211,252,.28);
        border-radius:6px;padding:3px 4px;font-size:11px;font-weight:700;cursor:pointer;
      }
      .s3d-sync-trims button:hover:not(:disabled){background:#0369a1;color:#fff}
      .s3d-sync-trims button:disabled{opacity:.42;cursor:not-allowed}
      .s3d-sync-warn{
        margin-top:5px;padding:4px 7px;border-radius:6px;background:rgba(153,27,27,.48);
        border:1px solid rgba(248,113,113,.75);color:#fecaca;font-size:10.5px;font-weight:700;line-height:1.3;
      }
      .s3d-sync-close-btn{
        width:100%;margin-top:7px;padding:7px 10px;border-radius:8px;border:1.5px solid #fca5a5;
        background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;font-size:12.5px;font-weight:800;
        cursor:pointer;letter-spacing:.3px;box-shadow:0 4px 14px rgba(220,38,38,.45);transition:all .15s;
      }
      .s3d-sync-close-btn.ready{
        border-color:#86efac;background:linear-gradient(135deg,#16a34a,#15803d);
        box-shadow:0 0 18px rgba(34,197,94,.65);
      }
      .s3d-sync-close-btn.auto{
        border-color:#7dd3fc;background:linear-gradient(135deg,#0284c7,#0369a1);
        box-shadow:0 0 14px rgba(56,189,248,.5);cursor:not-allowed;opacity:.92;
      }
      .s3d-sync-close-btn:disabled:not(.auto){
        opacity:.52;cursor:not-allowed;box-shadow:none;filter:grayscale(.35);
      }
      .s3d-pq-legend{
        display:inline-flex;align-items:center;gap:7px;padding:3px 8px;border-radius:7px;
        background:rgba(15,32,54,.75);border:1px solid rgba(125,211,252,.22);font-size:11px;font-weight:700;
      }
      .s3d-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:4}
      .s3d-tag{
        position:absolute;transform:translate(-50%,-100%);
        background:rgba(15,23,42,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        border:1px solid rgba(56,189,248,.55);border-radius:8px;padding:4px 8px;
        color:#f8fafc;font-size:11.5px;line-height:1.3;white-space:nowrap;
        box-shadow:0 4px 14px rgba(15,23,42,.35);transition:opacity .15s;
      }
      .s3d-tag::after{
        content:"";position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);
        border:6px solid transparent;border-top-color:rgba(56,189,248,.65);border-bottom:0;
      }
      .s3d-tag b{color:#7dd3fc;font-size:12px;display:block;letter-spacing:.2px}
      .s3d-tag .v{font-variant-numeric:tabular-nums;color:#f1f5f9}
      .s3d-tag .st-on{color:#ff5b5b;font-weight:700}
      .s3d-tag .st-off{color:#4ade80;font-weight:700}
      .s3d-tag .st-run{color:#38bdf8;font-weight:700}

      .s3d-glass{
        background:rgba(11,23,39,.80);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
        border:1px solid rgba(125,211,252,.32);border-radius:11px;
        box-shadow:0 8px 26px rgba(15,23,42,.34);
      }
      .s3d-top-left{
        position:absolute;top:12px;left:12px;z-index:8;display:flex;flex-direction:column;gap:7px;
        max-width:calc(100% - 336px);pointer-events:none;
      }
      .s3d-bar{
        display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:6px 8px;pointer-events:auto;
      }
      .s3d-title{
        font-size:11.5px;font-weight:700;color:#7dd3fc;letter-spacing:.5px;text-transform:uppercase;
        padding:0 6px 0 4px;border-right:1px solid rgba(125,211,252,.28);margin-right:2px;
      }
      .s3d-btn{
        background:rgba(24,47,74,.78);color:#e2eef8;border:1px solid rgba(125,211,252,.25);
        border-radius:7px;padding:5px 9px;font-size:12px;font-weight:600;cursor:pointer;
        transition:all .15s;white-space:nowrap;
      }
      .s3d-btn:hover{background:rgba(37,79,122,.95);border-color:rgba(125,211,252,.7);color:#fff}
      .s3d-btn.act{
        background:linear-gradient(135deg,#0284c7,#0369a1);border-color:#7dd3fc;color:#fff;
        box-shadow:0 0 12px rgba(14,165,233,.45);
      }
      .s3d-btn.tog-on{
        background:linear-gradient(135deg,#0f766e,#0d9488);border-color:#5eead4;color:#fff;
        box-shadow:0 0 10px rgba(20,184,166,.4);
      }
      .s3d-btn.pq-btn{
        background:linear-gradient(135deg,#b45309,#d97706);border-color:#fcd34d;color:#fff;
      }
      .s3d-btn.pq-btn:hover{filter:brightness(1.1)}

      /* Bảng giám sát góc phải */
      .s3d-panel{
        position:absolute;top:12px;right:12px;z-index:9;width:302px;max-height:calc(100% - 24px);
        display:flex;flex-direction:column;overflow:hidden;
      }
      .s3d-panel.collapsed{width:auto}
      .s3d-panel.collapsed .s3d-pbody{display:none}
      .s3d-phdr{
        display:flex;align-items:center;justify-content:space-between;gap:8px;
        padding:9px 11px;border-bottom:1px solid rgba(110,185,245,.2);
        background:rgba(13,31,52,.72);
      }
      .s3d-phdr-title{font-size:13px;font-weight:700;color:#e0f2fe;display:flex;align-items:center;gap:6px}
      .s3d-badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:99px;letter-spacing:.3px}
      .s3d-badge.live{background:rgba(34,197,94,.22);color:#4ade80;border:1px solid rgba(74,222,128,.5)}
      .s3d-badge.demo{background:rgba(245,158,11,.24);color:#fbbf24;border:1px solid rgba(251,191,36,.55)}
      .s3d-pbody{padding:9px 11px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;font-size:12px}
      .s3d-pbody::-webkit-scrollbar{width:6px}
      .s3d-pbody::-webkit-scrollbar-thumb{background:rgba(125,211,252,.28);border-radius:3px}
      .s3d-sec{background:rgba(15,32,52,.62);border:1px solid rgba(125,211,252,.16);border-radius:8px;padding:7px 9px}
      .s3d-sec-t{
        font-size:11px;font-weight:700;color:#7dd3fc;text-transform:uppercase;letter-spacing:.45px;
        margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;
      }
      .s3d-kv{display:grid;grid-template-columns:1fr auto;gap:3px 8px;align-items:center}
      .s3d-kv span{color:#a8bfd4}
      .s3d-kv b{font-variant-numeric:tabular-nums;color:#f8fafc;font-weight:600}
      .s3d-pill{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10.5px;font-weight:700}
      .s3d-pill.red{background:rgba(239,68,68,.26);color:#ff7575;border:1px solid rgba(239,68,68,.6)}
      .s3d-pill.grn{background:rgba(34,197,94,.22);color:#4ade80;border:1px solid rgba(74,222,128,.55)}
      .s3d-pill.amb{background:rgba(245,158,11,.24);color:#fbbf24;border:1px solid rgba(251,191,36,.55)}
      .s3d-pill.blu{background:rgba(56,189,248,.24);color:#38bdf8;border:1px solid rgba(56,189,248,.55)}

      .s3d-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .s3d-act{
        border:1px solid rgba(125,211,252,.28);background:rgba(20,45,72,.86);color:#e6f4ff;
        border-radius:7px;padding:6px 7px;font-size:11.5px;font-weight:600;cursor:pointer;
        text-align:center;transition:all .15s;
      }
      .s3d-act:hover{background:rgba(32,72,112,.98);border-color:#7dd3fc}
      .s3d-act.full{grid-column:1 / -1}
      .s3d-act.danger{background:rgba(153,27,27,.76);border-color:rgba(248,113,113,.6);color:#fee2e2}
      .s3d-act.danger:hover{background:rgba(185,28,28,.94)}
      .s3d-act.ok{background:rgba(21,128,61,.74);border-color:rgba(74,222,128,.6);color:#dcfce7}
      .s3d-act.ok:hover{background:rgba(22,163,74,.92)}

      .s3d-hint{
        position:absolute;left:12px;bottom:12px;z-index:7;padding:5px 10px;
        font-size:11.5px;color:#cbd5e1;pointer-events:none;
      }
      .s3d-hint b{color:#7dd3fc}

      /* Popup Biểu đồ P-Q song song H1 & H2 */
      .s3d-pq-modal{
        position:absolute;inset:0;z-index:25;background:rgba(7,16,28,.68);
        backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
        display:flex;align-items:center;justify-content:center;padding:18px;
      }
      .s3d-pq-modal.hidden{display:none}
      .s3d-pq-box{
        width:min(1180px,96%);max-height:92%;overflow:auto;padding:14px 16px;
        background:rgba(10,21,36,.95);border:1px solid rgba(125,211,252,.42);border-radius:14px;
        box-shadow:0 20px 54px rgba(0,0,0,.6);color:#e2e8f0;
      }
      .s3d-pq-top{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        padding-bottom:10px;margin-bottom:12px;border-bottom:1px solid rgba(125,211,252,.22);
      }
      .s3d-pq-top h4{margin:0;font-size:15px;color:#7dd3fc}
      .s3d-pq-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      @media(max-width:960px){.s3d-pq-grid{grid-template-columns:1fr}}
      .s3d-pq-item{
        background:rgba(15,29,48,.75);border:1px solid rgba(125,211,252,.2);border-radius:10px;padding:10px;
      }
      .s3d-pq-item canvas{width:100%;height:auto;display:block;border-radius:8px}

      .s3d-fallback{
        position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:10px;padding:24px;text-align:center;color:#1e293b;background:#dbeafe;z-index:20;
      }
      body.kiosk .s3d-btn{padding:8px 13px;font-size:14px}
      body.kiosk .s3d-act{padding:9px 10px;font-size:13.5px}
      body.kiosk .s3d-panel{width:340px}
      body.kiosk .s3d-pbody{font-size:14px}
    `;
    document.head.appendChild(st);
  })();

  // =========================================================================
  // 1b. BẮT SỰ KIỆN /api/state?ev= (msg "hồ quang" / "dao nối đất ... đang có điện")
  // =========================================================================
  (function hookStateArcEvents() {
    const pendingArcQueue = [];
    let arcReceiver = null;
    let lastArcEvSeq = -1;

    function isArcOrLiveEarthMsg(txt) {
      const low = String(txt || '').toLowerCase();
      if (!low || low.includes('liên động') || low.includes('cấm thao tác') || low.includes('đã tắt')) return false;
      if (low.includes('hồ quang')) return true;
      if (/dao\s+nối\s+đất.*đang\s+có\s+điện/i.test(txt)) return true;
      if (/ngắn\s+mạch\s+3\s+pha\s+qua\s+dao\s+nối\s+đất/i.test(txt)) return true;
      return false;
    }

    function handleStateEvResponse(reqSeq, j) {
      if (!j || typeof j !== 'object') return;
      if (reqSeq < 0) {
        if (typeof j.evSeq === 'number' && j.evSeq > lastArcEvSeq) lastArcEvSeq = j.evSeq;
        return;
      }
      const evs = Array.isArray(j.ev) ? j.ev : [];
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        if (!e) continue;
        if (e.seq != null) {
          if (e.seq <= lastArcEvSeq) continue;
          lastArcEvSeq = e.seq;
        }
        if (e.t === 'msg' && typeof e.v === 'string' && isArcOrLiveEarthMsg(e.v)) {
          const item = { text: e.v, ts: Date.now() };
          if (arcReceiver) {
            try { arcReceiver(item); } catch (err) { }
          } else {
            pendingArcQueue.push(item);
            if (pendingArcQueue.length > 6) pendingArcQueue.shift();
          }
        }
      }
      if (typeof j.evSeq === 'number' && j.evSeq > lastArcEvSeq) lastArcEvSeq = j.evSeq;
    }

    window._sim3dSetArcReceiver = function (fn) {
      arcReceiver = typeof fn === 'function' ? fn : null;
      if (!arcReceiver || pendingArcQueue.length === 0) return;
      const now = Date.now();
      while (pendingArcQueue.length > 0) {
        const it = pendingArcQueue.shift();
        if (now - it.ts <= 4000) {
          try { arcReceiver(it); } catch (err) { }
        }
      }
    };

    if (typeof window.api === 'function' && !window.api._sim3dEvHooked) {
      const origApi = window.api;
      const wrappedApi = async function (path, body, retry) {
        const j = await origApi.apply(this, arguments);
        if (typeof path === 'string' && path.indexOf('state?ev=') === 0) {
          const reqSeq = parseInt(path.slice(9), 10);
          handleStateEvResponse(isFinite(reqSeq) ? reqSeq : -1, j);
        }
        return j;
      };
      wrappedApi._sim3dEvHooked = true;
      window.api = wrappedApi;
    }
  })();

  // =========================================================================
  // 2. BỘ GIẢ LẬP MẪU CHO CHẾ ĐỘ PREVIEW ĐỘC LẬP (KHI KHÔNG CÓ /api/state)
  // =========================================================================
  const demo = {
    active: false,
    initialized: false,
    everOnline: false,
    t: 0,
    targets: {
      IntakeGate: 1, G1Mode: 1, G2Mode: 1, G1P: 6.5, G1Q: 1.8, G2P: 6.5, G2Q: 1.7,
      CB331: 1, CB332: 1, CB371: 1, CB372: 1, CB601: 1, CB602: 1,
      IS312_1: 1, IS331_1: 1, IS332_2: 1, IS371_1: 1, IS371_7: 1, IS372_2: 1, IS372_7: 1,
      IS612_1: 1, IS612_2: 0, AXT1: 1, AXT2: 0,
      GS371_76: 0, GS371_75: 0, GS371_15: 0, GS372_76: 0, GS372_75: 0, GS372_25: 0,
      GS331_14: 0, GS331_15: 0, GS332_24: 0, GS332_25: 0, GS1QE: 0, GS2QE: 0,
      StandbyInput400: 0, dgEngine: 0, dgCb: 0
    }
  };

  function initDemoState() {
    demo.initialized = true;
    Object.assign(S, {
      sim: 1, interlock: 'strict',
      HeadHigh: 30.5, zUp: 30.5, zTail: 2.1, qSpill: 2.8, inflowM3s: 82.0,
      IntakeGate: 1,
      CB331: 1, CB332: 1, CB371: 1, CB372: 1, CB601: 1, CB602: 1,
      IS312_1: 1, IS371_7: 1, IS371_1: 1, IS372_7: 1, IS372_2: 1, IS331_1: 1, IS332_2: 1,
      IS612_1: 1, IS612_2: 0, AXT1: 1, AXT2: 0,
      GS371_76: 0, GS371_75: 0, GS371_15: 0, GS372_76: 0, GS372_75: 0, GS372_25: 0,
      GS331_14: 0, GS331_15: 0, GS332_24: 0, GS332_25: 0, GS1QE: 0, GS2QE: 0,
      V371: 38.5, V372: 38.4, VbusZone1: 38.5, VbusZone2: 38.5,
      FreqZone1: 50.0, FreqZone2: 50.0, Vaux6: 6.32, V400Zone1: 0.402, V400Zone2: 0.402, V400: 0.402,
      P371: 6.52, P372: 6.48, Q371: 1.85, Q372: 1.75, I371: 101.2, I372: 100.4,
      StandbyInput400: 0, dgEngine: 0, dgCb: 0, dgAuto: 1, dgKW: 0, dgKVAr: 0,
      lpAir: 0.75, hpAir: 4.00, sump: 1.2, drain: 0.8, gridOk: 1,
      // H1
      'G1.mode': 1, 'G1.running': 1, 'G1.grid': 1, 'G1.tripped': 0, 'G1.tripReason': '', 'G1.relays': [],
      'G1.P': 6.5, 'G1.Q': 1.8, 'G1.Pload': 6.52, 'G1.Qload': 1.85,
      'G1.Vgen': 6.32, 'G1.V60': 6.32, 'G1.busV': 6.32, 'G1.busF': 50.0, 'G1.phase': 0, 'G1.autoSync': 0, 'G1.spTrim': 0.08, 'G1.vTrim': 0,
      'G1.Ia': 620, 'G1.freq': 50.0,
      'G1.speed': 214.3, 'G1.GV': 68.5, 'G1.blade': 62.0, 'G1.flow': 37.8, 'G1.head': 28.4,
      'G1.airBrake': 1, 'G1.servoLock': 0, 'G1.maintSeal': 0, 'G1.fieldDischarge': 1,
      'G1.auxAuto': 1,
      'G1.waterPump1': 1, 'G1.waterPump2': 0, 'G1.cwValve': 1, 'G1.cwPreMPa': 0.34, 'G1.cwMPa': 0.32, 'G1.cwFlow': 1,
      'G1.cwPress': 72, 'G1.cwLevel': 76, 'G1.cwTemp': 29.4,
      'G1.oilPump1': 1, 'G1.oilPump2': 0, 'G1.oilPress': 86, 'G1.oilLevel': 74, 'G1.oilMPa': 3.82,
      'G1.airComp1': 1, 'G1.airComp2': 0, 'G1.airPress': 82,
      'G1.hc1': 1, 'G1.hc2': 0, 'G1.headCover': 85,
      'G1.stator': 62.5, 'G1.statorMax': 64.2, 'G1.core': 56.4, 'G1.rotor': 68.0,
      'G1.thrust': 44.2, 'G1.thrustOil': 39.5, 'G1.upper': 41.8, 'G1.lower': 40.2, 'G1.turbPad': 38.6,
      'G1.coldAir': 32.5, 'G1.hotAir': 48.2, 'G1.seqState': 'RUNNING', 'G1.seq': 'Phát điện',
      // H2
      'G2.mode': 1, 'G2.running': 1, 'G2.grid': 1, 'G2.tripped': 0, 'G2.tripReason': '', 'G2.relays': [],
      'G2.P': 6.5, 'G2.Q': 1.7, 'G2.Pload': 6.48, 'G2.Qload': 1.75,
      'G2.Vgen': 6.31, 'G2.V60': 6.31, 'G2.busV': 6.32, 'G2.busF': 50.0, 'G2.phase': 0, 'G2.autoSync': 0, 'G2.spTrim': 0.08, 'G2.vTrim': 0,
      'G2.Ia': 615, 'G2.freq': 50.0,
      'G2.speed': 214.3, 'G2.GV': 67.8, 'G2.blade': 61.5, 'G2.flow': 37.4, 'G2.head': 28.4,
      'G2.airBrake': 1, 'G2.servoLock': 0, 'G2.maintSeal': 0, 'G2.fieldDischarge': 1,
      'G2.auxAuto': 1,
      'G2.waterPump1': 1, 'G2.waterPump2': 0, 'G2.cwValve': 1, 'G2.cwPreMPa': 0.34, 'G2.cwMPa': 0.32, 'G2.cwFlow': 1,
      'G2.cwPress': 71, 'G2.cwLevel': 75, 'G2.cwTemp': 28.4,
      'G2.oilPump1': 1, 'G2.oilPump2': 0, 'G2.oilPress': 85, 'G2.oilLevel': 73, 'G2.oilMPa': 3.80,
      'G2.airComp1': 0, 'G2.airComp2': 1, 'G2.airPress': 80,
      'G2.hc1': 0, 'G2.hc2': 1, 'G2.headCover': 80,
      'G2.stator': 61.9, 'G2.statorMax': 63.5, 'G2.core': 55.8, 'G2.rotor': 67.2,
      'G2.thrust': 43.8, 'G2.thrustOil': 39.1, 'G2.upper': 41.2, 'G2.lower': 39.8, 'G2.turbPad': 38.1,
      'G2.coldAir': 32.1, 'G2.hotAir': 47.6, 'G2.seqState': 'RUNNING', 'G2.seq': 'Phát điện',
      scFaults: [], lineRelays: [], faults: [], pending: {}, thermalSpeed: 1
    });
  }

  function stepDemo(dt) {
    if (typeof online !== 'undefined' && online) {
      demo.everOnline = true;
      demo.active = false;
      return;
    }
    if (demo.everOnline) return;
    if (!demo.initialized) initDemoState();
    demo.active = true;
    demo.t += dt;

    const tg = demo.targets;
    const syncKeys = [
      'IntakeGate', 'CB331', 'CB332', 'CB371', 'CB372', 'CB601', 'CB602',
      'IS312_1', 'IS331_1', 'IS332_2', 'IS371_1', 'IS371_7', 'IS372_2', 'IS372_7',
      'IS612_1', 'IS612_2', 'AXT1', 'AXT2',
      'GS371_76', 'GS371_75', 'GS371_15', 'GS372_76', 'GS372_75', 'GS372_25',
      'GS331_14', 'GS331_15', 'GS332_24', 'GS332_25', 'GS1QE', 'GS2QE',
      'StandbyInput400', 'dgEngine', 'dgCb'
    ];
    for (let i = 0; i < syncKeys.length; i++) S[syncKeys[i]] = tg[syncKeys[i]];

    const headBase = 30.5 + Math.sin(demo.t * 0.14) * 0.45;
    S.HeadHigh = headBase;
    S.zUp = headBase;

    let totalFlow = 0;
    const has400 = (+(S.V400 || 0)) > 0.3;
    const thSpd = Math.max(1, +(S.thermalSpeed || 1));

    for (let u = 1; u <= 2; u++) {
      const k = 'G' + u + '.';
      const uMode = u === 1 ? tg.G1Mode : tg.G2Mode;
      const pSet = u === 1 ? tg.G1P : tg.G2P;
      const qSet = u === 1 ? tg.G1Q : tg.G2Q;
      S[k + 'P'] = pSet; S[k + 'Q'] = qSet;
      const tripped = +(S[k + 'tripped'] || 0) > 0.5;
      const wantSpin = !tripped && (uMode === 1 || uMode === 2 || uMode === 3);
      const wantGen = !tripped && uMode === 1;
      const cb33 = u === 1 ? (tg.CB331 && tg.IS331_1 && tg.CB601) : (tg.CB332 && tg.IS332_2 && tg.CB602);
      const canWater = tg.IntakeGate === 1;

      const targetGV = !canWater || !wantSpin ? 0 : (wantGen ? Math.min(96, Math.max(18, (pSet / 8.0) * 82)) + Math.sin(demo.t * 0.5 + u) * 1.3 : 14.0);
      const curGV = +(S[k + 'GV'] || 0);
      const nextGV = curGV + (targetGV - curGV) * Math.min(1, dt * 1.1);
      S[k + 'GV'] = nextGV;

      const targetBlade = nextGV * 0.91;
      S[k + 'blade'] = (+(S[k + 'blade'] || 0)) + (targetBlade - (+(S[k + 'blade'] || 0))) * Math.min(1, dt * 1.0);

      const flow = canWater ? (nextGV / 100) * 55.2 : 0;
      S[k + 'flow'] = flow;
      totalFlow += flow;

      const targetSpd = (wantSpin && canWater && nextGV > 4) ? 214.3 : 0;
      const curSpd = +(S[k + 'speed'] || 0);
      const braking = !wantSpin && curSpd > 1.5 && curSpd < 68;
      if (S[k + 'auxAuto'] !== 0) S[k + 'airBrake'] = braking ? 0 : 1;
      const decel = braking ? 28 : 16;
      const nextSpd = targetSpd > curSpd
        ? Math.min(targetSpd, curSpd + dt * 36)
        : Math.max(targetSpd, curSpd - dt * decel);
      S[k + 'speed'] = nextSpd;
      const spTr = +(S[k + 'spTrim'] || 0);
      const vTr = +(S[k + 'vTrim'] || 0);
      const synced = (wantGen && cb33 && nextSpd > 205) ? 1 : 0;
      S[k + 'grid'] = synced;
      S[k + 'freq'] = synced ? 50.0 : ((nextSpd / 214.3) * 50.0 + spTr);
      S[k + 'busF'] = 50.0;
      S[k + 'busV'] = 6.32;
      if (synced) {
        S[k + 'phase'] = 0;
      } else if (nextSpd > 150) {
        let ph = (+(S[k + 'phase'] || 0)) + (S[k + 'freq'] - 50.0) * 360 * dt;
        while (ph > 180) ph -= 360;
        while (ph < -180) ph += 360;
        S[k + 'phase'] = ph;
      }
      S[k + 'running'] = nextSpd > 20 ? 1 : 0;
      S[k + 'mode'] = uMode;

      const pTarget = (S[k + 'grid'] && canWater) ? (pSet + Math.sin(demo.t * 0.65 + u * 2) * 0.14) : 0;
      S[k + 'Pload'] = (+(S[k + 'Pload'] || 0)) + (pTarget - (+(S[k + 'Pload'] || 0))) * Math.min(1, dt * 1.4);
      S[k + 'Qload'] = S[k + 'grid'] ? (qSet + Math.cos(demo.t * 0.55 + u) * 0.16) : 0;
      S[k + 'Vgen'] = (!tripped && nextSpd > 150 && (uMode === 1 || uMode === 2)) ? (6.32 * (1 + vTr / 100)) : 0;
      S[k + 'V60'] = (S[k + 'Vgen'] > 1 || (u === 1 ? (tg.CB331 && tg.IS331_1) : (tg.CB332 && tg.IS332_2))) ? 6.32 : 0;
      S[k + 'Ia'] = S[k + 'Pload'] * 94.0;
      S[k + 'head'] = headBase - S.zTail;

      // Phần A: Chỉ tự động điều khiển bơm/van khi auxAuto == 1 (TỰ ĐỘNG)
      if (S[k + 'auxAuto'] !== 0) {
        S[k + 'waterPump1'] = (wantSpin && has400) ? 1 : 0;
        S[k + 'cwValve'] = (wantSpin && has400) ? 1 : 0;
        S[k + 'oilPump1'] = has400 ? 1 : 0;
        S[k + 'airComp1'] = (u === 1 && has400) ? 1 : 0;
        S[k + 'airComp2'] = (u === 2 && has400) ? 1 : 0;
        S[k + 'hc1'] = (wantSpin && has400) ? 1 : 0;
      } else if (!has400) {
        S[k + 'waterPump1'] = 0; S[k + 'waterPump2'] = 0;
        S[k + 'oilPump1'] = 0; S[k + 'oilPump2'] = 0;
        S[k + 'hc1'] = 0; S[k + 'hc2'] = 0;
      }

      // Thủy lực trước van & sau van CW (Phần A)
      const pumpOn = (S[k + 'waterPump1'] > 0.5 || S[k + 'waterPump2'] > 0.5) && has400;
      const valveOn = S[k + 'cwValve'] > 0.5;
      const targetPre = !pumpOn ? 0.0 : (valveOn ? 0.34 : 0.48);
      const targetPost = (pumpOn && valveOn) ? 0.32 : 0.0;
      S[k + 'cwPreMPa'] = (+(S[k + 'cwPreMPa'] || 0)) + (targetPre - (+(S[k + 'cwPreMPa'] || 0))) * Math.min(1, dt * 1.6);
      S[k + 'cwMPa'] = (+(S[k + 'cwMPa'] || 0)) + (targetPost - (+(S[k + 'cwMPa'] || 0))) * Math.min(1, dt * 1.6);
      S[k + 'cwFlow'] = (pumpOn && valveOn) ? 1 : 0;
      S[k + 'cwPress'] = Math.round((S[k + 'cwMPa'] / 0.45) * 100);

      // Giả lập tăng nhiệt dầu ổ đỡ khi mất nước CW trong chế độ demo offline
      if (nextSpd > 50 && S[k + 'cwFlow'] < 0.1) {
        S[k + 'thrustOil'] = Math.min(62, (+(S[k + 'thrustOil'] || 40)) + dt * 0.12 * Math.min(10, thSpd));
        S[k + 'thrust'] = Math.max(+(S[k + 'thrust'] || 44), S[k + 'thrustOil'] + 4.5);
        if (S[k + 'thrustOil'] >= 55.0 && !tripped) {
          S[k + 'tripped'] = 1;
          S[k + 'tripReason'] = 'Nhiệt độ dầu ổ đỡ ≥ 55°C (mất nước làm mát CW)';
          if (u === 1) { tg.CB331 = 0; tg.CB601 = 0; tg.G1Mode = 0; }
          else { tg.CB332 = 0; tg.CB602 = 0; tg.G2Mode = 0; }
        }
      } else {
        const tTarget = nextSpd > 50 ? 39.5 : 28.0;
        S[k + 'thrustOil'] = (+(S[k + 'thrustOil'] || 39.5)) + (tTarget - (+(S[k + 'thrustOil'] || 39.5))) * Math.min(1, dt * 0.25);
        S[k + 'thrust'] = S[k + 'thrustOil'] + (nextSpd > 50 ? 4.5 : 0.5);
      }

      S[k + 'seq'] = tripped ? 'Dừng sự cố (' + (S[k + 'tripReason'] || 'Bảo vệ') + ')' : (braking ? 'Dừng – phanh tổ máy' : (S[k + 'grid'] ? 'Phát điện' : (uMode === 2 ? 'Không tải kích từ' : (uMode === 3 ? 'Chạy tự do' : 'Dừng dự phòng'))));
    }

    S.zTail = 1.6 + Math.min(2.2, totalFlow * 0.015);
    S.qSpill = 2.4 + Math.sin(demo.t * 0.25) * 0.5;
    const pTot = (+(S['G1.Pload'] || 0)) + (+(S['G2.Pload'] || 0));
    const qTot = (+(S['G1.Qload'] || 0)) + (+(S['G2.Qload'] || 0));
    const l1 = (S.CB371 && S.IS371_1 && S.IS371_7) ? 1 : 0;
    const l2 = (S.CB372 && S.IS372_2 && S.IS372_7) ? 1 : 0;
    const activeLines = l1 + l2;
    S.P371 = (l1 && activeLines > 0) ? (S.IS312_1 ? pTot / activeLines : +(S['G1.Pload'] || 0)) : 0;
    S.P372 = (l2 && activeLines > 0) ? (S.IS312_1 ? pTot / activeLines : +(S['G2.Pload'] || 0)) : 0;
    S.Q371 = (l1 && activeLines > 0) ? (S.IS312_1 ? qTot / activeLines : +(S['G1.Qload'] || 0)) : 0;
    S.Q372 = (l2 && activeLines > 0) ? (S.IS312_1 ? qTot / activeLines : +(S['G2.Qload'] || 0)) : 0;
    const gridLive = +(S.gridOk !== undefined ? S.gridOk : 1) > 0.5;
    S.V371 = gridLive ? 38.5 : 0; S.V372 = gridLive ? 38.4 : 0;
    const g1ToBus = S.CB331 && S.IS331_1 && S['G1.Vgen'] > 1;
    const g2ToBus = S.CB332 && S.IS332_2 && S['G2.Vgen'] > 1;
    const b1Live = (gridLive && l1) || g1ToBus;
    const b2Live = (gridLive && l2) || g2ToBus;
    S.VbusZone1 = b1Live || (S.IS312_1 && b2Live) ? 38.5 : 0;
    S.VbusZone2 = b2Live || (S.IS312_1 && b1Live) ? 38.5 : 0;
    S.Vaux6 = (S.IS612_1 && S['G1.V60'] > 0.5) || (S.IS612_2 && S['G2.V60'] > 0.5) ? 6.32 : 0;
    S.V400Zone1 = S.Vaux6 > 0.5 ? 0.402 : 0;
    S.V400Zone2 = S.VbusZone2 > 1 ? 0.402 : 0;
    S.V400 = (S.AXT1 && S.V400Zone1 > 0.1) || (S.AXT2 && S.V400Zone2 > 0.1) || (S.dgEngine && S.dgCb) ? 0.402 : 0;
    S.dgKW = (S.dgEngine && S.dgCb) ? 145 : 0;
    S.dgKVAr = (S.dgEngine && S.dgCb) ? 38 : 0;
  }

  function applyDemoScenario(id) {
    initDemoState();
    const tg = demo.targets;
    const clearEarth = () => {
      ['GS371_76', 'GS371_75', 'GS371_15', 'GS372_76', 'GS372_75', 'GS372_25', 'GS331_14', 'GS331_15', 'GS332_24', 'GS332_25', 'GS1QE', 'GS2QE']
        .forEach(k => { tg[k] = 0; S[k] = 0; });
    };
    clearEarth();
    S.gridOk = 1; S.scFaults = []; S.lineRelays = []; S.faults = []; S.thermalSpeed = 1;
    S['G1.auxAuto'] = 1; S['G2.auxAuto'] = 1;
    S['G1.tripped'] = 0; S['G2.tripped'] = 0; S['G1.tripReason'] = ''; S['G2.tripReason'] = '';
    S['G1.relays'] = []; S['G2.relays'] = [];
    S['G1.maintSeal'] = 0; S['G2.maintSeal'] = 0; S['G1.servoLock'] = 0; S['G2.servoLock'] = 0;
    if (id === 1 || id === 2) {
      tg.G1Mode = 0; tg.G2Mode = 0; tg.CB331 = 0; tg.CB332 = 0; tg.CB601 = 0; tg.CB602 = 0;
      tg.AXT1 = 0; tg.AXT2 = 1;
      S['G1.speed'] = 0; S['G2.speed'] = 0; S['G1.GV'] = 0; S['G2.GV'] = 0; S['G1.Pload'] = 0; S['G2.Pload'] = 0;
      S['G1.Vgen'] = 0; S['G2.Vgen'] = 0; S['G1.grid'] = 0; S['G2.grid'] = 0;
      if (id === 2) {
        tg.IntakeGate = 0; tg.IS331_1 = 0; tg.GS1QE = 1; tg.GS331_14 = 1; tg.GS331_15 = 1;
        S['G1.maintSeal'] = 1; S['G1.servoLock'] = 1; S['G1.airBrake'] = 0; S['G1.fieldDischarge'] = 0; S['G1.oilMPa'] = 2.4;
      }
    } else if (id === 3) {
      tg.G1Mode = 2; tg.CB601 = 1; tg.CB331 = 0; tg.G2Mode = 0; tg.CB332 = 0; tg.CB602 = 0;
      S['G1.speed'] = 214.3; S['G1.spTrim'] = 0.25; S['G1.vTrim'] = -3.0; S['G1.Vgen'] = 6.13; S['G1.grid'] = 0;
      S['G2.speed'] = 0; S['G2.Pload'] = 0; S['G2.grid'] = 0;
    } else if (id === 4) {
      tg.G1Mode = 1; tg.G2Mode = 1; tg.G1P = 8.0; tg.G1Q = 4.0; tg.G2P = 8.0; tg.G2Q = 4.0;
      tg.IS312_1 = 1; tg.AXT1 = 1; tg.AXT2 = 0;
      [1, 2].forEach(u => {
        const k = 'G' + u + '.';
        S[k + 'auxAuto'] = 1; S[k + 'waterPump1'] = 1; S[k + 'waterPump2'] = 0; S[k + 'cwValve'] = 1;
        S[k + 'cwPreMPa'] = 0.34; S[k + 'cwMPa'] = 0.32; S[k + 'cwFlow'] = 1; S[k + 'cwTemp'] = 27.5;
        S[k + 'thrustOil'] = 44.5; S[k + 'thrust'] = 49.0; S[k + 'stator'] = 78.0; S[k + 'statorMax'] = 79.5;
      });
    } else if (id === 5) {
      S.gridOk = 0; tg.G1Mode = 0; tg.G2Mode = 0; tg.CB331 = 0; tg.CB332 = 0; tg.CB601 = 0; tg.CB602 = 0;
      tg.CB371 = 0; tg.CB372 = 0; tg.AXT1 = 0; tg.AXT2 = 0; tg.dgEngine = 0; tg.dgCb = 0; S.V400 = 0;
      S['G1.speed'] = 0; S['G2.speed'] = 0; S['G1.Vgen'] = 0; S['G2.Vgen'] = 0; S['G1.grid'] = 0; S['G2.grid'] = 0;
    } else if (id === 6) {
      tg.G1Mode = 1; tg.G2Mode = 1; tg.G1P = 5.0; tg.G2P = 5.0; tg.AXT1 = 1; tg.AXT2 = 0;
    } else if (id === 7) {
      tg.G1Mode = 1; tg.G2Mode = 0; tg.G1P = 7.0; tg.G1Q = 2.0; tg.CB332 = 0; tg.CB602 = 0;
      S['G1.auxAuto'] = 0; S['G1.waterPump1'] = 1; S['G1.cwValve'] = 0; S['G1.cwPreMPa'] = 0.48; S['G1.cwMPa'] = 0; S['G1.cwFlow'] = 0;
      S['G1.thrustOil'] = 43.0; S.thermalSpeed = 8;
    } else if (id === 8) {
      tg.G1Mode = 1; tg.G2Mode = 1; tg.CB371 = 0; tg.CB372 = 0; tg.G1P = 7.0; tg.G2P = 7.0;
      S['G1.speed'] = 248; S['G2.speed'] = 246;
    } else if (id === 9) {
      tg.G1Mode = 0; tg.CB601 = 0; tg.CB331 = 0; S['G1.fieldDischarge'] = 0; S['G1.speed'] = 42;
      S['G1.tripped'] = 1; S['G1.tripReason'] = '87G So lệch dọc máy phát MF1'; S['G1.relays'] = ['87G'];
      tg.G2Mode = 1; tg.G2P = 6.0; tg.IS612_1 = 0; tg.IS612_2 = 1; tg.AXT1 = 1; tg.AXT2 = 0;
    }
    stepDemo(0.05);
  }

  // Mọi lệnh thao tác 3D đều đi qua set(name, val) chuẩn của app.js để giữ nguyên SOE, INTERLOCK & âm thanh
  function sendCommand(name, val) {
    if (typeof online !== 'undefined' && online) {
      set(name, val);
      return;
    }
    const tg = demo.targets;
    const u = String(name || '').toUpperCase();
    const gm = u.match(/^G(?:EN)?([12])\.(.+)$/);
    if (gm) {
      const gn = +gm[1], gk = 'G' + gn + '.', fld = gm[2];
      const v = val !== undefined ? +val : undefined;
      if (fld === 'MODE') {
        if (gn === 1) { tg.G1Mode = v; if (v === 1) { tg.CB601 = 1; tg.CB331 = 1; } else if (v === 0) { tg.CB331 = 0; } }
        else { tg.G2Mode = v; if (v === 1) { tg.CB602 = 1; tg.CB332 = 1; } else if (v === 0) { tg.CB332 = 0; } }
      } else if (fld === 'SYNCCLOSE') {
        if (gn === 1) { tg.CB601 = 1; tg.IS331_1 = 1; tg.CB331 = 1; tg.G1Mode = 1; }
        else { tg.CB602 = 1; tg.IS332_2 = 1; tg.CB332 = 1; tg.G2Mode = 1; }
      } else if (fld === 'SPTRIM') S[gk + 'spTrim'] = v;
      else if (fld === 'VTRIM') S[gk + 'vTrim'] = v;
      else if (fld === 'P') { if (gn === 1) tg.G1P = Math.max(0, Math.min(8.5, v)); else tg.G2P = Math.max(0, Math.min(8.5, v)); }
      else if (fld === 'Q') { if (gn === 1) tg.G1Q = Math.max(-4, Math.min(7, v)); else tg.G2Q = Math.max(-4, Math.min(7, v)); }
      else if (fld === 'RESET') { S[gk + 'tripped'] = 0; S[gk + 'tripReason'] = ''; S[gk + 'relays'] = []; }
      else if (fld === 'AUXAUTO') { S[gk + 'auxAuto'] = v !== undefined ? (v ? 1 : 0) : (S[gk + 'auxAuto'] ? 0 : 1); }
      else if (['WATERPUMP1', 'WATERPUMP2', 'CWVALVE', 'OILPUMP1', 'OILPUMP2', 'HC1', 'HC2', 'AIRCOMP1', 'AIRCOMP2'].includes(fld)) {
        if (S[gk + 'auxAuto'] !== 0) {
          if (typeof toast === 'function') toast('Đang ở chế độ TỰ ĐỘNG – chuyển sang BẰNG TAY để thao tác bơm/van!', true);
          return;
        }
        const map = { WATERPUMP1: 'waterPump1', WATERPUMP2: 'waterPump2', CWVALVE: 'cwValve', OILPUMP1: 'oilPump1', OILPUMP2: 'oilPump2', HC1: 'hc1', HC2: 'hc2', AIRCOMP1: 'airComp1', AIRCOMP2: 'airComp2' };
        const key = gk + map[fld];
        S[key] = v !== undefined ? (v ? 1 : 0) : (S[key] ? 0 : 1);
      } else if (fld === 'AIRBRAKE') S[gk + 'airBrake'] = v !== undefined ? (v ? 1 : 0) : (S[gk + 'airBrake'] ? 0 : 1);
      else if (fld === 'SERVOLOCK') S[gk + 'servoLock'] = v !== undefined ? (v ? 1 : 0) : (S[gk + 'servoLock'] ? 0 : 1);
      else if (fld === 'MAINTSEAL') S[gk + 'maintSeal'] = v !== undefined ? (v ? 1 : 0) : (S[gk + 'maintSeal'] ? 0 : 1);
      else if (fld === 'FIELDDISCHARGE') S[gk + 'fieldDischarge'] = v !== undefined ? (v ? 1 : 0) : (S[gk + 'fieldDischarge'] ? 0 : 1);
      else if (fld === 'LEAKRESET') {
        if (v === undefined || v >= 0.5) {
          S[gk + 'headCover'] = 0; S[gk + 'leakage'] = 0; S[gk + 'leakReset'] = 0;
          S.faults = (S.faults || []).filter(x => x !== 'g' + gn + '.leak');
        } else { S[gk + 'leakReset'] = 0; }
      }
    } else if (u === 'INTERLOCK') {
      S.interlock = val !== undefined ? (+val ? 'strict' : 'natural') : (S.interlock === 'strict' ? 'natural' : 'strict');
    } else if (u === 'THERMALSPEED') {
      S.thermalSpeed = Math.max(1, Math.min(60, +val || 1));
    } else if (name === 'StandbyInput400') { tg.StandbyInput400 = tg.StandbyInput400 ? 0 : 1; tg.dgEngine = tg.StandbyInput400; if (!tg.dgEngine) tg.dgCb = 0; }
    else if (name === 'dgCb') { tg.dgCb = tg.dgCb ? 0 : 1; if (tg.dgCb) tg.dgEngine = 1; }
    else if (Object.prototype.hasOwnProperty.call(tg, name)) {
      tg[name] = val !== undefined ? (+val ? 1 : 0) : (tg[name] ? 0 : 1);
    }
    if (typeof toast === 'function') toast('[Preview mẫu] Đã thực thi: ' + name + (val !== undefined ? ' = ' + val : ''));
  }

  window.HpsSim3D = { sendDemoCmd: sendCommand, applyDemoScenario };

  // =========================================================================
  // 3. TIỆN ÍCH TEXTURE CANVAS & HÌNH HỌC THREE.JS r128
  // =========================================================================
  function makeGlowTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, inner); g.addColorStop(0.45, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
  }

  function makeHazardTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#facc15'; ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#0f172a';
    for (let x = -32; x < 160; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x + 30, 32); ctx.lineTo(x + 16, 32);
      ctx.closePath(); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 1);
    return tex;
  }

  function makeConcreteTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const v = 185 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
    }
    ctx.strokeStyle = 'rgba(100,116,139,0.22)'; ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2);
    return tex;
  }

  function makeGrassTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#68b35e'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3200; i++) {
      const g = 148 + Math.floor(Math.random() * 52);
      ctx.fillStyle = `rgb(${Math.floor(g * 0.56)},${g},${Math.floor(g * 0.48)})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(16, 14);
    return tex;
  }

  function makeGravelTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#aeb8c4'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6800; i++) {
      const v = 128 + Math.floor(Math.random() * 98);
      const sz = Math.random() < 0.72 ? 2 : 3;
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
      ctx.fillRect(Math.random() * 255, Math.random() * 255, sz, sz);
    }
    // Thêm hạt đá tối tạo chiều sâu bề mặt đá dăm 1x2
    for (let i = 0; i < 1800; i++) {
      const v = 86 + Math.floor(Math.random() * 44);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(Math.random() * 255, Math.random() * 255, 2, 1.5);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 9);
    return tex;
  }

  function makeB40MeshTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.92)';
    ctx.lineWidth = 3.2;
    const step = 32;
    for (let k = -128; k <= 256; k += step) {
      ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + 128, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k, 128); ctx.lineTo(k + 128, 0); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
    ctx.lineWidth = 1.2;
    for (let k = -128; k <= 256; k += step) {
      ctx.beginPath(); ctx.moveTo(k + 2, 0); ctx.lineTo(k + 130, 128); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function makeSignboardTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 140;
    const ctx = c.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 1024, 0);
    grd.addColorStop(0, '#0f294a'); grd.addColorStop(0.5, '#1d4ed8'); grd.addColorStop(1, '#0f294a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 1024, 140);
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 6; ctx.strokeRect(5, 5, 1014, 130);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 34px system-ui,Segoe UI,Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TRƯỜNG CAO ĐẲNG ĐIỆN LỰC MIỀN TRUNG – HPS 2×8 MW', 512, 56);
    ctx.fillStyle = '#fde047'; ctx.font = '600 22px system-ui,Segoe UI,Arial,sans-serif';
    ctx.fillText('SA BÀN SỐ THỜI GIAN THỰC · NHÀ MÁY THUỶ ĐIỆN TUABIN KAPLAN', 512, 104);
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
  }

  function makeCabinetFaceTexture(title, accentHex) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 128, 256);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 120, 248);
    ctx.fillStyle = accentHex; ctx.fillRect(8, 10, 112, 26);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, 64, 28);
    // Màn hình HMI nhỏ trên mặt tủ
    ctx.fillStyle = '#0f172a'; ctx.fillRect(18, 48, 92, 62);
    ctx.fillStyle = '#38bdf8'; ctx.fillRect(24, 58, 36, 10);
    ctx.fillStyle = '#4ade80'; ctx.fillRect(24, 74, 62, 8);
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(24, 88, 48, 8);
    // Đèn báo & đồng hồ đo
    const cols = ['#22c55e', '#ef4444', '#f59e0b', '#38bdf8'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.arc(28 + i * 24, 130, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Khe thông gió đáy tủ
    ctx.fillStyle = '#475569';
    for (let y = 175; y < 235; y += 10) ctx.fillRect(22, y, 84, 4);
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
  }

  function makeHorizontalTank(radius, length, mat) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 20), mat);
    cyl.rotation.z = Math.PI / 2; cyl.castShadow = true; cyl.receiveShadow = true;
    g.add(cyl);
    const capGeo = new THREE.SphereGeometry(radius, 18, 12);
    const c1 = new THREE.Mesh(capGeo, mat); c1.position.x = -length / 2; g.add(c1);
    const c2 = new THREE.Mesh(capGeo, mat); c2.position.x = length / 2; g.add(c2);
    return g;
  }

  function makeSpiralCaseGeometry(inletR, centerR, turns) {
    const segU = 56, segV = 18;
    const positions = [], indices = [];
    for (let i = 0; i <= segU; i++) {
      const t = i / segU;
      const theta = Math.PI + t * Math.PI * 2 * turns;
      const tubeR = inletR * (1 - 0.72 * t);
      const ringR = centerR + tubeR * 0.85;
      const cx = Math.cos(theta) * ringR, cz = Math.sin(theta) * ringR;
      const rx = Math.cos(theta), rz = Math.sin(theta);
      for (let j = 0; j <= segV; j++) {
        const phi = (j / segV) * Math.PI * 2;
        const cp = Math.cos(phi), sp = Math.sin(phi);
        positions.push(cx + rx * cp * tubeR, sp * tubeR * 0.92, cz + rz * cp * tubeR);
      }
    }
    const stride = segV + 1;
    for (let i = 0; i < segU; i++) {
      for (let j = 0; j < segV; j++) {
        const a = i * stride + j, b = (i + 1) * stride + j;
        const c = (i + 1) * stride + j + 1, d = i * stride + j + 1;
        indices.push(a, b, d, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function makeKaplanBladeGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0.0, -0.19);
    shape.bezierCurveTo(0.45, -0.36, 1.25, -0.54, 1.66, -0.15);
    shape.bezierCurveTo(1.78, 0.03, 1.70, 0.30, 1.44, 0.38);
    shape.bezierCurveTo(1.00, 0.46, 0.40, 0.32, 0.0, 0.17);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.10, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2
    });
    geo.translate(0, 0, -0.05);
    geo.rotateX(Math.PI / 2);
    return geo;
  }

  // Tạo cây xanh kiến trúc đặt trên sườn đồi & ven đường
  function makeTree(x, y, z, scale) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 1.6 * scale, 7),
      new THREE.MeshStandardMaterial({ color: 0x784c2a, roughness: 0.92 })
    );
    trunk.position.y = 0.8 * scale; trunk.castShadow = true;
    g.add(trunk);
    const greens = [0x2d6a4f, 0x40916c, 0x52b788];
    const col = greens[Math.abs(Math.floor(x * 7 + z * 13)) % greens.length];
    const fMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.45 * scale, 2.5 * scale, 8), fMat);
    c1.position.y = 2.4 * scale; c1.castShadow = true; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 2.1 * scale, 8), fMat);
    c2.position.y = 3.6 * scale; c2.castShadow = true; g.add(c2);
    return g;
  }

  // Tạo đường dây mềm có độ võng tự nhiên giữa pA và pB bằng QuadraticBezierCurve3
  function makeCatenaryCurve(pA, pB, sag) {
    const mid = new THREE.Vector3().lerpVectors(pA, pB, 0.5);
    mid.y -= (sag || 0) * 1.9;
    return new THREE.QuadraticBezierCurve3(pA.clone(), mid, pB.clone());
  }

  // =========================================================================
  // 4. ĐĂNG KÝ TRANG 3D VÀO HMI
  // =========================================================================
  addPage('view3d', 'Mô hình 3D', root => {
    const wrap = h('div', { class: 's3d-wrap' }, root);

    if (typeof THREE === 'undefined') {
      const fb = h('div', { class: 's3d-fallback' }, wrap,
        '<b style="font-size:16px;color:#1d4ed8">Không thể tải thư viện đồ hoạ Three.js (r128)</b>' +
        '<div style="max-width:460px;font-size:13px;color:#475569">Thiết bị chưa có kết nối Internet để tải three.min.js từ CDN. Hãy kết nối mạng hoặc nhúng file three.min.js nội bộ rồi tải lại trang.</div>');
      h('button', { class: 's3d-btn act', onclick: () => location.reload() }, fb, '↻ Tải lại trang');
      return;
    }

    const canvasHost = h('div', { class: 's3d-canvas' }, wrap);
    const labelLayer = h('div', { class: 's3d-labels' }, wrap);

    // -----------------------------------------------------------------------
    // 4.1 KHỞI TẠO SCENE BAN NGÀY, CAMERA & ÁNH SÁNG ĐỔ BÓNG MỀM MỊN
    // -----------------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeafe);
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.0021);

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.25, 480);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    canvasHost.appendChild(renderer.domElement);

    // Vòm trời ban ngày dịu nhẹ
    (function buildDaylightSky() {
      const c = document.createElement('canvas'); c.width = 32; c.height = 256;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0.0, '#7dd3fc');
      g.addColorStop(0.35, '#bae6fd');
      g.addColorStop(0.62, '#dbeafe');
      g.addColorStop(0.84, '#eff6ff');
      g.addColorStop(1.0, '#dcfce7');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 256);
      const tex = new THREE.CanvasTexture(c);
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(290, 24, 16),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
      );
      scene.add(sky);
    })();

    // HemisphereLight trời sáng 0xffffff – đất cỏ 0x86efac + DirectionalLight đổ bóng mềm mịn
    scene.add(new THREE.HemisphereLight(0xffffff, 0x86efac, 0.92));

    const sun = new THREE.DirectionalLight(0xfffbeb, 1.25);
    sun.position.set(44, 72, 46);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 210;
    const sc = 68;
    sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc;
    sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    const skyFill = new THREE.DirectionalLight(0xbae6fd, 0.42);
    skyFill.position.set(-55, 34, -38);
    scene.add(skyFill);

    // Đèn rọi bổ trợ trong khoang cắt vát tuabin & máy phát
    const pitLight1 = new THREE.PointLight(0xfff7ed, 0.85, 22);
    pitLight1.position.set(7.5, 9.5, -8); scene.add(pitLight1);
    const pitLight2 = new THREE.PointLight(0xfff7ed, 0.85, 22);
    pitLight2.position.set(7.5, 9.5, 8); scene.add(pitLight2);

    // -----------------------------------------------------------------------
    // 4.2 VẬT LIỆU CHUẨN BAN NGÀY & DANH SÁCH X-RAY
    // -----------------------------------------------------------------------
    const concreteTex = makeConcreteTexture();
    const grassTex = makeGrassTexture();
    const gravelTex = makeGravelTexture();
    const hazardTex = makeHazardTexture();
    const waterGlowTex = makeGlowTexture('rgba(224,249,255,1)', 'rgba(34,211,238,0.75)');
    const foamGlowTex = makeGlowTexture('rgba(255,255,255,0.96)', 'rgba(224,242,254,0.45)');
    const smokeGlowTex = makeGlowTexture('rgba(148,163,184,0.72)', 'rgba(100,116,139,0.2)');

    const matConcrete = new THREE.MeshStandardMaterial({ map: concreteTex, color: 0xe2e8f0, roughness: 0.84, metalness: 0.05 });
    const matLightWall = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78, metalness: 0.06 });
    const matDarkConcrete = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.08 });
    const matGrass = new THREE.MeshStandardMaterial({ map: grassTex, color: 0x86efac, roughness: 0.94, metalness: 0.02 });
    const matHill = new THREE.MeshStandardMaterial({ color: 0x5ea85b, roughness: 0.95, metalness: 0.02 });
    const matGravel = new THREE.MeshStandardMaterial({ map: gravelTex, color: 0xe2e8f0, roughness: 0.92, metalness: 0.04 });
    const matAsphalt = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.86, metalness: 0.05 });
    const matRoadLine = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    const matSteel = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.42, metalness: 0.72 });
    const matDarkSteel = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.46, metalness: 0.76 });
    const matBrightSteel = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.88 });
    const matPorcelainWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.30, metalness: 0.14 });
    const matCharcoal = new THREE.MeshStandardMaterial({ color: 0x273240, roughness: 0.55, metalness: 0.45 });
    const matYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.36, metalness: 0.32 });
    const matValveYellow = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.45 });
    const matServoGreen = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.38, metalness: 0.40 });
    const matCopper = new THREE.MeshStandardMaterial({ color: 0xd96b27, roughness: 0.28, metalness: 0.84 });
    const matBronze = new THREE.MeshStandardMaterial({ color: 0xc84b28, roughness: 0.25, metalness: 0.85 });
    const matPorcelainIns = new THREE.MeshStandardMaterial({ color: 0x7c3e26, roughness: 0.22, metalness: 0.18 });
    const matTrafoTank = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.48, metalness: 0.58 });
    const matBluePipe = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.48 });
    const matOilPipe = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.36, metalness: 0.42 });
    const matBusductRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.40, metalness: 0.48 });
    const matAirSilver = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.34, metalness: 0.48 });

    // Danh sách vật liệu hỗ trợ chế độ X-Ray (Nhìn xuyên ống)
    const xrayMaterials = [];
    function registerXray(mat, normalOpacity, xrayOpacity, normalTransparent) {
      mat.transparent = !!normalTransparent;
      mat.opacity = normalOpacity;
      mat.depthWrite = !normalTransparent;
      xrayMaterials.push({ mat, normalOpacity, xrayOpacity, normalTransparent: !!normalTransparent });
      return mat;
    }

    // Ống áp lực xanh dương (trong suốt khi bật X-Ray)
    const matPenstockShell = registerXray(
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.36, metalness: 0.58, side: THREE.DoubleSide }),
      1.0, 0.16, false
    );
    // Buồng xoắn & ống hút BÁN TRONG SUỐT MẶC ĐỊNH (0.45 mặc định, 0.15 khi bật X-Ray) để luôn thấy rõ phần quay!
    const matSpiralShell = registerXray(
      new THREE.MeshPhysicalMaterial({ color: 0x0284c7, roughness: 0.22, metalness: 0.28, side: THREE.DoubleSide }),
      0.45, 0.15, true
    );
    const matDraftShell = registerXray(
      new THREE.MeshPhysicalMaterial({ color: 0x0369a1, roughness: 0.30, metalness: 0.25, side: THREE.DoubleSide }),
      0.45, 0.15, true
    );
    // Vỏ máy phát trắng sứ (cắt vát sẵn 110° mặt trước; khi bật X-Ray toàn bộ vỏ trở nên trong suốt)
    const matGenHousingXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.15, side: THREE.DoubleSide }),
      1.0, 0.15, false
    );
    // Khối móng bê tông quanh tuabin (bán trong suốt nhẹ để khoe buồng xoắn & ống hút, X-Ray hạ xuống 0.12)
    const matTurbinePit = registerXray(
      new THREE.MeshStandardMaterial({ map: concreteTex, color: 0xdbe4ee, roughness: 0.85, metalness: 0.04 }),
      0.42, 0.12, true
    );
    const matGenFloorXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72, metalness: 0.12 }),
      1.0, 0.20, false
    );
    // Vật liệu hỗ trợ X-Ray cho bầu bánh xe cầu, trục rỗng, xi lanh servomotor cánh & lõi rotor
    const matHubShellXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0xc84b28, roughness: 0.26, metalness: 0.84, side: THREE.DoubleSide }),
      1.0, 0.22, false
    );
    const matShaftShellXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.88, side: THREE.DoubleSide }),
      1.0, 0.18, false
    );
    const matFlangeXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.46, metalness: 0.76 }),
      1.0, 0.24, false
    );
    const matYellowXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.36, metalness: 0.32 }),
      1.0, 0.26, false
    );
    const matServoCylXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.34, metalness: 0.45, side: THREE.DoubleSide }),
      1.0, 0.24, false
    );
    const matRotorHubXray = registerXray(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.46, metalness: 0.76 }),
      1.0, 0.20, false
    );
    // Cực từ N (đỏ) / S (xanh dương) cho rotor 28 cực SF8000-28
    const matPoleN = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.45 });
    const matPoleS = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.38, metalness: 0.45 });


    // -----------------------------------------------------------------------
    // 4.2b HỆ THỐNG CHỌN & TƯƠNG TÁC TRỰC TIẾP 3D (RAYCASTER + HOVER HALO)
    // -----------------------------------------------------------------------
    const pickMeshes = [];
    const matHitBox = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const hoverBox3 = new THREE.Box3();
    const hoverSize = new THREE.Vector3();
    const hoverCenter = new THREE.Vector3();

    // Khung phát sáng viền + lớp halo khi rê chuột qua thiết bị 3D
    const hoverHighlightGroup = new THREE.Group();
    hoverHighlightGroup.visible = false;
    const hoverEdgeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });
    const hoverEdgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      hoverEdgeMat
    );
    const hoverGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide
    });
    const hoverGlowMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hoverGlowMat);
    hoverHighlightGroup.add(hoverEdgeLines);
    hoverHighlightGroup.add(hoverGlowMesh);
    scene.add(hoverHighlightGroup);

    function registerInteractive(rootGroup, info, hitBoxDef) {
      info.rootGroup = rootGroup;
      if (hitBoxDef) {
        const hb = new THREE.Mesh(
          new THREE.BoxGeometry(hitBoxDef.w, hitBoxDef.h, hitBoxDef.d),
          matHitBox
        );
        hb.position.set(hitBoxDef.x || 0, hitBoxDef.y || 0, hitBoxDef.z || 0);
        hb.userData.pickItem = info;
        rootGroup.add(hb);
        pickMeshes.push(hb);
      }
      rootGroup.traverse(ch => {
        if (ch.isMesh && ch !== hoverGlowMesh && ch.material !== matHitBox && !ch.userData.pickItem) {
          ch.userData.pickItem = info;
          pickMeshes.push(ch);
        }
      });
      return info;
    }

    // -----------------------------------------------------------------------
    // 4.3 THUNG LŨNG CỎ XANH, SƯỜN ĐỒI, CÂY XANH & ĐƯỜNG NHỰA NỘI BỘ
    // -----------------------------------------------------------------------
    // Thảm cỏ thung lũng rộng lớn
    const valleyFloor = new THREE.Mesh(new THREE.BoxGeometry(200, 2, 160), matGrass);
    valleyFloor.position.set(16, -6.2, 4);
    valleyFloor.receiveShadow = true;
    scene.add(valleyFloor);

    // Sườn đồi thoai thoải bao quanh hồ chứa và bờ Bắc kênh xả (nơi đặt 2 cột 35 kV bờ bên kia!)
    const northBank = new THREE.Mesh(new THREE.BoxGeometry(118, 8.2, 46), matGrass);
    northBank.position.set(36, -1.8, -46);
    northBank.receiveShadow = true;
    scene.add(northBank);

    // Bờ cỏ phía Đông sân trạm 35 kV (đỡ đường nhựa phía Đông & hành lang 2 cột xuất tuyến 371/372)
    const eastBank = new THREE.Mesh(new THREE.BoxGeometry(66, 11.2, 26.5), matGrass);
    eastBank.position.set(79.8, -0.05, 28.1);
    eastBank.receiveShadow = true;
    scene.add(eastBank);

    const hillConfigs = [
      [-40, 6.5, -45, 58, 22, 26],
      [-40, 6.5, 48, 58, 22, 26],
      [6, 3.0, 52, 48, 16, 22],
      [56, 3.5, 52, 54, 17, 24],
      [78, 3.5, -44, 42, 14, 34]
    ];
    hillConfigs.forEach(([hx, hy, hz, hw, hh, hd]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), matHill);
      m.position.set(hx, hy, hz);
      m.receiveShadow = true;
      scene.add(m);
    });

    // Cây xanh rải tự nhiên trên đồi, ven bờ sông và lối vào
    const treeCoords = [
      [-32, 17.4, -36, 1.3], [-24, 17.4, -35, 1.1], [-46, 17.4, -38, 1.5], [-16, 17.4, -37, 1.2],
      [-36, 17.4, 38, 1.4], [-22, 17.4, 39, 1.2], [-10, 11.0, 44, 1.3], [6, 11.0, 44, 1.2],
      [26, 11.0, 45, 1.4], [44, 11.8, 43, 1.3], [60, 11.8, 44, 1.5],
      [18, 2.3, -29, 1.2], [28, 2.3, -31, 1.4], [38, 2.3, -29, 1.1], [45, 2.3, -34, 1.3],
      [68, 2.3, -30, 1.4], [74, 2.3, -25, 1.2], [52, 2.3, -38, 1.5]
    ];
    treeCoords.forEach(([tx, ty, tz, ts]) => scene.add(makeTree(tx, ty, tz, ts)));

    // Đường nhựa nội bộ có vạch kẻ trắng chạy quanh gian máy & sân trạm 35 kV
    const roadGroup = new THREE.Group();
    scene.add(roadGroup);
    function addRoadSegment(x, y, z, w, d, horiz) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), matAsphalt);
      r.position.set(x, y, z); r.receiveShadow = true;
      roadGroup.add(r);
      // Vạch kẻ đường đứt nét trắng ở giữa
      const len = horiz ? w : d;
      for (let s = -len / 2 + 1.5; s < len / 2 - 1.2; s += 3.2) {
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? 1.6 : 0.16, 0.18, horiz ? 0.16 : 1.6),
          matRoadLine
        );
        dash.position.set(horiz ? x + s : x, y + 0.02, horiz ? z : z + s);
        roadGroup.add(dash);
      }
    }
    addRoadSegment(18, 5.66, 36.8, 66, 4.2, true);   // Đường trục Nam chạy dọc nhà máy -> sân trạm
    addRoadSegment(-12.2, 5.66, 26.2, 4.2, 25, false); // Đường nhánh phía Tây gian phụ trợ
    addRoadSegment(49.2, 5.66, 26.2, 4.2, 25, false);  // Đường vòng phía Đông sân trạm 35 kV

    // -----------------------------------------------------------------------
    // 4.4 HỒ CHỨA THƯỢNG LƯU – ĐẬP BÊ TÔNG TRỌNG LỰC – ĐẬP TRÀN – CỬA NHẬN NƯỚC – HẠ LƯU
    // -----------------------------------------------------------------------
    const upWaterGeo = new THREE.PlaneGeometry(46, 62, 34, 34);
    upWaterGeo.rotateX(-Math.PI / 2);
    const upWaterBaseY = new Float32Array(upWaterGeo.attributes.position.count);
    for (let i = 0; i < upWaterBaseY.length; i++) upWaterBaseY[i] = upWaterGeo.attributes.position.getY(i);
    const upWaterMesh = new THREE.Mesh(upWaterGeo, new THREE.MeshPhongMaterial({
      color: 0x0ea5e9, emissive: 0x0369a1, emissiveIntensity: 0.25,
      specular: 0xffffff, shininess: 110, transparent: true, opacity: 0.88
    }));
    upWaterMesh.position.set(-40, 12.0, -1);
    upWaterMesh.receiveShadow = true;
    scene.add(upWaterMesh);

    const upWaterBody = new THREE.Mesh(
      new THREE.BoxGeometry(45.8, 18, 61.6),
      new THREE.MeshBasicMaterial({ color: 0x0369a1, transparent: true, opacity: 0.55 })
    );
    upWaterBody.position.set(-40, 2.5, -1);
    scene.add(upWaterBody);

    // Đập bê tông trọng lực & Đập tràn
    const damGroup = new THREE.Group();
    scene.add(damGroup);
    function makeDamSection(widthZ, topY, baseX) {
      const sh = new THREE.Shape();
      sh.moveTo(-4, -5.5); sh.lineTo(5.5, -5.5); sh.lineTo(1.2, topY); sh.lineTo(-4, topY);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: widthZ, bevelEnabled: false });
      geo.translate(0, 0, -widthZ / 2);
      const m = new THREE.Mesh(geo, matConcrete);
      m.position.set(baseX, 0, 0); m.castShadow = true; m.receiveShadow = true;
      return m;
    }
    const damMain = makeDamSection(48, 19.2, -14.8); damMain.position.z = 10; damGroup.add(damMain);
    const damNorth = makeDamSection(10, 19.2, -14.8); damNorth.position.z = -31; damGroup.add(damNorth);
    const damRoad = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 70), matAsphalt);
    damRoad.position.set(-16.2, 19.45, 0); damGroup.add(damRoad);

    // Khoang đập tràn (Spillway) ở Z = -26 đến -14
    const spillBody = makeDamSection(12, 13.6, -14.8); spillBody.position.z = -20; damGroup.add(spillBody);
    for (const pz of [-25.8, -20.0, -14.2]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(8.5, 6.2, 1.2), matConcrete);
      pier.position.set(-14.9, 16.5, pz); pier.castShadow = true; damGroup.add(pier);
    }
    const chute = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.8, 11.4), matDarkConcrete);
    chute.position.set(-7.8, 4.2, -20); chute.rotation.z = -0.82; damGroup.add(chute);

    // Dải nước tràn tự do đổ xuống hạ lưu (qSpill > 0.1)
    const spillGroup = new THREE.Group();
    scene.add(spillGroup);
    const spillCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-18.5, 13.9, 0), new THREE.Vector3(-14.0, 13.7, 0),
      new THREE.Vector3(-10.6, 9.2, 0), new THREE.Vector3(-5.8, 1.5, 0), new THREE.Vector3(-2.5, -1.8, 0)
    ]);
    const matSpillSheet = new THREE.MeshPhongMaterial({
      color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 0.25, specular: 0xffffff,
      shininess: 120, transparent: true, opacity: 0.78, side: THREE.DoubleSide
    });
    for (const sz of [-22.9, -17.1]) {
      const spMesh = new THREE.Mesh(new THREE.TubeGeometry(spillCurve, 24, 1.85, 10, false), matSpillSheet);
      spMesh.scale.set(1, 0.32, 2.35); spMesh.position.z = sz;
      spillGroup.add(spMesh);
    }
    const spillPartCount = 130;
    const spillPos = new Float32Array(spillPartCount * 3);
    const spillPhase = new Float32Array(spillPartCount);
    const spillLane = new Float32Array(spillPartCount);
    for (let i = 0; i < spillPartCount; i++) {
      spillPhase[i] = Math.random();
      spillLane[i] = (i % 2 === 0 ? -22.9 : -17.1) + (Math.random() - 0.5) * 4.4;
    }
    const spillPartGeo = new THREE.BufferGeometry();
    spillPartGeo.setAttribute('position', new THREE.BufferAttribute(spillPos, 3));
    const spillParticles = new THREE.Points(spillPartGeo, new THREE.PointsMaterial({
      size: 1.45, map: foamGlowTex, transparent: true, opacity: 0.88, depthWrite: false
    }));
    spillGroup.add(spillParticles);

    // Tháp cửa nhận nước + Lưới chắn rác + Cửa van phẳng màu vàng + Tời nâng
    const intakeGroup = new THREE.Group();
    scene.add(intakeGroup);
    const intakeGates = [];
    const intakeCables = [];
    for (const iz of [-8, 8]) {
      for (const dz of [-2.55, 2.55]) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 15.5, 0.85), matConcrete);
        slot.position.set(-18.5, 11.4, iz + dz); slot.castShadow = true; intakeGroup.add(slot);
      }
      // Lưới chắn rác
      const rack = new THREE.Group();
      rack.position.set(-20.7, 7.2, iz); rack.rotation.z = 0.22;
      for (let r = -2.0; r <= 2.0; r += 0.36) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 8.2, 0.08), matDarkSteel);
        bar.position.z = r; rack.add(bar);
      }
      for (let ry = -3.4; ry <= 3.4; ry += 1.7) {
        const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 4.4), matSteel);
        hbar.position.y = ry; rack.add(hbar);
      }
      intakeGroup.add(rack);

      // Tời nâng trên đỉnh tháp
      const gantry = new THREE.Group();
      gantry.position.set(-18.5, 19.6, iz);
      for (const dz of [-2.2, 2.2]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.4, 0.55), matYellow);
        leg.position.set(0, 2.2, dz); leg.castShadow = true; gantry.add(leg);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 5.4), matYellow);
      beam.position.set(0, 4.4, 0); gantry.add(beam);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 14), matDarkSteel);
      drum.rotation.x = Math.PI / 2; drum.position.set(0, 4.9, 0); gantry.add(drum);
      const hoistMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 12), matBluePipe);
      hoistMotor.rotation.x = Math.PI / 2; hoistMotor.position.set(0, 4.9, 1.7); gantry.add(hoistMotor);
      intakeGroup.add(gantry);

      // Cửa van phẳng thép màu vàng
      const gate = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.6, 4.3), matYellow);
      plate.castShadow = true; gate.add(plate);
      for (let gy = -1.7; gy <= 1.7; gy += 0.85) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.22, 4.25), matDarkSteel);
        rib.position.y = gy; gate.add(rib);
      }
      gate.position.set(-18.5, 13.8, iz);
      intakeGroup.add(gate);
      intakeGates.push(gate);

      for (const cz of [-1.2, 1.2]) {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 6), matBrightSteel);
        cable.position.set(-18.5, 18.5, iz + cz);
        intakeGroup.add(cable);
        intakeCables.push({ mesh: cable });
      }

      // Giếng thông hơi đứng (Air Vent) ngay sau khe cửa van phẳng trên thân đập
      const airVentGroup = new THREE.Group();
      airVentGroup.position.set(-16.1, 0, iz);
      const ventCollar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.9, 1.45), matConcrete);
      ventCollar.position.set(0, 19.7, 0); ventCollar.castShadow = true; airVentGroup.add(ventCollar);
      const ventShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 14.4, 14), matBluePipe);
      ventShaft.position.set(0, 14.5, 0); ventShaft.castShadow = true; airVentGroup.add(ventShaft);
      const ventFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.16, 14), matDarkSteel);
      ventFlange.position.set(0, 21.35, 0); airVentGroup.add(ventFlange);
      const ventLouvre = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.55, 14), matBrightSteel);
      ventLouvre.position.set(0, 21.7, 0); airVentGroup.add(ventLouvre);
      const ventHood = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.48, 14), matDarkSteel);
      ventHood.position.set(0, 22.15, 0); ventHood.castShadow = true; airVentGroup.add(ventHood);
      intakeGroup.add(airVentGroup);
    }
    // Cho phép bấm trực tiếp vào cửa nhận nước trên đập để Đóng/Mở IntakeGate
    registerInteractive(intakeGroup, {
      id: 'IntakeGate',
      title: 'Cửa nhận nước (IntakeGate)',
      getTooltip: () => {
        const open = on('IntakeGate');
        return {
          status: open ? 'ĐANG MỞ' : 'ĐANG ĐÓNG',
          cls: open ? 'off' : 'warn',
          action: open ? 'Bấm để ĐÓNG cửa van' : 'Bấm để MỞ cửa van'
        };
      },
      onClick: () => ask(`${on('IntakeGate') ? 'Đóng' : 'Mở'} cửa nhận nước (IntakeGate)?`, () => sendCommand('IntakeGate'))
    });

    // Kênh xả hạ lưu rộng & trong xanh (X = +13 đến +85, Z = -24 đến +14)
    const tailWaterGeo = new THREE.PlaneGeometry(76, 38, 32, 24);
    tailWaterGeo.rotateX(-Math.PI / 2);
    const tailWaterMesh = new THREE.Mesh(tailWaterGeo, new THREE.MeshPhongMaterial({
      color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.2,
      specular: 0xe0f2fe, shininess: 95, transparent: true, opacity: 0.88
    }));
    tailWaterMesh.position.set(50, -2.5, -5);
    tailWaterMesh.receiveShadow = true;
    scene.add(tailWaterMesh);

    // Kè bê tông hai bên kênh xả hạ lưu
    const tailWallN = new THREE.Mesh(new THREE.BoxGeometry(74, 6.2, 1.6), matConcrete);
    tailWallN.position.set(49, -1.6, -24.2); scene.add(tailWallN);
    const tailWallS = new THREE.Mesh(new THREE.BoxGeometry(74, 8.2, 1.6), matConcrete);
    tailWallS.position.set(49, 0.0, 14.4); scene.add(tailWallS);

    // Bọt sóng trắng khuấy động tại 2 cửa xả ống hút
    const tailFoams = [];
    for (const uz of [-8, 8]) {
      const fCount = 75;
      const fPos = new Float32Array(fCount * 3);
      const fSeed = new Float32Array(fCount * 3);
      for (let i = 0; i < fCount; i++) {
        fSeed[i * 3] = Math.random();
        fSeed[i * 3 + 1] = (Math.random() - 0.5) * 4.6;
        fSeed[i * 3 + 2] = 0.5 + Math.random() * 0.9;
      }
      const fGeo = new THREE.BufferGeometry();
      fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
      const fPts = new THREE.Points(fGeo, new THREE.PointsMaterial({
        size: 1.75, map: foamGlowTex, transparent: true, opacity: 0.9, depthWrite: false
      }));
      scene.add(fPts);
      const foamRing = new THREE.Mesh(
        new THREE.CircleGeometry(2.9, 22),
        new THREE.MeshBasicMaterial({ map: foamGlowTex, transparent: true, opacity: 0.65, depthWrite: false })
      );
      foamRing.rotation.x = -Math.PI / 2;
      foamRing.position.set(16.6, -2.3, uz);
      scene.add(foamRing);
      tailFoams.push({ pts: fPts, geo: fGeo, pos: fPos, seed: fSeed, ring: foamRing, uz, count: fCount });
    }

    // -----------------------------------------------------------------------
    // 4.5 GIAN MÁY CẮT VÁT KIẾN TRÚC (CUTAWAY POWERHOUSE), CẦU TRỤC & PHÒNG ĐK TẠI CHỖ
    // -----------------------------------------------------------------------
    const phGroup = new THREE.Group();
    scene.add(phGroup);

    // Khối móng quanh hầm tuabin (bán trong suốt nhẹ để thấy rõ buồng xoắn & ống hút)
    const phBase = new THREE.Mesh(new THREE.BoxGeometry(16.5, 11.2, 34), matTurbinePit);
    phBase.position.set(4.2, -0.4, 0);
    phGroup.add(phBase);

    // Sàn gian máy phát (Y = 5.65) khoét 2 giếng tròn cho H1 & H2
    const floorShape = new THREE.Shape();
    floorShape.moveTo(-4.2, -17); floorShape.lineTo(12.6, -17);
    floorShape.lineTo(12.6, 17); floorShape.lineTo(-4.2, 17); floorShape.closePath();
    for (const uz of [-8, 8]) {
      const hole = new THREE.Path();
      hole.absarc(4, uz, 3.65, 0, Math.PI * 2, true);
      floorShape.holes.push(hole);
    }
    const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.45, bevelEnabled: false });
    floorGeo.rotateX(Math.PI / 2);
    const genFloor = new THREE.Mesh(floorGeo, matGenFloorXray);
    genFloor.position.set(0, 5.7, 0); genFloor.receiveShadow = true;
    phGroup.add(genFloor);

    // Tường hậu cảnh phía Tây (X = -4.2) cao ráo, sáng sạch — KHÔNG CÓ MÁI CHE PHÍA TRÊN!
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.65, 11.4, 34.2), matLightWall);
    backWall.position.set(-4.2, 11.3, 0); backWall.castShadow = true; backWall.receiveShadow = true;
    phGroup.add(backWall);

    // Viền xanh kiến trúc đầu tường hậu cảnh
    const backTrim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.55, 34.4), matBluePipe);
    backTrim.position.set(-4.2, 17.05, 0);
    phGroup.add(backTrim);

    // Biển tên trường nổi bật trên tường hậu cảnh: TRƯỜNG CAO ĐẲNG ĐIỆN LỰC MIỀN TRUNG – HPS 2×8 MW
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24.0, 3.2),
      new THREE.MeshBasicMaterial({ map: makeSignboardTexture() })
    );
    signMesh.rotation.y = Math.PI / 2;
    signMesh.position.set(-3.82, 14.5, 0);
    phGroup.add(signMesh);

    // Tường đầu hồi phía Bắc (Z = -16.9) cắt vát kiến trúc thấp dần về mặt trước (+X)
    const northCutShape = new THREE.Shape();
    northCutShape.moveTo(-4.4, 5.6);
    northCutShape.lineTo(12.6, 5.6);
    northCutShape.lineTo(12.6, 7.6);
    northCutShape.lineTo(6.5, 11.2);
    northCutShape.lineTo(-4.4, 17.0);
    northCutShape.closePath();
    const northWall = new THREE.Mesh(new THREE.ExtrudeGeometry(northCutShape, { depth: 0.5, bevelEnabled: false }), matLightWall);
    northWall.position.set(0, 0, -17.15);
    northWall.castShadow = true; northWall.receiveShadow = true;
    phGroup.add(northWall);

    // Tường cắt vát thấp mặt trước (+X = 12.4) để quan sát trực diện vào bên trong gian máy!
    const frontLowWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.85, 34.0), matLightWall);
    frontLowWall.position.set(12.4, 6.55, 0); frontLowWall.castShadow = true; frontLowWall.receiveShadow = true;
    phGroup.add(frontLowWall);
    const frontCap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 34.2), matBluePipe);
    frontCap.position.set(12.4, 7.52, 0);
    phGroup.add(frontCap);

    // Cột thép đen đỡ dầm ray cầu trục gian máy (mở hoàn toàn phía trên, không mái che)
    for (const cx of [-3.6, 12.1]) {
      for (const cz of [-16.2, -8.0, 0, 8.0, 16.2]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 9.2, 0.55), matDarkSteel);
        col.position.set(cx, 10.2, cz); col.castShadow = true;
        phGroup.add(col);
      }
      // Dầm ray thép đen phía trên
      const railBeam = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, 33.4), matDarkSteel);
      railBeam.position.set(cx, 14.8, 0); railBeam.castShadow = true;
      phGroup.add(railBeam);
    }

    // Cầu trục gian máy màu vàng (Overhead Bridge Crane) chạy trên 2 dầm ray thép đen
    const craneBridge = new THREE.Group();
    craneBridge.position.set(4.25, 15.55, -0.4);
    const matHazard = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.42, metalness: 0.3 });
    for (const gz of [-0.95, 0.95]) {
      const girder = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.95, 0.50), matYellow);
      girder.position.z = gz; girder.castShadow = true;
      craneBridge.add(girder);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(16.22, 0.24, 0.54), matHazard);
      stripe.position.set(0, -0.32, gz);
      craneBridge.add(stripe);
    }
    for (const ex of [-7.85, 7.85]) {
      const truck = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 3.0), matDarkSteel);
      truck.position.set(ex, -0.35, 0);
      craneBridge.add(truck);
    }
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 2.2), matDarkSteel);
    trolley.position.set(0.0, 0.65, 0); craneBridge.add(trolley);
    const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.82, 0.48), matYellow);
    hookBlock.position.set(0.0, -1.9, 0); craneBridge.add(hookBlock);
    for (const rx of [-0.18, 0.18]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), matBrightSteel);
      rope.position.set(rx, -0.65, 0); craneBridge.add(rope);
    }
    phGroup.add(craneBridge);

    // Phòng điều khiển tại chỗ sát tường sau: Dãy tủ LCU1, LCU2, Tủ kích từ + Bàn trực 3 màn hình
    const ctrlGroup = new THREE.Group();
    ctrlGroup.position.set(-2.9, 5.7, 0);
    phGroup.add(ctrlGroup);
    const cabSpecs = [
      ['LCU 1', '#0284c7', -3.0],
      ['KT 1', '#d97706', -1.8],
      ['PUB', '#0f766e', -0.6],
      ['LCU 2', '#0284c7', 0.6],
      ['KT 2', '#d97706', 1.8],
      ['AVR', '#7c3aed', 3.0]
    ];
    cabSpecs.forEach(([lbl, col, cz]) => {
      const faceTex = makeCabinetFaceTexture(lbl, col);
      const mats = [
        new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.45 }), // +X mặt trước
        matSteel, matSteel, matSteel, matSteel, matSteel
      ];
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.35, 1.08), mats);
      cab.position.set(0, 1.18, cz); cab.castShadow = true; cab.receiveShadow = true;
      ctrlGroup.add(cab);
    });

    // Bàn trực vận hành 3 màn hình SCADA trước dãy tủ
    const desk = new THREE.Group();
    desk.position.set(2.15, 0, 0);
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 3.6), matPorcelainWhite);
    deskTop.position.set(0, 0.92, 0); deskTop.castShadow = true; desk.add(deskTop);
    const deskBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.88, 3.2), matDarkSteel);
    deskBase.position.set(0, 0.44, 0); desk.add(deskBase);
    for (const mz of [-1.05, 0, 1.05]) {
      const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.88), matDarkSteel);
      monFrame.position.set(-0.22, 1.38, mz);
      monFrame.rotation.y = mz * -0.18;
      desk.add(monFrame);
      const monScr = new THREE.Mesh(new THREE.PlaneGeometry(0.80, 0.52), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
      monScr.rotation.y = Math.PI / 2 + mz * -0.18;
      monScr.position.set(-0.17, 1.38, mz);
      desk.add(monScr);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.14), matSteel);
      stand.position.set(-0.24, 1.04, mz); desk.add(stand);
    }
    ctrlGroup.add(desk);

    // -----------------------------------------------------------------------
    // 4.6 TỔ MÁY KAPLAN H1 (z = -8) & H2 (z = +8) SIÊU CHI TIẾT – CẮT VÁT THẤY RÕ PHẦN QUAY
    // -----------------------------------------------------------------------
    const units3D = [];
    const sharedBladeGeo = makeKaplanBladeGeometry();
    const sharedSpiralGeo = makeSpiralCaseGeometry(1.62, 2.45, 0.90);
    // Hình học dùng chung cho cơ cấu đổi góc Kaplan, rotor 28 cực & 6 bộ kích phanh (tối ưu cho TX3 Mini)
    const sharedTrunnionGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.56, 14);
    const sharedTrunnionBushGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.09, 14);
    const sharedRootFlangeGeo = new THREE.CylinderGeometry(0.28, 0.30, 0.08, 20);
    const sharedFlangeBoltsGeo = new THREE.TorusGeometry(0.21, 0.020, 6, 16);
    const sharedCrankBossGeo = new THREE.CylinderGeometry(0.135, 0.135, 0.09, 12);
    const sharedCrankArmGeo = new THREE.BoxGeometry(0.065, 0.085, 0.35);
    const sharedPinGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.13, 10);
    const sharedCrossArmGeo = new THREE.BoxGeometry(0.08, 0.08, 0.44);
    const sharedLinkUnitGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.0, 8);
    const sharedPoleCoreGeo = new THREE.BoxGeometry(0.36, 1.92, 0.27);
    const sharedPoleCoilGeo = new THREE.BoxGeometry(0.22, 1.72, 0.36);
    const sharedPoleFaceGeo = new THREE.BoxGeometry(0.05, 1.88, 0.28);
    const sharedBrakeCylGeo = new THREE.CylinderGeometry(0.17, 0.19, 0.32, 12);
    const sharedBrakePadGeo = new THREE.BoxGeometry(0.52, 0.28, 0.44);
    const sharedBrakeHitGeo = new THREE.BoxGeometry(0.78, 0.72, 0.72);
    const UP_Y = new THREE.Vector3(0, 1, 0);
    const tmpLinkDir = new THREE.Vector3();
    const tmpLinkQuat = new THREE.Quaternion();


    function buildHydroUnit(unitNo, uz) {
      const uGroup = new THREE.Group();
      scene.add(uGroup);

      // 1. ĐƯỜNG ỐNG ÁP LỰC XANH DƯƠNG (PENSTOCK) + VAN CHÍNH MÀU VÀNG
      const penCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-18.2, 7.6, uz),
        new THREE.Vector3(-12.8, 7.1, uz),
        new THREE.Vector3(-7.4, 2.5, uz),
        new THREE.Vector3(-2.2, 1.2, uz),
        new THREE.Vector3(0.4, 1.2, uz - 1.75)
      ]);
      const penMesh = new THREE.Mesh(new THREE.TubeGeometry(penCurve, 36, 1.52, 20, false), matPenstockShell);
      penMesh.castShadow = true;
      uGroup.add(penMesh);

      for (const t of [0.22, 0.45, 0.68]) {
        const pt = penCurve.getPoint(t), tg = penCurve.getTangent(t);
        const flange = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.11, 8, 22), matDarkSteel);
        flange.position.copy(pt);
        flange.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
        uGroup.add(flange);
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(1.4, Math.max(1.2, pt.y + 5.5), 3.6), matConcrete);
        saddle.position.set(pt.x, (pt.y - 5.5) / 2, pt.z);
        uGroup.add(saddle);
      }

      // Van chính màu vàng (Main Butterfly/Spherical Valve) ở đầu vào ống áp lực
      const valvePt = penCurve.getPoint(0.75);
      const mainValve = new THREE.Group();
      mainValve.position.copy(valvePt);
      const vBody = new THREE.Mesh(new THREE.CylinderGeometry(1.94, 1.94, 1.15, 22), matValveYellow);
      vBody.rotation.z = Math.PI / 2; vBody.castShadow = true;
      mainValve.add(vBody);
      for (const sx of [-0.62, 0.62]) {
        const vf = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.14, 8, 22), matDarkSteel);
        vf.rotation.y = Math.PI / 2; vf.position.x = sx; mainValve.add(vf);
      }
      const vAct = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.3, 12), matServoGreen);
      vAct.position.set(0, 1.9, 0.9); vAct.rotation.x = 0.28;
      mainValve.add(vAct);
      uGroup.add(mainValve);

      // 2. BUỒNG XOẮN BÁN TRONG SUỐT (opacity 0.45 mặc định, 0.15 X-Ray) + VÀNH TĨNH
      const unitCenter = new THREE.Group();
      unitCenter.position.set(4, 0, uz);
      uGroup.add(unitCenter);

      const spiralMesh = new THREE.Mesh(sharedSpiralGeo, matSpiralShell);
      spiralMesh.position.y = 1.2;
      unitCenter.add(spiralMesh);

      // Vành tĩnh trên/dưới
      for (const sy of [0.35, 2.05]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.14, 10, 28), matDarkSteel);
        ring.rotation.x = Math.PI / 2; ring.position.y = sy;
        unitCenter.add(ring);
      }

      // 3. 24 CÁNH HƯỚNG DÒNG MÀU VÀNG (KAPLAN ZZJK508-LJ-280) + VÀNH ĐIỀU CHỈNH + 02 XI-LANH SERVO THỦY LỰC
      const wicketGates = [];
      const gateGeo = new THREE.BoxGeometry(0.46, 1.48, 0.11);
      const pinGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.25, 8);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(a) * 2.1, 1.2, Math.sin(a) * 2.1);
        pivot.add(new THREE.Mesh(gateGeo, matYellow));
        const pin = new THREE.Mesh(pinGeo, matBrightSteel);
        pin.position.y = 0.55; pivot.add(pin);
        unitCenter.add(pivot);
        wicketGates.push({ pivot, baseAngle: -a + Math.PI / 2 });
      }

      const opRing = new THREE.Group();
      opRing.position.y = 2.7;
      const opTorus = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.17, 10, 36), matYellow);
      opTorus.rotation.x = Math.PI / 2; opRing.add(opTorus);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const link = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.075, 0.075), matBrightSteel);
        link.position.set(Math.cos(a) * 2.1, -0.15, Math.sin(a) * 2.1);
        link.rotation.y = -a; opRing.add(link);
      }
      unitCenter.add(opRing);

      // 2 Xi-lanh thủy lực servo màu xanh lá với cần pít-tông đẩy vành điều chỉnh
      const servoRods = [];
      for (const s of [-1, 1]) {
        const srv = new THREE.Group();
        srv.position.set(s * 2.45, 2.75, s * 2.15);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.1, 14), matServoGreen);
        cyl.rotation.z = Math.PI / 2; srv.add(cyl);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.6, 10), matBrightSteel);
        rod.rotation.z = Math.PI / 2; rod.position.x = -s * 1.1; srv.add(rod);
        unitCenter.add(srv);
        servoRods.push({ rod, side: s });
      }

      // 4. ỐNG HÚT CONG BÁN TRONG SUỐT (DRAFT TUBE)
      const draftCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.15, 0),
        new THREE.Vector3(0, -2.5, 0),
        new THREE.Vector3(1.6, -4.3, 0),
        new THREE.Vector3(6.2, -4.1, 0),
        new THREE.Vector3(11.8, -3.4, 0)
      ]);
      const draftMesh = new THREE.Mesh(new THREE.TubeGeometry(draftCurve, 28, 1.65, 18, false), matDraftShell);
      unitCenter.add(draftMesh);

      // 5. CỤM QUAY ĐỒNG BỘ (Bầu cầu Kaplan + cơ cấu đổi góc + 5 cánh + trục rỗng + Rotor 28 cực N/S)
      const rotatingGroup = new THREE.Group();
      unitCenter.add(rotatingGroup);

      // 5a. Bầu bánh xe công tác dạng cầu (hỗ trợ nhìn xuyên X-Ray) + chóp dưới giữ nguyên
      const hubSphere = new THREE.Mesh(new THREE.SphereGeometry(0.76, 24, 18), matHubShellXray);
      hubSphere.position.y = 0.05;
      rotatingGroup.add(hubSphere);
      const hubNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.22, 20), matHubShellXray);
      hubNeck.position.y = 0.68;
      rotatingGroup.add(hubNeck);
      const hubCone = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.95, 20), matBronze);
      hubCone.rotation.x = Math.PI; hubCone.position.y = -0.92; rotatingGroup.add(hubCone);

      // 5b. Servomotor cánh BXCT (xi lanh + piston) trên đỉnh bầu & cơ cấu thanh truyền + con trượt chữ thập
      const servoCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.94, 22, 1, true), matServoCylXray);
      servoCyl.position.y = 1.15;
      rotatingGroup.add(servoCyl);
      for (const cy of [0.72, 1.60]) {
        const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.045, 8, 22), matFlangeXray);
        capRing.rotation.x = Math.PI / 2; capRing.position.y = cy;
        rotatingGroup.add(capRing);
      }

      // Cụm chuyển động tịnh tiến dọc trục: Piston servomotor + Thanh truyền trong lòng trục rỗng + Con trượt chữ thập
      const pitchRodAssembly = new THREE.Group();
      rotatingGroup.add(pitchRodAssembly);

      const servoPiston = new THREE.Group();
      servoPiston.position.y = 1.15;
      servoPiston.add(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.18, 20), matYellow));
      for (const sy of [-0.055, 0.055]) {
        const seal = new THREE.Mesh(new THREE.TorusGeometry(0.435, 0.022, 6, 20), matDarkSteel);
        seal.rotation.x = Math.PI / 2; seal.position.y = sy;
        servoPiston.add(seal);
      }
      pitchRodAssembly.add(servoPiston);

      // Thanh truyền đi dọc trong lòng trục rỗng từ bộ phân phối dầu xuống piston & con trượt chữ thập
      const opRod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 12.60, 12), matOilPipe);
      opRod.position.y = 5.96; // từ y = -0.34 (con trượt) tới y = 12.26 (bộ phân phối dầu)
      pitchRodAssembly.add(opRod);

      // Con trượt chữ thập (5 nhánh) bên trong bầu cầu
      const crosshead = new THREE.Group();
      crosshead.position.y = -0.34;
      crosshead.add(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.18, 16), matOilPipe));
      const crossArmAngle = Math.atan2(0.28, -0.32);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const armHolder = new THREE.Group();
        armHolder.rotation.y = a;
        const arm = new THREE.Mesh(sharedCrossArmGeo, matOilPipe);
        arm.position.set(0.14, 0, -0.16);
        arm.rotation.y = crossArmAngle;
        armHolder.add(arm);
        const cPin = new THREE.Mesh(sharedPinGeo, matBrightSteel);
        cPin.rotation.z = Math.PI / 2;
        cPin.position.set(0.28, 0, -0.32);
        armHolder.add(cPin);
        crosshead.add(armHolder);
      }
      pitchRodAssembly.add(crosshead);

      // 5c. 5 cánh BXCT gắn qua chốt quay (trunnion) xuyên thành bầu + mặt bích tròn + tay quay + thanh nối
      const bladePivots = [];
      const pitchLinks = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const holder = new THREE.Group(); holder.rotation.y = a;

        // Trục chốt quay cánh (hướng kính X)
        const pitchPivot = new THREE.Group(); pitchPivot.position.set(0, 0.05, 0);

        // Chốt quay cánh xuyên thành bầu
        const trunnion = new THREE.Mesh(sharedTrunnionGeo, matBrightSteel);
        trunnion.rotation.z = Math.PI / 2; trunnion.position.set(0.54, 0, 0);
        pitchPivot.add(trunnion);
        const trunnionBush = new THREE.Mesh(sharedTrunnionBushGeo, matDarkSteel);
        trunnionBush.rotation.z = Math.PI / 2; trunnionBush.position.set(0.67, 0, 0);
        pitchPivot.add(trunnionBush);

        // Mặt bích tròn ở gốc cánh áp sát mặt bầu cầu (xoay cùng cánh)
        const rootFlange = new THREE.Mesh(sharedRootFlangeGeo, matBronze);
        rootFlange.rotation.z = Math.PI / 2; rootFlange.position.set(0.75, 0, 0);
        pitchPivot.add(rootFlange);
        const flangeBolts = new THREE.Mesh(sharedFlangeBoltsGeo, matBrightSteel);
        flangeBolts.rotation.y = Math.PI / 2; flangeBolts.position.set(0.79, 0, 0);
        pitchPivot.add(flangeBolts);

        // Cánh Kaplan gắn khít mặt bích tròn
        const bladeMesh = new THREE.Mesh(sharedBladeGeo, matBronze);
        bladeMesh.position.set(0.74, 0, 0);
        bladeMesh.scale.set(0.76, 1.0, 1.0);
        bladeMesh.castShadow = true;
        pitchPivot.add(bladeMesh);

        // Tay quay (crank lever) trên đầu trong của chốt quay cánh
        const crankBoss = new THREE.Mesh(sharedCrankBossGeo, matValveYellow);
        crankBoss.rotation.z = Math.PI / 2; crankBoss.position.set(0.29, 0, 0);
        pitchPivot.add(crankBoss);
        const crankArm = new THREE.Mesh(sharedCrankArmGeo, matValveYellow);
        crankArm.position.set(0.29, 0, -0.175);
        pitchPivot.add(crankArm);
        const crankPin = new THREE.Mesh(sharedPinGeo, matBrightSteel);
        crankPin.rotation.z = Math.PI / 2; crankPin.position.set(0.29, 0, -0.34);
        pitchPivot.add(crankPin);

        // Thanh nối (connecting link) giữa chốt con trượt chữ thập và chốt tay quay
        const linkMesh = new THREE.Mesh(sharedLinkUnitGeo, matBrightSteel);
        holder.add(linkMesh);
        pitchLinks.push(linkMesh);

        holder.add(pitchPivot); rotatingGroup.add(holder);
        bladePivots.push(pitchPivot);
      }

      // Trục chính rỗng (hỗ trợ X-Ray để lộ thanh truyền bên trong) + mặt bích + vạch vàng quan sát tốc độ
      const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 10.65, 20, 1, true), matShaftShellXray);
      mainShaft.position.y = 6.95; rotatingGroup.add(mainShaft);
      const shaftFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.34, 18), matFlangeXray);
      shaftFlange.position.y = 4.2; rotatingGroup.add(shaftFlange);
      const shaftStripe = new THREE.Mesh(new THREE.BoxGeometry(0.80, 3.2, 0.15), matYellowXray);
      shaftStripe.position.y = 4.35; rotatingGroup.add(shaftStripe);

      // Rotor máy phát đồng bộ SF8000-28 (Y = 8.4) với 28 cực từ xen kẽ N (đỏ) / S (xanh) qua cửa cắt vát 110°!
      const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 1.98, 2.1, 28), matRotorHubXray);
      rotorHub.position.y = 8.4; rotatingGroup.add(rotorHub);
      for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.25, 0.32), matSteel);
        spoke.position.y = 9.5; spoke.rotation.y = (i / 6) * Math.PI;
        rotatingGroup.add(spoke);
      }
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const isN = i % 2 === 0;
        const pole = new THREE.Group();
        pole.position.set(Math.cos(a) * 2.18, 8.4, Math.sin(a) * 2.18);
        pole.rotation.y = -a;
        pole.add(new THREE.Mesh(sharedPoleCoreGeo, isN ? matBrightSteel : matDarkSteel));
        const coil = new THREE.Mesh(sharedPoleCoilGeo, matCopper);
        coil.position.x = -0.05; pole.add(coil);
        const poleFace = new THREE.Mesh(sharedPoleFaceGeo, isN ? matPoleN : matPoleS);
        poleFace.position.x = 0.18; pole.add(poleFace);
        rotatingGroup.add(pole);
      }
      const brakeTrack = new THREE.Mesh(new THREE.CylinderGeometry(2.28, 2.28, 0.18, 28), matSteel);
      brakeTrack.position.y = 7.05; rotatingGroup.add(brakeTrack);


      // 6. VỎ MÁY PHÁT TRẮNG SỨ CẮT VÁT 110° MẶT TRƯỚC + 4 CHÂN TRỤ + 4 AIR COOLERS + ỐNG GÓP XANH + BUỒNG KÍCH TỪ HỘP
      const cutRad = (110 * Math.PI) / 180;
      const keepRad = Math.PI * 2 - cutRad;
      // Cửa sổ cắt vát 110° hướng ra mặt trước (+X/+Z, góc xoay quanh Y = 0.72 rad)
      const cutCenterAngle = Math.PI / 2 - 0.18; // Hướng về +X (và hơi nghiêng +Z về phía góc nhìn chính)
      const startTheta = cutCenterAngle + cutRad / 2;

      // Vỏ stator trắng sứ khoét góc 110°
      const statorOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(3.45, 3.45, 3.1, 36, 1, true, startTheta, keepRad),
        matGenHousingXray
      );
      statorOuter.position.y = 8.45; statorOuter.castShadow = true;
      unitCenter.add(statorOuter);

      // Nắp trên & đáy vành tròn vỏ máy phát (khoét đồng bộ chính xác góc 110° với CylinderGeometry)
      const ringTop = new THREE.Mesh(new THREE.RingGeometry(2.1, 3.45, 36, 1, startTheta - Math.PI / 2, keepRad), matGenHousingXray);
      ringTop.rotation.x = -Math.PI / 2; ringTop.position.y = 10.0; unitCenter.add(ringTop);
      const ringBot = new THREE.Mesh(new THREE.RingGeometry(2.1, 3.45, 36, 1, startTheta - Math.PI / 2, keepRad), matGenHousingXray);
      ringBot.rotation.x = -Math.PI / 2; ringBot.position.y = 6.9; unitCenter.add(ringBot);

      // Viền thép cắt vát sắc nét 2 mép cửa sổ 110°
      for (const edgeAng of [startTheta, startTheta + keepRad]) {
        const ex = Math.sin(edgeAng) * 3.12, ez = Math.cos(edgeAng) * 3.12;
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.14, 0.70), matDarkSteel);
        trim.position.set(ex, 8.45, ez); trim.rotation.y = edgeAng;
        unitCenter.add(trim);
      }

      // Lõi thép stator & cuộn dây đồng (vật liệu riêng cho từng tổ máy để phát sáng đỏ cam khi quá nhiệt stator!)
      const statorCoreMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55, metalness: 0.72, side: THREE.DoubleSide });
      const statorWindingMat = matCopper.clone();
      const statorCore = new THREE.Mesh(
        new THREE.CylinderGeometry(2.85, 2.85, 2.0, 32, 1, true, startTheta, keepRad),
        statorCoreMat
      );
      statorCore.position.y = 8.4; unitCenter.add(statorCore);
      for (const wy of [7.35, 9.45]) {
        const wArc = new THREE.Mesh(new THREE.TorusGeometry(2.68, 0.21, 10, 36, keepRad), statorWindingMat);
        wArc.rotation.x = -Math.PI / 2;
        wArc.rotation.z = startTheta - Math.PI / 2;
        wArc.position.y = wy; unitCenter.add(wArc);
      }
      // Vòng sáng cảnh báo quá nhiệt stator (ẩn khi bình thường, phát sáng đỏ cam khi G#.stator vượt ngưỡng)
      const statorHeatRingMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
      const statorHeatRing = new THREE.Mesh(new THREE.CylinderGeometry(3.56, 3.56, 3.2, 32, 1, true), statorHeatRingMat);
      statorHeatRing.position.y = 8.45; statorHeatRing.visible = false;
      unitCenter.add(statorHeatRing);

      // 4 Chân trụ đỡ vỏ máy phát xuống sàn gian máy
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.35, 0.75), matPorcelainWhite);
        leg.position.set(Math.cos(a) * 3.15, 6.32, Math.sin(a) * 3.15);
        leg.castShadow = true; unitCenter.add(leg);
      }

      // 4 Bộ làm mát không khí (Air Coolers) màu than + cửa chớp thông gió đen quanh phần vỏ kín
      const coolerAngles = [startTheta + 0.55, startTheta + 1.55, startTheta + 2.65, startTheta + 3.75];
      coolerAngles.forEach(ang => {
        const cooler = new THREE.Group();
        cooler.position.set(Math.sin(ang) * 3.65, 8.45, Math.cos(ang) * 3.65);
        cooler.rotation.y = ang;
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.35, 0.55), matCharcoal);
        box.castShadow = true; cooler.add(box);
        // Cửa chớp thông gió đen
        for (let ly = -0.85; ly <= 0.85; ly += 0.28) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.62), matDarkSteel);
          slat.position.y = ly; cooler.add(slat);
        }
        unitCenter.add(cooler);
      });

      // Ống góp nước làm mát vòng tròn màu xanh dương bao quanh kết nối 4 bộ làm mát không khí
      const cwRingPipe = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.14, 10, 36), matBluePipe);
      cwRingPipe.rotation.x = Math.PI / 2; cwRingPipe.position.y = 7.45;
      unitCenter.add(cwRingPipe);

      // Giá chữ thập trên/dưới + ổ đỡ trục (vật liệu riêng cho ổ đỡ để phát sáng đỏ cam khi G#.thrust quá nhiệt!)
      const thrustBearingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.76 });
      function makeCrossBracket(yPos, armLen, thick, hubMat) {
        const br = new THREE.Group(); br.position.y = yPos;
        br.add(new THREE.Mesh(new THREE.BoxGeometry(armLen, thick, 0.50), matSteel));
        br.add(new THREE.Mesh(new THREE.BoxGeometry(0.50, thick, armLen), matSteel));
        br.add(new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.0, thick + 0.25, 18), hubMat));
        return br;
      }
      unitCenter.add(makeCrossBracket(10.15, 6.7, 0.42, thrustBearingMat));
      unitCenter.add(makeCrossBracket(6.35, 6.3, 0.34, thrustBearingMat));
      const thrustHeatRingMat = new THREE.MeshBasicMaterial({ color: 0xff3b00, transparent: true, opacity: 0.0, depthWrite: false });
      const thrustHeatRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.16, 10, 24), thrustHeatRingMat);
      thrustHeatRing.rotation.x = Math.PI / 2; thrustHeatRing.position.y = 10.18; thrustHeatRing.visible = false;
      unitCenter.add(thrustHeatRing);

      // Hệ thống phanh khí nén dưới rotor (6 bộ kích phanh, phát sáng đỏ khi đang phanh & bấm để kiểm tra)
      const brakeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, emissiveIntensity: 0 });
      const brakeGroup = new THREE.Group();
      unitCenter.add(brakeGroup);
      const brakePads = [];
      const brakeHitMeshes = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.25;
        const cx = Math.cos(a) * 2.15, cz = Math.sin(a) * 2.15;
        const baseCyl = new THREE.Mesh(sharedBrakeCylGeo, matDarkSteel);
        baseCyl.position.set(cx, 6.50, cz);
        brakeGroup.add(baseCyl);
        const pad = new THREE.Mesh(sharedBrakePadGeo, brakeMat);
        pad.position.set(cx, 6.76, cz);
        pad.rotation.y = -a;
        brakeGroup.add(pad);
        brakePads.push(pad);
        const hit = new THREE.Mesh(sharedBrakeHitGeo, matHitBox);
        hit.position.set(cx, 6.72, cz);
        hit.rotation.y = -a;
        brakeGroup.add(hit);
        brakeHitMeshes.push(hit);
      }

      // Buồng kích từ hình hộp màu trắng sứ có lưới tản nhiệt đen trên đỉnh
      const excBox = new THREE.Group();
      excBox.position.y = 11.25;
      const excBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.75, 2.35), matPorcelainWhite);
      excBody.castShadow = true; excBox.add(excBody);
      const excTop = new THREE.Mesh(new THREE.BoxGeometry(2.50, 0.22, 2.50), matDarkSteel);
      excTop.position.y = 0.96; excBox.add(excTop);
      for (const rotY of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const grill = new THREE.Group(); grill.rotation.y = rotY;
        for (let gy = -0.5; gy <= 0.5; gy += 0.22) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.08), matCharcoal);
          bar.position.set(0, gy, 1.19); grill.add(bar);
        }
        excBox.add(grill);
      }
      unitCenter.add(excBox);

      // Bộ phân phối dầu (Oil Head) trên đỉnh trục máy phát (cấp dầu điều khiển cánh BXCT qua lòng trục rỗng)
      const oilHeadGroup = new THREE.Group();
      oilHeadGroup.position.y = 12.32;
      const ohBase = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.16, 18), matDarkSteel);
      ohBase.position.y = 0.08; oilHeadGroup.add(ohBase);
      const ohSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 16), matBrightSteel);
      ohSeal.position.y = 0.26; oilHeadGroup.add(ohSeal);
      const ohBody = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.72, 20), matSteel);
      ohBody.position.y = 0.70; ohBody.castShadow = true; oilHeadGroup.add(ohBody);
      for (const fy of [0.38, 1.04]) {
        const ohFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 20), matDarkSteel);
        ohFlange.position.y = fy; oilHeadGroup.add(ohFlange);
      }
      const ohBand = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.14, 20), matOilPipe);
      ohBand.position.y = 0.70; oilHeadGroup.add(ohBand);
      const ohCap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.18, 16), matDarkSteel);
      ohCap.position.y = 1.16; oilHeadGroup.add(ohCap);
      const ohInd = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 12), matOilPipe);
      ohInd.position.y = 1.34; oilHeadGroup.add(ohInd);
      // 2 ống dầu cấp/hồi nối ngang từ bộ phân phối dầu xuống dọc vỏ buồng kích từ
      for (const py of [0.56, 0.84]) {
        const hPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.96, 10), matOilPipe);
        hPipe.rotation.z = Math.PI / 2; hPipe.position.set(0.96, py, py > 0.7 ? -0.14 : 0.14);
        oilHeadGroup.add(hPipe);
        const vPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.55, 10), matOilPipe);
        vPipe.position.set(1.42, py - 0.76, py > 0.7 ? -0.14 : 0.14);
        oilHeadGroup.add(vPipe);
      }
      unitCenter.add(oilHeadGroup);

      // 7. HẠT DÒNG CHẢY XANH NGỌC (Penstock -> Cánh hướng -> Bánh xe -> Ống hút)
      const flowCount = 200;
      const flowPos = new Float32Array(flowCount * 3);
      const flowU = new Float32Array(flowCount);
      const flowOffA = new Float32Array(flowCount);
      const flowOffR = new Float32Array(flowCount);
      for (let i = 0; i < flowCount; i++) {
        flowU[i] = Math.random();
        flowOffA[i] = Math.random() * Math.PI * 2;
        flowOffR[i] = 0.25 + Math.random() * 0.65;
      }
      const flowGeo = new THREE.BufferGeometry();
      flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
      const flowPoints = new THREE.Points(flowGeo, new THREE.PointsMaterial({
        size: 1.05, map: waterGlowTex, color: 0x22d3ee, transparent: true, opacity: 0.95, depthWrite: false
      }));
      uGroup.add(flowPoints);

      // Đăng ký tương tác cho 6 bộ kích phanh khí nén TRƯỚC unitCenter để click vào phanh mở bảng trạng thái phanh
      const brakePickInfo = {
        id: 'BRAKE_' + unitNo,
        parentId: 'UNIT_' + unitNo,
        highlightMat: brakeMat,
        title: `Kích phanh khí nén (6 bộ) – Tổ máy H${unitNo}`,
        getTooltip: () => {
          const g = 'G' + unitNo + '.';
          const braking = (S[g + 'airBrake'] !== undefined) ? !on(g + 'airBrake') : false;
          const rpm = n(g + 'speed');
          const pct = (rpm / 214.3) * 100;
          return {
            status: `${braking ? 'ĐANG PHANH' : 'Đã giải trừ phanh'} · n = ${fx(rpm, 1)} v/ph (${fx(pct, 1)}% nđm)`,
            cls: braking ? 'on' : (rpm <= 64.3 ? 'off' : 'warn'),
            action: 'Bấm để xem trạng thái phanh & ngưỡng tốc độ 30% nđm (64,3 v/ph)'
          };
        },
        onClick: () => openBrakeQuickModal(unitNo)
      };
      registerInteractive(brakeGroup, brakePickInfo);
      brakeHitMeshes.forEach(hm => { hm.userData.pickItem = brakePickInfo; pickMeshes.push(hm); });

      // Cho phép bấm trực tiếp vào thân Tổ máy H1 / H2 để mở bảng điều khiển nhanh
      registerInteractive(unitCenter, {
        id: 'UNIT_' + unitNo,
        title: `Tổ máy H${unitNo} (Kaplan 8 MW – MF${unitNo})`,
        getTooltip: () => {
          const g = 'G' + unitNo + '.';
          const run = on(g + 'running');
          const trip = on(g + 'tripped');
          return {
            status: trip ? 'BẢO VỆ ĐÃ CẮT' : (run ? `ĐANG CHẠY · ${fx(n(g + 'Pload'), 2)} MW / ${fx(n(g + 'Qload'), 2)} MVAr` : 'ĐANG DỪNG'),
            cls: trip ? 'on' : (run ? 'off' : 'warn'),
            action: 'Bấm để mở bảng điều khiển nhanh (Chế độ, P/Q, Reset, Zoom)'
          };
        },
        onClick: () => openUnitQuickModal(unitNo)
      }, { w: 7.4, h: 12.6, d: 7.4, x: 0, y: 6.2, z: 0 });

      return {
        no: unitNo, uz, penCurve, draftCurve, rotatingGroup, bladePivots,
        pitchRodAssembly, pitchLinks, lastBladePct: -1,
        wicketGates, opRing, servoRods, brakeMat, brakePads,
        statorCoreMat, statorWindingMat, statorHeatRing, statorHeatRingMat,
        thrustBearingMat, thrustHeatRing, thrustHeatRingMat,
        flowPoints, flowGeo, flowPos, flowU, flowOffA, flowOffR, flowCount
      };
    }

    units3D.push(buildHydroUnit(1, -8));
    units3D.push(buildHydroUnit(2, 8));

    // -----------------------------------------------------------------------
    // 4.7 GIAN THIẾT BỊ PHỤ TRỢ, ĐƯỜNG ỐNG DẦU/NƯỚC + VAN CHẶN VÔ-LĂNG & DIESEL 500 kVA
    // -----------------------------------------------------------------------
    const auxGroup = new THREE.Group();
    scene.add(auxGroup);

    const auxSlab = new THREE.Mesh(new THREE.BoxGeometry(17.2, 1.0, 16.5), matConcrete);
    auxSlab.position.set(4.2, 5.15, 25.2); auxSlab.receiveShadow = true; auxGroup.add(auxSlab);
    const auxSub = new THREE.Mesh(new THREE.BoxGeometry(17.2, 10.6, 16.5), matDarkConcrete);
    auxSub.position.set(4.2, -0.65, 25.2); auxGroup.add(auxSub);

    // Helper dựng van chặn màu xanh dương kèm tay quay vô-lăng
    function buildHandwheelValve(x, y, z, rotY) {
      const vg = new THREE.Group();
      vg.position.set(x, y, z); vg.rotation.y = rotY || 0;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.55, 12), matBluePipe);
      body.rotation.z = Math.PI / 2; vg.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.55, 8), matBrightSteel);
      stem.position.y = 0.35; vg.add(stem);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 8, 16), matBluePipe);
      wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.62; vg.add(wheel);
      for (let i = 0; i < 2; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.035, 0.045), matBluePipe);
        sp.position.y = 0.62; sp.rotation.y = i * Math.PI / 2; vg.add(sp);
      }
      auxGroup.add(vg);
      return vg;
    }

    // Helper dựng bơm có cánh quạt quay + đèn báo
    const rotatingPumps = [];
    function buildPumpUnit(x, y, z, key, bodyColor) {
      const g = new THREE.Group(); g.position.set(x, y, z);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.8), matDarkSteel));
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.72, 12), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.38, metalness: 0.52 }));
      motor.rotation.z = Math.PI / 2; motor.position.set(-0.18, 0.42, 0); g.add(motor);
      const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 14), matSteel);
      volute.rotation.z = Math.PI / 2; volute.position.set(0.32, 0.42, 0); g.add(volute);
      const imp = new THREE.Group(); imp.position.set(0.48, 0.42, 0);
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.11), matYellow);
        fin.rotation.x = (i / 3) * Math.PI; imp.add(fin);
      }
      g.add(imp);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 1.5 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), lampMat);
      lamp.position.set(-0.18, 0.86, 0); g.add(lamp);
      auxGroup.add(g);
      rotatingPumps.push({ key, imp, lampMat });
      return g;
    }

    // Hệ thống nước làm mát (CW)
    const cwTankOuter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 2.6), new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38, roughness: 0.2 }));
    cwTankOuter.position.set(-1.8, 6.65, 19.8); auxGroup.add(cwTankOuter);
    const cwWaterInner = new THREE.Mesh(new THREE.BoxGeometry(3.15, 1.5, 2.35), new THREE.MeshPhongMaterial({ color: 0x0ea5e9, emissive: 0x0369a1, transparent: true, opacity: 0.82 }));
    cwWaterInner.position.set(-1.8, 6.45, 19.8); auxGroup.add(cwWaterInner);

    buildPumpUnit(-2.7, 5.65, 22.2, 'G1.waterPump1', 0x0284c7);
    buildPumpUnit(-1.1, 5.65, 22.2, 'G1.waterPump2', 0x0284c7);
    buildPumpUnit(-2.7, 5.65, 23.8, 'G2.waterPump1', 0x0369a1);
    buildPumpUnit(-1.1, 5.65, 23.8, 'G2.waterPump2', 0x0369a1);

    const cwPipeMat1 = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x000000, roughness: 0.35, metalness: 0.5 });
    const cwPipeMat2 = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x000000, roughness: 0.35, metalness: 0.5 });
    const cwRun1 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.3, 6.45, 22.2), new THREE.Vector3(-2.3, 6.45, 16.2), new THREE.Vector3(0.4, 7.45, -8.0)
    ]), 24, 0.14, 8, false), cwPipeMat1);
    auxGroup.add(cwRun1);
    const cwRun2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.5, 6.45, 23.8), new THREE.Vector3(-1.5, 6.45, 15.5), new THREE.Vector3(0.4, 7.45, 8.0)
    ]), 20, 0.14, 8, false), cwPipeMat2);
    auxGroup.add(cwRun2);

    // Hệ thống dầu áp lực điều tốc (HYZ/OPU) + Tuyến ống dầu cam/vàng có van chặn xanh vô-lăng!
    const oilTank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 2.4), matOilPipe);
    oilTank.position.set(2.5, 6.4, 19.8); oilTank.castShadow = true; auxGroup.add(oilTank);
    for (const ox of [1.65, 3.35]) {
      const acc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.4, 16), matYellow);
      acc.position.set(ox, 7.4, 22.0); acc.castShadow = true; auxGroup.add(acc);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), matYellow);
      dome.position.set(ox, 9.1, 22.0); auxGroup.add(dome);
    }
    buildPumpUnit(1.6, 5.65, 23.8, 'G1.oilPump1', 0xd97706);
    buildPumpUnit(3.3, 5.65, 23.8, 'G1.oilPump2', 0xd97706);
    buildPumpUnit(1.6, 5.65, 25.3, 'G2.oilPump1', 0xb45309);
    buildPumpUnit(3.3, 5.65, 25.3, 'G2.oilPump2', 0xb45309);

    // Tuyến ống dầu áp lực cam/vàng chạy từ HYZ tới H2 & H1 kèm van chặn xanh vô-lăng
    for (const [ox, tz] of [[1.65, -8], [3.35, 8]]) {
      const oilCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ox, 6.35, 21.8),
        new THREE.Vector3(ox, 6.35, 16.5),
        new THREE.Vector3(ox + 4.5, 6.35, 15.8),
        new THREE.Vector3(ox + 4.5, 6.35, tz + 3.2),
        new THREE.Vector3(ox + 4.5, 3.2, tz + 2.4)
      ]);
      const oilPipeMesh = new THREE.Mesh(new THREE.TubeGeometry(oilCurve, 26, 0.14, 8, false), matOilPipe);
      oilPipeMesh.castShadow = true; auxGroup.add(oilPipeMesh);
    }
    buildHandwheelValve(1.65, 6.35, 17.8, Math.PI / 2);
    buildHandwheelValve(3.35, 6.35, 17.8, Math.PI / 2);
    buildHandwheelValve(6.15, 6.35, 12.2, Math.PI / 2);
    buildHandwheelValve(7.85, 6.35, 12.2, Math.PI / 2);

    // Hệ thống khí nén & Bơm thoát nước nắp tuabin
    const hpTank = makeHorizontalTank(0.52, 2.6, matAirSilver); hpTank.position.set(7.2, 6.5, 19.6); auxGroup.add(hpTank);
    const lpTank = makeHorizontalTank(0.62, 2.8, matAirSilver); lpTank.position.set(7.2, 6.6, 21.3); auxGroup.add(lpTank);
    buildPumpUnit(6.4, 5.65, 23.0, 'G1.airComp1', 0x64748b);
    buildPumpUnit(8.1, 5.65, 23.0, 'G1.airComp2', 0x64748b);
    buildPumpUnit(6.4, 5.65, 24.5, 'G2.airComp1', 0x475569);
    buildPumpUnit(8.1, 5.65, 24.5, 'G2.airComp2', 0x475569);
    buildPumpUnit(6.4, 5.65, 26.0, 'G2.hc1', 0x0d9488);
    buildPumpUnit(8.1, 5.65, 26.0, 'G2.hc2', 0x0d9488);
    buildPumpUnit(-2.7, 5.65, 25.4, 'G1.hc1', 0x0d9488);
    buildPumpUnit(-1.1, 5.65, 25.4, 'G1.hc2', 0x0d9488);

    // Tổ máy phát Diesel dự phòng 500 kVA + Tủ tự dùng 0,4 kV + TD6 & TD35
    const dieselGroup = new THREE.Group();
    const dgBasePos = new THREE.Vector3(2.8, 5.65, 29.5);
    dieselGroup.position.copy(dgBasePos);
    auxGroup.add(dieselGroup);
    const dgSkid = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.3, 2.1), matDarkSteel); dgSkid.position.y = 0.15; dieselGroup.add(dgSkid);
    const dgBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.55, 1.6), matYellow); dgBody.position.set(-0.5, 1.08, 0); dgBody.castShadow = true; dieselGroup.add(dgBody);
    const dgAlt = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.35, 16), matBluePipe); dgAlt.rotation.z = Math.PI / 2; dgAlt.position.set(1.65, 1.0, 0); dieselGroup.add(dgAlt);
    const dgRad = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.65, 1.5), matDarkSteel); dgRad.position.set(-2.22, 1.12, 0); dieselGroup.add(dgRad);
    const dgStack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.6, 10), matDarkSteel); dgStack.position.set(-1.3, 3.8, -0.5); dieselGroup.add(dgStack);
    const dgLampMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 2.0 });
    const dgLamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), dgLampMat); dgLamp.position.set(0.4, 2.05, 0); dieselGroup.add(dgLamp);

    const smokeCount = 45;
    const smokePos = new Float32Array(smokeCount * 3);
    const smokeLife = new Float32Array(smokeCount);
    for (let i = 0; i < smokeCount; i++) smokeLife[i] = Math.random();
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokePts = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
      size: 1.55, map: smokeGlowTex, transparent: true, opacity: 0.72, depthWrite: false
    }));
    smokePts.visible = false; auxGroup.add(smokePts);

    // (Dãy tủ phân phối tự dùng 0,4 kV / tủ ATS gồm 1AXT, ATS, 2AXT, DG, PP 0,4 kV được dựng ngay sau swg6kVGroup để đồng bộ breakerWidgets)

    // Cho phép bấm trực tiếp vào Tổ máy Diesel dự phòng 500 kVA
    registerInteractive(dieselGroup, {
      id: 'DIESEL',
      title: 'Tổ máy phát Diesel dự phòng 500 kVA',
      getTooltip: () => {
        const run = on('dgEngine'), cb = on('dgCb');
        return {
          status: (run ? 'ĐANG CHẠY' : 'ĐANG DỪNG') + (cb ? ` · MC ĐÓNG (${fx(n('dgKW'), 0)} kW)` : ' · MC CẮT'),
          cls: run ? 'on' : 'off',
          action: 'Bấm để điều khiển Lệnh chạy (StandbyInput400) & MC Diesel (dgCb)'
        };
      },
      onClick: () => openDieselQuickModal()
    }, { w: 5.4, h: 3.4, d: 2.6, x: 0, y: 1.7, z: 0 });

    // MBA tự dùng TD61 (6,3/0,4 kV – 320 kVA) được dựng chi tiết ở mục 4.8 sát vách tường phân phối điện
    // (giữa dãy tủ hợp bộ 6,3 kV và dãy tủ tự dùng 0,4 kV ATS) để tái sử dụng sứ gân nâu, máng cáp và vật liệu chuẩn.
    // TD32 (35/0,4 kV – 320 kVA) đặt ngoài sân trạm 35 kV (đấu trực tiếp từ TC 32, kèm chống sét van song song CSV-TD32);
    // máy cắt hạ áp 1AXT & 2AXT đặt trong dãy tủ phân phối tự dùng 0,4 kV (tủ ATS) bên trong nhà máy (Z = 29.8).

    // -----------------------------------------------------------------------
    // 4.8 TRẠM BIẾN ÁP NÂNG ÁP & SÂN PHÂN PHỐI 35 kV – CẬN CẢNH THỰC TẾ ĐRÂY H'LINH 2
    // -----------------------------------------------------------------------
    const swGroup = new THREE.Group();
    scene.add(swGroup);
    const nameplateGroup = new THREE.Group();
    swGroup.add(nameplateGroup);

    // Vật liệu & Hình học dùng chung tối ưu GPU cho Android TV Box TX3 Mini
    const matGalvSteel = new THREE.MeshStandardMaterial({ color: 0xb0bac5, roughness: 0.34, metalness: 0.78 });
    const matIbeamGrey = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.38, metalness: 0.72 });
    const matMechLightGrey = new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.42, metalness: 0.25 });
    const matDclBlue = new THREE.MeshStandardMaterial({ color: 0x1e5aa8, roughness: 0.36, metalness: 0.30 });
    const matBladeYellow = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.28, metalness: 0.42 });
    const matInsOrange = new THREE.MeshStandardMaterial({ color: 0xe66c1c, roughness: 0.18, metalness: 0.12 });
    const matInsBrown = new THREE.MeshStandardMaterial({ color: 0x8d4925, roughness: 0.18, metalness: 0.14 });
    const matInsWhite = new THREE.MeshStandardMaterial({ color: 0xdfe6ed, roughness: 0.18, metalness: 0.10 });
    const matInsGlass = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.14, metalness: 0.24 });
    const matAlum = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.24, metalness: 0.86 });
    const matTrenchCover = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.84, metalness: 0.05 });
    const matTrenchSeam = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.90, metalness: 0.05 });
    const matNameplateEdge = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.35 });
    const gndHazardTex = hazardTex.clone();
    gndHazardTex.wrapS = THREE.RepeatWrapping; gndHazardTex.wrapT = THREE.RepeatWrapping;
    gndHazardTex.repeat.set(1, 3); gndHazardTex.needsUpdate = true;
    const matGroundBlade = new THREE.MeshStandardMaterial({ map: gndHazardTex, roughness: 0.35, metalness: 0.28 });

    // Hình học tái sử dụng cho phụ kiện nhỏ
    const sharedClampGeo = new THREE.BoxGeometry(0.16, 0.12, 0.16);
    const sharedBoltGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.14, 6);
    const sharedPostGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.90, 6);
    const sharedPostFootGeo = new THREE.BoxGeometry(0.12, 0.04, 0.12);
    const sharedPlateGeo = new THREE.BoxGeometry(0.68, 0.26, 0.026);
    const sharedFootingGeo = new THREE.BoxGeometry(0.18, 0.14, 0.18);
    const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const unitCylGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
    const insulatorGeoCache = Object.create(null);

    function getInsulatorMaterial(colorType) {
      if (colorType === 'orange') return matInsOrange;
      if (colorType === 'white') return matInsWhite;
      if (colorType === 'glass') return matInsGlass;
      return matInsBrown;
    }

    // Dựng 1 trụ sứ cách điện có tán gân sắc nét (10–14 tán) bằng LatheGeometry dùng chung (1 draw call/trụ)
    function createInsulatorColumn(height, baseRadius, topRadius, shedsCount, colorType) {
      const nSheds = Math.max(8, Math.min(16, shedsCount || 12));
      const key = `${height.toFixed(3)}_${baseRadius.toFixed(3)}_${topRadius.toFixed(3)}_${nSheds}`;
      let geo = insulatorGeoCache[key];
      if (!geo) {
        const pts = [];
        const flangeH = Math.min(0.07, height * 0.045);
        pts.push(new THREE.Vector2(0.001, 0));
        pts.push(new THREE.Vector2(baseRadius * 1.15, 0));
        pts.push(new THREE.Vector2(baseRadius * 1.15, flangeH));
        const bodyStart = flangeH;
        const bodyEnd = height - flangeH;
        const bodyH = bodyEnd - bodyStart;
        const step = bodyH / nSheds;
        for (let i = 0; i < nSheds; i++) {
          const t0 = i / nSheds;
          const tMid = (i + 0.52) / nSheds;
          const rCore = baseRadius + (topRadius - baseRadius) * t0;
          const rCoreNext = baseRadius + (topRadius - baseRadius) * ((i + 1) / nSheds);
          const rShed = (baseRadius + (topRadius - baseRadius) * tMid) * 1.56;
          const y0 = bodyStart + i * step;
          pts.push(new THREE.Vector2(rCore * 0.84, y0));
          pts.push(new THREE.Vector2(rShed, y0 + step * 0.34));
          pts.push(new THREE.Vector2(rShed * 0.96, y0 + step * 0.56));
          pts.push(new THREE.Vector2(rCoreNext * 0.84, y0 + step * 0.84));
        }
        pts.push(new THREE.Vector2(topRadius * 1.12, bodyEnd));
        pts.push(new THREE.Vector2(topRadius * 1.12, height));
        pts.push(new THREE.Vector2(0.001, height));
        geo = new THREE.LatheGeometry(pts, 10);
        insulatorGeoCache[key] = geo;
      }
      const mesh = new THREE.Mesh(geo, getInsulatorMaterial(colorType));
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      return mesh;
    }

    // Kẹp cực kim loại nhôm trên đỉnh sứ đấu dây
    function addTerminalClamp(parent, x, y, z) {
      const m = new THREE.Mesh(sharedClampGeo, matAlum);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }

    // Biển tên thiết bị thực tế gắn trên cọc thép cao 0,9 m đặt ngay trước chân giá đỡ
    function createDeviceNameplate(codeText, x, z, rotY) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 104;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 104);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 246, 94);
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.strokeRect(13, 13, 230, 78);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 42px system-ui,Segoe UI,Arial,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(codeText, 128, 54);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;

      const faceMat = new THREE.MeshBasicMaterial({ map: tex });
      const plateMats = [matNameplateEdge, matNameplateEdge, matNameplateEdge, matNameplateEdge, faceMat, faceMat];

      const g = new THREE.Group();
      g.position.set(x, 5.65, z);
      if (rotY) g.rotation.y = rotY;
      const foot = new THREE.Mesh(sharedPostFootGeo, matDarkConcrete);
      foot.position.y = 0.02; g.add(foot);
      const post = new THREE.Mesh(sharedPostGeo, matGalvSteel);
      post.position.y = 0.45; g.add(post);
      const board = new THREE.Mesh(sharedPlateGeo, plateMats);
      board.position.set(0, 0.90, 0.01);
      board.rotation.x = -0.14;
      g.add(board);
      nameplateGroup.add(g);
      return g;
    }

    // Dựng thanh thép nối từ điểm pA đến pB (dùng cho thanh giằng chéo / giàn cột cổng)
    const _strutDir = new THREE.Vector3();
    const _strutMid = new THREE.Vector3();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    function addStrut(parent, pA, pB, thick, mat) {
      _strutDir.subVectors(pB, pA);
      const len = _strutDir.length();
      if (len < 0.01) return;
      _strutMid.addVectors(pA, pB).multiplyScalar(0.5);
      const m = new THREE.Mesh(unitBoxGeo, mat || matGalvSteel);
      m.position.copy(_strutMid);
      m.scale.set(thick, len, thick);
      m.quaternion.setFromUnitVectors(_yAxis, _strutDir.normalize());
      parent.add(m);
    }

    // Khung giá đỡ thép mạ kẽm 4 chân thanh mảnh (KHÔNG dùng khối hộp đặc!)
    function addSteelFrame4Leg(parent, w, h, d, mat, opts) {
      const m = mat || matGalvSteel;
      const legT = (opts && opts.legT) || 0.075;
      const beamH = (opts && opts.beamH) || 0.11;
      const hx = w * 0.5, hz = d * 0.5;
      const corners = [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]];
      corners.forEach(([cx, cz]) => {
        const foot = new THREE.Mesh(sharedFootingGeo, matDarkConcrete);
        foot.position.set(cx, 0.07, cz); parent.add(foot);
        const leg = new THREE.Mesh(unitBoxGeo, m);
        leg.position.set(cx, h * 0.5, cz);
        leg.scale.set(legT, h, legT);
        leg.castShadow = true;
        parent.add(leg);
      });
      // Khung dầm đỉnh 4 cạnh
      for (const sz of [-hz, hz]) {
        const bx = new THREE.Mesh(unitBoxGeo, m);
        bx.position.set(0, h - beamH * 0.5, sz); bx.scale.set(w + legT, beamH, legT * 1.1); parent.add(bx);
      }
      for (const sx of [-hx, hx]) {
        const bz = new THREE.Mesh(unitBoxGeo, m);
        bz.position.set(sx, h - beamH * 0.5, 0); bz.scale.set(legT * 1.1, beamH, d + legT); parent.add(bz);
      }
      // Thanh giằng ngang giữa thân + giằng chéo chữ X 2 đầu hồi
      const midY = h * 0.45;
      for (const sz of [-hz, hz]) {
        const mx = new THREE.Mesh(unitBoxGeo, m);
        mx.position.set(0, midY, sz); mx.scale.set(w, 0.055, 0.055); parent.add(mx);
      }
      if (!opts || opts.braces !== false) {
        for (const sx of [-hx, hx]) {
          addStrut(parent, new THREE.Vector3(sx, 0.18, -hz), new THREE.Vector3(sx, h - 0.12, hz), 0.042, m);
          addStrut(parent, new THREE.Vector3(sx, 0.18, hz), new THREE.Vector3(sx, h - 0.12, -hz), 0.042, m);
        }
      }
    }

    // -----------------------------------------------------------------------
    // MẶT BẰNG SÂN TRẠM 35 kV: ĐÁ DĂM XÁM, ĐƯỜNG NHỰA TRUNG TÂM, MƯƠNG CÁP BÊ TÔNG & HÀNG RÀO B40
    // -----------------------------------------------------------------------
    const swDeck = new THREE.Mesh(new THREE.BoxGeometry(34.0, 1.0, 19.6), matGravel);
    swDeck.position.set(29.8, 5.15, 24.7); swDeck.receiveShadow = true; swGroup.add(swDeck);
    const swBase = new THREE.Mesh(new THREE.BoxGeometry(34.0, 10.6, 19.6), matConcrete);
    swBase.position.set(29.8, -0.65, 24.7); swGroup.add(swBase);

    // Đường nội bộ bê tông nhựa (Z = 24.6, rộng 2.0 m) chạy dọc giữa sân trạm kèm vạch kẻ đứt màu trắng & bó vỉa
    const swRoad = new THREE.Mesh(new THREE.BoxGeometry(33.4, 0.05, 1.95), matAsphalt);
    swRoad.position.set(29.9, 5.675, 24.6); swRoad.receiveShadow = true; swGroup.add(swRoad);
    for (const cz of [23.58, 25.62]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(33.4, 0.08, 0.11), matConcrete);
      curb.position.set(29.9, 5.69, cz); swGroup.add(curb);
    }
    for (let dx = 14.2; dx <= 45.8; dx += 2.2) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.015, 0.08), matRoadLine);
      dash.position.set(dx, 5.705, 24.6); swGroup.add(dash);
    }

    // Mương cáp bê tông đậy tấm đan xám chạy dọc hai bên đường nội bộ & rẽ nhánh tới từng hàng thiết bị
    function addCableTrench(x1, z1, x2, z2, width) {
      const w = width || 0.46;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) return;
      const horiz = Math.abs(dx) >= Math.abs(dz);
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? len : w, 0.06, horiz ? w : len),
        matTrenchCover
      );
      slab.position.set((x1 + x2) * 0.5, 5.68, (z1 + z2) * 0.5);
      slab.receiveShadow = true;
      swGroup.add(slab);
      // Khe nối tấm đan bê tông định kỳ mỗi 1.2 m
      const step = 1.2;
      const count = Math.floor(len / step);
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? 0.035 : w + 0.02, 0.066, horiz ? w + 0.02 : 0.035),
          matTrenchSeam
        );
        seam.position.set(x1 + dx * t, 5.682, z1 + dz * t);
        swGroup.add(seam);
      }
    }
    // 2 tuyến mương cáp trục chính chạy dọc sát bó vỉa đường nội bộ
    addCableTrench(14.0, 23.22, 44.2, 23.22, 0.46);
    addCableTrench(14.0, 25.98, 44.2, 25.98, 0.46);
    // Các nhánh mương cáp rẽ thẳng vào từng dãy thiết bị (T1/T2, CS/TU, DCL, TI, MC, ĐZ 371/372)
    [17.4, 20.0, 22.35, 24.55, 26.2, 32.85, 36.1, 37.85, 40.35, 42.95].forEach(tx => {
      addCableTrench(tx, 20.6, tx, 23.0, 0.34);
      addCableTrench(tx, 26.2, tx, 28.6, 0.34);
    });

    // Hàng rào lưới thép B40 mạ kẽm bao quanh 4 phía sân trạm (dùng texture lưới mắt cáo alpha tối ưu GPU)
    const b40BaseTex = makeB40MeshTexture();
    function addB40FenceSegment(x1, z1, x2, z2) {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.2) return;
      const hF = 2.15;
      const ang = Math.atan2(dz, dx);
      const tex = b40BaseTex.clone();
      tex.repeat.set(Math.max(1, len * 1.4), hF * 1.4);
      tex.needsUpdate = true;
      const meshMat = new THREE.MeshStandardMaterial({
        map: tex, color: 0xdce4ee, roughness: 0.42, metalness: 0.70,
        transparent: true, alphaTest: 0.38, side: THREE.DoubleSide
      });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, hF), meshMat);
      panel.position.set((x1 + x2) * 0.5, 5.65 + hF * 0.5, (z1 + z2) * 0.5);
      panel.rotation.y = -ang;
      swGroup.add(panel);

      // Thanh giằng ống thép trên & dưới
      for (const ry of [0.15, hF - 0.06]) {
        const rail = new THREE.Mesh(unitBoxGeo, matGalvSteel);
        rail.position.set((x1 + x2) * 0.5, 5.65 + ry, (z1 + z2) * 0.5);
        rail.scale.set(len, 0.055, 0.055);
        rail.rotation.y = -ang;
        swGroup.add(rail);
      }
      // Cột thép hàng rào mỗi ~3.0 m + tay vươn chống leo trên đỉnh
      const nPosts = Math.max(1, Math.round(len / 3.0));
      for (let i = 0; i <= nPosts; i++) {
        const t = i / nPosts;
        const px = x1 + dx * t, pz = z1 + dz * t;
        const post = new THREE.Mesh(unitCylGeo, matGalvSteel);
        post.position.set(px, 5.65 + hF * 0.5 + 0.05, pz);
        post.scale.set(0.042, hF + 0.12, 0.042);
        swGroup.add(post);
      }
    }
    // Phía Bắc & Nam sân trạm
    addB40FenceSegment(13.15, 15.15, 46.55, 15.15);
    addB40FenceSegment(13.15, 34.25, 46.55, 34.25);
    // Phía Đông (chừa cổng ra vào đường nội bộ Z = 23.2..26.0)
    addB40FenceSegment(46.55, 15.15, 46.55, 23.20);
    addB40FenceSegment(46.55, 26.00, 46.55, 34.25);
    // Hai trụ cổng thép mạ kẽm & 2 cánh cổng mở tại lối vào Đông
    for (const gz of [23.20, 26.00]) {
      const gPost = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      gPost.position.set(46.55, 6.85, gz); gPost.scale.set(0.14, 2.4, 0.14); swGroup.add(gPost);
    }
    // Phía Tây (chừa lối đường nội bộ & hộp thanh dẫn busduct 6,3 kV)
    addB40FenceSegment(13.15, 15.15, 13.15, 18.2);
    addB40FenceSegment(13.15, 21.0, 13.15, 23.3);
    addB40FenceSegment(13.15, 25.9, 13.15, 28.2);
    addB40FenceSegment(13.15, 31.0, 13.15, 34.25);

    // Quản lý dây dẫn mang điện (Đỏ sẫm #c0392b có xung điện / Xám kim loại khi mất điện)
    const liveWireGroups = []; // { mat, pulses:[{mesh, curve, u}], isLiveFn, hasPowerFn }
    const pulseGeo = new THREE.SphereGeometry(0.20, 7, 7);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfff066 });

    function createConductorGroup(isLiveFn, hasPowerFn) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x7c8a99, emissive: 0x000000, roughness: 0.34, metalness: 0.72 });
      const grp = { mat, pulses: [], isLiveFn, hasPowerFn: hasPowerFn || isLiveFn };
      liveWireGroups.push(grp);
      return grp;
    }

    function addWireToGroup(grp, curve, radius, pulseCount) {
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius || 0.048, 6, false), grp.mat);
      swGroup.add(mesh);
      const nP = pulseCount === undefined ? 2 : pulseCount;
      for (let i = 0; i < nP; i++) {
        const sp = new THREE.Mesh(pulseGeo, pulseMat);
        swGroup.add(sp);
        grp.pulses.push({ mesh: sp, curve, u: i / Math.max(1, nP) });
      }
    }

    // Danh sách máy cắt (Cờ ĐỎ = Đóng, XANH LÁ = Cắt) & dao cách ly / tiếp địa (xoay mượt)
    const breakerWidgets = [];
    const disconnectorWidgets = [];
    const trafoFans = [];

    // Tọa độ chuẩn 3 pha cho 2 ngăn: Bay 1 (Z1 = 19.6), Bay 2 (Z2 = 29.6), 3 pha dz = [-0.95, 0, +0.95]
    const Z_BAY = [19.6, 29.6];
    const PH_DZ = [-0.95, 0.0, 0.95];
    const BUS_X = [28.3, 29.4, 30.5]; // 3 thanh cái ống 35 kV pha A, B, C
    const BUS_Y = 11.65;
    const OPEN_75_DEG = (75 * Math.PI) / 180;

    // -----------------------------------------------------------------------
    // ĐOẠN 1: DÃY TỦ PHÂN PHỐI HỢP BỘ 6,3 kV TRONG GIAN MÁY (METAL-CLAD SWITCHGEAR)
    //         & 2 TUYẾN CẦU THANH DẪN 6,3 kV MÀU ĐỎ XUYÊN TƯỜNG QUA SỨ XUYÊN TƯỜNG TỚI 1T & 2T
    // -----------------------------------------------------------------------
    const matSwg6kV = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.36, metalness: 0.30 });
    const matSwgTrim = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.48, metalness: 0.45 });
    const matSwgCavity = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.35 });
    const matSwgGlass = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.12
    });
    const matVcbPole = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.28, metalness: 0.22 });

    function makeSwgHeaderTexture(code, sub) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 256, 96);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 248, 88);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 40px system-ui,Segoe UI,Arial,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(code, 128, sub ? 38 : 48);
      if (sub) {
        ctx.fillStyle = '#475569';
        ctx.font = '600 18px system-ui,Segoe UI,Arial,sans-serif';
        ctx.fillText(sub, 128, 72);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }

    // Dãy tủ hợp bộ 6,3 kV đặt gọn trên sàn vận hành bên trong gian máy (X = 9.75, Y = 5.70, Z = -5.45..+5.45)
    const swg6kVGroup = new THREE.Group();
    swg6kVGroup.position.set(9.75, 5.70, 0);
    phGroup.add(swg6kVGroup);

    // Bệ thép chân tủ liên tục + hộp thanh cái 6,3 kV chạy suốt đỉnh dãy tủ
    const swgPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.14, 11.05), matDarkSteel);
    swgPlinth.position.set(0, 0.07, 0); swg6kVGroup.add(swgPlinth);
    const swgBusHood = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.28, 10.95), matSwgTrim);
    swgBusHood.position.set(-0.04, 2.74, 0); swgBusHood.castShadow = true; swg6kVGroup.add(swgBusHood);

    const swgBayDefs = [
      { id: 'GS1QE', code: '1QE', sub: 'Tiếp địa MF1', z: -4.98, w: 0.86, type: 'gnd', key: 'GS1QE', label: '1QE (MF1 6,3 kV)' },
      { id: 'CB601', code: 'MC 601', sub: 'Máy cắt MF1', z: -3.86, w: 1.32, type: 'vcb', key: 'CB601', label: '601 (MF1)' },
      { id: 'TV1', code: '1TV', sub: 'Đo lường 6,3 kV', z: -2.56, w: 1.22, type: 'vt', unit: 1 },
      { id: 'IS612_1', code: '612-1', sub: 'Phân đoạn 1', z: -1.30, w: 1.24, type: 'disc', key: 'IS612_1', label: '612-1' },
      { id: 'TD61_CUB', code: 'TD61', sub: 'Rẽ tự dùng', z: 0.00, w: 1.30, type: 'td61', key: 'AXT1' },
      { id: 'IS612_2', code: '612-2', sub: 'Phân đoạn 2', z: 1.30, w: 1.24, type: 'disc', key: 'IS612_2', label: '612-2' },
      { id: 'TV2', code: '2TV', sub: 'Đo lường 6,3 kV', z: 2.56, w: 1.22, type: 'vt', unit: 2 },
      { id: 'CB602', code: 'MC 602', sub: 'Máy cắt MF2', z: 3.86, w: 1.32, type: 'vcb', key: 'CB602', label: '602 (MF2)' },
      { id: 'GS2QE', code: '2QE', sub: 'Tiếp địa MF2', z: 4.98, w: 0.86, type: 'gnd', key: 'GS2QE', label: '2QE (MF2 6,3 kV)' }
    ];

    const swgDepth = 1.28;
    const swgH = 2.46;
    const swgFrontX = swgDepth * 0.5;

    swgBayDefs.forEach(bay => {
      const cg = new THREE.Group();
      cg.position.set(0, 0.14, bay.z);
      swg6kVGroup.add(cg);

      // Thân tủ hợp bộ sơn xám công nghiệp (#cbd5e1)
      const body = new THREE.Mesh(new THREE.BoxGeometry(swgDepth, swgH, bay.w - 0.04), matSwg6kV);
      body.position.set(0, swgH * 0.5, 0);
      body.castShadow = true; body.receiveShadow = true;
      cg.add(body);

      // Khe rãnh phân khoang tối nét ở 2 mép đứng mặt trước
      for (const sz of [-(bay.w - 0.03) * 0.5, (bay.w - 0.03) * 0.5]) {
        const seam = new THREE.Mesh(unitBoxGeo, matSwgTrim);
        seam.position.set(swgFrontX + 0.005, swgH * 0.5, sz);
        seam.scale.set(0.02, swgH, 0.025);
        cg.add(seam);
      }

      // Biển tên khoang rõ nét ở dải trên mặt trước (+X)
      const hdrPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(bay.w - 0.14, 0.34),
        new THREE.MeshBasicMaterial({ map: makeSwgHeaderTexture(bay.code, bay.sub) })
      );
      hdrPlate.rotation.y = Math.PI / 2;
      hdrPlate.position.set(swgFrontX + 0.012, swgH - 0.22, 0);
      cg.add(hdrPlate);

      // Ngăn rơ le / đồng hồ đo trên cửa trên + tay nắm cửa tủ
      const relayScreen = new THREE.Mesh(unitBoxGeo, new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
      relayScreen.position.set(swgFrontX + 0.014, swgH - 0.58, -bay.w * 0.18);
      relayScreen.scale.set(0.02, 0.16, Math.min(0.28, bay.w * 0.26));
      cg.add(relayScreen);

      const handle = new THREE.Mesh(unitBoxGeo, matDarkSteel);
      handle.position.set(swgFrontX + 0.035, 1.05, bay.w * 0.34);
      handle.scale.set(0.04, 0.22, 0.04);
      cg.add(handle);

      // Khe thông gió đáy cửa tủ
      for (let vy = 0.22; vy <= 0.46; vy += 0.08) {
        const vent = new THREE.Mesh(unitBoxGeo, matSwgTrim);
        vent.position.set(swgFrontX + 0.01, vy, 0);
        vent.scale.set(0.02, 0.025, bay.w * 0.62);
        cg.add(vent);
      }

      // Đèn báo trạng thái thực tế Đỏ (Đóng) / Xanh (Cắt) trên mặt tủ
      let indMat = null;
      if (bay.key) {
        indMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.9 });
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.22), indMat);
        lamp.position.set(swgFrontX + 0.02, swgH - 0.58, bay.w * 0.22);
        cg.add(lamp);
        breakerWidgets.push({ key: bay.key, indMat });
      } else {
        const vtLamp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.16), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        vtLamp.position.set(swgFrontX + 0.02, swgH - 0.58, bay.w * 0.22);
        cg.add(vtLamp);
      }

      // Ô cửa kính quan sát khoang thiết bị bên trong (máy cắt kéo rút / biến điện áp / dao phân đoạn)
      if (bay.type === 'vcb' || bay.type === 'vt' || bay.type === 'disc' || bay.type === 'td61') {
        const winW = bay.w * 0.68;
        const winH = bay.type === 'vcb' ? 0.86 : 0.68;
        const winY = 1.18;
        // Hốc buồng tối bên trong cửa kính
        const cav = new THREE.Mesh(unitBoxGeo, matSwgCavity);
        cav.position.set(swgFrontX - 0.14, winY, 0);
        cav.scale.set(0.32, winH - 0.06, winW - 0.06);
        cg.add(cav);

        if (bay.type === 'vcb') {
          // Xe máy cắt chân không 6,3 kV kéo rút (withdrawable VCB truck): khung xe + 3 cực sứ đúc epoxy
          const truck = new THREE.Mesh(unitBoxGeo, matAlum);
          truck.position.set(swgFrontX - 0.10, winY - 0.24, 0);
          truck.scale.set(0.22, 0.24, winW - 0.14);
          cg.add(truck);
          [-0.22, 0, 0.22].forEach(pz => {
            const pole = new THREE.Mesh(unitCylGeo, matVcbPole);
            pole.position.set(swgFrontX - 0.09, winY + 0.10, pz);
            pole.scale.set(0.068, 0.42, 0.068);
            cg.add(pole);
            const cap = new THREE.Mesh(unitBoxGeo, matCopper);
            cap.position.set(swgFrontX - 0.09, winY + 0.32, pz);
            cap.scale.set(0.09, 0.05, 0.09);
            cg.add(cap);
          });
        } else if (bay.type === 'vt') {
          // 3 cuộn máy biến điện áp đúc nhựa 6,3/0,1 kV
          [-0.20, 0, 0.20].forEach(pz => {
            const vtCoil = new THREE.Mesh(unitBoxGeo, matVcbPole);
            vtCoil.position.set(swgFrontX - 0.10, winY - 0.04, pz);
            vtCoil.scale.set(0.18, 0.34, 0.13);
            cg.add(vtCoil);
          });
        } else {
          // 3 pha thanh đồng / dao cách ly phân đoạn 612-1, 612-2 hoặc cầu chì ống ngăn TD61
          [-0.20, 0, 0.20].forEach(pz => {
            const bar = new THREE.Mesh(unitBoxGeo, bay.type === 'td61' ? matInsWhite : matCopper);
            bar.position.set(swgFrontX - 0.10, winY, pz);
            bar.scale.set(0.07, 0.42, 0.06);
            cg.add(bar);
          });
        }

        // Khung viền cửa kính + mặt kính trong suốt
        const frame = new THREE.Mesh(unitBoxGeo, matDarkSteel);
        frame.position.set(swgFrontX + 0.008, winY, 0);
        frame.scale.set(0.025, winH + 0.04, winW + 0.04);
        cg.add(frame);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW - 0.04, winH - 0.04), matSwgGlass);
        glass.rotation.y = Math.PI / 2;
        glass.position.set(swgFrontX + 0.024, winY, 0);
        cg.add(glass);
      } else if (bay.type === 'gnd') {
        // Dải vạch vàng-đen cảnh báo tiếp địa cho ngăn 1QE / 2QE
        const stripe = new THREE.Mesh(unitBoxGeo, matGroundBlade);
        stripe.position.set(swgFrontX + 0.012, 1.18, 0);
        stripe.scale.set(0.02, 0.56, bay.w * 0.56);
        cg.add(stripe);
      }

      // Gắn tương tác click với hitbox vô hình (matHitBox: opacity 0, transparent true, giữ raycast)
      const hitDef = { w: swgDepth + 0.25, h: swgH + 0.45, d: bay.w, x: 0, y: swgH * 0.5 + 0.1, z: 0 };
      if (bay.type === 'vcb') {
        registerInteractive(cg, {
          id: bay.key,
          title: `Tủ máy cắt hợp bộ 6,3 kV – ${bay.code}`,
          highlightMat: indMat,
          getTooltip: () => {
            const closed = on(bay.key);
            return {
              status: closed ? 'ĐANG ĐÓNG (Đỏ)' : 'ĐANG CẮT (Xanh)',
              cls: closed ? 'on' : 'off',
              action: closed ? `Bấm để CẮT máy cắt ${bay.label}` : `Bấm để ĐÓNG máy cắt ${bay.label}`
            };
          },
          onClick: () => ask(`${on(bay.key) ? 'Cắt' : 'Đóng'} máy cắt 6,3 kV ${bay.label}?`, () => sendCommand(bay.key))
        }, hitDef);
      } else if (bay.type === 'disc') {
        registerInteractive(cg, {
          id: bay.key,
          title: `Tủ phân đoạn 6,3 kV – DCL ${bay.code}`,
          highlightMat: indMat,
          getTooltip: () => {
            const closed = on(bay.key);
            return {
              status: closed ? 'ĐANG ĐÓNG (Cấp tự dùng TD61)' : 'ĐANG MỞ',
              cls: closed ? 'on' : 'off',
              action: closed ? `Bấm để MỞ DCL ${bay.label}` : `Bấm để ĐÓNG DCL ${bay.label}`
            };
          },
          onClick: () => ask(`${on(bay.key) ? 'Mở' : 'Đóng'} dao cách ly phân đoạn 6,3 kV ${bay.label}?`, () => sendCommand(bay.key))
        }, hitDef);
      } else if (bay.type === 'td61') {
        registerInteractive(cg, {
          id: 'TD61_SWG',
          title: 'Ngăn rẽ tự dùng 6,3 kV – TD61',
          highlightMat: indMat,
          getTooltip: () => {
            const v6 = n('Vaux6');
            return {
              status: `U_TD61 = ${fx(v6, 2)} kV · 1AXT: ${on('AXT1') ? 'ĐÓNG' : 'CẮT'}`,
              cls: v6 > 0.5 ? 'on' : 'off',
              action: 'Bấm để mở bảng điều khiển tự dùng TD61 (DCL 612-1 / 612-2 & 1AXT)'
            };
          },
          onClick: () => openAuxTrafoQuickModal('TD61')
        }, hitDef);
      } else if (bay.type === 'gnd') {
        registerInteractive(cg, {
          id: bay.key,
          title: `Ngăn tiếp địa 6,3 kV – ${bay.code}`,
          highlightMat: indMat,
          getTooltip: () => {
            const closed = on(bay.key);
            return {
              status: closed ? 'ĐANG ĐÓNG (ĐÃ TIẾP ĐỊA)' : 'ĐANG MỞ',
              cls: closed ? 'warn' : 'off',
              action: closed ? `Bấm để MỞ dao tiếp địa ${bay.label}` : `Bấm để ĐÓNG dao tiếp địa ${bay.label}`
            };
          },
          onClick: () => ask(`${on(bay.key) ? 'Mở' : 'Đóng'} dao tiếp địa ${bay.label}?`, () => sendCommand(bay.key))
        }, hitDef);
      } else if (bay.type === 'vt') {
        registerInteractive(cg, {
          id: bay.id,
          title: `Tủ biến điện áp 6,3 kV – ${bay.code}`,
          highlightMat: matSwg6kV,
          getTooltip: () => {
            const vg = n(`G${bay.unit}.Vgen`);
            const v60 = n(`G${bay.unit}.V60`);
            return {
              status: `U_MF${bay.unit} = ${fx(vg, 2)} kV · U_6,3 = ${fx(v60, 2)} kV`,
              cls: vg > 0.5 || v60 > 0.5 ? 'on' : 'off',
              action: `Đo lường & bảo vệ thanh cái 6,3 kV tổ máy H${bay.unit}`
            };
          },
          onClick: () => {}
        }, hitDef);
      }
    });

    // Dãy tủ phân phối tự dùng 0,4 kV (tủ ATS) bên trong nhà máy tại Z = 29.8: gồm 1AXT, ATS, 2AXT, DG, PP 0,4 kV
    const ats04Specs = [
      { id: 'ATS_1AXT', code: '1AXT', sub: 'Hạ áp TD61', x: 7.60, key: 'AXT1', modal: 'TD61' },
      { id: 'ATS_CTRL', code: 'ATS', sub: 'Chuyển nguồn', x: 8.62, key: null, modal: 'TD32' },
      { id: 'ATS_2AXT', code: '2AXT', sub: 'Hạ áp TD32', x: 9.64, key: 'AXT2', modal: 'TD32' },
      { id: 'ATS_DG', code: 'DG 0,4', sub: 'MC Diesel', x: 10.66, key: 'dgCb', modal: 'DIESEL' },
      { id: 'ATS_PP04', code: 'PP 0,4', sub: 'Phụ tải TD', x: 11.68, key: null, modal: null }
    ];
    ats04Specs.forEach(sc => {
      const ag = new THREE.Group();
      ag.position.set(sc.x, 5.65, 29.8);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.26, 0.90), matSwg6kV);
      cab.position.y = 1.13; cab.castShadow = true; cab.receiveShadow = true; ag.add(cab);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.92), matDarkSteel);
      plinth.position.y = 0.06; ag.add(plinth);
      // Biển tên tủ 0,4 kV ở mặt trước (-Z, quay về lối đi gian phụ trợ)
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.84, 0.30),
        new THREE.MeshBasicMaterial({ map: makeSwgHeaderTexture(sc.code, sc.sub) })
      );
      plate.rotation.y = Math.PI;
      plate.position.set(0, 2.02, -0.458);
      ag.add(plate);
      let indMat = null;
      if (sc.key) {
        indMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.9 });
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), indMat);
        led.position.set(0, 1.66, -0.465); ag.add(led);
        breakerWidgets.push({ key: sc.key, indMat });
      } else {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        led.position.set(0, 1.66, -0.465); ag.add(led);
      }
      auxGroup.add(ag);
      const hitDef = { w: 1.0, h: 2.35, d: 1.0, x: 0, y: 1.18, z: 0 };
      if (sc.modal === 'TD32' || sc.modal === 'TD61') {
        const is2Axt = sc.code === '2AXT';
        registerInteractive(ag, {
          id: sc.id,
          title: is2Axt ? 'Máy cắt hạ áp 2AXT – Tủ tự dùng 0,4 kV (ATS)' : (sc.code === '1AXT' ? 'Máy cắt hạ áp 1AXT – Tủ tự dùng 0,4 kV (ATS)' : 'Tủ ATS chuyển nguồn tự dùng 0,4 kV'),
          highlightMat: indMat || matSwg6kV,
          getTooltip: () => {
            const k = sc.key || (on('AXT1') ? 'AXT1' : 'AXT2');
            const cl = on(k);
            return {
              status: `${sc.code}: ${sc.key ? (cl ? 'ĐANG ĐÓNG' : 'ĐANG CẮT') : 'TỰ ĐỘNG ATS'} · TC 0,4 kV: ${fx(n('V400') * 1000, 0)} V`,
              cls: cl ? 'on' : 'off',
              action: `Bấm để đóng/cắt ${sc.code} trong tủ phân phối tự dùng 0,4 kV`
            };
          },
          onClick: () => openAuxTrafoQuickModal(sc.modal)
        }, hitDef);
      } else if (sc.modal === 'DIESEL') {
        registerInteractive(ag, {
          id: sc.id,
          title: 'Ngăn máy cắt Diesel 0,4 kV – Tủ ATS',
          highlightMat: indMat,
          getTooltip: () => ({
            status: `MC Diesel: ${on('dgCb') ? 'ĐANG ĐÓNG' : 'ĐANG CẮT'} · ${fx(n('dgKW'), 0)} kW`,
            cls: on('dgCb') ? 'on' : 'off',
            action: 'Bấm để điều khiển máy phát Diesel & MC 0,4 kV'
          }),
          onClick: () => openDieselQuickModal()
        }, hitDef);
      } else {
        registerInteractive(ag, {
          id: sc.id,
          title: 'Tủ phân phối tự dùng 0,4 kV',
          highlightMat: matSwg6kV,
          getTooltip: () => ({
            status: `U_TC 0,4 kV = ${fx(n('V400') * 1000, 0)} V`,
            cls: n('V400') > 0.1 ? 'on' : 'off',
            action: 'Phân phối nguồn 0,4 kV cho các hệ thống phụ trợ nhà máy'
          }),
          onClick: () => {}
        }, hitDef);
      }
    });

    // Helper dựng đoạn cầu thanh dẫn bọc kim loại màu đỏ (Busduct 6,3 kV) nối theo đường gấp khúc
    function addBusductRun(pts, size) {
      const sz = size || 0.56;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), dz = Math.abs(b.z - a.z);
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(dx > 0.05 ? dx + sz * 0.85 : sz, dy > 0.05 ? dy + sz * 0.85 : sz, dz > 0.05 ? dz + sz * 0.85 : sz),
          matBusductRed
        );
        seg.position.copy(mid);
        seg.castShadow = true;
        swGroup.add(seg);
      }
    }

    // 2 Tuyến cầu thanh dẫn 6,3 kV màu đỏ:
    //  - Đầu vào: H1 -> MC 601 và H2 -> MC 602
    //  - Đầu ra: Từ nóc tủ MC 601 & MC 602 chạy trên cao (Y = 10.25) xuyên qua tường + 3 sứ xuyên tường 6,3 kV xuống 3 sứ hạ áp 1T & 2T
    const busductConfigs = [
      { genZ: -8.0, swgZ: -3.86, bayZ: Z_BAY[0], vKey: 'G1.V60', gKey: 'G1.Vgen', runX: 10.72 },
      { genZ: 8.0, swgZ: 3.86, bayZ: Z_BAY[1], vKey: 'G2.V60', gKey: 'G2.Vgen', runX: 11.62 }
    ];
    busductConfigs.forEach(cfg => {
      // Nhánh từ đầu cực máy phát H1/H2 vào tủ MC 601 / MC 602
      addBusductRun([
        new THREE.Vector3(7.45, 8.20, cfg.genZ),
        new THREE.Vector3(9.75, 8.20, cfg.genZ),
        new THREE.Vector3(9.75, 8.20, cfg.swgZ)
      ], 0.52);

      // Tuyến cầu thanh dẫn bọc kim loại màu đỏ từ dãy tủ hợp bộ -> xuyên tường tại X = 13.15
      addBusductRun([
        new THREE.Vector3(9.75, 8.58, cfg.swgZ),
        new THREE.Vector3(9.75, 10.25, cfg.swgZ),
        new THREE.Vector3(cfg.runX, 10.25, cfg.swgZ),
        new THREE.Vector3(cfg.runX, 10.25, cfg.bayZ),
        new THREE.Vector3(13.15, 10.25, cfg.bayZ)
      ], 0.56);

      // Cột thép mạ kẽm thanh mảnh đỡ cầu thanh dẫn trên hành lang phụ trợ
      for (const sz of [14.6, cfg.bayZ - 2.2]) {
        const sup = new THREE.Mesh(unitBoxGeo, matGalvSteel);
        sup.position.set(cfg.runX, 7.82, sz);
        sup.scale.set(0.12, 4.35, 0.12);
        swGroup.add(sup);
      }

      // Trụ tường xuyên thanh dẫn 6,3 kV tại ranh giới gian máy – sân trạm (X = 13.15) + 3 sứ xuyên tường gân nâu
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.46, 5.45, 2.78), matLightWall);
      pier.position.set(13.15, 5.65 + 2.725, cfg.bayZ);
      pier.castShadow = true; pier.receiveShadow = true;
      swGroup.add(pier);
      const pierCap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 2.90), matBluePipe);
      pierCap.position.set(13.15, 5.65 + 5.50, cfg.bayZ);
      swGroup.add(pierCap);
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.02, 2.16), matGalvSteel);
      flange.position.set(13.15, 10.25, cfg.bayZ);
      swGroup.add(flange);

      const lvGrp = createConductorGroup(() => n(cfg.vKey) > 0.5 || n(cfg.gKey) > 0.5);
      PH_DZ.forEach(dz => {
        const zPh = cfg.bayZ + dz * 0.72;
        // Sứ xuyên tường 6,3 kV vươn ngang hướng +X từ mặt tường ra phía 3 sứ hạ áp MBA 1T / 2T
        const wb = createInsulatorColumn(0.96, 0.095, 0.072, 8, 'brown');
        wb.rotation.z = -Math.PI / 2;
        wb.position.set(13.38, 10.25, zPh);
        swGroup.add(wb);
        addTerminalClamp(swGroup, 14.34, 10.25, zPh);
        // Dây dẫn mềm đấu gọn từ đầu cực sứ xuyên tường xuống đúng tâm 3 sứ hạ áp 6,3 kV trên nắp MBA 1T / 2T
        const pWallTip = new THREE.Vector3(14.34, 10.25, zPh);
        const pLvTip = new THREE.Vector3(16.25, 9.83, zPh);
        addWireToGroup(lvGrp, makeCatenaryCurve(pWallTip, pLvTip, -0.06), 0.050, 1);
      });
    });

    // -----------------------------------------------------------------------
    // MÁY BIẾN ÁP TỰ DÙNG TRONG NHÀ TD61 (6,3/0,4 kV – 320 kVA)
    // Đặt gọn sát vách tường khu vực phân phối điện (X = 10.80, Z = 24.60),
    // nằm giữa dãy tủ hợp bộ 6,3 kV và dãy tủ tự dùng 0,4 kV (ATS / 1AXT)
    // -----------------------------------------------------------------------
    const td61Pos = new THREE.Vector3(10.80, 5.65, 24.60);
    const td61Group = new THREE.Group();
    td61Group.position.copy(td61Pos);

    // 1) Bệ móng bê tông thấp + ray thép kê máy + vách ngăn tường phía Đông + lan can an toàn màu vàng
    const td61Pad = new THREE.Mesh(new THREE.BoxGeometry(2.20, 0.24, 2.30), matDarkConcrete);
    td61Pad.position.y = 0.12; td61Pad.receiveShadow = true; td61Group.add(td61Pad);
    for (const sx of [-0.48, 0.48]) {
      const skid = new THREE.Mesh(unitBoxGeo, matDarkSteel);
      skid.position.set(sx, 0.29, 0); skid.scale.set(0.10, 0.10, 1.38); td61Group.add(skid);
    }
    // Vách tường ngăn khoang MBA sát ranh giới phân phối điện phía Đông (X = 12.22)
    const td61Wall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.75, 2.90), matLightWall);
    td61Wall.position.set(1.42, 1.375, 0); td61Wall.castShadow = true; td61Wall.receiveShadow = true; td61Group.add(td61Wall);
    const td61WallCap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.10, 2.96), matBluePipe);
    td61WallCap.position.set(1.42, 2.78, 0); td61Group.add(td61WallCap);

    // Khung lan can bảo vệ an toàn màu vàng chuẩn nhà máy thủy điện bao quanh 3 mặt Bắc – Tây – Nam
    const railPosts = [
      [-1.28, -1.36], [0.0, -1.36], [1.26, -1.36],
      [-1.28, 0.0],
      [-1.28, 1.36], [0.0, 1.36], [1.26, 1.36]
    ];
    railPosts.forEach(([px, pz]) => {
      const p = new THREE.Mesh(unitBoxGeo, matBladeYellow);
      p.position.set(px, 0.54, pz); p.scale.set(0.055, 1.08, 0.055); td61Group.add(p);
    });
    for (const ry of [0.56, 1.04]) {
      // Thanh chắn Tây (-X)
      const rW = new THREE.Mesh(unitBoxGeo, matBladeYellow);
      rW.position.set(-1.28, ry, 0); rW.scale.set(0.045, 0.045, 2.76); td61Group.add(rW);
      // Thanh chắn Bắc (-Z) & Nam (+Z)
      for (const rz of [-1.36, 1.36]) {
        const rNS = new THREE.Mesh(unitBoxGeo, matBladeYellow);
        rNS.position.set(-0.01, ry, rz); rNS.scale.set(2.58, 0.045, 0.045); td61Group.add(rNS);
      }
    }
    const td61Kick = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.16, 2.68),
      new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.45, metalness: 0.15 })
    );
    td61Kick.position.set(-1.28, 0.10, 0); td61Group.add(td61Kick);

    // 2) Thân máy biến áp TD61 vỏ thép xám công nghiệp (#475569), cánh tản nhiệt xếp lớp 2 bên sườn & bình dầu phụ
    const td61TankMat = matTrafoTank.clone();
    const td61Tank = new THREE.Mesh(new THREE.BoxGeometry(1.44, 1.38, 1.18), td61TankMat);
    td61Tank.position.y = 1.03; td61Tank.castShadow = true; td61Tank.receiveShadow = true; td61Group.add(td61Tank);
    const td61Cover = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.08, 1.28), matDarkSteel);
    td61Cover.position.y = 1.76; td61Group.add(td61Cover);

    // Cánh tản nhiệt xếp lớp 2 bên sườn Đông – Tây (7 lá/sườn kèm ống góp dầu trên-dưới)
    for (const sx of [-1, 1]) {
      for (let i = -3; i <= 3; i++) {
        const fin = new THREE.Mesh(unitBoxGeo, matTrafoTank);
        fin.position.set(sx * 0.83, 1.03, i * 0.155);
        fin.scale.set(0.22, 1.06, 0.036);
        fin.castShadow = true;
        td61Group.add(fin);
      }
      for (const my of [0.60, 1.46]) {
        const mani = new THREE.Mesh(unitBoxGeo, matDarkSteel);
        mani.position.set(sx * 0.77, my, 0);
        mani.scale.set(0.12, 0.06, 1.00);
        td61Group.add(mani);
      }
    }

    // Bình dầu phụ hình trụ đặt trên 2 giá đỡ thép phía trên nắp thùng dầu
    const td61Cons = makeHorizontalTank(0.17, 0.96, matGalvSteel);
    td61Cons.position.set(0, 2.34, 0.02);
    td61Group.add(td61Cons);
    for (const bx of [-0.30, 0.30]) {
      const leg = new THREE.Mesh(unitBoxGeo, matDarkSteel);
      leg.position.set(bx, 2.04, 0.02); leg.scale.set(0.05, 0.48, 0.05); td61Group.add(leg);
    }
    const td61Pipe = new THREE.Mesh(unitCylGeo, matDarkSteel);
    td61Pipe.position.set(0, 2.02, 0.02); td61Pipe.scale.set(0.032, 0.44, 0.032); td61Group.add(td61Pipe);
    // Mặt báo mức dầu nhỏ ở đầu Tây bình dầu phụ
    const td61Gauge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.03, 10),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    td61Gauge.rotation.z = Math.PI / 2;
    td61Gauge.position.set(-0.50, 2.34, 0.02);
    td61Group.add(td61Gauge);

    // Biển tên TD61 sắc nét gắn trên mặt trước (hướng Tây -X) của thùng máy + cọc biển tên thiết bị chuẩn
    const td61FrontBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.30),
      new THREE.MeshBasicMaterial({ map: makeSwgHeaderTexture('TD61', '6,3/0,4 kV · 320 kVA') })
    );
    td61FrontBadge.rotation.y = -Math.PI / 2;
    td61FrontBadge.position.set(-0.955, 1.18, 0);
    td61Group.add(td61FrontBadge);
    createDeviceNameplate('TD61', td61Pos.x - 1.56, td61Pos.z, -Math.PI / 2);

    // 3) Đầu vào 6,3 kV (mép Bắc nắp máy, dz = -0.38): 3 sứ gân nâu trung thế nối thẳng lên nhánh cầu thanh dẫn 6,3 kV
    const td61HvDx = [-0.36, 0.0, 0.36];
    const td61HvTips = [];
    td61HvDx.forEach(dx => {
      const hv = createInsulatorColumn(0.72, 0.068, 0.050, 8, 'brown');
      hv.position.set(dx, 1.80, -0.38);
      td61Group.add(hv);
      addTerminalClamp(td61Group, dx, 2.54, -0.38);
      td61HvTips.push(new THREE.Vector3(td61Pos.x + dx, td61Pos.y + 2.54, td61Pos.z - 0.38));
    });

    // Nhánh cầu thanh dẫn 6,3 kV màu đỏ từ ngăn rẽ TD61 (sau dao phân đoạn 612-1 / 612-2) đi thẳng tới phía trên 3 sứ cao áp TD61
    const td61HvZ = td61Pos.z - 0.38; // 24.22
    addBusductRun([
      new THREE.Vector3(9.75, 8.58, 0.0),
      new THREE.Vector3(9.75, 9.35, 0.0),
      new THREE.Vector3(9.75, 9.35, td61HvZ),
      new THREE.Vector3(td61Pos.x, 9.35, td61HvZ)
    ], 0.36);
    // Hộp đầu cuối thanh dẫn 6,3 kV ngay phía trên 3 sứ trung thế TD61
    const td61DropBox = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.24, 0.42), matBusductRed);
    td61DropBox.position.set(td61Pos.x, 9.18, td61HvZ);
    swGroup.add(td61DropBox);
    const td61Grp = createConductorGroup(() => n('Vaux6') > 0.5 || n('G1.V60') > 0.5 || n('G2.V60') > 0.5);
    td61HvTips.forEach(tip => {
      addWireToGroup(td61Grp, makeCatenaryCurve(
        new THREE.Vector3(tip.x, 9.08, tip.z),
        tip,
        0.0
      ), 0.036, 1);
    });

    // 4) Đầu ra 0,4 kV (mép Nam nắp máy, dz = +0.38): 4 sứ hạ áp (3 pha A-B-C + Trung tính N)
    const td61LvDx = [-0.42, -0.14, 0.14, 0.42];
    const td61LvTips = [];
    td61LvDx.forEach(dx => {
      const lv = createInsulatorColumn(0.38, 0.044, 0.034, 8, 'brown');
      lv.position.set(dx, 1.80, 0.38);
      td61Group.add(lv);
      const lug = new THREE.Mesh(sharedClampGeo, matAlum);
      lug.position.set(dx, 2.20, 0.38);
      lug.scale.set(0.68, 0.72, 0.68);
      td61Group.add(lug);
      td61LvTips.push(new THREE.Vector3(td61Pos.x + dx, td61Pos.y + 2.20, td61Pos.z + 0.38));
    });

    auxGroup.add(td61Group);
    registerInteractive(td61Group, {
      id: 'TD61',
      title: 'MBA tự dùng TD 61 (6,3/0,4 kV – 320 kVA – Ưu tiên)',
      highlightMat: td61TankMat,
      getTooltip: () => {
        const lv = S.V400Zone1 !== undefined ? n('V400Zone1') : (n('Vaux6') > 0.5 ? 0.4 : 0);
        const closed = on('AXT1');
        return {
          status: `U_6,3 = ${fx(n('Vaux6'), 2)} kV · Hạ áp: ${fx(lv * 1000, 0)} V · 1AXT: ${closed ? 'ĐANG ĐÓNG' : 'ĐANG CẮT'}`,
          cls: closed ? 'on' : 'off',
          action: 'Bấm để điều khiển đóng/cắt nguồn tự dùng TD 61 (1AXT)'
        };
      },
      onClick: () => openAuxTrafoQuickModal('TD61')
    }, { w: 2.65, h: 2.95, d: 2.80, x: 0, y: 1.48, z: 0 });

    // 5) Máng cáp thép mạ kẽm & 4 sợi cáp hạ áp 0,4 kV chuẩn màu (Đỏ – Vàng – Xanh – Đen) đấu gọn vào tủ 1AXT (X = 7.60, Z = 29.80)
    const trayY = 8.32;
    const trayZStart = td61Pos.z + 0.38; // 24.98
    const trayZEnd = 29.80;
    const axt1X = 7.60;
    const trayHalfW = 0.24;
    const trayLenNS = trayZEnd - trayZStart; // 4.82 m
    const trayLenEW = td61Pos.x - axt1X;     // 3.20 m

    // Nhánh máng cáp chạy hướng Nam từ trên đầu sứ hạ áp TD61 tới trên nóc dãy tủ tự dùng 0,4 kV (Z = 29.80)
    for (const sx of [-trayHalfW, trayHalfW]) {
      const railNS = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      railNS.position.set(td61Pos.x + sx, trayY, (trayZStart + trayZEnd) * 0.5);
      railNS.scale.set(0.035, 0.09, trayLenNS + 0.48);
      auxGroup.add(railNS);
    }
    for (let zR = trayZStart; zR <= trayZEnd + 0.05; zR += 0.52) {
      const rung = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      rung.position.set(td61Pos.x, trayY - 0.032, zR);
      rung.scale.set(trayHalfW * 2, 0.024, 0.04);
      auxGroup.add(rung);
    }
    // Nhánh máng cáp chạy hướng Tây dọc nóc dãy tủ 0,4 kV (ATS) tới đúng ngăn máy cắt 1AXT (X = 7.60)
    for (const sz of [-trayHalfW, trayHalfW]) {
      const railEW = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      railEW.position.set((td61Pos.x + axt1X) * 0.5, trayY, trayZEnd + sz);
      railEW.scale.set(trayLenEW + 0.48, 0.09, 0.035);
      auxGroup.add(railEW);
    }
    for (let xR = axt1X; xR <= td61Pos.x + 0.05; xR += 0.52) {
      const rung = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      rung.position.set(xR, trayY - 0.032, trayZEnd);
      rung.scale.set(0.04, 0.024, trayHalfW * 2);
      auxGroup.add(rung);
    }
    // Chân trụ đỡ máng cáp xuống sàn hành lang và trên nóc tủ 0,4 kV
    for (const sz of [26.45, 28.25]) {
      const post = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      post.position.set(td61Pos.x + 0.25, (5.65 + trayY) * 0.5, sz);
      post.scale.set(0.065, trayY - 5.65, 0.065);
      auxGroup.add(post);
      const arm = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      arm.position.set(td61Pos.x, trayY - 0.06, sz);
      arm.scale.set(0.56, 0.045, 0.055);
      auxGroup.add(arm);
    }
    for (const sx of [7.60, 9.20, 10.80]) {
      const riser = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      riser.position.set(sx, (7.91 + trayY) * 0.5, trayZEnd);
      riser.scale.set(0.055, trayY - 7.91, 0.055);
      auxGroup.add(riser);
    }
    // Hộp cổ cáp đấu nối trên nóc tủ máy cắt hạ áp 1AXT (X = 7.60, Y = 7.91, Z = 29.80)
    const axt1Gland = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.30), matDarkSteel);
    axt1Gland.position.set(axt1X, 7.99, trayZEnd);
    auxGroup.add(axt1Gland);

    // 4 sợi cáp 0,4 kV chuẩn màu (Pha A: Đỏ, Pha B: Vàng, Pha C: Xanh dương, Trung tính N: Đen)
    const lvCableColors = [0xdc2626, 0xeab308, 0x2563eb, 0x0f172a];
    const lvLaneOff = [-0.15, -0.05, 0.05, 0.15];
    td61LvTips.forEach((tip, i) => {
      const off = lvLaneOff[i];
      const curve = new THREE.CatmullRomCurve3([
        tip,
        new THREE.Vector3(td61Pos.x + off, trayY + 0.02, trayZStart + 0.26),
        new THREE.Vector3(td61Pos.x + off, trayY + 0.02, trayZEnd - 0.34 - off),
        new THREE.Vector3(td61Pos.x - 0.34 + off, trayY + 0.02, trayZEnd - off),
        new THREE.Vector3(axt1X + 0.26 + off * 0.8, trayY + 0.02, trayZEnd - off),
        new THREE.Vector3(axt1X + off * 0.9, trayY - 0.10, trayZEnd),
        new THREE.Vector3(axt1X + off * 0.9, 7.92, trayZEnd)
      ]);
      const cableMat = new THREE.MeshStandardMaterial({ color: lvCableColors[i], roughness: 0.42, metalness: 0.08 });
      const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.028, 6, false), cableMat);
      cableMesh.castShadow = false;
      auxGroup.add(cableMesh);
    });

    // -----------------------------------------------------------------------
    // 2 MÁY BIẾN ÁP LỰC CHÍNH T1 & T2 (6,3 / 38,5 kV – 10 MVA) tại X = 17.4
    // -----------------------------------------------------------------------
    const trafoHvTips = [[], []];
    function buildPowerTransformer(x, z, idx) {
      const unitNo = idx + 1;
      const g = new THREE.Group(); g.position.set(x, 5.65, z);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.36, 4.1), matDarkConcrete); pad.position.y = 0.18; g.add(pad);
      const tank = new THREE.Mesh(new THREE.BoxGeometry(2.75, 3.05, 2.25), matTrafoTank); tank.position.y = 1.9; tank.castShadow = true; tank.receiveShadow = true; g.add(tank);

      for (const side of [-1, 1]) {
        for (let i = -3; i <= 3; i++) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.45, 0.58), matGalvSteel);
          fin.position.set(i * 0.36, 1.9, side * 1.40); g.add(fin);
        }
        const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 14), matDarkSteel);
        fanRing.position.set(0, 1.55, side * 1.76); g.add(fanRing);
        const fanBlades = new THREE.Group(); fanBlades.position.set(0, 1.55, side * 1.76);
        for (let b = 0; b < 4; b++) {
          const bl = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 0.04), matBladeYellow);
          bl.rotation.z = (b / 4) * Math.PI; fanBlades.add(bl);
        }
        g.add(fanBlades); trafoFans.push({ blades: fanBlades, unitNo });
      }
      const cons = makeHorizontalTank(0.50, 2.25, matGalvSteel); cons.position.set(-0.22, 4.42, -0.76); g.add(cons);
      for (const sx of [-0.78, 0.32]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.02, 0.11), matDarkSteel);
        leg.position.set(sx, 3.88, -0.76); g.add(leg);
      }

      // 3 Sứ xuyên hạ áp 6,3 kV phía -X (gân sứ nâu)
      PH_DZ.forEach(dz => {
        const lv = createInsulatorColumn(1.05, 0.095, 0.075, 8, 'brown');
        lv.position.set(-1.15, 3.12, dz * 0.72); g.add(lv);
        addTerminalClamp(g, -1.15, 4.18, dz * 0.72);
      });

      // 3 Sứ xuyên cao áp 35 kV phía +X dùng createInsulatorColumn (12 tán gân sắc nét)
      PH_DZ.forEach(dz => {
        const hvCol = createInsulatorColumn(1.92, 0.145, 0.095, 12, 'brown');
        hvCol.position.set(0.92, 3.40, dz); g.add(hvCol);
        addTerminalClamp(g, 0.92, 5.36, dz);
        trafoHvTips[idx].push(new THREE.Vector3(x + 0.92, 5.65 + 5.36, z + dz));
      });
      swGroup.add(g);
    }
    buildPowerTransformer(17.4, Z_BAY[0], 0); // T1
    buildPowerTransformer(17.4, Z_BAY[1], 1); // T2

    // -----------------------------------------------------------------------
    // BỘ HÀM DỰNG THIẾT BỊ CAO ÁP 35 kV CHI TIẾT (MC, DCL, DTĐ, TI, TU, CS)
    // -----------------------------------------------------------------------

    // 1. Dao cách ly 35 kV (DCL): Giá thép mạ kẽm 4 chân mảnh, 3 cặp sứ nâu gân, lưỡi vàng xoay 75°, hộp truyền động xanh dương
    function buildDisconnectorX(x, z, key, label, nameplateCode, opts) {
      const o = opts || {};
      const axisZ = !!o.axisZ; // true: 3 pha xếp dọc trục X, lưỡi đóng mở dọc trục Z (dùng cho DCL 321-2)
      const phOffsets = o.phOffsets || PH_DZ;
      const span = o.span || 0.62;
      const frameH = o.frameH || 1.72;
      const insH = o.insH || 1.82;
      const g = new THREE.Group(); g.position.set(x, 5.65, z);
      if (axisZ) g.rotation.y = Math.PI / 2;

      const spanW = span * 2 + 0.24;
      const spanD = Math.abs(phOffsets[2] - phOffsets[0]) + 0.42;
      addSteelFrame4Leg(g, spanW, frameH, spanD, matGalvSteel);

      // Tủ truyền động cơ khí màu xanh dương (#1e5aa8) gắn dưới xà đỡ
      const mechBox = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.64, 0.36), matDclBlue);
      mechBox.position.set(-span, frameH - 0.56, spanD * 0.5 + 0.14);
      mechBox.castShadow = true; g.add(mechBox);
      const mechDoor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.54, 0.03), matGalvSteel);
      mechDoor.position.set(-span, frameH - 0.56, spanD * 0.5 + 0.32); g.add(mechDoor);

      // Trục đồng trục & tay đòn liên kết 3 pha
      const driveShaft = new THREE.Group();
      driveShaft.position.set(-span, frameH + 0.05, 0);
      const shaftBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, spanD + 0.18, 6), matAlum);
      shaftBar.rotation.x = Math.PI / 2; driveShaft.add(shaftBar);
      const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.075, 0.075), matBladeYellow);
      crankArm.position.set(0.18, 0, spanD * 0.5 + 0.06); driveShaft.add(crankArm);
      g.add(driveShaft);

      const bladeMat = matBladeYellow.clone();
      const leftPts = [], rightPts = [], blades = [], linkRods = [];
      const topY = frameH + insH + 0.06;

      phOffsets.forEach(dz => {
        for (const sx of [-span, span]) {
          const ins = createInsulatorColumn(insH, 0.115, 0.088, 10, 'brown');
          ins.position.set(sx, frameH, dz); g.add(ins);
          addTerminalClamp(g, sx, topY, dz);
        }
        // Ngàm tiếp điểm chữ U bằng đồng phía cực phải (+span)
        for (const jz of [-0.085, 0.085]) {
          const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.045), matCopper);
          jaw.position.set(span, topY + 0.06, dz + jz); g.add(jaw);
        }
        // Thanh kéo truyền động
        const linkRod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, insH - 0.10, 6), matAlum);
        linkRod.position.set(-span * 0.62, frameH + insH * 0.5, dz); g.add(linkRod);
        linkRods.push(linkRod);

        // Lưỡi dao dẫn điện màu vàng sáng xoay 75° (MỞ) -> 0° (ĐÓNG khép kín vào ngàm đồng)
        const pivot = new THREE.Group();
        pivot.position.set(-span, topY, dz);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.14, 0.10, 0.095), bladeMat);
        blade.position.x = span; pivot.add(blade);
        g.add(pivot);
        blades.push(pivot);

        const lp = new THREE.Vector3(-span, topY, dz);
        const rp = new THREE.Vector3(span, topY, dz);
        if (axisZ) {
          lp.applyAxisAngle(_yAxis, Math.PI / 2);
          rp.applyAxisAngle(_yAxis, Math.PI / 2);
        }
        leftPts.push(new THREE.Vector3(x + lp.x, 5.65 + lp.y, z + lp.z));
        rightPts.push(new THREE.Vector3(x + rp.x, 5.65 + rp.y, z + rp.z));
      });
      swGroup.add(g);

      if (nameplateCode) {
        const npX = o.npX !== undefined ? o.npX : x;
        const npZ = o.npZ !== undefined ? o.npZ : (z + 1.48);
        createDeviceNameplate(nameplateCode, npX, npZ, o.npRotY || 0);
      }

      disconnectorWidgets.push({
        key, blades, driveShaft, linkRods, axis: 'z', openAngle: OPEN_75_DEG,
        prog: null, isGround: false, baseLinkY: frameH + insH * 0.5
      });

      const titleTxt = o.title || `Dao cách ly ${label}`;
      registerInteractive(g, {
        id: o.id || key,
        title: titleTxt,
        highlightMat: bladeMat,
        getTooltip: () => {
          const closed = on(key);
          return {
            status: closed ? 'ĐANG ĐÓNG (Góc 0°)' : 'ĐANG MỞ (Góc 75°)',
            cls: closed ? 'on' : 'off',
            action: o.actionText ? o.actionText(closed) : (closed ? `Bấm để MỞ dao cách ly ${label}` : `Bấm để ĐÓNG dao cách ly ${label}`)
          };
        },
        onClick: () => ask(`${on(key) ? 'Mở' : 'Đóng'} ${o.confirmLabel || ('dao cách ly ' + label)}?`, () => sendCommand(key))
      }, { w: spanW + 0.4, h: topY + 1.2, d: spanD + 0.4, x: 0, y: (topY + 0.8) * 0.5, z: 0 });
      return { leftPts, rightPts };
    }

    // 2. Dao tiếp địa 35 kV (DTĐ): Giá thép mảnh (không khối hộp), dây tiếp địa đồng, lưỡi sọc vàng-đen xoay tiếp xúc 3 pha
    function buildGroundingSwitch(x, z, key, label, opts) {
      const o = opts || {};
      const baseY = o.baseY !== undefined ? o.baseY : 5.65;
      const topH = o.topH !== undefined ? o.topH : 3.60;
      const bladeLen = o.bladeLen !== undefined ? o.bladeLen : 1.05;
      const phSpread = o.phSpread || PH_DZ;
      const pivotY = Math.max(0.85, topH - bladeLen);
      const axisZ = !!o.axisZ;

      const g = new THREE.Group(); g.position.set(x, baseY, z);
      if (axisZ) g.rotation.y = Math.PI / 2;

      const frameD = Math.abs(phSpread[phSpread.length - 1] - phSpread[0]) + 0.36;
      // Khung thép hình chữ H thanh mảnh 2 chân + xà ngang (thay thế khối hộp đặc)
      for (const sz of [-frameD * 0.5, frameD * 0.5]) {
        const foot = new THREE.Mesh(sharedFootingGeo, matDarkConcrete);
        foot.position.set(0, 0.07, sz); g.add(foot);
        const leg = new THREE.Mesh(unitBoxGeo, matGalvSteel);
        leg.position.set(0, pivotY * 0.5, sz); leg.scale.set(0.08, pivotY, 0.08); g.add(leg);
      }
      const topCross = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      topCross.position.set(0, pivotY - 0.05, 0); topCross.scale.set(0.11, 0.10, frameD + 0.10); g.add(topCross);
      const midCross = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      midCross.position.set(0, pivotY * 0.48, 0); midCross.scale.set(0.06, 0.06, frameD); g.add(midCross);

      // Thanh đồng tiếp địa nối xuống bãi đá dăm
      const earthStrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, pivotY, 0.08), matCopper);
      earthStrip.position.set(0.09, pivotY * 0.5, frameD * 0.46); g.add(earthStrip);

      // Hộp cơ cấu thao tác nhỏ & đèn báo trạng thái tiếp địa
      const opBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.24), matDarkSteel);
      opBox.position.set(0, 1.05, frameD * 0.5 + 0.14); g.add(opBox);
      const indMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.7 });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), indMat);
      beacon.position.set(0, 1.34, frameD * 0.5 + 0.14); g.add(beacon);

      // Trục đồng trục + tay đòn
      const driveShaft = new THREE.Group();
      driveShaft.position.set(0, pivotY, 0);
      const shaftBar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, frameD + 0.20, 6), matAlum);
      shaftBar.rotation.x = Math.PI / 2; driveShaft.add(shaftBar);
      const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.07), matOilPipe);
      crankArm.position.set(0, -0.18, frameD * 0.5 + 0.08); driveShaft.add(crankArm);
      g.add(driveShaft);

      const bladeMat = matGroundBlade.clone();
      const blades = [];
      phSpread.forEach(dz => {
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.18), matCopper);
        jaw.position.set(0, topH + 0.02, dz); g.add(jaw);

        // Lưỡi dao tiếp địa sọc vàng-đen: 0° = dựng đứng chạm 3 pha (ĐÓNG), -75° = gập an toàn (MỞ)
        const pivot = new THREE.Group();
        pivot.position.set(0, pivotY, dz);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.095, bladeLen, 0.095), bladeMat);
        blade.position.y = bladeLen * 0.5;
        pivot.add(blade);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), matCopper);
        tip.position.y = bladeLen - 0.09;
        pivot.add(tip);
        g.add(pivot);
        blades.push(pivot);
      });
      swGroup.add(g);

      if (o.nameplate) {
        const npX = o.npX !== undefined ? o.npX : x;
        const npZ = o.npZ !== undefined ? o.npZ : (z + 1.48);
        createDeviceNameplate(o.nameplate, npX, npZ, o.npRotY || 0);
      }

      if (key) {
        disconnectorWidgets.push({
          key, blades, driveShaft, axis: 'z', openAngle: -OPEN_75_DEG,
          prog: null, isGround: true, indMat
        });
        registerInteractive(g, {
          id: key,
          title: `Dao tiếp địa ${label}`,
          highlightMat: bladeMat,
          getTooltip: () => {
            const closed = on(key);
            return {
              status: closed ? 'ĐANG ĐÓNG (ĐÃ TIẾP ĐỊA)' : 'ĐANG MỞ',
              cls: closed ? 'warn' : 'off',
              action: closed ? `Bấm để MỞ dao tiếp địa ${label}` : `Bấm để ĐÓNG dao tiếp địa ${label}`
            };
          },
          onClick: () => ask(`${on(key) ? 'Mở' : 'Đóng'} dao tiếp địa ${label}?`, () => sendCommand(key))
        }, { w: 1.15, h: topH + 0.6, d: frameD + 0.4, x: 0, y: (topH + 0.3) * 0.5, z: 0 });
      } else {
        // DTĐ liên động chỉ thị (ví dụ DTĐ 321-14 / 321-24 ở ngăn liên lạc thanh cái)
        blades.forEach(p => { p.rotation.z = -OPEN_75_DEG; });
        driveShaft.rotation.z = -OPEN_75_DEG * 0.65;
        registerInteractive(g, {
          id: o.id || label,
          title: `Dao tiếp địa ${label}`,
          highlightMat: bladeMat,
          getTooltip: () => ({
            status: 'ĐANG MỞ (Khóa liên động thanh cái)',
            cls: 'off',
            action: 'Bảo vệ tiếp địa ngăn liên lạc TC 31 – TC 32'
          }),
          onClick: () => {}
        }, { w: 1.0, h: topH + 0.5, d: frameD + 0.3, x: 0, y: (topH + 0.3) * 0.5, z: 0 });
      }
      return g;
    }

    // 3. Máy cắt 35 kV (MC): Khung thép chữ I màu bạc xám + thanh giằng ngang, 3 trụ sứ cam có tán (#e66c1c), tủ cơ khí xám nhạt
    function buildBreaker35kV(x, z, key, label, nameplateCode, opts) {
      const o = opts || {};
      const axisZ = !!o.axisZ;
      const phOffsets = o.phOffsets || PH_DZ;
      const frameH = o.frameH || 1.62;
      const insH = o.insH || 2.08;
      const g = new THREE.Group(); g.position.set(x, 5.65, z);
      if (axisZ) g.rotation.y = Math.PI / 2;

      const spanD = Math.abs(phOffsets[2] - phOffsets[0]) + 0.45;
      // Khung giá đỡ thép chữ I màu bạc xám (2 trụ đầu hồi + dầm I ngang đỡ 3 cực + giằng ngang/chéo)
      for (const sz of [-spanD * 0.5, spanD * 0.5]) {
        for (const sx of [-0.42, 0.42]) {
          const foot = new THREE.Mesh(sharedFootingGeo, matDarkConcrete);
          foot.position.set(sx, 0.07, sz); g.add(foot);
          const col = new THREE.Mesh(unitBoxGeo, matIbeamGrey);
          col.position.set(sx, frameH * 0.5, sz); col.scale.set(0.10, frameH, 0.12);
          col.castShadow = true; g.add(col);
        }
        // Thanh giằng ngang & chữ X đầu hồi
        const hBar = new THREE.Mesh(unitBoxGeo, matIbeamGrey);
        hBar.position.set(0, frameH * 0.46, sz); hBar.scale.set(0.88, 0.07, 0.07); g.add(hBar);
        addStrut(g, new THREE.Vector3(-0.42, 0.16, sz), new THREE.Vector3(0.42, frameH - 0.12, sz), 0.045, matIbeamGrey);
        addStrut(g, new THREE.Vector3(0.42, 0.16, sz), new THREE.Vector3(-0.42, frameH - 0.12, sz), 0.045, matIbeamGrey);
      }
      // Dầm thép chữ I chính chạy dọc 3 pha (cánh trên, cánh dưới, bản bụng)
      for (const sx of [-0.36, 0.36]) {
        const iBeam = new THREE.Mesh(unitBoxGeo, matIbeamGrey);
        iBeam.position.set(sx, frameH - 0.08, 0); iBeam.scale.set(0.14, 0.16, spanD + 0.18);
        iBeam.castShadow = true; g.add(iBeam);
      }
      const midTie = new THREE.Mesh(unitBoxGeo, matIbeamGrey);
      midTie.position.set(0, frameH * 0.46, 0); midTie.scale.set(0.08, 0.07, spanD); g.add(midTie);

      // Tủ cơ cấu truyền động cơ khí màu xám nhạt gắn bên hông dưới xà đỡ
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.96, 0.46), matMechLightGrey);
      cab.position.set(0, frameH - 0.68, spanD * 0.5 + 0.18);
      cab.castShadow = true; g.add(cab);
      const cabTrim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.84, 0.03), matIbeamGrey);
      cabTrim.position.set(0, frameH - 0.68, spanD * 0.5 + 0.415); g.add(cabTrim);
      const cabWin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.04), matDarkSteel);
      cabWin.position.set(0, frameH - 0.42, spanD * 0.5 + 0.42); g.add(cabWin);
      // Đèn báo trạng thái ĐỎ (Đóng) / XANH LÁ (Cắt) gắn gọn trên mặt tủ cơ khí (không che đỉnh buồng dập hồ quang)
      const indMat = new THREE.MeshStandardMaterial({ color: 0x00e65b, emissive: 0x00c853, emissiveIntensity: 0.9 });
      const cabLed = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.045), indMat);
      cabLed.position.set(0, frameH - 0.42, spanD * 0.5 + 0.435); g.add(cabLed);

      // 3 Trụ sứ cách điện màu cam gốm có tán (#e66c1c) + buồng dập hồ quang chữ T nằm ngang song song hướng tuyến
      const leftPts = [], rightPts = [];
      const headY = frameH + insH + 0.14;
      const chLen = 0.48;
      const termX = 0.78;
      phOffsets.forEach(dz => {
        const col = createInsulatorColumn(insH, 0.145, 0.125, 12, 'orange');
        col.position.set(0, frameH, dz); g.add(col);
        // Hộp cơ cấu trung gian chữ T trên đỉnh trụ sứ (khít 0 mm với đỉnh sứ)
        const boxMid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.30), matAlum);
        boxMid.position.set(0, headY, dz); g.add(boxMid);
        for (const side of [-1, 1]) {
          // Buồng dập hồ quang sứ cam nằm ngang vươn ra 2 phía song song hướng dây dẫn (-side * PI/2)
          const ch = createInsulatorColumn(chLen, 0.115, 0.098, 8, 'orange');
          ch.rotation.z = -side * (Math.PI / 2);
          ch.position.set(side * 0.16, headY, dz);
          g.add(ch);
          // Đầu cực kim loại kéo dài hai bên buồng dập nối khít tới tâm kẹp cực
          const termStud = new THREE.Mesh(unitCylGeo, matAlum);
          termStud.rotation.z = Math.PI / 2;
          termStud.scale.set(0.088, 0.16, 0.088);
          termStud.position.set(side * (0.16 + chLen + 0.06), headY, dz);
          g.add(termStud);
          addTerminalClamp(g, side * termX, headY, dz);
        }
        const lp = new THREE.Vector3(-termX, headY, dz);
        const rp = new THREE.Vector3(termX, headY, dz);
        if (axisZ) {
          lp.applyAxisAngle(_yAxis, Math.PI / 2);
          rp.applyAxisAngle(_yAxis, Math.PI / 2);
        }
        leftPts.push(new THREE.Vector3(x + lp.x, 5.65 + lp.y, z + lp.z));
        rightPts.push(new THREE.Vector3(x + rp.x, 5.65 + rp.y, z + rp.z));
      });

      // Khối hitbox vô hình phía trên đỉnh máy cắt (opacity: 0, transparent: true – giữ raycast đóng/cắt, không che buồng dập 3D)
      const topHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.56), topHitMat);
      flag.position.set(0, headY + 0.62, 0); g.add(flag);
      swGroup.add(g);

      if (nameplateCode) {
        const npX = o.npX !== undefined ? o.npX : x;
        const npZ = o.npZ !== undefined ? o.npZ : (z + 1.48);
        createDeviceNameplate(nameplateCode, npX, npZ, o.npRotY || 0);
      }

      breakerWidgets.push({ key, indMat });
      registerInteractive(g, {
        id: o.id || key,
        title: o.title || `Máy cắt 35 kV – ${label}`,
        highlightMat: indMat,
        getTooltip: () => {
          const closed = on(key);
          return {
            status: closed ? 'ĐANG ĐÓNG' : 'ĐANG CẮT',
            cls: closed ? 'on' : 'off',
            action: o.actionText ? o.actionText(closed) : (closed ? `Bấm để CẮT máy cắt ${label}` : `Bấm để ĐÓNG máy cắt ${label}`)
          };
        },
        onClick: () => ask(`${on(key) ? 'Cắt' : 'Đóng'} ${o.confirmLabel || ('máy cắt ' + label)}?`, () => sendCommand(key))
      }, { w: 1.85, h: headY + 1.0, d: spanD + 0.5, x: 0, y: (headY + 0.6) * 0.5, z: 0 });
      return { leftPts, rightPts };
    }

    // 4. Máy biến dòng 35 kV (TI / CT): Giá thép mảnh 4 chân, 3 trụ sứ gân nâu, bầu dầu đỉnh nhôm + hộp đấu dây nhị thứ
    function buildCT35kV(x, z, code, bayIdx, isLine) {
      const frameH = 1.65, insH = 1.78;
      const g = new THREE.Group(); g.position.set(x, 5.65, z);
      addSteelFrame4Leg(g, 0.68, frameH, 2.22, matGalvSteel, { legT: 0.062, beamH: 0.085 });

      // Hộp đấu dây nhị thứ dưới chân
      const jBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.30), matMechLightGrey);
      jBox.position.set(0, 1.05, 1.24); g.add(jBox);

      const leftPts = [], rightPts = [];
      const headY = frameH + insH + 0.24;
      PH_DZ.forEach(dz => {
        const col = createInsulatorColumn(insH, 0.125, 0.105, 11, 'brown');
        col.position.set(0, frameH, dz); g.add(col);
        // Bầu đỉnh chứa cuộn dây & giãn nở dầu màu nhôm xám
        const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.18, 0.42, 10), matAlum);
        dome.position.set(0, headY, dz); g.add(dome);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 10), matGalvSteel);
        cap.position.set(0, headY + 0.23, dz); g.add(cap);
        addTerminalClamp(g, -0.25, headY + 0.04, dz);
        addTerminalClamp(g, 0.25, headY + 0.04, dz);
        leftPts.push(new THREE.Vector3(x - 0.25, 5.65 + headY + 0.04, z + dz));
        rightPts.push(new THREE.Vector3(x + 0.25, 5.65 + headY + 0.04, z + dz));
      });
      swGroup.add(g);
      createDeviceNameplate(code, x, z + 1.48, 0);

      registerInteractive(g, {
        id: code.replace(/\s+/g, '_'),
        title: `Máy biến dòng 35 kV – ${code}`,
        highlightMat: matAlum,
        getTooltip: () => {
          const iVal = isLine ? n(bayIdx === 0 ? 'I371' : 'I372') : (n(bayIdx === 0 ? 'G1.Ia' : 'G2.Ia') * 0.164);
          return {
            status: `I = ${fx(iVal, 1)} A · Đo lường & Bảo vệ rơle`,
            cls: iVal > 1 ? 'on' : 'off',
            action: 'Biến dòng dầu 35 kV – Tỷ số chuẩn Đrây H\'Linh 2'
          };
        },
        onClick: () => {}
      }, { w: 0.95, h: headY + 0.6, d: 2.55, x: 0, y: (headY + 0.3) * 0.5, z: 0 });
      return { leftPts, rightPts };
    }

    // 5. Máy biến điện áp 35 kV (TU / VT): Giá thép mảnh 4 chân, 3 trụ sứ gân nâu, bầu dầu đỉnh nhôm + hộp nhị thứ
    function buildVT35kV(x, z, code, bayIdx) {
      const frameH = 1.65, insH = 1.68;
      const g = new THREE.Group(); g.position.set(x, 5.65, z);
      addSteelFrame4Leg(g, 0.62, frameH, 2.22, matGalvSteel, { legT: 0.058, beamH: 0.08 });

      const jBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), matMechLightGrey);
      jBox.position.set(0, 1.02, 1.22); g.add(jBox);

      const topPts = [];
      const topY = frameH + insH + 0.28;
      PH_DZ.forEach(dz => {
        const col = createInsulatorColumn(insH, 0.115, 0.092, 11, 'brown');
        col.position.set(0, frameH, dz); g.add(col);
        const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.28, 10), matAlum);
        dome.position.set(0, frameH + insH + 0.12, dz); g.add(dome);
        addTerminalClamp(g, 0, topY, dz);
        topPts.push(new THREE.Vector3(x, 5.65 + topY, z + dz));
      });
      swGroup.add(g);
      createDeviceNameplate(code, x, z + 1.48, 0);

      registerInteractive(g, {
        id: code.replace(/\s+/g, '_'),
        title: `Máy biến điện áp 35 kV – ${code}`,
        highlightMat: matAlum,
        getTooltip: () => {
          const vVal = n(bayIdx === 0 ? 'VbusZone1' : 'VbusZone2');
          return {
            status: `U = ${fx(vVal, 1)} kV · Đo lường & Hòa đồng bộ`,
            cls: vVal > 1 ? 'on' : 'off',
            action: 'Biến điện áp 35/0,1 kV ngăn MBA ' + (bayIdx === 0 ? 'T1' : 'T2')
          };
        },
        onClick: () => {}
      }, { w: 0.88, h: topY + 0.5, d: 2.55, x: 0, y: (topY + 0.2) * 0.5, z: 0 });
      return { topPts };
    }

    // 6. Chống sét van 35 kV (CS / Surge Arrester): Giá thép mảnh 4 chân, 3 trụ sứ trắng sứ có tán + vòng đều áp + bộ đếm sét
    function buildSurgeArrester35kV(x, z, code, bayIdx, isLine) {
      const frameH = 1.65, insH = 1.72;
      const g = new THREE.Group(); g.position.set(x, 5.65, z);
      addSteelFrame4Leg(g, 0.54, frameH, 2.22, matGalvSteel, { legT: 0.055, beamH: 0.075 });

      const cntBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.24), matMechLightGrey);
      cntBox.position.set(0, 1.0, 1.20); g.add(cntBox);

      const topPts = [];
      const topY = frameH + insH + 0.14;
      PH_DZ.forEach(dz => {
        const col = createInsulatorColumn(insH, 0.10, 0.088, 12, 'white');
        col.position.set(0, frameH, dz); g.add(col);
        // Vòng nhôm đều áp đỉnh chống sét van ZnO
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 12), matAlum);
        ring.rotation.x = Math.PI / 2; ring.position.set(0, frameH + insH - 0.08, dz); g.add(ring);
        addTerminalClamp(g, 0, topY, dz);
        topPts.push(new THREE.Vector3(x, 5.65 + topY, z + dz));
      });
      swGroup.add(g);
      createDeviceNameplate(code, x, z + 1.48, 0);

      registerInteractive(g, {
        id: code.replace(/\s+/g, '_'),
        title: `Chống sét van 35 kV – ${code}`,
        highlightMat: matInsWhite,
        getTooltip: () => ({
          status: 'SẴN SÀNG BẢO VỆ QUÁ ĐIỆN ÁP (ZnO 35 kV)',
          cls: 'on',
          action: isLine ? `Bảo vệ quá điện áp xuất tuyến ${bayIdx === 0 ? '371' : '372'}` : `Bảo vệ quá điện áp MBA ${bayIdx === 0 ? 'T1' : 'T2'}`
        }),
        onClick: () => {}
      }, { w: 0.80, h: topY + 0.5, d: 2.55, x: 0, y: (topY + 0.2) * 0.5, z: 0 });
      return { topPts };
    }

    // -----------------------------------------------------------------------
    // ĐOẠN 2: NGĂN MBA T1 & T2 (CS -> TU -> DTĐ -> DCL -> DTĐ -> TI -> MC -> THANH CÁI 35 kV)
    // -----------------------------------------------------------------------
    const cs331 = buildSurgeArrester35kV(19.35, Z_BAY[0], 'CS 331', 0, false);
    const tu331 = buildVT35kV(20.30, Z_BAY[0], 'TU 331', 0);
    buildGroundingSwitch(21.15, Z_BAY[0], 'GS331_15', '331-15', { topH: 3.92, bladeLen: 0.90, nameplate: 'DTĐ 331-15', npZ: Z_BAY[0] + 1.82 });
    const is331 = buildDisconnectorX(22.35, Z_BAY[0], 'IS331_1', '331-1', 'DCL 331-1');
    buildGroundingSwitch(23.55, Z_BAY[0], 'GS331_14', '331-14', { topH: 3.65, bladeLen: 0.88, nameplate: 'DTĐ 331-14', npZ: Z_BAY[0] + 1.82 });
    const ti331 = buildCT35kV(24.55, Z_BAY[0], 'TI 331', 0, false);
    const cb331 = buildBreaker35kV(26.20, Z_BAY[0], 'CB331', '331', 'MC 331');

    const cs332 = buildSurgeArrester35kV(19.35, Z_BAY[1], 'CS 332', 1, false);
    const tu332 = buildVT35kV(20.30, Z_BAY[1], 'TU 332', 1);
    buildGroundingSwitch(21.15, Z_BAY[1], 'GS332_25', '332-25', { topH: 3.92, bladeLen: 0.90, nameplate: 'DTĐ 332-25', npZ: Z_BAY[1] + 1.82 });
    const is332 = buildDisconnectorX(22.35, Z_BAY[1], 'IS332_2', '332-2', 'DCL 332-2');
    buildGroundingSwitch(23.55, Z_BAY[1], 'GS332_24', '332-24', { topH: 3.65, bladeLen: 0.88, nameplate: 'DTĐ 332-24', npZ: Z_BAY[1] + 1.82 });
    const ti332 = buildCT35kV(24.55, Z_BAY[1], 'TI 332', 1, false);
    const cb332 = buildBreaker35kV(26.20, Z_BAY[1], 'CB332', '332', 'MC 332');

    // (Dao tiếp địa 1QE / 2QE 6,3 kV đã được chuyển gọn vào dãy tủ hợp bộ 6,3 kV trong gian máy)

    const wT1_IS = createConductorGroup(() => n('G1.V60') > 0.5 || (on('IS331_1') && on('CB331') && n('VbusZone1') > 1), () => n('G1.Pload') > 0.05);
    const wIS_CB331 = createConductorGroup(() => (on('IS331_1') && n('G1.V60') > 0.5) || (on('CB331') && n('VbusZone1') > 1), () => n('G1.Pload') > 0.05);
    const wCB331_Bus = createConductorGroup(() => n('VbusZone1') > 1, () => n('G1.Pload') > 0.05);

    const wT2_IS = createConductorGroup(() => n('G2.V60') > 0.5 || (on('IS332_2') && on('CB332') && n('VbusZone2') > 1), () => n('G2.Pload') > 0.05);
    const wIS_CB332 = createConductorGroup(() => (on('IS332_2') && n('G2.V60') > 0.5) || (on('CB332') && n('VbusZone2') > 1), () => n('G2.Pload') > 0.05);
    const wCB332_Bus = createConductorGroup(() => n('VbusZone2') > 1, () => n('G2.Pload') > 0.05);

    for (let ph = 0; ph < 3; ph++) {
      // Bay 1: T1 -> dây vượt (rẽ xuống CS 331 & TU 331) -> DCL 331-1 -> TI 331 -> MC 331 -> Thanh cái TC 31
      const cT1 = makeCatenaryCurve(trafoHvTips[0][ph], is331.leftPts[ph], 0.24);
      addWireToGroup(wT1_IS, cT1, 0.048, 2);
      addWireToGroup(wT1_IS, makeCatenaryCurve(cT1.getPoint(0.32), cs331.topPts[ph], 0.04), 0.036, 0);
      addWireToGroup(wT1_IS, makeCatenaryCurve(cT1.getPoint(0.60), tu331.topPts[ph], 0.04), 0.036, 0);
      addWireToGroup(wIS_CB331, makeCatenaryCurve(is331.rightPts[ph], ti331.leftPts[ph], 0.14), 0.048, 1);
      addWireToGroup(wIS_CB331, makeCatenaryCurve(ti331.rightPts[ph], cb331.leftPts[ph], 0.12), 0.048, 1);
      const busTap1 = new THREE.Vector3(BUS_X[ph], BUS_Y, Z_BAY[0] + PH_DZ[ph]);
      addTerminalClamp(swGroup, busTap1.x, busTap1.y, busTap1.z);
      addWireToGroup(wCB331_Bus, makeCatenaryCurve(cb331.rightPts[ph], busTap1, -0.35), 0.048, 2);

      // Bay 2: T2 -> dây vượt (rẽ xuống CS 332 & TU 332) -> DCL 332-1 -> TI 332 -> MC 332 -> Thanh cái TC 32
      const cT2 = makeCatenaryCurve(trafoHvTips[1][ph], is332.leftPts[ph], 0.24);
      addWireToGroup(wT2_IS, cT2, 0.048, 2);
      addWireToGroup(wT2_IS, makeCatenaryCurve(cT2.getPoint(0.32), cs332.topPts[ph], 0.04), 0.036, 0);
      addWireToGroup(wT2_IS, makeCatenaryCurve(cT2.getPoint(0.60), tu332.topPts[ph], 0.04), 0.036, 0);
      addWireToGroup(wIS_CB332, makeCatenaryCurve(is332.rightPts[ph], ti332.leftPts[ph], 0.14), 0.048, 1);
      addWireToGroup(wIS_CB332, makeCatenaryCurve(ti332.rightPts[ph], cb332.leftPts[ph], 0.12), 0.048, 1);
      const busTap2 = new THREE.Vector3(BUS_X[ph], BUS_Y, Z_BAY[1] + PH_DZ[ph]);
      addTerminalClamp(swGroup, busTap2.x, busTap2.y, busTap2.z);
      addWireToGroup(wCB332_Bus, makeCatenaryCurve(cb332.rightPts[ph], busTap2, -0.35), 0.048, 2);
    }

    // -----------------------------------------------------------------------
    // ĐOẠN 3: THANH CÁI 35 kV (TC 31 / TC 32) & NGĂN LIÊN LẠC THANH CÁI C31–C32 (MC 321, DCL 321-1/2, DTĐ 321-14/24)
    // -----------------------------------------------------------------------
    const busGrp1 = createConductorGroup(() => n('VbusZone1') > 1, () => n('P371') > 0.05 || n('G1.Pload') > 0.05);
    const busGrp2 = createConductorGroup(() => n('VbusZone2') > 1, () => n('P372') > 0.05 || n('G2.Pload') > 0.05);
    const busTieGrp = createConductorGroup(() => on('IS312_1') && (n('VbusZone1') > 1 || n('VbusZone2') > 1), () => on('IS312_1') && (n('G1.Pload') > 0.05 || n('G2.Pload') > 0.05));

    // Khung cổng thép mạ kẽm đỡ thanh cái 35 kV + trụ sứ đỡ có tán gân nâu (thay cọc trơn cũ)
    function buildBusSupportPortal(zPos) {
      const pg = new THREE.Group(); pg.position.set(BUS_X[1], 5.65, zPos);
      const portalH = 4.25;
      for (const sx of [-1.42, 1.42]) {
        const foot = new THREE.Mesh(sharedFootingGeo, matDarkConcrete);
        foot.position.set(sx, 0.07, 0); pg.add(foot);
        const col = new THREE.Mesh(unitBoxGeo, matGalvSteel);
        col.position.set(sx, portalH * 0.5, 0); col.scale.set(0.14, portalH, 0.14);
        col.castShadow = true; pg.add(col);
      }
      const xBeam = new THREE.Mesh(unitBoxGeo, matGalvSteel);
      xBeam.position.set(0, portalH, 0); xBeam.scale.set(3.15, 0.16, 0.18); pg.add(xBeam);
      // Giằng nách góc cổng
      addStrut(pg, new THREE.Vector3(-1.42, portalH - 0.65, 0), new THREE.Vector3(-0.75, portalH, 0), 0.055, matGalvSteel);
      addStrut(pg, new THREE.Vector3(1.42, portalH - 0.65, 0), new THREE.Vector3(0.75, portalH, 0), 0.055, matGalvSteel);
      // 3 Trụ sứ đỡ gân nâu cao 1.68 m lên đúng cao độ BUS_Y (5.65 + 4.25 + 1.75 = 11.65)
      [-1.1, 0, 1.1].forEach(dx => {
        const ins = createInsulatorColumn(1.68, 0.12, 0.095, 11, 'brown');
        ins.position.set(dx, portalH + 0.06, 0); pg.add(ins);
        addTerminalClamp(pg, dx, portalH + 1.76, 0);
      });
      swGroup.add(pg);
    }
    [17.15, 23.45, 25.75, 31.75].forEach(sz => buildBusSupportPortal(sz));

    // DCL phân đoạn thanh cái 35 kV: DCL 312-1 (gắn trên cổng thanh cái, khóa lệnh IS312_1)
    const is312Blades = [];
    const is312Group = new THREE.Group();
    swGroup.add(is312Group);
    const is312BladeMat = matBladeYellow.clone();
    const is312IndMat = new THREE.MeshStandardMaterial({ color: 0x00e65b, emissive: 0x00c853, emissiveIntensity: 0.9 });

    const is312Shaft = new THREE.Group();
    is312Shaft.position.set(BUS_X[1], BUS_Y - 0.55, 23.48);
    const sh312Bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.75, 6), matAlum);
    sh312Bar.rotation.z = Math.PI / 2; is312Shaft.add(sh312Bar);
    const cr312Arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.09), matBladeYellow);
    cr312Arm.position.set(1.40, -0.20, 0); is312Shaft.add(cr312Arm);
    is312Group.add(is312Shaft);

    // Tủ truyền động xanh dương dưới chân cột cổng + thanh truyền động đứng lên DCL 312-1
    const is312Cab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.36), matDclBlue);
    is312Cab.position.set(BUS_X[1] + 1.42, 5.65 + 1.15, 23.22); is312Group.add(is312Cab);
    const is312VertRod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 4.1, 6), matAlum);
    is312VertRod.position.set(BUS_X[1] + 1.42, 5.65 + 3.45, 23.38); is312Group.add(is312VertRod);
    createDeviceNameplate('DCL 312-1', BUS_X[1] + 1.72, 23.15, 0);

    for (let ph = 0; ph < 3; ph++) {
      const bx = BUS_X[ph];
      // Thanh cái ống 35 kV Phân đoạn 1 (TC 31: Z = 16.05 -> 23.48) và Phân đoạn 2 (TC 32: Z = 25.72 -> 33.48)
      addWireToGroup(busGrp1, new THREE.LineCurve3(new THREE.Vector3(bx, BUS_Y, 16.05), new THREE.Vector3(bx, BUS_Y, 23.48)), 0.075, 2);
      addWireToGroup(busGrp2, new THREE.LineCurve3(new THREE.Vector3(bx, BUS_Y, 25.72), new THREE.Vector3(bx, BUS_Y, 33.48)), 0.075, 2);
      for (const jx of [-0.085, 0.085]) {
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.18), matCopper);
        jaw.position.set(bx + jx, BUS_Y + 0.05, 25.72); is312Group.add(jaw);
      }
      // Lưỡi dao vàng DCL 312-1 xoay mượt 75° (MỞ) -> 0° (ĐÓNG ngang)
      const p312 = new THREE.Group();
      p312.position.set(bx, BUS_Y, 23.48);
      const blade312 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 2.26), is312BladeMat);
      blade312.position.z = 1.13; p312.add(blade312);
      is312Group.add(p312);
      is312Blades.push(p312);
    }
    disconnectorWidgets.push({
      key: 'IS312_1', blades: is312Blades, driveShaft: is312Shaft, axis: 'x',
      openAngle: -OPEN_75_DEG, prog: null, isGround: false
    });
    const is312HitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const is312Flag = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), is312HitMat);
    is312Flag.position.set(BUS_X[1], BUS_Y + 1.15, 24.6); is312Group.add(is312Flag);
    const is312Led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.04), is312IndMat);
    is312Led.position.set(BUS_X[1] + 1.42, 5.65 + 1.32, 23.41); is312Group.add(is312Led);
    breakerWidgets.push({ key: 'IS312_1', indMat: is312IndMat });
    registerInteractive(is312Group, {
      id: 'IS312_1',
      title: 'Dao cách ly phân đoạn thanh cái – DCL 312-1 (TC 31 – TC 32)',
      highlightMat: is312BladeMat,
      getTooltip: () => {
        const closed = on('IS312_1');
        return {
          status: closed ? 'ĐANG ĐÓNG (Liên lạc TC 31 – TC 32)' : 'ĐANG MỞ (Tách TC 31 / TC 32)',
          cls: closed ? 'on' : 'off',
          action: closed ? 'Bấm để MỞ DCL 312-1' : 'Bấm để ĐÓNG DCL 312-1'
        };
      },
      onClick: () => ask(`${on('IS312_1') ? 'Mở' : 'Đóng'} dao cách ly phân đoạn thanh cái DCL 312-1 (TC 31 – TC 32)?`, () => sendCommand('IS312_1'))
    }, { w: 3.1, h: 3.0, d: 2.7, x: BUS_X[1], y: BUS_Y + 0.5, z: 24.6 });

    // Cụm máy cắt liên lạc phụ trợ phía dưới thanh cái (giữ sạch sơ đồ nhất thứ Đrây H'Linh 2 với biển DCL 312-1)
    const mc321 = buildBreaker35kV(BUS_X[1], 22.15, 'IS312_1', '312-1 (Phân đoạn TC 31–TC 32)', null, {
      id: 'MC321_VIEW', axisZ: true, phOffsets: [-1.1, 0, 1.1], frameH: 1.45, insH: 1.85,
      title: 'Ngăn phân đoạn thanh cái 35 kV – DCL 312-1 (TC 31 – TC 32)',
      confirmLabel: 'dao cách ly phân đoạn thanh cái DCL 312-1',
      actionText: cl => cl ? 'Bấm để MỞ phân đoạn thanh cái DCL 312-1' : 'Bấm để ĐÓNG phân đoạn thanh cái DCL 312-1'
    });
    for (let ph = 0; ph < 3; ph++) {
      const bx = BUS_X[ph];
      const tapL = new THREE.Vector3(bx, BUS_Y, mc321.leftPts[ph].z);
      const tapR = new THREE.Vector3(bx, BUS_Y, mc321.rightPts[ph].z);
      addTerminalClamp(swGroup, tapL.x, tapL.y, tapL.z);
      addTerminalClamp(swGroup, tapR.x, tapR.y, tapR.z);
      addWireToGroup(busTieGrp, makeCatenaryCurve(mc321.leftPts[ph], tapL, -0.14), 0.042, 0);
      addWireToGroup(busTieGrp, makeCatenaryCurve(mc321.rightPts[ph], tapR, -0.14), 0.042, 0);
    }

    // -----------------------------------------------------------------------
    // ĐOẠN 3B: BIẾN ĐIỆN ÁP THANH CÁI 1BTV (TC 31), 2BTV (TC 32) & CỤM TỰ DÙNG 35 kV NGOÀI TRỜI (FCO-TD32 + TD32)
    // -----------------------------------------------------------------------
    function buildBusVT35kV(x, z, code, zoneNo, axisZ, npX, npZ) {
      const frameH = 1.65, insH = 1.85;
      const phOff = axisZ ? [-1.1, 0, 1.1] : [-0.62, 0, 0.62];
      const g = new THREE.Group(); g.position.set(x, 5.65, z);
      if (axisZ) g.rotation.y = Math.PI / 2;
      const spanD = Math.abs(phOff[2] - phOff[0]) + 0.42;
      addSteelFrame4Leg(g, 0.62, frameH, spanD, matGalvSteel, { legT: 0.06, beamH: 0.085 });
      const topPts = [];
      const topY = frameH + insH + 0.28;
      phOff.forEach(dz => {
        const col = createInsulatorColumn(insH, 0.11, 0.088, 11, 'brown');
        col.position.set(0, frameH, dz); g.add(col);
        const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.26, 10), matAlum);
        dome.position.set(0, frameH + insH + 0.12, dz); g.add(dome);
        addTerminalClamp(g, 0, topY, dz);
        const p = new THREE.Vector3(0, topY, dz);
        if (axisZ) p.applyAxisAngle(_yAxis, Math.PI / 2);
        topPts.push(new THREE.Vector3(x + p.x, 5.65 + p.y, z + p.z));
      });
      swGroup.add(g);
      createDeviceNameplate(code, npX, npZ, 0);
      registerInteractive(g, {
        id: code,
        title: `Biến điện áp thanh cái 35 kV – ${code} (TC 3${zoneNo})`,
        highlightMat: matAlum,
        getTooltip: () => {
          const vVal = n(zoneNo === 1 ? 'VbusZone1' : 'VbusZone2');
          return {
            status: `U_TC3${zoneNo} = ${fx(vVal, 1)} kV · Đo lường & Bảo vệ thanh cái`,
            cls: vVal > 1 ? 'on' : 'off',
            action: `Biến điện áp thanh cái 35/0,1 kV Phân đoạn ${zoneNo}`
          };
        },
        onClick: () => {}
      }, { w: 0.95, h: topY + 0.4, d: spanD + 0.3, x: 0, y: (topY + 0.2) * 0.5, z: 0 });
      return { topPts };
    }

    // 1BTV ở đầu Bắc Phân đoạn 1 (TC 31, Z = 16.05)
    const btv1 = buildBusVT35kV(BUS_X[1], 16.05, '1BTV', 1, true, BUS_X[2] + 1.05, 16.15);
    for (let ph = 0; ph < 3; ph++) {
      const tap = new THREE.Vector3(BUS_X[ph], BUS_Y, 16.05);
      addTerminalClamp(swGroup, tap.x, tap.y, tap.z);
      addWireToGroup(busGrp1, makeCatenaryCurve(tap, btv1.topPts[ph], 0.05), 0.036, 0);
    }

    // 2BTV ở đầu Nam Phân đoạn 2 (TC 32, X = 26.35, Z = 32.65)
    const btv2 = buildBusVT35kV(26.35, 32.65, '2BTV', 2, false, 26.35, 33.88);
    for (let ph = 0; ph < 3; ph++) {
      const tap = new THREE.Vector3(BUS_X[ph], BUS_Y, 32.05 + (ph - 1) * 0.32);
      addTerminalClamp(swGroup, tap.x, tap.y, tap.z);
      addWireToGroup(busGrp2, makeCatenaryCurve(tap, btv2.topPts[ph], 0.16), 0.036, 0);
    }

    // Máy biến áp tự dùng ngoài trời TD32 (35/0,4 kV – 320 kVA) đặt trên bệ bê tông cạnh hàng rào Nam sân trạm 35 kV
    // (3 dây 35 kV từ thanh cái TC 32 đi thẳng trực tiếp vào 3 sứ cao áp TD32; KHÔNG đặt nhãn hay nút 2AXT ngoài sân trạm)
    const td32Pos = new THREE.Vector3(31.85, 5.65, 32.95);
    const td32PhZ = [-0.50, 0.0, 0.50]; // 3 pha A – B – C song song Z = 32.45, 32.95, 33.45
    const td32Group = new THREE.Group();
    td32Group.position.copy(td32Pos);
    const td32Pad = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.28, 2.05), matDarkConcrete);
    td32Pad.position.y = 0.14; td32Group.add(td32Pad);
    const td32TankMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.44, metalness: 0.55 });
    const td32Tank = new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.48, 1.56), td32TankMat);
    td32Tank.position.y = 1.02; td32Tank.castShadow = true; td32Tank.receiveShadow = true; td32Group.add(td32Tank);
    // Cánh tản nhiệt 2 mặt Bắc – Nam thùng dầu TD32
    for (const sz of [-0.88, 0.88]) {
      for (let i = -2; i <= 2; i++) {
        const fin = new THREE.Mesh(unitBoxGeo, matGalvSteel);
        fin.position.set(i * 0.22, 1.02, sz); fin.scale.set(0.045, 1.18, 0.22); td32Group.add(fin);
      }
    }
    // Bình dầu phụ hình trụ nhỏ đặt lệch về mép Tây nắp thùng dầu để khoảng không phía Đông hoàn toàn thoáng
    const td32Cons = makeHorizontalTank(0.20, 1.08, matGalvSteel);
    td32Cons.rotation.y = Math.PI / 2;
    td32Cons.position.set(-0.34, 2.16, 0); td32Group.add(td32Cons);
    // 3 Sứ cao áp 35 kV (gân sứ nâu) xếp thẳng hàng theo trục Z để nhận trực tiếp 3 pha từ TC 32 và rẽ nhánh sang CSV-TD32
    const td32HvTips = [];
    td32PhZ.forEach(dz => {
      const hv = createInsulatorColumn(0.95, 0.082, 0.060, 8, 'brown');
      hv.position.set(0.28, 1.76, dz); td32Group.add(hv);
      addTerminalClamp(td32Group, 0.28, 2.74, dz);
      td32HvTips.push(new THREE.Vector3(td32Pos.x + 0.28, td32Pos.y + 2.74, td32Pos.z + dz));
    });
    // Hộp đấu cáp hạ áp 0,4 kV + ống dẫn cáp ngầm về tủ tự dùng 0,4 kV (tủ ATS) bên trong nhà máy
    const td32LvBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.50, 0.48), matDarkSteel);
    td32LvBox.position.set(-0.74, 1.12, 0); td32Group.add(td32LvBox);
    const td32Conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.02, 8), matDarkSteel);
    td32Conduit.position.set(-0.74, 0.54, 0); td32Group.add(td32Conduit);
    swGroup.add(td32Group);
    addCableTrench(31.10, 32.95, 31.10, 26.2, 0.34);
    createDeviceNameplate('TD32', td32Pos.x, 34.04, 0);

    registerInteractive(td32Group, {
      id: 'TD32',
      title: 'MBA tự dùng ngoài trời TD32 (35/0,4 kV – 320 kVA)',
      highlightMat: td32TankMat,
      getTooltip: () => {
        const v35 = n('VbusZone2');
        const lv = S.V400Zone2 !== undefined ? n('V400Zone2') : (v35 > 1 ? 0.4 : 0);
        return {
          status: `U_35 = ${fx(v35, 1)} kV (TC 32) · U_0,4 = ${fx(lv * 1000, 0)} V`,
          cls: v35 > 1 ? 'on' : 'off',
          action: 'MBA tự dùng 35/0,4 kV – Cáp hạ áp đấu về tủ ATS 0,4 kV trong nhà'
        };
      },
      onClick: () => {}
    }, { w: 2.15, h: 3.1, d: 2.15, x: 0, y: 1.55, z: 0 });

    // 3 Trụ Chống sét van 35 kV (CSV-TD32) đặt ngay cạnh TD32, đấu rẽ nhánh song song từ 3 sứ cao áp TD32 xuống đất
    const csvTd32Pos = new THREE.Vector3(34.15, 5.65, 32.95);
    const csvTd32Group = new THREE.Group();
    csvTd32Group.position.copy(csvTd32Pos);
    const csvFrameH = 1.48, csvInsH = 1.62;
    addSteelFrame4Leg(csvTd32Group, 0.54, csvFrameH, 1.42, matGalvSteel, { legT: 0.055, beamH: 0.075 });
    // Bệ bê tông tiếp địa + bộ đếm sét
    const csvPad = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 1.72), matDarkConcrete);
    csvPad.position.y = 0.07; csvTd32Group.add(csvPad);
    const csvCntBox = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.26, 0.22), matMechLightGrey);
    csvCntBox.position.set(0.32, 0.96, 0); csvTd32Group.add(csvCntBox);
    // Thanh đồng góp tiếp địa nối chung chân 3 trụ CSV + dây đồng tiếp địa chạy thẳng xuống bệ bê tông
    const csvGndBus = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.12), matCopper);
    csvGndBus.position.set(0.18, csvFrameH - 0.02, 0); csvTd32Group.add(csvGndBus);
    const csvGndDown = new THREE.Mesh(new THREE.BoxGeometry(0.06, csvFrameH, 0.07), matCopper);
    csvGndDown.position.set(0.24, csvFrameH * 0.5, 0); csvTd32Group.add(csvGndDown);

    const csvTd32Tips = [];
    const csvTopY = csvFrameH + csvInsH + 0.12;
    td32PhZ.forEach(dz => {
      const col = createInsulatorColumn(csvInsH, 0.095, 0.082, 12, 'white');
      col.position.set(0, csvFrameH, dz); csvTd32Group.add(col);
      // Vòng đều áp nhôm trên đỉnh trụ chống sét van ZnO
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.020, 6, 12), matAlum);
      ring.rotation.x = Math.PI / 2; ring.position.set(0, csvFrameH + csvInsH - 0.08, dz); csvTd32Group.add(ring);
      // Thanh nối chân trụ CSV vào thanh đồng tiếp địa xuống bệ
      const legTap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.05), matCopper);
      legTap.position.set(0.09, csvFrameH + 0.02, dz); csvTd32Group.add(legTap);
      addTerminalClamp(csvTd32Group, 0, csvTopY, dz);
      csvTd32Tips.push(new THREE.Vector3(csvTd32Pos.x, csvTd32Pos.y + csvTopY, csvTd32Pos.z + dz));
    });
    swGroup.add(csvTd32Group);
    createDeviceNameplate('CSV-TD32', csvTd32Pos.x, 33.98, 0);
    registerInteractive(csvTd32Group, {
      id: 'CSV_TD32',
      title: 'Chống sét van 35 kV – CSV-TD32 (Đấu song song xuống đất)',
      highlightMat: matInsWhite,
      getTooltip: () => ({
        status: `U_TC32 = ${fx(n('VbusZone2'), 1)} kV · SẴN SÀNG BẢO VỆ QUÁ ĐIỆN ÁP`,
        cls: n('VbusZone2') > 1 ? 'on' : 'off',
        action: 'Chống sét van ZnO 35 kV đấu rẽ nhánh song song bảo vệ MBA TD32'
      }),
      onClick: () => {}
    }, { w: 0.90, h: csvTopY + 0.4, d: 1.75, x: 0, y: (csvTopY + 0.2) * 0.5, z: 0 });

    // 3 dây dẫn cao áp 35 kV từ thanh cái TC 32 đi thẳng trực tiếp vào 3 sứ cao áp TD32,
    // đồng thời rẽ nhánh song song từ 3 đầu sứ cao áp TD32 sang đỉnh 3 trụ Chống sét van CSV-TD32
    const wTD32 = createConductorGroup(() => n('VbusZone2') > 1, () => on('AXT2'));
    for (let ph = 0; ph < 3; ph++) {
      const zPh = td32Pos.z + td32PhZ[ph];
      const busTap = new THREE.Vector3(BUS_X[ph], BUS_Y, zPh);
      addTerminalClamp(swGroup, busTap.x, busTap.y, busTap.z);
      addWireToGroup(wTD32, makeCatenaryCurve(busTap, td32HvTips[ph], 0.14), 0.038, 1);
      addWireToGroup(wTD32, makeCatenaryCurve(td32HvTips[ph], csvTd32Tips[ph], -0.10), 0.034, 0);
    }

    // -----------------------------------------------------------------------
    // ĐOẠN 4: NGĂN XUẤT TUYẾN ĐZ 371 & ĐZ 372 (DCL-1/2 -> DTĐ -> MC -> TI -> DTĐ-75 -> DCL-7 -> DTĐ-76 -> CS -> CỘT CỔNG)
    // -----------------------------------------------------------------------
    const is371_1 = buildDisconnectorX(32.85, Z_BAY[0], 'IS371_1', '371-1', 'DCL 371-1');
    buildGroundingSwitch(34.45, Z_BAY[0], 'GS371_15', '371-15', { topH: 3.65, bladeLen: 0.88, nameplate: 'DTĐ 371-15', npZ: Z_BAY[0] + 1.82 });
    const cb371 = buildBreaker35kV(36.10, Z_BAY[0], 'CB371', '371', 'MC 371');
    const ti371 = buildCT35kV(37.85, Z_BAY[0], 'TI 371', 0, true);
    buildGroundingSwitch(39.05, Z_BAY[0], 'GS371_75', '371-75', { topH: 3.65, bladeLen: 0.88, nameplate: 'DTĐ 371-75', npZ: Z_BAY[0] + 1.82 });
    const is371_7 = buildDisconnectorX(40.35, Z_BAY[0], 'IS371_7', '371-7', 'DCL 371-7');
    buildGroundingSwitch(41.80, Z_BAY[0], 'GS371_76', '371-76', { topH: 4.42, bladeLen: 0.92, nameplate: 'DTĐ 371-76', npZ: Z_BAY[0] + 1.82 });
    const cs371 = buildSurgeArrester35kV(42.95, Z_BAY[0], 'CS 371', 0, true);

    const is372_2 = buildDisconnectorX(32.85, Z_BAY[1], 'IS372_2', '372-2', 'DCL 372-2');
    buildGroundingSwitch(34.45, Z_BAY[1], 'GS372_25', '372-25', { topH: 3.65, bladeLen: 0.88, nameplate: 'DTĐ 372-25', npZ: Z_BAY[1] + 1.82 });
    const cb372 = buildBreaker35kV(36.10, Z_BAY[1], 'CB372', '372', 'MC 372');
    const ti372 = buildCT35kV(37.85, Z_BAY[1], 'TI 372', 1, true);
    buildGroundingSwitch(39.05, Z_BAY[1], 'GS372_75', '372-75', { topH: 3.65, bladeLen: 0.88, nameplate: 'DTĐ 372-75', npZ: Z_BAY[1] + 1.82 });
    const is372_7 = buildDisconnectorX(40.35, Z_BAY[1], 'IS372_7', '372-7', 'DCL 372-7');
    buildGroundingSwitch(41.80, Z_BAY[1], 'GS372_76', '372-76', { topH: 4.42, bladeLen: 0.92, nameplate: 'DTĐ 372-76', npZ: Z_BAY[1] + 1.82 });
    const cs372 = buildSurgeArrester35kV(42.95, Z_BAY[1], 'CS 372', 1, true);

    // Giàn cột cổng thép giàn không gian mạ kẽm sáng (#b0bac5) đan chéo chữ X tại X = 45.0
    const gantryTips = [[], []];
    function buildLatticeColumn(parent, xOff, zOff, h) {
      const bW = 0.42, tW = 0.21;
      const bays = 5;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      // 4 thanh thép góc chính vát côn từ đáy lên đỉnh
      corners.forEach(([sx, sz]) => {
        const pBot = new THREE.Vector3(xOff + sx * bW, 0, zOff + sz * bW);
        const pTop = new THREE.Vector3(xOff + sx * tW, h, zOff + sz * tW);
        addStrut(parent, pBot, pTop, 0.068, matGalvSteel);
      });
      // Đế móng bê tông cột cổng
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 1.1), matDarkConcrete);
      base.position.set(xOff, 0.18, zOff); parent.add(base);
      // Thanh giằng chéo chữ X trên 4 mặt cột
      for (let i = 0; i < bays; i++) {
        const y0 = (i / bays) * h, y1 = ((i + 1) / bays) * h;
        const w0 = bW + (tW - bW) * (i / bays);
        const w1 = bW + (tW - bW) * ((i + 1) / bays);
        for (let f = 0; f < 4; f++) {
          const [ax, az] = corners[f];
          const [bx, bz] = corners[(f + 1) % 4];
          const p00 = new THREE.Vector3(xOff + ax * w0, y0, zOff + az * w0);
          const p10 = new THREE.Vector3(xOff + bx * w0, y0, zOff + bz * w0);
          const p01 = new THREE.Vector3(xOff + ax * w1, y1, zOff + az * w1);
          const p11 = new THREE.Vector3(xOff + bx * w1, y1, zOff + bz * w1);
          addStrut(parent, p00, p11, 0.036, matGalvSteel);
          addStrut(parent, p10, p01, 0.036, matGalvSteel);
          addStrut(parent, p01, p11, 0.042, matGalvSteel);
        }
      }
      // Kim thu sét đỉnh cột cổng
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.065, 2.6, 6), matAlum);
      spire.position.set(xOff, h + 1.3, zOff); parent.add(spire);
    }

    function buildSwitchyardGantry(x, zCenter, idx) {
      const g = new THREE.Group(); g.position.set(x, 5.65, zCenter);
      const colH = 11.4, beamY = 10.75, spanZ = 3.45;
      buildLatticeColumn(g, 0, -spanZ, colH);
      buildLatticeColumn(g, 0, spanZ, colH);

      // Xà ngang giàn không gian thép mạ kẽm đan chéo chữ X nối 2 cột cổng
      const bw = 0.24, bh = 0.34, zLen = spanZ * 2 + 0.6;
      const zStart = -zLen * 0.5, nSegs = 8, segDz = zLen / nSegs;
      for (const sx of [-bw, bw]) {
        for (const sy of [-bh, bh]) {
          const chord = new THREE.Mesh(unitBoxGeo, matGalvSteel);
          chord.position.set(sx, beamY + sy, 0); chord.scale.set(0.055, 0.055, zLen); g.add(chord);
        }
      }
      for (let i = 0; i < nSegs; i++) {
        const z0 = zStart + i * segDz, z1 = z0 + segDz;
        for (const sx of [-bw, bw]) {
          addStrut(g, new THREE.Vector3(sx, beamY - bh, z0), new THREE.Vector3(sx, beamY + bh, z1), 0.034, matGalvSteel);
          addStrut(g, new THREE.Vector3(sx, beamY + bh, z0), new THREE.Vector3(sx, beamY - bh, z1), 0.034, matGalvSteel);
        }
        addStrut(g, new THREE.Vector3(-bw, beamY - bh, z0), new THREE.Vector3(bw, beamY - bh, z1), 0.032, matGalvSteel);
        addStrut(g, new THREE.Vector3(-bw, beamY + bh, z0), new THREE.Vector3(bw, beamY + bh, z1), 0.032, matGalvSteel);
      }

      // 3 Chuỗi sứ treo thủy tinh / gốm nhiều tán rủ xuống kẹp néo dây 3 pha
      PH_DZ.forEach(dz => {
        const zOff = dz * 1.8;
        const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.24), matAlum);
        yoke.position.set(0, beamY - bh - 0.07, zOff); g.add(yoke);
        const insStr = createInsulatorColumn(1.42, 0.125, 0.125, 10, 'glass');
        insStr.position.set(0, beamY - bh - 1.50, zOff); g.add(insStr);
        addTerminalClamp(g, 0, beamY - bh - 1.54, zOff);
        gantryTips[idx].push(new THREE.Vector3(x, 5.65 + beamY - bh - 1.54, zCenter + zOff));
      });
      swGroup.add(g);
    }
    buildSwitchyardGantry(45.0, Z_BAY[0], 0);
    buildSwitchyardGantry(45.0, Z_BAY[1], 1);

    // Đấu nối kín 3 pha ngăn xuất tuyến: Thanh cái -> DCL-1 -> MC -> TI -> DCL-7 -> dây vượt (rẽ xuống CS) -> Giàn cột cổng
    const wBus_371 = createConductorGroup(() => n('VbusZone1') > 1, () => n('P371') > 0.05);
    const wMid_371 = createConductorGroup(() => (on('IS371_1') && n('VbusZone1') > 1) || (on('CB371') && on('IS371_7') && n('V371') > 1), () => n('P371') > 0.05);
    const wOut_371 = createConductorGroup(() => (on('IS371_7') && n('V371') > 1) || (on('CB371') && on('IS371_1') && n('VbusZone1') > 1), () => n('P371') > 0.05);
    const wLine_371 = createConductorGroup(() => n('V371') > 1, () => n('P371') > 0.05);

    const wBus_372 = createConductorGroup(() => n('VbusZone2') > 1, () => n('P372') > 0.05);
    const wMid_372 = createConductorGroup(() => (on('IS372_2') && n('VbusZone2') > 1) || (on('CB372') && on('IS372_7') && n('V372') > 1), () => n('P372') > 0.05);
    const wOut_372 = createConductorGroup(() => (on('IS372_7') && n('V372') > 1) || (on('CB372') && on('IS372_2') && n('VbusZone2') > 1), () => n('P372') > 0.05);
    const wLine_372 = createConductorGroup(() => n('V372') > 1, () => n('P372') > 0.05);

    for (let ph = 0; ph < 3; ph++) {
      // ĐZ 371
      const b1 = new THREE.Vector3(BUS_X[ph], BUS_Y, Z_BAY[0] + PH_DZ[ph]);
      addWireToGroup(wBus_371, makeCatenaryCurve(b1, is371_1.leftPts[ph], -0.30), 0.048, 2);
      addWireToGroup(wMid_371, makeCatenaryCurve(is371_1.rightPts[ph], cb371.leftPts[ph], 0.16), 0.048, 2);
      addWireToGroup(wOut_371, makeCatenaryCurve(cb371.rightPts[ph], ti371.leftPts[ph], 0.12), 0.048, 1);
      addWireToGroup(wOut_371, makeCatenaryCurve(ti371.rightPts[ph], is371_7.leftPts[ph], 0.14), 0.048, 1);
      const cL1 = makeCatenaryCurve(is371_7.rightPts[ph], gantryTips[0][ph], 0.24);
      addWireToGroup(wLine_371, cL1, 0.048, 2);
      addWireToGroup(wLine_371, makeCatenaryCurve(cL1.getPoint(0.55), cs371.topPts[ph], 0.04), 0.036, 0);

      // ĐZ 372
      const b2 = new THREE.Vector3(BUS_X[ph], BUS_Y, Z_BAY[1] + PH_DZ[ph]);
      addWireToGroup(wBus_372, makeCatenaryCurve(b2, is372_2.leftPts[ph], -0.30), 0.048, 2);
      addWireToGroup(wMid_372, makeCatenaryCurve(is372_2.rightPts[ph], cb372.leftPts[ph], 0.16), 0.048, 2);
      addWireToGroup(wOut_372, makeCatenaryCurve(cb372.rightPts[ph], ti372.leftPts[ph], 0.12), 0.048, 1);
      addWireToGroup(wOut_372, makeCatenaryCurve(ti372.rightPts[ph], is372_7.leftPts[ph], 0.14), 0.048, 1);
      const cL2 = makeCatenaryCurve(is372_7.rightPts[ph], gantryTips[1][ph], 0.24);
      addWireToGroup(wLine_372, cL2, 0.048, 2);
      addWireToGroup(wLine_372, makeCatenaryCurve(cL2.getPoint(0.55), cs372.topPts[ph], 0.04), 0.036, 0);
    }

    // -----------------------------------------------------------------------
    // ĐOẠN 5: 2 CỘT GIÀN THÉP MẠ KẼM XUẤT TUYẾN 35 kV ĐỒNG TRỤC 90° VỚI CỘT CỔNG 371 & 372
    // -----------------------------------------------------------------------
    const GANTRY_PH_Z = PH_DZ.map(dz => dz * 1.8); // Khớp tuyệt đối khoảng cách 3 pha A-B-C của cột cổng (-1.71, 0, +1.71 m)

    function buildTransmissionTower(x, groundY, z, lineCode) {
      const tg = new THREE.Group(); tg.position.set(x, groundY, z);
      const hBody = 12.6;
      const armY = 10.65;
      const bW = 0.88, tW = 0.34;
      const bays = 5;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

      // 4 Đế móng bê tông chân cột
      corners.forEach(([sx, sz]) => {
        const ped = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.54), matDarkConcrete);
        ped.position.set(sx * bW, 0.22, sz * bW); tg.add(ped);
        // 4 Thanh thép góc chính mạ kẽm vát côn từ chân lên đỉnh
        addStrut(tg, new THREE.Vector3(sx * bW, 0.2, sz * bW), new THREE.Vector3(sx * tW, hBody, sz * tW), 0.085, matGalvSteel);
      });

      // Hệ thanh giằng chéo chữ X & vành ngang mạ kẽm 5 tầng trên cả 4 mặt tháp
      for (let i = 0; i < bays; i++) {
        const y0 = 0.2 + (i / bays) * (hBody - 0.2);
        const y1 = 0.2 + ((i + 1) / bays) * (hBody - 0.2);
        const w0 = bW + (tW - bW) * (i / bays);
        const w1 = bW + (tW - bW) * ((i + 1) / bays);
        for (let f = 0; f < 4; f++) {
          const [ax, az] = corners[f];
          const [bx, bz] = corners[(f + 1) % 4];
          const p00 = new THREE.Vector3(ax * w0, y0, az * w0);
          const p10 = new THREE.Vector3(bx * w0, y0, bz * w0);
          const p01 = new THREE.Vector3(ax * w1, y1, az * w1);
          const p11 = new THREE.Vector3(bx * w1, y1, bz * w1);
          addStrut(tg, p00, p11, 0.042, matGalvSteel);
          addStrut(tg, p10, p01, 0.042, matGalvSteel);
          addStrut(tg, p01, p11, 0.048, matGalvSteel);
        }
      }

      // Chóp kim thu sét giàn thép đỉnh cột
      const peakY = hBody + 2.35;
      corners.forEach(([sx, sz]) => {
        addStrut(tg, new THREE.Vector3(sx * tW, hBody, sz * tW), new THREE.Vector3(0, peakY, 0), 0.048, matGalvSteel);
      });
      const lightningRod = new THREE.Mesh(new THREE.ConeGeometry(0.055, 1.4, 6), matAlum);
      lightningRod.position.set(0, peakY + 0.7, 0); tg.add(lightningRod);

      // Xà ngang giàn thép mạ kẽm hướng theo trục Z (song song xà cột cổng) cho 3 pha A-B-C thẳng hàng tuyệt đối
      const armHalfZ = Math.abs(GANTRY_PH_Z[2]) + 0.55; // 2.26 m mỗi bên -> tổng dài 4.52 m
      const armW = 0.24, armH = 0.28;
      for (const sx of [-armW, armW]) {
        for (const sy of [-armH, armH]) {
          const chord = new THREE.Mesh(unitBoxGeo, matGalvSteel);
          chord.position.set(sx, armY + sy, 0);
          chord.scale.set(0.055, 0.055, armHalfZ * 2);
          tg.add(chord);
        }
      }
      const nArmSegs = 6;
      const segDz = (armHalfZ * 2) / nArmSegs;
      for (let i = 0; i < nArmSegs; i++) {
        const z0 = -armHalfZ + i * segDz, z1 = z0 + segDz;
        for (const sx of [-armW, armW]) {
          addStrut(tg, new THREE.Vector3(sx, armY - armH, z0), new THREE.Vector3(sx, armY + armH, z1), 0.036, matGalvSteel);
          addStrut(tg, new THREE.Vector3(sx, armY + armH, z0), new THREE.Vector3(sx, armY - armH, z1), 0.036, matGalvSteel);
        }
        addStrut(tg, new THREE.Vector3(-armW, armY + armH, z0), new THREE.Vector3(armW, armY + armH, z1), 0.034, matGalvSteel);
      }
      // Thanh treo xiên đỡ đầu xà ngang từ đỉnh thân cột xuống 2 đầu xà
      for (const sz of [-armHalfZ + 0.15, armHalfZ - 0.15]) {
        addStrut(tg, new THREE.Vector3(0, hBody - 0.1, sz > 0 ? tW : -tW), new THREE.Vector3(0, armY + armH, sz), 0.046, matGalvSteel);
      }

      // 3 Bộ chuỗi sứ néo ngang + chuỗi sứ treo dẫn vòng chuẩn 35 kV tại đúng tọa độ pha A-B-C của cột cổng
      const inTips = [], outTips = [], dropTips = [];
      GANTRY_PH_Z.forEach(zOff => {
        // Bát treo xà & chuỗi sứ đỡ lèo thẳng đứng
        const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), matAlum);
        yoke.position.set(0, armY - armH - 0.07, zOff); tg.add(yoke);
        const vertIns = createInsulatorColumn(1.18, 0.115, 0.115, 8, 'glass');
        vertIns.position.set(0, armY - armH - 1.26, zOff); tg.add(vertIns);
        addTerminalClamp(tg, 0, armY - armH - 1.30, zOff);

        // 2 Chuỗi sứ néo ngang (hướng -X về cột cổng & hướng +X đi tiếp ra lưới)
        const strainY = armY - 0.10;
        const strainLen = 0.96;
        const insIn = createInsulatorColumn(strainLen, 0.11, 0.11, 8, 'glass');
        insIn.rotation.z = Math.PI / 2;
        insIn.position.set(-armW, strainY, zOff);
        tg.add(insIn);
        addTerminalClamp(tg, -armW - strainLen, strainY, zOff);

        const insOut = createInsulatorColumn(strainLen, 0.11, 0.11, 8, 'glass');
        insOut.rotation.z = -Math.PI / 2;
        insOut.position.set(armW, strainY, zOff);
        tg.add(insOut);
        addTerminalClamp(tg, armW + strainLen, strainY, zOff);

        inTips.push(new THREE.Vector3(x - armW - strainLen, groundY + strainY, z + zOff));
        outTips.push(new THREE.Vector3(x + armW + strainLen, groundY + strainY, z + zOff));
        dropTips.push(new THREE.Vector3(x, groundY + armY - armH - 1.30, z + zOff));
      });

      swGroup.add(tg);

      if (lineCode) {
        const is371 = lineCode === '371';
        registerInteractive(tg, {
          id: 'TOWER_' + lineCode,
          title: `Cột xuất tuyến 35 kV – ĐZ ${lineCode} (${is371 ? 'TC 31' : 'TC 32'})`,
          highlightMat: matGalvSteel,
          getTooltip: () => {
            const v = n(is371 ? 'V371' : 'V372');
            const p = n(is371 ? 'P371' : 'P372');
            const iA = n(is371 ? 'I371' : 'I372');
            return {
              status: `${fx(v, 1)} kV · ${fx(p, 2)} MW · ${fx(iA, 1)} A`,
              cls: v > 1 ? 'on' : 'off',
              action: 'Cột giàn thép mạ kẽm néo thẳng 35 kV đồng trục cột cổng'
            };
          },
          onClick: () => {}
        }, { w: 2.6, h: hBody + 2.5, d: armHalfZ * 2 + 0.6, x: 0, y: (hBody + 1.5) * 0.5, z: 0 });
      }
      return { inTips, outTips, dropTips };
    }

    // Đặt 2 cột xuất tuyến đầu tiên đồng trục 90° với tâm 2 khoang cột cổng (cùng Z_BAY[0] = 19.6 và Z_BAY[1] = 29.6, tịnh tiến thẳng theo +X)
    const tower371 = buildTransmissionTower(72.0, 5.55, Z_BAY[0], '371');
    const tower372 = buildTransmissionTower(72.0, 5.55, Z_BAY[1], '372');

    for (let ph = 0; ph < 3; ph++) {
      // 6 Sợi dây xuất tuyến đi song song, thẳng tắp 90° từ chuỗi sứ cột cổng (X = 45.0) tới chuỗi sứ néo cột đầu tiên (X = 72.0)
      addWireToGroup(wLine_371, makeCatenaryCurve(gantryTips[0][ph], tower371.inTips[ph], 1.15), 0.054, 4);
      addWireToGroup(wLine_372, makeCatenaryCurve(gantryTips[1][ph], tower372.inTips[ph], 1.15), 0.054, 4);

      // Dây lèo vòng mềm nối qua gầm xà giữa 2 chuỗi sứ néo vào/ra trên từng pha
      addWireToGroup(wLine_371, new THREE.QuadraticBezierCurve3(tower371.inTips[ph], tower371.dropTips[ph], tower371.outTips[ph]), 0.044, 0);
      addWireToGroup(wLine_372, new THREE.QuadraticBezierCurve3(tower372.inTips[ph], tower372.dropTips[ph], tower372.outTips[ph]), 0.044, 0);

      // Nhịp tiếp nối vươn thẳng song song ra lưới hệ thống 35 kV (cùng tọa độ Z tuyệt đối trên cả 6 pha)
      const far1 = new THREE.Vector3(106.0, 16.4, tower371.outTips[ph].z);
      const far2 = new THREE.Vector3(106.0, 16.4, tower372.outTips[ph].z);
      addWireToGroup(wLine_371, makeCatenaryCurve(tower371.outTips[ph], far1, 1.35), 0.052, 3);
      addWireToGroup(wLine_372, makeCatenaryCurve(tower372.outTips[ph], far2, 1.35), 0.052, 3);
    }

    // -----------------------------------------------------------------------
    // 4.8b VECTOR MŨI TÊN HƯỚNG DÒNG CÔNG SUẤT P (CAM) & Q (XANH LƠ) TRÊN THANH DẪN & ĐZ 35 kV
    // -----------------------------------------------------------------------
    const matArrowP = new THREE.MeshStandardMaterial({
      color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.85, roughness: 0.25, metalness: 0.2
    });
    const matArrowQ = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.85, roughness: 0.25, metalness: 0.2
    });
    const arrowHeadGeo = new THREE.ConeGeometry(0.28, 0.72, 10);
    const arrowTailGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.62, 8);
    function makePowerArrowMesh(mat) {
      const ag = new THREE.Group();
      const head = new THREE.Mesh(arrowHeadGeo, mat);
      head.position.y = 0.36; ag.add(head);
      const tail = new THREE.Mesh(arrowTailGeo, mat);
      tail.position.y = -0.31; ag.add(tail);
      ag.visible = false;
      swGroup.add(ag);
      return ag;
    }

    const powerFlowTracks = [];
    function addPowerFlowTrack(points, valFn, isQ, count, offsetVec) {
      const off = offsetVec || new THREE.Vector3(0, 0.52, 0);
      const curvePts = points.map(p => p.clone().add(off));
      const curve = new THREE.CatmullRomCurve3(curvePts);
      const arrows = [];
      const mat = isQ ? matArrowQ : matArrowP;
      for (let i = 0; i < count; i++) {
        arrows.push({ mesh: makePowerArrowMesh(mat), u: i / count });
      }
      powerFlowTracks.push({ curve, valFn, arrows, isQ });
    }

    // Tuyến cầu thanh dẫn 6,3 kV: H1 -> Tủ MC 601 -> Xuyên tường -> 1T và H2 -> Tủ MC 602 -> Xuyên tường -> 2T
    const bus1Pts = [
      new THREE.Vector3(7.45, 8.20, -8.0), new THREE.Vector3(9.75, 8.20, -3.86),
      new THREE.Vector3(10.72, 10.25, -3.86), new THREE.Vector3(10.72, 10.25, Z_BAY[0]),
      new THREE.Vector3(16.25, 10.05, Z_BAY[0])
    ];
    const bus2Pts = [
      new THREE.Vector3(7.45, 8.20, 8.0), new THREE.Vector3(9.75, 8.20, 3.86),
      new THREE.Vector3(11.62, 10.25, 3.86), new THREE.Vector3(11.62, 10.25, Z_BAY[1]),
      new THREE.Vector3(16.25, 10.05, Z_BAY[1])
    ];
    addPowerFlowTrack(bus1Pts, () => n('G1.Pload'), false, 5, new THREE.Vector3(0, 0.55, -0.32));
    addPowerFlowTrack(bus1Pts, () => n('G1.Qload'), true, 5, new THREE.Vector3(0, 0.55, 0.32));
    addPowerFlowTrack(bus2Pts, () => n('G2.Pload'), false, 5, new THREE.Vector3(0, 0.55, -0.32));
    addPowerFlowTrack(bus2Pts, () => n('G2.Qload'), true, 5, new THREE.Vector3(0, 0.55, 0.32));

    // Tuyến ngăn MBA 35 kV: T1 -> MC 331 -> Thanh cái I & T2 -> MC 332 -> Thanh cái II
    const tr1Pts = [
      new THREE.Vector3(18.32, 10.95, Z_BAY[0]), new THREE.Vector3(22.35, 9.6, Z_BAY[0]),
      new THREE.Vector3(26.20, 9.8, Z_BAY[0]), new THREE.Vector3(BUS_X[1], BUS_Y, Z_BAY[0])
    ];
    const tr2Pts = [
      new THREE.Vector3(18.32, 10.95, Z_BAY[1]), new THREE.Vector3(22.35, 9.6, Z_BAY[1]),
      new THREE.Vector3(26.20, 9.8, Z_BAY[1]), new THREE.Vector3(BUS_X[1], BUS_Y, Z_BAY[1])
    ];
    addPowerFlowTrack(tr1Pts, () => (on('CB331') && on('IS331_1')) ? n('G1.Pload') : 0, false, 3, new THREE.Vector3(0, 0.58, -0.45));
    addPowerFlowTrack(tr1Pts, () => (on('CB331') && on('IS331_1')) ? n('G1.Qload') : 0, true, 3, new THREE.Vector3(0, 0.58, 0.45));
    addPowerFlowTrack(tr2Pts, () => (on('CB332') && on('IS332_2')) ? n('G2.Pload') : 0, false, 3, new THREE.Vector3(0, 0.58, -0.45));
    addPowerFlowTrack(tr2Pts, () => (on('CB332') && on('IS332_2')) ? n('G2.Qload') : 0, true, 3, new THREE.Vector3(0, 0.58, 0.45));

    // Tuyến đường dây xuất tuyến 35 kV ĐZ 371 & ĐZ 372 (thẳng góc 90° đồng trục từ cột cổng -> cột xuất tuyến -> lưới)
    const line371Pts = [
      new THREE.Vector3(BUS_X[1], BUS_Y, Z_BAY[0]),
      new THREE.Vector3(36.10, 9.8, Z_BAY[0]),
      new THREE.Vector3(45.0, 14.52, Z_BAY[0]),
      new THREE.Vector3(58.0, 14.20, Z_BAY[0]),
      new THREE.Vector3(72.0, 16.10, Z_BAY[0]),
      new THREE.Vector3(104.0, 16.35, Z_BAY[0])
    ];
    const line372Pts = [
      new THREE.Vector3(BUS_X[1], BUS_Y, Z_BAY[1]),
      new THREE.Vector3(36.10, 9.8, Z_BAY[1]),
      new THREE.Vector3(45.0, 14.52, Z_BAY[1]),
      new THREE.Vector3(58.0, 14.20, Z_BAY[1]),
      new THREE.Vector3(72.0, 16.10, Z_BAY[1]),
      new THREE.Vector3(104.0, 16.35, Z_BAY[1])
    ];
    addPowerFlowTrack(line371Pts, () => (on('CB371') && on('IS371_1') && on('IS371_7')) ? n('P371') : 0, false, 6, new THREE.Vector3(0, 0.72, -0.65));
    addPowerFlowTrack(line371Pts, () => (on('CB371') && on('IS371_1') && on('IS371_7')) ? n('Q371') : 0, true, 6, new THREE.Vector3(0, 0.72, 0.65));
    addPowerFlowTrack(line372Pts, () => (on('CB372') && on('IS372_2') && on('IS372_7')) ? n('P372') : 0, false, 6, new THREE.Vector3(0, 0.72, -0.65));
    addPowerFlowTrack(line372Pts, () => (on('CB372') && on('IS372_2') && on('IS372_7')) ? n('Q372') : 0, true, 6, new THREE.Vector3(0, 0.72, 0.65));

    // -----------------------------------------------------------------------
    // 4.8c HỆ THỐNG HIỆU ỨNG HỒ QUANG ĐIỆN XANH TRẮNG + CỘT KHÓI SỰ CỐ NGẮN MẠCH TRONG 3D
    // -----------------------------------------------------------------------
    const faultEmitters = [];
    const darkSmokeTex = makeGlowTexture('rgba(30,41,59,0.92)', 'rgba(71,85,105,0.28)');
    function createFaultArcEmitter() {
      const grp = new THREE.Group();
      grp.visible = false;
      scene.add(grp);

      const coreMat = new THREE.MeshBasicMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.95 });
      const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 12), coreMat);
      grp.add(coreSphere);

      const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, depthWrite: false });
      const haloSphere = new THREE.Mesh(new THREE.SphereGeometry(1.45, 12, 12), haloMat);
      grp.add(haloSphere);

      const arcLight = new THREE.PointLight(0xbae6fd, 0, 26);
      grp.add(arcLight);

      const bolts = [];
      const boltMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.95 });
      for (let b = 0; b < 6; b++) {
        const pts = new Float32Array(7 * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const line = new THREE.Line(geo, boltMat);
        grp.add(line);
        bolts.push({ line, geo, pts });
      }

      const sCnt = 56;
      const sPos = new Float32Array(sCnt * 3);
      const sLife = new Float32Array(sCnt);
      const sSeed = new Float32Array(sCnt);
      for (let i = 0; i < sCnt; i++) {
        sLife[i] = Math.random();
        sSeed[i] = Math.random() * Math.PI * 2;
      }
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      const smokeMat = new THREE.PointsMaterial({
        size: 2.35, map: darkSmokeTex, transparent: true, opacity: 0.86, depthWrite: false
      });
      const smoke = new THREE.Points(sGeo, smokeMat);
      grp.add(smoke);

      return { grp, coreSphere, coreMat, haloSphere, haloMat, arcLight, bolts, boltMat, smoke, smokeMat, sCnt, sPos, sLife, sSeed, sGeo };
    }
    for (let i = 0; i < 6; i++) faultEmitters.push(createFaultArcEmitter());

    // Bảng toạ độ 3D chính xác của từng Dao cách ly & Dao nối đất (đặt hồ quang đúng tại con dao sự cố)
    const SWITCH_POS_MAP = {
      '331-1':  new THREE.Vector3(22.35, 9.25, Z_BAY[0]),
      '332-2':  new THREE.Vector3(22.35, 9.25, Z_BAY[1]),
      '371-1':  new THREE.Vector3(32.85, 9.25, Z_BAY[0]),
      '371-7':  new THREE.Vector3(40.35, 9.25, Z_BAY[0]),
      '372-2':  new THREE.Vector3(32.85, 9.25, Z_BAY[1]),
      '372-7':  new THREE.Vector3(40.35, 9.25, Z_BAY[1]),
      '312-1':  new THREE.Vector3(BUS_X[1], BUS_Y, 24.60),
      '612-1':  new THREE.Vector3(9.75, 8.00, -1.30),
      '612-2':  new THREE.Vector3(9.75, 8.00,  1.30),
      '1QE':    new THREE.Vector3(9.75, 8.00, -4.98),
      '2QE':    new THREE.Vector3(9.75, 8.00,  4.98),
      '1QE1':   new THREE.Vector3(9.75, 8.00, -0.55),
      '2QE1':   new THREE.Vector3(9.75, 8.00,  0.55),
      '331-15': new THREE.Vector3(21.15, 9.60, Z_BAY[0]),
      '331-14': new THREE.Vector3(23.55, 9.30, Z_BAY[0]),
      '332-25': new THREE.Vector3(21.15, 9.60, Z_BAY[1]),
      '332-24': new THREE.Vector3(23.55, 9.30, Z_BAY[1]),
      '371-15': new THREE.Vector3(34.45, 9.30, Z_BAY[0]),
      '371-75': new THREE.Vector3(39.05, 9.30, Z_BAY[0]),
      '371-76': new THREE.Vector3(41.80, 10.10, Z_BAY[0]),
      '372-25': new THREE.Vector3(34.45, 9.30, Z_BAY[1]),
      '372-75': new THREE.Vector3(39.05, 9.30, Z_BAY[1]),
      '372-76': new THREE.Vector3(41.80, 10.10, Z_BAY[1])
    };
    const SWITCH_CODES_SORTED = Object.keys(SWITCH_POS_MAP).sort((a, b) => b.length - a.length);

    function extractSwitchFromArcMsg(txt) {
      const s = String(txt || '');
      let m = s.match(/(?:dao\s+nối\s+đất|dao\s+tiếp\s+địa|dtđ)\s+([0-9]{3}[-_][0-9]{1,2}|[12]qe1?)/i);
      if (!m) m = s.match(/(?:dao\s+cách\s+ly|dcl|dao)\s+([0-9]{3}[-_][0-9]{1,2}|[12]qe1?)/i);
      if (m) {
        const code = m[1].toUpperCase().replace(/_/g, '-');
        if (SWITCH_POS_MAP[code]) return { code, pos: SWITCH_POS_MAP[code].clone() };
      }
      for (let i = 0; i < SWITCH_CODES_SORTED.length; i++) {
        const code = SWITCH_CODES_SORTED[i];
        const re = new RegExp('(?:^|[^0-9a-zA-Z-])' + code.replace('-', '[-_]') + '(?:$|[^0-9a-zA-Z-])', 'i');
        if (re.test(s)) return { code, pos: SWITCH_POS_MAP[code].clone() };
      }
      return null;
    }

    function extractSuppressNode(txt) {
      const m = String(txt || '').match(/ngắn\s+mạch\s+3\s+pha\s+tại\s+([^–—\n]+)/i);
      if (!m) return '';
      const node = m[1].trim().toLowerCase();
      return (node && node !== 'dao') ? node : '';
    }

    const ARC_TOTAL_DUR = 4.2;   // Giữ hiệu ứng tối thiểu 4 giây (khói còn tới > 4s)
    const ARC_PEAK_DUR = 1.5;    // Hồ quang sáng mạnh 1,5s đầu
    const ARC_FADE_END = 2.6;    // Hồ quang tắt dần tới 2,6s
    const arcBursts = [];        // { code, pos, text, suppressNode, startMs }
    let autoFlyArc = true;
    try { autoFlyArc = localStorage.getItem('hps3dAutoFlyArc') !== '0'; } catch (e) { }
    let arcAudioCtx = null;
    let lastArcBangMs = 0;

    function playArcBangSound() {
      if (!(typeof soundOn !== 'undefined' && soundOn)) return;
      const nowMs = Date.now();
      if (nowMs - lastArcBangMs < 350) return;
      lastArcBangMs = nowMs;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = (typeof actx !== 'undefined' && actx) ? actx : (arcAudioCtx || (arcAudioCtx = new AC()));
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });
        const t0 = ctx.currentTime;
        // Tiếng nổ trầm ngắn
        const osc = ctx.createOscillator();
        const gOsc = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(155, t0);
        osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.26);
        gOsc.gain.setValueAtTime(0.001, t0);
        gOsc.gain.linearRampToValueAtTime(0.50, t0 + 0.008);
        gOsc.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
        osc.connect(gOsc).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.29);
        // Tiếng rít/nổ hồ quang cao áp (nhiễu lọc băng thông 0.42s)
        const dur = 0.42;
        const len = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const env = Math.pow(1 - i / len, 1.5);
          const crackle = (i % 97 < 14) ? 1.35 : 0.75;
          ch[i] = (Math.random() * 2 - 1) * env * crackle;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1350, t0);
        bp.Q.setValueAtTime(0.75, t0);
        const gNoise = ctx.createGain();
        gNoise.gain.setValueAtTime(0.48, t0);
        gNoise.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(bp).connect(gNoise).connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
      } catch (e) { }
    }

    function flyCameraToArc(pos) {
      if (!autoFlyArc || !pos) return;
      camCtrl.target.copy(pos);
      const indoor = pos.x < 14;
      const wantTheta = indoor ? 0.52 : 0.88;
      const twoPi = Math.PI * 2;
      let dTheta = (wantTheta - camCtrl.curTheta) % twoPi;
      if (dTheta > Math.PI) dTheta -= twoPi;
      if (dTheta < -Math.PI) dTheta += twoPi;
      camCtrl.theta = camCtrl.curTheta + dTheta;
      camCtrl.phi = indoor ? 1.12 : 1.06;
      camCtrl.dist = indoor ? 13.0 : 15.5;
      Object.keys(presetBtns).forEach(k => presetBtns[k].classList.remove('act'));
    }

    function triggerArcBurst(text, forcedCode, forcedPos) {
      const sw = forcedPos ? { code: forcedCode || '', pos: forcedPos.clone() } : extractSwitchFromArcMsg(text);
      if (!sw) return;
      const suppressNode = extractSuppressNode(text);
      const nowPerf = performance.now();
      const existing = arcBursts.find(b => b.code && b.code === sw.code);
      if (existing) {
        existing.pos.copy(sw.pos);
        existing.text = text || existing.text;
        existing.suppressNode = suppressNode || existing.suppressNode;
        existing.startMs = nowPerf;
      } else {
        arcBursts.push({ code: sw.code, pos: sw.pos, text: text || '', suppressNode, startMs: nowPerf });
        if (arcBursts.length > 4) arcBursts.shift();
      }
      playArcBangSound();
      flyCameraToArc(sw.pos);
    }

    function escHtml3d(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function mapFaultTextToPos(txt) {
      const s = String(txt || '').toLowerCase();
      if (s.includes('đầu cực mf1') || s.includes('1qe')) return new THREE.Vector3(4.0, 9.2, -8.0);
      if (s.includes('đầu cực mf2') || s.includes('2qe')) return new THREE.Vector3(4.0, 9.2, 8.0);
      if (s.includes('6,3 kv mf1') || s.includes('601')) return new THREE.Vector3(9.75, 8.4, -3.86);
      if (s.includes('6,3 kv mf2') || s.includes('602')) return new THREE.Vector3(9.75, 8.4, 3.86);
      if (s.includes('td61') || s.includes('td6')) return new THREE.Vector3(10.80, 8.0, 24.60);
      if (s.includes('td32') || s.includes('td35')) return new THREE.Vector3(32.55, 8.2, 32.95);
      if (s.includes('331-15') || s.includes('t1') || s.includes('mba 1')) return new THREE.Vector3(17.4, 10.6, Z_BAY[0]);
      if (s.includes('331-14') || s.includes('331')) return new THREE.Vector3(26.2, 9.7, Z_BAY[0]);
      if (s.includes('332-25') || s.includes('332-15') || s.includes('t2') || s.includes('mba 2')) return new THREE.Vector3(17.4, 10.6, Z_BAY[1]);
      if (s.includes('332-24') || s.includes('332-14') || s.includes('332')) return new THREE.Vector3(26.2, 9.7, Z_BAY[1]);
      if (s.includes('c31') || s.includes('312') || s.includes('321') || s.includes('thanh cái 35')) return new THREE.Vector3(29.4, 11.8, 20.5);
      if (s.includes('c32')) return new THREE.Vector3(29.4, 11.8, 28.5);
      if (s.includes('371-76') || s.includes('đường dây 371')) return new THREE.Vector3(41.8, 10.2, Z_BAY[0]);
      if (s.includes('371')) return new THREE.Vector3(36.1, 9.7, Z_BAY[0]);
      if (s.includes('372-76') || s.includes('đường dây 372')) return new THREE.Vector3(41.8, 10.2, Z_BAY[1]);
      if (s.includes('372')) return new THREE.Vector3(36.1, 9.7, Z_BAY[1]);
      if (s.includes('diesel') || s.includes('0,4 kv')) return new THREE.Vector3(2.8, 8.2, 29.5);
      return new THREE.Vector3(29.4, 11.8, 24.6);
    }

    // Bảng kiểm tra đóng nhầm dao tiếp địa khi đoạn mạch đang mang điện -> tạo hồ quang ngay tại trụ dao tiếp địa!
    const liveGroundFaultChecks = [
      { key: 'GS1QE', label: 'Đóng nhầm DTĐ 1QE khi MF1 mang điện', liveFn: () => n('G1.Vgen') > 0.5 || n('G1.V60') > 0.5, pos: new THREE.Vector3(9.75, 8.0, -4.98) },
      { key: 'GS2QE', label: 'Đóng nhầm DTĐ 2QE khi MF2 mang điện', liveFn: () => n('G2.Vgen') > 0.5 || n('G2.V60') > 0.5, pos: new THREE.Vector3(9.75, 8.0, 4.98) },
      { key: 'GS331_15', label: 'Đóng nhầm DTĐ 331-15 khi mang điện', liveFn: wT1_IS.isLiveFn, pos: new THREE.Vector3(21.15, 9.6, Z_BAY[0]) },
      { key: 'GS331_14', label: 'Đóng nhầm DTĐ 331-14 khi mang điện', liveFn: wIS_CB331.isLiveFn, pos: new THREE.Vector3(23.55, 9.3, Z_BAY[0]) },
      { key: 'GS332_25', label: 'Đóng nhầm DTĐ 332-25 khi mang điện', liveFn: wT2_IS.isLiveFn, pos: new THREE.Vector3(21.15, 9.6, Z_BAY[1]) },
      { key: 'GS332_24', label: 'Đóng nhầm DTĐ 332-24 khi mang điện', liveFn: wIS_CB332.isLiveFn, pos: new THREE.Vector3(23.55, 9.3, Z_BAY[1]) },
      { key: 'GS371_15', label: 'Đóng nhầm DTĐ 371-15 khi mang điện', liveFn: wMid_371.isLiveFn, pos: new THREE.Vector3(34.45, 9.3, Z_BAY[0]) },
      { key: 'GS371_75', label: 'Đóng nhầm DTĐ 371-75 khi mang điện', liveFn: wOut_371.isLiveFn, pos: new THREE.Vector3(39.05, 9.3, Z_BAY[0]) },
      { key: 'GS371_76', label: 'Đóng nhầm DTĐ 371-76 khi mang điện', liveFn: wLine_371.isLiveFn, pos: new THREE.Vector3(41.80, 10.1, Z_BAY[0]) },
      { key: 'GS372_25', label: 'Đóng nhầm DTĐ 372-25 khi mang điện', liveFn: wMid_372.isLiveFn, pos: new THREE.Vector3(34.45, 9.3, Z_BAY[1]) },
      { key: 'GS372_75', label: 'Đóng nhầm DTĐ 372-75 khi mang điện', liveFn: wOut_372.isLiveFn, pos: new THREE.Vector3(39.05, 9.3, Z_BAY[1]) },
      { key: 'GS372_76', label: 'Đóng nhầm DTĐ 372-76 khi mang điện', liveFn: wLine_372.isLiveFn, pos: new THREE.Vector3(41.80, 10.1, Z_BAY[1]) }
    ];

    // -----------------------------------------------------------------------
    // 4.9 BỘ ĐIỀU KHIỂN CAMERA MƯỢT MÀ (ISOMETRIC DAYLIGHT PRESETS)
    // -----------------------------------------------------------------------
    const PRESETS = [
      { id: 'overview', label: 'Toàn cảnh', target: [12, 6.5, 8], theta: 0.78, phi: 1.04, dist: 68 },
      { id: 'g1', label: 'Tổ máy H1', target: [4, 5.2, -8], theta: 0.32, phi: 1.16, dist: 15.8 },
      { id: 'g2', label: 'Tổ máy H2', target: [4, 5.2, 8], theta: 0.36, phi: 1.16, dist: 15.8 },
      { id: 'intake', label: 'Cửa nhận nước & Đập', target: [-15, 10.5, -5], theta: 2.38, phi: 1.14, dist: 38 },
      { id: 'aux', label: 'Hệ thống phụ trợ & Diesel', target: [4, 7.2, 24.5], theta: 1.15, phi: 1.06, dist: 24 },
      { id: 'substation', label: 'Trạm biến áp 35 kV', target: [30.5, 8.6, 24.4], theta: 0.92, phi: 1.12, dist: 30 },
      { id: 'top', label: 'Nhìn từ trên xuống', target: [14, 5.0, 6], theta: 1.57, phi: 0.14, dist: 84 }
    ];

    const camCtrl = {
      target: new THREE.Vector3(12, 6.5, 8), curTarget: new THREE.Vector3(12, 6.5, 8),
      theta: 0.78, curTheta: 0.78, phi: 1.04, curPhi: 1.04, dist: 68, curDist: 68,
      dragging: false, mode: 'orbit', lastX: 0, lastY: 0,
      touches: new Map(), pinchDist: 0, pinchMidX: 0, pinchMidY: 0
    };

    let xrayOn = false;
    let labelsOn = true; // Bật sẵn mặc định theo yêu cầu!
    let fxOn = true;
    let autoRotate = false;
    let activePreset = 'overview';

    function applyCameraImmediate() {
      const sp = Math.sin(camCtrl.curPhi), cp = Math.cos(camCtrl.curPhi);
      camera.position.set(
        camCtrl.curTarget.x + camCtrl.curDist * sp * Math.cos(camCtrl.curTheta),
        camCtrl.curTarget.y + camCtrl.curDist * cp,
        camCtrl.curTarget.z + camCtrl.curDist * sp * Math.sin(camCtrl.curTheta)
      );
      camera.lookAt(camCtrl.curTarget);
    }
    applyCameraImmediate();

    function panCamera(dx, dy) {
      const factor = camCtrl.curDist * 0.00145;
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();
      camCtrl.target.addScaledVector(right, -dx * factor);
      camCtrl.target.addScaledVector(up, dy * factor);
    }

    // -----------------------------------------------------------------------
    // 4.9b BỘ RAYCASTER 3D (PHÂN BIỆT KÉO CAMERA > 5px VÀ CLICK CHỌN < 5px + HOVER + TOOLTIP)
    // -----------------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const tooltipEl = h('div', { class: 's3d-tooltip' }, wrap);
    let hoveredItem = null;
    let prevHighlightMat = null;
    let prevHighlightEmissive = 0;

    function pickAtClientXY(clientX, clientY) {
      const rect = dom.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(pickMeshes, false);
      let first = null;
      for (let i = 0; i < hits.length; i++) {
        const it = hits[i].object.userData && hits[i].object.userData.pickItem;
        if (!it) continue;
        if (!first) first = it;
        if (it.parentId && it.parentId === first.id) return it;
      }
      return first;
    }

    function clearHoverVisual() {
      if (prevHighlightMat) {
        prevHighlightMat.emissive.setHex(prevHighlightEmissive);
        prevHighlightMat = null;
      }
      hoveredItem = null;
      hoverHighlightGroup.visible = false;
      dom.classList.remove('s3d-pointer');
      tooltipEl.style.display = 'none';
    }

    function updateHoverAt(clientX, clientY) {
      const it = pickAtClientXY(clientX, clientY);
      if (it !== hoveredItem) {
        if (prevHighlightMat) {
          prevHighlightMat.emissive.setHex(prevHighlightEmissive);
          prevHighlightMat = null;
        }
        hoveredItem = it;
        if (it) {
          dom.classList.add('s3d-pointer');
          if (it.highlightMat && it.highlightMat.emissive) {
            prevHighlightMat = it.highlightMat;
            prevHighlightEmissive = it.highlightMat.emissive.getHex();
            it.highlightMat.emissive.setHex(0x38bdf8);
          }
          hoverBox3.setFromObject(it.rootGroup);
          if (!hoverBox3.isEmpty()) {
            hoverBox3.getSize(hoverSize);
            hoverBox3.getCenter(hoverCenter);
            hoverHighlightGroup.position.copy(hoverCenter);
            hoverHighlightGroup.scale.set(
              Math.max(0.4, hoverSize.x + 0.35),
              Math.max(0.4, hoverSize.y + 0.35),
              Math.max(0.4, hoverSize.z + 0.35)
            );
            hoverHighlightGroup.visible = true;
          }
        } else {
          hoverHighlightGroup.visible = false;
          dom.classList.remove('s3d-pointer');
        }
      }
      if (hoveredItem) {
        const tt = hoveredItem.getTooltip();
        tooltipEl.innerHTML =
          `<b>${hoveredItem.title}</b>` +
          `<span class="tt-st ${tt.cls || ''}">${tt.status}</span>` +
          `<span class="tt-act">${tt.action}</span>`;
        const wRect = wrap.getBoundingClientRect();
        const tx = Math.min(wRect.width - 280, Math.max(10, clientX - wRect.left + 16));
        const ty = Math.min(wRect.height - 78, Math.max(10, clientY - wRect.top - 12));
        tooltipEl.style.left = tx + 'px';
        tooltipEl.style.top = ty + 'px';
        tooltipEl.style.display = 'block';
      } else {
        tooltipEl.style.display = 'none';
      }
    }

    const ptrClick = { active: false, downX: 0, downY: 0, moved: 0, multi: false, button: 0 };
    const dom = renderer.domElement;
    dom.addEventListener('contextmenu', e => e.preventDefault());
    dom.addEventListener('pointerleave', () => { if (!camCtrl.dragging) clearHoverVisual(); });
    dom.addEventListener('pointerdown', e => {
      dom.setPointerCapture(e.pointerId);
      camCtrl.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (camCtrl.touches.size === 1) {
        camCtrl.dragging = true;
        camCtrl.mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'orbit';
        camCtrl.lastX = e.clientX; camCtrl.lastY = e.clientY;
        ptrClick.active = true; ptrClick.downX = e.clientX; ptrClick.downY = e.clientY;
        ptrClick.moved = 0; ptrClick.multi = false; ptrClick.button = e.button;
      } else if (camCtrl.touches.size === 2) {
        ptrClick.multi = true;
        const pts = Array.from(camCtrl.touches.values());
        camCtrl.pinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        camCtrl.pinchMidX = (pts[0].x + pts[1].x) * 0.5;
        camCtrl.pinchMidY = (pts[0].y + pts[1].y) * 0.5;
      }
    });
    dom.addEventListener('pointermove', e => {
      if (!camCtrl.touches.has(e.pointerId)) {
        // Rê chuột (không bấm giữ): cập nhật Hover Highlight + Tooltip
        if (e.pointerType === 'mouse' && !camCtrl.dragging) updateHoverAt(e.clientX, e.clientY);
        return;
      }
      camCtrl.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (camCtrl.touches.size === 2) {
        ptrClick.multi = true;
        const pts = Array.from(camCtrl.touches.values());
        const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const mx = (pts[0].x + pts[1].x) * 0.5, my = (pts[0].y + pts[1].y) * 0.5;
        if (camCtrl.pinchDist > 0) camCtrl.dist = Math.max(8, Math.min(145, camCtrl.dist * (camCtrl.pinchDist / Math.max(10, d))));
        panCamera(mx - camCtrl.pinchMidX, my - camCtrl.pinchMidY);
        camCtrl.pinchDist = d; camCtrl.pinchMidX = mx; camCtrl.pinchMidY = my;
        return;
      }
      if (!camCtrl.dragging) return;
      const dx = e.clientX - camCtrl.lastX, dy = e.clientY - camCtrl.lastY;
      camCtrl.lastX = e.clientX; camCtrl.lastY = e.clientY;
      if (ptrClick.active) {
        ptrClick.moved = Math.max(ptrClick.moved, Math.hypot(e.clientX - ptrClick.downX, e.clientY - ptrClick.downY));
      }
      if (ptrClick.moved >= 5) {
        if (hoveredItem) clearHoverVisual();
        if (camCtrl.mode === 'pan') panCamera(dx, dy);
        else {
          camCtrl.theta += dx * 0.0065;
          camCtrl.phi = Math.max(0.08, Math.min(Math.PI * 0.485, camCtrl.phi - dy * 0.006));
        }
      }
    });
    function releasePointer(e, isCancel) {
      const wasClick = !isCancel && ptrClick.active && !ptrClick.multi && ptrClick.moved < 5 && (ptrClick.button === 0 || e.pointerType !== 'mouse');
      camCtrl.touches.delete(e.pointerId);
      if (camCtrl.touches.size === 0) {
        camCtrl.dragging = false;
        ptrClick.active = false;
      } else if (camCtrl.touches.size === 1) {
        const rem = Array.from(camCtrl.touches.values())[0];
        camCtrl.lastX = rem.x; camCtrl.lastY = rem.y;
      }
      if (wasClick) {
        const picked = pickAtClientXY(e.clientX, e.clientY);
        if (picked && typeof picked.onClick === 'function') {
          picked.onClick();
        }
      }
    }
    dom.addEventListener('pointerup', e => releasePointer(e, false));
    dom.addEventListener('pointercancel', e => releasePointer(e, true));
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      camCtrl.dist = Math.max(8, Math.min(145, camCtrl.dist * (e.deltaY > 0 ? 1.09 : 0.91)));
    }, { passive: false });

    function setXray(val) {
      xrayOn = !!val;
      xrayMaterials.forEach(item => {
        item.mat.transparent = xrayOn || item.normalTransparent;
        item.mat.opacity = xrayOn ? item.xrayOpacity : item.normalOpacity;
        item.mat.depthWrite = xrayOn ? false : !item.normalTransparent;
        item.mat.needsUpdate = true;
      });
    }

    // -----------------------------------------------------------------------
    // 4.10 NHÃN THIẾT BỊ 3D BẬT SẴN (ĐỦ 11 HẠNG MỤC TRỌNG ĐIỂM)
    // -----------------------------------------------------------------------
    let focusedUnitNo = 1;
    const focusG = () => 'G' + focusedUnitNo + '.';
    const worldLabels = [
      { id: 'intake', pos: new THREE.Vector3(-18.5, 25.0, 0), html: () => `<b>Cửa nhận nước (Lưới rác & Giếng hơi)</b><span class="v">H = ${fx(n('HeadHigh'), 1)} m · <span class="${on('IntakeGate') ? 'st-run' : 'st-on'}">${on('IntakeGate') ? 'MỞ' : 'ĐÓNG'}</span></span>` },
      { id: 'h1', pos: new THREE.Vector3(4, 15.0, -8), html: () => `<b>Tổ máy H1 (8 MW · 214,3 v/ph)</b><span class="v">${fx(n('G1.Pload'), 2)} MW · ${fx(n('G1.speed'), 1)} v/ph · GV ${fx(n('G1.GV'), 0)}%</span>` },
      { id: 'h2', pos: new THREE.Vector3(4, 15.0, 8), html: () => `<b>Tổ máy H2 (8 MW · 214,3 v/ph)</b><span class="v">${fx(n('G2.Pload'), 2)} MW · ${fx(n('G2.speed'), 1)} v/ph · GV ${fx(n('G2.GV'), 0)}%</span>` },
      // 6 nhãn chi tiết cụm tuabin Kaplan & hệ thống phanh (tự gắn theo H1/H2 gần camera, hiện rõ khi cận cảnh hoặc X-Ray)
      { id: 'oilhead', unitFocus: true, localOff: [0.55, 13.55, 0.75], detailMaxDist: 48, pos: new THREE.Vector3(4.55, 13.55, -7.25), html: () => `<b>Bộ phân phối dầu</b><span class="v">H${focusedUnitNo} · Dầu ĐT ${fx(n(focusG() + 'oilMPa'), 2)} MPa</span>` },
      { id: 'braketrack', unitFocus: true, localOff: [1.5, 7.25, -1.85], detailMaxDist: 46, pos: new THREE.Vector3(5.5, 7.25, -9.85), html: () => `<b>Vành phanh</b><span class="v">H${focusedUnitNo} · ${fx(n(focusG() + 'speed'), 1)} v/ph</span>` },
      { id: 'brakejacks', unitFocus: true, localOff: [1.5, 6.45, 1.9], detailMaxDist: 46, pos: new THREE.Vector3(5.5, 6.45, -6.1), html: () => {
        const g = focusG();
        const br = S[g + 'airBrake'] !== undefined ? !on(g + 'airBrake') : false;
        return `<b>Kích phanh khí nén (6 bộ)</b><span class="v"><span class="${br ? 'st-on' : 'st-off'}">${br ? 'ĐANG PHANH' : 'Nhả phanh'}</span> · Ngưỡng 30% nđm</span>`;
      } },
      { id: 'bladeservo', unitFocus: true, localOff: [0.65, 1.35, -1.15], detailMaxDist: 44, pos: new THREE.Vector3(4.65, 1.35, -9.15), html: () => `<b>Servomotor cánh BXCT</b><span class="v">H${focusedUnitNo} · Cánh ${fx(n(focusG() + 'blade'), 1)}%</span>` },
      { id: 'trunnion', unitFocus: true, localOff: [1.25, 0.15, -0.55], detailMaxDist: 44, pos: new THREE.Vector3(5.25, 0.15, -8.55), html: () => {
        const deg = -10 + (Math.max(0, Math.min(100, n(focusG() + 'blade'))) / 100) * 22;
        return `<b>Chốt quay cánh</b><span class="v">Góc cánh ${deg >= 0 ? '+' : ''}${deg.toFixed(1)}° (−10°~+12°)</span>`;
      } },
      { id: 'crosshead', unitFocus: true, localOff: [0.55, -0.45, 1.1], detailMaxDist: 44, pos: new THREE.Vector3(4.55, -0.45, -6.9), html: () => `<b>Con trượt chữ thập</b><span class="v">H${focusedUnitNo} · 5 thanh nối & tay quay</span>` },
      { id: 'swg6', pos: new THREE.Vector3(9.75, 9.8, 0), html: () => `<b>Tủ hợp bộ 6,3 kV (MC 601 · 612 · MC 602)</b><span class="v">601 <span class="${on('CB601') ? 'st-on' : 'st-off'}">${on('CB601') ? 'ĐÓNG' : 'CẮT'}</span> · 602 <span class="${on('CB602') ? 'st-on' : 'st-off'}">${on('CB602') ? 'ĐÓNG' : 'CẮT'}</span></span>` },
      { id: 'aux', pos: new THREE.Vector3(3.2, 11.4, 27.5), html: () => `<b>Tự dùng 0,4 kV (TD 61 / 2AXT / DG)</b><span class="v">${fx(n('V400') * 1000, 0)} V · ${on('AXT1') ? '1AXT' : (on('AXT2') ? '2AXT' : (on('dgCb') ? 'DG' : 'CẮT'))} · DG: <span class="${on('dgEngine') ? 'st-on' : 'st-off'}">${on('dgEngine') ? 'CHẠY' : 'DỪNG'}</span></span>` },
      { id: 't1', pos: new THREE.Vector3(17.4, 12.0, Z_BAY[0]), html: () => `<b>MBA 1T (10 MVA · 6,3/38,5 kV)</b><span class="v">MC601 <span class="${on('CB601') ? 'st-on' : 'st-off'}">${on('CB601') ? 'ĐÓNG' : 'CẮT'}</span></span>` },
      { id: 'cb331', pos: new THREE.Vector3(26.2, 11.8, Z_BAY[0]), html: () => `<b>MC 331 (TC 31)</b><span class="${on('CB331') ? 'st-on' : 'st-off'}">${on('CB331') ? 'ĐÓNG' : 'CẮT'}</span> · <span class="v">DCL 331-1 ${on('IS331_1') ? 'ĐÓNG' : 'MỞ'}</span>` },
      { id: 't2', pos: new THREE.Vector3(17.4, 12.0, Z_BAY[1]), html: () => `<b>MBA 2T (10 MVA · 6,3/38,5 kV)</b><span class="v">MC602 <span class="${on('CB602') ? 'st-on' : 'st-off'}">${on('CB602') ? 'ĐÓNG' : 'CẮT'}</span></span>` },
      { id: 'cb332', pos: new THREE.Vector3(26.2, 11.8, Z_BAY[1]), html: () => `<b>MC 332 (TC 32)</b><span class="${on('CB332') ? 'st-on' : 'st-off'}">${on('CB332') ? 'ĐÓNG' : 'CẮT'}</span> · <span class="v">DCL 332-2 ${on('IS332_2') ? 'ĐÓNG' : 'MỞ'}</span>` },
      { id: 'bus35', pos: new THREE.Vector3(29.4, 14.3, 24.6), html: () => `<b>Thanh cái TC 31 / TC 32 – DCL 312-1</b><span class="v">${fx(n('VbusZone1'), 1)}/${fx(n('VbusZone2'), 1)} kV · <span class="${on('IS312_1') ? 'st-on' : 'st-off'}">${on('IS312_1') ? 'ĐÓNG' : 'MỞ'}</span></span>` },
      { id: 'td32', pos: new THREE.Vector3(32.8, 10.1, 32.95), html: () => `<b>MBA tự dùng TD32 (35/0,4 kV – 320 kVA)</b><span class="v">CSV-TD32 · ${fx(n('VbusZone2'), 1)} kV</span>` },
      { id: 'l371', pos: new THREE.Vector3(45.0, 18.8, Z_BAY[0]), html: () => `<b>Xuất tuyến 371 (TC 31)</b><span class="v">${fx(n('P371'), 2)} MW · ${fx(n('V371'), 1)} kV · MC <span class="${on('CB371') ? 'st-on' : 'st-off'}">${on('CB371') ? 'ĐÓNG' : 'CẮT'}</span></span>` },
      { id: 'l372', pos: new THREE.Vector3(45.0, 18.8, Z_BAY[1]), html: () => `<b>Xuất tuyến 372 (TC 32)</b><span class="v">${fx(n('P372'), 2)} MW · ${fx(n('V372'), 1)} kV · MC <span class="${on('CB372') ? 'st-on' : 'st-off'}">${on('CB372') ? 'ĐÓNG' : 'CẮT'}</span></span>` }
    ];
    worldLabels.forEach(lb => { lb.el = h('div', { class: 's3d-tag' }, labelLayer); });

    // -----------------------------------------------------------------------
    // 4.11 GIAO DIỆN HUD & POPUP BIỂU ĐỒ P–Q H1 & H2
    // -----------------------------------------------------------------------
    const topLeft = h('div', { class: 's3d-top-left' }, wrap);

    const presetBar = h('div', { class: 's3d-glass s3d-bar' }, topLeft);
    h('span', { class: 's3d-title' }, presetBar, 'Góc nhìn');
    const presetBtns = {};
    function selectPreset(p) {
      activePreset = p.id;
      camCtrl.target.set(p.target[0], p.target[1], p.target[2]);
      camCtrl.theta = p.theta; camCtrl.phi = p.phi; camCtrl.dist = p.dist;
      Object.keys(presetBtns).forEach(k => presetBtns[k].classList.toggle('act', k === p.id));
    }
    PRESETS.forEach(p => {
      const b = h('button', { class: 's3d-btn' + (p.id === activePreset ? ' act' : ''), onclick: () => selectPreset(p) }, presetBar, p.label);
      presetBtns[p.id] = b;
    });

    // Thanh chế độ hiển thị + nút 📈 Biểu đồ P–Q + chú thích vector P/Q
    const modeBar = h('div', { class: 's3d-glass s3d-bar' }, topLeft);
    h('span', { class: 's3d-title' }, modeBar, 'Hiển thị');
    const btnXray = h('button', { class: 's3d-btn', onclick: () => { setXray(!xrayOn); btnXray.classList.toggle('tog-on', xrayOn); } }, modeBar, '🔍 Nhìn xuyên ống');
    const btnLbl = h('button', { class: 's3d-btn tog-on', onclick: () => { labelsOn = !labelsOn; labelLayer.style.display = labelsOn ? '' : 'none'; nameplateGroup.visible = labelsOn; btnLbl.classList.toggle('tog-on', labelsOn); } }, modeBar, '🏷 Nhãn thiết bị');
    const btnFx = h('button', { class: 's3d-btn tog-on', onclick: () => { fxOn = !fxOn; btnFx.classList.toggle('tog-on', fxOn); } }, modeBar, '⚡ Hiệu ứng dòng điện & nước');
    const btnRot = h('button', { class: 's3d-btn', onclick: () => { autoRotate = !autoRotate; btnRot.classList.toggle('tog-on', autoRotate); } }, modeBar, '🔄 Tự xoay');
    const btnAutoFly = h('button', {
      class: 's3d-btn' + (autoFlyArc ? ' tog-on' : ''),
      title: 'Tự bay camera tới vị trí con dao khi xảy ra hồ quang',
      onclick: () => {
        autoFlyArc = !autoFlyArc;
        btnAutoFly.classList.toggle('tog-on', autoFlyArc);
        try { localStorage.setItem('hps3dAutoFlyArc', autoFlyArc ? '1' : '0'); } catch (e) { }
      }
    }, modeBar, '🎯 Tự bay sự cố');
    const btnPQ = h('button', { class: 's3d-btn pq-btn', onclick: () => togglePQModal(true) }, modeBar, '📈 Biểu đồ P–Q');
    h('span', { class: 's3d-pq-legend', title: 'Mũi tên hướng dòng công suất 3D' }, modeBar,
      '<span style="color:#fb923c">➤ P (MW)</span><span style="color:#22d3ee">➤ Q (MVAr)</span>');

    // Banner cảnh báo sự cố ngắn mạch / đóng nhầm DTĐ / quá nhiệt + nhãn 3D nổi mô tả sự cố hồ quang (từ S.incident)
    const faultBanner = h('div', { class: 's3d-fault-banner' }, wrap);
    const arcLabelEl = h('div', { class: 's3d-arc-tag' }, wrap);
    let lastArcLabelHtml = '';

    // Kết nối bộ đón sự kiện /api/state?ev= từ tầng ngoài vào scene 3D (và xả sự kiện mới phát sinh trong 4 giây gần nhất)
    if (typeof window._sim3dSetArcReceiver === 'function') {
      window._sim3dSetArcReceiver(evItem => triggerArcBurst(evItem.text));
    }

    // Đồng bộ kế nổi (Mini Synchroscope) góc dưới phải – tự hiện khi H1 hoặc H2 ở chế độ PHÁT ĐIỆN mà chưa hòa lưới
    const miniSync = h('div', { class: 's3d-sync-box hidden' }, wrap);
    const msHdr = h('div', { class: 's3d-sync-hdr' }, miniSync);
    const msTitle = h('b', {}, msHdr, '⏱ ĐỒNG BỘ KẾ H1');
    const msTabs = h('div', { class: 's3d-sync-tabs' }, msHdr);
    let syncTargetUnit = 1;
    const msTab1 = h('button', { class: 's3d-sync-tab act', onclick: () => { syncTargetUnit = 1; updateMiniSync(true); } }, msTabs, 'H1');
    const msTab2 = h('button', { class: 's3d-sync-tab', onclick: () => { syncTargetUnit = 2; updateMiniSync(true); } }, msTabs, 'H2');

    const msBody = h('div', { class: 's3d-sync-body' }, miniSync);
    const msSvg = el('svg', { viewBox: '0 0 120 120', class: 's3d-sync-svg' }, msBody);
    el('circle', { cx: 60, cy: 60, r: 56, fill: '#0f172a', stroke: '#38bdf8', 'stroke-width': 2 }, msSvg);
    el('circle', { cx: 60, cy: 60, r: 50, fill: '#f8fafc' }, msSvg);
    el('path', {
      d: `M60 60 L${(60 + 50 * Math.sin(-0.21)).toFixed(1)} ${(60 - 50 * Math.cos(-0.21)).toFixed(1)} A50 50 0 0 1 ${(60 + 50 * Math.sin(0.21)).toFixed(1)} ${(60 - 50 * Math.cos(0.21)).toFixed(1)} Z`,
      fill: '#86efac'
    }, msSvg);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      el('line', {
        x1: (60 + 48 * Math.sin(a)).toFixed(1), y1: (60 - 48 * Math.cos(a)).toFixed(1),
        x2: (60 + (i % 2 ? 43 : 38) * Math.sin(a)).toFixed(1), y2: (60 - (i % 2 ? 43 : 38) * Math.cos(a)).toFixed(1),
        stroke: '#1e293b', 'stroke-width': i % 2 ? 1 : 1.8
      }, msSvg);
    }
    const tSlow = el('text', { x: 32, y: 63, 'font-size': 8.5, 'font-weight': 700, fill: '#334155', 'text-anchor': 'middle' }, msSvg, 'CHẬM');
    const tFast = el('text', { x: 88, y: 63, 'font-size': 8.5, 'font-weight': 700, fill: '#334155', 'text-anchor': 'middle' }, msSvg, 'NHANH');
    void tSlow; void tFast;
    const msLamp = el('circle', { cx: 60, cy: 88, r: 7, fill: '#475569', stroke: '#0f172a', 'stroke-width': 1.2 }, msSvg);
    const msNeedle = el('line', { x1: 60, y1: 68, x2: 60, y2: 14, stroke: '#dc2626', 'stroke-width': 3.6, 'stroke-linecap': 'round' }, msSvg);
    el('circle', { cx: 60, cy: 60, r: 5, fill: '#0f172a' }, msSvg);

    const msMetrics = h('div', { class: 's3d-sync-metrics' }, msBody);
    const msRowU35g = h('div', { class: 's3d-sync-row' }, msMetrics, '<span>U MBA T1</span><b>0.0 kV</b>');
    const msRowU35b = h('div', { class: 's3d-sync-row' }, msMetrics, '<span>U TC 31</span><b>0.0 kV</b>');
    const msRowU = h('div', { class: 's3d-sync-row' }, msMetrics, '<span>ΔU</span><b>0.0 %</b>');
    const msRowF = h('div', { class: 's3d-sync-row' }, msMetrics, '<span>Δf</span><b>0.00 Hz</b>');
    const msRowP = h('div', { class: 's3d-sync-row' }, msMetrics, '<span>Δφ</span><b>0°</b>');
    const msLblU35g = msRowU35g.querySelector('span');
    const msValU35g = msRowU35g.querySelector('b');
    const msLblU35b = msRowU35b.querySelector('span');
    const msValU35b = msRowU35b.querySelector('b');
    const msValU = msRowU.querySelector('b');
    const msValF = msRowF.querySelector('b');
    const msValP = msRowP.querySelector('b');

    const msWarn = h('div', { class: 's3d-sync-warn', style: 'display:none' }, miniSync);

    const msTrims = h('div', { class: 's3d-sync-trims' }, miniSync);
    const msTrimBtns = [
      h('button', { title: 'Giảm tần số', onclick: () => sendCommand(`GEN${syncTargetUnit}.SPTRIM`, n(`G${syncTargetUnit}.spTrim`) - 0.05) }, msTrims, '−f'),
      h('button', { title: 'Tăng tần số', onclick: () => sendCommand(`GEN${syncTargetUnit}.SPTRIM`, n(`G${syncTargetUnit}.spTrim`) + 0.05) }, msTrims, '+f'),
      h('button', { title: 'Giảm điện áp', onclick: () => sendCommand(`GEN${syncTargetUnit}.VTRIM`, n(`G${syncTargetUnit}.vTrim`) - 0.5) }, msTrims, '−U'),
      h('button', { title: 'Tăng điện áp', onclick: () => sendCommand(`GEN${syncTargetUnit}.VTRIM`, n(`G${syncTargetUnit}.vTrim`) + 0.5) }, msTrims, '+U')
    ];

    const msCloseBtn = h('button', {
      class: 's3d-sync-close-btn',
      onclick: () => {
        const g = 'G' + syncTargetUnit;
        if (on(g + '.autoSync')) return;
        const cbNum = syncTargetUnit === 1 ? '331' : '332';
        ask(`Đóng hòa máy cắt ${cbNum} (hòa Tổ máy H${syncTargetUnit} vào TC ${syncTargetUnit === 1 ? '31' : '32'} – 35 kV)?`, () => sendCommand(`GEN${syncTargetUnit}.SYNCCLOSE`, 1));
      }
    }, miniSync, '⚡ ĐÓNG HÒA MC 331');

    function isUnitStartingOrSyncing3d(uNo) {
      const gg = 'G' + uNo;
      const m = n(gg + '.mode');
      return (m === 1 || m === 2) && !on(gg + '.grid');
    }

    function updateMiniSync(skipNeedle) {
      const need1 = n('G1.mode') === 1 && !on('G1.grid');
      const need2 = n('G2.mode') === 1 && !on('G2.grid');
      if (!need1 && !need2) {
        miniSync.classList.add('hidden');
        return;
      }
      miniSync.classList.remove('hidden');
      if (syncTargetUnit === 1 && !need1) syncTargetUnit = 2;
      if (syncTargetUnit === 2 && !need2) syncTargetUnit = 1;
      msTab1.style.display = need1 ? '' : 'none';
      msTab2.style.display = need2 ? '' : 'none';
      msTab1.classList.toggle('act', syncTargetUnit === 1);
      msTab2.classList.toggle('act', syncTargetUnit === 2);

      const gn = syncTargetUnit, g = 'G' + gn;
      const cbNum = gn === 1 ? '331' : '332';
      const tcLbl = gn === 1 ? 'TC 31' : 'TC 32';
      const isAuto = on(g + '.autoSync');
      const isStrict = (S.interlock || 'strict') === 'strict';
      msTitle.textContent = `⏱ ĐỒNG BỘ KẾ H${gn} (MC ${cbNum})`;

      const busF = n(g + '.busF') || n(gn === 1 ? 'FreqZone1' : 'FreqZone2') || 50.0;
      const u35Gen = n(g + '.Vgen') * (38.5 / 6.3);
      const u35Bus = n(gn === 1 ? 'VbusZone1' : 'VbusZone2') || (n(g + '.busV') * (38.5 / 6.3));
      const df = n(g + '.freq') - busF;
      const dv = u35Bus > 1 ? ((u35Gen - u35Bus) / u35Bus) * 100 : 0;
      const ph = n(g + '.phase');
      const okU = Math.abs(dv) < 5;
      const okF = Math.abs(df) < 0.2;
      const okP = Math.abs(ph) < 12;
      const allOk = okU && okF && okP && u35Bus > 5;

      msLblU35g.textContent = `U MBA T${gn} (35kV)`;
      msValU35g.textContent = fx(u35Gen, 1) + ' kV';
      msLblU35b.textContent = `U ${tcLbl} (35kV)`;
      msValU35b.textContent = fx(u35Bus, 1) + ' kV';
      msValU.textContent = (dv >= 0 ? '+' : '') + fx(dv, 1) + ' %';
      msValU.className = okU ? 's3d-sync-ok' : 's3d-sync-bad';
      msValF.textContent = (df >= 0 ? '+' : '') + fx(df, 2) + ' Hz';
      msValF.className = okF ? 's3d-sync-ok' : 's3d-sync-bad';
      msValP.textContent = fx(ph, 0) + '°';
      msValP.className = okP ? 's3d-sync-ok' : 's3d-sync-bad';

      if (need1 && need2) {
        msWarn.style.display = 'block';
        msWarn.textContent = '⚠ ĐIỀU 10: Không khởi động / hòa lưới đồng thời 2 tổ máy!';
      } else {
        msWarn.style.display = 'none';
      }

      msTrimBtns.forEach(tb => { tb.disabled = isAuto; });
      msLamp.setAttribute('fill', allOk ? '#22c55e' : '#475569');
      msCloseBtn.classList.toggle('auto', isAuto);
      msCloseBtn.classList.toggle('ready', !isAuto && allOk);
      if (isAuto) {
        msCloseBtn.disabled = true;
        msCloseBtn.textContent = '⏳ Đang hòa tự động (SDQ200)…';
        msCloseBtn.title = 'Hệ thống tự động hòa lưới SDQ200 đang làm việc – khóa nút đóng tay';
      } else if (isStrict && !allOk) {
        msCloseBtn.disabled = true;
        msCloseBtn.textContent = `🔒 CHỜ RƠ-LE ĐB XANH (MC ${cbNum})`;
        msCloseBtn.title = 'Chế độ liên động chặt: chỉ mở khóa ĐÓNG MC khi đèn rơ-le kiểm tra đồng bộ sáng xanh';
      } else {
        msCloseBtn.disabled = false;
        msCloseBtn.textContent = `⚡ ĐÓNG HÒA MC ${cbNum}`;
        msCloseBtn.title = 'Đóng hòa máy cắt ' + cbNum;
      }
      if (!skipNeedle) {
        msNeedle.setAttribute('transform', `rotate(${ph.toFixed(1)} 60 60)`);
      }
    }

    h('div', { class: 's3d-glass s3d-hint' }, wrap,
      '<b>Bấm trực tiếp</b> thiết bị 3D để thao tác · <b>Chuột trái</b> xoay 360° · <b>Chuột phải / Shift</b> kéo ngang · <b>Cuộn</b> thu/phóng');

    // Popup điều khiển nhanh cho Tổ máy H1/H2, Diesel 500 kVA & MBA tự dùng TD6/TD35
    const quickModal = h('div', { class: 's3d-quick-modal hidden' }, wrap);
    const quickBox = h('div', { class: 's3d-quick-box' }, quickModal);
    quickModal.onclick = e => { if (e.target === quickModal) closeQuickModal(); };
    let quickRefreshFn = null;
    function closeQuickModal() {
      quickModal.classList.add('hidden');
      quickRefreshFn = null;
    }

    function openUnitQuickModal(unitNo) {
      const g = 'G' + unitNo;
      const otherNo = unitNo === 1 ? 2 : 1;
      quickBox.innerHTML = '';
      const hdr = h('div', { class: 's3d-quick-hdr' }, quickBox);
      h('h4', {}, hdr, `⚡ Tổ máy H${unitNo} (ZZJK508 / SF8000 – 8 MW · 10 MVA)`);
      h('button', { class: 's3d-btn', onclick: closeQuickModal }, hdr, '✕');

      const stats = h('div', { class: 's3d-quick-stats' }, quickBox);
      const tripBar = h('div', { style: 'margin-bottom:8px;display:none;padding:7px 10px;border-radius:8px;background:rgba(153,27,27,.45);border:1px solid #f87171;color:#fecaca;font-weight:700;font-size:12px' }, quickBox);
      const specBar = h('div', { style: 'margin-bottom:8px;padding:6px 9px;border-radius:8px;background:rgba(15,32,54,.72);border:1px solid rgba(125,211,252,.22);color:#bae6fd;font-size:11px;line-height:1.45' }, quickBox,
        '<b>Ngưỡng tốc độ (nđm = 214,3 v/ph):</b> Phanh cơ &lt;30% (~64,3) · Quá tốc L1 145% (310,7) · L2 hạ cửa 155% (332,2) · Lồng 540,3 v/ph · 24 cánh hướng dòng');

      const modesRow = h('div', { class: 's3d-quick-modes' }, quickBox);
      const modeSpecs = [
        ['▶ PHÁT ĐIỆN', 1, 'ok'],
        ['⚙ KHÔNG TẢI', 2, ''],
        ['⏹ DỪNG MÁY', 0, 'danger']
      ];
      const modeBtns = modeSpecs.map(([lbl, mVal, cls]) => {
        const b = h('button', {
          class: 's3d-act ' + cls,
          onclick: () => {
            const d10 = (mVal === 1 || mVal === 2) && isUnitStartingOrSyncing3d(otherNo)
              ? `\n\n⚠ CẢNH BÁO ĐIỀU 10: Tổ máy H${otherNo} đang khởi động/hòa lưới. Quy trình nghiêm cấm khởi động đồng thời 2 tổ máy!`
              : '';
            ask(`Tổ máy H${unitNo} (MF${unitNo}): chuyển chế độ ${lbl.replace(/^.\s/, '')}?${d10}`, () => sendCommand(`GEN${unitNo}.MODE`, mVal));
          }
        }, modesRow, lbl);
        return { b, mVal, baseCls: cls };
      });

      const slWrap = h('div', { class: 's3d-quick-sliders' }, quickBox);
      let editingP = false, editingQ = false;
      const rP = h('div', { class: 's3d-sl-row' }, slWrap);
      h('span', {}, rP, 'Đặt P (MW)');
      const inP = h('input', { type: 'range', min: 0, max: 8.5, step: 0.1, value: n(g + '.P') }, rP);
      const vP = h('b', {}, rP, fx(n(g + '.P'), 1));

      const rQ = h('div', { class: 's3d-sl-row' }, slWrap);
      h('span', {}, rQ, 'Đặt Q (MVAr)');
      const inQ = h('input', { type: 'range', min: 0, max: 7.0, step: 0.1, value: n(g + '.Q') }, rQ);
      const vQ = h('b', {}, rQ, fx(n(g + '.Q'), 1));

      const mvaBox = h('div', { style: 'margin-top:6px;padding:6px 9px;border-radius:7px;font-size:11.5px;font-weight:700;display:flex;justify-content:space-between;align-items:center' }, slWrap);
      function refreshMvaPreview(pv, qv) {
        const sMva = Math.hypot(pv, qv);
        const over = sMva > 10.0;
        mvaBox.style.background = over ? 'rgba(153,27,27,.58)' : 'rgba(15,32,54,.75)';
        mvaBox.style.border = over ? '1.5px solid #f87171' : '1px solid rgba(125,211,252,.25)';
        mvaBox.style.color = over ? '#fecaca' : '#a7f3d0';
        mvaBox.innerHTML = over
          ? `<span>⚠ QUÁ TẢI BIỂU KIẾN S = √(P²+Q²) &gt; 10 MVA!</span><b>${sMva.toFixed(2)} / 10,00 MVA</b>`
          : `<span>Công suất biểu kiến đặt S = √(P²+Q²)</span><b>${sMva.toFixed(2)} / 10,00 MVA</b>`;
      }
      inP.oninput = () => { editingP = true; vP.textContent = (+inP.value).toFixed(1); refreshMvaPreview(+inP.value, +inQ.value); };
      inP.onchange = () => { sendCommand(`GEN${unitNo}.P`, +inP.value); setTimeout(() => { editingP = false; }, 1200); };
      inQ.oninput = () => { editingQ = true; vQ.textContent = (+inQ.value).toFixed(1); refreshMvaPreview(+inP.value, +inQ.value); };
      inQ.onchange = () => { sendCommand(`GEN${unitNo}.Q`, +inQ.value); setTimeout(() => { editingQ = false; }, 1200); };

      const foot = h('div', { class: 's3d-quick-foot' }, quickBox);
      h('button', {
        class: 's3d-act danger',
        onclick: () => ask(`Giải trừ bảo vệ (RESET) Tổ máy H${unitNo}?`, () => sendCommand(`GEN${unitNo}.RESET`))
      }, foot, '🔄 GIẢI TRỪ BẢO VỆ (RESET)');
      h('button', {
        class: 's3d-act',
        onclick: () => {
          const p = PRESETS.find(x => x.id === 'g' + unitNo);
          if (p) selectPreset(p);
          closeQuickModal();
        }
      }, foot, `🎥 Cận cảnh H${unitNo}`);
      h('button', {
        class: 's3d-act',
        onclick: () => { closeQuickModal(); togglePQModal(true); }
      }, foot, '📈 Biểu đồ P–Q');

      quickRefreshFn = () => {
        const curMode = n(g + '.mode');
        const braking = S[g + '.airBrake'] !== undefined ? !on(g + '.airBrake') : false;
        const sReal = Math.hypot(n(g + '.Pload'), n(g + '.Qload'));
        stats.innerHTML =
          `<div><span>Công suất P / Q</span><b>${fx(n(g + '.Pload'), 2)} MW · ${fx(n(g + '.Qload'), 2)} MVAr</b></div>` +
          `<div><span>Biểu kiến S (đm 10 MVA)</span><b style="color:${sReal > 10 ? '#f87171' : '#4ade80'}">${fx(sReal, 2)} MVA</b></div>` +
          `<div><span>Điện áp / Dòng</span><b>${fx(n(g + '.Vgen'), 2)} kV · ${fx(n(g + '.Ia'), 0)} A</b></div>` +
          `<div><span>Tốc độ / f</span><b>${fx(n(g + '.speed'), 1)} v/ph · ${fx(n(g + '.freq'), 2)} Hz</b></div>` +
          `<div><span>Cánh hướng (24) / BXCT</span><b>${fx(n(g + '.GV'), 1)}% / ${fx(n(g + '.blade'), 1)}%</b></div>` +
          `<div><span>Phanh khí nén</span><b style="color:${braking ? '#fbbf24' : '#4ade80'}">${braking ? '⚠ ĐANG PHANH' : 'Đã giải trừ phanh'}</b></div>`;
        const tripped = on(g + '.tripped');
        tripBar.style.display = tripped ? 'block' : 'none';
        if (tripped) tripBar.textContent = `⚠ BẢO VỆ ĐÃ CẮT H${unitNo}: ${S[g + '.tripReason'] || 'Tác động rơ-le'}`;
        modeBtns.forEach(mb => {
          mb.b.style.outline = curMode === mb.mVal ? '2px solid #7dd3fc' : 'none';
        });
        if (!editingP) { inP.value = n(g + '.P'); vP.textContent = fx(n(g + '.P'), 1); }
        if (!editingQ) { inQ.value = n(g + '.Q'); vQ.textContent = fx(n(g + '.Q'), 1); }
        refreshMvaPreview(+inP.value, +inQ.value);
      };
      quickRefreshFn();
      quickModal.classList.remove('hidden');
    }

    function openBrakeQuickModal(unitNo) {
      const g = 'G' + unitNo;
      const N_RATED = 214.3;
      const BRAKE_LIMIT_RPM = N_RATED * 0.30; // 64.29 v/ph (30% nđm)
      quickBox.innerHTML = '';
      const hdr = h('div', { class: 's3d-quick-hdr' }, quickBox);
      h('h4', {}, hdr, `🛑 Kích phanh khí nén (6 bộ) – Tổ máy H${unitNo}`);
      h('button', { class: 's3d-btn', onclick: closeQuickModal }, hdr, '✕');

      const stats = h('div', { class: 's3d-quick-stats' }, quickBox);
      const condBar = h('div', { style: 'margin-bottom:9px;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:700;line-height:1.45' }, quickBox);
      const foot = h('div', { class: 's3d-quick-foot' }, quickBox);
      h('button', {
        class: 's3d-act',
        onclick: () => openUnitQuickModal(unitNo)
      }, foot, `⚡ Điều khiển Tổ máy H${unitNo}`);
      h('button', {
        class: 's3d-act',
        onclick: () => {
          const p = PRESETS.find(x => x.id === 'g' + unitNo);
          if (p) selectPreset(p);
          closeQuickModal();
        }
      }, foot, `🎥 Cận cảnh H${unitNo}`);

      quickRefreshFn = () => {
        const braking = S[g + '.airBrake'] !== undefined ? !on(g + '.airBrake') : false;
        const rpm = n(g + '.speed');
        const pct = (rpm / N_RATED) * 100;
        const allowed = rpm <= BRAKE_LIMIT_RPM;
        stats.innerHTML =
          `<div><span>Trạng thái phanh (airBrake)</span><b style="color:${braking ? '#f87171' : '#4ade80'}">${braking ? '⚠ ĐANG PHANH' : 'Đã giải trừ phanh'}</b></div>` +
          `<div><span>Tốc độ quay hiện tại</span><b>${fx(rpm, 1)} v/ph (${fx(pct, 1)}% nđm)</b></div>` +
          `<div><span>Ngưỡng tốc độ phanh</span><b style="color:#7dd3fc">≤ 30% nđm (64,3 v/ph)</b></div>` +
          `<div><span>Kết cấu hệ phanh</span><b>6 bộ kích phanh khí nén · Vành phanh</b></div>`;
        if (braking && !allowed) {
          condBar.style.background = 'rgba(153,27,27,.55)';
          condBar.style.border = '1.5px solid #f87171';
          condBar.style.color = '#fecaca';
          condBar.textContent = '⚠ CẢNH BÁO: Đang phanh vượt ngưỡng 30% nđm (64,3 v/ph) – nguy cơ quá nhiệt/cháy má phanh và vành phanh!';
        } else if (allowed) {
          condBar.style.background = 'rgba(20,83,45,.48)';
          condBar.style.border = '1px solid #4ade80';
          condBar.style.color = '#bbf7d0';
          condBar.textContent = `✓ Tốc độ hiện tại (${fx(pct, 1)}% nđm) nằm trong ngưỡng ≤ 30% nđm (64,3 v/ph): CHO PHÉP đóng phanh khí nén.`;
        } else {
          condBar.style.background = 'rgba(120,53,15,.48)';
          condBar.style.border = '1px solid #fbbf24';
          condBar.style.color = '#fde68a';
          condBar.textContent = `⛔ Tốc độ hiện tại (${fx(pct, 1)}% nđm) > 30% nđm (64,3 v/ph): CẤM đóng phanh khí nén theo Quy trình vận hành.`;
        }
      };
      quickRefreshFn();
      quickModal.classList.remove('hidden');
    }

    function openDieselQuickModal() {
      quickBox.innerHTML = '';
      const hdr = h('div', { class: 's3d-quick-hdr' }, quickBox);
      h('h4', {}, hdr, '⛽ Tổ máy phát Diesel dự phòng 500 kVA');
      h('button', { class: 's3d-btn', onclick: closeQuickModal }, hdr, '✕');
      const stats = h('div', { class: 's3d-quick-stats' }, quickBox);
      const atsWarn = h('div', { class: 's3d-sync-warn', style: 'margin-bottom:9px;display:none' }, quickBox);
      const foot = h('div', { class: 's3d-quick-foot' }, quickBox);
      const btnStandby = h('button', {
        class: 's3d-act',
        onclick: () => ask(`${on('StandbyInput400') ? 'Tắt' : 'Bật'} lệnh chạy Diesel dự phòng (StandbyInput400)?`, () => sendCommand('StandbyInput400'))
      }, foot, '');
      const btnCb = h('button', {
        class: 's3d-act',
        onclick: () => {
          const closing = !on('dgCb');
          const gridLive = on('AXT1') || on('AXT2') || (n('V400') > 0.1 && !on('dgCb'));
          if (closing && gridLive) {
            const msg = '⛔ LIÊN ĐỘNG ATS CẤM ĐÓNG SONG SONG: Thanh cái 0,4 kV đang có điện từ lưới (1AXT/2AXT đang đóng). Cấm tuyệt đối đóng MC Diesel lên thanh cái đang có điện lưới!';
            if (typeof toast === 'function') toast(msg);
            if ((S.interlock || 'strict') === 'strict') return;
            ask(msg + '\nVẫn cưỡng bức đóng MC Diesel?', () => sendCommand('dgCb'));
            return;
          }
          ask(`${closing ? 'Đóng' : 'Cắt'} máy cắt đầu cực Diesel (dgCb)?`, () => sendCommand('dgCb'));
        }
      }, foot, '');

      quickRefreshFn = () => {
        const eng = on('dgEngine'), stby = on('StandbyInput400'), cb = on('dgCb');
        const gridLive = on('AXT1') || on('AXT2');
        stats.innerHTML =
          `<div><span>Động cơ Diesel</span><b>${eng ? 'ĐANG CHẠY' : 'ĐANG DỪNG'}</b></div>` +
          `<div><span>Lệnh 400V Standby</span><b>${stby ? 'BẬT' : 'TẮT'}</b></div>` +
          `<div><span>MC Diesel (dgCb)</span><b>${cb ? 'ĐÓNG' : 'CẮT'}</b></div>` +
          `<div><span>1AXT (TD 61) / 2AXT (TD 32)</span><b>${on('AXT1') ? 'ĐÓNG' : 'CẮT'} / ${on('AXT2') ? 'ĐÓNG' : 'CẮT'}</b></div>` +
          `<div><span>Công suất phát</span><b>${fx(n('dgKW'), 0)} kW · ${fx(n('dgKVAr'), 0)} kVAr</b></div>` +
          `<div><span>Thanh cái 0,4 kV / ATS</span><b>${fx(n('V400') * 1000, 0)} V · ${on('dgAuto') ? 'AUTO' : 'TAY'}</b></div>`;
        if (gridLive && !cb) {
          atsWarn.style.display = 'block';
          atsWarn.textContent = '🔒 KHÓA LIÊN ĐỘNG ATS: 1AXT/2AXT đang đóng – Cấm đóng MC Diesel song song với lưới!';
        } else if (gridLive && cb) {
          atsWarn.style.display = 'block';
          atsWarn.textContent = '⚠ CẢNH BÁO NGUY HIỂM: Đang đóng song song MC Diesel với nguồn lưới (1AXT/2AXT)!';
        } else {
          atsWarn.style.display = 'none';
        }
        btnStandby.textContent = stby ? '⏹ Tắt lệnh chạy Diesel (StandbyInput400)' : '▶ Bật lệnh chạy Diesel (StandbyInput400)';
        btnStandby.className = 's3d-act ' + (stby ? 'danger' : 'ok');
        btnCb.textContent = cb ? 'Cắt MC Diesel (dgCb)' : (gridLive ? '🔒 Cấm đóng MC Diesel (ATS)' : 'Đóng MC Diesel (dgCb)');
        btnCb.className = 's3d-act ' + (cb ? 'danger' : 'ok');
      };
      quickRefreshFn();
      quickModal.classList.remove('hidden');
    }

    function openAuxTrafoQuickModal(tdName) {
      quickBox.innerHTML = '';
      const isTD61 = tdName === 'TD61' || tdName === 'TD6';
      const hdr = h('div', { class: 's3d-quick-hdr' }, quickBox);
      h('h4', {}, hdr, isTD61 ? '🔌 MBA tự dùng TD 61 (6,3 / 0,4 kV – Ưu tiên)' : '🔌 MBA tự dùng TD 32 (35 / 0,4 kV – Từ TC 32)');
      h('button', { class: 's3d-btn', onclick: closeQuickModal }, hdr, '✕');
      const stats = h('div', { class: 's3d-quick-stats' }, quickBox);
      const atsWarn = h('div', { class: 's3d-sync-warn', style: 'margin-bottom:9px;display:none' }, quickBox);
      const foot = h('div', { class: 's3d-quick-foot' }, quickBox);

      const axKey = isTD61 ? 'AXT1' : 'AXT2';
      const otherAxKey = isTD61 ? 'AXT2' : 'AXT1';
      const axLbl = isTD61 ? '1AXT (TD 61)' : '2AXT (TD 32)';
      const otherAxLbl = isTD61 ? '2AXT (TD 32)' : '1AXT (TD 61)';
      const btnAx = h('button', {
        class: 's3d-act',
        onclick: () => {
          const closing = !on(axKey);
          const conflict = closing && (on(otherAxKey) || on('dgCb'));
          if (conflict) {
            const who = on(otherAxKey) ? otherAxLbl : 'MC Diesel';
            const msg = `⛔ LIÊN ĐỘNG ATS CẤM ĐÓNG SONG SONG: ${who} đang đóng! Cấm hòa song song TD 61 với TD 32 hoặc Diesel.`;
            if (typeof toast === 'function') toast(msg);
            if ((S.interlock || 'strict') === 'strict') return;
            ask(msg + `\nVẫn cưỡng bức đóng ${axLbl}?`, () => sendCommand(axKey));
            return;
          }
          ask(`${closing ? 'Đóng' : 'Cắt'} máy cắt hạ áp ${axLbl}?`, () => sendCommand(axKey));
        }
      }, foot, '');
      let btn612_1 = null, btn612_2 = null;
      if (isTD61) {
        btn612_1 = h('button', {
          class: 's3d-act',
          onclick: () => ask(`${on('IS612_1') ? 'Mở' : 'Đóng'} dao cách ly 612-1 (từ thanh cái 6,3 kV MF1)?`, () => sendCommand('IS612_1'))
        }, foot, '');
        btn612_2 = h('button', {
          class: 's3d-act',
          onclick: () => ask(`${on('IS612_2') ? 'Mở' : 'Đóng'} dao cách ly 612-2 (từ thanh cái 6,3 kV MF2)?`, () => sendCommand('IS612_2'))
        }, foot, '');
      }

      quickRefreshFn = () => {
        const lv1 = S.V400Zone1 !== undefined ? n('V400Zone1') : (n('Vaux6') > 0.5 ? 0.4 : 0);
        const lv2 = S.V400Zone2 !== undefined ? n('V400Zone2') : (n('VbusZone2') > 1 ? 0.4 : 0);
        const conflict = on(otherAxKey) || on('dgCb');
        stats.innerHTML = isTD61
          ? `<div><span>Sơ cấp 6,3 kV / Hạ áp TD 61</span><b>${fx(n('Vaux6'), 2)} kV · ${fx(lv1 * 1000, 0)} V</b></div>` +
            `<div><span>Thanh cái tự dùng 0,4 kV</span><b>${fx(n('V400') * 1000, 0)} V</b></div>` +
            `<div><span>DCL 612-1 / 612-2</span><b>${on('IS612_1') ? 'ĐÓNG' : 'MỞ'} / ${on('IS612_2') ? 'ĐÓNG' : 'MỞ'}</b></div>` +
            `<div><span>1AXT / 2AXT / MC Diesel</span><b>${on('AXT1') ? 'ĐÓNG' : 'CẮT'} / ${on('AXT2') ? 'ĐÓNG' : 'CẮT'} / ${on('dgCb') ? 'ĐÓNG' : 'CẮT'}</b></div>`
          : `<div><span>TC 32 (35 kV) / Hạ áp TD 32</span><b>${fx(n('VbusZone2'), 1)} kV · ${fx(lv2 * 1000, 0)} V</b></div>` +
            `<div><span>Thanh cái tự dùng 0,4 kV</span><b>${fx(n('V400') * 1000, 0)} V</b></div>` +
            `<div><span>2AXT / 1AXT / MC Diesel</span><b>${on('AXT2') ? 'ĐÓNG' : 'CẮT'} / ${on('AXT1') ? 'ĐÓNG' : 'CẮT'} / ${on('dgCb') ? 'ĐÓNG' : 'CẮT'}</b></div>` +
            `<div><span>Diesel 500 kVA</span><b>${on('dgEngine') ? 'CHẠY' : 'DỪNG'}</b></div>`;
        const closed = on(axKey);
        if (conflict && !closed) {
          atsWarn.style.display = 'block';
          atsWarn.textContent = `🔒 KHÓA LIÊN ĐỘNG ATS: ${on(otherAxKey) ? otherAxLbl : 'MC Diesel'} đang đóng – Cấm đóng song song ${axLbl}!`;
        } else if (conflict && closed) {
          atsWarn.style.display = 'block';
          atsWarn.textContent = `⚠ CẢNH BÁO NGUY HIỂM: Đang đóng song song ${axLbl} với ${on(otherAxKey) ? otherAxLbl : 'MC Diesel'}!`;
        } else {
          atsWarn.style.display = 'none';
        }
        btnAx.textContent = closed ? ('Cắt ' + axLbl) : (conflict ? ('🔒 Cấm đóng ' + axLbl + ' (ATS)') : ('Đóng ' + axLbl));
        btnAx.className = 's3d-act ' + (closed ? 'danger' : 'ok');
        if (btn612_1) {
          btn612_1.textContent = (on('IS612_1') ? 'Mở' : 'Đóng') + ' DCL 612-1';
          btn612_1.className = 's3d-act ' + (on('IS612_1') ? 'danger' : 'ok');
        }
        if (btn612_2) {
          btn612_2.textContent = (on('IS612_2') ? 'Mở' : 'Đóng') + ' DCL 612-2';
          btn612_2.className = 's3d-act ' + (on('IS612_2') ? 'danger' : 'ok');
        }
      };
      quickRefreshFn();
      quickModal.classList.remove('hidden');
    }

    // Popup xem đồng thời Biểu đồ P–Q của H1 và H2
    const pqModal = h('div', { class: 's3d-pq-modal hidden' }, wrap);
    const pqBox = h('div', { class: 's3d-pq-box' }, pqModal);
    const pqTop = h('div', { class: 's3d-pq-top' }, pqBox);
    h('h4', {}, pqTop, '📈 Đường cong khả năng P–Q thời gian thực – Tổ máy H1 & H2 (SF8000-28/4250 · 10 MVA)');
    h('button', { class: 's3d-btn', onclick: () => togglePQModal(false) }, pqTop, '✕ Đóng');
    const pqGrid = h('div', { class: 's3d-pq-grid' }, pqBox);
    const pqCard1 = h('div', { class: 's3d-pq-item' }, pqGrid);
    const pqCv1 = h('canvas', { width: 560, height: 320 }, pqCard1);
    const pqCard2 = h('div', { class: 's3d-pq-item' }, pqGrid);
    const pqCv2 = h('canvas', { width: 560, height: 320 }, pqCard2);
    pqModal.onclick = e => { if (e.target === pqModal) togglePQModal(false); };
    let pqOpen = false;
    function togglePQModal(open) {
      pqOpen = !!open;
      pqModal.classList.toggle('hidden', !pqOpen);
      if (pqOpen && typeof window.drawPQCurve === 'function') {
        window.drawPQCurve(pqCv1, 1, true);
        window.drawPQCurve(pqCv2, 2, true);
      }
    }

    // Bảng giám sát & Thao tác nhanh góc phải
    const panel = h('div', { class: 's3d-glass s3d-panel' }, wrap);
    const phdr = h('div', { class: 's3d-phdr' }, panel);
    const phTitle = h('div', { class: 's3d-phdr-title' }, phdr, '<span>SCADA 3D</span>');
    const modeBadge = h('span', { class: 's3d-badge demo' }, phTitle, 'PREVIEW MẪU');
    const colBtn = h('button', { class: 's3d-btn', style: 'padding:2px 7px', title: 'Thu gọn / Mở rộng', onclick: () => {
      panel.classList.toggle('collapsed');
      colBtn.textContent = panel.classList.contains('collapsed') ? '◀' : '▶';
    } }, phdr, '▶');
    const pbody = h('div', { class: 's3d-pbody' }, panel);

    const secHyd = h('div', { class: 's3d-sec' }, pbody);
    h('div', { class: 's3d-sec-t' }, secHyd, '<span>Thủy công & Hồ chứa</span><span id="s3d-gate-pill" class="s3d-pill blu">MỞ</span>');
    const hydKv = h('div', { class: 's3d-kv' }, secHyd);

    const secG1 = h('div', { class: 's3d-sec' }, pbody);
    const g1Hdr = h('div', { class: 's3d-sec-t' }, secG1, '<span>Tổ máy H1 (Kaplan 8 MW)</span>');
    const g1Pill = h('span', { class: 's3d-pill red' }, g1Hdr, 'MC331 ĐÓNG');
    const g1Kv = h('div', { class: 's3d-kv' }, secG1);

    const secG2 = h('div', { class: 's3d-sec' }, pbody);
    const g2Hdr = h('div', { class: 's3d-sec-t' }, secG2, '<span>Tổ máy H2 (Kaplan 8 MW)</span>');
    const g2Pill = h('span', { class: 's3d-pill red' }, g2Hdr, 'MC332 ĐÓNG');
    const g2Kv = h('div', { class: 's3d-kv' }, secG2);

    const secNet = h('div', { class: 's3d-sec' }, pbody);
    h('div', { class: 's3d-sec-t' }, secNet, '<span>Xuất tuyến 35 kV & Tự dùng</span>');
    const netKv = h('div', { class: 's3d-kv' }, secNet);

    const secAct = h('div', { class: 's3d-sec' }, pbody);
    h('div', { class: 's3d-sec-t' }, secAct, '<span>Thao tác nhanh</span>');
    const actsGrid = h('div', { class: 's3d-acts' }, secAct);

    const actGate = h('button', { class: 's3d-act full', onclick: () => ask(`${on('IntakeGate') ? 'Đóng' : 'Mở'} cửa nhận nước?`, () => sendCommand('IntakeGate')) }, actsGrid, 'Cửa nhận nước');
    const actG1 = h('button', { class: 's3d-act', onclick: () => {
      const run = on('G1.running') || n('G1.mode') === 1;
      const d10 = (!run && isUnitStartingOrSyncing3d(2)) ? '\n\n⚠ CẢNH BÁO ĐIỀU 10: Tổ máy H2 đang khởi động/hòa lưới!' : '';
      ask(`${run ? 'Dừng' : 'Khởi động phát điện'} Tổ máy H1 (MF1)?${d10}`, () => sendCommand('GEN1.MODE', run ? 0 : 1));
    } }, actsGrid, 'H1');
    const actG2 = h('button', { class: 's3d-act', onclick: () => {
      const run = on('G2.running') || n('G2.mode') === 1;
      const d10 = (!run && isUnitStartingOrSyncing3d(1)) ? '\n\n⚠ CẢNH BÁO ĐIỀU 10: Tổ máy H1 đang khởi động/hòa lưới!' : '';
      ask(`${run ? 'Dừng' : 'Khởi động phát điện'} Tổ máy H2 (MF2)?${d10}`, () => sendCommand('GEN2.MODE', run ? 0 : 1));
    } }, actsGrid, 'H2');
    const actCB331 = h('button', { class: 's3d-act', onclick: () => ask(`${on('CB331') ? 'Cắt' : 'Đóng'} máy cắt 331?`, () => sendCommand('CB331')) }, actsGrid, 'MC 331');
    const actCB332 = h('button', { class: 's3d-act', onclick: () => ask(`${on('CB332') ? 'Cắt' : 'Đóng'} máy cắt 332?`, () => sendCommand('CB332')) }, actsGrid, 'MC 332');

    // -----------------------------------------------------------------------
    // 4.12 RESIZE & CẬP NHẬT DỮ LIỆU SCADA (U)
    // -----------------------------------------------------------------------
    let lastW = 0, lastH = 0;
    function syncSize() {
      const w = canvasHost.clientWidth || wrap.clientWidth;
      const hh = canvasHost.clientHeight || wrap.clientHeight;
      if (w > 10 && hh > 10 && (w !== lastW || hh !== lastH)) {
        lastW = w; lastH = hh;
        camera.aspect = w / hh;
        camera.updateProjectionMatrix();
        renderer.setSize(w, hh, false);
      }
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(syncSize).observe(canvasHost);
    window.addEventListener('resize', syncSize);

    function updateHud() {
      const isLive = typeof online !== 'undefined' && online;
      modeBadge.textContent = isLive ? 'LIVE SERVER' : 'PREVIEW MẪU';
      modeBadge.className = 's3d-badge ' + (isLive ? 'live' : 'demo');

      const gateOpen = on('IntakeGate');
      const gatePill = wrap.querySelector('#s3d-gate-pill');
      if (gatePill) {
        gatePill.textContent = gateOpen ? 'CỬA VAN MỞ' : 'CỬA VAN ĐÓNG';
        gatePill.className = 's3d-pill ' + (gateOpen ? 'blu' : 'amb');
      }
      hydKv.innerHTML =
        `<span>Cột nước (HeadHigh)</span><b>${fx(n('HeadHigh'), 1)} m</b>` +
        `<span>MN Thượng / Hạ lưu</span><b>${fx(n('zUp'), 1)} / ${fx(n('zTail'), 1)} m</b>` +
        `<span>Lưu lượng tràn</span><b>${fx(n('qSpill'), 2)} m³/s</b>`;

      const g1Run = on('G1.running') || n('G1.mode') === 1;
      g1Pill.textContent = on('CB331') ? 'MC331 ĐÓNG' : 'MC331 CẮT';
      g1Pill.className = 's3d-pill ' + (on('CB331') ? 'red' : 'grn');
      g1Kv.innerHTML =
        `<span>Công suất P / Q</span><b>${fx(n('G1.Pload'), 2)} MW · ${fx(n('G1.Qload'), 2)} MVAr</b>` +
        `<span>Tốc độ / Lưu lượng</span><b>${fx(n('G1.speed'), 1)} v/ph · ${fx(n('G1.flow'), 1)} m³/s</b>` +
        `<span>Cánh hướng / BXCT</span><b>${fx(n('G1.GV'), 1)}% / ${fx(n('G1.blade'), 1)}%</b>`;

      const g2Run = on('G2.running') || n('G2.mode') === 1;
      g2Pill.textContent = on('CB332') ? 'MC332 ĐÓNG' : 'MC332 CẮT';
      g2Pill.className = 's3d-pill ' + (on('CB332') ? 'red' : 'grn');
      g2Kv.innerHTML =
        `<span>Công suất P / Q</span><b>${fx(n('G2.Pload'), 2)} MW · ${fx(n('G2.Qload'), 2)} MVAr</b>` +
        `<span>Tốc độ / Lưu lượng</span><b>${fx(n('G2.speed'), 1)} v/ph · ${fx(n('G2.flow'), 1)} m³/s</b>` +
        `<span>Cánh hướng / BXCT</span><b>${fx(n('G2.GV'), 1)}% / ${fx(n('G2.blade'), 1)}%</b>`;

      netKv.innerHTML =
        `<span>Xuất tuyến ĐZ 371 (TC 31)</span><b>${fx(n('P371'), 2)} MW · ${fx(n('V371'), 1)} kV</b>` +
        `<span>Xuất tuyến ĐZ 372 (TC 32)</span><b>${fx(n('P372'), 2)} MW · ${fx(n('V372'), 1)} kV</b>` +
        `<span>DCL 312-1 / Tự dùng</span><b>${on('IS312_1') ? 'ĐÓNG' : 'MỞ'} · ${on('AXT1') ? 'TD 61' : (on('AXT2') ? 'TD 32' : (on('dgCb') ? 'DG' : 'CẮT'))}</b>`;

      actGate.textContent = gateOpen ? '⬇ Đóng cửa nhận nước' : '⬆ Mở cửa nhận nước';
      actGate.className = 's3d-act full ' + (gateOpen ? 'danger' : 'ok');
      actG1.textContent = g1Run ? '⏹ Dừng H1' : '▶ Khởi động H1';
      actG1.className = 's3d-act ' + (g1Run ? 'danger' : 'ok');
      actG2.textContent = g2Run ? '⏹ Dừng H2' : '▶ Khởi động H2';
      actG2.className = 's3d-act ' + (g2Run ? 'danger' : 'ok');
      actCB331.textContent = on('CB331') ? 'Cắt MC 331' : 'Đóng MC 331';
      actCB331.className = 's3d-act ' + (on('CB331') ? 'danger' : 'ok');
      actCB332.textContent = on('CB332') ? 'Cắt MC 332' : 'Đóng MC 332';
      actCB332.className = 's3d-act ' + (on('CB332') ? 'danger' : 'ok');

      if (labelsOn) worldLabels.forEach(lb => { lb.el.innerHTML = lb.html(); });
      if (pqOpen && typeof window.drawPQCurve === 'function') {
        window.drawPQCurve(pqCv1, 1, true);
        window.drawPQCurve(pqCv2, 2, true);
      }
      if (quickRefreshFn) quickRefreshFn();
      updateMiniSync(false);
    }
    U(updateHud);

    // -----------------------------------------------------------------------
    // 4.13 VÒNG HOẠT HÌNH 3D THỜI GIAN THỰC (F)
    // -----------------------------------------------------------------------
    let animT = 0, gatePosY = 13.8, hudTimer = 0;
    const projVec = new THREE.Vector3(), tmpPt = new THREE.Vector3(), tmpTan = new THREE.Vector3();
    const UP_VEC = new THREE.Vector3(0, 1, 0);

    F(dt => {
      syncSize();
      stepDemo(dt);
      animT += dt;
      if (demo.active) {
        hudTimer += dt;
        if (hudTimer >= 0.25) { hudTimer = 0; updateHud(); }
      }

      // 1. Camera damping & tự xoay
      if (autoRotate && !camCtrl.dragging) camCtrl.theta += dt * 0.14;
      const lerpF = 1 - Math.exp(-dt * 7.5);
      camCtrl.curTarget.lerp(camCtrl.target, lerpF);
      camCtrl.curTheta += (camCtrl.theta - camCtrl.curTheta) * lerpF;
      camCtrl.curPhi += (camCtrl.phi - camCtrl.curPhi) * lerpF;
      camCtrl.curDist += (camCtrl.dist - camCtrl.curDist) * lerpF;
      applyCameraImmediate();

      // 2. Hồ chứa thượng lưu & gợn sóng
      const headVal = Math.max(10, Math.min(45, n('HeadHigh') || n('zUp') || 30));
      const upTargetY = 4.5 + ((headVal - 10) / 35) * 12.2;
      upWaterMesh.position.y += (upTargetY - upWaterMesh.position.y) * Math.min(1, dt * 3);
      upWaterBody.position.y = upWaterMesh.position.y - 9.0;
      const uAttr = upWaterGeo.attributes.position;
      for (let i = 0; i < uAttr.count; i++) {
        const wx = uAttr.getX(i), wz = uAttr.getZ(i);
        uAttr.setY(i, upWaterBaseY[i] + Math.sin(wx * 0.35 + animT * 2.1) * 0.13 + Math.cos(wz * 0.28 - animT * 1.6) * 0.10);
      }
      uAttr.needsUpdate = true;

      // 3. Đập tràn tự do
      const qSpill = n('qSpill');
      spillGroup.visible = qSpill > 0.1;
      if (qSpill > 0.1) {
        const spScale = Math.min(1.6, 0.55 + qSpill * 0.12);
        matSpillSheet.opacity = Math.min(0.86, 0.45 + qSpill * 0.08 + Math.sin(animT * 6) * 0.05);
        spillParticles.visible = fxOn;
        if (fxOn) {
          for (let i = 0; i < spillPartCount; i++) {
            spillPhase[i] = (spillPhase[i] + dt * (0.65 + spScale * 0.35)) % 1;
            spillCurve.getPoint(spillPhase[i], tmpPt);
            spillPos[i * 3] = tmpPt.x + Math.sin(i * 12.3 + animT * 4) * 0.45;
            spillPos[i * 3 + 1] = tmpPt.y + 0.35 + (spillPhase[i] > 0.85 ? Math.sin(animT * 12 + i) * 0.7 : 0);
            spillPos[i * 3 + 2] = spillLane[i];
          }
          spillPartGeo.attributes.position.needsUpdate = true;
        }
      }

      // 4. Cửa van phẳng nhận nước & cáp tời
      const gateOpen = on('IntakeGate');
      gatePosY += ((gateOpen ? 13.8 : 7.3) - gatePosY) * Math.min(1, dt * 2.4);
      intakeGates.forEach(gt => { gt.position.y = gatePosY; });
      const cableLen = Math.max(0.5, 24.4 - (gatePosY + 2.4));
      intakeCables.forEach(c => { c.mesh.scale.y = cableLen; c.mesh.position.y = (gatePosY + 2.4) + cableLen * 0.5; });

      // 5. Kênh xả hạ lưu & bọt sóng trắng
      const zTail = Math.max(0, Math.min(8, n('zTail') || 1.8));
      tailWaterMesh.position.y += ((-3.4 + zTail * 0.45) - tailWaterMesh.position.y) * Math.min(1, dt * 3);
      for (let idx = 0; idx < 2; idx++) {
        const tf = tailFoams[idx], gKey = 'G' + (idx + 1) + '.';
        const fl = gateOpen ? n(gKey + 'flow') : 0;
        const active = fxOn && (fl > 0.5 || on(gKey + 'running'));
        tf.pts.visible = active; tf.ring.visible = active;
        if (active) {
          const intensity = Math.min(1.5, 0.35 + fl / 38);
          tf.ring.position.y = tailWaterMesh.position.y + 0.08;
          const scR = (0.75 + intensity * 0.55) + Math.sin(animT * 5 + idx) * 0.08;
          tf.ring.scale.set(scR, scR, 1);
          for (let i = 0; i < tf.count; i++) {
            let u = tf.seed[i * 3] + dt * (0.45 + intensity * 0.55) * tf.seed[i * 3 + 2];
            if (u > 1) u -= 1; tf.seed[i * 3] = u;
            tf.pos[i * 3] = 15.6 + u * 13.0 * intensity;
            tf.pos[i * 3 + 1] = tailWaterMesh.position.y + 0.14 + Math.sin(u * Math.PI) * 0.55 * intensity;
            tf.pos[i * 3 + 2] = tf.uz + tf.seed[i * 3 + 1] * (0.5 + u * 0.85);
          }
          tf.geo.attributes.position.needsUpdate = true;
        }
      }

      // 6. Hai tổ máy Kaplan H1 & H2: quay đồng bộ, cánh hướng 0-45°, góc cánh Kaplan, servo, phanh & hạt nước
      units3D.forEach(u => {
        const g = 'G' + u.no + '.';
        const rpm = n(g + 'speed');
        const gv = Math.max(0, Math.min(100, n(g + 'GV')));
        const bladePct = Math.max(0, Math.min(100, n(g + 'blade')));
        const flow = gateOpen ? n(g + 'flow') : 0;

        u.rotatingGroup.rotation.y -= (rpm / 214.3) * Math.PI * 2 * 1.35 * dt;
        // Góc cánh BXCT theo QT −10° ~ +12° & đồng bộ cơ cấu đổi góc (piston – thanh truyền – con trượt – thanh nối – tay quay)
        const pitchRad = (-10 + (bladePct / 100) * 22) * (Math.PI / 180);
        u.bladePivots.forEach(bp => { bp.rotation.x = pitchRad; });
        if (Math.abs(bladePct - u.lastBladePct) > 0.01) {
          u.lastBladePct = bladePct;
          const dy = 0.34 * Math.sin(pitchRad);
          u.pitchRodAssembly.position.y = dy;
          const pCrossY = -0.34 + dy;
          const pCrankY = 0.05 + dy;
          const pCrankZ = -0.34 * Math.cos(pitchRad);
          tmpLinkDir.set(0.29 - 0.28, pCrankY - pCrossY, pCrankZ - (-0.32));
          const linkLen = tmpLinkDir.length();
          tmpLinkDir.divideScalar(Math.max(0.001, linkLen));
          tmpLinkQuat.setFromUnitVectors(UP_Y, tmpLinkDir);
          const midX = (0.28 + 0.29) * 0.5;
          const midY = (pCrossY + pCrankY) * 0.5;
          const midZ = (-0.32 + pCrankZ) * 0.5;
          for (let li = 0; li < u.pitchLinks.length; li++) {
            const lk = u.pitchLinks[li];
            lk.position.set(midX, midY, midZ);
            lk.scale.set(1, linkLen, 1);
            lk.quaternion.copy(tmpLinkQuat);
          }
        }

        const gvRad = (gv / 100) * (Math.PI / 4);
        u.wicketGates.forEach(wg => { wg.pivot.rotation.y = wg.baseAngle - gvRad; });
        u.opRing.rotation.y = gvRad * 0.45;
        u.servoRods.forEach(sr => { sr.rod.position.x = -sr.side * (0.85 + (gv / 100) * 0.55); });

        const braking = (S[g + 'airBrake'] !== undefined) ? !on(g + 'airBrake') : false;
        if (braking) {
          const pulse = 0.65 + 0.35 * Math.sin(animT * 10);
          u.brakeMat.color.setHex(0xff3333); u.brakeMat.emissive.setHex(0xff1111); u.brakeMat.emissiveIntensity = 1.4 * pulse;
          u.brakePads.forEach(p => { p.position.y = 6.91; });
        } else {
          u.brakeMat.color.setHex(0x64748b); u.brakeMat.emissive.setHex(0x000000); u.brakeMat.emissiveIntensity = 0;
          u.brakePads.forEach(p => { p.position.y = 6.76; });
        }

        const showFlow = fxOn && gateOpen && flow > 0.2;
        u.flowPoints.visible = showFlow;
        if (showFlow) {
          const spd = Math.min(1.3, 0.14 + (flow / 49.2) * 0.78);
          for (let i = 0; i < u.flowCount; i++) {
            let t = u.flowU[i] + spd * dt;
            if (t >= 1) t -= 1; u.flowU[i] = t;
            const oa = u.flowOffA[i], or = u.flowOffR[i];
            if (t < 0.42) {
              u.penCurve.getPoint(t / 0.42, tmpPt);
              u.flowPos[i * 3] = tmpPt.x + Math.cos(oa) * 0.45 * or;
              u.flowPos[i * 3 + 1] = tmpPt.y + Math.sin(oa) * 0.92 * or;
              u.flowPos[i * 3 + 2] = tmpPt.z + Math.cos(oa + 1.1) * 0.92 * or;
            } else if (t < 0.72) {
              const k = (t - 0.42) / 0.30;
              const ang = Math.PI + k * Math.PI * 2.1 + oa * 0.25;
              const r = 2.85 * (1 - k * 0.58) + (or - 0.5) * 0.38;
              u.flowPos[i * 3] = 4 + Math.cos(ang) * r;
              u.flowPos[i * 3 + 1] = 1.2 - k * 1.18 + Math.sin(oa) * 0.32;
              u.flowPos[i * 3 + 2] = u.uz + Math.sin(ang) * r;
            } else {
              const k = (t - 0.72) / 0.28;
              u.draftCurve.getPoint(k, tmpPt);
              const swirl = k * 8.0 + oa;
              u.flowPos[i * 3] = 4 + tmpPt.x + Math.cos(swirl) * 0.7 * or;
              u.flowPos[i * 3 + 1] = tmpPt.y + Math.sin(swirl) * 0.7 * or;
              u.flowPos[i * 3 + 2] = u.uz + Math.cos(swirl + 1.5) * 0.75 * or;
            }
          }
          u.flowGeo.attributes.position.needsUpdate = true;
        }

        // Cảnh báo quá nhiệt Stator (báo 110°C / cắt 120°C) & Ổ đỡ trục (dầu ổ đỡ 50°C/55°C Điều 12, bạc ổ đỡ 60°C/65°C)
        const tStator = n(g + 'stator');
        const tThrustPad = n(g + 'thrust');
        const tThrustOil = S[g + 'thrustOil'] !== undefined ? n(g + 'thrustOil') : tThrustPad;
        const stHot = tStator >= 110;
        const thHot = tThrustOil >= 50 || tThrustPad >= 60;
        const heatPulse = 0.55 + 0.45 * Math.sin(animT * 7.5);
        if (stHot) {
          const sev = tStator >= 120 ? 1.0 : 0.65;
          u.statorCoreMat.emissive.setHex(0xff3b00);
          u.statorCoreMat.emissiveIntensity = (0.7 + 0.7 * heatPulse) * sev;
          u.statorWindingMat.emissive.setHex(0xff5500);
          u.statorWindingMat.emissiveIntensity = (0.8 + 0.8 * heatPulse) * sev;
          u.statorHeatRing.visible = true;
          u.statorHeatRingMat.opacity = (0.22 + 0.24 * heatPulse) * sev;
        } else {
          u.statorCoreMat.emissive.setHex(0x000000);
          u.statorCoreMat.emissiveIntensity = 0;
          u.statorWindingMat.emissive.setHex(0x000000);
          u.statorWindingMat.emissiveIntensity = 0;
          u.statorHeatRing.visible = false;
        }
        if (thHot) {
          const sev = (tThrustOil >= 55 || tThrustPad >= 65) ? 1.0 : 0.65;
          u.thrustBearingMat.emissive.setHex(0xff3b00);
          u.thrustBearingMat.emissiveIntensity = (0.85 + 0.85 * heatPulse) * sev;
          u.thrustHeatRing.visible = true;
          u.thrustHeatRingMat.opacity = (0.35 + 0.35 * heatPulse) * sev;
        } else {
          u.thrustBearingMat.emissive.setHex(0x000000);
          u.thrustBearingMat.emissiveIntensity = 0;
          u.thrustHeatRing.visible = false;
        }
      });

      // 7. Phụ trợ: cánh bơm quay, màu ống nước làm mát, Diesel rung + khói
      rotatingPumps.forEach(p => {
        const running = on(p.key);
        if (running) { p.imp.rotation.x += dt * 14.0; p.lampMat.color.setHex(0x22c55e); p.lampMat.emissive.setHex(0x22c55e); }
        else { p.lampMat.color.setHex(0x475569); p.lampMat.emissive.setHex(0x000000); }
      });
      const cw1On = (on('G1.waterPump1') || on('G1.waterPump2')) && (on('G1.cwValve') || n('G1.cwPress') > 5);
      const cw2On = (on('G2.waterPump1') || on('G2.waterPump2')) && (on('G2.cwValve') || n('G2.cwPress') > 5);
      cwPipeMat1.color.setHex(cw1On ? 0x0284c7 : 0x64748b); cwPipeMat1.emissive.setHex(cw1On ? 0x0369a1 : 0x000000);
      cwPipeMat2.color.setHex(cw2On ? 0x0284c7 : 0x64748b); cwPipeMat2.emissive.setHex(cw2On ? 0x0369a1 : 0x000000);

      const dgOn = on('dgEngine');
      if (dgOn) {
        dieselGroup.position.set(dgBasePos.x + Math.sin(animT * 52) * 0.035, dgBasePos.y + Math.cos(animT * 64) * 0.02, dgBasePos.z + Math.sin(animT * 46) * 0.03);
        dgLampMat.color.setHex(0xff5252); dgLampMat.emissive.setHex(0xff2222); dgLampMat.emissiveIntensity = 1.4 + 0.6 * Math.sin(animT * 8);
      } else {
        dieselGroup.position.copy(dgBasePos);
        dgLampMat.color.setHex(0x334155); dgLampMat.emissive.setHex(0x000000); dgLampMat.emissiveIntensity = 0;
      }
      smokePts.visible = dgOn && fxOn;
      if (dgOn && fxOn) {
        for (let i = 0; i < smokeCount; i++) {
          smokeLife[i] = (smokeLife[i] + dt * 0.42) % 1;
          const lf = smokeLife[i];
          smokePos[i * 3] = dgBasePos.x - 1.3 + lf * 2.2 + Math.sin(animT * 2 + i) * 0.35 * lf;
          smokePos[i * 3 + 1] = dgBasePos.y + 6.1 + lf * 5.2;
          smokePos[i * 3 + 2] = dgBasePos.z - 0.5 + Math.cos(animT * 1.7 + i) * 0.45 * lf;
        }
        smokeGeo.attributes.position.needsUpdate = true;
      }

      // 8. Quạt MBA, Máy cắt (ĐỎ = Đóng / XANH = Cắt), 7 DCL & 12 Dao tiếp địa xoay cơ khí mượt ~1.2 giây (90° -> 0°)
      trafoFans.forEach(f => {
        const active = f.unitNo === 1 ? (on('CB331') || n('G1.Pload') > 0.2) : (on('CB332') || n('G2.Pload') > 0.2);
        if (active) f.blades.rotation.z += dt * 11.0;
      });
      breakerWidgets.forEach(bw => {
        const closed = on(bw.key);
        bw.indMat.color.setHex(closed ? 0xef4444 : 0x22c55e);
        if (bw.indMat !== prevHighlightMat) {
          bw.indMat.emissive.setHex(closed ? 0xdc2626 : 0x16a34a);
        }
        bw.indMat.emissiveIntensity = closed ? (0.95 + 0.2 * Math.sin(animT * 4)) : 0.7;
      });
      // Nội suy mượt trong 1.2 giây (smoothstep 0..1) giữa góc MỞ 90° và góc ĐÓNG 0° (khép kín vào ngàm tiếp điểm)
      const swStep = dt / 1.2;
      disconnectorWidgets.forEach(dw => {
        const closed = on(dw.key);
        const targetProg = closed ? 1 : 0;
        if (dw.prog === null) {
          dw.prog = targetProg;
        } else if (dw.prog < targetProg) {
          dw.prog = Math.min(targetProg, dw.prog + swStep);
        } else if (dw.prog > targetProg) {
          dw.prog = Math.max(targetProg, dw.prog - swStep);
        }
        const eased = dw.prog * dw.prog * (3 - 2 * dw.prog);
        const curAng = (1 - eased) * dw.openAngle; // prog=0 -> openAngle (±90°), prog=1 -> 0° (Đóng kín vào ngàm)
        for (let i = 0; i < dw.blades.length; i++) {
          dw.blades[i].rotation[dw.axis] = curAng;
        }
        if (dw.driveShaft) {
          dw.driveShaft.rotation[dw.axis] = curAng * 0.65;
        }
        if (dw.linkRods) {
          const baseY = dw.baseLinkY || 2.52;
          for (let i = 0; i < dw.linkRods.length; i++) {
            dw.linkRods[i].position.y = baseY + (1 - eased) * 0.24;
            dw.linkRods[i].rotation.z = (1 - eased) * 0.20;
          }
        }
        if (dw.isGround && dw.indMat) {
          dw.indMat.color.setHex(closed ? 0xf97316 : 0x22c55e);
          dw.indMat.emissive.setHex(closed ? 0xea580c : 0x16a34a);
          dw.indMat.emissiveIntensity = closed ? (1.1 + 0.35 * Math.sin(animT * 6)) : 0.45;
        }
      });

      // Nhấp nháy nhẹ khung sáng Hover Highlight khi đang trỏ chuột vào thiết bị 3D
      if (hoverHighlightGroup.visible) {
        hoverGlowMat.opacity = 0.12 + 0.08 * Math.sin(animT * 7.0);
        hoverEdgeMat.opacity = 0.78 + 0.22 * Math.sin(animT * 7.0);
      }

      // 9. Màu mang điện trên từng đoạn dây (#c0392b đỏ cam có xung điện / #7c8a99 xám kim loại khi mất điện)
      liveWireGroups.forEach(grp => {
        const live = grp.isLiveFn();
        const showPulses = fxOn && live && grp.hasPowerFn();
        grp.mat.color.setHex(live ? 0xc0392b : 0x7c8a99);
        grp.mat.emissive.setHex(live ? 0x7f1d1d : 0x000000);
        grp.mat.emissiveIntensity = live ? 0.48 : 0;
        grp.pulses.forEach(p => {
          p.mesh.visible = showPulses;
          if (showPulses) {
            p.u = (p.u + dt * 0.55) % 1;
            p.curve.getPoint(p.u, p.mesh.position);
          }
        });
      });

      // 9b. Vector mũi tên hướng dòng công suất P (cam) & Q (xanh lơ) – đổi chiều tự động theo dấu P, Q
      powerFlowTracks.forEach(tr => {
        const val = tr.valFn();
        const absV = Math.abs(val);
        const show = fxOn && absV > 0.05;
        const dir = val >= 0 ? 1 : -1;
        const spd = Math.min(0.42, 0.08 + absV * 0.035);
        const sc = Math.min(1.35, 0.72 + absV * 0.075);
        for (let i = 0; i < tr.arrows.length; i++) {
          const ar = tr.arrows[i];
          ar.mesh.visible = show;
          if (!show) continue;
          ar.u = (ar.u + dir * spd * dt) % 1;
          if (ar.u < 0) ar.u += 1;
          tr.curve.getPoint(ar.u, ar.mesh.position);
          tr.curve.getTangent(ar.u, tmpTan);
          if (dir < 0) tmpTan.negate();
          tmpTan.normalize();
          ar.mesh.quaternion.setFromUnitVectors(UP_VEC, tmpTan);
          ar.mesh.scale.setScalar(sc);
        }
      });

      // 9c. Trực quan hóa Hồ quang tại dao (tối thiểu 4s: 1,5s sáng mạnh -> tắt dần, khói còn tới 4s) & Ngắn mạch S.scFaults
      const nowPerf = performance.now();
      const scList = S.scFaults || [];
      const scLowList = scList.map(x => String(x || '').toLowerCase());

      // Chế độ demo ngoại tuyến: đóng nhầm dao tiếp địa mang điện kích hoạt cùng hiệu ứng 4s
      const isOnlineNow = (typeof online !== 'undefined' && online);
      for (let i = 0; i < liveGroundFaultChecks.length; i++) {
        const gc = liveGroundFaultChecks[i];
        const liveNow = on(gc.key) && gc.liveFn();
        if (liveNow && !gc._wasLive && !isOnlineNow) {
          const code = gc.key.replace(/^GS/, '').replace(/_/g, '-');
          triggerArcBurst(gc.label, code, gc.pos);
        }
        gc._wasLive = liveNow;
      }

      // Loại bỏ các đợt hồ quang đã hết thời gian (>= 4.2s) và không còn ngắn mạch đang cháy tại cùng điểm
      for (let i = arcBursts.length - 1; i >= 0; i--) {
        const b = arcBursts[i];
        const age = (nowPerf - b.startMs) / 1000;
        const stillLiveSc = b.suppressNode && scLowList.some(s => s.includes(b.suppressNode));
        if (age >= ARC_TOTAL_DUR && !stillLiveSc) {
          arcBursts.splice(i, 1);
        }
      }

      const activeFaults = [];
      let latestArcBurst = null;
      for (let i = 0; i < arcBursts.length; i++) {
        const b = arcBursts[i];
        const age = Math.max(0, (nowPerf - b.startMs) / 1000);
        const stillLiveSc = b.suppressNode && scLowList.some(s => s.includes(b.suppressNode));
        let arcStrength = 0;
        if (stillLiveSc || age <= ARC_PEAK_DUR) {
          arcStrength = 1.0;
        } else if (age < ARC_FADE_END) {
          arcStrength = Math.max(0, 1.0 - (age - ARC_PEAK_DUR) / (ARC_FADE_END - ARC_PEAK_DUR));
        }
        let smokeOpacity = 0.86;
        if (!stillLiveSc) {
          if (age < 0.25) smokeOpacity = 0.86 * (0.35 + 0.65 * (age / 0.25));
          else if (age > 3.5) smokeOpacity = 0.86 * Math.max(0, (ARC_TOTAL_DUR - age) / (ARC_TOTAL_DUR - 3.5));
        }
        const incTxt = (S.incident && String(S.incident).trim()) ? String(S.incident).trim() : b.text;
        activeFaults.push({
          label: incTxt || ('Hồ quang tại dao ' + b.code),
          pos: b.pos,
          arcStrength,
          smokeOpacity,
          isBurst: true
        });
        latestArcBurst = b;
      }

      // Ngắn mạch do giáo viên đặt (S.scFaults): giữ cách hiển thị hiện tại; bỏ qua mục trùng điểm thanh cái do hồ quang dao đang phát
      for (let i = 0; i < scList.length; i++) {
        const scLow = scLowList[i];
        const coveredBySwitchArc = arcBursts.some(b => b.suppressNode && scLow.includes(b.suppressNode));
        if (coveredBySwitchArc) continue;
        activeFaults.push({
          label: 'NGẮN MẠCH: ' + scList[i],
          pos: mapFaultTextToPos(scList[i]),
          arcStrength: 1.0,
          smokeOpacity: 0.86,
          isBurst: false
        });
      }

      for (let idx = 0; idx < faultEmitters.length; idx++) {
        const em = faultEmitters[idx];
        const f = activeFaults[idx];
        if (!f) {
          em.grp.visible = false;
          em.arcLight.intensity = 0;
          continue;
        }
        em.grp.visible = true;
        em.grp.position.copy(f.pos);
        const aStr = f.arcStrength;
        const showArc = aStr > 0.015;
        em.coreSphere.visible = showArc;
        em.haloSphere.visible = showArc;
        if (showArc) {
          const flash = Math.random() > 0.22 ? (1.2 + Math.random() * 2.6) : 0.25;
          em.arcLight.intensity = flash * 2.4 * aStr;
          const cSc = (0.65 + Math.random() * 0.95) * (0.4 + 0.6 * aStr);
          em.coreSphere.scale.setScalar(cSc);
          em.coreMat.opacity = 0.95 * aStr;
          em.haloSphere.scale.setScalar((0.9 + Math.random() * 1.15) * (0.45 + 0.55 * aStr));
          em.haloMat.opacity = (0.28 + Math.random() * 0.45) * aStr;
          em.boltMat.opacity = 0.95 * aStr;
          // Dựng lại 6 tia hồ quang điện gãy khúc ngẫu nhiên mỗi khung hình
          for (let b = 0; b < em.bolts.length; b++) {
            const bolt = em.bolts[b];
            bolt.line.visible = true;
            const reach = 0.45 + 0.55 * aStr;
            const dirX = (Math.random() - 0.5) * 2.8 * reach;
            const dirY = (Math.random() - 0.2) * 2.6 * reach;
            const dirZ = (Math.random() - 0.5) * 2.8 * reach;
            for (let k = 0; k < 7; k++) {
              const frac = k / 6;
              const jit = k === 0 ? 0 : 0.42 * reach;
              bolt.pts[k * 3] = dirX * frac + (Math.random() - 0.5) * jit;
              bolt.pts[k * 3 + 1] = dirY * frac + (Math.random() - 0.5) * jit;
              bolt.pts[k * 3 + 2] = dirZ * frac + (Math.random() - 0.5) * jit;
            }
            bolt.geo.attributes.position.needsUpdate = true;
          }
        } else {
          em.arcLight.intensity = 0;
          for (let b = 0; b < em.bolts.length; b++) em.bolts[b].line.visible = false;
        }
        // Cột khói bốc cao từ điểm sự cố (còn tới 4s sau khi hồ quang tắt)
        em.smokeMat.opacity = f.smokeOpacity;
        em.smoke.visible = f.smokeOpacity > 0.02;
        if (em.smoke.visible) {
          for (let i = 0; i < em.sCnt; i++) {
            em.sLife[i] = (em.sLife[i] + dt * 0.36) % 1;
            const lf = em.sLife[i], sd = em.sSeed[i];
            const spread = 0.35 + lf * 2.4;
            em.sPos[i * 3] = Math.cos(sd + animT * 1.4) * spread + lf * 1.6;
            em.sPos[i * 3 + 1] = 0.4 + lf * 13.5;
            em.sPos[i * 3 + 2] = Math.sin(sd + animT * 1.2) * spread;
          }
          em.sGeo.attributes.position.needsUpdate = true;
        }
      }

      // Cập nhật Banner cảnh báo sự cố & quá nhiệt + kim Đồng bộ kế nổi mượt 60fps
      const warnMsgs = activeFaults.map(x => x.label);
      const oil1 = S['G1.thrustOil'] !== undefined ? n('G1.thrustOil') : n('G1.thrust');
      const oil2 = S['G2.thrustOil'] !== undefined ? n('G2.thrustOil') : n('G2.thrust');
      if (n('G1.stator') >= 110) warnMsgs.push(`QUÁ NHIỆT STATOR H1 (${fx(n('G1.stator'), 1)}°C)`);
      if (n('G2.stator') >= 110) warnMsgs.push(`QUÁ NHIỆT STATOR H2 (${fx(n('G2.stator'), 1)}°C)`);
      if (oil1 >= 50) warnMsgs.push(`QUÁ NHIỆT DẦU Ổ ĐỠ H1 (${fx(oil1, 1)}°C)`);
      else if (n('G1.thrust') >= 60) warnMsgs.push(`QUÁ NHIỆT BẠC Ổ ĐỠ H1 (${fx(n('G1.thrust'), 1)}°C)`);
      if (oil2 >= 50) warnMsgs.push(`QUÁ NHIỆT DẦU Ổ ĐỠ H2 (${fx(oil2, 1)}°C)`);
      else if (n('G2.thrust') >= 60) warnMsgs.push(`QUÁ NHIỆT BẠC Ổ ĐỠ H2 (${fx(n('G2.thrust'), 1)}°C)`);
      if (warnMsgs.length > 0) {
        faultBanner.style.display = 'flex';
        faultBanner.textContent = '⚠ ' + warnMsgs.slice(0, 2).join('  |  ');
      } else {
        faultBanner.style.display = 'none';
      }
      if (!miniSync.classList.contains('hidden')) {
        msNeedle.setAttribute('transform', `rotate(${n('G' + syncTargetUnit + '.phase').toFixed(1)} 60 60)`);
      }

      // 10. Render & chiếu nhãn 3D
      renderer.render(scene, camera);
      if (latestArcBurst && lastW > 0 && lastH > 0) {
        const incText = (S.incident && String(S.incident).trim()) ? String(S.incident).trim() : latestArcBurst.text;
        const htmlStr = `<b>⚡ HỒ QUANG${latestArcBurst.code ? ' – DAO ' + escHtml3d(latestArcBurst.code) : ''}</b><span>${escHtml3d(incText)}</span>`;
        if (htmlStr !== lastArcLabelHtml) {
          arcLabelEl.innerHTML = htmlStr;
          lastArcLabelHtml = htmlStr;
        }
        projVec.set(latestArcBurst.pos.x, latestArcBurst.pos.y + 2.4, latestArcBurst.pos.z).project(camera);
        const inFront = projVec.z >= -1 && projVec.z <= 1;
        const sx = Math.max(175, Math.min(lastW - 175, (projVec.x * 0.5 + 0.5) * lastW));
        const sy = Math.max(68, Math.min(lastH - 54, (-projVec.y * 0.5 + 0.5) * lastH));
        if (inFront) {
          arcLabelEl.style.display = 'block';
          arcLabelEl.style.left = sx.toFixed(1) + 'px';
          arcLabelEl.style.top = sy.toFixed(1) + 'px';
        } else {
          arcLabelEl.style.display = 'none';
        }
      } else {
        arcLabelEl.style.display = 'none';
      }
      if (labelsOn && lastW > 0 && lastH > 0) {
        const nextFocus = (camCtrl.curTarget.z > 0 && camCtrl.curDist < 42) ? 2 : 1;
        if (nextFocus !== focusedUnitNo) {
          focusedUnitNo = nextFocus;
          const fz = focusedUnitNo === 2 ? 8 : -8;
          for (let i = 0; i < worldLabels.length; i++) {
            const lb = worldLabels[i];
            if (lb.unitFocus) {
              lb.pos.set(4 + lb.localOff[0], lb.localOff[1], fz + lb.localOff[2]);
              lb.el.innerHTML = lb.html();
            }
          }
        }
        for (let i = 0; i < worldLabels.length; i++) {
          const lb = worldLabels[i];
          if (lb.detailMaxDist && !xrayOn && camCtrl.curDist > lb.detailMaxDist) {
            lb.el.style.display = 'none';
            continue;
          }
          projVec.copy(lb.pos).project(camera);
          const inFront = projVec.z >= -1 && projVec.z <= 1;
          const sx = (projVec.x * 0.5 + 0.5) * lastW;
          const sy = (-projVec.y * 0.5 + 0.5) * lastH;
          if (inFront && sx > -90 && sx < lastW + 90 && sy > -40 && sy < lastH + 40) {
            lb.el.style.display = 'block';
            lb.el.style.left = sx.toFixed(1) + 'px';
            lb.el.style.top = sy.toFixed(1) + 'px';
          } else {
            lb.el.style.display = 'none';
          }
        }
      }
    });

    if (!(typeof online !== 'undefined' && online) && !demo.initialized) initDemoState();
    updateHud();
    setTimeout(syncSize, 60);
  });

  // =========================================================================
  // 5. GẮN NÚT ĐIỀU HƯỚNG & SECTION VÀO DOM NGAY SAU 'turbine2'
  // =========================================================================
  (function mountView3dPage() {
    if (typeof pages === 'undefined' || !Array.isArray(pages)) return;
    const pg = pages.find(x => x.id === 'view3d');
    if (!pg || pg.el) return;
    const mainEl = $('pages'), navEl = $('nav');
    if (!mainEl || !navEl) return;

    if (typeof NAV !== 'undefined' && Array.isArray(NAV)) {
      pages.sort((a, b) => NAV.indexOf(a.id) - NAV.indexOf(b.id));
    }
    pg.el = h('section', { class: 'page', id: 'pg-' + pg.id }, mainEl);
    pg.btn = h('button', { onclick: () => show(pg.id) }, null, pg.title);

    const anchorPg = pages.find(x => x.id === 'turbine2');
    if (anchorPg && anchorPg.btn && anchorPg.btn.parentNode === navEl) {
      navEl.insertBefore(pg.btn, anchorPg.btn.nextSibling);
    } else {
      navEl.appendChild(pg.btn);
    }
    if (typeof kiosk !== 'undefined' && kiosk && typeof KIOSK_HIDE !== 'undefined' && KIOSK_HIDE.includes(pg.id)) {
      pg.btn.classList.add('hidden');
    }
    if (location.hash === '#view3d') show('view3d');
  })();
})();
