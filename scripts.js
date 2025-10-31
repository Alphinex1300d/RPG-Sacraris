/* script.js - Clean mobile RPG panel
   - 100 pontos total
   - Level calculado por thresholds: lvl1 = 10, cada lvl +3, max lvl 25 (82 pts)
   - Autosave no localStorage (personagem + notepad)
   - Parallax simples (mobile friendly)
*/

const STORAGE_KEY = 'rpg_clean_v1';

// ----- Base character data -----
let character = {
  name: 'Herói',
  totalPoints: 100,
  allocated: 0, // soma de todos os pontos gastos em atributos+domínios
  attributes: {
    CON: { value: 0, name: 'Constituição', desc: '+5 HP por ponto' },
    INT: { value: 0, name: 'Inteligência', desc: '+5 MP a cada 2 pontos' },
    ATL: { value: 0, name: 'Atletismo', desc: '+4 Estamina a cada 2 pontos' },
    RES: { value: 0, name: 'Resiliência', desc: '+5 Estresse a cada 10 pontos' }
  },
  domains: {
    FOR: { value: 0, name: 'Força' },
    PRE: { value: 0, name: 'Precisão' },
    DES: { value: 0, name: 'Destreza' },
    RESI: { value: 0, name: 'Resistência' },
    ACR: { value: 0, name: 'Acrobacia' },
    SOB: { value: 0, name: 'Sobrevivência' },
    PER: { value: 0, name: 'Percepção' },
    ARC: { value: 0, name: 'Arcano' },
    CAR: { value: 0, name: 'Carisma' },
    FE:  { value: 0, name: 'Fé' }
  },
  resources: {
    hp: { current: 20, max: 20 },
    mp: { current: 15, max: 15 },
    stamina: { current: 15, max: 15 },
    stress: { current: 0, max: 30 }
  },
  notepad: ''
};

// ----- Level thresholds (level -> required points) -----
const LEVEL_MAX = 25;
function pointsForLevel(level) {
  // level 1 -> 10, level 2 -> 13, level 3 -> 16, ...
  return 10 + (level - 1) * 3;
}

// compute current level from allocated points (capped to level max)
function computeLevelFromAllocated(pts) {
  let lvl = 1;
  for (let L = 1; L <= LEVEL_MAX; L++) {
    if (pts >= pointsForLevel(L)) lvl = L;
    else break;
  }
  return lvl;
}

// compute next threshold or max threshold (for progress bar)
const MAX_THRESHOLD = pointsForLevel(LEVEL_MAX); // 82

// ----- DOM elements -----
const el = {
  name: document.getElementById('charName'),
  availablePoints: document.getElementById('availablePoints'),
  levelDisplay: document.getElementById('levelDisplay'),
  levelBar: document.getElementById('levelBar'),
  levelInfo: document.getElementById('levelInfo'),
  hpText: document.getElementById('hpText'),
  mpText: document.getElementById('mpText'),
  stText: document.getElementById('stText'),
  esText: document.getElementById('esText'),
  hpBar: document.getElementById('hpBar'),
  mpBar: document.getElementById('mpBar'),
  stBar: document.getElementById('stBar'),
  esBar: document.getElementById('esBar'),
  attributesGrid: document.getElementById('attributesGrid'),
  domainsGrid: document.getElementById('domainsGrid'),
  notepad: document.getElementById('notepad'),
  resetBtn: document.getElementById('resetBtn')
};

// ----- Init/render -----
function init() {
  loadFromStorage();
  renderAll();
  attachEvents();
  requestAnimationFrame(parallaxTick);
}

function renderAll() {
  el.name.value = character.name;
  updateAllocatedAndUI();
  renderResources();
  renderAttributes();
  renderDomains();
  el.notepad.value = character.notepad || '';
}

// update available points, level, and level bar
function updateAllocatedAndUI() {
  // recalc allocated
  let alloc = 0;
  for (const a of Object.values(character.attributes)) alloc += a.value;
  for (const d of Object.values(character.domains)) alloc += d.value;
  character.allocated = alloc;

  const available = Math.max(0, character.totalPoints - character.allocated);
  el.availablePoints.textContent = available;

  // level
  const lvl = computeLevelFromAllocated(character.allocated);
  el.levelDisplay.textContent = lvl;

  // progress towards next level (or fraction of max)
  const currentThreshold = pointsForLevel(lvl);
  const nextThreshold = Math.min(MAX_THRESHOLD, pointsForLevel(Math.min(LEVEL_MAX, lvl + 1)));
  // when at max level, show full
  let pct = 0;
  if (lvl >= LEVEL_MAX) pct = 100;
  else {
    const denom = nextThreshold - currentThreshold || 1;
    const progress = Math.min(character.allocated - currentThreshold, denom);
    pct = Math.max(0, Math.round((progress / denom) * 100));
  }
  el.levelBar.style.width = pct + '%';

  el.levelInfo.textContent = `Gasto: ${character.allocated} / ${MAX_THRESHOLD} pts (lvl max: ${LEVEL_MAX})`;

  autosave();
}

// render resource values & bars
function renderResources() {
  const r = character.resources;
  el.hpText.textContent = `${r.hp.current} / ${r.hp.max}`;
  el.mpText.textContent = `${r.mp.current} / ${r.mp.max}`;
  el.stText.textContent = `${r.stamina.current} / ${r.stamina.max}`;
  el.esText.textContent = `${r.stress.current} / ${r.stress.max}`;

  el.hpBar.style.width = `${Math.round((r.hp.current / Math.max(1, r.hp.max)) * 100)}%`;
  el.mpBar.style.width = `${Math.round((r.mp.current / Math.max(1, r.mp.max)) * 100)}%`;
  el.stBar.style.width = `${Math.round((r.stamina.current / Math.max(1, r.stamina.max)) * 100)}%`;
  el.esBar.style.width = `${Math.round((r.stress.current / Math.max(1, r.stress.max)) * 100)}%`;
}

// attributes UI
function renderAttributes() {
  el.attributesGrid.innerHTML = '';
  for (const [key, attr] of Object.entries(character.attributes)) {
    const elCard = document.createElement('div');
    elCard.className = 'statCard';
    elCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">${attr.name}</div>
          <div class="statDesc">${attr.desc}</div>
        </div>
        <div style="text-align:right">
          <div class="statValue">${attr.value}</div>
          <div style="margin-top:6px">
            <button class="btn tiny" data-type="attr" data-key="${key}" data-change="-1">-</button>
            <button class="btn tiny" data-type="attr" data-key="${key}" data-change="1">+</button>
          </div>
        </div>
      </div>
    `;
    el.attributesGrid.appendChild(elCard);
  }
}

// domains UI
function renderDomains() {
  el.domainsGrid.innerHTML = '';
  for (const [key, dom] of Object.entries(character.domains)) {
    const elCard = document.createElement('div');
    elCard.className = 'statCard';
    elCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">${dom.name}</div>
          <div class="statDesc">Bônus por 5 pts: +${Math.floor(dom.value/5)}</div>
        </div>
        <div style="text-align:right">
          <div class="statValue">${dom.value}</div>
          <div style="margin-top:6px">
            <button class="btn tiny" data-type="dom" data-key="${key}" data-change="-1">-</button>
            <button class="btn tiny" data-type="dom" data-key="${key}" data-change="1">+</button>
          </div>
        </div>
      </div>
    `;
    el.domainsGrid.appendChild(elCard);
  }
}

// ----- attribute/domain change handling -----
function changeStat(kind, key, delta) {
  // delta is ±1
  delta = Number(delta);
  if (delta === 0) return;

  // compute available points
  const available = character.totalPoints - character.allocated;
  if (delta > 0 && available <= 0) return; // sem pontos

  // target object
  const target = (kind === 'attr') ? character.attributes[key] : character.domains[key];
  if (!target) return;

  if (delta < 0 && target.value <= 0) return;

  target.value = Math.max(0, target.value + delta);
  updateResourcesFromAttributes();
  renderAll();
}

// ----- resources controls (hp/mp/st/stress) -----
function applyResource(action, value) {
  const r = character.resources;
  switch (action) {
    case 'hp':
      if (value === 'max') r.hp.current = r.hp.max;
      else r.hp.current = clamp(r.hp.current + Number(value), 0, r.hp.max);
      break;
    case 'mp':
      if (value === 'max') r.mp.current = r.mp.max;
      else r.mp.current = clamp(r.mp.current + Number(value), 0, r.mp.max);
      break;
    case 'st':
      if (value === 'max') r.stamina.current = r.stamina.max;
      else r.stamina.current = clamp(r.stamina.current + Number(value), 0, r.stamina.max);
      break;
    case 'es':
      if (value === 'reset') r.stress.current = 0;
      else r.stress.current = clamp(r.stress.current + Number(value), 0, r.stress.max);
      break;
  }
  renderResources();
  autosave();
}

// ----- update resource maxima from attributes -----
function updateResourcesFromAttributes() {
  const con = character.attributes.CON.value;
  const intel = character.attributes.INT.value;
  const atl = character.attributes.ATL.value;
  const res = character.attributes.RES.value;

  // recalcula máximos
  character.resources.hp.max = 20 + (con * 5);
  character.resources.mp.max = 15 + (Math.floor(intel / 2) * 5);
  character.resources.stamina.max = 15 + (Math.floor(atl / 2) * 4);
  character.resources.stress.max = 30 + (Math.floor(res / 10) * 5);

  // ajusta atuais sem exceder
  character.resources.hp.current = Math.min(character.resources.hp.current, character.resources.hp.max);
  character.resources.mp.current = Math.min(character.resources.mp.current, character.resources.mp.max);
  character.resources.stamina.current = Math.min(character.resources.stamina.current, character.resources.stamina.max);
  character.resources.stress.current = Math.min(character.resources.stress.current, character.resources.stress.max);
}

// ----- helpers -----
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// ----- autosave & load -----
let saveTimer = null;
function autosave() {
  // small debounce
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    } catch(e){ /* ignore */ }
  }, 200);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // basic merge to keep defaults
      character = Object.assign(character, data);
      // ensure nested objects exist (simple merge)
      character.attributes = Object.assign(character.attributes, data.attributes || {});
      character.domains = Object.assign(character.domains, data.domains || {});
      character.resources = Object.assign(character.resources, data.resources || character.resources);
      character.notepad = data.notepad || character.notepad;
    }
  } catch(e){ /* ignore */ }
}

// ----- events -----
function attachEvents() {
  // name change
  el.name.addEventListener('input', (e) => {
    character.name = e.target.value;
    autosave();
  });

  // delegate attribute/domain buttons
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-type], button[data-action]');
    if (!btn) return;

    if (btn.dataset.type === 'attr' || btn.dataset.type === 'dom') {
      const kind = btn.dataset.type;
      const key = btn.dataset.key;
      const change = Number(btn.dataset.change);
      changeStat(kind, key, change);
      return;
    }

    if (btn.dataset.action) {
      const action = btn.dataset.action;
      const val = btn.dataset.value;
      applyResource(action, val);
      return;
    }
  });

  // notepad autosave
  el.notepad.addEventListener('input', (e) => {
    character.notepad = e.target.value;
    autosave();
  });

  // reset button
  el.resetBtn.addEventListener('click', () => {
    if (!confirm('Resetar personagem para padrão?')) return;
    resetCharacter();
  });

  // parallax touch/scroll
  window.addEventListener('scroll', () => { /* handled in RAF loop */ }, {passive:true});
}

// reset
function resetCharacter() {
  character = {
    name: 'Herói',
    totalPoints: 100,
    allocated: 0,
    attributes: {
      CON: { value: 0, name: 'Constituição', desc: '+5 HP por ponto' },
      INT: { value: 0, name: 'Inteligência', desc: '+5 MP a cada 2 pontos' },
      ATL: { value: 0, name: 'Atletismo', desc: '+4 Estamina a cada 2 pontos' },
      RES: { value: 0, name: 'Resiliência', desc: '+5 Estresse a cada 10 pontos' }
    },
    domains: {
      FOR: { value: 0, name: 'Força' },
      PRE: { value: 0, name: 'Precisão' },
      DES: { value: 0, name: 'Destreza' },
      RESI: { value: 0, name: 'Resistência' },
      ACR: { value: 0, name: 'Acrobacia' },
      SOB: { value: 0, name: 'Sobrevivência' },
      PER: { value: 0, name: 'Percepção' },
      ARC: { value: 0, name: 'Arcano' },
      CAR: { value: 0, name: 'Carisma' },
      FE:  { value: 0, name: 'Fé' }
    },
    resources: {
      hp: { current: 20, max: 20 },
      mp: { current: 15, max: 15 },
      stamina: { current: 15, max: 15 },
      stress: { current: 0, max: 30 }
    },
    notepad: ''
  };
  renderAll();
  autosave();
}

// ----- parallax (simple, mobile-friendly) -----
const layers = [...document.querySelectorAll('#parallax .layer')];
function parallaxTick() {
  const y = window.scrollY || window.pageYOffset;
  // modest transform for mobile performance
  layers.forEach(layer => {
    const speed = parseFloat(layer.dataset.speed) || 0.3;
    layer.style.transform = `translate3d(0, ${-y * speed}px, 0)`;
  });
  requestAnimationFrame(parallaxTick);
}

// init
init();
