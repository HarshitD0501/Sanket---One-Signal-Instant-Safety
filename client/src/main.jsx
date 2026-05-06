import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SOSProvider } from './context/SOSContext';
import { Toaster } from 'react-hot-toast';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SOSProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
              },
              success: {
                iconTheme: { primary: 'var(--safe-green)', secondary: '#000' },
              },
              error: {
                iconTheme: { primary: 'var(--sos-red)', secondary: '#000' },
              },
            }}
          />
        </SOSProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
