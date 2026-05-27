const AUTH_STORAGE_KEY = "aimlock_google_user";

const authEls = {
  area: document.getElementById("authArea"),
};

let gsiReady = false;

function getClientId() {
  return (window.AIMLOCK_AUTH && window.AIMLOCK_AUTH.googleClientId) || "";
}

function isFileOrigin() {
  return window.location.protocol === "file:";
}

function createLocalUser() {
  return {
    name: "로컬 사용자",
    email: "",
    picture: "",
    sub: "local-file-user",
  };
}

function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(json);
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function showAuthToast(msg) {
  if (typeof showToast === "function") showToast(msg);
}

function handleCredentialResponse(response) {
  try {
    const payload = parseJwt(response.credential);
    const user = {
      name: payload.name || "사용자",
      email: payload.email || "",
      picture: payload.picture || "",
      sub: payload.sub,
    };
    saveUser(user);
    renderAuth(user);
    notifyAuthChange(user);
    showAuthToast(`${user.name}님, 환영합니다.`);
  } catch {
    showAuthToast("로그인 정보를 처리하지 못했습니다.");
  }
}

function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google 로그인 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

function initGoogleAuth(clientId) {
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  gsiReady = true;
}

function renderLoggedOut(clientId) {
  authEls.area.innerHTML = "";

  if (isFileOrigin()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "login-btn";
    btn.innerHTML = `
      <svg class="login-btn-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>
      <span>로컬 로그인</span>
    `;
    btn.title = "file://로 열면 Google 로그인이 차단되어 로컬 로그인으로 대체됩니다.";
    btn.addEventListener("click", () => {
      const user = createLocalUser();
      saveUser(user);
      renderAuth(user);
      notifyAuthChange(user);
      showAuthToast("로컬 사용자로 로그인했습니다. Google 로그인은 배포된 https 주소에서 사용할 수 있습니다.");
    });
    authEls.area.appendChild(btn);
    return;
  }

  if (!clientId) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "login-btn";
    btn.innerHTML = `
      <svg class="login-btn-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>
      <span>로그인</span>
    `;
    btn.addEventListener("click", () => {
      showAuthToast("auth-config.js에 Google 클라이언트 ID를 설정해 주세요.");
    });
    authEls.area.appendChild(btn);
    return;
  }

  const btnHost = document.createElement("div");
  btnHost.className = "google-btn-host";
  authEls.area.appendChild(btnHost);

  if (gsiReady) {
    window.google.accounts.id.renderButton(btnHost, {
      type: "standard",
      theme: "filled_black",
      size: "medium",
      text: "signin",
      shape: "pill",
      locale: "ko",
      width: 100,
    });
  }
}

function renderLoggedIn(user) {
  authEls.area.innerHTML = "";

  const profile = document.createElement("div");
  profile.className = "auth-profile";

  if (user.picture) {
    const img = document.createElement("img");
    img.className = "auth-avatar";
    img.src = user.picture;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    profile.appendChild(img);
  }

  const name = document.createElement("span");
  name.className = "auth-name";
  name.textContent = user.name;
  name.title = user.email || user.name;
  profile.appendChild(name);

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "logout-btn";
  logoutBtn.textContent = "로그아웃";
  logoutBtn.addEventListener("click", () => {
    clearUser();
    if (gsiReady && window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
    renderAuth(null);
    notifyAuthChange(null);
    showAuthToast("로그아웃했습니다.");
  });

  authEls.area.appendChild(profile);
  authEls.area.appendChild(logoutBtn);
}

function notifyAuthChange(user) {
  if (typeof window.handleAuthStateChange === "function") {
    window.handleAuthStateChange(user);
  }
}

function renderAuth(user) {
  const clientId = getClientId();
  if (user) {
    renderLoggedIn(user);
  } else {
    renderLoggedOut(clientId);
  }
}

async function initAuth() {
  if (!authEls.area) return;

  const clientId = getClientId();
  const stored = loadStoredUser();
  renderAuth(stored);
  notifyAuthChange(stored);

  if (isFileOrigin()) return;
  if (!clientId) return;

  try {
    await loadGsiScript();
    initGoogleAuth(clientId);
    if (!stored) renderLoggedOut(clientId);
  } catch {
    if (!stored) {
      authEls.area.innerHTML = "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "login-btn";
      btn.textContent = "로그인";
      btn.addEventListener("click", () => {
        showAuthToast("Google 로그인을 불러오지 못했습니다. 네트워크를 확인해 주세요.");
      });
      authEls.area.appendChild(btn);
    }
  }
}

window.getCurrentUser = loadStoredUser;

document.addEventListener("DOMContentLoaded", initAuth);
