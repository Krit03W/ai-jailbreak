const $ = (sel) => document.querySelector(sel);

// views
const vaultListView = $("#vaultListView");
const chatView = $("#chatView");
const vaultGrid = $("#vaultGrid");
const groupInput = $("#groupName");

// chat
const messagesEl = $("#messages");
const form = $("#chatForm");
const input = $("#input");
const sendBtn = $("#sendBtn");
const backBtn = $("#backBtn");
const resetVaultBtn = $("#resetVaultBtn");
const chatVaultName = $("#chatVaultName");
const chatVaultDiff = $("#chatVaultDiff");

// win
const winOverlay = $("#winOverlay");
const winVault = $("#winVault");
const winGroup = $("#winGroup");
const winReset = $("#winReset");

// admin
const adminBtn = $("#adminBtn");
const adminModal = $("#adminModal");
const adminClose = $("#adminClose");
const adminLogin = $("#adminLogin");
const adminPanel = $("#adminPanel");
const adminPass = $("#adminPass");
const adminError = $("#adminError");
const adminLoginBtn = $("#adminLoginBtn");
const adminLogout = $("#adminLogout");
const adminVaults = $("#adminVaults");
const adminSave = $("#adminSave");
const adminSaved = $("#adminSaved");
const adminResetAll = $("#adminResetAll");

const DIFF_LABEL = { easy: "😀 ง่าย", medium: "😐 กลาง", hard: "😈 ยาก" };

let currentVaultId = null;
let busy = false;
let adminToken = localStorage.getItem("adminToken") || null;

// ===================== VAULT LIST =====================
async function loadVaults() {
  const res = await fetch("/api/vaults");
  const data = await res.json();
  renderVaultGrid(data.vaults);
}

function renderVaultGrid(list) {
  vaultGrid.innerHTML = "";
  for (const v of list) {
    const card = document.createElement("div");
    card.className = "vault-card" + (v.defeated ? " cracked" : "");
    card.innerHTML = `
      <span class="vault-id">#${String(v.id).padStart(2, "0")}</span>
      <div class="vault-icon">${v.defeated ? "🔓" : "🔒"}</div>
      <div class="vault-name">${escapeHtml(v.name)}</div>
      <span class="diff-badge ${v.difficulty}">${DIFF_LABEL[v.difficulty]}</span>
      <div class="vault-status ${v.defeated ? "breached" : "locked"}">
        ${v.defeated ? "🏆 ถูกเจาะแล้ว" : "🛡️ ยังปลอดภัย"}
      </div>
      ${
        v.defeated && v.crackedBy
          ? `<div class="vault-cracked-by">โดย: ${escapeHtml(v.crackedBy)}</div>`
          : ""
      }
    `;
    card.addEventListener("click", () => openVault(v.id));
    vaultGrid.appendChild(card);
  }
}

// ===================== CHAT =====================
async function openVault(id) {
  currentVaultId = id;
  const res = await fetch("/api/vault?id=" + id);
  if (!res.ok) return;
  const v = await res.json();
  chatVaultName.textContent = v.name;
  chatVaultDiff.textContent = DIFF_LABEL[v.difficulty];
  chatVaultDiff.className = "diff-badge " + v.difficulty;
  renderHistory(v.history);
  vaultListView.classList.add("hidden");
  chatView.classList.remove("hidden");
  if (v.defeated) {
    setTimeout(() => showWin(v), 300);
  }
  input.focus();
}

function backToList() {
  chatView.classList.add("hidden");
  vaultListView.classList.remove("hidden");
  winOverlay.classList.add("hidden");
  currentVaultId = null;
  loadVaults();
}

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

function renderHistory(history) {
  messagesEl.innerHTML = "";
  if (!history || !history.length) {
    addMessage(
      "system",
      "📡 เชื่อมต่อกับ GUARDIAN แล้ว... พิมพ์ข้อความเพื่อหลอกล่อให้มันบอกรหัสผ่านห้องนี้ให้ได้!"
    );
    return;
  }
  for (const m of history) {
    addMessage(m.role === "assistant" ? "guardian" : "user", m.content);
  }
}

async function send() {
  const text = input.value.trim();
  if (!text || busy || currentVaultId == null) return;
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
      body: JSON.stringify({
        vaultId: currentVaultId,
        message: text,
        group: groupInput.value.trim(),
      }),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) {
      addMessage("system", "⚠️ " + (data.error || "เกิดข้อผิดพลาด"));
    } else {
      addMessage("guardian", data.reply, { leaked: data.leaked });
      if (data.leaked) {
        const res2 = await fetch("/api/vault?id=" + currentVaultId);
        const v = await res2.json();
        setTimeout(() => showWin(v), 800);
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

async function resetVault() {
  if (currentVaultId == null) return;
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultId: currentVaultId }),
  });
  winOverlay.classList.add("hidden");
  renderHistory([]);
  input.focus();
}

function showWin(v) {
  winVault.textContent = "🔓 " + (v.name || "");
  winGroup.textContent = v.crackedBy ? "🏆 " + v.crackedBy : "";
  winOverlay.classList.remove("hidden");
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ===================== ADMIN =====================
function openAdmin() {
  adminModal.classList.remove("hidden");
  adminError.textContent = "";
  adminSaved.textContent = "";
  if (adminToken) {
    showAdminPanel();
  } else {
    adminLogin.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    adminPass.value = "";
    adminPass.focus();
  }
}

async function showAdminPanel() {
  const res = await fetch("/api/admin/vaults", {
    headers: { "x-admin-token": adminToken },
  });
  if (res.status === 401) {
    // token หมดอายุ (เซิร์ฟเวอร์รีสตาร์ท) — ให้ล็อกอินใหม่
    adminToken = null;
    localStorage.removeItem("adminToken");
    adminLogin.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    adminPass.focus();
    return;
  }
  const data = await res.json();
  renderAdminVaults(data.vaults);
  adminLogin.classList.add("hidden");
  adminPanel.classList.remove("hidden");
}

function renderAdminVaults(list) {
  adminVaults.innerHTML = "";
  for (const v of list) {
    const row = document.createElement("div");
    row.className = "admin-vault-row";
    row.dataset.id = v.id;
    row.innerHTML = `
      <span class="row-id">#${String(v.id).padStart(2, "0")}</span>
      <input class="a-name" type="text" value="${escapeAttr(v.name)}" placeholder="ชื่อห้อง" />
      <input class="a-secret" type="text" value="${escapeAttr(v.secret)}" placeholder="รหัสลับ" />
      <select class="a-diff">
        <option value="easy" ${v.difficulty === "easy" ? "selected" : ""}>😀 ง่าย</option>
        <option value="medium" ${v.difficulty === "medium" ? "selected" : ""}>😐 กลาง</option>
        <option value="hard" ${v.difficulty === "hard" ? "selected" : ""}>😈 ยาก</option>
      </select>
    `;
    adminVaults.appendChild(row);
  }
}

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

async function adminDoLogin() {
  adminError.textContent = "";
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminPass.value }),
  });
  const data = await res.json();
  if (!res.ok) {
    adminError.textContent = data.error || "เข้าสู่ระบบไม่สำเร็จ";
    return;
  }
  adminToken = data.token;
  localStorage.setItem("adminToken", adminToken);
  showAdminPanel();
}

async function adminDoSave() {
  const rows = [...adminVaults.querySelectorAll(".admin-vault-row")];
  const payload = rows.map((r) => ({
    name: r.querySelector(".a-name").value,
    secret: r.querySelector(".a-secret").value,
    difficulty: r.querySelector(".a-diff").value,
  }));
  const res = await fetch("/api/admin/vaults", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({ vaults: payload }),
  });
  if (!res.ok) {
    adminSaved.textContent = "";
    adminError.textContent = "บันทึกไม่สำเร็จ";
    return;
  }
  adminSaved.textContent = "✅ บันทึกแล้ว";
  setTimeout(() => (adminSaved.textContent = ""), 2500);
  loadVaults();
}

async function adminDoResetAll() {
  if (!confirm("รีเซ็ตสถานะเกมทุกห้อง? (บทสนทนาและสถานะเจาะจะถูกล้างทั้งหมด)"))
    return;
  await fetch("/api/admin/reset-all", {
    method: "POST",
    headers: { "x-admin-token": adminToken },
  });
  adminSaved.textContent = "♻️ รีเซ็ตทุกห้องแล้ว";
  setTimeout(() => (adminSaved.textContent = ""), 2500);
  loadVaults();
}

async function adminDoLogout() {
  await fetch("/api/admin/logout", {
    method: "POST",
    headers: { "x-admin-token": adminToken },
  }).catch(() => {});
  adminToken = null;
  localStorage.removeItem("adminToken");
  adminModal.classList.add("hidden");
}

// ===================== EVENTS =====================
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
backBtn.addEventListener("click", backToList);
resetVaultBtn.addEventListener("click", resetVault);
winReset.addEventListener("click", backToList);

adminBtn.addEventListener("click", openAdmin);
adminClose.addEventListener("click", () => adminModal.classList.add("hidden"));
adminModal.addEventListener("click", (e) => {
  if (e.target === adminModal) adminModal.classList.add("hidden");
});
adminLoginBtn.addEventListener("click", adminDoLogin);
adminPass.addEventListener("keydown", (e) => {
  if (e.key === "Enter") adminDoLogin();
});
adminSave.addEventListener("click", adminDoSave);
adminResetAll.addEventListener("click", adminDoResetAll);
adminLogout.addEventListener("click", adminDoLogout);

loadVaults();
