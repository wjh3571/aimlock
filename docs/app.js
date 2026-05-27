const FAVORITES_KEY_PREFIX = "aimlock_favorites_";
const PAGE_SIZE = 40;

const TYPE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "crosshair", label: "십자선" },
  { value: "circle", label: "원형" },
  { value: "square", label: "사각형" },
  { value: "other", label: "기타" },
];

const TYPE_LABEL_MAP = Object.fromEntries(
  TYPE_OPTIONS.filter((o) => o.value !== "all").map((o) => [o.value, o.label])
);
const CATEGORY_LABEL_MAP = {
  general: "일반",
  pro: "프로",
  entertainment: "예능",
  difficult: "어려움",
};

const state = {
  items: [],
  query: "",
  type: "all",
  sort: "latest",
  page: 1,
  favoritesOnly: false,
  favorites: new Set(),
};

function getBaasConfig() {
  const cfg = window.AIMLOCK_BAAS || {};
  return {
    enabled: !!cfg.enabled,
    provider: cfg.provider || "supabase",
    supabaseUrl: String(cfg.supabaseUrl || "").replace(/\/+$/, ""),
    supabaseAnonKey: String(cfg.supabaseAnonKey || ""),
    table: cfg.table || "crosshairs",
  };
}

const els = {
  searchInput: document.getElementById("searchInput"),
  searchClear: document.getElementById("searchClear"),
  typeChips: document.getElementById("typeChips"),
  favoritesFilterGroup: document.getElementById("favoritesFilterGroup"),
  favoritesToggle: document.getElementById("favoritesToggle"),
  countLabel: document.getElementById("countLabel"),
  cardGrid: document.getElementById("cardGrid"),
  emptyState: document.getElementById("emptyState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptyHint: document.getElementById("emptyHint"),
  pagination: document.getElementById("pagination"),
  pagePrev: document.getElementById("pagePrev"),
  pageNext: document.getElementById("pageNext"),
  pageNumbers: document.getElementById("pageNumbers"),
  toast: document.getElementById("toast"),
};

function getLoggedInUser() {
  return typeof getCurrentUser === "function" ? getCurrentUser() : null;
}

function isLoggedIn() {
  const user = getLoggedInUser();
  return !!(user && user.sub);
}

function favoritesStorageKey(sub) {
  return `${FAVORITES_KEY_PREFIX}${sub}`;
}

function loadFavoritesForUser(sub) {
  if (!sub) return new Set();
  try {
    const raw = localStorage.getItem(favoritesStorageKey(sub));
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  const user = getLoggedInUser();
  if (!user || !user.sub) return;
  localStorage.setItem(favoritesStorageKey(user.sub), JSON.stringify([...state.favorites]));
}

function isFavorite(id) {
  return isLoggedIn() && state.favorites.has(String(id));
}

function toggleFavorite(id) {
  if (!isLoggedIn()) {
    showToast("즐겨찾기는 로그인 후 이용할 수 있습니다.");
    return;
  }
  const key = String(id);
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
    showToast("즐겨찾기에서 제거했습니다.");
  } else {
    state.favorites.add(key);
    showToast("즐겨찾기에 추가했습니다.");
  }
  saveFavorites();
  syncFavoritesToggle();
  applyFilters();
}

function syncFavoritesUI() {
  const visible = isLoggedIn();
  if (els.favoritesFilterGroup) {
    els.favoritesFilterGroup.hidden = !visible;
  }
  if (!visible) {
    state.favoritesOnly = false;
    state.favorites = new Set();
  }
}

function handleAuthStateChange(user) {
  if (user && user.sub) {
    state.favorites = loadFavoritesForUser(user.sub);
  } else {
    state.favorites = new Set();
    state.favoritesOnly = false;
  }
  syncFavoritesUI();
  syncFavoritesToggle();
  if (state.items.length) applyFilters(true);
}

window.handleAuthStateChange = handleAuthStateChange;

function syncFavoritesToggle() {
  if (!els.favoritesToggle) return;
  els.favoritesToggle.classList.toggle("is-active", state.favoritesOnly);
  els.favoritesToggle.setAttribute("aria-pressed", state.favoritesOnly ? "true" : "false");
}

function favoriteIconSvg(filled) {
  const points = "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";
  if (filled) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><polygon points="${points}" fill="currentColor"/></svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><polygon points="${points}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>`;
}

function renderChips(container, options, group, current) {
  container.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (opt.value === current ? " is-active" : "");
    btn.textContent = opt.label;
    btn.dataset.value = opt.value;
    btn.addEventListener("click", () => {
      state[group] = opt.value;
      state.page = 1;
      renderChips(els.typeChips, TYPE_OPTIONS, "type", state.type);
      applyFilters(true);
    });
    container.appendChild(btn);
  });
}

function relativeTime(iso) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return "방금 전";
  if (diff < h) return `${Math.floor(diff / m)}분 전`;
  if (diff < d) return `${Math.floor(diff / h)}시간 전`;
  if (diff < 7 * d) return `${Math.floor(diff / d)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function matchesQuery(item, q) {
  if (!q) return true;
  const hay = [
    item.title,
    item.author,
    ...(item.tags || []),
    TYPE_LABEL_MAP[item.type],
    CATEGORY_LABEL_MAP[item.category],
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function goToPage(page) {
  state.page = page;
  applyFilters(false);
  els.cardGrid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPagination(totalPages) {
  if (!els.pagination) return;

  const show = totalPages > 1;
  els.pagination.hidden = !show;
  if (!show) return;

  els.pagePrev.disabled = state.page <= 1;
  els.pageNext.disabled = state.page >= totalPages;

  els.pageNumbers.innerHTML = "";
  const maxButtons = 7;
  let start = Math.max(1, state.page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  const addPageBtn = (num) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-num" + (num === state.page ? " is-active" : "");
    btn.textContent = String(num);
    btn.setAttribute("aria-label", `${num}페이지`);
    if (num === state.page) btn.setAttribute("aria-current", "page");
    btn.addEventListener("click", () => goToPage(num));
    els.pageNumbers.appendChild(btn);
  };

  if (start > 1) {
    addPageBtn(1);
    if (start > 2) {
      const gap = document.createElement("span");
      gap.className = "page-ellipsis";
      gap.textContent = "…";
      els.pageNumbers.appendChild(gap);
    }
  }

  for (let p = start; p <= end; p += 1) {
    if (p === 1 && start > 1) continue;
    addPageBtn(p);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      const gap = document.createElement("span");
      gap.className = "page-ellipsis";
      gap.textContent = "…";
      els.pageNumbers.appendChild(gap);
    }
    addPageBtn(totalPages);
  }
}

function applyFilters(resetPage = false) {
  if (resetPage) state.page = 1;
  const q = state.query.trim().toLowerCase();
  const loggedIn = isLoggedIn();
  let list = state.items.filter((item) => {
    if (state.favoritesOnly && loggedIn && !isFavorite(item.id)) return false;
    if (state.type !== "all" && item.type !== state.type) return false;
    return matchesQuery(item, q);
  });

  list = [...list].sort((a, b) => {
    if (state.sort === "popular") return b.copyCount - a.copyCount;
    return new Date(b.postedAt) - new Date(a.postedAt);
  });

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const pageList = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  els.countLabel.textContent =
    state.favoritesOnly && loggedIn
      ? `즐겨찾기 ${total}개 · ${state.page}/${totalPages} 페이지`
      : `총 ${total}개 · ${state.page}/${totalPages} 페이지`;
  els.cardGrid.innerHTML = "";
  els.emptyState.hidden = total > 0;
  renderPagination(totalPages);
  if (total === 0) {
    if (state.favoritesOnly && loggedIn) {
      els.emptyTitle.textContent = "즐겨찾기한 조준점이 없습니다.";
      els.emptyHint.textContent = state.favorites.size
        ? "다른 필터를 해제하거나 검색어를 바꿔 보세요."
        : "카드의 별 아이콘을 눌러 즐겨찾기에 추가해 보세요.";
    } else {
      els.emptyTitle.textContent = "조건에 맞는 조준점이 없습니다.";
      els.emptyHint.textContent = "검색어나 필터를 바꿔 보세요.";
    }
  }

  pageList.forEach((item, i) => {
    const card = document.createElement("article");
    card.className = "card";
    if (state.page === 1 && i === 0 && state.sort === "popular") card.classList.add("is-featured");
    if (isFavorite(item.id)) card.classList.add("is-favorite");

    const time = document.createElement("div");
    time.className = "card-time";
    const timeLabel = document.createElement("span");
    timeLabel.textContent = relativeTime(item.postedAt);
    time.appendChild(timeLabel);

    if (loggedIn) {
      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "fav-btn" + (isFavorite(item.id) ? " is-active" : "");
      favBtn.title = isFavorite(item.id) ? "즐겨찾기 해제" : "즐겨찾기";
      favBtn.setAttribute("aria-label", favBtn.title);
      favBtn.setAttribute("aria-pressed", isFavorite(item.id) ? "true" : "false");
      favBtn.innerHTML = favoriteIconSvg(isFavorite(item.id));
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(item.id);
      });
      time.appendChild(favBtn);
    }

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "card-thumb-wrap";
    const img = document.createElement("img");
    img.className = "card-thumb";
    if (item.thumb && /^https?:\/\//i.test(item.thumb)) {
      img.src = item.thumb;
    } else if (typeof crosshairPreviewDataUrl === "function") {
      img.src = crosshairPreviewDataUrl(item.code, item.type || "crosshair", 240);
    } else {
      img.src = item.thumb || "";
    }
    img.alt = "";
    img.decoding = "async";
    thumbWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <h2 class="card-title"></h2>
      <p class="card-author"></p>
      <div class="card-tags"></div>
    `;
    body.querySelector(".card-title").textContent = item.title;
    body.querySelector(".card-author").textContent = item.author;
    const tagsEl = body.querySelector(".card-tags");
    const typeTag = TYPE_LABEL_MAP[item.type] || item.type;
    const catTag = CATEGORY_LABEL_MAP[item.category] || item.category;
    [typeTag, catTag].forEach((text) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = text;
      tagsEl.appendChild(span);
    });
    (item.tags || []).slice(0, 2).forEach((text) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = text;
      tagsEl.appendChild(span);
    });

    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.innerHTML = `
      <button type="button" class="icon-btn copy-btn" title="코드 복사">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        <span>복사</span>
      </button>
      <button type="button" class="icon-btn share-btn" title="공유">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 4.02"/></svg>
        <span>공유</span>
      </button>
    `;

    actions.querySelector(".copy-btn").addEventListener("click", () => copyCode(item.code));
    actions.querySelector(".share-btn").addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}#${item.id}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: item.title, text: item.code, url });
        } else {
          await navigator.clipboard.writeText(url);
          showToast("링크를 복사했습니다.");
        }
      } catch {
        showToast("공유에 실패했습니다.");
      }
    });

    card.appendChild(time);
    card.appendChild(thumbWrap);
    card.appendChild(body);
    card.appendChild(actions);
    els.cardGrid.appendChild(card);
  });
}

let toastTimer;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast("조준점 코드를 복사했습니다.");
  } catch {
    showToast(code);
  }
}

async function loadData() {
  const baas = getBaasConfig();
  if (baas.enabled && baas.provider === "supabase") {
    const url = `${baas.supabaseUrl}/rest/v1/${encodeURIComponent(baas.table)}?select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: baas.supabaseAnonKey,
        Authorization: `Bearer ${baas.supabaseAnonKey}`,
      },
    });
    if (!res.ok) throw new Error("BaaS 데이터를 불러오지 못했습니다.");
    state.items = await res.json();
    return;
  }

  throw new Error("BaaS 설정이 꺼져 있습니다.");
}

function initSortTabs() {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.sort = btn.dataset.sort;
      state.page = 1;
      document.querySelectorAll(".sort-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      applyFilters(true);
    });
  });
}

function initNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;

      document.querySelectorAll(".nav-btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });

      if (nav === "create") {
        window.location.href = "creator.html";
        return;
      }

      if (nav === "main") {
        const mainSection = document.getElementById("mainSection");
        if (mainSection) mainSection.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (nav === "search") {
        const searchSection = document.getElementById("searchSection");
        if (searchSection) searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    });
  });
}

function initHomeNavButtons() {
  const handleNavClick = (el) => {
    if (!el || !el.dataset) return;
    const nav = el.dataset.nav;
    if (!nav) return;

    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.nav === nav)
    });

    if (nav === "create") {
      window.location.href = "creator.html"
      return
    }

    if (nav === "main") {
      const mainSection = document.getElementById("mainSection");
      if (mainSection) mainSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return
    }

    if (nav === "search") {
      const searchSection = document.getElementById("searchSection");
      if (searchSection) searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return
    }
  }

  document.querySelectorAll("[data-nav]").forEach((el) => {
    if (el.classList && el.classList.contains("nav-btn")) return;
    el.addEventListener("click", () => handleNavClick(el));
  });
}

function initPagination() {
  if (!els.pagePrev || !els.pageNext) return;
  els.pagePrev.addEventListener("click", () => {
    if (state.page > 1) goToPage(state.page - 1);
  });
  els.pageNext.addEventListener("click", () => {
    if (!els.pageNext.disabled) goToPage(state.page + 1);
  });
}

function initFavorites() {
  if (!els.favoritesToggle) return;
  els.favoritesToggle.addEventListener("click", () => {
    if (!isLoggedIn()) {
      showToast("즐겨찾기는 로그인 후 이용할 수 있습니다.");
      return;
    }
    state.favoritesOnly = !state.favoritesOnly;
    syncFavoritesToggle();
    applyFilters(true);
  });
  handleAuthStateChange(getLoggedInUser());
}

function initSearch() {
  const syncClear = () => {
    els.searchClear.hidden = !state.query;
  };
  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value;
    state.page = 1;
    syncClear();
    applyFilters(true);
  });
  els.searchClear.addEventListener("click", () => {
    state.query = "";
    state.page = 1;
    els.searchInput.value = "";
    syncClear();
    applyFilters(true);
    els.searchInput.focus();
  });
  syncClear();
}

(async function init() {
  renderChips(els.typeChips, TYPE_OPTIONS, "type", state.type);
  initNav();
  initHomeNavButtons();
  initFavorites();
  initSortTabs();
  initPagination();
  initSearch();
  try {
    await loadData();
    applyFilters(true);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const fetchFail =
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError");

    els.countLabel.textContent = fetchFail
      ? "BaaS 데이터를 불러오지 못했습니다."
      : "데이터 로드에 실패했습니다.";

    els.emptyTitle.textContent = fetchFail
      ? "Supabase 연결을 확인해 주세요"
      : "데이터를 불러오지 못했습니다";

    els.emptyHint.textContent = fetchFail
      ? "baas-config.js의 URL/key/table 값과 Supabase RLS 읽기 정책을 확인해 주세요."
      : msg;

    els.emptyState.hidden = false;
  }
})();
