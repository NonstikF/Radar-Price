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

const ACCENT = '#2563eb';       // azul
const ACCENT_DARK = '#1e40af';
const ACCENT_LIGHT = '#eff6ff';

// PDF para proveedor: sin precios
export const SupplierPDF = forwardRef<HTMLDivElement, PDFProps>(
    ({ supplierName, supplierRfc, items, date }, ref) => (
        <div ref={ref} className="pdf-root" style={{ width: 816, padding: '48px 56px', background: '#fff' }}>
            <style>{`
                @page { size: letter portrait; margin: 18mm 16mm; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                .pdf-root { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }

                .header-bar { background: ${ACCENT}; padding: 18px 22px; border-radius: 8px; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
                .header-title { font-size: 24px; font-weight: 900; color: #fff; letter-spacing: -0.5px; }
                .header-sub { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 4px; }
                .meta-block { text-align: right; }
                .meta-block .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.09em; color: rgba(255,255,255,0.65); font-weight: 700; }
                .meta-block .value { font-size: 13px; font-weight: 800; color: #fff; margin-top: 2px; }
                .meta-block .rfc { font-size: 10px; color: rgba(255,255,255,0.7); margin-top: 2px; }
                .meta-block .date-val { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.85); margin-top: 2px; }

                .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: ${ACCENT}; margin-bottom: 8px; }

                table { width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden; }
                thead tr { background: ${ACCENT_DARK}; }
                thead th { color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; padding: 10px 12px; text-align: left; }
                thead th.center { text-align: center; }
                tbody tr:nth-child(even) { background: ${ACCENT_LIGHT}; }
                tbody tr { border-bottom: 1px solid #e0eaff; }
                tbody td { padding: 9px 12px; vertical-align: middle; }
                .td-num { font-size: 9px; color: #aaa; text-align: center; width: 28px; }
                .td-sku { font-family: 'Courier New', monospace; font-size: 10px; color: ${ACCENT_DARK}; font-weight: 700; white-space: nowrap; }
                .td-name { font-size: 10.5px; color: #111; font-weight: 500; line-height: 1.4; }
                .td-alias { font-size: 9px; color: #888; margin-top: 2px; }
                .td-qty { text-align: center; font-size: 15px; font-weight: 900; color: ${ACCENT}; width: 60px; }

                .footer { margin-top: 32px; padding-top: 12px; border-top: 2px solid ${ACCENT_LIGHT}; display: flex; justify-content: space-between; align-items: center; }
                .footer-count { font-size: 11px; font-weight: 700; color: #444; }
                .footer-count span { color: ${ACCENT}; font-size: 14px; }
                .footer-date { font-size: 9px; color: #aaa; text-align: right; }
            `}</style>

            <div className="header-bar">
                <div>
                    <div className="header-title">Solicitud de Compra</div>
                    <div className="header-sub">Lista de artículos requeridos</div>
                </div>
                <div className="meta-block">
                    <div className="label">Proveedor</div>
                    <div className="value">{supplierName}</div>
                    <div className="rfc">{supplierRfc}</div>
                    <div style={{ marginTop: 8 }}>
                        <div className="label">Fecha</div>
                        <div className="date-val">{date}</div>
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
                        <th className="center">Cantidad</th>
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
                <div className="footer-count">
                    Total: <span>{items.reduce((s, i) => s + i.quantity, 0)}</span> unidades &nbsp;·&nbsp; {items.length} referencias
                </div>
                <div className="footer-date">{date}</div>
            </div>
        </div>
    )
);

// PDF interno: con precios, subtotal, IVA y total
export const InternalPDF = forwardRef<HTMLDivElement, PDFProps>(
    ({ supplierName, supplierRfc, items, total, date }, ref) => {
        const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
        const subtotal = total;
        const iva = subtotal * 0.16;
        const totalConIva = subtotal + iva;

        return (
            <div ref={ref} className="pdf-root" style={{ width: 816, padding: '48px 56px', background: '#fff' }}>
                <style>{`
                    @page { size: letter portrait; margin: 18mm 16mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    .pdf-root { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }

                    .header-bar { background: #7c3aed; padding: 18px 22px; border-radius: 8px; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
                    .header-title { font-size: 24px; font-weight: 900; color: #fff; letter-spacing: -0.5px; }
                    .badge { display: inline-block; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; background: rgba(255,255,255,0.2); color: #fff; padding: 3px 9px; border-radius: 20px; margin-top: 6px; }
                    .meta-block { text-align: right; }
                    .meta-block .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.09em; color: rgba(255,255,255,0.65); font-weight: 700; }
                    .meta-block .value { font-size: 13px; font-weight: 800; color: #fff; margin-top: 2px; }
                    .meta-block .rfc { font-size: 10px; color: rgba(255,255,255,0.7); margin-top: 2px; }
                    .meta-block .date-val { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.85); margin-top: 2px; }

                    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: #7c3aed; margin-bottom: 8px; }

                    table { width: 100%; border-collapse: collapse; }
                    thead tr { background: #5b21b6; }
                    thead th { color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; padding: 10px 12px; text-align: left; }
                    thead th.right { text-align: right; }
                    thead th.center { text-align: center; }
                    tbody tr:nth-child(even) { background: #f5f3ff; }
                    tbody tr { border-bottom: 1px solid #ede9fe; }
                    tbody td { padding: 9px 12px; vertical-align: middle; }
                    .td-num { font-size: 9px; color: #aaa; text-align: center; width: 24px; }
                    .td-sku { font-family: 'Courier New', monospace; font-size: 10px; color: #5b21b6; font-weight: 700; white-space: nowrap; }
                    .td-name { font-size: 10.5px; color: #111; font-weight: 500; line-height: 1.4; }
                    .td-alias { font-size: 9px; color: #888; margin-top: 2px; }
                    .td-qty { text-align: center; font-size: 14px; font-weight: 900; color: #7c3aed; width: 50px; }
                    .td-price { text-align: right; font-size: 10px; color: #666; white-space: nowrap; width: 76px; }
                    .td-sub { text-align: right; font-size: 11px; font-weight: 700; color: #111; white-space: nowrap; width: 84px; }

                    .bottom-area { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
                    .summary-counts { font-size: 10.5px; color: #555; line-height: 2; }
                    .summary-counts strong { color: #111; font-weight: 800; }

                    .totals-box { min-width: 260px; border-radius: 8px; overflow: hidden; border: 1.5px solid #ede9fe; }
                    .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid #f3f0ff; }
                    .totals-row .tl { font-size: 10.5px; color: #555; font-weight: 600; }
                    .totals-row .tv { font-size: 11px; font-weight: 800; color: #111; }
                    .totals-row.iva-row { background: #f5f3ff; }
                    .totals-row.iva-row .tl { color: #7c3aed; }
                    .totals-row.iva-row .tv { color: #7c3aed; }
                    .totals-row.total-row { background: #7c3aed; border-bottom: none; }
                    .totals-row.total-row .tl { color: rgba(255,255,255,0.8); font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
                    .totals-row.total-row .tv { color: #fff; font-size: 18px; font-weight: 900; }

                    .footer { margin-top: 28px; padding-top: 12px; border-top: 2px solid #f5f3ff; display: flex; justify-content: flex-end; }
                    .footer-date { font-size: 9px; color: #bbb; text-align: right; }
                `}</style>

                <div className="header-bar">
                    <div>
                        <div className="header-title">Lista de Compras</div>
                        <div><span className="badge">Interno</span></div>
                    </div>
                    <div className="meta-block">
                        <div className="label">Proveedor</div>
                        <div className="value">{supplierName}</div>
                        <div className="rfc">{supplierRfc}</div>
                        <div style={{ marginTop: 8 }}>
                            <div className="label">Fecha</div>
                            <div className="date-val">{date}</div>
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

                <div className="bottom-area">
                    <div className="summary-counts">
                        <div>Referencias: <strong>{items.length}</strong></div>
                        <div>Total unidades: <strong>{totalUnits}</strong></div>
                    </div>
                    <div className="totals-box">
                        <div className="totals-row">
                            <span className="tl">Subtotal</span>
                            <span className="tv">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="totals-row iva-row">
                            <span className="tl">IVA (16%)</span>
                            <span className="tv">${iva.toFixed(2)}</span>
                        </div>
                        <div className="totals-row total-row">
                            <span className="tl">Total con IVA</span>
                            <span className="tv">${totalConIva.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="footer">
                    <div className="footer-date">Generado el {date}</div>
                </div>
            </div>
        );
    }
);
