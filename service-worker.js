/* v5.4.0.0: двойная среда. Тестовый адрес (localhost / IP / порт / путь test-cartoteka) → test_config.json и свой кэш;
   боевой домен → config.json. Префикс кэша разный, чтобы два сайта на одном github.io не стирали кэши друг друга. */
const ENV_QS=(()=>{try{return new URL(self.location.href).searchParams.get('env')}catch(e){return null}})();
/* v1.0.0.6: контур может прийти из страницы (?env=prod|test) — так локальный сервер открывает боевой config.json на localhost */
const ENV_TEST=ENV_QS?ENV_QS==='test':(()=>{try{const h=String(self.location.hostname||''),p=String(self.location.pathname||'');return /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(h)||/\.local$/.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||!!self.location.port||/test-cartoteka/.test(h+p)}catch(e){return false}})();
const CONFIG_FILE=ENV_TEST?'test_config.json':'config.json';
const CACHE_PREFIX=ENV_TEST?'test-cartoteka-':'cartoteka-';
const CACHE=CACHE_PREFIX+'v1.0.0.6';
const CORE=['./','./index.html','./style.css','./validator.js','./script.js','./qr.js','./'+CONFIG_FILE,'./languages.json','./kazakhstan_geo.json','./categories.json','./id_aliases.json','./name_synonyms.json','./manifest.webmanifest','./icon.png','./icon-192.png','./icon-512.png','./header_folder_bg.jpg','./reklama.txt'];
/* v5.0.1.0: стратегия Network First применена ко ВСЕМ конфигурационным шлюзам —
   config.json, kazakhstan_geo.json и текстовым базам жителей сёл.
   v5.2.0.1: тот же режим распространён на новые суверенные файлы
   categories.json (каталог категорий 9×9) и name_synonyms.json (словарь
   синонимов имён) — это тоже структурные данные, а не статика кузова. */
const isDbOrConfig=u=>u.origin===location.origin&&(u.pathname.endsWith('/'+CONFIG_FILE)||u.pathname.endsWith('/kazakhstan_geo.json')||u.pathname.endsWith('/categories.json')||u.pathname.endsWith('/id_aliases.json')||u.pathname.endsWith('/name_synonyms.json')||/\/baza_[^/]+\.txt$/.test(u.pathname));
async function putFresh(cache,request,response){try{if(response&&response.ok)await cache.put(request,response.clone())}catch(e){}}
/* v5.4.0.0: ленивая загрузка — при установке в кэш кладётся только база села по умолчанию
   (первая в config.json). Остальные базы попадают в кэш сами, когда житель впервые выбирает село
   (Network First в обработчике fetch ниже), и потом открываются офлайн. */
async function dbFilesFromConfig(){
  try{
    const r=await fetch('./'+CONFIG_FILE,{cache:'no-store'});
    if(!r.ok)return[];
    const cfg=await r.json();
    const v=Array.isArray(cfg.villages)&&cfg.villages[0];
    if(v&&v.path)return['./'+v.path];
    const list=Array.isArray(cfg.files)?cfg.files:[];
    return list.slice(0,1).map(f=>'./'+f);
  }catch(e){return[]}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  const dbFiles=await dbFilesFromConfig();
  const all=[...CORE,...dbFiles];
  await Promise.all(all.map(async u=>{try{const r=await fetch(u,{cache:'no-store'});if(r.ok)await c.put(u,r.clone())}catch(e){}}));
  /* v5.3.0.5: skipWaiting() здесь больше НЕ вызывается — новая версия ждёт решения
     человека (окно обновления в script.js присылает SKIP_WAITING). Если на телефоне
     ещё не открыт ни один экземпляр приложения, воркер активируется сам. */
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();
  /* v5.2.0.0 (п.4 наряда): регистрация Periodic Background Sync — ЧЕСТНО
     ОГОВОРЕНО: это экспериментальный Chromium/Android API, требующий
     установленного PWA и «движка вовлечённости» браузера; не гарантирует
     точный интервал и не работает в iOS Safari/обычной вкладке. Если
     API недоступен — тихий no-op, никакой ошибки/белого экрана. */
  try{
    if('periodicSync' in self.registration){
      await self.registration.periodicSync.register('cartoteka-queue-radar',{minInterval:30*60*1000});
    }
  }catch(e){}
})()));
/* v5.2.0.0: Service Worker физически НЕ МОЖЕТ читать localStorage —
   токен администратора и служебные параметры репозитория передаются сюда
   ТОЛЬКО через postMessage со страницы (см. relayAdminTokenToSw в script.js)
   и хранятся в памяти воркера. Если воркер перезапускается браузером между
   сеансами — память теряется (честно оговорено в АРХИТЕКТУРНЫЙ ПРОЕКТ.txt);
   при каждом активном открытии приложения script.js сам переотправляет
   персистентно сохранённый (по явному действию администратора) токен. */
let ADMIN={token:'',owner:'',repo:'',requestsPath:'requests.txt',files:[],lang:'ru'};
self.addEventListener('message',event=>{
  const msg=event.data||{};
  if(msg.type==='SKIP_WAITING'){event.waitUntil(self.skipWaiting());return}
  if(msg.type==='ADMIN_TOKEN'){
    ADMIN={token:msg.token||'',owner:msg.owner||ADMIN.owner,repo:msg.repo||ADMIN.repo,requestsPath:msg.requestsPath||ADMIN.requestsPath,files:Array.isArray(msg.files)?msg.files:ADMIN.files,lang:msg.lang||ADMIN.lang};
  }
});
async function swT(key,vars){
  let dict={};
  try{const r=await caches.match('./languages.json')||await fetch('./languages.json',{cache:'no-store'});if(r&&r.ok)dict=await r.json()}catch(e){}
  let s=(dict[ADMIN.lang]&&dict[ADMIN.lang][key])||(dict.ru&&dict.ru[key])||key;
  if(vars)for(const k in vars)s=s.split('{'+k+'}').join(String(vars[k]));
  return s;
}
async function ghGet(path){
  if(!ADMIN.token||!ADMIN.owner||!ADMIN.repo)return null;
  try{
    const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(ADMIN.owner)}/${encodeURIComponent(ADMIN.repo)}/contents/${path}`,{headers:{Authorization:`Bearer ${ADMIN.token}`,Accept:'application/vnd.github+json'},cache:'no-store'});
    if(!r.ok)return null;
    const d=await r.json();
    const b64=(d.content||'').replace(/\n/g,'');
    const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch(e){return null}
}
/* v5.2.0.0 (п.4 наряда): ПРОПОРЦИОНАЛЬНЫЙ фоновый робот-радар — НЕ дублирует
   целиком клиентский validator.js, а проверяет 3 честно оговоренных,
   недорогих признака: (1) [снято в v5.3.0.1], (2) повторяющиеся абсолютные ID внутри одной и той же базы
   (дубликаты), (3) число строк с немодерированным маркером
   (NEW/ORIGINAL/EDIT/DELETE_* вместо $) как прокси срабатывания Карантина.
   Посетители сайта этих уведомлений не видят — радар работает только если
   в память воркера когда-либо был передан ADMIN_TOKEN администратора. */
async function checkQueueAndNotify(){
  if(!ADMIN.token||!ADMIN.owner||!ADMIN.repo)return;
  try{
    /* v5.3.0.1: счёт заявок по requests.txt удалён — заявки теперь живут в
       Google Таблице; радар проверяет только дубли ID и Карантин баз. */
    let dupeTotal=0,quarantineTotal=0;
    for(const file of ADMIN.files){
      const text=await ghGet(file);
      if(!text)continue;
      const ids=new Map(),rows=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>l.split(' | ')).filter(f=>f.length===20);
      for(const f of rows){const id=f[0];ids.set(id,(ids.get(id)||0)+1);if(f[19]!=='$')quarantineTotal++}
      for(const[,n] of ids)if(n>1)dupeTotal+=n-1;
    }
    if(dupeTotal>0)await self.registration.showNotification(await swT('notifDupeTitle'),{body:await swT('notifDupeBody',{count:dupeTotal}),icon:'./icon-192.png',badge:'./icon-192.png',tag:'cartoteka-dupe',data:{action:'OPEN_ADMIN'}});
    if(quarantineTotal>0)await self.registration.showNotification(await swT('notifQuarantineTitle'),{body:await swT('notifQuarantineBody',{count:quarantineTotal}),icon:'./icon-192.png',badge:'./icon-192.png',tag:'cartoteka-quarantine',data:{action:'OPEN_ADMIN'}});
  }catch(e){}
}
self.addEventListener('periodicsync',event=>{if(event.tag==='cartoteka-queue-radar')event.waitUntil(checkQueueAndNotify())});
/* v5.2.0.0: клик по системной плашке уведомления Андроида пулей открывает
   Админ-пульт — либо фокусируя уже открытую вкладку и посылая ей команду
   OPEN_ADMIN (script.js сам откроет adminOpen(), если токен администратора
   персистентно сохранён на этом устройстве), либо открывая новую вкладку
   с параметром ?admin=1. Секретная фраза пульта НЕ обходится — страница
   сама решает, показывать пульт или обычный запрос кода. */
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of all){try{c.postMessage({type:'OPEN_ADMIN'});await c.focus();return}catch(e){}}
    await self.clients.openWindow('./?admin=1');
  })());
});
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(u.origin!==location.origin)return;
  if(isDbOrConfig(u)){
    event.respondWith((async()=>{
      try{const fresh=await fetch(event.request,{cache:'no-store'});await putFresh(await caches.open(CACHE),event.request,fresh);return fresh}
      catch(e){const cached=await caches.match(event.request,{ignoreSearch:true});if(cached)return cached;throw e}
    })());
    return;
  }
  const p=u.pathname;
  if(p.endsWith('/script.js')||p.endsWith('/validator.js')||p.endsWith('/style.css')||p.endsWith('/qr.js')||p.endsWith('/languages.json')||p.endsWith('/manifest.webmanifest')||p.endsWith('/reklama.txt')||p.endsWith('/requests.txt')||p.endsWith('/icon.png')||p.endsWith('/icon-192.png')||p.endsWith('/icon-512.png')){
    event.respondWith((async()=>{
      try{const r=await fetch(event.request,{cache:'no-store'});await putFresh(await caches.open(CACHE),event.request,r);return r}
      catch(e){return caches.match(event.request,{ignoreSearch:true})}
    })());
  }
});
