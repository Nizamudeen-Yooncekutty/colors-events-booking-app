const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  const reqId = req.headers['x-request-id'] || req.id || '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      reqId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: duration + 'ms',
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '-',
      user: req.employee ? {
        id: req.employee.employeeId,
        name: req.employee.name,
        role: req.employee.role,
      } : null,
    };

    if (req.method !== 'GET' && req.body) {
      const safeBody = { ...req.body };
      if (safeBody.password) safeBody.password = '***';
      if (safeBody.token) safeBody.token = '***';
      if (safeBody.idToken) safeBody.idToken = '***';
      log.body = safeBody;
    }

    if (res.statusCode >= 500) {
      logger.error('REQUEST', log);
    } else if (res.statusCode >= 400) {
      logger.warn('REQUEST', log);
    } else {
      logger.info('REQUEST', log);
    }
  });

  next();
};

const logAction = (action, details) => {
  logger.info(action, details);
};

const logError = (action, error, details = {}) => {
  logger.error(action, {
    ...details,
    error: error.message || error,
    stack: error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : undefined,
  });
};

module.exports = { requestLogger, logAction, logError };
