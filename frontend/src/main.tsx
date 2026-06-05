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
        <div class="app-boot-glow"></div>
        <div class="app-boot-card">
          <div class="app-boot-logo">E</div>
          <div class="app-boot-title">Echo</div>
          <div class="app-boot-subtitle">轻量级即时通讯空间</div>
          <div class="app-boot-status">
            <div class="app-boot-text">连接服务失败</div>
            <div class="app-boot-actions">
              <button class="app-boot-button app-boot-button-primary" onclick="location.reload()">重试</button>
              <button class="app-boot-button app-boot-button-secondary" onclick="location.assign('/#/login')">体验模式</button>
            </div>
          </div>
        </div>
        <div class="app-boot-footer">Echo IM · Modern Communication Platform</div>
      </div>
    `;
  }
}
