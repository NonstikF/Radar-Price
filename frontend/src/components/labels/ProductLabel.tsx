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

    // 2. LÓGICA DE TAMAÑO DE FUENTE "ADAPTABLE" PARA EL NOMBRE
    const getNameStyle = (text: string) => {
        const length = text.length;
        // Ajustamos los tamaños para que se parezca más a la imagen de referencia
        if (length < 20) return 'text-[12px] leading-tight font-bold';
        if (length < 35) return 'text-[10px] leading-tight font-bold';
        return 'text-[8px] leading-tight font-bold tracking-tight';
    };

    // Diccionario de dimensiones
    const sizeClasses: Record<string, string> = {
        '1.5x1': 'w-[1.5in] h-[1in]',
        '2x1': 'w-[2in] h-[1in]',
        '50x25mm': 'w-[50mm] h-[25mm]',
    };

    const safeSize = settings?.size || '50x25mm';
    const containerSize = sizeClasses[safeSize] || sizeClasses['50x25mm'];

    // 3. PRECIO SIN CENTAVOS (Redondeado)
    const rawPrice = product.selling_price || product.price || 0;
    // Usamos Math.round para redondear al entero más cercano (ej: 79.90 -> 80)
    const finalPrice = Math.round(rawPrice);

    return (
        <div ref={ref} className="bg-white p-0.5 mx-auto overflow-hidden">
            <div className={`${containerSize} flex flex-col bg-white text-black border border-gray-100 overflow-hidden relative`}>

                {/* --- SECCIÓN SUPERIOR: EMPRESA --- */}
                {settings.companyName && (
                    <div className="w-full text-center pt-0.5">
                        {/* Fuente un poco más grande y bold como en la imagen */}
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-black truncate px-1 leading-none">
                            {settings.companyName}
                        </p>
                    </div>
                )}

                {/* --- SECCIÓN CENTRAL: PRECIO GIGANTE SIN CENTAVOS --- */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-0 -mt-1">
                    {settings.showPrice && (
                        <div className="flex items-start leading-none">
                            {/* Signo de pesos ajustado */}
                            <span className="text-base font-bold mt-1 mr-0.5">$</span>

                            {/* Precio Entero GIGANTE (text-5xl para que se vea enorme) */}
                            <span className={`text-5xl tracking-tighter ${settings.boldPrice ? 'font-black' : 'font-extrabold'}`}>
                                {finalPrice}
                            </span>
                        </div>
                    )}
                </div>

                {/* --- SECCIÓN INFERIOR: NOMBRE DEL PRODUCTO --- */}
                {settings.showName && (
                    // Borde negro grueso superior como en la imagen
                    <div className={`w-full text-center px-0.5 pb-0.5 pt-0.5 border-t-2 border-black mt-auto leading-none items-center flex min-h-[18px]`}>
                        <p className={`${getNameStyle(displayName)} break-words uppercase text-black w-full`}>
                            {displayName}
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
});

ProductLabel.displayName = 'ProductLabel';