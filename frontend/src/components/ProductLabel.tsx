import React from 'react';
// Importamos el tipo usando 'type' para evitar errores estrictos
import type { LabelSettings } from '../hooks/useLabelSettings';

interface Props {
    product: any;
    settings: LabelSettings; // Recibimos la configuración completa
}

export const ProductLabel = React.forwardRef<HTMLDivElement, Props>(({ product, settings }, ref) => {
    if (!product) return null;

    const { size, companyName, nameSource } = settings;

    // 1. MEDIDAS Y FUENTES
    const width = size === '2x1' ? '2in' : '1.5in';
    const height = '1in';
    const priceFontSize = size === '2x1' ? '42pt' : '34pt';

    // 2. LÓGICA DE NOMBRE (Alias vs Nombre Original)
    let footerText = "";

    if (nameSource === 'always_name') {
        footerText = product.name;
    } else if (nameSource === 'always_alias') {
        footerText = product.alias || "";
    } else {
        // 'alias_if_available' (Por defecto)
        footerText = (product.alias && product.alias.trim() !== "") ? product.alias : product.name;
    }

    // 3. AUTO-AJUSTE DE TEXTO
    // Si el texto es largo, reducimos la letra para que quepa en 2 líneas
    const isLongText = footerText.length > 20;
    const nameFontSize = isLongText ? '7pt' : '9pt';

    // 4. FORMATEO DE PRECIO
    const price = parseFloat(product.selling_price || 0);
    const isInteger = Number.isInteger(price);
    const priceDisplay = isInteger ? price : price.toFixed(2);

    return (
        <div style={{ display: 'none' }}>
            <div ref={ref}>
                <style type="text/css" media="print">
                    {`
                        @page { size: ${width} ${height}; margin: 0; }
                        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
                        .label-container {
                            width: ${width}; height: ${height};
                            display: flex; flex-direction: column; align-items: center;
                            justify-content: space-between; text-align: center;
                            font-family: Arial, Helvetica, sans-serif;
                            overflow: hidden; padding: 1mm 1mm 0 1mm;
                            box-sizing: border-box; background: white;
                        }
                        .company-name {
                            font-size: 8pt; font-weight: bold; color: #000;
                            line-height: 1; width: 100%; white-space: nowrap; overflow: hidden;
                        }
                        .price-wrapper {
                            flex: 1; display: flex; align-items: center; justify-content: center;
                            width: 100%; line-height: 0.8; margin: -2px 0;
                        }
                        .currency {
                            font-size: 14pt; font-weight: bold; vertical-align: top;
                            margin-top: 6px; margin-right: 2px;
                        }
                        .price-number {
                            font-size: ${priceFontSize}; font-weight: 900; letter-spacing: -1px;
                        }
                        .price-number.decimal { font-size: 24pt; }
                        .product-name {
                            font-size: ${nameFontSize}; font-weight: bold; width: 100%;
                            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                            white-space: normal; overflow: hidden;
                            line-height: 1; text-transform: uppercase;
                            border-top: 1px solid #000; padding-top: 1px; margin-bottom: 2px;
                        }
                    `}
                </style>

                <div className="label-container">
                    <div className="company-name">{companyName}</div>
                    <div className="price-wrapper">
                        <span className="currency">$</span>
                        <span className={`price-number ${!isInteger ? 'decimal' : ''}`}>{priceDisplay}</span>
                    </div>
                    <div className="product-name">{footerText}</div>
                </div>
            </div>
        </div>
    );
});