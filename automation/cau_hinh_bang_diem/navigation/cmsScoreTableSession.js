// `loginCmsAdmin()` là code đăng nhập THẬT dùng chung cho mọi module CMS Admin (chỉ khác nhau ở
// `envOverride`/`CMS_ADMIN_ENV` để chọn đúng host+tài khoản) - tái sử dụng thẳng từ
// `quan_ly_goi_dich_vu`, KHÔNG viết lại (cùng quy ước với `cmsSectionSession.js` của
// `quan_ly_section` - module này cùng host dev `parotedu-cms.codeinet.com`, dùng chung
// CMS_USERNAME_DEV/CMS_PASSWORD_DEV).
export { loginCmsAdmin, CmsAdminAuthError } from "../../quan_ly_goi_dich_vu/navigation/cmsAdminSession.js";
