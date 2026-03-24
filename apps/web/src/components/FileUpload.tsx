'use client';

import { useState, useRef } from 'react';
import { Upload, Camera, X, Loader2, FileText, Image } from 'lucide-react';

interface FileUploadProps {
  /** S3 function folder: gemba, five-s, quality, ncr */
  func: string;
  /** Callback with the uploaded file URL */
  onUpload: (url: string, fileName: string) => void;
  /** MIME types to accept. Default: images */
  accept?: string;
  /** Show camera capture button (mobile) */
  capture?: boolean;
  /** Label text */
  label?: string;
  /** Current file URL (for showing existing upload) */
  value?: string;
  /** Allow clearing the upload */
  onClear?: () => void;
  /** Compact mode for inline use */
  compact?: boolean;
}

export default function FileUpload({
  func,
  onUpload,
  accept = 'image/*',
  capture = true,
  label = 'Upload file',
  value,
  onClear,
  compact = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  const upload = async (file: File) => {
    if (!file) return;
    setError('');
    setUploading(true);

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/uploads?function=${func}`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(body.message || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      onUpload(data.url, file.name);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const clear = () => {
    setPreview(null);
    setError('');
    onClear?.();
  };

  // Show existing uploaded file
  if (value && !uploading) {
    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'}`}>
        {isImage(value) ? (
          <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-200">
            <img src={value} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand-600 hover:underline truncate flex-1"
        >
          View file
        </a>
        {onClear && (
          <button onClick={clear} className="text-gray-400 hover:text-red-500 p-1" aria-label="Remove file">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      {capture && (
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      )}

      {uploading ? (
        <div className={`flex items-center gap-2 ${compact ? '' : 'p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'}`}>
          <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
          <span className="text-sm text-gray-500">Uploading...</span>
          {preview && (
            <div className="w-8 h-8 rounded overflow-hidden ml-auto">
              <img src={preview} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      ) : (
        <div className={`flex gap-2 ${compact ? '' : ''}`}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              compact
                ? 'text-gray-500 hover:text-brand-600'
                : 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            {label}
          </button>
          {capture && (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                compact
                  ? 'text-gray-500 hover:text-brand-600'
                  : 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Camera className="w-4 h-4" />
              Camera
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
