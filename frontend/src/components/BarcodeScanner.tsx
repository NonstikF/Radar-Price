import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react'; // ✅ Corregido: Se quitó Loader2

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: Props) {
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // 1. Instanciamos la clase "Pro"
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        // 2. Iniciamos directamente con la cámara trasera
        html5QrCode.start(
            { facingMode: "environment" }, // Cámara trasera
            config,
            (decodedText) => {
                // Éxito
                handleStopAndScan(decodedText);
            },
            (errorMessage) => {
                // Error de lectura (ignorar)
            }
        ).catch(err => {
            console.error("Error al iniciar cámara:", err);
        });

        // Limpieza al salir
        return () => {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Error al detener", err));
            }
        };
    }, []);

    const handleStopAndScan = (text: string) => {
        if (scannerRef.current?.isScanning) {
            scannerRef.current.stop()
                .then(() => {
                    scannerRef.current?.clear();
                    onScan(text);
                })
                .catch(err => console.error(err));
        } else {
            onScan(text);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4 animate-fade-in">

            {/* Botón cerrar */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 bg-white/20 p-3 rounded-full text-white hover:bg-white/30 transition-all z-50 backdrop-blur-sm"
            >
                <X className="w-8 h-8" />
            </button>

            <h2 className="text-white font-bold text-xl mb-8 relative z-10">Apunta al código</h2>

            {/* Contenedor del video */}
            <div className="w-full max-w-sm aspect-square relative rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl bg-black">
                {/* ID requerido por la librería */}
                <div id="reader" className="w-full h-full"></div>

                {/* Guía visual (cuadro rojo) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-red-500/50 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4 border-red-500 rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4 border-red-500 rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4 border-red-500 rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4 border-red-500 rounded-br-xl"></div>
                    </div>
                </div>
            </div>

            <p className="text-gray-400 text-sm mt-8 text-center max-w-xs">
                La cámara trasera se iniciará automáticamente.
            </p>
        </div>
    );
}