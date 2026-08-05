import { chromium } from "playwright";
import { loadExamSession, parseCookieHeader } from "./examSession.js";

/**
 * Mở trang Exam Editor thật (exam.parrotedu.vn) cho 1 examId bất kỳ (không hardcode),
 * dùng session thật (cookie + localStorage) export từ Chrome của user, rồi trả về:
 *   - html: toàn bộ HTML sau khi render xong (để debug/viết parser)
 *   - windowState: các biến global phổ biến của Nuxt/React nếu tồn tại (window.__NUXT__,
 *     window.__INITIAL_STATE__, window.__PRELOADED_STATE__...) để kiểm tra dữ liệu có nằm
 *     trong state client hay chỉ nằm trong DOM đã render.
 *
 * Đây là bước "quan sát" - parseQuestionsFromPage() (đọc thật dữ liệu Question/Answer) sẽ
 * được viết ngay sau khi có kết quả gọi thử với session thật, dựa trên cấu trúc thật quan
 * sát được thay vì đoán trước.
 */
export async function openExamPage(examId) {
  const session = loadExamSession();
  const url = `${session.examOrigin}/exam/add/manual?id=${examId}`;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();

    if (session.cookieHeader) {
      const cookies = parseCookieHeader(session.cookieHeader, session.examOrigin);
      if (cookies.length > 0) {
        await context.addCookies(cookies);
      }
    }

    if (session.localStorage && Object.keys(session.localStorage).length > 0) {
      await context.addInitScript((entries) => {
        for (const [key, value] of Object.entries(entries)) {
          window.localStorage.setItem(key, value);
        }
      }, session.localStorage);
    }

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    const windowState = await page.evaluate(() => ({
      hasNuxt: typeof window.__NUXT__ !== "undefined",
      nuxt: window.__NUXT__ ?? null,
      hasInitialState: typeof window.__INITIAL_STATE__ !== "undefined",
      initialState: window.__INITIAL_STATE__ ?? null,
      hasPreloadedState: typeof window.__PRELOADED_STATE__ !== "undefined",
      preloadedState: window.__PRELOADED_STATE__ ?? null,
    }));
    const html = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText);

    return { url, html, bodyText, windowState };
  } finally {
    await browser.close();
  }
}

/**
 * window.__NUXT__.data lưu kết quả các lệnh gọi useAsyncData/useFetch phía SERVER (SSR) -
 * đây là lý do KHÔNG có request Fetch/XHR nào xuất hiện trên Network tab dù dữ liệu vẫn tới
 * tay client: server đã fetch sẵn rồi nhúng thẳng vào HTML lúc render. Mỗi entry được key
 * bằng 1 hash nội bộ của Nuxt (không phải examId, và có thể đổi khác giữa các lần build) -
 * nên KHÔNG dựa vào tên key, chỉ tìm entry nào có "data.id === examId" (hoặc
 * "data.exam_id === examId" cho phòng trường hợp shape khác) để không hardcode bất kỳ key/id
 * nào - hoạt động cho bất kỳ examId nào được discovery chọn ngẫu nhiên.
 */
function findExamEntryInNuxtData(nuxtData, examId) {
  for (const value of Object.values(nuxtData ?? {})) {
    const entity = value?.data;
    if (entity && typeof entity === "object" && !Array.isArray(entity)) {
      if (entity.id === examId || entity.exam_id === examId) {
        return entity;
      }
    }
  }
  return null;
}

/**
 * Mở trang Exam Editor thật cho 1 examId bất kỳ (không hardcode) và trả về danh sách
 * Question THÔ (nguyên dạng CMS, chưa chuẩn hoá) từ window.__NUXT__.data (xem
 * findExamEntryInNuxtData). Cố tình KHÔNG diễn giải shape của "question"/"answers"/"correct"
 * ở đây - đã quan sát được các dạng bài khác nhau có shape khác hẳn nhau, ví dụ:
 *   - "ONE"/"TRUE_FALSE": answers là mảng object {id, content}, correct là 1 id string.
 *   - "DRAG_DROP": answers là mảng string thuần (word bank), correct là mảng string thuần
 *     (không có id), question.content là mảng string (các đoạn văn bản quanh chỗ trống).
 * Việc diễn giải theo từng shape này thuộc về model/questionModel.js#normalizeQuestion() -
 * đây là lớp DUY NHẤT được phép biết cả 2 shape, để thêm dạng bài mới sau này chỉ cần sửa
 * đúng 1 hàm đó, không phải sửa lại module scrape này.
 *
 * Trả về: { examId, examName, questions: [ <raw question object nguyên văn từ CMS> ] }
 */
export async function parseQuestionsFromExamPage(examId) {
  const { windowState } = await openExamPage(examId);
  if (!windowState.hasNuxt) {
    throw new Error(
      `Trang Exam ${examId} không có window.__NUXT__ - có thể session (cookie "Bearer") đã ` +
        `hết hạn, cập nhật lại automation/.cache/exam_session.json.`,
    );
  }

  const exam = findExamEntryInNuxtData(windowState.nuxt.data, examId);
  if (!exam) {
    throw new Error(
      `Không tìm thấy entry nào trong window.__NUXT__.data có id === "${examId}". ` +
        `Có thể session hết hạn (trang không render được đề thật) hoặc Nuxt đổi shape dữ liệu.`,
    );
  }

  return { examId, examName: exam.name, questions: exam.questions ?? [] };
}
