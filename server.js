const http=require("http");
const PORT=process.env.PORT||3000;
const OWNER_ID=String(process.env.OWNER_ID||"38263727");
const REGISTER_URL=process.env.REGISTER_URL||"https://one-vv4027.com/?open=register&p=ka7s";

function json(res,status,data){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
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
  return json(res,404,{ok:false,error:"not_found"});
});
server.listen(PORT,()=>console.log("jetLucky1 server listening on "+PORT));