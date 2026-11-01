const BASE_URL = "https://apiv2.ajaxsystems.fun";

// Menü ve Panel Yönetimi
const menuLinks = document.querySelectorAll('.sidebar .menu a');
menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        menuLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const targetSectionId = link.getAttribute('data-target');
        const panelTitle = link.innerText.trim();
        
        // Başlığı güncelle
        document.getElementById('current-panel-title').innerText = panelTitle + " Paneli";

        // Tüm arama kutularını gizle, sadece seçileni göster
        document.querySelectorAll('.search-section .search-box').forEach(box => {
            box.classList.add('hidden');
        });
        document.getElementById(targetSectionId).classList.remove('hidden');
        
        addLog(`Sekme Değiştirildi: ${panelTitle} alanına geçildi.`, "system");
    });
});

// Detaylı Log Konsolu Fonksiyonu
function addLog(text, type = 'info') {
    const consoleEl = document.getElementById('logConsole');
    const time = new Date().toLocaleTimeString();
    const logLine = document.createElement('div');
    logLine.className = `log-line ${type}`;
    logLine.innerText = `[${time}] ${text}`;
    consoleEl.appendChild(logLine);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Log Temizleme
document.getElementById('btnClearLogs').addEventListener('click', () => {
    document.getElementById('logConsole').innerHTML = '<div class="log-line system">[SİSTEM] Konsol temizlendi.</div>';
});

// BUTON TIKLAMALARINI YAKALAMA (Ortak Tetikleyici)
document.querySelectorAll('.btn-sorgula').forEach(button => {
    button.addEventListener('click', async () => {
        const apiType = button.getAttribute('data-api');
        const parentBox = button.parentElement;
        const resultsContainer = document.getElementById('results-container');

        let finalUrl = "";
        let logName = "";

        // 1. Durum: Ada Parsel Sorgulama (İl ve İlçe ister)
        if (apiType === 'adaparsel') {
            const il = document.getElementById('ilInput').value.trim();
            const ilce = document.getElementById('ilceInput').value.trim();
            if (!il || !ilce) {
                addLog("HATA: İl ve İlçe alanları boş bırakılamaz!", "error");
                alert("Lütfen İl ve İlçe alanlarını doldurun.");
                return;
            }
            finalUrl = `${BASE_URL}/adaparsel.php?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}`;
            logName = `Ada Parsel (${il}/${ilce})`;
        } 
        // 2. Durum: Tüm Diğer TC Tabanlı Sorgulamalar
        else {
            const tcInput = parentBox.querySelector('.tc-input').value.trim();
            if (tcInput.length !== 11 || isNaN(tcInput)) {
                addLog(`HATA: Geçersiz TC Kimlik formatı girildi! (${tcInput})`, "error");
                alert("Lütfen 11 haneli geçerli bir TC kimlik numarası girin.");
                return;
            }
            
            logName = apiType.toUpperCase() + " API";
            // Seçilen türe göre tam linki eşittir'den sonra ekleyerek oluşturuyoruz
            finalUrl = `${BASE_URL}/${apiType}.php?tc=${tcInput}`;
        }

        // Arayüzde Yükleniyor Durumu Oluşturma
        addLog(`Sorgu Başlatıldı -> Adrese bağlanılıyor: ${logName}`, "info");
        resultsContainer.innerHTML = `
            <div class="result-card">
                <h2>${logName} Sorgulanıyor... <i class="fa-solid fa-spinner fa-spin" style="color:#3b82f6;"></i></h2>
                <div class="api-link-box"><i class="fa-solid fa-link"></i> ${finalUrl}</div>
                <p style="color:var(--text-muted); font-size:14px;">Sunucudan ham JSON verileri çözülüyor, lütfen bekleyin...</p>
            </div>
        `;

        // API İstek Motoru (Fetch)
        try {
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error(`HTTP Hata! Kod: ${response.status}`);
            
            const data = await response.json();
            addLog(`BAŞARILI: ${logName} verileri başarıyla ekrana indirildi.`, "success");

            // Ekrana Verileri Basma
            let contentHtml = `
                <div class="result-card">
                    <h2>${logName} Sonuçları <i class="fa-solid fa-circle-check" style="color:#4ade80;"></i></h2>
                    <div class="api-link-box"><i class="fa-solid fa-link"></i> ${finalUrl}</div>
                    <div class="data-grid">
            `;

            // Gelen veri nesne (Object) ise direkt bas
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                for (const [key, value] of Object.entries(data)) {
                    contentHtml += `
                        <div class="data-item">
                            <span class="label">${key}:</span>
                            <span class="value">${value !== null && value !== undefined ? value : '-'}</span>
                        </div>`;
                }
            } 
            // Gelen veri bir liste (Array) ise (Örn: Aile/Sülale listeleri) döngüyle bas
            else if (Array.isArray(data)) {
                if(data.length === 0) {
                    contentHtml += `<p style="color:var(--text-muted); padding:10px;">Eşleşen kayıt bulunamadı.</p>`;
                } else {
                    data.forEach((item, index) => {
                        contentHtml += `<div style="grid-column: 1 / -1; color:#60a5fa; font-size:14px; font-weight:bold; margin-top:15px; border-left:3px solid #3b82f6; padding-left:10px;">Kayıt #${index + 1}</div>`;
                        for (const [key, value] of Object.entries(item)) {
                            contentHtml += `
                                <div class="data-item">
                                    <span class="label">${key}:</span>
                                    <span class="value">${value !== null && value !== undefined ? value : '-'}</span>
                                </div>`;
                        }
                    });
                }
            } else {
                contentHtml += `<p style="color:var(--text-muted); padding:10px;">Dönen veri formatı tanımsız veya boş.</p>`;
            }

            contentHtml += `</div></div>`;
            resultsContainer.innerHTML = contentHtml;

        } catch (error) {
            addLog(`BAĞLANTI HATASI: ${logName} yüklenemedi! Nedeni: ${error.message}`, "error");
            resultsContainer.innerHTML = `
                <div class="result-card" style="border: 1px solid var(--accent-red);">
                    <h2 style="color:var(--accent-red);">${logName} Hatası <i class="fa-solid fa-triangle-exclamation"></i></h2>
                    <div class="api-link-box"><i class="fa-solid fa-link"></i> ${finalUrl}</div>
                    <p style="color:#f87171; font-weight:bold; margin-bottom:10px;">Tarayıcı Güvenlik Engeli (CORS) veya Sunucu Çökmesi</p>
                    <p style="color:var(--text-muted); font-size:13px; line-height:1.5;">
                        Girdiğin link tarayıcı üzerinden doğrudan veri çekilmesine (CORS) izin vermiyor olabilir. 
                        Ancak bu linki tarayıcının adres çubuğuna yapıştırdığında açılıyorsa, bu durum tamamen tarayıcının güvenlik korumasından kaynaklanır.
                    </p>
                </div>
            `;
        }
    });
});
