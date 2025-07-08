import React from 'react';
import { Layout } from '@widgets/Layout';
import { useBetting } from '@shared/hooks/useBetting';
import type { Bet } from '@shared/api/types';

const BetCard: React.FC<{ bet: Bet }> = ({ bet }) => {
  const getStatusColor = (status: Bet['status']) => {
    switch (status) {
      case 'completed':
        return bet.win_amount && bet.win_amount !== '0' ? 'text-success' : 'text-danger';
      case 'pending':
        return 'text-warning';
      case 'cancelled':
        return 'text-secondary';
      default:
        return 'text-secondary';
    }
  };

  const getStatusText = (status: Bet['status']) => {
    switch (status) {
      case 'completed':
        return bet.win_amount && bet.win_amount !== '0' ? '✅ Won' : '❌ Lost';
      case 'pending':
        return '⏳ Pending';
      case 'cancelled':
        return '🚫 Cancelled';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="card">
      <div className="flex flex-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Bet #{bet.id}</h4>
          <p className="text-secondary" style={{ margin: 0, fontSize: '0.9rem' }}>
            {formatDate(bet.created_at)}
          </p>
        </div>
        <div className={`${getStatusColor(bet.status)}`} style={{ fontWeight: 'bold' }}>
          {getStatusText(bet.status)}
        </div>
      </div>

      <div className="grid grid-2 gap-2 mt-1">
        <div>
          <div className="text-secondary">Bet Amount</div>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>${bet.amount}</div>
        </div>
        
        {bet.status === 'completed' && (
          <div>
            <div className="text-secondary">
              {bet.win_amount && bet.win_amount !== '0' ? 'Win Amount' : 'Lost Amount'}
            </div>
            <div 
              className={bet.win_amount && bet.win_amount !== '0' ? 'text-success' : 'text-danger'}
              style={{ fontWeight: 'bold', fontSize: '1.2rem' }}
            >
              {bet.win_amount && bet.win_amount !== '0' ? `+$${bet.win_amount}` : `-$${bet.amount}`}
            </div>
          </div>
        )}

        {bet.status === 'pending' && (
          <div>
            <div className="text-secondary">Potential Win</div>
            <div className="text-warning" style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
              ${Number(bet.amount) * 2}
            </div>
          </div>
        )}
      </div>

      {bet.completed_at && (
        <div className="mt-1">
          <div className="text-secondary" style={{ fontSize: '0.9rem' }}>
            Completed: {formatDate(bet.completed_at)}
          </div>
        </div>
      )}
    </div>
  );
};

export const BetsPage: React.FC = () => {
  const { bets, loading, error, stats, refreshBets } = useBetting();

  const handleRefresh = () => {
    refreshBets();
  };

  if (loading && bets.length === 0) {
    return (
      <Layout>
        <div className="flex flex-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="grid gap-2">
        {/* Header */}
        <div className="flex flex-between" style={{ alignItems: 'center' }}>
          <h2>🎯 Your Bets</h2>
          <button onClick={handleRefresh} className="btn" disabled={loading}>
            {loading ? '⟳' : '🔄'} Refresh
          </button>
        </div>

        {/* Stats overview */}
        <div className="grid grid-2 gap-2">
          <div className="card">
            <h3>Betting Statistics</h3>
            <div className="grid grid-2 gap-1">
              <div>
                <div className="text-secondary">Total Bets</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>{stats.totalBets}</div>
              </div>
              <div>
                <div className="text-secondary">Completed</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>{stats.completedBets}</div>
              </div>
              <div>
                <div className="text-secondary">Pending</div>
                <div className="text-warning" style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                  {stats.pendingBets}
                </div>
              </div>
              <div>
                <div className="text-secondary">Success Rate</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                  {stats.completedBets > 0 
                    ? `${Math.round((bets.filter(b => b.status === 'completed' && b.win_amount && b.win_amount !== '0').length / stats.completedBets) * 100)}%`
                    : '0%'
                  }
                </div>
              </div>
            </div>
          </div>
          
          <div className="card">
            <h3>Financial Summary</h3>
            <div className="grid grid-2 gap-1">
              <div>
                <div className="text-secondary">Total Wagered</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>${stats.totalWagered}</div>
              </div>
              <div>
                <div className="text-secondary">Total Winnings</div>
                <div className="text-success" style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                  ${stats.totalWinnings}
                </div>
              </div>
              <div>
                <div className="text-secondary">Net Profit</div>
                <div 
                  className={stats.totalWinnings - stats.totalWagered >= 0 ? 'text-success' : 'text-danger'}
                  style={{ fontWeight: 'bold', fontSize: '1.5rem' }}
                >
                  ${stats.totalWinnings - stats.totalWagered}
                </div>
              </div>
              <div>
                <div className="text-secondary">ROI</div>
                <div 
                  className={stats.totalWinnings - stats.totalWagered >= 0 ? 'text-success' : 'text-danger'}
                  style={{ fontWeight: 'bold', fontSize: '1.5rem' }}
                >
                  {stats.totalWagered > 0 
                    ? `${Math.round(((stats.totalWinnings - stats.totalWagered) / stats.totalWagered) * 100)}%`
                    : '0%'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error handling */}
        {error && (
          <div className="card" style={{ backgroundColor: 'var(--color-danger)' }}>
            <p style={{ margin: 0, color: 'white' }}>{error}</p>
          </div>
        )}

        {/* Bets list */}
        {bets.length === 0 ? (
          <div className="card text-center">
            <h3>No bets yet</h3>
            <p className="text-secondary">
              Head to the dashboard to place your first bet!
            </p>
          </div>
        ) : (
          <div className="grid gap-1">
            <h3>Bet History ({bets.length})</h3>
            {bets.map((bet) => (
              <BetCard key={bet.id} bet={bet} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}; 