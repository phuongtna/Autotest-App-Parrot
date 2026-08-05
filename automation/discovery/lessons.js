import { fetchChildListWithFallback } from "./fetchList.js";
import { getEntityId } from "./entityId.js";

/**
 * Lấy danh sách Lesson của 1 Unit cụ thể (unit lấy được từ getUnitsOfBook(), không hardcode).
 */
export async function getLessonsOfUnit(unit) {
  const unitId = getEntityId(unit, ["unitId"]);
  return fetchChildListWithFallback({
    endpointKey: "lessonsOfUnit",
    params: { unitId },
    parentCollection: "units",
    parentId: unitId,
    childCollection: "lessons",
  });
}
