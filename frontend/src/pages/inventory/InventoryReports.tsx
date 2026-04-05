import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeft,
    Package,
    Search,
    ChevronLeft,
    ChevronRight,
    Activity,
} from 'lucide-react';
import { API_URL } from '../../config/api';

interface StockHistoryItem {
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    change_type: string;
    old_value: number;
    new_value: number;
    diff: number;
    source: string;
    date: string;
}

interface Summary {
    total_products: number;
    movements_today: number;
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    ENTRADA: { label: 'Entrada', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
    AJUSTE: { label: 'Ajuste', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
    MERGE: { label: 'Fusión', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' },
};

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export function InventoryReports() {
    const navigate = useNavigate();

    const [summary, setSummary] = useState<Summary | null>(null);
    const [items, setItems] = useState<StockHistoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [loading, setLoading] = useState(false);

    const PAGE_SIZE = 50;

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(0); }, [debouncedQ]);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/inventory/reports/summary`);
            setSummary({ total_products: res.data.total_products, movements_today: res.data.movements_today });
        } catch { /* silent */ }
    }, []);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/inventory/reports/stock-history`, {
                params: { q: debouncedQ || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
            });
            setItems(res.data.items);
            setTotal(res.data.total);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedQ, page]);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 pb-28 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <button
                    onClick={() => navigate('/inventory')}
                    className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Reportes</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Historial de movimientos de existencias.</p>
                </div>
                {summary && (
                    <div className="hidden sm:flex items-center gap-3">
                        <StatPill icon={<Package className="w-3.5 h-3.5" />} label="Productos" value={summary.total_products.toLocaleString()} color="blue" />
                        <StatPill icon={<Activity className="w-3.5 h-3.5" />} label="Hoy" value={summary.movements_today.toLocaleString()} color="amber" />
                    </div>
                )}
            </div>

            {/* Stats en mobile */}
            {summary && (
                <div className="flex sm:hidden gap-3 mb-4">
                    <StatPill icon={<Package className="w-3.5 h-3.5" />} label="Productos" value={summary.total_products.toLocaleString()} color="blue" />
                    <StatPill icon={<Activity className="w-3.5 h-3.5" />} label="Hoy" value={summary.movements_today.toLocaleString()} color="amber" />
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent overflow-hidden">
                {/* Barra de búsqueda */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar producto o SKU..."
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 tabular-nums">{total.toLocaleString()} registros</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
                                <th className="px-4 py-3 font-semibold">Producto</th>
                                <th className="px-4 py-3 font-semibold">Tipo</th>
                                <th className="px-4 py-3 font-semibold text-right">Anterior</th>
                                <th className="px-4 py-3 font-semibold text-right">Nuevo</th>
                                <th className="px-4 py-3 font-semibold text-right">Diferencia</th>
                                <th className="px-4 py-3 font-semibold hidden md:table-cell">Fuente</th>
                                <th className="px-4 py-3 font-semibold">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center text-gray-400 text-sm">Cargando...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center">
                                        <div className="flex flex-col items-center gap-2 text-gray-400">
                                            <Activity className="w-8 h-8 opacity-30" />
                                            <span className="text-sm">Sin movimientos registrados aún</span>
                                            <span className="text-xs">Los movimientos aparecerán aquí al importar facturas o agregar productos</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map(item => {
                                    const typeInfo = CHANGE_TYPE_LABELS[item.change_type] ?? { label: item.change_type, color: 'text-gray-500 bg-gray-100' };
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[200px]">{item.product_name}</div>
                                                {item.sku && <div className="text-xs text-gray-400">{item.sku}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                                                    {typeInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">{item.old_value}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-100 tabular-nums">{item.new_value}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                <span className={`font-bold ${item.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : item.diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {item.diff > 0 ? '+' : ''}{item.diff}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[140px] hidden md:table-cell">{item.source || '—'}</td>
                                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(item.date)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="flex items-center gap-1 text-sm font-medium text-gray-500 disabled:opacity-40 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        <span className="text-xs text-gray-400">Página {page + 1} de {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="flex items-center gap-1 text-sm font-medium text-gray-500 disabled:opacity-40 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                            Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-500 dark:text-blue-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-500 dark:text-amber-400' },
};

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${c.bg}`}>
            <span className={c.icon}>{icon}</span>
            <span className={`text-xs font-semibold ${c.text}`}>{label}: <span className="font-black">{value}</span></span>
        </div>
    );
}
