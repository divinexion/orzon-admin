module.exports = {
  apps: [
    {
      name: 'orzon-admin',
      script: 'env-cmd',
      args: '-f ./.env node ./bin/www',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      }
    }
  ]
}