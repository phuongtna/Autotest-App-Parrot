import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loginCmsAdmin } from "../../quan_ly_goi_dich_vu/navigation/cmsAdminSession.js";
import { gotoDeThi, deThiRow } from "../navigation/cmsDeThiPageObjects.js";
import { parseQuestionsFromExamPageWithRetry } from "../../discovery/examPageScraper.js";
import { normalizeQuestions } from "../../model/questionModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// PHẢI khớp đúng default path trong `discovery/examSession.js` (không export hằng đó ra ngoài).
const DEFAULT_EXAM_SESSION_PATH = join(__dirname, "..", "..", ".cache", "exam_session.json");

/**
 * Nguồn đáp án cho module MỚI "Ngân hàng đề thi" (CMS Admin, /exam-prep/papers) - SONG SONG với
 * `../../bai_tap/discovery/teacherMaterialsExamResolver.js` (nguồn cũ cho "Tài liệu giáo viên").
 *
 * ĐÃ XÁC NHẬN THẬT (2026-11-14, staging cms-staging.parrotedu.vn, qua network capture trực tiếp):
 * - Mở màn "Sửa" 1 đề thi gọi NGAY `GET /api/cms/exam-prep/papers/{paperId}` - response đã có sẵn
 *   `sections[].practices[].core_exam_id` (+ `core_exam_name`). KHÔNG cần bấm icon "Xem" (icon đó
 *   chỉ gọi thêm `/api/cms/exams/token` để mở modal xem nhanh trong-trang, không trả thêm dữ liệu
 *   câu hỏi nào, không mở tab/trang mới).
 * - `core_exam_id` CHÍNH LÀ examId dùng được THẲNG cho `examPageScraper.js` đã có sẵn (cùng 1 "Exam
 *   Core" catalog dùng chung bởi cả Tài liệu giáo viên lẫn Ngân hàng đề thi) - đã verify full vòng
 *   lặp: lấy core_exam_id → mở exam-core (`exam-staging.parrotedu.vn/exam/add/manual?id=...`) với
 *   cookie `Bearer=<token lấy qua GET /api/cms/exams/token>` → `window.__NUXT__.data` có đúng
 *   entity, `normalizeQuestions()` (KHÔNG sửa gì) trả ra đúng `correctAnswer` đọc được.
 * - Token CMS Admin (`Authorization: Bearer <JWT>`) là JWT phiên đăng nhập qua `loginCmsAdmin()`
 *   (role "Admin") - KHÁC HẲN `CMS_ACCESS_TOKEN`/`cmsClient.js` (chỉ cấu hình cho production, dùng
 *   cho nguồn cũ) - lấy trực tiếp từ header request thật của chính trang thay vì đoán tên field
 *   localStorage, nên không phụ thuộc cơ chế lưu token nội bộ của SPA.
 * - exam-core là 1 APP RIÊNG, KHÔNG suy ra được từ URL CMS Admin theo quy luật chung (production là
 *   domain gốc "parrotedu.vn" nhưng exam-core lại có subdomain "exam.") - origin dưới đây ĐÃ XÁC
 *   NHẬN THẬT cho dev/staging bằng test trực tiếp 2026-11-14 (production trùng giá trị mặc định đã
 *   dùng ổn định từ trước trong `.cache/exam_session.json`). Override qua `EXAM_CORE_URL_<ENV>` nếu
 *   môi trường đổi domain sau này - KHÔNG đoán thêm env nào chưa verify.
 */
const EXAM_CORE_ORIGIN_BY_ENV = {
  staging: process.env.EXAM_CORE_URL_STAGING || "https://exam-staging.parrotedu.vn",
  production: process.env.EXAM_CORE_URL_PRODUCTION || "https://exam.parrotedu.vn",
};

/**
 * Lấy 1 đề thi theo tên trong "Ngân hàng đề thi", trả về toàn bộ câu hỏi (kèm đáp án đúng) của
 * TỪNG bài thực hành trong từng section - tái sử dụng NGUYÊN `examPageScraper.js`/`questionModel.js`
 * đã có, không viết lại parser/model nào.
 * @returns {Promise<
 *     { status: "RESOLVED", paperId: string, paperName: string, practices: Array<{sectionName, practiceName, coreExamId, status: "RESOLVED", examName, questions} | {sectionName, practiceName, coreExamId, status: "SESSION_ERROR", reason}> }
 *   | { status: "EXAM_CORE_ORIGIN_NOT_CONFIGURED"|"PAPER_NOT_FOUND"|"AUTH_TOKEN_NOT_CAPTURED"|"PAPER_DETAIL_NOT_CAPTURED"|"EXAM_CORE_TOKEN_NOT_RESOLVED", reason: string }
 * >}
 */
export async function resolveExamPrepPaperQuestions(paperName, { envOverride = "staging", headless = true } = {}) {
  const examCoreOrigin = EXAM_CORE_ORIGIN_BY_ENV[envOverride];
  if (!examCoreOrigin) {
    return {
      status: "EXAM_CORE_ORIGIN_NOT_CONFIGURED",
      reason: `Chưa xác nhận exam-core origin cho môi trường "${envOverride}" - thêm vào EXAM_CORE_ORIGIN_BY_ENV (examPrepPaperResolver.js) sau khi verify thật, KHÔNG đoán.`,
    };
  }

  const { browser, page, baseUrl } = await loginCmsAdmin({ envOverride, headless });
  try {
    let adminToken = null;
    let apiOrigin = null;
    let paperDetail = null;
    page.on("response", async (res) => {
      const req = res.request();
      const auth = req.headers()["authorization"];
      if (auth && !adminToken) {
        adminToken = auth;
        apiOrigin = new URL(req.url()).origin;
      }
      if (/\/api\/cms\/exam-prep\/papers\/[0-9a-f-]+$/i.test(req.url())) {
        try {
          const json = await res.json();
          if (json?.data?.id) paperDetail = json.data;
        } catch {}
      }
    });

    await gotoDeThi(page, baseUrl);
    const row = deThiRow(page, paperName);
    if ((await row.count()) === 0) {
      return { status: "PAPER_NOT_FOUND", reason: `Không tìm thấy đề thi "${paperName}" trong Ngân hàng đề thi (env=${envOverride}).` };
    }
    await row.getByRole("button", { name: "Sửa" }).click();
    await page.getByText("Chỉnh sửa đề thi", { exact: false }).first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1500); // cho GET /api/cms/exam-prep/papers/{id} kịp trả về (bất đồng bộ, xem cmsDeThiPageObjects.js#openEditDeThi)

    if (!adminToken || !apiOrigin) {
      return {
        status: "AUTH_TOKEN_NOT_CAPTURED",
        reason: "Không bắt được header Authorization thật từ request CMS Admin - UI có thể đã đổi cơ chế auth.",
      };
    }
    if (!paperDetail) {
      return {
        status: "PAPER_DETAIL_NOT_CAPTURED",
        reason: "Không bắt được response GET /api/cms/exam-prep/papers/{id} - UI có thể đã đổi API.",
      };
    }

    const practices = (paperDetail.sections ?? []).flatMap((s) =>
      (s.practices ?? []).map((p) => ({ sectionName: s.name, practiceName: p.core_exam_name, coreExamId: p.core_exam_id })),
    );

    const tokenRes = await fetch(`${apiOrigin}/api/cms/exams/token`, { headers: { Authorization: adminToken, Accept: "application/json" } });
    const tokenJson = await tokenRes.json().catch(() => null);
    const examCoreToken = tokenJson?.data?.token;
    if (!examCoreToken) {
      return {
        status: "EXAM_CORE_TOKEN_NOT_RESOLVED",
        reason: `GET /api/cms/exams/token (status ${tokenRes.status}) không có data.token: ${JSON.stringify(tokenJson)}`,
      };
    }

    // Ghi session tạm cho examPageScraper.js tái sử dụng NGUYÊN (KHÔNG sửa file đó) - vào ĐÚNG path
    // mặc định `automation/.cache/exam_session.json` mà `examSession.js` đọc. `EXAM_SESSION_FILE`
    // KHÔNG dùng được ở đây: `examSession.js` đọc biến này 1 LẦN DUY NHẤT ở top-level lúc module
    // được import (trước khi hàm này kịp chạy), set lại `process.env` tại runtime không có tác dụng -
    // ĐÃ GẶP THẬT (2026-11-14, session luôn rơi về session production cũ dù đã set biến). Cùng cách
    // ghi đè trực tiếp này đã dùng ổn định ở `pro_lamlai_target_score.mjs#refreshExamSessionFromEnvCookie()`.
    writeFileSync(DEFAULT_EXAM_SESSION_PATH, JSON.stringify({ examOrigin: examCoreOrigin, cookieHeader: `Bearer=${examCoreToken}`, localStorage: {} }, null, 2));

    const results = [];
    for (const practice of practices) {
      try {
        const examData = await parseQuestionsFromExamPageWithRetry(practice.coreExamId);
        results.push({ ...practice, status: "RESOLVED", examName: examData.examName, questions: normalizeQuestions(examData) });
      } catch (err) {
        results.push({ ...practice, status: "SESSION_ERROR", reason: err.message });
      }
    }

    return { status: "RESOLVED", paperId: paperDetail.id, paperName: paperDetail.name, practices: results };
  } finally {
    await browser.close();
  }
}
