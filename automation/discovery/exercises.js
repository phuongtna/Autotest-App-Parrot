import { fetchEntityWithFallback } from "./fetchList.js";
import { getEntityId } from "./entityId.js";

/**
 * Đảm bảo Exercise có đủ "exam_ids" (mảng id Exam thật) để đi tiếp sang exams.js.
 * Quan sát thực tế: node EXERCISE lấy từ lessonItemsOfLesson/childrenOfLessonItem đã có
 * sẵn "room_id" + "exam_ids" ngay trong response list - không cần gọi thêm API. Chỉ khi
 * thiếu "exam_ids" (vd CMS đổi shape sau này) mới fallback gọi lessonItemDetail để lấy qua
 * "item_content.exams[].id".
 */
export async function getExerciseDetail(exerciseItem) {
  if (Array.isArray(exerciseItem.exam_ids) && exerciseItem.exam_ids.length > 0) {
    return exerciseItem;
  }

  const lessonItemId = getEntityId(exerciseItem, ["lessonItemId"]);
  const detail = await fetchEntityWithFallback({
    endpointKey: "lessonItemDetail",
    params: { lessonItemId },
    candidates: [`/lesson-items/${lessonItemId}`, `/exercises/${lessonItemId}`],
  });

  const room = detail.item_content;
  const examIds = Array.isArray(room?.exams) ? room.exams.map((e) => e.id) : [];
  if (examIds.length === 0) {
    throw new Error(
      `Exercise "${exerciseItem.name ?? lessonItemId}" không tìm thấy exam nào ` +
        `(cả "exam_ids" trong list lẫn "item_content.exams" trong detail đều rỗng).`,
    );
  }
  return { ...detail, exam_ids: examIds, room };
}
