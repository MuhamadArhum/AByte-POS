// =============================================================
// main.jsx - Application Entry Point (React)
// This is the very first file that runs when the app loads.
// It mounts the React app into the HTML page (index.html).
// StrictMode enables extra development warnings for best practices.
// =============================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'      // Global CSS styles for the entire application
import App from './App.jsx'  // Root component with routing and providers

// Mount the React app into the <div id="root"> element in index.html
// StrictMode: helps find common bugs by running components twice in development
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
