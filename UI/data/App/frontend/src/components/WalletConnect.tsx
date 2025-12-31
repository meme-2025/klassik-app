import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, Shield, Zap, Trophy } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import './WalletConnect.css';

const WalletConnect: React.FC = () => {
  const { user, setUser } = useGameStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState('');
  const [step, setStep] = useState<'connect' | 'sacrifice' | 'complete'>('connect');

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleWalletConnect = async () => {
    if (!address || address.length < 10) {
      toast.error('Please enter a valid Kaspa address');
      return;
    }

    setIsConnecting(true);
    
    try {
      // Simulate wallet connection
      const walletData = {
        address: address,
        signedMessage: 'klassik_auth_' + Date.now(),
        timestamp: Date.now()
      };

      const response = await authAPI.connectWallet(walletData);
      
      if (response.requiresSacrifice) {
        setStep('sacrifice');
        toast.success('Wallet connected! Please complete 1 KAS sacrifice to continue.');
      } else {
        setUser(response.user);
        setStep('complete');
        toast.success('Welcome back to Klassik Casino!');
      }
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      toast.error(error.response?.data?.message || 'Wallet connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSacrifice = async () => {
    setIsConnecting(true);
    
    try {
      const sacrificeData = {
        address: address,
        amount: 1,
        txHash: 'mock_tx_' + Date.now() // In real app, get from wallet
      };

      const response = await authAPI.register(sacrificeData);
      setUser(response.user);
      setStep('complete');
      toast.success('Sacrifice complete! Welcome to Klassik Casino!');
    } catch (error: any) {
      console.error('Sacrifice failed:', error);
      toast.error(error.response?.data?.message || 'Sacrifice failed');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="wallet-connect">
      <motion.div 
        className="connect-container"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="connect-header">
          <motion.div 
            className="logo-section"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1>KLASSIK CASINO</h1>
            <p>Next-Generation Kaspa Gaming Platform</p>
          </motion.div>
        </div>

        {step === 'connect' && (
          <motion.div 
            className="connect-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h2>Connect Your Wallet</h2>
            <p>Enter your Kaspa address to get started</p>
            
            <div className="form-group">
              <label>Kaspa Address</label>
              <input
                type="text"
                placeholder="kaspa:qq..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isConnecting}
              />
            </div>

            <button 
              className="connect-btn primary"
              onClick={handleWalletConnect}
              disabled={isConnecting || !address}
            >
              {isConnecting ? (
                <>
                  <div className="spinner" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet size={20} />
                  Connect Wallet
                </>
              )}
            </button>

            <div className="features-grid">
              <div className="feature-card">
                <Shield size={24} />
                <h3>Secure</h3>
                <p>Bank-level security with blockchain verification</p>
              </div>
              <div className="feature-card">
                <Zap size={24} />
                <h3>Fast</h3>
                <p>Instant transactions with Kaspa's speed</p>
              </div>
              <div className="feature-card">
                <Trophy size={24} />
                <h3>Rewarding</h3>
                <p>Earn rewards and climb the leaderboard</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'sacrifice' && (
          <motion.div 
            className="sacrifice-form"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2>Complete Registration</h2>
            <p>Sacrifice 1 KAS to unlock the full gaming experience</p>
            
            <div className="sacrifice-info">
              <h3>Why 1 KAS Sacrifice?</h3>
              <ul>
                <li>✅ Unlock all games and features</li>
                <li>✅ Join exclusive tournaments</li>
                <li>✅ Earn community points and rewards</li>
                <li>✅ Access premium support</li>
                <li>✅ Priority in game lobbies</li>
              </ul>
            </div>

            <div className="sacrifice-steps">
              <h3>How it works:</h3>
              <ol>
                <li>Send exactly 1 KAS to our sacrifice address</li>
                <li>Wait for blockchain confirmation</li>
                <li>Your account will be automatically activated</li>
              </ol>
            </div>

            <div className="sacrifice-address">
              <label>Sacrifice Address:</label>
              <div className="address-box">
                kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc
                <button onClick={() => navigator.clipboard.writeText('kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc')}>
                  Copy
                </button>
              </div>
            </div>

            <button 
              className="sacrifice-btn primary"
              onClick={handleSacrifice}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="spinner" />
                  Verifying...
                </>
              ) : (
                'I have sent 1 KAS - Verify'
              )}
            </button>

            <button 
              className="back-btn secondary"
              onClick={() => setStep('connect')}
              disabled={isConnecting}
            >
              Back to Wallet Connect
            </button>
          </motion.div>
        )}

        {step === 'complete' && (
          <motion.div 
            className="complete-form"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <h2>🎉 Welcome to Klassik!</h2>
            <p>Your account has been successfully created</p>
            
            <div className="welcome-stats">
              <div className="stat">
                <span className="stat-value">1000</span>
                <span className="stat-label">Starting KAS</span>
              </div>
              <div className="stat">
                <span className="stat-value">0</span>
                <span className="stat-label">Level</span>
              </div>
              <div className="stat">
                <span className="stat-value">1</span>
                <span className="stat-label">Achievements</span>
              </div>
            </div>

            <button 
              className="continue-btn primary"
              onClick={() => window.location.href = '/dashboard'}
            >
              Enter Casino
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default WalletConnect;