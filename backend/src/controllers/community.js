const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * Community Features Controller
 * Gamification system to grow from 40 to 400+ followers
 */

// Point system configuration
const POINTS_CONFIG = {
  dailyLogin: 10,
  createPost: 25,
  createComment: 15,
  likePost: 2,
  sharePost: 10,
  referralSignup: 500,
  weeklyActive: 50,
  monthlyActive: 200,
  sacrifice: (kas) => Math.floor(kas * 1000), // 1 KAS = 1000 points
  firstPost: 100,
  firstComment: 50,
  popular_post: 100 // When post gets 10+ likes
};

// Achievement definitions
const ACHIEVEMENTS = {
  'first_sacrifice': {
    name: 'First Sacrifice',
    description: 'Made your first KAS sacrifice',
    points: 100,
    icon: '🔥'
  },
  'community_builder': {
    name: 'Community Builder',
    description: 'Created 10 posts',
    requirement: { type: 'posts', count: 10 },
    points: 250,
    icon: '🏗️'
  },
  'social_butterfly': {
    name: 'Social Butterfly',
    description: 'Made 50 comments',
    requirement: { type: 'comments', count: 50 },
    points: 200,
    icon: '🦋'
  },
  'kas_whale': {
    name: 'KAS Whale',
    description: 'Sacrificed 100+ KAS',
    requirement: { type: 'sacrifice_kas', amount: 100 },
    points: 1000,
    icon: '🐋'
  },
  'influencer': {
    name: 'Influencer',
    description: 'Got 100+ likes across all posts',
    requirement: { type: 'total_likes', count: 100 },
    points: 500,
    icon: '⭐'
  },
  'early_adopter': {
    name: 'Early Adopter',
    description: 'One of the first 100 users',
    points: 300,
    icon: '🚀'
  },
  'daily_visitor': {
    name: 'Daily Visitor',
    description: 'Logged in for 7 consecutive days',
    requirement: { type: 'consecutive_days', count: 7 },
    points: 150,
    icon: '📅'
  },
  'referral_master': {
    name: 'Referral Master',
    description: 'Referred 5 new users',
    requirement: { type: 'referrals', count: 5 },
    points: 1000,
    icon: '👥'
  }
};

class CommunityManager {
  constructor() {
    this.io = null; // Will be set externally
  }

  setWebSocket(io) {
    this.io = io;
  }

  /**
   * Award points to user
   */
  async awardPoints(userId, action, amount = null) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const points = amount || POINTS_CONFIG[action] || 0;
      
      if (points <= 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Invalid action or points' };
      }

      // Update user points
      const result = await client.query(`
        INSERT INTO user_points (user_id, points_total, points_weekly, last_reset)
        VALUES ($1, $2, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          points_total = user_points.points_total + $2,
          points_weekly = CASE 
            WHEN user_points.last_reset < NOW() - INTERVAL '7 days' 
            THEN $2 
            ELSE user_points.points_weekly + $2 
          END,
          last_reset = CASE 
            WHEN user_points.last_reset < NOW() - INTERVAL '7 days' 
            THEN CURRENT_TIMESTAMP 
            ELSE user_points.last_reset 
          END
        RETURNING points_total, points_weekly
      `, [userId, points]);

      const updatedPoints = result.rows[0];

      // Log point transaction
      await client.query(`
        INSERT INTO point_transactions (user_id, action, points, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [userId, action, points]);

      await client.query('COMMIT');

      // Check for new achievements
      this.checkAchievements(userId);

      // Notify user via WebSocket
      if (this.io) {
        this.io.emit('points:awarded', {
          userId,
          action,
          points,
          totalPoints: updatedPoints.points_total,
          weeklyPoints: updatedPoints.points_weekly
        });
      }

      return {
        success: true,
        pointsAwarded: points,
        totalPoints: updatedPoints.points_total,
        weeklyPoints: updatedPoints.points_weekly
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to award points:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Check and award achievements
   */
  async checkAchievements(userId) {
    try {
      // Get user stats
      const stats = await this.getUserStats(userId);
      
      for (const [achievementId, achievement] of Object.entries(ACHIEVEMENTS)) {
        // Skip if user already has this achievement
        const existing = await db.query(
          'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
          [userId, achievementId]
        );
        
        if (existing.rows.length > 0) continue;

        let earned = false;

        // Check achievement requirements
        if (!achievement.requirement) {
          // Manual achievements (like first_sacrifice)
          continue;
        }

        const req = achievement.requirement;
        switch (req.type) {
          case 'posts':
            earned = stats.totalPosts >= req.count;
            break;
          case 'comments':
            earned = stats.totalComments >= req.count;
            break;
          case 'sacrifice_kas':
            earned = stats.totalSacrifice >= req.amount;
            break;
          case 'total_likes':
            earned = stats.totalLikes >= req.count;
            break;
          case 'referrals':
            earned = stats.totalReferrals >= req.count;
            break;
          case 'consecutive_days':
            earned = stats.consecutiveDays >= req.count;
            break;
        }

        if (earned) {
          await this.awardAchievement(userId, achievementId, achievement);
        }
      }

    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  }

  /**
   * Award achievement to user
   */
  async awardAchievement(userId, achievementId, achievement) {
    try {
      // Insert achievement
      await db.query(`
        INSERT INTO user_achievements (user_id, achievement_id, unlocked_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, achievement_id) DO NOTHING
      `, [userId, achievementId]);

      // Award points
      if (achievement.points) {
        await this.awardPoints(userId, 'achievement', achievement.points);
      }

      // Notify user
      if (this.io) {
        this.io.emit('achievement:unlocked', {
          userId,
          achievementId,
          achievement: {
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            points: achievement.points
          }
        });
      }

      console.log(`🏆 User ${userId} unlocked achievement: ${achievement.name}`);

    } catch (error) {
      console.error('Failed to award achievement:', error);
    }
  }

  /**
   * Get user statistics for achievements
   */
  async getUserStats(userId) {
    const result = await db.query(`
      SELECT 
        u.sacrifice_points / 100 as total_sacrifice,
        COALESCE(post_stats.post_count, 0) as total_posts,
        COALESCE(comment_stats.comment_count, 0) as total_comments,
        COALESCE(like_stats.like_count, 0) as total_likes,
        COALESCE(referral_stats.referral_count, 0) as total_referrals,
        COALESCE(up.points_total, 0) as total_points,
        COALESCE(up.points_weekly, 0) as weekly_points
      FROM users u
      LEFT JOIN user_points up ON u.id = up.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as post_count 
        FROM community_posts 
        WHERE user_id = $1 
        GROUP BY user_id
      ) post_stats ON u.id = post_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as comment_count 
        FROM community_comments 
        WHERE user_id = $1 
        GROUP BY user_id
      ) comment_stats ON u.id = comment_stats.user_id
      LEFT JOIN (
        SELECT cp.user_id, SUM(cp.likes) as like_count
        FROM community_posts cp
        WHERE cp.user_id = $1
        GROUP BY cp.user_id
      ) like_stats ON u.id = like_stats.user_id
      LEFT JOIN (
        SELECT referred_by, COUNT(*) as referral_count
        FROM users
        WHERE referred_by = $1
        GROUP BY referred_by
      ) referral_stats ON u.id = referral_stats.referred_by
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return {
        totalSacrifice: 0,
        totalPosts: 0,
        totalComments: 0,
        totalLikes: 0,
        totalReferrals: 0,
        totalPoints: 0,
        weeklyPoints: 0,
        consecutiveDays: 0
      };
    }

    const stats = result.rows[0];
    
    // Calculate consecutive login days
    stats.consecutiveDays = await this.getConsecutiveDays(userId);

    return {
      totalSacrifice: parseFloat(stats.total_sacrifice) || 0,
      totalPosts: parseInt(stats.total_posts) || 0,
      totalComments: parseInt(stats.total_comments) || 0,
      totalLikes: parseInt(stats.total_likes) || 0,
      totalReferrals: parseInt(stats.total_referrals) || 0,
      totalPoints: parseInt(stats.total_points) || 0,
      weeklyPoints: parseInt(stats.weekly_points) || 0,
      consecutiveDays: stats.consecutiveDays
    };
  }

  /**
   * Get consecutive login days
   */
  async getConsecutiveDays(userId) {
    // This would require a login tracking table
    // For now, return 0
    return 0;
  }

  /**
   * Get leaderboard data
   */
  async getLeaderboard(type = 'points', limit = 50) {
    let query;
    
    switch (type) {
      case 'points':
        query = `
          SELECT u.id, u.username, up.points_total as score
          FROM users u
          JOIN user_points up ON u.id = up.user_id
          ORDER BY up.points_total DESC
          LIMIT $1
        `;
        break;
      
      case 'sacrifice':
        query = `
          SELECT u.id, u.username, u.sacrifice_points / 100 as score
          FROM users u
          WHERE u.sacrifice_points > 0
          ORDER BY u.sacrifice_points DESC
          LIMIT $1
        `;
        break;
      
      case 'posts':
        query = `
          SELECT u.id, u.username, COUNT(cp.id) as score
          FROM users u
          LEFT JOIN community_posts cp ON u.id = cp.user_id
          GROUP BY u.id, u.username
          HAVING COUNT(cp.id) > 0
          ORDER BY COUNT(cp.id) DESC
          LIMIT $1
        `;
        break;
      
      case 'weekly':
        query = `
          SELECT u.id, u.username, up.points_weekly as score
          FROM users u
          JOIN user_points up ON u.id = up.user_id
          WHERE up.points_weekly > 0
          ORDER BY up.points_weekly DESC
          LIMIT $1
        `;
        break;
      
      default:
        throw new Error('Invalid leaderboard type');
    }

    const result = await db.query(query, [limit]);
    
    return result.rows.map((row, index) => ({
      rank: index + 1,
      userId: row.id,
      username: row.username,
      score: parseFloat(row.score) || 0
    }));
  }
}

const communityManager = new CommunityManager();

/**
 * POST /api/community/posts
 * Create a new community post
 */
router.post('/posts', authMiddleware, async (req, res) => {
  try {
    const { title, content, tags = [] } = req.body;
    const userId = req.user.userId || req.user.id;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.length > 200) {
      return res.status(400).json({ error: 'Title too long (max 200 characters)' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ error: 'Content too long (max 5000 characters)' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Create post
      const postResult = await client.query(`
        INSERT INTO community_posts (user_id, title, content, tags, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `, [userId, title, content, tags]);

      const post = postResult.rows[0];

      // Check if this is user's first post
      const postCount = await client.query(
        'SELECT COUNT(*) FROM community_posts WHERE user_id = $1',
        [userId]
      );

      await client.query('COMMIT');

      // Award points
      const isFirstPost = parseInt(postCount.rows[0].count) === 1;
      if (isFirstPost) {
        await communityManager.awardPoints(userId, 'firstPost', POINTS_CONFIG.firstPost);
      }
      await communityManager.awardPoints(userId, 'createPost', POINTS_CONFIG.createPost);

      // Get user info for response
      const userResult = await db.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );

      res.status(201).json({
        ...post,
        username: userResult.rows[0].username,
        pointsEarned: POINTS_CONFIG.createPost + (isFirstPost ? POINTS_CONFIG.firstPost : 0),
        isFirstPost
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * GET /api/community/posts
 * Get community posts with pagination
 */
router.get('/posts', async (req, res) => {
  try {
    const { page = 1, limit = 20, tag } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [limit, offset];
    
    if (tag) {
      whereClause = 'WHERE $3 = ANY(cp.tags)';
      params.push(tag);
    }

    const result = await db.query(`
      SELECT 
        cp.*,
        u.username,
        COALESCE(comment_count.count, 0) as comment_count
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN (
        SELECT post_id, COUNT(*) as count
        FROM community_comments
        GROUP BY post_id
      ) comment_count ON cp.id = comment_count.post_id
      ${whereClause}
      ORDER BY cp.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    res.json({
      posts: result.rows,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: result.rows.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

/**
 * POST /api/community/posts/:postId/like
 * Like/unlike a post
 */
router.post('/posts/:postId/like', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId || req.user.id;

    // Check if already liked
    const existingLike = await db.query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (existingLike.rows.length > 0) {
        // Unlike
        await client.query(
          'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
          [postId, userId]
        );
        
        await client.query(
          'UPDATE community_posts SET likes = likes - 1 WHERE id = $1',
          [postId]
        );

        await client.query('COMMIT');
        res.json({ liked: false, action: 'unliked' });

      } else {
        // Like
        await client.query(
          'INSERT INTO post_likes (post_id, user_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
          [postId, userId]
        );
        
        const updateResult = await client.query(
          'UPDATE community_posts SET likes = likes + 1 WHERE id = $1 RETURNING likes, user_id',
          [postId]
        );

        await client.query('COMMIT');

        // Award points to liker
        await communityManager.awardPoints(userId, 'likePost', POINTS_CONFIG.likePost);

        // Check if post reached popular status (10+ likes)
        const newLikes = updateResult.rows[0].likes;
        const postOwnerId = updateResult.rows[0].user_id;
        
        if (newLikes === 10) {
          await communityManager.awardPoints(postOwnerId, 'popular_post', POINTS_CONFIG.popular_post);
        }

        res.json({ 
          liked: true, 
          action: 'liked',
          totalLikes: newLikes,
          pointsEarned: POINTS_CONFIG.likePost
        });
      }

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

/**
 * POST /api/community/posts/:postId/comments
 * Add comment to post
 */
router.post('/posts/:postId/comments', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Comment too long (max 1000 characters)' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Create comment
      const commentResult = await client.query(`
        INSERT INTO community_comments (post_id, user_id, content, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING *
      `, [postId, userId, content.trim()]);

      // Check if this is user's first comment
      const commentCount = await client.query(
        'SELECT COUNT(*) FROM community_comments WHERE user_id = $1',
        [userId]
      );

      await client.query('COMMIT');

      // Award points
      const isFirstComment = parseInt(commentCount.rows[0].count) === 1;
      if (isFirstComment) {
        await communityManager.awardPoints(userId, 'firstComment', POINTS_CONFIG.firstComment);
      }
      await communityManager.awardPoints(userId, 'createComment', POINTS_CONFIG.createComment);

      // Get user info
      const userResult = await db.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );

      res.status(201).json({
        ...commentResult.rows[0],
        username: userResult.rows[0].username,
        pointsEarned: POINTS_CONFIG.createComment + (isFirstComment ? POINTS_CONFIG.firstComment : 0),
        isFirstComment
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

/**
 * GET /api/community/posts/:postId/comments
 * Get comments for a post
 */
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT 
        cc.*,
        u.username
      FROM community_comments cc
      JOIN users u ON cc.user_id = u.id
      WHERE cc.post_id = $1
      ORDER BY cc.created_at ASC
      LIMIT $2 OFFSET $3
    `, [postId, limit, offset]);

    res.json({
      comments: result.rows,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: result.rows.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/**
 * GET /api/community/leaderboard/:type
 * Get leaderboard
 */
router.get('/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 50 } = req.query;

    const leaderboard = await communityManager.getLeaderboard(type, parseInt(limit));
    
    res.json({
      type,
      leaderboard,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

/**
 * GET /api/community/user/:userId/stats
 * Get user community statistics
 */
router.get('/user/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const stats = await communityManager.getUserStats(userId);
    
    // Get achievements
    const achievementsResult = await db.query(`
      SELECT ua.achievement_id, ua.unlocked_at
      FROM user_achievements ua
      WHERE ua.user_id = $1
      ORDER BY ua.unlocked_at DESC
    `, [userId]);

    const achievements = achievementsResult.rows.map(row => ({
      id: row.achievement_id,
      unlockedAt: row.unlocked_at,
      ...ACHIEVEMENTS[row.achievement_id]
    }));

    res.json({
      ...stats,
      achievements,
      achievementCount: achievements.length,
      totalAchievements: Object.keys(ACHIEVEMENTS).length
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

/**
 * GET /api/community/achievements
 * Get all available achievements
 */
router.get('/achievements', (req, res) => {
  const achievementList = Object.entries(ACHIEVEMENTS).map(([id, achievement]) => ({
    id,
    ...achievement
  }));

  res.json({
    achievements: achievementList,
    pointsConfig: POINTS_CONFIG
  });
});

// Export the community manager instance so it can be used by other modules
module.exports = { 
  router, 
  communityManager,
  POINTS_CONFIG,
  ACHIEVEMENTS
};