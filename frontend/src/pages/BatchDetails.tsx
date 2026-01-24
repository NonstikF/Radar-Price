import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, Save, Loader2, AlertTriangle, CheckCircle2, Barcode, Filter, ListFilter } from 'lucide-react';
import { API_URL } from '../config';

// ==========================================
// 1. SUB-COMPONENTE: Tarjeta Móvil (Optimizado)
// ==========================================
const BatchItemCard = React.memo(({ p, onPriceUpdate, onUpcUpdate }: any) => {
    // Estado local para escribir súper rápido sin lag
    const [localPrice, setLocalPrice] = useState(p.selling_price || '');
    const [localUpc, setLocalUpc] = useState(p.upc || '');

    // Sincronizar si la data externa cambia (ej: al cargar)
    useEffect(() => {
        setLocalPrice(p.selling_price || '');
        setLocalUpc(p.upc || '');
    }, [p.selling_price, p.upc]);

    const costo = p.price || 0;
    const venta = parseFloat(localPrice) || 0;
    const margen = venta > 0 ? ((venta - costo) / venta * 100) : 0;
    const tienePrecio = venta > 0;

    const cardClass = tienePrecio
        ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm";

    const inputClass = tienePrecio
        ? "text-green-700 dark:text-green-300 border-green-200 focus:ring-green-500 bg-white dark:bg-gray-900"
        : "text-red-700 dark:text-red-300 border-red-300 focus:ring-red-500 bg-white dark:bg-gray-900 ring-1 ring-red-100 dark:ring-red-900/30";

    return (
        <div className={`p-4 rounded-xl border transition-all ${cardClass}`}>
            <div className="mb-3">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug w-[85%]">{p.name}</h3>
                    {tienePrecio
                        ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        : <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    }
                </div>
                <div className="flex flex-col gap-1 mt-2">
                    <p className="text-xs text-gray-400 font-mono">SKU: {p.sku || 'N/A'}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Barcode className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={localUpc}
                            onChange={(e) => setLocalUpc(e.target.value)}
                            onBlur={() => onUpcUpdate(p.id, localUpc)} // <--- ACTUALIZA AL SALIR
                            placeholder="UPC..."
                            className="text-xs border-b border-gray-300 dark:border-gray-600 bg-transparent focus:border-blue-500 outline-none w-full py-1 text-gray-700 dark:text-gray-200"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end bg-white/50 dark:bg-gray-800/50 p-2 rounded-lg">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Costo</p>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">${costo.toFixed(2)}</p>
                    <span className={`text-[10px] font-bold ${margen > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        Margen: {margen > 0 ? `${margen.toFixed(0)}%` : '-'}
                    </span>
                </div>
                <div>
                    <p className={`text-[10px] uppercase font-bold mb-1 ${tienePrecio ? 'text-green-600' : 'text-red-500'}`}>Precio Venta</p>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input
                            type="number"
                            value={localPrice}
                            onChange={(e) => setLocalPrice(e.target.value)}
                            onBlur={() => onPriceUpdate(p.id, localPrice)} // <--- ACTUALIZA AL SALIR
                            className={`w-full pl-5 pr-2 py-2 text-sm font-bold text-right border rounded-lg focus:ring-2 outline-none transition-colors ${inputClass}`}
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

// ==========================================
// 2. SUB-COMPONENTE: Fila Escritorio (Optimizado)
// ==========================================
const BatchItemRow = React.memo(({ p, onPriceUpdate, onUpcUpdate }: any) => {
    const [localPrice, setLocalPrice] = useState(p.selling_price || '');
    const [localUpc, setLocalUpc] = useState(p.upc || '');

    useEffect(() => {
        setLocalPrice(p.selling_price || '');
        setLocalUpc(p.upc || '');
    }, [p.selling_price, p.upc]);

    const costo = p.price || 0;
    const venta = parseFloat(localPrice) || 0;
    const margen = venta > 0 ? ((venta - costo) / venta * 100) : 0;
    const tienePrecio = venta > 0;

    const rowClass = tienePrecio
        ? "bg-green-50/30 hover:bg-green-50 dark:bg-green-900/10 dark:hover:bg-green-900/20"
        : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700";

    const inputClass = tienePrecio
        ? "text-green-700 border-green-200 focus:ring-green-500 bg-white"
        : "text-red-600 border-red-300 focus:ring-red-500 bg-white shadow-sm ring-1 ring-red-100";

    return (
        <tr className={`transition-colors ${rowClass}`}>
            <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku || '-'}</td>
            <td className="px-4 py-3">
                <div className="relative group">
                    <input
                        type="text"
                        value={localUpc}
                        onChange={(e) => setLocalUpc(e.target.value)}
                        onBlur={() => onUpcUpdate(p.id, localUpc)}
                        className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-blue-500 outline-none font-mono text-xs text-gray-600 dark:text-gray-400 focus:text-gray-900 dark:focus:text-white py-1 transition-colors"
                        placeholder="---"
                    />
                    <Barcode className="w-3 h-3 text-gray-300 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </td>
            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
            <td className="px-4 py-3 text-right text-gray-500">${costo.toFixed(2)}</td>
            <td className="px-4 py-2">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                        type="number"
                        value={localPrice}
                        onChange={(e) => setLocalPrice(e.target.value)}
                        onBlur={() => onPriceUpdate(p.id, localPrice)}
                        className={`w-full pl-6 pr-2 py-1.5 border rounded-lg focus:ring-2 font-bold text-right outline-none transition-all ${inputClass}`}
                        placeholder="0.00"
                    />
                </div>
            </td>
            <td className={`px-4 py-3 text-center font-bold ${margen > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                {margen > 0 ? `${margen.toFixed(0)}%` : '-'}
            </td>
            <td className="px-4 py-3 text-center">
                {tienePrecio
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                    : <AlertTriangle className="w-5 h-5 text-red-400 mx-auto opacity-50" />
                }
            </td>
        </tr>
    );
});


// ==========================================
// 3. COMPONENTE PRINCIPAL (Padre)
// ==========================================
export function BatchDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<'all' | 'missing' | 'ready'>('all');

    useEffect(() => {
        const fetchBatchData = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_URL}/invoices/batches/${id}/products`);
                setProducts(response.data);
            } catch (err) {
                console.error(err);
                setError("No se pudo cargar la información del lote.");
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchBatchData();
    }, [id]);

    // Callback optimizado: Solo actualiza la lista principal cuando sales del input (onBlur)
    const handlePriceUpdate = useCallback((productId: number, newPrice: string) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, selling_price: newPrice } : p
        ));
    }, []);

    const handleUpcUpdate = useCallback((productId: number, newUpc: string) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, upc: newUpc } : p
        ));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = products.map(p => ({
                id: p.id,
                name: p.name,
                selling_price: parseFloat(p.selling_price) || 0,
                upc: p.upc || ""
            }));
            await axios.post(`${API_URL}/invoices/update-prices`, updates);
            setSuccessMsg("Guardado");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
            alert("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    // Cálculos memorizados
    const stats = useMemo(() => {
        const totalItems = products.length;
        const itemsReady = products.filter(p => parseFloat(p.selling_price) > 0).length;
        const itemsMissing = totalItems - itemsReady;
        const progress = totalItems > 0 ? Math.round((itemsReady / totalItems) * 100) : 0;
        return { totalItems, itemsReady, itemsMissing, progress };
    }, [products]);

    // Filtrado
    const displayedProducts = useMemo(() => {
        return products.filter(p => {
            const hasPrice = parseFloat(p.selling_price) > 0;
            if (filter === 'missing') return !hasPrice;
            if (filter === 'ready') return hasPrice;
            return true;
        });
    }, [products, filter]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-600" />
            <p>Cargando detalles...</p>
        </div>
    );

    if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 pb-24 animate-fade-in">
            {/* HEADER */}
            <div className="sticky top-16 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur py-4 border-b border-gray-200 dark:border-gray-800 shadow-sm md:shadow-none -mx-4 px-4 md:mx-0 md:px-0 rounded-b-2xl md:rounded-none">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                        <button onClick={() => navigate('/history')} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium mb-2 text-sm">
                            <ArrowLeft className="w-4 h-4" /> Volver al Historial
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                                <FileText className="w-8 h-8 md:w-6 md:h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white truncate">Importación #{id}</h1>
                                <div className="flex items-center gap-2 mt-1 w-full max-w-[200px]">
                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${stats.progress}%` }}></div>
                                    </div>
                                    <span className="font-bold text-green-600 text-xs">{stats.progress}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {successMsg && <span className="text-green-600 dark:text-green-400 text-xs font-bold animate-pulse flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg whitespace-nowrap"><CheckCircle2 className="w-4 h-4" /> {successMsg}</span>}
                        <button onClick={handleSave} disabled={saving} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base">
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <span className="text-gray-400 mr-2 hidden md:block"><ListFilter className="w-5 h-5" /></span>
                    <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filter === 'all' ? 'bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>Todos <span className="opacity-60">({stats.totalItems})</span></button>
                    <button onClick={() => setFilter('missing')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filter === 'missing' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' : 'bg-white text-gray-500 border-gray-300 hover:bg-orange-50 hover:text-orange-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}><AlertTriangle className="w-3 h-3" />Faltan Precio <span className="opacity-80">({stats.itemsMissing})</span></button>
                    <button onClick={() => setFilter('ready')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filter === 'ready' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' : 'bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}><CheckCircle2 className="w-3 h-3" />Listos <span className="opacity-80">({stats.itemsReady})</span></button>
                </div>
            </div>

            {displayedProducts.length === 0 ? (
                <div className="text-center py-20 text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No hay productos en esta categoría.</p>
                </div>
            ) : (
                <>
                    {/* VISTA MÓVIL OPTIMIZADA */}
                    <div className="md:hidden space-y-4 pt-2">
                        {displayedProducts.map(p => (
                            <BatchItemCard key={p.id} p={p} onPriceUpdate={handlePriceUpdate} onUpcUpdate={handleUpcUpdate} />
                        ))}
                    </div>

                    {/* VISTA ESCRITORIO OPTIMIZADA */}
                    <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase text-xs font-bold">
                                <tr>
                                    <th className="px-4 py-3 w-28">SKU</th>
                                    <th className="px-4 py-3 w-36">Cód. Barras</th>
                                    <th className="px-4 py-3">Producto</th>
                                    <th className="px-4 py-3 text-right">Costo</th>
                                    <th className="px-4 py-3 text-center w-40">Precio Venta</th>
                                    <th className="px-4 py-3 text-center w-20">Margen</th>
                                    <th className="px-4 py-3 text-center w-16">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {displayedProducts.map(p => (
                                    <BatchItemRow key={p.id} p={p} onPriceUpdate={handlePriceUpdate} onUpcUpdate={handleUpcUpdate} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}