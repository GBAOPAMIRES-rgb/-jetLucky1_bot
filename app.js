const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const OWNER_IDS=new Set(["38263727","5158203829"]);
const $=id=>document.getElementById(id);
const user=tg?.initDataUnsafe?.user||null;
const userId=String(user?.id||"");

let role=userId&&OWNER_IDS.has(userId)?"owner":"user";
let hasAccess=true,registered=false,restricted=false,onewinId="";
let currentSection="home";
let REGISTER_URL="";

async function api(endpoint,options={}){
  const initData=tg?.initData||"";
  const opts={...options,headers:{...(options.headers||{}),"Content-Type":"application/json","X-Telegram-Init-Data":initData}};
  let url=endpoint;
  if(endpoint==="/api/access")url+="?init_data="+encodeURIComponent(initData);
  try{
    const response=await fetch(url,opts);
    const data=await response.json().catch(()=>({ok:false,error:"invalid_server_response"}));
    if(!response.ok&&data.ok!==false)data.ok=false;
    return data;
  }catch(e){return {ok:false,error:"network_error",message:"Не удалось связаться с сервером"}}
}

const userNav=[
  ["⌂","Главная","home"],["🚀","Сигналы","signals"],["📜","История","history"],
  ["◉","Профиль","profile"],["☰","Ещё","more"]
];
const ownerNav=[
  ["⌂","Главная","home"],["🚀","Сигналы","signals"],["📊","Аналитика","analytics"],
  ["👥","Пользователи","users"],["☰","Ещё","more"]
];

const moreUser=[
  ["💬","Поддержка","Помощь и связь","support"],["⚙️","Настройки","Язык и часовой пояс","settings"]
];
const moreOwner=[
  ["📜","История","Подтверждённые данные","history"],["🔐","Управление доступом","Ограничения пользователей","access"],
  ["⚙️","Управление ботом","Пауза и режим","bot"],["🩺","Диагностика","Проверка системы","diag"],
  ["📋","Логи","Статус событий","logs"],["👑","Owner Panel","Информация Owner","owner"],
  ["💬","Поддержка","Помощь и связь","support"],["⚙️","Настройки","Язык и часовой пояс","settings"]
];

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}

function shell(title,subtitle,body){
  return '<div class="screen-page"><div class="screen-title"><span class="mini-label">LUCKY JET</span><h2>'+title+'</h2><p class="muted">'+subtitle+'</p></div><div class="screen-body">'+body+'</div></div>';
}

function metric(label,value,sub){
  return '<div class="metric-box"><span>'+label+'</span><b>'+value+'</b><small>'+sub+'</small></div>';
}

function renderNav(){
  const nav=role==="owner"?ownerNav:userNav;
  $("roundNav").innerHTML=nav.map(x=>{
    const active=x[2]===currentSection;
    return '<button class="round-nav-item '+(active?"active":"")+'" data-nav="'+x[2]+'"><span class="nav-icon">'+x[0]+'</span><small>'+x[1]+'</small></button>';
  }).join("");
  $("roundNav").querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
  $("roleBadge").textContent=role==="owner"?"OWNER":"USER";
}

function setScreen(title,html){
  $("pageTitle").textContent=title;
  $("screen").innerHTML=html;
  $("screen").scrollTop=0;
}

function center(title,subtitle,body){
  return '<div class="center-stage">'+shell(title,subtitle,body)+'</div>';
}

function signalScreen(){
  setScreen("Сигналы",center("🚀 Сигналы","Только подтверждённые данные.",
    '<div class="signal-orbit"><div class="signal-ring"></div><button class="signal-circle-btn" id="getSignal"><span class="signal-circle-icon">🚀</span><b>ПОЛУЧИТЬ<br>СИГНАЛ</b></button></div>'+
    '<div class="signal-result"><span id="signalState">ГОТОВ</span><small id="signalSub">Нажмите центральную кнопку для проверки источника.</small></div>'));
  $("getSignal").onclick=async()=>{
    const b=$("getSignal");b.disabled=true;$("signalState").textContent="ПРОВЕРКА";$("signalSub").textContent="Проверяем подтверждённый источник данных…";
    const r=await api("/api/signal");
    if(r.ok&&r.signal){$("signalState").textContent="СИГНАЛ";$("signalSub").textContent="Коэффициент: "+r.signal.multiplier+"x";}
    else{$("signalState").textContent="ОЖИДАНИЕ";$("signalSub").textContent="Источник данных не подтверждён. Вымышленный сигнал не показываем."}
    b.disabled=false;
  };
}

async function historyScreen(){
  setScreen("История",center("📜 История","Здесь находятся только подтверждённые результаты.","<div id='historyBody' class='data-stack'><div class='loading'>Проверяем данные…</div></div>"));
  const r=await api("/api/history");
  $("historyBody").innerHTML=r.ok&&r.history?.length?r.history.map(x=>'<div class="data-row"><span>'+escapeHtml(x.time)+'</span><b>'+escapeHtml(x.multiplier)+'x</b></div>').join(""):'<div class="empty-state">НЕТ ПОДТВЕРЖДЁННЫХ ДАННЫХ</div>';
}

function homeScreen(){
  const owner=role==="owner";
  setScreen("Главная",center(owner?"👑 Owner":"🚀 Lucky Jet",owner?"Центр управления системой":"Ваш основной экран.",
    '<div class="home-orb">🚀</div><h3 class="hero-title">'+(owner?"Управление Lucky Jet":"Добро пожаловать")+'</h3><p class="muted">'+(owner?"Все административные функции разнесены по отдельным разделам.":"Каждый раздел имеет свою отдельную функцию.")+'</p><div class="home-status"><span>СТАТУС</span><b>ONLINE</b></div>'));
}

function profileScreen(){
  setScreen("Профиль",center("👤 Профиль","Ваш аккаунт и 1win ID.",
    '<div class="profile-card"><div class="data-row"><span>Telegram</span><b>'+escapeHtml(user?.username?"@"+user.username:(user?.first_name||"Пользователь"))+'</b></div><div class="data-row"><span>Telegram ID</span><b>'+escapeHtml(userId)+'</b></div><label>1win ID</label><input id="onewinInput" inputmode="numeric" placeholder="Введите 1win ID" value="'+escapeHtml(onewinId)+'"><small>Укажите ID после регистрации.</small><button class="primary-btn" id="saveOneWin">Сохранить 1win ID</button><div id="profileMsg" class="signal-state"></div></div>'));
  $("saveOneWin").onclick=async()=>{
    const v=$("onewinInput").value.trim();
    if(!v){$("profileMsg").textContent="Введите 1win ID";return}
    const r=await api("/api/profile",{method:"POST",body:JSON.stringify({onewin_id:v})});
    if(!r.ok){$("profileMsg").textContent=r.message||"Ошибка";return}
    registered=true;onewinId=r.onewin_id||v;hasAccess=!r.restricted;restricted=!!r.restricted;$("profileMsg").textContent="Данные сохранены";renderNav();
  };
}

function supportScreen(){
  setScreen("Поддержка",center("💬 Поддержка","Помощь по регистрации и работе Mini App.",
    '<div class="support-card"><p class="muted">Не отправляйте пароли, токены или другие секреты.</p><textarea id="supportText" maxlength="1000" placeholder="Опишите вопрос"></textarea><button class="primary-btn" id="sendSupport">Написать Owner</button><div id="supportMsg" class="signal-state"></div></div>'));
  $("sendSupport").onclick=async()=>{
    const msg=$("supportText").value.trim();if(!msg){$("supportMsg").textContent="Введите сообщение";return}
    const r=await api("/api/support/message",{method:"POST",body:JSON.stringify({message:msg})});
    $("supportMsg").textContent=r.ok?"Сообщение отправлено Owner":"Не удалось отправить сообщение";
  };
}

function settingsScreen(){
  setScreen("Настройки",center("⚙️ Настройки","Язык и часовой пояс.",
    '<div class="settings-card"><label>Язык</label><select id="languageSelect"><option value="ru">Русский</option><option value="en">English</option></select><label>Часовой пояс</label><select id="timezoneSelect"><option value="Europe/Berlin">Europe/Berlin</option><option value="Europe/Moscow">Europe/Moscow</option><option value="Asia/Dushanbe">Asia/Dushanbe</option><option value="UTC">UTC</option></select><button class="primary-btn" id="saveSettingsBtn">Сохранить</button><div id="settingsMsg" class="signal-state"></div></div>'));
  const tz=localStorage.getItem("luckyjet_timezone"),lg=localStorage.getItem("luckyjet_language");
  if(tz)$("timezoneSelect").value=tz;if(lg)$("languageSelect").value=lg;
  $("saveSettingsBtn").onclick=()=>{localStorage.setItem("luckyjet_timezone",$("timezoneSelect").value);localStorage.setItem("luckyjet_language",$("languageSelect").value);$("settingsMsg").textContent="Настройки сохранены"};
}

function moreScreen(){
  const items=role==="owner"?moreOwner:moreUser;
  setScreen("Разделы",center("☰ Разделы","Каждый пункт открывает отдельный экран.",
    '<div class="round-section-list">'+items.map(x=>'<button class="section-choice" data-choice="'+x[3]+'"><span>'+x[0]+'</span><div><b>'+x[1]+'</b><small>'+x[2]+'</small></div><em>›</em></button>').join("")+'</div>'));
  $("screen").querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>navigate(b.dataset.choice));
}

async function adminScreen(type){
  if(type==="users"){
    setScreen("Пользователи",center("👥 Пользователи","Пользователи и их доступ.",
      '<div id="usersBody" class="data-stack"><div class="loading">Загрузка…</div></div>'));
    const r=await api("/api/users");
    const rows=(r.users||[]).map(u=>'<div class="user-admin-row"><div><b>'+escapeHtml((u.first_name||"Пользователь")+(u.username?" • @"+u.username:""))+'</b><small>Telegram ID: '+escapeHtml(u.telegram_id)+'<br>1win ID: '+escapeHtml(u.onewin_id||"—")+'</small></div><button data-uid="'+escapeHtml(u.telegram_id)+'" data-r="'+(!u.restricted)+'">'+(u.restricted?"Разрешить":"Ограничить")+'</button></div>').join("");
    $("usersBody").innerHTML='<div class="user-count">Всего: <b>'+Number(r.count||0)+'</b></div>'+(rows||'<div class="empty-state">Пользователей нет</div>');
    $("usersBody").querySelectorAll("[data-uid]").forEach(b=>b.onclick=async()=>{await api("/api/users/restrict",{method:"POST",body:JSON.stringify({telegram_id:b.dataset.uid,restricted:b.dataset.r==="true"})});adminScreen("users")});
    return;
  }
  if(type==="owner"){setScreen("Owner Panel",center("👑 Owner Panel","Служебная информация.",
    '<div class="owner-card">'+metric("РОЛЬ","OWNER","полный доступ")+metric("TELEGRAM",userId,"ID скрыт от пользователей")+metric("ТОРГОВЛЯ","OFF","операции отключены")+'</div>'));return}
  if(type==="access"){setScreen("Управление доступом",center("🔐 Управление доступом","Ограничения управляются в разделе Пользователи.",'<div class="admin-status">Telegram WebApp: <b>'+(tg?.initData?"OK":"НЕТ")+'</b><br>Доступ Owner: <b>ПОЛНЫЙ</b></div>'));return}
  if(type==="bot"){
    const r=await api("/api/bot/status");
    setScreen("Управление ботом",center("⚙️ Управление ботом","Пауза влияет только на режим работы Mini App.",
      '<div class="admin-status">Статус: <b>'+(r.paused?"ПРИОСТАНОВЛЕН":"РАБОТАЕТ")+'</b></div><button class="primary-btn" id="pauseBot">'+(r.paused?"▶️ Возобновить":"⏸️ Приостановить")+'</button><div id="botMsg" class="signal-state"></div>'));
    $("pauseBot").onclick=async()=>{const rr=await api("/api/bot/pause",{method:"POST",body:JSON.stringify({paused:!r.paused})});if(rr.ok)adminScreen("bot");else $("botMsg").textContent=rr.message||"Ошибка"};
    return;
  }
  if(type==="diag"){
    const r=await api("/api/bot/status");
    setScreen("Диагностика",center("🩺 Диагностика","Безопасная проверка без секретов.",'<div class="data-stack">'+
      '<div class="data-row"><span>Telegram WebApp</span><b>'+(tg?"OK":"НЕТ")+'</b></div><div class="data-row"><span>initData</span><b>'+(tg?.initData?"ПОЛУЧЕНА":"НЕТ")+'</b></div><div class="data-row"><span>Доступ</span><b>'+(hasAccess?"РАЗРЕШЁН":"ОГРАНИЧЕН")+'</b></div><div class="data-row"><span>Бот</span><b>'+(r.paused?"ПРИОСТАНОВЛЕН":"РАБОТАЕТ")+'</b></div></div>'));return;
  }
  if(type==="logs"){setScreen("Логи",center("📋 Логи","Безопасный статус без секретов.",'<div class="admin-status">Источник: <b>Render</b><br><br>Секреты и токены в Mini App не показываются.</div>'));return}
}

function gate(){
  document.body.classList.add("locked");
  $("roundNav").classList.add("hidden");
  setScreen("Доступ",'<div class="access-gate"><div class="gate-icon">🔐</div><span class="mini-label">LUCKY JET</span><h2>Доступ ограничен</h2><p class="muted">Сначала зарегистрируйтесь, затем укажите 1win ID в Профиле.</p><a class="primary-btn" href="'+escapeHtml(REGISTER_URL)+'" target="_blank" rel="noopener">📝 РЕГИСТРАЦИЯ</a><button class="secondary-btn" id="registeredBtn">Я уже зарегистрирован</button></div>');
  $("registeredBtn").onclick=profileScreen;
}

function navigate(section){
  if(section==="more"){currentSection="more";moreScreen();renderNav();return}
  if(section==="home"){currentSection="home";homeScreen()}
  else if(section==="signals"){currentSection="signals";signalScreen()}
  else if(section==="history"){currentSection="history";historyScreen()}
  else if(section==="profile"){currentSection="profile";profileScreen()}
  else if(section==="support"){currentSection="support";supportScreen()}
  else if(section==="settings"){currentSection="settings";settingsScreen()}
  else if(["analytics","users","access","bot","diag","logs","owner"].includes(section)){
    if(role!=="owner")return;
    currentSection=section;
    if(section==="analytics")setScreen("Аналитика",center("📊 Аналитика","Статистика системы.",'<div class="metrics-grid">'+metric("СИСТЕМА","ONLINE","Mini App")+metric("СИГНАЛЫ","—","нет неподтверждённых данных")+metric("РЕЖИМ","READ-ONLY","активен")+'</div>'));
    else adminScreen(section);
  }
  renderNav();
}

async function init(){
  const c=await api("/api/config");REGISTER_URL=c.registrationUrl||"#";
  const r=await api("/api/access");
  if(!r.ok){if(userId&&OWNER_IDS.has(userId)){role="owner";hasAccess=true;registered=true;renderNav();homeScreen();return}gate();return}
  role=userId&&OWNER_IDS.has(userId)?"owner":r.role;
  hasAccess=role==="owner"?true:r.access;registered=role==="owner"?true:r.registered;restricted=role==="owner"?false:r.restricted;onewinId=r.onewin_id||"";
  if(role==="owner"||hasAccess){renderNav();homeScreen()}else gate();
}
init();