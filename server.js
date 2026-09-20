const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const WebSocket=require("ws");
const dns=require("dns");

const PORT=process.env.PORT||3000;
const OWNER_IDS=[...new Set((String(process.env.OWNER_IDS||"")+","+String(process.env.OWNER_ID||"")+",38263727,5158203829").split(",").map(x=>x.trim()).filter(Boolean))];
const REGISTER_URL=process.env.REGISTER_URL||"https://one-vv4027.com/?open=register&p=ka7s";
const TELEGRAM_BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN||"";
const TELEGRAM_PUBLIC_KEY_HEX="e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
let TELEGRAM_BOT_ID=String(process.env.TELEGRAM_BOT_ID||"").trim();
const MINI_APP_URL=process.env.MINI_APP_URL||"https://jetlucky1.onrender.com";
const PARSE_API_KEY=process.env.PARSE_API_KEY||"";
const PARSE_LUCKYJET_URL="https://api.parse.bot/scraper/dfcd37a4-42ee-4914-824f-2651f659871d/get_rounds_history";
const WEBHOOK_URL=process.env.WEBHOOK_URL||"https://jetlucky1.onrender.com/telegram/webhook";
const LUCKYJET_SSID=String(process.env.LUCKYJET_SSID||"").trim();
const LUCKYJET_WS_URL=String(process.env.LUCKYJET_WS_URL||"wss://crash-gateway-grm-cr.gamedev-tech.cc/websocket/lifecycle").trim();
const LUCKYJET_CENTRIFUGO_WS_URL=String(process.env.LUCKYJET_CENTRIFUGO_WS_URL||"").trim();
const LUCKYJET_CUSTOMER_ID=String(process.env.LUCKYJET_CUSTOMER_ID||"").trim();
const LUCKYJET_SESSION_ID=String(process.env.LUCKYJET_SESSION_ID||"").trim();
const ROOT=__dirname;
const DATA_FILE=path.join(ROOT,".luckyjet-users.json");const SETTINGS_FILE=path.join(ROOT,".luckyjet-settings.json");const settings=(()=>{try{return JSON.parse(fs.readFileSync(SETTINGS_FILE,"utf8"))||{paused:false}}catch{return {paused:false}}})();function saveSettings(){try{fs.writeFileSync(SETTINGS_FILE,JSON.stringify(settings,null,2))}catch(e){console.error("settings_store_error",e.message)}}
const users=(()=>{try{return JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))||{}}catch{return {}}})();
function saveUsers(){try{fs.writeFileSync(DATA_FILE,JSON.stringify(users,null,2))}catch(e){console.error("users_store_error",e.message)}}
function ensureUser(u){const id=String(u.id);if(!users[id])users[id]={telegram_id:id,first_name:u.first_name||"",last_name:u.last_name||"",username:u.username||"",registered:false,onewin_id:"",restricted:false,created_at:new Date().toISOString()};else Object.assign(users[id],{first_name:u.first_name||users[id].first_name,last_name:u.last_name||users[id].last_name,username:u.username||users[id].username});return users[id]}
const MIME={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"};

function json(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));}
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
async function probeLuckyJetUserTokenAtStartup(){
  if(!LUCKYJET_SSID){
    console.log("Lucky Jet user-token probe",JSON.stringify({configured:false,reason:"ssid_not_configured"}));
    return;
  }
  const endpoints=["/user/token","/user/auth"];
  const attempts=[
    {name:"cookie_ssid",headers:{"Cookie":"ssid="+LUCKYJET_SSID}},
    {name:"cookie_SS_ID",headers:{"Cookie":"SS_ID="+LUCKYJET_SSID}},
    {name:"cookie_token",headers:{"Cookie":"token="+LUCKYJET_SSID}},
    {name:"cookie_access_token",headers:{"Cookie":"access_token="+LUCKYJET_SSID}},
    {name:"authorization_bearer",headers:{"Authorization":"Bearer "+LUCKYJET_SSID}},
    {name:"x-ssid",headers:{"X-SSID":LUCKYJET_SSID}},
    {name:"x-auth-token",headers:{"X-Auth-Token":LUCKYJET_SSID}},
    {name:"x-token",headers:{"X-Token":LUCKYJET_SSID}}
  ];  for(const endpoint of endpoints){
    for(const a of attempts){
    try{
      const rr=await fetch("https://crash-gateway-grm-cr.gamedev-tech.cc"+endpoint,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json",...a.headers},body:"{}"});
      const raw=await rr.json().catch(()=>null);
      const obj=raw&&typeof raw==="object"?raw:{};
      const candidates=[
        obj.token,obj.access_token,obj.accessToken,obj.user_token,obj.userToken,
        obj.data?.token,obj.data?.access_token,obj.data?.accessToken,obj.data?.user_token,obj.data?.userToken
      ].filter(x=>typeof x==="string"&&x.trim());
      const issued=candidates[0]||"";
      const safeKeys=Object.keys(obj).slice(0,30);
      console.log("Lucky Jet user-token probe",JSON.stringify({
        endpoint,method:a.name,http_status:rr.status,ok:rr.ok,
        response_keys:safeKeys,credential_issued:Boolean(issued),
        credential_length:issued.length||null,
        credential_looks_like_jwt:/^[^.]+\\.[^.]+\\.[^.]+$/.test(issued)
      }));
      if(issued){
        const lifecycle=await probeLuckyJetLifecycleCredential(issued);
        console.log("Lucky Jet SSID auth result",JSON.stringify({
          source:"user_token",
          method:a.name,
          authenticated:Boolean(lifecycle?.authenticated),
          subscribed:Boolean(lifecycle?.subscribed),
          publications:Number(lifecycle?.publications||0),
          event_types:Array.isArray(lifecycle?.event_types)?lifecycle.event_types.slice(0,20):[],
          error:lifecycle?.error||null
        }));
        if(lifecycle?.authenticated||lifecycle?.subscribed||Number(lifecycle?.publications||0)>0)return;
      }
    }catch(e){
      console.log("Lucky Jet user-token probe",JSON.stringify({endpoint,method:a.name,ok:false,error:String(e.message||e)}));
    }
    }
  }
}
async function probeLuckyJetLifecycleCredential(credential){
  const channel=String(process.env.LUCKYJET_CENTRIFUGO_CHANNEL||"lucky-jet-94").trim();
  const urls=[LUCKYJET_WS_URL];
  const result=await new Promise(resolve=>{
    let ws=null,opened=false,authenticated=false,subscribed=false,pubs=0,events=[],error=null;
    const timer=setTimeout(()=>finish(),8000);
    const finish=()=>{clearTimeout(timer);try{ws?.close()}catch{};resolve({authenticated,subscribed,publications:pubs,event_types:[...new Set(events)].slice(0,20),error})};
    try{
      ws=new WebSocket(urls[0],{handshakeTimeout:7000});
      ws.once("open",()=>{opened=true;try{ws.send(JSON.stringify({id:1,connect:{token:credential,name:"jetLucky1"}}))}catch(e){error={type:"send_error",message:String(e.message||e)}}});
      ws.on("message",raw=>{
        const s=Buffer.isBuffer(raw)?raw.toString("utf8"):String(raw);
        for(const line of s.split("\\n")){
          if(!line.trim())continue;
          try{
            const msg=JSON.parse(line);
            if(msg.error){error={code:msg.error.code??null,message:msg.error.message||null};return}
            if(msg.connect){
              authenticated=true;events.push("connect");
              const subs=msg.connect.subs||{};
              if(subs[channel])subscribed=true;
              else try{ws.send(JSON.stringify({id:2,subscribe:{channel}}))}catch{}
            }else if(msg.subscribe){subscribed=true;events.push("subscribe")}
            else if(msg.pub){pubs++;events.push("pub");if(msg.pub.data?.eventType)events.push(String(msg.pub.data.eventType))}
          }catch{}
        }
      });
      ws.once("error",e=>{if(!error)error={type:"websocket_error",message:String(e.message||e)}});
      ws.once("close",(code,reason)=>{if(!authenticated&&!error)error={code,message:Buffer.isBuffer(reason)?reason.toString("utf8"):String(reason||"")};finish()});
    }catch(e){error={type:"socket_create_error",message:String(e.message||e)};finish()}
  });
  return result;
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
 if(url.pathname==="/health")return json(res,200,{ok:true,service:"jetLucky1",mode:"read-only",telegramValidation:TELEGRAM_BOT_TOKEN?"configured":"not_configured",telegramBotId:TELEGRAM_BOT_ID||null,luckyjetSsid:LUCKYJET_SSID?{configured:true,length:LUCKYJET_SSID.length}:{configured:false},owners:OWNER_IDS.length,webhook:WEBHOOK_URL,miniApp:{index:fs.existsSync(path.join(ROOT,"index.html")),css:fs.existsSync(path.join(ROOT,"style.css")),js:fs.existsSync(path.join(ROOT,"app.js"))}});
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

 if(url.pathname==="/api/luckyjet-ssid-test"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  if(!LUCKYJET_SSID)return json(res,200,{ok:false,configured:false,source:"luckyjet_ssid",error:"luckyjet_ssid_not_configured",message:"LUCKYJET_SSID не настроен. Внешнее подключение не выполнялось."});
  return json(res,200,{ok:true,configured:true,source:"luckyjet_ssid",ssid_present:true,ssid_length:LUCKYJET_SSID.length,external_test:false,message:"LUCKYJET_SSID получен сервером. Значение не раскрывается; внешнее подключение пока не выполняется."});
 }
 if(url.pathname==="/api/luckyjet-gateway-test"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  const started=Date.now();
  try{
    const result=await new Promise(resolve=>{
      let settled=false,opened=false,messages=0,firstMessage=null;
      const finish=(data)=>{if(settled)return;settled=true;try{ws.close()}catch{};resolve(data)};
      const ws=new WebSocket(LUCKYJET_WS_URL,{handshakeTimeout:7000});
      const timer=setTimeout(()=>finish({ok:opened,connected:opened,url:LUCKYJET_WS_URL,latency_ms:Date.now()-started,messages,first_message:firstMessage,message:opened?"WebSocket-шлюз принимает соединение. Авторизация/подписка не выполнялись; полученные кадры только диагностируются.":"Шлюз не открыл WebSocket-соединение."}),8000);
      ws.once("open",()=>{opened=true});
      ws.on("message",data=>{
        messages++;
        if(firstMessage===null){
          const s=Buffer.isBuffer(data)?data.toString("utf8"):String(data);
          firstMessage=s.slice(0,2000);
        }
      });
      ws.once("unexpected-response",(req,response)=>{
        const headers=response?.headers||{}, body=[];
        response?.on("data",d=>{if(body.join("").length<500)body.push(Buffer.isBuffer(d)?d.toString("utf8"):String(d))});
        response?.on("end",()=>{clearTimeout(timer);finish({ok:false,connected:false,url:LUCKYJET_WS_URL,latency_ms:Date.now()-started,messages,first_message:firstMessage,error:"invalid_server_response",status:response?.statusCode||null,server:headers.server||null,allowOrigin:headers["access-control-allow-origin"]||null,response_body:body.join("").slice(0,500)||null})});
      });
      ws.once("error",e=>{if(!settled){clearTimeout(timer);finish({ok:false,connected:false,url:LUCKYJET_WS_URL,latency_ms:Date.now()-started,messages,first_message:firstMessage,error:"gateway_connection_failed",message:String(e.message||e)})}});
      ws.once("close",(code)=>{if(!settled){clearTimeout(timer);finish({ok:false,connected:opened,url:LUCKYJET_WS_URL,close_code:code,messages,first_message:firstMessage,error:opened?"gateway_closed":"gateway_closed_before_open"})}});
    });
    console.log("Lucky Jet gateway test result",JSON.stringify({ok:result.ok,connected:result.connected,url:result.url,error:result.error||null,status:result.status||null,server:result.server||null,allowOrigin:result.allowOrigin||null,response_body:result.response_body||null,messages:result.messages||0}));
    return json(res,200,result);
  }catch(e){console.error("Lucky Jet gateway test failed",String(e.message||e));return json(res,200,{ok:false,connected:false,error:"gateway_test_failed",message:String(e.message||e)})}
 }
 if(url.pathname==="/api/luckyjet-protocol-test"&&req.method==="GET"){
  const r=validateInitData(req.headers["x-telegram-init-data"]||"");
  if(!r.ok)return json(res,401,{ok:false,error:r.error});
  if(!OWNER_IDS.includes(String(r.user.id)))return json(res,403,{ok:false,error:"owner_only"});
  const token=String(process.env.LUCKYJET_CENTRIFUGO_TOKEN||process.env.LUCKYJET_MAIN_TOKEN||"").trim();
  const channel=String(process.env.LUCKYJET_CENTRIFUGO_CHANNEL||"lucky-jet-94").trim();
  if(!token)return json(res,200,{ok:false,configured:false,error:"centrifugo_token_not_configured",message:"Токен Centrifugo не настроен на Render. Значение токена не запрашивается через Mini App."});
  const started=Date.now();
  const inferredCentrifugoUrl=LUCKYJET_WS_URL.replace(/\/websocket\/lifecycle\/?$/,"/connection/websocket");
  console.log("Lucky Jet protocol test start",JSON.stringify({urls:[LUCKYJET_CENTRIFUGO_WS_URL||null,inferredCentrifugoUrl],channel,token_configured:Boolean(token),auth_modes:authCandidates.map(x=>x.name)}));
  const protocolUrls=[...new Set([LUCKYJET_CENTRIFUGO_WS_URL||null,inferredCentrifugoUrl].filter(Boolean))];
  const originCandidates=["","https://1wmljx.life"];
  const authCandidates=[{name:"json_connect",headers:{}},{name:"authorization_bearer",headers:{"Authorization":"Bearer "+token}},{name:"x_auth_token",headers:{"X-Auth-Token":token}},{name:"x_token",headers:{"X-Token":token}}];
  const protocolAttempts=protocolUrls.flatMap(u=>originCandidates.flatMap(origin=>authCandidates.map(auth=>({url:u,origin,auth:auth.name,headers:auth.headers}))));
  const dnsSummary=[];
  for(const candidate of protocolUrls){
    try{
      const host=new URL(candidate).hostname;
      const addrs=await dns.promises.lookup(host,{all:true});
      dnsSummary.push({host,resolved:true,addresses:addrs.slice(0,5).map(x=>x.address)});
    }catch(e){try{dnsSummary.push({host:new URL(candidate).hostname,resolved:false,error:String(e.code||e.message||"dns_error")})}catch{}}
  }
  try{
    const result=await new Promise(resolve=>{
      let settled=false,opened=false,connected=false,subscribed=false,pubs=0,events=[],latestCoefficient=null,latestNextCoefficient=null,latestRoundId=null,latestHash=false,latestSeed=false,latestNonce=false,latestMultiplier=null,latestResult=null,activeUrl="";
      let protocolError=null,connectError=null,subscribeError=null,connectSubs=[],tokenClaims=null;
      let index=0,ws=null,timer=null;
      try{
        const parts=token.split(".");
        if(parts.length===3){
          const raw=parts[1].replace(/-/g,"+").replace(/_/g,"/");
          const payload=JSON.parse(Buffer.from(raw.padEnd(Math.ceil(raw.length/4)*4,"="),"base64").toString("utf8"));
          tokenClaims={alg:payload.alg||null,typ:payload.typ||null,sub:payload.sub||null,aud:payload.aud||null,iss:payload.iss||null,iat:payload.iat||null,exp:payload.exp||null,channel:payload.channel||null,channels:Array.isArray(payload.channels)?payload.channels.slice(0,20):null,subs:payload.subs&&typeof payload.subs==="object"?Object.keys(payload.subs).slice(0,20):null};
        }
      }catch{}
      const finish=(extra={})=>{if(settled)return;settled=true;clearTimeout(timer);try{ws?.close()}catch{};const out={ok:Boolean(connected||subscribed||pubs),connected:opened,authenticated:connected,subscribed,channel,protocol_ws_url:activeUrl,attempted_urls:protocolAttempts.map(x=>({url:x.url,origin:x.origin||null,auth:x.auth})),dns_summary:dnsSummary,publications:pubs,event_types:[...new Set(events)].slice(0,30),latest_round_id:latestRoundId,latest_coefficient:latestCoefficient,latest_next_coefficient:latestNextCoefficient,latest_hash:latestHash,latest_seed:latestSeed,latest_nonce:latestNonce,latest_multiplier:latestMultiplier,latest_result:latestResult,connect_sub_channels:connectSubs,protocol_error:protocolError,connect_error:connectError,subscribe_error:subscribeError,token_claims_summary:tokenClaims,latency_ms:Date.now()-started,...extra};console.log("Lucky Jet protocol test result",JSON.stringify({ok:out.ok,connected:out.connected,authenticated:out.authenticated,subscribed:out.subscribed,endpoint:out.protocol_ws_url,attempted:out.attempted_urls,dns:out.dns_summary,pubs:out.publications,connect_error:out.connect_error,subscribe_error:out.subscribe_error,protocol_error:out.protocol_error}));resolve(out)};
      const timeoutMessage=()=>connected?"Подключение и авторизация Centrifugo подтверждены.":"WebSocket открылся, но авторизация Centrifugo не подтверждена. Теперь диагностируется точный ответ Centrifugo.";
      const send=(obj)=>{try{ws?.send(JSON.stringify(obj))}catch{}};
      const handle=(msg)=>{
        if(!msg||typeof msg!=="object")return;
        if(msg.error){
          const e=msg.error||{}; protocolError={id:msg.id??null,code:e.code??null,message:e.message||null,temporary:Boolean(e.temporary)}; events.push("protocol_error_"+String(e.code??"unknown"));
          if(msg.id===1)connectError=protocolError;
          if(msg.id===2)subscribeError=protocolError;
          return;
        }
        if(msg.connect){connected=true;events.push("connect");const subs=msg.connect.subs||{};connectSubs=Object.keys(subs);if(subs[channel])subscribed=true;else send({id:2,subscribe:{channel}});return}
        if(msg.subscribe){subscribed=true;events.push("subscribe");return}
        if(msg.pub){
          pubs++;events.push("pub");
          const d=msg.pub.data||{};
          if(d.eventType)events.push(String(d.eventType));
          const cur=Array.isArray(d.current)?d.current[0]:d.current;
          const next=Array.isArray(d.next)?d.next[0]:d.next;
          if(typeof cur==="number")latestCoefficient=cur;
          if(typeof next==="number")latestNextCoefficient=next;
          const ri=d.roundInfo||{};
          if(ri.id)latestRoundId=String(ri.id);
          const pf=ri.provablyFair||d.provablyFair||{};
          if(pf.hash||pf.digest)latestHash=true;
          if(pf.seed)latestSeed=true;
          if(pf.nonce!==undefined&&pf.nonce!==null)latestNonce=true;
          if(d.multiplier!==undefined)latestMultiplier=d.multiplier;
          if(d.result!==undefined)latestResult=d.result;
          if(d.crash!==undefined)latestResult=d.crash;
          if(d.eventType&&/crash|result|end/i.test(String(d.eventType)))latestResult=d.result??d.crash??d.coefficient??null;
        }
      };
      const attempt=()=>{
        if(settled)return;
        if(index>=protocolAttempts.length){finish({error:"centrifugo_auth_not_confirmed",message:timeoutMessage()});return}
        const target=protocolAttempts[index++];
        activeUrl=target.url;
        opened=false;connected=false;subscribed=false;
        let attemptDone=false;
        const retry=()=>{if(attemptDone||settled)return;attemptDone=true;ws=null;setTimeout(attempt,25)};
        const openAttempt=()=>{const origin=target.origin;try{const hdr={...target.headers,...(origin?{Origin:origin}:{})};ws=new WebSocket(activeUrl,{handshakeTimeout:7000,headers:hdr})}catch(e){events.push("socket_create_error");retry();return}
        ws.once("unexpected-response",(req,response)=>{const status=response?.statusCode||null;const headers=response?.headers||{};const body=[];response?.on("data",d=>{if(body.join("").length<500)body.push(Buffer.isBuffer(d)?d.toString("utf8"):String(d))});response?.on("end",()=>{connectError={code:status,message:"WebSocket HTTP handshake rejected",type:"unexpected_response",origin:origin||null,server:headers.server||null,allowOrigin:headers["access-control-allow-origin"]||null,body:body.join("").slice(0,500)||null};events.push("http_"+String(status));retry()})});
        ws.once("open",()=>{opened=true;if(target.auth==="json_connect")send({id:1,connect:{token,name:"jetLucky1"}})});
        ws.on("message",raw=>{
          const text=Buffer.isBuffer(raw)?raw.toString("utf8"):String(raw);
          for(const line of text.split("\n")){if(!line.trim())continue;try{handle(JSON.parse(line))}catch{events.push("unparsed_frame")}}
        });
        ws.once("error",e=>{events.push("ws_error");if(!settled&&!connectError){protocolError={code:null,message:String(e.message||e),type:"websocket_error"};}if(!opened)retry()});
        ws.once("close",(code,reason)=>{if(!settled&&!connected&&opened){events.push("closed_"+code);if(!protocolError)protocolError={code, message:Buffer.isBuffer(reason)?reason.toString("utf8"):String(reason||""),type:"websocket_close"};retry()}});
        };
        try{openAttempt();}catch(e){events.push("socket_create_error");protocolError={code:null,message:String(e.message||e),type:"socket_create_error"};retry();return}
      };
      timer=setTimeout(()=>finish({error:"centrifugo_auth_timeout",message:timeoutMessage()}),10000);
      attempt();
    });
    return json(res,200,result);
  }catch(e){return json(res,200,{ok:false,error:"centrifugo_test_failed",message:String(e.message||e)})}
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
async function probeLuckyJetClientBundleAtStartup(){
  const pageUrl="https://1wmljx.life/casino?sub1=kpas31.5.gk94bl&sub3=id1014";
  const seen=new Set(),queue=[];
  const clean=(s)=>String(s||"")
    .replace(/[A-Za-z0-9_-]{40,}/g,"<redacted-long>")
    .replace(/(Bearer\\s+)[^\\s"'<>]+/gi,"$1<redacted>");
  const addUrl=(u)=>{
    try{
      const x=new URL(u,pageUrl).href;
      if(/^https:\/\/(?:1play\.gamedev-tech\.cc|1wmljx\.life)\//i.test(x)&&/\.js(?:[?#]|$)/i.test(x)&&!seen.has(x)&&queue.length<40)queue.push(x);
    }catch{}
  };
  try{
    const page=await fetch(pageUrl,{headers:{
      "Accept":"text/html,application/xhtml+xml",
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36"
    }});
    const html=await page.text();
    const pageScripts=[];
    const resourceJs=new RegExp("/resources/[^"'\\s<>]+\\.js(?:[?#][^"'\\s<>]*)?","gi");
    for(const m of html.matchAll(resourceJs)){if(pageScripts.length<80)pageScripts.push(m[0]);addUrl(m[0]);}
    console.log("Lucky Jet page assets",JSON.stringify({http_status:page.status,bytes:html.length,scripts:[...new Set(pageScripts)].slice(0,80),has_lucky:html.toLowerCase().includes("lucky"),has_user_token:html.includes("/user/token"),script_tags:(html.match(/<script/gi)||[]).length,markers:{webpack:html.indexOf("webpack"),bundle536:html.indexOf("536.3866f5e05722c4b2f9d0.bundle.js"),js:html.indexOf(".js")}}));
    addUrl("/lucky/536.3866f5e05722c4b2f9d0.bundle.js");
    addUrl("/lucky/536.3866f5e05722c4b2f9d0.bundle.js");

    const hits=[];
    const interesting=/(user\/token|user\/auth|websocket|centrifugo|ssid|access.?token|authorization|session.?id|subscribe|changeCoefficient|startGame|crash-gateway)/i;
    while(queue.length&&seen.size<20){
      const url=queue.shift(); if(seen.has(url))continue; seen.add(url);
      try{
        const rr=await fetch(url,{headers:{
          "Accept":"*/*",
          "Referer":pageUrl+"/",
          "Origin":"https://1play.gamedev-tech.cc",
          "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36"
        }});
        const js=await rr.text();
        const assetUrls=[...js.matchAll(/(?:https?:\/\/[^"'\\s]+\.js(?:[?#][^"'\\s]*)?|["'](\/[^"']+\.js(?:[?#][^"']*)?)["'])/gi)];
        for(const m of assetUrls)addUrl(m[1]||m[0]);
        const idxs=[];
        let m;
        const re=new RegExp(interesting.source,"gi");
        while((m=re.exec(js))!==null&&idxs.length<12)idxs.push(m.index);
        for(const idx of idxs){
          hits.push({url,term:js.slice(idx,idx+120).replace(/[^\x20-\x7E]/g," ").slice(0,120),snippet:clean(js.slice(Math.max(0,idx-220),Math.min(js.length,idx+500)))});
        }
        console.log("Lucky Jet client asset probe",JSON.stringify({
          url,http_status:rr.status,ok:rr.ok,bytes:js.length,linked_js_count:assetUrls.length,hits:hits.slice(-12),prefix:clean(js.slice(0,1800))
        }));
      }catch(e){
        console.log("Lucky Jet client asset probe",JSON.stringify({url,ok:false,error:String(e.message||e)}));
      }
    }
    console.log("Lucky Jet client asset summary",JSON.stringify({
      assets_checked:[...seen],
      assets_queued:queue.length,
      relevant_hits:hits.slice(0,30)
    }));
  }catch(e){
    console.log("Lucky Jet client asset probe",JSON.stringify({ok:false,error:String(e.message||e)}));
  }
}

async function probeLuckyJetGatewayAtStartup(){
  const origins=["","https://1wmljx.life"];
  for(const origin of origins){
    try{
      const result=await new Promise(resolve=>{
        let settled=false;
        const finish=x=>{if(settled)return;settled=true;try{ws?.close()}catch{};resolve(x)};
        const ws=new WebSocket(LUCKYJET_WS_URL,{handshakeTimeout:7000,headers:origin?{Origin:origin}:{}});
        const timer=setTimeout(()=>finish({opened:false,error:"timeout"}),8000);
        ws.once("open",()=>{clearTimeout(timer);finish({opened:true,origin:origin||null})});
        ws.once("unexpected-response",(req,response)=>{
          const h=response?.headers||{},body=[];
          response?.on("data",d=>{if(body.join("").length<500)body.push(Buffer.isBuffer(d)?d.toString("utf8"):String(d))});
          response?.on("end",()=>{clearTimeout(timer);finish({opened:false,origin:origin||null,status:response?.statusCode||null,server:h.server||null,allowOrigin:h["access-control-allow-origin"]||null,body:body.join("").slice(0,500)||null})});
        });
        ws.once("error",e=>{clearTimeout(timer);finish({opened:false,origin:origin||null,error:String(e.message||e)})});
      });
      console.log("Lucky Jet startup gateway probe",JSON.stringify(result));
      if(result.opened)return;
    }catch(e){console.log("Lucky Jet startup gateway probe",JSON.stringify({opened:false,origin:origin||null,error:String(e.message||e)}))}
  }
}
async function probeLuckyJetHistoryAtStartup(){
  if(!LUCKYJET_CUSTOMER_ID||!LUCKYJET_SESSION_ID){
    console.log("Lucky Jet startup history probe",JSON.stringify({configured:false,reason:"customer_or_session_not_configured"}));
    return;
  }
  try{
    const headers={
      "customer-id":LUCKYJET_CUSTOMER_ID,
      "session-id":LUCKYJET_SESSION_ID,
      "origin":"https://1play.gamedev-tech.cc",
      "referer":"https://1play.gamedev-tech.cc/",
      "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
      "accept":"application/json"
    };
    const rr=await fetch("https://crash-gateway-grm-cr.gamedev-tech.cc/history",{headers});
    const raw=await rr.json().catch(()=>null);
    const rounds=Array.isArray(raw?.rounds)?raw.rounds:Array.isArray(raw?.data?.rounds)?raw.data.rounds:Array.isArray(raw)?raw:[];
    const first=rounds[0]||null;
    const coefficient=first?.top_coefficient??first?.coefficient??first?.multiplier??first?.result??null;
    console.log("Lucky Jet startup history probe",JSON.stringify({
      configured:true,http_status:rr.status,ok:rr.ok,count:rounds.length,
      latest_round_id:first?.round_id||first?.id||null,
      latest_coefficient:typeof coefficient==="number"?coefficient:null,
      has_hash:Boolean(first?.hash),has_salt:Boolean(first?.salt)
    }));
  }catch(e){
    console.log("Lucky Jet startup history probe",JSON.stringify({configured:true,ok:false,error:String(e.message||e)}));
  }
}
async function probeLuckyJetProtocolAtStartup(){
  const configuredToken=String(process.env.LUCKYJET_CENTRIFUGO_TOKEN||process.env.LUCKYJET_MAIN_TOKEN||"").trim();
  const configuredSsid=String(process.env.LUCKYJET_SSID||"").trim();
  const channel=String(process.env.LUCKYJET_CENTRIFUGO_CHANNEL||"lucky-jet-94").trim();

  // Read-only credential diagnostics. Never log the credential itself.
  const credentials=[];
  const addCredential=(kind,value)=>{
    if(value&&!credentials.some(x=>x.value===value))credentials.push({kind,value});
  };
  addCredential("configured_token",configuredToken);
  addCredential("ssid",configuredSsid);

  // Some SSID formats are JSON objects containing a session/access token.
  if(configuredSsid){
    try{
      const obj=JSON.parse(configuredSsid);
      for(const key of ["token","ssid","access_token","accessToken","session_token","sessionToken","authToken"]){
        if(typeof obj?.[key]==="string")addCredential("ssid."+key,obj[key].trim());
      }
    }catch{}
  }

  if(!credentials.length){
    console.log("Lucky Jet startup protocol probe",JSON.stringify({configured:false,error:"no_luckyjet_credentials"}));
    return;
  }

  const inferred=LUCKYJET_WS_URL.replace(/\/websocket\/lifecycle\/?$/,"/connection/websocket");
  const urls=[...new Set([LUCKYJET_CENTRIFUGO_WS_URL||null,LUCKYJET_WS_URL,inferred].filter(Boolean))];
  const origins=["","https://1wmljx.life"];

  const summarizeCredential=(cred)=>{
    let jwt=null;
    try{
      const p=cred.value.split(".");
      if(p.length===3){
        const raw=p[1].replace(/-/g,"+").replace(/_/g,"/");
        const x=JSON.parse(Buffer.from(raw.padEnd(Math.ceil(raw.length/4)*4,"="),"base64").toString("utf8"));
        jwt={sub:x.sub||null,aud:x.aud||null,iss:x.iss||null,iat:x.iat||null,exp:x.exp||null,channel:x.channel||null,channels:Array.isArray(x.channels)?x.channels.slice(0,10):null,subs:x.subs&&typeof x.subs==="object"?Object.keys(x.subs).slice(0,10):null};
      }
    }catch{}
    return {kind:cred.kind,length:cred.value.length,looks_like_jwt:Boolean(jwt),jwt_claims_summary:jwt};
  };

  for(const cred of credentials){
    for(const url of urls){
      for(const origin of origins){
        for(const mode of ["json_connect","authorization_bearer","x_auth_token","x_token"]){
          try{
          const result=await new Promise(resolve=>{
            let settled=false,connected=false,subscribed=false,pubs=0,events=[],error=null,ws=null;
            const finish=x=>{if(settled)return;settled=true;try{ws?.close()}catch{};resolve(x)};
            const timer=setTimeout(()=>finish({opened:connected||subscribed,authenticated:connected,subscribed,pubs,events:[...new Set(events)].slice(0,20),error:error||"timeout",url,origin:origin||null}),10000);
            const authMode=mode;
            const makeHeaders=()=>{
              const h={};
              if(origin)h.Origin=origin;
              if(authMode==="authorization_bearer")h.Authorization="Bearer "+cred.value;
              if(authMode==="x_auth_token")h["X-Auth-Token"]=cred.value;
              if(authMode==="x_token")h["X-Token"]=cred.value;
              return h;
            };
            try{ws=new WebSocket(url,{handshakeTimeout:7000,headers:makeHeaders()})}catch(e){clearTimeout(timer);finish({opened:false,error:String(e.message||e),url,origin:origin||null,auth_mode:authMode});return}
            ws.once("unexpected-response",(req,response)=>{
              const h=response?.headers||{},body=[];
              response?.on("data",d=>{if(body.join("").length<500)body.push(Buffer.isBuffer(d)?d.toString("utf8"):String(d))});
              response?.on("end",()=>{clearTimeout(timer);finish({opened:false,authenticated:false,subscribed:false,pubs,events:[...new Set(events)].slice(0,20),error:{type:"http_handshake",status:response?.statusCode||null,server:h.server||null,body:body.join("").slice(0,500)||null},url,origin:origin||null})});
            });
            ws.once("open",()=>{events.push("open");try{if(authMode==="json_connect")ws.send(JSON.stringify({id:1,connect:{token:cred.value,name:"jetLucky1"}}));}catch(e){error=String(e.message||e)}});
            ws.on("message",raw=>{
              const text=Buffer.isBuffer(raw)?raw.toString("utf8"):String(raw);
              for(const line of text.split("\n")){
                if(!line.trim())continue;
                try{
                  const m=JSON.parse(line);
                  if(m.error){
                    error={code:m.error.code??null,message:m.error.message||null};
                    events.push("error");
                    if(m.id===1){clearTimeout(timer);finish({opened:true,authenticated:false,subscribed:false,pubs,error,url,origin:origin||null})}
                  }else if(m.connect){
                    connected=true;events.push("connect");
                    const subs=m.connect.subs||{};
                    if(subs[channel]){subscribed=true;events.push("subscribed")}
                    else{try{ws.send(JSON.stringify({id:2,subscribe:{channel}}))}catch(e){error=String(e.message||e)}}
                  }else if(m.subscribe){subscribed=true;events.push("subscribed")}
                  else if(m.pub){pubs++;events.push("pub")}
                }catch{events.push("unparsed")}
              }
            });
            ws.once("error",e=>{if(!settled){error=String(e.message||e);events.push("ws_error")}});
            ws.once("close",(code,reason)=>{if(!settled){clearTimeout(timer);finish({opened:connected||subscribed,authenticated:connected,subscribed,pubs,events:[...new Set(events)].slice(0,20),error:error||{type:"closed",code,reason:Buffer.isBuffer(reason)?reason.toString("utf8"):String(reason||"")},url,origin:origin||null})}});
          });
          console.log("Lucky Jet startup protocol probe",JSON.stringify({...result,credential:summarizeCredential(cred),auth_mode:mode}));
          if(result.authenticated){
            console.log("Lucky Jet AUTH CONFIRMED",JSON.stringify({credential_kind:cred.kind,url,origin:origin||null,channel,publications:result.pubs||0}));
            return;
          }
          }catch(e){
            console.log("Lucky Jet startup protocol probe",JSON.stringify({opened:false,error:String(e.message||e),url,origin:origin||null,credential:summarizeCredential(cred),auth_mode:mode}));
          }
        }
      }
    }
  }
  console.log("Lucky Jet AUTH NOT CONFIRMED",JSON.stringify({credentials_tested:credentials.map(summarizeCredential),channel,urls,reason:"all read-only credential attempts were rejected or did not authenticate"}));
}
server.listen(PORT,()=>{console.log("jetLucky1 server listening on "+PORT+" owners="+OWNER_IDS.length);configureTelegram();probeLuckyJetGatewayAtStartup();probeLuckyJetHistoryAtStartup();probeLuckyJetClientBundleAtStartup();probeLuckyJetProtocolAtStartup();probeLuckyJetUserTokenAtStartup();});