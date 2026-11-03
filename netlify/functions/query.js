
import { createClient } from "@supabase/supabase-js";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

function reply(statusCode, data) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(data)
  };
}

function getPath(object, path) {
  if (!path) return object;

  return path.split(".").reduce((value, key) => {
    if (value == null) return undefined;
    return value[key];
  }, object);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Yöntem desteklenmiyor." });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return reply(500, { error: "Sunucu yapılandırması eksik." });
    }

    const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return reply(401, { error: "Oturum gerekli." });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return reply(401, { error: "Geçersiz oturum." });
    }

    const body = JSON.parse(event.body || "{}");

    const categoryId = body.categoryId;
    const value = String(body.value || "").trim();
    const page = Number(body.page);

    if (!categoryId || !value || value.length > 500) {
      return reply(400, { error: "Sorgu bilgileri geçersiz." });
    }

    if (!Number.isSafeInteger(page) || page < 1 || page > 1000) {
      return reply(400, { error: "Sayfa numarası geçersiz." });
    }

    const { data: category, error: categoryError } =
      await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .single();

    if (categoryError || !category) {
      return reply(404, { error: "Kategori bulunamadı." });
    }

    let target;

    try {
      target = new URL(category.api_url);
    } catch {
      return reply(400, { error: "API adresi geçersiz." });
    }

    const allowedHosts = (process.env.ALLOWED_API_HOSTS || "")
      .split(",")
      .map(host => host.trim().toLowerCase())
      .filter(Boolean);

    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.port ||
      target.hash ||
      !allowedHosts.includes(target.hostname.toLowerCase())
    ) {
      return reply(403, {
        error: "Bu API adresi sunucu izin listesinde bulunmuyor."
      });
    }

    const queryParam = String(category.query_param || "query");
    const pageParam = String(category.page_param || "page");

    if (
      !/^[a-zA-Z0-9_.-]{1,60}$/.test(queryParam) ||
      !/^[a-zA-Z0-9_.-]{1,60}$/.test(pageParam)
    ) {
      return reply(400, { error: "API parametreleri geçersiz." });
    }

    const method = category.method;

    if (!["GET", "POST"].includes(method)) {
      return reply(400, { error: "API yöntemi desteklenmiyor." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let apiResponse;

    try {
      if (method === "GET") {
        target.searchParams.set(queryParam, value);
        target.searchParams.set(pageParam, String(page));

        apiResponse = await fetch(target, {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: controller.signal,
          redirect: "error"
        });
      } else {
        apiResponse = await fetch(target, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            [queryParam]: value,
            [pageParam]: page
          }),
          signal: controller.signal,
          redirect: "error"
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!apiResponse.ok) {
      return reply(502, {
        error: "Harici API hata verdi.",
        apiStatus: apiResponse.status
      });
    }

    const contentType = apiResponse.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return reply(502, { error: "API JSON formatında yanıt vermedi." });
    }

    const raw = await apiResponse.text();

    if (raw.length > 1000000) {
      return reply(502, { error: "API yanıtı izin verilen boyutu aşıyor." });
    }

    let apiData;

    try {
      apiData = JSON.parse(raw);
    } catch {
      return reply(502, { error: "API yanıtı okunamadı." });
    }

    const resultData = getPath(apiData, category.results_path);

    if (resultData === undefined) {
      return reply(502, {
        error: "Tanımlanan JSON sonuç yolu bulunamadı."
      });
    }

    const paginationInfo =
      apiData?.pagination || apiData?.meta?.pagination || {};

    const reportedPages =
      Number(
        paginationInfo.total_pages ??
        apiData?.totalPages ??
        apiData?.total_pages ??
        1
      );

    const totalPages =
      Number.isSafeInteger(reportedPages) && reportedPages >= page
        ? Math.min(reportedPages, 1000)
        : page;

    return reply(200, {
      success: true,
      page,
      totalPages,
      data: resultData
    });

  } catch (error) {
    console.error("Query error:", error.message);

    return reply(500, {
      error: error.name === "AbortError"
        ? "API yanıt süresi doldu."
        : "Sorgulama sırasında sunucu hatası oluştu."
    });
  }
}

