const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const OWNER_ID="38263727";
const REGISTER_URL="https://one-vv4027.com/?open=register&p=ka7s";
const btn=document.getElementById("signalBtn"),state=document.getElementById("signalState"),mult=document.getElementById("multiplier"),hero=document.querySelector(".hero"),panel=document.getElementById("panel"),ownerPanel=document.getElementById("ownerPanel");
const gate=document.getElementById("accessGate"),appContent=document.getElementById("appContent"),accessState=document.getElementById("accessState");
const user=tg?.initDataUnsafe?.user||null;
const userId=String(user?.id||"");
const localOwner=userId===OWNER_ID;
const demo=[1.18,1.42,2.07,1.09,3.21,1.67,1.31,4.06,1.24,2.42];

function showPanel(title,html){panel.innerHTML="<h2>"+title+"</h2>"+html;panel.classList.remove("hidden");}
function renderOwner(){
  if(!localOwner)return;
  ownerPanel.innerHTML='<div class="owner-title"><h2>Owner-панель</h2><span class="badge">OWNER</span></div>'+
    '<div class="row"><span>Telegram ID</span><b>'+OWNER_ID+'</b></div>'+
    '<div class="row"><span>Режим</span><b>Полный доступ</b></div>'+
    '<div class="row"><span>Регистрация</span><b>Не требуется</b></div>'+
    '<p class="muted">Владелец не проходит регистрацию.</p>';
  ownerPanel.classList.remove("hidden");
}
function setAccess(allowed,reason){
  gate.classList.toggle("hidden",allowed);
  appContent.classList.toggle("hidden",!allowed);
  if(allowed)renderOwner();
  if(!allowed&&reason)accessState.textContent=reason;
  return allowed;
}
function showDiagnostic(text){
  let box=document.getElementById("diagnosticBox");
  if(!box){
    box=document.createElement("div");
    box.id="diagnosticBox";
    box.className="panel";
    gate.appendChild(box);
  }
  box.innerHTML="<h3>Диагностика доступа</h3>"+text;
}
document.getElementById("registerBtn").href=REGISTER_URL;

async function verifyAccess(){
  const hasTelegram=!!tg;
  const hasInitData=!!tg?.initData;
  const rawId=String(tg?.initDataUnsafe?.user?.id||"");
  showDiagnostic(
    '<div class="row"><span>Telegram WebApp</span><b>'+ (hasTelegram?"OK":"НЕТ") +'</b></div>'+
    '<div class="row"><span>initData</span><b>'+ (hasInitData?"ПОЛУЧЕНА":"НЕТ") +'</b></div>'+
    '<div class="row"><span>Telegram ID</span><b>'+ (rawId||"не определён") +'</b></div>'
  );
  if(!hasInitData){
    setAccess(false,"Откройте Mini App именно внутри Telegram, чтобы получить данные пользователя.");
    return false;
  }
  try{
    const response=await fetch("/api/access?init_data="+encodeURIComponent(tg.initData)+"&diag=1",{cache:"no-store"});
    const data=await response.json();
    showDiagnostic(
      '<div class="row"><span>Telegram WebApp</span><b>OK</b></div>'+
      '<div class="row"><span>initData</span><b>ПОЛУЧЕНА</b></div>'+
      '<div class="row"><span>Telegram ID</span><b>'+ (rawId||"не определён") +'</b></div>'+
      '<div class="row"><span>Сервер</span><b>'+ (response.ok?"ОТВЕТИЛ":"ОШИБКА "+response.status) +'</b></div>'+
      '<div class="row"><span>Доступ</span><b>'+ (data.access?"РАЗРЕШЁН":"ОГРАНИЧЕН") +'</b></div>'+
      '<div class="row"><span>Причина</span><b>'+ (data.reason||data.error||"—") +'</b></div>'
    );
    if(data.ok&&data.access){setAccess(true);return true;}
    setAccess(false,"Доступ пока не подтверждён сервером.");
    return false;
  }catch(error){
    showDiagnostic(
      '<div class="row"><span>Telegram WebApp</span><b>OK</b></div>'+
      '<div class="row"><span>initData</span><b>ПОЛУЧЕНА</b></div>'+
      '<div class="row"><span>Telegram ID</span><b>'+ (rawId||"не определён") +'</b></div>'+
      '<div class="row"><span>Сервер</span><b>ОШИБКА ЗАПРОСА</b></div>'+
      '<div class="row"><span>Причина</span><b>'+String(error?.message||error)+'</b></div>'
    );
    setAccess(false,"Не удалось проверить доступ на сервере.");
    return false;
  }
}

let hasAccess=false;
verifyAccess().then(v=>{hasAccess=v;});

document.getElementById("checkAccessBtn").onclick=async()=>{
  accessState.textContent="Проверяем доступ…";
  hasAccess=await verifyAccess();
  if(hasAccess)accessState.textContent="Доступ подтверждён.";
};

btn.onclick=()=>{
  if(!hasAccess)return;
  btn.disabled=true;hero.classList.add("spin");state.textContent="Анализируем доступные данные…";mult.textContent="…";
  setTimeout(()=>{
    hero.classList.remove("spin");
    const v=demo[Math.floor(Math.random()*demo.length)];
    mult.textContent=v.toFixed(2)+"×";
    state.textContent="Демонстрационный индикатор. Реальный источник ещё не подключён.";
    btn.disabled=false;
  },1300);
};

document.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>{
  if(!hasAccess)return;
  const s=b.dataset.section;
  if(s==="history")showPanel("История",demo.slice().reverse().map((x,i)=>'<div class="row"><span>Раунд '+(i+1)+'</span><b>'+x.toFixed(2)+"×</b></div>").join(""));
  if(s==="analysis")showPanel("Анализ",'<div class="row"><span>Раундов</span><b>'+demo.length+'</b></div><div class="row"><span>Среднее</span><b>'+((demo.reduce((a,b)=>a+b,0))/demo.length).toFixed(2)+'×</b></div><p class="muted">Данные демонстрационные. Реальный источник подключим после проверки.</p>');
  if(s==="profile")showPanel("Профиль",'<div class="row"><span>Telegram</span><b>'+(user?.first_name||"Пользователь")+'</b></div><div class="row"><span>ID</span><b>'+(userId||"не определён")+'</b></div><div class="row"><span>Доступ</span><b>'+(localOwner?"Owner":"Пользователь")+'</b></div>');
  if(s==="support")showPanel("Поддержка",'<p class="muted">Поддержка Mini App. Автоматические ставки и торговые операции не выполняются.</p>');
  if(s==="settings")showPanel("Настройки",'<div class="row"><span>Язык</span><b>Русский</b></div><div class="row"><span>Режим</span><b>Read-only</b></div><div class="row"><span>Источник данных</span><b>Не подключён</b></div>');
  if(s==="ai")showPanel("AI-анализ",'<p class="muted">AI сможет объяснять статистику и найденные закономерности после подключения проверенного источника данных. Он не будет обещать гарантированный результат.</p>');
});