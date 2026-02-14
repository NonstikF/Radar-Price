import { forwardRef } from 'react';
import BarcodeLib from 'react-barcode';
// CORRECCIÓN 1: Agregamos "type" aquí para que TypeScript sea feliz
import type { LabelSettings } from '../../hooks/useLabelSettings';

// Parche para la librería de código de barras
const Barcode = BarcodeLib as any;

interface Props {
    product: any;
    settings: LabelSettings;
}

export const ProductLabel = forwardRef<HTMLDivElement, Props>((props, ref) => {
    const { product, settings } = props;

    const sizeClasses: Record<string, string> = {
        '1.5x1': 'w-[1.5in] h-[1in]',
        '2x1': 'w-[2in] h-[1in]',
        '50x25mm': 'w-[50mm] h-[25mm]',
    };

    const fontSizes: Record<string, string> = {
        small: 'text-[8px]',
        normal: 'text-[10px]',
        large: 'text-[12px]',
    };

    // Validamos que settings no sea undefined
    const safeSize = settings?.size || '50x25mm';
    const safeFont = settings?.fontSize || 'normal';

    const containerSize = sizeClasses[safeSize] || sizeClasses['50x25mm'];
    const textSize = fontSizes[safeFont] || fontSizes['normal'];

    return (
        <div ref={ref} className="bg-white p-1 mx-auto overflow-hidden">
            <div className={`${containerSize} flex flex-col items-center justify-center border border-gray-100 bg-white text-black leading-tight overflow-hidden text-center`}>

                {/* NOMBRE */}
                {settings?.showName && (
                    <h3 className={`${textSize} font-bold line-clamp-2 px-1 mb-0.5`}>
                        {product.name}
                    </h3>
                )}

                {/* CÓDIGO DE BARRAS */}
                <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                    <Barcode
                        value={product.upc || product.sku || "000000"}
                        width={safeSize === '1.5x1' ? 1 : 1.2}
                        height={25}
                        fontSize={8}
                        margin={0}
                        displayValue={settings?.showSku ?? true}
                    />
                </div>

                {/* PRECIO Y FECHA */}
                <div className="flex justify-between items-end w-full px-2 mt-0.5">
                    {settings?.showDate ? (
                        <span className="text-[7px] text-gray-500">
                            {new Date().toLocaleDateString('es-MX')}
                        </span>
                    ) : <span></span>}

                    {settings?.showPrice && (
                        <span className={`${settings?.boldPrice ? 'font-black' : 'font-medium'} text-lg`}>
                            ${product.selling_price?.toFixed(2)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});

ProductLabel.displayName = 'ProductLabel';