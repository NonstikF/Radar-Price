import { forwardRef } from 'react';
import type { LabelSettings } from '../../hooks/useLabelSettings';

interface Props {
    product: any;
    settings: LabelSettings;
}

export const ProductLabel = forwardRef<HTMLDivElement, Props>((props, ref) => {
    const { product, settings } = props;

    // 1. LÓGICA PARA OBTENER EL NOMBRE CORRECTO
    const getProductName = () => {
        const source = settings.nameSource || 'alias_if_available';
        const alias = product.alias ? product.alias.trim() : '';
        const originalName = product.name || '';

        if (source === 'always_alias') return alias;
        if (source === 'always_name') return originalName;
        return alias.length > 0 ? alias : originalName;
    };

    const displayName = getProductName();

    // 2. LÓGICA DE TAMAÑO DE FUENTE "ADAPTABLE"
    const getNameStyle = (text: string) => {
        const length = text.length;
        if (length < 20) return 'text-[11px] leading-tight font-bold';
        if (length < 40) return 'text-[9px] leading-tight font-semibold';
        return 'text-[7px] leading-tight font-medium tracking-tight';
    };

    // Diccionario de dimensiones
    const sizeClasses: Record<string, string> = {
        '1.5x1': 'w-[1.5in] h-[1in]',
        '2x1': 'w-[2in] h-[1in]',
        '50x25mm': 'w-[50mm] h-[25mm]',
    };

    const safeSize = settings?.size || '50x25mm';
    const containerSize = sizeClasses[safeSize] || sizeClasses['50x25mm'];

    // Separamos enteros y decimales para dar estilo
    const price = product.selling_price || product.price || 0;
    const priceParts = price.toFixed(2).split('.');
    const integerPart = priceParts[0];
    const decimalPart = priceParts[1];

    return (
        <div ref={ref} className="bg-white p-0.5 mx-auto overflow-hidden">
            <div className={`${containerSize} flex flex-col bg-white text-black border border-gray-100 overflow-hidden relative`}>

                {/* --- SECCIÓN SUPERIOR: EMPRESA --- */}
                {settings.companyName && (
                    <div className="w-full text-center border-b border-black pb-0.5 mb-0.5">
                        <p className="text-[7px] font-bold uppercase tracking-widest text-black truncate px-1">
                            {settings.companyName}
                        </p>
                    </div>
                )}

                {/* --- SECCIÓN CENTRAL: PRECIO GIGANTE --- */}
                {/* Al quitar el código de barras, usamos flex-1 para centrar el precio verticalmente */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                    {settings.showPrice && (
                        <div className="flex items-start leading-none -mt-1">
                            <span className="text-xs font-bold mt-1.5 mr-0.5">$</span>

                            {/* Precio Entero GIGANTE */}
                            <span className={`text-4xl tracking-tighter ${settings.boldPrice ? 'font-black' : 'font-bold'}`}>
                                {integerPart}
                            </span>

                            {/* Decimales pequeños arriba */}
                            <span className="text-xs font-bold mt-1.5 underline decoration-2">
                                {decimalPart}
                            </span>
                        </div>
                    )}
                </div>

                {/* --- SECCIÓN INFERIOR: DESCRIPCIÓN --- */}
                {settings.showName && (
                    <div className={`w-full text-center px-1 pb-1 pt-0.5 border-t border-gray-200 mt-auto`}>
                        <p className={`${getNameStyle(displayName)} break-words uppercase text-black`}>
                            {displayName}
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
});

ProductLabel.displayName = 'ProductLabel';