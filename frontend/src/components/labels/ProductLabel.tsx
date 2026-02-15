import { forwardRef } from 'react';
import type { LabelSettings } from '../../hooks/useLabelSettings';

interface Props {
    product: any;
    settings: LabelSettings;
}

export const ProductLabel = forwardRef<HTMLDivElement, Props>((props, ref) => {
    const { product, settings } = props;

    // 1. OBTENER NOMBRE (Alias vs Original)
    const getProductName = () => {
        const source = settings.nameSource || 'alias_if_available';
        const alias = product.alias ? product.alias.trim() : '';
        const originalName = product.name || '';

        if (source === 'always_alias') return alias;
        if (source === 'always_name') return originalName;
        return alias.length > 0 ? alias : originalName;
    };

    const displayName = getProductName();

    // 2. TAMAÑO DE FUENTE RESPONSIVO PARA EL NOMBRE
    const getNameStyle = (text: string) => {
        const length = text.length;
        if (length < 20) return 'text-[12px] leading-none font-bold';
        if (length < 35) return 'text-[10px] leading-none font-bold';
        return 'text-[8px] leading-none font-bold tracking-tight';
    };

    // 3. DIMENSIONES Y ESTILOS DE IMPRESIÓN
    // Definimos las dimensiones exactas en CSS
    const width = settings.size === '1.5x1' ? '1.5in' : (settings.size === '2x1' ? '2in' : '50mm');
    const height = settings.size === '1.5x1' ? '1in' : (settings.size === '2x1' ? '1in' : '25mm');

    const rawPrice = product.selling_price || product.price || 0;
    const finalPrice = Math.round(rawPrice);

    return (
        <>
            {/* ESTILOS GLOBALES DE IMPRESIÓN FORZADOS */}
            {/* Esto elimina el problema de las "2 hojas" y los márgenes blancos */}
            <style>
                {`
                    @media print {
                        @page {
                            margin: 0 !important;
                            size: ${width} ${height} !important;
                        }
                        body {
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        /* Ocultar encabezados y pies de página del navegador */
                        html, body {
                            height: 100%;
                            overflow: hidden;
                        }
                    }
                `}
            </style>

            <div ref={ref} className="bg-white mx-auto overflow-hidden">
                {/* Contenedor Principal */}
                <div
                    style={{ width: width, height: height }}
                    className="flex flex-col bg-white text-black overflow-hidden relative items-center"
                >

                    {/* --- PARTE SUPERIOR: EMPRESA --- */}
                    {settings.companyName && (
                        <div className="w-full text-center pt-1 shrink-0 z-10">
                            <p className="text-[10px] font-black uppercase tracking-wider text-black truncate px-1 leading-none">
                                {settings.companyName}
                            </p>
                        </div>
                    )}

                    {/* --- PARTE CENTRAL: PRECIO --- */}
                    {/* Usamos absolute para centrarlo perfectamente sin depender del flujo */}
                    {settings.showPrice && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="flex items-start leading-none pt-1">
                                <span className="text-lg font-bold mt-1 mr-0.5">$</span>
                                <span className={`text-[3.2rem] tracking-tighter leading-none ${settings.boldPrice ? 'font-black' : 'font-extrabold'}`}>
                                    {finalPrice}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* --- PARTE INFERIOR: NOMBRE --- */}
                    {settings.showName && (
                        <div className="absolute bottom-0 w-full text-center px-0.5 pb-0.5 z-10 bg-white">
                            {/* Línea divisoria negra */}
                            <div className="border-t-2 border-black w-full mb-0.5 mx-auto"></div>
                            <p className={`${getNameStyle(displayName)} break-words uppercase text-black w-full`}>
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