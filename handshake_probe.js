const https=require("https");
function fetchText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{
      "Accept":"*/*",
      "Referer":"https://1wmljx.life/",
      "Origin":"https://1wmljx.life",
      "User-Agent":"Mozilla/5.0"
    }},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>resolve({status:res.statusCode||0,text:d}));res.on("error",reject)}).on("error",reject);
  });
}
function clean(s){
  return String(s||"")
    .replace(/Bearer\s+[^\s"'<>]+/gi,"Bearer <redacted>")
    .replace(/[A-Za-z0-9_-]{40,}/g,"<redacted-long>")
    .replace(/(?:ssid|token|access_token|authorization|cookie)\s*[:=]\s*["'][^"']+["']/gi,"$1:<redacted>");
}
async function run(){
  const url="https://1wmljx.life/resources/v1/app/assets/socket-io-adapter-DSFgpOt0.js";
  try{
    const r=await fetchText(url), js=r.text, terms=[
      "this.options","options.query","options.auth","auth:","query:",
      "Language:","connect()","socket=t","new Socket","socket.on"
    ];
    const hits=[];
    for(const term of terms){
      let p=0,n=0;
      while((p=js.indexOf(term,p))>=0&&n<8){
        hits.push({term,snippet:clean(js.slice(Math.max(0,p-900),Math.min(js.length,p+1500)))});
        p+=term.length;n++;
      }
    }
    console.log("Lucky Jet adapter handshake extraction",JSON.stringify({
      http_status:r.status,bytes:js.length,
      hits:hits.slice(0,40)
    }));
  }catch(e){
    console.log("Lucky Jet adapter handshake extraction",JSON.stringify({ok:false,error:String(e.message||e)}));
  }
}
module.exports={run};
