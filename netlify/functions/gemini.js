
import { createClient } from "@supabase/supabase-js";

function reply(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Yöntem desteklenmiyor." });
  }

  try {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return reply(401, { error: "Oturum gerekli." });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return reply(401, { error: "Oturum geçersiz." });
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

    if (profileError || profile?.role !== "admin") {
      return reply(403, { error: "Bu alana erişim yetkiniz yok." });
    }

    const { prompt } = JSON.parse(event.body || "{}");

    if (
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 2000
    ) {
      return reply(400, { error: "Mesaj geçersiz." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return reply(500, { error: "Gemini yapılandırması eksik." });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `Sen DataCore platformunun yönetici destek asistanısın.

Görevin:
- API yapılandırmalarını açıklamak.
- Yönetim paneli hakkında bilgi vermek.
- Teknik hataları yorumlamak.
- Kullanıcıya resmi, anlaşılır ve Türkçe yanıt vermek.
- Güvenlik açıkları ve yanlış yapılandırmalar konusunda uyarıda bulunmak.

Kurallar:
- Yönetici talimatları olmadan sistemde değişiklik yaptığını iddia etme.
- Gizli anahtarları veya parolaları isteme.
- Yetkisiz kişisel veri sorgulamalarına yardımcı olma.
- Bilmediğin teknik konularda tahmin yürütme.
- Sistem üzerinde doğrudan işlem yapmadığını açıkça belirt.`
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt.trim() }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1200
          }
        }),
        signal: AbortSignal.timeout(30000)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Gemini API status:", response.status);
      return reply(502, { error: "Gemini hizmeti yanıt veremedi." });
    }

    const answer = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return reply(502, { error: "Gemini boş yanıt döndürdü." });
    }

    return reply(200, {
      success: true,
      answer
    });

  } catch (error) {
    console.error("Gemini error:", error.message);

    return reply(500, {
      error: "Asistan bağlantısında hata oluştu."
    });
  }
}

