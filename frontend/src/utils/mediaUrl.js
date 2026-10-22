import api from '../services/api';

/*
 * Uploaded student photos are served by the API at /api/media/student-avatars/….
 * The value we get may be a bare path ("student-avatars/x.jpg"), an old
 * /storage/ URL, or a URL built from another host's APP_URL (e.g.
 * http://127.0.0.1:8000 saved in localStorage). Rebuild it on this build's
 * API base so it loads on local dev (Vite proxy), Render, and the domain.
 */
export const mediaUrl = (value) => {
  if (!value) return '';
  const text = String(value);
  if (/^(data|blob):/.test(text)) return text;

  const match = text.match(/(?:^|\/)(student-avatars\/[^?#/]+)/);
  if (!match) return text;

  const base = new URL(api.defaults.baseURL, window.location.origin).href.replace(/\/+$/, '');
  return `${base}/media/${match[1]}`;
};
