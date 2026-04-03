/**
 * Upload a photo file to the API and return the URL.
 *
 * @param file  The File object to upload
 * @param func  S3 function folder (e.g. 'five-s', 'safety', 'quality', 'gemba')
 * @returns     The public URL of the uploaded file
 */
export async function uploadPhoto(file: File, func = 'general'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const res = await fetch(`/api/uploads?function=${encodeURIComponent(func)}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(body.message || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  return data.url;
}
