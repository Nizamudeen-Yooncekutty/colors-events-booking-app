require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { sanitizeInputs } = require('./middleware/sanitize');
const { requestId } = require('./middleware/requestId');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const walkInRoutes = require('./routes/walkins');

const app = express();
const PORT = process.env.PORT || 5000;

const PLACEHOLDER_SECRETS = [
  'your_jwt_secret_change_in_production',
  'change-this-in-production',
  'secret',
  'jwt_secret',
];
if (!process.env.JWT_SECRET || PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not set or uses a placeholder value. Refusing to start.');
    process.exit(1);
  }
  const generated = crypto.randomBytes(64).toString('hex');
  process.env.JWT_SECRET = generated;
  console.warn('WARNING: JWT_SECRET was a placeholder. Generated a random secret for this session. Set a permanent secret in production.');
}

if (process.env.LOAD_TEST === 'true' && process.env.NODE_ENV === 'production') {
  console.error('FATAL: LOAD_TEST=true is not allowed in production. Refusing to start.');
  process.exit(1);
}

app.set('trust proxy', 1);
connectDB();

const clientUrls = process.env.CLIENT_URL?.split(',').map(u => u.trim()) || [];

// Filter out private/internal IPs from CSP connect-src to avoid information disclosure
const PRIVATE_IP_PATTERN = /^https?:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
const publicClientUrls = clientUrls.filter(u => !PRIVATE_IP_PATTERN.test(u));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // unsafe-inline required for style-src: Radix UI and Framer Motion inject inline styles at runtime
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://login.microsoftonline.com", ...publicClientUrls],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL?.split(',').map(u => u.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Reject ambiguous requests (HTTP request smuggling defense)
app.use((req, res, next) => {
  if (req.headers['transfer-encoding'] && req.headers['content-length']) {
    return res.status(400).json({ message: 'Ambiguous request: both Transfer-Encoding and Content-Length present' });
  }
  next();
});

// Request ID tracking
app.use(requestId);

// Logging
const isProduction = process.env.NODE_ENV === 'production';
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Body parsing with limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Cookie parser
app.use(cookieParser());

// HTTP parameter pollution protection
app.use(hpp());

// Input sanitization (XSS, SQL/NoSQL injection)
app.use(sanitizeInputs);

// ── Rate Limiting ──
// Designed for: 10K employees, 1000 reg/min peak, concurrent QR scanning
// LOAD_TEST=true disables all limits for load testing
const isLoadTest = process.env.LOAD_TEST === 'true';
const rl = (max, windowMs, msg) => rateLimit({
  windowMs,
  max: isLoadTest ? 100000 : max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: msg },
});

// Global: 5000 req / 1 min per IP — peak: 10K users burst during event registration
app.use('/api/', rl(5000, 60 * 1000, 'Too many requests, please try again later'));

// Auth: 15 attempts / 5 min per IP — brute-force protection (SSO handles most logins)
const authLimiter = rl(15, 5 * 60 * 1000, 'Too many login attempts, please try again in 5 minutes');
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/sso', rl(30, 5 * 60 * 1000, 'Too many SSO attempts, please try again'));
app.use('/api/auth/refresh', rl(30, 5 * 60 * 1000, 'Too many refresh attempts, please try again'));

// Booking creation: 100 req / 1 min per IP — allows rapid registration during peak
app.use('/api/bookings', rl(100, 60 * 1000, 'Too many booking requests, please slow down'));

// Admin: 500 req / 1 min per IP — dashboard polling, reports, management
app.use('/api/admin', rl(500, 60 * 1000, 'Too many requests, please try again later'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/walkins', walkInRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(`[${req.requestId || 'no-id'}] ${err.stack}`);
  }

  res.status(status).json({
    message: status >= 500 ? 'Internal server error' : err.message,
    ...(req.requestId && { requestId: req.requestId }),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
