import { forwardRef } from 'react';
import BarcodeLib from 'react-barcode';
import type { LabelSettings } from '../../hooks/useLabelSettings';

// Parche para la librería de código de barras
const Barcode = BarcodeLib as any;

interface Props {
    product: any;
    settings: LabelSettings;
}

export const ProductLabel = forwardRef<HTMLDivElement, Props>((props, ref) => {
    const { product, settings } = props;

    // --- LÓGICA INTELIGENTE PARA EL NOMBRE ---
    const getProductName = () => {
        const source = settings.nameSource || 'alias_if_available'; // Por defecto
        const alias = product.alias ? product.alias.trim() : '';
        const originalName = product.name || '';

        if (source === 'always_alias') {
            return alias; // Si no hay alias, saldrá vacío (útil para imprimir etiquetas mudas)
        }
        if (source === 'always_name') {
            return originalName;
        }
        // 'alias_if_available'
        return alias.length > 0 ? alias : originalName;
    };

    const displayName = getProductName();

    // Diccionario de tamaños
    const sizeClasses: Record<string, string> = {
        '1.5x1': 'w-[1.5in] h-[1in]',
        '2x1': 'w-[2in] h-[1in]',
        '50x25mm': 'w-[50mm] h-[25mm]',
    };

    // Diccionario de fuentes para el nombre del producto
    const fontSizes: Record<string, string> = {
        small: 'text-[8px]',
        normal: 'text-[10px]',
        large: 'text-[12px]',
    };

    const safeSize = settings?.size || '50x25mm';
    const safeFont = settings?.fontSize || 'normal';

    const containerSize = sizeClasses[safeSize] || sizeClasses['50x25mm'];
    const textSize = fontSizes[safeFont] || fontSizes['normal'];

    return (
        <div ref={ref} className="bg-white p-1 mx-auto overflow-hidden">
            <div className={`${containerSize} flex flex-col items-center justify-center border border-gray-100 bg-white text-black leading-tight overflow-hidden text-center`}>

                {/* 1. NOMBRE DE LA EMPRESA (NUEVO) */}
                {settings.companyName && (
                    <div className="text-[7px] font-bold uppercase tracking-wider mb-0.5 text-gray-600">
                        {settings.companyName}
                    </div>
                )}

                {/* 2. NOMBRE DEL PRODUCTO (Con lógica de Alias) */}
                {settings?.showName && displayName && (
                    <h3 className={`${textSize} font-bold line-clamp-2 px-1 mb-0.5 leading-none`}>
                        {displayName}
                    </h3>
                )}

                {/* 3. CÓDIGO DE BARRAS */}
                <div className="flex-1 flex items-center justify-center w-full overflow-hidden min-h-0">
                    <Barcode
                        value={product.upc || product.sku || "000000"}
                        width={safeSize === '1.5x1' ? 1 : 1.3}
                        height={20} // Un poco más bajo para dar espacio a la empresa
                        fontSize={8}
                        margin={0}
                        displayValue={settings?.showSku ?? true}
                    />
                </div>

                {/* 4. PRECIO Y FECHA */}
                <div className="flex justify-between items-end w-full px-2 mt-0.5">
                    {settings?.showDate ? (
                        <span className="text-[7px] text-gray-500">
                            {new Date().toLocaleDateString('es-MX')}
                        </span>
                    ) : <span></span>}

                    {settings?.showPrice && (
                        <span className={`${settings?.boldPrice ? 'font-black' : 'font-medium'} text-lg leading-none`}>
                            ${(product.selling_price || product.price || 0).toFixed(2)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});

ProductLabel.displayName = 'ProductLabel';