const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const PORT=process.env.PORT||3000;
const OWNER_IDS=[...new Set((String(process.env.OWNER_IDS||"")+","+String(process.env.OWNER_ID||"")+",38263727,5158203829").split(",").map(x=>x.trim()).filter(Boolean))];
const REGISTER_URL=process.env.REGISTER_URL||"https://one-vv4027.com/?open=register&p=ka7s";
const TELEGRAM_BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN||"";
const MINI_APP_URL=process.env.MINI_APP_URL||"https://jetlucky1.onrender.com";
const PARSE_API_KEY=process.env.PARSE_API_KEY||"";
const PARSE_LUCKYJET_URL="https://api.parse.bot/scraper/dfcd37a4-42ee-4914-824f-2651f659871d/get_rounds_history";
const WEBHOOK_URL=process.env.WEBHOOK_URL||"https://jetlucky1.onrender.com/telegram/webhook";
const ROOT=__dirname;
const DATA_FILE=path.join(ROOT,".luckyjet-users.json");const SETTINGS_FILE=path.join(ROOT,".luckyjet-settings.json");const settings=(()=>{try{return JSON.parse(fs.readFileSync(SETTINGS_FILE,"utf8"))||{paused:false}}catch{return {paused:false}}})();function saveSettings(){try{fs.writeFileSync(SETTINGS_FILE,JSON.stringify(settings,null,2))}catch(e){console.error("settings_store_error",e.message)}}
const users=(()=>{try{return JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))||{}}catch{return {}}})();
function saveUsers(){try{fs.writeFileSync(DATA_FILE,JSON.stringify(users,null,2))}catch(e){console.error("users_store_error",e.message)}}
function ensureUser(u){const id=String(u.id);if(!users[id])users[id]={telegram_id:id,first_name:u.first_name||"",last_name:u.last_name||"",username:u.username||"",registered:false,onewin_id:"",restricted:false,created_at:new Date().toISOString()};else Object.assign(users[id],{first_name:u.first_name||users[id].first_name,last_name:u.last_name||users[id].last_name,username:u.username||users[id].username});return users[id]}
const MIME={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"};

function json(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));}
function validateInitData(initData){
 if(!TELEGRAM_BOT_TOKEN)return {ok:false,error:"telegram_bot_token_not_configured"};
 if(!initData||typeof initData!=="string")return {ok:false,error:"init_data_required"};
 const params=new URLSearchParams(initData),hash=params.get("hash"); if(!hash)return {ok:false,error:"hash_missing"};
 params.delete("hash");
 const dataCheckString=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
 const secret=crypto.createHmac("sha256",TELEGRAM_BOT_TOKEN).update("WebAppData").digest();
 const calculated=crypto.createHmac("sha256",secret).update(dataCheckString).digest("hex");
 if(hash.length!==calculated.length||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(calculated)))return {ok:false,error:"init_data_invalid"};
 let user;try{user=JSON.parse(params.get("user")||"null");}catch{return {ok:false,error:"user_invalid"}}
 if(!user?.id)return {ok:false,error:"user_missing"};return {ok:true,user};
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
  await telegram("setMyCommands",{commands:[{command:"start",description:"Открыть Lucky Jet"},{command:"app",description:"Открыть Mini App"},{command:"help",description:"Помощь"}]});
  await telegram("setChatMenuButton",{menu_button:{type:"web_app",text:"🚀 Lucky Jet",web_app:{url:MINI_APP_URL}}});
  await telegram("setWebhook",{url:WEBHOOK_URL,allowed_updates:["message"]});
  console.log("Telegram setup: OK bot=@"+(me.username||"unknown")+" menu=Lucky Jet webhook="+WEBHOOK_URL);
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
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://localhost");
 if(url.pathname==="/health")return json(res,200,{ok:true,service:"jetLucky1",mode:"read-only",telegramValidation:TELEGRAM_BOT_TOKEN?"configured":"not_configured",owners:OWNER_IDS.length,webhook:WEBHOOK_URL,miniApp:{index:fs.existsSync(path.join(ROOT,"index.html")),css:fs.existsSync(path.join(ROOT,"style.css")),js:fs.existsSync(path.join(ROOT,"app.js"))}});
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
  function handlePostback(raw){
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

 if(url.pathname==="/api/luckyjet-source-test"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  if(!PARSE_API_KEY)return json(res,200,{ok:false,configured:false,source:"parse_luckyjet",error:"parse_api_key_not_configured",message:"PARSE_API_KEY не настроен. Тест ничего не запрашивает без ключа."});
  try{
   const rr=await fetch(PARSE_LUCKYJET_URL,{method:"GET",headers:{"X-API-Key":PARSE_API_KEY,"Accept":"application/json"}});
   const raw=await rr.json().catch(()=>null);
   if(!rr.ok)return json(res,200,{ok:false,configured:true,source:"parse_luckyjet",http_status:rr.status,error:"upstream_error",upstream_error:raw?.error||raw?.message||"parse_api_error"});
   const data=raw?.data||raw||{};
   const rounds=Array.isArray(data.rounds)?data.rounds:[];
   const first=rounds[0]||null;
   const coefficient=first?.top_coefficient??first?.coefficient??null;
   return json(res,200,{ok:true,configured:true,source:"parse_luckyjet",http_status:rr.status,count:rounds.length,latest_round_id:first?.round_id||first?.id||null,latest_coefficient:typeof coefficient==="number"?coefficient:null,latest_outcome:first?.outcome??null,has_hash:Boolean(first?.hash),has_salt:Boolean(first?.salt),message:rounds.length?"Источник ответил данными раундов. Это диагностический результат; /api/signal пока не использует источник.":"Источник ответил без раундов."});
  }catch(e){
   console.error("Lucky Jet source test error",String(e.message||e));
   return json(res,200,{ok:false,configured:true,source:"parse_luckyjet",error:"source_request_failed",message:String(e.message||e)});
  }
 }
 if(url.pathname==="/api/signal"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  const u=ensureUser(r.user);
  const isOwner=OWNER_IDS.includes(String(r.user.id));
  if(!isOwner&&(!u.registered||!u.onewin_id||u.restricted))return json(res,403,{ok:false,error:"access_denied"});
  return json(res,200,{ok:false,error:"signal_source_unavailable",message:"Нет подтверждённого источника Lucky Jet. Коэффициент не генерируется и не подставляется."});
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
server.listen(PORT,()=>{console.log("jetLucky1 server listening on "+PORT+" owners="+OWNER_IDS.length);configureTelegram();});