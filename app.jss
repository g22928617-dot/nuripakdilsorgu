// Base URL ve API Yolları Tanımlamaları
const BASE_URL = "https://apiv2.ajaxsystems.fun";

// Menü Geçiş Yönetimi
const menuLinks = document.querySelectorAll('.sidebar .menu a');
menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        menuLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const target = link.getAttribute('data-target');
        
        // Form kutularını gizle/göster
        document.getElementById('tc-search-box').classList.add('hidden');
        document.getElementById('gsm-search-box').classList.add('hidden');
        document.getElementById('ada-search-box').classList.add('hidden');

        if(target === 'tc-sorgu') document.getElementById('tc-search-box').classList.remove('hidden');
        if(target === 'gsm-sorgu') document.getElementById('gsm-search-box').classList.remove('hidden');
        if(target === 'tapu-sorgu') document.getElementById('ada-search-box').classList.remove('hidden');
    });
});

// Element Seçiciler
const loader = document.getElementById('loader');
const resultsGrid = document.getElementById('results-grid');

// 1. TC SORGULAMA MOTORU (Aynı anda tüm TC API'lerini tetikler)
document.getElementById('btnTcSorgula').addEventListener('click', async () => {
    const tc = document.getElementById('tcInput').value.trim();
    if(tc.length !== 11 || isNaN(tc)) {
        alert("Lütfen geçerli 11 haneli bir TC numarası girin.");
        return;
    }

    // Ekranı temizle ve yükleniyor yap
    resultsGrid.innerHTML = "";
    loader.classList.remove('hidden');

    // İstek atılacak endpoint listesi
    const endpoints = [
        { name: "E-Okul Bilgisi", url: `${BASE_URL}/eokul.php?tc=${tc}` },
        { name: "Adres Bilgisi", url: `${BASE_URL}/adres.php?tc=${tc}` },
        { name: "Tapu Kaydı", url: `${BASE_URL}/tapu.php?tc=${tc}` },
        { name: "GSM Bağlantısı", url: `${BASE_URL}/tcgsm.php?tc=${tc}` },
        { name: "Aile Listesi", url: `${BASE_URL}/aile.php?tc=${tc}` },
        { name: "Aile Pro Bilgisi", url: `${BASE_URL}/ailepro.php?tc=${tc}` },
        { name: "Sülale Bilgisi", url: `${BASE_URL}/sulale.php?tc=${tc}` },
        { name: "Temel TC Bilgisi", url: `${BASE_URL}/tc.php?tc=${tc}` },
        { name: "TC Pro Detay", url: `${BASE_URL}/tcpro.php?tc=${tc}` }
    ];

    // Tüm istekleri paralel olarak başlat (Bug & Donma önleyici Promise.all)
    await Promise.all(endpoints.map(api => fetchAndRender(api.name, api.url)));
    
    loader.classList.add('hidden');
});

// 2. GSM SORGULAMA MOTORU
document.getElementById('btnGsmSorgula').addEventListener('click', async () => {
    const gsm = document.getElementById('gsmInput').value.trim();
    if(!gsm) { alert("Lütfen bir GSM numarası girin."); return; }

    resultsGrid.innerHTML = "";
    loader.classList.remove('hidden');

    const url = `${BASE_URL}/gsmtc.php?gsm=${gsm}&auth=fire`;
    await fetchAndRender("GSM'den TC Sorgu", url);

    loader.classList.add('hidden');
});

// 3. ADA PARSEL SORGULAMA MOTORU
document.getElementById('btnAdaSorgula').addEventListener('click', async () => {
    const il = document.getElementById('ilInput').value.trim();
    const ilce = document.getElementById('ilceInput').value.trim();
    if(!il || !ilce) { alert("Lütfen İl ve İlçe alanlarını doldurun."); return; }

    resultsGrid.innerHTML = "";
    loader.classList.remove('hidden');

    const url = `${BASE_URL}/adaparsel.php?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}`;
    await fetchAndRender("Ada & Parsel Sorgu", url);

    loader.classList.add('hidden');
});


// ORTAK FETCH VE EKRANA BASMA FONKSİYONU (Sistemdeki Bug'ları Önler)
async function fetchAndRender(apiTitle, apiUrl) {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Sunucu hatası");
        
        const data = await response.json();
        
        // Kart elementini inşa et
        const card = document.createElement('div');
        card.className = 'card';
        
        let cardContent = `<h3>${apiTitle} <i class="fa-solid fa-circle-check" style="color:#4ade80;"></i></h3>`;
        
        // Gelen JSON verisini key-value (etiket-değer) olarak ayrıştırıp karta basar
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const [key, value] of Object.entries(data)) {
                cardContent += `
                    <div class="card-item">
                        <span class="label">${key.toUpperCase()}:</span>
                        <span class="value">${value || '-'}</span>
                    </div>`;
            }
        } else if (Array.isArray(data)) {
            // Eğer veri liste halinde (örneğin aile listesi) gelirse
            data.forEach((item, index) => {
                cardContent += `<div style="margin-top:10px; font-weight:bold; color:#3b82f6;">Kayıt #${index + 1}</div>`;
                for (const [key, value] of Object.entries(item)) {
                    cardContent += `
                        <div class="card-item">
                            <span class="label">${key.toUpperCase()}:</span>
                            <span class="value">${value || '-'}</span>
                        </div>`;
                }
            });
        } else {
            cardContent += `<p style="color:var(--text-muted)">Veri bulunamadı veya boş döndü.</p>`;
        }

        card.innerHTML = cardContent;
        resultsGrid.appendChild(card);

    } catch (error) {
        // Herhangi bir API çökerse tüm sitenin durmasını engeller, sadece o karta hata basar
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderLine = "1px solid #ef4444";
        card.innerHTML = `
            <h3 style="color:#ef4444;">${apiTitle} <i class="fa-solid fa-triangle-exclamation"></i></h3>
            <p style="color:var(--text-muted); font-size:13px;">API bağlantısı sağlanamadı veya CORS engeline takıldı.</p>
        `;
        resultsGrid.appendChild(card);
    }
}
