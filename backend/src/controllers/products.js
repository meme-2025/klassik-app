const db = require('../db');

/**
 * GET /api/products
 * List all products with optional filters
 */
async function listProducts(req, res) {
  try {
    const { 
      category, 
      subcategory, 
      provider, 
      country, 
      search, 
      active = 'true',
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (active === 'true') {
      query += ` AND active = true`;
    }

    if (category) {
      query += ` AND category = $${paramCount++}`;
      params.push(category);
    }

    if (subcategory) {
      query += ` AND subcategory = $${paramCount++}`;
      params.push(subcategory);
    }

    if (provider && provider !== 'all') {
      query += ` AND provider = $${paramCount++}`;
      params.push(provider);
    }

    if (country) {
      query += ` AND country = $${paramCount++}`;
      params.push(country);
    }

    if (search) {
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({ 
      products: result.rows,
      count: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('listProducts error:', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
}

/**
 * GET /api/products/:id
 * Get single product by ID
 */
async function getProduct(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('getProduct error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
}

/**
 * POST /api/products
 * Create new product (admin only)
 */
async function createProduct(req, res) {
  try {
    const {
      title,
      description,
      category,
      subcategory,
      provider = 'internal',
      country,
      price,
      currency = 'ETH',
      stock = 0,
      image_url,
      external_id,
      metadata,
      active = true
    } = req.body;

    // Validation
    if (!title || !price) {
      return res.status(400).json({ error: 'Title and price are required' });
    }

    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    const result = await db.query(
      `INSERT INTO products 
       (title, description, category, subcategory, provider, country, price, currency, stock, image_url, external_id, metadata, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [title, description, category, subcategory, provider, country, price, currency, stock, image_url, external_id, metadata, active]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

/**
 * PUT /api/products/:id
 * Update product (admin only)
 */
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      subcategory,
      provider,
      country,
      price,
      currency,
      stock,
      image_url,
      external_id,
      metadata,
      active
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      params.push(category);
    }
    if (subcategory !== undefined) {
      updates.push(`subcategory = $${paramCount++}`);
      params.push(subcategory);
    }
    if (provider !== undefined) {
      updates.push(`provider = $${paramCount++}`);
      params.push(provider);
    }
    if (country !== undefined) {
      updates.push(`country = $${paramCount++}`);
      params.push(country);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      params.push(price);
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramCount++}`);
      params.push(currency);
    }
    if (stock !== undefined) {
      updates.push(`stock = $${paramCount++}`);
      params.push(stock);
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      params.push(image_url);
    }
    if (external_id !== undefined) {
      updates.push(`external_id = $${paramCount++}`);
      params.push(external_id);
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      params.push(metadata);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramCount++}`);
      params.push(active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

/**
 * DELETE /api/products/:id
 * Soft delete product (admin only)
 */
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE products SET active = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deactivated', product: result.rows[0] });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
}

/**
 * GET /api/products/categories
 * Get unique categories
 */
async function getCategories(req, res) {
  try {
    const result = await db.query(
      `SELECT DISTINCT category, COUNT(*) as count 
       FROM products 
       WHERE active = true AND category IS NOT NULL
       GROUP BY category 
       ORDER BY category`
    );

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
}

/**
 * GET /api/products/countries
 * Get unique countries
 */
async function getCountries(req, res) {
  try {
    const result = await db.query(
      `SELECT DISTINCT country, COUNT(*) as count 
       FROM products 
       WHERE active = true AND country IS NOT NULL
       GROUP BY country 
       ORDER BY country`
    );

    res.json({ countries: result.rows });
  } catch (error) {
    console.error('getCountries error:', error);
    res.status(500).json({ error: 'Failed to get countries' });
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getCountries
};
