import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { useLabelSettings } from '../../hooks/useLabelSettings';
import type { BarcodeSource } from '../../hooks/useLabelSettings';

export type LabelPrintContent = 'name' | 'price' | 'both';
export type LabelNameSource = 'always_name' | 'always_alias' | 'alias_if_available';

export interface LabelPrintChoice {
    content: LabelPrintContent;
    nameSource: LabelNameSource;
    showBarcode: boolean;
}

interface Props {
    onSelect: (choice: LabelPrintChoice) => void;
    onClose: () => void;
}

const contentOptions = [
    { value: 'both', title: 'Título y precio', detail: 'El nombre del producto junto con su precio.' },
    { value: 'name', title: 'Solo título', detail: 'Sin precio. Para almacenamiento.' },
    { value: 'price', title: 'Solo precio', detail: 'Sin el nombre del producto.' },
] as const;

const nameOptions = [
    { value: 'always_name', title: 'Nombre del producto', detail: 'El título completo, aunque tenga apodo.' },
    { value: 'always_alias', title: 'Alias / apodo', detail: 'Más corto: útil en etiquetas chicas.' },
    { value: 'alias_if_available', title: 'Automático', detail: 'Usa el alias si existe, si no el nombre.' },
] as const;

export const LabelPrintOptions = ({ onSelect, onClose }: Props) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const { settings, updateSettings } = useLabelSettings();

    // Arrancamos con lo último que se imprimió para no reconfigurar cada vez,
    // pero la elección se confirma aquí: así lo que se ve es lo que sale.
    const [content, setContent] = useState<LabelPrintContent>(
        (settings.lastPrintContent as LabelPrintContent) || 'both'
    );
    const [nameSource, setNameSource] = useState<LabelNameSource>(
        (settings.nameSource as LabelNameSource) || 'always_name'
    );
    const [showBarcode, setShowBarcode] = useState<boolean>(settings.showBarcode !== false);

    useEffect(() => {
        const dialog = dialogRef.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);

    const handlePrint = () => {
        // Se recuerda para la próxima impresión.
        updateSettings({ lastPrintContent: content, nameSource, showBarcode });
        onSelect({ content, nameSource, showBarcode });
    };

    const optionClass = (active: boolean) =>
        `flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
            active
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 hover:border-blue-300 dark:border-gray-600 dark:hover:bg-gray-700'
        }`;

    return createPortal(
        <dialog
            ref={dialogRef}
            aria-labelledby="label-print-title"
            onCancel={onClose}
            style={{
                // Deja libre el safe-area de iOS para que la barra del navegador no lo tape.
                maxHeight: 'calc(100dvh - 2rem - env(safe-area-inset-bottom) - env(safe-area-inset-top))',
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/60 dark:bg-gray-800 dark:text-white"
        >
            <div className="mb-5 flex items-center justify-between gap-3">
                <h2 id="label-print-title" className="text-lg font-bold">¿Qué quieres imprimir?</h2>
                <button type="button" onClick={onClose} aria-label="Cancelar impresión" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* CONTENIDO DE LA ETIQUETA */}
            <fieldset className="mb-5">
                <legend className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Contenido</legend>
                <div className="space-y-2">
                    {contentOptions.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={content === option.value}
                            onClick={() => setContent(option.value)}
                            className={optionClass(content === option.value)}
                        >
                            <span className="min-w-0">
                                <span className="block text-sm font-bold">{option.title}</span>
                                <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{option.detail}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </fieldset>

            {/* QUÉ NOMBRE USAR (no aplica si solo va el precio) */}
            {content !== 'price' && (
                <fieldset className="mb-5">
                    <legend className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Nombre a usar</legend>
                    <div className="space-y-2">
                        {nameOptions.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={nameSource === option.value}
                                onClick={() => setNameSource(option.value)}
                                className={optionClass(nameSource === option.value)}
                            >
                                <span className="min-w-0">
                                    <span className="block text-sm font-bold">{option.title}</span>
                                    <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{option.detail}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </fieldset>
            )}

            {/* CÓDIGO DE BARRAS */}
            <button
                type="button"
                role="switch"
                aria-checked={showBarcode}
                onClick={() => setShowBarcode(v => !v)}
                className={optionClass(showBarcode) + ' mb-6 items-center justify-between'}
            >
                <span className="min-w-0">
                    <span className="block text-sm font-bold">Imprimir código de barras</span>
                    <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">Aparece en pequeño en la parte inferior.</span>
                </span>
                <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${showBarcode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${showBarcode ? 'left-[1.125rem]' : 'left-0.5'}`}></span>
                </span>
            </button>

            <button
                type="button"
                onClick={handlePrint}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95"
            >
                <Printer className="h-5 w-5" /> Imprimir
            </button>
        </dialog>,
        document.body,
    );
};

// Se re-exporta para que los consumidores no tengan que importar del hook.
export type { BarcodeSource };
