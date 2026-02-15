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

    // 2. FUENTE ADAPTABLE (Optimizada para legibilidad en borde inferior)
    const getNameStyle = (text: string) => {
        const length = text.length;
        if (length < 15) return 'text-[14px] leading-none font-black';
        if (length < 25) return 'text-[12px] leading-none font-bold';
        if (length < 40) return 'text-[10px] leading-none font-bold';
        return 'text-[9px] leading-none font-bold tracking-tight';
    };

    // 3. DIMENSIONES
    const width = settings.size === '1.5x1' ? '1.5in' : (settings.size === '2x1' ? '2in' : '50mm');
    const height = settings.size === '1.5x1' ? '1in' : (settings.size === '2x1' ? '1in' : '25mm');

    const rawPrice = product.selling_price || product.price || 0;
    const finalPrice = Math.round(rawPrice);

    return (
        <>
            <style>
                {`
                    @media print {
                        @page {
                            margin: 0 !important;
                            size: ${width} ${height} !important;
                        }
                        body { margin: 0 !important; padding: 0 !important; }
                        html, body { height: 100%; overflow: hidden; }
                    }
                `}
            </style>

            <div ref={ref} className="bg-white mx-auto overflow-hidden">
                <div
                    style={{ width: width, height: height }}
                    className="bg-white text-black overflow-hidden relative"
                >

                    {/* --- 1. TÍTULO (Pegado Arriba) --- */}
                    {settings.companyName && (
                        // top-[-1px] para subirlo al máximo posible
                        <div className="absolute top-[-1px] left-0 w-full text-center z-20">
                            <p className="text-[10px] font-black uppercase tracking-wide text-black truncate px-1 leading-none pt-[2px]">
                                {settings.companyName}
                            </p>
                        </div>
                    )}

                    {/* --- 2. PRECIO (Expandido) --- */}
                    {settings.showPrice && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            {/* translate-y-1 baja el precio un poco para centrarlo respecto a los textos */}
                            <div className="flex items-start leading-none translate-y-1">
                                <span className="text-xl font-bold mt-2 mr-1">$</span>
                                {/* Aumentamos a 5.5rem para llenar más espacio visual */}
                                <span className={`text-[5.5rem] tracking-tighter leading-none ${settings.boldPrice ? 'font-black' : 'font-extrabold'}`}>
                                    {finalPrice}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* --- 3. TEXTO INFERIOR (Pegado Abajo agresivamente) --- */}
                    {settings.showName && (
                        // CAMBIO CLAVE: bottom-[-1px] fuerza al texto a bajar más allá del límite teórico
                        // Quitamos pb (padding-bottom) para ganar esos milímetros extra.
                        <div className="absolute bottom-[-1px] left-0 w-full text-center px-1 z-20 bg-white/60">

                            {/* Línea divisoria */}
                            <div className="border-t-2 border-black w-full mb-[1px]"></div>

                            {/* Texto pegado al borde */}
                            <p className={`${getNameStyle(displayName)} break-words uppercase text-black w-full pb-[1px]`}>
                                {displayName}
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
});

ProductLabel.displayName = 'ProductLabel';