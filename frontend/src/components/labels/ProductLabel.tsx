import { forwardRef } from 'react';
import type { LabelSettings } from '../../hooks/useLabelSettings';

interface Props {
    product: any;
    settings: LabelSettings;
}

export const ProductLabel = forwardRef<HTMLDivElement, Props>((props, ref) => {
    const { product, settings } = props;

    // NOMBRES
    const getProductName = () => {
        const source = settings.nameSource || 'alias_if_available';
        const alias = product.alias ? product.alias.trim() : '';
        const originalName = product.name || '';
        if (source === 'always_alias') return alias;
        if (source === 'always_name') return originalName;
        return alias.length > 0 ? alias : originalName;
    };
    const displayName = getProductName();

    // ESTILOS DE FUENTE
    const getNameStyle = (text: string) => {
        const length = text.length;
        if (length < 15) return 'text-[13px] leading-none font-black';
        if (length < 25) return 'text-[11px] leading-none font-bold';
        return 'text-[9px] leading-none font-bold tracking-tight';
    };

    // --- CÁLCULO DE DIMENSIONES ---
    const getDimensions = () => {
        if (settings.size === 'custom') {
            // Si es personalizado, usamos tus valores
            return {
                w: settings.customWidth || '2in',
                h: settings.customHeight || '1in'
            };
        }
        const sizeClasses: Record<string, { w: string, h: string }> = {
            '1.5x1': { w: '1.5in', h: '1in' },
            '2x1': { w: '2in', h: '1in' },
            '50x25mm': { w: '50mm', h: '25mm' },
        };
        return sizeClasses[settings.size] || { w: '50mm', h: '25mm' };
    };

    const { w: width, h: height } = getDimensions();

    // PRECIO
    const rawPrice = product.selling_price || product.price || 0;
    const finalPrice = Math.round(rawPrice);
    const priceLength = finalPrice.toString().length;
    const priceFontSize = priceLength > 2 ? 'text-[4rem]' : 'text-[5rem]';

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
                    {/* EMPRESA */}
                    {settings.companyName && (
                        <div className="absolute top-0 left-0 w-full text-center z-20 bg-white pb-[1px]">
                            <p className="text-[10px] font-black uppercase tracking-wide text-black truncate px-1 leading-none pt-[2px]">
                                {settings.companyName}
                            </p>
                        </div>
                    )}

                    {/* PRECIO */}
                    {settings.showPrice && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className={`flex items-start leading-none -translate-y-2`}>
                                <span className="text-xl font-bold mt-2 mr-1">$</span>
                                <span className={`${priceFontSize} tracking-tighter leading-[0.75] ${settings.boldPrice ? 'font-black' : 'font-extrabold'}`}>
                                    {finalPrice}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* TEXTO INFERIOR */}
                    {settings.showName && (
                        <div className="absolute bottom-0 left-0 w-full text-center px-1 z-20 bg-white">
                            <div className="border-t-2 border-black w-full mb-[1px]"></div>
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