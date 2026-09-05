/** 站点访问口令（静态站前端校验，防随手打开；非银行级加密） */
export const SITE_PASSWORD = (import.meta.env.VITE_SITE_PASSWORD as string) || 'yws2026'

export const ACCESS_STORAGE_KEY = 'ecommerce_dash_unlocked'
