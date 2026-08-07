const path = require('path');
const fs = require('fs');

// Load env vars from server/.env
const envPath = path.join(__dirname, 'server', '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
  });
}

// Remove PORT from envVars so each instance gets its own
delete envVars.PORT;

const INSTANCE_COUNT = 6;
const BASE_PORT = 5001;

module.exports = {
  apps: Array.from({ length: INSTANCE_COUNT }, (_, i) => ({
    name: `api-${i + 1}`,
    script: 'server/src/index.js',
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
};
