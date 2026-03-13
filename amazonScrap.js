const { chromium } = require("playwright");
const xlsx = require("xlsx");

// ✏️ Añade aquí las URLs de los productos que quieres scrapear
const URLS = [
  "https://www.amazon.es/dp/B0C7XHY6YS?ref_=MARS_NAVSTRIPE_desktop_echo_show_15&th=1",
  "https://www.amazon.es/PlusAcc-Dot-Bater%C3%ADa-generaci%C3%B3n-reproducci%C3%B3n/dp/B0C5JDNP2M/ref=pd_rhf_dp_s_pd_crcd_d_sccl_2_4/524-6130858-7168613?pd_rd_w=HaqiZ&content-id=amzn1.sym.fefa772b-6540-4186-be83-3322ed57acee&pf_rd_p=fefa772b-6540-4186-be83-3322ed57acee&pf_rd_r=EQZ9EAS32ZQYA8M50TFT&pd_rd_wg=8sw4B&pd_rd_r=16b568c5-6282-4585-b9d3-96e727759519&pd_rd_i=B0C5JDNP2M&th=1",
  "https://www.amazon.es/dp/B0FTM82WR9/ref=sspa_dk_detail_0?psc=1&pd_rd_i=B0FTM82WR9&pd_rd_w=NLXIC&content-id=amzn1.sym.dfec5303-8205-4c53-8624-ce20b3f594e6&pf_rd_p=dfec5303-8205-4c53-8624-ce20b3f594e6&pf_rd_r=M32BZWNJMGW2RSH0826A&pd_rd_wg=wsRUX&pd_rd_r=edab76a7-5d3b-4b83-a3c1-004afc075eac&aref=SgpMEkQCJp&sp_csd=d2lkZ2V0TmFtZT1zcF9kZXRhaWxfdGhlbWF0aWM"
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getProductInfo(page, url) {
  try {
    // Limpiar URL a formato limpio
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    const asin = asinMatch ? asinMatch[1] : "Desconocido";
    if (asinMatch) url = `https://www.amazon.es/dp/${asin}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(2000);

    // Aceptar cookies si aparece
    try {
      const cookieBtn = page.locator("#sp-cc-accept");
      if (await cookieBtn.isVisible({ timeout: 3000 })) {
        await cookieBtn.click();
        await delay(1000);
      }
    } catch {}

    const name = await page.locator("#productTitle, #title, h1.a-size-large").first()
      .textContent({ timeout: 5000 })
      .then(t => t.trim())
      .catch(() => "No encontrado");

    let price = "No disponible";
    const priceSelectors = [
      ".a-price .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      "#apex_desktop .a-price .a-offscreen",
    ];
    for (const selector of priceSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 })) {
          price = (await el.textContent()).trim();
          if (price) break;
        }
      } catch {}
    }

    return { ASIN: asin, Nombre: name.substring(0, 100), Precio: price, URL: url, Fecha: new Date().toLocaleDateString("es-ES"), Hora: new Date().toLocaleTimeString("es-ES") };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { ASIN: "Error", Nombre: "Error", Precio: "Error", URL: url, Fecha: new Date().toLocaleDateString("es-ES"), Hora: new Date().toLocaleTimeString("es-ES") };
  }
}

async function main() {
  console.log("🛒 Amazon Price Scraper");
  console.log("=======================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    extraHTTPHeaders: { "Accept-Language": "es-ES,es;q=0.9" }
  });
  const page = await context.newPage();
  const results = [];

  for (let i = 0; i < URLS.length; i++) {
    console.log(`[${i + 1}/${URLS.length}] ${URLS[i]}`);
    const info = await getProductInfo(page, URLS[i]);
    results.push(info);
    console.log(`  ✅ ${info.Nombre.substring(0, 70)}`);
    console.log(`  💶 ${info.Precio}\n`);
    if (i < URLS.length - 1) await delay(2500 + Math.random() * 2000);
  }

  await browser.close();

  const ws = xlsx.utils.json_to_sheet(results);
  ws["!cols"] = [{ wch: 12 }, { wch: 80 }, { wch: 15 }, { wch: 60 }, { wch: 12 }, { wch: 10 }];
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Precios Amazon");
  const filename = `precios_amazon_${new Date().toISOString().slice(0, 10)}.xlsx`;
  xlsx.writeFile(wb, filename);

  console.log(`✅ Guardado: ${filename}`);
  console.log(`📊 Total: ${results.length} productos`);
}

main();