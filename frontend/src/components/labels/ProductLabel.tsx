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

    // 2. FUENTE ADAPTABLE PARA EL NOMBRE (Más grande para aprovechar el ancho)
    const getNameStyle = (text: string) => {
        const length = text.length;
        if (length < 15) return 'text-[14px] leading-none font-black'; // Muy corto: Gigante
        if (length < 25) return 'text-[12px] leading-none font-bold'; // Corto: Grande
        if (length < 40) return 'text-[10px] leading-none font-bold'; // Medio: Normal
        return 'text-[8px] leading-none font-bold tracking-tight'; // Largo: Compacto
    };

    // 3. DIMENSIONES
    // Ajustamos las medidas de CSS para que coincidan con 2x1 pulgadas
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
                        <div className="absolute top-0 left-0 w-full text-center pt-[2px] z-20">
                            {/* Aumenté el tamaño a 11px y weight black para que destaque */}
                            <p className="text-[11px] font-black uppercase tracking-wide text-black truncate px-1 leading-none">
                                {settings.companyName}
                            </p>
                        </div>
                    )}

                    {/* --- 2. PRECIO (Centro Absoluto y GIGANTE) --- */}
                    {settings.showPrice && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            {/* Transform translate-y corrige visualmente el centrado vertical */}
                            <div className="flex items-start leading-none -translate-y-0.5">
                                <span className="text-xl font-bold mt-2 mr-1">$</span>
                                {/* text-[5rem] es ENORME (aprox 80px), llenará todo el centro */}
                                <span className={`text-[5rem] tracking-tighter leading-none ${settings.boldPrice ? 'font-black' : 'font-extrabold'}`}>
                                    {finalPrice}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* --- 3. TEXTO INFERIOR (Pegado Abajo) --- */}
                    {settings.showName && (
                        <div className="absolute bottom-0 left-0 w-full text-center px-1 pb-[2px] z-20 bg-white/80">
                            {/* Línea divisoria */}
                            <div className="border-t-2 border-black w-full mb-[1px]"></div>
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