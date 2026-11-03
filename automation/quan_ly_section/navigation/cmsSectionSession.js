// `loginCmsAdmin()` là code đăng nhập THẬT dùng chung cho mọi module CMS Admin (chỉ khác nhau ở
// `envOverride`/`CMS_ADMIN_ENV` để chọn đúng host+tài khoản) - tái sử dụng thẳng từ
// `quan_ly_goi_dich_vu`, KHÔNG viết lại (xem `resolveCmsAdminCredentials()` trong
// `automation/src/config.js` - đã hỗ trợ tài khoản RIÊNG theo môi trường từ 2026-11-03 để phục vụ
// đúng module này, môi trường dev dùng tài khoản khác staging/production).
export { loginCmsAdmin, CmsAdminAuthError } from "../../quan_ly_goi_dich_vu/navigation/cmsAdminSession.js";
