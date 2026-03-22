import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Truck, Plus, Edit3, Trash2, X, Loader2, CheckCircle2, AlertTriangle,
    Search, Package, Square, CheckSquare, ChevronLeft, Tag, Barcode
} from 'lucide-react';
import { API_URL } from '../../config/api';
import { TOAST_DURATION } from '../../config/constants';

interface Supplier {
    id: number;
    rfc: string;
    name: string;
    product_count: number;
    created_at: string;
}

interface SupplierProduct {
    id: number;
    name: string;
    alias: string;
    sku: string;
    upc: string;
    price: number;
    selling_price: number;
    stock: number;
}

interface SupplierDetail {
    id: number;
    rfc: string;
    name: string;
    created_at: string;
    products: SupplierProduct[];
    product_count: number;
}

interface UnassignedProduct {
    id: number;
    name: string;
    sku: string;
    price: number;
}

export function Suppliers() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // Vista detalle
    const [detail, setDetail] = useState<SupplierDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailSearch, setDetailSearch] = useState('');

    // Modal CRUD
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ rfc: '', name: '' });
    const [processing, setProcessing] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Modal asignación masiva
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkSupplierId, setBulkSupplierId] = useState<number | null>(null);
    const [bulkSupplierName, setBulkSupplierName] = useState('');
    const [unassignedProducts, setUnassignedProducts] = useState<UnassignedProduct[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
    const [searchUnassigned, setSearchUnassigned] = useState('');
    const [loadingUnassigned, setLoadingUnassigned] = useState(false);
    const [assigning, setAssigning] = useState(false);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), TOAST_DURATION);
    };

    // --- TOAST COMPONENT ---
    const Toast = () => (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
            <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="font-bold text-sm">{toast.message}</span>
            </div>
        </div>
    );

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/suppliers`);
            setSuppliers(res.data);
        } catch (err) {
            showToast("Error al cargar proveedores", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id: number) => {
        setLoadingDetail(true);
        setDetailSearch('');
        try {
            const res = await axios.get(`${API_URL}/suppliers/${id}`);
            setDetail(res.data);
        } catch (err) {
            showToast("Error al cargar detalle", "error");
        } finally {
            setLoadingDetail(false);
        }
    };

    useEffect(() => { fetchSuppliers(); }, []);

    // --- CRUD ---
    const openCreateModal = () => {
        setEditingId(null);
        setFormData({ rfc: '', name: '' });
        setShowFormModal(true);
    };

    const openEditModal = (s: Supplier) => {
        setEditingId(s.id);
        setFormData({ rfc: s.rfc || '', name: s.name });
        setShowFormModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            if (editingId) {
                await axios.put(`${API_URL}/suppliers/${editingId}`, formData);
                showToast("Proveedor actualizado");
            } else {
                await axios.post(`${API_URL}/suppliers`, formData);
                showToast("Proveedor creado");
            }
            setShowFormModal(false);
            fetchSuppliers();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error", "error");
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setProcessing(true);
        try {
            await axios.delete(`${API_URL}/suppliers/${deleteId}`);
            showToast("Proveedor eliminado");
            setDeleteId(null);
            fetchSuppliers();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error al eliminar", "error");
        } finally {
            setProcessing(false);
        }
    };

    // --- ASIGNACIÓN MASIVA ---
    const openBulkModal = (supplierId: number, supplierName: string) => {
        setBulkSupplierId(supplierId);
        setBulkSupplierName(supplierName);
        setSelectedProductIds(new Set());
        setSearchUnassigned('');
        setShowBulkModal(true);
        fetchUnassigned('');
    };

    const fetchUnassigned = async (q: string) => {
        setLoadingUnassigned(true);
        try {
            const res = await axios.get(`${API_URL}/suppliers/unassigned-products`, { params: q ? { q } : {} });
            setUnassignedProducts(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingUnassigned(false);
        }
    };

    useEffect(() => {
        if (!showBulkModal) return;
        const timer = setTimeout(() => fetchUnassigned(searchUnassigned), 300);
        return () => clearTimeout(timer);
    }, [searchUnassigned, showBulkModal]);

    const toggleProduct = (id: number) => {
        setSelectedProductIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedProductIds.size === unassignedProducts.length) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(unassignedProducts.map(p => p.id)));
        }
    };

    const handleBulkAssign = async () => {
        if (!bulkSupplierId || selectedProductIds.size === 0) return;
        setAssigning(true);
        try {
            await axios.post(`${API_URL}/suppliers/bulk-assign`, {
                product_ids: Array.from(selectedProductIds),
                supplier_id: bulkSupplierId,
            });
            showToast(`${selectedProductIds.size} productos asignados a ${bulkSupplierName}`);
            setShowBulkModal(false);
            fetchSuppliers();
            // Refresh detail if we're looking at this supplier
            if (detail && detail.id === bulkSupplierId) {
                fetchDetail(bulkSupplierId);
            }
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error", "error");
        } finally {
            setAssigning(false);
        }
    };

    // --- VISTA DETALLE DE PROVEEDOR ---
    if (detail) {
        const filtered = detailSearch
            ? detail.products.filter(p =>
                p.name.toLowerCase().includes(detailSearch.toLowerCase()) ||
                p.sku.toLowerCase().includes(detailSearch.toLowerCase()) ||
                p.alias.toLowerCase().includes(detailSearch.toLowerCase())
            )
            : detail.products;

        return (
            <div className="w-full max-w-6xl mx-auto p-2 md:p-6 pb-24 animate-fade-in">
                <Toast />

                {/* HEADER */}
                <div className="mb-6 px-2">
                    <button onClick={() => { setDetail(null); fetchSuppliers(); }} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors">
                        <ChevronLeft className="w-4 h-4" /> Volver a proveedores
                    </button>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <Truck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white">{detail.name}</h1>
                                    {detail.rfc && <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{detail.rfc}</p>}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => openBulkModal(detail.id, detail.name)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Asignar productos
                        </button>
                    </div>
                </div>

                {/* BUSCADOR */}
                {detail.products.length > 0 && (
                    <div className="mb-4 px-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar en productos de este proveedor..."
                                value={detailSearch}
                                onChange={(e) => setDetailSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-900 dark:text-white shadow-sm"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-2 px-1">
                            {filtered.length} de {detail.product_count} productos
                        </p>
                    </div>
                )}

                {/* LOADING */}
                {loadingDetail ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" /></div>
                ) : detail.products.length === 0 ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                        <Package className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-medium text-gray-400">Sin productos</p>
                        <p className="text-sm text-gray-400 mt-2">Asigna productos a este proveedor</p>
                    </div>
                ) : (
                    <div className="space-y-2 px-2 md:px-0">
                        {filtered.map((p) => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-transparent flex justify-between items-center">
                                <div className="flex-1 min-w-0 pr-3">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight mb-1 line-clamp-2">{p.name}</h3>
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        {p.sku && (
                                            <span className="bg-gray-100 dark:bg-gray-900 px-2 rounded font-mono flex items-center gap-1">
                                                <Barcode className="w-3 h-3" /> {p.sku}
                                            </span>
                                        )}
                                        {p.alias && (
                                            <span className="bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 rounded font-bold flex items-center gap-1">
                                                <Tag className="w-3 h-3" /> {p.alias}
                                            </span>
                                        )}
                                        <span>Costo: ${p.price.toFixed(2)}</span>
                                        <span>Stock: {p.stock}</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    {p.selling_price > 0 ? (
                                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">${p.selling_price.toFixed(2)}</span>
                                    ) : (
                                        <span className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-bold">Sin Precio</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* MODAL ASIGNACIÓN MASIVA (compartido) */}
                {showBulkModal && <BulkAssignModal />}
            </div>
        );
    }

    // --- VISTA LISTA ---
    return (
        <div className="w-full max-w-6xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
            <Toast />

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Proveedores</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona proveedores y asigna productos.</p>
                </div>
                <button onClick={openCreateModal} className="w-full md:w-auto bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-95">
                    <Plus className="w-5 h-5" /> Nuevo Proveedor
                </button>
            </div>

            {/* LISTA */}
            {loading ? (
                <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" /></div>
            ) : suppliers.length === 0 ? (
                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <Truck className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-xl font-medium text-gray-400">No hay proveedores</p>
                    <p className="text-sm text-gray-400 mt-2">Crea uno manualmente o sube una factura XML</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {suppliers.map((s) => (
                        <div
                            key={s.id}
                            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-transparent flex items-center gap-4 group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
                        >
                            {/* CLICKEABLE PARA IR AL DETALLE */}
                            <div
                                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                                onClick={() => fetchDetail(s.id)}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <Truck className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{s.name}</h3>
                                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {s.rfc && <span className="bg-gray-100 dark:bg-gray-900 px-2 rounded font-mono">{s.rfc}</span>}
                                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {s.product_count} productos</span>
                                    </div>
                                </div>
                            </div>

                            {/* ACCIONES */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openBulkModal(s.id, s.name)} title="Asignar productos" className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                                    <Package className="w-5 h-5" />
                                </button>
                                <button onClick={() => openEditModal(s)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                    <Edit3 className="w-5 h-5" />
                                </button>
                                <button onClick={() => setDeleteId(s.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL CREAR/EDITAR PROVEEDOR */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-scale-in">
                        <button onClick={() => setShowFormModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                {editingId ? <Edit3 className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Nombre <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Distribuidora SA de CV"
                                    className="w-full mt-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">RFC <span className="text-gray-300 dark:text-gray-600 font-normal text-[10px]">(opcional)</span></label>
                                <input
                                    type="text"
                                    value={formData.rfc}
                                    onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                                    placeholder="ABC123456XYZ"
                                    className="w-full mt-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900 dark:text-white uppercase"
                                />
                            </div>
                            <button type="submit" disabled={processing} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex justify-center gap-2 hover:bg-blue-700 transition-all">
                                {processing ? <Loader2 className="animate-spin w-5 h-5" /> : (editingId ? "Guardar" : "Crear")}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMAR BORRAR */}
            {deleteId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xs p-6 shadow-2xl text-center">
                        <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">¿Eliminar proveedor?</h3>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl">Cancelar</button>
                            <button onClick={handleDelete} disabled={processing} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl flex justify-center">
                                {processing ? <Loader2 className="animate-spin w-5 h-5" /> : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ASIGNACIÓN MASIVA */}
            {showBulkModal && <BulkAssignModal />}
        </div>
    );

    // --- MODAL ASIGNACIÓN MASIVA (EXTRAÍDO) ---
    function BulkAssignModal() {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl relative animate-scale-in flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
                        <button onClick={() => setShowBulkModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">Asignar productos a</h2>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">{bulkSupplierName}</p>

                        <div className="relative mt-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar productos sin proveedor..."
                                value={searchUnassigned}
                                onChange={(e) => setSearchUnassigned(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-1">
                        {loadingUnassigned ? (
                            <div className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 text-blue-600 mx-auto" /></div>
                        ) : unassignedProducts.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No hay productos sin proveedor</p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={toggleAll}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mb-2"
                                >
                                    {selectedProductIds.size === unassignedProducts.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    {selectedProductIds.size === unassignedProducts.length ? 'Deseleccionar todos' : `Seleccionar todos (${unassignedProducts.length})`}
                                </button>

                                {unassignedProducts.map((p) => (
                                    <div
                                        key={p.id}
                                        onClick={() => toggleProduct(p.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedProductIds.has(p.id) ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                    >
                                        {selectedProductIds.has(p.id) ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">{p.name}</p>
                                            <div className="flex gap-2 text-xs text-gray-400">
                                                {p.sku && <span className="font-mono">{p.sku}</span>}
                                                <span>${p.price.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
                        <button
                            onClick={handleBulkAssign}
                            disabled={assigning || selectedProductIds.size === 0}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition-all"
                        >
                            {assigning ? <Loader2 className="animate-spin w-5 h-5" /> : <><Package className="w-5 h-5" /> Asignar {selectedProductIds.size > 0 ? `${selectedProductIds.size} productos` : ''}</>}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
