import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootEl = document.getElementById('root')

try {
  if (!rootEl) throw new Error('Root element not found')
  rootEl.dataset.ready = '1'
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (err) {
  console.error(err)
  if (rootEl) {
    rootEl.innerHTML = `
      <div class="app-boot-fallback">
        <div class="app-boot-logo">Echo</div>
        <div class="app-boot-text">加载失败，请刷新或用系统浏览器打开</div>
        <button class="app-boot-button" onclick="location.reload()">重新加载</button>
      </div>
    `
  }
}
