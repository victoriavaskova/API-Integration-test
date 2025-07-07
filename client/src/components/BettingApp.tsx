import React, { useState, useEffect } from 'react';
import { useAuth } from '../shared/hooks/useAuth';
import { useBetting } from '../shared/hooks/useBetting';
import { useBalance } from '../shared/hooks/useBalance';
import './BettingApp.css';

interface LoginFormProps {
  onLogin: (username: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, isLoading, error }) => {
  const [username, setUsername] = useState('user1');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(username);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🎯 Betting System Login</h2>
        <p>Система ставок с HMAC SHA-512 аутентификацией</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <select 
              id="username"
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            >
              <option value="user1">user1 (Test User 1)</option>
              <option value="user2">user2 (Test User 2)</option>
              <option value="user3">user3 (Test User 3)</option>
            </select>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="info-section">
          <h4>ℹ️ О системе:</h4>
          <ul>
            <li>Шанс выигрыша: 50/50</li>
            <li>Выплата при выигрыше: 2x</li>
            <li>Диапазон ставок: 1-5</li>
            <li>JWT аутентификация</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

interface BettingDashboardProps {
  user: any;
  onLogout: () => void;
}

const BettingDashboard: React.FC<BettingDashboardProps> = ({ user, onLogout }) => {
  const betting = useBetting();
  const balance = useBalance();
  const [betAmount, setBetAmount] = useState(1);
  const [activeTab, setActiveTab] = useState<'betting' | 'history' | 'transactions'>('betting');

  // Загрузка данных при монтировании
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        balance.loadBalance(),
        betting.loadBetsHistory(),
        balance.loadTransactions(),
      ]);
    };
    
    loadData();
  }, []);

  // Обработка размещения ставки
  const handlePlaceBet = async () => {
    const result = await betting.placeBet({ amount: betAmount });
    
    if (result.success) {
      // Обновляем баланс после размещения ставки
      await balance.refreshBalance();
      await balance.loadTransactions(1, 10); // Обновляем транзакции
      
      // Показываем уведомление
      alert(`✅ Ставка на ${betAmount} размещена успешно!`);
    } else {
      alert(`❌ Ошибка: ${result.error}`);
    }
  };

  // Получение рекомендуемой ставки
  const handleGetRecommended = async () => {
    const recommended = await betting.getRecommendedBet();
    if (recommended) {
      setBetAmount(recommended);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'cancelled': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'bet_win': return '#4CAF50';
      case 'bet_place': return '#F44336';
      case 'deposit': return '#2196F3';
      case 'withdrawal': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1>🎯 Betting Dashboard</h1>
        <div className="user-info">
          <span>👤 {user.username} ({user.email})</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      {/* Balance Display */}
      <div className="balance-section">
        <div className="balance-card">
          <h3>💰 Current Balance</h3>
          {balance.isLoadingBalance ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="balance-amount">
              ${balance.getFormattedBalance()}
            </div>
          )}
          <button onClick={balance.loadBalance} disabled={balance.isLoadingBalance}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-navigation">
        <button 
          className={activeTab === 'betting' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('betting')}
        >
          🎲 Place Bets
        </button>
        <button 
          className={activeTab === 'history' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('history')}
        >
          📊 Bets History
        </button>
        <button 
          className={activeTab === 'transactions' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('transactions')}
        >
          📈 Transactions
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'betting' && (
          <div className="betting-section">
            <div className="betting-card">
              <h3>🎲 Place a Bet</h3>
              
              <div className="betting-controls">
                <div className="form-group">
                  <label>Bet Amount (1-5):</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    disabled={betting.placingBet}
                  />
                </div>
                
                <div className="betting-buttons">
                  <button 
                    onClick={handlePlaceBet}
                    disabled={betting.placingBet || betAmount < 1 || betAmount > 5}
                    className="place-bet-btn"
                  >
                    {betting.placingBet ? 'Placing Bet...' : `🎯 Place Bet ($${betAmount})`}
                  </button>
                  
                  <button 
                    onClick={handleGetRecommended}
                    disabled={betting.loadingRecommended}
                    className="recommended-btn"
                  >
                    {betting.loadingRecommended ? 'Loading...' : '💡 Get Recommended'}
                  </button>
                </div>
                
                {betting.recommendedAmount && (
                  <div className="recommended-display">
                    💡 Recommended: ${betting.recommendedAmount}
                  </div>
                )}
              </div>
              
              {betting.error && (
                <div className="error-message">{betting.error}</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <div className="history-header">
              <h3>📊 Bets History</h3>
              <button onClick={betting.loadBetsHistory} disabled={betting.isLoading}>
                🔄 Refresh
              </button>
            </div>
            
            {betting.isLoading ? (
              <div className="loading">Loading bets history...</div>
            ) : betting.bets.length === 0 ? (
              <div className="empty-state">No bets placed yet</div>
            ) : (
              <div className="bets-list">
                {betting.bets.map((bet) => (
                  <div key={bet.id} className="bet-card">
                    <div className="bet-header">
                      <span className="bet-id">Bet #{bet.id}</span>
                      <span 
                        className="bet-status" 
                        style={{ color: getStatusColor(bet.status) }}
                      >
                        {bet.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="bet-details">
                      <div>💰 Amount: ${bet.amount}</div>
                      {bet.win_amount && <div>🎉 Won: ${bet.win_amount}</div>}
                      <div>📅 Created: {formatDate(bet.created_at)}</div>
                      {bet.completed_at && <div>✅ Completed: {formatDate(bet.completed_at)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="transactions-section">
            <div className="transactions-header">
              <h3>📈 Transaction History</h3>
              <button onClick={() => balance.loadTransactions(1, 10)} disabled={balance.isLoadingTransactions}>
                🔄 Refresh
              </button>
            </div>
            
            {balance.isLoadingTransactions ? (
              <div className="loading">Loading transactions...</div>
            ) : balance.transactions.length === 0 ? (
              <div className="empty-state">No transactions yet</div>
            ) : (
              <div className="transactions-list">
                {balance.transactions.map((transaction) => (
                  <div key={transaction.id} className="transaction-card">
                    <div className="transaction-header">
                      <span className="transaction-id">#{transaction.id}</span>
                      <span 
                        className="transaction-type"
                        style={{ color: getTransactionTypeColor(transaction.type) }}
                      >
                        {transaction.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="transaction-details">
                      <div className="amount-change">
                        {transaction.amount > 0 ? '+' : ''}${transaction.amount}
                      </div>
                      <div>Balance: ${transaction.balance_before} → ${transaction.balance_after}</div>
                      <div>📅 {formatDate(transaction.created_at)}</div>
                      {transaction.description && (
                        <div className="transaction-description">{transaction.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const BettingApp: React.FC = () => {
  const auth = useAuth();

  const handleLogin = async (username: string) => {
    const result = await auth.login({ username });
    if (!result.success) {
      console.error('Login failed:', result.error);
    }
  };

  if (auth.isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <LoginForm 
        onLogin={handleLogin}
        isLoading={auth.isLoading}
        error={auth.error}
      />
    );
  }

  return (
    <BettingDashboard 
      user={auth.user}
      onLogout={auth.logout}
    />
  );
}; 