const https=require("https");

function get(url){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{
      "Accept":"*/*","Referer":"https://1wmljx.life/","Origin":"https://1wmljx.life","User-Agent":"Mozilla/5.0"
    }},res=>{
      let d="";res.on("data",c=>{d+=c});res.on("end",()=>resolve({status:res.statusCode||0,text:d}));res.on("error",reject);
    });req.on("error",reject);
  });
}
function clean(s){
  return String(s||"").replace(/[A-Za-z0-9_-]{40,}/g,"<redacted-long>").replace(/Bearer\s+[^\s"'<>]+/gi,"Bearer <redacted>");
}
function paths(js){
  const out=new Set();
  for(const m of js.matchAll(/(?:["'])(\/resources\/v1\/[^"'\\]+\.js)(?:["'])/g))out.add("https://1wmljx.life"+m[1]);
  for(const m of js.matchAll(/(?:["'])(assets\/[^"'\\]+\.js)(?:["'])/g))out.add("https://1wmljx.life/resources/v1/app/"+m[1]);
  return [...out];
}
async function run(){
  const main="https://1wmljx.life/resources/v1/app/assets/main-CYh8X1YZ.js";
  try{
    const mr=await get(main), urls=paths(mr.text), matches=[];
    for(const url of urls.slice(0,220)){
      try{
        const r=await get(url),js=r.text;
        if(js.includes("socket-io-adapter-DSFgpOt0")){
          const terms=["function M(","M=()=>","M=()=>({","localStorage.getItem","sessionStorage.getItem","document.cookie","customerId","customer-id","sessionId","session-id","accessToken","Authorization","ssid","SS_ID","token","socket-io-adapter-DSFgpOt0","new S("];
          const hits=[];
          for(const term of terms){
            let p=0,n=0;
            while((p=js.indexOf(term,p))>=0&&n<4){
              hits.push({term,snippet:clean(js.slice(Math.max(0,p-1000),Math.min(js.length,p+1800)))});
              p+=term.length;n++;
            }
          }
          matches.push({url,http_status:r.status,bytes:js.length,hits:hits.slice(0,28)});
        }
      }catch{}
    }
    console.log("Lucky Jet adapter constructor search",JSON.stringify({main_status:mr.status,assets_scanned:Math.min(urls.length,220),matches}));
  }catch(e){console.log("Lucky Jet adapter constructor search",JSON.stringify({ok:false,error:String(e.message||e)}))}
}
module.exports={run};
