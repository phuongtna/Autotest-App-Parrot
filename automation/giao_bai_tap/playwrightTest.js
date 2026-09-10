// Re-export `test`/`expect` từ `@playwright/test` - CHỈ để file test ở `flows/web/teacher/` import
// được. Cùng lý do/cơ chế với `automation/quan_ly_goi_dich_vu/playwrightTest.js` (Node resolve
// `node_modules` ngược từ vị trí FILE đang import, `flows/` không nằm trên đường tìm ngược đó từ
// `automation/node_modules/`) - import "@playwright/test" TRỰC TIẾP từ file trong `flows/` sẽ lỗi
// "Cannot find module". File shim này nằm TRONG `automation/` nên tự resolve được, file ở `flows/`
// chỉ cần import qua đường dẫn tương đối tới file này (không phải tên package).
export { test, expect } from "@playwright/test";
