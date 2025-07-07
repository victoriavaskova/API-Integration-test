import React from 'react';
import { Layout } from '@widgets/Layout';
import { useBalance } from '@shared/hooks/useBalance';
import type { Transaction } from '@shared/api/types';

const TransactionCard: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'bet_win':
        return 'text-success';
      case 'bet_place':
        return 'text-danger';
      case 'deposit':
        return 'text-success';
      case 'withdrawal':
        return 'text-danger';
      default:
        return 'text-secondary';
    }
  };

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'bet_win':
        return '🎉';
      case 'bet_place':
        return '🎯';
      case 'deposit':
        return '💰';
      case 'withdrawal':
        return '💸';
      default:
        return '💱';
    }
  };

  const getTypeText = (type: Transaction['type']) => {
    switch (type) {
      case 'bet_win':
        return 'Bet Win';
      case 'bet_place':
        return 'Bet Placed';
      case 'deposit':
        return 'Deposit';
      case 'withdrawal':
        return 'Withdrawal';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isPositive = transaction.amount > 0;

  return (
    <div className="card">
      <div className="flex flex-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="flex gap-1" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>{getTypeIcon(transaction.type)}</span>
            <h4 style={{ margin: 0 }}>{getTypeText(transaction.type)}</h4>
          </div>
          <p className="text-secondary" style={{ margin: 0, fontSize: '0.9rem' }}>
            {formatDate(transaction.created_at)}
          </p>
          {transaction.description && (
            <p className="text-secondary" style={{ margin: 0, fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {transaction.description}
            </p>
          )}
        </div>
        
        <div className="text-right">
          <div 
            className={getTypeColor(transaction.type)}
            style={{ fontWeight: 'bold', fontSize: '1.2rem' }}
          >
            {isPositive ? '+' : ''}${transaction.amount}
          </div>
          <div className="text-secondary" style={{ fontSize: '0.9rem' }}>
            Transaction #{transaction.id}
          </div>
        </div>
      </div>

      <div className="grid grid-2 gap-2 mt-1">
        <div>
          <div className="text-secondary">Balance Before</div>
          <div>${transaction.balance_before}</div>
        </div>
        <div>
          <div className="text-secondary">Balance After</div>
          <div className="text-success" style={{ fontWeight: 'bold' }}>
            ${transaction.balance_after}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TransactionsPage: React.FC = () => {
  const { 
    transactions, 
    pagination, 
    loading, 
    error, 
    balance,
    fetchTransactions,
    refreshTransactions 
  } = useBalance();

  const handleRefresh = () => {
    refreshTransactions();
  };

  const handleLoadMore = () => {
    if (pagination && pagination.page < pagination.pages) {
      fetchTransactions(pagination.page + 1, pagination.limit);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <Layout>
        <div className="flex flex-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      </Layout>
    );
  }

  // Calculate transaction statistics
  const stats = {
    totalTransactions: transactions.length,
    totalDeposits: transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0),
    totalWithdrawals: transactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    totalBetWins: transactions
      .filter(t => t.type === 'bet_win')
      .reduce((sum, t) => sum + t.amount, 0),
    totalBetPlaced: transactions
      .filter(t => t.type === 'bet_place')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
  };

  return (
    <Layout>
      <div className="grid gap-2">
        {/* Header */}
        <div className="flex flex-between" style={{ alignItems: 'center' }}>
          <h2>💰 Transaction History</h2>
          <button onClick={handleRefresh} className="btn" disabled={loading}>
            {loading ? '⟳' : '🔄'} Refresh
          </button>
        </div>

        {/* Current balance */}
        <div className="card">
          <h3>Current Balance</h3>
          <div className="text-success" style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            ${balance}
          </div>
        </div>

        {/* Transaction statistics */}
        <div className="card">
          <h3>Transaction Summary</h3>
          <div className="grid grid-2 gap-2">
            <div>
              <div className="text-secondary">Total Transactions</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                {stats.totalTransactions}
              </div>
            </div>
            <div>
              <div className="text-secondary">Bet Winnings</div>
              <div className="text-success" style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                ${stats.totalBetWins}
              </div>
            </div>
            <div>
              <div className="text-secondary">Total Bet Amount</div>
              <div className="text-danger" style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                ${stats.totalBetPlaced}
              </div>
            </div>
            <div>
              <div className="text-secondary">Net from Betting</div>
              <div 
                className={stats.totalBetWins - stats.totalBetPlaced >= 0 ? 'text-success' : 'text-danger'}
                style={{ fontWeight: 'bold', fontSize: '1.5rem' }}
              >
                ${stats.totalBetWins - stats.totalBetPlaced}
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

        {/* Transactions list */}
        {transactions.length === 0 ? (
          <div className="card text-center">
            <h3>No transactions yet</h3>
            <p className="text-secondary">
              Start betting to see your transaction history!
            </p>
          </div>
        ) : (
          <div className="grid gap-1">
            <h3>
              Transaction History ({pagination ? pagination.total : transactions.length})
            </h3>
            
            {transactions.map((transaction) => (
              <TransactionCard key={transaction.id} transaction={transaction} />
            ))}

            {/* Load more button */}
            {pagination && pagination.page < pagination.pages && (
              <div className="text-center mt-2">
                <button 
                  onClick={handleLoadMore} 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                      Loading...
                    </>
                  ) : (
                    `Load More (${pagination.total - transactions.length} remaining)`
                  )}
                </button>
              </div>
            )}

            {/* Pagination info */}
            {pagination && (
              <div className="text-center text-secondary">
                <p>
                  Page {pagination.page} of {pagination.pages} • 
                  Showing {transactions.length} of {pagination.total} transactions
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}; 