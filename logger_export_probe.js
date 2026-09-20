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
  const needles=["AR as al","al:AR","export{","AR(","AR=async","AR=(()=>","AR=({","AR=Object","AR=\"","AR=null","AR=function"];
  for(const n of needles){
   const ps=[];let p=0;
   while((p=s.indexOf(n,p))>=0&&ps.length<8){ps.push({pos:p,snippet:red(s.slice(Math.max(0,p-900),Math.min(s.length,p+1500)))});p+=n.length;}
   console.log("Lucky Jet logger exact search",JSON.stringify({needle:n,count:ps.length,hits:ps}));
  }
  const map=await get(BASE+".map");
  console.log("Lucky Jet logger sourcemap",JSON.stringify({status:map.status,bytes:map.body.length}));
  if(map.status===200){
   let j=null;try{j=JSON.parse(map.body)}catch{}
   const sources=j?.sources||[], contents=j?.sourcesContent||[];
   console.log("Lucky Jet logger sourcemap summary",JSON.stringify({sources:sources.slice(0,30),sources_count:sources.length,has_sources_content:contents.length>0}));
   for(let i=0;i<contents.length;i++){
    const c=String(contents[i]||"");
    if(/\bAR\b/.test(c)||/function\s+AR\b/.test(c)){
      const p=Math.max(0,c.search(/function\s+AR\b|\bAR\b/));
      console.log("Lucky Jet logger sourcemap AR source",JSON.stringify({source:sources[i]||null,snippet:red(c.slice(Math.max(0,p-1200),p+3500))}));
    }
   }
  }
 }catch(e){console.log("Lucky Jet logger export probe",JSON.stringify({ok:false,error:String(e.message||e)}));}
}
module.exports={run};
