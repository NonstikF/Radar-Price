import { useState, useEffect } from 'react';
import axios from 'axios';
import { Warehouse, Search, Truck, Package, Loader2, CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react';
import { API_URL } from '../../config/api';
import { TOAST_DURATION } from '../../config/constants';
import { PageHeader } from '../../components/ui/PageHeader';

interface SupplierSetting {
    id: number;
    name: string;
    rfc: string | null;
    product_count: number;
    manages_inventory: boolean;
}

export function Settings() {
    const [suppliers, setSuppliers] = useState<SupplierSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [search, setSearch] = useState('');
    // Proveedores con un cambio en curso: se bloquea su interruptor hasta que responda el servidor.
    const [pending, setPending] = useState<Set<number>>(new Set());
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), TOAST_DURATION);
    };

    const fetchSuppliers = async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const res = await axios.get(`${API_URL}/suppliers`);
            setSuppliers(res.data);
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSuppliers(); }, []);

    const setSupplierInventory = (id: number, enabled: boolean) =>
        setSuppliers(prev => prev.map(s => s.id === id ? { ...s, manages_inventory: enabled } : s));

    // Cambio optimista: el interruptor se mueve al instante y regresa si el servidor falla.
    const handleToggle = async (supplier: SupplierSetting) => {
        const enabled = !supplier.manages_inventory;
        setSupplierInventory(supplier.id, enabled);
        setPending(prev => new Set(prev).add(supplier.id));
        try {
            await axios.put(`${API_URL}/suppliers/${supplier.id}/inventory`, { enabled });
            showToast(enabled ? `Inventario activado para ${supplier.name}` : `Inventario desactivado para ${supplier.name}`);
        } catch (err) {
            setSupplierInventory(supplier.id, !enabled);
            const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
            showToast(detail || 'No se pudo guardar el cambio', 'error');
        } finally {
            setPending(prev => {
                const next = new Set(prev);
                next.delete(supplier.id);
                return next;
            });
        }
    };

    const query = search.trim().toLowerCase();
    const filtered = query
        ? suppliers.filter(s => s.name.toLowerCase().includes(query) || (s.rfc || '').toLowerCase().includes(query))
        : suppliers;
    const enabledCount = suppliers.filter(s => s.manages_inventory).length;

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

            <PageHeader parent="dashboard" title="Configuración" description="Ajustes generales del sistema." />

            <section aria-labelledby="inventory-settings-title" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                            <Warehouse className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h2 id="inventory-settings-title" className="text-lg font-bold text-gray-900 dark:text-white">Gestión de inventario por proveedor</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Solo los productos de los proveedores activados llevan existencia por ubicación y aparecen en Ubicaciones, Asignar productos y Reportes de inventario. Los productos sin proveedor quedan fuera.
                            </p>
                        </div>
                    </div>

                    {!loading && !loadError && suppliers.length > 0 && (
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {enabledCount} de {suppliers.length} {suppliers.length === 1 ? 'proveedor' : 'proveedores'} con inventario
                            </p>
                            <div className="relative sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" aria-hidden="true" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar proveedor o RFC"
                                    aria-label="Buscar proveedor o RFC"
                                    className="w-full min-h-11 pl-9 pr-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="py-16 text-center"><Loader2 className="animate-spin h-7 w-7 text-blue-600 mx-auto" aria-label="Cargando proveedores" /></div>
                ) : loadError ? (
                    <div className="py-12 px-6 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">No se pudieron cargar los proveedores.</p>
                        <button type="button" onClick={fetchSuppliers} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <RotateCw className="w-4 h-4" aria-hidden="true" /> Reintentar
                        </button>
                    </div>
                ) : suppliers.length === 0 ? (
                    <div className="py-12 px-6 text-center text-gray-500 dark:text-gray-400">
                        <Truck className="w-10 h-10 mx-auto mb-3 opacity-50" aria-hidden="true" />
                        <p className="text-sm">Todavía no hay proveedores. Se crean al importar una factura XML o desde Proveedores.</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <p className="py-12 px-6 text-center text-sm text-gray-500 dark:text-gray-400">Ningún proveedor coincide con "{search}".</p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filtered.map((s) => {
                            const busy = pending.has(s.id);
                            return (
                                <li key={s.id} className="flex items-center gap-4 px-5 md:px-6 py-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                            {s.rfc && <span className="font-mono">{s.rfc}</span>}
                                            <span className="flex items-center gap-1"><Package className="w-3 h-3" aria-hidden="true" /> {s.product_count} {s.product_count === 1 ? 'producto' : 'productos'}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={s.manages_inventory}
                                        aria-label={`Gestión de inventario de ${s.name}`}
                                        disabled={busy}
                                        onClick={() => handleToggle(s)}
                                        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
                                    >
                                        <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${s.manages_inventory ? 'bg-amber-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${s.manages_inventory ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
