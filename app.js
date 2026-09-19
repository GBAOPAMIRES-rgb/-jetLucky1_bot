const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}
const OWNER_IDS=new Set(["38263727","5158203829"]);
const $=id=>document.getElementById(id);
const panel=$("panel"),ownerPanel=$("ownerPanel"),btn=$("signalBtn"),state=$("signalState"),mult=$("multiplier");
const user=tg?.initDataUnsafe?.user||null,userId=String(user?.id||"");
let role=userId&&OWNER_IDS.has(userId)?"owner":"user";
let hasAccess=true;
let registered=false;
let restricted=false;
let onewinId="";

async function api(endpoint, options={}){
  const initData=tg?.initData||"";
  const opts={...options,headers:{...(options.headers||{}),"Content-Type":"application/json","X-Telegram-Init-Data":initData}};
  let url=endpoint;
  if(endpoint==="/api/access"){
    url=endpoint+"?init_data="+encodeURIComponent(initData);
  }
  try{
    const response=await fetch(url,opts);
    const data=await response.json().catch(()=>({ok:false,error:"invalid_server_response"}));
    if(!response.ok && data.ok!==false)data.ok=false;
    return data;
  }catch(e){
    return {ok:false,error:"network_error",message:"Не удалось связаться с сервером"};
  }
}

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
 '<button data-admin="logs">📋 Логи</button></div>';
 ownerPanel.classList.add("hidden");
 ownerPanel.querySelectorAll("[data-admin]").forEach(b=>b.onclick=()=>adminPanel(b.dataset.admin));
}
function adminPanel(type){
 if(type==="users"){adminUsers();return;}
 if(type==="access"){showPanel("Управление доступом",shell("Управление доступом","Управление регистрацией и ограничениями пользователей.",'<div class="row"><span>Telegram</span><b>'+(tg?.initData?"OK":"НЕТ")+'</b></div><div class="row"><span>Telegram ID</span><b>'+userId+'</b></div><p class="muted">Ограничение пользователей выполняется через раздел «Пользователи».</p>'));return;}
 if(type==="bot"){api("/api/bot/status").then(r=>{showPanel("Управление ботом",shell("Управление ботом","Административные настройки. Торговые операции отключены.",'<div class="row"><span>Режим</span><b>READ-ONLY</b></div><div class="row"><span>Статус</span><b>'+(r.paused?"ПРИОСТАНОВЛЕН":"РАБОТАЕТ")+'</b></div><button class="primary-btn" id="pauseBotBtn">'+(r.paused?"▶️ Возобновить бот":"⏸️ Приостановить бот")+'</button><div id="botMsg" class="signal-state"></div>'));$("pauseBotBtn").onclick=async()=>{const rr=await api("/api/bot/pause",{method:"POST",body:JSON.stringify({paused:!r.paused})});if(rr.ok)adminPanel("bot");else $("botMsg").textContent=rr.message||rr.error||"Ошибка";};});return;}
 if(type==="diag"){api("/api/bot/status").then(r=>showPanel("Диагностика",shell("Диагностика","Безопасная проверка состояния Mini App.",'<div class="row"><span>Telegram WebApp</span><b>'+(tg?"OK":"НЕТ")+'</b></div><div class="row"><span>initData</span><b>'+(tg?.initData?"ПОЛУЧЕНА":"НЕТ")+'</b></div><div class="row"><span>Telegram ID</span><b>'+userId+'</b></div><div class="row"><span>Доступ</span><b>'+(hasAccess?"РАЗРЕШЁН":"ОГРАНИЧЕН")+'</b></div><div class="row"><span>Бот</span><b>'+(r.paused?"ПРИОСТАНОВЛЕН":"РАБОТАЕТ")+'</b></div>')));return;}
 if(type==="logs"){showPanel("Логи",shell("Логи","Безопасный статус без секретов.",'<div class="row"><span>Источник</span><b>Render</b></div><p class="muted">Подробные серверные логи доступны Owner в Render. Секреты и токены здесь не показываются.</p>'));return;}
}
function gate(){document.body.classList.add("locked");const ownerHint=userId&&OWNER_IDS.has(userId)?"OWNER ID РАСПОЗНАН":"OWNER ID НЕ РАСПОЗНАН";$("appContent").innerHTML=`<section class="access-gate"><div class="gate-icon">🔐</div><span class="mini-label">LUCKY JET</span><h2>Доступ ограничен</h2><p class="muted">Сначала зарегистрируйтесь. После регистрации откройте Профиль и укажите свой 1win ID.</p><div class="row"><span>Telegram WebApp</span><b>${tg?"OK":"НЕТ"}</b></div><div class="row"><span>Telegram ID</span><b>${userId||"НЕ ОПРЕДЕЛЁН"}</b></div><div class="row"><span>Проверка Owner</span><b>${ownerHint}</b></div><a class="primary-btn" href="${window.REGISTER_URL}" target="_blank" rel="noopener">📝 РЕГИСТРАЦИЯ</a><button class="secondary-btn" id="registeredBtn">Я уже зарегистрирован</button></section>`;$("registeredBtn").onclick=profileForm;}
function profileForm(){showPanel("Профиль",`<div class="row"><span>Telegram</span><b>${user?.username?"@"+user.username:(user?.first_name||"Пользователь")}</b></div><div class="row"><span>Telegram ID</span><b>${userId}</b></div><div class="profile-input"><label>Ваш 1win ID</label><input id="onewinInput" inputmode="numeric" placeholder="Введите 1win ID" value="${onewinId}"><small>Укажите ID из приложения 1win после регистрации.</small></div><button class="primary-btn" id="saveOneWin">Сохранить 1win ID и получить доступ</button><div id="profileMsg" class="signal-state"></div>`);$("saveOneWin").onclick=async()=>{const v=$("onewinInput").value.trim(),r=await api("/api/profile",{method:"POST",body:JSON.stringify({onewin_id:v})});if(!r.ok){$("profileMsg").textContent=r.message||"Ошибка";return}registered=true;onewinId=r.onewin_id;hasAccess=!r.restricted;panel.classList.add("hidden");renderRoleUI()}}
function adminUsers(){api("/api/users").then(r=>{const rows=(r.users||[]).map(u=>`<div class="user-admin-row"><div><b>${u.first_name||"Пользователь"} ${u.username?"• @"+u.username:""}</b><small>Telegram ID: ${u.telegram_id}<br>1win ID: ${u.onewin_id||"—"} • ${u.registered?"Зарегистрирован":"Не зарегистрирован"}</small></div><button data-uid="${u.telegram_id}" data-r="${!u.restricted}">${u.restricted?"Снять ограничение":"Ограничить"}</button></div>`).join("")||"<p class=\"muted\">Пока пользователей нет.</p>";showPanel("Пользователи",`<div class="user-count">Всего: <b>${r.count||0}</b></div>${rows}`);panel.querySelectorAll("[data-uid]").forEach(b=>b.onclick=async()=>{await api("/api/users/restrict",{method:"POST",body:JSON.stringify({telegram_id:b.dataset.uid,restricted:b.dataset.r==="true"})});adminUsers()})})}
function renderRoleUI(){
 document.body.classList.toggle("owner-mode",role==="owner");$("roleBadge").textContent=role==="owner"?"OWNER":"USER";$("roleBadge").classList.toggle("owner",role==="owner");$("pageTitle").textContent="Главная";$("modeLabel").textContent=role==="owner"?"OWNER • ПОЛНЫЙ ДОСТУП":"LUCKY JET";$("welcomeTitle").innerHTML=role==="owner"?"Ваш центр<br><strong>Управление Lucky Jet</strong>":"Ваш центр<br><strong>Lucky Jet</strong>";$("sectionHint").textContent=role==="owner"?"Все функции Owner":"Доступные функции";if(role==="owner"){api("/api/users").then(r=>{if(r.ok){const card=$("userCountCard");if(card)card.querySelector("b").textContent=String(r.count||0)}})}
 const grid=$("sectionGrid");const items=role==="owner"?[
 ["🏠","Главная","Центр управления","home",1],["🚀","Сигналы","Аналитический центр","signals",1],["📊","Аналитика","Статистика","analytics",0],["📜","История","Ваши данные","history",0],["👥","Пользователи","Все зарегистрированные","users",0],["🔐","Управление доступом","Ограничения","access",0],["⚙️","Управление ботом","Пауза и режим","bot",0],["🩺","Диагностика","Проверка системы","diag",0],["📋","Логи","Статус событий","logs",0],["👑","Owner Panel","Полный контроль","owner",1],["◉","Профиль","Аккаунт Owner","profile",0],["💬","Поддержка","Связь с Owner","support",0],["⚙","Настройки","Язык и часовой пояс","settings",0]
 ]:[
 ["🏠","Главная","Центр Lucky Jet","home",1],["🚀","Сигналы","Получение сигнала","signals",1],["📜","История","Ваши результаты","history",0],["◉","Профиль","1win ID и аккаунт","profile",0],["💬","Поддержка","Помощь и связь","support",0],["⚙","Настройки","Язык и часовой пояс","settings",0]];
 grid.innerHTML=items.map(x=>card(...x)).join("");
 $("quickActions").innerHTML="";
 $("bottomNav").innerHTML=role==="owner"?nav("⌂","Главная","home")+nav("🚀","Сигналы","signals")+nav("📊","Аналитика","analytics")+nav("👥","Пользователи","users")+nav("☰","Ещё","owner"):nav("⌂","Главная","home")+nav("🚀","Сигналы","signals")+nav("📜","История","history")+nav("◉","Профиль","profile")+nav("💬","Поддержка","support");
 bindSections();renderOwnerPanel();
}
function bindSections(){
 document.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>{
  const s=b.dataset.section;
  if(s==="home"){panel.classList.add("hidden");ownerPanel.classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"});return;}
  if(s==="signals"){showPanel("Сигналы",shell("Сигналы","Единственное место получения сигнала.",'<div class="signal-result"><span id="sectionSignalState">ГОТОВ</span><small id="sectionSignalSub">Запрос будет выполнен только к подтверждённому источнику данных.</small></div><button class="signal-circle-btn" style="margin-top:18px" id="sectionSignalBtn"><span class="signal-circle-icon">🚀</span><b>ПОЛУЧИТЬ<br>СИГНАЛ</b></button>'));$("sectionSignalBtn").onclick=async()=>{const b=$("sectionSignalBtn");b.disabled=true;const r=await api("/api/signal");$("sectionSignalState").textContent=r.ok&&r.signal?"СИГНАЛ":"ОЖИДАНИЕ";$("sectionSignalSub").textContent=r.ok&&r.signal?("Коэффициент: "+r.signal.multiplier+"x"):"Источник данных не подтверждён";b.disabled=false};return;}
  if(s==="history"){api("/api/history").then(r=>showPanel("История",shell("История","Только подтверждённые данные.",r.ok&&r.history?.length?r.history.map(x=>'<div class="row"><span>'+x.time+'</span><b>'+x.multiplier+'x</b></div>').join(""):'<div class="row"><span>Подтверждённые результаты</span><b>НЕТ ДАННЫХ</b></div><p class="muted">История не заполняется вымышленными результатами. Она появится только после подтверждения источника данных.</p>')));return;}
  if(s==="analytics"){showPanel("Аналитика",shell("Аналитика","Статистика без автоматических ставок.",'<div class="metrics-grid">'+metric("СИСТЕМА","ONLINE","Mini App")+metric("СИГНАЛЫ","—","нет подтверждённых данных")+metric("РЕЖИМ","READ-ONLY","активен")+'</div>'));return;}

  if(s==="users"){if(role==="owner")adminUsers();return;}
  if(["access","bot","diag","logs"].includes(s)){if(role!=="owner")return;adminPanel(s);return;}
  if(s==="owner"){
  if(role!=="owner")return;
  ownerPanel.classList.remove("hidden");
  ownerPanel.scrollIntoView({behavior:"smooth",block:"start"});
  return;
}
  if(s==="profile")profileForm();
  if(s==="support"){showPanel("Поддержка",shell("Поддержка","Помощь по регистрации и работе Mini App.",'<p class="muted">Не отправляйте пароли, токены или другие секреты.</p><textarea id="supportText" class="support-text" maxlength="1000" placeholder="Опишите вопрос"></textarea><button class="primary-btn" id="sendSupport">💬 Написать Owner</button><div id="supportMsg" class="signal-state"></div>'));$("sendSupport").onclick=async()=>{const msg=$("supportText").value.trim();if(!msg){$("supportMsg").textContent="Введите сообщение";return}const r=await api("/api/support/message",{method:"POST",body:JSON.stringify({message:msg})});$("supportMsg").textContent=r.ok?"Сообщение отправлено Owner":"Не удалось отправить сообщение";};}
  if(s==="settings")showPanel("Настройки",shell("Настройки","Язык и часовой пояс.",'<div class="profile-input"><label>Язык</label><select id="languageSelect"><option value="ru">Русский</option><option value="en">English</option></select></div><div class="profile-input"><label>Часовой пояс</label><select id="timezoneSelect"><option value="Europe/Berlin">Europe/Berlin</option><option value="Europe/Moscow">Europe/Moscow</option><option value="Asia/Dushanbe">Asia/Dushanbe</option><option value="UTC">UTC</option></select><small>Время в истории и системных событиях будет отображаться по выбранному поясу.</small></div><div class="row"><span>Режим</span><b>Read-only</b></div><button class="primary-btn" id="saveSettingsBtn">Сохранить настройки</button><div id="settingsMsg" class="signal-state"></div>'));$("saveSettingsBtn").onclick=()=>{localStorage.setItem("luckyjet_timezone",$("timezoneSelect").value);localStorage.setItem("luckyjet_language",$("languageSelect").value);$("settingsMsg").textContent="Настройки сохранены"};const tz=localStorage.getItem("luckyjet_timezone");const lg=localStorage.getItem("luckyjet_language");if(tz)$("timezoneSelect").value=tz;if(lg)$("languageSelect").value=lg;
 });
}
async function requestSignal(target){
 const button=target||btn;if(button)button.disabled=true;
 const result=await api("/api/signal");
 if(result.ok&&result.signal){if(mult)mult.textContent=result.signal.multiplier+"x";if(state)state.textContent="Сигнал получен";if($("mainStatus"))$("mainStatus").textContent="СИГНАЛ";if($("mainStatusSub"))$("mainStatusSub").textContent="Подтверждённый источник данных";}
 else {if(mult)mult.textContent="—";if(state)state.textContent="Нет подтверждённых данных для реального сигнала.";if($("mainStatus"))$("mainStatus").textContent="ОЖИДАНИЕ";if($("mainStatusSub"))$("mainStatusSub").textContent="Источник данных не подтверждён";}
 if(button)button.disabled=false;
}
if(btn)btn.onclick=()=>requestSignal(btn);
async function init(){const c=await api("/api/config");window.REGISTER_URL=c.registrationUrl;const r=await api("/api/access");if(!r.ok){if(userId&&OWNER_IDS.has(userId)){role="owner";hasAccess=true;registered=true;restricted=false;renderRoleUI();return}gate();return}if(userId&&OWNER_IDS.has(userId)){role="owner";hasAccess=true;registered=true;restricted=false;onewinId=r.onewin_id||"";renderRoleUI();return}role=r.role;hasAccess=r.access;registered=r.registered;restricted=r.restricted;onewinId=r.onewin_id||"";if(role==="owner"||hasAccess){renderRoleUI()}else gate()}
init();