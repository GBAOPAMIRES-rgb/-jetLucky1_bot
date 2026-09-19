const http=require("http");
const fs=require("fs");
const path=require("path");

const PORT=process.env.PORT||3000;
const OWNER_ID=String(process.env.OWNER_ID||"38263727");
const REGISTER_URL=process.env.REGISTER_URL||"https://one-vv4027.com/?open=register&p=ka7s";
const ROOT=__dirname;

const MIME={
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".svg":"image/svg+xml",
  ".ico":"image/x-icon"
};

function json(res,status,data){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
}

function serveStatic(req,res){
  let pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/") pathname="/index.html";
  if(pathname.includes("..")) return json(res,400,{ok:false,error:"invalid_path"});
  const file=path.join(ROOT,pathname);
  if(!file.startsWith(ROOT)) return json(res,400,{ok:false,error:"invalid_path"});
  try{
    const data=fs.readFileSync(file);
    res.writeHead(200,{"Content-Type":MIME[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});
    res.end(data);
  }catch{
    json(res,404,{ok:false,error:"not_found"});
  }
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/health") return json(res,200,{ok:true,service:"jetLucky1",mode:"read-only"});
  if(url.pathname==="/api/config") return json(res,200,{ok:true,registrationUrl:REGISTER_URL});
  if(url.pathname==="/api/access"){
    const id=url.searchParams.get("telegram_id");
    if(!id)return json(res,400,{ok:false,error:"telegram_id_required"});
    if(String(id)===OWNER_ID)return json(res,200,{ok:true,access:true,role:"owner"});
    return json(res,200,{ok:true,access:false,role:"user",reason:"registration_verification_not_connected"});
  }
  if(req.method!=="GET") return json(res,405,{ok:false,error:"method_not_allowed"});
  return serveStatic(req,res);
});

server.listen(PORT,()=>console.log("jetLucky1 server listening on "+PORT));