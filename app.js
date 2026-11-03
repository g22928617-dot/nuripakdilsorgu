
const SUPABASE_URL = "https://ytnohesfcvlgqavxpcui.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_2SJUQszXzzZIJEWoAR54PA_OPEctTP9";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;
let currentProfile = null;
let authMode = "login";
let categories = [];
let selectedCategory = null;
let currentPage = 1;
let totalPages = 1;

const $ = (id) => document.getElementById(id);

function message(id, text, error = false) {
  const element = $(id);
  element.textContent = text;
  element.style.color = error ? "#ff7777" : "#70d6a0";
}

function safeNickname(value) {
  return value.trim().toLowerCase();
}

function emailFromNickname(nickname) {
  return safeNickname(nickname) + "@accounts.datacore.example";
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function isAdmin() {
  return currentProfile?.role === "admin";
}

function showAuth() {
  $("auth-screen").classList.remove("hidden");
  $("main-screen").classList.add("hidden");
}

function showMain() {
  $("auth-screen").classList.add("hidden");
  $("main-screen").classList.remove("hidden");
}

function setPage(page) {
  if (page === "admin" || page === "assistant") {
    if (!isAdmin()) return;
  }

  document.querySelectorAll(".page").forEach(el => {
    el.classList.add("hidden");
  });

  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.remove("active");
  });

  $(page + "-page").classList.remove("hidden");

  document.querySelector(`[data-page="${page}"]`)
    ?.classList.add("active");

  const titles = {
    dashboard: ["Genel Bakış", "Platform genel durumu."],
    queries: ["Sorgulama Merkezi", "Veri kaynaklarında sorgulama yapın."],
    admin: ["Yönetim Paneli", "Kategorileri ve API yapılandırmalarını yönetin."],
    assistant: ["Gemini Asistan", "Yönetici destek merkezi."]
  };

  $("page-title").textContent = titles[page][0];
  $("page-description").textContent = titles[page][1];
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    setPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    setPage(button.dataset.go);
  });
});

// GİRİŞ / KAYIT SEÇİMİ

document.querySelectorAll(".auth-tab").forEach(button => {
  button.addEventListener("click", () => {
    authMode = button.dataset.tab;

    document.querySelectorAll(".auth-tab").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });

    $("auth-submit").textContent =
      authMode === "register" ? "Hesap Oluştur" : "Giriş Yap";

    $("password").autocomplete =
      authMode === "register" ? "new-password" : "current-password";

    message("auth-message", "");
  });
});

// KAYIT VE GİRİŞ

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const nickname = $("nickname").value.trim();
  const password = $("password").value;

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(nickname)) {
    message(
      "auth-message",
      "Kullanıcı adı 3-30 karakter olmalı; harf, sayı ve alt çizgi içermelidir.",
      true
    );
    return;
  }

  if (password.length < 8) {
    message("auth-message", "Parola en az 8 karakter olmalıdır.", true);
    return;
  }

  $("auth-submit").disabled = true;

  try {
    const email = emailFromNickname(nickname);

    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname }
        }
      });

      if (error) throw error;

      if (!data.session) {
        message(
          "auth-message",
          "Kayıt oluşturuldu. Supabase e-posta doğrulama ayarlarını kontrol edin.",
          true
        );
        return;
      }

      message("auth-message", "Hesap oluşturuldu.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
    }

    await loadApplication();

  } catch (error) {
    message("auth-message", error.message || "İşlem başarısız.", true);
  } finally {
    $("auth-submit").disabled = false;
  }
});

// PROFİL VE UYGULAMA YÜKLEME

async function loadApplication() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    showAuth();
    return;
  }

  currentUser = sessionData.session.user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,nickname,role")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    showAuth();
    return;
  }

  currentProfile = profile;

  showMain();

  $("sidebar-username").textContent = profile.nickname;
  $("sidebar-role").textContent =
    profile.role === "admin" ? "Yönetici" : "Kullanıcı";

  $("account-type").textContent =
    profile.role === "admin" ? "Yönetici" : "Kullanıcı";

  $("admin-nav").classList.toggle("hidden", !isAdmin());
  $("ai-nav").classList.toggle("hidden", !isAdmin());

  await loadCategories();
  setPage("dashboard");
}

// ÇIKIŞ

$("logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showAuth();
});

// KATEGORİLER

async function loadCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  categories = data || [];

  $("category-count").textContent = categories.length;

  renderCategories();
  renderAdminCategories();
}

function renderCategories() {
  const container = $("category-list");
  container.replaceChildren();

  if (!categories.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Henüz kategori oluşturulmamış.";
    container.appendChild(empty);
    return;
  }

  categories.forEach(category => {
    const card = document.createElement("button");
    card.className = "category-card";

    const title = document.createElement("strong");
    title.textContent = category.name;

    const description = document.createElement("small");
    description.textContent = "Sorgulama kategorisini aç";

    card.append(title, description);

    card.addEventListener("click", () => {
      selectCategory(category.id);
    });

    container.appendChild(card);
  });
}

function renderAdminCategories() {
  const container = $("admin-category-list");
  container.replaceChildren();

  categories.forEach(category => {
    const row = document.createElement("div");
    row.className = "admin-category";

    const name = document.createElement("strong");
    name.textContent = category.name;

    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.textContent = "Sil";

    remove.addEventListener("click", async () => {
      if (!confirm(category.name + " kategorisini silmek istiyor musunuz?")) {
        return;
      }

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id);

      if (error) {
        message("admin-message", error.message, true);
        return;
      }

      if (selectedCategory?.id === category.id) {
        selectedCategory = null;
        $("query-workspace").classList.add("hidden");
      }

      await loadCategories();
      message("admin-message", "Kategori silindi.");
    });

    row.append(name, remove);
    container.appendChild(row);
  });
}

// KATEGORİ SEÇİMİ

function selectCategory(id) {
  selectedCategory = categories.find(c => c.id === id);

  if (!selectedCategory) return;

  currentPage = 1;

  $("selected-category").textContent = selectedCategory.name;
  $("query-workspace").classList.remove("hidden");
  $("results-container").classList.add("hidden");

  $("query-value").value = "";
  $("query-value").focus();

  setPage("queries");
}

// YENİ KATEGORİ OLUŞTURMA

$("category-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdmin()) return;

  const apiUrl = $("new-category-url").value.trim();

  let parsedUrl;

  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    message("admin-message", "Geçerli bir API adresi girin.", true);
    return;
  }

  if (parsedUrl.protocol !== "https:") {
    message("admin-message", "Yalnızca HTTPS API adresleri kabul edilir.", true);
    return;
  }

  const category = {
    name: $("new-category-name").value.trim(),
    api_url: apiUrl,
    query_param: $("new-category-param").value.trim(),
    results_path: $("new-category-results").value.trim(),
    page_param: $("new-category-page").value.trim(),
    method: $("new-category-method").value
  };

  const { error } = await supabase
    .from("categories")
    .insert(category);

  if (error) {
    message("admin-message", error.message, true);
    return;
  }

  $("category-form").reset();
  await loadCategories();

  message("admin-message", "Kategori başarıyla oluşturuldu.");
});

// API SORGULAMA

$("query-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedCategory) return;

  const value = $("query-value").value.trim();

  if (!value) return;

  currentPage = 1;
  await runQuery();
});

async function runQuery() {
  if (!selectedCategory) return;

  message("query-message", "Sorgulama gerçekleştiriliyor...");

  $("results-container").classList.add("hidden");

  try {
    const token = await getToken();

    const response = await fetch("/.netlify/functions/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        categoryId: selectedCategory.id,
        value: $("query-value").value.trim(),
        page: currentPage
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Sorgulama başarısız.");
    }

    totalPages = result.totalPages || 1;

    $("results-content").textContent =
      JSON.stringify(result.data, null, 2);

    $("result-count").textContent =
      "Sayfa " + currentPage + " / " + totalPages;

    $("results-container").classList.remove("hidden");

    renderPagination();

    message("query-message", "Sorgulama tamamlandı.");

  } catch (error) {
    message("query-message", error.message, true);
  }
}

// SAYFALAMA

function renderPagination() {
  const container = $("pagination");
  container.replaceChildren();

  const maxPages = Math.min(totalPages, 100);

  for (let page = 1; page <= maxPages; page++) {
    const button = document.createElement("button");

    button.textContent = page;

    if (page === currentPage) {
      button.classList.add("active");
    }

    button.addEventListener("click", async () => {
      currentPage = page;
      await runQuery();
    });

    container.appendChild(button);
  }

  if (currentPage < totalPages) {
    const next = document.createElement("button");
    next.textContent = "Sonraki →";

    next.addEventListener("click", async () => {
      currentPage++;
      await runQuery();
    });

    container.appendChild(next);
  }

  if (currentPage > 1) {
    const previous = document.createElement("button");
    previous.textContent = "← Önceki";

    previous.addEventListener("click", async () => {
      currentPage--;
      await runQuery();
    });

    container.prepend(previous);
  }
}

// GEMINI ASİSTANI

$("ai-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdmin()) return;

  const input = $("ai-input");
  const prompt = input.value.trim();

  if (!prompt) return;

  addAIMessage(prompt, true);
  input.value = "";

  const loading = addAIMessage("Yanıt hazırlanıyor...", false);

  try {
    const token = await getToken();

    const response = await fetch("/.netlify/functions/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ prompt })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Asistan yanıt veremedi.");
    }

    loading.textContent = result.answer;

  } catch (error) {
    loading.textContent = error.message;
  }
});

function addAIMessage(text, user) {
  const container = $("ai-messages");
  const element = document.createElement("div");

  element.className = user ? "user-message" : "ai-message";
  element.textContent = text;

  container.appendChild(element);
  container.scrollTop = container.scrollHeight;

  return element;
}

// OTURUM KONTROLÜ

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    showAuth();
  }
});

loadApplication();

