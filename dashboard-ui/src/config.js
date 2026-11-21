// Where the frontend finds the backend API.
// - Local dev:      http://localhost:5000 (default when the env var is not set)
// - On Vercel:      set REACT_APP_API_URL=same-origin  →  API_URL = ""
//                   so every call becomes a same-origin /api/... request, which
//                   vercel.json rewrites to the backend service.
const raw = process.env.REACT_APP_API_URL;
const API_URL =
  raw === undefined ? 'http://localhost:5000' : raw === 'same-origin' ? '' : raw;

export default API_URL;
