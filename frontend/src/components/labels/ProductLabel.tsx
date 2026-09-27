import { forwardRef } from 'react';
import Barcode from 'react-barcode';
import type { LabelSettings } from '../../hooks/useLabelSettings';

interface Props {
    product: any;
    settings: LabelSettings;
}

// --- HOJA A4 -----------------------------------------------------------------
// En una hoja entera el texto no se ajusta con tamaños fijos: un precio de dos
// dígitos y un nombre de cinco palabras tienen que llenar la misma caja. Lo
// resolvemos con el viewBox de un SVG, que escala su contenido hasta llenar la
// caja que lo contiene. No medimos en el DOM porque la etiqueta se renderiza
// dentro de un contenedor display:none, donde toda medida daría cero.
const A4_MM = { w: 210, h: 297 };
const SHEET_PADDING_MM = 10;
const SHEET_GAP_MM = 6;
const SHEET_COMPANY_MM = 14;
const SHEET_BARCODE_MM = 32;
// Línea divisoria entre precio y nombre, con su margen.
const SHEET_RULE_MM = 5;
// Reparto de la zona principal cuando van nombre y precio juntos: el precio
// manda, que es lo que se lee de lejos.
const SHEET_PRICE_SHARE = 0.62;

// Medidas internas del viewBox. El tamaño de fuente es arbitrario: lo que
// importa es la proporción entre el alto de los renglones y su ancho.
const FIT_FONT = 100;
const FIT_LINE_HEIGHT = 1.06;
// Ancho medio de un glifo en negritas, en múltiplos del tamaño de fuente.
const FIT_CHAR_WIDTH = 0.62;
// Dos cortes que dejan la letra a menos de esto de diferencia cuentan como
// iguales, en milímetros.
const FIT_TIE_MM = 0.5;

// Texto que crece hasta llenar la caja donde se monta.
const FittedText = ({ lines }: { lines: string[] }) => {
    const widest = lines.reduce((max, line) => Math.max(max, line.length), 1);
    const boxWidth = widest * FIT_CHAR_WIDTH * FIT_FONT;
    const boxHeight = lines.length * FIT_LINE_HEIGHT * FIT_FONT;

    return (
        <svg
            viewBox={`0 0 ${boxWidth} ${boxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            width="100%"
            height="100%"
            style={{ display: 'block' }}
        >
            {lines.map((line, index) => (
                <text
                    key={index}
                    x={boxWidth / 2}
                    y={(index + 0.5) * FIT_LINE_HEIGHT * FIT_FONT}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={FIT_FONT}
                    fontWeight={900}
                    fill="#000000"
                    // Fijar el ancho de cada renglón garantiza que nada se salga
                    // de la hoja aunque el promedio de arriba se quede corto.
                    textLength={line.length * FIT_CHAR_WIDTH * FIT_FONT}
                    lengthAdjust="spacingAndGlyphs"
                >
                    {line}
                </text>
            ))}
        </svg>
    );
};

// Corta el texto en renglones de a lo más maxChars caracteres, sin partir
// palabras. Puede devolver más renglones de los previstos si alguna palabra no
// cabe; quien llama mide el resultado real, así que no pasa nada.
function wrapAt(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];

    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (!current) current = word;
        else if (current.length + 1 + word.length <= maxChars) current += ' ' + word;
        else {
            lines.push(current);
            current = word;
        }
    }
    lines.push(current);
    return lines;
}

// Prueba cada corte posible del texto y se queda con el que deja la letra más
// grande dentro de una caja de boxW x boxH milímetros.
function fitLines(text: string, boxW: number, boxH: number): string[] {
    let best = [text];
    let bestSize = -1;
    for (let maxChars = 1; maxChars <= text.length; maxChars++) {
        const candidate = wrapAt(text, maxChars);
        const widest = candidate.reduce((max, line) => Math.max(max, line.length), 1);
        // Al escalar con "meet" manda la dimensión que queda más apretada.
        const size = Math.min(
            boxW / (widest * FIT_CHAR_WIDTH),
            boxH / (candidate.length * FIT_LINE_HEIGHT),
        );
        // Varios cortes dan la misma letra (los limita la misma palabra larga).
        // Entre esos nos quedamos con el de menos renglones, que se lee mejor
        // que una columna de palabras sueltas.
        const bigger = size > bestSize + FIT_TIE_MM;
        const tidier = size > bestSize - FIT_TIE_MM && candidate.length < best.length;
        if (bigger || tidier) {
            bestSize = Math.max(size, bestSize);
            best = candidate;
        }
    }
    return best;
}

export const ProductLabel = forwardRef<HTMLDivElement, Props>((props, ref) => {
    const { product, settings } = props;

    // NOMBRES
    const getProductName = () => {
        const source = settings.nameSource || 'alias_if_available';
        const alias = product.alias ? String(product.alias).trim() : '';
        const originalName = product.name ? String(product.name).trim() : '';
        // Cada modo cae al otro campo si el suyo viene vacío, para no imprimir
        // una etiqueta sin texto.
        if (source === 'always_alias') return alias.length > 0 ? alias : originalName;
        if (source === 'always_name') return originalName.length > 0 ? originalName : alias;
        return alias.length > 0 ? alias : originalName;
    };
    const displayName = getProductName();
    const nameOnlyStyle = displayName.length > 60
        ? 'text-xs leading-tight font-bold'
        : displayName.length > 30 ? 'text-sm leading-tight font-bold' : 'text-lg leading-tight font-bold';

    // ESTILOS DE FUENTE
    const getNameStyle = (text: string) => {
        const length = text.length;
        if (length < 15) return 'text-[13px] leading-none font-black';
        if (length < 25) return 'text-[11px] leading-none font-bold';
        return 'text-[9px] leading-none font-bold tracking-tight';
    };

    // CÓDIGO DE BARRAS
    const getBarcodeValue = () => {
        const source = settings.barcodeSource || 'upc_if_available';
        const upc = product.upc ? String(product.upc).trim() : '';
        const sku = product.sku ? String(product.sku).trim() : '';
        if (source === 'always_upc') return upc;
        if (source === 'always_sku') return sku;
        return upc.length > 0 ? upc : sku;
    };
    const barcodeValue = getBarcodeValue();
    const showBarcode = settings.showBarcode && barcodeValue.length > 0;
    // Alto reservado en la etiqueta para la franja del código (barras + número).
    const BARCODE_STRIP_PX = 26;

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
            '2.25x1.25': { w: '2.25in', h: '1.25in' },
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

    // --- HOJA A4 COMPLETA ---
    // Es un cartel, no una etiqueta: en vez de meter el diseño chico dentro de
    // una hoja grande, repartimos la hoja entera entre lo que se pidió imprimir
    // y dejamos que cada bloque crezca hasta llenar su parte.
    if (settings.size === 'a4' || settings.size === 'a4-landscape') {
        const landscape = settings.size === 'a4-landscape';
        // Acostada es la misma hoja con los lados cambiados. El reparto de
        // abajo trabaja con estas dos medidas, así que no hay que tocarlo.
        const sheetW = landscape ? A4_MM.h : A4_MM.w;
        const sheetH = landscape ? A4_MM.w : A4_MM.h;
        const contentW = sheetW - SHEET_PADDING_MM * 2;
        const contentH = sheetH - SHEET_PADDING_MM * 2;
        const mainH = contentH
            - (settings.companyName ? SHEET_COMPANY_MM + SHEET_GAP_MM : 0)
            - (showBarcode ? SHEET_BARCODE_MM + SHEET_GAP_MM : 0);

        const bothVisible = settings.showPrice && settings.showName;
        const priceH = bothVisible ? mainH * SHEET_PRICE_SHARE : mainH;
        const nameH = bothVisible ? mainH * (1 - SHEET_PRICE_SHARE) - SHEET_GAP_MM : mainH;
        // Con precio, al nombre le queda menos: arriba lleva la línea divisoria.
        const nameBoxH = bothVisible ? nameH - SHEET_RULE_MM : nameH;

        return (
            <div ref={ref} className="bg-white mx-auto overflow-hidden">
                <style>
                    {`
                    @media print {
                        @page { margin: 0 !important; size: A4 ${landscape ? 'landscape' : 'portrait'} !important; }
                        body { margin: 0 !important; padding: 0 !important; }
                    }
                `}
                </style>

                <div
                    style={{
                        width: `${sheetW}mm`,
                        height: `${sheetH}mm`,
                        padding: `${SHEET_PADDING_MM}mm`,
                        gap: `${SHEET_GAP_MM}mm`,
                    }}
                    className="bg-white text-black overflow-hidden flex flex-col"
                >
                    {settings.companyName && (
                        <div style={{ height: `${SHEET_COMPANY_MM}mm` }} className="shrink-0">
                            <FittedText lines={[settings.companyName.toUpperCase()]} />
                        </div>
                    )}

                    {settings.showPrice && (
                        <div style={{ height: `${priceH}mm` }} className="shrink-0">
                            <FittedText lines={[`$${finalPrice}`]} />
                        </div>
                    )}

                    {settings.showName && (
                        <div style={{ height: `${nameH}mm` }} className="flex shrink-0 flex-col">
                            {bothVisible && (
                                <div
                                    style={{ marginBottom: `${SHEET_RULE_MM}mm` }}
                                    className="w-full shrink-0 border-t-[3px] border-black"
                                />
                            )}
                            <div className="min-h-0 flex-1">
                                <FittedText lines={fitLines(displayName.toUpperCase(), contentW, nameBoxH)} />
                            </div>
                        </div>
                    )}

                    {showBarcode && (
                        <div
                            style={{ height: `${SHEET_BARCODE_MM}mm` }}
                            className="mt-auto flex shrink-0 items-end justify-center overflow-hidden"
                        >
                            <Barcode
                                value={barcodeValue}
                                format="CODE128"
                                renderer="svg"
                                height={70}
                                width={3}
                                margin={0}
                                displayValue
                                fontSize={24}
                                textMargin={2}
                                background="#ffffff"
                                lineColor="#000000"
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={ref} className="bg-white mx-auto overflow-hidden">
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

                    {/* ZONA PRINCIPAL: deja libre la franja inferior del código de barras */}
                    <div
                        className="absolute top-0 left-0 w-full"
                        style={{ bottom: showBarcode ? `${BARCODE_STRIP_PX}px` : 0 }}
                    >
                        {/* PRECIO */}
                        {settings.showPrice && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                <div className={`flex items-start leading-none ${settings.showName ? '-translate-y-2' : ''}`}>
                                    <span className="text-xl font-bold mt-2 mr-1">$</span>
                                    <span className={`${priceFontSize} tracking-tighter leading-[0.75] ${settings.boldPrice ? 'font-black' : 'font-extrabold'}`}>
                                        {finalPrice}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* TEXTO INFERIOR */}
                        {settings.showName && (
                            <div className={settings.showPrice
                                ? 'absolute bottom-0 left-0 w-full text-center px-1 z-20 bg-white'
                                : `absolute inset-0 flex items-center justify-center text-center px-2 z-10 ${settings.companyName ? 'pt-4' : ''}`}>
                                {settings.showPrice && <div className="border-t-2 border-black w-full mb-[1px]"></div>}
                                <p className={`${settings.showPrice ? getNameStyle(displayName) : nameOnlyStyle} break-words uppercase text-black w-full pb-[1px]`}>
                                    {displayName}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* CÓDIGO DE BARRAS (abajo, pequeño) */}
                    {showBarcode && (
                        <div
                            className="absolute bottom-0 left-0 w-full flex items-end justify-center bg-white z-30 overflow-hidden"
                            style={{ height: `${BARCODE_STRIP_PX}px` }}
                        >
                            <Barcode
                                value={barcodeValue}
                                format="CODE128"
                                renderer="svg"
                                height={16}
                                width={1}
                                margin={0}
                                displayValue
                                fontSize={7}
                                textMargin={0}
                                background="#ffffff"
                                lineColor="#000000"
                            />
                        </div>
                    )}
                </div>
        </div>
    );
});

ProductLabel.displayName = 'ProductLabel';
