/// <reference types="vite/client" />

/**
 * Where the backend lives. Empty (default) = same origin: Vite's dev proxy
 * locally, or the backend serving the SPA itself on Railway. On Vercel set
 * VITE_API_ORIGIN=https://api.ozimai.kz so REST and socket.io go straight to
 * Railway (real WebSockets, real visitor IPs for rate limits).
 */
export const API_ORIGIN = ((import.meta.env.VITE_API_ORIGIN as string | undefined) ?? '').replace(/\/$/, '');
