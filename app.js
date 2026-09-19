window.addEventListener("error",function(){try{const a=document.getElementById("appContent"),g=document.getElementById("accessGate"),s=document.getElementById("accessState");if(a)a.classList.remove("hidden");if(g)g.classList.add("hidden");if(s)s.textContent="Интерфейс загружен с резервным режимом.";const f=document.getElementById("bootFooter");if(f)f.textContent="🚀 Lucky Jet • резервный режим";}catch(_){}});
window.addEventListener("unhandledrejection",function(){try{const a=document.getElementById("appContent");if(a)a.classList.remove("hidden");}catch(_){}});
const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const REGISTER_URL="https://one-vv4027.com/?open=register&p=ka7s";
const OWNER_IDS=new Set(["38263727","5158203829"]);
const demo=[1.18,1.42,2.07,1.09,3.21,1.67,1.31,2.48,1.24,2.42];
const $=id=>document.getElementById(id);
const gate=$("accessGate"),appContent=$("appContent"),panel=$("panel"),ownerPanel=$("ownerPanel");
const btn=$("signalBtn"),state=$("signalState"),mult=$("multiplier");
const user=tg?.initDataUnsafe?.user||null,userId=String(user?.id||"");
let hasAccess=false,role="user";
if(userId && OWNER_IDS.has(userId)){ role="owner"; hasAccess=true; setAccess(true); renderRoleUI(); }

$("registerBtn").href=REGISTER_URL;

function showPanel(title,html){panel.innerHTML="<div class='panel-head'><h2>"+title+"</h2><button class='quick-link' onclick='document.getElementById("panel").classList.add("hidden")'>Закрыть</button></div>"+html;panel.classList.remove("hidden");panel.classList.add("full-screen-section");panel.scrollIntoView({behavior:"smooth",block:"start"});}
function sectionShell(title,subtitle,body){return '<div class="section-screen"><span class="mini-label">LUCKY JET</span><h2>'+title+'</h2><p class="muted">'+subtitle+'</p>'+body+'</div>';}
function metric(label,value,sub){return '<div class="metric-box"><span>'+label+'</span><b>'+value+'</b><small>'+sub+'</small></div>';}
function card(icon,title,small,section,accent=false){return '<button class="card '+(accent?"accent":"")+'" data-section="'+section+'"><span class="card-icon">'+icon+'</span><b>'+title+'</b><small>'+small+'</small><em>→</em></button>';}
function nav(icon,title,section){return '<button class="nav-item" data-section="'+section+'"><span>'+icon+'</span><small>'+title+'</small></button>';}

function renderOwnerPanel(){
  if(role!=="owner")return;
  ownerPanel.innerHTML='<div class="owner-title"><h2>👑 Owner Panel</h2><span class="badge">FULL ACCESS</span></div>'+
  '<div class="row"><span>Telegram ID</span><b>'+userId+'</b></div>'+
  '<div class="row"><span>Доступ</span><b>Полный</b></div>'+
  '<div class="row"><span>Регистрация</span><b>Не требуется</b></div>'+
  '<div class="row"><span>Торговые операции</span><b>ОТКЛЮЧЕНЫ</b></div>'+
  '<div class="quick-actions" style="margin-top:10px">'+
  '<button data-admin="users">👥 Пользователи</button><button data-admin="access">🔐 Доступ</button>'+
  '<button data-admin="bot">⚙️ Управление ботом</button><button data-admin="diag">🩺 Диагностика</button>'+
  '<button data-admin="logs">📋 Логи</button><button data-admin="ai">✦ Настройки AI</button></div>';
  ownerPanel.classList.remove("hidden");
  ownerPanel.querySelectorAll("[data-admin]").forEach(b=>b.onclick=()=>adminPanel(b.dataset.admin));
}
function adminPanel(type){
  const map={
    users:["Пользователи",'<p class="muted">Панель подготовлена. Список пользователей появится после подключения постоянного хранилища.</p>'],
    access:["Управление доступом",'<div class="row"><span>Проверка Telegram initData</span><b>СЕРВЕРНАЯ</b></div><div class="row"><span>Регистрация</span><b>ОЖИДАЕТ API</b></div><p class="muted">Автоматически выдавать доступ по регистрации можно только после получения официального API/webhook регистрации.</p>'],
    bot:["Управление ботом",'<div class="row"><span>Режим</span><b>READ-ONLY</b></div><div class="row"><span>Ставки/торговля</span><b>ОТКЛЮЧЕНО</b></div><div class="row"><span>Mini App</span><b>АКТИВНО</b></div>'],
    diag:["Системная диагностика",'<div class="row"><span>Telegram WebApp</span><b>'+ (tg?"OK":"НЕТ")+'</b></div><div class="row"><span>initData</span><b>'+ (tg?.initData?"ПОЛУЧЕНА":"НЕТ")+'</b></div><div class="row"><span>Telegram ID</span><b>'+userId+'</b></div><div class="row"><span>Роль</span><b>'+role.toUpperCase()+'</b></div>'],
    logs:["Логи",'<p class="muted">Логи Render не выводятся в клиентский интерфейс. Проверяйте их на сервере/в Render.</p>'],
    ai:["Настройки AI",'<div class="row"><span>AI-анализ</span><b>ГОТОВ</b></div><div class="row"><span>Источник</span><b>ОЖИДАЕТ</b></div><p class="muted">AI не создаёт реальные результаты без проверенных входных данных.</p>']
  };
  showPanel(map[type][0],map[type][1]);
}

function renderRoleUI(){
  document.body.classList.toggle("owner-mode",role==="owner");
  $("roleBadge").textContent=role==="owner"?"OWNER":"USER";
  $("roleBadge").classList.toggle("owner",role==="owner");
  $("pageTitle").textContent=role==="owner"?"Главная (Owner)":"Главная";
  $("modeLabel").textContent=role==="owner"?"OWNER • ПОЛНЫЙ ДОСТУП":"АНАЛИТИЧЕСКИЙ ЦЕНТР";
  $("welcomeTitle").innerHTML=role==="owner"?"Больше, чем просто сигналы<br><strong>Контроль. Аналитика. Управление.</strong>":"Больше, чем просто сигналы<br><strong>Анализ. Статистика. AI.</strong>";
  $("sectionHint").textContent=role==="owner"?"Все функции Owner":"Только доступные функции";
  const grid=$("sectionGrid");
  const items=role==="owner"?[
    ["🏠","Главная","Центр управления","home",1],["🚀","Сигналы","Аналитика данных","signals",1],["⌁","Аналитика","Статистика системы","analysis",0],["◷","История","Раунды и события","history",0],["✦","AI-анализ","AI-инструменты","ai",0],
    ["👥","Пользователи","Список и активность","users",0],["🔐","Управление доступом","Права и регистрация","access",0],["⚙️","Управление ботом","Настройки и режим","bot",0],["🩺","Диагностика","Проверка системы","diag",0],
    ["📋","Логи","Журнал событий","logs",0],["👑","Owner Panel","Полный контроль","owner",1],["◉","Профиль","Аккаунт Owner","profile",0],["?","Поддержка","Помощь и связь","support",0],["⚙","Настройки","Параметры","settings",0]
  ]:[
    ["🚀","Сигналы","Доступные индикаторы","signals",1],["◷","История","Ваши доступные данные","history",0],["⌁","Анализ","Статистика","analysis",0],["✦","AI-анализ","AI-объяснение","ai",0],["◉","Профиль","Ваш аккаунт","profile",0],["?","Поддержка","Помощь и связь","support",0],["⚙","Настройки","Параметры","settings",0]
  ];
  grid.innerHTML=items.map(x=>card(x[0],x[1],x[2],x[3],x[4])).join("");
  $("quickActions").innerHTML=role==="owner"
    ? '<button data-section="users">👥 Пользователи</button><button data-section="bot">⚙️ Бот</button><button data-section="diag">🩺 Диагностика</button><button data-section="logs">📋 Логи</button>'
    : '<button data-section="signals">🚀 Сигнал</button><button data-section="analysis">⌁ Анализ</button><button data-section="history">◷ История</button><button data-section="ai">✦ AI</button>';
  $("bottomNav").innerHTML=role==="owner"
    ? nav("⌂","Главная","home")+nav("🚀","Сигналы","signals")+nav("⌁","Аналитика","analysis")+nav("👥","Пользователи","users")+nav("☰","Ещё","owner")
    : nav("◉","Профиль","profile")+nav("◷","История","history")+nav("🚀","Сигналы","signals")+nav("✦","AI","ai")+nav("?","Поддержка","support");
  bindSections();
  renderOwnerPanel();
}

function bindSections(){
 document.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>{
   if(!hasAccess)return;
   const s=b.dataset.section;
   if(s==="home"){panel.classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"});return;}
   if(s==="signals"){showPanel("Сигналы",sectionShell("Сигналы","Выберите параметры и запустите read-only анализ.",'<div class="signal-controls"><button class="control-chip active">EUR/USD</button><button class="control-chip">GBP/USD</button><button class="control-chip">USD/JPY</button><button class="control-chip">BTC/USD</button></div><div class="signal-controls"><button class="control-chip active">M1</button><button class="control-chip">M5</button><button class="control-chip">M15</button></div><button class="primary-link" style="display:block;text-align:center;margin-top:12px" onclick="document.getElementById('signalBtn').click()">🚀 ПОЛУЧИТЬ СИГНАЛ</button><div class="signal-result" style="margin-top:12px"><span>ОЖИДАНИЕ</span><small>Реальный источник ещё не подключён</small></div>"));return;}
   if(s==="history"){showPanel("История",sectionShell("История","Последние доступные результаты.",demo.slice().reverse().map((x,i)=>'<div class="row"><span>Раунд '+(i+1)+'</span><b>'+x.toFixed(2)+'×</b></div>').join("")+'<p class="muted">Демо-данные отмечены отдельно и не являются реальным источником.</p>'));return;}
   if(s==="analysis"){showPanel("Аналитика",sectionShell("Аналитика","Сводка показателей без автоматических ставок.",'<div class="metrics-grid">'+metric("РАУНДЫ",demo.length,"демо") + metric("СРЕДНЕЕ",((demo.reduce((a,b)=>a+b,0))/demo.length).toFixed(2)+"×","демо") + metric("ИСТОЧНИК","ОЖИДАЕТ","подключение") + metric("РЕЖИМ","READ-ONLY","активен")+'</div><p class="muted">Реальные метрики появятся только после подтверждения источника данных.</p>'));return;}
   if(s==="ai"){showPanel("AI-анализ",sectionShell("AI-анализ","Интеллектуальное объяснение только на основе доступных данных.",'<div class="ai-box"><div class="row"><span>Статус</span><b>ГОТОВ</b></div><div class="row"><span>Входные данные</span><b>ОЖИДАЮТСЯ</b></div><button class="secondary-btn" onclick="this.textContent='ДАННЫЕ ОЖИДАЮТСЯ'">ЗАПУСТИТЬ AI-АНАЛИЗ</button></div><p class="muted">AI не создаёт гарантированные результаты и не выполняет ставки.</p>'));return;}
   if(s==="users"||s==="access"||s==="bot"||s==="diag"||s==="logs"||s==="owner"){if(role!=="owner")return;if(s==="owner"){ownerPanel.scrollIntoView({behavior:"smooth"});return;}adminPanel(s);return;}
   if(s==="profile")showPanel("Профиль",'<div class="row"><span>Telegram</span><b>'+(user?.first_name||"Пользователь")+'</b></div><div class="row"><span>ID</span><b>'+userId+'</b></div><div class="row"><span>Роль</span><b>'+role.toUpperCase()+'</b></div>'); 
   if(s==="support")showPanel("Поддержка",'<p class="muted">Помощь по Mini App и регистрации. Автоматические ставки и торговые операции не выполняются.</p>');
   if(s==="settings")showPanel("Настройки",'<div class="row"><span>Язык</span><b>Русский</b></div><div class="row"><span>Тема</span><b>Тёмная</b></div><div class="row"><span>Режим</span><b>Read-only</b></div><div class="row"><span>Источник данных</span><b>Не подключён</b></div>');
 });
}

function setAccess(allowed){
 gate.classList.toggle("hidden",allowed);appContent.classList.toggle("hidden",!allowed);
}
async function verifyAccess(){
 if(!tg?.initData){setAccess(false);$("accessState").textContent="Откройте Mini App внутри Telegram.";return false;}
 try{
  const r=await fetch("/api/access?init_data="+encodeURIComponent(tg.initData),{cache:"no-store"});
  const d=await r.json();
  if(d.ok&&d.access){role=d.role||"user";hasAccess=true;setAccess(true);renderRoleUI();return true;}
  setAccess(false);$("accessState").textContent=d.reason||"Доступ пока не подтверждён сервером.";return false;
 }catch(e){setAccess(false);$("accessState").textContent="Не удалось проверить доступ на сервере.";return false;}
}
btn.onclick=()=>{if(!hasAccess)return;btn.disabled=true;heroSpin(true);state.textContent="Анализируем доступные данные…";mult.textContent="…";setTimeout(()=>{heroSpin(false);const v=demo[Math.floor(Math.random()*demo.length)];mult.textContent=v.toFixed(2)+"×";state.textContent="Демонстрационный индикатор — реальный источник ещё не подключён.";btn.disabled=false;},900);};
function heroSpin(v){document.querySelector(".hero").classList.toggle("spin",v);}
$("checkAccessBtn").onclick=verifyAccess;
$("sourceStatus").textContent="ОЖИДАЕТ";$("sourceSub").textContent="Реальный источник не подключён";
$("aiStatus").textContent="ГОТОВ";
if(!hasAccess){ $("accessState").textContent="Загрузка интерфейса…"; verifyAccess(); }