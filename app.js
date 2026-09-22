const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const OWNER_IDS=new Set(["38263727","5158203829"]);
const $=id=>document.getElementById(id);
const user=tg?.initDataUnsafe?.user||null;
const userId=String(user?.id||"");

async function requestBridgeToken(){
  const btn=document.getElementById("getBridgeToken");
  const box=document.getElementById("bridgeTokenBox");
  const msg=document.getElementById("luckyJetDiagMsg");
  if(!btn||!box||btn.dataset.busy==="1")return;
  btn.dataset.busy="1";
  btn.disabled=true;
  box.textContent="Получаем временный токен…";
  if(msg)msg.textContent="⏳ Запрос отправляется на Render…";
  try{
    const tr=await api("/api/luckyjet-bridge-token");
    if(tr?.ok&&tr?.token){
      box.textContent=tr.token;
      if(msg)msg.textContent="✅ Временный токен получен. Не отправляйте его в чат.";
    }else{
      box.textContent=tr?.message||tr?.error||"Сервер не вернул токен";
      if(msg)msg.textContent="❌ Сервер отклонил запрос: "+(tr?.message||tr?.error||"неизвестная ошибка");
    }
  }catch(e){
    box.textContent="Ошибка запроса: "+String(e?.message||e);
    if(msg)msg.textContent="❌ Ошибка соединения с Render.";
  }finally{
    btn.dataset.busy="0";
    btn.disabled=false;
  }
}
window.requestBridgeToken=requestBridgeToken;

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
  ["🚀","Сигналы","signals"],["◉","Профиль","profile"]
];
const ownerNav=[
  ["📊","Аналитика","analytics"],["🚀","Сигналы","signals"],
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
    return '<button class="nav-item '+(active?"active":"")+'" data-nav="'+x[2]+'"><span>'+x[0]+'</span><small>'+x[1]+'</small></button>';
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
  setScreen("Сигналы",'<div class="screen-page"><div class="screen-title"><span class="mini-label">LUCKY JET</span><h2>Сигналы</h2><p class="muted">Доступ открывается после регистрации и сохранения 1win ID.</p></div><div class="signal-panel"><div class="signal-card"><div class="signal-kicker">ПРОВЕРИТЬ КОЭФФИЦИЕНТ</div><button class="signal-main-btn" id="getSignal" aria-label="Получить коэффициент"><span class="rocket" id="signalRocket">🚀</span><span class="signal-coefficient" id="signalCoefficient">— —</span></button><div id="signalState" class="signal-state"></div></div></div></div>');
  const b=$("getSignal"),coefficient=$("signalCoefficient"),rocket=$("signalRocket"),state=$("signalState");
  const locked=role!=="owner"&&!(registered&&onewinId&&!restricted);
  if(locked){b.classList.add("disabled");state.textContent=restricted?"Доступ ограничен владельцем":"Сначала зарегистрируйтесь и сохраните 1win ID в Профиле.";}
  b.onclick=async()=>{
    if(locked)return;
    b.disabled=true;coefficient.textContent="…";rocket.textContent="🚀";state.textContent="";
    const r=await api("/api/signal");
    if(r.ok&&r.signal){coefficient.textContent=String(r.signal.multiplier)+"x";state.textContent=r.source==="parse_luckyjet_read_only"?"Источник: подтверждённая история Lucky Jet (read-only).":r.source==="official_browser_bridge_read_only"?"Источник: официальный браузерный поток (read-only).":"Источник: "+String(r.source||"read-only");}else{coefficient.textContent="— —";state.textContent=r?.message||"Свежего подтверждённого коэффициента нет.";}

    b.disabled=false;
  };
}

async function historyScreen(){
  setScreen("История",center("📜 История","Здесь находятся только подтверждённые результаты.","<div id='historyBody' class='data-stack'><div class='loading'>Проверяем данные…</div></div>"));
  const r=await api("/api/history");
  $("historyBody").innerHTML=r.ok&&r.history?.length?((r.source_confirmed?'<div class="metrics-note"><b>Источник подтверждён</b><p class="muted">'+escapeHtml(r.source||"read-only")+'</p></div>':"")+r.history.map(x=>'<div class="data-row"><span>'+escapeHtml(x.time||"Последний подтверждённый раунд")+'</span><b>'+escapeHtml(x.multiplier)+'x</b></div>').join("")):'<div class="empty-state">НЕТ ПОДТВЕРЖДЁННЫХ ДАННЫХ</div>';
}

function homeScreen(){
  const owner=role==="owner";
  setScreen("Главная",'<div class="screen-page"><div class="screen-title"><span class="mini-label">LUCKY JET</span><h2>Главная</h2><p class="muted">Центр Lucky Jet Mini App.</p></div><div class="home-card"><div class="home-hero"><div class="home-orb">🚀</div><h3 class="hero-title">'+(owner?"Управление Lucky Jet":"Lucky Jet")+'</h3><p class="muted">'+(owner?"Административные функции находятся в разделах Owner.":"Перейдите в «Сигналы», чтобы проверить источник данных.")+'</p></div><div class="home-status"><span>СТАТУС СИСТЕМЫ</span><b>ONLINE</b></div></div></div>');
}

function profileScreen(){
  setScreen("Профиль",center("👤 Профиль","Укажите 1win ID после регистрации.",
    '<div class="profile-card"><label>1win ID</label><input id="onewinInput" inputmode="numeric" placeholder="Введите 1win ID" value="'+escapeHtml(onewinId)+'"><small>Этот ID нужен для открытия доступа к Сигналам.</small><button class="primary-btn" id="saveOneWin">Сохранить 1win ID</button><button class="secondary-btn" id="writeOwner">💬 Написать владельцу</button><div id="profileMsg" class="signal-state"></div></div>'));
  $("saveOneWin").onclick=async()=>{
    const v=$("onewinInput").value.trim();
    if(!v){$("profileMsg").textContent="Введите 1win ID";return}
    const r=await api("/api/profile",{method:"POST",body:JSON.stringify({onewin_id:v})});
    if(!r.ok){$("profileMsg").textContent=r.message||"Ошибка";return}
    registered=!!r.registered;onewinId=r.onewin_id||v;hasAccess=!!r.access;restricted=!!r.restricted;
    $("profileMsg").textContent=r.message||(hasAccess?"Доступ к Сигналам открыт":"Регистрация ещё не подтверждена");
    renderNav();
    if(hasAccess){currentSection="signals";signalScreen();renderNav();}else{currentSection="signals";gate();}
  };
  $("writeOwner").onclick=()=>supportScreen();
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
    const [status,sourceStatus]=await Promise.all([api("/api/luckyjet-browser-status"),api("/api/luckyjet-source-status")]);
    const bs=status?.state||null;
    const ps=sourceStatus?.parse||null;
    const tgOk=!!tg?.initData;
    const official=bs?.state==="connect"||bs?.state==="connect_error"||bs?.state==="disconnect";
    const live=Boolean(status?.connected);
    const browser=live?"ДОСТУПНА":bs?.state==="connect_error"?"НЕТ — ошибка":"НЕТ ДАННЫХ";
    const socket=live?"УСТАНОВЛЕН":bs?.state==="connect_error"?"ОТКЛОНЁН":"НЕТ ДАННЫХ";
    const event=status?.has_event?"ПОЛУЧЕНО":"НЕТ";
    const coeff=status?.has_event&&typeof status.latest_coefficient==="number"?String(status.latest_coefficient)+"x":"НЕТ";
    setScreen("Диагностика",center("🩺 Диагностика","Пошаговая read-only проверка реального источника Lucky Jet.",
      '<div class="data-stack diag-stack" id="luckyJetStages">'+
      '<button class="data-row diag-row" data-diag="telegram"><span>1. Telegram WebApp</span><b>'+ (tgOk?"OK":"НЕТ") +'</b><em>›</em></button>'+
      '<button class="data-row diag-row" data-diag="official"><span>2. Официальная страница</span><b>'+ (official?"ПРОВЕРЕНА":"НЕТ ДАННЫХ") +'</b><em>›</em></button>'+
      '<button class="data-row diag-row" data-diag="browser"><span>3. Браузерная сессия</span><b>'+browser+'</b><em>›</em></button>'+
      '<button class="data-row diag-row" data-diag="socket"><span>4. Socket.IO transport</span><b>'+socket+'</b><em>›</em></button>'+
      '<button class="data-row diag-row" data-diag="event"><span>5. Реальное событие</span><b>'+event+'</b><em>›</em></button>'+
      '<button class="data-row diag-row" data-diag="coefficient"><span>6. Коэффициент</span><b>'+coeff+'</b><em>›</em></button><button class="data-row diag-row" data-diag="source"><span>7. Read-only источник</span><b>'+(ps?.ok?"ПОДТВЕРЖДЁН":"ОТКЛОНЁН")+'</b><em>›</em></button>'+
      '</div>'+
      '<div id="luckyJetDiagDetail" class="support-card diag-detail"><b>Нажмите на любой пункт</b><p class="muted">Здесь откроется подробная информация по выбранному этапу. Секреты, cookies и SSID не показываются.</p></div>'+
      '<button type="button" class="secondary-btn" id="getBridgeToken">🔑 Получить временный bridge-токен</button><div id="bridgeTokenBox" class="signal-state" style="word-break:break-all"></div><div id="luckyJetDiagMsg" class="signal-state">'+(status?.has_event?"✅ Реальное read-only событие получено.":ps?.ok?"✅ Read-only источник подтверждён; браузерное событие пока не получено.":"ℹ️ Подтверждённого реального события пока нет. Коэффициент не генерируется и не подставляется.")+'</div>'));
    const tokenBtn=$("getBridgeToken"); if(tokenBtn){ tokenBtn.onclick=requestBridgeToken; }
    const detail=$("luckyJetDiagDetail");
    const details={
      telegram:["Telegram WebApp",tgOk?"OK":"НЕТ",tgOk?"Telegram initData получены для служебной проверки.":"Mini App не получил Telegram initData."],
      official:["Официальная страница",official?"ПРОВЕРЕНА":"НЕТ ДАННЫХ",official?"Browser bridge сообщил состояние официального контекста.":"Mini App сам по себе не является официальным контекстом 1wmljx.life."],
      browser:["Браузерная сессия",browser,bs?.message?String(bs.message):"Состояние browser bridge пока не подтверждено."],
      socket:["Socket.IO transport",socket,live?"Socket.IO сообщил актуальное соединение за последние 30 секунд.":bs?.message||"Актуальное соединение с transport не подтверждено."],
      event:["Реальное событие",event,status?.has_event?"Получено подтверждённое событие browser bridge.":"Свежего подтверждённого события нет."],
      coefficient:["Коэффициент",coeff,status?.has_event?"Значение получено из реального события и не генерировалось.":"Значение отсутствует; подстановка запрещена."],
      source:["Read-only источник",ps?.ok?String(ps.source||"ПОДТВЕРЖДЁН"):"НЕ ПОДТВЕРЖДЁН",ps?.ok?"Последняя проверка Parse успешно вернула реальные раунды.":"Последняя проверка Parse не дала подтверждённых раундов: "+((ps?.failures||[]).map(x=>x.source+" — "+x.error).join("; ")||ps?.error||"нет данных")]
    };
    $("screen").querySelectorAll("[data-diag]").forEach(btn=>btn.onclick=()=>{
      const d=details[btn.dataset.diag];
      detail.innerHTML="<b>"+escapeHtml(d[0])+"</b><p class='diag-value'>"+escapeHtml(d[1])+"</p><p class='muted'>"+escapeHtml(d[2])+"</p>";
    });
    return;
  }
  if(type==="logs"){setScreen("Логи",center("📋 Логи","Безопасный статус без секретов.",'<div class="admin-status">Источник: <b>Render</b><br><br>Секреты и токены в Mini App не показываются.</div>'));return}
}

function getRegistrationUrl(){
  const base=REGISTER_URL||"#";
  if(!userId)return base;
  try{
    const u=new URL(base,window.location.origin);
    u.searchParams.set("sub1","tg_"+userId);
    return u.toString();
  }catch{return base;}
}

function gate(){
  document.body.classList.remove("locked");
  $("roundNav").classList.remove("hidden");
  currentSection="signals";
  setScreen("Сигналы",'<div class="screen-page"><div class="screen-title"><span class="mini-label">LUCKY JET</span><h2>Регистрация</h2><p class="muted">Зарегистрируйтесь по ссылке, затем вернитесь сюда и добавьте 1win ID в Профиле.</p></div><div class="profile-card"><a class="primary-btn" href="'+escapeHtml(getRegistrationUrl())+'" target="_blank" rel="noopener">📝 РЕГИСТРАЦИЯ</a><button class="secondary-btn" id="openProfile">👤 Открыть Профиль</button></div></div>');
  renderNav();
  $("openProfile").onclick=()=>{currentSection="profile";profileScreen();renderNav();};
}

function navigate(section){
  if(section==="more"){currentSection="more";moreScreen();renderNav();return}
  if(section==="home"){currentSection="analytics";setScreen("Аналитика",center("📊 Аналитика","Статистика системы.",'<div class="metrics-grid">'+metric("СИСТЕМА","ONLINE","Mini App")+metric("ИСТОЧНИК","НЕТ","реальное событие не получено")+metric("РЕЖИМ","READ-ONLY","без ставок и генерации")+'</div><div class="metrics-note"><b>Источник данных</b><p class="muted">Состояние реального read-only источника смотрите в разделе «Диагностика».</p></div>'))}
  else if(section==="signals"){currentSection="signals";signalScreen()}
  else if(section==="profile"){currentSection="profile";profileScreen()}
  else if(section==="support"){currentSection="support";supportScreen()}
  else if(section==="settings"){if(role==="owner"){currentSection="settings";settingsScreen()}}
  else if(["analytics","users","access","bot","diag","logs","owner"].includes(section)){
    if(role!=="owner")return;
    currentSection=section;
    if(section==="analytics")setScreen("Аналитика",center("📊 Аналитика","Статистика системы.",'<div class="metrics-grid">'+metric("СИСТЕМА","ONLINE","Mini App")+metric("ИСТОЧНИК","НЕТ","реальное событие не получено")+metric("РЕЖИМ","READ-ONLY","без ставок и генерации")+'</div><div class="metrics-note"><b>Источник данных</b><p class="muted">Состояние реального read-only источника смотрите в разделе «Диагностика».</p></div>'));
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
  if(role==="owner"){
    document.body.classList.remove("locked");
    $("roundNav").classList.remove("hidden");
    renderNav();
    currentSection="analytics";
    setScreen("Аналитика",center("📊 Аналитика","Статистика системы.",'<div class="metrics-grid">'+metric("СИСТЕМА","ONLINE","Mini App")+metric("ИСТОЧНИК","НЕТ","реальное событие не получено")+metric("РЕЖИМ","READ-ONLY","без ставок и генерации")+'</div><div class="metrics-note"><b>Источник данных</b><p class="muted">Состояние реального read-only источника смотрите в разделе «Диагностика».</p></div>'));
    renderNav();
  }else{
    registered=!!r.registered;hasAccess=!!r.access;restricted=!!r.restricted;onewinId=r.onewin_id||"";
    document.body.classList.remove("locked");
    $("roundNav").classList.remove("hidden");
    renderNav();
    if(hasAccess)signalScreen();else gate();
  }
}
init();