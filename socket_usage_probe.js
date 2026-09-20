const https=require("https");
function get(url){return new Promise((resolve,reject)=>https.get(url,{headers:{"Accept":"*/*","Referer":"https://1wmljx.life/","Origin":"https://1wmljx.life","User-Agent":"Mozilla/5.0"}},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>resolve({status:res.statusCode||0,text:d}));res.on("error",reject)}).on("error",reject)})}
function clean(s){return String(s||"").replace(/[A-Za-z0-9_-]{40,}/g,"<redacted-long>").replace(/Bearer\s+[^\s"'<>]+/gi,"Bearer <redacted>");}
async function run(){
 const urls=[
  "https://1wmljx.life/resources/v1/app/assets/main-CYh8X1YZ.js",
  "https://1wmljx.life/resources/v1/app/assets/socket-io-adapter-DSFgpOt0.js"
 ];
 const terms=["socket-io-adapter-DSFgpOt0","new S(","new h(","customerId","sessionId","accessToken","Authorization","authorization","ssid","SS_ID","token:"];
 for(const url of urls)try{
  const r=await get(url),js=r.text,hits=[];
  for(const term of terms){
   let p=0,n=0;
   while((p=js.indexOf(term,p))>=0&&n<10){hits.push({term,snippet:clean(js.slice(Math.max(0,p-1200),Math.min(js.length,p+2200)))});p+=term.length;n++;}
  }
  console.log("Lucky Jet socket usage probe",JSON.stringify({url,http_status:r.status,bytes:js.length,hits:hits.slice(0,30)}));
 }catch(e){console.log("Lucky Jet socket usage probe",JSON.stringify({url,ok:false,error:String(e.message||e)}))}
}
module.exports={run};
