import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Loader2, CheckCircle2, AlertTriangle, PackageOpen, MapPin, Clock } from 'lucide-react';
import { API_URL } from '../../config/api';
import { DEBOUNCE_DELAY, TOAST_DURATION } from '../../config/constants';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProductShelvesModal, type Shelf } from '../../components/modals/ProductShelvesModal';

interface StockItem {
    id: number;
    name: string;
    sku: string;
    alias: string;
    supplier_name: string;
    stock: number;
    reserved: number;
    locations: Shelf[];
}

type Availability = 'all' | 'in' | 'out';

const AVAILABILITY: { id: Availability; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'in', label: 'Con existencia' },
    { id: 'out', label: 'Sin existencia' },
];

const PAGE_SIZE = 50;

// Consulta del inventario del almacén. Las piezas viven en las ubicaciones:
// la existencia es lo que hay en estantes menos lo apartado en pedidos, y se
// corrige desde las ubicaciones de cada producto.
export function StockAdjust() {
    const [availability, setAvailability] = useState<Availability>('all');
    const [items, setItems] = useState<StockItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<StockItem | null>(null);
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

    const updateItem = (id: number, locations: Shelf[], stock: number) =>
        setItems(prev => prev.map(i => i.id === id ? { ...i, locations, stock } : i));

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
                description="Piezas de cada producto por ubicación. Toca Ubicaciones para acomodar, contar o mover piezas."
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
                                    <div className="flex flex-wrap gap-1 mt-1.5" aria-label="Piezas por ubicación">
                                        {item.locations.length === 0 && (
                                            <span className="rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">Sin ubicación</span>
                                        )}
                                        {item.locations.map(loc => (
                                            <span key={loc.location_id} className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                                <MapPin className="w-3 h-3" aria-hidden="true" />{loc.code} <span className="font-mono">({loc.quantity})</span>
                                            </span>
                                        ))}
                                        {item.reserved > 0 && (
                                            <span title="Piezas en pedidos activos: siguen en el estante hasta surtir" className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                                                <Clock className="w-3 h-3" aria-hidden="true" />Apartadas: {item.reserved}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`text-xl font-black tabular-nums ${item.stock > 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>{item.stock}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">disponibles</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditing(item)}
                                    aria-label={`Ubicaciones de ${item.name}`}
                                    className="min-h-11 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-600 px-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <MapPin className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Ubicaciones</span>
                                </button>
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
                <ProductShelvesModal
                    product={editing}
                    onClose={() => setEditing(null)}
                    onChange={(locations, stock) => updateItem(editing.id, locations, stock)}
                    onMessage={showToast}
                />
            )}
        </div>
    );
}
