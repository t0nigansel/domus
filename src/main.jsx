import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CloudApp from './CloudApp.jsx'

import { ThemeProvider } from './context/ThemeContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      {import.meta.env.MODE === 'cloud' ? <CloudApp /> : <App />}
    </ThemeProvider>
  </StrictMode>,
)
