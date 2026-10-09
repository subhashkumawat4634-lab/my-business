const { spawn } = require('child_process');

function startTunnel() {
  console.log('[Tunnel] Connecting localtunnel to port 4000 (subdomain: thekabook-live-api)...');
  const child = spawn('npx', ['-y', 'localtunnel', '--port', '4000', '--subdomain', 'thekabook-live-api'], {
    shell: true,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    console.log(`[Tunnel] Tunnel closed (code: ${code}). Auto-reconnecting in 3s...`);
    setTimeout(startTunnel, 3000);
  });

  child.on('error', (err) => {
    console.error('[Tunnel] Spawn error:', err.message);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
