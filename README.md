# Binance Trading Bot

A trading bot for Binance with real-time price monitoring and virtual trading capabilities.

## Project Structure

The project consists of two main parts:

### Backend
- WebSocket connection with Binance
- Technical indicators calculation (RSI, EMA50, Fibonacci)
- Virtual Account for paper trading
- Logging system
- Configuration via .env file

### Frontend
- Built with React and TypeScript
- Real-time price updates via WebSocket
- Dark theme with Material-UI
- Responsive design
- Price table and account information display

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/binance-trading-bot.git
cd binance-trading-bot
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

## Configuration

1. Create a `.env` file in the backend directory:
```env
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
PORT=3001
```

## Running the Application

1. Start the backend server:
```bash
cd backend
npm start
```

2. Start the frontend development server:
```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:3001`

## Features

- Real-time price monitoring
- Virtual trading account
- Technical analysis indicators
- Position management
- Dark theme UI
- Responsive design

## Technologies Used

- Backend:
  - Node.js
  - WebSocket
  - Technical indicators library
  - Environment configuration

- Frontend:
  - React
  - TypeScript
  - Material-UI
  - WebSocket client

## License

MIT 