import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      await login({ username: username.trim() });
      navigate('/dashboard');
    } catch (error) {
      // Error is handled by useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-center" style={{ minHeight: '100vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-2">
          <h1>🎲 Betting System</h1>
          <p className="text-secondary">Test Application with HMAC SHA-512 Authentication</p>
          <p className="text-secondary">50/50 chance • 2x payout on win</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {error && (
            <div className="card" style={{ backgroundColor: 'var(--color-danger)', marginBottom: '1rem' }}>
              <p style={{ margin: 0, color: 'white' }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={isSubmitting || !username.trim()}
          >
            {isSubmitting ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-2 text-center">
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>
            Available test users: user1, user2, user3, user4, user5
          </p>
        </div>
      </div>
    </div>
  );
}; 