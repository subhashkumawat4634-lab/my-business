const localtunnel = require('localtunnel');

async function startTunnel() {
  console.log('[Tunnel] Connecting localtunnel to port 4000 (subdomain: thekabook-live-api)...');
  try {
    const tunnel = await localtunnel({
      port: 4000,
      subdomain: 'thekabook-live-api',
    });

    console.log(`[Tunnel] Live URL ready: ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('[Tunnel] Tunnel closed. Reconnecting in 3s...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('[Tunnel] Error:', err.message);
      try { tunnel.close(); } catch {}
      setTimeout(startTunnel, 3000);
    });
  } catch (err) {
    console.error('[Tunnel] Failed to start:', err.message);
    setTimeout(startTunnel, 3000);
  }
}

startTunnel();
