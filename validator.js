(()=>{'use strict';
/* v5.4.0.0: автоопределитель среды (общий для validator.js и script.js): локальный/тестовый адрес или путь test-cartoteka → test_config.json, боевой домен → config.json. */
window.CART_ENV=window.CART_ENV||(function(){try{const h=String(location.hostname||''),p=String(location.pathname||'');const local=/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(h)||/\.local$/.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||!!location.port;const sandbox=/test-cartoteka/.test(h+p);const test=local||sandbox;return{mode:test?'test':'prod',configFile:test?'test_config.json':'config.json'}}catch(e){return{mode:'prod',configFile:'config.json'}}})();
const CFG_FILE=window.CART_ENV.configFile;
/* КАРТОТЕКА v5.0.1.0 — изолированный пре-лончер диагностики «Живой Карантин».
   Файл полностью отделён от script.js: даже если это проверка целиком упадёт,
   она не может обрушить запуск основного приложения — все ошибки гасятся
   внутри try/catch, а финальный хук скрытия заставки всегда вызывается.
   Задача: пока на экране крутится заставка «Идёт загрузка Справочника...»,
   тихо проверить сетевую доступность ключевых шлюзов (config.json,
   languages.json, kazakhstan_geo.json) и доложить результат в window.__CARTOTEKA_PRECHECK__
   для панели «Живой Карантин» в Админ-пульте. Если шлюз недоступен — сайт НЕ
   блокируется: script.js всё равно поднимет офлайн-кэш и покажет Справочник. */
window.__CARTOTEKA_PRECHECK__={startedAt:Date.now(),finishedAt:null,gates:[],ok:true};

function setStatus(text){
  try{const el=document.getElementById('launchSplashStatus');if(el)el.textContent=text}catch(e){}
}

async function checkGate(name,url){
  const gate={name,url,ok:false,error:''};
  try{
    const r=await fetch(`${url}?precheck=${Date.now()}`,{cache:'no-store'});
    gate.ok=!!r.ok;
    if(!r.ok)gate.error=`HTTP ${r.status}`;
  }catch(e){
    gate.error=e&&e.message?e.message:'сеть недоступна';
  }
  return gate;
}

/* Этот хук — единственная точка, которая физически скрывает заставку.
   Выполняется строго при статусе «Проверка завершена», с display:none,
   чтобы пятиэтажный хедер и все 12 плиток категорий открылись мгновенно,
   без поломки стилей кузова (заставка — отдельный fixed-слой поверх #app). */
function hideSplashNow(){
  try{
    const el=document.getElementById('launchSplash');
    if(!el)return;
    el.style.display='none';
    el.setAttribute('aria-hidden','true');
  }catch(e){}
}

/* v5.0.1.4: валидатор теперь сам узнаёт список файлов баз жителей из
   config.json (поле files[]) и сверяет пофайлово. Это НЕ блокирующая
   проверка — при любой сетевой неудаче по базе валидатор тихо проверяет
   офлайн-кэш Cache Storage и считает шлюз живым, если файл там уже есть;
   полностью отсутствующий файл просто помечается gate.ok=false, но
   старт приложения всё равно не останавливается (script.js поднимет то,
   что сможет, через собственный резилиент-init). */
async function checkCacheHas(url){
  try{
    if(!('caches' in self))return false;
    const names=await caches.keys();
    for(const name of names){
      const cache=await caches.open(name);
      const hit=await cache.match(url,{ignoreSearch:true});
      if(hit)return true;
    }
  }catch(e){}
  return false;
}
async function checkGateWithCacheFallback(name,url){
  const gate=await checkGate(name,url);
  if(!gate.ok){
    const cached=await checkCacheHas(url);
    if(cached){gate.ok=true;gate.offline=true;gate.error=''}
  }
  return gate;
}
/* v5.4.0.0: ЛЕНИВАЯ ЗАГРУЗКА. Валидатор больше не опрашивает все 165 баз: при старте
   проверяется только база села, с которым житель откроет приложение (сохранённое или первое
   в config.json). Остальные базы проверяются, когда житель выбирает село. */
function startDbPathFromConfig(cfg){
  const vs=Array.isArray(cfg.villages)?cfg.villages:[];
  let saved='';try{saved=localStorage.getItem('cart_village')||''}catch(e){}
  const v=vs.find(x=>x&&x.name===saved)||vs[0];
  if(v)return v.path||v.file;
  const files=Array.isArray(cfg.files)?cfg.files:[];
  return files[0]||'';
}
async function dbGatesFromConfig(){
  try{
    const cfgGate=await checkGate(CFG_FILE,CFG_FILE);
    if(!cfgGate.ok)return [];
    const r=await fetch(`${CFG_FILE}?dbscan=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)return [];
    const f=startDbPathFromConfig(await r.json());
    return f?[await checkGateWithCacheFallback(f,f)]:[];
  }catch(e){return []}
}
/* v5.0.1.5: лёгкая, НЕ блокирующая сверка сотых диапазонов ID. Валидатор не
   дублирует полный парсер script.js (20-графовый формат) — он лишь читает
   графу №1 каждой строки и раскладывает её по вёдрам супер-плиток 1–9,
   системному резерву 0–999 и Жителям 10000+, чтобы админ-панель «Живой
   Карантин» сразу видела грубую статистику без похода в код. Любая ошибка
   чтения файла тут же гасится — это диагностика, а не гейт запуска.
   v5.2.0.1: диапазон супер-плиток принудительно расширен с [1-6] на [1-9]
   под каскад 9×9 (суверенная структура категорий, Вариант Б). */
function scanIdRanges(text){
  const buckets={reserve:0,tiles:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0},residents:0,anomaly:0};
  const lines=String(text||'').split(/\r?\n/);
  for(const line of lines){
    const raw=line.trim();
    if(!raw||raw.startsWith('#'))continue;
    const id=Number(raw.split(' | ')[0]);
    if(!Number.isFinite(id))continue;
    if(id<1000)buckets.reserve++;
    else if(id>=10000)buckets.residents++;
    else{
      const tile=Math.floor(id/1000);
      if(tile>=1&&tile<=9)buckets.tiles[tile]++;
      else buckets.anomaly++;
    }
  }
  return buckets;
}
async function idGridScan(){
  try{
    const r=await fetch(`${CFG_FILE}?idgrid=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)return null;
    const f=startDbPathFromConfig(await r.json());
    const out={};
    if(f){try{const fr=await fetch(`${f}?idgrid=${Date.now()}`,{cache:'no-store'});if(fr.ok)out[f]=scanIdRanges(await fr.text())}catch(e){}}
    return out;
  }catch(e){return null}
}
async function runPrecheck(){
  setStatus('Идёт загрузка Справочника...');
  const [baseGates,dbGates,idGrid]=await Promise.all([
    Promise.all([
      checkGateWithCacheFallback(CFG_FILE,CFG_FILE),
      checkGateWithCacheFallback('languages.json','languages.json'),
      checkGateWithCacheFallback('kazakhstan_geo.json','kazakhstan_geo.json')
    ]),
    dbGatesFromConfig(),
    idGridScan()
  ]);
  const gates=[...baseGates,...dbGates];
  window.__CARTOTEKA_PRECHECK__.gates=gates;
  window.__CARTOTEKA_PRECHECK__.idGrid=idGrid;
  window.__CARTOTEKA_PRECHECK__.ok=gates.every(g=>g.ok);
  window.__CARTOTEKA_PRECHECK__.finishedAt=Date.now();
  setStatus('Проверка завершена');
  try{document.dispatchEvent(new CustomEvent('cartoteka:precheck',{detail:window.__CARTOTEKA_PRECHECK__}))}catch(e){}
  hideSplashNow();
}

try{runPrecheck()}catch(e){
  /* Железная защита: даже если сам пре-лончер сломался, заставка обязана
     скрыться, а не намертво зависнуть на экране жителя. */
  try{window.__CARTOTEKA_PRECHECK__.ok=false;window.__CARTOTEKA_PRECHECK__.error=String(e)}catch(_e){}
  setStatus('Проверка завершена');
  hideSplashNow();
}
/* v5.0.1.3: двухступенчатый аварийный тайм-аут. На 8-й секунде — мягкое
   предупреждение в статусе (на случай очень медленной сети), на 12-й —
   жёсткий принудительный выход: заставка обязана уйти с экрана в любом
   случае, Справочник не имеет права зависать на пустом фоне. */
setTimeout(()=>{if(document.getElementById('launchSplash')?.style.display!=='none')setStatus('Проверка затянулась, продолжаем...')},8000);
setTimeout(hideSplashNow,12000);
})();
