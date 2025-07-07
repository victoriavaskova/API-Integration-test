import React, { useState } from 'react';
import { Layout } from '@widgets/Layout';
import { useAuth } from '@shared/hooks/useAuth';
import { useBalance } from '@shared/hooks/useBalance';
import { useBetting } from '@shared/hooks/useBetting';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { balance, refreshBalance } = useBalance();
  const { 
    recommendedAmount, 
    placeBet, 
    placingBet, 
    error, 
    clearError, 
    stats,
    refreshBets 
  } = useBetting();
  
  const [customAmount, setCustomAmount] = useState<number>(recommendedAmount || 1);
  const [useRecommended, setUseRecommended] = useState(true);

  React.useEffect(() => {
    if (recommendedAmount > 0) {
      setCustomAmount(recommendedAmount);
    }
  }, [recommendedAmount]);

  const handlePlaceBet = async () => {
    const amount = useRecommended ? recommendedAmount : customAmount;
    
    if (amount < 1 || amount > 5) {
      return;
    }

    if (amount > balance) {
      return;
    }

    clearError();

    try {
      await placeBet(amount);
      // Refresh data after successful bet
      await Promise.all([refreshBalance(), refreshBets()]);
    } catch (error) {
      // Error is handled by useBetting hook
    }
  };

  const betAmount = useRecommended ? recommendedAmount : customAmount;
  const canPlaceBet = betAmount >= 1 && betAmount <= 5 && betAmount <= balance && !placingBet;

  return (
    <Layout>
      <div className="grid gap-2">
        {/* Welcome section */}
        <div className="card">
          <h2>Welcome to Betting System! 🎲</h2>
          <p className="text-secondary">
            This is a test betting system with 50/50 chance and 2x payout on win.
            Place your bets wisely!
          </p>
        </div>

        {/* Stats overview */}
        <div className="grid grid-2 gap-2">
          <div className="card">
            <h3>Your Balance</h3>
            <div className="text-success" style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              ${balance}
            </div>
          </div>
          
          <div className="card">
            <h3>Betting Stats</h3>
            <div className="text-secondary">
              <p>Total Bets: {stats.totalBets}</p>
              <p>Completed: {stats.completedBets}</p>
              <p>Pending: {stats.pendingBets}</p>
              <p>Total Winnings: ${stats.totalWinnings}</p>
            </div>
          </div>
        </div>

        {/* Betting section */}
        <div className="card">
          <h3>Place a Bet</h3>
          
          <div className="mb-2">
            <label className="flex gap-1" style={{ alignItems: 'center', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={useRecommended}
                onChange={(e) => setUseRecommended(e.target.checked)}
              />
              Use recommended amount (${recommendedAmount})
            </label>
            
            {!useRecommended && (
              <div className="form-group">
                <label htmlFor="betAmount" className="form-label">
                  Custom Bet Amount (1-5)
                </label>
                <input
                  type="number"
                  id="betAmount"
                  className="form-input"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  min={1}
                  max={5}
                  disabled={placingBet}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="card" style={{ backgroundColor: 'var(--color-danger)', marginBottom: '1rem' }}>
              <p style={{ margin: 0, color: 'white' }}>{error}</p>
            </div>
          )}

          <div className="flex gap-1" style={{ alignItems: 'center' }}>
            <button
              onClick={handlePlaceBet}
              className="btn btn-success"
              disabled={!canPlaceBet}
              style={{ minWidth: '120px' }}
            >
              {placingBet ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                  Placing...
                </>
              ) : (
                `Bet $${betAmount}`
              )}
            </button>
            
            <div className="text-secondary">
              {betAmount > balance && (
                <span className="text-danger">Insufficient balance!</span>
              )}
              {(betAmount < 1 || betAmount > 5) && (
                <span className="text-danger">Bet amount must be between $1 and $5</span>
              )}
              {canPlaceBet && (
                <span>50% chance to win ${betAmount * 2}</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick info */}
        <div className="card">
          <h3>How it works</h3>
          <div className="grid grid-2 gap-2">
            <div>
              <h4>🎯 Game Rules</h4>
              <ul style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>
                <li>Bet amounts: $1 to $5</li>
                <li>50/50 chance to win</li>
                <li>2x payout on win</li>
                <li>Lose your bet on loss</li>
              </ul>
            </div>
            <div>
              <h4>📊 Example</h4>
              <ul style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>
                <li>Bet: $3</li>
                <li>Win: Get $6 (double)</li>
                <li>Loss: Lose $3</li>
                <li>Net on win: +$3</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}; 