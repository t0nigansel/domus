import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CloudApp from './CloudApp.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import LegalPage from './pages/LegalPage.jsx'

import { ThemeProvider } from './context/ThemeContext'

const legalPage = window.location.pathname.match(/^\/(impressum|datenschutz)(?:\.html)?\/?$/)?.[1]

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <div className="app-content">
        {legalPage ? <LegalPage page={legalPage} /> : import.meta.env.MODE === 'cloud' ? <CloudApp /> : <App />}
      </div>
      <SiteFooter />
    </ThemeProvider>
  </StrictMode>,
)
