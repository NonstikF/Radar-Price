import React from 'react';

// Definimos los tamaños soportados para evitar errores
export type LabelSize = '1.5x1' | '2x1';

interface Props {
    product: any;
    size: LabelSize;        // Nuevo: Tamaño elegido
    companyName: string;    // Nuevo: Nombre de la empresa
}

export const ProductLabel = React.forwardRef<HTMLDivElement, Props>(({ product, size, companyName }, ref) => {
    if (!product) return null;

    // 1. DEFINIR MEDIDAS SEGÚN EL MODELO
    const width = size === '2x1' ? '2in' : '1.5in';
    const height = '1in'; // Ambas son de 1 pulgada de alto

    // Ajustamos el tamaño de la fuente del precio si la etiqueta es más grande
    const priceFontSize = size === '2x1' ? '40pt' : '34pt';

    // 2. LÓGICA DE TEXTO (Alias o Nombre)
    let footerText = product.name;
    if (product.alias && product.alias.trim() !== "") {
        footerText = product.alias;
    }

    // 3. FORMATEO DE PRECIO
    const price = parseFloat(product.selling_price || 0);
    const isInteger = Number.isInteger(price);
    const priceDisplay = isInteger ? price : price.toFixed(2);

    return (
        <div style={{ display: 'none' }}>
            <div ref={ref}>
                <style type="text/css" media="print">
                    {`
                        @page { 
                            size: ${width} ${height}; 
                            margin: 0;
                        }
                        body { 
                            margin: 0; 
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                        }
                        .label-container {
                            width: ${width};
                            height: ${height};
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                            text-align: center;
                            font-family: Arial, Helvetica, sans-serif;
                            overflow: hidden;
                            padding: 1mm;
                            box-sizing: border-box;
                            background: white;
                        }
                        
                        .company-name {
                            font-size: 10pt;
                            font-weight: bold;
                            color: #000;
                            line-height: 1;
                            margin-top: 1px;
                            width: 100%;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }

                        .price-wrapper {
                            flex: 1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 100%;
                            line-height: 0.9;
                        }
                        
                        .currency {
                            font-size: 14pt;
                            font-weight: bold;
                            vertical-align: top;
                            margin-top: 4px;
                            margin-right: 1px;
                        }

                        .price-number {
                            font-size: ${priceFontSize}; /* Dinámico según tamaño */
                            font-weight: 900;
                            letter-spacing: -1px;
                        }

                        .price-number.decimal {
                            font-size: 24pt; 
                        }

                        .product-name {
                            font-size: 8pt; /* Un poco más grande si cabe */
                            font-weight: bold;
                            width: 100%;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            text-transform: uppercase;
                            border-top: 1px solid #000;
                        }
                    `}
                </style>

                <div className="label-container">
                    {/* NOMBRE EMPRESA DINÁMICO */}
                    <div className="company-name">{companyName}</div>

                    {/* PRECIO */}
                    <div className="price-wrapper">
                        <span className="currency">$</span>
                        <span className={`price-number ${!isInteger ? 'decimal' : ''}`}>
                            {priceDisplay}
                        </span>
                    </div>

                    {/* PRODUCTO */}
                    <div className="product-name">
                        {footerText}
                    </div>
                </div>
            </div>
        </div>
    );
});