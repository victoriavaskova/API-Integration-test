import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LoginPage } from '../pages/login';
import { DashboardPage } from '../pages/dashboard';
import { BetsPage } from '../pages/bets';
import { TransactionsPage } from '../pages/transactions';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/bets" element={<BetsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
