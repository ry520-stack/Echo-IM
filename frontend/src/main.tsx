import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootEl = document.getElementById('root');

try {
  if (!rootEl) throw new Error('Root element not found');
  rootEl.dataset.ready = '1';
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  console.error(err);
  if (rootEl) {
    rootEl.innerHTML = `
      <div class="app-boot-fallback">
        <div class="app-boot-card">
          <div class="app-boot-logo">E</div>
          <div class="app-boot-title">Echo</div>
          <div class="app-boot-subtitle">新一代轻量级即时通讯空间</div>
          <div class="app-boot-status">
            <div class="app-boot-text">Echo 服务连接失败</div>
            <button class="app-boot-button" style="margin-top:14px;height:48px;width:100%;" onclick="location.reload()">重试</button>
          </div>
        </div>
        <div class="app-boot-footer">Echo IM · Real-time Communication Platform</div>
      </div>
    `;
  }
}
