require('dotenv').config();
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

connectDB();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL?.split(',').map(u => u.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Request ID tracking
app.use(requestId);

// Logging
app.use(morgan('dev'));

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
  const isProduction = process.env.NODE_ENV === 'production';

  if (status >= 500) {
    console.error(`[${req.requestId || 'no-id'}] ${err.stack}`);
  }

  res.status(status).json({
    message: status >= 500 && isProduction ? 'Internal server error' : err.message,
    ...(req.requestId && { requestId: req.requestId }),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
