import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Dev only: window.__uploadBlueprints() (signed in as the admin) uploads the
// sheets in private/blueprints to the private store
if (import.meta.env.DEV) {
  window.__uploadBlueprints = () => import('./model/blueprintStore.js').then((m) => m.uploadBlueprintsFromLocal())
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
