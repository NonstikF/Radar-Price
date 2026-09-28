import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { NativeActionDropdown } from '@/components/ui/action-dropdown';
import type { ActionDropdownNode } from '@/components/ui/action-dropdown';
import { useLabelSettings } from '../../hooks/useLabelSettings';
import type { BarcodeSource } from '../../hooks/useLabelSettings';

export type LabelPrintContent = 'name' | 'price' | 'both';
export type LabelNameSource = 'always_name' | 'always_alias' | 'alias_if_available';
// 'label' usa la medida configurada en ajustes; las 'a4' imprimen una hoja
// entera, de pie o acostada.
export type LabelPaper = 'label' | 'a4' | 'a4-landscape';

export interface LabelPrintChoice {
    content: LabelPrintContent;
    nameSource: LabelNameSource;
    showBarcode: boolean;
    paper: LabelPaper;
    // Solo aplica a las hojas A4; en etiqueta no hay espacio para ella.
    showDate: boolean;
}

interface Props {
    onSelect: (choice: LabelPrintChoice) => void;
    onClose: () => void;
}

// Cada opción repite su detalle como "summary" para que el botón cerrado
// muestre también qué hace, no solo el nombre.
const option = (id: string, name: string, detail: string): ActionDropdownNode =>
    ({ id, name, detail, summary: detail });

const paperOptions = [
    option('label', 'Etiqueta', 'La medida que tienes configurada en ajustes.'),
    option('a4', 'Hoja A4 vertical', 'Un cartel: el contenido llena la hoja completa.'),
    option('a4-landscape', 'Hoja A4 horizontal', 'Cartel acostado: más ancho para títulos largos.'),
];

const contentOptions = [
    option('both', 'Título y precio', 'El nombre del producto junto con su precio.'),
    option('name', 'Solo título', 'Sin precio. Para almacenamiento.'),
    option('price', 'Solo precio', 'Sin el nombre del producto.'),
];

const nameOptions = [
    option('always_name', 'Nombre del producto', 'El título completo, aunque tenga apodo.'),
    option('always_alias', 'Alias / apodo', 'Más corto: útil en etiquetas chicas.'),
    option('alias_if_available', 'Automático', 'Usa el alias si existe, si no el nombre.'),
];

// Interruptor de sí/no con título y explicación.
const PrintToggle = ({ title, detail, checked, onChange, className }: {
    title: string;
    detail: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    className: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={className + ' items-center justify-between'}
    >
        <span className="min-w-0">
            <span className="block text-sm font-bold">{title}</span>
            <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{detail}</span>
        </span>
        <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.125rem]' : 'left-0.5'}`}></span>
        </span>
    </button>
);

// Título de sección + desplegable, con el mismo estilo de encabezado que el
// resto del diálogo.
const PrintField = ({ title, items, value, onChange }: {
    title: string;
    items: ActionDropdownNode[];
    value: string;
    onChange: (id: string) => void;
}) => (
    <div className="mb-5">
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">{title}</p>
        <NativeActionDropdown
            items={items}
            value={value}
            onValueChange={onChange}
            label={title}
            className="max-w-none"
        />
    </div>
);

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
    const [paper, setPaper] = useState<LabelPaper>(
        (settings.lastPrintPaper as LabelPaper) || 'label'
    );
    // Apagada de inicio: es un dato de control, no algo que todo cartel lleve.
    const [showDate, setShowDate] = useState<boolean>(settings.lastPrintDate === true);
    const isSheet = paper !== 'label';

    useEffect(() => {
        const dialog = dialogRef.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);

    const handlePrint = () => {
        // Se recuerda para la próxima impresión.
        updateSettings({ lastPrintContent: content, lastPrintPaper: paper, lastPrintDate: showDate, nameSource, showBarcode });
        onSelect({ content, nameSource, showBarcode, paper, showDate: isSheet && showDate });
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

            <PrintField
                title="Hoja" items={paperOptions}
                value={paper} onChange={id => setPaper(id as LabelPaper)}
            />

            <PrintField
                title="Contenido" items={contentOptions}
                value={content} onChange={id => setContent(id as LabelPrintContent)}
            />

            {/* QUÉ NOMBRE USAR (no aplica si solo va el precio) */}
            {content !== 'price' && (
                <PrintField
                    title="Nombre a usar" items={nameOptions}
                    value={nameSource} onChange={id => setNameSource(id as LabelNameSource)}
                />
            )}

            <div className="mb-6 space-y-2">
                <PrintToggle
                    title="Imprimir código de barras"
                    detail="Aparece en pequeño en la parte inferior."
                    checked={showBarcode}
                    onChange={setShowBarcode}
                    className={optionClass(showBarcode)}
                />

                {/* FECHA Y HORA (solo en hoja A4) */}
                {isSheet && (
                    <PrintToggle
                        title="Imprimir fecha y hora"
                        detail="En letra chica, en la esquina inferior derecha."
                        checked={showDate}
                        onChange={setShowDate}
                        className={optionClass(showDate)}
                    />
                )}
            </div>

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
