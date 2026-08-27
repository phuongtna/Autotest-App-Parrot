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
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.teacherAccessToken}`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
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
        // lessonTag (MỚI 2026-08-21, additive - KHÔNG đổi field cũ nào): `GET /api/learn/lesson/:unitId`
        // trả kèm `lesson.tag.name` - XÁC NHẬN THẬT (curl trực tiếp, Unit 3: Community service) đây
        // CHÍNH LÀ tên nút "Chọn Lesson" thật hiển thị trên Web GV (vd lesson.name="Grammar" nhưng
        // lesson.tag.name="A closer look 2" - tên nút bấm được là tag.name, KHÔNG PHẢI lesson.name).
        // Trước đây (assignHomeworkFlow.js#resolveAndSelectLesson) truyền thẳng lesson.name vào so
        // khớp EXACT với text nút DOM - SAI với lesson nào có lessonName != tag.name (đã gặp FAIL
        // thật 2 lần: "VOCABULARY & GRAMMAR" tag="Other", "Looking back: Skills" tag="Looking back").
        eligibleLessons.push({ lessonId: lesson.id, lessonName: lesson.name, lessonTag: lesson.tag?.name ?? null, items: eligibleItems });
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

export class RoomNotFoundError extends TeacherAssignmentApiError {}

/**
 * Tìm room (assignment đã giao) THẬT qua `GET /api/user/exams/room.json` bằng lessonItemId
 * (catalog item id, khớp `room.lesson_item_id` - xem endpoint doc đầu file) + classId - dùng để
 * lấy đúng `room.id` (= id thật trong URL `/teacher/exercise/{id}/edit|report`) NGAY SAU khi tạo
 * assignment mới qua assignHomeworkFlow.js.
 *
 * SỬA/THAY THẾ (2026-08-27, FAIL thật xác nhận qua chạy live): trước đây định vị dòng vừa tạo
 * trên "Danh sách bài tập đã giao" bằng cách so khớp DOM className+itemName+dueDateLine (xem
 * navigation/teacherAssignedListPageObjects.js#locateAssignedRow) - PHÁT HIỆN THẬT: title bài tập
 * rất chung chung (vd "Choose the correct answer.", "Read the text and choose the correct
 * answer.") LẶP LẠI ở nhiều catalog item khác nhau (khác `lesson_item_id`, khác Unit/Lesson) - 2
 * assignment thật trùng cả title+lớp+hạn nộp cùng lúc tồn tại (đã xác nhận qua API), khiến việc so
 * khớp CHỈ bằng title+lớp+hạn nộp bị ambiguous (count()>1) và bị `locateAssignedRowAcrossPages` âm
 * thầm coi là "không tìm thấy trên trang này" (không phân biệt được "không có" và "có nhưng không
 * duy nhất"), dẫn tới quét hết mọi trang mà vẫn báo lỗi dù dòng thật sự có tồn tại. `lesson_item_id`
 * là id ổn định của catalog item (KHÔNG bao giờ trùng giữa 2 item khác nhau, khác hẳn title hiển
 * thị) - dùng để định vị CHẮC CHẮN đúng room, không phụ thuộc DOM/pagination/search UI (đã xác
 * nhận KHÔNG hoạt động đúng - xem searchByItemName).
 *
 * SỬA (2026-08-27, xác nhận thật): object `room` trong response KHÔNG có field `created_at` (luôn
 * `undefined`) - KHÔNG dùng được để chọn "room mới nhất" khi có ≥2 room cũ trùng lessonItemId+lớp
 * (đã xác nhận thật có sẵn 4 room cũ như vậy trên tài khoản GV "Phương", từ các lần chạy test
 * trước không dọn hết). Dùng `endTimeDatePrefix` ("YYYY-MM-DD", khớp tiền tố `room.end_time`) để
 * thu hẹp đúng 1 room - vì test luôn tự đặt `dueDate` lúc tạo nên biết chắc giá trị này, đáng tin
 * hơn nhiều so với đoán "mới nhất" qua field không tồn tại.
 *
 * SỬA (2026-08-27, root cause THẬT của chuỗi FAIL "không tìm thấy room" nhiều lần liên tiếp khi
 * mới viết hàm này): `rawFetch()` ở đầu file ĐÃ tự bóc `json?.data` rồi (trả thẳng mảng), code cũ
 * ở đây lại bóc thêm lần nữa (`data?.data`) - luôn ra `undefined` -> `rows` luôn rỗng -> `break`
 * ngay ở trang 1 mọi lần, không bao giờ thực sự quét được dữ liệu thật dù retry bao nhiêu lần hay
 * chờ bao lâu. Từng nghi nhầm là "cache CDN" hoặc "độ trễ lan truyền" (network capture qua Python
 * urllib độc lập vẫn thấy dữ liệu đúng ngay lập tức, trong khi đúng cùng lúc đó hàm này báo
 * "không tìm thấy") - mãi tới khi log riêng từng bước trong vòng lặp mới lộ `rows.length` luôn là
 * 0. Giữ lại retry (vài lần, khoảng cách ngắn) làm lưới an toàn cho ĐỘ TRỄ LAN TRUYỀN THẬT (có
 * tồn tại nhưng ngắn, không phải nguyên nhân chính) - không dựa hẳn vào retry để che giấu bug.
 *
 * @param {{ lessonItemId: string, classId: string, endTimeDatePrefix?: string, maxPages?: number,
 *   retries?: number, retryDelayMs?: number }} params
 * @returns {Promise<{ id: string, endTime: string }>}
 */
export async function findRoomIdByLessonItem({
  lessonItemId,
  classId,
  endTimeDatePrefix,
  maxPages = 6,
  retries = 4,
  retryDelayMs = 3000,
}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const matches = [];
    for (let page = 1; page <= maxPages; page++) {
      // `_ts`: giữ lại phá cache phòng ngừa (không phải nguyên nhân chính của FAIL trước đây -
      // xem docblock hàm này), vô hại nếu thật ra không có tầng cache nào.
      const rows = (await rawFetch(`/api/user/exams/room.json?limit=50&page=${page}&_ts=${Date.now()}`)) || [];
      if (rows.length === 0) break;
      for (const row of rows) {
        const room = row.room;
        if (room?.lesson_item_id === lessonItemId && (room?.class_ids || []).includes(classId)) {
          matches.push({ id: room.id, endTime: room.end_time });
        }
      }
    }
    const scoped = endTimeDatePrefix ? matches.filter((m) => (m.endTime || "").startsWith(endTimeDatePrefix)) : matches;
    if (scoped.length === 1) return scoped[0];
    if (scoped.length > 1) {
      throw new RoomNotFoundError(
        `findRoomIdByLessonItem: ${scoped.length} room khớp lessonItemId="${lessonItemId}" + classId="${classId}"` +
          `${endTimeDatePrefix ? ` + hạn nộp="${endTimeDatePrefix}"` : ""} (cần đúng 1) - BLOCKED, không đoán.`,
      );
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new RoomNotFoundError(
    `findRoomIdByLessonItem: không tìm thấy room nào khớp lessonItemId="${lessonItemId}" + classId="${classId}"` +
      `${endTimeDatePrefix ? ` + hạn nộp="${endTimeDatePrefix}"` : ""} sau ${retries} lần thử - BLOCKED, không đoán.`,
  );
}

/** Kiểm tra 1 room.id CỤ THỂ (đã biết chắc từ findRoomIdByLessonItem) còn tồn tại trong danh sách
 * hay không - dùng để xác nhận "đã xóa thật" sau bước Xóa (chính xác hơn tìm lại theo
 * lessonItemId, vì có thể có room CŨ khác cùng lessonItemId+classId từ lần chạy test trước còn
 * sót - xem docblock findRoomIdByLessonItem). Trả về `{ endTime }` nếu còn thấy, `null` nếu không. */
export async function findRoomById(roomId, { maxPages = 6 } = {}) {
  for (let page = 1; page <= maxPages; page++) {
    const rows = (await rawFetch(`/api/user/exams/room.json?limit=50&page=${page}&_ts=${Date.now()}`)) || [];
    if (rows.length === 0) break;
    const match = rows.find((row) => row.room?.id === roomId);
    if (match) return { endTime: match.room.end_time };
  }
  return null;
}

/** "2026-08-28T16:59:59.999Z" (end_time, luôn 23:59:59 giờ VN cùng ngày dương lịch UTC - xem
 * ddmmyyyyToIsoDatePrefix trong assignedListLifecycleFlow.js) -> "28/08/2026" (format hiển thị
 * trên UI). */
function isoToDdMmYyyy(iso) {
  const [yyyy, mm, dd] = iso.slice(0, 10).split("-");
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Tìm 1 room THẬT có ĐÚNG 1 HS hoàn thành nhưng làm lại (retake) ≥ 2 lần (status="done" cả 2+
 * lần) - dùng để verify cột "ĐIỂM TB" trên "Danh sách bài tập đã giao" có tính đúng theo rule đã
 * biết ("khi HS làm lại nhiều lần thì dùng điểm của lần điểm cao nhất") hay không.
 *
 * NGUỒN XÁC NHẬN THẬT (2026-08-27, đối chiếu 11 room thật có retake, tất cả đều khớp CHÍNH XÁC):
 * `room.average_score` hiện tại = MAX(điểm các lần làm) / SỐ LẦN làm - KHÔNG phải chỉ lấy điểm
 * cao nhất như acceptance criteria mô tả (case 1 HS, không retake: `average_score` LUÔN khớp
 * đúng điểm lần làm duy nhất - bug CHỈ xảy ra khi có retake). Test dùng hàm này để lấy 1 case retake
 * thật + tính sẵn `expectedCorrectAverage` (= điểm cao nhất, đúng theo spec) so với
 * `apiAverageScoreShownOnList` (giá trị hiện đang hiển thị, có thể sai) để caller tự assert.
 *
 * @param {{ maxPages?: number }} [params]
 * @returns {Promise<null | { roomId, className, itemName, dueDateLine, attemptScores,
 *   attemptsCount, expectedCorrectAverage, apiAverageScoreShownOnList }>}
 */
export async function findRetakeAverageScoreCandidate({ maxPages = 6 } = {}) {
  for (let page = 1; page <= maxPages; page++) {
    requireTeacherPortalConfig();
    const url = `${config.teacherPortalBaseUrl}/api/user/exams/room.json?limit=50&page=${page}&_ts=${Date.now()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.teacherAccessToken}`,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    const json = await res.json();
    const rows = json?.data || [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const room = row.room;
      const doneAnswers = (room?.answers || []).filter((a) => a.status === "done");
      if (room?.completed_students === 1 && doneAnswers.length >= 2) {
        const attemptScores = doneAnswers.map((a) => a.total_point);
        return {
          roomId: room.id,
          className: json.class_names?.[room.class_ids?.[0]] ?? null,
          itemName: room.name,
          dueDateLine: isoToDdMmYyyy(room.end_time),
          attemptScores,
          attemptsCount: attemptScores.length,
          expectedCorrectAverage: Math.max(...attemptScores),
          apiAverageScoreShownOnList: room.average_score,
        };
      }
    }
  }
  return null;
}
