require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const db = new Database(path.join(__dirname, 'licenses.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS licenses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'active',
 duration_days INTEGER NOT NULL DEFAULT 30,
 created_at TEXT NOT NULL,
 expires_at TEXT,
 hwid TEXT,
 activated_at TEXT,
 note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 action TEXT NOT NULL,
 license_id INTEGER,
 key TEXT,
 detail TEXT DEFAULT '',
 ip TEXT DEFAULT '',
 created_at TEXT NOT NULL
);
`);

app.use(express.json({limit:'64kb'}));
app.use(express.urlencoded({extended:false}));
app.use(session({secret:process.env.SESSION_SECRET || 'change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',maxAge:8*60*60*1000}}));
app.use(express.static(path.join(__dirname,'public')));

const now = () => new Date().toISOString();
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function keyGen(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const p=()=>Array.from({length:5},()=>a[crypto.randomInt(0,a.length)]).join(''); return `${p()}-${p()}-${p()}-${p()}`;}
function audit(req, action, row, detail=''){db.prepare('INSERT INTO audit_logs(action,license_id,key,detail,ip,created_at) VALUES(?,?,?,?,?,?)').run(action,row?.id||null,row?.key||null,detail,ipOf(req),now());}
function auth(req,res,next){if(req.session?.admin)return next();res.status(401).json({error:'Unauthorized'});}
const expectedUser=process.env.ADMIN_USERNAME || 'admin';
const adminHash=bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'change-me',10);

app.get('/api/health',(req,res)=>res.json({ok:true,time:now()}));
app.post('/api/admin/login',async(req,res)=>{const u=String(req.body.username||'');const p=String(req.body.password||'');if(u!==expectedUser || !(await bcrypt.compare(p,adminHash))) return res.status(401).json({error:'Sai tài khoản hoặc mật khẩu'});req.session.admin=true;res.json({ok:true});});
app.post('/api/admin/logout',auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/admin/me',auth,(req,res)=>res.json({ok:true,username:expectedUser}));

app.get('/api/admin/stats',auth,(req,res)=>{
 const total=db.prepare('SELECT COUNT(*) c FROM licenses').get().c;
 const active=db.prepare("SELECT COUNT(*) c FROM licenses WHERE status='active' AND (expires_at IS NULL OR expires_at>?)").get(now()).c;
 const banned=db.prepare("SELECT COUNT(*) c FROM licenses WHERE status='banned'").get().c;
 const disabled=db.prepare("SELECT COUNT(*) c FROM licenses WHERE status='disabled' OR (status='active' AND expires_at IS NOT NULL AND expires_at<=?)").get(now()).c;
 const bound=db.prepare("SELECT COUNT(*) c FROM licenses WHERE hwid IS NOT NULL AND hwid!=''").get().c;
 res.json({total,active,banned,disabled,bound});
});

app.get('/api/admin/licenses',auth,(req,res)=>{
 const q=String(req.query.q||'').trim();
 const status=String(req.query.status||'all');
 let sql='SELECT * FROM licenses WHERE 1=1'; const args=[];
 if(q){sql+=' AND (key LIKE ? OR hwid LIKE ? OR note LIKE ?)'; const s=`%${q}%`;args.push(s,s,s);}
 if(['active','banned','disabled'].includes(status)){sql+=' AND status=?';args.push(status);}
 sql+=' ORDER BY id DESC LIMIT 1000';
 res.json(db.prepare(sql).all(...args));
});

function createLicense(duration,note){
 duration=Math.max(0,Math.min(36500,Number(duration||30)));
 note=String(note||'').slice(0,500);
 let key;do{key=keyGen();}while(db.prepare('SELECT 1 FROM licenses WHERE key=?').get(key));
 const created=now(); const expires=duration>0?new Date(Date.now()+duration*86400000).toISOString():null;
 const info=db.prepare('INSERT INTO licenses(key,status,duration_days,created_at,expires_at,note) VALUES(?,?,?,?,?,?)').run(key,'active',duration,created,expires,note);
 return db.prepare('SELECT * FROM licenses WHERE id=?').get(info.lastInsertRowid);
}
app.post('/api/admin/licenses',auth,(req,res)=>{const row=createLicense(req.body.duration_days,req.body.note);audit(req,'create',row);res.json({ok:true,license:row});});
app.post('/api/admin/licenses/bulk',auth,(req,res)=>{const count=Math.max(1,Math.min(500,Number(req.body.count||1)));const duration=Number(req.body.duration_days||30);const note=String(req.body.note||'').slice(0,500);const rows=[];const tx=db.transaction(()=>{for(let i=0;i<count;i++){const row=createLicense(duration,note);rows.push(row);audit(req,'create_bulk',row,`batch=${count}`);}});tx();res.json({ok:true,licenses:rows});});
app.patch('/api/admin/licenses/:id',auth,(req,res)=>{const id=Number(req.params.id);const status=String(req.body.status||'');if(!['active','banned','disabled'].includes(status))return res.status(400).json({error:'Trạng thái không hợp lệ'});const row=db.prepare('SELECT * FROM licenses WHERE id=?').get(id);if(!row)return res.status(404).json({error:'Không tìm thấy key'});db.prepare('UPDATE licenses SET status=? WHERE id=?').run(status,id);audit(req,status==='banned'?'ban':'status',row,status);res.json({ok:true});});
app.post('/api/admin/licenses/:id/reset-hwid',auth,(req,res)=>{const id=Number(req.params.id);const row=db.prepare('SELECT * FROM licenses WHERE id=?').get(id);if(!row)return res.status(404).json({error:'Không tìm thấy key'});db.prepare("UPDATE licenses SET hwid=NULL, activated_at=NULL WHERE id=?").run(id);audit(req,'reset_hwid',row);res.json({ok:true});});
app.delete('/api/admin/licenses/:id',auth,(req,res)=>{const id=Number(req.params.id);const row=db.prepare('SELECT * FROM licenses WHERE id=?').get(id);if(!row)return res.status(404).json({error:'Không tìm thấy key'});db.prepare('DELETE FROM licenses WHERE id=?').run(id);audit(req,'delete',row);res.json({ok:true});});
app.get('/api/admin/logs',auth,(req,res)=>res.json(db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all()));

function checkLicense(key,hwid,bind){const row=db.prepare('SELECT * FROM licenses WHERE key=?').get(key);if(!row)return {ok:false,code:'INVALID_KEY',message:'Key không tồn tại'};if(row.status!=='active')return {ok:false,code:row.status==='banned'?'BANNED':'KEY_DISABLED',message:row.status==='banned'?'Key đã bị khóa':'Key đã bị vô hiệu hóa'};if(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()){db.prepare("UPDATE licenses SET status='disabled' WHERE id=?").run(row.id);return {ok:false,code:'EXPIRED',message:'Key đã hết hạn'};}if(!hwid||hwid.length<4||hwid.length>256)return {ok:false,code:'INVALID_HWID',message:'HWID không hợp lệ'};if(row.hwid&&row.hwid!==hwid)return {ok:false,code:'HWID_MISMATCH',message:'HWID không khớp'};if(!row.hwid&&bind)db.prepare('UPDATE licenses SET hwid=?,activated_at=? WHERE id=?').run(hwid,now(),row.id);const u=db.prepare('SELECT * FROM licenses WHERE id=?').get(row.id);return {ok:true,key:u.key,status:u.status,expires_at:u.expires_at,activated_at:u.activated_at};}
app.post('/api/license/activate',(req,res)=>{const key=String(req.body.key||'').trim().toUpperCase();const hwid=String(req.body.hwid||'').trim();const result=checkLicense(key,hwid,true);res.status(result.ok?200:400).json(result);});
app.post('/api/license/validate',(req,res)=>{const key=String(req.body.key||'').trim().toUpperCase();const hwid=String(req.body.hwid||'').trim();const result=checkLicense(key,hwid,false);res.status(result.ok?200:400).json(result);});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`License server v2 running: http://localhost:${PORT}`));
