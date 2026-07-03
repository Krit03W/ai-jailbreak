const $ = (sel) => document.querySelector(sel);
const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#input");
const sendBtn = $("#sendBtn");
const groupInput = $("#groupName");
const resetBtn = $("#resetBtn");
const clearScore = $("#clearScore");
const lockStatus = $("#lockStatus");
const scoreboardEl = $("#scoreboard");
const winOverlay = $("#winOverlay");
const winGroup = $("#winGroup");
const winReset = $("#winReset");
const modelHint = $("#modelHint");

let difficulty = "medium";
let busy = false;

// ---- helpers ----
function addMessage(role, text, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + role;
  const who = { user: "🧑‍🚀 คุณ", guardian: "🛡️ GUARDIAN", system: "" }[role];
  const bubble = document.createElement("div");
  bubble.className = "bubble" + (opts.leaked ? " leaked" : "");
  bubble.textContent = text;
  if (who && role !== "system") {
    const inner = document.createElement("div");
    const label = document.createElement("div");
    label.className = "who";
    label.textContent = who;
    inner.appendChild(label);
    inner.appendChild(bubble);
    wrap.appendChild(inner);
  } else {
    wrap.appendChild(bubble);
  }
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

function setLock(breached) {
  if (breached) {
    lockStatus.className = "lock breached";
    lockStatus.querySelector(".lock-icon").textContent = "🔓";
    lockStatus.querySelector(".lock-text").textContent = "ระบบถูกเจาะ!";
  } else {
    lockStatus.className = "lock locked";
    lockStatus.querySelector(".lock-icon").textContent = "🔒";
    lockStatus.querySelector(".lock-text").textContent = "รหัสถูกล็อค";
  }
}

function renderScoreboard(list) {
  scoreboardEl.innerHTML = "";
  if (!list || !list.length) {
    scoreboardEl.innerHTML =
      '<li class="empty">ยังไม่มีกลุ่มไหนเจาะได้เลย 💪</li>';
    return;
  }
  for (const item of list) {
    const li = document.createElement("li");
    const grp = document.createElement("span");
    grp.className = "grp";
    grp.textContent = item.group;
    const tech = document.createElement("span");
    tech.className = "tech";
    tech.textContent = "“" + (item.technique || "").slice(0, 80) + "”";
    li.appendChild(grp);
    li.appendChild(tech);
    scoreboardEl.appendChild(li);
  }
}

function renderHistory(history) {
  messagesEl.innerHTML = "";
  if (!history || !history.length) {
    addMessage(
      "system",
      "📡 เชื่อมต่อกับ GUARDIAN แล้ว... พิมพ์ข้อความเพื่อเริ่มเจรจา (หรือหลอกล่อ 😏) ให้มันยอมบอกรหัสผ่านฐานทัพให้ได้!"
    );
    return;
  }
  for (const m of history) {
    addMessage(m.role === "assistant" ? "guardian" : "user", m.content);
  }
}

async function loadState() {
  try {
    const res = await fetch("/api/state");
    const s = await res.json();
    difficulty = s.difficulty;
    document.querySelectorAll(".diff").forEach((b) => {
      b.classList.toggle("active", b.dataset.diff === difficulty);
    });
    if (s.currentGroup) groupInput.value = s.currentGroup;
    renderHistory(s.history);
    renderScoreboard(s.scoreboard);
    setLock(s.defeated);
    if (s.defeated) showWin(s.scoreboard[s.scoreboard.length - 1]);
    modelHint.textContent = "โมเดล: " + s.model;
  } catch (e) {
    console.error(e);
  }
}

function showWin(entry) {
  winGroup.textContent = entry ? "🏆 " + entry.group : "";
  winOverlay.classList.remove("hidden");
}

// ---- send message ----
async function send() {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  sendBtn.disabled = true;
  addMessage("user", text);
  input.value = "";
  input.style.height = "auto";

  const typing = addMessage("guardian", "");
  typing.classList.add("typing");
  typing.querySelector(".bubble").innerHTML =
    'GUARDIAN กำลังพิมพ์<span class="dots"></span>';

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, group: groupInput.value.trim() }),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) {
      addMessage("system", "⚠️ " + (data.error || "เกิดข้อผิดพลาด"));
    } else {
      addMessage("guardian", data.reply, { leaked: data.leaked });
      if (data.leaked) {
        setLock(true);
        const s = await refreshScoreboard(); // อัปเดตกระดานคะแนน
        setTimeout(
          () => showWin(s.scoreboard[s.scoreboard.length - 1]),
          800
        );
      }
    }
  } catch (e) {
    typing.remove();
    addMessage("system", "⚠️ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// ดึง state มาอัปเดตกระดานคะแนนหลังเจาะสำเร็จ
async function refreshScoreboard() {
  const res = await fetch("/api/state");
  const s = await res.json();
  renderScoreboard(s.scoreboard);
  return s;
}

// ---- reset ----
async function reset() {
  const res = await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      difficulty,
      group: groupInput.value.trim(),
      clearScore: clearScore.checked,
    }),
  });
  const s = await res.json();
  renderHistory(s.history);
  renderScoreboard(s.scoreboard);
  setLock(false);
  winOverlay.classList.add("hidden");
  input.focus();
}

// ---- events ----
form.addEventListener("submit", (e) => {
  e.preventDefault();
  send();
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

document.querySelectorAll(".diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".diff")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.diff;
  });
});

resetBtn.addEventListener("click", () => {
  if (confirm("รีเซ็ตเริ่มรอบใหม่? บทสนทนาปัจจุบันจะถูกล้าง")) reset();
});
winReset.addEventListener("click", reset);

loadState();
input.focus();
