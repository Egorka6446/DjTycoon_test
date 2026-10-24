import './style.css';
import { SAVE_KEY, GEAR, VENUES, CREW, QUESTS, freshState, parseSave, incomePerSecond, advance, gearCost, buyGear, buyCrew, recordLoop, feeMultiplier, finishGig, claimQuest, nextVenue, judgeBeat } from './engine.js';
import { AudioEngine } from './audio.js';

const icons = {
  wave: '<path d="M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4"/>',
  decks: '<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="7.5" cy="12" r="3"/><circle cx="16.5" cy="12" r="3"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M6 10a7 7 0 0 1 4-4m4 12a7 7 0 0 0 4-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 5h6"/>',
  club: '<path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6M9 10h6"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 4a5 5 0 0 1 2 4v3"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8H11a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v2m0 8v2"/>',
  up: '<path d="m5 15 5-5 4 3 5-8m-5 0h5v5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  sound: '<path d="M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 4 6 8H3v8h3l5 4Zm5 5 6 6m0-6-6 6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  speaker: '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="6" r="1"/>',
  cup: '<path d="M4 4h13v9a6.5 6.5 0 0 1-13 0ZM17 5h2a3 3 0 0 1 0 6h-2M3 22h15"/>',
  heart: '<path d="M20 4a5 5 0 0 0-8 2 5 5 0 0 0-8-2c-6 6 8 16 8 16s14-10 8-16Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v7m-5 0h10"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.wave}</svg>`;
const money = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.floor(n));
const compact = n => new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = freshState(), offline = 0, storageAvailable = true, loadError = false;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    state = parseSave(JSON.parse(raw));
    const seconds = Math.max(0, (Date.now() - state.savedAt) / 1000);
    offline = advance(state, seconds);
  }
} catch { loadError = true; }
let view = 'studio', session = null, lastFrame = performance.now(), lastUI = 0, lastSave = 0, lastPad = -Infinity, padIndex = 0;
const audio = new AudioEngine();
audio.setVolume(state.settings.volume);
const app = document.querySelector('#app');

function save() {
  state.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); storageAvailable = true; }
  catch { storageAvailable = false; }
  updateSaveStatus();
}
function updateSaveStatus() {
  const label = document.querySelector('#save-status');
  if (label) label.innerHTML = `${icon(storageAvailable ? 'check' : 'download')} ${storageAvailable ? 'Прогресс сохранён' : 'Скачай сохранение в настройках'}`;
}
function toast(message, kind = 'success') {
  const host = document.querySelector('#toasts');
  const item = document.createElement('div'); item.className = `toast ${kind}`;
  item.innerHTML = `${icon(kind === 'success' ? 'check' : 'disc')}<span>${escapeHtml(message)}</span>`;
  host.append(item); setTimeout(() => item.remove(), 4500);
}

function render() {
  document.documentElement.classList.toggle('reduce-motion', state.settings.reducedMotion);
  app.innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="AFTERHOURS, студия" data-action="nav" data-view="studio"><span class="brand-mark">${icon('wave')}</span><span>AFTERHOURS<small>DJ TYCOON</small></span></a>
      <div class="sidebar-label">ТВОЯ ИМПЕРИЯ</div>
      <nav aria-label="Разделы игры">${[['studio', 'decks', 'Студия'], ['gigs', 'calendar', 'Выступления'], ['club', 'club', 'Мой клуб']].map(([id, ico, name]) => `<button class="nav-item ${view === id ? 'active' : ''}" data-action="nav" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}>${icon(ico)}<span>${name}</span>${view === id ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-journey"><div class="journey-art">${icon('disc')}<span class="tiny-star">✦</span></div><span class="eyebrow">ТВОЯ СЛЕДУЮЩАЯ СЦЕНА</span><h3 id="next-name"></h3><div class="progress"><i id="next-progress"></i></div><p id="next-count"></p><button class="text-link" data-action="nav" data-view="gigs">Посмотреть площадки ${icon('arrow')}</button></div>
      <div class="sidebar-bottom"><span class="no-ads">${icon('heart')} Только музыка. Без рекламы.</span><button class="nav-item settings-link" data-action="settings">${icon('settings')} Настройки</button><small>СДЕЛАНО ДЛЯ ТВОЕГО РИТМА</small></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">Твоя империя <span>/</span> <strong>${{ studio: 'Студия', gigs: 'Выступления', club: 'Мой клуб' }[view]}</strong></div><div class="header-actions"><span id="save-status"></span><button class="sound-button ${audio.enabled ? 'enabled' : ''}" data-action="sound" aria-label="${audio.enabled ? 'Выключить звук' : 'Включить звук'}">${icon(audio.enabled ? 'sound' : 'mute')}<span>${audio.enabled ? 'Звук вкл.' : 'Включить звук'}</span></button><button class="avatar" data-action="settings" aria-label="Настройки профиля">DJ</button></div></header>
      <main id="main-content">
        <div class="page-heading"><div><div class="eyebrow accent">${view === 'studio' ? 'ИЗ СПАЛЬНИ — В ХЕДЛАЙНЕРЫ' : view === 'gigs' ? 'КАЖДЫЙ СЕТ — НОВАЯ ИСТОРИЯ' : 'МЕСТО, ГДЕ ЖИВЁТ МУЗЫКА'}</div><h1>${view === 'studio' ? 'Твой звук. Твои правила<span>.</span>' : view === 'gigs' ? 'Город ждёт твой сет<span>.</span>' : 'Больше, чем танцпол<span>.</span>'}</h1><p>${view === 'studio' ? 'Создавай музыку, собирай людей и делай ночь своей.' : view === 'gigs' ? 'От первого квартирника до имени на главной сцене.' : 'Собери команду и построй место, в которое хочется вернуться.'}</p></div><span class="chapter-badge">${icon('spark')} ${rank()}</span></div>
        <section class="stats" aria-label="Твоя статистика"><div class="stat-card"><span class="stat-icon green">${icon('coin')}</span><div><span class="stat-label">Твой баланс</span><strong><span data-stat="cash"></span> <small>₽</small></strong></div><span class="stat-foot green-text">${icon('up')} <span data-stat="income"></span>/сек</span></div><div class="stat-card"><span class="stat-icon purple">${icon('people')}</span><div><span class="stat-label">Твои фанаты</span><strong data-stat="fans"></strong></div><span class="stat-foot">Твоя музыкальная семья</span></div><div class="stat-card"><span class="stat-icon peach">${icon('disc')}</span><div><span class="stat-label">Выпущено треков</span><strong data-stat="tracks"></strong></div><span class="stat-foot"><span data-stat="shows"></span> сетов за плечами</span></div></section>
        ${view === 'studio' ? studioView() : view === 'gigs' ? gigsView() : clubView()}
        <footer><span>AFTERHOURS <i>·</i> Ночь только начинается</span><span>Прогресс хранится в этом браузере ${icon('check')}</span></footer>
      </main>
    </div>
    <div id="toasts" class="toasts" aria-live="polite"></div>
    <dialog id="modal"><div id="modal-content"></div></dialog>`;
  updateUI(); updateSaveStatus();
}

function rank() { return state.fans >= 1200 ? 'Хедлайнер' : state.fans >= 550 ? 'Резидент клуба' : state.fans >= 220 ? 'Голос андеграунда' : state.fans >= 65 ? 'Восходящая звезда' : 'Спальня — это старт'; }
function waveform(color, seed = 0) {
  return `<svg viewBox="0 0 360 52" preserveAspectRatio="none" aria-hidden="true">${Array.from({ length: 100 }, (_, i) => { const h = 3 + Math.abs(Math.sin(i * 1.7 + seed) * Math.cos(i * .21 + seed)) * 46; return `<rect x="${i * 3.6}" y="${(52 - h) / 2}" width="2" height="${h}" rx="1" fill="${color}" opacity="${.3 + (i % 7) / 10}"/>`; }).join('')}</svg>`;
}
function deck(side) {
  return `<div class="deck deck-${side}"><div class="deck-meta"><span><i class="live-dot ${side === 'b' ? 'purple-dot' : ''}"></i> DECK ${side.toUpperCase()}</span><strong>${side === 'a' ? 'Midnight City' : 'Velvet Horizon'}</strong><span class="deck-genre">${side === 'a' ? 'DEEP HOUSE' : 'MELODIC HOUSE'} <b>Am</b></span></div><div class="vinyl ${audio.enabled || session ? 'spinning' : ''}"><div class="vinyl-ring"></div><div class="record-label"><span>${side === 'a' ? 'a' : 'b'}.</span><small>AFTERHOURS<br>ORIGINALS</small><i></i></div><span class="vinyl-shine"></span></div><div class="waveform">${waveform(side === 'a' ? '#bcf77b' : '#b9a2ff', side === 'a' ? 0 : 2)}<span class="playhead"></span></div><div class="deck-bottom"><span><b class="bpm-number">${session?.venue.bpm || 112}</b> BPM</span><span class="track-time">${side === 'a' ? '03:42' : '04:18'} <i> / ORIGINAL MIX</i></span></div></div>`;
}
function studioView() {
  return `${pixelRoom()}<div class="studio-grid"><section class="panel booth-panel"><div class="panel-heading"><h2>${icon('decks')} За пультом</h2><span class="status-pill ${session ? 'on-air' : ''}"><i></i>${session ? 'LIVE · ' + session.venue.name : 'STUDIO SESSION'}</span></div><div class="console">${deck('a')}<div class="mixer"><div class="mixer-label">MIXER</div><div class="eq"><span>HI</span><i class="knob"></i><span>MID</span><i class="knob knob-alt"></i><span>LOW</span><i class="knob"></i></div><div class="vu-meter"><span></span><span></span></div><div class="mixer-logo">A<span>/</span>H</div></div>${deck('b')}</div><div class="crossfader"><div class="crossfader-label"><span>DECK A</span><label for="mix">${session ? 'Держи фейдер в зелёной зоне' : 'КРОССФЕЙДЕР'}</label><span>DECK B</span></div><div class="fader-track"><div id="mix-target" class="mix-target" ${session ? '' : 'hidden'}></div><input id="mix" type="range" min="0" max="100" value="${session?.mix ?? 50}" aria-label="Кроссфейдер"/></div></div>
      ${session ? livePanel() : `<div class="studio-actions"><div class="pads" aria-label="Запись лупов">${[0, 1, 2, 3].map((i) => `<button class="pad pad-${i}" data-action="pad" data-pad="${i}" aria-label="Записать луп ${i + 1}"><span>${i + 1}</span>${['KICK', 'BASS', 'CHORD', 'LEAD'][i]}</button>`).join('')}</div><div class="record-progress"><span>Твой следующий релиз <b><span data-stat="loops"></span>/16</b></span><div class="loop-bars">${Array.from({ length: 16 }, (_, i) => `<i data-loop="${i}"></i>`).join('')}</div><small>Нажимай пэды или клавиши 1–4</small></div><button class="button primary" data-action="play-best">${icon('play')} Играть сет</button></div>`}
    </section><aside class="right-column"><section class="dream-card"><div class="dream-art"><div class="art-sun"></div><div class="art-orbit"></div><div class="art-mountains"></div><div class="art-grid"></div><div class="art-stars">✦ <span>+</span> ·</div><span class="art-word">AFTER<br>HOURS</span><span class="art-caption">THIS IS YOUR NIGHT.</span></div><div class="dream-content"><span class="eyebrow accent">БОЛЬШОЙ ЗВУК НАЧИНАЕТСЯ С МАЛОГО</span><h3>Следующая остановка —<br>${nextVenue(state)?.name || 'весь мир'}.</h3><p>Каждый трек и каждый сет<br>приближают тебя к главной сцене.</p><button class="text-link" data-action="nav" data-view="gigs">Найти свою сцену ${icon('arrow')}</button></div></section></aside></div>
    <div class="section-heading"><div><h2>Прокачай свой звук</h2><p>Хорошая музыка заслуживает хорошего оборудования.</p></div><span class="muted">${icon('up')} Улучшения навсегда</span></div><section class="gear-grid" aria-label="Оборудование">${GEAR.map(gearCard).join('')}</section>
    <div class="bottom-grid"><section class="panel goals-panel"><div class="panel-heading"><h2>${icon('trophy')} Маленькие шаги, большой путь</h2><span class="muted" data-stat="quests"></span></div><div id="quests">${questRows()}</div></section><section class="panel listening-panel"><span class="listening-icon">${icon('heart')}</span><div class="eyebrow">МУЗЫКА РАБОТАЕТ ЗА ТЕБЯ</div><h3>Можно просто<br>поймать вайб.</h3><p>Роялти приходят даже без кликов.<br>А после перерыва тебя ждёт доход<br>за время до 8 часов.</p><span class="listening-tag"><i class="live-dot"></i> Без спешки. В своём ритме.</span></section></div>`;
}
function pixelRoom() {
  const room = Math.min(4, Math.floor((state.fans + state.tracks * 18 + state.shows * 24) / 130));
  const deckName = state.gear.decks >= 2 ? 'DDJ-REV7' : 'DDJ-FLX4';
  return `<section class="pixel-room room-${room}"><div class="pixel-room-art"><span class="pixel-moon">☾</span><span class="pixel-star star-one">✦</span><span class="pixel-star star-two">·</span><div class="pixel-window"></div><div class="pixel-poster">${room >= 2 ? 'AH<br><b>LIVE</b>' : 'MAKE<br><b>NOISE</b>'}</div><div class="pixel-shelf"><i></i><i></i><i></i><i></i></div><div class="pixel-person"><i class="pixel-hair"></i><i class="pixel-face"></i><i class="pixel-shirt"></i><i class="pixel-hand"></i></div><div class="pixel-console"><span></span><span></span><span></span><span></span><b>${deckName}</b></div><div class="pixel-floor"></div></div><div class="pixel-room-copy"><div><span class="eyebrow">ТВОЯ СТУДИЯ · УРОВЕНЬ ${room + 1}</span><h2>${['Спальня на окраине','Домашняя студия','Уютный лофт','Клубная кабина','Главная сцена'][room]}</h2><p>${['Первый бит всегда самый важный.','Уже можно звать первых друзей.','Твой звук слышен на весь район.','Теперь танцпол работает на тебя.','Ты управляешь целой ночью.'][room]}</p></div><button class="room-play" data-action="play-best">${icon('play')}</button></div></section>`;
}
function gearCard(item) {
  const level = state.gear[item.id];
  return `<article class="gear-card"><div class="gear-top"><span class="gear-illustration ${item.id}">${icon(item.icon)}</span><span class="level" data-level="${item.id}">LVL ${level}</span></div><span class="eyebrow">${item.category}</span><h3>${item.name}</h3><p>${item.description}</p><div class="gear-benefit">${icon('up')} +${item.income.toFixed(2).replace('.', ',')} ₽/сек ${item.fee ? `· +${Math.round(item.fee * 100)}% к сетам` : '· постоянный доход'}</div><button class="upgrade-button" data-action="buy-gear" data-id="${item.id}" ${level >= 10 || state.cash < gearCost(state, item.id) ? 'disabled' : ''}><span>${level >= 10 ? 'Максимальный уровень' : 'Улучшить'}</span><b data-price="${item.id}">${level >= 10 ? '✓' : money(gearCost(state, item.id)) + ' ₽'}</b></button></article>`;
}
function questRows() {
  const visible = QUESTS.filter(q => !state.claimed.includes(q.id)).slice(0, 3);
  return visible.length ? visible.map(q => { const value = Math.min(q.value(state), q.goal); return `<div class="quest-row"><span class="quest-symbol ${value >= q.goal ? 'complete' : ''}">${icon(value >= q.goal ? 'check' : 'spark')}</span><div class="quest-text"><strong>${q.name}</strong><small>${q.description}</small><div class="progress"><i style="width:${value / q.goal * 100}%"></i></div></div><button class="quest-reward" data-action="claim" data-id="${q.id}" ${value < q.goal ? 'disabled' : ''}>${value >= q.goal ? 'Забрать' : `${money(value)}/${money(q.goal)}`}<span>+${money(q.reward)} ₽</span></button></div>`; }).join('') : '<div class="all-done">✦ Все цели достигнуты. Теперь эта ночь — твоя.<br><small>Ставь рекорды, развивай клуб и играй любимые сеты.</small></div>';
}
function gigsView() {
  return `<section class="gig-intro"><span class="intro-icon">${icon('wave')}</span><div><h2>Почувствуй ритм</h2><p>Нажимай пробел или «В бит», когда нота попадает на линию. Держи фейдер в зелёной зоне. 32 бита, около 20 секунд — и танцпол твой.</p></div><span class="intro-tag">Даже первый сет приносит доход</span></section><section class="venue-grid" aria-label="Площадки">${VENUES.map((v, i) => { const locked = state.fans < v.fans; return `<article class="venue-card ${locked ? 'locked' : ''}" style="--venue-color:${v.color}"><div class="venue-art venue-art-${i}"><span class="venue-number">0${i + 1} / THE JOURNEY</span><div class="venue-symbol">${v.emoji}</div><div class="venue-skyline">${Array.from({ length: 11 }, (_, j) => `<i style="height:${20 + ((j * 37 + i * 13) % 65)}%"></i>`).join('')}</div><span class="venue-tag">${locked ? icon('lock') : '<i class="live-dot"></i>'}${v.tag}</span></div><div class="venue-content"><span class="eyebrow">${v.subtitle}</span><h2>${v.name}</h2><div class="venue-info"><span>${icon('people')} ${v.crowd}</span><span>${v.bpm} BPM</span></div><div class="venue-rewards"><span>Гонорар от <strong>${money(v.fee * .6 * feeMultiplier(state))} ₽</strong></span><span>до +${Math.round(v.gain * 1.6 * (1 + state.gear.lights * .12))} фанатов</span></div>${locked ? `<div class="venue-unlock"><div class="progress"><i data-venue-progress="${v.id}" style="width:${Math.min(100, state.fans / v.fans * 100)}%"></i></div><span>Нужно ${money(v.fans)} фанатов</span></div>` : ''}<button class="button ${locked ? 'locked-button' : 'primary'}" data-action="start-gig" data-id="${v.id}" ${locked ? 'disabled' : ''}>${icon(locked ? 'lock' : 'play')}${locked ? 'Пока не открыто' : 'Занять место за пультом'}</button></div></article>`; }).join('')}</section><section class="panel history-panel"><div class="panel-heading"><h2>${icon('calendar')} Твои последние ночи</h2><span class="muted">Личный рекорд: ${state.bestAccuracy}%</span></div>${historyRows()}</section>`;
}
function historyRows() {
  return state.history.length ? `<div class="history-list">${state.history.map(row => `<div class="history-row"><span class="history-disc">${icon('disc')}</span><div><strong>${VENUES.find(v => v.id === row.venue).name}</strong><small>${new Date(row.time).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · Точность ${row.accuracy}%</small></div><span class="green-text">+${money(row.fee)} ₽</span><span class="muted">+${row.fans} фанатов</span></div>`).join('')}</div>` : '<div class="empty-state">Твоя история выступлений пока чиста.<br><span>Первый квартирник уже ждёт тебя.</span></div>';
}
function clubView() {
  return `<section class="club-banner"><div><span class="eyebrow accent">НЕЗАВИСИМАЯ МУЗЫКА. СВОИ ЛЮДИ.</span><h2>Твой маленький<br>центр притяжения<span>.</span></h2><p>Ты отвечаешь за музыку. Команда позаботится об остальном.<br>Развивай клуб без аренды, долгов и таймеров ожидания.</p><span class="club-status">${icon('people')} ${money(state.fans)} людей уже на твоей волне</span></div><div class="club-visual"><div class="club-sign">AFTER<br><b>HOURS</b></div><div class="club-door"></div><div class="club-window"></div><div class="club-pavement"></div></div></section><div class="section-heading"><div><h2>Команда мечты</h2><p>Те, кто помогает твоему делу расти.</p></div></div><section class="crew-grid">${CREW.map(item => { const owned = state.crew.includes(item.id), locked = state.fans < item.fans; return `<article class="crew-card"><span class="crew-icon">${icon(item.icon)}</span><span class="eyebrow">${owned ? 'УЖЕ В ТВОЕЙ КОМАНДЕ' : 'РАСШИРЕНИЕ КЛУБА'}</span><h3>${item.name}</h3><p>${item.description}</p><div class="crew-benefit">+${item.income} ₽/сек${item.id === 'promoter' ? '<br>+126 фанатов/час' : ''}</div><button class="upgrade-button" data-action="buy-crew" data-id="${item.id}" ${owned || locked || state.cash < item.cost ? 'disabled' : ''}><span>${owned ? 'Работает для тебя' : locked ? `${money(item.fans)} фанатов` : 'Пригласить'}</span><b>${owned ? '✓' : locked ? icon('lock') : money(item.cost) + ' ₽'}</b></button></article>`; }).join('')}</section><section class="panel collection-panel"><div class="panel-heading"><h2>${icon('disc')} Твоя дискография</h2><span class="muted">${state.tracks} релизов</span></div>${state.tracks ? `<div class="album-grid">${Array.from({ length: Math.min(state.tracks, 8) }, (_, i) => `<div class="album"><div class="album-cover album-${i % 4}"><span>AH / 00${i + 1}</span>${icon('disc')}<b>${['MIDNIGHT<br>CITY', 'VELVET<br>HORIZON', 'AFTER<br>THE RAIN', 'NO SLEEP<br>CLUB'][i % 4]}</b></div><strong>${['Midnight City', 'Velvet Horizon', 'After the Rain', 'No Sleep Club'][i % 4]} ${i >= 4 ? 'II' : ''}</strong><span>AFTERHOURS ORIGINAL</span></div>`).join('')}</div>` : '<div class="empty-state">Первый релиз начинается с одного лупа.<br><span>Вернись в студию и нажимай пэды 1–4.</span><button class="text-link" data-action="nav" data-view="studio">Создать музыку ' + icon('arrow') + '</button></div>'}</section>`;
}
function livePanel() {
  return `<section class="live-panel"><div class="live-topline"><div><span class="eyebrow accent">ТВОЙ МОМЕНТ</span><h3 id="hit-feedback">Лови ритм. Ты справишься.</h3></div><span id="live-counter">0 / 32 БИТА</span></div><div class="rhythm-lane" id="rhythm-lane" aria-hidden="true"><div class="hit-line"></div><span class="hit-zone-label">БИТ</span>${Array.from({ length: 32 }, (_, i) => `<i class="beat-note" data-beat="${i}"></i>`).join('')}</div><div class="live-controls"><button class="button primary hit-button" data-action="hit">${icon('wave')} В бит <kbd>ПРОБЕЛ</kbd></button><span id="live-score">Нажимай, когда нота пересекает линию</span><button class="text-link muted" data-action="cancel-gig">Прервать</button></div></section>`;
}
function updateUI() {
  const stats = { cash: money(state.cash), income: incomePerSecond(state).toFixed(2).replace('.', ',') + ' ₽', fans: money(state.fans), tracks: money(state.tracks), shows: state.shows, loops: state.loops, quests: `${state.claimed.length}/${QUESTS.length} целей` };
  for (const [key, value] of Object.entries(stats)) document.querySelectorAll(`[data-stat="${key}"]`).forEach(el => el.textContent = value);
  const next = nextVenue(state);
  document.querySelector('#next-name').textContent = next?.name || 'Ты — хедлайнер!';
  document.querySelector('#next-progress').style.width = `${next ? Math.min(100, state.fans / next.fans * 100) : 100}%`;
  document.querySelector('#next-count').textContent = next ? `${money(state.fans)} / ${money(next.fans)} фанатов` : 'Главная сцена открыта';
  document.querySelectorAll('[data-loop]').forEach(el => el.classList.toggle('filled', +el.dataset.loop < state.loops));
  for (const item of GEAR) {
    const button = document.querySelector(`[data-action="buy-gear"][data-id="${item.id}"]`);
    if (button) button.disabled = state.gear[item.id] >= 10 || state.cash < gearCost(state, item.id);
  }
  for (const item of CREW) {
    const button = document.querySelector(`[data-action="buy-crew"][data-id="${item.id}"]`);
    if (button) button.disabled = state.crew.includes(item.id) || state.fans < item.fans || state.cash < item.cost;
  }
}
function openModal(html) {
  document.querySelector('#modal-content').innerHTML = `<button class="modal-close" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button>${html}`;
  document.querySelector('#modal').showModal();
}
function closeModal() { document.querySelector('#modal').close(); }
function settingsModal() {
  openModal(`<span class="eyebrow accent">У ТЕБЯ ВСЁ ПОД КОНТРОЛЕМ</span><h2>Настрой свой вайб</h2><p class="modal-description">Сохранение — локальное. Скачай копию, чтобы перенести свою империю на другое устройство.</p><label class="setting-row" for="volume">Громкость <input id="volume" type="range" min="0" max="100" value="${state.settings.volume * 100}"/></label><label class="setting-row" for="motion">Меньше анимации<input id="motion" type="checkbox" ${state.settings.reducedMotion ? 'checked' : ''}/></label><div class="save-actions"><button class="button secondary" data-action="export">${icon('download')} Скачать прогресс</button><label class="button secondary import-label">Загрузить прогресс<input id="import-save" type="file" accept="application/json,.json"/></label></div><p class="settings-note">Без аккаунтов, рекламы, покупок и отправки игровых данных. Очистка данных браузера удалит локальное сохранение.</p><div class="reset-area"><button class="text-link danger-text" data-action="confirm-reset">Начать заново</button><div id="reset-confirm" hidden><p>Твой баланс, треки и выступления будут удалены. Сначала можно скачать копию.</p><button class="button danger" data-action="reset">Да, начать с чистого листа</button></div></div>`);
}
async function toggleSound() {
  if (audio.enabled) { audio.disable(); state.settings.sound = false; }
  else {
    audio.setVolume(state.settings.volume);
    const enabled = await audio.enable();
    state.settings.sound = enabled;
    if (!enabled) { toast('Браузер не разрешил звук. Ритм всё равно виден на экране.', 'info'); return; }
    if (session) {
      const elapsed = (performance.now() - session.start) / 1000;
      const index = Math.max(0, Math.ceil((elapsed - 1) / session.interval));
      audio.setTempo(session.venue.bpm, Math.max(.01, 1 + index * session.interval - elapsed));
    }
  }
  const button = document.querySelector('.sound-button');
  button.classList.toggle('enabled', audio.enabled); button.setAttribute('aria-label', audio.enabled ? 'Выключить звук' : 'Включить звук');
  button.innerHTML = `${icon(audio.enabled ? 'sound' : 'mute')}<span>${audio.enabled ? 'Звук вкл.' : 'Включить звук'}</span>`;
  document.querySelectorAll('.vinyl').forEach(el => el.classList.toggle('spinning', audio.enabled || !!session));
  save();
}
function pad(index) {
  if (performance.now() - lastPad < 120) return;
  lastPad = performance.now(); audio.pad(index);
  const el = document.querySelector(`[data-action="pad"][data-pad="${index}"]`);
  if (el) { el.classList.remove('pressed'); void el.offsetWidth; el.classList.add('pressed'); }
  if (session) return;
  const released = recordLoop(state);
  updateUI();
  if (released) {
    document.querySelector('#quests').innerHTML = questRows();
    toast(`Новый релиз! +40 ₽ и +5 фанатов. Твой звук услышат.`);
    save();
  }
}
function startGig(id) {
  if (session) return;
  const venue = VENUES.find(v => v.id === id);
  if (!venue || state.fans < venue.fans) return;
  closeModal();
  view = 'studio';
  session = { venue, start: performance.now(), interval: 60 / venue.bpm, scored: new Set(), points: 0, mix: 50, mixPoints: 0, mixSamples: 0, sampled: -1, feedbackUntil: 0, target: 50 };
  audio.setTempo(venue.bpm, 1);
  render();
  document.querySelector('.booth-panel').scrollIntoView({ behavior: state.settings.reducedMotion ? 'instant' : 'smooth', block: 'center' });
}
function hit() {
  if (!session) return;
  const elapsed = (performance.now() - session.start) / 1000;
  const result = judgeBeat(elapsed, session.interval, 32, session.scored);
  const feedback = document.querySelector('#hit-feedback');
  if (result) {
    session.points += result.quality;
    feedback.textContent = result.label;
    feedback.className = result.quality === 1 ? 'perfect' : 'good';
    document.querySelector(`[data-beat="${result.index}"]`)?.classList.add('hit');
    const lane = document.querySelector('#rhythm-lane'); lane.classList.remove('hit-flash'); void lane.offsetWidth; lane.classList.add('hit-flash');
  } else {
    feedback.textContent = 'Поймай следующую ноту'; feedback.className = 'miss';
  }
  session.feedbackUntil = performance.now() + 650;
}
function tickGig(now) {
  if (!session) return;
  const elapsed = (now - session.start) / 1000;
  const beat = Math.floor((elapsed - 1) / session.interval);
  const section = Math.max(0, Math.min(3, Math.floor(beat / 8)));
  session.target = [50, 28, 72, 45][section];
  const target = document.querySelector('#mix-target');
  if (target) { target.style.left = `${session.target - 18}%`; target.style.width = '36%'; }
  if (beat >= 0 && beat < 32 && beat !== session.sampled) {
    session.sampled = beat; session.mixSamples++; session.mixPoints += Math.abs(session.mix - session.target) <= 18 ? 1 : .2;
  }
  document.querySelectorAll('[data-beat]').forEach(el => {
    const t = 1 + +el.dataset.beat * session.interval - elapsed;
    el.style.left = `${24 + t * 39}%`;
    el.style.visibility = t < 2.1 && t > -.65 ? 'visible' : 'hidden';
    el.classList.toggle('missed', t < -.21 && !session.scored.has(+el.dataset.beat));
  });
  document.querySelector('#live-counter').textContent = `${Math.max(0, Math.min(32, beat + 1))} / 32 БИТА`;
  document.querySelector('#live-score').textContent = `${session.scored.size} попаданий · ${Math.max(0, Math.ceil(1 + 32 * session.interval - elapsed))} сек`;
  if (now > session.feedbackUntil && elapsed > 1) { const el = document.querySelector('#hit-feedback'); el.textContent = ['Почувствуй этот грув', 'Фейдер левее — новый вайб', 'Фейдер правее — подними волну', 'Финальные биты. Это твоя ночь.'][section]; el.className = ''; }
  if (elapsed >= 1 + 32 * session.interval + .25) completeGig();
}
function completeGig() {
  const quality = .85 * session.points / 32 + .15 * session.mixPoints / Math.max(1, session.mixSamples);
  const venue = session.venue;
  const previousFans = state.fans;
  const result = finishGig(state, venue.id, quality);
  session = null; audio.setTempo(112); save(); render();
  const unlocked = VENUES.find(v => v.fans > previousFans && v.fans <= state.fans);
  openModal(`<div class="result-icon">${icon(quality > .7 ? 'trophy' : 'disc')}</div><div class="eyebrow accent">${venue.name.toUpperCase()} · СЕТ ЗАВЕРШЁН</div><h2>${quality > .8 ? 'Танцпол влюбился.' : quality > .4 ? 'Ночь удалась.' : 'Первый шаг — уже музыка.'}</h2><p class="modal-description">${quality > .7 ? 'Ты и музыка сегодня были одним целым.' : 'Каждый сет делает тебя увереннее. Продолжай ловить ритм.'}</p><div class="result-stats"><div><strong>+${money(result.fee)} ₽</strong><span>Твой гонорар</span></div><div><strong>+${result.fans}</strong><span>Новых фанатов</span></div><div><strong>${result.accuracy}%</strong><span>Качество сета</span></div></div>${unlocked ? `<div class="unlock-message">${icon('spark')} Новая сцена открыта: ${unlocked.name}!</div>` : ''}<button class="button primary full-width" data-action="replay" data-id="${venue.id}">${icon('play')} Ещё один сет</button><button class="button secondary full-width" data-action="close-modal">Вернуться в студию</button>`);
}
function exportSave() {
  save();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `afterhours-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let pendingImport = null;
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (button.tagName === 'A') event.preventDefault();
  if (action === 'nav') {
    if (session) { toast('Сначала закончи сет или нажми «Прервать».', 'info'); return; }
    view = button.dataset.view; render(); window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (action === 'sound') await toggleSound();
  else if (action === 'settings') { if (session) toast('Настройки доступны после сета.', 'info'); else settingsModal(); }
  else if (action === 'close-modal') closeModal();
  else if (action === 'pad') pad(+button.dataset.pad);
  else if (action === 'buy-gear' && buyGear(state, id)) { save(); render(); toast(`${GEAR.find(g => g.id === id).name}: новый уровень!`); }
  else if (action === 'buy-crew' && buyCrew(state, id)) { save(); render(); toast('Команда стала сильнее. Доход уже растёт!'); }
  else if (action === 'claim' && claimQuest(state, id)) { save(); render(); toast(`Цель достигнута! +${QUESTS.find(q => q.id === id).reward} ₽`); }
  else if (action === 'play-best') startGig([...VENUES].reverse().find(v => state.fans >= v.fans).id);
  else if (action === 'start-gig' || action === 'replay') startGig(id);
  else if (action === 'hit') hit();
  else if (action === 'cancel-gig') {
    openModal('<div class="eyebrow accent">БЕЗ СПЕШКИ</div><h2>Закончить сет раньше?</h2><p class="modal-description">Гонорар и фанаты начисляются за полный сет. Твои деньги и прогресс сохранятся.</p><button class="button primary full-width" data-action="close-modal">Продолжить играть</button><button class="button secondary full-width" data-action="leave-gig">Выйти в студию</button>');
  } else if (action === 'leave-gig') { session = null; audio.setTempo(112); render(); }
  else if (action === 'export') exportSave();
  else if (action === 'confirm-reset') document.querySelector('#reset-confirm').hidden = false;
  else if (action === 'reset') { state = freshState(); pendingImport = null; audio.disable(); audio.setVolume(state.settings.volume); save(); view = 'studio'; render(); toast('Новая история начинается. Добро пожаловать за пульт.'); }
  else if (action === 'apply-import' && pendingImport) {
    state = pendingImport; pendingImport = null; lastFrame = performance.now(); audio.disable(); audio.setVolume(state.settings.volume); save(); render(); toast('Твой прогресс загружен. Продолжаем ночь!');
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'mix') { audio.mix = +event.target.value / 100; if (session) session.mix = +event.target.value; }
  if (event.target.id === 'volume') { state.settings.volume = +event.target.value / 100; audio.setVolume(state.settings.volume); save(); }
});
document.addEventListener('change', async event => {
  if (event.target.id === 'motion') { state.settings.reducedMotion = event.target.checked; document.documentElement.classList.toggle('reduce-motion', state.settings.reducedMotion); save(); }
  if (event.target.id === 'import-save') {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('Слишком большой файл сохранения.');
      pendingImport = parseSave(JSON.parse(await file.text()));
      closeModal();
      openModal(`<span class="eyebrow accent">ТВОЯ МУЗЫКА ВОЗВРАЩАЕТСЯ</span><h2>Загрузить этот прогресс?</h2><p class="modal-description">В файле: ${money(pendingImport.cash)} ₽, ${money(pendingImport.fans)} фанатов, ${pendingImport.tracks} треков. Текущий прогресс будет заменён.</p><button class="button primary full-width" data-action="apply-import">Загрузить сохранение</button><button class="button secondary full-width" data-action="close-modal">Оставить текущий прогресс</button>`);
    } catch (error) { toast(error instanceof SyntaxError ? 'Файл не похож на сохранение. Выбери JSON-файл AFTERHOURS.' : error.message, 'info'); }
  }
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input, textarea, select, button, a') || document.querySelector('#modal').open) return;
  if (event.code === 'Space' && session) { event.preventDefault(); hit(); }
  else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code) && view === 'studio' && !session) { event.preventDefault(); pad(+event.code.slice(-1) - 1); }
});
document.addEventListener('pointerdown', () => {
  if (audio.context?.state === 'suspended' && audio.enabled) audio.context.resume().catch(() => {});
}, { passive: true });
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else {
    const now = performance.now();
    const earned = advance(state, (now - lastFrame) / 1000); lastFrame = now;
    if (earned > 5) toast(`С возвращением! Музыка принесла ${money(earned)} ₽.`);
    updateUI();
  }
});
function frame(now) {
  if (!document.hidden) {
    advance(state, (now - lastFrame) / 1000); lastFrame = now;
    if (session) tickGig(now);
    if (now - lastUI > 250) { updateUI(); lastUI = now; }
    if (now - lastSave > 5000) { save(); lastSave = now; }
  }
  requestAnimationFrame(frame);
}
render();
save();
if (offline >= 5) setTimeout(() => toast(`Пока тебя не было, роялти принесли ${money(offline)} ₽. С возвращением!`), 400);
if (loadError) setTimeout(() => toast('Не удалось прочитать сохранение. Можно загрузить резервную копию в настройках.', 'info'), 600);
requestAnimationFrame(frame);
