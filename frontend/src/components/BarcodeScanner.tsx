import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: Props) {
    useEffect(() => {
        // Configuración del escáner
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                // Éxito al leer
                scanner.clear();
                onScan(decodedText);
            },
            (error) => {
                // Error de lectura (es normal ignorarlo mientras busca)
                console.warn(error);
            }
        );

        // Limpieza al desmontar
        return () => {
            scanner.clear().catch(error => console.error("Error al limpiar scanner", error));
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in">
            <button
                onClick={onClose}
                className="absolute top-6 right-6 bg-white/10 p-3 rounded-full text-white hover:bg-white/20 transition-all"
            >
                <X className="w-8 h-8" />
            </button>

            <h2 className="text-white font-bold text-xl mb-4">Escaneando Código...</h2>

            {/* Aquí se muestra la cámara */}
            <div id="reader" className="w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl"></div>

            <p className="text-gray-400 text-sm mt-6 text-center max-w-xs">
                Apunta la cámara al código de barras.
            </p>
        </div>
    );
}