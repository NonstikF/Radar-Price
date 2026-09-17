import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

export type LabelPrintContent = 'name' | 'price' | 'both';

interface Props {
    onSelect: (content: LabelPrintContent) => void;
    onClose: () => void;
}

const options = [
    { value: 'name', title: 'Solo título', detail: 'Nombre o alias del producto, sin precio. Para almacenamiento.' },
    { value: 'price', title: 'Solo precio', detail: 'Precio de venta, sin el nombre del producto.' },
    { value: 'both', title: 'Título y precio', detail: 'Nombre o alias del producto junto con su precio.' },
] as const;

export const LabelPrintOptions = ({ onSelect, onClose }: Props) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);

    return createPortal(
        <dialog
            ref={dialogRef}
            aria-labelledby="label-print-title"
            aria-describedby="label-print-description"
            onCancel={onClose}
            style={{
                // Deja libre el safe-area de iOS para que la barra del navegador no lo tape.
                maxHeight: 'calc(100dvh - 2rem - env(safe-area-inset-bottom) - env(safe-area-inset-top))',
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/60 dark:bg-gray-800 dark:text-white"
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="label-print-title" className="text-lg font-bold">¿Qué quieres imprimir?</h2>
                <button type="button" onClick={onClose} aria-label="Cancelar impresión" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <X className="h-5 w-5" />
                </button>
            </div>
            <p id="label-print-description" className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                Elige el contenido para esta impresión. Si imprimes un lote, se aplica a todas sus etiquetas.
            </p>
            <div className="space-y-3">
                {options.map(option => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onSelect(option.value)}
                        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-blue-600 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                        <Printer className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>
                            <span className="block font-bold">{option.title}</span>
                            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{option.detail}</span>
                        </span>
                    </button>
                ))}
            </div>
        </dialog>,
        document.body,
    );
};
