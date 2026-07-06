// Vite base (trailing slash) — /demo/production-order-planner/ in prod, / in dev if overridden
export const APP_BASE = import.meta.env.BASE_URL;

// react-router basename must not end with /
export const ROUTER_BASENAME = APP_BASE.replace(/\/$/, '') || '/';
