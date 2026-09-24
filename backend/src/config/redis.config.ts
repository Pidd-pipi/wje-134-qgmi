export const redisConfig = () => ({
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
    rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 60),
    reportCacheSeconds: Number(process.env.REPORT_CACHE_SECONDS ?? 300)
  }
});
