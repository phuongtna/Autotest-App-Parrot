// Re-export `test`/`expect` từ `@playwright/test` - CHỈ để file test ở `flows/cms/goi_dich_vu/`
// import được. Node resolve `node_modules` bằng cách tìm ngược lên từ vị trí FILE đang import,
// và `automation/node_modules/` không nằm trên đường tìm ngược đó từ `flows/` (2 thư mục khác
// nhánh, không phải cha-con) - import "@playwright/test" TRỰC TIẾP từ file trong `flows/` sẽ lỗi
// "Cannot find module" (ĐÃ GẶP THẬT 2026-09-07). File shim này nằm TRONG `automation/` nên tự
// resolve được, file ở `flows/` chỉ cần import qua đường dẫn tương đối tới file này (không phải
// tên package) - đúng quy ước "chỉ code trong automation/ mới import package bên thứ 3 trực tiếp"
// mà `flows/web/giao_bai_tap/*.mjs` đã áp dụng từ trước (chỉ import module local, không import
// "playwright" thẳng).
export { test, expect } from "@playwright/test";
