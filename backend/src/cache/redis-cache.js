/**
 * ============================================
 * REDIS CACHING SYSTEM
 * ============================================
 * 
 * Implementiert effizientes Caching für:
 * - API-Responses (Kaspa Stats, Blocks, Transactions)
 * - Database-Queries
 * - Session-Management
 * - Rate-Limiting
 */

const redis = require('redis');

// Redis Client Configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('❌ Redis connection refused');
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('❌ Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      console.error('❌ Too many Redis retry attempts');
      return undefined; // Stop retrying
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
};

// Create Redis Client
let client = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
async function initRedis() {
  if (client) {
    console.log('✅ Redis client already initialized');
    return client;
  }
  
  try {
    console.log('🔄 Connecting to Redis...');
    console.log(`   Host: ${redisConfig.host}:${redisConfig.port}`);
    
    client = redis.createClient(redisConfig);
    
    client.on('connect', () => {
      console.log('🔗 Redis connecting...');
    });
    
    client.on('ready', () => {
      console.log('✅ Redis connection ready');
      isConnected = true;
    });
    
    client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      isConnected = false;
    });
    
    client.on('end', () => {
      console.log('⚠️  Redis connection closed');
      isConnected = false;
    });
    
    await client.connect();
    
    // Test connection
    await client.ping();
    console.log('✅ Redis connected successfully');
    
    return client;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    console.warn('⚠️  Running without Redis cache - performance may be impacted');
    client = null;
    isConnected = false;
    return null;
  }
}

/**
 * ✅ Get cached data
 */
async function get(key) {
  if (!client || !isConnected) {
    console.warn('⚠️  Redis not available, cache miss:', key);
    return null;
  }
  
  try {
    const data = await client.get(key);
    
    if (data) {
      console.log(`✅ Cache HIT: ${key}`);
      return JSON.parse(data);
    }
    
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error(`❌ Redis GET error for ${key}:`, error.message);
    return null;
  }
}

/**
 * ✅ Set cached data with TTL
 */
async function set(key, value, ttlSeconds = 60) {
  if (!client || !isConnected) {
    console.warn('⚠️  Redis not available, skipping cache set:', key);
    return false;
  }
  
  try {
    const serialized = JSON.stringify(value);
    await client.setEx(key, ttlSeconds, serialized);
    
    console.log(`✅ Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (error) {
    console.error(`❌ Redis SET error for ${key}:`, error.message);
    return false;
  }
}

/**
 * ✅ Delete cached data
 */
async function del(key) {
  if (!client || !isConnected) {
    return false;
  }
  
  try {
    await client.del(key);
    console.log(`✅ Cache DELETE: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Redis DELETE error for ${key}:`, error.message);
    return false;
  }
}

/**
 * ✅ Delete multiple keys by pattern
 */
async function deletePattern(pattern) {
  if (!client || !isConnected) {
    return 0;
  }
  
  try {
    const keys = await client.keys(pattern);
    
    if (keys.length === 0) {
      console.log(`⚠️  No keys found matching pattern: ${pattern}`);
      return 0;
    }
    
    await client.del(keys);
    console.log(`✅ Deleted ${keys.length} keys matching: ${pattern}`);
    return keys.length;
  } catch (error) {
    console.error(`❌ Redis DELETE PATTERN error for ${pattern}:`, error.message);
    return 0;
  }
}

/**
 * ✅ Cache middleware for Express routes
 */
function cacheMiddleware(ttlSeconds = 60, keyPrefix = 'api') {
  return async (req, res, next) => {
    if (!client || !isConnected) {
      return next(); // Skip caching if Redis unavailable
    }
    
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Generate cache key from route and query params
    const cacheKey = `${keyPrefix}:${req.originalUrl || req.url}`;
    
    try {
      const cachedData = await get(cacheKey);
      
      if (cachedData) {
        console.log(`✅ Serving from cache: ${cacheKey}`);
        return res.json({
          ...cachedData,
          cached: true,
          cacheKey
        });
      }
      
      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        // Cache successful responses
        if (res.statusCode === 200) {
          set(cacheKey, data, ttlSeconds).catch(err => {
            console.error('Failed to cache response:', err);
          });
        }
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * ✅ Smart cache with auto-refresh
 * Fetches fresh data while serving stale cache
 */
async function getCachedOrFetch(key, fetchFunction, ttlSeconds = 60, staleTime = 300) {
  const cachedData = await get(key);
  
  if (cachedData) {
    // Check if stale (older than staleTime)
    const age = Date.now() - (cachedData._cachedAt || 0);
    
    if (age < staleTime * 1000) {
      // Fresh cache
      return cachedData;
    }
    
    // Stale cache - fetch in background
    console.log(`⚠️  Cache stale: ${key}, refreshing in background`);
    fetchFunction().then(freshData => {
      const dataWithTimestamp = {
        ...freshData,
        _cachedAt: Date.now()
      };
      set(key, dataWithTimestamp, ttlSeconds);
    }).catch(err => {
      console.error('Background refresh failed:', err);
    });
    
    // Return stale data immediately
    return cachedData;
  }
  
  // No cache - fetch now
  console.log(`❌ No cache for: ${key}, fetching fresh data`);
  const freshData = await fetchFunction();
  
  const dataWithTimestamp = {
    ...freshData,
    _cachedAt: Date.now()
  };
  
  await set(key, dataWithTimestamp, ttlSeconds);
  return dataWithTimestamp;
}

/**
 * ✅ Increment counter (for rate limiting, analytics)
 */
async function increment(key, ttlSeconds = 3600) {
  if (!client || !isConnected) {
    return 0;
  }
  
  try {
    const count = await client.incr(key);
    
    // Set expiry on first increment
    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }
    
    return count;
  } catch (error) {
    console.error(`❌ Redis INCREMENT error for ${key}:`, error.message);
    return 0;
  }
}

/**
 * ✅ Get cache statistics
 */
async function getStats() {
  if (!client || !isConnected) {
    return {
      connected: false,
      message: 'Redis not connected'
    };
  }
  
  try {
    const info = await client.info('stats');
    const dbSize = await client.dbSize();
    
    return {
      connected: true,
      dbSize,
      info: info.split('\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          acc[key.trim()] = value.trim();
        }
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Failed to get Redis stats:', error);
    return {
      connected: false,
      error: error.message
    };
  }
}

/**
 * ✅ Flush all cache
 */
async function flushAll() {
  if (!client || !isConnected) {
    return false;
  }
  
  try {
    await client.flushDb();
    console.log('✅ Redis cache flushed');
    return true;
  } catch (error) {
    console.error('❌ Failed to flush Redis cache:', error);
    return false;
  }
}

/**
 * Close Redis connection
 */
async function close() {
  if (client && isConnected) {
    await client.quit();
    console.log('✅ Redis connection closed');
    client = null;
    isConnected = false;
  }
}

module.exports = {
  initRedis,
  get,
  set,
  del,
  deletePattern,
  increment,
  cacheMiddleware,
  getCachedOrFetch,
  getStats,
  flushAll,
  close,
  isConnected: () => isConnected
};
