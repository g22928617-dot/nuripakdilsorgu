const BASE_URL = "https://ajaxsystems.fun";

// 1. Sekme Değiştirme Motoru (Doğrudan Çağrılır - Bug Korumalı)
function switchTab(element, sectionId, title) {
    // Menü aktifliğini güncelle
    document.querySelectorAll('.sidebar .menu a').forEach(link => link.classList.remove('active'));
    element.classList.add('active');
    
    // Üst başlığı değiştir
    document.getElementById('current-panel-title').innerText = title + " Paneli";

    // Tüm arama panellerini gizle, sadece seçileni aç
    document.querySelectorAll('.search-section .search-box').forEach(box => box.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    
    addLog(`Sekme Aktif: ${title} arama moduna geçildi.`, "system");
}

// 2. Anlık Loglama Konsol Motoru
function addLog(text, type = 'info') {
    const consoleEl = document.getElementById('logConsole');
    if (!consoleEl) return;
    const time = new Date().toLocaleTimeString();
    const logLine = document.createElement('div');
    logLine.className = `log-line ${type}`;
    logLine.innerText = `[${time}] ${text}`;
    consoleEl.appendChild(logLine);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Log Temizleme Butonu Aksiyonu
document.getElementById('btnClearLogs').addEventListener('click', () => {
    document.getElementById('logConsole').innerHTML = '<div class="log-line system">[SİSTEM] Konsol geçmişi silindi.</div>';
});

// 3. DOĞRUDAN BUTON TETİKLEYİCİLERİ (Bug'lar Engellendi)
document.getElementById('btn-aile').addEventListener('click', () => handleQuery('aile', document.getElementById('input-aile').value));
document.getElementById('btn-ailepro').addEventListener('click', () => handleQuery('ailepro', document.getElementById('input-ailepro').value));
document.getElementById('btn-sulale').addEventListener('click', () => handleQuery('sulale', document.getElementById('input-sulale').value));
document.getElementById('btn-tcgsm').addEventListener('click', () => handleQuery('tcgsm', document.getElementById('input-tcgsm').value));
document.getElementById('btn-eokul').addEventListener('click', () => handleQuery('eokul', document.getElementById('input-eokul').value));
document.getElementById('btn-adres').addEventListener('click', () => handleQuery('adres', document.getElementById('input-adres').value));
document.getElementById('btn-tapu').addEventListener('click', () => handleQuery('tapu', document.getElementById('input-tapu').value));
document.getElementById('btn-tcpro').addEventListener('click', () => handleQuery('tcpro', document.getElementById('input-tcpro').value));

document.getElementById('btn-adaparsel').addEventListener('click', () => {
    const il = document.getElementById('ilInput').value.trim();
    const ilce = document.getElementById('ilceInput').value.trim();
    if (!il || !ilce) {
        addLog("HATA: Ada/Parsel için İl ve İlçe zorunludur!", "error");
        alert("Lütfen İl ve İlçe alanlarını eksiksiz doldurun.");
        return;
    }
    const targetUrl = `${BASE_URL}/adaparsel.php?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}`;
    executeFetch("Ada Parsel API", targetUrl);
});

// Ortak TC Veri Kontrolü ve Yönlendirici
function handleQuery(apiName, value) {
    const cleanValue = value.trim();
    if (cleanValue.length !== 11 || isNaN(cleanValue)) {
        addLog(`HATA: Giriş doğrulanamadı, 11 hane sayı olmalı! Girilen: "${cleanValue}"`, "error");
        alert("Lütfen 11 haneli geçerli bir numara girin.");
        return;
    }
    const targetUrl = `${BASE_URL}/${apiName}.php?tc=${cleanValue}`;
    executeFetch(apiName.toUpperCase() + " API", targetUrl);
}

// 4. BAĞIMSIZ ASENKRON FETCH MOTORU (Kısıtlamasız Tüm Veriyi Çeker)
async function executeFetch(displayName, fullUrl) {
    const resultsContainer = document.getElementById('results-container');
    
    addLog(`SORGULANIYOR... -> Veri sunucusundan istek yapılıyor: ${displayName}`, "info");
    
    // Ekrana anlık "Sorgulanıyor..." kartını basıyoruz
    resultsContainer.innerHTML = `
        <div class="result-card searching">
            <h2><i class="fa-solid fa-arrows-spin fa-spin"></i> ${displayName} - SORGULANIYOR...</h2>
            <div class="api-link-box"><i class="fa-solid fa-link"></i> ${fullUrl}</div>
            <p style="color:var(--accent-orange); font-size:14px; font-weight:bold; animation: pulse 1.5s infinite;">
                Lütfen bekleyin, API adresindeki veriler toplanıyor ve listeleniyor...
            </p>
        </div>
    `;

    try {
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`Sunucu yanıt vermedi! HTTP Kod: ${response.status}`);
        
        const data = await response.json();
        addLog(`BAŞARILI: ${displayName} sunucusundan gelen tüm veriler alındı.`, "success");

        // Başarılı Kart Yapısı
        let htmlOutput = `
            <div class="result-card success">
                <h2><i class="fa-solid fa-circle-check" style="color:#4ade80;"></i> ${displayName} Sonuçları</h2>
                <div class="api-link-box"><i class="fa-solid fa-link"></i> ${fullUrl}</div>
                <div class="data-grid">
        `;

        // KISITLAMASIZ TÜM VERİLERİ DÖKME MOTORU (Recursive Object Explorer)
        function renderAllData(obj) {
            let chunk = "";
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                // Tekil obje ise içindeki her şeyi döngüyle bas
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'object' && value !== null) {
                        chunk += `<div style="grid-column: 1 / -1; color:#38bdf8; font-size:12px; margin-top:10px;">[${key.toUpperCase()}]</div>`;
                        chunk += renderAllData(value); // İç içe veri varsa onu da açar kısıtlamaz
                    } else {
                        chunk += `
                            <div class="data-item">
                                <span class="label">${key}:</span>
                                <span class="value">${value !== null && value !== undefined ? value : '-'}</span>
                            </div>`;
                    }
                }
            } else if (Array.isArray(obj)) {
                // Eğer liste halinde veri geldiyse tamamını aç
                if (obj.length === 0) {
                    chunk += `<p style="color:var(--text-muted); padding:5px;">Veri listesi boş.</p>`;
                } else {
                    obj.forEach((item, index) => {
                        chunk += `<div style="grid-column: 1 / -1; color:#60a5fa; font-size:13px; font-weight:bold; margin-top:15px; border-left:3px solid #3b82f6; padding-left:10px;">Kayıt #${index + 1}</div>`;
                        if (typeof item === 'object') {
                            chunk += renderAllData(item);
                        } else {
                            chunk += `
                                <div class="data-item">
                                    <span class="label">VERİ:</span>
                                    <span class="value">${item}</span>
                                </div>`;
                        }
                    });
                }
            } else {
                chunk += `<p style="color:var(--text-muted);">Veri yok.</p>`;
            }
            return chunk;
        }

        // Fonksiyonu çalıştırıp tüm veriyi grid içerisine aktarıyoruz
        htmlOutput += renderAllData(data);
        htmlOutput += `</div></div>`;
        resultsContainer.innerHTML = htmlOutput;

    } catch (error) {
        addLog(`BAĞLANTI BAŞARISIZ: ${displayName} yüklenemedi! Hata açıklaması: ${error.message}`, "error");
        resultsContainer.innerHTML = `
            <div class="result-card" style="border: 1px solid var(--accent-red);">
                <h2 style="color:var(--accent-red);"><i class="fa-solid fa-triangle-exclamation"></i> ${displayName} - Bağlantı Koptu</h2>
                <div class="api-link-box"><i class="fa-solid fa-link"></i> ${fullUrl}</div>
                <p style="color:#f87171; font-weight:bold; margin-bottom:8px;">Tarayıcı Güvenlik Kuralı (CORS Bloke) veya Hatalı İstek</p>
                <p style="color:var(--text-muted); font-size:13px; line-height:1.5;">
                    Bu link tarayıcı üzerinden doğrudan veri çekilmesine izin vermiyor (CORS engeli var). 
                    Ancak linki kopyalayıp tarayıcı sekmene yapıştırdığında açılıyorsa, bu web sitesinin kodlarının çalıştığını ama tarayıcının güvenlik korumasına takıldığını gösterir.
                </p>
            </div>
        `;
    }
}
