import { forwardRef } from 'react';
import type { LabelSettings } from '../../hooks/useLabelSettings';

interface Props {
    product: any;
    settings: LabelSettings;
}

export const ProductLabel = forwardRef<HTMLDivElement, Props>((props, ref) => {
    const { product, settings } = props;

    // 1. LÓGICA DE NOMBRE
    const getProductName = () => {
        const source = settings.nameSource || 'alias_if_available';
        const alias = product.alias ? product.alias.trim() : '';
        const originalName = product.name || '';

        if (source === 'always_alias') return alias;
        if (source === 'always_name') return originalName;
        return alias.length > 0 ? alias : originalName;
    };

    const displayName = getProductName();

    // 2. LÓGICA DE FUENTE ADAPTABLE
    const getNameStyle = (text: string) => {
        const length = text.length;
        if (length < 20) return 'text-[12px] leading-none font-bold';
        if (length < 35) return 'text-[10px] leading-none font-bold';
        return 'text-[8px] leading-none font-bold tracking-tight';
    };

    // 3. DIMENSIONES EXACTAS (Sin padding extra)
    const sizeClasses: Record<string, string> = {
        '1.5x1': 'w-[1.5in] h-[1in]',
        '2x1': 'w-[2in] h-[1in]',
        '50x25mm': 'w-[50mm] h-[25mm]',
    };

    const safeSize = settings?.size || '50x25mm';
    const containerSize = sizeClasses[safeSize] || sizeClasses['50x25mm'];

    // 4. PRECIO REDONDEADO
    const rawPrice = product.selling_price || product.price || 0;
    const finalPrice = Math.round(rawPrice);

    return (
        <div ref={ref} className="bg-white mx-auto overflow-hidden">
            <div className={`${containerSize} flex flex-col bg-white text-black overflow-hidden relative`}>

                {/* --- SECCIÓN SUPERIOR: EMPRESA --- */}
                {/* shrink-0 evita que esta sección se aplaste */}
                {settings.companyName && (
                    <div className="w-full text-center pt-1 shrink-0">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-black truncate px-1 leading-none">
                            {settings.companyName}
                        </p>
                    </div>
                )}

                {/* --- SECCIÓN CENTRAL: PRECIO --- */}
                {/* flex-1 hace que ocupe todo el espacio disponible automáticamente */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                    {settings.showPrice && (
                        <div className="flex items-start leading-none -mt-1">
                            <span className="text-base font-bold mt-1.5 mr-0.5">$</span>
                            {/* Ajustamos un poco el tamaño para asegurar que no empuje el footer */}
                            <span className={`text-[2.8rem] tracking-tighter leading-none ${settings.boldPrice ? 'font-black' : 'font-extrabold'}`}>
                                {finalPrice}
                            </span>
                        </div>
                    )}
                </div>

                {/* --- SECCIÓN INFERIOR: NOMBRE --- */}
                {/* mt-auto empuja esto al fondo, shrink-0 evita que desaparezca */}
                {settings.showName && (
                    <div className="w-full text-center px-0.5 shrink-0">
                        {/* Línea negra superior */}
                        <div className="border-t-2 border-black w-full mb-0.5"></div>
                        <p className={`${getNameStyle(displayName)} break-words uppercase text-black w-full pb-0.5`}>
                            {displayName}
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
});

ProductLabel.displayName = 'ProductLabel';