// Registration Validation System - 1 KAS Minimum Requirement
// Überwacht Wallet-Guthaben für Registrierungsanforderungen

class RegistrationValidator {
  constructor() {
    this.MINIMUM_KAS = 1.0; // 1 KAS minimum requirement
    this.cache = new Map();
    this.CACHE_DURATION = 30 * 1000; // 30 seconds cache
    this.validationResults = new Map();
  }

  // Hauptfunktion zur Validierung einer Wallet-Adresse
  async validateWalletBalance(address) {
    try {
      console.log(`Validating wallet balance for: ${address}`);
      
      // Check cache first
      const cached = this.getCachedBalance(address);
      if (cached !== null) {
        console.log(`Using cached balance for ${address}: ${cached} KAS`);
        return this.checkMinimumRequirement(cached, address);
      }

      // Fetch balance from backend API
      const balanceData = await this.fetchWalletBalance(address);
      
      if (balanceData.success) {
        // Cache the result
        this.setCachedBalance(address, balanceData.balance);
        
        // Check minimum requirement
        return this.checkMinimumRequirement(balanceData.balance, address);
      } else {
        throw new Error(balanceData.error || 'Failed to fetch balance');
      }
      
    } catch (error) {
      console.error(`Validation failed for ${address}:`, error);
      return {
        valid: false,
        balance: 0,
        error: error.message,
        address: address,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Hole Wallet-Guthaben über Backend-API
  async fetchWalletBalance(address) {
    try {
      const response = await fetch(`/api/kaspa-enhanced/address/${address}`, {
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`API response not ok: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert from sompi to KAS (1 KAS = 100,000,000 sompi)
      const balanceInSompi = data.balance || 0;
      const balanceInKas = balanceInSompi / 100000000;
      
      return {
        success: true,
        balance: balanceInKas,
        address: address,
        rawBalance: balanceInSompi,
        utxoCount: data.utxoCount || 0
      };
      
    } catch (error) {
      console.error(`Failed to fetch balance for ${address}:`, error);
      return {
        success: false,
        error: error.message,
        address: address
      };
    }
  }

  // Überprüfe Mindestguthaben-Anforderung
  checkMinimumRequirement(balance, address) {
    const isValid = balance >= this.MINIMUM_KAS;
    const deficit = isValid ? 0 : (this.MINIMUM_KAS - balance);
    
    const result = {
      valid: isValid,
      balance: balance,
      minimum: this.MINIMUM_KAS,
      deficit: deficit,
      address: address,
      timestamp: new Date().toISOString(),
      message: isValid 
        ? `✅ Wallet meets requirement (${balance.toFixed(8)} KAS ≥ ${this.MINIMUM_KAS} KAS)`
        : `❌ Insufficient balance (${balance.toFixed(8)} KAS < ${this.MINIMUM_KAS} KAS, need ${deficit.toFixed(8)} more)`
    };

    // Store validation result
    this.validationResults.set(address, result);
    
    console.log(`Validation result for ${address}:`, result);
    return result;
  }

  // Cache-Management
  getCachedBalance(address) {
    const cached = this.cache.get(address);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.balance;
    }
    return null;
  }

  setCachedBalance(address, balance) {
    this.cache.set(address, {
      balance: balance,
      timestamp: Date.now()
    });
  }

  // Bulk validation for multiple addresses
  async validateMultipleWallets(addresses) {
    console.log(`Validating ${addresses.length} wallet addresses...`);
    
    const results = await Promise.allSettled(
      addresses.map(address => this.validateWalletBalance(address))
    );

    const validationReport = {
      total: addresses.length,
      valid: 0,
      invalid: 0,
      errors: 0,
      results: [],
      timestamp: new Date().toISOString()
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        validationReport.results.push(result.value);
        if (result.value.valid) {
          validationReport.valid++;
        } else if (result.value.error) {
          validationReport.errors++;
        } else {
          validationReport.invalid++;
        }
      } else {
        validationReport.errors++;
        validationReport.results.push({
          valid: false,
          error: result.reason.message,
          address: addresses[index],
          timestamp: new Date().toISOString()
        });
      }
    });

    console.log('Bulk validation report:', validationReport);
    return validationReport;
  }

  // Get all validation results
  getAllValidationResults() {
    return Array.from(this.validationResults.entries()).map(([address, result]) => ({
      address,
      ...result
    }));
  }

  // Clear cache and results
  clearCache() {
    this.cache.clear();
    this.validationResults.clear();
    console.log('Validation cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    const validEntries = entries.filter(([_, data]) => 
      (now - data.timestamp) < this.CACHE_DURATION
    );

    return {
      totalEntries: entries.length,
      validEntries: validEntries.length,
      expiredEntries: entries.length - validEntries.length,
      memoryUsage: `${(JSON.stringify(entries).length / 1024).toFixed(2)}KB`,
      cacheDuration: `${this.CACHE_DURATION / 1000}s`
    };
  }

  // Real-time validation for registration form
  async validateRegistrationForm(formData) {
    const { walletAddress, username, email } = formData;
    
    console.log(`Validating registration for user: ${username}`);
    
    // Validate wallet balance
    const balanceValidation = await this.validateWalletBalance(walletAddress);
    
    // Create comprehensive registration result
    const registrationResult = {
      username: username,
      email: email,
      walletAddress: walletAddress,
      balanceValidation: balanceValidation,
      canRegister: balanceValidation.valid,
      timestamp: new Date().toISOString(),
      requirements: {
        minimumKAS: this.MINIMUM_KAS,
        walletBalance: balanceValidation.balance,
        deficit: balanceValidation.deficit || 0
      }
    };

    // Log registration attempt
    console.log('Registration validation result:', registrationResult);
    
    return registrationResult;
  }

  // Monitor balance changes over time
  async monitorBalance(address, intervalMinutes = 5) {
    console.log(`Starting balance monitoring for ${address} (${intervalMinutes}min intervals)`);
    
    const monitoringData = {
      address: address,
      started: new Date().toISOString(),
      history: [],
      currentBalance: null,
      isValid: false
    };

    const checkBalance = async () => {
      try {
        const validation = await this.validateWalletBalance(address);
        const historyEntry = {
          timestamp: new Date().toISOString(),
          balance: validation.balance,
          valid: validation.valid,
          change: monitoringData.currentBalance !== null 
            ? validation.balance - monitoringData.currentBalance 
            : 0
        };

        monitoringData.history.push(historyEntry);
        monitoringData.currentBalance = validation.balance;
        monitoringData.isValid = validation.valid;

        console.log(`Balance check for ${address}:`, historyEntry);
        
        // Emit event if balance changed significantly
        if (Math.abs(historyEntry.change) > 0.001) {
          this.emitBalanceChangeEvent(address, historyEntry);
        }

      } catch (error) {
        console.error(`Balance monitoring error for ${address}:`, error);
        monitoringData.history.push({
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    };

    // Initial check
    await checkBalance();

    // Set up interval monitoring
    const intervalId = setInterval(checkBalance, intervalMinutes * 60 * 1000);

    // Return control object
    return {
      data: monitoringData,
      stop: () => {
        clearInterval(intervalId);
        console.log(`Stopped monitoring for ${address}`);
      },
      getHistory: () => monitoringData.history,
      getCurrentBalance: () => monitoringData.currentBalance
    };
  }

  // Emit balance change events
  emitBalanceChangeEvent(address, data) {
    const event = new CustomEvent('walletBalanceChanged', {
      detail: { address, ...data }
    });
    document.dispatchEvent(event);
  }

  // Get system status
  getSystemStatus() {
    return {
      minimumRequirement: `${this.MINIMUM_KAS} KAS`,
      cacheStats: this.getCacheStats(),
      validationResults: this.getAllValidationResults().length,
      systemTime: new Date().toISOString(),
      api: {
        endpoint: '/api/kaspa-enhanced/address',
        timeout: '10s',
        status: 'operational'
      }
    };
  }
}

// Global instance
window.registrationValidator = new RegistrationValidator();

// Event listeners for balance changes
document.addEventListener('walletBalanceChanged', (event) => {
  console.log('Wallet balance changed:', event.detail);
  // Could trigger UI updates, notifications, etc.
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RegistrationValidator;
}

console.log('Registration Validation System loaded - 1 KAS minimum requirement active');