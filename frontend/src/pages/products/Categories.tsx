import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Tag, Plus, Edit3, Trash2, X, Loader2, CheckCircle2, AlertTriangle,
    Search, Package, MapPin, ArrowLeft
} from 'lucide-react';
import { API_URL } from '../../config/api';
import { TOAST_DURATION } from '../../config/constants';

interface CategoryItem {
    id: number;
    name: string;
    description: string | null;
    color: string;
    product_count: number;
}

interface CategoryProduct {
    id: number;
    product_id: number;
    name: string;
    sku: string;
    upc: string;
    alias: string;
    image_url: string;
    price: number;
    selling_price: number;
    locations: { code: string; quantity: number }[];
}

interface CategoryDetail {
    id: number;
    name: string;
    description: string | null;
    color: string;
    products: CategoryProduct[];
    product_count: number;
}

interface SearchProduct {
    id: number;
    name: string;
    sku: string;
    upc: string;
    price: number;
    selling_price: number;
    image_url: string;
    already_in_category: boolean;
}

const COLORS = [
    { key: 'blue', label: 'Azul', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    { key: 'red', label: 'Rojo', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
    { key: 'green', label: 'Verde', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
    { key: 'amber', label: 'Amarillo', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
    { key: 'purple', label: 'Morado', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
    { key: 'pink', label: 'Rosa', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
    { key: 'indigo', label: 'Indigo', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
    { key: 'teal', label: 'Teal', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
];

const getColor = (key: string) => COLORS.find(c => c.key === key) || COLORS[0];

export function Categories() {
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    const [detail, setDetail] = useState<CategoryDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [showFormModal, setShowFormModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '', color: 'blue' });
    const [processing, setProcessing] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const [showAddProduct, setShowAddProduct] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);

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

    useEffect(() => { fetchCategories(); }, []);

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/categories`);
            setCategories(data);
        } catch { showToast('Error al cargar categorías', 'error'); }
        finally { setLoading(false); }
    };

    const openDetail = async (id: number) => {
        setLoadingDetail(true);
        try {
            const { data } = await axios.get(`${API_URL}/categories/${id}`);
            setDetail(data);
        } catch { showToast('Error al cargar detalle', 'error'); }
        finally { setLoadingDetail(false); }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;
        setProcessing(true);
        try {
            if (editingId) {
                await axios.put(`${API_URL}/categories/${editingId}`, formData);
                showToast('Categoría actualizada');
            } else {
                await axios.post(`${API_URL}/categories`, formData);
                showToast('Categoría creada');
            }
            setShowFormModal(false);
            setFormData({ name: '', description: '', color: 'blue' });
            setEditingId(null);
            fetchCategories();
            if (detail && editingId === detail.id) openDetail(detail.id);
        } catch (err: any) {
            showToast(err.response?.data?.detail || 'Error al guardar', 'error');
        } finally { setProcessing(false); }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await axios.delete(`${API_URL}/categories/${deleteId}`);
            showToast('Categoría eliminada');
            if (detail?.id === deleteId) setDetail(null);
            setDeleteId(null);
            fetchCategories();
        } catch (err: any) {
            showToast(err.response?.data?.detail || 'Error al eliminar', 'error');
        }
    };

    const searchProducts = async (q: string) => {
        if (!q.trim() || !detail) return;
        setLoadingSearch(true);
        try {
            const { data } = await axios.get(`${API_URL}/categories/search-products`, {
                params: { q, category_id: detail.id }
            });
            setSearchResults(data);
        } catch { /* ignore */ }
        finally { setLoadingSearch(false); }
    };

    useEffect(() => {
        const t = setTimeout(() => { if (productSearch.trim()) searchProducts(productSearch); else setSearchResults([]); }, 300);
        return () => clearTimeout(t);
    }, [productSearch]);

    const addProduct = async (productId: number) => {
        if (!detail) return;
        try {
            await axios.post(`${API_URL}/categories/${detail.id}/products`, { product_ids: [productId] });
            showToast('Producto agregado');
            openDetail(detail.id);
            fetchCategories();
            if (productSearch.trim()) searchProducts(productSearch);
        } catch (err: any) {
            showToast(err.response?.data?.detail || 'Error', 'error');
        }
    };

    const removeProduct = async (productId: number) => {
        if (!detail) return;
        try {
            await axios.delete(`${API_URL}/categories/${detail.id}/products/${productId}`);
            showToast('Producto removido');
            openDetail(detail.id);
            fetchCategories();
        } catch (err: any) {
            showToast(err.response?.data?.detail || 'Error', 'error');
        }
    };

    // --- DETAIL VIEW ---
    if (detail) {
        const color = getColor(detail.color);
        return (
            <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
                <Toast />

                <button onClick={() => setDetail(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4 text-sm font-bold transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Categorías
                </button>

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl ${color.bg} flex items-center justify-center`}>
                            <Tag className={`w-6 h-6 ${color.text}`} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{detail.name}</h1>
                            {detail.description && <p className="text-sm text-gray-500">{detail.description}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setEditingId(detail.id);
                                setFormData({ name: detail.name, description: detail.description || '', color: detail.color });
                                setShowFormModal(true);
                            }}
                            className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            <Edit3 className="w-5 h-5" />
                        </button>
                        <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors">
                            <Plus className="w-4 h-4" /> Agregar Producto
                        </button>
                    </div>
                </div>

                <p className="text-sm text-gray-400 font-bold mb-3">{detail.product_count} producto(s)</p>

                {detail.products.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-bold">Sin productos</p>
                        <p className="text-sm mt-1">Agrega productos a esta categoría</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {detail.products.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 group">
                                {p.image_url ? (
                                    <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-gray-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{p.name}</h3>
                                    <p className="text-xs text-gray-400">{p.sku}{p.upc ? ` · ${p.upc}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {p.locations.length > 0 ? (
                                        <div className="flex items-center gap-1 flex-wrap justify-end">
                                            {p.locations.map((loc) => (
                                                <span key={loc.code} className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />{loc.code} ({loc.quantity})
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-400 px-2 py-0.5 rounded-lg">Sin ubicación</span>
                                    )}
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-2">${p.selling_price.toFixed(2)}</span>
                                    <button
                                        onClick={() => removeProduct(p.product_id)}
                                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Agregar Producto */}
                {showAddProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowAddProduct(false); setProductSearch(''); setSearchResults([]); }}>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="font-black text-gray-900 dark:text-white">Agregar Producto</h2>
                                    <button onClick={() => { setShowAddProduct(false); setProductSearch(''); setSearchResults([]); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Buscar por nombre, SKU o código..."
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-[60vh] p-2">
                                {loadingSearch ? (
                                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                                ) : searchResults.length === 0 ? (
                                    <p className="text-center text-gray-400 py-8 text-sm">{productSearch.trim() ? 'Sin resultados' : 'Escribe para buscar'}</p>
                                ) : (
                                    searchResults.map((p) => (
                                        <button
                                            key={p.id}
                                            disabled={p.already_in_category}
                                            onClick={() => addProduct(p.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${p.already_in_category ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                        >
                                            {p.image_url ? (
                                                <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                    <Package className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
                                                <p className="text-xs text-gray-400">{p.sku}{p.upc ? ` · ${p.upc}` : ''} · ${p.selling_price.toFixed(2)}</p>
                                            </div>
                                            {p.already_in_category ? (
                                                <span className="text-xs font-bold text-green-500">Ya agregado</span>
                                            ) : (
                                                <Plus className="w-5 h-5 text-indigo-500 shrink-0" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Form */}
                {showFormModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowFormModal(false)}>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <h2 className="font-black text-lg text-gray-900 dark:text-white mb-4">{editingId ? 'Editar' : 'Nueva'} Categoría</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre</label>
                                    <input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: Verano 2026" autoFocus />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Descripción</label>
                                    <input value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Opcional" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COLORS.map((c) => (
                                            <button
                                                key={c.key}
                                                onClick={() => setFormData(p => ({ ...p, color: c.key }))}
                                                className={`w-8 h-8 rounded-xl ${c.bg} border-2 transition-all ${formData.color === c.key ? `${c.border} scale-110` : 'border-transparent'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => { setShowFormModal(false); setEditingId(null); }} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
                                <button onClick={handleSave} disabled={processing || !formData.name.trim()} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Delete */}
                {deleteId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <h3 className="font-black text-gray-900 dark:text-white mb-1">Eliminar categoría</h3>
                            <p className="text-sm text-gray-500 mb-5">Se eliminará junto con todas sus asignaciones de productos.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
                                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm">Eliminar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- LIST VIEW ---
    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
            <Toast />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Categorías</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Agrupa productos para organizarlos.</p>
                </div>
                <button
                    onClick={() => { setFormData({ name: '', description: '', color: 'blue' }); setEditingId(null); setShowFormModal(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" /> Nueva
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : categories.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-bold">Sin categorías</p>
                    <p className="text-sm mt-1">Crea tu primera categoría para organizar productos</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat) => {
                        const color = getColor(cat.color);
                        return (
                            <div
                                key={cat.id}
                                onClick={() => openDetail(cat.id)}
                                className={`bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:${color.border} cursor-pointer transition-all group active:scale-[0.98]`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
                                        <Tag className={`w-5 h-5 ${color.text}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{cat.name}</h3>
                                        {cat.description && <p className="text-xs text-gray-400 truncate">{cat.description}</p>}
                                    </div>
                                    <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-lg shrink-0">
                                        {cat.product_count} prod.
                                    </span>
                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingId(cat.id);
                                            setFormData({ name: cat.name, description: cat.description || '', color: cat.color });
                                            setShowFormModal(true);
                                        }} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(cat.id); }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {loadingDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
            )}

            {/* Modal Form */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowFormModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h2 className="font-black text-lg text-gray-900 dark:text-white mb-4">{editingId ? 'Editar' : 'Nueva'} Categoría</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre</label>
                                <input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: Verano 2026" autoFocus />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Descripción</label>
                                <input value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Opcional" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c.key}
                                            onClick={() => setFormData(p => ({ ...p, color: c.key }))}
                                            className={`w-8 h-8 rounded-xl ${c.bg} border-2 transition-all ${formData.color === c.key ? `${c.border} scale-110` : 'border-transparent'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowFormModal(false); setEditingId(null); }} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
                            <button onClick={handleSave} disabled={processing || !formData.name.trim()} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <h3 className="font-black text-gray-900 dark:text-white mb-1">Eliminar categoría</h3>
                        <p className="text-sm text-gray-500 mb-5">Se eliminará junto con todas sus asignaciones.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
