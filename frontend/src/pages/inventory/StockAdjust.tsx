import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Loader2, CheckCircle2, AlertTriangle, X, PackageOpen, SlidersHorizontal, MapPin } from 'lucide-react';
import { API_URL } from '../../config/api';
import { DEBOUNCE_DELAY, TOAST_DURATION } from '../../config/constants';
import { PageHeader } from '../../components/ui/PageHeader';
import { canAccess, getSessionUser } from '../../lib/permissions';

interface StockItem {
    id: number;
    name: string;
    sku: string;
    alias: string;
    supplier_name: string;
    stock: number;
    locations: { code: string; quantity: number }[];
}

type Availability = 'all' | 'in' | 'out';

const AVAILABILITY: { id: Availability; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'in', label: 'Con existencia' },
    { id: 'out', label: 'Sin existencia' },
];

type Mode = 'set' | 'add' | 'subtract';

const MODES: { id: Mode; label: string; hint: string }[] = [
    { id: 'set', label: 'Conteo', hint: 'La existencia queda en la cantidad contada.' },
    { id: 'add', label: 'Entrada', hint: 'Suma piezas que llegaron sin factura.' },
    { id: 'subtract', label: 'Salida', hint: 'Resta mermas, daños o piezas que salieron.' },
];

const PAGE_SIZE = 50;

const errorDetail = (err: unknown, fallback: string) =>
    (axios.isAxiosError(err) && err.response?.data?.detail) || fallback;

// Consulta del inventario del almacén: cualquiera con permiso de inventario ve
// existencias y ubicaciones; solo el admin puede ajustar.
export function StockAdjust() {
    const canAdjust = canAccess(getSessionUser(), 'admin');
    const [availability, setAvailability] = useState<Availability>('all');
    const [items, setItems] = useState<StockItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<StockItem | null>(null);
    const [mode, setMode] = useState<Mode>('set');
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), TOAST_DURATION);
    };

    const fetchPage = async (q: string, offset: number) => {
        const res = await axios.get(`${API_URL}/inventory/stock`, { params: { q: q || undefined, availability, limit: PAGE_SIZE, offset } });
        return res.data as { total: number; items: StockItem[] };
    };

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const data = await fetchPage(search.trim(), 0);
                setItems(data.items);
                setTotal(data.total);
            } catch {
                showToast('No se pudieron cargar las existencias', 'error');
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_DELAY);
        return () => clearTimeout(timer);
    }, [search, availability]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const data = await fetchPage(search.trim(), items.length);
            setItems(prev => [...prev, ...data.items]);
        } catch {
            showToast('No se pudieron cargar más productos', 'error');
        } finally {
            setLoadingMore(false);
        }
    };

    const openAdjust = (item: StockItem) => {
        setEditing(item);
        setMode('set');
        setQuantity(String(item.stock));
        setNote('');
    };

    const qty = parseInt(quantity);
    const validQty = !isNaN(qty) && qty >= 0;
    const result = !editing || !validQty ? null
        : mode === 'set' ? qty : mode === 'add' ? editing.stock + qty : editing.stock - qty;
    const invalid = result === null || result < 0 || (mode !== 'set' && qty === 0);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing || invalid) return;
        setSaving(true);
        try {
            const res = await axios.post(`${API_URL}/inventory/stock/${editing.id}/adjust`, { mode, quantity: qty, note: note.trim() || null });
            setItems(prev => prev.map(i => i.id === editing.id ? { ...i, stock: res.data.stock } : i));
            showToast(`${editing.name}: existencia en ${res.data.stock}`);
            setEditing(null);
        } catch (err) {
            showToast(errorDetail(err, 'No se pudo guardar el ajuste'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
            <div role="status" aria-live="polite" className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                {toast.show && (
                    <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        <span className="font-bold text-sm">{toast.message}</span>
                    </div>
                )}
            </div>

            <PageHeader
                parent="inventory"
                title="Consultar inventario"
                description={canAdjust
                    ? 'Existencias y ubicaciones del almacén. Ajusta con conteos físicos, entradas sin factura y mermas.'
                    : 'Existencias y ubicaciones de los productos del almacén.'}
            />

            <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" aria-hidden="true" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, SKU o código de barras"
                    aria-label="Buscar producto del almacén"
                    className="w-full min-h-12 pl-10 pr-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-900 dark:text-white shadow-sm"
                />
            </div>

            <div role="radiogroup" aria-label="Filtrar por existencia" className="flex flex-wrap gap-2 mb-4">
                {AVAILABILITY.map(a => (
                    <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={availability === a.id}
                        onClick={() => setAvailability(a.id)}
                        className={`min-h-10 px-4 rounded-full text-sm font-semibold transition-colors ${availability === a.id ? 'bg-amber-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        {a.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" aria-label="Cargando existencias" /></div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 px-6 text-gray-500 dark:text-gray-400 flex flex-col items-center">
                    <PackageOpen className="w-12 h-12 mb-3 opacity-50" aria-hidden="true" />
                    <p className="font-medium">
                        {search ? `Ningún producto del almacén coincide con "${search}".`
                            : availability === 'in' ? 'No hay productos con existencia.'
                            : availability === 'out' ? 'Todos los productos del almacén tienen existencia.'
                            : 'No hay productos en el almacén.'}
                    </p>
                    {!search && availability === 'all' && <p className="text-sm mt-1">Activa la gestión de inventario de un proveedor en Configuración.</p>}
                </div>
            ) : (
                <>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">{items.length} de {total} productos</p>
                    <ul className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {items.map(item => (
                            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight line-clamp-2">{item.alias || item.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                        {item.sku && <span className="font-mono">{item.sku} · </span>}{item.supplier_name}
                                    </p>
                                    {(() => {
                                        // Diferencia entre la existencia y lo que está en ubicaciones
                                        const located = item.locations.reduce((sum, loc) => sum + loc.quantity, 0);
                                        const unlocated = item.stock - located;
                                        if (item.locations.length === 0 && unlocated <= 0) return null;
                                        return (
                                            <div className="flex flex-wrap gap-1 mt-1.5" aria-label="Ubicaciones">
                                                {item.locations.map(loc => (
                                                    <span key={loc.code} className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                                        <MapPin className="w-3 h-3" aria-hidden="true" />{loc.code} <span className="font-mono">({loc.quantity})</span>
                                                    </span>
                                                ))}
                                                {unlocated > 0 && (
                                                    <span className="rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">Sin ubicar: {unlocated}</span>
                                                )}
                                                {unlocated < 0 && (
                                                    <span title="Hay más piezas en ubicaciones que en existencia; revisa el conteo" className="rounded-md bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400">{-unlocated} de más en ubicaciones</span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`text-xl font-black tabular-nums ${item.stock > 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>{item.stock}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">piezas</p>
                                </div>
                                {canAdjust && <button
                                    type="button"
                                    onClick={() => openAdjust(item)}
                                    aria-label={`Ajustar existencia de ${item.name}`}
                                    className="min-h-11 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-600 px-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Ajustar
                                </button>}
                            </li>
                        ))}
                    </ul>
                    {items.length < total && (
                        <button type="button" onClick={loadMore} disabled={loadingMore} className="mt-4 w-full min-h-11 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2">
                            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />} Cargar más
                        </button>
                    )}
                </>
            )}

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setEditing(null)}>
                    <form
                        onSubmit={handleSave}
                        onClick={(e) => e.stopPropagation()}
                        aria-labelledby="adjust-title"
                        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-scale-in space-y-4"
                    >
                        <button type="button" onClick={() => setEditing(null)} aria-label="Cerrar" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="pr-10">
                            <h2 id="adjust-title" className="text-lg font-black text-gray-900 dark:text-white leading-tight">{editing.alias || editing.name}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Existencia actual: <span className="font-bold tabular-nums">{editing.stock}</span></p>
                        </div>

                        <div role="radiogroup" aria-label="Tipo de ajuste" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900">
                            {MODES.map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={mode === m.id}
                                    onClick={() => { setMode(m.id); setQuantity(m.id === 'set' ? String(editing.stock) : ''); }}
                                    className={`min-h-10 rounded-lg text-sm font-bold transition-colors ${mode === m.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">{MODES.find(m => m.id === mode)?.hint}</p>

                        <div>
                            <label htmlFor="adjust-qty" className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{mode === 'set' ? 'Piezas contadas' : 'Piezas'}</label>
                            <input
                                id="adjust-qty"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                autoFocus
                                className="w-full mt-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-2xl font-black text-center tabular-nums text-gray-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label htmlFor="adjust-note" className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Motivo <span className="font-normal normal-case">(opcional)</span></label>
                            <input
                                id="adjust-note"
                                type="text"
                                maxLength={200}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={mode === 'subtract' ? 'Ej. 2 macetas rotas' : mode === 'add' ? 'Ej. Devolución de cliente' : 'Ej. Conteo de fin de mes'}
                                className="w-full mt-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-white"
                            />
                        </div>

                        <p className={`text-sm font-semibold ${result !== null && result < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                            {result === null ? 'Escribe una cantidad.' : result < 0 ? `Solo hay ${editing.stock} piezas para restar.` : `Quedará en ${result} piezas.`}
                        </p>

                        <button type="submit" disabled={saving || invalid} className="w-full min-h-12 bg-blue-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors">
                            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : 'Guardar ajuste'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
