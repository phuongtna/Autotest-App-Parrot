import { addClassFlow } from "./addClassFlow.js";
import { deleteClassFlow } from "./deleteClassFlow.js";

/**
 * Tự động hoá case happy-path "Xóa lớp học thành công" (DEL-02,
 * flows/web/teacher/testcases/lop-phu-trach/xoa-lop.md) theo đúng yêu cầu: PHẢI xóa đúng lớp vừa
 * được tạo ra ở bước trước, không suy đoán/chọn nhầm lớp khác trong danh sách.
 *
 * Cách đảm bảo "chọn đúng lớp đã tạo trước đó": chạy addClassFlow() trước để tạo 1 lớp test mới,
 * lấy `createdClass.id` (id thật trả về từ POST /api/classes) rồi truyền THẲNG vào
 * deleteClassFlow() qua `classId` - deleteClassFlow sẽ vào thẳng `/teacher/class/{id}` bằng URL,
 * an toàn tuyệt đối, không phụ thuộc việc tìm card theo tên (tên có thể trùng với lớp khác - xem
 * case ADD-11/rule chưa rõ). deleteClassFlow vẫn tự assert popup xác nhận xóa nhắc đúng tên lớp
 * (`className`) trước khi bấm "Xác nhận", nên vẫn double-check tên khớp id.
 *
 * @param {object} params
 * @param {string} params.khoi - label dropdown Khối lúc tạo lớp, vd "Khối 7".
 * @param {string} params.tenLop - tên lớp test sẽ tạo rồi xóa ngay, vd "7QA-DeleteTest-<ts>".
 *   Caller nên truyền tên duy nhất (vd gắn timestamp) để không trùng lớp có sẵn.
 * @param {string} [params.namHoc] - label dropdown Năm học lúc tạo (không truyền = giữ mặc định).
 * @param {boolean} [params.headless=true]
 * @param {boolean} [params.debugDump=false]
 * @returns {Promise<{status:"PASS"|"FAIL", steps, error?, addResult, deleteResult}>}
 */
export async function createThenDeleteClassFlow(params) {
  const { khoi, tenLop, namHoc, headless = true, debugDump = false } = params;

  const addResult = await addClassFlow({ khoi, tenLop, namHoc, headless, debugDump });
  if (addResult.status !== "PASS" || !addResult.createdClass) {
    return {
      status: "FAIL",
      steps: addResult.steps,
      error: `Bước tạo lớp thất bại, không thể tiếp tục xóa: ${addResult.error ?? "không rõ lỗi"}`,
      addResult,
      deleteResult: null,
    };
  }

  const { id: classId, name: className } = addResult.createdClass;
  if (!classId) {
    return {
      status: "FAIL",
      steps: addResult.steps,
      error:
        "Tạo lớp thành công nhưng không lấy được id thật (createdClass.id null) - " +
        "không đủ điều kiện an toàn để xóa đúng lớp vừa tạo bằng classId.",
      addResult,
      deleteResult: null,
    };
  }

  const deleteResult = await deleteClassFlow({ className, classId, headless, debugDump });

  return {
    status: deleteResult.status,
    steps: [...addResult.steps, ...deleteResult.steps],
    error: deleteResult.error,
    addResult,
    deleteResult,
  };
}
