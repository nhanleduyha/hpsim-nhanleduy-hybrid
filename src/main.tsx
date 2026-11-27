import { createLocalApi, type LocalApi } from './localApi';
import type { HpsSim } from './sim/HpsSim';

declare global {
  interface Window {
    localApi: LocalApi;
    __hpsSim: HpsSim;
  }
}

function loadScriptSequential(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Không tải được script: ${src}`));
    document.body.appendChild(s);
  });
}

async function boot(): Promise<void> {
  const localApi = createLocalApi();
  window.localApi = localApi;
  window.__hpsSim = localApi.sim;

  const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');
  await loadScriptSequential(`${base}ops.js`);
  await loadScriptSequential(`${base}app.js`);
  await loadScriptSequential(`${base}three.min.js`);
  await loadScriptSequential(`${base}sim3d.js`);
}

boot().catch((err) => {
  console.error('Lỗi khởi động mô phỏng HPS:', err);
});
