import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('klassik_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('klassik_auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  // Wallet authentication
  connectWallet: async (walletData: any) => {
    const response = await api.post('/auth/wallet-connect', walletData);
    if (response.data.token) {
      localStorage.setItem('klassik_auth_token', response.data.token);
    }
    return response.data;
  },

  // Sacrifice registration
  register: async (sacrificeData: any) => {
    const response = await api.post('/auth/sacrifice-register', sacrificeData);
    return response.data;
  },

  // Get user profile
  getProfile: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  // Update profile
  updateProfile: async (updates: any) => {
    const response = await api.put('/users/me', updates);
    return response.data;
  }
};

export const gameAPI = {
  // Get available games
  getGames: async () => {
    const response = await api.get('/games');
    return response.data;
  },

  // Get game history
  getGameHistory: async (limit = 50) => {
    const response = await api.get(`/games/history?limit=${limit}`);
    return response.data;
  },

  // Get leaderboard
  getLeaderboard: async (gameType?: string) => {
    const response = await api.get(`/games/leaderboard${gameType ? `?type=${gameType}` : ''}`);
    return response.data;
  },

  // Create new game session
  createSession: async (gameType: string, options: any) => {
    const response = await api.post('/games/create', { gameType, options });
    return response.data;
  },

  // Join game session
  joinSession: async (sessionId: string, betAmount: number) => {
    const response = await api.post(`/games/${sessionId}/join`, { betAmount });
    return response.data;
  },

  // Get session details
  getSession: async (sessionId: string) => {
    const response = await api.get(`/games/${sessionId}`);
    return response.data;
  }
};

export const kaspaAPI = {
  // Get Kaspa price
  getPrice: async () => {
    const response = await api.get('/kaspa/price');
    return response.data;
  },

  // Get network stats
  getNetworkStats: async () => {
    const response = await api.get('/kaspa/network');
    return response.data;
  },

  // Create payment address
  createPaymentAddress: async (amount: number, purpose: string) => {
    const response = await api.post('/payments/kaspa/create', { amount, purpose });
    return response.data;
  },

  // Check payment status
  checkPayment: async (paymentId: string) => {
    const response = await api.get(`/payments/${paymentId}/status`);
    return response.data;
  },

  // Get wallet balance
  getBalance: async () => {
    const response = await api.get('/kaspa/balance');
    return response.data;
  }
};

export const communityAPI = {
  // Get leaderboard
  getLeaderboard: async () => {
    const response = await api.get('/community/leaderboard');
    return response.data;
  },

  // Get achievements
  getAchievements: async () => {
    const response = await api.get('/community/achievements');
    return response.data;
  },

  // Get posts
  getPosts: async (limit = 20, offset = 0) => {
    const response = await api.get(`/community/posts?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  // Create post
  createPost: async (content: string, title?: string) => {
    const response = await api.post('/community/posts', { content, title });
    return response.data;
  },

  // Like post
  likePost: async (postId: string) => {
    const response = await api.post(`/community/posts/${postId}/like`);
    return response.data;
  }
};

// Combined API service for easy access
export const apiService = {
  auth: authAPI,
  games: gamesAPI,
  kaspa: kaspaAPI,
  community: communityAPI
};

export default api;