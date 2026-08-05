module.exports = {
  apps: [{
    name: 'ust-passmint-api',
    script: 'server/src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 5000,
    },
    max_memory_restart: '500M',
    watch: false,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
