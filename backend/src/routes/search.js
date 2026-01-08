const express = require('express');
const axios = require('axios');
const KaspaAPIComplete = require('../services/kaspa-api-complete');

const router = express.Router();

/**
 * Comprehensive Explorer Search System
 * Supports: Addresses, Transaction Hashes, Block Hashes, DAA Scores
 */

const KASPA_APIs = {
  restServer: process.env.KASPA_REST_SERVER || 'http://localhost:16110',
  primary: null,
  explorer: null
};

class ExplorerSearch {
  constructor() {
    this.kaspaAPI = new KaspaAPIComplete();
  }

  /**
   * Main search function - auto-detects search type
   */
  async search(query) {
    const cleanQuery = query.trim();
    
    if (!cleanQuery || cleanQuery.length < 3) {
      throw new Error('Search query too short (minimum 3 characters)');
    }

    const searchType = this.detectSearchType(cleanQuery);
    
    console.log(`🔍 Searching for "${cleanQuery}" (detected type: ${searchType})`);

    switch (searchType) {
      case 'address':
        return await this.searchAddress(cleanQuery);
      case 'transaction':
        return await this.searchTransaction(cleanQuery);
      case 'block':
        return await this.searchBlock(cleanQuery);
      case 'daa_score':
        return await this.searchByDAAScore(parseInt(cleanQuery));
      default:
        return await this.searchAll(cleanQuery);
    }
  }

  /**
   * Auto-detect search type based on query format
   */
  detectSearchType(query) {
    // Kaspa address patterns
    if (query.startsWith('kaspa:') && query.length >= 50) {
      return 'address';
    }
    
    // Transaction/Block hash (64 character hex string)
    if (/^[a-fA-F0-9]{64}$/.test(query)) {
      return 'transaction'; // We'll try both transaction and block
    }
    
    // DAA Score (pure number)
    if (/^\d+$/.test(query) && parseInt(query) < 1000000000) {
      return 'daa_score';
    }
    
    // Partial hash or address
    if (/^[a-fA-F0-9]{6,}$/.test(query)) {
      return 'partial_hash';
    }

    return 'unknown';
  }

  /**
   * Search for Kaspa address
   */
  async searchAddress(address) {
    try {
      const [balance, transactions, utxos] = await Promise.allSettled([
        this.getAddressBalance(address),
        this.getAddressTransactions(address, 50),
        this.getAddressUTXOs(address)
      ]);

      const addressData = {
        type: 'address',
        address: address,
        found: true,
        balance: balance.status === 'fulfilled' ? balance.value : 0,
        transactions: transactions.status === 'fulfilled' ? transactions.value : [],
        utxos: utxos.status === 'fulfilled' ? utxos.value : [],
        transactionCount: transactions.status === 'fulfilled' ? transactions.value.length : 0,
        totalReceived: 0, // Will calculate from transactions
        totalSent: 0,
        firstSeen: null,
        lastActivity: null
      };

      // Calculate statistics from transactions
      if (addressData.transactions.length > 0) {
        addressData.firstSeen = addressData.transactions[addressData.transactions.length - 1].timestamp;
        addressData.lastActivity = addressData.transactions[0].timestamp;
        
        for (const tx of addressData.transactions) {
          // Calculate total received and sent
          if (tx.outputs) {
            for (const output of tx.outputs) {
              if (output.address === address) {
                addressData.totalReceived += parseFloat(output.value || 0);
              }
            }
          }
          if (tx.inputs) {
            for (const input of tx.inputs) {
              if (input.address === address) {
                addressData.totalSent += parseFloat(input.value || 0);
              }
            }
          }
        }
      }

      return addressData;

    } catch (error) {
      return { 
        type: 'address', 
        found: false, 
        error: error.message,
        address: address
      };
    }
  }

  /**
   * Search for transaction
   */
  async searchTransaction(txHash) {
    try {
      const transaction = await this.getTransaction(txHash);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return {
        type: 'transaction',
        found: true,
        transaction: {
          hash: txHash,
          ...transaction,
          inputCount: transaction.inputs ? transaction.inputs.length : 0,
          outputCount: transaction.outputs ? transaction.outputs.length : 0,
          totalInput: this.calculateTotalValue(transaction.inputs),
          totalOutput: this.calculateTotalValue(transaction.outputs),
          fee: this.calculateFee(transaction)
        }
      };

    } catch (error) {
      // If transaction search fails, try as block hash
      try {
        const block = await this.getBlock(txHash);
        return {
          type: 'block',
          found: true,
          block: block
        };
      } catch (blockError) {
        return { 
          type: 'transaction', 
          found: false, 
          error: error.message,
          hash: txHash
        };
      }
    }
  }

  /**
   * Search for block
   */
  async searchBlock(blockHash) {
    try {
      const block = await this.getBlock(blockHash);
      
      return {
        type: 'block',
        found: true,
        block: block
      };

    } catch (error) {
      return { 
        type: 'block', 
        found: false, 
        error: error.message,
        hash: blockHash
      };
    }
  }

  /**
   * Search by DAA score (block height)
   */
  async searchByDAAScore(daaScore) {
    try {
      const block = await this.getBlockByDAAScore(daaScore);
      
      return {
        type: 'block',
        found: true,
        searchedDAAScore: daaScore,
        block: block
      };

    } catch (error) {
      return { 
        type: 'block', 
        found: false, 
        error: error.message,
        daaScore: daaScore
      };
    }
  }

  /**
   * Search across all types
   */
  async searchAll(query) {
    const results = {
      type: 'multi',
      query: query,
      results: []
    };

    // Try different search types in parallel
    const searches = await Promise.allSettled([
      this.searchAddress(query).catch(() => null),
      this.searchTransaction(query).catch(() => null),
      this.searchPartialHash(query).catch(() => null)
    ]);

    for (const search of searches) {
      if (search.status === 'fulfilled' && search.value && search.value.found) {
        results.results.push(search.value);
      }
    }

    results.found = results.results.length > 0;
    
    if (!results.found) {
      results.error = 'No results found for query';
    }

    return results;
  }

  /**
   * Search for partial hashes
   */
  async searchPartialHash(partialHash) {
    try {
      // This would require database integration to search partial hashes
      // For now, return a not found response
      throw new Error('Partial hash search not implemented yet');
    } catch (error) {
      return { type: 'partial', found: false, error: error.message };
    }
  }

  /**
   * Get address balance
   */
  async getAddressBalance(address) {
    try {
      if (KASPA_APIs.restServer) {
        const response = await axios.get(`${KASPA_APIs.restServer}/addresses/${address}/balance`, { timeout: 5000 });
        return parseFloat(response.data.balance || 0);
      }

      const response = await axios.get(`${KASPA_APIs.explorer}/addresses/${address}/balance`, { timeout: 10000 });
      return parseFloat(response.data.balance || 0);
    } catch (error) {
      console.warn('Failed to get address balance:', error.message);
      return 0;
    }
  }

  /**
   * Get address transactions
   */
  async getAddressTransactions(address, limit = 50) {
    try {
      if (KASPA_APIs.restServer) {
        const response = await axios.get(`${KASPA_APIs.restServer}/addresses/${address}/transactions`, {
          params: { limit },
          timeout: 10000
        });
        return response.data || [];
      }

      const response = await axios.get(`${KASPA_APIs.explorer}/addresses/${address}/transactions`, {
        params: { limit },
        timeout: 15000
      });
      return response.data || [];
    } catch (error) {
      console.warn('Failed to get address transactions:', error.message);
      return [];
    }
  }

  /**
   * Get address UTXOs
   */
  async getAddressUTXOs(address) {
    try {
      if (KASPA_APIs.restServer) {
        const response = await axios.get(`${KASPA_APIs.restServer}/addresses/${address}/utxos`, { timeout: 5000 });
        return response.data || [];
      }

      // UTXOs might not be available in all APIs
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get single transaction
   */
  async getTransaction(txHash) {
    try {
      if (KASPA_APIs.restServer) {
        const response = await axios.get(`${KASPA_APIs.restServer}/transactions/${txHash}`, { timeout: 5000 });
        return response.data;
      }

      const response = await axios.get(`${KASPA_APIs.explorer}/transactions/${txHash}`, { timeout: 10000 });
      return response.data;
    } catch (error) {
      throw new Error(`Transaction not found: ${error.message}`);
    }
  }

  /**
   * Get single block
   */
  async getBlock(blockHash) {
    try {
      if (KASPA_APIs.restServer) {
        const response = await axios.get(`${KASPA_APIs.restServer}/blocks/${blockHash}`, { timeout: 5000 });
        return response.data;
      }

      const response = await axios.get(`${KASPA_APIs.explorer}/blocks/${blockHash}`, { timeout: 10000 });
      return response.data;
    } catch (error) {
      throw new Error(`Block not found: ${error.message}`);
    }
  }

  /**
   * Get block by DAA score
   */
  async getBlockByDAAScore(daaScore) {
    try {
      if (KASPA_APIs.restServer) {
        const response = await axios.get(`${KASPA_APIs.restServer}/blocks`, {
          params: { daaScore },
          timeout: 5000
        });
        return response.data?.[0];
      }

      const response = await axios.get(`${KASPA_APIs.explorer}/blocks`, {
        params: { height: daaScore },
        timeout: 10000
      });
      return response.data?.[0];
    } catch (error) {
      throw new Error(`Block at DAA score ${daaScore} not found: ${error.message}`);
    }
  }

  /**
   * Calculate total value from inputs/outputs
   */
  calculateTotalValue(items) {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((total, item) => {
      return total + parseFloat(item.value || item.amount || 0);
    }, 0);
  }

  /**
   * Calculate transaction fee
   */
  calculateFee(transaction) {
    const totalInput = this.calculateTotalValue(transaction.inputs);
    const totalOutput = this.calculateTotalValue(transaction.outputs);
    return Math.max(0, totalInput - totalOutput);
  }
}

/**
 * GET /api/search?q=...
 * Main search endpoint
 */
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        error: 'Search query parameter "q" is required' 
      });
    }

    const searcher = new ExplorerSearch();
    const results = await searcher.search(q);

    res.json({
      success: true,
      query: q,
      ...results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      message: error.message,
      query: req.query.q
    });
  }
});

/**
 * GET /api/search/suggestions?q=...
 * Search suggestions for autocomplete
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 3) {
      return res.json({ suggestions: [] });
    }

    const suggestions = [];
    const searchType = new ExplorerSearch().detectSearchType(q);

    // Add type-specific suggestions
    switch (searchType) {
      case 'address':
        suggestions.push({
          text: q,
          type: 'address',
          description: 'Kaspa Address'
        });
        break;
      
      case 'transaction':
        suggestions.push({
          text: q,
          type: 'transaction',
          description: 'Transaction Hash'
        });
        break;
      
      case 'daa_score':
        suggestions.push({
          text: q,
          type: 'block',
          description: `Block at DAA Score ${q}`
        });
        break;
      
      default:
        if (q.startsWith('kaspa:')) {
          suggestions.push({
            text: q,
            type: 'address',
            description: 'Kaspa Address'
          });
        }
        if (/^[a-fA-F0-9]{6,}$/.test(q)) {
          suggestions.push({
            text: q,
            type: 'hash',
            description: 'Hash (Transaction or Block)'
          });
        }
    }

    res.json({ suggestions });

  } catch (error) {
    res.json({ suggestions: [] });
  }
});

module.exports = router;