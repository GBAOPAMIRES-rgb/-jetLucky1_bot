const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}
const OWNER_IDS=new Set(["38263727","5158203829"]);
const $=id=>document.getElementById(id);
const panel=$("panel"),ownerPanel=$("ownerPanel"),btn=$("signalBtn"),state=$("signalState"),mult=$("multiplier");
const user=tg?.initDataUnsafe?.user||null,userId=String(user?.id||"");
let role=userId&&OWNER_IDS.has(userId)?"owner":"user";
let hasAccess=true;

function showPanel(title,html){
 panel.innerHTML="<div class='panel-head'><h2>"+title+"</h2><button class='quick-link' id='closePanel'>Закрыть</button></div>"+html;
 panel.classList.remove("hidden");panel.classList.add("full-screen-section");
 $("closePanel").onclick=()=>panel.classList.add("hidden");
 panel.scrollIntoView({behavior:"smooth",block:"start"});
}
function shell(title,subtitle,body){return '<div class="section-screen"><span class="mini-label">LUCKY JET</span><h2>'+title+'</h2><p class="muted">'+subtitle+'</p>'+body+'</div>'}
function metric(label,value,sub){return '<div class="metric-box"><span>'+label+'</span><b>'+value+'</b><small>'+sub+'</small></div>'}
function card(icon,title,small,section,accent=false){return '<button class="card '+(accent?"accent":"")+'" data-section="'+section+'"><span class="card-icon">'+icon+'</span><b>'+title+'</b><small>'+small+'</small><em>→</em></button>'}
function nav(icon,title,section){return '<button class="nav-item" data-section="'+section+'"><span>'+icon+'</span><small>'+title+'</small></button>'}

function renderOwnerPanel(){
 if(role!=="owner")return;
 ownerPanel.innerHTML='<div class="owner-title"><h2>👑 Owner Panel</h2><span class="badge">FULL ACCESS</span></div>'+
 '<div class="row"><span>Telegram ID</span><b>'+userId+'</b></div>'+
 '<div class="row"><span>Доступ</span><b>Полный</b></div>'+
 '<div class="row"><span>Торговые операции</span><b>ОТКЛЮЧЕНЫ</b></div>'+
 '<div class="quick-actions" style="margin-top:10px">'+
 '<button data-admin="users">👥 Пользователи</button><button data-admin="access">🔐 Доступ</button>'+
 '<button data-admin="bot">⚙️ Бот</button><button data-admin="diag">🩺 Диагностика</button>'+
 '<button data-admin="logs">📋 Логи</button><button data-admin="ai">✦ Настройки AI</button></div>';
 ownerPanel.classList.remove("hidden");
 ownerPanel.querySelectorAll("[data-admin]").forEach(b=>b.onclick=()=>adminPanel(b.dataset.admin));
}
function adminPanel(type){
 const map={
 users:["Пользователи",'<p class="muted">Раздел Owner. Список пользователей подключается к серверному хранилищу.</p>'],
 access:["Управление доступом",'<div class="row"><span>Telegram WebApp</span><b>ПРОВЕРЯЕТСЯ</b></div><p class="muted">Права обычных пользователей не открывают Owner-функции.</p>'],
 bot:["Управление ботом",'<div class="row"><span>Режим</span><b>READ-ONLY</b></div><div class="row"><span>Торговые операции</span><b>ОТКЛЮЧЕНЫ</b></div>'],
 diag:["Диагностика",'<div class="row"><span>Telegram WebApp</span><b>'+(tg?"OK":"НЕТ")+'</b></div><div class="row"><span>initData</span><b>'+(tg?.initData?"ПОЛУЧЕНА":"НЕТ")+'</b></div><div class="row"><span>Telegram ID</span><b>'+userId+'</b></div>'],
 logs:["Логи",'<p class="muted">Серверные логи доступны в Render. В Mini App показываем только безопасный статус.</p>'],
 ai:["Настройки AI",'<div class="row"><span>AI-анализ</span><b>ГОТОВ</b></div><div class="row"><span>Автоматические ставки</span><b>ОТКЛЮЧЕНЫ</b></div>']
 };
 showPanel(map[type][0],map[type][1]);
}
function renderRoleUI(){
 document.body.classList.toggle("owner-mode",role==="owner");
 $("roleBadge").textContent=role==="owner"?"OWNER":"USER";
 $("roleBadge").classList.toggle("owner",role==="owner");
 $("pageTitle").textContent="Главная";
 $("modeLabel").textContent=role==="owner"?"OWNER • ПОЛНЫЙ ДОСТУП":"LUCKY JET";
 $("welcomeTitle").innerHTML=role==="owner"?"Ваш центр<br><strong>Управление Lucky Jet</strong>":"Ваш центр<br><strong>Lucky Jet</strong>";
 $("sectionHint").textContent=role==="owner"?"Все функции Owner":"Доступные функции";
 const grid=$("sectionGrid");
 const items=role==="owner"?[
 ["🏠","Главная","Центр управления","home",1],["🚀","Сигналы","Аналитический центр","signals",1],
 ["⌁","Аналитика","Статистика","analysis",0],["◷","История","Доступные данные","history",0],["✦","AI-анализ","AI-инструменты","ai",0],
 ["👥","Пользователи","Список и активность","users",0],["🔐","Управление доступом","Права","access",0],["⚙️","Управление ботом","Режим","bot",0],
 ["🩺","Диагностика","Проверка системы","diag",0],["📋","Логи","Журнал событий","logs",0],["👑","Owner Panel","Полный контроль","owner",1],
 ["◉","Профиль","Аккаунт Owner","profile",0],["?","Поддержка","Помощь и связь","support",0],["⚙","Настройки","Параметры","settings",0]
 ]:[
 ["🚀","Сигналы","Аналитический центр","signals",1],["◷","История","Ваши данные","history",0],["⌁","Анализ","Статистика","analysis",0],
 ["✦","AI-анализ","AI-инструменты","ai",0],["◉","Профиль","Ваш аккаунт","profile",0],["?","Поддержка","Помощь и связь","support",0],["⚙","Настройки","Параметры","settings",0]
 ];
 grid.innerHTML=items.map(x=>card(...x)).join("");
 $("quickActions").innerHTML=role==="owner"
 ? '<button data-section="users">👥 Пользователи</button><button data-section="bot">⚙️ Бот</button><button data-section="diag">🩺 Диагностика</button><button data-section="logs">📋 Логи</button>'
 : '<button data-section="signals">🚀 Сигнал</button><button data-section="analysis">⌁ Анализ</button><button data-section="history">◷ История</button><button data-section="ai">✦ AI</button>';
 $("bottomNav").innerHTML=role==="owner"
 ? nav("⌂","Главная","home")+nav("🚀","Сигналы","signals")+nav("⌁","Аналитика","analysis")+nav("👥","Пользователи","users")+nav("☰","Ещё","owner")
 : nav("◉","Профиль","profile")+nav("◷","История","history")+nav("🚀","Сигналы","signals")+nav("✦","AI","ai")+nav("?","Поддержка","support");
 bindSections();renderOwnerPanel();
}
function bindSections(){
 document.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>{
  const s=b.dataset.section;
  if(s==="home"){panel.classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"});return;}
  if(s==="signals"){showPanel("Сигналы",shell("Сигналы","Центральный экран Lucky Jet.",'<div class="signal-result"><span>ГОТОВ</span><small>Нажмите «Получить сигнал» для запуска анализа доступных данных.</small></div><button class="signal-circle-btn" style="margin-top:18px" onclick="document.getElementById(\'signalBtn\').click()"><span class="signal-circle-icon">🚀</span><b>ПОЛУЧИТЬ<br>СИГНАЛ</b></button>'));return;}
  if(s==="history"){showPanel("История",shell("История","Реальные результаты появятся после подключения проверенного источника.",'<div class="row"><span>Данные</span><b>ОЖИДАЮТСЯ</b></div><div class="row"><span>Режим</span><b>READ-ONLY</b></div>'));return;}
  if(s==="analysis"){showPanel("Аналитика",shell("Аналитика","Статистика без автоматических ставок.",'<div class="metrics-grid">'+metric("СИСТЕМА","ONLINE","Mini App")+metric("СИГНАЛЫ","—","нет подтверждённых данных")+metric("AI","ГОТОВ","ожидает данные")+metric("РЕЖИМ","READ-ONLY","активен")+'</div>'));return;}
  if(s==="ai"){showPanel("AI-анализ",shell("AI-анализ","AI работает только с проверенными входными данными.",'<div class="ai-box"><div class="row"><span>Статус</span><b>ГОТОВ</b></div><div class="row"><span>Данные</span><b>ОЖИДАЮТСЯ</b></div><button class="secondary-btn" onclick="this.textContent=\'ДАННЫЕ ОЖИДАЮТСЯ\'">ЗАПУСТИТЬ AI-АНАЛИЗ</button></div>'));return;}
  if(["users","access","bot","diag","logs"].includes(s)){if(role!=="owner")return;adminPanel(s);return;}
  if(s==="owner"){if(role==="owner")ownerPanel.scrollIntoView({behavior:"smooth"});return;}
  if(s==="profile")showPanel("Профиль",'<div class="row"><span>Telegram</span><b>'+(user?.first_name||"Пользователь")+'</b></div><div class="row"><span>ID</span><b>'+userId+'</b></div><div class="row"><span>Роль</span><b>'+role.toUpperCase()+'</b></div>');
  if(s==="support")showPanel("Поддержка",'<p class="muted">Помощь по Mini App и регистрации. Торговые операции не выполняются.</p>');
  if(s==="settings")showPanel("Настройки",'<div class="row"><span>Язык</span><b>Русский</b></div><div class="row"><span>Тема</span><b>Тёмная</b></div><div class="row"><span>Режим</span><b>Read-only</b></div>');
 });
}
btn.onclick=()=>{
 btn.disabled=true;document.querySelector(".hero").classList.add("spin");state.textContent="Проверяем доступные данные…";mult.textContent="…";
 setTimeout(()=>{document.querySelector(".hero").classList.remove("spin");mult.textContent="—";state.textContent="Нет подтверждённых данных для реального сигнала.";btn.disabled=false;$("mainStatus").textContent="ОЖИДАНИЕ";$("mainStatusSub").textContent="Источник данных не подтверждён";},700);
};
renderRoleUI();