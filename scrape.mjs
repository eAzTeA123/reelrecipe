
import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.tiktok.com/@sinobites/video/7582619561262943521");
  await page.waitForTimeout(5000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.slice(0, 2000));
  await browser.close();
})();

