require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("betnova.db");
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league TEXT NOT NULL,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds TEXT,
  confidence INTEGER DEFAULT 80,
  kickoff TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const adminEmail = process.env.ADMIN_EMAIL || "admin@betnova.local";
const adminPassword = process.env.ADMIN_PASSWORD || "change-this-password";
if (!db.prepare("SELECT id FROM admins WHERE email=?").get(adminEmail)) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)").run(adminEmail, hash);
}

function auth(req,res,next){
  const token = req.cookies.bn_token;
  if(!token) return res.status(401).json({error:"Authentication required"});
  try { req.admin = jwt.verify(token, process.env.JWT_SECRET || "dev-only-secret"); next(); }
  catch { return res.status(401).json({error:"Invalid session"}); }
}

app.post("/api/auth/login",(req,res)=>{
  const {email,password}=req.body||{};
  const admin=db.prepare("SELECT * FROM admins WHERE email=?").get(email);
  if(!admin || !bcrypt.compareSync(password||"",admin.password_hash))
    return res.status(401).json({error:"Invalid email or password"});
  const token=jwt.sign({id:admin.id,email:admin.email},process.env.JWT_SECRET||"dev-only-secret",{expiresIn:"8h"});
  res.cookie("bn_token",token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000});
  res.json({ok:true});
});

app.post("/api/auth/logout",(req,res)=>{res.clearCookie("bn_token");res.json({ok:true})});
app.get("/api/auth/me",auth,(req,res)=>res.json({email:req.admin.email}));

app.post("/api/auth/change-password",auth,(req,res)=>{
  const {currentPassword,newPassword}=req.body||{};
  if(!currentPassword || !newPassword) return res.status(400).json({error:"Current and new passwords are required"});
  if(String(newPassword).length < 8) return res.status(400).json({error:"New password must be at least 8 characters"});
  const admin=db.prepare("SELECT * FROM admins WHERE id=?").get(req.admin.id);
  if(!admin || !bcrypt.compareSync(currentPassword,admin.password_hash)) return res.status(401).json({error:"Current password is incorrect"});
  const hash=bcrypt.hashSync(newPassword,12);
  db.prepare("UPDATE admins SET password_hash=? WHERE id=?").run(hash,req.admin.id);
  res.json({ok:true});
});

app.get("/api/predictions",(req,res)=>{
  const {market,league,status}=req.query;
  let sql="SELECT * FROM predictions WHERE 1=1", params=[];
  if(market){sql+=" AND market=?";params.push(market)}
  if(league){sql+=" AND league=?";params.push(league)}
  if(status){sql+=" AND status=?";params.push(status)}
  sql+=" ORDER BY datetime(kickoff) ASC";
  res.json(db.prepare(sql).all(...params));
});

app.post("/api/predictions",auth,(req,res)=>{
  const {league,home,away,market,selection,odds,confidence,kickoff,status}=req.body||{};
  if(!league||!home||!away||!market||!selection||!kickoff)
    return res.status(400).json({error:"Required fields are missing"});
  const info=db.prepare(`INSERT INTO predictions
    (league,home,away,market,selection,odds,confidence,kickoff,status)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(
      league,home,away,market,selection,odds||"",Number(confidence)||80,kickoff,status||"Pending"
    );
  res.status(201).json(db.prepare("SELECT * FROM predictions WHERE id=?").get(info.lastInsertRowid));
});

app.put("/api/predictions/:id",auth,(req,res)=>{
  const {league,home,away,market,selection,odds,confidence,kickoff,status}=req.body||{};
  const result=db.prepare(`UPDATE predictions SET league=?,home=?,away=?,market=?,selection=?,odds=?,confidence=?,kickoff=?,status=? WHERE id=?`)
    .run(league,home,away,market,selection,odds||"",Number(confidence)||80,kickoff,status||"Pending",req.params.id);
  if(!result.changes) return res.status(404).json({error:"Prediction not found"});
  res.json(db.prepare("SELECT * FROM predictions WHERE id=?").get(req.params.id));
});

app.delete("/api/predictions/:id",auth,(req,res)=>{
  const result=db.prepare("DELETE FROM predictions WHERE id=?").run(req.params.id);
  if(!result.changes) return res.status(404).json({error:"Prediction not found"});
  res.json({ok:true});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`BetNova running on http://localhost:${PORT}`));
