const { io } = require("socket.io-client");

function summarizeJwt(v){
  try{
    const p=String(v||"").split(".");
    if(p.length!==3)return {length:String(v||"").length,looks_like_jwt:false};
    const raw=p[1].replace(/-/g,"+").replace(/_/g,"/");
    const x=JSON.parse(Buffer.from(raw.padEnd(Math.ceil(raw.length/4)*4,"="),"base64").toString("utf8"));
    return {length:String(v).length,looks_like_jwt:true,sub:x.sub||null,iat:x.iat||null,exp:x.exp||null,channels:Array.isArray(x.channels)?x.channels.slice(0,5):null};
  }catch{return {length:String(v||"").length,looks_like_jwt:false};}
}

async function attempt(name, base, ssid){
  return await new Promise(resolve=>{
    let settled=false,events=[],sampleEvents=[],socket;
    const finish=(result)=>{if(settled)return;settled=true;try{socket?.disconnect()}catch{};resolve({...result,mode:name,events:[...new Set(events)].slice(0,20),sample_events:sampleEvents.slice(0,8)})};
    const timer=setTimeout(()=>finish({connected:false,authenticated:false,reason:"timeout"}),10000);
    const opts={
      path:"/v4/socket.io",
      transports:["websocket"],
      forceNew:true,
      reconnection:false,
      timeout:9000,
      withCredentials:true,
      query:{Language:"en"}
    };
    if(name==="auth_token")opts.auth={token:ssid};
    if(name==="auth_ssid")opts.auth={ssid};
    if(name==="auth_access_token")opts.auth={access_token:ssid};
    if(name==="query_token")opts.query.token=ssid;
    if(name==="query_ssid")opts.query.ssid=ssid;
    if(name==="query_access_token")opts.query.access_token=ssid;
    if(name==="header_bearer")opts.extraHeaders={Authorization:"Bearer "+ssid,Origin:"https://1wmljx.life",Referer:"https://1wmljx.life/"};
    if(name==="cookie_ssid")opts.extraHeaders={Cookie:"ssid="+ssid,Origin:"https://1wmljx.life",Referer:"https://1wmljx.life/"};
    if(name==="cookie_SS_ID")opts.extraHeaders={Cookie:"SS_ID="+ssid,Origin:"https://1wmljx.life",Referer:"https://1wmljx.life/"};
    socket=io(base,opts);
    socket.on("connect",()=>{
      events.push("connect");
      clearTimeout(timer);
      setTimeout(()=>finish({connected:true,authenticated:true,id:socket.id,transport:socket.io.engine?.transport?.name||null}),5000);
    });
    socket.on("connect_error",e=>{
      events.push("connect_error");
      finish({connected:false,authenticated:false,error:String(e?.message||e),description:String(e?.description||""),context:e?.context?String(e.context).slice(0,300):null});
    });
    socket.on("disconnect",reason=>{events.push("disconnect"); if(!settled)finish({connected:false,authenticated:false,reason:String(reason||"disconnect")})});
    socket.onAny((event,...args)=>{
      events.push("event:"+String(event));
      if(sampleEvents.length<8){
        let safe=args;
        try{safe=JSON.parse(JSON.stringify(args,(k,v)=>{
          if(typeof v==="string"&&(/token|ssid|authorization|cookie/i.test(k)||v.length>200))return "<redacted>";
          return v;
        }))}catch{safe=["<unserializable>"];}
        sampleEvents.push({event:String(event),args:safe});
      }
    });
  });
}

async function run(){
  const ssid=String(process.env.LUCKYJET_SSID||"").trim();
  const base=String(process.env.LUCKYJET_SOCKETIO_URL||"https://crash-gateway-grm-cr.gamedev-tech.cc").trim();
  if(!ssid){
    console.log("Lucky Jet Socket.IO probe",JSON.stringify({configured:false,reason:"ssid_not_configured"}));
    return;
  }
  console.log("Lucky Jet Socket.IO probe started",JSON.stringify({base,path:"/v4/socket.io",ssid:summarizeJwt(ssid)}));
  const modes=["auth_token","auth_ssid","auth_access_token","query_token","query_ssid","query_access_token","header_bearer","cookie_ssid","cookie_SS_ID"];
  for(const mode of modes){
    const result=await attempt(mode,base,ssid);
    console.log("Lucky Jet Socket.IO probe result",JSON.stringify(result));
    if(result.connected){
      console.log("Lucky Jet SOCKET.IO AUTH CONFIRMED",JSON.stringify({mode,transport:result.transport||null,event_types:result.events.filter(x=>x.startsWith("event:")).slice(0,20)}));
      return;
    }
  }
  console.log("Lucky Jet SOCKET.IO AUTH NOT CONFIRMED",JSON.stringify({modes_tested:modes}));
}

module.exports={run};
