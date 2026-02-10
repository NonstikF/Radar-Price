import React from 'react';

export const ProductLabel = React.forwardRef<HTMLDivElement, { product: any }>(({ product }, ref) => {
    if (!product) return null;

    // 1. LÓGICA DE TEXTO: Preferimos el Alias, si no hay, usamos el Nombre
    let footerText = product.name;
    if (product.alias && product.alias.trim() !== "") {
        footerText = product.alias;
    }

    // 2. FORMATEO DE PRECIO: Quitamos decimales si es número entero para que se vea MAS GRANDE
    const price = parseFloat(product.selling_price || 0);
    const isInteger = Number.isInteger(price);
    const priceDisplay = isInteger ? price : price.toFixed(2);

    return (
        <div style={{ display: 'none' }}>
            <div ref={ref}>
                <style type="text/css" media="print">
                    {`
                        @page { 
                            size: 1.5in 1in; /* 1.5 ancho x 1 alto */
                            margin: 0;
                        }
                        body { 
                            margin: 0; 
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                        }
                        .label-container {
                            width: 1.5in;
                            height: 1in;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                            text-align: center;
                            font-family: Arial, Helvetica, sans-serif;
                            overflow: hidden;
                            padding: 1mm; /* Un pequeño margen interno de seguridad */
                            box-sizing: border-box;
                            background: white;
                        }
                        
                        /* HEADER: PlantArte */
                        .company-name {
                            font-size: 10pt;
                            font-weight: bold;
                            color: #000;
                            line-height: 1;
                            margin-top: 1px;
                        }

                        /* BODY: Precio */
                        .price-wrapper {
                            flex: 1; /* Ocupa todo el espacio disponible en medio */
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
                            font-size: 34pt; /* TAMAÑO GIGANTE */
                            font-weight: 900;
                            letter-spacing: -1px;
                        }

                        /* Si tiene decimales, reducimos un poco la fuente para que quepa */
                        .price-number.decimal {
                            font-size: 24pt; 
                        }

                        /* FOOTER: Nombre o Alias */
                        .product-name {
                            font-size: 7pt;
                            font-weight: bold;
                            width: 100%;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            text-transform: uppercase;
                            padding-top: 1px;
                            border-top: 1px solid #000; /* Línea separadora opcional para estilo */
                        }
                    `}
                </style>

                <div className="label-container">
                    {/* 1. EMPRESA */}
                    <div className="company-name">PlantArte</div>

                    {/* 2. PRECIO */}
                    <div className="price-wrapper">
                        <span className="currency">$</span>
                        <span className={`price-number ${!isInteger ? 'decimal' : ''}`}>
                            {priceDisplay}
                        </span>
                    </div>

                    {/* 3. PRODUCTO / ALIAS */}
                    <div className="product-name">
                        {footerText}
                    </div>
                </div>
            </div>
        </div>
    );
});