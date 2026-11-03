// Re-export `test`/`expect` từ `@playwright/test` - CHỈ để file test ở
// `flows/cms/quan_ly_on_thi/ngan_hang_de_thi/` import được (Node resolve `node_modules` ngược lên
// từ vị trí FILE import, `flows/` không nằm trên đường đó tới `automation/node_modules/`). Cùng
// quy ước với `automation/quan_ly_ky_thi/playwrightTest.js` (xem comment gốc ở
// `automation/quan_ly_goi_dich_vu/playwrightTest.js` để biết lý do đầy đủ).
export { test, expect } from "@playwright/test";
