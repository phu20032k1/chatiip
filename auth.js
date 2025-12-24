/*
  Auth UI (frontend-only demo)
  - Login/Register modal (email/password)
  - Social buttons (Google/Facebook) – demo only
  - Persist auth + settings in localStorage
  - After login: hide Login/Register bar on pages that have hamburger sidebar; show account in hamburger.
*/

(function () {
  const STORAGE_CURRENT = "chatiip_current_user";
  // Access token (JWT) do backend trả về khi login/register
  const STORAGE_TOKEN = "chatiip_access_token";
  // Legacy (demo) - giữ lại để không phá vỡ dữ liệu cũ, nhưng không dùng nữa
  const STORAGE_USERS = "chatiip_users";
  const STORAGE_THEME = "chatiip_theme"; // 'light' | 'dark'
  const STORAGE_SETTINGS = "chatiip_settings"; // { notifications: boolean }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function readJSON(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeParse(raw, fallback);
  }

  function writeJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function uuid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  // ---------------- Backend auth helpers ----------------
  // Thông qua Netlify/_redirects:
  //  - /auth/*  -> BACKEND /api/auth/*
  // Vì vậy FE chỉ cần gọi /auth/...
  const AUTH_BASE = "/auth";

  function getToken() {
    try {
      return localStorage.getItem(STORAGE_TOKEN) || "";
    } catch {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(STORAGE_TOKEN, token);
      else localStorage.removeItem(STORAGE_TOKEN);
    } catch {
      // ignore
    }
  }

  async function apiAuth(path, { method = "GET", body, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${AUTH_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include"
    });

    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = (data && data.message) || (typeof data === "string" && data) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function getCurrentUser() {
    return readJSON(STORAGE_CURRENT, null);
  }

  function setCurrentUser(user) {
    writeJSON(STORAGE_CURRENT, user);
    // sync with existing logging helper in script.js
    try {
      localStorage.setItem("chatiip_user_id", user?.id || "anonymous");
    } catch {}
  }

  function clearCurrentUser() {
    localStorage.removeItem(STORAGE_CURRENT);
    localStorage.removeItem("chatiip_user_id");
  }

  function getUsers() {
    return readJSON(STORAGE_USERS, []);
  }

  function setUsers(list) {
    writeJSON(STORAGE_USERS, list);
  }

  function getSettings() {
    return readJSON(STORAGE_SETTINGS, { notifications: true });
  }

  function setSettings(settings) {
    writeJSON(STORAGE_SETTINGS, settings);
  }

  // ---------------- Toast ----------------
  function ensureToastWrap() {
    let wrap = document.getElementById("toastWrap");
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.id = "toastWrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
    return wrap;
  }

  function showToast(message, type = "success") {
    const wrap = ensureToastWrap();
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <div class="toast-icon">${type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"}</div>
      <div class="toast-msg">${message}</div>
      <button class="toast-close" aria-label="Đóng">&times;</button>
    `;
    wrap.appendChild(t);

    const remove = () => {
      t.classList.add("hide");
      setTimeout(() => t.remove(), 250);
    };

    t.querySelector(".toast-close")?.addEventListener("click", remove);
    setTimeout(remove, 3500);
  }

  // --------------- Theme ----------------
  function applyTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("theme-dark", t === "dark");
    localStorage.setItem(STORAGE_THEME, t);

    // Update labels if present
    const themeText = document.getElementById("themeToggleText");
    const themeIcon = document.getElementById("themeToggleIcon");
    if (themeText) themeText.textContent = t === "dark" ? "Tối" : "Sáng";
    if (themeIcon) themeIcon.className = t === "dark" ? "fas fa-moon" : "fas fa-sun";

    const modalThemeText = document.getElementById("modalThemeToggleText");
    const modalThemeIcon = document.getElementById("modalThemeToggleIcon");
    if (modalThemeText) modalThemeText.textContent = t === "dark" ? "Đang bật: Tối" : "Đang bật: Sáng";
    if (modalThemeIcon) modalThemeIcon.className = t === "dark" ? "fas fa-moon" : "fas fa-sun";
  }

  function initThemeFromStorage() {
    const theme = localStorage.getItem(STORAGE_THEME) || "light";
    applyTheme(theme);
  }

  // --------------- UI injection ----------------
  function adjustAuthBarPosition() {
    const bar = document.getElementById("authBar");
    if (!bar) return;

    const hasSidebar = !!document.getElementById("sidebar");
    if (hasSidebar) {
      bar.style.top = "16px";
      return;
    }

    // If the page has its own header (news/laws/article...), push auth bar below it to avoid overlap.
    const header = document.querySelector("header");
    if (header) {
      const h = header.getBoundingClientRect().height || 64;
      const top = Math.min(16 + h + 8, 120);
      bar.style.top = top + "px";
    } else {
      bar.style.top = "16px";
    }
  }

  // Decide whether to show the top auth bar (Đăng nhập/Đăng ký).
// We only show it on the chat page to avoid cluttering public pages (news/laws/doc/...).
function shouldShowAuthBar() {
  const page = document.body?.dataset?.page || "";
  if (page) return page === "chat"; // explicit override via <body data-page="...">
  // Fallback (in case data-page is missing): detect chat layout markers
  return !!(document.getElementById("chatContainer")
    || document.getElementById("messageInputContainer")
    || document.querySelector(".chat-container"));
}

function injectAuthUI() {
    const showTopBar = shouldShowAuthBar();
    if (!showTopBar) {
      const oldBar = document.getElementById("authBar");
      if (oldBar) oldBar.remove();
    }
    // Auth bar (top center)
    if (showTopBar && !document.getElementById("authBar")) {
      const bar = document.createElement("div");
      bar.id = "authBar";
      bar.className = "auth-bar";
      bar.innerHTML = `
        <button class="auth-btn" id="loginOpenBtn">Đăng nhập</button>
        <button class="auth-btn secondary" id="registerOpenBtn">Đăng ký</button>
        <button class="auth-btn" id="accountOpenBtn" style="display:none;">
          <i class="fas fa-user"></i>
          <span id="accountOpenBtnText">Tài khoản</span>
        </button>
      `;
      document.body.appendChild(bar);
    }

    // Auth modal
    if (!document.getElementById("authOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "authOverlay";
      overlay.className = "auth-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `
        <div class="auth-modal" role="dialog" aria-modal="true" aria-label="Đăng nhập / Đăng ký">
          <button class="auth-close" id="authCloseBtn" aria-label="Đóng">&times;</button>

          <div class="auth-title">Tài khoản ChatIIP</div>
          <div class="auth-subtitle">Đăng nhập hoặc tạo tài khoản để đồng bộ trải nghiệm.</div>

          <div class="auth-tabs" role="tablist">
            <button class="auth-tab active" id="tabLogin" data-tab="login" type="button">Đăng nhập</button>
            <button class="auth-tab" id="tabRegister" data-tab="register" type="button">Đăng ký</button>
          </div>

          <div class="auth-panel" id="panelLogin">
            <div class="auth-social">
              <button class="social-btn google" id="googleLoginBtn" type="button">
                <i class="fa-brands fa-google"></i> Tiếp tục với Google
              </button>
              <button class="social-btn facebook" id="facebookLoginBtn" type="button">
                <i class="fa-brands fa-facebook"></i> Tiếp tục với Facebook
              </button>
            </div>

            <div class="auth-divider"><span>hoặc</span></div>

            <form id="loginForm" class="auth-form">
              <label class="auth-label">Email</label>
              <input class="auth-input" id="loginEmail" type="email" placeholder="vd: ten@email.com" required />

              <label class="auth-label">Mật khẩu</label>
              <input class="auth-input" id="loginPassword" type="password" placeholder="Nhập mật khẩu" required />

              <button class="auth-submit" type="submit">Đăng nhập</button>
              <div class="auth-hint">Chưa có tài khoản? <button class="link-btn" id="gotoRegister" type="button">Đăng ký ngay</button></div>
            </form>
          </div>

          <div class="auth-panel hidden" id="panelRegister">
            <div class="auth-social">
              <button class="social-btn google" id="googleRegisterBtn" type="button">
                <i class="fa-brands fa-google"></i> Đăng ký với Google
              </button>
              <button class="social-btn facebook" id="facebookRegisterBtn" type="button">
                <i class="fa-brands fa-facebook"></i> Đăng ký với Facebook
              </button>
            </div>

            <div class="auth-divider"><span>hoặc</span></div>

            <form id="registerForm" class="auth-form">
              <label class="auth-label">Họ & tên</label>
              <input class="auth-input" id="regName" type="text" placeholder="VD: Minh Phú" required />

              <label class="auth-label">Email</label>
              <input class="auth-input" id="regEmail" type="email" placeholder="vd: ten@email.com" required />

              <label class="auth-label">Mật khẩu</label>
              <input class="auth-input" id="regPassword" type="password" placeholder="Tối thiểu 6 ký tự" minlength="6" required />

              <label class="auth-label">Nhập lại mật khẩu</label>
              <input class="auth-input" id="regPassword2" type="password" placeholder="Nhập lại mật khẩu" minlength="6" required />

              <button class="auth-submit" type="submit">Tạo tài khoản</button>
              <div class="auth-hint">Đã có tài khoản? <button class="link-btn" id="gotoLogin" type="button">Đăng nhập</button></div>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    // Account overlay (only used on pages without sidebar)
    if (!document.getElementById("accountOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "accountOverlay";
      overlay.className = "auth-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `
        <div class="account-modal" role="dialog" aria-modal="true" aria-label="Tài khoản">
          <button class="auth-close" id="accountCloseBtn" aria-label="Đóng">&times;</button>
          <div class="auth-title">Tài khoản</div>

          <div class="account-card">
            <div class="account-row">
              <div class="avatar" id="modalAvatar">U</div>
              <div class="account-meta">
                <div class="account-name" id="modalAccountName">User</div>
                <div class="account-email" id="modalAccountEmail">email</div>
              </div>
            </div>

            <div class="settings-group">
              <div class="settings-title">Cài đặt</div>

              <div class="setting-row">
                <div class="setting-text">
                  <div class="setting-title">Thông báo</div>
                  <div class="setting-desc">Bật/tắt thông báo trên web</div>
                </div>
                <label class="switch">
                  <input type="checkbox" id="modalNotifications" />
                  <span class="slider"></span>
                </label>
              </div>

              <div class="setting-row">
                <div class="setting-text">
                  <div class="setting-title">Chủ đề</div>
                  <div class="setting-desc">Sáng / tối</div>
                </div>
                <button class="pill-btn" id="modalThemeToggleBtn" type="button">
                  <i id="modalThemeToggleIcon" class="fas fa-sun"></i>
                  <span id="modalThemeToggleText">Đang bật: Sáng</span>
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-text">
                  <div class="setting-title">Cài đặt chung</div>
                  <div class="setting-desc">Một số tuỳ chọn cơ bản (demo)</div>
                </div>
                <span class="badge">Đang phát triển</span>
              </div>
            </div>

            <button class="menu-item logout-item" id="modalLogoutBtn" type="button">
              <i class="fas fa-right-from-bracket"></i> Đăng xuất
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    // Sidebar account section (only when #sidebar exists)
    const sidebar = document.getElementById("sidebar");
    if (sidebar && !document.getElementById("sidebarAccount")) {
      const account = document.createElement("div");
      account.id = "sidebarAccount";
      account.className = "sidebar-account";
      account.innerHTML = `
        <div class="sidebar-divider"></div>

        <button class="menu-item account-toggle" id="accountToggleBtn" type="button">
          <i class="fas fa-user-circle"></i>
          <span class="account-toggle-text" id="accountLabel">Tài khoản</span>
          <i class="fas fa-chevron-down chevron"></i>
        </button>

        <div class="account-panel" id="accountPanel" style="display:none;">
          <div class="account-guest" id="accountGuest">
            <div class="account-guest-title">Bạn chưa đăng nhập</div>
            <div class="account-guest-actions">
              <button class="auth-btn small" id="sidebarLoginBtn" type="button">Đăng nhập</button>
              <button class="auth-btn secondary small" id="sidebarRegisterBtn" type="button">Đăng ký</button>
            </div>
            <div class="account-guest-hint">Hoặc dùng Google / Facebook trong form đăng nhập.</div>
          </div>

          <div class="account-user" id="accountUser" style="display:none;">
            <div class="account-row">
              <div class="avatar" id="accountAvatar">U</div>
              <div class="account-meta">
                <div class="account-name" id="accountName">User</div>
                <div class="account-email" id="accountEmail">email</div>
              </div>
            </div>

            <div class="settings-group">
              <div class="settings-title">Cài đặt</div>

              <div class="setting-row">
                <div class="setting-text">
                  <div class="setting-title">Thông báo</div>
                  <div class="setting-desc">Bật/tắt thông báo trên web</div>
                </div>
                <label class="switch">
                  <input type="checkbox" id="settingNotifications" />
                  <span class="slider"></span>
                </label>
              </div>

              <div class="setting-row">
                <div class="setting-text">
                  <div class="setting-title">Chủ đề</div>
                  <div class="setting-desc">Sáng / tối</div>
                </div>
                <button class="pill-btn" id="themeToggleBtn" type="button">
                  <i id="themeToggleIcon" class="fas fa-sun"></i>
                  <span id="themeToggleText">Sáng</span>
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-text">
                  <div class="setting-title">Cài đặt chung</div>
                  <div class="setting-desc">Một số tuỳ chọn cơ bản (demo)</div>
                </div>
                <span class="badge">Đang phát triển</span>
              </div>
            </div>

            <button class="menu-item logout-item" id="logoutBtn" type="button">
              <i class="fas fa-right-from-bracket"></i> Đăng xuất
            </button>
          </div>
        </div>
      `;

      // append after sidebar-menu if exists
      const sidebarMenu = sidebar.querySelector(".sidebar-menu") || sidebar;
      sidebarMenu.appendChild(account);
    }
  }

  function openOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("show");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("show");
    el.setAttribute("aria-hidden", "true");
    // only remove if both overlays closed
    const anyOpen = document.querySelector(".auth-overlay.show");
    if (!anyOpen) document.body.classList.remove("modal-open");
  }

  function setAuthTab(tab) {
    const loginTab = document.getElementById("tabLogin");
    const regTab = document.getElementById("tabRegister");
    const loginPanel = document.getElementById("panelLogin");
    const regPanel = document.getElementById("panelRegister");
    if (!loginTab || !regTab || !loginPanel || !regPanel) return;

    const isLogin = tab === "login";
    loginTab.classList.toggle("active", isLogin);
    regTab.classList.toggle("active", !isLogin);
    loginPanel.classList.toggle("hidden", !isLogin);
    regPanel.classList.toggle("hidden", isLogin);
  }

  // --------------- Account UI sync ----------------
  function syncSidebarAccountUI(user) {
    const guest = document.getElementById("accountGuest");
    const userWrap = document.getElementById("accountUser");
    if (!guest || !userWrap) return;

    guest.style.display = user ? "none" : "block";
    userWrap.style.display = user ? "block" : "none";

    if (user) {
      const name = document.getElementById("accountName");
      const email = document.getElementById("accountEmail");
      const avatar = document.getElementById("accountAvatar");
      if (name) name.textContent = user.name || "Tài khoản";
      if (email) email.textContent = user.email || user.provider || "";
      if (avatar) avatar.textContent = (user.name || "U").trim().charAt(0).toUpperCase();
    }

    // settings
    const settings = getSettings();
    const notif = document.getElementById("settingNotifications");
    if (notif) notif.checked = !!settings.notifications;

    const theme = localStorage.getItem(STORAGE_THEME) || "light";
    applyTheme(theme);
  }

  function syncAccountModalUI(user) {
    const name = document.getElementById("modalAccountName");
    const email = document.getElementById("modalAccountEmail");
    const avatar = document.getElementById("modalAvatar");
    if (name) name.textContent = user?.name || "Tài khoản";
    if (email) email.textContent = user?.email || user?.provider || "";
    if (avatar) avatar.textContent = (user?.name || "U").trim().charAt(0).toUpperCase();

    const settings = getSettings();
    const notif = document.getElementById("modalNotifications");
    if (notif) notif.checked = !!settings.notifications;

    const theme = localStorage.getItem(STORAGE_THEME) || "light";
    applyTheme(theme);
  }

  function syncTopBarUI(user) {
    const bar = document.getElementById("authBar");
    if (!bar) return;

    const hasSidebar = !!document.getElementById("sidebar");
    const loginBtn = document.getElementById("loginOpenBtn");
    const regBtn = document.getElementById("registerOpenBtn");
    const accountBtn = document.getElementById("accountOpenBtn");

    if (!user) {
      // guest: show login/register
      bar.style.display = "flex";
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (regBtn) regBtn.style.display = "inline-flex";
      if (accountBtn) accountBtn.style.display = "none";
      return;
    }

    // logged in
    if (hasSidebar) {
      // hide bar entirely (account lives in hamburger)
      bar.style.display = "none";
    } else {
      // no sidebar: show a single account button
      bar.style.display = "flex";
      if (loginBtn) loginBtn.style.display = "none";
      if (regBtn) regBtn.style.display = "none";
      if (accountBtn) {
        accountBtn.style.display = "inline-flex";
        const t = document.getElementById("accountOpenBtnText");
        if (t) t.textContent = user.name || "Tài khoản";
      }
    }
  }

  function syncAllUI() {
    const user = getCurrentUser();
    syncTopBarUI(user);
    syncSidebarAccountUI(user);
    syncAccountModalUI(user);
  }

  // --------------- Auth actions ----------------
  async function handleRegister(name, email, password) {
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      showToast("Vui lòng nhập email hợp lệ.", "error");
      return;
    }
    if ((password || "").length < 6) {
      showToast("Mật khẩu tối thiểu 6 ký tự.", "error");
      return;
    }

    try {
      const data = await apiAuth("/register", {
        method: "POST",
        auth: false,
        body: { name: (name || "").trim(), email: normalizedEmail, password }
      });

      if (data?.token) setToken(data.token);
      const u = data?.user;
      // backend trả: { id, name, email, role }
      setCurrentUser({
        id: u?.id || "anonymous",
        name: u?.name || "",
        email: u?.email || normalizedEmail,
        role: u?.role || "user",
        provider: "password"
      });

      showToast(`Tạo tài khoản thành công! Xin chào ${u?.name || normalizedEmail}.`, "success");
      closeOverlay("authOverlay");
      syncAllUI();
    } catch (e) {
      showToast(`Đăng ký thất bại: ${e.message}`, "error");
    }
  }

  async function handleLogin(email, password) {
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      showToast("Vui lòng nhập email.", "error");
      return;
    }

    try {
      const data = await apiAuth("/login", {
        method: "POST",
        auth: false,
        body: { email: normalizedEmail, password }
      });

      if (data?.token) setToken(data.token);
      const u = data?.user;
      setCurrentUser({
        id: u?.id || "anonymous",
        name: u?.name || "",
        email: u?.email || normalizedEmail,
        role: u?.role || "user",
        provider: "password"
      });

      showToast(`Đăng nhập thành công! Xin chào ${u?.name || normalizedEmail}.`, "success");
      closeOverlay("authOverlay");
      syncAllUI();
    } catch (e) {
      showToast(`Đăng nhập thất bại: ${e.message}`, "error");
    }
  }

  function handleSocial(provider) {
    showToast(`Hiện chưa hỗ trợ đăng nhập bằng ${provider === "google" ? "Google" : "Facebook"}.`, "info");
  }

  async function logout() {
    try {
      await apiAuth("/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setToken("");
    clearCurrentUser();
    showToast("Bạn đã đăng xuất.", "info");
    closeOverlay("accountOverlay");
    syncAllUI();
  }

  // --------------- Event wiring ----------------
  function wireEvents() {
    // Open/close auth
    document.getElementById("loginOpenBtn")?.addEventListener("click", () => {
      setAuthTab("login");
      openOverlay("authOverlay");
    });

    document.getElementById("registerOpenBtn")?.addEventListener("click", () => {
      setAuthTab("register");
      openOverlay("authOverlay");
    });

    document.getElementById("authCloseBtn")?.addEventListener("click", () => closeOverlay("authOverlay"));

    // Close on backdrop click
    document.getElementById("authOverlay")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "authOverlay") closeOverlay("authOverlay");
    });

    // Tabs
    document.getElementById("tabLogin")?.addEventListener("click", () => setAuthTab("login"));
    document.getElementById("tabRegister")?.addEventListener("click", () => setAuthTab("register"));

    document.getElementById("gotoRegister")?.addEventListener("click", () => setAuthTab("register"));
    document.getElementById("gotoLogin")?.addEventListener("click", () => setAuthTab("login"));

    // Forms
    document.getElementById("registerForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("regName")?.value || "";
      const email = document.getElementById("regEmail")?.value || "";
      const pw1 = document.getElementById("regPassword")?.value || "";
      const pw2 = document.getElementById("regPassword2")?.value || "";

      if (pw1 !== pw2) {
        showToast("Mật khẩu nhập lại không khớp.", "error");
        return;
      }
      handleRegister(name, email, pw1);
    });

    document.getElementById("loginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail")?.value || "";
      const pw = document.getElementById("loginPassword")?.value || "";
      handleLogin(email, pw);
    });

    // Social
    document.getElementById("googleLoginBtn")?.addEventListener("click", () => handleSocial("google"));
    document.getElementById("facebookLoginBtn")?.addEventListener("click", () => handleSocial("facebook"));
    document.getElementById("googleRegisterBtn")?.addEventListener("click", () => handleSocial("google"));
    document.getElementById("facebookRegisterBtn")?.addEventListener("click", () => handleSocial("facebook"));

    // Sidebar account expand/collapse
    const toggle = document.getElementById("accountToggleBtn");
    const panel = document.getElementById("accountPanel");
    if (toggle && panel) {
      toggle.addEventListener("click", () => {
        const isOpen = panel.style.display !== "none";
        panel.style.display = isOpen ? "none" : "block";
        toggle.classList.toggle("open", !isOpen);
      });
    }

    // Sidebar login/register buttons
    document.getElementById("sidebarLoginBtn")?.addEventListener("click", () => {
      setAuthTab("login");
      openOverlay("authOverlay");
    });
    document.getElementById("sidebarRegisterBtn")?.addEventListener("click", () => {
      setAuthTab("register");
      openOverlay("authOverlay");
    });

    // Sidebar settings: notifications
    document.getElementById("settingNotifications")?.addEventListener("change", (e) => {
      const settings = getSettings();
      settings.notifications = !!e.target.checked;
      setSettings(settings);
      showToast(settings.notifications ? "Đã bật thông báo." : "Đã tắt thông báo.", "info");
    });

    // Sidebar theme
    document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
      const cur = localStorage.getItem(STORAGE_THEME) || "light";
      const next = cur === "dark" ? "light" : "dark";
      applyTheme(next);
      showToast(next === "dark" ? "Đã bật chế độ tối." : "Đã bật chế độ sáng.", "info");
    });

    // Sidebar logout
    document.getElementById("logoutBtn")?.addEventListener("click", logout);

    // Account button on non-sidebar pages
    document.getElementById("accountOpenBtn")?.addEventListener("click", () => {
      const user = getCurrentUser();
      if (!user) return;
      syncAccountModalUI(user);
      openOverlay("accountOverlay");
    });

    document.getElementById("accountCloseBtn")?.addEventListener("click", () => closeOverlay("accountOverlay"));
    document.getElementById("accountOverlay")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "accountOverlay") closeOverlay("accountOverlay");
    });

    document.getElementById("modalLogoutBtn")?.addEventListener("click", logout);

    // Modal settings events
    document.getElementById("modalNotifications")?.addEventListener("change", (e) => {
      const settings = getSettings();
      settings.notifications = !!e.target.checked;
      setSettings(settings);
      // mirror sidebar toggle if present
      const sidebarNotif = document.getElementById("settingNotifications");
      if (sidebarNotif) sidebarNotif.checked = settings.notifications;
      showToast(settings.notifications ? "Đã bật thông báo." : "Đã tắt thông báo.", "info");
    });

    document.getElementById("modalThemeToggleBtn")?.addEventListener("click", () => {
      const cur = localStorage.getItem(STORAGE_THEME) || "light";
      const next = cur === "dark" ? "light" : "dark";
      applyTheme(next);
      showToast(next === "dark" ? "Đã bật chế độ tối." : "Đã bật chế độ sáng.", "info");
    });

    // ESC to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeOverlay("authOverlay");
        closeOverlay("accountOverlay");
      }
    });
  }

  // --------------- Boot ----------------
  async function hydrateSessionFromBackend() {
    // Nếu có token (hoặc cookie) thì thử gọi /me để lấy user thật
    try {
      const hasToken = !!getToken();
      // Nếu không có token thì vẫn có thể có cookie (admin.chatiip.com...), cứ thử một lần.
      const me = await apiAuth("/me", { method: "GET", auth: hasToken });
      if (me && me.user) {
        setCurrentUser({
          id: me.user.id,
          name: me.user.name || "",
          email: me.user.email,
          role: me.user.role || "user",
          provider: "password"
        });
        syncAllUI();
      }
    } catch {
      // Token/cookie không hợp lệ → clear
      setToken("");
      clearCurrentUser();
      syncAllUI();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectAuthUI();
    adjustAuthBarPosition();
    window.addEventListener("resize", adjustAuthBarPosition);
    initThemeFromStorage();
    wireEvents();
    syncAllUI();
    hydrateSessionFromBackend();
  });
})();
