const SUPABASE_URL = "https://ytnohesfcvlgqavxpcui.supabase.co";
const SUPABASE_ANON_KEY = "SUPABASE_PUBLISHABLE_KEY_BURAYA";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;
let currentProfile = null;
let categories = [];
let currentPage = 1;
let totalPages = 1;
let currentQuery = "";
let currentCategoryId = null;
let authMode = "login";

const $ = (id) => document.getElementById(id);

function message(id, text, isError = false) {
  const element = $(id);
  element.textContent = text;
  element.style.color = isError ? "#ff8295" : "#9eafff";
}

function nicknameToEmail(nickname) {
  return `${nickname.toLowerCase()}@accounts.datacore.example`;
}

function validNickname(value) {
  return /^[a-zA-Z0-9._-]{3,24}$/.test(value);
}

function showAuth() {
  $("authScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");
}

function showApp() {
  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
}

function setAuthMode(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("authSubmit").textContent = mode === "login" ? "Giriş Yap" : "Kayıt Ol";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  message("authMessage", "");
}

$("loginTab").addEventListener("click", () => setAuthMode("login"));
$("registerTab").addEventListener("click", () => setAuthMode("register"));

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const nickname = $("nickname").value.trim();
  const password = $("password").value;

  if (!validNickname(nickname)) {
    return message("authMessage", "Kullanıcı adı 3-24 karakter olmalı; harf, rakam, nokta, tire ve alt çizgi kullanabilirsiniz.", true);
  }

  if (password.length < 8) {
    return message("authMessage", "Şifre en az 8 karakter olmalıdır.", true);
  }

  $("authSubmit").disabled = true;
  message("authMessage", "İşlem gerçekleştiriliyor...");

  try {
    const email = nicknameToEmail(nickname);

    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname } }
      });

      if (error) throw error;

      if (!data.session) {
        message("authMessage", "Kayıt oluşturuldu. E-posta doğrulaması açıksa hesabınızı doğrulamanız gerekir.");
      } else {
        message("authMessage", "Kayıt başarılı.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      await loadApplication();
    }
  } catch (error) {
    message("authMessage", error.message || "İşlem başarısız.", true);
  } finally {
    $("authSubmit").disabled = false;
  }
});

async function loadApplication() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    showAuth();
    return;
  }

  currentUser = userData.user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,nickname,role")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    showAuth();
    message("authMessage", "Kullanıcı profili bulunamadı. Yöneticiyle iletişime geçin.", true);
    return;
  }

  currentProfile = profile;
  const isAdmin = profile.role === "admin";

  $("userLabel").textContent = profile.nickname || "Kullanıcı";
  $("roleBadge").textContent = isAdmin ? "Yönetici" : "Kullanıcı";
  $("accountType").textContent = isAdmin ? "Yönetici" : "Kullanıcı";
  $("adminNav").classList.toggle("hidden", !isAdmin);
  $("aiNav").classList.toggle("hidden", !isAdmin);

  await loadCategories();
  showApp();
  showPage("dashboard");
}

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
  $("categoryCount").textContent = categories.length;

  $("categorySelect").replaceChildren(new Option("Kategori seçin", ""));
  categories.forEach((category) => {
    $("categorySelect").add(new Option(category.name, category.id));
  });

  $("dashboardCategories").replaceChildren();
  categories.forEach((category) => {
    const card = document.createElement("div");
    card.className = "category-card";

    const title = document.createElement("h4");
    title.textContent = category.name;

    const description = document.createElement("p");
    description.textContent = "Sorgulama kategorisi";

    card.append(title, description);
    $("dashboardCategories").append(card);
  });

  renderAdminCategories();
}

function renderAdminCategories() {
  const container = $("adminCategories");
  container.replaceChildren();

  if (!categories.length) {
    container.textContent = "Henüz kategori eklenmemiş.";
    return;
  }

  categories.forEach((category) => {
    const row = document.createElement("div");
    row.className = "admin-row";

    const name = document.createElement("span");
    name.textContent = category.name;

    const button = document.createElement("button");
    button.className = "delete-btn";
    button.textContent = "Sil";
    button.addEventListener("click", () => deleteCategory(category.id));

    row.append(name, button);
    container.append(row);
  });
}

async function deleteCategory(id) {
  if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    message("categoryMessage", error.message, true);
    return;
  }

  message("categoryMessage", "Kategori silindi.");
  await loadCategories();
}

$("categoryForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (currentProfile?.role !== "admin") return;

  const apiUrl = $("apiUrl").value.trim();

  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== "https:") {
      throw new Error("API adresi HTTPS kullanmalıdır.");
    }
  } catch {
    return message("categoryMessage", "Geçerli bir HTTPS API adresi girin.", true);
  }

  const payload = {
    name: $("categoryName").value.trim(),
    api_url: apiUrl,
    method: $("apiMethod").value,
    query_param: $("queryParam").value.trim(),
    page_param: $("pageParam").value.trim() || "page",
    results_path: $("resultsPath").value.trim(),
    total_pages_path: $("totalPagesPath").value.trim()
  };

  const { error } = await supabase.from("categories").insert(payload);

  if (error) {
    message("categoryMessage", error.message, true);
    return;
  }

  message("categoryMessage", "Kategori başarıyla oluşturuldu.");
  $("categoryForm").reset();
  $("apiMethod").value = "GET";
  $("queryParam").value = "query";
  $("pageParam").value = "page";
  await loadCategories();
});

async function runQuery(page = 1) {
  if (!currentCategoryId || !currentQuery) return;

  message("queryMessage", "Sorgu gerçekleştiriliyor...");
  $("resultPanel").classList.remove("hidden");
  $("resultOutput").textContent = "Yükleniyor...";

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        categoryId: currentCategoryId,
        value: currentQuery,
        page
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Sorgu başarısız.");

    currentPage = result.page;
    totalPages = result.totalPages;

    $("resultOutput").textContent = JSON.stringify(result.results, null, 2);
    $("pageInfo").textContent = `Sayfa ${currentPage} / ${totalPages}`;
    $("prevPage").disabled = currentPage <= 1;
    $("nextPage").disabled = currentPage >= totalPages;
    message("queryMessage", "Sorgu tamamlandı.");
  } catch (error) {
    $("resultOutput").textContent = "";
    message("queryMessage", error.message, true);
  }
}

$("queryForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  currentCategoryId = $("categorySelect").value;
  currentQuery = $("queryValue").value.trim();
  currentPage = 1;

  if (!currentCategoryId || !currentQuery) {
    return message("queryMessage", "Kategori ve sorgu değeri girin.", true);
  }

  await runQuery(1);
});

$("prevPage").addEventListener("click", () => {
  if (currentPage > 1) runQuery(currentPage - 1);
});

$("nextPage").addEventListener("click", () => {
  if (currentPage < totalPages) runQuery(currentPage + 1);
});

function showPage(page) {
  const pages = {
    dashboard: ["dashboardPage", "Genel Bakış"],
    query: ["queryPage", "Sorgulama"],
    admin: ["adminPage", "Yönetim Paneli"],
    assistant: ["assistantPage", "AI Asistan"]
  };

  if (!pages[page]) return;
  if ((page === "admin" || page === "assistant") && currentProfile?.role !== "admin") return;

  Object.values(pages).forEach(([id]) => $(id).classList.add("hidden"));
  $(pages[page][0]).classList.remove("hidden");
  $("pageTitle").textContent = pages[page][1];

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => showPage(item.dataset.page));
});

$("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showAuth();
});

function addChatMessage(text, who) {
  const element = document.createElement("div");
  element.className = `chat-message ${who}`;
  element.textContent = text;
  $("chatMessages").append(element);
  element.scrollIntoView({ block: "nearest" });
}

$("aiForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (currentProfile?.role !== "admin") return;

  const prompt = $("aiInput").value.trim();
  if (!prompt) return;

  $("aiInput").value = "";
  addChatMessage(prompt, "user");
  message("aiMessage", "Yanıt hazırlanıyor...");

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionData.session?.access_token}`
      },
      body: JSON.stringify({ prompt })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "AI yanıt veremedi.");

    addChatMessage(result.answer, "assistant");
    message("aiMessage", "");
  } catch (error) {
    message("aiMessage", error.message, true);
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) showAuth();
});

(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) await loadApplication();
  else showAuth();
})();
