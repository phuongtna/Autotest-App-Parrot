// Re-export `test`/`expect` từ `@playwright/test` - CHỈ để file test ở
// `flows/web/teacher/testcases/bao-cao-hoc-tap/` import được (cùng lý do + cùng cơ chế shim đã
// giải thích ở automation/quan_ly_goi_dich_vu/playwrightTest.js: `flows/` không resolve được
// `automation/node_modules/` khi import thẳng tên package "@playwright/test").
export { test, expect } from "@playwright/test";
