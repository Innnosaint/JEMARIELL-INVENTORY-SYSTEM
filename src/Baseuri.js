// ─────────────────────────────────────────────────────────────
// api.js — Central API base URL
// In development:  uses http://127.0.0.1:5000
// In production:   uses VITE_API_URL from Vercel environment variables
// ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default API_BASE;