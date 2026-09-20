const https=require("https");
const BASE="https://1wmljx.life/resources/v1/app/assets/logger-D8JkLHFH.js";
function get(url){return new Promise((resolve,reject)=>https.get(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"*/*","Origin":"https://1wmljx.life","Referer":"https://1wmljx.life/"}},r=>{let b="";r.setEncoding("utf8");r.on("data",x=>b+=x);r.on("end",()=>resolve({status:r.statusCode||0,body:b}));}).on("error",reject));}
function red(s){return String(s).replace(/(["'])(?:token|ssid|authorization|cookie|access[_-]?token|session[_-]?id|customer[_-]?id)\1\s*[:=]\s*[^,;}]+/gi,"$1<redacted>$1").replace(/[A-Za-z0-9_-]{120,}/g,"<redacted-long>");}
async function run(){
 try{
  const r=await get(BASE);
  console.log("Lucky Jet logger export probe",JSON.stringify({status:r.status,bytes:r.body.length}));
  if(r.status!==200)return;
  const s=r.body;
  const needles=["AR as al","al:AR","function AR(","AR=async","AR=(()=>","AR=({","AR=Object","AR=()=>({","AR=()=>","AR=function","const AR=","let AR=","var AR=","document.cookie","localStorage","sessionStorage","Authorization","accessToken","customerId","traceId"];
  for(const n of needles){
   const ps=[];let p=0;
   while((p=s.indexOf(n,p))>=0&&ps.length<6){ps.push({pos:p,snippet:red(s.slice(Math.max(0,p-700),Math.min(s.length,p+1800)))});p+=n.length;}
   console.log("Lucky Jet logger exact search",JSON.stringify({needle:n,count:ps.length,hits:ps}));
  }
  const declPatterns=[/function\s+AR\s*\(/g,/\b(?:const|let|var)\s+AR\s*=/g,/\bAR\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g];
  for(const re of declPatterns){
   const hits=[];let m;
   while((m=re.exec(s))&&hits.length<10){const p=m.index;hits.push({pos:p,snippet:red(s.slice(Math.max(0,p-700),Math.min(s.length,p+3000)))});}
   console.log("Lucky Jet logger AR declaration search",JSON.stringify({pattern:String(re),count:hits.length,hits}));
  }
  const map=await get(BASE+".map");
  console.log("Lucky Jet logger sourcemap",JSON.stringify({status:map.status,bytes:map.body.length}));
 }catch(e){console.log("Lucky Jet logger export probe",JSON.stringify({ok:false,error:String(e.message||e)}));}
}
module.exports={run};
