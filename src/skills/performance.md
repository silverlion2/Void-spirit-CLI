# Performance Optimization

## Frontend:
- Lazy load routes and heavy components
- Optimize images: WebP, responsive sizes, lazy loading
- Minimize bundle size: tree-shake, code-split, analyze with `npx vite-bundle-visualizer`
- Debounce/throttle event handlers (scroll, resize, search)
- Use `useMemo`/`useCallback` for expensive computations in React
- Virtualize long lists (react-window, tanstack-virtual)
- Cache API responses (SWR, React Query, stale-while-revalidate)

## Backend:
- Add database indexes on frequently queried columns
- Use connection pooling for databases
- Implement caching (Redis, in-memory) for hot data
- Paginate large result sets
- Use streaming for large responses
- Profile before optimizing: measure, don't guess
- Avoid N+1 queries: use JOINs or batch loading

## General:
- Gzip/Brotli compression for HTTP responses
- Use CDN for static assets
- HTTP/2 for multiplexing
- Preconnect/prefetch for critical resources
- Monitor with real metrics: Core Web Vitals, p95 latency

## Profiling commands:
```bash
# Node.js CPU profile
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Lighthouse audit
npx lighthouse https://your-site.com --output json

# Bundle analysis
npx webpack-bundle-analyzer stats.json
```
