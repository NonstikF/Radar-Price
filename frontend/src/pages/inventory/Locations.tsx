import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    MapPin, Plus, Edit3, Trash2, X, Loader2, CheckCircle2, AlertTriangle,
    Search, Package, ChevronLeft, Tag, Barcode, QrCode, UserMinus
} from 'lucide-react';
import { BarcodeScanner } from '../../components/ui/BarcodeScanner';
import { API_URL } from '../../config/api';
import { TOAST_DURATION } from '../../config/constants';

interface LocationItem {
    id: number;
    code: string;
    description: string | null;
    product_count: number;
    created_at: string;
}

interface LocationProduct {
    id: number;
    product_id: number;
    name: string;
    sku: string;
    alias: string;
    price: number;
    selling_price: number;
    quantity: number;
}

interface LocationDetail {
    id: number;
    code: string;
    description: string | null;
    created_at: string;
    products: LocationProduct[];
    product_count: number;
}

interface SearchProduct {
    id: number;
    name: string;
    sku: string;
    price: number;
    already_in_location: boolean;
}

export function Locations() {
    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // Vista detalle
    const [detail, setDetail] = useState<LocationDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailSearch, setDetailSearch] = useState('');

    // Modal CRUD
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ code: '', description: '' });
    const [processing, setProcessing] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Scanner QR
    const [showScanner, setShowScanner] = useState(false);

    // Modal agregar producto
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [addingProductId, setAddingProductId] = useState<number | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), TOAST_DURATION);
    };

    const Toast = () => (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
            <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="font-bold text-sm">{toast.message}</span>
            </div>
        </div>
    );

    // --- FETCH ---
    const fetchLocations = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/locations`);
            setLocations(res.data);
        } catch {
            showToast("Error al cargar ubicaciones", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id: number) => {
        setLoadingDetail(true);
        setDetailSearch('');
        try {
            const res = await axios.get(`${API_URL}/locations/${id}`);
            setDetail(res.data);
        } catch {
            showToast("Error al cargar detalle", "error");
        } finally {
            setLoadingDetail(false);
        }
    };

    useEffect(() => { fetchLocations(); }, []);

    // Búsqueda con debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!searchTerm.trim()) {
                fetchLocations();
                return;
            }
            setLoading(true);
            try {
                const res = await axios.get(`${API_URL}/locations/search`, { params: { q: searchTerm } });
                setLocations(res.data);
            } catch {
                showToast("Error en búsqueda", "error");
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Búsqueda productos para agregar
    useEffect(() => {
        if (!showAddProduct || !detail) return;
        const timer = setTimeout(async () => {
            setLoadingSearch(true);
            try {
                const res = await axios.get(`${API_URL}/locations/search-products`, {
                    params: { q: productSearch || undefined, location_id: detail.id },
                });
                setSearchResults(res.data);
            } catch {
                console.error("Error buscando productos");
            } finally {
                setLoadingSearch(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [productSearch, showAddProduct]);

    // --- QR SCAN ---
    const handleScan = async (code: string) => {
        setShowScanner(false);
        try {
            const res = await axios.get(`${API_URL}/locations/by-code/${encodeURIComponent(code)}`);
            fetchDetail(res.data.id);
        } catch {
            showToast(`Ubicación "${code}" no encontrada`, "error");
            setSearchTerm(code);
        }
    };

    // --- CRUD ---
    const openCreateModal = () => {
        setEditingId(null);
        setFormData({ code: '', description: '' });
        setShowFormModal(true);
    };

    const openEditModal = (loc: LocationItem) => {
        setEditingId(loc.id);
        setFormData({ code: loc.code, description: loc.description || '' });
        setShowFormModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            if (editingId) {
                await axios.put(`${API_URL}/locations/${editingId}`, formData);
                showToast("Ubicación actualizada");
            } else {
                await axios.post(`${API_URL}/locations`, formData);
                showToast("Ubicación creada");
            }
            setShowFormModal(false);
            fetchLocations();
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
            await axios.delete(`${API_URL}/locations/${deleteId}`);
            showToast("Ubicación eliminada");
            setDeleteId(null);
            fetchLocations();
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error al eliminar", "error");
        } finally {
            setProcessing(false);
        }
    };

    // --- PRODUCTOS EN UBICACIÓN ---
    const handleAddProduct = async (productId: number) => {
        if (!detail) return;
        setAddingProductId(productId);
        try {
            await axios.post(`${API_URL}/locations/${detail.id}/products`, {
                product_id: productId,
                quantity: 1,
            });
            showToast("Producto agregado");
            fetchDetail(detail.id);
            setProductSearch(prev => prev + '');
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error", "error");
        } finally {
            setAddingProductId(null);
        }
    };

    const handleRemoveProduct = async (productId: number) => {
        if (!detail) return;
        try {
            await axios.delete(`${API_URL}/locations/${detail.id}/products/${productId}`);
            showToast("Producto removido");
            setDetail({
                ...detail,
                products: detail.products.filter(p => p.product_id !== productId),
                product_count: detail.product_count - 1,
            });
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error", "error");
        }
    };

    // --- MODAL AGREGAR PRODUCTO (JSX variable) ---
    const addProductModalContent = showAddProduct && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl relative animate-scale-in flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
                    <button onClick={() => { setShowAddProduct(false); setProductSearch(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Agregar producto a</h2>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-mono font-bold">{detail.code}</p>

                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {loadingSearch ? (
                        <div className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 text-blue-600 mx-auto" /></div>
                    ) : searchResults.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No se encontraron productos</p>
                        </div>
                    ) : (
                        searchResults.map((p) => (
                            <div
                                key={p.id}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${p.already_in_location ? 'bg-green-50 dark:bg-green-900/10 opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">{p.name}</p>
                                    <div className="flex gap-2 text-xs text-gray-400">
                                        {p.sku && <span className="font-mono">{p.sku}</span>}
                                        <span>${p.price.toFixed(2)}</span>
                                    </div>
                                </div>
                                {p.already_in_location ? (
                                    <span className="text-xs font-bold text-green-600 dark:text-green-400 px-2">Ya agregado</span>
                                ) : (
                                    <button
                                        onClick={() => handleAddProduct(p.id)}
                                        disabled={addingProductId === p.id}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {addingProductId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    // --- VISTA DETALLE ---
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
                    <button onClick={() => { setDetail(null); fetchLocations(); }} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors">
                        <ChevronLeft className="w-4 h-4" /> Volver a ubicaciones
                    </button>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white font-mono">{detail.code}</h1>
                                    {detail.description && <p className="text-sm text-gray-500 dark:text-gray-400">{detail.description}</p>}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => { setShowAddProduct(true); setProductSearch(''); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Agregar productos
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
                                placeholder="Buscar en productos de esta ubicación..."
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

                {/* CONTENIDO */}
                {loadingDetail ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" /></div>
                ) : detail.products.length === 0 ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                        <Package className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-medium text-gray-400">Sin productos</p>
                        <p className="text-sm text-gray-400 mt-2">Agrega productos a esta ubicación</p>
                    </div>
                ) : (
                    <div className="space-y-2 px-2 md:px-0">
                        {filtered.map((p) => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-transparent flex justify-between items-center group">
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
                                        <span className="bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-2 rounded font-bold">
                                            Qty: {p.quantity}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleRemoveProduct(p.product_id)}
                                        title="Quitar de esta ubicación"
                                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors md:opacity-0 md:group-hover:opacity-100"
                                    >
                                        <UserMinus className="w-4 h-4" />
                                    </button>
                                    <div className="text-right">
                                        {p.selling_price > 0 ? (
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">${p.selling_price.toFixed(2)}</span>
                                        ) : (
                                            <span className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-bold">Sin Precio</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {addProductModalContent}
                {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
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
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Ubicaciones</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona ubicaciones de inventario.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => setShowScanner(true)} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95">
                        <QrCode className="w-5 h-5" /> Escanear QR
                    </button>
                    <button onClick={openCreateModal} className="flex-1 md:flex-none bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg active:scale-95">
                        <Plus className="w-5 h-5" /> Nueva Ubicación
                    </button>
                </div>
            </div>

            {/* BUSCADOR */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar ubicación (ej: R1B2)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-900 dark:text-white shadow-sm"
                    />
                </div>
            </div>

            {/* LISTA */}
            {loading ? (
                <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto" /></div>
            ) : locations.length === 0 ? (
                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <MapPin className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-xl font-medium text-gray-400">No hay ubicaciones</p>
                    <p className="text-sm text-gray-400 mt-2">Crea una nueva o escanea un QR</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {locations.map((loc) => (
                        <div
                            key={loc.id}
                            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-transparent flex items-center gap-4 group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
                        >
                            <div
                                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                                onClick={() => fetchDetail(loc.id)}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-gray-800 dark:text-gray-100 text-base font-mono leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{loc.code}</h3>
                                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {loc.description && <span className="truncate max-w-[200px]">{loc.description}</span>}
                                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {loc.product_count} productos</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEditModal(loc)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                    <Edit3 className="w-5 h-5" />
                                </button>
                                <button onClick={() => setDeleteId(loc.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL CREAR/EDITAR */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-scale-in">
                        <button onClick={() => setShowFormModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                {editingId ? <Edit3 className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">{editingId ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Código <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="R1B2"
                                    className="w-full mt-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-gray-900 dark:text-white uppercase"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Descripción <span className="text-gray-300 dark:text-gray-600 font-normal text-[10px]">(opcional)</span></label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Rack 1, Balda 2"
                                    className="w-full mt-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 dark:text-white"
                                />
                            </div>
                            <button type="submit" disabled={processing} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl flex justify-center gap-2 hover:bg-indigo-700 transition-all">
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">¿Eliminar ubicación?</h3>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl">Cancelar</button>
                            <button onClick={handleDelete} disabled={processing} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl flex justify-center">
                                {processing ? <Loader2 className="animate-spin w-5 h-5" /> : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCANNER QR */}
            {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
        </div>
    );
}
