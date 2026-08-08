/* =========================================================
   管理者モード（クライアント側のみ）
   注意: これは「本当のサーバー権限」ではなく、
   ブラウザ内でJSONを編集・書き出すための補助ツール。
   キーは誰でもソースコードから読める前提で設計している。
   ========================================================= */

const ADMIN_KEY = "fushigi-love-2026"; // 本気の秘密ではない。運用時は変更してください。
const DRAFT_KEY = "love_game_admin_draft_v1";

let baseQuestions = [];
let draft = loadDraft();
let editingId = null;

document.getElementById("enterBtn").addEventListener("click", async () => {
  const val = document.getElementById("keyInput").value.trim();
  if (val !== ADMIN_KEY) {
    alert("キーが違います。");
    return;
  }
  document.getElementById("gate").style.display = "none";
  document.getElementById("panel").style.display = "";
  baseQuestions = await fetch("questions.json").then(r => r.json());
  renderList();
  resetForm();
  runValidation(false);
});

document.getElementById("addChoiceBtn").addEventListener("click", () => addChoiceRow());
document.getElementById("clearBtn").addEventListener("click", resetForm);
document.getElementById("saveBtn").addEventListener("click", saveQuestion);
document.getElementById("exportBtn").addEventListener("click", exportJson);
document.getElementById("validateBtn").addEventListener("click", () => runValidation(true));

/* =========================================================
   JSONバリデーション
   ・idの存在／重複チェック
   ・level / category / question の存在チェック
   ・choicesが必ず5個で、A〜Eが揃っているか
   ・text / attributes.love(数値) / comment の存在チェック
   ========================================================= */
function validateQuestions(list) {
  const errors = []; // { id, messages: [] }
  const seenIds = new Set();

  list.forEach((q, idx) => {
    const msgs = [];
    const label = (q && q.id !== undefined) ? `#${q.id}` : `(${idx + 1}番目・IDなし)`;

    if (q.id === undefined || q.id === null || q.id === "") msgs.push("idがありません");
    else if (seenIds.has(q.id)) msgs.push(`idが重複しています（${q.id}）`);
    else seenIds.add(q.id);

    if (q.level === undefined || q.level === null) msgs.push("levelがありません");
    if (!q.category) msgs.push("categoryがありません");
    if (!q.question) msgs.push("questionがありません");

    if (!Array.isArray(q.choices)) {
      msgs.push("choicesが配列ではありません");
    } else {
      if (q.choices.length !== 5) msgs.push(`選択肢が5個ではありません（現在${q.choices.length}個）`);
      const expectedLetters = ["A", "B", "C", "D", "E"];
      q.choices.forEach((c, i) => {
        const pos = expectedLetters[i] || `${i + 1}番目`;
        if (i < 5 && c.id !== expectedLetters[i]) msgs.push(`${pos}番目の選択肢のidが「${expectedLetters[i]}」になっていません（実際: ${c.id}）`);
        if (!c.text) msgs.push(`選択肢${c.id || pos}のtextがありません`);
        if (!c.attributes || typeof c.attributes.love !== "number") msgs.push(`選択肢${c.id || pos}のattributes.loveが数値ではありません`);
        if (!c.comment) msgs.push(`選択肢${c.id || pos}のcommentがありません`);
      });
    }

    if (msgs.length) errors.push({ id: label, messages: msgs });
  });

  return { valid: errors.length === 0, errors, total: list.length };
}

function runValidation(showAlert) {
  const result = validateQuestions(mergedQuestions());
  const box = document.getElementById("validateResult");
  if (result.valid) {
    box.innerHTML = `<p style="color:#9ee6b0">✓ 全${result.total}問、問題は見つかりませんでした（5択・必須項目・ID重複すべてOK）。</p>`;
  } else {
    let html = `<p style="color:#ffb4a2">✕ ${result.errors.length}件の問題があります（全${result.total}問中）</p>`;
    result.errors.forEach(e => {
      html += `<p style="margin-top:6px"><b>${e.id}</b><br>${e.messages.map(m => "・" + escapeHtml(m)).join("<br>")}</p>`;
    });
    box.innerHTML = html;
  }
  return result;
}


function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function mergedQuestions() {
  const map = new Map();
  baseQuestions.forEach(q => map.set(q.id, q));
  Object.values(draft).forEach(q => map.set(q.id, q)); // draft が上書き・追加
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

function renderList() {
  const all = mergedQuestions();
  document.getElementById("countLabel").textContent = `全 ${all.length} 問（うち下書き ${Object.keys(draft).length} 件）`;
  const list = document.getElementById("list");
  list.innerHTML = "";
  all.forEach(q => {
    const row = document.createElement("div");
    row.className = "q-item";
    row.innerHTML = `
      <span>#${q.id} [Lv${q.level}] ${escapeHtml(q.category)} — ${escapeHtml(truncate(q.question, 24))}</span>
      <span>
        <button data-act="edit" data-id="${q.id}">編集</button>
        <button data-act="del" data-id="${q.id}">削除</button>
      </span>`;
    list.appendChild(row);
  });
  list.querySelectorAll("button[data-act='edit']").forEach(b =>
    b.addEventListener("click", () => loadIntoForm(Number(b.dataset.id))));
  list.querySelectorAll("button[data-act='del']").forEach(b =>
    b.addEventListener("click", () => deleteQuestion(Number(b.dataset.id))));
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }

function resetForm() {
  editingId = null;
  document.getElementById("formTitle").textContent = "新しい設問を追加";
  document.getElementById("fId").value = "";
  document.getElementById("fLevel").value = 1;
  document.getElementById("fCategory").value = "";
  document.getElementById("fQuestion").value = "";
  document.getElementById("choicesWrap").innerHTML = "";
  ["A", "B", "C", "D", "E"].forEach(l => addChoiceRow(l));
}

function addChoiceRow(letter, text = "", love = 0, comment = "") {
  const wrap = document.getElementById("choicesWrap");
  const div = document.createElement("div");
  div.className = "choice-block";
  div.innerHTML = `
    <div class="row">
      <div><label>記号</label><input class="c-id" value="${letter || String.fromCharCode(65 + wrap.children.length)}"></div>
      <div><label>愛のポイント</label><input class="c-love" type="number" value="${love}"></div>
    </div>
    <label>選択肢テキスト</label>
    <input class="c-text" value="${escapeAttr(text)}">
    <label>コメント（選択後に表示）</label>
    <textarea class="c-comment">${escapeHtml(comment)}</textarea>
    <button type="button" class="ghost-btn" style="margin-top:6px" data-remove>この選択肢を削除</button>
  `;
  div.querySelector("[data-remove]").addEventListener("click", () => div.remove());
  wrap.appendChild(div);
}

function loadIntoForm(id) {
  const q = mergedQuestions().find(x => x.id === id);
  if (!q) return;
  editingId = id;
  document.getElementById("formTitle").textContent = `#${id} を編集`;
  document.getElementById("fId").value = q.id;
  document.getElementById("fLevel").value = q.level;
  document.getElementById("fCategory").value = q.category;
  document.getElementById("fQuestion").value = q.question;
  document.getElementById("choicesWrap").innerHTML = "";
  q.choices.forEach(c => addChoiceRow(c.id, c.text, (c.attributes && c.attributes.love) || 0, c.comment));
  window.scrollTo({ top: document.querySelector(".admin-card:nth-of-type(2)").offsetTop - 10, behavior: "smooth" });
}

function deleteQuestion(id) {
  if (!confirm(`#${id} を削除しますか？（この操作は下書きに反映されます）`)) return;
  // 元データにある場合は「削除済み」として空マークするより、単純にdraftへ tombstone を置く
  const all = mergedQuestions();
  const filtered = all.filter(q => q.id !== id);
  draft = {};
  filtered.forEach(q => draft[q.id] = q);
  // baseQuestions 側にあった分は draft で上書きされ、消えたものは export 時に filtered から再構築
  baseQuestions = filtered; // 表示上はこれで十分（書き出しは export 時に再計算）
  saveDraft();
  renderList();
}

function saveQuestion() {
  const idVal = document.getElementById("fId").value.trim();
  const all = mergedQuestions();
  const id = idVal ? Number(idVal) : (Math.max(0, ...all.map(q => q.id)) + 1);

  const choices = Array.from(document.querySelectorAll("#choicesWrap .choice-block")).map(block => ({
    id: block.querySelector(".c-id").value.trim(),
    text: block.querySelector(".c-text").value.trim(),
    attributes: { love: Number(block.querySelector(".c-love").value) || 0 },
    comment: block.querySelector(".c-comment").value.trim()
  })).filter(c => c.text);

  if (!document.getElementById("fQuestion").value.trim() || choices.length === 0) {
    alert("問題文と、少なくとも1つの選択肢を入力してください。");
    return;
  }
  if (choices.length !== 5) {
    const proceed = confirm(`選択肢が${choices.length}個です。このゲームの設問は5択が基本方針です。このまま保存しますか？`);
    if (!proceed) return;
  }

  draft[id] = {
    id,
    level: Number(document.getElementById("fLevel").value) || 1,
    category: document.getElementById("fCategory").value.trim() || "未分類",
    question: document.getElementById("fQuestion").value.trim(),
    choices
  };
  saveDraft();
  renderList();
  resetForm();
}

function exportJson() {
  const result = runValidation(false);
  if (!result.valid) {
    const proceed = confirm(`検証で${result.errors.length}件の問題が見つかりました。このまま書き出しますか？\n（詳細は検証結果の欄をご確認ください）`);
    if (!proceed) return;
  }
  const all = mergedQuestions();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "questions.json";
  a.click();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) { return escapeHtml(str).replace(/"/g, "&quot;"); }
