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
const title = `AUTO_QA_TBT_UPLOAD_EXPLORE3_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await loginTeacherPortalUi(page, { baseUrl: BASE_URL, username: "0915315315", password: "123456789" });
  await gotoKhoi(page, BASE_URL, "11");
  await openUnit(page, "UNIT 1: LEISURE TIME");
  await openLesson(page, "READING");
  await createPractice(page, title);

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
  console.log("img preview count before save:", await page.locator('img[alt="preview"]').count());

  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await page.getByText(/thành công/i).first().waitFor({ state: "visible", timeout: 10000 });
  console.log("saved ok");

  let found = false;
  for (let i = 0; i < 8; i++) {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const count = await page.locator('img[alt="preview"]').count();
    console.log(`reload attempt ${i + 1}: img preview count =`, count);
    if (count > 0) {
      found = true;
      break;
    }
    await page.waitForTimeout(3000);
  }
  console.log("FINAL: image persisted after save+reload?", found);

  if (found) {
    const previewWrap = page.locator('img[alt="preview"]').first().locator("xpath=..");
    await previewWrap.hover();
    await page.waitForTimeout(300);
    const removeBtn = previewWrap.locator('button[title="Xoá"]');
    const removeVisible = await removeBtn.first().isVisible().catch(() => false);
    console.log("remove button visible on hover:", removeVisible);
    if (removeVisible) {
      await removeBtn.first().click();
      await page.waitForTimeout(500);
      console.log("img preview count after remove click:", await page.locator('img[alt="preview"]').count());
    }
  }
} finally {
  try {
    await deletePracticeByTitle(page, title);
    console.log("cleaned up:", title);
  } catch (e) {
    console.log("CLEANUP FAILED - manual cleanup needed for:", title, e.message);
  }
  await browser.close();
}
