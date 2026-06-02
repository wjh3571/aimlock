const AUTH_STORAGE_KEY = "aimlock_supabase_user";
const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

const authEls = {
  area: document.getElementById("authArea"),
};

let supabaseClient = null;
let currentUser = null;

function getBaasAuthConfig() {
  const cfg = window.AIMLOCK_BAAS || {};
  return {
    supabaseUrl: String(cfg.supabaseUrl || "").replace(/\/+$/, ""),
    supabaseAnonKey: String(cfg.supabaseAnonKey || ""),
  };
}

function isFileOrigin() {
  return window.location.protocol === "file:";
}

function createLocalUser() {
  return {
    name: "Local user",
    email: "",
    picture: "",
    sub: "local-file-user",
  };
}

function userFromSession(session) {
  const user = session && session.user;
  if (!user) return null;

  const meta = user.user_metadata || {};
  return {
    name: meta.full_name || meta.name || user.email || "User",
    email: user.email || "",
    picture: meta.avatar_url || meta.picture || "",
    sub: user.id,
  };
}

function loadStoredUser() {
  if (currentUser) return currentUser;

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser(user) {
  currentUser = user;

  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function showAuthToast(message) {
  if (typeof showToast === "function") {
    showToast(message);
    return;
  }

  console.info(message);
}

function notifyAuthChange(user) {
  if (typeof window.handleAuthStateChange === "function") {
    window.handleAuthStateChange(user);
  }
}

function loadSupabaseScript() {
  return new Promise((resolve, reject) => {
    if (window.supabase && window.supabase.createClient) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = SUPABASE_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the Supabase auth script."));
    document.head.appendChild(script);
  });
}

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const cfg = getBaasAuthConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error("Missing Supabase URL or anon key in baas-config.js.");
  }

  await loadSupabaseScript();
  supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return supabaseClient;
}

function getRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

async function signInWithGoogle() {
  if (isFileOrigin()) {
    const user = createLocalUser();
    saveUser(user);
    renderAuth(user);
    notifyAuthChange(user);
    showAuthToast("Signed in locally. Google login works on a deployed HTTPS URL.");
    return;
  }

  try {
    const client = await getSupabaseClient();
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectUrl(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error("Supabase Google sign-in failed:", error);
    showAuthToast(error && error.message ? error.message : "Could not start Google login.");
  }
}

async function signOut() {
  try {
    if (!isFileOrigin()) {
      const client = await getSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
  } catch (error) {
    console.error("Supabase sign-out failed:", error);
  }

  saveUser(null);
  renderAuth(null);
  notifyAuthChange(null);
  showAuthToast("Signed out.");
}

function renderLoggedOut() {
  if (!authEls.area) return;
  authEls.area.innerHTML = "";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "login-btn";
  btn.innerHTML = `
    <svg class="login-btn-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
    </svg>
    <span>Login</span>
  `;
  btn.addEventListener("click", signInWithGoogle);
  authEls.area.appendChild(btn);
}

function renderLoggedIn(user) {
  if (!authEls.area) return;
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
  logoutBtn.textContent = "Logout";
  logoutBtn.addEventListener("click", signOut);

  authEls.area.appendChild(profile);
  authEls.area.appendChild(logoutBtn);
}

function renderAuth(user) {
  if (user) {
    renderLoggedIn(user);
  } else {
    renderLoggedOut();
  }
}

function syncUserFromSession(session, showWelcome = false) {
  const user = userFromSession(session);
  saveUser(user);
  renderAuth(user);
  notifyAuthChange(user);

  if (showWelcome && user) {
    showAuthToast(`Welcome, ${user.name}.`);
  }
}

async function initAuth() {
  if (!authEls.area) return;

  const stored = loadStoredUser();
  renderAuth(stored);
  notifyAuthChange(stored);

  if (isFileOrigin()) return;

  try {
    const client = await getSupabaseClient();
    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (error) throw error;
    syncUserFromSession(session);

    client.auth.onAuthStateChange((event, session) => {
      syncUserFromSession(session, event === "SIGNED_IN");
    });
  } catch (error) {
    console.error("Supabase auth initialization failed:", error);
    if (!stored) renderLoggedOut();
    showAuthToast(error && error.message ? error.message : "Could not check login state.");
  }
}

window.getCurrentUser = loadStoredUser;

document.addEventListener("DOMContentLoaded", initAuth);
