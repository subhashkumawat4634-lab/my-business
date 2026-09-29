import { database } from './db.mjs';
import { createApp } from './app.mjs';
const db = await database();
// Explicit migration command is required; never auto-reset user data.
await db.query('SELECT id FROM organizations LIMIT 1');
const port = Number(process.env.PORT || 4000);
const server = createApp(db).listen(port, () => console.log('ThekaBook API listening on port ' + port));
async function stop() { server.close(async () => { await db.close(); process.exit(0); }); }
process.on('SIGTERM',stop); process.on('SIGINT',stop);
