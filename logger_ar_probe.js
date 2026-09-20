const https=require("https");

const URL="https://1wmljx.life/resources/v1/app/assets/logger-D8JkLHFH.js";

function redact(s){
  return String(s)
    .replace(/[A-Za-z0-9_-]{120,}/g,"<redacted-long>")
    .replace(/(token|ssid|authorization|cookie|access[_-]?token|session[_-]?id|customer[_-]?id)(["':=,\s]+)([^,;\s}"']{8,})/gi,"$1$2<redacted>");
}

function fetchText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{
      "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept":"*/*",
      "Origin":"https://1wmljx.life",
      "Referer":"https://1wmljx.life/"
    }},res=>{
      let b="";
      res.setEncoding("utf8");
      res.on("data",d=>b+=d);
      res.on("end",()=>resolve({status:res.statusCode||0,body:b}));
    }).on("error",reject);
  });
}

async function run(){
  try{
    const r=await fetchText(URL);
    console.log("Lucky Jet logger AR definition probe",JSON.stringify({status:r.status,bytes:r.body.length}));
    if(r.status!==200){console.log("Lucky Jet logger AR definition probe",JSON.stringify({ok:false,reason:"http_status"}));return;}

    const s=r.body;
    const hits=[];
    const re=/\bAR\b/g;
    let m;
    while((m=re.exec(s))!==null){
      const pos=m.index;
      const before=s.slice(Math.max(0,pos-500),pos);
      const after=s.slice(pos,pos+1200);
      const window=before+after;
      const definitionLike=/(function\s+|(?:const|let|var)\s+|=>|=\s*\(?|export\s*\{)/.test(window);
      if(definitionLike) hits.push({pos,snippet:redact(window.slice(Math.max(0,window.length-900)))});
      if(hits.length>=20) break;
    }
    console.log("Lucky Jet logger AR occurrences",JSON.stringify({count:hits.length,occurrences:hits}));
  }catch(e){
    console.log("Lucky Jet logger AR definition probe",JSON.stringify({ok:false,error:String(e.message||e)}));
  }
}
module.exports={run};
