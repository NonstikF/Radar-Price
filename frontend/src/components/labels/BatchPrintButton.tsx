import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { usePrintLabel } from '../../hooks/usePrintLabel';
import { useLabelSettings } from '../../hooks/useLabelSettings';
import { ProductLabel } from './ProductLabel';

interface Props {
    products: any[]; // La lista de productos del lote
}

export function BatchPrintButton({ products }: Props) {
    const { settings } = useLabelSettings();
    const componentRef = useRef<HTMLDivElement>(null);

    // Usamos nuestro hook personalizado
    const handlePrint = usePrintLabel(componentRef, `Lote_Etiquetas_${new Date().toLocaleDateString()}`);

    if (!products || products.length === 0) return null;

    return (
        <>
            {/* 1. EL BOTÓN VISIBLE */}
            <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all active:scale-95"
            >
                <Printer className="w-5 h-5" />
                <span className="hidden md:inline">Imprimir Lote ({products.length})</span>
            </button>

            {/* 2. LO QUE SE IMPRIME (INVISIBLE EN PANTALLA) */}
            <div style={{ display: 'none' }}>
                <div ref={componentRef}>
                    {/* Mapeamos cada producto para generar su etiqueta */}
                    {products.map((product, index) => (
                        <div key={product.id || index} style={{ pageBreakAfter: 'always' }}>
                            <ProductLabel
                                product={product}
                                settings={settings}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}