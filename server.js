const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const PORT=process.env.PORT||3000;
const OWNER_IDS=[...new Set((String(process.env.OWNER_IDS||"")+","+String(process.env.OWNER_ID||"")+",38263727,5158203829").split(",").map(x=>x.trim()).filter(Boolean))];
const REGISTER_URL=process.env.REGISTER_URL||"https://one-vv4027.com/?open=register&p=ka7s";
const TELEGRAM_BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN||"";
const TELEGRAM_PUBLIC_KEY_HEX="e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
let TELEGRAM_BOT_ID=String(process.env.TELEGRAM_BOT_ID||"").trim();
const MINI_APP_URL=process.env.MINI_APP_URL||"https://jetlucky1.onrender.com";
const WEBHOOK_URL=process.env.WEBHOOK_URL||"https://jetlucky1.onrender.com/telegram/webhook";
const ROOT=__dirname;
let luckyJetBridgeToken={value:crypto.randomBytes(24).toString("hex"),expiresAt:0};
function bridgeTokenValid(value){const v=String(value||"");if(!v||!luckyJetBridgeToken.value||Date.now()>luckyJetBridgeToken.expiresAt)return false;const a=Buffer.from(v),b=Buffer.from(luckyJetBridgeToken.value);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function bridgeCors(res){res.setHeader("Access-Control-Allow-Origin","https://1wmljx.life");res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, X-LuckyJet-Bridge-Token");res.setHeader("Vary","Origin");}

const DATA_FILE=path.join(ROOT,".luckyjet-users.json");const SETTINGS_FILE=path.join(ROOT,".luckyjet-settings.json");const settings=(()=>{try{return JSON.parse(fs.readFileSync(SETTINGS_FILE,"utf8"))||{paused:false}}catch{return {paused:false}}})();function saveSettings(){try{fs.writeFileSync(SETTINGS_FILE,JSON.stringify(settings,null,2))}catch(e){console.error("settings_store_error",e.message)}}
const users=(()=>{try{return JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))||{}}catch{return {}}})();
function saveUsers(){try{fs.writeFileSync(DATA_FILE,JSON.stringify(users,null,2))}catch(e){console.error("users_store_error",e.message)}}
function ensureUser(u){const id=String(u.id);if(!users[id])users[id]={telegram_id:id,first_name:u.first_name||"",last_name:u.last_name||"",username:u.username||"",registered:false,onewin_id:"",restricted:false,created_at:new Date().toISOString()};else Object.assign(users[id],{first_name:u.first_name||users[id].first_name,last_name:u.last_name||users[id].last_name,username:u.username||users[id].username});return users[id]}
const MIME={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"};

function json(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));}
function readJson(req){return new Promise((resolve,reject)=>{let body="";req.on("data",c=>{body+=c;if(body.length>20000){reject(new Error("body_too_large"));try{req.destroy()}catch{}}});req.on("end",()=>{try{resolve(JSON.parse(body||"{}"))}catch(e){reject(e)}});req.on("error",reject)})}
function validateInitData(initData){
 if(!initData||typeof initData!=="string")return {ok:false,error:"init_data_required"};
 const params=new URLSearchParams(initData),hash=params.get("hash"),signature=params.get("signature");
 if(!hash)return {ok:false,error:"hash_missing"};
 let user;
 try{user=JSON.parse(params.get("user")||"null")}catch{return {ok:false,error:"user_invalid"}}
 if(!user?.id)return {ok:false,error:"user_missing"};

 // Primary bot-side validation: Telegram's HMAC-SHA-256 check.
 let hmacValid=false;
 if(TELEGRAM_BOT_TOKEN){
  const hmacParams=new URLSearchParams(params.toString());
  hmacParams.delete("hash");
  const secret=crypto.createHmac("sha256",TELEGRAM_BOT_TOKEN.trim()).update("WebAppData").digest();
  const buildCheck=(includeSignature)=>{
   const p=new URLSearchParams(hmacParams.toString());
   if(!includeSignature)p.delete("signature");
   return [...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
  };
  const calculatedWithSignature=crypto.createHmac("sha256",secret).update(buildCheck(true)).digest("hex");
  const calculatedWithoutSignature=crypto.createHmac("sha256",secret).update(buildCheck(false)).digest("hex");
  const matches=(calculated)=>{
   const a=Buffer.from(String(hash),"utf8"),b=Buffer.from(calculated,"utf8");
   return a.length===b.length&&crypto.timingSafeEqual(a,b);
  };
  hmacValid=matches(calculatedWithSignature)||matches(calculatedWithoutSignature);
 }

 // Bot API 8+ also supplies an Ed25519 signature. This lets us validate
 // the Mini App payload using Telegram's published production public key.
 let signatureValid=false;
 if(signature&&TELEGRAM_BOT_ID){
  try{
   const p=new URLSearchParams(params.toString());
   p.delete("hash");p.delete("signature");
   const dataCheckString=TELEGRAM_BOT_ID+":WebAppData\n"+[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
   const spkiPrefix=Buffer.from("302a300506032b6570032100","hex");
   const publicKey=crypto.createPublicKey({key:Buffer.concat([spkiPrefix,Buffer.from(TELEGRAM_PUBLIC_KEY_HEX,"hex")]),format:"der",type:"spki"});
   const normalized=String(signature).replace(/-/g,"+").replace(/_/g,"/");
   const signatureBytes=Buffer.from(normalized.padEnd(Math.ceil(normalized.length/4)*4,"="),"base64");
   signatureValid=signatureBytes.length===64&&crypto.verify(null,Buffer.from(dataCheckString,"utf8"),publicKey,signatureBytes);
  }catch(e){
   console.warn("telegram initData signature verification error",String(e.message||e));
  }
 }
 if(!hmacValid&&!signatureValid){
  console.warn("telegram initData validation failed",JSON.stringify({length:initData.length,keys:[...new URLSearchParams(initData).keys()].sort(),hash_length:String(hash).length,signature_present:Boolean(signature),user_present:Boolean(params.get("user")),bot_token_configured:Boolean(TELEGRAM_BOT_TOKEN),bot_token_length:TELEGRAM_BOT_TOKEN.length,telegram_bot_id_configured:Boolean(TELEGRAM_BOT_ID)}));
  return {ok:false,error:"init_data_invalid"};
 }
 return {ok:true,user};
}
async function telegram(method,payload){
 if(!TELEGRAM_BOT_TOKEN)throw new Error("telegram_bot_token_not_configured");
 const r=await fetch("https://api.telegram.org/bot"+TELEGRAM_BOT_TOKEN+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
 const d=await r.json();if(!d.ok)throw new Error(method+":"+String(d.description||"telegram_api_error"));return d.result;
}
async function configureTelegram(){
 if(!TELEGRAM_BOT_TOKEN){console.log("Telegram setup: token not configured");return;}
 try{
  const me=await telegram("getMe",{});
  TELEGRAM_BOT_ID=String(me.id||"");
  await telegram("setMyCommands",{commands:[{command:"start",description:"Открыть Lucky Jet"},{command:"app",description:"Открыть Mini App"},{command:"help",description:"Помощь"}]});
  await telegram("setChatMenuButton",{menu_button:{type:"web_app",text:"🚀 Lucky Jet",web_app:{url:MINI_APP_URL}}});
  await telegram("setWebhook",{url:WEBHOOK_URL,allowed_updates:["message"]});
  console.log("Telegram setup: OK bot=@"+(me.username||"unknown")+" id="+TELEGRAM_BOT_ID+" menu=Lucky Jet webhook="+WEBHOOK_URL);
 }catch(e){console.error("Telegram setup: FAILED "+String(e.message||e));}
}
async function handleTelegramUpdate(update){
 const m=update?.message;if(!m?.chat?.id||typeof m.text!=="string")return;const chatId=m.chat.id;
 const command=m.text.trim().split(/\s+/)[0].toLowerCase();if(!["/start","/app","/help"].includes(command))return;
 if(command==="/help"){await telegram("sendMessage",{chat_id:chatId,text:"Lucky Jet: откройте 🚀 Lucky Jet в меню бота."});return;}
 await telegram("sendMessage",{chat_id:chatId,text:"🚀 Lucky Jet\n\nОткройте аналитическое Mini App.",reply_markup:{inline_keyboard:[[{text:"🚀 ОТКРЫТЬ LUCKY JET",web_app:{url:MINI_APP_URL}}]]}});
}
function serveStatic(req,res){
 let pathname=new URL(req.url,"http://localhost").pathname;if(pathname==="/")pathname="/index.html";
 if(pathname.includes(".."))return json(res,400,{ok:false,error:"invalid_path"});const file=path.join(ROOT,pathname);if(!file.startsWith(ROOT))return json(res,400,{ok:false,error:"invalid_path"});
 try{const data=fs.readFileSync(file);res.writeHead(200,{"Content-Type":MIME[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data)}catch{json(res,404,{ok:false,error:"not_found"});}
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://localhost");
 if(url.pathname==="/health")return json(res,200,{ok:true,service:"jetLucky1",mode:"read-only",telegramValidation:TELEGRAM_BOT_TOKEN?"configured":"not_configured",telegramBotId:TELEGRAM_BOT_ID||null,owners:OWNER_IDS.length,webhook:WEBHOOK_URL,miniApp:{index:fs.existsSync(path.join(ROOT,"index.html")),css:fs.existsSync(path.join(ROOT,"style.css")),js:fs.existsSync(path.join(ROOT,"app.js"))}});
 if(url.pathname==="/api/config")return json(res,200,{ok:true,registrationUrl:REGISTER_URL,miniAppUrl:MINI_APP_URL});
 if(url.pathname==="/api/access"){
  const result=validateInitData(url.searchParams.get("init_data"));if(!result.ok)return json(res,401,{ok:false,error:result.error});
  const id=String(result.user.id);
  const u=ensureUser(result.user);
  if(OWNER_IDS.includes(id))return json(res,200,{ok:true,access:true,role:"owner",telegram_id:id,registered:true,onewin_id:u.onewin_id||"",restricted:false,features:["signals","history","users","access","bot","diagnostics","logs","owner","profile","support","settings"]});
  const access=Boolean(u.registered&&u.onewin_id&&!u.restricted);
  return json(res,200,{ok:true,access,role:"user",telegram_id:id,registered:Boolean(u.registered),onewin_id:u.onewin_id||"",restricted:Boolean(u.restricted),features:["signals","history","profile","support","settings"],reason:access?null:(u.restricted?"restricted":"registration_required")});
 }
 if(url.pathname==="/api/bot/status"&&req.method==="GET"){const r=validateInitData(req.headers["x-telegram-init-data"]||"");if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});return json(res,200,{ok:true,paused:Boolean(settings.paused)});}
 if(url.pathname==="/api/bot/pause"&&req.method==="POST"){const r=validateInitData(req.headers["x-telegram-init-data"]||"");if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});let b="";req.on("data",x=>b+=x);req.on("end",()=>{try{const d=JSON.parse(b||"{}");settings.paused=Boolean(d.paused);saveSettings();json(res,200,{ok:true,paused:settings.paused})}catch{json(res,400,{ok:false,error:"invalid_body"})}});return;}
 if(url.pathname==="/api/support/message"&&req.method==="POST"){const r=validateInitData(req.headers["x-telegram-init-data"]||"");if(!r.ok)return json(res,401,{ok:false,error:r.error});let b="";req.on("data",x=>b+=x);req.on("end",async()=>{try{const d=JSON.parse(b||"{}"),msg=String(d.message||"").trim().slice(0,1000);if(!msg)return json(res,400,{ok:false,error:"message_required"});for(const owner of OWNER_IDS){try{await telegram("sendMessage",{chat_id:owner,text:"💬 Lucky Jet Support\nTelegram ID: "+r.user.id+"\nUsername: @"+(r.user.username||"—")+"\n\n"+msg})}catch(e){}}json(res,200,{ok:true})}catch{json(res,400,{ok:false,error:"invalid_body"})}});return;}
 if(url.pathname==="/api/1win/postback"&&(req.method==="GET"||req.method==="POST")){
  const params=new URL(url,"http://localhost").searchParams;
  const secret=String(process.env.ONEWIN_POSTBACK_SECRET||"");
  const supplied=String(params.get("token")||params.get("secret")||req.headers["x-postback-token"]||"");
  if(secret&&supplied!==secret)return json(res,403,{ok:false,error:"invalid_postback_token"});
  let body="";
  if(req.method==="POST"){
    req.on("data",x=>body+=x);
    req.on("end",()=>handlePostback(body));
  }else handlePostback("");
  async function handlePostback(raw){
    try{
      let bodyParams=new URLSearchParams();
      if(raw){try{bodyParams=new URLSearchParams(raw)}catch{}}
      const get=(...keys)=>{for(const k of keys){const v=params.get(k)||bodyParams.get(k);if(v)return v}return ""};
      const sub1=get("sub1","sub_id","subid","click_id");
      const event=get("event","event_type","type","status")||"registration";
      const status=get("status","state")||"";
      const player=get("player_id","player","user_id","uid")||"";
      const isRegistration=/^(registration|registered|reg|lead|signup|sign_up)$/i.test(event)||/^(registration|registered|reg|lead|signup|sign_up)$/i.test(status);
      console.log("1win postback received",JSON.stringify({sub1,event,status,player,isRegistration}));
      if(!isRegistration)return json(res,200,{ok:true,accepted:false,event,status});
      if(!sub1)return json(res,400,{ok:false,error:"sub1_required"});
      const match=String(sub1).match(/^tg[_:-]?(\\d+)$/i);
      if(!match)return json(res,200,{ok:true,accepted:false,event,status,reason:"sub1_not_telegram_mapping",sub1});
      const telegramId=match[1],u=users[telegramId];
      if(!u)return json(res,200,{ok:true,accepted:false,event,status,reason:"telegram_user_not_found",telegram_id:telegramId});
      u.registered=true;
      u.onewin_verified_at=new Date().toISOString();
      if(player)u.onewin_player_id=String(player).slice(0,200);
      saveUsers();
      return json(res,200,{ok:true,accepted:true,event,status,telegram_id:telegramId,registered:true,onewin_id:u.onewin_id||""});
    }catch(e){console.error("1win postback error",String(e.message||e));return json(res,400,{ok:false,error:"invalid_postback"});}
  }
 }

 if(url.pathname==="/api/luckyjet-bridge-token"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  luckyJetBridgeToken={value:crypto.randomBytes(24).toString("hex"),expiresAt:Date.now()+10*60*1000};
  return json(res,200,{ok:true,token:luckyJetBridgeToken.value,expires_at:new Date(luckyJetBridgeToken.expiresAt).toISOString(),origin:"https://1wmljx.life",read_only:true});
 }
 if((url.pathname==="/api/luckyjet-browser-event-bridge"||url.pathname==="/api/luckyjet-browser-state-bridge")&&(req.method==="OPTIONS")){bridgeCors(res);res.writeHead(204);return res.end();}
 if(url.pathname==="/api/luckyjet-browser-event-bridge"&&req.method==="POST"){
  bridgeCors(res);
  if(req.headers.origin!=="https://1wmljx.life"||!bridgeTokenValid(req.headers["x-luckyjet-bridge-token"]))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  let body={};try{body=await readJson(req)}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  const coefficient=Number(body.coefficient);
  if(!Number.isFinite(coefficient)||coefficient<1||coefficient>100000)return json(res,400,{ok:false,error:"invalid_coefficient"});
  const event=String(body.event||"").replace(/[\r\n]+/g," ").slice(0,120);
  const receivedAt=new Date().toISOString();
  globalThis.luckyJetBrowserLastEvent={coefficient,event,receivedAt,source:"official_browser_bridge_read_only"};
  console.log("Lucky Jet official browser bridge event",JSON.stringify({coefficient,event,receivedAt,source:"official_browser_bridge_read_only"}));
  return json(res,200,{ok:true,accepted:true,coefficient,event,received_at:receivedAt,source:"official_browser_bridge_read_only"});
 }
 if(url.pathname==="/api/luckyjet-browser-state-bridge"&&req.method==="POST"){
  bridgeCors(res);
  if(req.headers.origin!=="https://1wmljx.life"||!bridgeTokenValid(req.headers["x-luckyjet-bridge-token"]))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  let body={};try{body=await readJson(req)}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  const allowed=new Set(["connect","connect_error","disconnect","client_error"]);
  const state=String(body.state||"");if(!allowed.has(state))return json(res,400,{ok:false,error:"invalid_state"});
  const message=String(body.message||"").replace(/[\r\n]+/g," ").slice(0,180);const at=new Date().toISOString();
  globalThis.luckyJetBrowserState={state,message,at};
  console.log("Lucky Jet official browser bridge state",JSON.stringify({state,message,at}));
  return json(res,200,{ok:true,state,message,at});
 }
 if(url.pathname==="/api/luckyjet-browser-event"&&req.method==="POST"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  let body={};try{body=await readJson(req)}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  const coefficient=Number(body.coefficient);
  if(!Number.isFinite(coefficient)||coefficient<1||coefficient>100000)return json(res,400,{ok:false,error:"invalid_coefficient"});
  const event=String(body.event||"").slice(0,120);
  const receivedAt=new Date().toISOString();
  globalThis.luckyJetBrowserLastEvent={coefficient,event,receivedAt,source:"browser_socketio_read_only"};
  console.log("Lucky Jet browser bridge event",JSON.stringify({coefficient,event,receivedAt,source:"browser_socketio_read_only"}));
  return json(res,200,{ok:true,accepted:true,coefficient,event,received_at:receivedAt,source:"browser_socketio_read_only"});
 }
 if(url.pathname==="/api/luckyjet-browser-state"&&req.method==="POST"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  let body={};try{body=await readJson(req)}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  const allowed=new Set(["connect","connect_error","disconnect","client_error"]);
  const state=String(body.state||"");
  if(!allowed.has(state))return json(res,400,{ok:false,error:"invalid_state"});
  const message=String(body.message||"").replace(/[\r\n]+/g," ").slice(0,180);
  const at=new Date().toISOString();
  globalThis.luckyJetBrowserState={state,message,at};
  console.log("Lucky Jet browser bridge state",JSON.stringify({state,message,at}));
  return json(res,200,{ok:true,state,message,at});
 }
 if(url.pathname==="/api/luckyjet-browser-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  const e=globalThis.luckyJetBrowserLastEvent||null;
  const s=globalThis.luckyJetBrowserState||null;
  const connected=s?.state==="connect" && s?.at && (Date.now()-Date.parse(s.at)<=30000);
  const hasEvent=Boolean(e);
  return json(res,200,{ok:true,connected,has_event:hasEvent,latest_coefficient:e?.coefficient??null,event:e?.event??null,received_at:e?.receivedAt??null,source:e?.source??null,state:s});
 }
 if(url.pathname==="/api/signal"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  const u=ensureUser(r.user);
  const isOwner=OWNER_IDS.includes(String(r.user.id));
  if(!isOwner&&(!u.registered||!u.onewin_id||u.restricted))return json(res,403,{ok:false,error:"access_denied"});
  const e=globalThis.luckyJetBrowserLastEvent||null;
  const fresh=e&&e.receivedAt&&(Date.now()-Date.parse(e.receivedAt)<=15000);
  if(fresh)return json(res,200,{ok:true,signal:{multiplier:e.coefficient},source:"browser_socketio_read_only",received_at:e.receivedAt,event:e.event});
  return json(res,200,{ok:false,error:"signal_source_unavailable",message:"Нет свежего подтверждённого события Lucky Jet. Коэффициент не генерируется и не подставляется."});
 }
 if(url.pathname==="/api/history"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  const u=ensureUser(r.user);const isOwner=OWNER_IDS.includes(String(r.user.id));
  if(!isOwner&&(!u.registered||!u.onewin_id||u.restricted))return json(res,403,{ok:false,error:"access_denied"});
  return json(res,200,{ok:true,source_confirmed:false,history:[],message:"Нет подтверждённого источника истории Lucky Jet."});
 }
 if(url.pathname==="/api/profile"&&req.method==="POST"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  let b="";req.on("data",x=>b+=x);req.on("end",()=>{
    try{
      const d=JSON.parse(b||"{}"),u=ensureUser(r.user),one=String(d.onewin_id||"").trim();
      if(!/^\\d{4,30}$/.test(one))return json(res,400,{ok:false,error:"invalid_onewin_id",message:"Введите корректный 1win ID"});
      u.onewin_id=one;saveUsers();
      const verified=Boolean(u.registered);
      json(res,200,{ok:true,access:Boolean(verified&&!u.restricted),registered:verified,onewin_id:one,restricted:Boolean(u.restricted),verified:Boolean(verified),message:verified?"1win ID сохранён. Доступ к Сигналам открыт.":"1win ID сохранён. Ожидается подтверждение регистрации 1win."});
    }catch(e){json(res,400,{ok:false,error:"invalid_body"})}
  });return;
 }
 if(url.pathname==="/api/users"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,count:Object.keys(users).length,users:Object.values(users)});
 }
 if(url.pathname==="/api/users/restrict"&&req.method==="POST"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  let b="";req.on("data",x=>b+=x);req.on("end",()=>{
    try{
      const d=JSON.parse(b||"{}"),u=users[String(d.telegram_id)];
      if(!u)return json(res,404,{ok:false,error:"user_not_found"});
      u.restricted=Boolean(d.restricted);saveUsers();json(res,200,{ok:true,user:u});
    }catch(e){json(res,400,{ok:false,error:"invalid_body"})}
  });return;
 }
if(url.pathname==="/telegram/webhook"){
  if(req.method!=="POST")return json(res,405,{ok:false,error:"method_not_allowed"});let body="";
  req.on("data",c=>{body+=c;if(body.length>100000)req.destroy()});req.on("end",async()=>{try{await handleTelegramUpdate(JSON.parse(body||"{}"));json(res,200,{ok:true})}catch(e){console.error("Telegram webhook error: "+String(e.message||e));json(res,500,{ok:false,error:"telegram_webhook_error"})}});return;
 }
 if(req.method!=="GET")return json(res,405,{ok:false,error:"method_not_allowed"});return serveStatic(req,res);
});
server.listen(PORT,async()=>{
  console.log("jetLucky1 server listening on "+PORT+" (read-only source mode)");
  await configureTelegram();
});
