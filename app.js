/* =========================================================
   愛を育てるゲーム — ゲームエンジン
   このファイルには「設問」や「宇宙どうぶつの種族データ」を書き込まない。
   すべて questions.json / evolution.json / rivals.json /
   species.json / traits.json から読み込む。
   ========================================================= */

const CONFIG = {
  questionFiles: ["questions.json"],
  evolutionFile: "evolution.json",
  rivalsFile: "rivals.json",
  speciesFile: "species.json",
  traitsFile: "traits.json",
  rivalNamesFile: "rival-names.json",
  proceduralRivalInterval: 6, // 固定ライバルを使い切った後、何問ごとに新しい相手が現れるか
  storageKey: "love_game_state_v2"
};

const state = {
  speciesId: null,
  total: 0,              // 13番目の指標＝愛のパワー
  ego: {},                // 12の地球人ぽい指標（key -> value）
  attributes: {},         // 選択肢の attributes を積算した生ログ（将来の拡張用）
  answeredIds: [],
  answeredCount: 0,
  seenRivals: []
};

let QUESTIONS = [];
let EVOLUTION = [];
let RIVALS = [];
let SPECIES = [];
let TRAITS = null;
let RIVAL_NAMES = null;
let MAX_LOVE = 100; // questions.json から算出する理論上の最大値

init();

async function init() {
  loadState();

  try {
    const qLists = await Promise.all(CONFIG.questionFiles.map(f => fetch(f).then(r => r.json())));
    const map = new Map();
    qLists.flat().forEach(q => map.set(q.id, q));
    QUESTIONS = Array.from(map.values()).sort((a, b) => a.id - b.id);
    MAX_LOVE = QUESTIONS.reduce((sum, q) => sum + Math.max(...q.choices.map(c => (c.attributes && c.attributes.love) || 0)), 0) || 100;

    EVOLUTION = (await fetch(CONFIG.evolutionFile).then(r => r.json())).sort((a, b) => a.min - b.min);
    RIVALS = (await fetch(CONFIG.rivalsFile).then(r => r.json())).sort((a, b) => a.afterQuestions - b.afterQuestions);
    SPECIES = await fetch(CONFIG.speciesFile).then(r => r.json());
    TRAITS = await fetch(CONFIG.traitsFile).then(r => r.json());
    RIVAL_NAMES = await fetch(CONFIG.rivalNamesFile).then(r => r.json());

    if (Object.keys(state.ego).length === 0) {
      TRAITS.egoTraits.forEach(t => (state.ego[t.key] = TRAITS.initialEgoValue));
    }
  } catch (e) {
    document.getElementById("questionText").textContent =
      "データの読み込みに失敗しました。サーバー経由（http://〜）で開いているかご確認ください。";
    console.error(e);
    return;
  }

  if (!state.speciesId) {
    renderSpeciesSelect();
  } else {
    startGame();
  }
}

/* ---------------- 状態管理 ---------------- */
function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) { /* 無視 */ }
}
function saveState() {
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch (e) {}
}

/* ---------------- 宇宙どうぶつ 選択 ---------------- */
function renderSpeciesSelect() {
  document.getElementById("selectScreen").style.display = "";
  document.getElementById("gameScreen").style.display = "none";

  const grid = document.getElementById("speciesGrid");
  grid.innerHTML = "";
  SPECIES.forEach(sp => {
    const card = document.createElement("button");
    card.className = "species-card";
    card.innerHTML = `
      <div class="species-preview" id="preview-${sp.id}"></div>
      <span class="species-name">${escapeHtml(sp.name)}</span>
      <span class="species-note">${escapeHtml(sp.personality)}</span>
    `;
    card.addEventListener("click", () => chooseSpecies(sp.id));
    grid.appendChild(card);

    // 選択画面ではまだ「とてもシンプルな姿」（進化ステージ0）だけを見せる
    document.getElementById(`preview-${sp.id}`).innerHTML = generateCreatureSVG({
      targetParts: sp.parts, stageIndex: 0, stageCount: EVOLUTION.length, idPrefix: `pv${sp.id}`
    });
  });
}

function chooseSpecies(id) {
  state.speciesId = id;
  saveState();
  startGame();
}

function startGame() {
  document.getElementById("selectScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "";
  renderStage();
  renderNextQuestion();
}

function getSpecies() {
  return SPECIES.find(s => s.id === state.speciesId) || SPECIES[0];
}

/* ---------------- 進化ステージ & 宇宙どうぶつ描画 ---------------- */
function currentStage() {
  let stage = EVOLUTION[0];
  for (const s of EVOLUTION) { if (state.total >= s.min) stage = s; else break; }
  return stage;
}

function renderStage() {
  const stage = currentStage();
  document.getElementById("stageName").textContent = stage.name;
  document.getElementById("stageDesc").textContent = stage.desc;
  document.getElementById("loveTotal").textContent = state.total;

  const sp = getSpecies();
  const stageIndex = EVOLUTION.indexOf(stage);
  document.getElementById("creatureMount").innerHTML = generateCreatureSVG({
    targetParts: sp.parts,
    stageIndex,
    stageCount: EVOLUTION.length,
    idPrefix: "main"
  });
  document.getElementById("creatureName").textContent =
    stageIndex >= EVOLUTION.length - 1 ? `${sp.name}` : `育っている宇宙どうぶつ（→ ${sp.name}）`;

  renderEgoPanel();
}

function renderEgoPanel() {
  const wrap = document.getElementById("egoPanel");
  wrap.innerHTML = "";
  TRAITS.egoTraits.forEach(t => {
    const val = Math.max(0, state.ego[t.key]);
    const pct = Math.min(100, (val / TRAITS.initialEgoValue) * 100);
    const row = document.createElement("div");
    row.className = "ego-row";
    row.innerHTML = `<span class="ego-label">${escapeHtml(t.label)}</span>
      <span class="ego-bar"><span style="width:${pct}%"></span></span>`;
    wrap.appendChild(row);
  });
}

/* ---------------- 設問の出題 ---------------- */
function nextUnanswered() { return QUESTIONS.find(q => !state.answeredIds.includes(q.id)); }

function renderNextQuestion() {
  updateProgress();
  const q = nextUnanswered();
  if (!q) { renderEnd(); return; }

  document.getElementById("questionCard").style.display = "";
  document.getElementById("questionCategory").textContent = `LEVEL ${q.level} ・ ${q.category}`;
  document.getElementById("questionText").textContent = q.question;

  const wrap = document.getElementById("choices");
  wrap.innerHTML = "";
  q.choices.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.innerHTML = `<span class="letter">${c.id}</span>${escapeHtml(c.text)}`;
    btn.addEventListener("click", () => answer(q, c));
    wrap.appendChild(btn);
  });
}

function updateProgress() {
  const total = QUESTIONS.length, done = state.answeredCount;
  document.getElementById("progressFill").style.width = total ? Math.min(100, (done / total) * 100) + "%" : "0%";
  document.getElementById("progressLabel").textContent = `${done} / ${total} 問`;
}

/* ---------------- 回答処理 ---------------- */
function answer(question, choice) {
  const beforeStage = currentStage();
  const delta = (choice.attributes && choice.attributes.love) || 0;

  state.total += delta;
  for (const [k, v] of Object.entries(choice.attributes || {})) {
    state.attributes[k] = (state.attributes[k] || 0) + v;
  }
  // 12の地球人ぽい指標は、愛が育つぶんだけ少しずつ小さくなっていく（簡易モデル）
  if (delta > 0) {
    const shrink = delta * 0.12;
    TRAITS.egoTraits.forEach(t => { state.ego[t.key] = Math.max(0, (state.ego[t.key] ?? TRAITS.initialEgoValue) - shrink); });
  }

  state.answeredIds.push(question.id);
  state.answeredCount += 1;
  saveState();

  const afterStage = currentStage();
  const evolved = afterStage !== beforeStage;

  showFeedback({ delta, comment: choice.comment, evolved, stage: afterStage }, () => {
    renderStage();
    const rival = nextRivalFor(state.answeredCount);
    if (rival) {
      state.seenRivals.push(rival.id);
      saveState();
      showRival(rival, () => renderNextQuestion());
    } else {
      renderNextQuestion();
    }
  });
}

/* 固定のライバルを使い切った後は、青天井（終わりのない）ライバルを毎回生成する。
   ドラゴンボールの「上には上がいる」の発想: 誰か一人を「最強」として固定しない。 */
function nextRivalFor(answeredCount) {
  const fixed = RIVALS.find(r => r.afterQuestions === answeredCount && !state.seenRivals.includes(r.id));
  if (fixed) return fixed;

  const lastFixed = RIVALS[RIVALS.length - 1];
  if (!lastFixed || answeredCount <= lastFixed.afterQuestions) return null;
  if ((answeredCount - lastFixed.afterQuestions) % CONFIG.proceduralRivalInterval !== 0) return null;

  const rng = makeRng(seedFrom("rival", state.speciesId, answeredCount, state.total));
  const name = pick(rng, RIVAL_NAMES.prefixes) + pick(rng, RIVAL_NAMES.suffixes);
  const multiplier = 1.15 + rng() * 0.5;
  const love = Math.max(state.total + 5, Math.round(state.total * multiplier));
  return {
    id: `proc-${answeredCount}`,
    name, love,
    message: "この道に終わりはありません。あなたより大きな愛を持つ存在は、これからも現れ続けます。"
  };
}

/* ---------------- フィードバック演出 ---------------- */
function showFeedback({ delta, comment, evolved, stage }, onClose) {
  const overlay = document.getElementById("feedbackOverlay");
  const card = document.getElementById("feedbackCard");
  card.innerHTML = `
    ${evolved ? `<p class="evolution-banner">✧ 進化しました ✧<br>${escapeHtml(stage.name)}</p>` : ""}
    <p class="feedback-delta">愛のパワー ${delta >= 0 ? "+" : ""}${delta} ❤</p>
    <p class="feedback-comment">${escapeHtml(comment || "")}</p>
    <button class="feedback-btn" id="feedbackNext">つづける</button>
  `;
  overlay.classList.add("show");
  document.getElementById("feedbackNext").addEventListener("click", () => {
    overlay.classList.remove("show");
    onClose();
  }, { once: true });
}

/* ---------------- ライバル（対戦相手）演出 ---------------- */
function showRival(rival, onClose) {
  const overlay = document.getElementById("feedbackOverlay");
  const card = document.getElementById("feedbackCard");
  card.innerHTML = `
    <p class="eyebrow" style="text-align:center">あなたより大きな愛を持つ存在</p>
    <p class="rival-name">${escapeHtml(rival.name)}</p>
    <div class="rival-compare">
      <span>あなたの愛<b>${state.total}</b></span>
      <span>${escapeHtml(rival.name)}の愛<b>${rival.love}</b></span>
    </div>
    <p class="feedback-comment">${escapeHtml(rival.message)}</p>
    <button class="feedback-btn" id="feedbackNext">もっと愛を育てる</button>
  `;
  overlay.classList.add("show");
  document.getElementById("feedbackNext").addEventListener("click", () => {
    overlay.classList.remove("show");
    onClose();
  }, { once: true });
}

/* ---------------- 終了 ---------------- */
function renderEnd() {
  const stage = currentStage();
  document.getElementById("questionCategory").textContent = "";
  document.getElementById("questionText").innerHTML =
    `今、あなたの愛は「<strong>${escapeHtml(stage.name)}</strong>」まで育ちました。<br><br>
     けれど、愛には天井がありません。今はここまでの問いを歩き終えましたが、
     新しい問いが追加されるたび、あなたよりさらに大きな愛を持つ存在に出会うたび、
     この物語はまだ先へ続いていきます。`;
  document.getElementById("choices").innerHTML = "";
}

/* ---------------- 疑似乱数（ライバル生成専用） ---------------- */
function seedFrom(...parts) {
  const str = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRng(seed) {
  let s = seed || 1;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967295;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/* ---------------- ユーティリティ ---------------- */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
