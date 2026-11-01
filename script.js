(()=>{'use strict';
/* ===================================================================
   КАРТОТЕКА — script.js v5.2.0.1
   Ядро v5.2.0.0 — ОСТАВЛЕНО НЕТРОНУТЫМ, внесена точечная калибровка.
   Весь видимый текст маршрутизируется через languages.json и T().
   v5.2.0.1 (СУВЕРЕННАЯ СТРУКТУРА КАТЕГОРИЙ, Вариант Б): каталог
   SUPER_TILES/SUB_TILES (9×9, эмодзи/двуязычные названия/теги) ВЫРЕЗАН
   отсюда и перенесён в отдельный независимый файл categories.json —
   он остаётся не «текстом интерфейса», а контент-каталогом, завязанным
   на цифровую математику масок Г17/Г19, поэтому живёт в своём файле, а
   не в languages.json. Загружается один раз через loadCategories() и
   присваивается в ЭТИ ЖЕ runtime-имена SUPER_TILES/SUB_TILES, чтобы вся
   нижестоящая логика (idTile/idSub, рендер плиток, buildCandidateRow)
   не требовала структурных правок — меняется только источник данных.
   Резервные слоты 7-9 на обоих уровнях 9×9 помечены hidden:true. */
const APP_VERSION='v1.0.0.3',SCHEMA=20;
/* v1.0.0.3: единый «Код входа в админку» = ADMIN_CODE шлюза. В код сайта он НЕ вшивается: проверку делает локальный сервер (/__auth), на нём хранится только отпечаток. */
/* Нормализация введённой фразы: без кавычек-ёлочек и обычных кавычек, лишние
   пробелы схлопываются, регистр не учитывается (Пойду Покурю = ПОЙДУ ПОКУРЮ). */
function normPhrase(v){return String(v||'').replace(/[«»"'“”„‘’`]/g,'').replace(/\s+/g,' ').trim().toLowerCase().replace(/ё/g,'е')}
/* v5.3.0.4: SHA-256 и хэши из ядра удалены. Вход в пульт — текстовая проверка секретной фразы без учёта регистра. */
/* ГОСТ Графы №17 (HOME LOCK) — 10 компонентов, 9 слэшей, 2 хвостовых нуля:
   X/C/T1/T2/G/L/W1/W2/0/0 (X=индекс села, C=супер-плитка 1-9, T1=под-плитка
   1-9, T2=индекс плитки 3-го уровня 0-9 (с v5.3.0.4; имена плиток — в categories.json), G=код графика 1-4, L=есть
   городской 0/1, W1/W2=WhatsApp на Сотовом№1/№2 подтверждён 0/1). Диапазон
   C/T1 расширен с [1-6] на [1-9] в v5.2.0.1 под каскад 9×9. */
const MASK17_RE=/^\d+\/[1-9]\/[1-9]\/[0-9]\/[1234]\/[01]\/[01]\/[01]\/0\/0$/;
const MASK18_RE=/^\d+\/P\/[01]\/[01]\/[01]\/0\/0$/;
const MASK19_RE=/^\d+\/[01]\/[12]\/[01]\/[0-9]\/0\/0$/;
const MARKER_RE=/^(\$|NEW|ORIGINAL|EDIT|DELETE_[1-4]|DELETE_.+)$/;
const isPublicMarker=m=>m==='$';
const isQuarantineMarker=m=>MARKER_RE.test(m)&&m!=='$';
/* v1.0.0.3: строки-ссылки на чаты (Г20 = wa | tg) живут в тех же 20-графовых базах, но в карточки не попадают. */
const CHAT_MARKER_RE=/^(wa|tg)$/;
const isChatRow=l=>{const f=String(l||'').split(' | ');return f.length===20&&CHAT_MARKER_RE.test(f[19].trim())};
function chatOf(f,file){const id=Number(f[0]);if(!/^\d{1,4}$/.test(f[0].trim())||id<1||id>1100)return null;const name=clean(f[1]),link=clean(f[3]);if(!name||name==='.'||!/^https?:\/\//i.test(link))return null;return{id:f[0].trim(),name,desc:clean(f[2])==='.'?'':clean(f[2]),link,kind:clean(f[19]),file,raw:f.map(clean).join(' | ')}}
function chatKindOfLink(u){const t=String(u||'').toLowerCase();if(/whatsapp\.com|wa\.me/.test(t))return 'wa';if(/(^|\/\/|\.)t\.me\b|telegram\.(me|org)/.test(t))return 'tg';return ''}
/* Каскадная архитектура 9x9 (с v5.2.0.1) + автоматика ID по сотым долям:
   расположение карточки вычисляется чистой математикой из графы №1 (ID):
   главная супер-плитка=floor(ID/1000), под-плитка Второго Этажа=floor(ID/100)%10. */
const idTile=id=>Math.floor(Number(id)/1000);
const idSub=id=>Math.floor(Number(id)/100)%10;
/* v5.2.0.1: каталог категорий (супер-плитки/под-плитки) больше НЕ встроен
   сюда литералом — он живёт в суверенном файле categories.json и
   поднимается один раз функцией loadCategories() ниже в эти же runtime-
   имена. До первой успешной загрузки — безопасные пустые заглушки, чтобы
   код, обращающийся к SUPER_TILES/SUB_TILES до старта, не падал. */
let RES_CRAFTS=[];
let SUPER_TILES=[],SUB_TILES={},OTHER_TILE={ru:'Прочее',kz:'Басқасы',emoji:'📂'};
async function loadCategories(){
 try{
  const r=await fetch(`categories.json?v=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)return;
  const data=await r.json();
  const st=Array.isArray(data.superTiles)?data.superTiles:[];
  const sb=data.subTiles&&typeof data.subTiles==='object'?data.subTiles:{};
  if(data.otherTile&&typeof data.otherTile==='object')OTHER_TILE=Object.assign({},OTHER_TILE,data.otherTile);
  if(st.length){SUPER_TILES=st;SUB_TILES=sb}
  if(Array.isArray(data.residentCrafts))RES_CRAFTS=data.residentCrafts;
 }catch(e){/* офлайн/битый файл — прежние значения (пустые или ранее успешно загруженные) остаются в силе, белого экрана не будет */}
}
/* v5.4.0.0: двойной конфиг. Имя репозитория в коде НЕ прописано: владелец/репозиторий берутся из активного конфига
   (боевой config.json -> zko-spravochnik/cartoteka, тестовый test_config.json -> zko-spravochnik/test-cartoteka). */
const ENV=window.CART_ENV||(function(){try{const h=String(location.hostname||''),p=String(location.pathname||'');const local=/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(h)||/\.local$/.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||!!location.port;const sandbox=/test-cartoteka/.test(h+p);const test=local||sandbox;return{mode:test?'test':'prod',configFile:test?'test_config.json':'config.json'}}catch(e){return{mode:'prod',configFile:'config.json'}}})();
try{if(ENV.mode==='test')document.title='[ТЕСТ] '+document.title}catch(e){}
const CONFIG={OWNER:'',REPO:'',BRANCH:'main',API:'https://api.github.com',FILES:[],PATH_CONFIG:ENV.configFile,PATH_REQUESTS:'requests.txt',PATH_REKLAMA:'reklama.txt',PATH_LOG:'admin_log.txt',REGION:'',DISTRICT:'',REGIONS:[],DISTRICTS:[],VILLAGES:[],ROUTE_59_ALLOWED_X:[1,3,4],EMERGENCY:['101','102','103','104','112'],MOBILE_PREFIXES:['7700','7701','7702','7705','7707','7708','7747','7748','7770','7771','7775','7776','7777','7778']};
let L={ru:{},kz:{}},APP_CFG={qrShareUrl:'',shareAppText:'',intakeWebhookUrl:'',repositoryOwner:'',repositoryName:''},GEO={villages:[],districts:[],regions:[]};
/* v5.2.0.1: словарь народных синонимов/уменьшительных имён (name_synonyms.json)
   — суверенный файл, НЕ часть languages.json. canon->[синонимы], плюс
   обратный индекс synonym->canon для быстрого расширения поискового слова
   в любую сторону при сопоставлении токенов ФИО. */
let NAME_SYN={ru:{},kz:{}},NAME_SYN_REV={};
async function loadNameSynonyms(){
 try{
  const r=await fetch(`name_synonyms.json?v=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)return;
  const data=await r.json();
  const pairs=Array.isArray(data.pairs)?data.pairs:[];
  const rev={};
  for(const p of pairs){
   const group=[p.canon,...(Array.isArray(p.synonyms)?p.synonyms:[])].map(norm).filter(Boolean);
   for(const token of group)rev[token]=group;
  }
  NAME_SYN_REV=rev;
 }catch(e){/* словарь недоступен — поиск просто не расширяется синонимами, базовый поиск по подстроке продолжает работать */}
}
/* Возвращает набор нормализованных форм слова, включая его народные
   синонимы (если слово есть в словаре), либо само слово (если нет). */
function nameSynonymGroup(word){const n=norm(word);return NAME_SYN_REV[n]||[n]}
const storageGet=(key,fallback='')=>{try{return localStorage.getItem(key)??fallback}catch(e){return fallback}};
const storageSet=(key,value)=>{try{localStorage.setItem(key,value);return true}catch(e){return false}};
const storageRemove=key=>{try{localStorage.removeItem(key);return true}catch(e){return false}};
const storageGetSession=(key,fallback='')=>{try{return sessionStorage.getItem(key)??fallback}catch(e){return fallback}};
const storageSetSession=(key,value)=>{try{sessionStorage.setItem(key,value);return true}catch(e){return false}};
let SPLASH_STARTED_AT=Date.now();
/* v5.2.0.0: T(key,vars) — ЗРЯЧАЯ ДИНАМИЧЕСКАЯ СВЯЗЬ со словарём. Никакого
   жёстко зашитого русского текста внутри вызовов больше нет — всегда
   читается из уже загруженного L[S.lang], с честным запасным контуром на
   L.ru, а затем на сам технический ключ (только если словарь битый/пуст,
   чтобы интерфейс не падал в белый экран). Поддерживает {подстановки}. */
function T(key,vars){
 let s=(L[S.lang]&&L[S.lang][key])??(L.ru&&L.ru[key])??key;
 if(vars)for(const k in vars)s=s.split('{'+k+'}').join(String(vars[k]));
 return s;
}
try{for(const key of Object.keys(localStorage)){try{const v=localStorage.getItem(key);if(v==='http://localhost:1040'||v==='http://localhost:1040/')localStorage.removeItem(key)}catch(e){}}localStorage.removeItem('cart_v401_legacy_qr');localStorage.removeItem('cart_github_pat')}catch(e){}

const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
const S={
  lang:storageGet('cart_lang','ru')||'ru',
  village:storageGet('cart_village','')||'',
  view:'home',stage:'main',tile:null,sub:null,tag:null,search:'',alphabet:'',
  rows:[],chats:[],byKey:new Map(),invalid:[],quarantine:[],files:new Map(),vip:new Map(),
  favorites:new Set(),favOrder:[],
  pinned:new Set(),pinnedOrder:[],
  favSettings:{mode:'category',showVip:true},favManualOrder:[],
  pocketOpen:{commercial:false,residents:false},lastPocketSearch:null,
  installPrompt:null,token:storageGetSession('cart_github_pat','')||''
};
const clean=v=>String(v??'').replace(/^\s*﻿+/,'').trim();
const esc=v=>String(v??'').replace(/[&<>'\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[m]));
const KZ_FOLD=[['ә','а'],['ғ','г'],['қ','к'],['ң','н'],['ө','о'],['ұ','у'],['ү','у'],['һ','х'],['і','и']];
const norm=v=>{let s=clean(v).toLocaleLowerCase('ru-RU').replace(/ё/g,'е');for(const[a,b]of KZ_FOLD)s=s.split(a).join(b);return s.replace(/\s+/g,' ')};
const digits=v=>clean(v).replace(/\D/g,'');
const villageObj=()=>CONFIG.VILLAGES.find(v=>v.name===S.village)||CONFIG.VILLAGES[0]||null;
const villageFile=()=>villageObj()?.file||'';
const xOfFile=file=>Number(CONFIG.VILLAGES.find(v=>v.file===file)?.index||0);
const fmtPhone=v=>{const d=digits(v);return d.length===11?`+7 ${d.slice(1,4)} ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`:clean(v)};
function startSplash(){SPLASH_STARTED_AT=Date.now();const root=$('#launchSplash');if(!root)return;root.setAttribute('aria-hidden','false');root.classList.remove('fade-out')}
function finishSplash(){const root=$('#launchSplash');if(!root)return;const wait=Math.max(0,3000-(Date.now()-SPLASH_STARTED_AT));setTimeout(()=>{root.classList.add('fade-out');const remove=()=>root.remove();root.addEventListener('transitionend',remove,{once:true});setTimeout(remove,900)},wait)}

/* ===== Булавка / Звезда — ДВА раздельных состояния (v5.0.2.1, сохранено) ===== */
function favKey(r){return `${r.file}::${r.id}`}
function favValue(r){const v=CONFIG.VILLAGES.find(x=>x.file===r.file)?.name||r.geo||'';return `${v}::${r.id}`}
function loadFav(){try{const raw=JSON.parse(storageGet('cart_favs','{}'));let keys=[];if(Array.isArray(raw)){keys=raw;const migrated={};for(const k of raw){const [file,id]=String(k).split('::');const v=CONFIG.VILLAGES.find(x=>x.file===file)?.name||file;migrated[k]=`${v}::${id}`}storageSet('cart_favs',JSON.stringify(migrated))}else if(raw&&typeof raw==='object'){keys=Object.keys(raw)}S.favorites=new Set(keys);S.favOrder=JSON.parse(storageGet('cart_fav_order','[]'));S.favOrder=S.favOrder.filter(k=>S.favorites.has(k))}catch(e){S.favorites=new Set();S.favOrder=[]}}
function saveFav(){const map={};for(const k of S.favorites){const [file,id]=String(k).split('::');const r=S.byKey.get(k);map[k]=r?favValue(r):`${CONFIG.VILLAGES.find(v=>v.file===file)?.name||file}::${id}`}storageSet('cart_favs',JSON.stringify(map));storageSet('cart_fav_order',JSON.stringify(S.favOrder))}
function loadPinned(){try{S.pinned=new Set(JSON.parse(storageGet('cart_pinned','[]')));S.pinnedOrder=JSON.parse(storageGet('cart_pinned_order','[]')).filter(k=>S.pinned.has(k))}catch(e){S.pinned=new Set();S.pinnedOrder=[]}}
function savePinned(){storageSet('cart_pinned',JSON.stringify([...S.pinned]));storageSet('cart_pinned_order',JSON.stringify(S.pinnedOrder))}
function togglePin(r){const k=favKey(r);if(S.pinned.has(k)){S.pinned.delete(k);S.pinnedOrder=S.pinnedOrder.filter(x=>x!==k)}else{S.pinned.add(k);S.pinnedOrder=[k,...S.pinnedOrder.filter(x=>x!==k)]}savePinned();render()}
function toggleFav(r){const k=favKey(r);if(S.favorites.has(k)){S.favorites.delete(k);S.favOrder=S.favOrder.filter(x=>x!==k)}else{S.favorites.add(k);if(!S.favOrder.includes(k))S.favOrder.push(k)}saveFav();render()}
function applyPinnedOnTop(rows){if(!S.pinned||!S.pinned.size)return rows;const pinned=[],rest=[];for(const r of rows){if(S.pinned.has(favKey(r)))pinned.push(r);else rest.push(r)}if(!pinned.length)return rows;pinned.sort((a,b)=>S.pinnedOrder.indexOf(favKey(a))-S.pinnedOrder.indexOf(favKey(b)));return [...pinned,...rest]}

/* ===== Настройки Избранного (v5.0.2.2, сохранено) ===== */
const FAV_MODES=['category','alpha','time','manual'];
function loadFavSettings(){try{const raw=storageGet('cart_fav_settings','');if(!raw){S.favSettings={mode:'category',showVip:true};saveFavSettings();return}const obj=JSON.parse(raw);S.favSettings={mode:FAV_MODES.includes(obj.mode)?obj.mode:'category',showVip:obj.showVip!==false}}catch(e){S.favSettings={mode:'category',showVip:true}}}
function saveFavSettings(){storageSet('cart_fav_settings',JSON.stringify(S.favSettings))}
function loadFavManualOrder(){try{S.favManualOrder=JSON.parse(storageGet('cart_fav_manual_order','[]'))}catch(e){S.favManualOrder=[]}}
function saveFavManualOrder(){storageSet('cart_fav_manual_order',JSON.stringify(S.favManualOrder))}
function favGroupKey(r){if(r.resParts)return[7,0];return[idTile(r.id)||9,idSub(r.id)||0]}
function favGroupLabel(r){if(r.resParts)return T('residentsGroupLabel');const t=idTile(r.id),s=idSub(r.id),st=SUPER_TILES.find(x=>x.id===t),sub=(SUB_TILES[t]||[]).find(x=>x.sub===s);return `${st?superLabel(st):T('otherGroupLabel')}${sub?' — '+subLabel(sub):''}`}
function sortFavorites(rows){const mode=S.favSettings?.mode||'category';if(mode==='alpha')return rows.slice().sort((a,b)=>norm(a.title).localeCompare(norm(b.title),'ru'));if(mode==='time')return rows.slice().sort((a,b)=>S.favOrder.indexOf(favKey(a))-S.favOrder.indexOf(favKey(b)));if(mode==='manual')return rows.slice().sort((a,b)=>{const order=S.favManualOrder,ia=order.indexOf(favKey(a)),ib=order.indexOf(favKey(b));if(ia===-1&&ib===-1)return S.favOrder.indexOf(favKey(a))-S.favOrder.indexOf(favKey(b));if(ia===-1)return 1;if(ib===-1)return-1;return ia-ib});return rows.slice().sort((a,b)=>{const ga=favGroupKey(a),gb=favGroupKey(b);if(ga[0]!==gb[0])return ga[0]-gb[0];if(ga[1]!==gb[1])return ga[1]-gb[1];return norm(a.title).localeCompare(norm(b.title),'ru')})}

/* ===== Валидация 20-графового формата / масок Г17-Г19 ===== */
function parseMask(v,kind){const raw=clean(v),expected=kind===17?9:kind===18||kind===19?6:null;if(expected===null)return{ok:false,zero:false,parts:[],slashes:0};if(raw==='0')return{ok:true,zero:true,parts:null,slashes:null};if(raw.length<=1)return{ok:false,zero:false,parts:raw? [raw]:[],slashes:0};const re=kind===17?MASK17_RE:kind===18?MASK18_RE:MASK19_RE,parts=raw.split('/'),slashes=parts.length-1;return{ok:re.test(raw)&&slashes===expected&&parts.length===expected+1,zero:false,parts,slashes}}
function validateMask17(v){return parseMask(v,17)}function validateMask18(v){return parseMask(v,18)}function validateMask19(v){return parseMask(v,19)}
function rowValidate(fields,lineNo,file){const e=[];if(fields.length!==20)e.push(T('auditErrFieldCount',{count:fields.length}));if(fields._barCount!==undefined&&fields._barCount!==19)e.push(T('auditErrBarCount',{count:fields._barCount}));if(fields.length!==20)return{ok:e.length===0,errors:e};if(fields[13]!=='R'||fields[14]!=='R'||fields[15]!=='R')e.push(T('auditErrRRR'));if(!MARKER_RE.test(fields[19]))e.push(T('auditErrMarker'));for(const[idx,fn,expected]of[[16,validateMask17,9],[17,validateMask18,6],[18,validateMask19,6]]){const v=fn(fields[idx]);if(!v.ok)e.push(T('auditErrMaskStruct',{n:idx+1}));if(!v.zero&&v.slashes!==expected)e.push(T('auditErrMaskSlashes',{n:idx+1}));if(!v.zero){const x=Number(v.parts[0]),fx=xOfFile(file);if(!Number.isInteger(x)||x<1)e.push(T('auditErrXRange',{n:idx+1}));if(fx&&x!==fx)e.push(T('auditErrXMismatch',{n:idx+1,x:fx}))}}const m17=fields[16]==='0'?null:fields[16].split('/'),m18=fields[17]==='0'?null:fields[17].split('/'),m19=fields[18]==='0'?null:fields[18].split('/');if(m17){if(Number(m17[1])<1||Number(m17[1])>9)e.push(T('auditErrC'));if(Number(m17[2])<1||Number(m17[2])>9)e.push(T('auditErrT1'));if(![1,2,3,4].includes(Number(m17[4])))e.push(T('auditErrG'));if(!(Number.isInteger(Number(m17[3]))&&Number(m17[3])>=0&&Number(m17[3])<=9))e.push(T('auditErrT2'))}if(m18&&m18[1]!=='P')e.push(T('auditErrP'));if(m19){if(![0,1].includes(Number(m19[1])))e.push(T('auditErrK1'));if(![1,2].includes(Number(m19[2])))e.push(T('auditErrK2'));if(![0,1].includes(Number(m19[3])))e.push(T('auditErrK3'));if(!(Number.isInteger(Number(m19[4]))&&Number(m19[4])>=0&&Number(m19[4])<=9))e.push(T('auditErrK4'))}
/* v5.2.0.1: новая кросс-проверка Г1↔тип строки. Запись, опознанная как
   ЖИТЕЛЬ (есть Г18/resMask≠0), обязана иметь ID≥10000; запись, опознанная
   как БИЗНЕС (Г18=0, т.е. m18 отсутствует), обязана иметь ID≤9999. Иначе —
   карантин до ручной модерации, это реальная структурная дыра, которой не
   было в прежнем rowValidate (он проверял только форму маски, не диапазон
   Г1 относительно типа записи). */
 const idNum=Number(fields[0]);
 if(Number.isFinite(idNum)){
  if(m18&&idNum<10000)e.push(T('auditErrResidentIdRange',{id:fields[0]}));
  if(!m18&&idNum>9999)e.push(T('auditErrBusinessIdRange',{id:fields[0]}));
 }
return{ok:e.length===0,errors:e}}
function parseRow(line,lineNo,file){const fields=line.split(' | ').map(clean);fields._barCount=(line.match(/ \| /g)||[]).length;const audit=rowValidate(fields,lineNo,file);if(!audit.ok)return{row:null,error:{line:lineNo,file,errors:audit.errors,raw:line}};const marker=fields[19];if(isQuarantineMarker(marker))return{row:null,error:null,quarantine:{line:lineNo,file,id:fields[0],marker,raw:line}};const p=fields,h=p[16],r=p[17],s=p[18];return{row:{id:p[0],folder:p[1],title:p[2],owner:p[3],residentNote:p[4],city:p[5],mobile1:p[6],mobile2:p[7],address:p[8],tags:p[9],geo:p[10],schedule:p[11],social:p[12],reserve1:p[13],reserve2:p[14],reserve3:p[15],homeMask:h,resMask:r,searchMask:s,raw:line,file,lineNo,homeParts:h==='0'?null:h.split('/').map(Number),resParts:r==='0'?null:r.split('/'),searchParts:s==='0'?null:s.split('/').map(Number)},error:null}}
function rowX(r){return Number(r.homeParts?.[0]??r.resParts?.[0]??r.searchParts?.[0]??0)}
function isBus59Row(r){return /пригородный автобус №59|автобус №59|маршрут 59/i.test(`${r.title} ${r.tags}`)}
function currentVillageRows(){const v=villageObj(),x=Number(v?.index||0);return S.rows.filter(r=>r.file===v?.file&&rowX(r)===x).filter(r=>!isBus59Row(r)||CONFIG.ROUTE_59_ALLOWED_X.includes(x))}

/* ===== Загрузка конфигурации / языка / гео / баз ===== */
/* v5.4.0.0: базы лежат в bazy_zko/<папка-района>/. Путь берётся из config.json (поле path),
   а если его нет — собирается из имени файла baza_zko_<папка>_<село>.txt и dbRoot. */
function dbPath(file){
 const p=CONFIG.PATHS&&CONFIG.PATHS.get(file);if(p)return p;
 const m=/^baza_zko_([a-z0-9]+)_/.exec(String(file||''));
 return CONFIG.DBROOT&&m?`${CONFIG.DBROOT}/${m[1]}/${file}`:file;
}
async function fetchDb(file){return fetchText(dbPath(file))}
async function fetchText(file){let lastErr=null;for(let attempt=1;attempt<=3;attempt++){try{const r=await fetch(`${file}?v=${encodeURIComponent(APP_VERSION)}-${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`${file}: HTTP ${r.status}`);return await r.text()}catch(e){lastErr=e;if(attempt<3)await new Promise(res=>setTimeout(res,350*attempt))}}throw lastErr}
const FALLBACK_VILLAGE={file:'baza_zko_baiterek_daryinskoe.txt',name:'Дарьинское',code:'daryinskoe',index:1,region:'zko',district:'beyterek'};
async function loadConfig(){
 let cfg={};
 try{const r=await fetch(`${ENV.configFile}?v=${Date.now()}`,{cache:'no-store'});if(r.ok)cfg=await r.json()}catch(e){cfg={}}
 let villages=[];
 if(Array.isArray(cfg.villages)){villages=cfg.villages.map(v=>{try{const index=Number(v.index);if(!v.file||!v.name||!Number.isInteger(index)||index<1)return null;return{file:String(v.file),name:String(v.name),code:String(v.code||v.file),index,region:String(v.region||cfg.regions?.[0]?.value||'zko'),district:String(v.district||cfg.districts?.[0]?.value||'beyterek'),folder:String(v.folder||''),path:String(v.path||'')}}catch(e){return null}}).filter(Boolean)}
 if(!villages.length)villages=[FALLBACK_VILLAGE];
 let files=Array.isArray(cfg.files)&&cfg.files.length===villages.length?cfg.files.map(String):villages.map(v=>v.file);
 CONFIG.REGION=String(cfg.region||'Западно-Казахстанская область');
 CONFIG.DISTRICT=String(cfg.district||'Район Бәйтерек');
 CONFIG.REGIONS=Array.isArray(cfg.regions)&&cfg.regions.length?cfg.regions.map(x=>typeof x==='string'?{value:x,label:x}:{value:String(x.value),label:String(x.label||x.value)}):[{value:'zko',label:'Западно-Казахстанская область'}];
 CONFIG.DISTRICTS=Array.isArray(cfg.districts)&&cfg.districts.length?cfg.districts.map(x=>typeof x==='string'?{region:CONFIG.REGIONS[0].value,value:x,label:x}:{region:String(x.region||CONFIG.REGIONS[0].value),value:String(x.value),label:String(x.label||x.value)}):[{region:CONFIG.REGIONS[0].value,value:'beyterek',label:'район Бәйтерек'}];
 CONFIG.VILLAGES=villages;CONFIG.FILES=files;
 CONFIG.DBROOT=String(cfg.dbRoot||'');CONFIG.PATHS=new Map(villages.filter(v=>v.path).map(v=>[v.file,v.path]));
 CONFIG.ROUTE_59_ALLOWED_X=Array.isArray(cfg.routeRules?.bus59AllowedX)?cfg.routeRules.bus59AllowedX.map(Number).filter(Number.isInteger):[1,3,4];
 try{APP_CFG=Object.assign(APP_CFG,cfg)}catch(e){}
 CONFIG.REPO=String(cfg.repository||cfg.github?.repository||cfg.repositoryName||CONFIG.REPO||'');
 CONFIG.OWNER=String(cfg.repositoryOwner||CONFIG.OWNER||'');CONFIG.BRANCH=String(cfg.branch||CONFIG.BRANCH||'main');
 CONFIG.BACKUP_OLD=String(cfg.backup?.oldPath||'backups/old backup');
 CONFIG.BACKUP_NEW=String(cfg.backup?.newPath||'backups/backup');
 const saved=storageGet('cart_village','');
 const savedValid=saved&&CONFIG.VILLAGES.some(v=>v.name===saved);
 S.village=savedValid?saved:(CONFIG.VILLAGES.find(v=>v.name==='Дарьинское')?.name||CONFIG.VILLAGES[0].name);
 storageSet('cart_village',S.village);
 try{await loadGeo()}catch(e){}
}
async function loadGeo(){GEO.villages=[];GEO.districts=[];GEO.regions=[];GEO.ok=false;try{const r=await fetch(`kazakhstan_geo.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;const g=await r.json();GEO.villages=Array.isArray(g.villages)?g.villages.filter(v=>v&&v.nameRu&&v.districtSlug):[];GEO.districts=Array.isArray(g.districts)?g.districts.filter(d=>d&&d.slug):[];GEO.regions=Array.isArray(g.regions)?g.regions.filter(rg=>rg&&rg.slug):[];GEO.ok=GEO.villages.length>0}catch(e){}}
function geoRegions(){return GEO.regions.length?GEO.regions:[{slug:'zko',nameRu:'Западно-Казахстанская область'}]}
function geoDistricts(regionSlug){return GEO.districts.filter(d=>d.regionSlug===regionSlug)}
function geoVillagesOf(districtSlug){return GEO.villages.filter(v=>v.districtSlug===districtSlug)}
function villageLabel(nameRu,lang){
 const c=GEO.villages.filter(x=>x.nameRu===nameRu);const v=c.find(x=>x.districtSlug===CONFIG.DISTRICT)||c.find(x=>x.displayRu)||c[0];if(!v)return nameRu;
 return (lang||S.lang)==='kz'?(v.displayKz||v.displayRu||nameRu):(v.displayRu||nameRu);
}
function geoVillageByName(districtSlug,nameRu){return GEO.villages.find(v=>v.districtSlug===districtSlug&&v.nameRu===nameRu)}
/* v5.4.0.0: названия районов/областей — строго из languages.json (geoDistricts / geoRegions по slug),
   запасной путь: nameRu/nameKz из гео-файла, затем технический slug. Новая область/район = новые ключи. */
function geoName(kind,e){
 if(!e)return '';
 const dict=(L[S.lang]||{})[kind==='region'?'geoRegions':'geoDistricts'];
 return (dict&&dict[e.slug])||(S.lang==='kz'?e.nameKz:e.nameRu)||e.nameRu||e.slug||'';
}
const districtName=d=>geoName('district',d),regionName=r=>geoName('region',r);
function geoDistrictBySlug(slug){return GEO.districts.find(d=>d.slug===slug)}
async function loadLang(){try{const r=await fetch(`languages.json?v=${Date.now()}`,{cache:'no-store'});if(r.ok)L=await r.json()}catch(e){}}
async function loadVip(){S.vip.clear();try{const text=await fetchText(CONFIG.PATH_REKLAMA);for(const line of text.split(/\r?\n/)){const p=line.split('|').map(clean);if(p.length>=3)S.vip.set(`${p[0]}::${p[1]}`,p[2])}}catch(e){}}
function isVip(r){const code=CONFIG.VILLAGES.find(v=>v.file===r.file)?.code,d=S.vip.get(`${code}::${r.id}`);if(!d)return false;if(/^(навсегда|бессрочно|forever)$/i.test(String(d).trim()))return true;const m=d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);return !!m&&new Date(+m[3],+m[2]-1,+m[1])>new Date()}
function buildRows(){S.byKey=new Map();S.rows.sort((a,b)=>Number(a.id)-Number(b.id)||a.file.localeCompare(b.file));for(const r of S.rows)S.byKey.set(favKey(r),r)}
/* ===== v5.4.0.0: ЛЕНИВАЯ ЗАГРУЗКА БАЗ =====
   При запуске скачиваются только config.json / geo / языки (они же «индекс» районов и сёл).
   Текстовая база села скачивается в момент выбора этого села (selectVillage) либо по требованию:
   избранное из другого села, анкета в другое село, админ-отчёты (ensureAllLoaded). */
S.loaded=new Set();S.loading=new Map();
async function fetchVillageText(file){
 try{return{file,text:await fetchDb(file),source:'network'}}catch(e){
  let cached=null;try{cached=localStorage.getItem('cart_cache_'+file)}catch(e2){}
  if(cached!=null)return{file,text:cached,source:'cache'};
  return{file,error:e?.message||String(e)};
 }
}
function dropVillageRows(file){
S.chats=(S.chats||[]).filter(c=>c.file!==file);
 S.rows=S.rows.filter(r=>r.file!==file);S.invalid=S.invalid.filter(x=>x.file!==file);S.quarantine=S.quarantine.filter(x=>x.file!==file);S.files.delete(file);
}
function ingestDbText(item){
 let parsedRows=0;
 if(item.error){ensureDefaultChats(item.file);S.files.set(item.file,{text:'',size:0,rows:0,bad:1,rawLines:0,source:'unavailable'});S.invalid.push({file:item.file,line:0,errors:[T('fileNotReceived',{error:item.error})],raw:''});return 0}
 const size=new TextEncoder().encode(item.text).length,info={text:item.text,size,rows:0,bad:0,rawLines:0,source:item.source,emergencySkipped:0};S.files.set(item.file,info);
 const lines=String(item.text??'').replace(/^\uFEFF/,'').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const raw=clean(lines[i]);if(!raw||raw.startsWith('#'))continue;info.rawLines++;
  const fields=raw.split(' | ').map(clean);
  if(fields.length===20&&CHAT_MARKER_RE.test(fields[19])){const c=chatOf(fields,item.file);if(c)S.chats.push(c);else{S.invalid.push({line:i+1,file:item.file,errors:[T('chatBadRow')],raw});info.bad++}continue}
  if(fields.length===20&&CONFIG.EMERGENCY.includes(clean(fields[5]))){info.emergencySkipped++;continue}
  const parsed=parseRow(raw,i+1,item.file);if(parsed.row){S.rows.push(parsed.row);info.rows++;parsedRows++}else if(parsed.quarantine){S.quarantine.push(parsed.quarantine);info.bad++}else{S.invalid.push(parsed.error);info.bad++}
 }
 ensureDefaultChats(item.file);
 return parsedRows;
}
async function loadVillageFile(file,force){
 if(!file)return false;
 if(!force&&S.loaded.has(file))return true;
 if(S.loading.has(file))return S.loading.get(file);
 const p=(async()=>{
  const item=await fetchVillageText(file);
  dropVillageRows(file);ingestDbText(item);
  if(!item.error)S.loaded.add(file);
  buildRows();
  return !item.error;
 })().finally(()=>S.loading.delete(file));
 S.loading.set(file,p);return p;
}
/* Выбор села на витрине: база скачивается СТРОГО в этот момент; при сбое связи остаёмся в прежнем селе. */
async function selectVillage(obj){
 if(!obj)return false;
 if(!S.loaded.has(obj.file)){
  toast(T('villageLoadingToast',{village:villageLabel(obj.name)}));
  const ok=await loadVillageFile(obj.file);
  if(!ok){dropVillageRows(obj.file);buildRows();toast(T('villageLoadFailToast',{village:villageLabel(obj.name)}));return false}
 }
 S.village=obj.name;storageSet('cart_village',obj.name);return true;
}
async function ensureFilesLoaded(files){await Promise.all([...new Set(files)].filter(f=>f&&!S.loaded.has(f)).map(f=>loadVillageFile(f)))}
/* Админ-инструменты (отчёты, аудит, дубли, резерв) работают по ВСЕЙ области — догружаем все базы пачками. */
async function ensureAllLoaded(){
 const todo=CONFIG.FILES.filter(f=>!S.loaded.has(f));if(!todo.length)return;
 toast(T('loadAllToast',{n:todo.length}));
 for(let i=0;i<todo.length;i+=8)await Promise.all(todo.slice(i,i+8).map(f=>loadVillageFile(f)));
}
async function loadDatabases(){
 const cur=villageObj()?.file,want=new Set([...S.loaded]);if(cur)want.add(cur);
 S.rows=[];S.chats=[];S.invalid=[];S.quarantine=[];S.files=new Map();S.loaded=new Set();
 const items=await Promise.all([...want].map(fetchVillageText));
 let parsedRows=0;
 for(const it of items){parsedRows+=ingestDbText(it);if(!it.error)S.loaded.add(it.file)}
 buildRows();saveFav();render();loadVip().then(()=>render()).catch(()=>{});scheduleSwNotifyCheck();return parsedRows>0
}

/* ===== Выборки по плиткам / ДВУХСЛОЙНЫЙ ГИБРИДНЫЙ ПОИСК (сохранено v5.0.2.2) ===== */
/* v1.0.0.3: АВТОПИЛОТ КОММЕРЦИИ. Описание жителя (примечание, теги, место работы) проверяется по словарю residentCrafts
   из categories.json (десятки корней по всем разделам). Нашёлся маркер коммерции — карточка жителя дублируется на экране в
   нужный раздел бизнеса (Мастера, Магазины, Транспорт, Медицина, Прочее). Оригинал остаётся в «Жителях», в базе строка одна. */
function craftRe(c){
 if(c._re)return c._re;
 const esc2=w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 c._re=(c.words||[]).map(w=>{w=String(w).toLowerCase().replace(/ё/g,'е');const whole=w[0]==='=';if(whole)w=w.slice(1);return new RegExp('(^|[^а-яa-z0-9])'+esc2(w)+(whole?'($|[^а-яa-z0-9])':''))});
 return c._re;
}
function craftOf(r){
 if(!r||!r.resParts||!RES_CRAFTS.length)return null;
 if(r._craft!==undefined)return r._craft;
 const txt=String([r.residentNote,r.tags,r.social].filter(x=>x&&x!=='.').join(' ; ')).toLowerCase().replace(/ё/g,'е');
 let out=null;
 for(const c of RES_CRAFTS){if(craftRe(c).some(re=>re.test(txt))){out={tile:Number(c.tile),sub:Number(c.sub),t2:Number(c.t2)};break}}
 r._craft=out;return out;
}
function mainTileRows(mainId){const id=Number(mainId);if(!Number.isInteger(id)||id<1||id>9)return[];return currentVillageRows().filter(r=>r.resParts?(craftOf(r)?.tile===id):idTile(r.id)===id)}
function subTileRows(mainId,subId){const s=Number(subId);if(!Number.isInteger(s)||s<1||s>9)return[];return mainTileRows(mainId).filter(r=>r.resParts?craftOf(r).sub===s:idSub(r.id)===s)}
function tileRows(mainId){return mainTileRows(mainId)}
/* v5.2.0.1: токенизация ФИО (Фамилия/Имя/Отчество — независимые токены, а
   не единая строка) + расширение каждого токена его народными синонимами
   из name_synonyms.json. Применяется только к ЖИТЕЛЯМ (Г18 активна) — по
   бизнес-карточкам поведение поиска и радара остаётся прежним. */
function nameTokensOf(r){return clean(`${r.title||''} ${r.residentNote||''}`).split(/\s+/).filter(Boolean)}
function residentAlphaKeys(r){
 const keys=new Set();
 for(const raw of nameTokensOf(r)){
  if(raw[0])keys.add(raw[0].toUpperCase());
  for(const syn of nameSynonymGroup(raw)){if(syn)keys.add(syn[0].toUpperCase())}
 }
 return keys;
}
/* v5.3.0.6: сквозной поиск по номеру телефона. Скобки, пробелы, тире, точки убираются;
   полный номер (+7…, 8…, 10 цифр) и ЛЮБОЙ хвост от 4 цифр сверяются с концом городского/сотовых номеров. */
function phoneQueryDigits(q){
 const s=String(q||'').replace(/[\s()\-.]/g,'');
 if(!/^\+?\d{4,}$/.test(s))return'';
 let d=s.replace(/\D/g,'');
 if(d.length===11&&d[0]==='8')d='7'+d.slice(1);
 return d;
}
function rowPhoneMatch(r,qd){
 if(!qd)return false;
 for(const p of[r.city,r.mobile1,r.mobile2]){const d=String(p||'').replace(/\D/g,'');if(d&&d.endsWith(qd))return true}
 return false;
}
function cleanSearchValue(raw){const v=clean(raw);return phoneQueryDigits(v)?v.replace(/[\s()\-.]/g,''):v}
function residentMatchesQuery(r,q){
 if(rowPhoneMatch(r,phoneQueryDigits(q)))return true;
 const whole=norm(`${r.title} ${r.residentNote} ${r.tags} ${r.social} ${r.address}`),n=norm(q);
 if(!n)return true;
 if(whole.includes(n))return true;
 const qTokens=tokenizeWords(q);if(!qTokens.length)return false;
 const rTokens=nameTokensOf(r).map(norm);
 return qTokens.every(qt=>rTokens.some(rt=>rt.includes(qt)||nameSynonymGroup(qt).includes(rt)||nameSynonymGroup(rt).includes(qt)));
}
function tokenizeWords(s){return norm(s).split(/\s+/).filter(Boolean)}
function applyAlphabet(rows){if(!S.alphabet)return rows;const a=norm(S.alphabet);return rows.filter(r=>r.resParts?residentAlphaKeys(r).has(S.alphabet):norm(r.title).startsWith(a))}
function searchResident(rows,q){if(!q)return rows;return rows.filter(r=>residentMatchesQuery(r,q))}
function residentBaseRows(){let a=currentVillageRows().filter(r=>r.resParts);if(S.search)a=searchResident(a,S.search);return a}
function residentRows(){return applyAlphabet(residentBaseRows())}
function searchBaseRows(){const q=norm(S.search),qd=phoneQueryDigits(S.search);let out=currentVillageRows();if(q)out=out.filter(r=>{if(qd&&rowPhoneMatch(r,qd))return true;if(r.searchParts?.[1]===undefined)return false;const deep=r.searchParts?.[2]===2,fields=deep?[r.title,r.owner,r.residentNote,r.city,r.mobile1,r.mobile2,r.address,r.tags,r.geo,r.social]:[r.title];return fields.map(norm).some(x=>x.includes(q))||(r.searchParts?.[3]===1&&norm(r.tags).includes(q))});return out}
function searchRows(){return applyAlphabet(searchBaseRows())}
function searchResidentsInVillage(q){return currentVillageRows().filter(r=>r.resParts&&residentMatchesQuery(r,q))}
function searchAlphabetSourceRows(){if(S.view==='residents')return residentBaseRows();if(S.view!=='search')return [];if(!S.search)return searchBaseRows();const commercial=searchBaseRows().filter(r=>r.homeParts);const residents=searchResidentsInVillage(S.search);return [...commercial,...residents]}
function sortRows(rows,mode){return rows.slice().sort((a,b)=>mode==='res'?norm(a.title).localeCompare(norm(b.title),'ru')||Number(a.id)-Number(b.id):mode==='fav'?(S.favOrder.indexOf(favKey(a))+100000)-(S.favOrder.indexOf(favKey(b))+100000):Number(isVip(b))-Number(isVip(a))||Number(a.id)-Number(b.id))}
function parseShift(s){const m=clean(s).match(/^SHIFT\|(\d+)\|(\d+)\|(\d{4}-\d{2}-\d{2})\|([0-2]\d):([0-5]\d)$/i);if(!m)return null;const start=new Date(`${m[3]}T${m[4]}:${m[5]}:00`);return Number.isNaN(start.getTime())?null:{work:Math.min(7,Math.max(1,Number(m[1]))),rest:Math.min(7,Math.max(1,Number(m[2]))),start}}
function shiftState(info,date){const a=new Date(date.getFullYear(),date.getMonth(),date.getDate()),b=new Date(info.start.getFullYear(),info.start.getMonth(),info.start.getDate()),diff=Math.floor((a-b)/86400000);if(diff<0)return T('shiftBeforeStart');return diff%(info.work+info.rest)<info.work?T('shiftWorkState'):T('shiftRestState')}
function shiftSummary(s){const i=parseShift(s);return i?T('shiftSummaryTemplate',{work:i.work,rest:i.rest,state:shiftState(i,new Date())}):T('shiftCyclicLabel')}
function shiftCalendar(r){const i=parseShift(r.schedule);if(!i)return'';const today=new Date();let h='<div class="shift-calendar"><div class="shift-calendar-title">'+esc(T('shiftCalendarTitle'))+'</div><div class="shift-calendar-meta">'+esc(T('shiftCalendarMeta',{work:i.work,rest:i.rest,start:i.start.toLocaleDateString('ru-RU')}))+'</div><div class="shift-days">';for(let n=0;n<7;n++){const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()+n),st=shiftState(i,d),cl=st===T('shiftWorkState')?'work':st===T('shiftRestState')?'rest':'before';h+=`<div class="shift-day ${cl}"><b>${d.toLocaleDateString('ru-RU',{weekday:'short'})}</b><span>${d.getDate()}</span><small>${esc(st)}</small></div>`}return h+'</div></div>'}
function rememberAction(r){if(!r)return;const k=favKey(r);let recent=[];try{recent=JSON.parse(storageGet('cart_recent','[]'))}catch(e){}recent=[k,...recent.filter(x=>x!==k)].slice(0,12);storageSet('cart_recent',JSON.stringify(recent));let pop={};try{pop=JSON.parse(storageGet('cart_pop','{}'))}catch(e){}pop[k]=(pop[k]||0)+1;storageSet('cart_pop',JSON.stringify(pop))}
function quickKeys(kind){if(kind==='recent'){try{return JSON.parse(storageGet('cart_recent','[]'))}catch(e){return[]}}let p={};try{p=JSON.parse(storageGet('cart_pop','{}'))}catch(e){}return Object.keys(p).sort((a,b)=>(p[b]||0)-(p[a]||0)).slice(0,10)}

/* ===== Карточка / блок связи ===== */
function card(r){
 const fav=S.favorites.has(favKey(r)),pinned=S.pinned.has(favKey(r)),vip=isVip(r);
 const hueCls=(!vip&&r.homeParts&&!r.resParts)?` card-hue ${hueOf(r.homeParts[1],r.homeParts[2])}`:'';
 let h=`<article class="card ${vip?'card-vip':''}${hueCls}" data-file="${esc(r.file)}" data-id="${esc(r.id)}"><div class="card-actions"><button class="card-star ${fav?'on':''}" data-fav="1" aria-label="${esc(fav?T('favOnAria'):T('favOffAria'))}">${fav?'★':'☆'}</button><button class="card-pin ${pinned?'on':''}" data-pin="1" aria-label="${esc(pinned?T('pinOnAria'):T('pinOffAria'))}">📌</button></div><h3>${vip?'<span class="vip-badge" aria-label="VIP">👑 VIP</span>':''}${esc(r.title)}</h3>`;
 const sub=r.folder==='ЖИТЕЛИ'?r.residentNote:r.owner;
 if(sub&&sub!=='.'&&norm(sub)!==norm(r.title))h+=`<div class="card-subtitle">👤 ${esc(sub)}</div>`;
 if(r.tags&&r.tags!=='.')h+=`<div class="card-desc">${esc(r.tags)}</div>`;
 if(r.social&&r.social!=='.')h+=`<div class="card-desc">🏷️ ${esc(r.social)}</div>`;
 if(r.address&&r.address!=='.')h+=`<div class="card-desc">📍 ${esc(r.address)}</div>`;
 h+=phoneBlockHtml(r);
 h+=bizLinksHtml(r);
 if(r.schedule&&/^SHIFT\|/i.test(r.schedule))h+=shiftCalendar(r);
 h+=`<div class="schedule-line">🕒 ${esc(/^SHIFT\|/i.test(r.schedule)?shiftSummary(r.schedule):(r.schedule&&r.schedule!=='.'?r.schedule:T('scheduleMissing')))}</div><div class="id-line">${esc(r.geo)} · ${esc(T('idLinePrefix'))} ${esc(r.id)}</div></article>`;
 return h;
}
/* v5.2.0.1: трёхэтажная WhatsApp-визитка строго по графам Конституции —
   Строка1 фикс. «КАРТОТЕКА БӘЙТЕРЕК»; Строка2=Г3(title); Строка3=Г4/Г5
   (owner/residentNote, та же ветка, что уже используется в card()); Строка4
   =Г10(tags), пропускается если «.»; Строка5=первый реальный номер из уже
   посчитанного numbers[] (городской→сотовый№1→сотовый№2) через fmtPhone().
   Необязательная Строка6 — реклама приложения из config.json
   (shareAppText+qrShareUrl), склеенная через пустую строку-отступ,
   ПОЛНОСТЬЮ опускается, если хоть одно из двух полей пустое (никогда не
   показываем битый/localhost текст). */
function businessCardText(r,numbers){
 const lines=['КАРТОТЕКА БӘЙТЕРЕК',r.title];
 const line3=r.folder==='ЖИТЕЛИ'?r.residentNote:r.owner;
 if(line3&&line3!=='.')lines.push(line3);
 if(r.tags&&r.tags!=='.')lines.push(r.tags);
 if(numbers&&numbers.length)lines.push(fmtPhone(numbers[0].phone));
 const appText=clean(APP_CFG.shareAppText||''),qrUrl=clean(shareUrl());
 let footer='';
 if(appText&&qrUrl)footer=`\n\n${appText}\n${qrUrl}`;
 return lines.join('\n')+footer;
}
function phoneBlockHtml(r){
 const h=r.homeParts,rm=r.resParts;
 const landline=(r.city&&r.city!=='.')?r.city:'',m1=(r.mobile1&&r.mobile1!=='.')?r.mobile1:'',m2=(r.mobile2&&r.mobile2!=='.')?r.mobile2:'';
 const wa1=!!(m1&&((h?.[6]===1)||(rm?.[3]==='1'))),wa2=!!(m2&&((h?.[7]===1)||(rm?.[4]==='1')));
 const numbers=[];
 if(landline)numbers.push({label:T('landlineLabel'),phone:landline});
 if(m1)numbers.push({label:T('mobile1Label'),phone:m1});
 if(m2)numbers.push({label:T('mobile2Label'),phone:m2});
 if(!numbers.length)return'';
 /* v5.2.0.4: номера телефонов отображаются каждый на своей строке
    (отдельные span.phone-number-line), а не одной склеенной через « · »
    строкой — так CSS может выставить именно текстовый блок в вертикальный
    столбик (flex-direction:column), не трогая кнопки звонка/WhatsApp. */
 const numbersText=numbers.map(n=>fmtPhone(n.phone)).join(' · ');
 const numbersLinesHtml=numbers.map(n=>`<span class="phone-number-line">${esc(fmtPhone(n.phone))}</span>`).join('');
 let callBtn='';
 if(numbers.length===1){callBtn=`<a class="call call-strong pastel-action" href="tel:${esc(numbers[0].phone)}">${esc(T('callBtn'))}</a>`}
 else{callBtn=`<button type="button" class="call call-strong pastel-action" data-callpicker='${esc(JSON.stringify(numbers))}'>${esc(T('callBtn'))}</button>`}
 const waCount=(wa1?1:0)+(wa2?1:0);
 let waBtns='';
 if(wa1)waBtns+=`<a class="wa wa-strong pastel-action" href="https://wa.me/${digits(m1)}" target="_blank" rel="noopener">${esc(waCount===1?T('waBtnSingle'):T('waBtn1'))}</a>`;
 if(wa2)waBtns+=`<a class="wa wa-strong pastel-action" href="https://wa.me/${digits(m2)}" target="_blank" rel="noopener">${esc(waCount===1?T('waBtnSingle'):T('waBtn2'))}</a>`;
 const row1=`<div class="phone-actions phone-row-1">${callBtn}${waBtns}</div>`;
 const copyAll=numbers.map(n=>n.phone).join(', ');
 const shareText=businessCardText(r,numbers);
 const row2=`<div class="phone-actions phone-row-2"><button class="neutral pastel-action" data-copy="${esc(copyAll)}">${esc(T('copyBtn'))}</button><button class="error-btn pastel-action" data-error="1">${esc(T('errorBtn'))}</button><button class="neutral pastel-action" data-share="${esc(shareText)}">${esc(T('shareBtn'))}</button></div>`;
 return `<div class="phone-block"><div class="phone-number-big phone-number-col">${numbersLinesHtml}</div>${row1}${row2}</div>`;
}
function openCallPicker(numbers){
 const html=(numbers||[]).map(n=>`<a class="sector-btn big-action" href="tel:${esc(n.phone)}" style="display:block;text-decoration:none;text-align:center">${esc(n.label)} — ${esc(fmtPhone(n.phone))}</a>`).join('');
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="callPickBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('callPickerTitle'))}</h2></div><div class="sector-grid">${html}</div></div>`);
 $('#callPickBack').onclick=closeModal;
}

/* ===== v5.3.0.5: ПЕРЕКРЁСТНЫЕ ССЫЛКИ «ЖИТЕЛЬ → БИЗНЕС/ГОС» =====
   Строятся на лету, ничего не хранится в базе: телефон жителя (городской и оба
   сотовых, последние 10 цифр) сверяется только с НЕ-жителями ЭТОГО ЖЕ села.
   Совпало — в карточке жителя появляется кнопка «Бизнес: …» (для плитки 5 —
   «Место работы: …»). Не совпало — карточка остаётся чистой. Фамилии не используются. */
let PHONE_IDX=null,PHONE_IDX_SRC=null,PHONE_IDX_LEN=-1;
function phoneKey10(p){const d=String(p||'').replace(/\D/g,'');return d.length>=10?d.slice(-10):''}
function bizPhoneIndex(){
 if(PHONE_IDX&&PHONE_IDX_SRC===S.rows&&PHONE_IDX_LEN===S.rows.length)return PHONE_IDX;
 const m=new Map();
 for(const r of S.rows){
  if(r.resParts)continue;
  for(const p of[r.city,r.mobile1,r.mobile2]){const k=phoneKey10(p);if(!k)continue;const key=r.file+'|'+k;let a=m.get(key);if(!a){a=[];m.set(key,a)}if(!a.includes(r))a.push(r)}
 }
 PHONE_IDX=m;PHONE_IDX_SRC=S.rows;PHONE_IDX_LEN=S.rows.length;return m;
}
function bizLinksFor(r){
 const out=[],seen=new Set(),idx=bizPhoneIndex();
 for(const p of[r.city,r.mobile1,r.mobile2]){const k=phoneKey10(p);if(!k)continue;for(const b of(idx.get(r.file+'|'+k)||[])){const kk=favKey(b);if(!seen.has(kk)){seen.add(kk);out.push(b)}}}
 return out.sort((a,b)=>Number(a.id)-Number(b.id));
}
function bizLinksHtml(r){
 if(!r.resParts)return'';
 const list=bizLinksFor(r);if(!list.length)return'';
 return `<div class="biz-links">${list.map(b=>`<button type="button" class="biz-link hue-bound ${hueOf(b.homeParts?b.homeParts[1]:idTile(b.id),b.homeParts?b.homeParts[2]:0)}" data-bizlink="${esc(favKey(b))}">${esc(T(idTile(b.id)===5?'linkWork':'linkBiz',{title:b.title}))}</button>`).join('')}</div>`;
}
function openBizCard(key){
 const t=S.byKey.get(key);if(!t)return;
 showModal(`<div class="modal-content biz-card-modal"><div class="form-head"><button class="back-capsule big-action" id="bizBack">⬅️ ${esc(T('back'))}</button></div>${card(t)}</div>`);
 $('#bizBack').onclick=closeModal;
}
function bindCards(){}
function setupCardDelegation(){
 if(document.body.dataset.cardDelegation==='1')return;document.body.dataset.cardDelegation='1';
 document.addEventListener('click',async e=>{
  const b=e.target.closest?.('[data-bizlink],[data-fav],[data-pin],[data-copy],[data-share],[data-error],[data-callpicker],a.call,a.wa');
  if(!b)return;
  if(b.matches('[data-bizlink]')){e.stopPropagation();openBizCard(b.dataset.bizlink);return}
  const el=b.closest('.card'),r=el&&S.byKey.get(`${el.dataset.file}::${el.dataset.id}`);
  if(!r)return;
  if(b.matches('[data-pin]')){e.stopPropagation();togglePin(r);return}
  if(b.matches('[data-fav]')){e.stopPropagation();toggleFav(r);return}
  if(b.matches('[data-callpicker]')){rememberAction(r);try{openCallPicker(JSON.parse(b.dataset.callpicker))}catch(err){}return}
  if(b.matches('a.call,a.wa')){rememberAction(r);return}
  if(b.matches('[data-copy]')){rememberAction(r);try{await navigator.clipboard.writeText(b.dataset.copy);toast(T('copiedToast'))}catch(err){toast(T('copyFailToast'))}return}
  if(b.matches('[data-share]')){rememberAction(r);const txt=b.dataset.share;try{if(navigator.share)await navigator.share({title:r.title,text:txt});else{await navigator.clipboard.writeText(txt);toast(T('shareCopiedToast'))}}catch(err){}return}
  if(b.matches('[data-error]')){rememberAction(r);openErrorEditor(r)}
 });
}
function superLabel(st){return S.lang==='kz'?st.kz:st.ru}
function subLabel(sb){return S.lang==='kz'?sb.kz:sb.ru}
/* v5.3.0.4: плитки 3-го уровня (вместо горизонтальных тегов). Названия — из categories.json (sb.tiles[]),
   индекс t2 = 4-й компонент Г17. t2, которого нет в списке плиток, попадает в автоплитку «Прочее» (t2=0). */
/* v5.4.0.0: пастельная радуга. Цвет задаётся в categories.json (hue у супер-плитки; у подкатегории перекрывает).
   Золотой цвет принадлежит ТОЛЬКО VIP-рекламе (.card-vip) и в радугу не входит. */
function hueOf(mainId,subId){
 const st=SUPER_TILES.find(x=>x.id===Number(mainId));
 const sb=subId?(SUB_TILES[mainId]||[]).find(x=>x.sub===Number(subId)):null;
 return 'hue-'+((sb&&sb.hue)||(st&&st.hue)||'sand');
}
/* v1.0.0.3: «1 контакт / 2 контакта / 5 контактов» */
function contactsLabel(n){n=Number(n)||0;if(S.lang==='kz')return `${n} ${T('contacts')}`;const m=n%100,d=n%10;const w=(m>=11&&m<=14)?'контактов':d===1?'контакт':(d>=2&&d<=4)?'контакта':'контактов';return `${n} ${w}`}
const plaqueHtml=(text,hue)=>`<div class="title-plaque ${hue}">${esc(text)}</div>`;
function tilesOf(sb){return sb&&Array.isArray(sb.tiles)&&sb.tiles.length?sb.tiles.filter(t=>!t.hidden):null}
function tileLabel(t){return S.lang==='kz'?(t.kz||t.ru):t.ru}
function otherTileLabel(sb){const o=(sb&&sb.otherTile)||OTHER_TILE;return S.lang==='kz'?(o.kz||o.ru||OTHER_TILE.kz):(o.ru||OTHER_TILE.ru)}
function rowT2(r){if(r&&r.resParts){const c=craftOf(r);return c?c.t2:0}const v=r&&r.homeParts?Number(r.homeParts[3]):0;return Number.isInteger(v)&&v>=0&&v<=9?v:0}
function effT2(r,tiles){const v=rowT2(r);return tiles.some(t=>t.t2===v)?v:0}
function currentSub(){return (SUB_TILES[S.tile]||[]).find(x=>x.sub===S.sub)}
function renderTileGrid(host,sb,rows){
 const tiles=tilesOf(sb)||[],cnt=new Map();
 rows.forEach(r=>{const k=effT2(r,tiles);cnt.set(k,(cnt.get(k)||0)+1)});
 const list=tiles.map(t=>({t2:t.t2,label:tileLabel(t),emoji:t.emoji||'📁',count:cnt.get(t.t2)||0}));
 if(!tiles.some(t=>t.t2===0)&&(cnt.get(0)||0)>0)list.push({t2:0,label:otherTileLabel(sb),emoji:(OTHER_TILE.emoji||'📂'),count:cnt.get(0)});
 host.innerHTML=`<div class="page v401-tiles tile3-grid">${list.map(x=>`<button type="button" class="tile pastel-tile ${hueOf(S.tile,S.sub)}" data-tile3="${x.t2}"><span class="tile-emoji">${esc(x.emoji)}</span><span class="tile-title">${esc(x.label)}</span><small class="tile3-foot"><span class="foot-id" aria-hidden="true">🪪</span><span class="foot-count">${esc(contactsLabel(x.count))}</span><span class="foot-go" aria-hidden="true">↗</span></small></button>`).join('')}</div><button type="button" class="back-capsule w100 tile3-all" id="tileAllBtn">${esc(T('tileShowAll'))} (${rows.length})</button>`;
 host.querySelectorAll('[data-tile3]').forEach(b=>b.addEventListener('click',()=>{S.tag=Number(b.dataset.tile3);renderFolder();renderCards();scrollTop()}));
 $('#tileAllBtn')?.addEventListener('click',()=>{S.tag=-1;renderFolder();renderCards();scrollTop()});
}

/* ===== Каскад 6x6 / список карточек ===== */
function renderTiles(){
  const host=$('#pages');if(!host)return;host.innerHTML='';document.querySelectorAll('#homeView>.stage-nav').forEach(e=>e.remove());
  const grid=document.createElement('div');
  const q=$('#homeQuick');
  if(S.stage==='sub'&&S.tile){
    grid.className='page v401-tiles substage';
    const subs=SUB_TILES[S.tile]||[];
    for(const sb of subs){
      if(sb.hidden)continue;
      const count=subTileRows(S.tile,sb.sub).length;
      const b=document.createElement('button');
      b.className='tile pastel-tile '+hueOf(S.tile,sb.sub);
      b.innerHTML=`<span class="tile-emoji">${esc(sb.emoji||'🔹')}</span><span class="tile-title">${esc(subLabel(sb))}</span><small class="tile3-foot"><span class="foot-id" aria-hidden="true">${tilesOf(sb)?'📂':'🪪'}</span><span class="foot-count">${esc(contactsLabel(count))}</span><span class="foot-go" aria-hidden="true">↗</span></small>`;
      b.onclick=()=>openSubTile(S.tile,sb.sub);
      grid.appendChild(b);
    }
    /* v5.3.0.4: главная кнопка «Назад» (в меню посёлка) вынесена из низа наверх — сразу под синюю кнопку «Добавить» — и прилипает при прокрутке. */
    const nav=document.createElement('div');nav.className='stage-nav';
    const stMain=SUPER_TILES.find(x=>x.id===S.tile);
    nav.innerHTML=`<button id="stageBackBtn" type="button" class="back-capsule back-wide">⬅️ ${esc(T('back'))}</button>${plaqueHtml(`${stMain?.emoji||''} ${stMain?superLabel(stMain):''}`.trim(),hueOf(S.tile))}`;
    const hv=$('#homeView');if(hv)hv.insertBefore(nav,hv.firstChild);host.appendChild(grid);
    if(q)q.innerHTML='';
    $('#stageBackBtn')?.addEventListener('click',()=>{S.stage='main';S.tile=null;render();scrollTop()});
    return;
  }
  grid.className='page v401-tiles';
  for(const st of SUPER_TILES){
    if(st.hidden)continue;
    const count=mainTileRows(st.id).length;
    const b=document.createElement('button');
    b.className='tile pastel-tile '+hueOf(st.id);
    b.innerHTML=`<span class="tile-emoji">${st.emoji}</span><span class="tile-title">${esc(superLabel(st))}</span><small class="tile3-foot"><span class="foot-id" aria-hidden="true">📂</span><span class="foot-count">${esc(contactsLabel(count))}</span><span class="foot-go" aria-hidden="true">↗</span></small>`;
    b.onclick=()=>openSuperTile(st.id);
    grid.appendChild(b);
  }
  host.appendChild(grid);
  if(q)q.innerHTML=`<button id="sosBtn" type="button" class="sos-compact">🆘 SOS</button><div class="chat-blocks"><button id="waBlock" type="button" class="chat-block wa">🟢 ${esc(T('chatWaTitle'))}</button><button id="tgBlock" type="button" class="chat-block tg">🔵 ${esc(T('chatTgTitle'))}</button></div><div class="home-smart-grid"><button class="smart-card" id="recentBtn">🕘<b>${esc(T('quickRecent'))}</b><small>${esc(T('quickRecentDesc'))}</small></button><button class="smart-card" id="popularBtn">⭐<b>${esc(T('quickPopular'))}</b><small>${esc(T('quickPopularDesc'))}</small></button></div>`;
  $('#sosBtn')?.addEventListener('click',()=>{
    showModal(`<div class="modal-content"><h2>${esc(T('sosTitle'))}</h2><div class="sos-grid">${CONFIG.EMERGENCY.map(n=>`<a href="tel:${n}">${n}</a>`).join('')}</div><div class="modal-actions"><button class="secondary" id="sosClose">${esc(T('sosClose'))}</button></div></div>`);
    const closeBtn=$('#sosClose');if(closeBtn)closeBtn.addEventListener('click',closeModal);
  });
  $('#waBlock')?.addEventListener('click',()=>openChats('wa'));
  $('#tgBlock')?.addEventListener('click',()=>openChats('tg'));
  $('#recentBtn')?.addEventListener('click',()=>showQuickList('recent','🕘 '+T('quickRecent')));
  $('#popularBtn')?.addEventListener('click',()=>showQuickList('popular','⭐ '+T('quickPopular')));
}
function openSuperTile(id){const n=Number(id);if(!Number.isInteger(n)||n<1||n>9)return;S.view='home';S.stage='sub';S.tile=n;S.sub=null;S.tag=null;render();scrollTop()}
function openSubTile(mainId,subId){const m=Number(mainId),s=Number(subId);if(!Number.isInteger(m)||!Number.isInteger(s))return;S.view='category';S.tile=m;S.sub=s;S.tag=null;S.alphabet='';S.search='';const inp=$('#searchInput');if(inp)inp.value='';render();scrollTop()}
function renderFolder(){
  const host=$('#categoryFolder');const mainId=S.tile,subId=S.sub;
  if(!host||!mainId||!subId)return;
  const sb=(SUB_TILES[mainId]||[]).find(x=>x.sub===subId);
  const tiles=tilesOf(sb);
  let subTitle=sb?subLabel(sb):'';
  if(tiles&&S.tag!==null){
    const t=tiles.find(x=>x.t2===S.tag);
    const tl=S.tag===-1?T('tileShowAll'):(t?tileLabel(t):otherTileLabel(sb));
    subTitle=`${subTitle} › ${tl}`;
  }
  host.innerHTML=`<div class="folder-head"><button class="back-capsule back-wide" id="folderBack">⬅️ ${esc(T('back'))}</button></div>`;
  const tb=$('#listToolbar');if(tb)tb.innerHTML=plaqueHtml(subTitle,hueOf(mainId,subId));
  $('#folderBack')?.addEventListener('click',()=>{
    if(tiles&&S.tag!==null){S.tag=null;renderFolder();renderCards();scrollTop();return}
    S.view='home';S.stage='sub';S.sub=null;S.tag=null;render();scrollTop()});
}
/* v5.2.0.1: двухсекционный карманный поиск на нативных details/summary
   (без своего JS-состояния toggle — встроенная доступность браузера,
   белый экран физически невозможен). Два кармана НЕЗАВИСИМЫ (не
   аккордеон), по умолчанию оба свёрнуты. Состояние "развёрнут/свёрнут"
   запоминается в S.pocketOpen и переживает перерисовку (например, от
   алфавитного радара по ЭТАП 2) — сбрасывается ТОЛЬКО когда реально
   меняется сама строка поиска. */
function renderSearchPockets(host,commercial,residents){
 if(S.lastPocketSearch!==S.search){S.pocketOpen={commercial:false,residents:false};S.lastPocketSearch=S.search}
 const commHtml=commercial.length?commercial.map(card).join(''):`<div class="card"><h3>${esc(T('noMatches'))}</h3></div>`;
 const resHtml=residents.length?residents.map(card).join(''):`<div class="card"><h3>${esc(T('noMatches'))}</h3></div>`;
 host.innerHTML=`
  <details class="search-pocket" id="pocketCommercial" ${S.pocketOpen.commercial?'open':''}>
   <summary>${esc(T('commercialPocketTitle',{count:commercial.length}))}</summary>
   <div class="search-pocket-body">${commHtml}</div>
  </details>
  <details class="search-pocket" id="pocketResidents" ${S.pocketOpen.residents?'open':''}>
   <summary>${esc(T('residentsPocketTitle',{count:residents.length}))}</summary>
   <div class="search-pocket-body">${resHtml}</div>
  </details>`;
 bindCards();
 $('#pocketCommercial')?.addEventListener('toggle',e=>{S.pocketOpen.commercial=e.target.open});
 $('#pocketResidents')?.addEventListener('toggle',e=>{S.pocketOpen.residents=e.target.open});
}
/* v5.4.0.0: пустая категория не прячется — по клику показывается дружелюбная заглушка. VIP-карточки всегда выше остальных. */
function renderEmptyStub(host){
 host.innerHTML=`<div class="empty-stub ${hueOf(S.tile,S.sub)}"><div class="empty-stub-emoji">🌱</div><p>${esc(T('emptyCategoryStub'))}</p></div>`;
}
/* v5.4.0.1: КАРУСЕЛЬ — VIP всегда наверху, а внутри VIP-блока порядок перемешивается заново при каждой загрузке страницы */
const VIP_SEED=Math.floor(Math.random()*2147483647)+1;
function vipRank(r){let h=VIP_SEED;const k=favKey(r);for(let i=0;i<k.length;i++)h=(Math.imul(h^k.charCodeAt(i),16777619)>>>0);return h}
function vipFirst(rows){const v=[],o=[];for(const r of rows)(isVip(r)?v:o).push(r);if(!v.length)return rows;v.sort((a,b)=>vipRank(a)-vipRank(b));return v.concat(o)}
function renderCards(){
  const host=$('#cards');if(!host)return;
  let rows=[];
  if(S.view==='category'){
    rows=subTileRows(S.tile,S.sub);
    if(!rows.length){renderEmptyStub(host);return}
    const sbx=currentSub(),tl=tilesOf(sbx);
    if(tl){
      if(S.tag===null){renderTileGrid(host,sbx,rows);return}
      if(S.tag!==-1)rows=rows.filter(r=>effT2(r,tl)===Number(S.tag));
      if(!rows.length){renderEmptyStub(host);return}
    }
  }
  else if(S.view==='residents') rows=residentRows();
  else if(S.view==='search') rows=searchRows();
  else if(S.view==='favorites'){renderFavoritesView(host);return}
  if(S.view==='home'||S.view==='more'){host.innerHTML='';return}
  rows=sortRows(rows,S.view==='residents'?'res':'default');
  rows=vipFirst(applyPinnedOnTop(rows));
  if(S.view==='search'&&S.search){
    const commercial=applyPinnedOnTop(rows.filter(r=>r.homeParts));
    const res=applyAlphabet(searchResidentsInVillage(S.search));
    renderSearchPockets(host,commercial,res);return;
  }
  host.innerHTML=rows.length?rows.map(card).join(''):`<div class="card"><h3>${esc(T('noResultsGeneric'))}</h3></div>`;
  bindCards();
}
function renderFavoritesView(host){
  let rows=currentVillageRows().filter(r=>S.favorites.has(favKey(r)));
  const stubKeys=favStubKeys();
  if(!rows.length&&!stubKeys.length){host.innerHTML=`<div class="card"><h3>${esc(T('favEmpty'))}</h3></div>`;bindCards();return}
  const mode=S.favSettings?.mode||'category';
  rows=sortFavorites(rows);
  const pinnedKeys=S.pinned||new Set();
  const pinnedRows=[],restRows=[];
  for(const r of rows){(pinnedKeys.has(favKey(r))?pinnedRows:restRows).push(r)}
  if(pinnedRows.length)pinnedRows.sort((a,b)=>S.pinnedOrder.indexOf(favKey(a))-S.pinnedOrder.indexOf(favKey(b)));
  let bodyHtml=pinnedRows.length?`<div class="search-block"><h2>${esc(T('pinnedGroupTitle'))}</h2>${pinnedRows.map(card).join('')}</div>`:'';
  if(mode==='category'){
    const groups=[];let curKey=null,curLabel=null,curList=[];
    for(const r of restRows){const gk=favGroupKey(r).join('/');if(gk!==curKey){if(curList.length)groups.push([curLabel,curList]);curKey=gk;curLabel=favGroupLabel(r);curList=[r]}else curList.push(r)}
    if(curList.length)groups.push([curLabel,curList]);
    bodyHtml+=groups.map(([label,list])=>`<div class="search-block"><h2>${esc(label)}</h2>${list.map(card).join('')}</div>`).join('');
  }else if(mode==='manual'){
    bodyHtml+=`<div class="fav-manual-list" id="favManualList">${restRows.map(r=>`<div class="fav-drag-item" data-favkey="${esc(favKey(r))}"><button class="fav-drag-handle" type="button" aria-label="${esc(T('favDragHandleAria'))}">⠿</button><div class="fav-drag-card">${card(r)}</div></div>`).join('')}</div>`;
  }else{
    bodyHtml+=restRows.map(card).join('');
  }
  if(S.favSettings?.showVip){
    const vipRows=currentVillageRows().filter(r=>isVip(r)&&!S.favorites.has(favKey(r)));
    if(vipRows.length)bodyHtml+=`<div class="search-block"><h2>${esc(T('vipRecommendGroupTitle'))}</h2>${vipRows.map(card).join('')}</div>`;
  }
  if(stubKeys.length)bodyHtml+=`<div class="search-block">${favStubsHtml(stubKeys)}</div>`;
  host.innerHTML=bodyHtml;bindCards();bindStubs(host);
  if(mode==='manual')setupFavDragDrop();
}
function favSettingsModal(){
  const m=S.favSettings?.mode||'category',vip=S.favSettings?.showVip!==false;
  showModal(`<div class="modal-content"><h2>${esc(T('favSettingsTitle'))}</h2>
   <div class="add-choice">
    <button class="choice-btn ${m==='alpha'?'choice-active':''}" data-favmode="alpha">${esc(T('favSortAlpha'))}</button>
    <button class="choice-btn ${m==='category'?'choice-active':''}" data-favmode="category">${esc(T('favSortCategory'))}</button>
    <button class="choice-btn ${m==='time'?'choice-active':''}" data-favmode="time">${esc(T('favSortTime'))}</button>
    <button class="choice-btn ${m==='manual'?'choice-active':''}" data-favmode="manual">${esc(T('favSortManual'))}</button>
   </div>
   <label class="fav-vip-check"><input type="checkbox" id="favShowVip" ${vip?'checked':''}> ${esc(T('favVipCheckbox'))}</label>
   <div class="modal-actions"><button class="secondary" id="favSettingsClose">${esc(T('favSettingsClose'))}</button></div>
  </div>`);
  $$('[data-favmode]').forEach(b=>b.onclick=()=>{S.favSettings.mode=b.dataset.favmode;saveFavSettings();closeModal();render()});
  const vipBox=$('#favShowVip');if(vipBox)vipBox.onchange=()=>{S.favSettings.showVip=vipBox.checked;saveFavSettings();render()};
  const cb=$('#favSettingsClose');if(cb)cb.onclick=closeModal;
}
function getDragAfterElement(container,y){const items=$$('#favManualList .fav-drag-item:not(.dragging)');return items.reduce((closest,child)=>{const box=child.getBoundingClientRect(),offset=y-box.top-box.height/2;if(offset<0&&offset>closest.offset)return{offset,element:child};return closest},{offset:-Infinity}).element}
function setupFavDragDrop(){
  const list=$('#favManualList');if(!list)return;
  $$('#favManualList .fav-drag-handle').forEach(handle=>{
    handle.onpointerdown=e=>{
      e.preventDefault();
      const dragEl=handle.closest('.fav-drag-item');if(!dragEl)return;
      dragEl.classList.add('dragging');
      const move=ev=>{const after=getDragAfterElement(list,ev.clientY);if(after==null)list.appendChild(dragEl);else list.insertBefore(dragEl,after)};
      const up=()=>{dragEl.classList.remove('dragging');S.favManualOrder=$$('#favManualList .fav-drag-item').map(x=>x.dataset.favkey);saveFavManualOrder();document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up)};
      document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});
    };
  });
}
const RU_ALPHABET='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
function renderAlphabet(){
 const host=$('#alphabetRadar');if(!host)return;
 if(S.view!=='residents'&&S.view!=='search'){host.classList.add('hidden');return}
 host.classList.remove('hidden');
 const letters=S.lang==='kz'?['А','Ә','Б','В','Г','Ғ','Д','Е','Ё','Ж','З','И','Й','К','Қ','Л','М','Н','Ң','О','Ө','П','Р','С','Т','У','Ұ','Ү','Ф','Х','Һ','Ц','Ч','Ш','Щ','Ъ','Ы','І','Ь','Э','Ю','Я']:RU_ALPHABET;
 const sourceRows=searchAlphabetSourceRows();
 const avail=new Set();
 for(const r of sourceRows){
  if(r.resParts){for(const k of residentAlphaKeys(r))avail.add(k)}
  else{const t=clean(r.title);if(t[0])avail.add(t[0].toUpperCase())}
 }
 if(S.alphabet&&!avail.has(S.alphabet))S.alphabet='';
 host.innerHTML=letters.map(ch=>{const on=avail.has(ch);return `<button class="alpha-btn ${S.alphabet===ch?'active':''} ${on?'':'dim'}" ${on?'':'disabled'} data-alpha="${ch}">${ch}</button>`}).join('');
 $$('[data-alpha]:not([disabled])').forEach(b=>b.onclick=()=>{S.alphabet=S.alphabet===b.dataset.alpha?'':b.dataset.alpha;renderAlphabet();renderCards()});
}
async function showQuickList(kind,title){
 const keys=quickKeys(kind);await ensureFilesLoaded(keys.map(k=>k.split('::')[0]));
 const rows=keys.map(k=>{const [file,id]=k.split('::');return S.rows.find(r=>r.file===file&&r.id===id)}).filter(Boolean);
 showModal(`<div class="modal-content quicklist-modal"><div class="quicklist-sticky-head"><button class="back-capsule big-action" id="quickBack">⬅️ ${esc(T('back'))}</button><h2>${esc(title)}</h2></div><div class="quicklist-body">${rows.length?rows.map(card).join(''):`<div class="card"><p>${esc(T('quickListEmpty'))}</p></div>`}</div></div>`);
 bindCards();$('#quickBack').onclick=closeModal;
}
function setLang(lang){if(lang!=='ru'&&lang!=='kz')return;S.lang=lang;storageSet('cart_lang',lang);$$('.lang').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));render()}
function renderMore(){
 const host=$('#cards');
 host.innerHTML=`<div class="card more-card"><button id="aboutMoreBtn" class="pastel-small w100">${esc(T('aboutMoreBtn'))}</button><div class="share-row"><button id="qrBtn" class="pastel-small">${esc(T('qrShareBtn'))}</button><button id="shareLinkBtn" class="pastel-small">${esc(T('shareLinkBtn'))}</button></div><button id="installBtn" class="pastel-small w100">${esc(T('installBtn'))}</button><button id="refreshDataBtn" class="admin-blue w100">${esc(T('refreshDataBtn'))}</button></div><div class="card"><div class="footer-main">${esc(T('footerCopyright'))}</div></div><div class="card stats-card" id="statsCard">${statsCardHtml((()=>{try{return JSON.parse(storageGet('cart_plat_stats','null'))}catch(e){return null}})())}</div>`;
 fillStatsCard();
 $('#aboutMoreBtn').onclick=infoModal;$('#qrBtn').onclick=showQR;$('#shareLinkBtn').onclick=shareLink;$('#installBtn').onclick=installPWA;$('#refreshDataBtn').onclick=refreshData;
}
/* Липкий блок «Назад»/плиток прижимается ровно под шапкой (под синей кнопкой «Добавить»): высота шапки меряется на лету. */
function syncFolderTop(){try{const h=$('#mainHeader');if(h)document.documentElement.style.setProperty('--folder-top',Math.round(h.getBoundingClientRect().height)+'px')}catch(e){}}
function render(){
  syncHeader();syncFolderTop();
  const home=$('#homeView'),list=$('#listView'),folder=$('#categoryFolder');
  if(home)home.classList.toggle('hidden',S.view!=='home');
  if(list)list.classList.toggle('hidden',S.view==='home');
  if(folder)folder.classList.toggle('hidden',S.view!=='category'&&S.view!=='chats');
  $('#searchRow')?.classList.toggle('hidden',!(S.view==='search'||S.view==='residents'));
  const inp=$('#searchInput');
  if(inp)inp.placeholder=S.view==='residents'?T('searchPlaceholderResidents'):T('searchPlaceholderAll');
  $('#bottomNav')?.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===S.view));
  renderAlphabet();
  if(S.view==='home'){renderTiles();renderCards()}
  else if(S.view==='category'){renderFolder();renderCards()}
  else if(S.view==='chats'){renderChats()}
  else if(S.view==='residents'){$('#listToolbar').innerHTML=`<div class="list-title">👥 ${esc(T('navResidents'))}</div>`;renderCards()}
  else if(S.view==='search'){$('#listToolbar').innerHTML=`<div class="list-title">🔎 ${esc(T('navSearch'))}</div>`;renderCards()}
  else if(S.view==='favorites'){$('#listToolbar').innerHTML=`<div class="list-title">⭐ ${esc(T('navFavorites'))}</div><button id="favSettingsBtn" class="fav-settings-btn" type="button" aria-label="${esc(T('favSettingsAria'))}">⚙️</button>`;const gb=$('#favSettingsBtn');if(gb)gb.onclick=favSettingsModal;renderCards()}
  else{$('#listToolbar').innerHTML=`<div class="list-title">… ${esc(T('navMore'))}</div>`;renderMore()}
}
/* v1.0.0.3: ШТОРКА ХЕДЕРА. Язычок справа от синей плашки сворачивает всю шапку «Картотека» вверх; состояние запоминается
   навсегда (localStorage) и не сбрасывается при переходах по категориям и вкладкам, т.к. класс висит на body. */
let HDR_COLLAPSED=(()=>{try{return storageGet('cart_hdr_collapsed','')==='1'}catch(e){return false}})();
function applyHeaderCollapse(){
 document.body.classList.toggle('hdr-collapsed',HDR_COLLAPSED);
 const t=$('#headerToggle');if(t){t.textContent=HDR_COLLAPSED?'🔽':'🔼';t.setAttribute('aria-expanded',String(!HDR_COLLAPSED));t.setAttribute('aria-label',T(HDR_COLLAPSED?'hdrExpand':'hdrCollapse'))}
}
function syncHeader(){
 const vc=$('#villagePicker');if(vc)vc.textContent=T('villagePickerBtn',{village:villageLabel(S.village)});
 const lt=$('#langToggle');if(lt)lt.textContent=S.lang==='kz'?'KZ':'RU';
 const pl=$('#postalLine');if(pl)pl.textContent=T('postalPrefix',{code:postalFor(S.village)});
 const z=$('#headerAddZone');
 if(z){z.innerHTML=`<div class="header-add-row"><button id="headerAddBusiness" class="header-add primary">${esc(T('addUnifiedBtn'))}</button><button id="headerToggle" class="header-toggle" type="button"></button></div>`;const bb=$('#headerAddBusiness');if(bb)bb.onclick=openAdd;const tg=$('#headerToggle');if(tg)tg.onclick=()=>{HDR_COLLAPSED=!HDR_COLLAPSED;try{storageSet('cart_hdr_collapsed',HDR_COLLAPSED?'1':'0')}catch(e){}applyHeaderCollapse()}}
 applyHeaderCollapse();
}
function districtOfVillage(name){const g=GEO.villages.find(v=>v.nameRu===name);return (g&&g.districtSlug)||'beyterek'}
function postalFor(villageName){const g=geoVillageByName(districtOfVillage(villageName),villageName);const code=g&&g.postalCode?g.postalCode:'';return code||T('postalUnknown')}
function cycleLang(){setLang(S.lang==='ru'?'kz':'ru')}
/* ===== v5.3.0.1: HISTORY API — жест «Назад» Андроида =====
   Окно (модальная папка) при открытии добавляет одну запись в историю, а
   жест «Назад» (боковой свайп без нижних кнопок) её снимает и закрывает
   окно, не покидая сайт. Программное закрытие окна снимает запись через
   history.back() с очередью (backPending), чтобы быстрая смена окон не
   запутала историю. На главном экране без окон первый «Назад» показывает
   подсказку, второй в течение 2 секунд выходит. Внутри раздела (категория,
   Поиск, Избранное) «Назад» возвращает на главный экран. */
let modalOpen=false,modalEntry=false,backPending=false,lastBackAt=0;
function syncModalHistory(){
 try{
  if(backPending)return;
  if(modalOpen&&!modalEntry){history.pushState({cartModal:1},'');modalEntry=true}
  else if(!modalOpen&&modalEntry){backPending=true;modalEntry=false;history.back()}
 }catch(e){}
}
function showModal(html){$('#modalRoot').innerHTML=`<div class="modal-backdrop"><div>${html}</div></div>`;modalOpen=true;syncModalHistory()}
function closeModal(){$('#modalRoot').innerHTML='';modalOpen=false;syncModalHistory()}
function atHomeRoot(){return S.view==='home'&&(S.stage==='main'||!S.stage)&&S.tile==null}
function setupHistory(){
 try{
  if(!(history.state&&history.state.cartTop)){history.replaceState({cartRoot:1},'');history.pushState({cartTop:1},'')}
  window.addEventListener('popstate',()=>{
   if(backPending){backPending=false;syncModalHistory();return}
   if(modalEntry){modalEntry=false;modalOpen=false;$('#modalRoot').innerHTML='';return}
   if(!atHomeRoot()){
    S.view='home';S.stage='main';S.tile=null;S.sub=null;S.tag=null;S.search='';S.alphabet='';
    const inp=$('#searchInput');if(inp)inp.value='';
    render();scrollTop();history.pushState({cartTop:1},'');return;
   }
   const now=Date.now();
   if(now-lastBackAt<2000){history.back();return}
   lastBackAt=now;toast(T('backAgainToast'));history.pushState({cartTop:1},'');
  });
 }catch(e){}
}
/* ===== v5.3.0.1: СВАЙПЫ ГЛАВНЫХ ЭКРАНОВ (Touch Events) =====
   Домашняя ↔ Поиск ↔ Избранное. Реагируем только на явно горизонтальный
   быстрый жест, начатый в центральной зоне экрана (от 18% до 82% ширины),
   чтобы не пересекаться с системным жестом «Назад» у краёв. Не срабатывает
   при открытом окне, в полях ввода и на горизонтально прокручиваемых
   элементах (карусели). Переключение — то же, что у нижней навигации. */
function setupSwipes(){
 const ORDER=['home','search','favorites'];
 let sx=0,sy=0,st=0,ok=false;
 const blocked=el=>{
  for(let n=el;n&&n!==document.body;n=n.parentElement){
   const tag=n.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return true;
   if(n.hasAttribute&&n.hasAttribute('data-noswipe'))return true;
   if(n.scrollWidth>n.clientWidth+4){const ox=getComputedStyle(n).overflowX;if(ox==='auto'||ox==='scroll')return true}
  }
  return false;
 };
 document.addEventListener('touchstart',e=>{
  ok=false;if(modalOpen||e.touches.length!==1)return;
  const t=e.touches[0],w=window.innerWidth;
  if(t.clientX<w*0.18||t.clientX>w*0.82)return;
  if(blocked(e.target))return;
  sx=t.clientX;sy=t.clientY;st=Date.now();ok=true;
 },{passive:true});
 document.addEventListener('touchend',e=>{
  if(!ok||modalOpen)return;ok=false;
  const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;
  if(Date.now()-st>700||Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)*0.5)return;
  let cur=S.view==='category'?'home':S.view;
  const i=ORDER.indexOf(cur);if(i<0)return;
  const j=dx<0?i+1:i-1;if(j<0||j>=ORDER.length)return;
  const v=ORDER[j];
  S.view=v;S.stage='main';S.tile=null;S.sub=null;S.tag=null;
  if(v!=='search'){S.search='';S.alphabet='';const inp=$('#searchInput');if(inp)inp.value=''}
  render();scrollTop();
 },{passive:true});
}
/* v5.4.0.1: плашка-подтверждение сверху экрана (видна поверх окон пульта) */
let PULT_KEEP={telegramBotToken:'',telegramChatId:''};
function banner(msg,bad){
 let b=document.getElementById('topBanner');
 if(!b){b=document.createElement('div');b.id='topBanner';b.setAttribute('role','status');b.setAttribute('aria-live','polite');document.body.appendChild(b)}
 b.textContent=msg;b.className='top-banner show'+(bad?' bad':'');
 clearTimeout(banner._t);banner._t=setTimeout(()=>b.classList.remove('show'),bad?5200:3600);
}
function toast(s){const e=$('#toast');e.textContent=s;e.classList.add('show');setTimeout(()=>e.classList.remove("show"),3200)}
function scrollTop(){window.scrollTo({top:0,behavior:'smooth'})}
function infoModal(){showModal(`<div class="modal-content"><h2>${esc(T('infoTitle'))}</h2><p>${esc(T('infoText'))}</p><div class="modal-actions"><button class="secondary" id="closeInfo">${esc(T('close'))}</button></div></div>`);const b=$('#closeInfo');if(b)b.onclick=closeModal}
function shareUrl(){
 const u=clean(APP_CFG.qrShareUrl||'');if(u)return u;
 try{if(/\.github\.io$/i.test(location.hostname))return location.origin+location.pathname.replace(/[^/]*$/,'')}catch(e){}
 return '';
}
async function shareLink(){
 const url=shareUrl();if(!url){toast(T('qrMissingUrl'));return}
 const text=clean(APP_CFG.shareAppText||'');
 try{if(navigator.share){await navigator.share({title:T('shareLinkTitle'),text,url});return}}catch(e){if(e&&e.name==='AbortError')return}
 try{await navigator.clipboard.writeText((text?text+'\n':'')+url);toast(T('shareCopiedToast'))}catch(e){toast(T('copyFailToast'))}
}
function showQR(){
 const url=shareUrl();let svg='';
 try{if(!url)throw Error(T('qrMissingUrl'));svg=window.LocalQR.svg(url)}catch(e){svg=`<div class="card"><b>${esc(T('qrNotBuilt'))}</b><p>${esc(e.message)}</p></div>`}
 showModal(`<div class="modal-content qr-modal"><h2>${esc(T('qrModalTitle'))}</h2><div class="qr-wrap">${svg}</div><code>${esc(url||'(—)')}</code><p class="hint">${esc(T('qrHint'))}</p><div class="modal-actions"><button class="primary" id="qrShareLink">${esc(T('shareLinkBtn'))}</button><button class="secondary" id="qrClose">${esc(T('qrClose'))}</button></div></div>`);
 $('#qrClose').onclick=closeModal;$('#qrShareLink').onclick=shareLink;
}
async function installPWA(){if(S.installPrompt){S.installPrompt.prompt();try{await S.installPrompt.userChoice}catch(e){}S.installPrompt=null;return}toast(T('installUnavailableToast'))}
function wheelHtml(id,label,items,value){const target=String(value??items[0]?.value??items[0]??'');return `<div class="wheel-field"><div class="wheel-label">${esc(label)}</div><div class="wheel-viewport" id="wheel-${esc(id)}" data-wheel-value="${esc(target)}"><div class="wheel-spacer"></div>${items.map(x=>{const o=typeof x==='object'?x:{value:x,label:x};return`<button type="button" class="wheel-item ${String(o.value)===target?'active':''}" data-wheel-value="${esc(o.value)}">${esc(o.label)}</button>`}).join('')}<div class="wheel-spacer"></div><div class="wheel-center"></div></div></div>`}
function setupWheel(id,items,value,onChange){const el=$(`#wheel-${id}`);if(!el)return;const opts=items.map(x=>typeof x==='object'?x:{value:x,label:x}),h=48,idx=Math.max(0,opts.findIndex(x=>String(x.value)===String(value)));el.scrollTop=idx*h;const commit=()=>{const n=Math.max(0,Math.min(opts.length-1,Math.round(el.scrollTop/h))),o=opts[n];el.dataset.wheelValue=String(o.value);el.querySelectorAll('.wheel-item').forEach((b,i)=>b.classList.toggle('active',i===n));onChange?.(o.value)};let tm=0;el.addEventListener('scroll',()=>{clearTimeout(tm);tm=setTimeout(commit,70)});el.querySelectorAll('.wheel-item').forEach((b,i)=>b.onclick=()=>{el.scrollTo({top:i*h,behavior:'smooth'});setTimeout(commit,140)});commit()}
function wheelValue(id){return $(`#wheel-${id}`)?.dataset.wheelValue||''}

/* ===== Автоматика ID / сбор строки анкеты ===== */
/* v5.2.0.4: ДИНАМИЧЕСКИЙ КАСКАД ID В ПОРЯДКЕ ОЧЕРЕДИ (+1). Раньше ID
   следующей заявки считался только от уже загруженных строк базы
   (S.rows) — если в локальной очереди на модерацию уже висело несколько
   НОВЫХ заявок подряд в одну и ту же категорию (ещё не применённых
   админом в базу), каждая из них независимо получала один и тот же
   «первый свободный» ID, потому что S.rows не менялся между заявками.
   Теперь перед выдачей ID в расчёт ОБЯЗАТЕЛЬНО подмешиваются ID уже
   стоящих в очереди (queueLocal()) заявок того же села/бакета — так
   вторая заявка подряд честно получает +1 от первой, третья — +1 от
   второй, и т.д., в порядке очереди. */
function pendingFieldsForFile(file){
 return queueLocal().filter(q=>q.kind==='NEW'&&q.file===file&&q.candidateRow).map(q=>q.candidateRow.split(' | ')).filter(f=>f.length===20);
}

/* ===== v5.3.0.5: ИЗОЛЯЦИЯ ID ПО СЕЛАМ =====
   Номер новой карточки считается ТОЛЬКО по файлу выбранной в анкете зоны
   (а не по просматриваемому сейчас селу): живые строки + карантин этого файла,
   «сожжённые» ID из id_aliases.json и заявки телефона для этого же файла.
   Бизнес: максимум внутри «сотни» + 1 (в пустом селе 1101, 1201…),
   жители: максимум ≥10000 + 1 (в пустом селе строго 10001). Дыры не заполняются. */
function zoneUsedIdsBase(file){
 const used=new Set(),info=S.files.get(file);
 if(info&&info.text){for(const ln of String(info.text).split(/\r?\n/)){const t=ln.trim();if(!t||t[0]==='#')continue;const n=Number(t.split(' | ')[0]);if(Number.isFinite(n))used.add(n)}}
 try{for(const k of Object.keys(ALIASES||{})){const i=k.indexOf('::');if(i>0&&k.slice(0,i)===file){const n=Number(k.slice(i+2));if(Number.isFinite(n))used.add(n)}}}catch(e){}
 return used;
}
function zoneUsedIds(file){
 const used=zoneUsedIdsBase(file);
 for(const f of pendingFieldsForFile(file)){const n=Number(f[0]);if(Number.isFinite(n))used.add(n)}
 return used;
}
function maxInSet(used,res,bucket){
 if(res){let m=10000;used.forEach(n=>{if(n>m)m=n});return m}
 const base=bucket*100;let m=base;used.forEach(n=>{if(n>base&&n<=base+99&&n>m)m=n});return m;
}
function nextZoneId(file,resident,mainId,subId,used){
 used=used||zoneUsedIds(file);
 if(resident)return String(maxInSet(used,true)+1);
 const bucket=Number(mainId)*10+Number(subId),base=bucket*100,m=maxInSet(used,false,bucket);
 if(m<base+99)return String(m+1);
 for(let n=1;n<=99;n++)if(!used.has(base+n))return String(base+n);
 return String(base+99);
}
function bucketOfFields(f){
 const home=f[16]&&f[16]!=='0'?f[16].split('/'):null,res=f[17]&&f[17]!=='0'?f[17].split('/'):null;
 if(res)return{res:true,bucket:0};
 if(home){const c=Number(home[1]),sb=Number(home[2]);if(c>=1&&c<=9&&sb>=1&&sb<=9)return{res:false,bucket:c*10+sb}}
 return null;
}
/* Аудит очереди пульта: ищет заявки NEW, чей ID не соответствует графе «Село»,
   и строит план пересчёта (универсально, для любой зоны). */
function auditQueueIds(items){
 const flags=new Map(),plan=[],groups=new Map();
 for(const it of items){if(it.kind!=='NEW'||!it.file)continue;if(it.status!=='Новая'&&it.status!=='Одобрена')continue;if(!groups.has(it.file))groups.set(it.file,[]);groups.get(it.file).push(it)}
 for(const [file,list] of groups){
  const v=CONFIG.VILLAGES.find(x=>x.file===file);if(!v)continue;
  const live=zoneUsedIdsBase(file),liveText=String(S.files.get(file)?.text||'');
  const liveLines=new Map();for(const ln of liveText.split(/\r?\n/)){const t=ln.trim();if(!t||t[0]==='#')continue;const p=t.split(' | ');liveLines.set(p[0],p)}
  const counters=new Map(),seen=new Set(),per=[];
  for(const it of list){
   const f=String(it.row||'').split(' | ');
   if(f.length!==20)continue;
   const lv=liveLines.get(f[0]);
   if(lv&&lv[2]===f[2]){per.push({it,f,skip:true});continue}  // уже внесена в файл
   const b=bucketOfFields(f),id=Number(f[0]);let reason='';
   if(!b||!Number.isFinite(id)){per.push({it,f,skip:true});continue}
   {
    const key=b.res?'R':b.bucket,k=(counters.get(key)||0)+1;counters.set(key,k);
    const shapeOk=b.res?id>=10001:(id<10000&&Math.floor(id/100)===b.bucket);
    if(!shapeOk)reason='bucket';
    else if(live.has(id))reason='clash';
    else if(seen.has(id))reason='dup';
    else if(id>maxInSet(live,b.res,b.bucket)+k)reason='gap';
   }
   if(!reason){const xh=(f[16]!=='0'?f[16]:f[17]).split('/')[0];if(Number(xh)!==v.index||f[10]!==`с. ${v.name}`)reason='zone'}
   seen.add(id);per.push({it,f,b,reason});
  }
  if(!per.some(p=>p.reason))continue;
  const taken=new Set(live);
  for(const p of per){if(!p.skip&&p.f&&!p.reason)taken.add(Number(p.f[0]))}
  for(const p of per){
   if(!p.reason||!p.f)continue;
   flags.set(p.it.uid,p.reason);
   const f=p.f.slice();let nid=Number(f[0]);
   if(p.b&&p.reason!=='zone'){const n=nextZoneId(file,p.b.res,p.b.bucket?Math.floor(p.b.bucket/10):0,p.b.bucket%10,taken);nid=Number(n);taken.add(nid)}
   f[0]=String(nid);f[10]=`с. ${v.name}`;
   for(const i of[16,17,18]){if(f[i]&&f[i]!=='0'){const a=f[i].split('/');a[0]=String(v.index);f[i]=a.join('/')}}
   plan.push({uid:p.it.uid,id:String(nid),oldId:p.f[0],title:f[2],row:f.join(' | ')});
  }
 }
 return{flags,plan};
}
function nextFreeIdInBucket(mainId,subId,extraFields){
 const base=Number(mainId)*1000+Number(subId)*100;
 const used=new Set(subTileRows(mainId,subId).map(r=>Number(r.id)).filter(Number.isFinite));
 if(extraFields)for(const f of extraFields){if(f[16]&&f[16]!=='0'){const m=f[16].split('/');if(Number(m[1])===Number(mainId)&&Number(m[2])===Number(subId)){const n=Number(f[0]);if(Number.isFinite(n))used.add(n)}}}
 for(let s=1;s<=99;s++){if(!used.has(base+s))return String(base+s)}
 return String(base+99);
}
/* v5.2.0.0: маркер готовой строки для ЛОКАЛЬНОЙ очереди модерации остаётся
   «NEW» (как и раньше — так Живой Карантин и Очередь заявок администратора
   продолжают видеть её как неподтверждённую). В Google Таблицу (v5.3.0.0)
   строка уходит функцией sendPendingToIntake, копия для вставки в .txt
   села получает маркер «$» при копировании в окне «Очередь заявок». */
/* v5.2.0.3: сверхподробный автопилот фильтрации Г6/Г7/Г8. Никогда не
   полагаемся на то, что живая вёрстка поля (enforcePhonePrefix) уже
   всё почистила — на отправке Анкеты данные ВСЕГДА прогоняются через
   этот единый фильтр заново, это последний и единственный рубеж перед
   записью в базу.
   Г6 (городской) — только чистые цифры, без скобок/пробелов/тире; если
   после чистки цифр не осталось — ровно одна точка «.».
   Г7/Г8 (сотовые) — ровная строка вида «+77778631126» (код страны 7 +
   10 цифр, 8-префикс honestly нормализуется в 7); если после чистки
   получилось МЕНЬШЕ 11 цифр (поле реально пустое, либо тронуто вёрсткой
   «+7 », но пользователь ничего не дописал) — НАГЛУХО запрещено
   оставлять голый «+7»: пишется ровно одна точка «.». */
/* v5.3.0.1: автоподхват телефонного кода района. Если вбит короткий
   городской номер (до 7 цифр) и код села известен из геоданных — код
   (напр. 71130) дописывается спереди. Полные номера не трогаются. */
function villageCityCode(villageName){
 const name=clean(villageName).replace(/^с\.\s*/i,'');
 const gv=GEO.villages.find(v=>clean(v.nameRu)===name)||geoVillageByName('beyterek',name);
 const d=geoDistrictBySlug(gv?.districtSlug||'beyterek');
 return String((gv&&gv.atcCode)||(d&&d.phoneCode)||'').replace(/\D/g,'');
}
function sanitizeCityDigits(raw,code){
 let digits=String(raw||'').replace(/\D/g,'');
 if(!digits)return '.';
 const c=String(code||'').replace(/\D/g,'');
 if(c&&digits.length<=7&&!digits.startsWith(c))digits=c+digits;
 return digits;
}
function sanitizeMobileE164(raw){
 let digits=String(raw||'').replace(/\D/g,'');
 if(digits.length===10)digits='7'+digits;   // v5.4.0.0: ввод начинается с кода оператора (705…), «+7» — отдельная плашка
 if(digits.length===11&&digits.startsWith('8'))digits='7'+digits.slice(1);
 if(digits&&!digits.startsWith('7'))digits='7'+digits;
 if(digits.length!==11)return'.';
 return'+'+digits;
}
function buildCandidateRow(fd,mode){
 const resident=mode==='resident',village=clean(fd.get('geo')),districtSlug=clean(fd.get('geoDistrict'))||'beyterek',gv=geoVillageByName(districtSlug,village),activeVillage=CONFIG.VILLAGES.find(v=>v.name===village),file=activeVillage?.file||villageFile(),X=xOfFile(file);
 const folderMainId=Number(fd.get('superTile'))||6;
 const mainId=Number(fd.get('superTile'))||6,subId=Number(fd.get('subTile'))||6;
 const subMeta=(SUB_TILES[mainId]||[]).find(s=>s.sub===subId);
 /* v5.2.0.3: Г2 для бизнеса склеивается через тире «Главная — Подкатегория»,
    а не одной лишь главной плиткой, как раньше. */
 const mainTileMeta=SUPER_TILES.find(x=>x.id===folderMainId);
 const folder=resident?'ЖИТЕЛИ':(mainTileMeta?`${superLabel(mainTileMeta)}${subMeta?' — '+subLabel(subMeta):''}`:'ПРОЧЕЕ');
 const title=clean(fd.get('title'))||'.',person=clean(fd.get('person'))||'.',address=clean(fd.get('address'))||'.';
 const city=sanitizeCityDigits(fd.get('city'),villageCityCode(fd.get('geo'))),m1=sanitizeMobileE164(fd.get('mobile1')),m2=sanitizeMobileE164(fd.get('mobile2'));
 const lunch=clean(fd.get('lunchValue'));
 let tags=clean(fd.get('tags'))||'.',social=resident?'.':clean(fd.get('social'))||'.',schedule=clean(fd.get('scheduleValue'))||T('scheduleNoneValue');
 if(lunch)schedule=`${schedule}${T('schedulePreviewLunch',{value:lunch})}`;
 const shift=/^SHIFT\|/i.test(schedule);
 /* v5.3.0.4: T2 — явный выбор плитки в Анкете; если выбран «авто» — подбор по названию/тегам относительно названий плиток из categories.json. */
 function matchTileIndex(sb,typedText){const tl=tilesOf(sb);if(!tl||!typedText)return 0;const hay=norm(typedText);let best=0,bestLen=0;for(const t of tl){for(const nm of [t.ru,t.kz]){const w=norm(nm||'');if(!w)continue;for(const part of w.split(/[\/,;]+/).map(x=>x.trim()).filter(x=>x.length>2)){if(hay.includes(part)&&part.length>bestLen){best=t.t2;bestLen=part.length}}}}return best}
 const pickT2=clean(fd.get('tileT2'));
 const T2tag=resident?0:(pickT2!==''&&/^[0-9]$/.test(pickT2)&&tilesOf(subMeta)?Number(pickT2):matchTileIndex(subMeta,`${clean(fd.get('title'))} ${tags}`));
 const Lx=city!=='.'?'1':'0',W1=fd.get('wa1')==='on'?'1':'0',W2=fd.get('wa2')==='on'?'1':'0',G=shift?4:(/^Круглосуточно/i.test(schedule)?2:(/по звонку|выезд/i.test(schedule)?3:1));
 const home=resident?'0':`${X}/${mainId}/${subId}/${T2tag}/${G}/${Lx}/${W1}/${W2}/0/0`,res=resident?`${X}/P/${Lx}/${W1}/${W2}/0/0`:'0';
 const hasPhone=(m1!=='.'||m2!=='.')?'1':'0',K2=resident?'2':'1',hasWa=(W1==='1'||W2==='1')?'1':'0';
 const search=`${X}/${hasPhone}/${K2}/${hasWa}/${T2tag}/0/0`;
 const isNewVillage=!!gv&&!villageHasRealFile(gv);
 /* v5.2.0.1 (Вариант А): для жителя ID больше НЕ оставляется пустым —
    строгий append-only каскад (максимум существующего ID жителя этого
    села, не ниже 10000, +1 — пустое село получает честный первый 10001,
    retired ID никогда не переиспользуются). v5.2.0.4: в расчёт ОБЯЗАТЕЛЬНО
    подмешиваются ID уже стоящих в локальной очереди (ещё не применённых
    админом) заявок того же села/бакета — каскад +1 честно работает даже
    если несколько заявок подряд уходят в очередь без перезагрузки. */
 const pendingForFile=pendingFieldsForFile(file);
 const id=isNewVillage?String(CONFIG.VILLAGES.length+1):nextZoneId(file,resident,mainId,subId);
 /* v5.2.0.3: Г11 — строго официальное имя села «с. {Название}», без
    служебного технического префикса «зона». */
 return [id,folder,title,resident?'.':person,resident?person:'.',city,m1,m2,address,tags,`с. ${village}`,schedule,social,'R','R','R',home,res,search,'NEW'].join(' | ');
}
/* ===== v1.0.0.3: блоки «Группы WhatsApp» / «Каналы Telegram» и анкета «Добавить ссылку» ===== */
/* v1.0.0.3: официальная группа WhatsApp с. Дарьинское зашита в код и выводится с первого запуска (строка в формате базы, Г4 склеивается без пробелов). */
const DEFAULT_CHATS=[{file:'baza_zko_baiterek_daryinskoe.txt',row:['0001','Дарьинск. Адресная и Телефонная база','Поиск номеров телефона ☎️ 📝 и адресов 🏪 магазинов, ЦОН, аптека, почта, парикмахерская и так далее..🏡⛪🏢🏥🏪⛲🏦 Нажмите, чтобы вступить в группу WhatsApp.','h t t p s : / / c h a t . w h a t s a p p . c o m / C w 9 L e h x o M u Z L S 0 v w V S 3 y v 0 ? s = c l & p = a & i a m = 2'.replace(/\s+/g,''),'.','.','.','.','.','.','.','.','.','R','R','R','0','0','0','wa']}];
function ensureDefaultChats(file){
 for(const d of DEFAULT_CHATS){
  if(d.file!==file)continue;
  const c=chatOf(d.row,file);if(!c)continue;
  if(!(S.chats||[]).some(x=>x.file===file&&x.link.toLowerCase()===c.link.toLowerCase()))S.chats.push(c);
 }
}
/* v1.0.0.3: блоки под SOS — «парадные двери»: отдельный экран раздела (S.view='chats'), без модальных окон. */
async function openChats(kind){
 S.view='chats';S.chatKind=kind==='tg'?'tg':'wa';S.tile=null;S.sub=null;S.tag=null;S.search='';
 render();scrollTop();
 const file=villageFile();
 if(file&&!S.loaded.has(file)){try{await ensureFilesLoaded([file])}catch(e){}if(S.view==='chats')render()}
}
function renderChats(){
 const kind=S.chatKind==='tg'?'tg':'wa',file=villageFile();
 const host=$('#categoryFolder');
 if(host){host.innerHTML=`<div class="folder-head"><button class="back-capsule back-wide" id="folderBack">⬅️ ${esc(T('back'))}</button></div>`;
  $('#folderBack')?.addEventListener('click',()=>{S.view='home';S.stage='main';S.tile=null;render();scrollTop()})}
 const tb=$('#listToolbar');if(tb)tb.innerHTML=plaqueHtml((kind==='wa'?'🟢 ':'🔵 ')+T(kind==='wa'?'chatWaTitle':'chatTgTitle'),kind==='wa'?'hue-green':'hue-sky');
 const list=(S.chats||[]).filter(c=>c.file===file&&c.kind===kind).sort((a,b)=>Number(a.id)-Number(b.id));
 const cards=$('#cards');if(!cards)return;
 cards.innerHTML=list.length?list.map((c,i)=>`<div class="card chat-card card-hue ${kind==='wa'?'hue-green':'hue-sky'}"><a class="chat-main" href="${esc(c.link)}" target="_blank" rel="noopener noreferrer"><h3>${esc(c.name)}</h3>${c.desc?`<p class="card-desc chat-desc">${esc(c.desc)}</p>`:''}<span class="chat-go" aria-hidden="true">↗</span></a><div class="chat-actions"><button type="button" class="chat-act chat-copy" data-ci="${i}">${esc(T('chatCopyBtn'))}</button><button type="button" class="chat-act chat-share" data-ci="${i}">${esc(T('chatShareBtn'))}</button><button type="button" class="chat-act chat-dead" data-ci="${i}">${esc(T('chatDeadBtn'))}</button></div></div>`).join(''):`<div class="card"><p class="card-desc">${esc(T('chatEmpty'))}</p></div>`;
 const pick=b=>list[Number(b.dataset.ci)];
 cards.querySelectorAll('.chat-copy').forEach(b=>b.onclick=async()=>{const c=pick(b);if(c){await copyText(c.link);toast(T('chatCopiedToast'))}});
 cards.querySelectorAll('.chat-share').forEach(b=>b.onclick=async()=>{
  const c=pick(b);if(!c)return;
  if(navigator.share){try{await navigator.share({title:c.name,text:c.desc||c.name,url:c.link})}catch(e){}}
  else{await copyText(c.link);toast(T('chatCopiedToast'))}
 });
 cards.querySelectorAll('.chat-dead').forEach(b=>b.onclick=()=>{const c=pick(b);if(c)chatDeadAsk(c)});
}
async function copyText(t){
 try{await navigator.clipboard.writeText(t);return true}catch(e){}
 try{const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok}catch(e){return false}
}
/* Жалоба «Ссылка сброшена»: сначала окно проверки, сигнал уходит ТОЛЬКО после подтверждения. Одна жалоба с устройства на чат. */
function chatDeadAsk(c){
 showModal(`<div class="modal-content"><h2>⚠️ ${esc(T('chatDeadAskTitle'))}</h2><p class="card-desc">«${esc(c.name)}»</p><div class="modal-actions"><button class="primary big-action" id="deadYes" type="button">${esc(T('chatDeadYes'))}</button><button class="secondary big-action" id="deadNo" type="button">${esc(T('chatDeadNo'))}</button></div></div>`);
 $('#deadNo').onclick=closeModal;
 $('#deadYes').onclick=async()=>{
  const dev=(await deviceId()).slice(0,12),key=`${dev}-${c.file}-${c.id}`;
  let sent=[];try{sent=JSON.parse(storageGet('cart_chatdead','[]'))||[]}catch(e){}
  if(sent.includes(key)){closeModal();toast(T('chatDeadAlready'));return}
  sent.push(key);try{storageSet('cart_chatdead',JSON.stringify(sent.slice(-200)))}catch(e){}
  enqueueRequest({uid:'dead-'+key,status:'PENDING',kind:'DELETE',createdAt:new Date().toISOString(),village:villageObj()?.name||'',file:c.file,id:c.id,reason:'Ссылка сброшена',candidateRow:c.raw,schema:SCHEMA});
  closeModal();toast(T('chatDeadSent'));sendPendingToIntake().catch(()=>{});
 };
}
function nextChatId(file){
 /* первый свободный индекс 0001–1100 в этом селе: файл (в Дарьинском 0001 занят вечной группой) + заявки в очереди телефона */
 const used=new Set();
 for(const c of S.chats||[])if(c.file===file)used.add(Number(c.id)||0);
 for(const q of queueLocal()){if(q.file!==file||q.kind!=='NEW')continue;const f=String(q.candidateRow||'').split(' | ');if(f.length===20&&CHAT_MARKER_RE.test(f[19]))used.add(Number(f[0])||0)}
 for(let n=1;n<=1100;n++)if(!used.has(n))return n;
 return 1101;
}
function openChatForm(){
 const v=villageObj();if(!v)return;
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="chatBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('chatFormTitle'))}</h2></div><div class="hint">📍 ${esc(villageLabel(v.name))}</div><form id="chatForm" class="form-grid"><label>${esc(T('chatFName'))}<input name="name" maxlength="60" required autocomplete="off"></label><label>${esc(T('chatFDesc'))}<input name="desc" maxlength="140" required autocomplete="off"></label><label>${esc(T('chatFLink'))}<input name="link" type="text" inputmode="url" maxlength="300" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://chat.whatsapp.com/… или https://t.me/…"></label><div class="modal-actions"><button class="primary big-action" type="submit">${esc(T('chatFSend'))}</button><button class="secondary" type="button" id="chatCancel">${esc(T('addCancelBtn'))}</button></div></form></div>`);
 $('#chatBack').onclick=openAdd;$('#chatCancel').onclick=closeModal;
 $('#chatForm').onsubmit=async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const cl=x=>clean(String(x||'').replace(/\s*\|\s*/g,' ').replace(/[\r\n]+/g,' '));
  const name=cl(fd.get('name')),desc=cl(fd.get('desc'));let link=clean(String(fd.get('link')||'')).replace(/\s+/g,'');
  if(/^(chat\.whatsapp\.com|wa\.me|t\.me|telegram\.me)\//i.test(link))link='https://'+link;
  if(!name||!desc||!/^https?:\/\/[^\s|]+$/i.test(link)){toast(T('chatBadLinkToast'));return}
  const kind=chatKindOfLink(link);
  if(!kind){toast(T('chatBadLinkToast'));return}
  const file=v.file;try{await ensureFilesLoaded([file])}catch(err){}
  if((S.chats||[]).some(c=>c.file===file&&c.link.toLowerCase()===link.toLowerCase())){toast(T('chatDupToast'));return}
  const n=nextChatId(file);if(n>1100){toast(T('chatFullToast'));return}
  const id=String(n).padStart(4,'0');
  const row=[id,name,desc,link,'.','.','.','.','.','.','.','.','.','R','R','R','0','0','0',kind].join(' | ');
  enqueueRequest({status:'PENDING',kind:'NEW',createdAt:new Date().toISOString(),village:v.name,file,mode:'chat',candidateRow:row,schema:SCHEMA});
  closeModal();toast(T('requestSaved'));sendPendingToIntake().catch(()=>{});
 };
}
function openAdd(){
 /* v5.4.0.1: единое четырёхкнопочное окно — открывается с любой из 5 вкладок */
 showModal(`<div class="modal-content"><h2>${esc(T('addChooseTitle'))}</h2><div class="add-choice"><button class="primary choice-btn" id="addBusiness">${esc(T('addBusinessBtn'))}</button><button class="secondary choice-btn" id="addResident">${esc(T('addResidentBtn'))}</button><button type="button" class="vip-apply choice-btn" id="addVip"><span class="vip-badge mini" aria-hidden="true">👑 VIP</span><span class="vip-apply-text">${esc(T('vipApplyBtn'))}</span></button></div><button type="button" class="choice-btn chat-add-btn" id="addChat">${esc(T('addChatBtn'))}</button><button class="secondary w100 choice-btn big-action add-cancel-big" id="addCancel">${esc(T('addCancelBtn'))}</button></div>`);
 $('#addCancel').onclick=closeModal;$('#addBusiness').onclick=()=>openAddForm('business');$('#addResident').onclick=()=>openAddForm('resident');$('#addVip').onclick=()=>openVipForm();$('#addChat').onclick=openChatForm;
}
function renderAddGeoWheels(regionSlug,districtSlug,villageName){
 const host=$('#geoWheels');if(!host)return;
 const regions=geoRegions();
 const region=regions.find(r=>r.slug===regionSlug)||regions[0];
 const districts=geoDistricts(region.slug);
 const district=districts.find(d=>d.slug===districtSlug)||districts.find(d=>d.slug==='beyterek')||districts[0];
 const villages=geoVillagesOf(district?.slug);
 const village=villages.find(v=>v.nameRu===villageName)||villages.find(v=>v.nameRu==='Дарьинское')||villages[0];
 host.innerHTML=`<label>${esc(T('regionModalTitle').replace('🗺️ ',''))}<select id="addSelRegion">${regions.map(r=>`<option value="${esc(r.slug)}" ${r.slug===region?.slug?'selected':''}>${esc(regionName(r))}</option>`).join('')}</select></label><label>${esc(T('districtModalTitle').replace('🗺️ ',''))}<select id="addSelDistrict">${districts.map(d=>`<option value="${esc(d.slug)}" ${d.slug===district?.slug?'selected':''}>${esc(districtName(d))}</option>`).join('')}</select></label><label>${esc(T('villagePickerTitle').replace('🗺️ ',''))}<select id="addSelVillage">${villages.map(v=>`<option value="${esc(v.nameRu)}" ${v.nameRu===village?.nameRu?'selected':''}>${esc(villageLabel(v.nameRu))}</option>`).join('')}</select></label>`;
 $('#addSelRegion').onchange=e=>renderAddGeoWheels(e.target.value,district?.slug,null);
 $('#addSelDistrict').onchange=e=>renderAddGeoWheels(region?.slug,e.target.value,null);
 $('#addSelVillage').onchange=e=>onAddVillagePicked(district?.slug,e.target.value);
 onAddVillagePicked(district?.slug,village?.nameRu||'');
}
/* ===== v5.4.0.0: изолированный ввод телефонов =====
   Городской: «+7» и «(код АТС)» — неизменяемые части (код берётся из kazakhstan_geo.json под выбранный
   посёлок), в поле — только сам номер. Сотовые: серая плашка «+7», в поле ввод с кода оператора.
   Пустое поле при отправке превращается в одиночную «.» (sanitizeCityDigits/sanitizeMobileE164). */
function localCityOf(v,villageName){
 const d=String(v||'').replace(/\D/g,'');if(!d)return'';
 const c=String(villageCityCode(villageName)||'').replace(/\D/g,'');
 let x=d;if(x.length>7&&x.startsWith('7')&&c&&x.slice(1).startsWith(c))x=x.slice(1);
 if(c&&x.startsWith(c))x=x.slice(c.length);
 return x;
}
function localMobileOf(v){
 let d=String(v||'').replace(/\D/g,'');if(!d)return'';
 if(d.length===11&&(d[0]==='7'||d[0]==='8'))d=d.slice(1);
 return fmtLocalMobile(d);
}
function fmtLocalMobile(d){d=String(d).replace(/\D/g,'').slice(0,10);return [d.slice(0,3),d.slice(3,6),d.slice(6,8),d.slice(8,10)].filter(Boolean).join(' ')}
function enforceLocalMobile(input){
 if(!input)return;
 input.addEventListener('input',()=>{
  input.dataset.touched='1';
  let d=input.value.replace(/\D/g,'');
  if(d.length>=11&&(d[0]==='7'||d[0]==='8'))d=d.slice(1);   // вставили номер целиком — «+7»/«8» срезаются
  input.value=fmtLocalMobile(d);
 });
}
function enforceLocalCity(input){
 if(!input)return;
 input.addEventListener('input',()=>{
  input.dataset.touched='1';
  const c=String(villageCityCode($('#geoValue')?.value||'')||'').replace(/\D/g,'');
  let d=input.value.replace(/\D/g,'');
  if(c&&d.length>7&&d.startsWith(c))d=d.slice(c.length);
  input.value=d.slice(0,10);
 });
}
function enforceDigitsOnly(input){if(!input)return;input.addEventListener('input',()=>{input.dataset.touched='1';input.value=input.value.replace(/[^\d\s()\-]/g,'')})}
function onAddVillagePicked(districtSlug,villageName){
 const gv=geoVillageByName(districtSlug,villageName);const d=geoDistrictBySlug(districtSlug);const atc=(gv&&gv.atcCode)||(d&&d.phoneCode)||'';
 const geoValue=$('#geoValue');if(geoValue)geoValue.value=villageName;
 const geoDist=$('#geoDistrictValue');if(geoDist)geoDist.value=districtSlug||'beyterek';
 const isNew=!villageHasRealFile(gv);
 const codeLbl=$('#cityCodeLabel');if(codeLbl)codeLbl.textContent=`(${atc||'—'})`;
 const note=$('#newVillageNote');
 if(note){if(isNew){const nextId=CONFIG.VILLAGES.length+1;note.classList.remove('hidden');note.textContent=T('newVillageWarn',{village:villageName,id:nextId,code:atc||'—'})}else{note.classList.add('hidden');note.textContent=''}}
}
/* v5.2.0.3: живая вёрстка больше НЕ вшивает «+7 » в поле по одному
   лишь фокусу — раньше именно это оставляло в Г8 голый префикс, если
   посетитель заходил в поле и ничего не печатал. Теперь префикс
   появляется ТОЛЬКО когда реально набраны цифры; пустое поле остаётся
   пустым (окончательную чистку/проверку на «.» всё равно делает
   sanitizeMobileE164() при отправке — это лишь удобство набора). */
function enforcePhonePrefix(input){
 if(!input)return;
 const fix=()=>{
  const digits=input.value.replace(/\D/g,'');
  if(!digits){input.value='';return}
  let d=digits;
  if(d.length===11&&d.startsWith('8'))d='7'+d.slice(1);
  if(!d.startsWith('7'))d='7'+d;
  input.value='+'+d;
 };
 input.addEventListener('input',()=>{input.dataset.touched='1';fix()});
}
function captureFormDraft(){const f=$('#addForm');if(!f)return{};const fd=new FormData(f);const draft=Object.fromEntries(fd.entries());draft.wa1=$('[name="wa1"]')?.checked?'on':'';draft.wa2=$('[name="wa2"]')?.checked?'on':'';return draft}
function categoryButtonHtml(draft){
 const mainId=Number(draft?.superTile)||SUPER_TILES[0].id;
 const subs=(SUB_TILES[mainId]||[]).filter(s=>!s.hidden);
 const subId=Number(draft?.subTile)||subs[0]?.sub||1;
 const st=SUPER_TILES.find(x=>x.id===mainId);
 const sb=subs.find(x=>x.sub===subId)||subs[0];
 const labelTxt=st&&sb?`${st.emoji} ${superLabel(st)} → ${subLabel(sb)}`:T('categoryPickFallback');
 return `<div class="wheel-stack"><div class="wheel-caption">${esc(T('categoryCaption'))}</div><button type="button" class="category-pick-btn big-action" id="categoryPickBtn">${esc(labelTxt)}</button></div><input type="hidden" id="superTileValue" name="superTile" value="${mainId}"><input type="hidden" id="subTileValue" name="subTile" value="${sb?.sub||1}">${tileSelectHtml(sb,draft)}`;
}
/* v5.3.0.4: выбор плитки 3-го уровня (T2) — только если у подкатегории в categories.json есть tiles. */
function tileSelectHtml(sb,draft){
 const tl=tilesOf(sb);if(!tl)return '';
 const cur=draft&&draft.tileT2!==undefined&&draft.tileT2!==null?String(draft.tileT2):'';
 const valid=cur!==''&&(tl.some(t=>String(t.t2)===cur)||cur==='0');
 const opts=[`<option value="">${esc(T('tileAutoOption'))}</option>`].concat(tl.map(t=>`<option value="${t.t2}" ${valid&&cur===String(t.t2)?'selected':''}>${esc((t.emoji?t.emoji+' ':'')+tileLabel(t))}</option>`));
 if(!tl.some(t=>t.t2===0))opts.push(`<option value="0" ${valid&&cur==='0'?'selected':''}>${esc(otherTileLabel(sb))}</option>`);
 return `<label class="tile-select">${esc(T('tileSelectLabel'))}<select name="tileT2">${opts.join('')}</select></label>`;
}
/* v5.2.0.4: setupCategoryButton/openSectorModal/openSubModal получили
   необязательные draftGetter/onClose — так карусель Сектор→Подкатегория
   из Анкеты добавления дословно переиспользуется и окном «⚠️ Ошибка»
   (которое перерисовывается не через openAddForm, а через свой
   openErrorEditor). Без этих параметров поведение Анкеты не меняется
   ни на символ. */
function setupCategoryButton(mode,draftGetter,onClose){const btn=$('#categoryPickBtn');if(!btn)return;const getDraft=draftGetter||captureFormDraft;btn.onclick=()=>{const draft=getDraft();closeModal();openSectorModal(mode,draft,onClose)}}
function openSectorModal(mode,draft,onClose){
 const back=()=>{closeModal();if(onClose)onClose(draft);else openAddForm(mode,draft)};
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="secBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('sectorModalTitle'))}</h2></div><div class="sector-grid">${SUPER_TILES.filter(st=>!st.hidden).map(st=>`<button type="button" class="sector-btn big-action" data-sector="${st.id}">${st.emoji} ${esc(superLabel(st))}</button>`).join('')}</div></div>`);
 $('#secBack').onclick=back;
 $$('[data-sector]').forEach(b=>b.onclick=()=>{draft.superTile=Number(b.dataset.sector);openSubModal(mode,draft,onClose)});
}
function openSubModal(mode,draft,onClose){
 const mainId=Number(draft.superTile),st=SUPER_TILES.find(x=>x.id===mainId);
 const subs=(SUB_TILES[mainId]||[]).filter(s=>!s.hidden);
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="subBack">⬅️ ${esc(T('back'))}</button><h2>${st?.emoji||''} ${esc(st?superLabel(st):T('subModalTitleFallback'))}</h2></div><div class="sector-grid">${subs.map(s=>`<button type="button" class="sector-btn big-action" data-sub="${s.sub}">${esc(subLabel(s))}</button>`).join('')}</div></div>`);
 $('#subBack').onclick=()=>openSectorModal(mode,draft,onClose);
 $$('[data-sub]').forEach(b=>b.onclick=()=>{draft.subTile=Number(b.dataset.sub);draft.tileT2='';closeModal();if(onClose)onClose(draft);else openAddForm(mode,draft)});
}
function hourPairs(fromH,toH){const out=[];for(let h=fromH;h<=toH;h++){out.push(`${String(h).padStart(2,'0')}:00`,`${String(h).padStart(2,'0')}:30`)}return out}
const WORK_TIME_GRID=hourPairs(6,22);
const WORK_TIME_GRID_NIGHT=WORK_TIME_GRID.concat(['23:00','23:30','00:00','01:00','02:00']);
/* v5.2.0.4: добавлен 4-й чип «🔁 Вахта» — селектор готовых кодов SHIFT|...
   (openShiftPickerModal), бок о бок с уже существующими «Без графика /
   24-7 / 4-шаговые тайм-пикеры С-До». Это чисто аддитивное добавление —
   ничего из уже работающих трёх чипов не тронуто. */
function scheduleGridHtml(draft){
 const sv=draft?.scheduleValue||T('scheduleNoneValue'),lv=draft?.lunchValue||'';
 return `<div class="schedule-quick"><button type="button" class="sched-chip" data-sched="none">${esc(T('schedNoneBtn'))}</button><button type="button" class="sched-chip" data-sched="24_7">${esc(T('sched247Btn'))}</button><button type="button" class="sched-chip" data-sched="custom">${esc(T('schedCustomBtn'))}</button><button type="button" class="sched-chip" data-sched="shift">${esc(T('schedShiftBtn'))}</button></div><input type="hidden" id="scheduleValue" name="scheduleValue" value="${esc(sv)}"><input type="hidden" id="lunchValue" name="lunchValue" value="${esc(lv)}"><div id="schedulePreview" class="calendar-note">${esc(T('schedulePreviewPrefix',{value:sv}))}${lv?esc(T('schedulePreviewLunch',{value:lv})):''}</div>`;
}
function updateSchedulePreview(){const sv=$('#scheduleValue')?.value||T('scheduleNoneValue');const lv=$('#lunchValue')?.value||'';const prev=$('#schedulePreview');if(prev)prev.textContent=T('schedulePreviewPrefix',{value:sv})+(lv?T('schedulePreviewLunch',{value:lv}):'')}
/* v5.2.0.4: setupScheduleGrid/open4StepTimeModal/openShiftPickerModal тоже
   получили необязательные draftGetter/onClose — та же логика переиспользования,
   что и у карусели категорий выше, нужна редактору «⚠️ Ошибка». */
function setupScheduleGrid(mode,draftGetter,onClose){
 const getDraft=draftGetter||captureFormDraft;
 $$('.sched-chip').forEach(b=>b.onclick=()=>{
  const kind=b.dataset.sched;
  if(kind==='none'){const el=$('#scheduleValue');if(el)el.value=T('scheduleNoneValue');updateSchedulePreview();return}
  if(kind==='24_7'){const el=$('#scheduleValue');if(el)el.value=T('schedule247Value');updateSchedulePreview();return}
  if(kind==='custom'){const draft=getDraft();closeModal();open4StepTimeModal(mode,draft,onClose);return}
  if(kind==='shift'){const draft=getDraft();closeModal();openShiftPickerModal(mode,draft,onClose);return}
 });
}
function open4StepTimeModal(mode,draft,onClose){
 let start=null,end=null,lunchStart=null;
 const back=()=>{closeModal();if(onClose)onClose(draft);else openAddForm(mode,draft)};
 const finalize=lunchEnd=>{draft.scheduleValue=`${start}-${end}`;draft.lunchValue=(lunchStart&&lunchEnd)?`${lunchStart}-${lunchEnd}`:'';closeModal();if(onClose)onClose(draft);else openAddForm(mode,draft)};
 const step4=()=>{
  showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="tsBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('step4Title'))}</h2></div><div class="time-grid two-col">${WORK_TIME_GRID.map(tm=>`<button type="button" class="time-chip" data-time="${tm}">${tm}</button>`).join('')}</div></div>`);
  $('#tsBack').onclick=back;
  $$('[data-time]').forEach(b=>b.onclick=()=>finalize(b.dataset.time));
 };
 const step3=()=>{
  showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="tsBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('step3Title'))}</h2></div><button type="button" class="sched-chip big-action w100" id="noLunchBtn" style="margin-bottom:10px">${esc(T('noLunchBtn'))}</button><div class="time-grid two-col">${WORK_TIME_GRID.map(tm=>`<button type="button" class="time-chip" data-time="${tm}">${tm}</button>`).join('')}</div></div>`);
  $('#tsBack').onclick=back;
  $('#noLunchBtn').onclick=()=>finalize(null);
  $$('[data-time]').forEach(b=>b.onclick=()=>{lunchStart=b.dataset.time;step4()});
 };
 const step2=()=>{
  showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="tsBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('step2Title'))}</h2></div><div class="time-grid two-col">${WORK_TIME_GRID_NIGHT.map(tm=>`<button type="button" class="time-chip" data-time="${tm}">${tm}</button>`).join('')}</div></div>`);
  $('#tsBack').onclick=back;
  $$('[data-time]').forEach(b=>b.onclick=()=>{end=b.dataset.time;step3()});
 };
 const step1=()=>{
  showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="tsBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('step1Title'))}</h2></div><div class="time-grid two-col">${WORK_TIME_GRID.map(tm=>`<button type="button" class="time-chip" data-time="${tm}">${tm}</button>`).join('')}</div></div>`);
  $('#tsBack').onclick=back;
  $$('[data-time]').forEach(b=>b.onclick=()=>{start=b.dataset.time;step2()});
 };
 step1();
}
/* v5.2.0.4: селектор готовых кодов SHIFT|work|rest|YYYY-MM-DD|HH:MM —
   полностью нативный ввод (<select>/<input type="date">/<input type="time">),
   без единого свободного текстового поля; собранная строка пишется в то же
   draft.scheduleValue, что и у остальных режимов графика. */
function openShiftPickerModal(mode,draft,onClose){
 const back=()=>{closeModal();if(onClose)onClose(draft);else openAddForm(mode,draft)};
 const days=[1,2,3,4,5,6,7];
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="shiftBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('shiftPickerTitle'))}</h2></div><form id="shiftForm" class="form-grid">
  <label>${esc(T('shiftWorkLabel'))}<select name="shiftWork">${days.map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>
  <label>${esc(T('shiftRestLabel'))}<select name="shiftRest">${days.map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>
  <label>${esc(T('shiftStartDateLabel'))}<input type="date" name="shiftDate" required></label>
  <label>${esc(T('shiftStartTimeLabel'))}<input type="time" name="shiftTime" value="08:00" required></label>
  <button class="primary big-action" type="submit">${esc(T('shiftApplyBtn'))}</button>
 </form></div>`);
 $('#shiftBack').onclick=back;
 $('#shiftForm').onsubmit=e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const work=Number(fd.get('shiftWork'))||1,rest=Number(fd.get('shiftRest'))||1,date=clean(fd.get('shiftDate')),time=clean(fd.get('shiftTime'))||'08:00';
  if(!date){toast(T('shiftDateRequiredToast'));return}
  draft.scheduleValue=`SHIFT|${work}|${rest}|${date}|${time}`;draft.lunchValue='';
  closeModal();if(onClose)onClose(draft);else openAddForm(mode,draft);
 };
}
/* ===== v5.3.0.0: ПРИЁМ ЗАЯВОК ЧЕРЕЗ GOOGLE ТАБЛИЦУ (Apps Script веб-хук) =====
   Старый шлюз GitHub Issues/requests.txt ЛИКВИДИРОВАН целиком: никаких
   токенов в публичном сайте, никаких 404. Заявка всегда сначала ложится в
   память телефона (IndexedDB, очередь с зеркалом в памяти), затем
   sendPendingToIntake() пытается отправить её POST-ом на адрес веб-хука
   (config.json -> intakeWebhookUrl) — в таблицу Baiterek_Ochered_2026.
   Таблица (google_apps_script_webhook.gs) сама присваивает ID по каскаду +1
   (с блокировкой от гонки) и ставит статус «Новая». Повторная отправка того
   же UID после обрыва связи дубль НЕ создаёт. Пока адрес веб-хука пуст или
   нет сети — заявка спокойно ждёт в телефоне и уйдёт сама, ничего не
   теряется. Тело запроса — text/plain с JSON, чтобы браузер не делал
   предзапрос CORS (Apps Script его не умеет). */
function intakeUrl(){return clean(APP_CFG.intakeWebhookUrl||'')}
/* v5.3.0.1: жёсткий сетевой таймаут 7 секунд (слабая Е-сеть в степи): запрос
   обрывается через AbortController, заявка остаётся в IndexedDB-очереди. */
const INTAKE_TIMEOUT_MS=7000;
async function intakePost(payload){
 const url=intakeUrl();if(!url)return null;
 const ctl=typeof AbortController==='function'?new AbortController():null;
 const timer=ctl?setTimeout(()=>ctl.abort(),INTAKE_TIMEOUT_MS):0;
 try{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),cache:'no-store',signal:ctl?ctl.signal:undefined});
  if(!r.ok)return null;
  return await r.json();
 }finally{if(timer)clearTimeout(timer)}
}
let intakeSending=false;
/* Радар досылки: уходит заявка за заявкой; обрыв/таймаут/сбой сервера —
   остановка до следующей попытки (старт, событие online, возврат на экран,
   таймер раз в минуту). Принципиально негодная заявка (ответ сервера
   «bad_*»/«unknown_file») НЕ стирается и не блокирует остальные: ей
   ставится пометка ошибки, она видна в админском окне «Очередь заявок». */
async function sendPendingToIntake(){
 if(intakeSending||!intakeUrl()||!navigator.onLine)return;
 const q=queueLocal().filter(x=>!x.sendError);if(!q.length)return;
 intakeSending=true;
 try{
  for(const item of q){
   const lines=String(item.candidateRow||'').split('\n').filter(Boolean);
   const last=(typeof QEDIT!=='undefined'&&QEDIT.get(item.uid))||lines[lines.length-1]||'';
   if(!item.file||last.split(' | ').length!==20){markQueueError(item.uid,'bad_row');continue}
   const kind=item.kind==='EDIT'||item.kind==='DELETE'?item.kind:'NEW';
   const payload={action:'submit',uid:item.uid,file:item.file,kind,
    row:kind==='DELETE'||isChatRow(last)?last:markerSwap(last,'$'),
    original:kind==='EDIT'&&lines.length>1?markerSwap(lines[0],'$'):'',
    reason:clean(item.reason||item.reasonCode||''),village:clean(item.village||'')};
   let res=null;
   try{res=await intakePost(payload)}catch(e){res=null}
   if(res&&res.ok)removeQueueLocal(item.uid);
   else if(res&&res.error&&res.error!=='server_error'&&res.error!=='forbidden')markQueueError(item.uid,res.error);
   else break;
  }
 }finally{intakeSending=false}
}
/* v5.4.0.0: любое добавление (бизнес, житель, село, район, область, общая кнопка) начинается с коротких правил заполнения. */
function showAddGuide(next,mode){
  showModal(`<div class="modal-content add-guide"><h2>📝 ${esc(T('addGuideTitle'))}</h2><ol class="add-guide-list">${[1,2,3,4,5].map(i=>`<li>${esc(T('addGuide'+i))}</li>`).join('')}</ol><div class="modal-actions"><button class="primary big-action w100" id="addGuideOk">${esc(T('addGuideOk'))}</button></div><div class="modal-actions"><button class="secondary big-action w100" id="addGuideCancel">${esc(T('cancel'))}</button></div></div>`);
 $('#addGuideOk').onclick=()=>{closeModal();next()};
 $('#addGuideCancel').onclick=closeModal;
}
/* v5.4.0.1: заявка на VIP-статус (100 тенге в сутки). Уходит в Google-скрипт (action=vip),
   бот присылает администратору сообщение с кнопками «Написать в WhatsApp» и «Позвонить». */
const VIP_TARIFFS=[{days:'7',key:'vipT7'},{days:'14',key:'vipT14'},{days:'30',key:'vipT30'},{days:'90',key:'vipT90'},{days:'180',key:'vipT180'},{days:'365',key:'vipT365'},{days:'forever',key:'vipTForever'}];
function siteBaseUrl(){try{return location.origin+location.pathname.replace(/[^/]*$/,'')}catch(e){return''}}
/* v1.0.0.3: VIP в три шага. 1) плитки тарифов; 2) крупное окно-предупреждение о сверке телефона владельца
   («ПОНЯТНО» / «НАЗАД / ОТМЕНА»); 3) анкета из 3 полей: ID карточки, имя, телефон. Сверку делает сайт по базе
   выбранного села (она уже в памяти страницы): совпал телефон с карточкой → «Заявка отправлена», иначе → «Заявка отклонена». */
function digitsOf(v){return String(v||'').replace(/\D/g,'')}
function vipVerify(village,id,phone){
 const v0=villageObj();const row=S.rows.find(r=>String(r.id)===String(id)&&(!v0||r.file===v0.file));
 if(!row)return{ok:false,reason:'noId'};
 const want=digitsOf(phone).slice(-10);
 const have=[row.mobile1,row.mobile2,row.city].map(x=>digitsOf(x&&x!=='.'?x:'')).filter(Boolean).map(x=>x.slice(-10));
 return have.includes(want)&&want.length===10?{ok:true,row}:{ok:false,reason:'phone'};
}
function vipResultModal(ok,reasonKey){
 showModal(`<div class="modal-content vip-result ${ok?'vip-ok':'vip-no'}"><h2>${ok?'✅':'⛔'} ${esc(T(ok?'vipAccepted':'vipRejected'))}</h2><p class="vip-warn-text">${esc(T(ok?'vipAcceptedText':reasonKey))}</p><div class="modal-actions"><button class="primary big-action w100" id="vipResOk">${esc(T('vipResClose'))}</button></div></div>`);
 $('#vipResOk').onclick=closeModal;
}
function openVipForm(){
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="vipBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('vipFormTitle'))}</h2></div><div class="form-grid">
  <div class="vip-rule" role="note">${esc(T('vipRule'))}</div>
  <div class="vip-tariff-list"><b>${esc(T('vipTariffTitle'))}</b>${VIP_TARIFFS.map(t=>`<button type="button" class="vip-tariff-btn big-action" data-days="${t.days}">${esc(T(t.key))}</button>`).join('')}</div>
 </div></div>`);
 $('#vipBack').onclick=()=>{closeModal();openAdd()};
 document.querySelectorAll('.vip-tariff-btn').forEach(b=>b.onclick=()=>vipWarn(b.dataset.days));
}
function vipWarn(days){
 showModal(`<div class="modal-content vip-warn"><h2>⚠️ ${esc(T('vipWarnTitle'))}</h2><p class="vip-warn-text">${esc(T('vipWarnText'))}</p><div class="modal-actions vip-warn-actions"><button class="primary big-action w100" id="vipWarnOk">${esc(T('vipWarnOk'))}</button><button class="secondary big-action w100" id="vipWarnBack">${esc(T('vipWarnBack'))}</button></div></div>`);
 $('#vipWarnOk').onclick=()=>vipApplyForm(days);
 $('#vipWarnBack').onclick=closeModal;
}
function vipApplyForm(days){
 const v0=villageObj(),village=v0?.name||S.village||'';
 const tar=VIP_TARIFFS.find(t=>t.days===days);
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="vipBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('vipFormTitle'))}</h2></div><form id="vipForm" class="form-grid" autocomplete="off">
  <div class="vip-village">📍 ${esc(villageLabel(village))}</div>
  <div class="vip-chosen">${esc(T(tar?tar.key:'vipTariffTitle'))}</div>
  <label>${esc(T('vipIdLabel'))}<input id="vipId" name="cardId" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="10061"></label>
  <div class="vip-id-help" role="note">${esc(T('vipIdHelp'))}</div>
  <label>${esc(T('vipOwnerLabel'))}<input id="vipOwner" name="owner"></label>
  <label>${esc(T('vipPhoneLabel'))}<div class="phone-split"><span class="phone-fixed grey">+7</span><input id="vipPhone" name="phone" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="705 123 45 67"></div></label>
  <div class="form-actions-row"><button class="vip-apply big-action" type="submit" id="vipSend">${esc(T('vipSend'))}</button><button class="secondary big-action" type="button" id="vipCancel">${esc(T('cancel'))}</button></div>
 </form></div>`);
 $('#vipBack').onclick=openVipForm;$('#vipCancel').onclick=closeModal;
 $('#vipForm').onsubmit=async e=>{
  e.preventDefault();
  const id=digitsOf($('#vipId').value),owner=clean($('#vipOwner').value),phone=sanitizeMobileE164($('#vipPhone').value);
  if(!id){banner(T('vipNeedId'),true);return}
  if(!owner){banner(T('vipNeedOwner'),true);return}
  if(phone==='.'){banner(T('vipBadPhone'),true);return}
  let chk=vipVerify(village,id,phone);
  /* v1.0.0.3: если запущен локальный сервер, сверку делает Python по файлу базы (главный судья); иначе — сайт по базе села в памяти */
  try{const rr=await fetch('/__vipcheck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:v0?.file||'',id,phone}),cache:'no-store'});const jj=rr.ok?await rr.json():null;
   if(jj&&jj.ok&&(jj.result==='ok'||jj.result==='no_id'||jj.result==='phone')){if(jj.result==='ok'){if(!chk.row)chk={ok:true,row:S.rows.find(x=>String(x.id)===String(id))||{title:''}};else chk.ok=true}else chk={ok:false,reason:jj.result==='no_id'?'noId':'phone'}}}catch(e){}
  if(!chk.ok){vipResultModal(false,chk.reason==='noId'?'vipRejNoId':'vipRejPhone');return}
  if(!intakeUrl()){banner(T('tgNeedUrlToast'),true);return}
  const btn=$('#vipSend');btn.disabled=true;
  let r=null;try{r=await intakePost({action:'vip',uid:'vip'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),village,title:chk.row.title,owner,phone,days,promo:'',cardId:id,siteUrl:siteBaseUrl()})}catch(err){r=null}
  btn.disabled=false;
  if(r&&r.ok)vipResultModal(true);
  else banner(T('vipFail',{error:r?tgErrText(r):T('vipNoLink')}),true);
 };
}
function openAddForm(mode,draft,opts){
 if(!draft&&!(opts&&opts.skipGuide)){showAddGuide(()=>openAddForm(mode,draft,{skipGuide:true}),mode);return}
 const resident=mode==='resident',v0=villageObj();
 const d=draft||{};
 const villageName=d.geo||v0?.name||'Дарьинское';
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="addBack">⬅️ ${esc(T('back'))}</button><h2>${esc(resident?T('addTitleResident'):T('addTitleBusiness'))}</h2></div><form id="addForm" class="form-grid">
  <div class="wheel-stack geo-first"><div class="wheel-caption">📍 ${esc(T('geoChainCaption'))}</div><button type="button" class="category-pick-btn big-action" id="villagePickBtn">${esc(T('villagePickBtn',{village:villageLabel(villageName)}))}</button><div id="geoWheels" class="hidden"></div><div id="newVillageNote" class="hint quarantine-note hidden"></div></div>
  <input type="hidden" id="geoValue" name="geo" value="${esc(villageName)}"><input type="hidden" id="geoDistrictValue" name="geoDistrict" value="beyterek">
  ${resident?'':categoryButtonHtml(d)}
  <label>${esc(resident?T('titleLabelResident'):T('titleLabelBusiness'))}<input name="title" required value="${esc(d.title||'')}"></label>
  <label>${esc(resident?T('personLabelResident'):T('personLabelBusiness'))}<input name="person" value="${esc(d.person||'')}"></label>
  <label>${esc(T('cityLabel'))}<div class="phone-split"><span class="phone-fixed">+7</span><span class="phone-code" id="cityCodeLabel">(${esc(villageCityCode(villageName)||'—')})</span><input id="cityPhoneInput" name="city" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="${esc(T('cityNumberPlaceholder'))}" value="${esc(localCityOf(d.city,villageName))}"></div></label>
  <div class="mobile-line"><label>${esc(T('mobile1Label'))}<div class="phone-split"><span class="phone-fixed grey">+7</span><input id="mobile1Input" name="mobile1" inputmode="numeric" autocomplete="off" placeholder="705 123 45 67" value="${esc(localMobileOf(d.mobile1))}"></div></label><label class="check-line wa-check"><input type="checkbox" name="wa1" ${d.wa1==='on'?'checked':''}> ${esc(T('waHasLabel'))}</label></div>
  <div class="mobile-line"><label>${esc(T('mobile2Label'))}<div class="phone-split"><span class="phone-fixed grey">+7</span><input id="mobile2Input" name="mobile2" inputmode="numeric" autocomplete="off" placeholder="771 123 45 67" value="${esc(localMobileOf(d.mobile2))}"></div></label><label class="check-line wa-check"><input type="checkbox" name="wa2" ${d.wa2==='on'?'checked':''}> ${esc(T('waHasLabel'))}</label></div>
  <label>${esc(T('addressLabel'))}<input name="address" value="${esc(d.address||'')}"></label>
  <label>${esc(T('tagsLabel'))}<textarea name="tags">${esc(d.tags||'')}</textarea></label>
  <div class="shift-drum"><div class="wheel-caption">${esc(T('scheduleCaption'))}</div>${scheduleGridHtml(d)}</div>
  ${resident?'':`<label>${esc(T('socialLabel'))}<input name="social" value="${esc(d.social||'')}"></label>`}
  <div class="form-actions-row"><button class="primary big-action" type="submit">${esc(T('submitModeration'))}</button><button class="secondary big-action" type="button" id="addCancelBtn">${esc(T('cancel'))}</button></div>
 </form></div>`);
 $('#addBack').onclick=openAdd;
 if(!resident)setupCategoryButton(mode);
 $('#villagePickBtn').onclick=()=>{
  const curDraft=captureFormDraft();
  const restoreForm=()=>{closeModal();openAddForm(mode,curDraft)};
  openGeomodal((picked,isOther,missingStep)=>{
   if(isOther){
    const stepKey=missingStep===1?'wizStepErrRegion':missingStep===2?'wizStepErrDistrict':'wizStepErrVillage';
    showModal(`<div class="modal-content"><h2>${esc(T(stepKey))}</h2><div class="modal-actions"><button class="primary big-action w100" id="wizStepOk">${esc(T('close'))}</button></div></div>`);
    $('#wizStepOk').onclick=restoreForm;
    return;
   }
   if(picked){curDraft.geo=picked.name;renderAddGeoWheels('zko',picked.districtSlug||'beyterek',picked.name)}
   closeModal();openAddForm(mode,curDraft);
  },undefined,restoreForm);
 };
 renderAddGeoWheels('zko',districtOfVillage(villageName),villageName);
 enforceLocalMobile($('#mobile1Input'));enforceLocalMobile($('#mobile2Input'));enforceLocalCity($('#cityPhoneInput'));
 setupScheduleGrid(mode);
 $('#addCancelBtn').onclick=()=>{$('#addForm')?.reset();closeModal()};
 $('#addForm').onsubmit=async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  try{await ensureFilesLoaded([CONFIG.VILLAGES.find(v=>v.name===fd.get('geo'))?.file])}catch(err){}
  const dup=checkDuplicateOnSubmit(fd,mode);
  if(dup==='BLOCKED')return;
  const row=buildCandidateRow(fd,mode);
  enqueueRequest({status:'PENDING',kind:'NEW',createdAt:new Date().toISOString(),village:fd.get('geo'),file:CONFIG.VILLAGES.find(v=>v.name===fd.get('geo'))?.file||villageFile(),mode,fields:Object.fromEntries(fd.entries()),candidateRow:row,schema:SCHEMA});
  /* п.2 наряда: автономная, скрытная отправка готовой 20-графовой строки (с
     маркером $) напрямую в изолированный сейф GitHub Issues — не трогая
     файлы баз сёл и не блокируя обычный интерфейс посетителя. */
  closeModal();toast(T('requestSaved'));sendPendingToIntake().catch(()=>{});
 };
}
function markerSwap(raw,marker){const parts=raw.split(' | ');if(parts.length!==20)return raw;parts[19]=marker;return parts.join(' | ')}
function rebuildCorrectionRow(r,changes,marker='EDIT'){
 /* v5.2.0.4: ХИРУРГИЯ РЕГИСТРА. Раньше Папка принудительно приводилась к
    .toUpperCase() ДЛЯ ЛЮБОЙ записи — отсюда и баг «МАГАЗИНЫ» капсом при
    EDIT, хотя и в базе, и в categories.json названия папок хранятся
    нормальным регистром («Магазины — Одежда/Обувь»). Регистр граф Папки
    теперь НИКОГДА самовольно не меняется — распознавание «это житель?»
    идёт через отдельное регистронезависимое сравнение, а само значение
    folder пишется в базу БУКВА В БУКВУ как пришло. */
 const folder=clean(changes.folder||r.folder)||'.';
 const isResidentFolder=folder.toUpperCase()==='ЖИТЕЛИ';
 const title=clean(changes.title||r.title)||'.';
 const owner=isResidentFolder?'.':(clean(changes.owner||r.owner)||'.');
 const residentNote=isResidentFolder?(clean(changes.residentNote||r.residentNote)||'.'):'.';
 /* v5.2.0.3: тот же автопилот Г6/Г7/Г8 действует и в редакторе
    «⚠️ Ошибка» — правки от посетителя тоже прогоняются через единый
    фильтр, а не сохраняются «как напечатано». */
 const city=sanitizeCityDigits(changes.city||r.city,villageCityCode(r.geo)),mobile1=sanitizeMobileE164(changes.mobile1||r.mobile1),mobile2=sanitizeMobileE164(changes.mobile2||r.mobile2),address=clean(changes.address||r.address)||'.',tags=clean(changes.tags||r.tags)||'.',geo=clean(changes.geo||r.geo)||'.',schedule=clean(changes.schedule||r.schedule)||'.',social=isResidentFolder?'.':(clean(changes.social||r.social)||'.');
 const X=xOfFile(r.file)||rowX(r)||1;
 let home=r.homeMask,res=r.resMask,search=r.searchMask;
 if(isResidentFolder){
  home='0';const rp=r.resParts||[X,'P',city!=='.'?'1':'0','0','0','0','0'];
  res=`${X}/P/${city!=='.'?'1':'0'}/${rp[3]||'0'}/${rp[4]||'0'}/0/0`;
  const hasPhoneR=(mobile1!=='.'||mobile2!=='.')?'1':'0',hasWaR=(rp[3]==='1'||rp[4]==='1')?'1':'0',k4R=r.searchParts?.[4]??0;
  search=`${X}/${hasPhoneR}/2/${hasWaR}/${k4R}/0/0`;
 }else{
  const hp=r.homeParts||[X,idTile(r.id)||1,idSub(r.id)||1,0,1,city!=='.'?1:0,0,0,0,0];
  const w1=String(changes.mobile1??r.mobile1)!=='.'&&String(changes.mobile1??r.mobile1)!==''?(changes.wa1confirm!==undefined?Number(changes.wa1confirm):(r.homeParts?.[6]??0)):0;
  const w2=String(changes.mobile2??r.mobile2)!=='.'&&String(changes.mobile2??r.mobile2)!==''?(changes.wa2confirm!==undefined?Number(changes.wa2confirm):(r.homeParts?.[7]??0)):0;
  const t2ch=changes.tileT2!==undefined?String(changes.tileT2):'';
  const t2b=/^[0-9]$/.test(t2ch)?Number(t2ch):(hp[3]??0);
  home=`${X}/${hp[1]||idTile(r.id)||1}/${hp[2]||idSub(r.id)||1}/${t2b}/${hp[4]||1}/${city!=='.'?'1':'0'}/${w1?1:0}/${w2?1:0}/0/0`;
  const hasPhoneB=(mobile1!=='.'||mobile2!=='.')?'1':'0',hasWaB=(w1||w2)?'1':'0';
  res='0';search=`${X}/${hasPhoneB}/1/${hasWaB}/${t2b}/0/0`;
 }
 const fields=[r.id,folder,title,owner,residentNote,city,mobile1,mobile2,address,tags,geo,schedule,social,'R','R','R',home,res,search,marker];
 return fields.join(' | ');
}
/* v5.2.0.4: ПЕРЕСТРОЙКА ОКНА «⚠️ Ошибка». Три графы переведены со свободного
   текста на управляемый ввод, как и было приказано:
   — Папка: ручной ввод вырезан наглухо, вместо него карусель
     Сектор→Подкатегория — ТОТ ЖЕ компонент (categoryButtonHtml/
     openSectorModal/openSubModal), что и в Анкете добавления;
   — Графика: ручной ввод тоже вырезан, вместо него те же чипы
     «Без графика / 24-7 / 4-шаговые тайм-пикеры С-До» + новый селектор
     готовых кодов SHIFT|... (openShiftPickerModal);
   — Г6/Г8: при стирании точки-заглушки живой ввод сам подставляет
     5-значный код села (из геоданных по Г11, а не из Г10 — графа тегов
     никаких кодов не хранит, см. setupErrorAutoPrefix) либо префикс «+7».
   Поскольку модалки carousel/schedule изначально жёстко перерисовывали
   именно openAddForm(mode,draft), все четыре функции ниже
   (setupCategoryButton/openSectorModal/openSubModal/setupScheduleGrid/
   open4StepTimeModal) получили необязательный onClose-колбэк — если он
   передан, перерисовка идёт через него (сюда, назад в редактор ошибки, с
   сохранением уже введённых значений остальных граф), иначе — поведение
   Анкеты остаётся прежним, 1-в-1. */
function captureErrorFormDraft(){
 const f=$('#errorForm');if(!f)return{};
 const fd=new FormData(f);
 const draft=Object.fromEntries(fd.entries());
 draft.wa1confirm=$('[name="wa1confirm"]')?.checked?'on':'';
 draft.wa2confirm=$('[name="wa2confirm"]')?.checked?'on':'';
 return draft;
}
/* Г6/Г8: источник 5-значного кода села — геоданные по официальному имени
   села (Г11), поскольку Г10 — графа свободных тегов и кодов сёл не несёт;
   это тот же атс-код, что подставляется в Анкете (onAddVillagePicked). */
function villageAtcCodeFor(r){
 /* v5.3.0.0: сперва ищем в тегах Г10 отдельное 5-значное число, но берём его
    ТОЛЬКО если оно совпадает с известным кодом села/района из геоданных
    (защита от случайных чисел в тегах); иначе — код по геоданным села. */
 const known=new Set();
 GEO.villages.forEach(v=>{if(v.atcCode)known.add(String(v.atcCode))});
 GEO.districts.forEach(d=>{if(d.phoneCode)known.add(String(d.phoneCode))});
 const m=String(r.tags||'').match(/(?:^|[^\d])(\d{5})(?!\d)/g)||[];
 for(const x of m){const c=x.replace(/\D/g,'');if(known.has(c))return c}
 const name=clean(r.geo).replace(/^с\.\s*/i,'');
 const gv=GEO.villages.find(v=>clean(v.nameRu)===name)||geoVillageByName('beyterek',name);
 const d=geoDistrictBySlug(gv?.districtSlug||'beyterek');
 return (gv&&gv.atcCode)||(d&&d.phoneCode)||'';
}
function setupErrorAutoPrefix(r){
 const form=$('#errorForm');if(!form)return;
 const cityInput=form.querySelector('[name="city"]'),m2Input=form.querySelector('[name="mobile2"]');
 if(cityInput)cityInput.addEventListener('input',()=>{
  if(cityInput.value.trim()==='' ){const code=villageAtcCodeFor(r);if(code)cityInput.value=code}
 });
 if(m2Input)m2Input.addEventListener('input',()=>{
  if(m2Input.value.trim()==='')m2Input.value='+7';
 });
}
function openErrorEditor(r,draft){
 const d=draft||{};
 const isResident=clean(r.folder).toUpperCase()==='ЖИТЕЛИ';
 const val=n=>d[n]!==undefined?d[n]:(r[n]??'');
 const wa1on=d.wa1confirm!==undefined?d.wa1confirm==='on':(r.homeParts?.[6]===1||r.resParts?.[3]==='1');
 const wa2on=d.wa2confirm!==undefined?d.wa2confirm==='on':(r.homeParts?.[7]===1||r.resParts?.[4]==='1');
 const editable=[['title',T('fieldTitle')],['owner',T('fieldOwner')],['residentNote',T('fieldResidentNote')],['city',T('fieldCity')],['mobile1',T('fieldMobile1')],['mobile2',T('fieldMobile2')],['address',T('fieldAddress')],['tags',T('fieldTags')],['geo',T('fieldGeo')],['social',T('fieldSocial')]];
 const rowsHtml=editable.map(([n,l])=>{
  const field=`<label>${esc(l)}<input name="${n}" value="${esc(val(n))}"></label>`;
  if(n==='mobile1')return field+`<label class="check-line wa-check">✅ <input type="checkbox" name="wa1confirm" ${wa1on?'checked':''}> ${esc(T('wa1ConfirmLabel'))}</label>`;
  if(n==='mobile2')return field+`<label class="check-line wa-check">✅ <input type="checkbox" name="wa2confirm" ${wa2on?'checked':''}> ${esc(T('wa2ConfirmLabel'))}</label>`;
  return field;
 }).join('');
 const folderHtml=isResident
  ?`<div class="wheel-stack"><div class="wheel-caption">${esc(T('fieldFolder'))}</div><div class="category-pick-btn big-action" style="pointer-events:none;opacity:.75">${esc(T('residentsGroupLabel'))}</div></div><input type="hidden" name="folder" value="ЖИТЕЛИ">`
  :categoryButtonHtml(d.superTile!==undefined?d:{superTile:idTile(r.id)||SUPER_TILES[0]?.id||1,subTile:idSub(r.id)||1,tileT2:r.homeParts?String(r.homeParts[3]):''});
 const scheduleDraft={scheduleValue:d.scheduleValue!==undefined?d.scheduleValue:((r.schedule&&r.schedule!=='.')?r.schedule:T('scheduleNoneValue')),lunchValue:d.lunchValue||''};
 const scheduleHtml=`<div class="shift-drum"><div class="wheel-caption">${esc(T('fieldSchedule'))}</div>${scheduleGridHtml(scheduleDraft)}</div>`;
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule" id="errBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('errorEditorTitle'))}</h2></div><div class="hint">${esc(T('errorEditorHint'))}</div><form id="errorForm" class="form-grid">${folderHtml}${rowsHtml}${scheduleHtml}<label>${esc(T('reasonLabel'))}<textarea name="reason" required placeholder="${esc(T('reasonPlaceholder'))}">${esc(d.reason||'')}</textarea></label><button class="primary big-action" type="submit">${esc(T('submitCorrectionBtn'))}</button><button class="secondary big-action" type="button" id="errDelete">${esc(T('deleteAnketaBtn'))}</button><button class="secondary big-action" type="button" id="errCancel">${esc(T('backCancelBtn'))}</button></form></div>`);
 $('#errBack').onclick=closeModal;$('#errCancel').onclick=closeModal;$('#errDelete').onclick=()=>openDeleteReasonModal(r);
 if(!isResident)setupCategoryButton('erredit',captureErrorFormDraft,nd=>openErrorEditor(r,nd));
 setupScheduleGrid('erredit',captureErrorFormDraft,nd=>openErrorEditor(r,nd));
 setupErrorAutoPrefix(r);
 $('#errorForm').onsubmit=e=>{
  e.preventDefault();
  const fd=new FormData(e.target),changes={};
  const skip=new Set(['reason','wa1confirm','wa2confirm','superTile','subTile','scheduleValue','lunchValue','folder']);
  for(const[k,v]of fd.entries())if(!skip.has(k))changes[k]=clean(v)||'.';
  changes.wa1confirm=fd.get('wa1confirm')?'1':'0';changes.wa2confirm=fd.get('wa2confirm')?'1':'0';
  const lunch=clean(fd.get('lunchValue'));
  let scheduleVal=clean(fd.get('scheduleValue'))||T('scheduleNoneValue');
  if(lunch)scheduleVal=`${scheduleVal}${T('schedulePreviewLunch',{value:lunch})}`;
  changes.schedule=scheduleVal;
  if(isResident){changes.folder='ЖИТЕЛИ'}
  else{
   const mainId=Number(fd.get('superTile'))||idTile(r.id)||1,subId=Number(fd.get('subTile'))||idSub(r.id)||1;
   const st=SUPER_TILES.find(x=>x.id===mainId),sb=(SUB_TILES[mainId]||[]).find(x=>x.sub===subId);
   changes.folder=st?`${superLabel(st)}${sb?' — '+subLabel(sb):''}`:r.folder;
  }
  const originalLine=markerSwap(r.raw,'ORIGINAL');
  const editLine=rebuildCorrectionRow(r,changes,'EDIT');
  const audit=rowValidate(editLine.split(' | '),0,r.file);if(!audit.ok){toast(T('validatorFailedToast'));return}
  enqueueRequest({status:'PENDING',kind:'EDIT',createdAt:new Date().toISOString(),file:r.file,id:r.id,reason:clean(fd.get('reason')),changes,candidateRow:`${originalLine}\n${editLine}`,schema:SCHEMA});
  closeModal();toast(T('doubleFixSavedToast'));sendPendingToIntake().catch(()=>{});
 };
}
function openDeleteReasonModal(r){
 const isResident=Number(r.id)>=10000;
 const reasons=[['DELETE_1',T('reasonOwnerAgainst')],['DELETE_2',T('reasonMoved')],...(isResident?[]:[['DELETE_3',T('reasonClosed')]]),['DELETE_4',T('reasonDuplicate')],['DELETE_OTHER',T('reasonOther')]];
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule" id="delBack">⬅️</button><h2>${esc(T('deleteReasonTitle'))}</h2></div><div class="hint">${esc(T('idLinePrefix'))} ${esc(r.id)} · ${esc(r.title)}</div><form id="deleteForm" class="form-grid">${reasons.map(([v,l],i)=>`<label class="check-line"><input type="radio" name="reasonCode" value="${v}" ${i===0?'checked':''}> ${esc(l)}</label>`).join('')}<label id="otherWrap" class="hidden">${esc(T('otherTextLabel'))}<input name="otherText" placeholder="${esc(T('otherTextPlaceholder'))}"></label><button class="primary" type="submit">${esc(T('confirmDeleteBtn'))}</button><button class="secondary" type="button" id="delCancel">${esc(T('cancel'))}</button></form></div>`);
 $('#delBack').onclick=()=>openErrorEditor(r);$('#delCancel').onclick=()=>openErrorEditor(r);
 const wrap=$('#otherWrap');$$('[name="reasonCode"]').forEach(b=>b.onchange=()=>wrap.classList.toggle('hidden',b.value!=='DELETE_OTHER'||!b.checked));
 $('#deleteForm').onsubmit=e=>{
  e.preventDefault();
  const fd=new FormData(e.target);let code=clean(fd.get('reasonCode'))||'DELETE_2';
  if(code==='DELETE_OTHER'){const txt=clean(fd.get('otherText'));if(!txt){toast(T('emptyReasonToast'));return}code=`DELETE_${txt}`}
  const candidateRow=markerSwap(r.raw,code);
  enqueueRequest({status:'PENDING',kind:'DELETE',createdAt:new Date().toISOString(),file:r.file,id:r.id,reasonCode:code,candidateRow,schema:SCHEMA});
  closeModal();toast(T('deleteSavedToast'));sendPendingToIntake().catch(()=>{});
 };
}
function makeUid(){return `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`}
/* ===== v5.3.0.1: ОЧЕРЕДЬ ЗАЯВОК И КОД ПРИЁМА В IndexedDB =====
   Чтение синхронное — из зеркала в памяти (QMIRROR), запись сквозная: в
   зеркало и в IndexedDB. Если IndexedDB недоступна, зеркало дублируется в
   localStorage (прежний ключ). Старая очередь из localStorage при первом
   запуске переносится в IndexedDB. Никаких лимитов в мегабайтах в коде нет;
   при нехватке места просим у браузера постоянное хранилище. Ключи Избранного
   (cart_favs и др.) этим узлом НЕ затрагиваются. */
let IGN_STORED=null,IGN_SET=null,DUP_IGN_OPEN=false,QMIRROR=[],ADMIN_CODE_MEM='',ADMIN_PIN_OK=false,idbPromise=null,idbBroken=false;
function idbOpen(){
 if(idbPromise)return idbPromise;
 idbPromise=new Promise((res,rej)=>{
  try{
   const rq=indexedDB.open('cartoteka_v5301',1);
   rq.onupgradeneeded=()=>{const db=rq.result;if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'uid'});if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv')};
   rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);rq.onblocked=()=>rej(new Error('blocked'));
  }catch(e){rej(e)}
 }).catch(e=>{idbBroken=true;return null});
 return idbPromise;
}
async function idbRun(store,mode,fn){
 const db=await idbOpen();if(!db)return undefined;
 return new Promise(res=>{
  try{
   const tx=db.transaction(store,mode),os=tx.objectStore(store),r=fn(os);
   tx.oncomplete=()=>res(r&&r.result!==undefined?r.result:true);
   tx.onerror=()=>{handleStorageFailure(tx.error);res(undefined)};tx.onabort=()=>{handleStorageFailure(tx.error);res(undefined)};
  }catch(e){handleStorageFailure(e);res(undefined)}
 });
}
function handleStorageFailure(e){
 try{if(e&&(e.name==='QuotaExceededError'||/quota/i.test(String(e.message||''))))requestPersistentStorage(true)}catch(_e){}
}
async function requestPersistentStorage(warn){
 try{
  if(!navigator.storage||!navigator.storage.persist)return;
  const already=navigator.storage.persisted?await navigator.storage.persisted():false;
  const ok=already||await navigator.storage.persist();
  if(!ok&&warn)toast(T('storageNotPersistentToast'));
 }catch(e){}
}
function persistMirrorFallback(){if(idbBroken)storageSet('cart_request_queue',JSON.stringify(QMIRROR))}
async function initQueue(){
 const rows=await idbRun('queue','readonly',os=>os.getAll());
 if(Array.isArray(rows)){
  const have=new Set(QMIRROR.map(x=>x.uid));
  rows.forEach(r=>{if(!have.has(r.uid))QMIRROR.push(r)});
 }
 let legacy=[];try{legacy=JSON.parse(storageGet('cart_request_queue','[]'))}catch(e){}
 if(Array.isArray(legacy)&&legacy.length&&!idbBroken){
  const have=new Set(QMIRROR.map(x=>x.uid));
  for(const it of legacy){if(it&&it.uid&&!have.has(it.uid)){QMIRROR.push(it);await idbRun('queue','readwrite',os=>os.put(it))}}
  storageRemove('cart_request_queue');
 }else if(idbBroken&&Array.isArray(legacy)){
  const have=new Set(QMIRROR.map(x=>x.uid));legacy.forEach(it=>{if(it&&it.uid&&!have.has(it.uid))QMIRROR.push(it)});
 }
 const code=await idbRun('kv','readonly',os=>os.get('admin_code'));
 if(typeof code==='string')ADMIN_CODE_MEM=code;
 const ip=await idbRun('kv','readonly',os=>os.get('ignored_pairs'));
 if(Array.isArray(ip))IGN_STORED=ip;
 else{try{const ls=JSON.parse(storageGet('cart_ignored_pairs','null'));if(Array.isArray(ls))IGN_STORED=ls}catch(e){}}
 const pin=await idbRun('kv','readonly',os=>os.get('admin_pin_ok'));
 if(pin==='1'||storageGet('cart_admin_pin_ok','')==='1')ADMIN_PIN_OK=true;
 await vaultRestore();
}
function queueLocal(){return QMIRROR.slice()}
function enqueueRequest(req){const it={uid:makeUid(),...req};QMIRROR.push(it);idbRun('queue','readwrite',os=>os.put(it));persistMirrorFallback();return it}
function removeQueueLocal(uid){QMIRROR=QMIRROR.filter(x=>x.uid!==uid);idbRun('queue','readwrite',os=>os.delete(uid));persistMirrorFallback()}
function markQueueError(uid,err){const it=QMIRROR.find(x=>x.uid===uid);if(!it)return;it.sendError=String(err||'error');idbRun('queue','readwrite',os=>os.put(it));persistMirrorFallback()}
function isStandaloneApp(){try{return !!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true}catch(e){return false}}
function toB64(s){const bytes=new TextEncoder().encode(s);let b='';for(let i=0;i<bytes.length;i+=0x8000)b+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(b)}
function fromB64(s){const b=atob(s.replace(/\n/g,''));return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)))}
function ghHeaders(){return S.token?{Authorization:`Bearer ${S.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'}:{Accept:'application/vnd.github+json'}}
async function readGitFile(path){const repo=CONFIG.REPO;if(!repo||!CONFIG.OWNER)throw Error('repository not configured');const r=await fetch(`${CONFIG.API}/repos/${encodeURIComponent(CONFIG.OWNER)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(CONFIG.BRANCH)}`,{headers:ghHeaders(),cache:'no-store'});if(!r.ok)throw Error(`GET ${r.status}`);const d=await r.json();return{content:fromB64(d.content||''),sha:d.sha}}
let commitChain=Promise.resolve();
function queuedWrite(fn){const next=commitChain.then(fn,fn);commitChain=next.catch(()=>{});return next}
async function githubWrite(path,content,message){if(!hasMaster())throw Error('read_only');if(!S.token)throw Error('GitHub token required');const repo=CONFIG.REPO;if(!repo||!CONFIG.OWNER)throw Error('repository not configured');return queuedWrite(async()=>{for(let a=0;a<4;a++){const cur=await readGitFile(path).catch(()=>({content:'',sha:null})),body={message,content:toB64(content),branch:CONFIG.BRANCH};if(cur.sha)body.sha=cur.sha;const r=await fetch(`${CONFIG.API}/repos/${encodeURIComponent(CONFIG.OWNER)}/${encodeURIComponent(repo)}/contents/${path}`,{method:'PUT',headers:ghHeaders(),body:JSON.stringify(body)});if(r.ok)return r.json();if(r.status===409){await new Promise(res=>setTimeout(res,500));continue}throw Error(`PUT ${r.status}`)}throw Error('GitHub conflict')})}
/* v5.2.0.1: Оперативный рапорт переписан с нуля. Убрана строка «Валидно»
   и сломанная nextFreeId() (которая на пустой базе всегда лгала «1»).
   Теперь по каждому селу — отдельный разрез Коммерция (Г18=0) / Жители
   (Г18 активна), каскад свободных ID жителей строго append-only
   (максимум существующего ID, но не ниже 10000, +1 — так пустое село
   честно показывает первым свободным 10001, не ломая при этом нижнюю
   границу валидации в rowValidate), и свободные ID коммерции — упакованы
   в независимые раскрывающиеся (details/summary) блоки по активным
   главным папкам (сегодня это 6 несистемных супер-плиток 1-6, при
   открытии резерва 7-9 в будущем — расширится само, без правок кода),
   только для бакетов, где уже есть хотя бы одна карточка. */
function residentNextId(rows,extraFields){
 const ids=rows.filter(r=>r.resParts).map(r=>Number(r.id)).filter(Number.isFinite);
 if(extraFields)for(const f of extraFields){if(f[17]&&f[17]!=='0'){const n=Number(f[0]);if(Number.isFinite(n))ids.push(n)}}
 const max=ids.length?Math.max(...ids):10000;
 return Math.max(max,10000)+1;
}
function nextFreeIdInBucketFor(rows,mainId,subId){
 const base=Number(mainId)*1000+Number(subId)*100;
 const used=new Set(rows.filter(r=>!r.resParts&&idTile(r.id)===Number(mainId)&&idSub(r.id)===Number(subId)).map(r=>Number(r.id)).filter(Number.isFinite));
 for(let s=1;s<=99;s++){if(!used.has(base+s))return String(base+s)}
 return String(base+99);
}
function commerceFreeIdBlocksFor(rows){
 const blocks=[];
 for(const st of SUPER_TILES){
  if(st.hidden)continue;
  const subs=(SUB_TILES[st.id]||[]).filter(sb=>!sb.hidden);
  const items=[];
  for(const sb of subs){
   const count=rows.filter(r=>!r.resParts&&idTile(r.id)===st.id&&idSub(r.id)===sb.sub).length;
   if(!count)continue;
   items.push({label:subLabel(sb),freeId:nextFreeIdInBucketFor(rows,st.id,sb.sub),count});
  }
  if(items.length)blocks.push({label:superLabel(st),items});
 }
 return blocks;
}
function operationalReportVillageHtml(v){
 const d=S.rows.filter(r=>r.file===v.file),bad=S.invalid.filter(x=>x.file===v.file);
 const commerceCount=d.filter(r=>!r.resParts).length,residentCount=d.filter(r=>r.resParts).length;
 const blocks=commerceFreeIdBlocksFor(d);
 const blocksHtml=blocks.map(b=>`<details class="report-pocket"><summary>${esc(b.label)} (${b.items.length})</summary><div class="report-pocket-body">${b.items.map(it=>`<div class="report-line">${esc(T('reportBucketLine',{label:it.label,freeId:it.freeId,count:it.count}))}</div>`).join('')}</div></details>`).join('');
 return `<div class="admin-card">
  <h3>${esc(v.name)}</h3>
  <div class="report-line">${esc(T('reportFileLine',{file:v.file,index:v.index}))}</div>
  <div class="report-line">${esc(T('reportCommerceLine',{count:commerceCount}))}</div>
  <div class="report-line">${esc(T('reportResidentsLine',{count:residentCount,nextId:residentNextId(d)}))}</div>
  <div class="report-line">${esc(T('reportBadLine',{count:bad.length}))}</div>
  ${blocksHtml}
 </div>`;
}
async function operationalReport(){
 await ensureAllLoaded();
 const html=CONFIG.VILLAGES.map(operationalReportVillageHtml).join('');
 showModal(`<div class="modal-content admin-dark">${adminHead(T('reportTitle'))}<div class="admin-card">${esc(T('reportTotals',{valid:S.rows.length,quarantine:S.invalid.length,villages:CONFIG.VILLAGES.length}))}</div>${html}<div class="modal-actions"><button class="secondary" id="reportBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
 bindAdminHome();$('#reportBack').onclick=adminOpen;
}
/* v5.2.0.3: универсальная хирургия карманов сёл. В скрытый карман
   details/summary уходят СТРОГО и ТОЛЬКО сёла, чьи .txt базы ФИЗИЧЕСКИ
   отсутствуют в проекте — проверка идёт через CONFIG.FILES (тот же
   список, который реально подтянут из config.json и реально фетчится
   loadDatabases(), а не через статичный признак на глазок), поэтому
   работает одинаково и локально, и на GitHub Pages. Пустой файл
   (Рубежинское/Байконыс) или файл с 1-2 карточками (Володарское/
   Озёрное) — физически СУЩЕСТВУЕТ, значит село остаётся зрячим в
   основном списке, карман тут ни при чём. */
/* v5.4.0.0: подсчёт карточек по тексту базы: первое число — бизнес, второе — жители (Г2 = ЖИТЕЛИ). Карантинные маркеры не считаются. */
function countsOfText(text){
 let b=0,r=0;
 for(const ln of String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const raw=clean(ln);if(!raw||raw.startsWith('#'))continue;
  const f=raw.split(' | ').map(clean);if(f.length!==20)continue;
  if(isQuarantineMarker(f[19])||CHAT_MARKER_RE.test(f[19]))continue;
  if(f[1].toUpperCase()==='ЖИТЕЛИ')r++;else b++;
 }
 return[b,r];
}
/* Загруженное село считается вживую по тексту базы, незагруженное — по лёгкому индексу counts активного конфига. */
function villageCountsOf(file){
 if(S.loaded.has(file)){const f=S.files.get(file);if(f&&typeof f.text==='string')return countsOfText(f.text)}
 const c=APP_CFG.counts&&APP_CFG.counts[file];
 return Array.isArray(c)?[Number(c[0])||0,Number(c[1])||0]:[0,0];
}
async function syncCountsIndex(file,text){
 try{
  const cur=await readGitFile(CONFIG.PATH_CONFIG);const cfg=JSON.parse(cur.content||'{}');
  cfg.counts=cfg.counts&&typeof cfg.counts==='object'?cfg.counts:{};cfg.counts[file]=countsOfText(text);
  await githubWrite(CONFIG.PATH_CONFIG,JSON.stringify(cfg,null,2)+'\n',`Счётчики села: ${file}`);
  APP_CFG.counts=cfg.counts;
 }catch(e){}
}
function villageHasRealFile(v){return !!(v&&v.dbFile&&CONFIG.FILES.includes(v.dbFile))}
/* v5.2.0.3: замок поэтапных проверок «на дурака». Раньше выход из цепочки
   Область→Район→Посёлок кнопкой «Назад» или «➕ Добавить…» на половине
   пути молча схлопывал модалку в пустоту — форма Анкеты пропадала
   бесследно, и первое же обращение к undefined где-то ниже по цепочке
   ловилось глобальным window.onerror, показывая обезличенный тост
   «Что-то пошло не так». Теперь: (1) у каждого вызова всей цепочки есть
   необязательный onCancel — что показать вместо пустой модалки, когда
   посетитель просто возвращается назад, НЕ потеряв черновик формы;
   (2) каждая кнопка «➕ Добавить…» явно называет СВОЙ номер шага (1 =
   Область, 2 = Район, 3 = Посёлок) и вызывает onPick(null,true,step),
   чтобы вызывающая сторона могла показать точное предупреждение
   «⚠️ Ошибка на Шаге N», а не обрушить общий обработчик ошибок. */
function openGeomodal(onPick,districtSlugOverride,onCancel){
 /* v5.3.0.0: защита — если окно вызвано напрямую как обработчик клика,
    первым аргументом приходит объект события, а не функция выбора. */
 if(typeof onPick!=='function')onPick=undefined;
 if(typeof districtSlugOverride!=='string')districtSlugOverride=undefined;
 if(typeof onCancel!=='function')onCancel=undefined;
 const current=S.village;
 const districtSlug=districtSlugOverride||(CONFIG.VILLAGES.find(x=>x.name===S.village)?.district)||'beyterek';
 const district=geoDistrictBySlug(districtSlug);
 const allVillages=geoVillagesOf(districtSlug).slice().sort((a,b)=>a.nameRu.localeCompare(b.nameRu,'ru'));
 /* v5.4.0.0: живые счётчики [бизнес][жители] у каждого села; сёла с нулями уходят в нижний карман-аккордеон. */
 const cfgOf=v=>CONFIG.VILLAGES.find(x=>x.file===v.dbFile)||CONFIG.VILLAGES.find(x=>x.name===v.nameRu&&x.district===districtSlug);
 const cntOf=v=>{const o=villageHasRealFile(v)?cfgOf(v):null;return o?villageCountsOf(o.file):[0,0]};
 const withData=allVillages.filter(v=>{const c=cntOf(v);return c[0]+c[1]>0});
 const villages=withData;
 const hiddenVillages=allVillages.filter(v=>!withData.includes(v));
 const villageBtn=v=>{const c=cntOf(v);return `<button type="button" class="sector-btn big-action village-row" data-village="${esc(v.nameRu)}"><span class="vname">${esc(villageLabel(v.nameRu))}${v.nameRu===current?' ✓':''}</span><span class="vcnt"><b class="cnt cnt-biz" title="${esc(T('cntBizTitle'))}" aria-label="${esc(T('cntBizTitle'))}">${c[0]}</b><b class="cnt cnt-res" title="${esc(T('cntResTitle'))}" aria-label="${esc(T('cntResTitle'))}">${c[1]}</b></span></button>`};
 const hiddenHtml=hiddenVillages.length?`<details class="search-pocket rest-pocket" id="geoHiddenVillages"><summary><span class="pk-closed">${esc(T('geoRestOpenTitle'))}</span><span class="pk-open">${esc(T('geoRestCloseTitle'))}</span></summary><div class="sector-grid search-pocket-body">${hiddenVillages.map(villageBtn).join('')}</div></details>`:'';
 showModal(`<div class="modal-content"><div class="form-head geo-sticky-head"><button class="back-capsule big-action" id="geoBack">⬅️ ${esc(T('back'))}</button><h2>🗺️ ${esc(districtName(district)||T('villagePickerTitle').replace('🗺️ ',''))}</h2></div>
  <p class="cnt-legend">${esc(T('cntLegend'))}</p>
  <div class="sector-grid">${villages.map(villageBtn).join('')}</div>
  ${hiddenHtml}
  <div class="modal-actions" style="margin-top:12px;flex-direction:column">
   <button type="button" class="secondary big-action w100" id="geoOtherDistrict">${esc(T('otherDistrictBtn'))}</button>
   <button type="button" class="secondary big-action w100" id="geoAddVillage">${esc(T('addVillageBtn'))}</button>
  </div></div>`);
 $('#geoBack').onclick=()=>{if(onCancel){onCancel();return}closeModal();if(!onPick)render()};
 $$('[data-village]').forEach(b=>b.onclick=async()=>{
  const name=b.dataset.village;
  const obj=CONFIG.VILLAGES.find(x=>x.name===name);
  if(onPick){closeModal();onPick({name,obj,districtSlug},false);return}
  if(!obj){toast(T('noDbVillageToast',{village:name}));closeModal();openAddForm('business');return}
  if(!await selectVillage(obj))return;
  if(S.view!=='category'){S.tile=null;S.sub=null;S.tag=null;S.stage='main'}
  S.search='';S.alphabet='';const inp=$('#searchInput');if(inp)inp.value='';
  closeModal();render();scrollTop();
 });
 $('#geoOtherDistrict').onclick=()=>openRegionDistrictModal(onPick,onCancel);
 $('#geoAddVillage').onclick=()=>{
  const ok=confirm(T('addVillageConfirm',{district:districtName(district)||districtSlug}));
  if(!ok)return;closeModal();
  if(onPick){onPick(null,true,3);return}
  toast(T('addVillageToast'));openAddForm('business');
 };
}
const openGeoModal=openGeomodal;
function openRegionDistrictModal(onPick,onCancel){
 const regions=geoRegions();
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="rdBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('regionModalTitle'))}</h2></div><div class="sector-grid">${regions.map(r=>`<button type="button" class="sector-btn big-action" data-region="${esc(r.slug)}">${esc(regionName(r))}</button>`).join('')}</div><div class="modal-actions" style="margin-top:12px"><button type="button" class="secondary big-action w100" id="rdAddRegion">${esc(T('addRegionBtn'))}</button></div></div>`);
 $('#rdBack').onclick=()=>openGeomodal(onPick,null,onCancel);
 $$('[data-region]').forEach(b=>b.onclick=()=>openDistrictStep(b.dataset.region,onPick,onCancel));
 $('#rdAddRegion').onclick=()=>{
  const ok=confirm(T('addRegionConfirm'));if(!ok)return;closeModal();
  if(onPick){onPick(null,true,1);return}
  toast(T('addRegionToast'));openAddForm('business');
 };
}
function openDistrictStep(regionSlug,onPick,onCancel){
 const districts=geoDistricts(regionSlug);
 showModal(`<div class="modal-content"><div class="form-head"><button class="back-capsule big-action" id="dBack">⬅️ ${esc(T('back'))}</button><h2>${esc(T('districtModalTitle'))}</h2></div><div class="sector-grid">${districts.map(d=>`<button type="button" class="sector-btn big-action" data-district="${esc(d.slug)}">${esc(districtName(d))}</button>`).join('')}</div><div class="modal-actions" style="margin-top:12px"><button type="button" class="secondary big-action w100" id="dAddDistrict">${esc(T('addDistrictBtn'))}</button></div></div>`);
 $('#dBack').onclick=()=>openRegionDistrictModal(onPick,onCancel);
 $$('[data-district]').forEach(b=>b.onclick=()=>openGeomodal(onPick,b.dataset.district,onCancel));
 $('#dAddDistrict').onclick=()=>{
  const ok=confirm(T('addDistrictConfirm'));if(!ok)return;closeModal();
  if(onPick){onPick(null,true,2);return}
  toast(T('addDistrictToast'));openAddForm('business');
 };
}
function quarantineBadgeCount(){const pre=window.__CARTOTEKA_PRECHECK__,gateFails=pre&&Array.isArray(pre.gates)?pre.gates.filter(g=>!g.ok).length:0;return (S.invalid?.length||0)+(S.quarantine?.length||0)+gateFails}
async function quarantineMonitor(){
 await ensureAllLoaded();
 const structural=S.invalid.slice();
 const markers=S.quarantine.slice();
 const pre=window.__CARTOTEKA_PRECHECK__;
 const gates=(pre&&Array.isArray(pre.gates))?pre.gates:[];
 const gateFails=gates.filter(g=>!g.ok);
 showModal(`<div class="modal-content admin-dark">${adminHead(T('quarantineTitle'))}
  <div class="admin-card">${esc(T('quarantineGateSummary',{status:gates.length?(gateFails.length?T('quarantineGateFail',{count:gateFails.length}):T('quarantineGateOk')):T('quarantineGatePending')}))}</div>
  ${gateFails.map(g=>`<div class="error-card"><b>${esc(g.name)}</b><br>${esc(g.error||T('quarantineGateNoResponse'))}</div>`).join('')}
  <div class="admin-card">${esc(T('quarantineStructuralCount',{count:structural.length}))}</div>
  ${structural.map(x=>`<div class="error-card"><b>${esc(x.file)}</b> · ${esc(x.line)}<br>${esc((x.errors||[]).join('; '))}</div>`).join('')}
  <div class="admin-card">${esc(T('quarantineMarkerCount',{count:markers.length}))}</div>
  ${markers.map(x=>`<div class="warn-card"><b>${esc(x.file)}</b> · ${esc(x.line)} · ID ${esc(x.id)}<br>${T('quarantineMarkerHint',{marker:esc(x.marker)})}</div>`).join('')}
  ${!structural.length&&!markers.length&&!gateFails.length?`<div class="ok-card">${esc(T('quarantineEmpty'))}</div>`:''}
  <div class="modal-actions"><button class="secondary" id="quarantineBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
 bindAdminHome();$('#quarantineBack').onclick=adminOpen;
}
function normalizePhoneKey(v){const d=digits(v);if(d.length===10)return '7'+d;if(d.length===11&&d.startsWith('7'))return d;if(d.length===11&&d.startsWith('8'))return '7'+d.slice(1);return d||''}
function checkDuplicateOnSubmit(fd,mode){
 if(mode==='resident')return 'OK';
 const phones=[clean(fd.get('city')),clean(fd.get('mobile1')),clean(fd.get('mobile2'))].map(normalizePhoneKey).filter(Boolean);
 if(!phones.length)return 'OK';
 const mainId=Number(fd.get('superTile'))||0,subId=Number(fd.get('subTile'))||0;
 for(const r of S.rows){
  if(r.folder==='ЖИТЕЛИ'||!r.homeParts)continue;
  const rPhones=[r.city,r.mobile1,r.mobile2].map(normalizePhoneKey).filter(Boolean);
  if(!rPhones.some(p=>phones.includes(p)))continue;
  const rTile=idTile(r.id),rSub=idSub(r.id);
  if(rTile===mainId&&rSub===subId){showDuplicateHardBlock(r);return 'BLOCKED'}
  const ok=confirm(T('dupWarnConfirm',{title:r.title}));
  if(!ok)return 'BLOCKED';
  return 'OK';
 }
 return 'OK';
}
function showDuplicateHardBlock(r){
 showModal(`<div class="modal-content"><h2>${esc(T('dupHardTitle'))}</h2><p>${esc(T('dupHardText'))}</p><div class="modal-actions"><button class="secondary big-action" id="dupClose">${esc(T('dupCloseBtn'))}</button><button class="primary big-action" id="dupFix">${esc(T('dupFixBtn'))}</button></div></div>`);
 $('#dupClose').onclick=closeModal;$('#dupFix').onclick=()=>{closeModal();openErrorEditor(r)};
}
/* v5.3.0.4: исключения Инспектора дубликатов. Пара = два ID одного файла, ключ «файл::ID|файл::ID» (по возрастанию ID).
   Хранилище: IndexedDB на устройстве (переживает обновления кода и очистку кэша страницы) + зеркало в localStorage;
   первичный источник при самом первом запуске — массив ignored_pairs из config.json; кнопка «Записать в GitHub» выгружает массив обратно в config.json. */
function pairKey(a,b){const ka=`${a.file}::${a.id}`,kb=`${b.file}::${b.id}`;return (Number(a.id)<Number(b.id)||(Number(a.id)===Number(b.id)&&ka<=kb))?`${ka}|${kb}`:`${kb}|${ka}`}
function ignSet(){
 if(!IGN_SET){
  const cfgArr=Array.isArray(APP_CFG.ignored_pairs)?APP_CFG.ignored_pairs:[];
  IGN_SET=new Set((IGN_STORED!==null?IGN_STORED:cfgArr).filter(x=>typeof x==='string'&&x.includes('|')));
 }
 return IGN_SET;
}
function saveIgn(){
 const arr=[...ignSet()].sort();IGN_STORED=arr;
 storageSet('cart_ignored_pairs',JSON.stringify(arr));
 idbRun('kv','readwrite',os=>os.put(arr,'ignored_pairs'));
}
function ignPairLabel(k){
 return k.split('|').map(part=>{const[file,id]=part.split('::');const r=S.rows.find(x=>String(x.id)===id&&x.file===file);return r?`${r.title} · ID ${id}`:`ID ${id} · ${file}`}).join('  ⇄  ');
}
async function writeIgnToGithub(){
 if(!S.token){toast(T('dupNoTokenToast'));return}
 try{
  const cur=await readGitFile(CONFIG.PATH_CONFIG);let cfg={};try{cfg=JSON.parse(cur.content||'{}')}catch(e){cfg={}}
  cfg.ignored_pairs=[...ignSet()].sort();
  await githubWrite(CONFIG.PATH_CONFIG,JSON.stringify(cfg,null,2)+'\n','Админ: исключения Инспектора дубликатов');
  APP_CFG=Object.assign(APP_CFG,{ignored_pairs:cfg.ignored_pairs});toast(T('dupWriteOkToast'));
 }catch(e){toast(T('dupWriteFailToast'))}
}
async function duplicateInspector(){
 await ensureAllLoaded();
 const buckets={commercial:new Map(),resident:new Map()};
 for(const r of S.rows){const type=r.folder==='ЖИТЕЛИ'?'resident':'commercial';const seen=new Set();for(const p of [r.city,r.mobile1,r.mobile2]){const k=normalizePhoneKey(p);if(!k||seen.has(k))continue;seen.add(k);if(!buckets[type].has(k))buckets[type].set(k,[]);buckets[type].get(k).push(r)}}
 const ign=ignSet(),pairs=new Map();
 for(const type of ['commercial','resident'])for(const [phone,rows] of buckets[type])if(rows.length>1){
  for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){
   const key=pairKey(rows[a],rows[b]);
   if(ign.has(key))continue;
   const p=pairs.get(key)||{key,type,phones:[],a:rows[a],b:rows[b]};
   if(!p.phones.includes(phone))p.phones.push(phone);pairs.set(key,p);
  }
 }
 const list=[...pairs.values()];
 const ignList=[...ign].sort();
 const infoHtml=`<button type="button" class="dup-ign-info" id="dupIgnInfo" aria-expanded="${DUP_IGN_OPEN?'true':'false'}">${esc(T('dupIgnoredInfo',{n:ignList.length}))} ${DUP_IGN_OPEN?'▴':'▾'}</button>`
  +`<div class="dup-ign-list ${DUP_IGN_OPEN?'':'hidden'}" id="dupIgnList">${ignList.length?ignList.map(k=>`<div class="admin-card dup-ign-row"><div>${esc(ignPairLabel(k))}</div><button type="button" class="secondary" data-ignback="${esc(k)}">${esc(T('dupReturnBtn'))}</button></div>`).join(''):`<div class="admin-card">${esc(T('dupIgnoredEmpty'))}</div>`}<button type="button" class="primary" id="dupIgnGit">${esc(T('dupWriteGithubBtn'))}</button></div>`;
 const pairsHtml=list.length?list.map(p=>`<div class="warn-card dup-pair"><b>${p.type==='resident'?esc(T('dupeGroupResident')):esc(T('dupeGroupCommercial'))} · ${esc(p.phones.join(', '))}</b>${[p.a,p.b].map(r=>`<div>${esc(r.title)} · ID ${esc(r.id)} · ${esc(r.file)}</div>`).join('')}<button type="button" class="secondary" data-ignore="${esc(p.key)}">${esc(T('dupIgnoreBtn'))}</button></div>`).join(''):`<div class="ok-card">${esc(T('dupeEmpty'))}</div>`;
 showModal(`<div class="modal-content admin-dark">${adminHead(T('dupeInspectorTitle'))}${infoHtml}<div class="admin-card">${esc(T('dupeInspectorHint'))}</div>${pairsHtml}<div class="modal-actions"><button class="secondary" id="dupeBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
 bindAdminHome();$('#dupeBack').onclick=adminOpen;
 $('#dupIgnInfo').onclick=()=>{DUP_IGN_OPEN=!DUP_IGN_OPEN;duplicateInspector()};
 $('#dupIgnGit').onclick=writeIgnToGithub;
 $$('[data-ignore]').forEach(b=>b.onclick=()=>{ignSet().add(b.dataset.ignore);saveIgn();duplicateInspector()});
 $$('[data-ignback]').forEach(b=>b.onclick=()=>{ignSet().delete(b.dataset.ignback);saveIgn();duplicateInspector()});
}
async function vipMonitor(){
 try{await loadVip()}catch(e){}
 const entries=[];
 for(const v of CONFIG.VILLAGES){for(const [key,date] of S.vip){if(key.startsWith(v.code+'::'))entries.push({v,id:key.split('::')[1],date,active:isVip({file:v.file,id:key.split('::')[1]})})}}
 entries.sort((a,b)=>Number(b.active)-Number(a.active)||String(a.date).localeCompare(String(b.date),'ru'));
 showModal(`<div class="modal-content admin-dark">${adminHead(T('vipMonitorTitle'))}<div class="admin-card">${esc(T('vipCount',{count:entries.length}))}</div>${entries.length?entries.map(e=>`<div class="admin-card">${esc(e.v.name)} · ID ${esc(e.id)} · ${esc(e.date)} · ${e.active?esc(T('vipActive')):esc(T('vipEnded'))}</div>`).join(''):`<div class="ok-card">${esc(T('vipEmpty'))}</div>`}<div class="modal-actions"><button class="secondary" id="vipBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
 bindAdminHome();$('#vipBack').onclick=adminOpen;
}
/* v5.3.0.0: ОЧЕРЕДЬ ЗАЯВОК = ЖИВАЯ GOOGLE ТАБЛИЦА Baiterek_Ochered_2026.
   «Удалённо» — строки, которые админ читает из таблицы через веб-хук
   (action=list, только с кодом приёма, который хранится в памяти вкладки
   и в публичный сайт не попадает). «Локально» — заявки, ещё не ушедшие
   из этого телефона. Кнопки: «Одобрить» (статус «Одобрена»), «Отклонить»,
   «Копировать» (ОДНА чистая строка с маркером «$» — для вставки в .txt села),
   «Внесена» (после ручной вставки в базу). */
/* v5.3.0.1: ВНЕСЕНИЕ ОДОБРЕННОЙ СТРОКИ. Только для новых записей (NEW):
   правки и удаления вносятся вручную (для них нужен поиск старой строки).
   Клик 1: appendToLocalServer — строка дописывается в подвал .txt села на
   телефоне через локальный Питон-сервер (cartoteka_server.py, запуск в
   Pydroid 3). Клик 2: appendToGithub — та же строка дописывается в файл
   репозитория по токену, введённому на пульте. Дубль (та же строка уже в
   файле) не создаётся. */
async function appendToLocalServer(file,line){
 try{
  if(!hasMaster())return false;
  const r=await fetch('/__append',{method:'POST',headers:srvHeaders(),body:JSON.stringify({file,line}),cache:'no-store'});
  if(!r.ok)return false;
  const j=await r.json();
  return j&&j.ok?(j.duplicate?'dup':true):false;
 }catch(e){return false}
}
async function appendToGithub(file,line){
 if(!S.token)return 'notoken';
 try{
  const cur=await readGitFile(dbPath(file));
  const text=cur&&cur.content!==undefined?cur.content:'';
  const rows=text.split(/\r?\n/);
  if(rows.some(x=>x.trim()===line.trim()))return 'dup';
  const newId=String(line).split(' | ')[0];
  if(rows.some(x=>x.trim()&&x.trim()[0]!=='#'&&x.split(' | ')[0].trim()===newId))return 'idclash';
  const next=(text.endsWith('\n')||text===''?text:text+'\n')+line+'\n';
  await githubWrite(dbPath(file),next,`Одобренная заявка: ${file}`);
  await syncCountsIndex(file,next);
  return 'ok';
 }catch(e){return 'fail'}
}
/* Код приёма: в установленном приложении — запоминается в IndexedDB «намертво»
   (до удаления приложения/данных сайта); в обычной вкладке (Терминал Pydroid,
   смена порта = новый адрес) — только в памяти вкладки. */
function saveAdminPin(){ADMIN_PIN_OK=true;storageSet('cart_admin_pin_ok','1');idbRun('kv','readwrite',os=>os.put('1','admin_pin_ok'))}
/* Поле пароля: символы скрыты точками, справа «глазик» (тап — показать/скрыть). */
function pwField(id,ph,val){return `<span class="pw-wrap"><input id="${id}" type="password" value="${esc(val||'')}" placeholder="${esc(ph)}" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="pw-eye" data-eye="${id}" aria-label="${esc(T('eyeToggle'))}">👁</button></span>`}
function bindEyes(root){(root||document).querySelectorAll('.pw-eye').forEach(b=>{b.onclick=()=>{const i=document.getElementById(b.dataset.eye);if(!i)return;const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'🙈':'👁';b.classList.toggle('on',show)}})}

/* ===== v5.3.0.5: «ЗАПОМНИТЬ МЕНЯ НА ЭТОМ УСТРОЙСТВЕ» =====
   Пароль-допуск, код приёма и токен GitHub один раз шифруются (AES-GCM, ключ
   неизвлекаемый, лежит в IndexedDB) и хранятся в IndexedDB + localStorage.
   При запуске расшифровываются сами — пульт открывается без ручного ввода,
   а «В GitHub» делает коммиты прямо из браузера (Python-сервер не нужен). */
let VAULT_ON=false;
async function vaultKey(){
 let k=await idbRun('kv','readonly',os=>os.get('vault_key'));
 if(k&&typeof k==='object'&&k.type==='secret')return k;
 k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 await idbRun('kv','readwrite',os=>os.put(k,'vault_key'));return k;
}
async function vaultSave(){
 try{
  if(!(window.crypto&&crypto.subtle)){toast(T('rememberNoCrypto'));return false}
  const key=await vaultKey(),iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify({pin:ADMIN_PIN_OK?'1':'',code:adminCode()||'',token:S.token||''}));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data));
  const blob=JSON.stringify({iv:Array.from(iv),ct:Array.from(ct)});
  await idbRun('kv','readwrite',os=>os.put(blob,'vault'));storageSet('cart_vault',blob);VAULT_ON=true;return true;
 }catch(e){return false}
}
async function vaultLoad(){
 try{
  if(!(window.crypto&&crypto.subtle))return null;
  let blob=await idbRun('kv','readonly',os=>os.get('vault'));
  if(typeof blob!=='string'||!blob.startsWith('{'))blob=storageGet('cart_vault','');
  if(typeof blob!=='string'||!blob.startsWith('{'))return null;
  const b=JSON.parse(blob),key=await vaultKey();
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b.iv)},key,new Uint8Array(b.ct));
  VAULT_ON=true;return JSON.parse(new TextDecoder().decode(pt));
 }catch(e){return null}
}
async function vaultForget(){
 VAULT_ON=false;storageRemove('cart_vault');storageRemove('cart_admin_pin_ok');
 await idbRun('kv','readwrite',os=>os.delete('vault'));await idbRun('kv','readwrite',os=>os.delete('admin_pin_ok'));await idbRun('kv','readwrite',os=>os.delete('admin_code'));
 ADMIN_PIN_OK=false;ADMIN_CODE_MEM='';S.token='';storageRemove('cart_admin_token_persist');
}
function vaultSync(){if(VAULT_ON)vaultSave()}
async function vaultRestore(){
 const v=await vaultLoad();if(!v)return;
 if(v.pin==='1')ADMIN_PIN_OK=true;
 if(v.code&&!ADMIN_CODE_MEM)ADMIN_CODE_MEM=v.code;
 if(v.token&&!S.token){S.token=v.token;relayAdminTokenToSw(v.token)}
}
/* v1.0.0.3: ДВА ЗАМКА. Код входа открывает пульт в режиме «Только чтение»; изменения (запись, отправка, облачные действия)
   требуют Мастер-пароля: сервер выдаёт временную сессию (10 минут). Пароль и сессия живут только в памяти страницы. */
let MSESS='',MSESS_UNTIL=0,MASTER_MEM='';
const MUT_ACTIONS=['setStatus','reid','updateRow','setTelegram','testTelegram'];
function hasMaster(){if(MSESS&&Date.now()<MSESS_UNTIL)return true;MSESS='';MASTER_MEM='';return false}
function srvHeaders(){const h={'Content-Type':'application/json'};if(MSESS)h['X-Cart-Session']=MSESS;return h}
async function masterLock(){MSESS='';MSESS_UNTIL=0;MASTER_MEM='';try{await fetch('/__lock',{method:'POST',cache:'no-store'})}catch(e){}}
function masterModal(onOk){
 const old=document.getElementById('masterOverlay');if(old)old.remove();
 const d=document.createElement('div');d.id='masterOverlay';d.className='master-overlay';
 d.innerHTML=`<div class="master-box"><h3>${esc(T('masterTitle'))}</h3><div class="hint">${esc(T('masterHint'))}</div>${pwField('masterInput',T('masterPlaceholder'))}<input type="text" id="masterPath" value="${esc(storageGet('cart_secrets_path',''))}" placeholder="${esc(T('secretsPathPlaceholder'))}" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="modal-actions"><button class="primary" id="masterOk">${esc(T('masterOkBtn'))}</button><button class="secondary" id="masterCancel">${esc(T('masterCancelBtn'))}</button></div></div>`;
 document.body.appendChild(d);bindEyes(d);
 const shut=()=>{d.remove()};
 const go=async()=>{
  const m=normPhrase($('#masterInput').value);if(!m){toast(T('badCodeToast'));return}
  const path=clean($('#masterPath').value);if(path)try{storageSet('cart_secrets_path',path)}catch(e){}
  let r=null;try{const resp=await fetch('/__unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:adminCode(),master:m,path}),cache:'no-store'});r=resp.ok?await resp.json():null}catch(e){r=null}
  if(!r){banner(T('needServer'),true);return}
  if(r.ok){MSESS=r.session;MSESS_UNTIL=Date.now()+(r.ttl||600)*1000-5000;MASTER_MEM=m;shut();toast(T('masterOpenToast'));if(onOk)onOk()}
  else{const k=String(r.error||'');banner(T(k==='wait'?'authWaitToast':k.indexOf('master_first_')===0?'masterFirstFail':'masterBadToast'),true);$('#masterInput').value=''}
 };
 $('#masterOk').onclick=go;$('#masterInput').addEventListener('keydown',e=>{if(e.key==='Enter')go()});
 $('#masterCancel').onclick=shut;
 setTimeout(()=>{try{$('#masterInput').focus()}catch(e){}},50);
}
/* Оборачивает кнопку изменения: без сессии мастера открывает окно пароля и только после него выполняет действие. */
function gated(fn){return function(){const a=arguments,self=this;if(hasMaster())return fn.apply(self,a);masterModal(()=>fn.apply(self,a))}}
/* Тревога: пульт зажат на устройстве без нашего сервера. Сигнал в Telegram: марка, IP, город, время. Не чаще раза в 5 минут. */
async function foreignAlarm(){
 try{
  const last=Number(storageGet('cart_alarm_last','0'))||0;if(Date.now()-last<300000)return;
  storageSet('cart_alarm_last',String(Date.now()));
  if(!intakeUrl())return;
  const ua=navigator.userAgent||'';
  const m=/\(([^)]*)\)/.exec(ua);const device=(m?m[1]:ua).slice(0,80);
  let ip='',city='';
  const tf=async(u)=>{const c=typeof AbortController==='function'?new AbortController():null;const t=c?setTimeout(()=>c.abort(),4000):0;try{const r=await fetch(u,{cache:'no-store',signal:c?c.signal:undefined});return r.ok?await r.json():null}catch(e){return null}finally{if(t)clearTimeout(t)}};
  const a=await tf('https://api.ipify.org?format=json');if(a&&a.ip)ip=String(a.ip);
  const b=await tf('https://ipapi.co/'+(ip?encodeURIComponent(ip)+'/':'')+'json/');if(b&&(b.city||b.country_name))city=[b.city,b.country_name].filter(Boolean).join(', ');
  await intakePost({action:'alarm',device,ip,city});
 }catch(e){}
}
async function serverAlive(){try{const r=await fetch('/__ping',{cache:'no-store'});if(!r.ok)return false;const j=await r.json();return !!(j&&j.ok)}catch(e){return false}}
function adminPinModal(){
 showModal(`<div class="modal admin-dark"><h2>${esc(T('adminPinTitle'))}</h2><div class="form-grid">${pwField('adminPinInput',T('adminPinPlaceholder'))}<label class="remember-row"><input type="checkbox" id="adminRememberChk" checked> ${esc(T('rememberMe'))}</label></div><div class="modal-actions"><button class="primary" id="adminPinOk">${esc(T('adminPinOkBtn'))}</button><button class="secondary" id="adminPinCancel">${esc(T('adminClose'))}</button></div></div>`);
 bindEyes($('#modalRoot'));
 const go=async()=>{
  const v=$('#adminPinInput').value;if(!clean(v)){toast(T('badCodeToast'));return}
  let r=null;try{const resp=await fetch('/__auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:normPhrase(v)}),cache:'no-store'});r=resp.ok?await resp.json():null}catch(e){r=null}
  if(!r){banner(T('needServer'),true);return}
  if(r.ok){
   saveAdminCode(normPhrase(v));
   const rem=$('#adminRememberChk')?.checked;
   if(rem){saveAdminPin();await vaultSave();toast(T('rememberMeSaved'))}else ADMIN_PIN_OK=true;
   if(r.first)toast(T('authFirstToast'));
   closeModal();adminOpen();
  }else{banner(T(r.error==='wait'?'authWaitToast':'badCodeToast'),true);$('#adminPinInput').value=''}
 };
 $('#adminPinOk').onclick=go;$('#adminPinInput').addEventListener('keydown',e=>{if(e.key==='Enter')go()});
 $('#adminPinCancel').onclick=closeModal;
 setTimeout(()=>{try{$('#adminPinInput').focus()}catch(e){}},50);
}
function adminCode(){return ADMIN_CODE_MEM||storageGetSession('cart_admin_code','')}
function saveAdminCode(v){
 ADMIN_CODE_MEM=v;
 if(isStandaloneApp())idbRun('kv','readwrite',os=>os.put(v,'admin_code'));
 else storageSetSession('cart_admin_code',v);
 vaultSync();
}
/* v1.0.0.3: мастер-сессия продлевается каждым успешным действием; если истекла посреди операции — окно пароля открывается ОДИН раз, и действие продолжается. */
function touchMaster(){if(MSESS)MSESS_UNTIL=Date.now()+600000-5000}
function needMaster(){return new Promise(res=>{if(hasMaster()){res(true);return}const t=setTimeout(()=>res(false),180000);masterModal(()=>{clearTimeout(t);res(true)})})}
async function adminIntake(payload){
 const code=adminCode();
 if(!intakeUrl())return {ok:false,error:'no_url'};
 if(!code)return {ok:false,error:'no_code'};
 const mut=MUT_ACTIONS.indexOf(payload&&payload.action)>=0;
 if(mut&&!hasMaster()){toast(T('masterExpiredToast'));if(!await needMaster())return {ok:false,error:'locked'}}
 try{const r=await intakePost(Object.assign({code},mut?{master:MASTER_MEM}:{},payload));if(mut&&r&&r.ok)touchMaster();return r||{ok:false,error:'network'}}catch(e){return {ok:false,error:'network'}}
}
function intakeErrorText(res){
 const e=res&&res.error;
 if(e==='no_url')return T('intakeNoUrlToast');
 if(e==='no_code')return T('intakeNoCodeToast');
 if(e==='forbidden')return T('intakeForbiddenToast');
 if(e==='locked')return T('masterExpiredToast');
 if(e==='master_required')return T('masterCloudToast');
 return T('intakeNetworkToast');
}
/* ===== v1.0.0.3: БРОНЯ ОЧЕРЕДИ ЗАЯВОК ===== */
/* Правки администратора (опечатки) живут в памяти вкладки по uid заявки и подхватываются ВСЕМИ кнопками: Одобрить, В файл + Буфер, В GitHub. */
const QEDIT=new Map((()=>{try{return JSON.parse(storageGetSession('cart_qedit','[]'))||[]}catch(e){return []}})());
/* v1.0.0.3: заявки, одобрение которых облако УЖЕ подтвердило. Карточка с такой отметкой рисуется как «Одобрена» с рабочими кнопками файла/GitHub,
   даже если список из облака пришёл со старым статусом или запрос списка не удался. Отметка снимается, когда облако сообщает «Внесена»/«Отклонена». */
const QAPPROVED=new Set();
function qeditSave(){try{storageSetSession('cart_qedit',JSON.stringify(Array.from(QEDIT.entries())))}catch(e){}}
function baseLineOf(item){
 const lines=String(item.row||item.candidateRow||'').split('\n').filter(Boolean);
 const last=lines[lines.length-1]||'';
 return item.kind==='DELETE'||isChatRow(last)?last:markerSwap(last,'$');
}
function copyLineOf(item){return QEDIT.get(item.uid)||baseLineOf(item)}
function origOf(item){
 if(item.kind!=='EDIT')return '';
 if(item.original)return markerSwap(item.original.split('\n').filter(Boolean)[0]||'','$');
 const lines=String(item.candidateRow||'').split('\n').filter(Boolean);
 return lines.length>1?markerSwap(lines[0],'$'):'';
}
/* Радар правок: индексы граф, которые отличаются (сравнение по номеру графы, пробелы по краям не важны). */
function diffIdx(a,b){
 const x=String(a||'').split(' | '),y=String(b||'').split(' | '),out=new Set();
 for(let i=0;i<Math.max(x.length,y.length);i++)if(String(x[i]??'').trim()!==String(y[i]??'').trim())out.add(i);
 return out;
}
function diffLineHtml(line,set,cls){
 return String(line||'').split(' | ').map((v,i)=>set&&set.has(i)?`<span class="${cls}">${esc(v)}</span>`:`<span class="df-same">${esc(v)}</span>`).join(' | ');
}
function queueCardHtml(item,source){
 if(!item||!(item.row||item.candidateRow))return `<div class="warn-card">${esc(T('queueBadRecordLine'))}</div>`;
 const line=copyLineOf(item),orig=origOf(item);
 const f=line.split(' | ');
 const chat=isChatRow(line);
 const title=chat?(f[1]||'.'):(f[2]||'.'),folder=chat?T('chatKind_'+f[19].trim()):(f[1]||'.'),village=chat?(item.village||'—'):(f[10]||'.');
 let status=source==='remote'?(item.status||'Новая'):(item.sendError?'⚠ '+item.sendError:'');
 if(source==='remote'&&status==='Новая'&&QAPPROVED.has(item.uid))status='Одобрена';
 const kind=item.kind||'NEW',uid=esc(item.uid);
 const isRemote=source==='remote';
 const idBad=isRemote&&QAUDIT.flags.has(item.uid);
 const head=`<b>${esc(kind)}</b>${status?` · ${esc(status)}`:''}${QEDIT.has(item.uid)?` · ✎`:''} · ID ${esc(f[0]||'')} · ${esc(title)}<br>${chat?'💬':'📂'} ${esc(folder)} · 📍 ${esc(village)}${item.reason?`<br>${esc(item.reason)}`:''}`;
 /* Жалоба «Ссылка сброшена» на плашку чата: один красный клик стирает строку на телефоне и на GitHub */
 if(chat&&kind==='DELETE'){
  const n=Array.from(QITEMS.values()).filter(x=>x.item.kind==='DELETE'&&x.item.file===item.file&&String(x.item.id||'').replace(/^0+/,'')===String(item.id||f[0]).replace(/^0+/,'')&&(x.item.status||'Новая')==='Новая').length||1;
  const can=isRemote&&(status==='Новая'||status==='Одобрена');
  return `<div class="admin-card q-card" data-quid="${uid}">${head}<br>👥 ${esc(T('chatReportsN',{n}))}<div class="df-cap">${esc(f[3]||'')}</div><div class="queue-row-actions q-two"><button class="qb-chatdel" data-q-chatdel="${uid}"${can?'':' disabled'}>${esc(T('qbChatDel'))}</button><button class="qb-reject" data-q-reject="${uid}" data-q-src="${isRemote?'remote':'local'}">${esc(T('qbChatAlive'))}</button></div>${can?'':`<div class="q-why">${esc(T('qWhyLocal'))}</div>`}</div>`;
 }
 const canApprove=(!isRemote&&!item.sendError)||(isRemote&&status==='Новая');
 const canWrite=isRemote&&status==='Одобрена'&&kind!=='DELETE';
 const canDone=isRemote&&status==='Одобрена';
 const dis=ok=>ok?'':' disabled';
 const buttons=`<button class="qb-approve" data-q-approve="${uid}"${dis(canApprove)}>${esc(T('qbApprove'))}</button>
  <button class="qb-edit" data-q-edit="${uid}">${esc(T('qbEdit'))}</button>
  <button class="qb-file" data-q-file="${uid}"${dis(canWrite)}>${esc(T('qbFile'))}</button>
  <button class="qb-gh" data-q-gh="${uid}"${dis(canWrite)}>${esc(T('qbGithub'))}</button>
  <button class="qb-done" data-q-done="${uid}"${dis(canDone)}>${esc(T('qbDone'))}</button>
  <button class="qb-reject" data-q-reject="${uid}" data-q-src="${isRemote?'remote':'local'}">${esc(T('qbReject'))}</button>`;
 /* Подсказка: почему серые кнопки */
 let why='';
 if(!canApprove&&!canWrite)why=isRemote?(status==='Одобрена'?'':T('qWhyStatus',{status})):T('qWhyLocalErr');
 else if(!canWrite&&kind!=='DELETE')why=T('qWhyWrite');
 const dset=orig?diffIdx(orig,line):null;
 const blocks=orig
  ?`<div class="df-cap">${esc(T('dfWas'))}</div><div class="queue-row-mono" data-qv="${uid}">${diffLineHtml(orig,dset,'df-old')}</div><div class="df-cap">${esc(T('dfNow'))} · ${esc(T('dfCount',{n:dset.size}))}</div><div class="queue-row-mono" data-qv="${uid}">${diffLineHtml(line,dset,'df-new')}</div>`
  :`<div class="queue-row-mono" data-qv="${uid}">${esc(line)}</div>`;
 return `<div class="admin-card q-card" data-quid="${uid}">${head}${idBad?`<br><span class="queue-blocked">${esc(T('qIdWarn'))}</span>`:''}${blocks}<div class="queue-row-actions q-six">${buttons}</div>${why?`<div class="q-why">${esc(why)}</div>`:''}</div>`;
}
let QITEMS=new Map();
let QAUDIT={flags:new Map(),plan:[]};
/* Окно «Полная строка»: читать (радар красный/зелёный) или Редактировать (20 полей ввода). Отдельный слой поверх пульта: очередь под ним не сбрасывается. */
/* v1.0.0.3: АВТОСВЯЗКА Г2↔Г1. Название категории в Г2 («Главная — Подкатегория») -> индексы плитки C и подкатегории T1.
   Узнаёт названия на обоих языках. Возвращает {c,sb} либо null (не бизнес-папка/не найдено). */
function folderToIds(folder){
 const f=String(folder||'').split('—').map(x=>x.trim().toLowerCase());if(!f[0]||f[0]==='жители')return null;
 const st=SUPER_TILES.find(x=>[x.ru,x.kz].some(n=>String(n||'').trim().toLowerCase()===f[0]));if(!st)return null;
 if(!f[1])return null;
 const sb=(SUB_TILES[st.id]||[]).find(x=>[x.ru,x.kz].some(n=>String(n||'').trim().toLowerCase()===f[1]));
 return sb?{c:st.id,sb:sb.sub}:null;
}
/* Пересчёт Г1 и масок Г17/Г19 под категорию из Г2. vals — 20 граф; возвращает {vals,log} либо null, если связка уже верна. */
function linkFolderToId(vals,file,ownId){
 const ids=folderToIds(vals[1]);if(!ids||isChatRow(vals.join(' | ')))return null;
 const curC=idTile(vals[0]),curS=idSub(vals[0]);
 if(curC===ids.c&&curS===ids.sb)return null;
 const used=zoneUsedIds(file);used.delete(Number(ownId));
 const nid=nextZoneId(file,false,ids.c,ids.sb,used);
 const out=vals.slice(),hp=String(out[16]).split('/');
 if(hp.length===10){hp[1]=String(ids.c);hp[2]=String(ids.sb);hp[3]='0';out[16]=hp.join('/')}
 const sp=String(out[18]).split('/');
 if(sp.length===7){sp[4]='0';out[18]=sp.join('/')}
 out[0]=nid;
 return{vals:out,log:`Г2 «${vals[1]}» → плитка ${ids.c}, подкатегория ${ids.sb}; Г1 ${vals[0]} → ${nid}; Г17 и Г19 пересчитаны`};
}
/* v1.0.0.3: Г2 выбирается ДВУМЯ окнами подряд (главная категория → подкатегория), без ручного ввода.
   В обоих окнах есть [ ⬅️ Назад ]: из окна 2 — в окно 1, из окна 1 — обратно в редактор. Текст Г2 подставляется
   готовым («Магазины — Онлайн-магазины/ПВЗ»), опечатки невозможны. */
function g2Picker(done){
 const close=()=>{const o=document.getElementById('g2Picker');if(o)o.remove()};
 const show=inner=>{close();const o=document.createElement('div');o.id='g2Picker';o.className='master-overlay row-viewer';o.style.zIndex=100001;o.innerHTML=`<div class="master-box row-viewer-box">${inner}</div>`;document.body.appendChild(o);return o};
 const main=()=>{
  const sts=SUPER_TILES.filter(x=>!x.hidden);
  const o=show(`<div class="form-head"><button type="button" class="back-capsule" id="g2Back">⬅️ ${esc(T('back'))}</button><h3>${esc(T('g2PickMainTitle'))}</h3></div>${sts.map(x=>`<button type="button" class="sector-btn" data-g2m="${x.id}">${esc(x.emoji||'📂')} ${esc(x.ru)}</button>`).join('')}`);
  o.querySelector('#g2Back').onclick=close;
  o.querySelectorAll('[data-g2m]').forEach(b=>b.onclick=()=>sub(Number(b.dataset.g2m)));
 };
 const sub=cid=>{
  const st=SUPER_TILES.find(x=>x.id===cid);if(!st)return;
  const sbs=(SUB_TILES[cid]||[]).filter(x=>!x.hidden&&!/^Резерв/i.test(String(x.ru||'')));
  const o=show(`<div class="form-head"><button type="button" class="back-capsule" id="g2Back">⬅️ ${esc(T('back'))}</button><h3>${esc(st.ru)}</h3></div><div class="hint">${esc(T('g2PickSubTitle'))}</div>${sbs.map(x=>`<button type="button" class="sector-btn" data-g2s="${x.sub}">${esc(x.emoji||'📁')} ${esc(x.ru)}</button>`).join('')}`);
  o.querySelector('#g2Back').onclick=main;
  o.querySelectorAll('[data-g2s]').forEach(b=>b.onclick=()=>{const sb=sbs.find(x=>String(x.sub)===b.dataset.g2s);close();done(`${st.ru} — ${sb.ru}`)});
 };
 main();
}
function rowViewer(item,edit){
 const old=document.getElementById('rowViewer');if(old)old.remove();
 const line=copyLineOf(item),orig=origOf(item);
 const d=document.createElement('div');d.id='rowViewer';d.className='master-overlay row-viewer';
 const cells=(l,set,cls)=>`<div class="rv-fields">${l.split(' | ').map((x,i)=>`<div class="rv-f ${set&&set.has(i)?cls:''}"><b>Г${i+1}</b><span>${esc(x)}</span></div>`).join('')}</div>`;
 let html;
 if(edit){
  const base=baseLineOf(item),ref=orig||base;
  const pickG2=!isChatRow(line)&&String(line.split(' | ')[1]||'').trim().toUpperCase()!=='ЖИТЕЛИ';
  html=`<h3>${esc(T('rowEditTitle'))}</h3><div class="hint">${esc(T('rowEditHint'))}</div><div class="rv-fields rv-edit">${line.split(' | ').map((x,i)=>`<label class="rv-f"><b>Г${i+1}</b><input data-g="${i}" value="${esc(x)}" autocomplete="off" autocapitalize="off" spellcheck="false"${pickG2&&i===1?' readonly data-pick="1" inputmode="none" style="cursor:pointer;font-weight:900"':''}></label>`).join('')}</div><div class="rv-msg" id="rvMsg"></div><div class="modal-actions"><button class="primary" id="rvApply" type="button">${esc(T('rowApplyBtn'))}</button><button class="secondary" id="rvCancel" type="button">${esc(T('addCancelBtn'))}</button></div>`;
  d.innerHTML=`<div class="master-box row-viewer-box">${html}</div>`;document.body.appendChild(d);
  const get=()=>Array.from(d.querySelectorAll('input[data-g]')).map(i=>i.value.trim()||'.');
  const paint=()=>{const cur=get().join(' | '),set=diffIdx(ref,cur);d.querySelectorAll('input[data-g]').forEach((i,k)=>i.classList.toggle(orig?'df-new':'df-new',set.has(k)))};
  d.querySelectorAll('input[data-g]').forEach(i=>i.addEventListener('input',paint));paint();
  const relink=(announce)=>{const r=linkFolderToId(get(),item.file,(orig||baseLineOf(item)).split(' | ')[0]);if(!r)return null;
   d.querySelectorAll('input[data-g]').forEach((i,k)=>{i.value=r.vals[k]});paint();
   if(announce){const m=$('#rvMsg');if(m)m.textContent='🔗 '+r.log}try{console.info('[миграция]',r.log)}catch(e){}return r};
  const g2=d.querySelector('input[data-pick="1"]');
  if(g2)g2.addEventListener('click',()=>g2Picker(v=>{g2.value=v;relink(true);paint()}));
  $('#rvCancel').onclick=()=>rowViewer(item,false);
  $('#rvApply').onclick=async()=>{
   const msg=$('#rvMsg');relink(false);const vals=get();
   if(vals.some(v=>/\||[\r\n]/.test(v))){msg.textContent=T('rowErrBar');return}
   const nl=vals.join(' | ');
   if(!isChatRow(nl)){const audit=rowValidate(nl.split(' | ').map(clean),0,item.file);if(!audit.ok){msg.textContent=T('rowErrInvalid')+' '+audit.errors.join('; ');return}}
   else if(!/^https?:\/\//i.test(vals[3])){msg.textContent=T('chatBadLinkToast');return}
   const oid=(orig||baseLineOf(item)).split(' | ')[0].trim(),nid=vals[0].trim();
   if(item.kind==='EDIT'&&nid!==oid){const own=folderToIds(vals[1]);if(!own||idTile(nid)!==own.c||idSub(nid)!==own.sb){msg.textContent=T('rowErrIdLocked');return}
    try{await ensureFilesLoaded([item.file])}catch(e){}if(S.rows.some(r=>r.file===item.file&&r.id===nid)){msg.textContent=T('rowErrIdTaken');return}}
   if(item.kind==='NEW'&&nid!==oid){try{await ensureFilesLoaded([item.file])}catch(e){}if(S.rows.some(r=>r.file===item.file&&r.id===nid)||(S.chats||[]).some(c=>c.file===item.file&&c.id===nid)){msg.textContent=T('rowErrIdTaken');return}}
   if(nl===baseLineOf(item))QEDIT.delete(item.uid);else QEDIT.set(item.uid,nl);
   qeditSave();
   let cloud='';
   if(QITEMS.get(item.uid)?.src==='remote'&&QEDIT.has(item.uid)){const r=await adminIntake({action:'updateRow',uid:item.uid,row:nl});cloud=r&&r.ok?'ok':'fail';if(cloud==='fail')toast(intakeErrorText(r))}
   d.remove();toast(T(cloud==='ok'?'rowSavedCloud':'rowSavedLocal'));requestQueueMonitor();
  };
  return;
 }
 const set=orig?diffIdx(orig,line):null;
 html=`<h3>${esc(T('rowViewTitle'))}</h3>${orig?`<div class="df-cap">${esc(T('dfWas'))}</div><div class="rv-raw">${diffLineHtml(orig,set,'df-old')}</div>${cells(orig,set,'df-old')}<div class="df-cap">${esc(T('dfNow'))} · ${esc(T('dfCount',{n:set.size}))}</div>`:''}<div class="rv-raw">${orig?diffLineHtml(line,set,'df-new'):esc(line)}</div>${cells(line,set,'df-new')}<div class="modal-actions"><button class="primary" id="rvEdit" type="button">${esc(T('qbEdit'))}</button><button class="secondary" id="rvClose" type="button">${esc(T('adminClose'))}</button></div>`;
 d.innerHTML=`<div class="master-box row-viewer-box">${html}</div>`;document.body.appendChild(d);
 const shut=()=>d.remove();
 $('#rvClose').onclick=shut;$('#rvEdit').onclick=()=>rowViewer(item,true);d.addEventListener('click',e=>{if(e.target===d)shut()});
}
async function localOp(file,kind,line,original){
 try{
  const r=await fetch('/__append',{method:'POST',headers:srvHeaders(),body:JSON.stringify({file,line,kind,original}),cache:'no-store'});
  const j=await r.json();return j||{ok:false,error:'network'};
 }catch(e){return {ok:false,error:'network'}}
}
async function ghPush(file,kind,line,original){
 try{
  const r=await fetch('/__github_push',{method:'POST',headers:srvHeaders(),body:JSON.stringify({file,line,kind,original}),cache:'no-store'});
  return await r.json();
 }catch(e){return {ok:false,error:'network'}}
}
const qErr=c=>{const k='qe_'+(c||'x');const t=T(k);return t===k?String(c||'?'):t};
async function requestQueueMonitor(){
 let remote=[],errNote='';
 const res=await adminIntake({action:'list'});
 if(res&&res.ok)remote=res.items||[];else errNote=intakeErrorText(res);
 remote.forEach(r=>{if(r.status==='Внесена'||r.status==='Отклонена')QAPPROVED.delete(r.uid)});
 QAUDIT=auditQueueIds(remote);
 const idWarn=QAUDIT.plan.length?`<div class="warn-card queue-idwarn"><b>⚠ ${esc(T('queueIdMismatch'))}</b><div class="queue-id-preview">${QAUDIT.plan.map(p=>`${esc(p.oldId)} → ${esc(p.id)} · ${esc(p.title)}`).join('<br>')}</div><button class="primary" id="queueRecalcBtn">${esc(T('queueIdRecalcBtn'))}</button></div>`:'';
 const local=queueLocal().map(q=>Object.assign({},q,{row:String(q.candidateRow||'').split('\n').filter(Boolean).pop()||''}));
 QITEMS=new Map();remote.forEach(r=>QITEMS.set(r.uid,{item:r,src:'remote',file:r.file}));local.forEach(r=>QITEMS.set(r.uid,{item:r,src:'local',file:r.file}));
 const html=[...remote.map(r=>queueCardHtml(r,'remote')),...local.map(r=>queueCardHtml(r,'local'))].join('');
 showModal(`<div class="modal-content admin-dark">${adminHead(T('queueTitle'))}<div class="admin-card">${esc(T('queueCounts',{remote:remote.length,local:local.length}))}</div>${errNote?`<div class="warn-card">${esc(errNote)}</div>`:''}${idWarn}${html||`<div class="ok-card">${esc(T('queueEmpty'))}</div>`}<div class="modal-actions"><button class="secondary" id="queueBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
 bindAdminHome();$('#queueBack').onclick=adminOpen;
 const recalc=$('#queueRecalcBtn');
 if(recalc)recalc.onclick=async()=>{recalc.disabled=true;const r=await adminIntake({action:'reid',items:QAUDIT.plan.map(p=>({uid:p.uid,id:p.id,row:p.row}))});if(r&&r.ok){toast(T('queueIdRecalcOk',{n:r.changed||QAUDIT.plan.length}));requestQueueMonitor()}else{toast(r&&r.error==='id_clash'?T('queueIdRecalcFail'):intakeErrorText(r));recalc.disabled=false}};
 const itemOf=uid=>QITEMS.get(uid)?Object.assign({},QITEMS.get(uid).item,{uid,file:QITEMS.get(uid).item.file}):null;
 const run=(b,fn)=>{b.onclick=()=>{const go=async()=>{if(b.disabled)return;b.disabled=true;try{await fn(b)}catch(err){try{console.error('[очередь]',err)}catch(e){}banner('⚠ '+T('qUnexpected',{error:String(err&&err.message||err)}),true)}finally{if(b.isConnected)b.disabled=false}};if(hasMaster())go();else masterModal(go)}};
 $$('.queue-row-mono[data-qv]').forEach(el=>{el.style.cursor='pointer';el.onclick=()=>{const it=itemOf(el.dataset.qv);if(it)rowViewer(it,false)}});
 const setStatus=async(uid,status)=>{const r=await adminIntake({action:'setStatus',uid,status});if(r&&r.ok){toast(T('queueStatusToast',{status}));return true}toast(intakeErrorText(r));return false};
 const localReport=(r,kind)=>r&&r.ok?(r.duplicate?'queueAlreadyThereToast':'queueLocalWriteOkToast'):null;
 $$('[data-q-edit]').forEach(b=>{b.onclick=()=>{const it=itemOf(b.dataset.qEdit);if(it)rowViewer(it,true)}});
 $$('[data-q-approve]').forEach(b=>run(b,async()=>{
  /* СКВОЗНОЕ «Одобрить» (v1.0.0.3: никогда не молчит, замки снимаются по собственному успеху страницы):
     (1) заявка в облаке, (2) облако: исправленная строка + статус «Одобрена» → СРАЗУ отметка QAPPROVED и перерисовка с рабочими кнопками,
     (3) файл села на телефоне: дописать (NEW) или заменить/перенести по ID (EDIT). Любой сбой — виден на экране с названием шага. */
  const uid=b.dataset.qApprove,it0=itemOf(uid);
  if(!it0){banner('⚠ '+T('qApproveStep',{step:'1',error:T('qNotInCloud')}),true);return}
  if(QAUDIT.flags.has(uid)){let okc=true;try{okc=confirm(T('qApproveForce'))}catch(e){okc=true}if(!okc)return}
  banner(T('qApproveWait'));
  const src=QITEMS.get(uid)?.src;
  if(src==='local'){
   await sendPendingToIntake();
   if(queueLocal().some(x=>x.uid===uid)){banner('⚠ '+T('qNeedCloud'),true);return}
  }
  const lr=await adminIntake({action:'list'});
  const rm=(lr&&lr.ok?lr.items||[]:[]).find(x=>x.uid===uid);
  if(!rm){banner('⚠ '+T('qApproveStep',{step:'2',error:lr&&lr.ok?T('qNotInCloud'):intakeErrorText(lr)}),true);return}
  const it=Object.assign({},it0,rm,{uid,file:rm.file});
  let line=QEDIT.get(uid)||baseLineOf(it),orig=origOf(it),cloudWarn=false;
  if(QEDIT.has(uid)&&rm.row!==line){const u=await adminIntake({action:'updateRow',uid,row:line});if(!(u&&u.ok)){banner('⚠ '+T('qApproveStep',{step:'3',error:intakeErrorText(u)||String(u&&u.error||'?')})+' · '+T('qCloudRowSkip'),true);cloudWarn=true}}
  if(rm.status==='Новая'){
   const st=await adminIntake({action:'setStatus',uid,status:'Одобрена'});
   if(!(st&&st.ok)){banner('⚠ '+T('qApproveStep',{step:'4',error:intakeErrorText(st)||String(st&&st.error||'?')}),true);return}
  }
  /* облако подтвердило — замок снимается сразу, не дожидаясь файла и нового списка */
  QAPPROVED.add(uid);
  requestQueueMonitor();
  const r=await localOp(it.file,it.kind==='EDIT'?'EDIT':'NEW',line,orig);
  if(r.ok&&r.line&&r.line!==line){QEDIT.set(uid,r.line);qeditSave();try{await adminIntake({action:'updateRow',uid,row:r.line})}catch(e){}line=r.line}
  const mig=(r.ok&&r.migration?` · 🔗 ${r.migration}`:'')+(cloudWarn?' · ⚠ '+T('qCloudRowSkip'):'');
  banner((r.ok?T(r.duplicate?'queueAlreadyThereToast':(it.kind==='EDIT'?'qEditLocalOk':'qApproveOk')):T('qEditLocalFail',{error:qErr(r.error)}))+mig,!r.ok);
  requestQueueMonitor();
 }));
 $$('[data-q-chatdel]').forEach(b=>run(b,async()=>{
  const uid=b.dataset.qChatdel,it=itemOf(uid);if(!it)return;
  const line=baseLineOf(it);
  const loc=await localOp(it.file,'DELETE',line);
  const gh=await ghPush(it.file,'DELETE',line);
  const okL=!!loc.ok,okG=!!gh.ok;
  if(okL&&okG){
   const same=Array.from(QITEMS.values()).filter(x=>x.item.kind==='DELETE'&&x.item.file===it.file&&String(x.item.id||'').replace(/^0+/,'')===String(it.id||'').replace(/^0+/,'')&&x.src==='remote');
   for(const x of same)await adminIntake({action:'setStatus',uid:x.item.uid,status:'Внесена'});
   try{await loadVillageFile(it.file,true)}catch(e){}
   banner(T('qChatDelOk',{tg:gh.tg?(gh.tg.ok?T('qTgOk'):T('qTgFail',{error:qErr(gh.tg.error)})):''}));
   requestQueueMonitor();
  }else banner(T('qChatDelFail',{phone:okL?'✔':'✖ '+qErr(loc.error),gh:okG?'✔':'✖ '+qErr(gh.error)}),true);
 }));
 $$('[data-q-file]').forEach(b=>run(b,async()=>{
  const it=itemOf(b.dataset.qFile);if(!it)return;
  const line=copyLineOf(it),orig=origOf(it);
  /* буфер — ПЕРВЫМ делом, пока действует касание пользователя; файл на телефоне пишет сервер одновременно */
  let clip;try{clip=navigator.clipboard.writeText(line)}catch(e){clip=Promise.reject(e)}
  const op=localOp(it.file,it.kind==='EDIT'?'EDIT':'NEW',line,orig);
  const [cl,fl]=await Promise.allSettled([clip,op]);
  const fr=fl.status==='fulfilled'?fl.value:{ok:false,error:'network'};
  toast(`${fr.ok?(fr.duplicate?'📄 '+T('queueAlreadyThereToast'):'📄 ✔'):'📄 ✖ '+qErr(fr.error)} · ${cl.status==='fulfilled'?'📋 ✔':'📋 ✖'}`);
 }));
 $$('[data-q-gh]').forEach(b=>run(b,async()=>{
  const it=itemOf(b.dataset.qGh);if(!it)return;
  const line=copyLineOf(it),orig=origOf(it);
  banner(T('qGhWait'));
  const r=await ghPush(it.file,it.kind==='EDIT'?'EDIT':'NEW',line,orig);
  if(r&&r.ok){
   const tg=r.tg?(r.tg.ok?T('qTgOk'):T('qTgFail',{error:qErr(r.tg.error)})):'';
   banner(r.duplicate?T('queueAlreadyThereToast'):T('qGhOk',{commit:r.commit||'—',tg}));
   if(await setStatus(it.uid,'Внесена'))requestQueueMonitor();
  }else{banner(T('qGhFail',{error:qErr(r&&r.error)}),true)}
 }));
 $$('[data-q-done]').forEach(b=>run(b,async()=>{if(await setStatus(b.dataset.qDone,'Внесена'))requestQueueMonitor()}));
 $$('[data-q-reject]').forEach(b=>run(b,async()=>{
  const uid=b.dataset.qReject;QEDIT.delete(uid);qeditSave();
  if(b.dataset.qSrc==='local'){removeQueueLocal(uid);toast(T('queueRejectedToast'));requestQueueMonitor()}
  else if(await setStatus(uid,'Отклонена'))requestQueueMonitor();
 }));
}
async function postSkipWaiting(){try{const reg=await navigator.serviceWorker?.ready;if(reg?.active)reg.active.postMessage({type:'SKIP_WAITING'});await reg?.update()}catch(e){}}
/* ===== v5.3.0.4: ПЛАТФОРМЕННАЯ СТАТИСТИКА (счётчик в подвале «...Ещё») ===== */
/* Случайный номер устройства хранится сразу в localStorage и IndexedDB (потерялся один — восстанавливается из другого).
   Ничего личного: ни IP, ни телефонов. Пинг уходит на тот же веб-хук, что и заявки; сводка кэшируется на 4 часа. */
const STATS_TTL_MS=4*3600*1000,SESSION_GAP_MS=30*60*1000,STATS_RETRY_MS=5*60*1000;
let DEV_ID='';
function rndHex32(){const a=new Uint8Array(16);try{crypto.getRandomValues(a)}catch(e){for(let i=0;i<16;i++)a[i]=Math.floor(Math.random()*256)}return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
async function deviceId(){
 if(DEV_ID)return DEV_ID;
 const re=/^[a-f0-9]{32}$/;
 const ls=storageGet('cart_dev_id','');
 let ix=await idbRun('kv','readonly',os=>os.get('dev_id'));if(typeof ix!=='string')ix='';
 const id=re.test(ls)?ls:(re.test(ix)?ix:rndHex32());
 if(ls!==id)storageSet('cart_dev_id',id);
 if(ix!==id)idbRun('kv','readwrite',os=>os.put(id,'dev_id'));
 DEV_ID=id;return id;
}
async function statsPing(){
 try{
  if(!intakeUrl())return;
  const now=Date.now(),last=Number(storageGet('cart_stats_last','0'))||0,tried=Number(storageGet('cart_stats_try','0'))||0;
  const standalone=isStandaloneApp(),instPending=standalone&&storageGet('cart_stats_inst','')!=='1',visitDue=now-last>SESSION_GAP_MS;
  if(!visitDue&&!instPending)return;
  if(now-tried<STATS_RETRY_MS)return;
  storageSet('cart_stats_try',String(now));
  const d=await deviceId();
  const res=await intakePost({action:'ping',d,ev:visitDue?'visit':'install',inst:standalone?1:0,v:APP_VERSION});
  if(res&&res.ok){if(visitDue)storageSet('cart_stats_last',String(now));if(standalone)storageSet('cart_stats_inst','1')}
 }catch(e){}
}
async function loadPlatformStats(){
 let cache=null;try{cache=JSON.parse(storageGet('cart_plat_stats','null'))}catch(e){}
 if(cache&&cache.ts&&Date.now()-cache.ts<STATS_TTL_MS)return cache;
 if(!intakeUrl())return cache;
 try{const r=await intakePost({action:'stats'});if(r&&r.ok&&r.stats){cache={ts:Date.now(),data:r.stats};storageSet('cart_plat_stats',JSON.stringify(cache))}}catch(e){}
 return cache;
}
function statsCardHtml(c){
 const head=`<div class="stats-title">📊 ${esc(T('statsTitle'))}</div>`;
 if(!c||!c.data)return head+`<div class="hint">${esc(T('statsUnavailable'))}</div>`;
 const s=c.data,f=n=>Number(n||0).toLocaleString(S.lang==='kz'?'kk-KZ':'ru-RU');
 const row=(k,v)=>`<div class="stats-row"><span>${esc(T(k))}</span><b>${f(v)}</b></div>`;
 return head+row('statsUnique',s.unique)+row('statsInstalls',s.installs)+row('statsToday',s.today)+row('statsMonth',s.month)+row('statsTotal',s.total)
  +`<div class="hint">${esc(T('statsUpdated',{t:new Date(c.ts).toLocaleString(S.lang==='kz'?'kk-KZ':'ru-RU',{dateStyle:'short',timeStyle:'short'})}))} · ${esc(T('statsPrivacy'))}</div>`;
}
async function fillStatsCard(){
 const el=$('#statsCard');if(!el)return;
 try{const c=await loadPlatformStats();const el2=$('#statsCard');if(el2)el2.innerHTML=statsCardHtml(c)}catch(e){}
}
/* ===== v5.3.0.4: ТАБЛИЦА АЛИАСОВ ID (id_aliases.json) и серые заглушки ===== */
/* Файл: {schemaVersion, updated, aliases:{"файл::старыйID":"файл::новыйID"}}. Подмена делается ТОЛЬКО если старого ключа в живой базе
   больше нет, а новый есть; цепочки A→B→C сворачиваются; применение повторно безопасно. Ушедшие ID заново не выдаются. */
let ALIASES={},ALIAS_READY=false;
async function loadAliases(){
 let data=null;
 try{const r=await fetch(`id_aliases.json?v=${Date.now()}`,{cache:'no-store'});if(r.ok){data=await r.json();storageSet('cart_aliases_cache',JSON.stringify(data))}}catch(e){}
 if(!data){try{data=JSON.parse(storageGet('cart_aliases_cache','null'))}catch(e){}}
 if(data&&typeof data==='object'&&data.aliases&&typeof data.aliases==='object'){ALIASES=data.aliases;ALIAS_READY=true}
}
function aliasResolve(k,map){const m=map||ALIASES;let cur=k;const seen=new Set([k]);for(let i=0;i<12;i++){const nx=m[cur];if(typeof nx!=='string'||!nx||seen.has(nx))break;cur=nx;seen.add(cur)}return cur}
function applyAliasesToStorage(){
 if(!ALIAS_READY||!S.byKey||!S.byKey.size)return 0;
 let moved=0;
 const mapKey=k=>{if(S.byKey.has(k))return k;const nk=aliasResolve(k);return(nk!==k&&S.byKey.has(nk))?nk:k};
 const dedupe=a=>{const seen=new Set(),out=[];for(const x of a)if(!seen.has(x)){seen.add(x);out.push(x)}return out};
 try{
  const favNew=new Set();for(const k of S.favorites){const nk=mapKey(k);if(nk!==k)moved++;favNew.add(nk)}
  const pinNew=new Set();for(const k of S.pinned){pinNew.add(mapKey(k))}
  const changed=moved>0||[...S.pinned].some(k=>mapKey(k)!==k);
  if(!changed&&![...S.favOrder,...(S.favManualOrder||[])].some(k=>mapKey(k)!==k))return 0;
  S.favorites=favNew;S.favOrder=dedupe(S.favOrder.map(mapKey)).filter(k=>S.favorites.has(k));
  S.favManualOrder=dedupe((S.favManualOrder||[]).map(mapKey));
  S.pinned=pinNew;S.pinnedOrder=dedupe(S.pinnedOrder.map(mapKey)).filter(k=>S.pinned.has(k));
  try{const rc=JSON.parse(storageGet('cart_recent','[]'));if(Array.isArray(rc))storageSet('cart_recent',JSON.stringify(dedupe(rc.map(mapKey))))}catch(e){}
  try{const pp=JSON.parse(storageGet('cart_pop','{}'));const np={};for(const k of Object.keys(pp)){const nk=mapKey(k);np[nk]=(np[nk]||0)+(Number(pp[k])||0)}storageSet('cart_pop',JSON.stringify(np))}catch(e){}
  saveFav();savePinned();saveFavManualOrder();
 }catch(e){}
 return moved;
}

/* v5.3.0.5: после переписи ID жителей (10001…) прежние ключи избранного жителей
   указывали бы на других людей — один раз на устройство они сбрасываются.
   Эпоха задаётся в config.json (dbEpoch). */
function applyDbEpoch(){
 const ep=String(APP_CFG.dbEpoch||'');if(!ep)return;
 let cur='';try{cur=localStorage.getItem('cart_db_epoch')||''}catch(e){}
 if(cur===ep)return;
 const isRes=k=>Number(String(k).split('::')[1])>=10000;let n=0;
 for(const k of[...S.favorites])if(isRes(k)){S.favorites.delete(k);n++}
 S.favOrder=S.favOrder.filter(k=>!isRes(k));S.favManualOrder=(S.favManualOrder||[]).filter(k=>!isRes(k));
 for(const k of[...S.pinned])if(isRes(k))S.pinned.delete(k);S.pinnedOrder=S.pinnedOrder.filter(k=>!isRes(k));
 try{const rc=JSON.parse(storageGet('cart_recent','[]'));if(Array.isArray(rc))storageSet('cart_recent',JSON.stringify(rc.filter(k=>!isRes(k))))}catch(e){}
 try{const pp=JSON.parse(storageGet('cart_pop','{}'));for(const k of Object.keys(pp))if(isRes(k))delete pp[k];storageSet('cart_pop',JSON.stringify(pp))}catch(e){}
 try{saveFav();savePinned();saveFavManualOrder()}catch(e){}
 storageSet('cart_db_epoch',ep);
 if(n)toast(T('epochResetToast',{n}));
}
function favStubKeys(){
 if(!ALIAS_READY||!S.byKey||!S.byKey.size)return[];
 const file=villageObj()?.file;if(!file||!S.rows.some(r=>r.file===file))return[];
 return [...S.favorites].filter(k=>k.startsWith(file+'::')&&!S.byKey.has(k));
}
function favStubsHtml(keys){
 return keys.map(k=>{const id=k.split('::')[1];return `<div class="card stub-card"><div><div class="stub-title">🗑 ${esc(T('stubDeleted'))}</div><small>ID ${esc(id)}</small></div><button type="button" class="stub-x" data-stubx="${esc(k)}" aria-label="${esc(T('stubRemoveAria'))}">✕</button></div>`}).join('');
}
function bindStubs(host){
 host.querySelectorAll('[data-stubx]').forEach(b=>b.onclick=()=>{
  const k=b.dataset.stubx;S.favorites.delete(k);S.favOrder=S.favOrder.filter(x=>x!==k);S.favManualOrder=(S.favManualOrder||[]).filter(x=>x!==k);
  if(S.pinned.has(k)){S.pinned.delete(k);S.pinnedOrder=S.pinnedOrder.filter(x=>x!==k);savePinned()}
  saveFav();saveFavManualOrder();renderCards();
 });
}
/* --- админка: сравнение «старая (GitHub) ⇄ новая (телефон)» по связке название + телефон --- */
function parseBaseText(file,text){
 const out=[];
 for(const line of String(text||'').split(/\r?\n/)){
  const f=line.split(' | ');if(f.length!==20||!/^\d+$/.test(f[0].trim()))continue;
  out.push({file,id:f[0].trim(),title:f[2],phones:[f[5],f[6],f[7]].map(normalizePhoneKey).filter(Boolean)});
 }
 return out;
}
function normTitle(t){return String(t||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'“”„‘’`]/g,'').replace(/\s+/g,' ').trim()}
function computeAliasPairs(oldRows,newRows){
 const oldKeys=new Set(oldRows.map(favKey)),newKeys=new Set(newRows.map(favKey));
 const removed=oldRows.filter(r=>!newKeys.has(favKey(r))),added=newRows.filter(r=>!oldKeys.has(favKey(r)));
 const used=new Set(),pairs=[],loose=[];
 const share=(a,b)=>a.phones.some(p=>b.phones.includes(p))||(!a.phones.length&&!b.phones.length);
 for(const r of removed){
  const c=added.find(a=>!used.has(favKey(a))&&a.file===r.file&&normTitle(a.title)===normTitle(r.title)&&share(a,r));
  if(c){used.add(favKey(c));pairs.push({from:favKey(r),to:favKey(c),title:r.title,how:'title+phone'})}
 }
 const done=new Set(pairs.map(p=>p.from));
 for(const r of removed){
  if(done.has(favKey(r))||!r.phones.length)continue;
  const cs=added.filter(a=>!used.has(favKey(a))&&a.file===r.file&&a.phones.some(p=>r.phones.includes(p)));
  if(cs.length===1)loose.push({from:favKey(r),to:favKey(cs[0]),title:`${r.title} → ${cs[0].title}`,how:'phone'});
 }
 return{pairs,loose,removed:removed.length,added:added.length};
}
function mergeAliasMaps(existing,newPairs,liveKeys){
 const m=Object.assign({},existing||{});
 for(const p of newPairs)m[p.from]=p.to;
 for(const k of Object.keys(m)){
  if(liveKeys&&liveKeys.has(k)){delete m[k];continue}
  const fin=aliasResolve(k,m);if(fin===k)delete m[k];else m[k]=fin;
 }
 const out={};for(const k of Object.keys(m).sort())out[k]=m[k];return out;
}
async function gatherAliasCompare(){
 const oldRows=[],newRows=[];
 for(const v of CONFIG.VILLAGES){
  const cur=await readGitFile(dbPath(v.file)).catch(()=>null);let local=null;try{local=await fetchDb(v.file)}catch(e){}
  if(!cur||local===null)continue;
  oldRows.push(...parseBaseText(v.file,cur.content));newRows.push(...parseBaseText(v.file,local));
 }
 return{oldRows,newRows,...computeAliasPairs(oldRows,newRows)};
}
async function writeAliasesToGithub(newPairs,liveKeys){
 const cur=await readGitFile('id_aliases.json').catch(()=>({content:'',sha:null}));
 let data={};try{data=JSON.parse(cur.content||'{}')}catch(e){data={}}
 const merged=mergeAliasMaps(data.aliases,newPairs,liveKeys);
 const body={schemaVersion:APP_VERSION,updated:new Date().toISOString().slice(0,10),aliases:merged};
 await githubWrite('id_aliases.json',JSON.stringify(body,null,2)+'\n','Админ: алиасы ID карточек');
 ALIASES=merged;ALIAS_READY=true;storageSet('cart_aliases_cache',JSON.stringify(body));
 return Object.keys(merged).length;
}
/* Автоматика при «В GitHub»: пары «название + телефон» дописываются в id_aliases.json сами. */
async function autoAliasSync(){
 try{
  const g=await gatherAliasCompare();
  if(!g.pairs.length)return;
  await writeAliasesToGithub(g.pairs,new Set(g.newRows.map(favKey)));
  toast(T('aliasAutoToast',{n:g.pairs.length}));
 }catch(e){}
}
async function aliasToolModal(){
 showModal(`<div class="modal-content admin-dark">${adminHead(T('aliasTitle'))}<div class="admin-card">${esc(T('aliasHint'))}</div><button class="primary" id="aliasRun" type="button">${esc(T('aliasRunBtn'))}</button><div id="aliasOut"></div><div class="modal-actions"><button class="secondary" id="aliasBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
 bindAdminHome();$('#aliasBack').onclick=adminOpen;
 $('#aliasRun').onclick=async()=>{
  const out=$('#aliasOut');out.innerHTML=`<div class="admin-card">${esc(T('aliasWorking'))}</div>`;
  let g;try{g=await gatherAliasCompare()}catch(e){out.innerHTML=`<div class="error-card">${esc(T('aliasCompareFail'))}</div>`;return}
  const chosen=new Set(g.pairs.map(p=>p.from));
  const live=new Set(g.newRows.map(favKey));
  const lineOf=p=>`${esc(p.title)}: ${esc(p.from.split('::')[1])} → ${esc(p.to.split('::')[1])}`;
  const draw=()=>{
   out.innerHTML=(g.pairs.length||g.loose.length?'':`<div class="ok-card">${esc(T('aliasNone'))}</div>`)
    +(g.pairs.length?`<div class="admin-card"><b>${esc(T('aliasPairsTitle',{n:g.pairs.length}))}</b>${g.pairs.map(p=>`<div>${lineOf(p)}</div>`).join('')}</div>`:'')
    +(g.loose.length?`<div class="warn-card"><b>${esc(T('aliasLooseTitle',{n:g.loose.length}))}</b>${g.loose.map((p,i)=>`<div class="dup-ign-row"><div>${lineOf(p)}</div><button type="button" class="secondary" data-aliasloose="${i}">${chosen.has(p.from)?'✓ ':''}${esc(T('aliasAddBtn'))}</button></div>`).join('')}</div>`:'')
    +(g.pairs.length||g.loose.length?`<button class="primary" id="aliasWrite" type="button">${esc(T('aliasWriteBtn'))}</button>`:'');
   $$('[data-aliasloose]').forEach(b=>b.onclick=()=>{const p=g.loose[Number(b.dataset.aliasloose)];if(chosen.has(p.from))chosen.delete(p.from);else chosen.add(p.from);draw()});
   const w=$('#aliasWrite');if(w)w.onclick=async()=>{
    if(!S.token){toast(T('dupNoTokenToast'));return}
    const take=[...g.pairs,...g.loose].filter(p=>chosen.has(p.from));
    try{const n=await writeAliasesToGithub(take,live);toast(T('aliasWriteOk',{n}))}catch(e){toast(T('aliasWriteFail'))}
   };
  };
  draw();
 };
}
async function refreshData(){
 const b=$('#refreshDataBtn')||$('#refreshAdminBtn');if(b)b.disabled=true;
 try{
  await postSkipWaiting();
  const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));
  const stamp=Date.now();
  const cfg=await fetch(`${ENV.configFile}?refresh=${stamp}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('config')));
  if(!Array.isArray(cfg.files))throw new Error('files');
  for(const file of [...S.loaded]){const r=await fetch(`${dbPath(file)}?refresh=${stamp}`,{cache:'no-store'});if(!r.ok)throw new Error(file)}
  await loadConfig();await loadDatabases();toast(T('dataRefreshedToast'));
 }catch(e){toast(T('dataRefreshFailToast'))}finally{if(b)b.disabled=false}
}
async function doubleGitHubBackup(){
 if(!S.token){toast(T('backupNoTokenToast'));return}
 const answer=confirm(T('backupConfirm'));if(!answer)return;
 const results=[];
 try{
  for(const file of CONFIG.FILES){const live=await readGitFile(dbPath(file));if(live?.content!==undefined){await githubWrite(`${CONFIG.BACKUP_OLD}/${file}`,live.content,`Backup OLD: ${file}`);results.push(`${file}: old backup OK`)}}
  await ensureAllLoaded();
  for(const file of CONFIG.FILES){const live=S.files.get(file)?.text;if(typeof live!=='string')throw new Error(T('backupMissingRam',{file}));await githubWrite(`${CONFIG.BACKUP_NEW}/${file}`,live,`Backup NEW: ${file}`);results.push(`${file}: backup OK`)}
  showModal(`<div class="modal-content admin-dark">${adminHead(T('backupTitle'))}<div class="ok-card">${results.map(esc).join('<br>')}</div><div class="modal-actions"><button class="secondary" id="backupBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
  bindAdminHome();$('#backupBack').onclick=adminOpen;
 }catch(e){
  showModal(`<div class="modal-content admin-dark">${adminHead(T('backupTitle'))}<div class="error-card">${esc(T('backupFailPrefix',{error:e.message||String(e)}))}</div><div class="modal-actions"><button class="secondary" id="backupErrBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
  bindAdminHome();$('#backupErrBack').onclick=adminOpen;
 }
}
function adminHead(title){return `<div class="admin-inner-head"><button class="back-capsule" id="adminHomeBtn">${esc(T('adminHomeBtn'))}</button><h2>${esc(title)}</h2></div>`}
function bindAdminHome(){const b=$('#adminHomeBtn');if(b)b.onclick=adminOpen}
/* v5.2.0.0: админ-пульт — добавлены 2 ранее мёртвых (нигде не подключённых)
   инструмента (аудит — кнопка 📊; «Контрольный паспорт строки» вырезан в v5.4.0.0), и новая
   кнопка «Сохранить token локально для фоновых уведомлений» (persistToken)
   для фонового робот-радара Service Worker (п.4 наряда). */
function adminOpen(pocketOpen){
 /* v1.0.0.3: наверху ровно 5 главных кнопок; весь инженерный шум спрятан в закрытый карман внизу (вход — по Мастер-паролю, строка 2). */
 const rw=hasMaster(),po=(pocketOpen===true||storageGetSession('cart_eng_open','')==='1')&&rw;
 showModal(`<div class="modal-content admin-dark"><div class="admin-inner-head"><h2>${esc(T('adminPanelTitle'))}</h2></div>
  <div class="admin-top5">
   <button class="admin-blue" id="vipBtn">${esc(T('adminVipBtn'))}</button>
   <button class="admin-yellow" id="reportBtn">${esc(T('adminReportBtn'))}</button>
   <button class="admin-green" id="auditBtn">${esc(T('adminDiagBtn'))}</button>
   <button class="admin-blue" id="refreshAdminBtn">${esc(T('adminRefreshBtn'))}</button>
   <button class="admin-red" id="forgetBtn">${esc(T('adminForgetBtn'))}</button>
  </div>
  <button class="mode-badge ${rw?'rw':'ro'}" id="modeBadge" type="button">${esc(T(rw?'modeRw':'modeRo'))}</button>
  <button class="eng-toggle" id="engToggle" type="button">${esc(T('engPocketTitle'))} ${po?'▲':'🔒'}</button>
  <div class="eng-pocket ${po?'':'hidden'}" id="engPocket">
   <div class="admin-grid">
    <button class="admin-green" id="queueBtn">${esc(T('adminQueueBtn'))}</button>
    <button class="admin-red quarantine-badge" id="quarantineBtn">${esc(T('adminQuarantineBtn'))}${quarantineBadgeCount()?`<span class="badge-count">${quarantineBadgeCount()}</span>`:''}</button>
    <button class="admin-green" id="dupeBtn">${esc(T('adminDupeBtn'))}</button>
    <button class="admin-yellow" id="backupBtn">${esc(T('adminBackupBtn'))}</button>
    <button class="admin-blue" id="aliasBtn">${esc(T('aliasBtn'))}</button>
   </div>
   <div class="admin-pockets">
    <div class="secrets-box">
     <div class="hint">${esc(T('secretsHint'))}</div>
     <input type="text" id="secretsPath" value="${esc(storageGet('cart_secrets_path',''))}" placeholder="${esc(T('secretsPathPlaceholder'))}" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url">
     <button class="primary big-action w100" id="readSecrets" type="button">${esc(T('secretsReadBtn'))}</button>
     <div id="secretsResult" class="secrets-result"></div>
    </div>
    <button class="admin-yellow w100" id="pushGas" type="button">${esc(T('syncBtn'))}</button>
   </div>
   <div class="hint">${esc(T('hintSecret'))}</div>
  </div>
  <div class="modal-actions"><button class="secondary" id="adminClose">${esc(T('adminClose'))}</button></div></div>`);
 bindAdminHome();bindEyes($('#modalRoot'));
 $('#adminClose').onclick=()=>{storageSetSession('cart_eng_open','0');masterLock();closeModal();S.view='home';S.tile=null;render()};
 $('#modeBadge').onclick=()=>{if(hasMaster()){storageSetSession('cart_eng_open','0');masterLock().then(()=>{closeModal();adminOpen()})}else masterModal(()=>{closeModal();adminOpen()})};
 $('#forgetBtn').onclick=async()=>{storageSetSession('cart_eng_open','0');await vaultForget();await masterLock();toast(T('rememberMeForgot'));closeModal();S.view='home';S.tile=null;render()};
 $('#engToggle').onclick=()=>{
  const pk=$('#engPocket');
  if(!pk.classList.contains('hidden')){storageSetSession('cart_eng_open','0');pk.classList.add('hidden');$('#engToggle').textContent=T('engPocketTitle')+' 🔒';return}
  if(hasMaster()){storageSetSession('cart_eng_open','1');pk.classList.remove('hidden');$('#engToggle').textContent=T('engPocketTitle')+' ▲'}
  else masterModal(()=>{storageSetSession('cart_eng_open','1');closeModal();adminOpen(true)});
 };
 $('#readSecrets').onclick=gated(readSecretsFile);
 $('#pushGas').onclick=gated(pushGasCode);
 $('#vipBtn').onclick=vipMonitor;$('#queueBtn').onclick=gated(requestQueueMonitor);$('#reportBtn').onclick=operationalReport;$('#refreshAdminBtn').onclick=refreshData;$('#quarantineBtn').onclick=gated(quarantineMonitor);$('#dupeBtn').onclick=gated(duplicateInspector);$('#backupBtn').onclick=gated(doubleGitHubBackup);
 $('#auditBtn').onclick=auditModal;$('#aliasBtn').onclick=gated(aliasToolModal);
}
/* v5.4.0.0: карман Telegram. Токен бота и ID чата вводятся только здесь, уходят в облачный скрипт Google
   (по коду администратора) и хранятся в его свойствах. В браузере (и тем более у жителей) они не сохраняются. */
const TG_ERR={bad_token_format:'неверный формат токена (должен быть вида 123456789:AA…)',bad_chat_format:'неверный формат ID чата (число или @имя)',forbidden:'код администратора не принят',master_required:'Мастер-пароль не принят облаком (проверьте MASTER_CODE в Свойствах скрипта)',tg_not_configured:'Telegram ещё не настроен',tg_failed:'Telegram отклонил запрос',tg_bad_token:'Telegram не принял токен бота (проверьте токен)',tg_no_permission:'у Google-скрипта нет разрешения «Внешние сервисы»: запустите authorizeTelegram в редакторе и выпустите НОВУЮ версию развёртывания',tg_fetch_failed:'скрипт не смог связаться с Telegram',server_error:'сбой в Google-скрипте'};
async function tgCall(action,extra){
 if(!intakeUrl()){banner(T('tgNeedUrlToast'),true);return null}
 const code=adminCode();if(!code){banner(T('tgNeedCodeToast'),true);return null}
 if(MUT_ACTIONS.indexOf(action)>=0&&!hasMaster()){banner(T('masterLockedToast'),true);return {ok:false,error:'master_required'}}
 let r=null;try{r=await intakePost(Object.assign({action,code,master:MASTER_MEM},extra||{}))}catch(e){r=null}
 return r||{ok:false,error:'нет связи с облачным скриптом'};
}
function tgErrText(r){return (TG_ERR[r.error]||r.error||'?')+(r.detail?` (${r.detail})`:'')}
/* v5.4.0.0: ссылка веб-приложения Google вводится в кармане и сама записывается в config.json (поле intakeWebhookUrl)
   через токен GitHub — сразу для всей области. После записи сайт проверяет, отвечает ли скрипт. */
/* v5.4.0.1: «Синхронизация Google Script»: локальный сервер (cartoteka_server.py) читает
   google_apps_script_webhook.gs и кладёт текст в ячейку A1 листа «Код» Google Таблицы. */
async function pushGasCode(){
 const btn=$('#pushGas');if(btn)btn.disabled=true;
 try{
  let r=null;
  try{const resp=await fetch('/__push_gas',{method:'POST',headers:srvHeaders(),body:JSON.stringify({master:MASTER_MEM}),cache:'no-store'});r=resp.ok?await resp.json():null}catch(e){r=null}
  if(r&&r.error==='locked'){MSESS='';banner(T('masterLockedToast'),true)}
  else if(r&&r.ok)banner(T('syncOk'));
  else if(r)banner(T('syncFail',{error:r.detail||r.error||'?'}),true);
  else banner(T('syncNoServer'),true);
 }finally{if(btn)btn.disabled=false}
}
/* v1.0.0.3: чтение secrets.txt. Сервер (cartoteka_server.py) читает файл по пути администратора, режет строки по первому
   двоеточию и отдаёт секреты странице: токен GitHub и Telegram живут только в памяти страницы, на экране — «••••». */
const SECRET_FIELDS=['code','master','githubToken','repoName','branch','siteTest','siteProd','webhook','tgToken','tgChat','dbRoot','mode','sheetId'];
function renderSecretsResult(found,problems,tgLine){
 const el=$('#secretsResult');if(!el)return;
 el.innerHTML=SECRET_FIELDS.map(k=>`<div class="sec-row ${found[k]?'ok':'miss'}"><span>${esc(T('sf_'+k))}</span><b>${found[k]?'••••••••':esc(T('secretsMissing'))}</b></div>`).join('')
  +(problems||[]).map(p=>`<div class="sec-row miss"><span>${esc(T('secretsLine',{n:p.line}))}</span><b>${esc(T('sp_'+p.msg))}</b></div>`).join('')
  +(tgLine?`<div class="sec-row ${tgLine.ok?'ok':'miss'}"><span>${esc(T('secretsTgCloud'))}</span><b>${esc(tgLine.text)}</b></div>`:'');
}
async function readSecretsFile(){
 const btn=$('#readSecrets'),path=clean($('#secretsPath').value);
 if(!path){banner(T('secretsNoPath'),true);return}
 const code=adminCode();
 if(!code){banner(T('secretsNoCode'),true);ADMIN_PIN_OK=false;closeModal();adminPinModal();return}
 try{storageSet('cart_secrets_path',path)}catch(e){}
 if(btn)btn.disabled=true;
 let r=null;
 try{const resp=await fetch('/__secrets',{method:'POST',headers:srvHeaders(),body:JSON.stringify({code,path,env:ENV.mode}),cache:'no-store'});r=resp.ok?await resp.json():null}catch(e){r=null}
 if(btn)btn.disabled=false;
 if(!r){banner(T('needServer'),true);return}
 if(!r.ok){
  const msg=T('se_'+(r.error||'x'));
  if(r.problems)renderSecretsResult({},r.problems);
  banner(T('secretsFail',{error:msg===('se_'+r.error)?r.error:msg}),true);return;
 }
 const sc=r.secret||{},pb=r.public||{};
 if(sc.githubToken){S.token=sc.githubToken;storageSetSession('cart_github_pat',S.token);relayAdminTokenToSw(S.token);vaultSync()}
 if(pb.intakeWebhookUrl)APP_CFG.intakeWebhookUrl=pb.intakeWebhookUrl;
 if(pb.qrShareUrl)APP_CFG.qrShareUrl=pb.qrShareUrl;
 if(pb.repositoryName)CONFIG.REPO=pb.repositoryName;
 if(pb.branch)CONFIG.BRANCH=pb.branch;
 PULT_KEEP.telegramBotToken=sc.tgToken||'';PULT_KEEP.telegramChatId=sc.tgChat||'';
 let tgLine=null;
 if(sc.tgToken&&sc.tgChat){
  if(!intakeUrl())tgLine={ok:false,text:T('secretsTgNoHook')};
  else{const t=await tgCall('setTelegram',{botToken:sc.tgToken,chatId:sc.tgChat});tgLine=t&&t.ok?{ok:true,text:T('secretsTgOk')}:{ok:false,text:t?tgErrText(t):'?'}}
 }
 renderSecretsResult(r.found||{},r.problems,tgLine);
 const allOk=SECRET_FIELDS.every(k=>(r.found||{})[k])&&!(r.problems||[]).length&&(!tgLine||tgLine.ok);
 banner(T(allOk?'bnSecrets':'bnSecretsPart'),!allOk);
}
async function auditModal(){
 await ensureAllLoaded();
 const per={};for(const v of CONFIG.VILLAGES)per[v.file]=S.rows.filter(r=>r.file===v.file).length;
 showModal(`<div class="modal-content admin-dark">${adminHead(T('auditTitle'))}<div class="admin-card">${esc(T('auditSummary',{version:APP_VERSION,valid:S.rows.length,bad:S.invalid.length}))}</div>${CONFIG.VILLAGES.map(v=>`<div class="admin-card">${esc(T('auditVillageLine',{village:v.name,count:per[v.file]||0,index:v.index}))}</div>`).join('')}${S.invalid.slice(0,20).map(x=>`<div class="error-card">${esc(x.file)} · ${esc(x.line)}<br>${esc((x.errors||[]).join('; '))}</div>`).join('')}<div class="modal-actions"><button class="secondary" id="auditBack">${esc(T('adminHomeBtn'))}</button></div></div>`);
 bindAdminHome();$('#auditBack').onclick=adminOpen;
}
function setupTheme(){try{if(storageGet('cart_theme','')==='dark')document.body.classList.add('dark');const b=$('#themeBtn');if(!b)return;b.onclick=()=>{try{document.body.classList.toggle('dark');storageSet('cart_theme',document.body.classList.contains('dark')?'dark':'light')}catch(e){}}}catch(e){}}
function setupAdmin(){let tm=0,suppress=false;const b=$('#infoBtn');if(!b)return;b.addEventListener('pointerdown',()=>{suppress=false;tm=setTimeout(async()=>{suppress=true;if(!(await serverAlive())){banner(T('needServer'),true);foreignAlarm();return}if(ADMIN_PIN_OK)adminOpen();else adminPinModal()},3000)});['pointerup','pointercancel','pointerleave'].forEach(e=>b.addEventListener(e,()=>clearTimeout(tm)));b.onclick=()=>{if(!suppress)infoModal();suppress=false}}
function setupPWA(){
 try{
  window.addEventListener('beforeinstallprompt',e=>{try{e.preventDefault();S.installPrompt=e;const b=$('#installBanner');if(b){b.classList.remove('hidden');setTimeout(()=>b.classList.add('hidden'),30000)}}catch(err){}});
  const now=$('#installNow');if(now)now.onclick=()=>{installPWA();const b=$('#installBanner');if(b)b.classList.add('hidden')};
  const close=$('#installClose');if(close)close.onclick=()=>{const b=$('#installBanner');if(b)b.classList.add('hidden')};
 }catch(e){}
}
function welcomeModal(){
 if(storageGet('cart_welcome_done',''))return;
 const lang=S.lang==='kz'?'kz':'ru';
 showModal(`<div class="modal-content welcome-modal"><div class="langs"><button class="lang-toggle" id="wToggle" data-lang-toggle="1">${lang==='kz'?'KZ':'RU'}</button></div><h2>${esc(L[lang]?.welcomeTitle||T('welcomeTitle'))}</h2><p id="welcomeText" class="welcome-text">${esc(L[lang]?.welcomeText||T('welcomeText'))}</p><div class="modal-actions"><button class="primary" id="welcomeStart">${esc(L[lang]?.tourStart||T('tourStart'))}</button></div></div>`);
 const toggle=$('#wToggle'), text=$('#welcomeText'), start=$('#welcomeStart');
 if(!toggle||!text||!start)return;
 const refresh=()=>{toggle.textContent=S.lang==='kz'?'KZ':'RU';text.textContent=L[S.lang]?.welcomeText||T('welcomeText');start.textContent=L[S.lang]?.tourStart||T('tourStart')};
 toggle.onclick=()=>{setLang(S.lang==='ru'?'kz':'ru');refresh()};
 start.onclick=()=>{storageSet('cart_welcome_done','1');closeModal();startTour()};
 refresh();
}
function startTour(){
 if(storageGet('cart_tour_done',''))return;
 const steps=[['mainHeader',T('tour1')],['homeQuick',T('tour3')],['bottomNav',T('tour5')]];
 let i=0;
 const next=()=>{
   document.querySelectorAll('.tour-hint').forEach(x=>x.remove());
   if(i>=steps.length){storageSet('cart_tour_done','1');return}
   const [id,msg]=steps[i++],el=document.getElementById(id);
   if(!el){next();return}
   const h=document.createElement('div');h.className='tour-hint';h.textContent=msg;document.body.appendChild(h);
   const r=el.getBoundingClientRect();
   h.style.top=Math.min(innerHeight-h.offsetHeight-12,Math.max(12,r.bottom+10))+'px';
   h.style.left=Math.max(12,Math.min(innerWidth-h.offsetWidth-12,r.left+r.width/2-h.offsetWidth/2))+'px';
   setTimeout(next,3000);
 };
 next();
}
function setupNav(){
  const nav=$('#bottomNav');if(!nav)return;
  nav.addEventListener('click',e=>{
    const b=e.target.closest?.('.nav-btn');if(!b)return;
    const v=b.dataset.view;if(!v)return;
    S.view=v;S.stage='main';S.tile=null;S.sub=null;S.tag=null;
    if(v!=='search'&&v!=='residents')S.search='';
    if(v!=='search'&&v!=='residents')S.alphabet='';
    const inp=$('#searchInput');if(inp&&v!=='search'&&v!=='residents')inp.value='';
    render();scrollTop();
  });
}

/* ===== НОВАЯ СИСТЕМА УВЕДОМЛЕНИЙ PWA (п.4 наряда v5.2.0.0) =====
   Service Worker не может читать localStorage — токен администратора
   передаётся в SW только через postMessage и хранится у него в памяти
   (теряется при перезапуске воркера — честно оговорено в паспорте и в
   АРХИТЕКТУРНЫЙ ПРОЕКТ.txt). Чтобы фоновый робот-радар переживал
   перезапуски между сеансами, script.js сам перечитывает персистентно
   сохранённый (по явному действию администратора) токен из localStorage
   и переотправляет его в SW при каждом активном открытии приложения. */

/* ===== v5.3.0.5: ДВУХРЕЖИМНОЕ ОКНО ОБНОВЛЕНИЙ =====
   Воркер больше не включается сам: новая версия «ждёт» (waiting), страница
   спрашивает человека. config.json → updateCritical: true — окно без отмены
   («Обновить сейчас»); false — «Обновить» / «Позже» (при «Позже» обновление
   применится само при следующем запуске приложения). */
let UPD_REG=null,UPD_BUSY=false;
function updateOverlayRemove(){const o=document.getElementById('updateOverlay');if(o)o.remove()}
async function updateIsCritical(){
 try{const r=await fetch(`${ENV.configFile}?upd=${Date.now()}`,{cache:'no-store'});if(r.ok){const c=await r.json();return c.updateCritical===true||c.updateCritical==='true'}}catch(e){}
 return APP_CFG.updateCritical===true;
}
async function applyUpdate(){
 if(UPD_BUSY)return;UPD_BUSY=true;
 try{
  toast(T('updatingToast'));
  try{const cfg=await fetch(`${ENV.configFile}?refresh=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());await Promise.all((cfg.files||[]).map(f=>fetch(`${f}?refresh=${Date.now()}`,{cache:'no-store'}).catch(()=>null)))}catch(e){}
  try{localStorage.removeItem('cart_update_later')}catch(e){}
  const w=UPD_REG&&UPD_REG.waiting;
  if(w){w.postMessage({type:'SKIP_WAITING'});setTimeout(()=>location.reload(),4000)}else location.reload();
 }catch(e){location.reload()}
}
async function showUpdatePrompt(){
 if(document.getElementById('updateOverlay'))return;
 for(let i=0;i<60&&!(L&&L[S.lang]&&L[S.lang].updNormalText);i++)await new Promise(r=>setTimeout(r,100));
 if(document.getElementById('updateOverlay'))return;
 const critical=await updateIsCritical();
 const o=document.createElement('div');o.id='updateOverlay';o.className='update-overlay';
 o.innerHTML=`<div class="update-box"><div class="update-icon">${critical?'⚠️':'🔄'}</div><p>${esc(T(critical?'updCriticalText':'updNormalText'))}</p><div class="update-actions"><button class="primary" id="updNow">${esc(T(critical?'updCriticalBtn':'updNormalBtn'))}</button>${critical?'':`<button class="secondary" id="updLater">${esc(T('updLaterBtn'))}</button>`}</div></div>`;
 document.body.appendChild(o);
 $('#updNow').onclick=applyUpdate;
 const later=$('#updLater');
 if(later)later.onclick=()=>{try{localStorage.setItem('cart_update_later','1');sessionStorage.setItem('cart_upd_sess','1')}catch(e){}updateOverlayRemove()};
}
function onWaitingWorker(reg){
 UPD_REG=reg;if(!reg.waiting||!navigator.serviceWorker.controller)return;
 let later='',sess='';try{later=localStorage.getItem('cart_update_later')||'';sess=sessionStorage.getItem('cart_upd_sess')||''}catch(e){}
 if(later&&!sess){applyUpdate();return}   // «Позже» из прошлого сеанса: применяем при новом запуске
 if(sess)return;                           // в этом сеансе уже ответили «Позже»
 showUpdatePrompt();
}
function setupUpdateFlow(reg){
 try{
  UPD_REG=reg;
  try{if(!sessionStorage.getItem('cart_sess_start'))sessionStorage.setItem('cart_sess_start','1')}catch(e){}
  if(reg.waiting)onWaitingWorker(reg);
  else{try{localStorage.removeItem('cart_update_later')}catch(e){}}   // отложенное уже применено браузером при закрытии приложения
  reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{if(nw.state==='installed')onWaitingWorker(reg)})});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(UPD_BUSY){try{location.reload()}catch(e){}}});
  const chk=()=>{try{reg.update()}catch(e){}};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')chk()});
  setInterval(chk,30*60*1000);
 }catch(e){}
}
function relayAdminTokenToSw(token){
 try{
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.ready.then(reg=>{reg.active?.postMessage({type:'ADMIN_TOKEN',token:token||'',owner:CONFIG.OWNER,repo:CONFIG.REPO,requestsPath:CONFIG.PATH_REQUESTS,files:CONFIG.FILES.map(dbPath),lang:S.lang})}).catch(()=>{});
 }catch(e){}
}
function scheduleSwNotifyCheck(){
 const persisted=storageGet('cart_admin_token_persist','');
 if(persisted)relayAdminTokenToSw(persisted);
}
function setupSwMessageBridge(){
 try{
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.addEventListener('message',e=>{
   const msg=e.data||{};
   if(msg.type==='OPEN_ADMIN'){
    const persisted=storageGet('cart_admin_token_persist','');
    if(persisted){S.token=persisted;adminOpen()}
   }
  });
 }catch(e){}
}

try{
 window.addEventListener('error',()=>{try{toast(T('genericErrorToast'))}catch(e){}});
 window.addEventListener('unhandledrejection',()=>{try{toast(T('genericErrorToast'))}catch(e){}});
}catch(e){}
function init(){
 try{startSplash()}catch(e){}
 try{
  const radar=()=>sendPendingToIntake().catch(()=>{});
  window.addEventListener('online',radar);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')radar()});
  setInterval(radar,60000);
  initQueue().then(()=>{requestPersistentStorage(false);setTimeout(radar,1500)}).catch(()=>{});
 }catch(e){}
 try{loadFav()}catch(e){}
 try{loadPinned()}catch(e){}
 try{window.addEventListener('appinstalled',async()=>{try{if(!intakeUrl())return;const d=await deviceId();const r=await intakePost({action:'ping',d,ev:'install',inst:1,v:APP_VERSION});if(r&&r.ok)storageSet('cart_stats_inst','1')}catch(e){}});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')statsPing()})}catch(e){}
 try{loadFavSettings()}catch(e){}
 try{loadFavManualOrder()}catch(e){}
 try{setupTheme()}catch(e){}
 try{setupAdmin()}catch(e){}
 try{const hh=$('#mainHeader');if(hh&&window.ResizeObserver)new ResizeObserver(syncFolderTop).observe(hh);window.addEventListener('resize',syncFolderTop);window.addEventListener('load',syncFolderTop)}catch(e){}
 try{setupHistory()}catch(e){}
 try{setupSwipes()}catch(e){}
 try{setupPWA()}catch(e){}
 try{setupSwMessageBridge()}catch(e){}
 if('serviceWorker' in navigator){
   navigator.serviceWorker.register('./service-worker.js').then(reg=>{scheduleSwNotifyCheck();setupUpdateFlow(reg)}).catch(()=>{});
 }
 try{const v=$('#villagePicker');if(v)v.onclick=()=>openGeomodal();const header=$('#mainHeader');if(header)header.addEventListener('click',e=>{const b=e.target.closest?.('[data-lang-toggle]');if(b)cycleLang()});setupNav();setupCardDelegation()}catch(e){}
 try{
  const input=$('#searchInput');
  let searchDebounce=0;
  if(input)input.addEventListener('input',()=>{
   const raw=clean(input.value);
   if(raw.length<2){S.search='';if(S.view!=='residents'&&S.view!=='search')S.view='search';clearTimeout(searchDebounce);render();return}
   if(S.view!=='residents'&&S.view!=='search')S.view='search';
   clearTimeout(searchDebounce);
   searchDebounce=setTimeout(()=>{
    const wasEmpty=!S.search;
    S.search=cleanSearchValue(input.value);
    if(wasEmpty&&S.alphabet)S.alphabet='';
    render();
   },1000);
  });
  if(input)input.addEventListener('keydown',e=>{
   if(e.key==='Enter'||e.key==='Search'||e.keyCode===13){
    clearTimeout(searchDebounce);
    const wasEmpty=!S.search;
    S.search=cleanSearchValue(input.value);
    if(wasEmpty&&S.alphabet)S.alphabet='';
    if(S.view!=='residents'&&S.view!=='search')S.view='search';
    render();
    try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur()}catch(_e){}
    try{input.blur()}catch(_e){}
   }
  });
 }catch(e){}
 try{window.addEventListener('scroll',()=>{const b=$('#scrollTopBtn');if(b)b.classList.toggle('hidden',window.scrollY<320)});const b=$('#scrollTopBtn');if(b)b.onclick=scrollTop}catch(e){}
 (async()=>{
   try{
     await loadConfig();
     try{loadFav()}catch(err){S.favorites=new Set();S.favOrder=[]}
     await loadLang();
     await loadCategories();
     loadNameSynonyms().catch(()=>{});
     render();
     await loadDatabases();
     try{applyDbEpoch()}catch(e){}
     try{await loadAliases();const mv=applyAliasesToStorage();if(mv>0)toast(T('aliasMigratedToast',{n:mv}));render()}catch(e){}
     statsPing();
     welcomeModal();
   }catch(e){
     console.error('Startup error',e);
     try{toast(T('startupFailToast'))}catch(err){}
   }finally{
      try{finishSplash()}catch(err){}
   }
 })();
}
init();
})();
