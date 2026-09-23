import { chromium } from "playwright";
import {
  loginTeacherPortalUi,
  gotoKhoi,
  openUnit,
  openLesson,
  createPractice,
  deletePracticeByTitle,
} from "./them_bai_thuc_hanh/navigation/themBaiThucHanhPageObjects.js";

const BASE_URL = "https://parrotedu.codeinet.com";
const title = `AUTO_QA_TBT_UPLOAD_EXPLORE2_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await loginTeacherPortalUi(page, { baseUrl: BASE_URL, username: "0915315315", password: "123456789" });
await gotoKhoi(page, BASE_URL, "11");
await openUnit(page, "UNIT 1: LEISURE TIME");
await openLesson(page, "READING");
await createPractice(page, title);
const editUrl = page.url();

await page.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click();
await page.waitForTimeout(1000);

async function attach(buttonLocator, filePath) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), buttonLocator.click()]);
  await chooser.setFiles(filePath);
  await page.waitForTimeout(1500);
}

await attach(
  page.getByRole("button", { name: "+ Ảnh", exact: true }).nth(0),
  "them_bai_thuc_hanh/fixtures/upload-files/sample-image.jpg",
);

const hasImgBeforeSave = await page.locator('img[alt="preview"]').count();
console.log("img preview count before save:", hasImgBeforeSave);

await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
await page.getByText(/thành công/i).first().waitFor({ state: "visible", timeout: 10000 });
console.log("saved ok");

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const hasImgAfterReload = await page.locator('img[alt="preview"]').count();
const imgSrcAfterReload = hasImgAfterReload ? await page.locator('img[alt="preview"]').first().getAttribute("src") : null;
console.log("img preview count after reload:", hasImgAfterReload, imgSrcAfterReload);

// Try removing it - hover then click title="Xoá" near the preview.
const previewWrap = page.locator('img[alt="preview"]').first().locator("xpath=..");
await previewWrap.hover();
await page.waitForTimeout(300);
const removeBtn = previewWrap.locator('button[title="Xoá"]');
console.log("remove button visible:", await removeBtn.first().isVisible().catch(() => false));
await removeBtn.first().click();
await page.waitForTimeout(500);
const hasImgAfterRemove = await page.locator('img[alt="preview"]').count();
console.log("img preview count after remove click:", hasImgAfterRemove);

await deletePracticeByTitle(page, title);
console.log("cleaned up:", title);

await browser.close();
