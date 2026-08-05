import { getEntityName } from "./entityId.js";
import { getBooks } from "./books.js";
import { getUnitsOfBook } from "./units.js";
import { shuffle } from "./randomPicker.js";
import { normalizeUnitKey } from "./unitNameKey.js";
import { bootstrapAppSession, openUnitsListForBook, scanUnitsListScreen } from "./unitStatusProbe.js";
import { STATES, detectFromCmsFields, detectFromUiSignals } from "./unitStateDetector.js";

/**
 * Random Book -> random Unit -> hỏi UnitStateDetector -> chưa COMPLETED thì random Unit khác
 * (rồi Book khác khi Book hiện tại hết Unit) - KHÔNG scan/tuần tự toàn bộ Book trước khi thử.
 * Chỉ khi đã thử HẾT mọi Book/Unit mới được kết luận, và CHỈ kết luận
 * "No completed Unit found." khi mọi Unit đều NOT_COMPLETED - còn UNKNOWN thì báo riêng, không
 * quy về "No completed Unit found." (state UNKNOWN nghĩa là "chưa xác định", không phải "chưa
 * hoàn thành").
 *
 * Chi phí thật của việc "mở app đọc trạng thái" nằm ở bước đăng nhập + chuyển Khối (không phải
 * ở việc đọc 1 hay nhiều Unit) - nên khi đã mở "Danh sách Units" của 1 Book, hàm này đọc TÍN
 * HIỆU của TẤT CẢ Unit trong Book đó ngay trong 1 lượt scroll (scanUnitsListScreen), rồi mới
 * random THỨ TỰ để tra cứu/log - vừa giữ đúng ý "random Unit rồi kiểm tra" (thứ tự ngẫu nhiên,
 * dừng ngay khi gặp Unit COMPLETED, không cần đọc hết Book nếu gặp sớm) vừa tránh phải mở lại
 * đúng 1 Book nhiều lần cho từng Unit riêng lẻ.
 *
 * @param {(...args: any[]) => void} [log]
 * @returns {Promise<{ book: Object, unit: Object }>}
 */
export async function findRandomCompletedUnit(log = console.log) {
  const books = await getBooks();
  if (books.length === 0) throw new Error("Không lấy được danh sách Book nào từ CMS.");

  let sessionReady = false;
  const unresolved = []; // { bookName, unitName, result } - state UNKNOWN, chờ kết luận cuối

  for (const book of shuffle(books)) {
    const bookName = getEntityName(book) ?? "(Book không tên)";
    const units = await getUnitsOfBook(book);
    if (units.length === 0) continue;

    log(`\nBook ${bookName}`);

    const cmsResults = new Map(units.map((unit) => [unit, detectFromCmsFields(unit)]));
    const needsUiScan = units.some((unit) => {
      const cms = cmsResults.get(unit);
      return !cms || cms.state === STATES.UNKNOWN;
    });

    let uiCardsByKey = new Map();
    if (needsUiScan) {
      if (!sessionReady) {
        bootstrapAppSession();
        sessionReady = true;
      }
      openUnitsListForBook(bookName);
      uiCardsByKey = scanUnitsListScreen();
    }

    for (const unit of shuffle(units)) {
      const unitName = getEntityName(unit) ?? "(không tên)";
      const cms = cmsResults.get(unit);
      const result =
        cms && cms.state !== STATES.UNKNOWN
          ? cms
          : detectFromUiSignals(uiCardsByKey.get(normalizeUnitKey(unitName)) ?? null);

      log(`\nUnit ${unitName}`);
      log(`State = ${result.state}`);
      log(`Source = ${result.source}`);
      log(`Confidence = ${result.confidence.toFixed(2)}`);
      if (result.reason) log(`Reason = ${result.reason}`);

      if (result.state === STATES.COMPLETED) {
        log(`\nUnit được chọn: ${unitName}`);
        return { book, unit };
      }
      if (result.state === STATES.UNKNOWN) {
        unresolved.push({ bookName, unitName, result });
      }
    }
  }

  if (unresolved.length > 0) {
    const detail = unresolved
      .map((u) => `  - ${u.bookName} / ${u.unitName} (confidence=${u.result.confidence.toFixed(2)})`)
      .join("\n");
    throw new Error(
      `Không thể kết luận "No completed Unit found." - còn ${unresolved.length} Unit ở trạng ` +
        `thái UNKNOWN (chưa xác định được), chưa đủ căn cứ báo không có Unit Hoàn thành:\n${detail}`,
    );
  }

  throw new Error("No completed Unit found.");
}
