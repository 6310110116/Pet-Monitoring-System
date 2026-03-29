
// ============================
// Auth guard (redirect to login.html if not logged in)
// ============================
async function authGuard() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data || !data.logged_in) {
      window.location.href = '/login.html';
      return;
    }
    // Optionally show user name somewhere in UI later
    window.__CURRENT_USER__ = data.user;

    // Admin-only menu button (Slide Menu)
    try { updateAdminMenuVisibility(); } catch (e) {}
  } catch (e) {
    window.location.href = '/login.html';
  }
}

// ============================
// Admin Panel menu visibility
// - Show "Admin Panel" in slide menu only when role=admin
// ============================
function isAdminUser(u) {
  const role = String(u?.role || '').trim().toLowerCase();
  return role === 'admin';
}

function updateAdminMenuVisibility() {
  const btn = document.getElementById('adminPanelBtn');
  if (!btn) return;
  const u = window.__CURRENT_USER__;
  if (isAdminUser(u)) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

function goAdminPanel() {
  window.location.href = '/admin.html';
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
  } catch (e) {}
  window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', authGuard);

// In case other scripts run before authGuard finishes, update once on load too.
document.addEventListener('DOMContentLoaded', () => {
  try { updateAdminMenuVisibility(); } catch (e) {}
});




/* =========================
 * 1) CONFIG
 * ========================= */
const API_BASE = ""; // same-origin (required for Service Worker / Web Push)

// --- Streaming mode helper ---
// localhost/LAN: ใช้ MJPEG (/video_feed) ได้ลื่น
// ผ่าน ngrok/มือถือ: ใช้ Snapshot polling (/snapshot) เพื่อลดหน่วงสะสม
function isLocalHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

let _snapshotTimer = null;
function clearSnapshotTimer() {
  if (_snapshotTimer) {
    clearInterval(_snapshotTimer);
    _snapshotTimer = null;
  }
}

function renderCameraFeed(roomName, camIndex, camLabel) {
  const container = document.getElementById('cameraFeed');
  if (!container) return;

  clearSnapshotTimer();

  if (!roomName && roomName !== '') {
    container.innerHTML = `<div class="simulated-video"><div class="camera-placeholder large">📹</div><p>ไม่มีกล้อง</p></div>`;
    return;
  }

  const renderId = `${roomName}:${camIndex}:${Date.now()}`;
  container.dataset.renderId = renderId;

  try {
    const oldImg = container.querySelector('img.camera-img');
    if (oldImg) {
      oldImg.onload = null;
      oldImg.onerror = null;
      oldImg.src = 'about:blank';
      oldImg.remove();
    }
  } catch (e) {}

  const mode = 'low';
  const baseUrl = `${API_BASE}/snapshot/${roomName}/${camIndex}?mode=${mode}`;
  const withTs = (u) => `${u}${u.includes('?') ? '&' : '?'}t=${Date.now()}`;

  container.innerHTML = '';
  const img = document.createElement('img');
  img.className = 'camera-img';
  img.alt = camLabel || 'Camera';
  container.appendChild(img);

  let attempts = 0;
  let retryTimer = null;

  const mountError = (message) => {
    container.innerHTML = `
      <div class="simulated-video">
        <div class="camera-placeholder large">📹</div>
        <p>${message}</p>
        <button class="select-btn" id="retryCamBtn">ลองใหม่</button>
      </div>`;
    const btn = document.getElementById('retryCamBtn');
    if (btn) btn.onclick = () => renderCameraFeed(roomName, camIndex, camLabel);
  };

  const reload = () => {
    if (container.dataset.renderId !== renderId) return;
    try { img.src = withTs(baseUrl); } catch (e) {}
  };

  img.onload = () => { attempts = 0; };
  img.onerror = async () => {
    if (container.dataset.renderId !== renderId) return;
    attempts += 1;
    if (attempts >= 6) {
      mountError('กล้องโหลดไม่สำเร็จ');
      return;
    }
    const delay = Math.min(3000, 500 * Math.pow(2, attempts - 1));
    retryTimer = setTimeout(reload, delay);
  };

  reload();

  _snapshotTimer = setInterval(() => {
    if (container.dataset.renderId !== renderId) {
      clearSnapshotTimer();
      try { if (retryTimer) clearTimeout(retryTimer); } catch (e) {}
      return;
    }
    reload();
  }, 1000);
}

const ENDPOINTS = {
  cats: `${API_BASE}/api/cats`,
  catsDisplayStatus: `${API_BASE}/api/cats/display_status`,
  catsUpdate: `${API_BASE}/api/cats/update`,
  catsUploadImage: `${API_BASE}/api/cats/upload_image`,
  alerts: `${API_BASE}/api/alerts`,
  alertsMarkRead: `${API_BASE}/api/alerts/mark_read`,
  alertsMarkAllRead: `${API_BASE}/api/alerts/mark_all_read`,
  systemConfig: `${API_BASE}/api/system_config`,
  systemConfigSummaries: `${API_BASE}/api/system_config/summaries`,
  systemConfigApplySummary: `${API_BASE}/api/system_config/apply_summary`,
  rooms: `${API_BASE}/api/rooms`,
timeline: `${API_BASE}/api/timeline`,
  timelineTable: `${API_BASE}/api/timeline_table`,
};
const REFRESH_INTERVAL = 5000;

async function fetchJsonChecked(url, options = {}) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* =========================
 * 1B) WEB PUSH NOTIFICATIONS
 * - Requires HTTPS or localhost
 * - Must be triggered by user gesture (button click)
 * ========================= */
const PUSH_ENDPOINTS = {
  vapidPublicKey: `${API_BASE}/api/push/vapid_public_key`,
  subscribe: `${API_BASE}/api/push/subscribe`,
  unsubscribe: `${API_BASE}/api/push/unsubscribe`,
  test: `${API_BASE}/api/push/test`,
};

function _setPushStatus(text) {
  const ids = ["pushStatusSettings"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

function _urlBase64ToUint8Array(base64String) {
  // base64url -> Uint8Array
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function _registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Browser นี้ไม่รองรับ Service Worker');
  }
  // Important: sw.js must be served from the same origin
  const reg = await navigator.serviceWorker.register('/sw.js');
  return reg;
}

async function _getVapidPublicKey() {
  const res = await fetch(PUSH_ENDPOINTS.vapidPublicKey);
  if (!res.ok) throw new Error('ไม่สามารถโหลด VAPID public key');
  const data = await res.json();
  return data.publicKey;
}

async function _postJSON(url, obj) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj || {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { ok: res.ok, status: res.status, text, json };
}

async function refreshPushStatus() {
  try {
    if (!('Notification' in window)) {
      _setPushStatus('สถานะ: Browser ไม่รองรับ Notification');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') {
      _setPushStatus('สถานะ: ถูกบล็อก (denied) — ไปที่ Site settings > Notifications แล้วเปลี่ยนเป็น Allow');
      return;
    }
    const reg = await _registerServiceWorker();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      _setPushStatus('สถานะ: เปิดใช้งานแล้ว ✅');
    } else {
      _setPushStatus(`สถานะ: ยังไม่ได้ subscribe (permission=${perm})`);
    }
  } catch (e) {
    _setPushStatus('สถานะ: ตรวจสอบไม่ได้ (' + (e?.message || e) + ')');
  }
}

// Called by button click in Notification Settings page
async function enablePushNotifications() {
  try {
    if (!('Notification' in window)) {
      alert('Browser นี้ไม่รองรับ Notification');
      return;
    }

    // Must be triggered by user gesture; this is called from onclick
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      _setPushStatus('สถานะ: ยังไม่ได้อนุญาต (permission=' + permission + ')');
      alert('ต้องกด Allow เพื่อเปิด Push');
      return;
    }

    const reg = await _registerServiceWorker();
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      _setPushStatus('สถานะ: เปิดใช้งานแล้ว ✅');
      return;
    }

    const publicKey = await _getVapidPublicKey();
    const applicationServerKey = _urlBase64ToUint8Array(publicKey);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    const out = await _postJSON(PUSH_ENDPOINTS.subscribe, sub);
    if (!out.ok) throw new Error(out.text || 'subscribe failed');

    _setPushStatus('สถานะ: เปิดใช้งานแล้ว ✅');
    alert('เปิด Push สำเร็จ');
  } catch (e) {
    console.error(e);
    _setPushStatus('สถานะ: เปิดไม่ได้ (' + (e?.message || e) + ')');
    alert('เปิด Push ไม่สำเร็จ: ' + (e?.message || e));
  }
}

async function disablePushNotifications() {
  try {
    const reg = await _registerServiceWorker();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // remove on server
      await _postJSON(PUSH_ENDPOINTS.unsubscribe, { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    _setPushStatus('สถานะ: ปิดแล้ว');
    alert('ปิด Push แล้ว');
  } catch (e) {
    console.error(e);
    alert('ปิด Push ไม่สำเร็จ: ' + (e?.message || e));
  }
}

async function testPushNotification() {
  try {
    const out = await _postJSON(PUSH_ENDPOINTS.test, {
      title: 'Pet Monitoring',
      body: 'ทดสอบแจ้งเตือนจากระบบ',
      url: '/#notifications',
    });
    if (!out.ok) throw new Error(out.text || 'test failed');
    alert('ส่งคำสั่งทดสอบแล้ว (ถ้า subscribe ไว้จะเด้ง)');
  } catch (e) {
    console.error(e);
    alert('ทดสอบไม่สำเร็จ: ' + (e?.message || e));
  }
}


// ============================================================
// LINE Notification (link by code)
// ============================================================

async function refreshLineStatus() {
  const statusEl = document.getElementById('lineStatus');
  const oaWrap = document.getElementById('lineOALinkWrap');
  const oaLink = document.getElementById('lineOALink');
  const codeBox = document.getElementById('lineCodeBox');

  if (codeBox) codeBox.style.display = 'none';

  if (!statusEl) return;
  statusEl.textContent = 'สถานะ: กำลังตรวจสอบ...';

  try {
    const res = await fetch(`${API_BASE}/api/line/status`, { credentials: 'include' });
    const data = await res.json();

    if (!data?.enabled) {
      statusEl.textContent = 'สถานะ: LINE ยังไม่ถูกตั้งค่าในระบบ (admin ต้องใส่ token/secret)';
      if (oaWrap) oaWrap.style.display = 'none';
      return;
    }

    if (data?.oa_user_id) {
      // LINE OA deep link (optional)
      if (oaLink) {
        // Accept both "@xxxx" and "xxxx" (LINE Official Account ID)
        const id = String(data.oa_user_id).replace(/^@/, '');
        oaLink.href = `https://line.me/R/ti/p/@${id}`;
      }
      if (oaWrap) oaWrap.style.display = '';
    } else {
      if (oaWrap) oaWrap.style.display = 'none';
    }

    statusEl.textContent = data?.linked
      ? 'สถานะ: เชื่อมต่อแล้ว ✅'
      : 'สถานะ: ยังไม่เชื่อมต่อ (ต้องสร้างรหัสและส่งให้บอท)';
  } catch (e) {
    statusEl.textContent = 'สถานะ: ตรวจสอบไม่ได้ (' + (e?.message || e) + ')';
    if (oaWrap) oaWrap.style.display = 'none';
  }
}

async function generateLineLinkCode() {
  const statusEl = document.getElementById('lineStatus');
  const codeBox = document.getElementById('lineCodeBox');
  const codeText = document.getElementById('lineCodeText');
  const hintEl = document.getElementById('lineCodeHint');
  if (codeBox) codeBox.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/line/link-code`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      const msg = data?.error || res.status;
      alert('สร้างรหัสไม่สำเร็จ: ' + msg);
      if (statusEl) statusEl.textContent = 'สถานะ: สร้างรหัสไม่สำเร็จ';
      return;
    }
    if (codeText) codeText.textContent = data.code;
    if (hintEl) hintEl.textContent = 'ส่งรหัสนี้ไปที่แชทบอท เพื่อยืนยันการเชื่อมต่อ';
    if (codeBox) codeBox.style.display = '';
    if (statusEl) statusEl.textContent = 'สถานะ: สร้างรหัสแล้ว (รอส่งให้บอท)';
  } catch (e) {
    alert('สร้างรหัสไม่สำเร็จ: ' + (e?.message || e));
  }
}

function copyLineCode() {
  const codeText = document.getElementById('lineCodeText');
  const code = (codeText?.textContent || '').trim();
  if (!code) return;
  navigator.clipboard?.writeText(code)
    .then(() => alert('คัดลอกรหัสแล้ว'))
    .catch(() => alert('คัดลอกไม่สำเร็จ (ลองเลือกและก๊อปเอง)'));
}

async function unlinkLine() {
  if (!confirm('ต้องการยกเลิกการเชื่อมต่อ LINE ใช่ไหม?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/line/unlink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert('ยกเลิกไม่สำเร็จ: ' + (data?.error || res.status));
      return;
    }
    alert('ยกเลิกการเชื่อมต่อแล้ว');
    refreshLineStatus();
  } catch (e) {
    alert('ยกเลิกไม่สำเร็จ: ' + (e?.message || e));
  }
}

async function testLineNotification() {
  try {
    const res = await fetch(`${API_BASE}/api/line/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert('ทดสอบไม่สำเร็จ: ' + (data?.error || res.status));
      return;
    }
    alert('ส่งทดสอบแล้ว (ถ้าเชื่อมต่อไว้จะได้รับข้อความใน LINE)');
  } catch (e) {
    alert('ทดสอบไม่สำเร็จ: ' + (e?.message || e));
  }
}


/* =========================
 * 2) STATE
 * ========================= */
let cats = [];
let dateRangePicker = null;
let selectedCatId = null;        // ชื่อแมวที่เลือก (จำมาจากหน้า Cat/Detail)
let refreshTimer = null;

// Cat edit modal state
let catEditPreviewObjectURL = null;

// =========================
// Active cats (from DB: display_status=1) used across dropdowns/pages
// =========================
function getActiveCats() {
  return (cats || []).filter((c) => Number(c?.display_status) === 1);
}

// Prefix สี/แมวที่มีคอลัมน์จริงใน timeslot (โหลดจาก backend แบบ dynamic)
let STAT_PREFIXES = [];
let statsPrefixesPromise = null;

function normalizeStatPrefix(value) {
  return String(value || "").trim().toLowerCase();
}

function loadStatsPrefixes(force = false) {
  if (!force && statsPrefixesPromise) return statsPrefixesPromise;

  statsPrefixesPromise = fetch(`${API_BASE}/api/statistics/prefixes?ts=${Date.now()}`, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      STAT_PREFIXES = Array.isArray(data?.prefixes)
        ? data.prefixes.map(normalizeStatPrefix).filter(Boolean)
        : [];
      return STAT_PREFIXES;
    })
    .catch((err) => {
      console.warn("loadStatsPrefixes failed:", err);
      STAT_PREFIXES = [];
      return STAT_PREFIXES;
    });

  return statsPrefixesPromise;
}

function getStatsEligibleCats() {
  // NOTE: The DB (timeslot table) stores per-cat columns by *color prefix*.
  // Backend จะคืนเฉพาะ prefix ที่มีคอลัมน์จริงอยู่ใน timeslot มาให้
  // เพื่อให้หน้า Statistics รองรับทุกสีที่ schema ปัจจุบันมีจริง
  // โดยไม่ต้อง hardcode รายชื่อสีไว้ในฝั่งหน้าเว็บ
  const activeCats = getActiveCats();
  if (!STAT_PREFIXES.length) return activeCats;

  return activeCats.filter((c) =>
    STAT_PREFIXES.includes(normalizeStatPrefix(c?.color || c?.name))
  );
}


function ensureSelectedCatIsActive() {
  if (!selectedCatId) return;
  // Prefer stats-eligible cats (colors that exist in timeslot)
  const eligible = getStatsEligibleCats();
  const list = eligible.length ? eligible : getActiveCats();
  if (list.some((c) => c?.name === selectedCatId)) return;
  selectedCatId = list.length ? list[0].name : null;
}

function refreshStatisticsCatSelectIfVisible() {
  const statsPage = document.getElementById("statisticsPage");
  if (!statsPage || statsPage.classList.contains("hidden")) return;

  const render = () => {
    const catSel = document.getElementById("catSelect");
    const titleEl = document.getElementById("statisticsTitle");
    if (!catSel) return;

    ensureSelectedCatIsActive();
    const eligible = getStatsEligibleCats();
    const active = eligible.length ? eligible : getActiveCats();

    catSel.innerHTML = "";
    if (active.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "ไม่มีแมวที่ถูกเลือก";
      catSel.appendChild(opt);
      catSel.disabled = true;
      if (titleEl) titleEl.textContent = "Statistics";
      return;
    }

    catSel.disabled = false;
    active.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      if (c.name === selectedCatId) opt.selected = true;
      catSel.appendChild(opt);
    });

    if (titleEl && selectedCatId) titleEl.textContent = `${selectedCatId}'s Statistics`;
  };

  if (STAT_PREFIXES.length) {
    render();
  } else {
    loadStatsPrefixes().finally(render);
  }
}

function refreshSystemConfigSummaryIfVisible() {
  const scPage = document.getElementById("systemConfigPage");
  if (!scPage || scPage.classList.contains("hidden")) return;
  // dropdown อ้างอิง display_status อยู่แล้ว
  populateConfigCatSelect();
  loadSystemConfigSummaries();
}

function refreshNotificationsIfVisible() {
  const nPage = document.getElementById("notificationsPage");
  if (!nPage || nPage.classList.contains("hidden")) return;
  loadNotificationsList();
}


// =========================
// Cat visibility (Cat page only)
// =========================
const CAT_VIS_STORAGE_KEY = "visibleCats_v1";

function _loadVisibleCatsArray() {
  try {
    const raw = localStorage.getItem(CAT_VIS_STORAGE_KEY);
    if (!raw) return null; // null = show all
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr.map((x) => String(x)).filter((x) => x.trim() !== "");
  } catch (_) {
    return null;
  }
}

function _saveVisibleCatsArray(arr) {
  try {
    localStorage.setItem(CAT_VIS_STORAGE_KEY, JSON.stringify(arr || []));
  } catch (_) {}
}

function getVisibleCatsSet() {
  const arr = _loadVisibleCatsArray();
  if (!arr) return null;
  return new Set(arr);
}

function normalizeVisibleCatsWithCurrentList() {
  // ถ้ามีการบันทึกไว้แล้ว: เพิ่มแมวใหม่ให้เป็น visible โดย default
  const arr = _loadVisibleCatsArray();
  if (!arr) return;

  const set = new Set(arr);
  let changed = false;
  (cats || []).forEach((c) => {
    const nm = String(c?.name || "").trim();
    if (!nm) return;
    if (!set.has(nm)) {
      set.add(nm);
      changed = true;
    }
  });
  if (changed) _saveVisibleCatsArray(Array.from(set));
}

function isCatVisibleByName(catName) {
  const set = getVisibleCatsSet();
  if (!set) return true; // default show all
  return set.has(String(catName));
}


let rooms = [];                  // [{name, cameras:[{label,index}]}]
let currentRoomIndex = null;
let currentCameraIndex = 0;
let cameraTimestampTimer = null;

// navigation: จำหน้าเดิมก่อนเปิด Alerts
let lastPageId = null;

// Alerts states
let selectedAlertIds = new Set();
let lastAlertsRaw = [];          // รายการดิบจาก API (ของแมวที่เลือก)

// โฟกัสแถว alert เฉพาะเมื่อมาจากหน้า Notifications
let _focusAlertId = null;

function focusAlertIfNeeded() {
  if (!_focusAlertId) return;
  const el = document.querySelector(`.alert-item[data-id="${_focusAlertId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("pulse-highlight");
    setTimeout(() => el.classList.remove("pulse-highlight"), 2500);
  }
  _focusAlertId = null;
}

/* =========================
 * 3) STARTUP
 * ========================= */

function _handleInitialRoute() {
  const h = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
  if (!h) return;
  if (h === "notifications") {
    showNotificationsPage();
    return;
  }
  if (h === "notification-settings" || h === "notificationsettings") {
    showNotificationSettings();
    return;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  try { _handleInitialRoute(); } catch (e) {}
  // NOTE: ไม่ต้องเรียก refreshPushStatus ตอนโหลดหน้าแรกเสมอ
  // เพราะจะไป register service worker ทุกครั้ง และบาง browser อาจมีอาการรีเฟรชหน้า/กระตุก
  // เราจะเรียก refreshPushStatus เฉพาะตอนเข้า "Notification Settings" เท่านั้น

    initDateRangePicker();
bindSystemConfigSummaryApply();
  fetchCatDataFromAPI();
  refreshTimer = setInterval(updateCatData, REFRESH_INTERVAL);
  loadSystemConfig();
  loadRoomsAndRender();
  // Fullscreen (double click + button)
  try { _bindCameraFullscreenHandlersOnce(); } catch (e) {}
});

/* =========================
 * Utils
 * ========================= */
function getVisiblePageId() {
  const pages = Array.from(document.querySelectorAll(".page"));
  const visible = pages.find(p => !p.classList.contains("hidden"));
  return visible ? visible.id : null;
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text ?? "");
}

// =========================
// Cat Image Helpers
// =========================
// Display order: real_image_url -> image_url
function getCatDisplayImage(cat) {
  const realUrl = String(cat?.real_image_url || "").trim();
  const baseUrl = String(cat?.image_url || "").trim();
  const chosen = realUrl || baseUrl || "";
  // If API returns a relative assets path, serve it from API_BASE.
  if (chosen.startsWith("/assets/")) {
    return `${API_BASE}${chosen}`;
  }
  return chosen;
}


// ===== Summary Card Helpers =====
function safeDiv(n, d) { return d ? (n / d) : 0; }
function formatAvg(value) {
  // show as integer when close to integer, else 2 decimals
  if (Number.isFinite(value) && Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return (Number.isFinite(value) ? value.toFixed(2) : "0");
}
function unitLabel(period) {
  if (period === "monthly") return "เดือน";
  if (period === "yearly")  return "ปี";
  // daily + range => per day
  return "วัน";
}
function countNonNullBuckets(arr) {
  // Count buckets that actually have data (non-null numeric)
  return (arr || []).reduce((acc, v) => acc + (Number.isFinite(Number(v)) ? 1 : 0), 0);
}

function updateSummaryCardsFromSeries(period, eatArr, excArr) {
  const totalEat = sum(eatArr);
  const totalExc = sum(excArr);

  // IMPORTANT: average should be computed only from days/months/years that have data,
  // not from the total calendar bucket count.
  const denomEat = countNonNullBuckets(eatArr);
  const denomExc = countNonNullBuckets(excArr);

  const avgEat = safeDiv(totalEat, denomEat);
  const avgExc = safeDiv(totalExc, denomExc);

  const unit = unitLabel(period);

  // Display average prominently; keep total + number of days used for reference
  setText(
    "eatTime",
    `เฉลี่ย ${formatAvg(avgEat)} ครั้ง/${unit} (รวม ${totalEat} ครั้ง, คิดจาก ${denomEat || 0} ${unit})`
  );
  setText(
    "excreteTime",
    `เฉลี่ย ${formatAvg(avgExc)} ครั้ง/${unit} (รวม ${totalExc} ครั้ง, คิดจาก ${denomExc || 0} ${unit})`
  );
}

function handleFetchError(err) {
  console.error("❌ API Error:", err);
  if (!document.body.dataset.alerted) {
    alert("ไม่สามารถเชื่อมต่อ API ได้ กรุณาตรวจสอบว่า Flask ทำงานอยู่หรือไม่");
    document.body.dataset.alerted = "true";
  }
}

function fmtDateTime(s) {
  const d = new Date(s);
  return isNaN(d) ? "" : d.toLocaleString();
}

function priorityClass(type) {
  switch (type) {
    case "no_cat":
    case "no_eating":
      return "high-priority";
    case "low_excrete":
    case "high_excrete":
      return "medium-priority";
    default:
      return "";
  }
}

/* =========================
 * 4) CATS: โหลด/เรนเดอร์
 * ========================= */
function fetchCatDataFromAPI() {
  fetch(ENDPOINTS.cats)
    .then(res => res.json())
    .then(data => {
      cats = Array.isArray(data) ? data : [];
      renderCatCards(cats);
      ensureSelectedCatIsActive();
      populateConfigCatSelect();
      refreshStatisticsCatSelectIfVisible();
      refreshSystemConfigSummaryIfVisible();
      refreshNotificationsIfVisible();
    })
    .catch(handleFetchError);
}

function updateCatData() {
  fetch(ENDPOINTS.cats)
    .then(res => res.json())
    .then(data => {
      cats = Array.isArray(data) ? data : [];
      renderCatCards(cats);
      updateOpenCatDetail();

      ensureSelectedCatIsActive();
      populateConfigCatSelect();
      refreshStatisticsCatSelectIfVisible();
      refreshSystemConfigSummaryIfVisible();
      refreshNotificationsIfVisible();
    })
    .catch(handleFetchError);
}

function renderCatCards(catList) {
  const container = document.querySelector(".cat-grid");
  if (!container) return;
  container.innerHTML = "";

  const seen = new Set();

  (catList || []).forEach((cat) => {
    const name = cat?.name;
    if (!name) return;
    if (seen.has(name)) return;
    seen.add(name);

    // แสดงเฉพาะแมวที่ถูกเลือกจาก DB (display_status = 1)
    if (Number(cat?.display_status) !== 1) return;

    const card = document.createElement("div");
    card.className = "cat-card";
    card.onclick = () => selectCat(name);

    const imgUrl = getCatDisplayImage(cat);
    card.innerHTML = `
      <img src="${escapeAttr(imgUrl)}" alt="${escapeAttr(name)}" class="cat-image">
      <h3>${escapeHtml(name)}</h3>
    `;
    container.appendChild(card);
  });

  if (container.children.length === 0) {
    container.innerHTML = `
      <div class="cat-settings-empty" style="grid-column:1/-1; text-align:center;">
        ไม่มีแมวที่ถูกเลือกให้แสดง (กด "ตั้งค่าแมว" เพื่อเลือก)
      </div>
    `;
  }
}/* =========================
 * 5) CAT DETAIL
 * ========================= */
function selectCat(catName) {
  const cat = cats.find((c) => c.name === catName);
  if (!cat) return;

  selectedCatId = catName; // จำชื่อแมวไว้ใช้ที่ Alerts/Statistics
  document.getElementById("catDetailName").textContent = cat.name;
  document.getElementById("catProfileName").textContent = `Name: ${cat.name}`;
  document.getElementById("catDetailImage").src = getCatDisplayImage(cat);
  document.getElementById("catLocation").textContent = cat.current_room || "Unknown";

  navigateTo("catDetailPage");
}

function goBackToCatGallery() {
  selectedCatId = null;
  // Prefer returning to Cat gallery explicitly
  navigateTo("catPage", { pushHistory: false });
}


/* =========================
 * 5.1) CAT EDIT (name + real_image_url)
 * ========================= */
function openCatEditModal() {
  // Must be on Cat Detail page
  if (!selectedCatId) {
    alert("กรุณาเลือกแมวก่อน");
    return;
  }
  const cat = cats.find((c) => c.name === selectedCatId);
  if (!cat) return;

  const overlay = document.getElementById("catEditOverlay");
	const modalEl = document.getElementById("catEditModal");
	if (!overlay || !modalEl) return;

  // Prefill
  const nameInput = document.getElementById("catEditNameInput");
  if (nameInput) nameInput.value = cat.name || "";

  const fileInput = document.getElementById("catEditFileInput");
  if (fileInput) fileInput.value = "";

	// reset flag
	modalEl.dataset.resetRealImage = "0";

  // Preview
  updateCatEditPreview();

	overlay.classList.remove("hidden");
	modalEl.classList.remove("hidden");
}

function closeCatEditModal() {
  const overlay = document.getElementById("catEditOverlay");
  const modal = document.getElementById("catEditModal");
  if (overlay) overlay.classList.add("hidden");
  if (modal) modal.classList.add("hidden");

  // cleanup object URL
  if (catEditPreviewObjectURL) {
    URL.revokeObjectURL(catEditPreviewObjectURL);
    catEditPreviewObjectURL = null;
  }
}

function updateCatEditPreview() {
  const cat = cats.find((c) => c.name === selectedCatId);
  if (!cat) return;

  const previewImg = document.getElementById("catEditPreviewImg");
  const previewName = document.getElementById("catEditPreviewName");
  const nameInput = document.getElementById("catEditNameInput");
  const fileInput = document.getElementById("catEditFileInput");

  const modal = document.getElementById("catEditModal");
  const resetReal = String(modal?.dataset?.resetRealImage || "0") === "1";

  const nm = String(nameInput?.value || cat.name || "").trim();
  const baseUrl = String(cat.image_url || "").trim();

  // Pick preview image priority:
  // 1) if user selected file -> local preview
  // 2) if user pressed reset -> base image_url
  // 3) else use current real_image_url -> image_url
  let img = baseUrl;

  const file = fileInput?.files?.[0] || null;
  if (file) {
    if (catEditPreviewObjectURL) {
      URL.revokeObjectURL(catEditPreviewObjectURL);
      catEditPreviewObjectURL = null;
    }
    catEditPreviewObjectURL = URL.createObjectURL(file);
    img = catEditPreviewObjectURL;
  } else if (resetReal) {
    img = baseUrl;
  } else {
    img = String(cat.real_image_url || "").trim() || baseUrl;
  }

  if (previewImg) previewImg.src = img;
  if (previewName) previewName.textContent = nm || "-";
}

function resetCatRealImage() {
  const modal = document.getElementById("catEditModal");
  if (modal) modal.dataset.resetRealImage = "1";

  const fileInput = document.getElementById("catEditFileInput");
  if (fileInput) fileInput.value = "";

  if (catEditPreviewObjectURL) {
    URL.revokeObjectURL(catEditPreviewObjectURL);
    catEditPreviewObjectURL = null;
  }
  updateCatEditPreview();
}

function saveCatEdit() {
  const cat = cats.find((c) => c.name === selectedCatId);
  if (!cat) return;

  const nameInput = document.getElementById("catEditNameInput");
  const fileInput = document.getElementById("catEditFileInput");

  const modal = document.getElementById("catEditModal");
  const resetReal = String(modal?.dataset?.resetRealImage || "0") === "1";

  const newName = String(nameInput?.value || "").trim();
  const file = fileInput?.files?.[0] || null;

  if (!newName) {
    alert("ชื่อแมวต้องไม่ว่าง");
    return;
  }

  const payload = {
    oldName: cat.name,
    newName,
  };

  // Only reset when user explicitly pressed the reset button.
  if (resetReal && !file) {
    payload.reset_image = true;
  }


  // 1) Update name/reset flags first
  fetch(ENDPOINTS.catsUpdate, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (r) => {
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || j?.error || `HTTP ${r.status}`);
      }
      return r.json();
    })
    .then(async () => {
      // 2) If user selected a file, upload it
      if (!file) return;
      const fd = new FormData();
      fd.append("catName", newName);
      fd.append("file", file);
      const r = await fetch(ENDPOINTS.catsUploadImage, { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || `Upload failed (HTTP ${r.status})`);
      }
      const j = await r.json().catch(() => ({}));
      if (!j?.ok) throw new Error(j?.message || "Upload failed");
    })
    .then(() => {
      selectedCatId = newName;
      const configSel = document.getElementById("configCatSelect");
      if (configSel && configSel.value === cat.name) {
        configSel.value = newName;
      }
      closeCatEditModal();
      updateCatData();
      loadSystemConfig();
    })
    .catch((e) => {
      console.error(e);
      alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
    });
}

function updateOpenCatDetail() {
  if (selectedCatId && !document.getElementById("catDetailPage").classList.contains("hidden")) {
    const cat = cats.find((c) => c.name === selectedCatId);
    if (cat) {
      document.getElementById("catLocation").textContent = cat.current_room || "Unknown";
      document.getElementById("catDetailName").textContent = cat.name;
      document.getElementById("catProfileName").textContent = `Name ${cat.name}`;
      document.getElementById("catDetailImage").src = getCatDisplayImage(cat);
    }
  }
}

/* =========================
 * 6) ROOMS & CAMERA
 * ========================= */
function loadRoomsAndRender() {
  fetch(ENDPOINTS.rooms)
    .then(res => res.json())
    .then(data => {
      rooms = Array.isArray(data) ? data : [];
      renderRoomCards(rooms);
    })
    .catch(err => console.error("❌ โหลดผังห้อง/กล้องล้มเหลว:", err));
}

function getRoomTheme(roomName = "") {
  const key = String(roomName).trim().toLowerCase();
  const map = {
    hall: {
      theme: "theme-hall",
      icon: "🚪",
      label: "Main hall",
      desc: "ห้อง Hall ใหม่ ใช้แทนห้องเดิมชื่อ Garage และต้องแยกสตรีมจาก Room1 อย่างชัดเจน"
    },
    room1: {
      theme: "theme-garage",
      icon: "1️⃣",
      label: "Room 1",
      desc: "ห้อง Room1 ใช้แทนห้องเดิมชื่อ Hall และคงกล้องเดิมของ Hall ไว้"
    },
    room2: {
      theme: "theme-garden",
      icon: "2️⃣",
      label: "Room 2",
      desc: "ห้อง Room2 ใช้แทนห้องเดิมชื่อ Garden"
    },
    kitchen: {
      theme: "theme-kitchen",
      icon: "🍽️",
      label: "Feeding zone",
      desc: "ติดตามช่วงเวลาให้อาหารและกิจกรรมใกล้จุดวางอาหารได้สะดวก"
    }
  };
  return map[key] || {
    theme: "theme-hall",
    icon: "🏠",
    label: "Monitoring zone",
    desc: "กดเพื่อเข้าสู่มุมมองกล้องของห้องนี้"
  };
}

function renderRoomCards(roomList) {
  const grid = document.querySelector(".room-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const roomCountEl = document.getElementById("homeRoomCount");
  if (roomCountEl) roomCountEl.textContent = String(roomList.length || 0);

  roomList.forEach((room, idx) => {
    const card = document.createElement("div");
    const roomName = capitalize(room.name || "Room");
    const cameraCount = Array.isArray(room.cameras) ? room.cameras.length : 0;
    const theme = getRoomTheme(room.name);

    card.className = `room-card ${theme.theme}`;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `เปิดดูห้อง ${roomName}`);
    card.onclick = () => selectRoom(idx);
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectRoom(idx);
      }
    };
    card.innerHTML = `
      <div class="room-preview">
        <div class="live-preview">
          <div class="room-badge-row">
            <span class="room-type">${theme.label}</span>
            <span class="camera-count">${cameraCount} camera${cameraCount === 1 ? '' : 's'}</span>
          </div>
          <div class="room-illustration"><span>${theme.icon}</span></div>
          <div class="room-meta">
            <div>
              <div class="room-label">Room overview</div>
              <h3>${roomName}</h3>
            </div>
          </div>
        </div>
      </div>
      <button class="select-btn" type="button">Open live view →</button>
    `;
    grid.appendChild(card);
  });
}

function selectRoom(index) {
  if (index < 0 || index >= rooms.length) return;
  currentRoomIndex = index;
  currentCameraIndex = 0;

  navigateTo("cameraPage");

  updateCameraUI();

  if (cameraTimestampTimer) clearInterval(cameraTimestampTimer);
  cameraTimestampTimer = setInterval(updateCameraTimestamp, 1000);
  updateCameraTimestamp();
}

function updateCameraUI() {
  if (currentRoomIndex === null) return;

  const room = rooms[currentRoomIndex] || {};
  const cams = room.cameras || [];
  const cam = cams[currentCameraIndex];

  const roomNameEl = document.getElementById("currentRoomName");
  const cameraInfoEl = document.getElementById("cameraInfo");
  const cameraFeedEl = document.getElementById("cameraFeed");
  const timestampEl = document.getElementById("timestamp");

  if (roomNameEl) roomNameEl.textContent = capitalize(room.name || "Room");
  if (cameraInfoEl) {
    cameraInfoEl.textContent = cams.length
      ? `กล้อง ${currentCameraIndex + 1} จาก ${cams.length}`
      : `ไม่มีกล้องในห้องนี้`;
  }

  if (cam) {
    renderCameraFeed(room.name, cam.index, cam.label || "Camera");
  } else if (cameraFeedEl) {
    clearSnapshotTimer();
    cameraFeedEl.innerHTML =
      `<div class="simulated-video"><div class="camera-placeholder large">📹</div><p>ไม่มีกล้อง</p></div>`;
  }

  const prevBtn = document.querySelector(".camera-controls .nav-btn:first-child");
  const nextBtn = document.querySelector(".camera-controls .nav-btn:last-child");
  if (prevBtn) prevBtn.disabled = currentCameraIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentCameraIndex >= cams.length - 1;

  if (timestampEl) timestampEl.textContent = new Date().toLocaleString();
}

// =========================
// Fullscreen (YouTube-like)
// - Button: #fullscreenBtn
// - Double click on video toggles fullscreen
// =========================
function _getCameraFullscreenTarget() {
  // Fullscreen the wrapper so the button stays visible
  return document.querySelector("#cameraPage .video-wrapper");
}

function _isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function _setFullscreenUI(isOn) {
  // Toggle class on <html> for CSS tweaks (hide navbar/header/controls)
  try { document.documentElement.classList.toggle("fs-active", !!isOn); } catch (e) {}

  const btn = document.getElementById("fullscreenBtn");
  if (btn) {
    // ⛶ = enter, ✕ = exit
    btn.textContent = isOn ? "✕" : "⛶";
    btn.setAttribute("aria-label", isOn ? "Exit fullscreen" : "Fullscreen");
    btn.title = isOn ? "ออกจากเต็มจอ" : "เต็มจอ";
  }
}

function toggleCameraFullscreen() {
  const el = _getCameraFullscreenTarget();
  if (!el) return;

  // Safari iOS uses webkit* APIs
  const active = _isFullscreenActive();
  if (active) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    return;
  }

  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) {
    alert("Browser นี้ไม่รองรับโหมดเต็มจอ");
    return;
  }
  try {
    req.call(el);
  } catch (e) {
    console.error(e);
    alert("เข้าเต็มจอไม่สำเร็จ: " + (e?.message || e));
  }
}

// Bind once
function _bindCameraFullscreenHandlersOnce() {
  if (window.__cameraFullscreenBound) return;
  window.__cameraFullscreenBound = true;

  // Double click anywhere on the video area
  const feed = document.getElementById("cameraFeed");
  if (feed) {
    feed.addEventListener("dblclick", (ev) => {
      // Prevent double-tap zoom on mobile where possible
      ev.preventDefault();
      toggleCameraFullscreen();
    });
  }

  // Keep UI state in sync
  document.addEventListener("fullscreenchange", () => _setFullscreenUI(_isFullscreenActive()));
  document.addEventListener("webkitfullscreenchange", () => _setFullscreenUI(_isFullscreenActive()));
}

function previousCamera() {
  if (currentRoomIndex === null) return;
  if (currentCameraIndex > 0) {
    currentCameraIndex--;
    updateCameraUI();
  }
}

function nextCamera() {
  if (currentRoomIndex === null) return;
  const cams = rooms[currentRoomIndex]?.cameras || [];
  if (currentCameraIndex < cams.length - 1) {
    currentCameraIndex++;
    updateCameraUI();
  }
}

function goBack() {
  goBackSPA();
}

// =========================
// SPA Navigation (single-page app)
// - Hide all pages then show target
// - Maintain history stack to prevent "page overlap"
// =========================
let __pageStack = [];
let __isNavigating = false;

function __allPages() {
  return Array.from(document.querySelectorAll(".page"));
}

function __hideAllPages() {
  __allPages().forEach(p => p.classList.add("hidden"));
}

function __cleanupOnLeave(pageId) {
  // Stop timers / reset state when leaving certain pages
  if (pageId === "cameraPage") {
    currentRoomIndex = null;
    clearSnapshotTimer();
    if (cameraTimestampTimer) {
      clearInterval(cameraTimestampTimer);
      cameraTimestampTimer = null;
    }
    try {
      const container = document.getElementById('cameraFeed');
      const img = container?.querySelector('img.camera-img');
      if (img) img.src = 'about:blank';
    } catch (e) {}
  }
}

function navigateTo(pageId, opts = {}) {
  const { pushHistory = true, resetStack = false } = opts;

  if (__isNavigating) return;
  __isNavigating = true;

  const target = document.getElementById(pageId);
  if (!target) {
    __isNavigating = false;
    return;
  }

  const currentId = getVisiblePageId();
  if (resetStack) __pageStack = [];

  if (pushHistory && currentId && currentId !== pageId) {
    __pageStack.push(currentId);
  }

  if (currentId) __cleanupOnLeave(currentId);

  __hideAllPages();
  target.classList.remove("hidden");

  // Close side menu on navigation (mobile UX)
  try {
    const menu = document.getElementById("sideMenu");
    if (menu) menu.classList.remove("open");
  } catch (e) {}

  // Scroll to top for page-like feel
  try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0,0); }

  __isNavigating = false;
}

function goBackSPA() {
  // Pop last page from stack, fallback to home
  const prev = __pageStack.pop();
  if (prev) navigateTo(prev, { pushHistory: false });
  else showHomePage();
}

// Backwards-compatible helper used by Alerts/Notifications
function _showOnlyPage(pageId) {
  navigateTo(pageId);
}


/* =========================
 * 7) PAGE NAV
 * ========================= */
function showHomePage() {
  selectedCatId = null;
  currentRoomIndex = null;
  // cleanup handled in navigateTo as well, but keep explicit for safety
  if (cameraTimestampTimer) {
    clearInterval(cameraTimestampTimer);
    cameraTimestampTimer = null;
  }
  navigateTo("homePage", { resetStack: true });
}

function showCatPage() {
  selectedCatId = null;
  currentRoomIndex = null;
  navigateTo("catPage");
}

// =========================
// Cat Settings Modal (visibility on Cat page)
// =========================
function openCatSettings() {
  const overlay = document.getElementById("catSettingsOverlay");
  const modal = document.getElementById("catSettingsModal");
  const list = document.getElementById("catSettingsList");
  if (!overlay || !modal || !list) return;

  // build list from DB field: cats.display_status (1=show,0=hide)
  if (!Array.isArray(cats) || cats.length === 0) {
    list.innerHTML = `<div class="cat-settings-empty">ยังไม่มีข้อมูลแมว</div>`;
  } else {
    const sorted = cats.slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    let html = "";
    sorted.forEach((c) => {
      const name = String(c?.name || "").trim();
      if (!name) return;
      const checked = Number(c?.display_status) === 1;
      const img = getCatDisplayImage(c);
      const id = `catVis_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      html += `
        <label class="cat-settings-item" for="${escapeAttr(id)}">
          <input type="checkbox" id="${escapeAttr(id)}" data-cat-name="${escapeAttr(name)}" ${checked ? "checked" : ""}>
          <img src="${escapeAttr(img)}" alt="${escapeAttr(name)}" class="cat-settings-thumb">
          <span class="cat-settings-name">${escapeHtml(name)}</span>
        </label>
      `;
    });
    list.innerHTML = html || `<div class="cat-settings-empty">ยังไม่มีข้อมูลแมว</div>`;
  }

  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");
}function closeCatSettings() {
  const overlay = document.getElementById("catSettingsOverlay");
  const modal = document.getElementById("catSettingsModal");
  if (overlay) overlay.classList.add("hidden");
  if (modal) modal.classList.add("hidden");
}

function toggleAllCatSettings(isOn) {
  const list = document.getElementById("catSettingsList");
  if (!list) return;
  list.querySelectorAll('input[type="checkbox"][data-cat-name]').forEach((cb) => {
    cb.checked = !!isOn;
  });
}

function saveCatSettings() {
  const list = document.getElementById("catSettingsList");
  if (!list) return;

  const selected = [];
  list.querySelectorAll('input[type="checkbox"][data-cat-name]').forEach((cb) => {
    if (cb.checked) selected.push(String(cb.dataset.catName || cb.getAttribute("data-cat-name") || "").trim());
  });

  fetchJsonChecked(ENDPOINTS.catsDisplayStatus, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selected: selected.filter((x) => x) }),
  })
    .then(() => {
      closeCatSettings();
      updateCatData();
    })
    .catch((err) => {
      console.error("saveCatSettings error:", err);
      alert(err?.message || "บันทึกการตั้งค่าแมวไม่สำเร็จ");
    });
}
function showProfilePage() {
  navigateTo("profilePage");
}

function showSystemConfigPage() {
  navigateTo("systemConfigPage");
}

/* =========================
 * 7.1) ALERTS & NOTIFICATIONS
 * ========================= */

/**
 * แสดงหน้าเพียงหน้าเดียว (ซ่อนทุกหน้าอื่น)
 * ใช้กับ Alerts/Notifications เพื่อไม่รีเซ็ต state เหมือน showHomePage()
 */
function _showOnlyPage(pageId) {
  const ids = [
    "homePage", "cameraPage", "catPage", "profilePage",
    "catDetailPage", "systemConfigPage", "notificationsPage",
    "notificationSettingsPage",
    "alertsPage", "statisticsPage", "timelinePage"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === pageId) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

/**
 * เปิดหน้า Alerts (ถ้ามี selectedCatId จะกรองเฉพาะแมวตัวนั้น)
 * lastPageId จะถูกจำไว้เพื่อย้อนกลับ
 */
function showAlertsPage() {
  lastPageId = getVisiblePageId();
  _showOnlyPage("alertsPage");
  loadAlertsList();
}

/**
 * เปิดหน้า Notifications (แสดงสรุปจำนวน Alerts ที่ยังไม่อ่าน)
 */
function showNotificationsPage() {
  _showOnlyPage("notificationsPage");
  loadNotificationsList();
}

/**
 * เปิดหน้า Notification Settings
 * - หน้านี้เอาไว้ตั้งค่า/ทดสอบ Push Notification
 */
function showNotificationSettings() {
  // Separate page for configuring/testing push notifications
  _showOnlyPage("notificationSettingsPage");
  refreshPushStatus();
  refreshLineStatus();
}

/**
 * ปุ่มย้อนกลับจากหน้า Alerts
 */
function goBackFromAlerts() {
  const target = lastPageId;
  lastPageId = null;

  if (!target) {
    showHomePage();
    return;
  }

  if (target === "homePage") return showHomePage();
  if (target === "catPage") return showCatPage();
  if (target === "profilePage") return showProfilePage();
  if (target === "systemConfigPage") return showSystemConfigPage();
  if (target === "notificationsPage") return showNotificationsPage();
  if (target === "notificationSettingsPage") return showNotificationSettings();
  if (target === "statisticsPage") return showCatStatisticsPage();
  if (target === "timelinePage") return showTimelinePage();

  // cat detail ต้องรักษา selectedCatId ไว้
  if (target === "catDetailPage") {
    _showOnlyPage("catDetailPage");
    return;
  }

  // fallback
  showHomePage();
}

/* ---------- Alerts data / render ---------- */

function _jsString(v) {
  // สำหรับใส่ใน onclick แบบปลอดภัย
  return JSON.stringify(String(v ?? ""));
}

function loadAlertsList() {
  const listEl = document.getElementById("alertsList");
  if (!listEl) return;

  listEl.innerHTML = `<div style="padding:10px; color:#666;">กำลังโหลด Alerts...</div>`;

  const qs = new URLSearchParams();
  qs.set("include_read", "1");
  qs.set("mode", "realtime");
  if (selectedCatId) qs.set("cat", selectedCatId);

  fetch(`${ENDPOINTS.alerts}?${qs.toString()}`)
    .then(r => r.json())
    .then(rows => {
      lastAlertsRaw = Array.isArray(rows) ? rows : [];
      renderAlertsList(lastAlertsRaw);
      // ถ้ามาจากหน้า Notifications และมี _focusAlertId ให้เลื่อนไปหา
      setTimeout(focusAlertIfNeeded, 50);
    })
    .catch(handleFetchError);
}

function renderAlertsList(rows) {
  const listEl = document.getElementById("alertsList");
  if (!listEl) return;

  const data = Array.isArray(rows) ? rows : [];
  if (data.length === 0) {
    listEl.innerHTML = `
      <div class="alert-item read" style="text-align:center;">
        ไม่มี Alerts ในขณะนี้
      </div>
    `;
    return;
  }

  // group by cat
  const byCat = new Map();
  for (const a of data) {
    const cat = a?.cat || a?.cat_name || "-";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(a);
  }

  // toolbar
  const toolbar = `
    <div class="alerts-toolbar" style="display:flex; gap:10px; margin-bottom:12px; align-items:center;">
      <button class="apply-filter-btn" onclick="markAllAlertsRead()" style="padding:10px 14px; border-radius:10px; border:none; cursor:pointer;">
        อ่านทั้งหมด${selectedCatId ? ` (${escapeHtml(selectedCatId)})` : ""}
      </button>
      <button class="clear-filter-btn" onclick="loadAlertsList()" style="padding:10px 14px; border-radius:10px; border:none; cursor:pointer;">
        รีเฟรช
      </button>
      <div style="margin-left:auto; color:#666; font-size:0.9rem;">
        แสดง ${data.length} รายการ
      </div>
    </div>
  `;

  let html = toolbar;

  const catsSorted = Array.from(byCat.keys()).sort((a, b) => String(a).localeCompare(String(b)));
  for (const cat of catsSorted) {
    const items = byCat.get(cat) || [];
    html += `<div class="alert-cat-group">`;
    html += `<div class="alert-cat-title">${escapeHtml(cat)}</div>`;
    html += `<div class="alert-items">`;

    for (const a of items) {
      const id = a?.id;
      const type = a?.type || a?.alert_type || "-";
      const msg = a?.message || "-";
      const isRead = Number(a?.is_read) === 1;
      const createdAt = a?.created_at || "";
      const high = (type === "no_cat" || type === "no_eating");

      html += `
        <div class="alert-item ${isRead ? "read" : ""} ${high ? "high-priority" : ""}" data-id="${escapeHtml(id)}">
          <div class="alert-line">
            <span class="alert-type-tag">${escapeHtml(type)}</span>
            <span style="font-weight:700; color:#333;">${escapeHtml(msg)}</span>
          </div>
          <div style="margin-top:8px; color:#777; font-size:0.85rem;">
            ${escapeHtml(createdAt)}
          </div>
          ${!isRead ? `
            <div style="margin-top:12px;">
              <button onclick="markAlertRead(${Number(id)}, event)"
                style="padding:8px 12px; border-radius:10px; border:none; cursor:pointer;">
                ทำเครื่องหมายอ่านแล้ว
              </button>
            </div>
          ` : ``}
        </div>
      `;
    }

    html += `</div></div>`;
  }

  listEl.innerHTML = html;
}

function markAlertRead(id, ev) {
  if (ev) ev.stopPropagation();
  const alertId = Number(id);
  if (!Number.isFinite(alertId)) return;

  fetchJsonChecked(ENDPOINTS.alertsMarkRead, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [alertId] }),
  })
    .then(() => {
      loadAlertsList();
      if (!document.getElementById("notificationsPage")?.classList.contains("hidden")) {
        loadNotificationsList();
      }
    })
    .catch(handleFetchError);
}

function markAllAlertsRead() {
  const qs = new URLSearchParams();
  if (selectedCatId) qs.set("cat", selectedCatId);

  const url = qs.toString()
    ? `${ENDPOINTS.alertsMarkAllRead}?${qs.toString()}`
    : ENDPOINTS.alertsMarkAllRead;

  fetchJsonChecked(url, { method: "PATCH" })
    .then(() => {
      loadAlertsList();
      if (!document.getElementById("notificationsPage")?.classList.contains("hidden")) {
        loadNotificationsList();
      }
    })
    .catch(handleFetchError);
}

/* ---------- Notifications data / render ---------- */

function loadNotificationsList() {
  const listEl = document.getElementById("notificationsList");
  if (!listEl) return;

  listEl.innerHTML = `<div style="padding:10px; color:#666;">กำลังโหลด Notifications...</div>`;

  const qs = new URLSearchParams();
  qs.set("include_read", "0");
  qs.set("mode", "realtime");

  fetch(`${ENDPOINTS.alerts}?${qs.toString()}`)
    .then(r => r.json())
    .then(rows => {
      const data = Array.isArray(rows) ? rows : [];
      renderNotificationsList(data);
    })
    .catch(handleFetchError);
}

function renderNotificationsList(unreadAlerts) {
  const listEl = document.getElementById("notificationsList");
  if (!listEl) return;

  const data = Array.isArray(unreadAlerts) ? unreadAlerts : [];

  // Filter by "active cats" (cats.display_status = 1) so hidden cats won't appear in Notifications.
  // ถ้า cats ยังไม่ถูกโหลด (active.length===0) จะไม่ filter เพื่อกันหน้าเงียบผิดพลาดตอนโหลดครั้งแรก
  const eligible = getStatsEligibleCats();
  const active = eligible.length ? eligible : getActiveCats();
  let filtered = data;
  if (active.length > 0) {
    const activeSet = new Set(active.map(c => String(c?.name || "").trim()).filter(x => x));
    filtered = data.filter(a => {
      const cat = String(a?.cat || a?.cat_name || "-").trim();
      return activeSet.has(cat);
    });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="notification-item" style="text-align:center;">
        ไม่มี Notifications (ยังไม่อ่าน) ในขณะนี้
      </div>
    `;
    return;
  }

  // group by cat + store latest id for focus
  const map = new Map(); // cat -> {count, latestId, latestAt}
  for (const a of filtered) {
    const cat = a?.cat || a?.cat_name || "-";
    const id = Number(a?.id);
    const at = String(a?.created_at || "");
    if (!map.has(cat)) {
      map.set(cat, { count: 0, latestId: id, latestAt: at });
    }
    const obj = map.get(cat);
    obj.count += 1;

    // update latest (string compare ok if ISO datetime)
    if (at && (!obj.latestAt || at > obj.latestAt)) {
      obj.latestAt = at;
      obj.latestId = id;
    }
  }

  const catsSorted = Array.from(map.keys()).sort((a, b) => String(a).localeCompare(String(b)));
  let html = "";
  for (const cat of catsSorted) {
    const { count, latestId, latestAt } = map.get(cat);
    // IMPORTANT:
    // อย่าใช้ onclick="..." พร้อมส่ง string ที่มี double quote (จาก JSON.stringify)
    // เพราะจะทำให้ HTML attribute แตก เช่น onclick="fn("Orange")" แล้วคลิกไม่ทำงาน
    // วิธีแก้ที่ง่ายที่สุดคือเปลี่ยน attribute ทั้งก้อนให้ใช้ single quote ครอบแทน
    html += `
      <div class="notification-item unread"
           onclick='openAlertsFromNotification(${_jsString(cat)}, ${Number(latestId)})'
           style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
        <div>
          <div style="font-weight:800; color:#333;">🐱 ${escapeHtml(cat)}</div>
          <div style="margin-top:6px; color:#666;">
            มี Alerts ที่ยังไม่อ่าน ${count} รายการ
            ${latestAt ? ` • ล่าสุด: ${escapeHtml(latestAt)}` : ""}
          </div>
        </div>
        <div class="notification-badge">${count}</div>
      </div>
    `;
  }

  listEl.innerHTML = html;
}

function openAlertsFromNotification(catName, focusAlertId) {
  selectedCatId = catName;
  _focusAlertId = Number(focusAlertId) || null;
  showAlertsPage();
}


/* =========================
 * 8) HAMBURGER MENU
 * ========================= */
function toggleMenu() {
  const menu = document.getElementById("navMenu");
  const overlay = document.getElementById("menuOverlay");
  const hamburgerBtn = document.querySelector(".hamburger-btn");

  if (menu.classList.contains("hidden")) {
    menu.classList.remove("hidden");
    menu.classList.add("show");
    overlay.classList.add("show");
    hamburgerBtn.classList.add("active");
    hamburgerBtn.innerHTML = "X";
  } else {
    closeMenu();
  }
}

function closeMenu() {
  const menu = document.getElementById("navMenu");
  const overlay = document.getElementById("menuOverlay");
  const hamburgerBtn = document.querySelector(".hamburger-btn");

  menu.classList.remove("show");
  overlay.classList.remove("show");
  hamburgerBtn.classList.remove("active");
  hamburgerBtn.innerHTML = "☰";

  setTimeout(() => menu.classList.add("hidden"), 300);
}

/* =========================
 * 9) STATISTICS (NO SLEEP)
 * ========================= */
let statsChartInstance = null;
let availableYears = [];  // ปีทั้งหมดใน DB (ASC)

function showCatStatisticsPage() {
  loadStatsPrefixes().finally(() => {
    ensureSelectedCatIsActive();
    if (!selectedCatId) { alert("กรุณาเลือกแมวก่อน"); return; }

    document.getElementById("catDetailPage")?.classList.add("hidden");
    document.getElementById("statisticsPage")?.classList.remove("hidden");

    const titleEl = document.getElementById("statisticsTitle");
    if (titleEl) titleEl.textContent = `${selectedCatId}'s Statistics`;

    const catSel = document.getElementById("catSelect");
    if (catSel) {
      catSel.innerHTML = "";
      const list = (getStatsEligibleCats().length ? getStatsEligibleCats() : getActiveCats());
      list.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.name; opt.textContent = c.name;
        if (c.name === selectedCatId) opt.selected = true;
        catSel.appendChild(opt);
      });
      catSel.onchange = () => {
        selectedCatId = catSel.value;
        if (titleEl) titleEl.textContent = `${selectedCatId}'s Statistics`;
        updateStatistics();
      };
    }

    const MONTHS = [
      ["01","ม.ค."],["02","ก.พ."],["03","มี.ค."],["04","เม.ย."],["05","พ.ค."],["06","มิ.ย."],
      ["07","ก.ค."],["08","ส.ค."],["09","ก.ย."],["10","ต.ค."],["11","พ.ย."],["12","ธ.ค."]
    ];
    const monthEl = document.getElementById("monthSelect");
    if (monthEl) {
      monthEl.innerHTML = "";
      MONTHS.forEach(([v,t]) => {
        const opt = document.createElement("option");
        opt.value = v; opt.textContent = t; monthEl.appendChild(opt);
      });
      const now = new Date();
      monthEl.value = String(now.getMonth()+1).padStart(2,"0");
    }

    fetch(`${API_BASE}/api/statistics/years`)
      .then(r => r.json())
      .then(({years}) => {
        availableYears = (years || []).slice();
        const startSel = document.getElementById("yearStartSelect");
        const endSel   = document.getElementById("yearSelect");
        [startSel, endSel].forEach(sel => {
          if (!sel) return;
          sel.innerHTML = "";
          availableYears.forEach(y => {
            const opt = document.createElement("option");
            opt.value = String(y); opt.textContent = String(y);
            sel.appendChild(opt);
          });
        });

        if (availableYears.length) {
          const minY = availableYears[0], maxY = availableYears[availableYears.length-1];
          if (startSel) startSel.value = String(minY);
          if (endSel)   endSel.value   = String(maxY);
        }

        const periodEl = document.getElementById("periodSelect");
        if (periodEl) {
          periodEl.value = "daily";
          periodEl.onchange = updateDateFilter;
        }
        updateDateFilter();
        updateStatistics();
      })
      .catch(handleFetchError);
  });
}

function updateDateFilter() {
  const period = document.getElementById("periodSelect")?.value || "daily";

  // ซ่อนทุกตัวก่อน
  ["yearSelect","monthSelect","yearStartSelect","dateRangeWrapper"].forEach(hideEl);

  if (period === "daily") {
    showEl("yearSelect");
    showEl("monthSelect");
  } else if (period === "monthly") {
    showEl("yearSelect");
  } else if (period === "yearly") {
    showEl("yearStartSelect");
    showEl("yearSelect");
  } else if (period === "range") {
    showEl("dateRangeWrapper");
  }
}


function updateStatistics() {
  searchStatistics();
}

function searchStatistics() {
  if (!selectedCatId) return;
  const qs = new URLSearchParams();
  qs.set("cat", selectedCatId);

  const period = document.getElementById("periodSelect").value;
  qs.set("period", period);

  if (period === "range") {
    // 1) ถ้าเลือกผ่านปฏิทิน (flatpickr) จะได้ selectedDates 2 ค่า
    if (dateRangePicker && Array.isArray(dateRangePicker.selectedDates) && dateRangePicker.selectedDates.length === 2) {
      const [sDate, eDate] = dateRangePicker.selectedDates;
      const sISO = toISODateLocal(sDate);
      const eISO = toISODateLocal(eDate);

      if (!sISO || !eISO) {
        alert("กรุณาเลือกช่วงวันที่ให้ถูกต้อง (รูปแบบ dd/mm/yyyy - dd/mm/yyyy)");
        return;
      }
      if (sISO > eISO) {
        alert("วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด");
        return;
      }

      qs.set("start_date", sISO);
      qs.set("end_date", eISO);
    } else {
      // 2) fallback: พิมพ์เอง dd/mm/yyyy - dd/mm/yyyy
      const raw = document.getElementById("dateRange")?.value || "";
      const parsed = parseRangeInputToISO(raw);

      if (!parsed) {
        alert("กรุณาเลือกช่วงวันที่ให้ถูกต้อง (รูปแบบ dd/mm/yyyy - dd/mm/yyyy)");
        return;
      }
      if (parsed.startISO > parsed.endISO) {
        alert("วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด");
        return;
      }

      qs.set("start_date", parsed.startISO);
      qs.set("end_date", parsed.endISO);
    }
  } else if (period === "daily") {
    qs.set("year", document.getElementById("yearSelect").value);
    qs.set("month", document.getElementById("monthSelect").value);
  } else if (period === "monthly") {
    qs.set("year", document.getElementById("yearSelect").value);
  } else if (period === "yearly") {
    qs.set("start_year", document.getElementById("yearStartSelect").value);
    qs.set("end_year", document.getElementById("yearSelect").value);
  }

  fetch(`${API_BASE}/api/statistics?${qs.toString()}`)
    .then(r => r.json())
    .then(drawStatisticsAligned)
    .catch(handleFetchError);
}


/* ===== Chart.js dataset helper (ต่อเส้นข้าม null แต่ตัดเส้นที่เป็น 0) ===== */
function makeStatsLineDataset(label, dataArr, opts = {}) {
  const borderWidth = Number.isFinite(opts.borderWidth) ? opts.borderWidth : 2;
  const pointSize   = Number.isFinite(opts.pointSize) ? opts.pointSize : 2;
  const hoverSize   = Number.isFinite(opts.hoverSize) ? opts.hoverSize : 4;
  const order       = Number.isFinite(opts.order) ? opts.order : undefined;
  const borderDash  = Array.isArray(opts.borderDash) ? opts.borderDash : undefined;
  const pointBorderWidth = Number.isFinite(opts.pointBorderWidth) ? opts.pointBorderWidth : 0;
  const pointFill = (opts.pointFill === false) ? false : true;

  return {
    label,
    // แปลง 0 -> null เพื่อไม่ให้เกิดเส้น/จุดจาก baseline (เช่น 0->1)
    data: (dataArr || []).map(v => (v === 0 ? null : v)),
    borderWidth,
    ...(borderDash ? { borderDash } : {}),
    tension: 0.2,
    spanGaps: true, // ✅ ลากเส้นข้าม null (วัน/เดือนที่ไม่มีข้อมูล)

    // ✅ ซ่อนจุดที่เป็น null หรือ 0
    pointRadius: (c) => {
      const v = c.raw;
      if (v === null || v === undefined) return 0;
      if (v === 0) return 0;
      return pointSize;
    },
    pointHoverRadius: (c) => {
      const v = c.raw;
      if (v === null || v === undefined) return 0;
      if (v === 0) return 0;
      return hoverSize;
    },

    pointBorderWidth,
    ...(pointFill ? {} : { pointBackgroundColor: "rgba(0,0,0,0)" }),


    // ✅ กันไว้กรณีข้อมูลยังมี 0 หลุดมา: ตัดเส้นผ่าน "0"
    segment: {
      borderColor: (ctx) => {
        const y0 = ctx.p0?.parsed?.y;
        const y1 = ctx.p1?.parsed?.y;
        if (y0 === 0 || y1 === 0) return "rgba(0,0,0,0)";
        return undefined; // ใช้สี default ของ dataset
      }
    },

    ...(order !== undefined ? { order } : {})
  };
}
/* ===== renderer รายวันเดียว ใช้ทั้ง daily & range (NO SLEEP) ===== */
function renderDailyLine(labelsYMD, raw) {
  const rawLabels = raw.labels || [];
  const series    = raw.series || {};

  const eat = alignSeries(labelsYMD, rawLabels, series.eatCount || []);
  const exc = alignSeries(labelsYMD, rawLabels, series.excreteCount || []);

  const ctx = document.getElementById("statsChart");
  if (statsChartInstance) { statsChartInstance.destroy(); statsChartInstance = null; }

  statsChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labelsYMD,
      datasets: [
        makeStatsLineDataset("Excrete (count)", exc, { borderWidth: 4, pointSize: 3.5, hoverSize: 4.5, pointBorderWidth: 1.5, pointFill: false, order: 1, borderDash: [8, 6] }),
        makeStatsLineDataset("Eat (count)", eat, { borderWidth: 1.5, pointSize: 2, hoverSize: 3, pointBorderWidth: 0, pointFill: true, order: 2 })
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { title: { display: true, text: "Date" }, ticks: { autoSkip: true, autoSkipPadding: 16, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: "Count" } }
      },
      plugins: { legend: { position: "bottom" }, tooltip: { mode: "index", intersect: false } }
    }
  });

  // Summary cards: average per selected unit
  // NOTE: average is computed only from buckets that have data (non-null)
  const curPeriod = document.getElementById("periodSelect")?.value || "daily";
  updateSummaryCardsFromSeries(curPeriod, eat, exc);
}

/* ===== วาดกราฟ + จัดช่วงให้ตรงสเปค ===== */
function drawStatisticsAligned(data) {
  if (!data) return;
  const period = document.getElementById("periodSelect")?.value || "daily";

  if (period === "range") {
    const parsed = getSelectedRangeISO();
    if (!parsed) return;
    if (parsed.startISO > parsed.endISO) return;
    const labels = buildDateListInclusive(parsed.startISO, parsed.endISO);
    renderDailyLine(labels, data);
    return;
  }

  if (period === "daily") {
    const year  = document.getElementById("yearSelect")?.value || String(new Date().getFullYear());
    const month = document.getElementById("monthSelect")?.value || String(new Date().getMonth()+1).padStart(2,"0");
    const end = lastDayOfYearMonth(year, month);
    const days = end.getDate();
    const labels = Array.from({ length: days }, (_, i) => `${year}-${month}-${String(i + 1).padStart(2,"0")}`);
    renderDailyLine(labels, data);
    return;
  }

  // monthly / yearly
  const year   = document.getElementById("yearSelect")?.value || "";
  const startY = document.getElementById("yearStartSelect")?.value || "";

  let targetLabels = [];
  if (period === "monthly") {
    targetLabels = [...Array(12)].map((_,i) => `${String(year).padStart(4,"0")}-${String(i+1).padStart(2,"0")}`);
  } else { // yearly
    const s = parseInt(startY || (availableYears[0] || new Date().getFullYear()), 10);
    const e = parseInt(year   || (availableYears[availableYears.length-1] || s), 10);
    targetLabels = rangeYears(Math.min(s,e), Math.max(s,e)).map(y => String(y));
  }

  const rawLabels = data.labels || [];
  const S = data.series || {};
  const eat = alignSeries(targetLabels, rawLabels, S.eatCount || []);
  const exc = alignSeries(targetLabels, rawLabels, S.excreteCount || []);

  const ctx = document.getElementById("statsChart");
  if (statsChartInstance) { statsChartInstance.destroy(); statsChartInstance = null; }

  statsChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: targetLabels,
      datasets: [
        makeStatsLineDataset("Excrete (count)", exc, { borderWidth: 4, pointSize: 3.5, hoverSize: 4.5, pointBorderWidth: 1.5, pointFill: false, order: 1, borderDash: [8, 6] }),
        makeStatsLineDataset("Eat (count)", eat, { borderWidth: 1.5, pointSize: 2, hoverSize: 3, pointBorderWidth: 0, pointFill: true, order: 2 })
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, title: { display: true, text: "Count" } } },
      plugins: { legend: { position: "bottom" }, tooltip: { mode: "index", intersect: false } },
      interaction: { mode: "index", intersect: false }
    }
  });

  // Summary cards: average per selected unit
  // NOTE: average is computed only from buckets that have data (non-null)
  updateSummaryCardsFromSeries(period, eat, exc);
}

/* ===== Helpers ===== */
function alignSeries(targetLabels, rawLabels, rawSeries) {
  // สเปค:
  // - ถ้า "ไม่มีข้อมูล" ของวัน/เดือนนั้น => คืนค่าเป็น null (ไม่แสดงจุด) และให้ Chart.js ลากเส้นข้ามด้วย spanGaps
  // - ถ้า "มีข้อมูลจริง" และค่าเป็น 0 => คืนค่า 0 (แต่จะซ่อนจุด + ตัดเส้นผ่าน 0 ด้วย segment callback)
  const m = new Map();
  rawLabels.forEach((lb, i) => {
    const v = rawSeries[i];
    if (v === null || v === undefined) return;
    const n = Number(v);
    if (Number.isFinite(n)) m.set(String(lb), n);
  });

  return targetLabels.map((lb) => {
    const key = String(lb);
    return m.has(key) ? Number(m.get(key)) : null;
  });
}


function sum(arr) {
  // รวมเฉพาะค่าที่เป็นตัวเลข (ข้าม null)
  return (arr || []).reduce((a, b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0);
}

function lastDayOfYearMonth(y, m) {
  const Y = parseInt(y || new Date().getFullYear(), 10);
  const M = parseInt(m || (new Date().getMonth()+1), 10);
  return new Date(Y, M, 0);
}
function lastNDates(endDate, N) {
  const out = [];
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  for (let i = N-1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(d);
  }
  return out;
}
function fmtYMD(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}



function initDateRangePicker() {
  const el = document.getElementById("dateRange");
  if (!el) return;

  // ใช้ flatpickr (โหลดจาก CDN ใน index.html) เพื่อให้มี calendar popup และเลือกช่วง (range)
  if (window.flatpickr) {
    dateRangePicker = window.flatpickr(el, {
      mode: "range",
      dateFormat: "d/m/Y",
      allowInput: true,
      rangeSeparator: " - "
    });
  } else {
    // fallback: ยังพิมพ์เองได้ตาม placeholder
    dateRangePicker = null;
  }
}

function openDateRangePicker() {
  if (dateRangePicker && typeof dateRangePicker.open === "function") {
    dateRangePicker.open();
    return;
  }
  document.getElementById("dateRange")?.focus();
}

function toISODateLocal(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseRangeInputToISO(rangeStr) {
  const s = String(rangeStr || "").trim();
  if (!s) return null;

  const m = s.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/);
  if (!m) return null;

  const startISO = parseDMYToISO(m[1]);
  const endISO = parseDMYToISO(m[2]);
  if (!startISO || !endISO) return null;

  return { startISO, endISO };
}

/**
 * ดึงช่วงวันที่ที่ user เลือกจาก UI (Statistics -> period=range)
 * รองรับทั้งเลือกจากปฏิทิน (flatpickr) และพิมพ์เองในช่อง dateRange
 * @returns {{startISO:string,endISO:string}|null}
 */
function getSelectedRangeISO() {
  // 1) ถ้าเลือกผ่านปฏิทิน (flatpickr) จะได้ selectedDates 2 ค่า
  if (dateRangePicker && Array.isArray(dateRangePicker.selectedDates) && dateRangePicker.selectedDates.length === 2) {
    const [sDate, eDate] = dateRangePicker.selectedDates;
    const startISO = toISODateLocal(sDate);
    const endISO = toISODateLocal(eDate);
    if (!startISO || !endISO) return null;
    return { startISO, endISO };
  }

  // 2) fallback: พิมพ์เอง dd/mm/yyyy - dd/mm/yyyy
  const raw = document.getElementById("dateRange")?.value || "";
  return parseRangeInputToISO(raw);
}


function parseDMYToISO(dmy) {
  // รับรูปแบบ dd/mm/yyyy แล้วคืนค่า yyyy-mm-dd (หรือ null ถ้าไม่ถูกต้อง)
  const s = String(dmy || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (yyyy < 1900 || yyyy > 3000) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;

  // validate real date
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || (dt.getMonth() + 1) !== mm || dt.getDate() !== dd) return null;
  return fmtYMD(dt);
}
function rangeYears(s,e){ const out=[]; for(let y=s; y<=e; y++) out.push(y); return out; }
function buildDateListInclusive(startISO, endISO) {
  const res = [];
  let d = new Date(startISO);
  const end = new Date(endISO);
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= endNorm) {
    res.push(fmtYMD(d));
    d.setDate(d.getDate() + 1);
  }
  return res;
}

function goBackFromStatistics() {
  document.getElementById("statisticsPage")?.classList.add("hidden");
  document.getElementById("catDetailPage")?.classList.remove("hidden");
  document.getElementById("systemConfigPage")?.classList.add("hidden");
}


/* =========================
 * 9.2) TIMELINE (10s slots) - per-slot scroll
 * ========================= */

/* =====================
 * TIMELINE (10s / 1h)
 * ===================== */

function showEl(id){ const el=document.getElementById(id); if(el) el.classList.remove("hidden"); }
function hideEl(id){ const el=document.getElementById(id); if(el) el.classList.add("hidden"); }
function escapeHtml(s){
  const str = String(s ?? "");
  return str
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function escapeAttr(s) {
  // ใช้สำหรับใส่ใน attribute HTML
  return escapeHtml(String(s ?? "")).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


let timelineBefore = null;        // cursor (datetime string) to load older slots (10s view)
let timelineHasMore = true;
let timelineIsLoading = false;
let timelineAutoTimer = null;
const TIMELINE_PAGE_SIZE = 500
const TIMELINE_MAX_ROWS = 5000;   // 300 slots = ~50 นาที (10s/slot)

function getTimelineGranularity() {
  const el = document.getElementById("timelineGranularity");
  return (el?.value || "10s");
}

function setTimelineGranularity(val) {
  const el = document.getElementById("timelineGranularity");
  if (el) el.value = val;
}

function showTimelinePage() {
  // hide others
  [
    "homePage","cameraPage","catPage","profilePage","catDetailPage",
    "systemConfigPage","notificationsPage","alertsPage","statisticsPage"
  ].forEach(id => document.getElementById(id)?.classList.add("hidden"));

  document.getElementById("timelinePage")?.classList.remove("hidden");

  // default date = today
  const dateEl = document.getElementById("timelineDate");
  if (dateEl && !dateEl.value) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    dateEl.value = `${yyyy}-${mm}-${dd}`;
  }

  // bind change granularity (กัน bind ซ้ำด้วย flag)
  const granEl = document.getElementById("timelineGranularity");
  if (granEl && !granEl.dataset.bound) {
    granEl.addEventListener("change", () => reloadTimeline());
    granEl.dataset.bound = "1";
  }

  updateTimelineTitle();
  reloadTimeline();
}

function updateTimelineTitle() {
  const titleEl = document.getElementById("timelineTitle");
  if (!titleEl) return;

  const g = getTimelineGranularity();
  const gLabel = (g === "1h") ? "1 ชั่วโมง" : "10 วินาที";
  const name = selectedCatId ? selectedCatId : "ทุกสี/ทุกตัว";
  titleEl.textContent = `Timeline: ${name} (${gLabel})`;
}

function reloadTimeline() {
  updateTimelineTitle();

  const g = getTimelineGranularity();

  // toggle view
  const listEl = document.getElementById("timelineList");
  const tableWrap = document.getElementById("timelineTableWrap");
  if (g === "1h") {
    // show table
    listEl?.classList.add("hidden");
    tableWrap?.classList.remove("hidden");
    hideEl("timelineEnd");
    stopTimelineAutoRefresh();
    loadTimelineTable();
    return;
  }

  // 10s view needs selected cat
  if (!selectedCatId) {
    alert("โหมด 10 วินาที ต้องเลือกแมวก่อน — จะสลับเป็นโหมด 1 ชั่วโมงให้");
    setTimelineGranularity("1h");
    reloadTimeline();
    return;
  }

  tableWrap?.classList.add("hidden");
  listEl?.classList.remove("hidden");

  // reset state
  timelineBefore = null;
  timelineHasMore = true;
  timelineIsLoading = false;
  if (listEl) listEl.innerHTML = "";
  hideEl("timelineEnd");
  loadTimelineAll(true);

  const autoEl = document.getElementById("timelineAutoRefresh");
  if (autoEl?.checked) startTimelineAutoRefresh();
  else stopTimelineAutoRefresh();
}

function startTimelineAutoRefresh() {
  stopTimelineAutoRefresh();
  timelineAutoTimer = setInterval(() => {
    const list = document.getElementById("timelineList");
    if (!list) return;
    if (list.scrollTop <= 30) {
      // reload latest chunk (reset cursor)
      timelineBefore = null;
      timelineHasMore = true;
      list.innerHTML = "";
      hideEl("timelineEnd");
      loadTimelineAll(true);
    }
  }, 8000);
}

function stopTimelineAutoRefresh() {
  if (timelineAutoTimer) clearInterval(timelineAutoTimer);
  timelineAutoTimer = null;
}

function goBackFromTimeline() {
  stopTimelineAutoRefresh();
  showCatPage();
}

/* ---------- 10s view ---------- */

function loadTimelineAll(resetScrollTop) {
  // Load chunks repeatedly until no more (or reached max)
  const step = () => {
    const loaded = document.querySelectorAll("#timelineList .timeline-row").length;
    if (!timelineHasMore || loaded >= TIMELINE_MAX_ROWS) return;
    // Wait a moment to keep UI responsive
    setTimeout(() => loadTimelineChunk(false), 50);
    // Schedule next check
    setTimeout(step, 150);
  };
  loadTimelineChunk(resetScrollTop);
  setTimeout(step, 200);
}

function loadTimelineChunk(resetScrollTop) {
  if (timelineIsLoading || !timelineHasMore) return;
  timelineIsLoading = true;
  showEl("timelineLoading");

  const date = document.getElementById("timelineDate")?.value;
  const params = new URLSearchParams();
  params.set("cat", selectedCatId);
  if (date) params.set("date", date);
  params.set("limit", String(TIMELINE_PAGE_SIZE));
  if (timelineBefore) params.set("before", timelineBefore);

  const url = `${ENDPOINTS.timeline}?${params.toString()}`;
  fetch(url)
    .then(r => r.json())
    .then(payload => {
      const rows = payload?.rows || [];
      timelineHasMore = !!payload?.has_more;
      timelineBefore = payload?.next_before || null;

      renderTimelineListRows(rows);

      const meta = document.getElementById("timelineMeta");
      if (meta) {
        const day = payload?.date || date || "-";
        const loaded = document.querySelectorAll("#timelineList .timeline-row").length;
        meta.textContent = `วันที่: ${day} | โหลดแล้ว: ${loaded} แถว | แสดง: 10 วินาที`;
      }

      if (!timelineHasMore) showEl("timelineEnd");

      if (resetScrollTop) {
        const list = document.getElementById("timelineList");
        if (list) list.scrollTop = 0;
      }
    })
    .catch(err => {
      console.error("loadTimelineChunk error:", err);
      alert("โหลด timeline ไม่สำเร็จ");
    })
    .finally(() => {
      timelineIsLoading = false;
      hideEl("timelineLoading");
    });
}

function renderTimelineListRows(rows) {
  const list = document.getElementById("timelineList");
  if (!list) return;

  for (const r of rows) {
    const timeTxt = (r.date_slot || "-");
    const roomTxt = (r.room || "-");
    const actTxt = (r.activity || "-");
    const st = (r.status || "-").toUpperCase();

    const row = document.createElement("div");
    row.className = "timeline-row";

    const statusClass = (st === "F") ? "st-found" : (st === "NF") ? "st-notfound" : "st-unknown";

    row.innerHTML = `
      <div class="tl-time">${escapeHtml(timeTxt)}</div>
      <div class="tl-room">${escapeHtml(roomTxt)}</div>
      <div class="tl-activity">${escapeHtml(actTxt)}</div>
      <div class="tl-status ${statusClass}">${escapeHtml(st)}</div>
    `;
    list.appendChild(row);
  }
}

// infinite scroll for 10s view
document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("timelineList");
  if (!list) return;

  list.addEventListener("scroll", () => {
    // only when 10s view is active
    if (getTimelineGranularity() !== "10s") return;

    const nearBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
    if (nearBottom) loadTimelineChunk(false);
  });
});

/* ---------- 1h view (table) ---------- */
function loadTimelineTable() {
  showEl("timelineLoading");

  const date = document.getElementById("timelineDate")?.value;
  const params = new URLSearchParams();
  if (date) params.set("date", date);

  const url = `${ENDPOINTS.timelineTable}?${params.toString()}`;
  fetch(url)
    .then(r => r.json())
    .then(payload => {
      const meta = document.getElementById("timelineMeta");
      if (meta) {
        meta.textContent = `วันที่: ${payload?.date || (date || "-")} | แสดง: รายชั่วโมง (00-23)`;
      }
      renderTimelineHourTable(payload);
    })
    .catch(err => {
      console.error("loadTimelineTable error:", err);
      alert("โหลดตาราง timeline ไม่สำเร็จ");
    })
    .finally(() => hideEl("timelineLoading"));
}

function renderTimelineHourTable(payload) {
  const table = document.getElementById("timelineTable");
  if (!table) return;

  const day = payload?.date || "-";
  const hours = payload?.hours || [];
  const rows = payload?.rows || [];

  // header (ไม่มีคอลัมน์ Activities)
  const thead = `<thead><tr>
    <th class="sticky-col col-date">Date</th>
    <th class="sticky-col-2 col-color">Color</th>
    <th class="sticky-col-3 col-cat">Cat_Name</th>
    ${hours.map(h => `<th class="hour-col">${h}.00</th>`).join("")}
  </tr></thead>`;

  // body
  let tbody = `<tbody>`;
  for (const r of rows) {
    const color = r.color || "-";
    const catName = r.cat_name || "-";
    const cells = r.cells || {};

    tbody += `<tr>
      <td class="sticky-col col-date">${day}</td>
      <td class="sticky-col-2 col-color">${escapeHtml(color)}</td>
      <td class="sticky-col-3 col-cat">${escapeHtml(catName)}</td>
      ${hours.map(h => {
        const val = cells[h] ?? "-";
        // val อาจมี <br> อยู่แล้ว (จาก backend) จึงห้าม escape ทั้งก้อน
        if (val === "-" || val === "" || val == null) {
          return `<td class="movement-empty">-</td>`;
        }
        if (String(val).toLowerCase().includes("not found")) {
          return `<td class="movement-nf">${escapeHtml(val)}</td>`;
        }
        return `<td class="movement-cell">${val}</td>`;
      }).join("")}
    </tr>`;
  }
  tbody += `</tbody>`;

  table.innerHTML = thead + tbody;
}


/* =========================
 * 3.1) SYSTEM CONFIG (Global / Per-cat by color)
 * ========================= */
function populateConfigCatSelect() {
  const sel = document.getElementById("configCatSelect");
  if (!sel) return;

  const current = sel.value || "__global__";
  // เคลียร์ให้เหลือ option Global ก่อน
  sel.innerHTML = `<option value="__global__">Global (ค่ารวมระบบ)</option>`;

  const allCats = [...(cats || [])]
    .filter(c => c && c.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));

  for (const c of allCats) {
    const name = c.name;
    if (!name) continue;
    const color = c.color ? ` (${c.color})` : "";
    const hiddenTag = (String(c.display_status) === "1" || c.display_status === 1) ? "" : " • hidden";
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = `${name}${color}${hiddenTag}`;
    sel.appendChild(opt);
  }

  // restore selection if possible
  const opts = Array.from(sel.options).map(o => o.value);
  sel.value = opts.includes(current) ? current : "__global__";
}

// hook: เรียกทุกครั้งที่โหลด cats แล้ว เพื่อให้ dropdown พร้อมใช้งาน
(function hookCatsLoadForConfigSelect() {
  const _oldFetchCatDataFromAPI = fetchCatDataFromAPI;
  fetchCatDataFromAPI = function () {
    return _oldFetchCatDataFromAPI.apply(this, arguments);
  };

  // หลัง renderCatCards เสร็จ (ซึ่งอยู่ใน .then) เราไม่มี callback ตรง ๆ
  // เลยใช้ observer แบบเบา: เรียก populate ใน updateCatData + DOMContentLoaded ด้วย
})();

function getSelectedConfigScope() {
  const sel = document.getElementById("configCatSelect");
  if (!sel) return { scope: "global" };
  const v = sel.value || "__global__";
  if (v === "__global__") return { scope: "global" };
  const catName = v;

  // หา color เพื่อส่งให้ backend (backend จะ fallback ให้ถ้าไม่ส่ง)
  const cat = (cats || []).find(x => x && x.name === catName);
  const catColor = cat && cat.color ? cat.color : undefined;

  return { scope: "cat", catName, catColor };
}

function loadSystemConfig() {
  populateConfigCatSelect();

  const scopeInfo = getSelectedConfigScope();
  const qs = new URLSearchParams({ _ts: String(Date.now()) });
  if (scopeInfo.scope === "cat" && scopeInfo.catName) {
    qs.set("cat", scopeInfo.catName);
  }
  const url = `${ENDPOINTS.systemConfig}?${qs.toString()}`;

  fetch(url, { cache: "no-store" })
    .then(async (res) => {
      let data = null;
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) {
        throw new Error(data?.message || `โหลด system config ไม่สำเร็จ (HTTP ${res.status})`);
      }
      return data;
    })
    .then(cfg => {
      if (!cfg) return;
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };
      setVal("alertNoCat", cfg.alertNoCat);
      setVal("alertNoEating", cfg.alertNoEating);
      setVal("minExcretion", cfg.minExcretion);
      setVal("maxExcretion", cfg.maxExcretion);
      setVal("maxCats", cfg.maxCats);
      loadSystemConfigSummaries();
    })
    .catch((err) => {
      console.error("loadSystemConfig error:", err);
      alert(err?.message || "โหลด System Config ไม่สำเร็จ");
    });
}


function loadSystemConfigSummaries() {
  const wrap = document.getElementById("systemConfigSummaryList");
  if (!wrap) return;

  wrap.innerHTML = `<div class="summary-empty">กำลังโหลด...</div>`;

  const scopeInfo = getSelectedConfigScope();
  const qs = new URLSearchParams({ _ts: String(Date.now()) });
  if (scopeInfo.scope === "cat" && scopeInfo.catName) qs.set("cat", scopeInfo.catName);
  const url = `${ENDPOINTS.systemConfigSummaries}?${qs.toString()}`;

  fetch(url, { cache: "no-store" })
    .then(async (r) => {
      let data = null;
      try { data = await r.json(); } catch (_) {}
      if (!r.ok) {
        throw new Error(data?.message || `โหลดค่าสรุปไม่สำเร็จ (HTTP ${r.status})`);
      }
      return data;
    })
    .then(rows => {
      const data = Array.isArray(rows) ? rows : [];
      if (data.length === 0) {
        wrap.innerHTML = `<div class="summary-empty">ยังไม่มีค่าสรุปที่ซ้ำกัน ≥ 3 เดือน</div>`;
        return;
      }

      let html = `<table class="summary-table">
        <thead>
          <tr>
            <th>Cat</th>
            <th>Color</th>
            <th>alert_no_eat</th>
            <th>alert_no_excrete_max</th>
            <th>Months</th>
            <th>Latest</th>
            <th></th>
          </tr>
        </thead>
        <tbody>`;

      for (const r of data) {
        const catName = r?.catName || "-";
        const catColor = r?.catColor || "-";
        const alertNoEating = r?.alertNoEating ?? "-";
        const maxExcretion = r?.maxExcretion ?? "-";
        const months = r?.monthsCount ?? "-";
        const latest = r?.latestMonth ?? "-";

        html += `<tr>
          <td>${escapeHtml(catName)}</td>
          <td>${escapeHtml(catColor)}</td>
          <td>${escapeHtml(String(alertNoEating))}</td>
          <td>${escapeHtml(String(maxExcretion))}</td>
          <td>${escapeHtml(String(months))}</td>
          <td>${escapeHtml(String(latest))}</td>
          <td>
            <button class="summary-apply-btn"
              type="button"
              data-cat-color="${escapeAttr(catColor)}"
              data-cat-name="${escapeAttr(catName)}"
              data-alert-no-eating="${escapeAttr(String(alertNoEating))}"
              data-max-excretion="${escapeAttr(String(maxExcretion))}">
              แอดข้อมูลจากค่าสรุป
            </button>
          </td>
          </td>
        </tr>`;
      }

      html += `</tbody></table>`;
      wrap.innerHTML = html;
    })
    .catch(err => {
      console.error("loadSystemConfigSummaries error:", err);
      wrap.innerHTML = `<div class="summary-empty">โหลดค่าสรุปไม่สำเร็จ</div>`;
    });
}



function bindSystemConfigSummaryApply() {
  const wrap = document.getElementById("systemConfigSummaryList");
  if (!wrap || wrap.dataset.boundApply === "true") return;

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".summary-apply-btn");
    if (!btn) return;

    const catColor = btn.dataset.catColor || "";
    const catName = btn.dataset.catName || "";
    const alertNoEating = Number(btn.dataset.alertNoEating);
    const maxExcretion = Number(btn.dataset.maxExcretion);

    applySummaryConfig(catColor, catName, alertNoEating, maxExcretion);
  });

  wrap.dataset.boundApply = "true";
}

function showSummaryMessage(msg, kind = "info") {
  const wrap = document.getElementById("systemConfigSummaryList");
  if (!wrap) return;

  let box = document.getElementById("systemConfigSummaryMessage");
  if (!box) {
    box = document.createElement("div");
    box.id = "systemConfigSummaryMessage";
    box.className = "summary-msg";
    wrap.parentElement?.insertBefore(box, wrap);
  }

  box.classList.remove("ok", "err", "info");
  box.classList.add(kind);
  box.textContent = msg;
  box.style.display = "block";

  // auto hide after a while
  window.clearTimeout(showSummaryMessage._t);
  showSummaryMessage._t = window.setTimeout(() => {
    box.style.display = "none";
  }, 4000);
}
function applySummaryConfig(catColor, catName, alertNoEating, maxExcretion) {
  if (!catColor) {
    showSummaryMessage("ไม่พบสีแมว (catColor) สำหรับการแอดค่า", "err");
    return;
  }

  fetch(ENDPOINTS.systemConfigApplySummary, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catColor, catName, alertNoEating, maxExcretion }),
  })
    .then(async (r) => {
      let data = null;
      try {
        data = await r.json();
      } catch {
        // ignore
      }

      if (!r.ok) {
        const msg = data?.message || `แอดค่าจากค่าสรุปไม่สำเร็จ (HTTP ${r.status})`;
        showSummaryMessage(msg, "err");
        return;
      }

      showSummaryMessage("✅ แอดข้อมูลจากค่าสรุปเรียบร้อย", "ok");

      // reload current config + summaries
      loadSystemConfig();
      loadSystemConfigSummaries();
    })
    .catch((err) => {
      console.error("applySummaryConfig error:", err);
      showSummaryMessage("ไม่สามารถเชื่อมต่อ API ได้ กรุณาตรวจสอบว่า Flask ทำงานอยู่หรือไม่", "err");
    });
}

function saveSystemConfig() {
  const scopeInfo = getSelectedConfigScope();

  const getInt = (id) => {
    const el = document.getElementById(id);
    if (!el) return undefined;
    const v = parseInt(el.value, 10);
    return Number.isFinite(v) ? v : undefined;
  };

  const payload = {
    alertNoCat: getInt("alertNoCat"),
    alertNoEating: getInt("alertNoEating"),
    minExcretion: getInt("minExcretion"),
    maxExcretion: getInt("maxExcretion"),
    maxCats: getInt("maxCats"),
  };

  if (scopeInfo.scope === "cat") {
    payload.catName = scopeInfo.catName;
    if (scopeInfo.catColor) payload.catColor = scopeInfo.catColor;
  }

  fetch(ENDPOINTS.systemConfig, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      let data = null;
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) {
        throw new Error(data?.message || `บันทึกการตั้งค่าไม่สำเร็จ (HTTP ${res.status})`);
      }
      return data;
    })
    .then((result) => {
      const cfg = result?.config || null;
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };
      if (cfg) {
        setVal("alertNoCat", cfg.alertNoCat);
        setVal("alertNoEating", cfg.alertNoEating);
        setVal("minExcretion", cfg.minExcretion);
        setVal("maxExcretion", cfg.maxExcretion);
        setVal("maxCats", cfg.maxCats);
      }
      alert("✅ บันทึกการตั้งค่าเรียบร้อย");
      loadSystemConfig();
      loadSystemConfigSummaries();
    })
    .catch((err) => {
      console.error("saveSystemConfig error:", err);
      alert(err?.message || "บันทึกการตั้งค่าไม่สำเร็จ");
    });
}

function resetSystemConfig() {
  const scopeInfo = getSelectedConfigScope();
  let url = `${ENDPOINTS.systemConfig}/reset`;
  if (scopeInfo.scope === "cat") {
    if (scopeInfo.catName) {
      url += `?cat=${encodeURIComponent(scopeInfo.catName)}`;
    } else if (scopeInfo.catColor) {
      url += `?catColor=${encodeURIComponent(scopeInfo.catColor)}`;
    }
  }

  fetchJsonChecked(url, { method: "POST" })
    .then(() => {
      alert("✅ รีเซ็ตการตั้งค่าเรียบร้อย");
      loadSystemConfig();
      loadSystemConfigSummaries();
    })
    .catch((err) => {
      console.error("resetSystemConfig error:", err);
      alert(err?.message || "รีเซ็ตการตั้งค่าไม่สำเร็จ");
    });
}

// เรียก populate dropdown อีกครั้งทุก ๆ รอบ updateCatData เพื่อให้รายการแมวไม่ stale
const _oldUpdateCatData = updateCatData;
updateCatData = function () {
  return fetch(ENDPOINTS.cats)
    .then(res => res.json())
    .then(data => {
      cats = Array.isArray(data) ? data : [];
      renderCatCards(cats);
      updateOpenCatDetail();
      populateConfigCatSelect();
    })
    .catch(handleFetchError);
};

/* ADD THIS BLOCK TO script.js */

async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Browser ไม่รองรับ Push Notification");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("ต้องอนุญาตการแจ้งเตือนก่อน");
    return;
  }

  const reg = await navigator.serviceWorker.register("/sw.js");

  const keyResp = await fetch("/api/push/vapid_public_key");
  const { publicKey } = await keyResp.json();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });

  alert("สมัครรับ Push สำเร็จ");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

window.addEventListener("pagehide", () => { try { clearSnapshotTimer(); } catch (e) {} });
window.addEventListener("beforeunload", () => { try { clearSnapshotTimer(); } catch (e) {} });
document.addEventListener("visibilitychange", () => { if (document.hidden) { try { clearSnapshotTimer(); } catch (e) {} } });
