import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Package,
    AlertTriangle,
    BarChart3,
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
    cost_value: number;
    sale_value: number;
    no_price: number;
    negative_margin: number;
    no_stock: number;
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

function formatCurrency(val: number) {
    return val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
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

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q), 400);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        setPage(0);
    }, [debouncedQ]);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/inventory/reports/summary`);
            setSummary(res.data);
        } catch {
            // silent
        }
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
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-28 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate('/inventory')}
                    className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Reportes</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Historial de existencias y resumen de inventario.</p>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <SummaryCard
                        icon={<Package className="w-5 h-5" />}
                        label="Productos"
                        value={summary.total_products.toLocaleString()}
                        color="blue"
                    />
                    <SummaryCard
                        icon={<BarChart3 className="w-5 h-5" />}
                        label="Valor (costo)"
                        value={formatCurrency(summary.cost_value)}
                        color="emerald"
                    />
                    <SummaryCard
                        icon={<TrendingUp className="w-5 h-5" />}
                        label="Valor (venta)"
                        value={formatCurrency(summary.sale_value)}
                        color="indigo"
                    />
                    <SummaryCard
                        icon={<Activity className="w-5 h-5" />}
                        label="Movimientos hoy"
                        value={summary.movements_today.toLocaleString()}
                        color="amber"
                    />
                    <SummaryCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        label="Sin precio venta"
                        value={summary.no_price.toLocaleString()}
                        color="orange"
                    />
                    <SummaryCard
                        icon={<TrendingDown className="w-5 h-5" />}
                        label="Margen negativo"
                        value={summary.negative_margin.toLocaleString()}
                        color="red"
                    />
                    <SummaryCard
                        icon={<Package className="w-5 h-5" />}
                        label="Sin stock"
                        value={summary.no_stock.toLocaleString()}
                        color="gray"
                    />
                </div>
            )}

            {/* History Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-3">
                    <h2 className="font-bold text-gray-800 dark:text-gray-100 text-base shrink-0">Historial de Existencias</h2>
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
                    <span className="text-xs text-gray-400 shrink-0">{total.toLocaleString()} registros</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                <th className="px-4 py-3 font-semibold">Producto</th>
                                <th className="px-4 py-3 font-semibold">Tipo</th>
                                <th className="px-4 py-3 font-semibold text-right">Anterior</th>
                                <th className="px-4 py-3 font-semibold text-right">Nuevo</th>
                                <th className="px-4 py-3 font-semibold text-right">Diferencia</th>
                                <th className="px-4 py-3 font-semibold">Fuente</th>
                                <th className="px-4 py-3 font-semibold">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">Cargando...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">Sin registros</td>
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
                                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{item.old_value}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{item.new_value}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-bold ${item.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : item.diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {item.diff > 0 ? '+' : ''}{item.diff}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[140px]">{item.source || '—'}</td>
                                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(item.date)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="flex items-center gap-1 text-sm font-medium text-gray-500 disabled:opacity-40 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        <span className="text-xs text-gray-400">
                            Página {page + 1} de {totalPages}
                        </span>
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

const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: 'text-indigo-600 dark:text-indigo-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-600 dark:text-orange-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400' },
    gray: { bg: 'bg-gray-100 dark:bg-gray-700/40', icon: 'text-gray-500 dark:text-gray-400' },
};

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const c = COLOR_MAP[color] ?? COLOR_MAP.gray;
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-transparent flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center ${c.icon} shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
                <div className="font-black text-gray-900 dark:text-white text-base leading-tight truncate">{value}</div>
            </div>
        </div>
    );
}
