(()=> {
  if (globalThis.__LUCKYJET_READONLY_COLLECTOR__) return;
  globalThis.__LUCKYJET_READONLY_COLLECTOR__=true;

  const RENDER="https://jetlucky1.onrender.com/api/luckyjet-browser-agent";
  const SAFE_PATHS=["/websocket/lifecycle","/websocket/state","/websocket/secondary"];
  const ALLOWED=/^(roundid|round_id|id|eventtype|state|coefficient|coefficients|currentcoefficient|currentcoefficients|nextcoefficient|nextcoefficients|multiplier|nextmultiplier|crashpoint|finalcoefficientvalues|finalvalue)$/i;

  function safeUrl(raw){
    try{
      const u=new URL(String(raw),location.href);
      if(!SAFE_PATHS.includes(u.pathname)) return null;
      return u.origin+u.pathname;
    }catch{return null}
  }

  function extract(raw){
    if(typeof raw!=="string" || raw.length>30000) return null;
    let obj;
    try{obj=JSON.parse(raw)}catch{return null;}
    const hits=[];
    function walk(v,path="",depth=0){
      if(depth>5 || v==null) return;
      if(Array.isArray(v)){
        for(let i=0;i<Math.min(v.length,20);i++) walk(v[i],path+"["+i+"]",depth+1);
        return;
      }
      if(typeof v!=="object") return;
      for(const [k,val] of Object.entries(v).slice(0,80)){
        const p=path?path+"."+k:k;
        if(ALLOWED.test(k)){
          if(typeof val==="number" && Number.isFinite(val)) hits.push({path:p,value:val});
          else if(Array.isArray(val)) {
            const a=val.slice(0,10).map(Number).filter(Number.isFinite);
            if(a.length) hits.push({path:p,value:a});
          } else if(typeof val==="string" && val.length<=160) hits.push({path:p,value:val.slice(0,160)});
        }
        walk(val,p,depth+1);
      }
    }
    walk(obj);
    const relevant=hits.filter(h=>/coefficient|multiplier|crashpoint/i.test(h.path)&&(
      (typeof h.value==="number"&&h.value>=1) || Array.isArray(h.value)
    ));
    if(!relevant.length) return null;
    const event=obj?.push?.pub?.[1]?.data || obj?.data || obj?.push?.data || obj;
    const channel=String(obj?.push?.channel||obj?.channel||"");
    if(channel && !channel.startsWith("lucky-jet-")) return null;
    return {
      url_path:null,
      direction:"received",
      eventType:event?.eventType||null,
      roundId:event?.roundId||event?.id||event?.roundInfo?.roundId||event?.roundInfo?.id||null,
      hits:relevant.slice(0,30),
      frame_length:raw.length,
      page_origin:location.origin,
      at:new Date().toISOString()
    };
  }

  async function sendCandidate(candidate,url){
    if(!candidate) return;
    candidate.url_path=url;
    try{
      await fetch(RENDER,{
        method:"POST",
        mode:"cors",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(candidate),
        keepalive:true
      });
    }catch{}
  }

  const OriginalWS=window.WebSocket;
  if(!OriginalWS) return;

  function WrappedWS(url,protocols){
    const ws=protocols===undefined?new OriginalWS(url):new OriginalWS(url,protocols);
    const safe=safeUrl(url);
    if(safe){
      ws.addEventListener("message",ev=>{
        if(typeof ev.data==="string"){
          const c=extract(ev.data);
          if(c) sendCandidate(c,safe);
        }
      });
    }
    return ws;
  }
  WrappedWS.prototype=OriginalWS.prototype;
  try{Object.setPrototypeOf(WrappedWS,OriginalWS)}catch{}
  window.WebSocket=WrappedWS;

  console.log("[Lucky Jet Read-Only Collector] armed",location.origin);
})();