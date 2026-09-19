const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const PORT=process.env.PORT||3000;
const OWNER_ID=String(process.env.OWNER_ID||"38263727");
const REGISTER_URL=process.env.REGISTER_URL||"https://one-vv4027.com/?open=register&p=ka7s";
const TELEGRAM_BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN||"";
const MINI_APP_URL=process.env.MINI_APP_URL||"https://jetlucky1.onrender.com";
const ROOT=__dirname;

const MIME={
  ".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",
  ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"
};

function json(res,status,data){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
}

function validateInitData(initData){
  if(!TELEGRAM_BOT_TOKEN)return {ok:false,error:"telegram_bot_token_not_configured"};
  if(!initData||typeof initData!=="string")return {ok:false,error:"init_data_required"};
  const params=new URLSearchParams(initData),hash=params.get("hash");
  if(!hash)return {ok:false,error:"hash_missing"};
  params.delete("hash");
  const dataCheckString=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
  const secret=crypto.createHmac("sha256","WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
  const calculated=crypto.createHmac("sha256",secret).update(dataCheckString).digest("hex");
  if(hash.length!==calculated.length||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(calculated)))return {ok:false,error:"init_data_invalid"};
  let user=null;
  try{user=JSON.parse(params.get("user")||"null");}catch{return {ok:false,error:"user_invalid"};}
  if(!user?.id)return {ok:false,error:"user_missing"};
  return {ok:true,user};
}

async function telegram(method,payload){
  if(!TELEGRAM_BOT_TOKEN)throw new Error("telegram_bot_token_not_configured");
  const response=await fetch("https://api.telegram.org/bot"+TELEGRAM_BOT_TOKEN+"/"+method,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
  });
  const data=await response.json();
  if(!data.ok)throw new Error(method+":"+String(data.description||"telegram_api_error"));
  return data.result;
}

async function configureTelegram(){
  if(!TELEGRAM_BOT_TOKEN){
    console.log("Telegram setup: token not configured");
    return;
  }
  try{
    const me=await telegram("getMe",{});
    await telegram("setChatMenuButton",{
      menu_button:{type:"web_app",text:"🚀 Lucky Jet",web_app:{url:MINI_APP_URL}}
    });
    console.log("Telegram setup: OK bot=@"+(me.username||"unknown")+" menu=Lucky Jet");
  }catch(error){
    console.error("Telegram setup: FAILED "+String(error.message||error));
  }
}

function serveStatic(req,res){
  let pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/")pathname="/index.html";
  if(pathname.includes(".."))return json(res,400,{ok:false,error:"invalid_path"});
  const file=path.join(ROOT,pathname);
  if(!file.startsWith(ROOT))return json(res,400,{ok:false,error:"invalid_path"});
  try{const data=fs.readFileSync(file);res.writeHead(200,{"Content-Type":MIME[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});res.end(data);}
  catch{json(res,404,{ok:false,error:"not_found"});}
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/health")return json(res,200,{ok:true,service:"jetLucky1",mode:"read-only",telegramValidation:TELEGRAM_BOT_TOKEN?"configured":"not_configured",miniApp:{index:fs.existsSync(path.join(ROOT,"index.html")),css:fs.existsSync(path.join(ROOT,"style.css")),js:fs.existsSync(path.join(ROOT,"app.js"))}});
  if(url.pathname==="/api/config")return json(res,200,{ok:true,registrationUrl:REGISTER_URL,miniAppUrl:MINI_APP_URL});
  if(url.pathname==="/api/access"){
    const result=validateInitData(url.searchParams.get("init_data"));
    if(!result.ok)return json(res,401,{ok:false,error:result.error});
    const id=String(result.user.id);
    if(id===OWNER_ID)return json(res,200,{ok:true,access:true,role:"owner",telegram_id:id});
    return json(res,200,{ok:true,access:false,role:"user",telegram_id:id,reason:"registration_verification_not_connected"});
  }
  if(req.method!=="GET")return json(res,405,{ok:false,error:"method_not_allowed"});
  return serveStatic(req,res);
});

server.listen(PORT,()=>{console.log("jetLucky1 server listening on "+PORT);configureTelegram();});