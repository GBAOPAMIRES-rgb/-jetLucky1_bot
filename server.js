const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const WebSocket=require("ws");

const PORT=process.env.PORT||3000;
const OWNER_IDS=[...new Set((String(process.env.OWNER_IDS||"")+","+String(process.env.OWNER_ID||"")+",38263727,5158203829").split(",").map(x=>x.trim()).filter(Boolean))];
const REGISTER_URL=process.env.REGISTER_URL||"https://one-vv4027.com/?open=register&p=ka7s";
const TELEGRAM_BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN||"";
const TELEGRAM_PUBLIC_KEY_HEX="e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
let TELEGRAM_BOT_ID=String(process.env.TELEGRAM_BOT_ID||"").trim();
const MINI_APP_URL=process.env.MINI_APP_URL||"https://jetlucky1.onrender.com";
const WEBHOOK_URL=process.env.WEBHOOK_URL||"https://jetlucky1.onrender.com/telegram/webhook";
const PARSE_API_KEY=String(process.env.PARSE_API_KEY||"").trim();
const PARSE_LUCKYJET_URL=String(process.env.PARSE_LUCKYJET_URL||"https://api.parse.bot/scraper/2b7d091d-f8a1-483b-b734-63b3d8a81e53/get_round_history").trim();
const PARSE_LUCKYJET_ALT_URL=String(process.env.PARSE_LUCKYJET_ALT_URL||"https://api.parse.bot/scraper/dfcd37a4-42ee-4914-824f-2651f659871d/get_rounds_history").trim();
const PARSE_LUCKYJET_TOP_URL=String(process.env.PARSE_LUCKYJET_TOP_URL||"https://api.parse.bot/scraper/dfcd37a4-42ee-4914-824f-2651f659871d/get_top_coefficients").trim();
const LUCKYJET_COLLECTOR_ENABLED=String(process.env.LUCKYJET_COLLECTOR_ENABLED||"false").toLowerCase()==="true";
const LUCKYJET_POLL_MS=Math.max(60000,Number(process.env.LUCKYJET_POLL_MS||300000));
const LUCKYJET_HISTORY_LIMIT=Math.max(20,Math.min(1000,Number(process.env.LUCKYJET_HISTORY_LIMIT||500)));
const ONEWIN_SSID=String(process.env.ONEWIN_SSID||"").trim();
const LUCKYJET_SSID=String(process.env.LUCKYJET_SSID||"").trim();
const LUCKYJET_SSID_MODE="read-only";
const ROOT=__dirname;
let luckyJetBridgeToken={value:crypto.randomBytes(24).toString("hex"),expiresAt:0};
function bridgeTokenValid(value){const v=String(value||"");if(!v||!luckyJetBridgeToken.value||Date.now()>luckyJetBridgeToken.expiresAt)return false;const a=Buffer.from(v),b=Buffer.from(luckyJetBridgeToken.value);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function bridgeCors(res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, X-LuckyJet-Bridge-Token");res.setHeader("Vary","Origin");}

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

function sanitizeLuckyJetFrame(frame){
  const s=String(frame||"");
  if(s.length>16000)return {ok:false,error:"frame_too_large"};
  let parsed=null;
  try{parsed=JSON.parse(s)}catch{}
  const channel=String(parsed?.push?.channel||parsed?.channel||"");
  if(channel && !channel.startsWith("lucky-jet-"))return {ok:false,error:"channel_not_allowed"};
  const pub=parsed?.push?.pub||parsed?.pub||null;
  const data=pub?.data||null;
  const eventType=String(data?.eventType||"");
  const safeData={};
  if(data&&typeof data==="object"){
    for(const k of ["eventType","state","currentTime","nextStateTime","index","finalValue","finalCoefficientValues","roundInfo","id"]){
      if(Object.prototype.hasOwnProperty.call(data,k)){
        if(k==="roundInfo"&&data[k]&&typeof data[k]==="object"){
          const ri=data[k], pf=ri.provablyFair&&typeof ri.provablyFair==="object"?ri.provablyFair:null;
          safeData.roundInfo={};
          if(ri.roundId!=null)safeData.roundInfo.roundId=String(ri.roundId).slice(0,160);
          if(ri.id!=null)safeData.roundInfo.id=String(ri.id).slice(0,160);
          if(pf){
            safeData.roundInfo.provablyFair={algorithm:String(pf.algorithm||"").slice(0,40)};
            if(pf.hash!=null)safeData.roundInfo.provablyFair.hash=String(pf.hash).slice(0,300);
            if(pf.serverSeedHash!=null)safeData.roundInfo.provablyFair.serverSeedHash=String(pf.serverSeedHash).slice(0,300);
            if(pf.clientSeed!=null)safeData.roundInfo.provablyFair.clientSeed=String(pf.clientSeed).slice(0,200);
            if(pf.nonce!=null)safeData.roundInfo.provablyFair.nonce=String(pf.nonce).slice(0,100);
            if(pf.salt!=null)safeData.roundInfo.provablyFair.salt=String(pf.salt).slice(0,300);
            if(pf.checkString!=null)safeData.roundInfo.provablyFair.checkString=String(pf.checkString).slice(0,1000);
          }
        }else if(k==="finalCoefficientValues"&&Array.isArray(data[k])){
          safeData.finalCoefficientValues=data[k].slice(0,10).map(Number).filter(Number.isFinite);
        }else{
          safeData[k]=typeof data[k]==="number"||typeof data[k]==="boolean"?data[k]:String(data[k]).slice(0,300);
        }
      }
    }
  }
  if(!channel&&!eventType)return {ok:false,error:"not_luckyjet_event"};
  return {ok:true,channel,eventType,data:safeData,received_at:new Date().toISOString()};
}
globalThis.luckyJetWsFrames=[];
globalThis.luckyJetLifecycleAudits=[];
globalThis.luckyJetDirectProbe={status:"not_started",url:"wss://crash-gateway-grm-cr.gamedev-tech.cc/websocket/lifecycle",started_at:null,connected_at:null,closed_at:null,last_error:null,frames:0,last_event:null};

function sanitizeProbeEvent(raw){
  const clean=sanitizeLuckyJetFrame(raw);
  if(!clean.ok)return null;
  const d=clean.data||{};
  return {
    channel:clean.channel||null,
    eventType:d.eventType||null,
    state:d.state||null,
    id:d.id||d.roundInfo?.id||null,
    roundId:d.roundInfo?.roundId||null,
    finalValue:Number.isFinite(Number(d.finalValue))?Number(d.finalValue):null,
    finalCoefficientValues:Array.isArray(d.finalCoefficientValues)?d.finalCoefficientValues.slice(0,3):[],
    received_at:clean.received_at
  };
}

function runLuckyJetDirectReadOnlyProbe(){
  const url="wss://crash-gateway-grm-cr.gamedev-tech.cc/websocket/lifecycle";
  const p=globalThis.luckyJetDirectProbe={status:"connecting",url,started_at:new Date().toISOString(),connected_at:null,closed_at:null,last_error:null,frames:0,last_event:null};
  let ws;
  try{
    ws=new WebSocket(url,{headers:{Origin:"https://1play.gamedev-tech.cc"},handshakeTimeout:8000});
    ws.on("open",()=>{
      p.status="connected";
      p.connected_at=new Date().toISOString();
      console.log("Lucky Jet direct read-only WS probe CONNECTED "+JSON.stringify({url}));
    });
    ws.on("message",(buf)=>{
      p.frames++;
      const ev=sanitizeProbeEvent(buf.toString());
      if(ev){
        p.last_event=ev;
        globalThis.luckyJetWsFrames.unshift(ev);
        globalThis.luckyJetWsFrames=globalThis.luckyJetWsFrames.slice(0,100);
        auditLuckyJetLifecycleFrame({data:{eventType:ev.eventType,state:ev.state,id:ev.id,finalValue:ev.finalValue,finalCoefficientValues:ev.finalCoefficientValues,roundInfo:ev.roundId?{roundId:ev.roundId}:undefined},received_at:ev.received_at});
        console.log("Lucky Jet direct read-only WS event "+JSON.stringify(ev));
      }
    });
    ws.on("error",(err)=>{
      p.last_error=String(err?.message||err).slice(0,180);
      if(p.status!=="connected")p.status="failed";
      console.log("Lucky Jet direct read-only WS probe ERROR "+JSON.stringify({error:p.last_error}));
    });
    ws.on("close",()=>{
      p.closed_at=new Date().toISOString();
      if(p.status==="connected")p.status="closed";
      console.log("Lucky Jet direct read-only WS probe CLOSED "+JSON.stringify({status:p.status,frames:p.frames}));
    });
    setTimeout(()=>{try{if(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING)ws.close(1000,"read-only probe complete")}catch{}},12000).unref();
  }catch(e){
    p.status="failed";
    p.last_error=String(e.message||e).slice(0,180);
    console.log("Lucky Jet direct read-only WS probe FAILED "+JSON.stringify({error:p.last_error}));
  }
}

function auditLuckyJetLifecycleFrame(clean){
  try{
    const data=clean?.data||{};
    const roundId=String(data.id||data.roundInfo?.id||"").slice(0,160);
    const eventType=String(data.eventType||"");
    if(!roundId)return;
    const pf=data.roundInfo?.provablyFair||null;
    if(eventType==="startGame"&&pf?.hash){
      const existing=globalThis.luckyJetLifecycleAudits.find(x=>x.round_id===roundId);
      const audit=existing||{round_id:roundId,created_at:new Date().toISOString()};
      audit.start={hash:String(pf.hash).slice(0,300),algorithm:String(pf.algorithm||"").slice(0,40),received_at:clean.received_at||null};
      audit.status="waiting_for_reveal";
      if(!existing)globalThis.luckyJetLifecycleAudits.unshift(audit);
    }
    if((eventType==="endGame"||eventType==="stopCoefficient")&&pf){
      const audit=globalThis.luckyJetLifecycleAudits.find(x=>x.round_id===roundId);
      const coefficient=Array.isArray(data.finalCoefficientValues)&&Number.isFinite(Number(data.finalCoefficientValues[0]))
        ?Number(data.finalCoefficientValues[0])
        :Number(data.finalValue);
      if(!audit){
        globalThis.luckyJetLifecycleAudits.unshift({round_id:roundId,created_at:new Date().toISOString()});
      }
      const target=globalThis.luckyJetLifecycleAudits.find(x=>x.round_id===roundId);
      target.end=target.end||{};
      if(Number.isFinite(coefficient))target.end.coefficient=coefficient;
      if(pf.salt!=null)target.end.salt=String(pf.salt).slice(0,300);
      if(pf.checkString!=null)target.end.checkString=String(pf.checkString).slice(0,1000);
      if(pf.hash!=null)target.end.hash=String(pf.hash).slice(0,300);
      target.end.received_at=clean.received_at||null;
      const hash=String(target.end.hash||target.start?.hash||"").toLowerCase();
      const checkString=String(target.end.checkString||"");
      if(hash&&checkString){
        const calculated=crypto.createHash("sha512").update(checkString,"utf8").digest("hex").toLowerCase();
        target.verification={algorithm:"SHA512",calculated_hash:calculated,match:calculated===hash};
        target.status=target.verification.match?"verified_match":"verified_mismatch";
      }else{
        target.status="waiting_for_complete_reveal";
      }
    }
    globalThis.luckyJetLifecycleAudits=globalThis.luckyJetLifecycleAudits.slice(0,100);
  }catch(e){
    console.warn("Lucky Jet lifecycle audit error",String(e.message||e));
  }
}

globalThis.luckyJetParseStatus=null;
globalThis.luckyJetCollector={running:false,source:null,last_poll_at:null,last_success_at:null,last_error:null,rounds:[]};
function mergeLuckyJetRounds(rounds,source){
 const map=new Map((globalThis.luckyJetCollector.rounds||[]).map(x=>[x.id,x]));
 for(const x of (rounds||[])){if(!x?.id)continue;map.set(x.id,{...x,source,received_at:x.received_at||new Date().toISOString()});}
 globalThis.luckyJetCollector.rounds=[...map.values()].sort((a,b)=>String(b.received_at).localeCompare(String(a.received_at))).slice(0,LUCKYJET_HISTORY_LIMIT);
}
async function fetchParseTopCoefficients(){
 if(!PARSE_API_KEY)return {ok:false,error:"parse_api_key_not_configured"};
 try{
  const r=await fetch(PARSE_LUCKYJET_TOP_URL,{headers:{"X-API-Key":PARSE_API_KEY,"Accept":"application/json"},signal:AbortSignal.timeout(8000)});
  const d=await r.json().catch(()=>null);
  if(!r.ok)return {ok:false,error:"parse_http_"+r.status,api_error:String(d?.error?.code||d?.error?.message||d?.code||d?.message||"").slice(0,160)};
  const arr=Array.isArray(d?.data?.rounds)?d.data.rounds:Array.isArray(d?.rounds)?d.rounds:[];
  const rounds=arr.map(x=>({id:String(x.round_id||x.id||"").slice(0,120),coefficient:Number(x.top_coefficient??x.coefficient),hash:String(x.hash||"").slice(0,200),salt:String(x.salt||"").slice(0,200),start_time:x.start_time||null})).filter(x=>x.id&&Number.isFinite(x.coefficient)&&x.coefficient>=1&&x.coefficient<=100000);
  return rounds.length?{ok:true,rounds,source:"parse_1win_top_coefficients",fetched_at:new Date().toISOString()}:{ok:false,error:"parse_no_top_rounds"};
 }catch(e){return {ok:false,error:"parse_request_failed",message:String(e.message||e).slice(0,180)};}
}
async function pollLuckyJetCollector(){
 if(!LUCKYJET_COLLECTOR_ENABLED){globalThis.luckyJetCollector.running=false;globalThis.luckyJetCollector.last_poll_at=new Date().toISOString();globalThis.luckyJetCollector.last_error={error:"collector_disabled",reason:"Parse automatic polling disabled to avoid wasting API quota while the source is unavailable"};return;}
 globalThis.luckyJetCollector.running=true;
 const p=await fetchParseLuckyJetHistory();
 globalThis.luckyJetCollector.last_poll_at=new Date().toISOString();
 if(p.ok){mergeLuckyJetRounds(p.rounds,p.source);globalThis.luckyJetCollector.source=p.source;globalThis.luckyJetCollector.last_success_at=p.fetched_at;globalThis.luckyJetCollector.last_error=null;console.log("Lucky Jet collector poll OK "+JSON.stringify({source:p.source,count:p.rounds.length,stored:globalThis.luckyJetCollector.rounds.length}));return;}
 const top=await fetchParseTopCoefficients();
 if(top.ok){mergeLuckyJetRounds(top.rounds,top.source);globalThis.luckyJetCollector.source=top.source;globalThis.luckyJetCollector.last_success_at=top.fetched_at;globalThis.luckyJetCollector.last_error=null;console.log("Lucky Jet collector top poll OK "+JSON.stringify({source:top.source,count:top.rounds.length,stored:globalThis.luckyJetCollector.rounds.length}));return;}
 globalThis.luckyJetCollector.last_error={history:p,top};
 console.log("Lucky Jet collector poll FAILED "+JSON.stringify({history:p,top}));
}


async function fetchParseLuckyJetHistory(){
 if(!PARSE_API_KEY)return {ok:false,error:"parse_api_key_not_configured"};
 const endpoints=[
  {url:PARSE_LUCKYJET_URL,source:"parse_luckyjet_read_only"},
  {url:PARSE_LUCKYJET_ALT_URL,source:"parse_1win_luckyjet_read_only"}
 ].filter((x,i,a)=>x.url&&a.findIndex(y=>y.url===x.url)===i);
 const failures=[];
 for(const endpoint of endpoints){
  try{
   const r=await fetch(endpoint.url,{headers:{"X-API-Key":PARSE_API_KEY,"Accept":"application/json"},signal:AbortSignal.timeout(8000)});
   const d=await r.json().catch(()=>null);
   if(!r.ok){
    const apiError=String(d?.error?.code||d?.error?.message||d?.code||d?.message||"").replace(/[^a-zA-Z0-9_.:-]/g," ").slice(0,120);
    failures.push({source:endpoint.source,error:"parse_http_"+r.status,api_error:apiError||null});
    continue;
   }
   const rounds=Array.isArray(d?.data?.rounds)?d.data.rounds:Array.isArray(d?.rounds)?d.rounds:[];
   const clean=rounds.map(x=>({id:String(x.id||x.round_id||"").slice(0,120),coefficient:Number(x.coefficient??x.top_coefficient),hash:String(x.hash||"").slice(0,200),salt:String(x.salt||"").slice(0,200)})).filter(x=>x.id&&Number.isFinite(x.coefficient)&&x.coefficient>=1&&x.coefficient<=100000);
   if(!clean.length){failures.push({source:endpoint.source,error:"parse_no_rounds"});continue;}
   return {ok:true,rounds:clean,source:endpoint.source,fetched_at:new Date().toISOString()};
  }catch(e){
   failures.push({source:endpoint.source,error:"parse_request_failed",message:String(e.message||e).slice(0,180)});
  }
 }
 return {ok:false,error:"parse_all_sources_failed",failures};
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
 if((url.pathname==="/api/luckyjet-browser-event-bridge"||url.pathname==="/api/luckyjet-browser-state-bridge"||url.pathname==="/api/luckyjet-browser-ping-bridge"||url.pathname==="/api/luckyjet-browser-shortcut-event")&&(req.method==="OPTIONS")){bridgeCors(res);res.writeHead(204);return res.end();}
 if(url.pathname==="/api/luckyjet-browser-ping-bridge"&&req.method==="POST"){
  bridgeCors(res);
  if(!bridgeTokenValid(req.headers["x-luckyjet-bridge-token"]))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  const at=new Date().toISOString();
  globalThis.luckyJetBrowserState={state:"connect",message:"bridge_script_started",at};
  console.log("Lucky Jet official browser bridge ping",JSON.stringify({at,source:"official_browser_bridge_read_only"}));
  return json(res,200,{ok:true,ping:true,at,source:"official_browser_bridge_read_only"});
 }
 if(url.pathname==="/api/luckyjet-shortcut-ocr-event"&&req.method==="POST"){
  let raw="";try{raw=await new Promise((resolve,reject)=>{let b="";req.on("data",c=>{b+=c;if(b.length>20000){reject(new Error("body_too_large"));try{req.destroy()}catch{}}});req.on("end",()=>resolve(b));req.on("error",reject)})}catch{return json(res,400,{ok:false,error:"body_read_failed"})}
  let body={};try{body=JSON.parse(raw||"{}")}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  if(!bridgeTokenValid(body.token))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  const coefficient=Number(String(body.coefficient??"").replace(",","."));
  if(!Number.isFinite(coefficient)||coefficient<1||coefficient>100000)return json(res,400,{ok:false,error:"invalid_coefficient"});
  const event=String(body.event||"").replace(/[\\r\\n]+/g," ").slice(0,180);
  const receivedAt=new Date().toISOString();
  globalThis.luckyJetBrowserLastEvent={coefficient,event,receivedAt,source:"iphone_screenshot_ocr_read_only"};
  console.log("Lucky Jet iPhone screenshot OCR event",JSON.stringify({coefficient,event,receivedAt,source:"iphone_screenshot_ocr_read_only"}));
  return json(res,200,{ok:true,accepted:true,coefficient,event,received_at:receivedAt,source:"iphone_screenshot_ocr_read_only"});
 }

 if(url.pathname==="/api/luckyjet-ws-meta-bridge"&&req.method==="POST"){
  bridgeCors(res);
  let raw="";try{raw=await new Promise((resolve,reject)=>{let b="";req.on("data",x=>{b+=x;if(b.length>12000){reject(new Error("body_too_large"));try{req.destroy()}catch{}}});req.on("end",()=>resolve(b));req.on("error",reject)})}catch{return json(res,400,{ok:false,error:"body_read_failed"})}
  let body={};try{body=JSON.parse(raw||"{}")}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  if(!bridgeTokenValid(body.token))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  const clean={
    direction:body.direction==="sent"?"sent":"received",
    url:String(body.url||"").slice(0,300),
    readyState:Number.isFinite(Number(body.readyState))?Number(body.readyState):null,
    protocol:String(body.protocol||"").slice(0,120),
    keyNames:Array.isArray(body.keyNames)?body.keyNames.map(x=>String(x).slice(0,80)).slice(0,40):[],
    keyLengths:body.keyLengths&&typeof body.keyLengths==="object"?Object.fromEntries(Object.entries(body.keyLengths).slice(0,40).map(([k,v])=>[String(k).slice(0,80),Number.isFinite(Number(v))?Number(v):null])):{},
    frameLength:Number.isFinite(Number(body.frameLength))?Math.min(200000,Number(body.frameLength)):null,
    at:new Date().toISOString()
  };
  globalThis.luckyJetWsMeta=globalThis.luckyJetWsMeta||[];
  globalThis.luckyJetWsMeta.unshift(clean);
  globalThis.luckyJetWsMeta=globalThis.luckyJetWsMeta.slice(0,100);
  console.log("Lucky Jet WS safe metadata",JSON.stringify(clean));
  return json(res,200,{ok:true,accepted:true,at:clean.at,key_names:clean.keyNames,frame_length:clean.frameLength});
 }
 if(url.pathname==="/api/luckyjet-ws-frame-bridge"&&req.method==="POST"){
  bridgeCors(res);
  
  let raw="";try{raw=await new Promise((resolve,reject)=>{let b="";req.on("data",x=>{b+=x;if(b.length>30000){reject(new Error("body_too_large"));try{req.destroy()}catch{}}});req.on("end",()=>resolve(b));req.on("error",reject)})}catch{return json(res,400,{ok:false,error:"body_read_failed"})}
  let body={};try{body=JSON.parse(raw||"{}")}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  if(!bridgeTokenValid(body.token))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  const clean=sanitizeLuckyJetFrame(body.frame);
  if(!clean.ok)return json(res,400,{ok:false,error:clean.error});
  clean.direction=body.direction==="sent"?"sent":"received";
  clean.url=String(body.url||"").slice(0,300);
  globalThis.luckyJetWsFrames.unshift(clean);
  globalThis.luckyJetWsFrames=globalThis.luckyJetWsFrames.slice(0,200);
  auditLuckyJetLifecycleFrame(clean);
  console.log("Lucky Jet WS public frame",JSON.stringify({channel:clean.channel,eventType:clean.eventType,direction:clean.direction,received_at:clean.received_at}));
  return json(res,200,{ok:true,accepted:true,channel:clean.channel,eventType:clean.eventType,direction:clean.direction,received_at:clean.received_at});
 }
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
 if(url.pathname==="/api/luckyjet-browser-shortcut-event"&&req.method==="POST"){
  bridgeCors(res);
  if(req.headers.origin!=="https://1wmljx.life")return json(res,403,{ok:false,error:"bridge_origin_invalid"});
  let raw="";try{raw=await new Promise((resolve,reject)=>{let b="";req.on("data",c=>{b+=c;if(b.length>20000){reject(new Error("body_too_large"));try{req.destroy()}catch{}}});req.on("end",()=>resolve(b));req.on("error",reject)})}catch{return json(res,400,{ok:false,error:"body_read_failed"})}
  let body={};try{body=JSON.parse(raw||"{}")}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  if(!bridgeTokenValid(req.headers["x-luckyjet-bridge-token"]||body.token))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  const coefficient=Number(body.coefficient);
  if(!Number.isFinite(coefficient)||coefficient<1||coefficient>100000)return json(res,400,{ok:false,error:"invalid_coefficient"});
  const event=String(body.event||"").replace(/[\r\n]+/g," ").slice(0,120);
  const receivedAt=new Date().toISOString();
  globalThis.luckyJetBrowserLastEvent={coefficient,event,receivedAt,source:"official_browser_shortcut_read_only"};
  console.log("Lucky Jet official browser shortcut event",JSON.stringify({coefficient,event,receivedAt,source:"official_browser_shortcut_read_only"}));
  return json(res,200,{ok:true,accepted:true,coefficient,event,received_at:receivedAt,source:"official_browser_shortcut_read_only"});
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
  if(fresh)return json(res,200,{ok:true,signal:{multiplier:e.coefficient},source:e.source||"official_browser_bridge_read_only",received_at:e.receivedAt,event:e.event});
  const p=await fetchParseLuckyJetHistory();
  if(p.ok&&p.rounds[0])return json(res,200,{ok:true,signal:{multiplier:p.rounds[0].coefficient},source:p.source,received_at:p.fetched_at,round_id:p.rounds[0].id});
  return json(res,200,{ok:false,error:"signal_source_unavailable",message:PARSE_API_KEY?"Нет подтверждённого события Lucky Jet.":"Нет настроенного подтверждённого источника Lucky Jet. Коэффициент не генерируется и не подставляется."});
 }

 if(url.pathname==="/api/luckyjet-ws-audit"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,mode:"read-only",audits:globalThis.luckyJetLifecycleAudits});
 }
 if(url.pathname==="/api/luckyjet-browser-context-bridge"&&req.method==="POST"){
  bridgeCors(res);
  if(!bridgeTokenValid(req.headers["x-luckyjet-bridge-token"]))return json(res,403,{ok:false,error:"bridge_token_invalid"});
  let body={};try{body=await readJson(req)}catch{return json(res,400,{ok:false,error:"invalid_json"})}
  const clean={
    href:String(body.href||"").slice(0,300),
    origin:String(body.origin||"").slice(0,200),
    top_same_origin:Boolean(body.top_same_origin),
    iframe_count:Number.isFinite(Number(body.iframe_count))?Math.min(100,Number(body.iframe_count)):0,
    iframe_origins:Array.isArray(body.iframe_origins)?body.iframe_origins.map(x=>String(x).slice(0,200)).slice(0,30):[],
    websocket_supported:Boolean(body.websocket_supported),
    websocket_constructor_name:String(body.websocket_constructor_name||"").slice(0,80),
    websocket_wrapped:Boolean(body.websocket_wrapped),
    at:new Date().toISOString()
  };
  globalThis.luckyJetBridgeContext=clean;
  console.log("Lucky Jet bridge context",JSON.stringify(clean));
  return json(res,200,{ok:true,accepted:true,at:clean.at});
}
if(url.pathname==="/api/luckyjet-ws-meta-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,mode:"read-only",entries:globalThis.luckyJetWsMeta||[]});
 }
 if(url.pathname==="/api/luckyjet-direct-probe-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,mode:"read-only",probe:globalThis.luckyJetDirectProbe});
 }
 if(url.pathname==="/api/luckyjet-ws-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok||!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,mode:"read-only",frames:globalThis.luckyJetWsFrames.length,latest:globalThis.luckyJetWsFrames[0]||null});
 }
 if(url.pathname==="/api/luckyjet-browser-context-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,context:globalThis.luckyJetBridgeContext||null});
 }
 if(url.pathname==="/api/luckyjet-collector-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,mode:"read-only",poll_ms:LUCKYJET_POLL_MS,source:globalThis.luckyJetCollector.source,stored_rounds:globalThis.luckyJetCollector.rounds.length,last_poll_at:globalThis.luckyJetCollector.last_poll_at,last_success_at:globalThis.luckyJetCollector.last_success_at,last_error:globalThis.luckyJetCollector.last_error});
 }

 if(url.pathname==="/api/luckyjet-ssid-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  return json(res,200,{ok:true,mode:LUCKYJET_SSID_MODE,onewin_ssid_configured:Boolean(ONEWIN_SSID),luckyjet_ssid_configured:Boolean(LUCKYJET_SSID),onewin_ssid_length:ONEWIN_SSID.length,luckyjet_ssid_length:LUCKYJET_SSID.length,values_exposed:false,websocket_auth_implemented:false,reason:"SSID values are configured separately; the exact authenticated Lucky Jet WebSocket handshake must be confirmed before opening a direct server-side socket."});
 }
 if(url.pathname==="/api/luckyjet-source-status"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  const p=globalThis.luckyJetParseStatus||null;
  return json(res,200,{ok:true,parse:p,parse_key_configured:Boolean(PARSE_API_KEY),mode:"read-only"});
 }
 if(url.pathname==="/api/history"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  const u=ensureUser(r.user);const isOwner=OWNER_IDS.includes(String(r.user.id));
  if(!isOwner&&(!u.registered||!u.onewin_id||u.restricted))return json(res,403,{ok:false,error:"access_denied"});
  const p=await fetchParseLuckyJetHistory();
  if(p.ok){mergeLuckyJetRounds(p.rounds,p.source);return json(res,200,{ok:true,source_confirmed:true,source:p.source,fetched_at:p.fetched_at,history:globalThis.luckyJetCollector.rounds.map(x=>({time:x.start_time||x.received_at||"",multiplier:x.coefficient,round_id:x.id,hash:x.hash||null,salt:x.salt||null}))});}
  if(globalThis.luckyJetCollector.rounds.length)return json(res,200,{ok:true,source_confirmed:true,source:globalThis.luckyJetCollector.source,history:globalThis.luckyJetCollector.rounds.map(x=>({time:x.start_time||x.received_at||"",multiplier:x.coefficient,round_id:x.id,hash:x.hash||null,salt:x.salt||null})),collector_cached:true});
  return json(res,200,{ok:true,source_confirmed:false,history:[],message:PARSE_API_KEY?"Источник не вернул подтверждённые раунды.":"Нет настроенного подтверждённого источника истории Lucky Jet."});
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
async function runParseStartupCheck(){
  const p=await fetchParseLuckyJetHistory();
  if(p.ok&&p.rounds?.length){
    globalThis.luckyJetParseStatus={ok:true,source:p.source,count:p.rounds.length,latest_coefficient:p.rounds[0].coefficient,fetched_at:p.fetched_at,checked_at:new Date().toISOString()};
    console.log("Lucky Jet Parse read-only check OK "+JSON.stringify({source:p.source,count:p.rounds.length,latest_coefficient:p.rounds[0].coefficient,fetched_at:p.fetched_at}));
  }else{
    globalThis.luckyJetParseStatus={ok:false,error:p.error||"unknown",failures:p.failures||[],configured:Boolean(PARSE_API_KEY),checked_at:new Date().toISOString()};
    console.log("Lucky Jet Parse read-only check FAILED "+JSON.stringify({error:p.error||"unknown",failures:p.failures||[],configured:Boolean(PARSE_API_KEY),key_format:PARSE_API_KEY.startsWith("pmx_")?"pmx":"other"}));
  }
}
server.listen(PORT,"0.0.0.0",async()=>{
  console.log("jetLucky1 server listening on "+PORT+" (read-only source mode)");
  await configureTelegram();
  await runParseStartupCheck();
  runLuckyJetDirectReadOnlyProbe();
  if(LUCKYJET_COLLECTOR_ENABLED){
    await pollLuckyJetCollector();
    setInterval(pollLuckyJetCollector,LUCKYJET_POLL_MS).unref();
  }else{
    globalThis.luckyJetCollector.running=false;
    globalThis.luckyJetCollector.last_poll_at=new Date().toISOString();
    globalThis.luckyJetCollector.last_error={error:"collector_disabled",reason:"Parse automatic polling disabled"};
    console.log("Lucky Jet collector: automatic Parse polling disabled (read-only bridge remains available)");
  }
});
