export const KASPA_CONFIG = {
  network: process.env.NEXT_PUBLIC_KASPA_NETWORK || 'testnet-10',
  apiUrl: process.env.NEXT_PUBLIC_KASPA_API || 'https://api.kaspa.org',
  casinoAddress: process.env.NEXT_PUBLIC_CASINO_ADDRESS || '',
  confirmations: 6,
  buyInAmount: 0.1,
  sompiPerKAS: 100000000,
};

export const GAME_CONFIG = {
  maxPlayers: 10,
  minPlayers: 2,
  countdownDuration: 15,
  tickRate: 50,
  houseEdge: 0.02,
};

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
};
