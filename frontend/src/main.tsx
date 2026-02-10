import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ¡YA NO IMPORTES BrowserRouter AQUÍ!

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Solo renderiza <App />, él ya tiene su propio Router adentro */}
    <App />
  </React.StrictMode>,
)