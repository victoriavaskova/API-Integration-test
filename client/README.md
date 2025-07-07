# Betting System Client

React-based frontend for the Betting System API integration project.

## Overview

This is a test betting system client built with React and TypeScript, using Feature-Sliced Design (FSD) architecture. It provides a clean interface for:

- User authentication
- Placing bets with 50/50 chance and 2x payout
- Viewing betting history
- Monitoring account balance and transactions

## Features

- 🎲 **Simple Betting**: Place bets from $1 to $5
- 📊 **Dashboard**: Overview of balance and betting stats
- 🎯 **Bet History**: View all your bets and results
- 💰 **Transaction History**: Track all balance changes
- 📱 **Responsive Design**: Works on desktop and mobile
- 🔒 **JWT Authentication**: Secure login system

## Architecture

The project follows Feature-Sliced Design (FSD) methodology:

```
src/
├── app/           # App configuration and routing
├── pages/         # Page components (Login, Dashboard, Bets, Transactions)
├── widgets/       # Composite UI blocks (Layout)
├── features/      # Business logic features
├── entities/      # Business entities
└── shared/        # Reusable modules (API, hooks, styles)
```

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **State Management**: React Hooks (useAuth, useBalance, useBetting)
- **Styling**: CSS Variables with utility classes

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   Navigate to `http://localhost:3000`

## Available Users

The system comes with pre-configured test users:
- `user1`
- `user2` 
- `user3`
- `user4`
- `user5`

Use any of these usernames to log in (no password required for testing).

## Game Rules

- **Bet Range**: $1 to $5 per bet
- **Odds**: 50/50 chance to win
- **Payout**: 2x your bet amount on win
- **Loss**: You lose your bet amount

### Example
- Bet: $3
- Win: Receive $6 (net profit: +$3)
- Loss: Lose $3 (net profit: -$3)

## API Integration

The client integrates with a Node.js/Express backend that uses HMAC SHA-512 authentication to communicate with an external betting API.

### API Endpoints Used
- `POST /api/auth/login` - User authentication
- `GET /api/balance` - Get current balance
- `GET /api/bets` - Get betting history
- `POST /api/bets` - Place a new bet
- `GET /api/bets/recommended` - Get recommended bet amount
- `GET /api/transactions` - Get transaction history

## Project Structure

### Key Components

- **App**: Main application with routing and auth protection
- **Layout**: Shared layout with navigation and header
- **LoginPage**: Authentication form
- **DashboardPage**: Main betting interface and stats
- **BetsPage**: Betting history and statistics
- **TransactionsPage**: Transaction history and balance tracking

### Custom Hooks

- **useAuth**: Manages authentication state and login/logout
- **useBalance**: Handles balance and transaction data
- **useBetting**: Manages betting operations and history

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style

The project follows React and TypeScript best practices:
- Functional components with hooks
- TypeScript for type safety
- Clean component structure
- Proper error handling
- Loading states and user feedback

## Security Notes

- JWT tokens are stored in localStorage
- No sensitive data is stored client-side
- All API communication goes through the backend proxy
- HMAC authentication is handled server-side

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features required
- No IE support

## Contributing

1. Follow the FSD architecture patterns
2. Use TypeScript for all new code
3. Maintain component purity and reusability
4. Add proper error handling and loading states
5. Test your changes across different user scenarios

## License

This is a test project for demonstration purposes. 