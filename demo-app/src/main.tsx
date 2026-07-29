import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// TODO: Remove later
import "./colorLogger.ts"; // Added temporarily to see the logs in the console in easier to read format. Remove Later

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
