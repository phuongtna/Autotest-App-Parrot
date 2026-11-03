// Re-export `test`/`expect` từ `@playwright/test` - CHỈ để file test ở
// `flows/cms/quan_ly_on_thi/cau_hinh_bang_diem/` import được (Node resolve `node_modules` ngược
// lên từ vị trí FILE import, `flows/` không nằm trên đường đó tới `automation/node_modules/`).
// Cùng quy ước với `automation/quan_ly_section/playwrightTest.js`.
export { test, expect } from "@playwright/test";
