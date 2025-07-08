import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="card mb-2">
        <div className="flex flex-between">
          <div className="flex gap-2">
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>🎲 Betting System</h1>
            {user && (
              <span className="text-secondary">
                Welcome, {user.username}!
              </span>
            )}
          </div>
          
          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            <button onClick={handleLogout} className="btn btn-danger">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="card mb-2">
        <div className="flex gap-1">
          <Link
            to="/dashboard"
            className={`btn ${isActive('/dashboard') ? 'btn-primary' : ''}`}
          >
            📊 Dashboard
          </Link>
          <Link
            to="/bets"
            className={`btn ${isActive('/bets') ? 'btn-primary' : ''}`}
          >
            🎯 Bets
          </Link>
          <Link
            to="/transactions"
            className={`btn ${isActive('/transactions') ? 'btn-primary' : ''}`}
          >
            💰 Transactions
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <main className="container">
        {children}
      </main>

      {/* Footer */}
      <footer className="text-center text-secondary mt-2">
        <p>Betting System - Test Application with HMAC SHA-512 Authentication</p>
        <p>50/50 chance • 2x payout on win</p>
      </footer>
    </div>
  );
}; 