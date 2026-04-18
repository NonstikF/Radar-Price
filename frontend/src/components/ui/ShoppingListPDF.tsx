import { forwardRef } from 'react';

interface ShoppingListItem {
    id: number;
    product_id: number;
    product_name: string;
    product_alias: string;
    product_sku: string;
    price: number;
    selling_price: number;
    quantity: number;
    subtotal: number;
    added_at: string;
}

interface PDFProps {
    supplierName: string;
    supplierRfc: string;
    items: ShoppingListItem[];
    total: number;
    date: string;
}

// PDF para proveedor: sin precios
export const SupplierPDF = forwardRef<HTMLDivElement, PDFProps>(
    ({ supplierName, supplierRfc, items, date }, ref) => (
        <div ref={ref} className="pdf-root">
            <style>{`
                @page { size: letter portrait; margin: 20mm 18mm; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                .pdf-root { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2.5px solid #111; margin-bottom: 22px; }
                .header-title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #111; }
                .header-sub { font-size: 11px; color: #555; margin-top: 3px; }
                .meta-block { text-align: right; }
                .meta-block .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 700; }
                .meta-block .value { font-size: 12px; font-weight: 800; color: #111; margin-top: 1px; }
                .meta-block .rfc { font-size: 10px; color: #555; margin-top: 2px; }
                .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: #888; margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; }
                thead tr { background: #111; }
                thead th { color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; padding: 9px 10px; text-align: left; }
                thead th.center { text-align: center; }
                tbody tr:nth-child(even) { background: #f8f8f8; }
                tbody tr { border-bottom: 1px solid #e5e5e5; }
                tbody td { padding: 8px 10px; vertical-align: middle; }
                .td-num { font-size: 9px; color: #999; text-align: center; width: 28px; }
                .td-sku { font-family: 'Courier New', monospace; font-size: 10px; color: #333; font-weight: 700; white-space: nowrap; }
                .td-name { font-size: 10.5px; color: #111; font-weight: 500; line-height: 1.35; }
                .td-alias { font-size: 9px; color: #888; margin-top: 2px; }
                .td-qty { text-align: center; font-size: 14px; font-weight: 900; color: #111; width: 60px; }
                .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; align-items: flex-end; }
                .footer-note { font-size: 9px; color: #aaa; max-width: 280px; line-height: 1.5; }
                .footer-count { font-size: 10px; font-weight: 700; color: #555; }
                .no-print { display: none !important; }
            `}</style>

            <div className="header">
                <div>
                    <div className="header-title">Solicitud de Compra</div>
                    <div className="header-sub">Para uso con proveedor · Documento confidencial</div>
                </div>
                <div className="meta-block">
                    <div className="label">Proveedor</div>
                    <div className="value">{supplierName}</div>
                    <div className="rfc">{supplierRfc}</div>
                    <div style={{ marginTop: 6 }}>
                        <div className="label">Fecha</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#444', marginTop: 1 }}>{date}</div>
                    </div>
                </div>
            </div>

            <div className="section-title">Artículos solicitados</div>

            <table>
                <thead>
                    <tr>
                        <th className="center">#</th>
                        <th>Código</th>
                        <th>Descripción del Artículo</th>
                        <th className="center">Cant.</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={item.id}>
                            <td className="td-num">{idx + 1}</td>
                            <td className="td-sku">{item.product_sku || '—'}</td>
                            <td className="td-name">
                                {item.product_alias || item.product_name}
                                {item.product_alias && (
                                    <div className="td-alias">{item.product_name}</div>
                                )}
                            </td>
                            <td className="td-qty">{item.quantity}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="footer">
                <div className="footer-note">
                    Este documento es una solicitud de compra interna. Los precios y condiciones serán acordados con el proveedor.
                </div>
                <div className="footer-count">
                    Total de artículos: <strong>{items.reduce((s, i) => s + i.quantity, 0)}</strong> unidades ({items.length} referencias)
                </div>
            </div>
        </div>
    )
);

// PDF interno: con precios y totales
export const InternalPDF = forwardRef<HTMLDivElement, PDFProps>(
    ({ supplierName, supplierRfc, items, total, date }, ref) => {
        const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
        return (
            <div ref={ref} className="pdf-root">
                <style>{`
                    @page { size: letter portrait; margin: 20mm 18mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    .pdf-root { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2.5px solid #111; margin-bottom: 22px; }
                    .header-title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #111; }
                    .badge { display: inline-block; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; background: #111; color: #fff; padding: 3px 8px; border-radius: 4px; margin-top: 6px; }
                    .meta-block { text-align: right; }
                    .meta-block .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 700; }
                    .meta-block .value { font-size: 12px; font-weight: 800; color: #111; margin-top: 1px; }
                    .meta-block .rfc { font-size: 10px; color: #555; margin-top: 2px; }
                    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: #888; margin-bottom: 8px; }
                    table { width: 100%; border-collapse: collapse; }
                    thead tr { background: #111; }
                    thead th { color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; padding: 9px 10px; text-align: left; }
                    thead th.right { text-align: right; }
                    thead th.center { text-align: center; }
                    tbody tr:nth-child(even) { background: #f8f8f8; }
                    tbody tr { border-bottom: 1px solid #e5e5e5; }
                    tbody td { padding: 8px 10px; vertical-align: middle; }
                    .td-num { font-size: 9px; color: #999; text-align: center; width: 24px; }
                    .td-sku { font-family: 'Courier New', monospace; font-size: 10px; color: #333; font-weight: 700; white-space: nowrap; }
                    .td-name { font-size: 10.5px; color: #111; font-weight: 500; line-height: 1.35; }
                    .td-alias { font-size: 9px; color: #888; margin-top: 2px; }
                    .td-qty { text-align: center; font-size: 13px; font-weight: 900; color: #111; width: 50px; }
                    .td-price { text-align: right; font-size: 10px; color: #555; white-space: nowrap; width: 72px; }
                    .td-sub { text-align: right; font-size: 11px; font-weight: 700; color: #111; white-space: nowrap; width: 80px; }
                    .totals-box { margin-top: 16px; display: flex; justify-content: flex-end; }
                    .totals-inner { min-width: 240px; border: 1.5px solid #e5e5e5; border-radius: 6px; overflow: hidden; }
                    .totals-row { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 10.5px; border-bottom: 1px solid #f0f0f0; }
                    .totals-row:last-child { border-bottom: none; background: #111; color: #fff; }
                    .totals-row .tl { color: inherit; font-weight: 600; }
                    .totals-row .tv { font-weight: 800; }
                    .totals-row:last-child .tl { color: #aaa; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
                    .totals-row:last-child .tv { font-size: 16px; }
                    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; align-items: flex-end; }
                    .footer-note { font-size: 9px; color: #aaa; max-width: 260px; line-height: 1.5; }
                    .footer-stamp { font-size: 9px; color: #bbb; text-align: right; }
                    .no-print { display: none !important; }
                `}</style>

                <div className="header">
                    <div>
                        <div className="header-title">Lista de Compras</div>
                        <div><span className="badge">Documento Interno</span></div>
                    </div>
                    <div className="meta-block">
                        <div className="label">Proveedor</div>
                        <div className="value">{supplierName}</div>
                        <div className="rfc">{supplierRfc}</div>
                        <div style={{ marginTop: 6 }}>
                            <div className="label">Fecha</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#444', marginTop: 1 }}>{date}</div>
                        </div>
                    </div>
                </div>

                <div className="section-title">Detalle de artículos</div>

                <table>
                    <thead>
                        <tr>
                            <th className="center">#</th>
                            <th>Código</th>
                            <th>Descripción del Artículo</th>
                            <th className="center">Cant.</th>
                            <th className="right">P. Costo</th>
                            <th className="right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="td-num">{idx + 1}</td>
                                <td className="td-sku">{item.product_sku || '—'}</td>
                                <td className="td-name">
                                    {item.product_alias || item.product_name}
                                    {item.product_alias && (
                                        <div className="td-alias">{item.product_name}</div>
                                    )}
                                </td>
                                <td className="td-qty">{item.quantity}</td>
                                <td className="td-price">${item.price.toFixed(2)}</td>
                                <td className="td-sub">${item.subtotal.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="totals-box">
                    <div className="totals-inner">
                        <div className="totals-row">
                            <span className="tl">Referencias</span>
                            <span className="tv">{items.length}</span>
                        </div>
                        <div className="totals-row">
                            <span className="tl">Total unidades</span>
                            <span className="tv">{totalUnits}</span>
                        </div>
                        <div className="totals-row">
                            <span className="tl">Total estimado</span>
                            <span className="tv">${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="footer">
                    <div className="footer-note">
                        Documento de uso interno. Los precios reflejan el costo de compra registrado y pueden variar según las condiciones del proveedor.
                    </div>
                    <div className="footer-stamp">
                        Generado el {date}<br />Uso exclusivo interno
                    </div>
                </div>
            </div>
        );
    }
);
