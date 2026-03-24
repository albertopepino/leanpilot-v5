process.env.NODE_ENV = 'development';
const { execSync } = require('child_process');
const port = process.env.PORT || 4001;
execSync(`npx next dev --turbopack --port ${port}`, {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' },
});
