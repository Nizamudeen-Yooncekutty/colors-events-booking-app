const path = require('path');
const fs = require('fs');

const envVars = {};
const envFiles = [
  path.join(__dirname, '.env'),
  path.join(__dirname, 'server', '.env'),
];

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const index = trimmed.indexOf('=');
  if (index < 1) return null;

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();

  const quoted = (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"));
  if (quoted) value = value.slice(1, -1);
  if (!quoted) value = value.replace(/\s+#.*$/, '').trim();

  return { key, value };
}

envFiles.forEach((envPath) => {
  if (!fs.existsSync(envPath)) return;

  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const parsed = parseEnvLine(line);
    if (parsed) envVars[parsed.key] = parsed.value;
  });
});

// Remove PORT from envVars so each instance gets its own
delete envVars.PORT;

const INSTANCE_COUNT = 6;
const BASE_PORT = 5001;
const MONGO_ROOT = '/home/196285@USTDEV.COM/.local/mongodb';
const MONGO_BIN = path.join(MONGO_ROOT, 'bin', 'mongod');
const MONGO_DBPATH = path.join(MONGO_ROOT, 'data');
const MONGO_LOGPATH = path.join(MONGO_ROOT, 'log', 'mongod.log');

module.exports = {
  apps: [
    {
      name: 'mongodb',
      script: MONGO_BIN,
      args: [
        '--dbpath', MONGO_DBPATH,
        '--logpath', MONGO_LOGPATH,
        '--port', '27017',
        '--bind_ip', '127.0.0.1,10.100.242.100',
      ],
      autorestart: true,
      max_restarts: 10,
      watch: false,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    ...Array.from({ length: INSTANCE_COUNT }, (_, i) => ({
      name: `api-${i + 1}`,
      script: 'server/src/index.js',
      node_args: '--use-system-ca',
      env: {
        NODE_ENV: 'production',
        ...envVars,
        PORT: BASE_PORT + i,
      },
      max_memory_restart: '500M',
      watch: false,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    })),
  ],
};
