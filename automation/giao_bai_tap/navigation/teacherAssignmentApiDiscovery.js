/**
 * Discovery THẬT qua API trực tiếp (KHÔNG qua DOM/Playwright) cho cây "Unit -> Lesson -> Exercise
 * item" của ĐÚNG pipeline mà form "Giao bài" Web GV dùng (mode="BY_TEACHER", bộ sách "Kết nối tri
 * thức") - THAY THẾ hoàn toàn cách cũ "random Unit/Lesson mù trên UI rồi reroll khi gặp ngõ cụt"
 * (automation/giao_bai_tap/runtime/assignHomeworkFlow.js bản cũ, RANDOM_SELECTION_MAX_ATTEMPTS).
 *
 * NGUỒN XÁC NHẬN THẬT (2026-08-12, network capture từ chính Playwright session của
 * dataDiscovery.mjs khi thao tác form giao bài - xem automation/output/data_discovery/A/
 * network_log.json): 4 endpoint dưới đây, ĐÚNG THỨ TỰ form Web GV tự gọi khi mở "Chọn Unit"/
 * "Chọn Lesson"/"Danh sách bài tập":
 *   GET  /api/learn/school/book-set                                -> {id, name} mỗi bộ sách
 *   GET  /api/learn/unit?book_set_id=...&class_id=...               -> Unit[] (CÓ field "status"
 *        nhưng ĐÃ XÁC NHẬN THẬT toàn bộ 24/24 Unit của bộ "Kết nối tri thức" đều status="done" dù
 *        chỉ 7/24 Unit thực sự có exercise item nào đó gắn exam - "status" KHÔNG dùng được để lọc,
 *        đúng cảnh báo đã nhận, phải xuống tới cấp item)
 *   GET  /api/learn/lesson/:unitId                                  -> Lesson[] (mỗi lesson có
 *        "tag_id" - dùng làm tham số bắt buộc cho bước sau, KHÔNG phải lesson.id)
 *   POST /api/learn/items {tag_ids:[lesson.tag_id], unit_id}        -> Exercise item[], mỗi item
 *        có exam_ids[]/question_count/room_id/mode/skills - "eligible" = exam_ids.length>0 VÀ
 *        question_count là số (KHÔNG dùng field nào khác để suy đoán, đã verify qua network capture
 *        thật rằng item KHÔNG có 2 field này luôn khiến "Giao bài đã chọn" không tạo được room -
 *        xem comment cũ trong assignHomeworkFlow.js).
 *
 * "class_id" (không phải tên lớp hiển thị "3B") lấy qua GET /api/classes/teacher?academic_year_id=
 * ...  - cần đúng academic_year_id (KHÔNG có mặc định ổn định: gọi thiếu param này trả về danh
 * sách lớp của 1 năm học KHÁC, đã verify thật 2026-08-12) nên phải tự chọn năm học chứa ngày hiện
 * tại qua GET /api/academic-years trước.
 */
import { config, requireTeacherPortalConfig } from "../../src/config.js";

export class TeacherAssignmentApiError extends Error {}

async function rawFetch(path, { method = "GET", body } = {}) {
  requireTeacherPortalConfig();
  const url = `${config.teacherPortalBaseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.teacherAccessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok || json?.status === false) {
    throw new TeacherAssignmentApiError(
      `${method} ${path} -> HTTP ${res.status}${json?.message ? ` (${json.message})` : ""}`,
    );
  }
  return json?.data;
}

/** Tìm đúng academic_year_id chứa NGÀY HIỆN TẠI (không hardcode 1 năm học cố định - repo này
 * chạy lâu dài, năm học sẽ đổi) - fallback: nếu không có năm học nào bao trùm ngày hiện tại
 * (hiếm, vd đang giữa 2 năm học), lấy năm học có start_date GẦN NHẤT trong quá khứ. */
async function resolveCurrentAcademicYearId() {
  const years = await rawFetch("/api/academic-years");
  if (!Array.isArray(years) || years.length === 0) {
    throw new TeacherAssignmentApiError("GET /api/academic-years trả về rỗng - không xác định được năm học.");
  }
  const now = Date.now();
  const containing = years.find((y) => now >= Date.parse(y.start_date) && now <= Date.parse(y.end_date));
  if (containing) return containing.id;
  const past = years
    .filter((y) => Date.parse(y.start_date) <= now)
    .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date));
  if (past.length > 0) return past[0].id;
  throw new TeacherAssignmentApiError(
    `Không tìm được năm học nào phù hợp với ngày hiện tại trong ${JSON.stringify(years.map((y) => y.name))}.`,
  );
}

/**
 * POST /api/learn/items {tag_ids:[tagId], unit_id} - trả nguyên mảng Exercise item[] của ĐÚNG 1
 * Lesson (xác định bằng tagId, KHÔNG phải lesson.id - xem docblock đầu file). Export riêng (tách
 * khỏi fetchEligibleAssignmentTree()) để dùng cho teacherMaterialsExamResolver.js - nơi cần tra
 * catalog của ĐÚNG 1 Lesson đã biết trước (từ 1 Room cụ thể), không cần duyệt toàn bộ cây.
 * @param {{ unitId: string, tagId: string }} params
 * @returns {Promise<Array<{id: string, name: string, exam_ids: string[], question_count: number,
 *   skills: string[], room_id: string}>>}
 */
export async function fetchLessonItems({ unitId, tagId }) {
  return rawFetch("/api/learn/items", { method: "POST", body: { tag_ids: [tagId], unit_id: unitId } });
}

/** className hiển thị trên UI (vd "3B") -> class_id thật dùng cho query param. */
export async function resolveClassId(className) {
  const academicYearId = await resolveCurrentAcademicYearId();
  const data = await rawFetch(
    `/api/classes/teacher?academic_year_id=${encodeURIComponent(academicYearId)}&limit=10000&page=1`,
  );
  const match = (data?.classes || []).find((c) => c.name === className);
  if (!match) {
    throw new TeacherAssignmentApiError(
      `Không tìm thấy lớp "${className}" trong năm học hiện tại (academic_year_id=${academicYearId}) - kiểm tra lại primaryClass.`,
    );
  }
  return match.id;
}

/** 1 item eligible: có exam_ids thật (mảng không rỗng) VÀ question_count là số - xem docblock đầu
 * file lý do CHỈ dùng đúng 2 field này để quyết định. */
function isEligibleItem(item) {
  return Array.isArray(item.exam_ids) && item.exam_ids.length > 0 && typeof item.question_count === "number";
}

/** SPEAK = có kỹ năng SPEAKING trong "skills" (ĐÃ XÁC NHẬN THẬT: "G3-U1-Lesson 1: Listen and
 * repeat" - bài luôn rơi vào BLOCKED_MISSING_EXERCISE_HANDLER trên App HS - có skills:["SPEAKING"]
 * trong response API này, xem flows/giao_bai_tap/e2e-teacher-assign-student-open.mjs docblock). */
function isSpeak(item) {
  return Array.isArray(item.skills) && item.skills.includes("SPEAKING");
}

/**
 * Xây TOÀN BỘ cây Unit -> Lesson -> Item eligible thật của bộ sách "Kết nối tri thức" (đúng
 * pipeline BY_TEACHER form giao bài dùng, xem docblock đầu file) cho 1 lớp, TỈA BỎ (yêu cầu 4)
 * mọi Lesson không còn item eligible nào và mọi Unit không còn Lesson eligible nào - CHỈ giữ lại
 * nhánh thật sự có thể giao. Trả về đủ thống kê (yêu cầu report [UNIT_DISCOVERY]/[LESSON_DISCOVERY]/
 * [EXERCISE_DISCOVERY]) VÀ cây đã tỉa để random (yêu cầu [RANDOM_CANDIDATES]).
 *
 * @param {string} className - vd "3B"
 * @returns {Promise<{bookSet, classId, stats:{totalUnits,eligibleUnits,totalItems,itemsWithExam,
 *   itemsWithoutExam}, allUnits: Array<{id,name,status}>, eligibleTree: Array<{unitId,unitName,
 *   lessons: Array<{lessonId,lessonName,items: Array<{id,name,examIds,questionCount,skills,roomId,
 *   isSpeak}>}>}>}>}
 */
export async function fetchEligibleAssignmentTree(className) {
  const bookSets = await rawFetch("/api/learn/school/book-set");
  const bookSet = (bookSets || []).find((b) => b.name.includes("Kết nối tri thức"));
  if (!bookSet) {
    throw new TeacherAssignmentApiError(
      `Không tìm thấy book-set "Kết nối tri thức" trong ${JSON.stringify((bookSets || []).map((b) => b.name))}.`,
    );
  }

  const classId = await resolveClassId(className);
  const allUnits = await rawFetch(`/api/learn/unit?book_set_id=${bookSet.id}&class_id=${classId}`);

  const eligibleTree = [];
  let totalItems = 0;
  let itemsWithExam = 0;

  for (const unit of allUnits) {
    const lessons = await rawFetch(`/api/learn/lesson/${unit.id}`);
    const eligibleLessons = [];
    for (const lesson of lessons || []) {
      const items = await rawFetch("/api/learn/items", {
        method: "POST",
        body: { tag_ids: [lesson.tag_id], unit_id: unit.id },
      });
      totalItems += (items || []).length;
      const eligibleItems = (items || [])
        .filter(isEligibleItem)
        .map((it) => ({
          id: it.id,
          name: it.name,
          examIds: it.exam_ids,
          questionCount: it.question_count,
          skills: it.skills || [],
          roomId: it.room_id,
          isSpeak: isSpeak(it),
        }));
      itemsWithExam += eligibleItems.length;
      if (eligibleItems.length > 0) {
        eligibleLessons.push({ lessonId: lesson.id, lessonName: lesson.name, items: eligibleItems });
      }
    }
    if (eligibleLessons.length > 0) {
      eligibleTree.push({ unitId: unit.id, unitName: unit.name, lessons: eligibleLessons });
    }
  }

  return {
    bookSet,
    classId,
    stats: {
      totalUnits: allUnits.length,
      eligibleUnits: eligibleTree.length,
      totalItems,
      itemsWithExam,
      itemsWithoutExam: totalItems - itemsWithExam,
    },
    allUnits: allUnits.map((u) => ({ id: u.id, name: u.name, status: u.status })),
    eligibleTree,
  };
}

export class NoEligibleAssignmentError extends TeacherAssignmentApiError {}

/** Thu hẹp cây eligible về ĐÚNG 1 Unit (và/hoặc 1 Lesson của Unit đó) khi caller CHỈ ĐỊNH SẴN
 * unitName/lessonName (case debug/tái hiện case cụ thể) nhưng vẫn để trống homeworkItemName -
 * random assignment CHỈ trong phạm vi đã chỉ định, không random tự do toàn bộ cây. Không tự bỏ
 * qua unitName/lessonName không tồn tại/không còn eligible - trả về cây rỗng, để
 * pickRandomEligibleAssignment tự throw NoEligibleAssignmentError (không đoán/không âm thầm bỏ
 * qua filter). */
export function filterEligibleTree(eligibleTree, { unitName, lessonName } = {}) {
  let tree = eligibleTree;
  if (unitName) {
    tree = tree.filter((u) => u.unitName === unitName);
  }
  if (lessonName) {
    tree = tree
      .map((u) => ({ ...u, lessons: u.lessons.filter((l) => l.lessonName === lessonName) }))
      .filter((u) => u.lessons.length > 0);
  }
  return tree;
}

/**
 * Random ĐÚNG theo cấu trúc yêu cầu (mục 6): random 1 Unit eligible -> random 1 Lesson eligible
 * CỦA Unit đó -> random 1 assignment eligible CỦA Lesson đó. KHÔNG filter bỏ SPEAK (yêu cầu 8/9 -
 * SPEAK vẫn là kết quả hợp lệ, downstream tự báo BLOCKED_MISSING_EXERCISE_HANDLER khi cần).
 * Throw NoEligibleAssignmentError nếu cây rỗng (yêu cầu: BLOCKED_NO_ELIGIBLE_ASSIGNMENT).
 */
export function pickRandomEligibleAssignment(eligibleTree) {
  if (!eligibleTree || eligibleTree.length === 0) {
    throw new NoEligibleAssignmentError(
      "BLOCKED_NO_ELIGIBLE_ASSIGNMENT: không còn Unit/Lesson/assignment nào thực sự có exam để random.",
    );
  }
  const unit = eligibleTree[Math.floor(Math.random() * eligibleTree.length)];
  const lesson = unit.lessons[Math.floor(Math.random() * unit.lessons.length)];
  const item = lesson.items[Math.floor(Math.random() * lesson.items.length)];
  return {
    unitName: unit.unitName,
    lessonName: lesson.lessonName,
    homeworkItemName: item.name,
    exerciseId: item.id,
    examIds: item.examIds,
    questionCount: item.questionCount,
    skills: item.skills,
    type: item.isSpeak ? "SPEAK" : "OTHER",
  };
}
