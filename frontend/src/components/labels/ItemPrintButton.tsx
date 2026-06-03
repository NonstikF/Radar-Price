import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { usePrintLabel } from '../../hooks/usePrintLabel';
import { useLabelSettings } from '../../hooks/useLabelSettings';
import { ProductLabel } from './ProductLabel';

interface Props {
    product: any; // Un solo producto del lote
}

export function ItemPrintButton({ product }: Props) {
    const { settings } = useLabelSettings();
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = usePrintLabel(componentRef, `Etiqueta_${product.sku || product.id}`);

    if (!product) return null;

    return (
        <>
            {/* BOTÓN VISIBLE */}
            <button
                onClick={handlePrint}
                title="Imprimir etiqueta"
                className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95"
            >
                <Printer className="w-4 h-4" />
            </button>

            {/* ETIQUETA INVISIBLE PARA IMPRESIÓN */}
            <div style={{ display: 'none' }}>
                <div ref={componentRef}>
                    <ProductLabel product={product} settings={settings} />
                </div>
            </div>
        </>
    );
}
