module.exports = {
  apps: [
    {
      name: 'unlockit-production',
      script: 'server/index.js',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}; 