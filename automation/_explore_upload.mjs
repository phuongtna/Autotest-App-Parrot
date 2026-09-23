import { chromium } from "playwright";
import {
  themBaiThucHanhPageObjects as po,
  loginTeacherPortalUi,
  gotoKhoi,
  openUnit,
  openLesson,
  createPractice,
  deletePracticeByTitle,
} from "./them_bai_thuc_hanh/navigation/themBaiThucHanhPageObjects.js";

const BASE_URL = "https://parrotedu.codeinet.com";
const title = `AUTO_QA_TBT_UPLOAD_EXPLORE_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await loginTeacherPortalUi(page, { baseUrl: BASE_URL, username: "0915315315", password: "123456789" });
await gotoKhoi(page, BASE_URL, "11");
await openUnit(page, "UNIT 1: LEISURE TIME");
await openLesson(page, "READING");
await createPractice(page, title);

await page.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click();
await page.waitForTimeout(1000);

async function attach(buttonLocator, filePath, label) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), buttonLocator.click()]);
  await chooser.setFiles(filePath);
  await page.waitForTimeout(1500);
  console.log(`--- after attach ${label} ---`);
}

const imgBtnTitle = page.getByRole("button", { name: "+ Ảnh", exact: true }).nth(0);
await attach(imgBtnTitle, "them_bai_thuc_hanh/fixtures/upload-files/sample-image.jpg", "title image");

const audioBtnAnswerA = page.getByRole("button", { name: "+ Audio", exact: true }).nth(1);
await attach(audioBtnAnswerA, "them_bai_thuc_hanh/fixtures/upload-files/sample-audio.wav", "answer A audio");

// Dump full DOM text + html near the question card for inspection.
const html = await page.evaluate(() => {
  const heading = [...document.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && e.textContent.trim() === "Đáp án (chọn một đúng)",
  );
  let container = heading.parentElement;
  for (let i = 0; i < 4; i++) container = container.parentElement;
  return container.outerHTML;
});
console.log("=== CONTAINER HTML ===");
console.log(html);

await browser.close();
