import React, { useState } from 'react';
import { Layout } from '@widgets/Layout';
import { useAuth } from '@shared/hooks/useAuth';
import { useBalance } from '@shared/hooks/useBalance';
import { useBetting } from '@shared/hooks/useBetting';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { balance, refreshBalance } = useBalance();
  const { 
    bets,
    recommendedAmount, 
    placeBet, 
    checkBetResult,
    placingBet, 
    loading,
    error, 
    clearError, 
    stats,
    refreshBets 
  } = useBetting();
  
  const [customAmount, setCustomAmount] = useState<number>(recommendedAmount || 1);
  const [useRecommended, setUseRecommended] = useState(true);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [checkingResult, setCheckingResult] = useState<string | null>(null);

  React.useEffect(() => {
    if (recommendedAmount > 0) {
      setCustomAmount(recommendedAmount);
    }
  }, [recommendedAmount]);

  const handlePlaceBet = async () => {
    const amount = useRecommended ? recommendedAmount : customAmount;
    
    if (amount < 1 || amount > 5) {
      console.log('❌ Invalid bet amount:', amount);
      return;
    }

    if (amount > balance) {
      console.log('❌ Insufficient balance. Amount:', amount, 'Balance:', balance);
      return;
    }

    clearError();
    setResultMessage('');

    console.log('🎲 Placing bet...', { amount, user: user?.username });

    try {
      const result = await placeBet(amount);
      console.log('✅ Bet placed successfully:', result);
      
      // Refresh balance after successful bet placement
      // We don't need to refresh bets because useBetting hook already optimistically updates the state
      await refreshBalance();
      console.log('🔄 Balance refreshed after bet placement');
      
      // No success message - user will check result separately
    } catch (error: any) {
      console.error('❌ Error placing bet:', error);
      // Error is handled by useBetting hook
    }
  };

  const handleCheckResult = async (betId: string) => {
    setCheckingResult(betId);
    setResultMessage('');
    
    console.log('🔍 Checking bet result for ID:', betId);
    
    try {
      const result = await checkBetResult(betId);
      console.log('📊 Bet result received:', result);
      
      // Refresh data after checking result (balance updated here if won)
      await Promise.all([refreshBalance(), refreshBets()]);
      console.log('🔄 Data refreshed after result check');
      
      if (result.status === 'completed') {
        if (result.win_amount && Number(result.win_amount) > 0) {
          setResultMessage(`🎉 Congratulations! You won $${result.win_amount}! Your bet of $${result.amount} paid out 2x.`);
          console.log('🎉 Player won!', { amount: result.amount, winAmount: result.win_amount });
        } else {
          setResultMessage(`😔 Sorry, you lost this time. Your bet of $${result.amount} didn't win. Better luck next time!`);
          console.log('😔 Player lost.', { amount: result.amount });
        }
      }
    } catch (error: any) {
      console.error('❌ Error checking bet result:', error);
      setResultMessage(`❌ Error checking result: ${error.message || 'Unknown error'}`);
    } finally {
      setCheckingResult(null);
    }
  };

  const betAmount = useRecommended ? recommendedAmount : customAmount;
  const canPlaceBet = betAmount >= 1 && betAmount <= 5 && betAmount <= balance && !placingBet;
  const pendingBets = bets.filter(bet => bet.status === 'pending');
  
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

        {/* Result message */}
        {resultMessage && (
          <div className={`card ${resultMessage.includes('🎉') ? 'bg-success' : resultMessage.includes('😔') ? 'bg-warning' : resultMessage.includes('❌') ? 'bg-danger' : 'bg-info'}`}>
            <p style={{ margin: 0, color: 'white', fontWeight: 'bold' }}>{resultMessage}</p>
          </div>
        )}

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
          <h3>🎯 Place a New Bet</h3>
          
          <div className="card" style={{ backgroundColor: 'var(--color-background-secondary)', marginBottom: '1rem', padding: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              <strong>How it works:</strong> Place your bet first (balance will be deducted), then check the result separately using the "Check Result" button below.
            </p>
          </div>
          
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
                `🎲 Place Bet $${betAmount}`
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

        {/* Pending bets section */}
        {pendingBets.length > 0 && (
          <div className="card">
            <h3>🔍 Check Pending Bet Results</h3>
            <p className="text-secondary mb-2">Your bets are placed and waiting for results. Click "Check Result" to see if you won or lost:</p>
            
            <div className="grid gap-1">
              {pendingBets.map((bet) => (
                <div key={bet.id} className="flex flex-between" style={{ 
                  alignItems: 'center', 
                  padding: '1rem', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-background-secondary)'
                }}>
                  <div>
                    <strong>Bet #{bet.id}</strong> - ${bet.amount}
                    <div className="text-secondary" style={{ fontSize: '0.9rem' }}>
                      Placed: {new Date(bet.created_at).toLocaleString()}
                    </div>
                    <div className="text-warning" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                      Potential win: ${Number(bet.amount) * 2}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckResult(bet.id)}
                    className="btn btn-primary"
                    disabled={checkingResult === bet.id}
                    style={{ minWidth: '120px' }}
                  >
                    {checkingResult === bet.id ? (
                      <>
                        <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                        Checking...
                      </>
                    ) : (
                      '🎲 Check Result'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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