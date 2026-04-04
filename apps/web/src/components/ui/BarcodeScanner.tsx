'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let scanner: any;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode('barcode-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' }, // rear camera
          {
            fps: 10,
            qrbox: { width: 250, height: 100 }, // rectangular for barcodes
          },
          (decodedText: string) => {
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {} // ignore scan failures
        );
      } catch (err) {
        setError('Camera not available. Please enter PO number manually.');
      }
    };

    startScanner();

    return () => {
      scanner?.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" /> Scan PO Barcode
          </h3>
          <button onClick={onClose} className="p-2 text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div id="barcode-reader" className="w-full rounded-xl overflow-hidden" />

        {error && (
          <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
        )}

        <p className="mt-4 text-gray-400 text-sm text-center">
          Point camera at the barcode on the production order
        </p>
      </div>
    </div>
  );
}
