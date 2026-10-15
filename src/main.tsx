import React, { Component, ReactNode, ErrorInfo } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          backgroundColor: '#FFFBEB',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ fontSize: '72px', marginBottom: '16px' }}>🦁</div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#92400E', marginBottom: '8px' }}>
            Animal Friends
          </h1>
          <p style={{ color: '#78350F', marginBottom: '24px', maxWidth: '400px' }}>
            Let&apos;s get ready to play with our animal friends!
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '14px 28px',
              fontSize: '18px',
              fontWeight: 800,
              color: '#FFFFFF',
              backgroundColor: '#F59E0B',
              border: 'none',
              borderRadius: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
          >
            Start Playing 🐾
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function mount() {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  const appElement = (
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );

  try {
    if (rootEl.hasChildNodes()) {
      hydrateRoot(rootEl, appElement);
    } else {
      createRoot(rootEl).render(appElement);
    }
  } catch (err) {
    console.warn('Hydration fallback to createRoot:', err);
    createRoot(rootEl).render(appElement);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
