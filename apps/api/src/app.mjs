import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { randomUUID, randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { wages } from '../../../shared/finance.js';
import { generateWorkerReportHtml } from './workerReportHtml.mjs';
import fs from 'node:fs';
import path from 'node:path';
const scrypt = promisify(_scrypt);

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const hash = value => createHash('sha256').update(value).digest('hex');
const id = z.uuid(), text = z.string().trim().min(1).max(200);
const short = z.string().trim().max(300).default('');
const amount = z.number().int().min(0).max(99999999999);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s;
}, 'Invalid calendar date');
const siteSchema = z.object({ name: text, owner_name: text, phone: short, address: short,
  work_type: z.enum(['LABOUR','MATERIAL']), pricing: z.enum(['FIXED','UNIT','DAILY']),
  contract_amount: amount, quantity: z.number().positive().max(10000000).default(1), unit: text.default('job'),
  unit_rate: amount.default(0), remaining_estimate: amount.default(0),
  status: z.enum(['UPCOMING','ONGOING','PAUSED','COMPLETED']).default('ONGOING'),
  start_date: date, end_date: date.nullable().default(null), notes: z.string().max(4000).default('')
}).strict().refine(x => !x.end_date || x.end_date >= x.start_date, 'End date must follow start date');
const workerSchema = z.object({ name: text, phone: short, skill: text, daily_rate: amount, overtime_rate: amount, active: z.boolean().default(true) }).strict();
const attendanceSchema = z.object({ site_id: id, worker_id: id, date,
  units: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
  overtime_minutes: z.number().int().min(0).max(960), notes: short
}).strict().refine(x => x.units > 0 || x.overtime_minutes === 0, 'Absent worker cannot have overtime');
const entrySchema = z.object({ site_id: id, worker_id: id.nullable().default(null),
  kind: z.enum(['RECEIPT','WAGE_PAYMENT','MATERIAL','EXPENSE','EXTRA','SUPPLIER_PAYMENT']),
  date, amount: amount.refine(n => n > 0), description: text, party: short,
  mode: z.enum(['CASH','UPI','BANK','RECORD']).default('CASH'), reference: short,
  due_date: date.nullable().default(null), linked_entry_id: id.nullable().default(null),
  quantity: z.number().positive().max(10000000).nullable().default(null), unit: short
}).strict();
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const requireThat = (condition, message, status = 400) => { if (!condition) throw new HttpError(status, message); };
async function one(db, sql, params) { return (await db.query(sql,params)).rows[0]; }
async function belongs(db, table, org, entity) {
  const row = await one(db, `SELECT * FROM ${table} WHERE org_id=$1 AND id=$2`, [org,entity]);
  requireThat(row, 'Record not found', 404); return row;
}
// Table identifiers are internal constants only; all user values are parameterized.
async function insert(db, table, values) {
  const keys = Object.keys(values);
  return one(db, `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i) => '$'+(i+1)).join(',')}) RETURNING *`, Object.values(values));
}
async function update(db, table, org, entity, values) {
  const keys = Object.keys(values);
  return one(db, `UPDATE ${table} SET ${keys.map((k,i) => `${k}=$${i+3}`).join(',')} WHERE org_id=$1 AND id=$2 RETURNING *`, [org,entity,...Object.values(values)]);
}
async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + Buffer.from(await scrypt(password, salt, 64)).toString('hex');
}
async function verify(password, saved) {
  const [salt,key] = saved.split(':');
  return timingSafeEqual(Buffer.from(key,'hex'), Buffer.from(await scrypt(password,salt,64)));
}
async function session(db, user) {
  const token = randomBytes(32).toString('hex');
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [hash(token),user.id,new Date(Date.now()+7*86400000)]);
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}
export function createApp(db, { testing = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  }));
  const allowed = (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      try {
        const u = new URL(origin);
        if (
          u.hostname === 'localhost' ||
          u.hostname === '127.0.0.1' ||
          u.hostname === '::1' ||
          u.hostname.endsWith('.local') ||
          !u.hostname.includes('.') ||
          /^192\.168\.\d+\.\d+$/.test(u.hostname) ||
          /^10\.\d+\.\d+\.\d+$/.test(u.hostname) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(u.hostname)
        ) {
          return cb(null, true);
        }
      } catch {}
      if (!process.env.CORS_ORIGINS) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  if (!testing) app.use(rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get('/health', async (_req,res) => { await db.query('SELECT 1'); res.json({ ok: true, database: 'postgresql' }); });
  const authLimiter = rateLimit({ windowMs: 15*60000, limit: 20, skip: () => testing, standardHeaders: 'draft-8', legacyHeaders: false });
  app.post('/auth/register', authLimiter, async (req,res) => {
    const b = z.object({ name: text, organization: text, email: z.email().max(254).transform(s=>s.toLowerCase()), password: z.string().min(10).max(128) }).strict().parse(req.body);
    const password_hash = await passwordHash(b.password);
    const result = await db.transaction(async tx => {
      const org = await insert(tx,'organizations',{id:randomUUID(), name:b.organization});
      const user = await insert(tx,'users',{id:randomUUID(),org_id:org.id,name:b.name,email:b.email,password_hash});
      return session(tx,user);
    });
    res.status(201).json(result);
  });
  app.post('/auth/login', authLimiter, async (req,res) => {
    const b = z.object({email:z.email().max(254),password:z.string().min(1).max(128)}).parse(req.body);
    const user = await one(db,'SELECT * FROM users WHERE email=$1',[b.email.toLowerCase()]);
    requireThat(user && await verify(b.password,user.password_hash), 'Email or password is incorrect',401);
    res.json(await session(db,user));
  });

  // Public Report Viewer for WhatsApp Worker Monthly Slips
  app.get('/report/worker/:workerId', async (req, res, next) => {
    try {
      const workerId = req.params.workerId;
      const worker = await one(db, 'SELECT * FROM workers WHERE id=$1', [workerId]);
      if (!worker) {
        return res.status(404).send('<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Worker Report Not Found</h2><p>The requested worker attendance slip could not be found or may have been deleted.</p></body></html>');
      }
      const org = await one(db, 'SELECT id, name FROM organizations WHERE id=$1', [worker.org_id]);
      const sites = (await db.query('SELECT id, name FROM sites WHERE org_id=$1', [worker.org_id])).rows;
      
      const now = new Date();
      const year = parseInt(req.query.y, 10) || now.getFullYear();
      const month = parseInt(req.query.m, 10) || (now.getMonth() + 1);
      const lang = req.query.lang === 'en' ? 'en' : 'hi';

      const countDays = new Date(year, month, 0).getDate();
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const startDate = `${monthPrefix}-01`;
      const endDate = `${monthPrefix}-${String(countDays).padStart(2, '0')}`;

      const attendance = (await db.query(
        'SELECT * FROM attendance WHERE org_id=$1 AND worker_id=$2 AND date >= $3 AND date <= $4 ORDER BY date ASC',
        [worker.org_id, worker.id, startDate, endDate]
      )).rows;

      const entries = (await db.query(
        'SELECT * FROM entries WHERE org_id=$1 AND worker_id=$2 AND date >= $3 AND date <= $4 AND voided_at IS NULL ORDER BY date ASC',
        [worker.org_id, worker.id, startDate, endDate]
      )).rows;

      const html = generateWorkerReportHtml({
        worker,
        org,
        sites,
        attendance,
        entries,
        year,
        month,
        lang,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      next(err);
    }
  });

  app.use(async (req,res,next) => {
    const token = req.headers.authorization?.replace(/^Bearer /,'') || (typeof req.query.token === 'string' ? req.query.token : undefined);
    requireThat(token && /^[a-f0-9]{64}$/.test(token),'Please sign in',401);
    const user = await one(db,'SELECT u.id,u.org_id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(token)]);
    requireThat(user,'Session expired. Please sign in again.',401);
    req.user = user; req.token = token; next();
  });
  app.post('/auth/logout', async (req,res) => { await db.query('DELETE FROM sessions WHERE token_hash=$1',[hash(req.token)]); res.json({ok:true}); });
  app.post('/documents/upload', async (req, res) => {
    const { id: docId, name, mimeType, dataUrl } = req.body || {};
    if (!docId || !dataUrl) {
      return res.status(400).json({ error: 'Missing document id or dataUrl' });
    }
    try {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      const base64Content = match ? match[2] : dataUrl;
      const detectedMime = match ? match[1] : (mimeType || 'application/pdf');
      const buffer = Buffer.from(base64Content, 'base64');
      const filePath = path.join(uploadsDir, `${docId}.bin`);
      const metaPath = path.join(uploadsDir, `${docId}.json`);
      fs.writeFileSync(filePath, buffer);
      fs.writeFileSync(metaPath, JSON.stringify({
        id: docId,
        orgId: req.user.org_id,
        name: name || 'document.pdf',
        mimeType: detectedMime,
        size: buffer.length,
        createdAt: new Date().toISOString(),
      }));
      res.json({ ok: true, id: docId });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save document' });
    }
  });

  app.get('/documents/:id', async (req, res) => {
    const rawId = req.params.id;
    const decodedId = decodeURIComponent(rawId);
    let filePath = path.join(uploadsDir, `${rawId}.bin`);
    let metaPath = path.join(uploadsDir, `${rawId}.json`);

    if (!fs.existsSync(filePath)) {
      // Try with decodedId
      const testPath = path.join(uploadsDir, `${decodedId}.bin`);
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        metaPath = path.join(uploadsDir, `${decodedId}.json`);
      }
    }

    if (!fs.existsSync(filePath) && fs.existsSync(uploadsDir)) {
      // Search all metadata JSONs for matching document name or ID
      try {
        const files = fs.readdirSync(uploadsDir);
        for (const f of files) {
          if (f.endsWith('.json')) {
            try {
              const metaContent = JSON.parse(fs.readFileSync(path.join(uploadsDir, f), 'utf8'));
              if (
                metaContent.id === rawId ||
                metaContent.id === decodedId ||
                metaContent.name === rawId ||
                metaContent.name === decodedId
              ) {
                const baseKey = f.replace(/\.json$/, '');
                const candBin = path.join(uploadsDir, `${baseKey}.bin`);
                if (fs.existsSync(candBin)) {
                  filePath = candBin;
                  metaPath = path.join(uploadsDir, f);
                  break;
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document not found' });
    }
    let meta = { name: decodedId || 'document.pdf', mimeType: 'application/pdf' };
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {}
    }
    const filename = meta.name || decodedId || 'document.pdf';
    res.setHeader('Content-Type', meta.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });

  app.get('/snapshot', async (req,res) => {
    const result = await db.transaction(async tx => {
      // Serialize snapshot with writes to avoid mixed financial revisions.
      await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[req.user.org_id]);
      const liveUser = await one(tx,'SELECT id,org_id,name,email,created_at FROM users WHERE id=$1',[req.user.id]);
      const data = { organization: await one(tx,'SELECT id,name,revision FROM organizations WHERE id=$1',[req.user.org_id]), user: liveUser || req.user };
      for (const table of ['sites','workers','attendance','entries']) {
        data[table] = (await tx.query(`SELECT * FROM ${table} WHERE org_id=$1 ORDER BY id LIMIT 10001`,[req.user.org_id])).rows;
        requireThat(data[table].length <= 10000,'Account exceeds first-release report limit. Paginated reporting is required before adding more records.',413);
      }
      data.audit = (await tx.query('SELECT action,entity_id,created_at FROM audit WHERE org_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.org_id])).rows;
      return data;
    });
    res.json(result);
  });
  app.post('/commands', async (req,res) => {
    const b = z.object({ key:id, action:z.enum(['site.create','site.update','worker.create','worker.update','attendance.save','entry.create','entry.void','profile.update']), entity_id:id.optional(), data:z.record(z.string(),z.unknown()) }).strict().parse(req.body);
    const org = req.user.org_id, digest = hash(JSON.stringify({action:b.action,entity_id:b.entity_id,data:b.data}));
    const result = await db.transaction(async tx => {
      // One organization row lock prevents cross-site attendance and payment races.
      await tx.query('UPDATE organizations SET revision=revision+1 WHERE id=$1',[org]);
      const previous = await one(tx,'SELECT * FROM requests WHERE org_id=$1 AND key=$2',[org,b.key]);
      if(previous) { requireThat(previous.hash === digest,'Request key reused with different data',409); return previous.result; }
      let before = null, after, entity = b.entity_id || randomUUID();
      if (b.action.startsWith('site.')) {
        const v = siteSchema.parse(b.data);
        if(v.pricing !== 'FIXED') { v.contract_amount = Math.round(v.quantity * v.unit_rate); requireThat(v.contract_amount <= 99999999999,'Contract amount too large'); }
        if(v.status === 'COMPLETED') v.remaining_estimate = 0;
        if(b.action === 'site.update') { requireThat(b.entity_id,'Site ID required'); before = await belongs(tx,'sites',org,entity); after = await update(tx,'sites',org,entity,v); }
        else after = await insert(tx,'sites',{id:entity,org_id:org,...v});
      } else if(b.action.startsWith('worker.')) {
        const v = workerSchema.parse(b.data);
        if(b.action === 'worker.update') { requireThat(b.entity_id,'Worker ID required'); before = await belongs(tx,'workers',org,entity); after = await update(tx,'workers',org,entity,v); }
        else after = await insert(tx,'workers',{id:entity,org_id:org,...v});
      } else if(b.action === 'attendance.save') {
        const v = attendanceSchema.parse(b.data);
        await belongs(tx,'sites',org,v.site_id); const worker = await belongs(tx,'workers',org,v.worker_id);
        requireThat(worker.active,'Worker is inactive');
        requireThat(v.date <= new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),'Future attendance is not allowed');
        const others = await one(tx,'SELECT COALESCE(SUM(units),0) AS units, COALESCE(SUM(overtime_minutes),0) AS overtime FROM attendance WHERE org_id=$1 AND worker_id=$2 AND date=$3 AND site_id<>$4',[org,v.worker_id,v.date,v.site_id]);
        requireThat(Number(others.units)+v.units <= 1,'Worker already assigned a full day across sites');
        requireThat(Number(others.overtime)+v.overtime_minutes <= 960,'Total overtime exceeds 16 hours');
        before = await one(tx,'SELECT * FROM attendance WHERE org_id=$1 AND site_id=$2 AND worker_id=$3 AND date=$4',[org,v.site_id,v.worker_id,v.date]) || null;
        if(before) requireThat(v.notes.trim().length >= 3,'Enter a reason when correcting attendance');
        const daily_rate = Number(before?.daily_rate ?? worker.daily_rate), overtime_rate = Number(before?.overtime_rate ?? worker.overtime_rate);
        const values = {...v,daily_rate,overtime_rate,amount:wages(v.units,v.overtime_minutes,daily_rate,overtime_rate)};
        requireThat(values.amount <= 99999999999,'Earned wage amount too large');
        if(before) { entity = before.id; after = await update(tx,'attendance',org,entity,values); }
        else after = await insert(tx,'attendance',{id:entity,org_id:org,...values});
      } else if(b.action === 'entry.create') {
        const v = entrySchema.parse(b.data); await belongs(tx,'sites',org,v.site_id);
        requireThat((v.kind === 'WAGE_PAYMENT') === !!v.worker_id,'Select a worker only for labour payments');
        if(v.worker_id) await belongs(tx,'workers',org,v.worker_id);
        requireThat((v.kind === 'SUPPLIER_PAYMENT') === !!v.linked_entry_id,'Supplier payment must reference a cost bill');
        if(v.kind === 'EXTRA') requireThat(v.reference.trim().length >= 3,'Record the client approval reference for extra work');
        if(v.linked_entry_id) {
          const bill = await belongs(tx,'entries',org,v.linked_entry_id);
          requireThat(['MATERIAL','EXPENSE'].includes(bill.kind) && !bill.voided_at && bill.site_id === v.site_id,'Choose a valid cost bill from this site');
          const paid = await one(tx,"SELECT COALESCE(SUM(amount),0) AS n FROM entries WHERE org_id=$1 AND linked_entry_id=$2 AND voided_at IS NULL",[org,bill.id]);
          requireThat(Number(paid.n)+v.amount <= Number(bill.amount),'Payment exceeds bill balance');
        }
        after = await insert(tx,'entries',{id:entity,org_id:org,...v});
      } else if (b.action === 'profile.update') {
        const v = z.object({
          name: z.string().trim().min(1).max(100).optional(),
          organization_name: z.string().trim().min(1).max(100).optional(),
        }).parse(b.data);
        if (v.name) {
          before = await one(tx, 'SELECT id,name FROM users WHERE id=$1', [req.user.id]);
          await tx.query('UPDATE users SET name=$1 WHERE id=$2', [v.name, req.user.id]);
        }
        if (v.organization_name) {
          await tx.query('UPDATE organizations SET name=$1 WHERE id=$2', [v.organization_name, org]);
        }
        after = { user_id: req.user.id, name: v.name, organization_name: v.organization_name };
      } else {
        requireThat(b.entity_id,'Entry ID required');
        const v = z.object({reason:z.string().trim().min(3).max(300)}).strict().parse(b.data);
        before = await belongs(tx,'entries',org,entity); requireThat(!before.voided_at,'Entry already voided',409);
        const paid = await one(tx,'SELECT id FROM entries WHERE org_id=$1 AND linked_entry_id=$2 AND voided_at IS NULL LIMIT 1',[org,entity]);
        requireThat(!paid,'Void linked supplier payments before voiding this bill');
        after = await update(tx,'entries',org,entity,{voided_at:new Date(),void_reason:v.reason});
      }
      const response = {record:after};
      await insert(tx,'audit',{id:randomUUID(),org_id:org,user_id:req.user.id,action:b.action,entity_id:entity,before_data:before ? JSON.stringify(before) : null,after_data:JSON.stringify(after)});
      await insert(tx,'requests',{org_id:org,key:b.key,hash:digest,result:JSON.stringify(response)});
      return response;
    });
    res.json(result);
  });
  app.use((err,req,res,_next) => {
    if(err instanceof z.ZodError) return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});
    if(err.code === '23505') return res.status(409).json({error:'Record already exists. Use another email or refresh.'});
    if(err.type === 'entity.parse.failed') return res.status(400).json({error:'Invalid JSON'});
    if(!err.status && !testing) console.error('API error:',err.message);
    res.status(err.status || 500).json({error:err.status ? err.message : 'Unable to complete request. Retry safely or contact support.'});
  });
  return app;
}
