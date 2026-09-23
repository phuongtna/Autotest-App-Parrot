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
const title = `AUTO_QA_TBT_UPLOAD_EXPLORE4_${Date.now()}`;
const questionTitleText = "EXPLORE4 question title text";

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

  await page.locator('input[placeholder="Nhập tiêu đề câu hỏi..."]').fill(questionTitleText);
  await page.waitForTimeout(300);

  async function attach(buttonLocator, filePath) {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), buttonLocator.click()]);
    await chooser.setFiles(filePath);
    await page.waitForTimeout(1500);
  }
  await attach(
    page.getByRole("button", { name: "+ Ảnh", exact: true }).nth(0),
    "them_bai_thuc_hanh/fixtures/upload-files/sample-image.jpg",
  );

  console.log("before save - title input value:", await page.locator('input[placeholder="Nhập tiêu đề câu hỏi..."]').inputValue());
  console.log("before save - img preview count:", await page.locator('img[alt="preview"]').count());

  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await page.getByText(/thành công/i).first().waitFor({ state: "visible", timeout: 10000 });
  console.log("saved ok, waiting then reloading with retries...");

  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const titleVal = await page.locator('input[placeholder="Nhập tiêu đề câu hỏi..."]').inputValue().catch(() => "<not found>");
    const imgCount = await page.locator('img[alt="preview"]').count();
    console.log(`attempt ${i + 1}: title input value = "${titleVal}", img preview count = ${imgCount}`);
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
