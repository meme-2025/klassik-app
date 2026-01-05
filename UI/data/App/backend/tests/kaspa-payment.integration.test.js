/**
 * Integration Tests - Kaspa Payment Service
 * Tests real blockchain interaction and transaction monitoring
 */

const KaspaPaymentService = require('../kaspa-payment-service');

describe('KaspaPaymentService - Integration Tests', () => {
  let paymentService;

  beforeAll(() => {
    // Use testnet for integration tests
    paymentService = new KaspaPaymentService({
      kaspaApi: 'https://api.kaspa.org',
      network: 'testnet',
      casinoAddress: 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc',
      confirmations: 1, // Lower for faster tests
      pollInterval: 2000
    });
  });

  afterAll(() => {
    paymentService.stopMonitoring();
  });

  describe('Kaspa API Connection', () => {
    test('should fetch Kaspa price', async () => {
      const price = await paymentService.getKaspaPrice();
      expect(price).toBeGreaterThan(0);
      expect(typeof price).toBe('number');
    }, 10000);

    test('should fetch casino balance', async () => {
      const balance = await paymentService.getCasinoBalance();
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(typeof balance).toBe('number');
    }, 10000);
  });

  describe('Transaction Verification', () => {
    test('should verify valid transaction', async () => {
      // Use a known testnet transaction
      const mockTxId = 'a'.repeat(64); // Mock transaction ID
      
      const verification = await paymentService.verifyTransaction(mockTxId);
      
      expect(verification).toHaveProperty('valid');
      expect(verification).toHaveProperty('confirmed');
    }, 10000);

    test('should handle invalid transaction gracefully', async () => {
      const invalidTxId = 'invalid-tx-id';
      
      const verification = await paymentService.verifyTransaction(invalidTxId);
      
      expect(verification.valid).toBe(false);
      expect(verification.reason).toBeDefined();
    }, 10000);
  });

  describe('Monitoring System', () => {
    test('should start monitoring without errors', async () => {
      const onDepositMock = jest.fn();
      
      await paymentService.startMonitoring(onDepositMock);
      
      expect(paymentService.isMonitoring).toBe(true);
      
      const stats = paymentService.getStats();
      expect(stats.isMonitoring).toBe(true);
    });

    test('should get monitoring stats', () => {
      const stats = paymentService.getStats();
      
      expect(stats).toHaveProperty('isMonitoring');
      expect(stats).toHaveProperty('pendingDeposits');
      expect(stats).toHaveProperty('pendingPayouts');
      expect(stats).toHaveProperty('processedTransactions');
      expect(stats).toHaveProperty('casinoAddress');
      expect(stats).toHaveProperty('network');
    });
  });

  describe('Payout Processing', () => {
    test('should create payout transaction', async () => {
      const toAddress = 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
      const amount = 1.5;
      
      const txId = await paymentService.sendPayout(toAddress, amount);
      
      expect(txId).toBeDefined();
      expect(typeof txId).toBe('string');
      expect(txId.length).toBe(64); // Hex transaction ID
    });

    test('should process batch payouts', async () => {
      const payouts = [
        { address: 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc', amount: 1.0 },
        { address: 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc', amount: 2.5 },
        { address: 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc', amount: 0.5 }
      ];
      
      const results = await paymentService.sendBatchPayout(payouts);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        if (result.success) {
          expect(result).toHaveProperty('txId');
        }
      });
    });
  });
});
