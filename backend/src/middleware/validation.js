/**
 * Input validation utilities
 */

const { ethers } = require('ethers');

/**
 * Validate Ethereum address
 */
function validateEthAddress(address) {
  if (!address || typeof address !== 'string') {
    return { valid: false, message: 'Address is required' };
  }
  
  if (!ethers.utils.isAddress(address)) {
    return { valid: false, message: 'Invalid Ethereum address' };
  }
  
  return { valid: true };
}

/**
 * Validate positive number
 */
function validatePositiveNumber(value, fieldName = 'Value') {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { valid: false, message: `${fieldName} must be a number` };
  }
  
  if (num <= 0) {
    return { valid: false, message: `${fieldName} must be positive` };
  }
  
  return { valid: true, value: num };
}

/**
 * Validate chain name
 */
function validateChain(chain) {
  const validChains = ['ETH', 'KASPA', 'BSC', 'POLYGON'];
  
  if (!chain || !validChains.includes(chain.toUpperCase())) {
    return { 
      valid: false, 
      message: `Invalid chain. Supported: ${validChains.join(', ')}` 
    };
  }
  
  return { valid: true, value: chain.toUpperCase() };
}

/**
 * Sanitize string input (prevent XSS)
 */
function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Remove < and > to prevent basic XSS
}

/**
 * Validate order creation request
 */
function validateOrderRequest(req, res, next) {
  const { fromChain, toChain, fromAmount, toAmount, fromAddress, toAddress } = req.body;
  
  // Validate chains
  const fromChainCheck = validateChain(fromChain);
  if (!fromChainCheck.valid) {
    return res.status(400).json({ error: fromChainCheck.message });
  }
  
  const toChainCheck = validateChain(toChain);
  if (!toChainCheck.valid) {
    return res.status(400).json({ error: toChainCheck.message });
  }
  
  if (fromChainCheck.value === toChainCheck.value) {
    return res.status(400).json({ error: 'Cannot swap to the same chain' });
  }
  
  // Validate amounts
  const fromAmountCheck = validatePositiveNumber(fromAmount, 'From amount');
  if (!fromAmountCheck.valid) {
    return res.status(400).json({ error: fromAmountCheck.message });
  }
  
  const toAmountCheck = validatePositiveNumber(toAmount, 'To amount');
  if (!toAmountCheck.valid) {
    return res.status(400).json({ error: toAmountCheck.message });
  }
  
  // Validate addresses
  if (fromChainCheck.value === 'ETH') {
    const addressCheck = validateEthAddress(fromAddress);
    if (!addressCheck.valid) {
      return res.status(400).json({ error: `From ${addressCheck.message}` });
    }
  }
  
  if (toChainCheck.value === 'ETH') {
    const addressCheck = validateEthAddress(toAddress);
    if (!addressCheck.valid) {
      return res.status(400).json({ error: `To ${addressCheck.message}` });
    }
  }
  
  next();
}

/**
 * Validate product creation request
 */
function validateProductRequest(req, res, next) {
  const { title, price } = req.body;
  
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Product title is required' });
  }
  
  if (title.length > 255) {
    return res.status(400).json({ error: 'Product title too long (max 255 characters)' });
  }
  
  const priceCheck = validatePositiveNumber(price, 'Price');
  if (!priceCheck.valid) {
    return res.status(400).json({ error: priceCheck.message });
  }
  
  // Sanitize title and description
  req.body.title = sanitizeString(title, 255);
  if (req.body.description) {
    req.body.description = sanitizeString(req.body.description, 5000);
  }
  
  next();
}

module.exports = {
  validateEthAddress,
  validatePositiveNumber,
  validateChain,
  sanitizeString,
  validateOrderRequest,
  validateProductRequest
};
