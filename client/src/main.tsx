import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SOSProvider } from './context/SOSContext';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SOSProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a25',
                color: '#f0f0f5',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
              },
            }}
          />
        </SOSProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
