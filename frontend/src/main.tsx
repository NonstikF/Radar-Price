import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// 1. IMPORTAR BROWSER ROUTER
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 2. ENVOLVER TU APP AQUÍ */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)