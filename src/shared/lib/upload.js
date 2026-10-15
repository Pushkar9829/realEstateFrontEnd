// File upload to POST /api/uploads?purpose=... (multipart, field "file").
// Returns the stored file: { id, url, thumbUrl, mime, sizeBytes, visibility }.
import { http } from './api';

export const UPLOAD_RULES = {
  image: { accept: 'image/jpeg,image/png,image/webp', maxMB: 5, label: 'JPG, PNG or WebP up to 5 MB' },
  document: { accept: 'image/jpeg,image/png,application/pdf', maxMB: 10, label: 'PDF, JPG or PNG up to 10 MB' },
  video: { accept: 'video/mp4,video/webm,video/quicktime', maxMB: 100, label: 'MP4 or WebM up to 100 MB' },
  csv: { accept: '.csv,text/csv', maxMB: 5, label: 'CSV up to 5 MB' },
};

export async function uploadFile(file, purpose, { onProgress } = {}) {
  const form = new FormData();
  form.append('file', file);
  const res = await http.post('/uploads', form, {
    params: { purpose },
    timeout: 120000,
    onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
  });
  return res.data.data;
}

export const formatBytes = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
