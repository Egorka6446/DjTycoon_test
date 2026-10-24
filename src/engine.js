export const SAVE_KEY = 'afterhours-save-v1';
export const MAX_OFFLINE = 8 * 60 * 60;
export const GEAR = [
  { id: 'decks', name: 'Pioneer DJ DDJ-FLX4', category: 'ПЕРВЫЙ ПУЛЬТ', description: 'Компактный контроллер для первых сетов.', icon: 'decks', base: 120, income: .18, fee: .12 },
  { id: 'speakers', name: 'KRK Rokit 5 G4', category: 'МОНИТОРЫ', description: 'Тёплый низ и честный звук в комнате.', icon: 'speaker', base: 220, income: .28, fee: .10 },
  { id: 'studio', name: 'Pioneer DJ DDJ-REV7', category: 'ПРО-СЕТАП', description: 'Виниловый контроль и уверенный скретч.', icon: 'wave', base: 350, income: .85, fee: 0 },
  { id: 'lights', name: 'Pioneer CDJ-3000 + DJM-A9', category: 'ХЕДЛАЙНЕР', description: 'Клубная кабина для больших ночей.', icon: 'spark', base: 480, income: .32, fee: .08 },
];
export const VENUES = [
  { id: 'bedroom', name: 'Квартирник', subtitle: 'СВОИ ЛЮДИ, ПЕРВЫЙ СЕТ', fans: 0, fee: 160, gain: 18, bpm: 112, color: '#bcf77b', emoji: '⌂', tag: 'Начало пути', crowd: '12 друзей' },
  { id: 'rooftop', name: 'Крыша на закате', subtitle: 'ГОРОД СЛУШАЕТ', fans: 65, fee: 380, gain: 40, bpm: 118, color: '#ffba86', emoji: '☀', tag: 'Над городом', crowd: '80 гостей' },
  { id: 'basement', name: 'Подземка', subtitle: 'ТВОЙ ПЕРВЫЙ СОЛДАУТ', fans: 220, fee: 850, gain: 80, bpm: 124, color: '#b8a0ff', emoji: '◈', tag: 'Андерграунд', crowd: '250 гостей' },
  { id: 'club', name: 'Неоновый клуб', subtitle: 'ВЕСЬ ТАНЦПОЛ ТВОЙ', fans: 550, fee: 1900, gain: 155, bpm: 128, color: '#f49aca', emoji: '✦', tag: 'Ночная жизнь', crowd: '800 гостей' },
  { id: 'festival', name: 'AFTERHOURS Festival', subtitle: 'ИМЯ НА ГЛАВНОЙ СЦЕНЕ', fans: 1200, fee: 4500, gain: 280, bpm: 132, color: '#90c8ff', emoji: '✷', tag: 'Хедлайнер', crowd: '5 000 гостей' },
];
export const CREW = [
  { id: 'bar', name: 'Бар и лаунж', description: 'Место, где остаются после сета.', cost: 900, fans: 80, income: 2.5, icon: 'cup' },
  { id: 'promoter', name: 'Твой промоутер', description: 'Находит новых слушателей каждый день.', cost: 1800, fans: 220, income: 1, icon: 'people' },
  { id: 'label', name: 'Независимый лейбл', description: 'Твоя музыка выходит в мир.', cost: 4200, fans: 550, income: 8, icon: 'disc' },
];
export const QUESTS = [
  { id: 'track', name: 'Первый релиз', description: 'Запиши 16 лупов на пэдах', reward: 90, goal: 1, value: s => s.tracks },
  { id: 'show', name: 'За пультом', description: 'Сыграй свой первый сет', reward: 130, goal: 1, value: s => s.shows },
  { id: 'gear', name: 'Новый уровень звука', description: 'Купи 3 улучшения оборудования', reward: 250, goal: 3, value: s => Object.values(s.gear).reduce((a, b) => a + b, 0) },
  { id: 'fans', name: 'Своя аудитория', description: 'Собери 220 фанатов', reward: 500, goal: 220, value: s => Math.floor(s.fans) },
  { id: 'resident', name: 'Резидент', description: 'Сыграй 10 сетов', reward: 900, goal: 10, value: s => s.shows },
  { id: 'headline', name: 'Мечта сбылась', description: 'Выступи на AFTERHOURS Festival', reward: 3000, goal: 1, value: s => s.festivalShows },
];

export function freshState(now = Date.now()) {
  return { version: 1, cash: 180, earned: 180, fans: 0, tracks: 0, loops: 0, shows: 0, festivalShows: 0,
    bestAccuracy: 0, gear: { decks: 0, speakers: 0, studio: 0, lights: 0 }, crew: [], claimed: [],
    history: [], savedAt: now, settings: { volume: .45, sound: false, reducedMotion: false } };
}

function finite(value, fallback, max = 1e12) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : fallback;
}

export function parseSave(raw, now = Date.now()) {
  if (!raw || raw.version !== 1) throw new Error('Это не сохранение AFTERHOURS версии 1.');
  const state = freshState(now);
  for (const key of ['cash', 'earned', 'fans', 'tracks', 'shows', 'festivalShows']) state[key] = finite(raw[key], state[key]);
  for (const key of ['tracks', 'shows', 'festivalShows']) state[key] = Math.floor(state[key]);
  state.loops = Math.floor(finite(raw.loops, 0, 15));
  state.bestAccuracy = finite(raw.bestAccuracy, 0, 100);
  for (const item of GEAR) state.gear[item.id] = Math.floor(finite(raw.gear?.[item.id], 0, 10));
  state.crew = CREW.filter(item => Array.isArray(raw.crew) && raw.crew.includes(item.id)).map(item => item.id);
  state.claimed = QUESTS.filter(item => Array.isArray(raw.claimed) && raw.claimed.includes(item.id)).map(item => item.id);
  state.savedAt = Math.min(finite(raw.savedAt, now, Number.MAX_SAFE_INTEGER), now);
  state.settings = { volume: finite(raw.settings?.volume, .45, 1), sound: raw.settings?.sound === true, reducedMotion: raw.settings?.reducedMotion === true };
  state.history = Array.isArray(raw.history) ? raw.history.slice(0, 8).filter(x => VENUES.some(v => v.id === x.venue)).map(x => ({
    venue: x.venue, fee: finite(x.fee, 0), fans: finite(x.fans, 0), accuracy: finite(x.accuracy, 0, 100), time: finite(x.time, now, Number.MAX_SAFE_INTEGER),
  })) : [];
  return state;
}

export function incomePerSecond(state) {
  return .35 + state.fans * .006 + state.tracks * .12
    + GEAR.reduce((sum, gear) => sum + state.gear[gear.id] * gear.income, 0)
    + CREW.reduce((sum, member) => sum + (state.crew.includes(member.id) ? member.income : 0), 0);
}

export function addCash(state, value) { state.cash += value; state.earned += value; }
export function advance(state, seconds) {
  const dt = Math.max(0, Math.min(seconds, MAX_OFFLINE));
  const income = incomePerSecond(state) * dt;
  addCash(state, income);
  if (state.crew.includes('promoter')) state.fans += dt * .035;
  return income;
}

export function gearCost(state, id) {
  const item = GEAR.find(g => g.id === id);
  return item ? Math.round(item.base * 1.72 ** state.gear[id]) : Infinity;
}
export function buyGear(state, id) {
  if (!GEAR.some(g => g.id === id) || state.gear[id] >= 10) return false;
  const cost = gearCost(state, id);
  if (state.cash < cost) return false;
  state.cash -= cost;
  state.gear[id]++;
  return true;
}
export function buyCrew(state, id) {
  const item = CREW.find(c => c.id === id);
  if (!item || state.crew.includes(id) || state.fans < item.fans || state.cash < item.cost) return false;
  state.cash -= item.cost;
  state.crew.push(id);
  return true;
}
export function recordLoop(state) {
  state.loops++;
  addCash(state, 2);
  if (state.loops < 16) return false;
  state.loops = 0;
  state.tracks++;
  state.fans += 5;
  addCash(state, 40);
  return true;
}
export function feeMultiplier(state) {
  return 1 + GEAR.reduce((sum, item) => sum + state.gear[item.id] * item.fee, 0);
}
export function finishGig(state, id, accuracy, now = Date.now()) {
  const venue = VENUES.find(v => v.id === id);
  if (!venue || state.fans < venue.fans) return null;
  const quality = finite(accuracy, 0, 1);
  const fee = Math.round(venue.fee * (.6 + quality * .8) * feeMultiplier(state));
  const fans = Math.round(venue.gain * (.6 + quality) * (1 + state.gear.lights * .12));
  addCash(state, fee);
  state.fans += fans;
  state.shows++;
  if (id === 'festival') state.festivalShows++;
  state.bestAccuracy = Math.max(state.bestAccuracy, Math.round(quality * 100));
  const result = { venue: id, fee, fans, accuracy: Math.round(quality * 100), time: now };
  state.history.unshift(result);
  state.history = state.history.slice(0, 8);
  return result;
}
export function claimQuest(state, id) {
  const quest = QUESTS.find(q => q.id === id);
  if (!quest || state.claimed.includes(id) || quest.value(state) < quest.goal) return false;
  state.claimed.push(id);
  addCash(state, quest.reward);
  return true;
}
export function nextVenue(state) { return VENUES.find(v => state.fans < v.fans); }

// A beat can be scored once. Audio and visuals share the same monotonic clock.
export function judgeBeat(elapsed, beatInterval, count, scored, offset = 1) {
  const index = Math.round((elapsed - offset) / beatInterval);
  if (index < 0 || index >= count || scored.has(index)) return null;
  const distance = Math.abs(elapsed - (offset + index * beatInterval));
  if (distance > .21) return null;
  const quality = distance <= .075 ? 1 : distance <= .145 ? .7 : .4;
  scored.add(index);
  return { index, quality, label: quality === 1 ? 'Идеально!' : quality === .7 ? 'В ритме' : 'Почти' };
}
