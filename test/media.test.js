
const request = require('supertest');
const mongoose = require('mongoose');
const redis = require('redis');
const app = require('../server');

let jwtToken;
let mediaId;
let redisClient;


const AdminUser = require('../models/AdminUser');

beforeAll(async () => {
  // Create Redis client for cleanup
  redisClient = redis.createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();

  // Clean up test user if exists
  await AdminUser.deleteOne({ email: 'testuser@example.com' });

  // Signup and login to get JWT
  await request(app)
    .post('/auth/signup')
    .send({ email: 'testuser@example.com', password: 'testpass123' });
  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'testuser@example.com', password: 'testpass123' });
  jwtToken = loginRes.body.token;
});

afterAll(async () => {
  // Cleanup MongoDB and Redis connections
  await mongoose.connection.close();
  await redisClient.quit();
});

describe('Media API', () => {
  it('should require JWT for /media/:id/view', async () => {
    const res = await request(app).post('/media/123456789012345678901234/view');
    expect(res.statusCode).toBe(401);
  });

  it('should require JWT for /media/:id/analytics', async () => {
    const res = await request(app).get('/media/123456789012345678901234/analytics');
    expect(res.statusCode).toBe(401);
  });

  it('should allow adding media with JWT', async () => {
    const res = await request(app)
      .post('/media')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ title: 'Test Video', type: 'video', file_url: 'http://example.com/video.mp4' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('_id');
    mediaId = res.body._id;
  });

  it('should get a secure stream URL for media', async () => {
    const res = await request(app)
      .get(`/media/${mediaId}/stream-url`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('secure_stream_url');
    // Extract token for stream test
    const url = res.body.secure_stream_url;
    const token = url.split('/stream/')[1];
    expect(token).toBeTruthy();
    // Test stream access
    const streamRes = await request(app).get(`/stream/${token}`);
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.text).toContain('Access granted to stream file');
  });

  it('should log a view for media with JWT', async () => {
    const res = await request(app)
      .post(`/media/${mediaId}/view`)
      .set('Authorization', `Bearer ${jwtToken}`);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'View logged');
  });

  it('should enforce rate limiting on view logging', async () => {
    // Assuming rate limit is set low for testing
    const res1 = await request(app)
      .post(`/media/${mediaId}/view`)
      .set('Authorization', `Bearer ${jwtToken}`);
    const res2 = await request(app)
      .post(`/media/${mediaId}/view`)
      .set('Authorization', `Bearer ${jwtToken}`);
    // One should be rate limited (status 429)
    expect([res1.statusCode, res2.statusCode]).toContain(429);
  });

  it('should return analytics for media with JWT', async () => {
    // Clear Redis cache for analytics
    await redisClient.del(`media:${mediaId}:analytics`);
    const res = await request(app)
      .get(`/media/${mediaId}/analytics`)
      .set('Authorization', `Bearer ${jwtToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('total_views');
    expect(res.body).toHaveProperty('unique_ips');
    expect(res.body).toHaveProperty('views_per_day');
  });

  it('should reject invalid media type', async () => {
    const res = await request(app)
      .post('/media')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ title: 'Bad Media', type: 'image', file_url: 'http://example.com/image.jpg' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should reject missing fields when adding media', async () => {
    const res = await request(app)
      .post('/media')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ title: 'Missing Type' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should reject invalid JWT', async () => {
    const res = await request(app)
      .post('/media')
      .set('Authorization', 'Bearer invalidtoken')
      .send({ title: 'Test Video', type: 'video', file_url: 'http://example.com/video.mp4' });
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('message');
  });

  it('should reject missing JWT format', async () => {
    const res = await request(app)
      .post('/media')
      .set('Authorization', jwtToken) // No 'Bearer '
      .send({ title: 'Test Video', type: 'video', file_url: 'http://example.com/video.mp4' });
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  it('should return zero analytics for new media', async () => {
    // Add new media
    const res = await request(app)
      .post('/media')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ title: 'No Views', type: 'video', file_url: 'http://example.com/noviews.mp4' });
    const newMediaId = res.body._id;
    // Clear Redis cache for analytics
    await redisClient.del(`media:${newMediaId}:analytics`);
    const analyticsRes = await request(app)
      .get(`/media/${newMediaId}/analytics`)
      .set('Authorization', `Bearer ${jwtToken}`);
    expect(analyticsRes.statusCode).toBe(200);
    expect(analyticsRes.body.total_views).toBe(0);
    expect(analyticsRes.body.unique_ips).toBe(0);
    expect(Object.keys(analyticsRes.body.views_per_day).length).toBe(0);
  });
});
