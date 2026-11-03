// Re-export `test`/`expect` từ `@playwright/test` - CHỈ để file test ở
// `flows/cms/quan_ly_on_thi/quan_ly_section/` import được (Node resolve `node_modules` ngược lên
// từ vị trí FILE import, `flows/` không nằm trên đường đó tới `automation/node_modules/`). Cùng
// quy ước với `automation/quan_ly_goi_dich_vu/playwrightTest.js` - xem comment gốc ở đó để biết lý
// do đầy đủ (ĐÃ GẶP THẬT 2026-09-07: "Cannot find module" khi import "@playwright/test" trực tiếp
// từ file trong `flows/`).
export { test, expect } from "@playwright/test";
