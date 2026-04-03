'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface PhotoCaptureProps {
  /** Current photo URL */
  value?: string;
  /** Called with the captured File (parent handles upload) */
  onCapture: (file: File) => void;
  /** Called when user clears the photo */
  onClear?: () => void;
  /** Label text */
  label?: string;
  /** Show loading state while parent uploads */
  uploading?: boolean;
}

export function PhotoCapture({
  value,
  onCapture,
  onClear,
  label = 'Photo',
  uploading = false,
}: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value || null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onCapture(file);
    e.target.value = '';
  };

  const handleClear = () => {
    setPreview(null);
    onClear?.();
  };

  // Show existing photo or preview
  if ((value || preview) && !uploading) {
    const src = value || preview;
    return (
      <div className="relative inline-block">
        <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          <img
            src={src!}
            alt={label}
            className="w-full h-full object-cover"
          />
        </div>
        {onClear && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white
                       flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
            aria-label="Remove photo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Uploading state
  if (uploading) {
    return (
      <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600
                      flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800">
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
        <span className="text-xs text-gray-500">Uploading...</span>
      </div>
    );
  }

  // Empty state with capture buttons
  return (
    <div>
      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600
                      flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800/50
                      hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
        <ImageIcon className="w-6 h-6 text-gray-400" />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md
                       bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <Camera className="w-3 h-3" />
            Camera
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md
                       border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-3 h-3" />
            Gallery
          </button>
        </div>
      </div>
    </div>
  );
}
