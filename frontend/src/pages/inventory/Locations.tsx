import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    MapPin, Plus, Edit3, Trash2, X, Loader2, CheckCircle2, AlertTriangle,
    Search, Package, ChevronLeft, QrCode, ChevronDown, ChevronRight,
    Filter, Camera, ImagePlus, ZoomIn, Save
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
    image_url: string;
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
    const [scannerTarget, setScannerTarget] = useState<'addProduct' | 'detail' | 'productSearch' | null>(null);

    // Filtro existencia en detalle
    const [showAll, setShowAll] = useState(false);

    // Buscar producto con ubicaciones (vista lista)
    const [productSearchMode, setProductSearchMode] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [productSearchResults, setProductSearchResults] = useState<{ id: number; name: string; sku: string; price: number; selling_price: number; image_url: string; locations: { code: string; quantity: number }[] }[]>([]);
    const [loadingProductSearch, setLoadingProductSearch] = useState(false);

    // Modal agregar producto
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [addingProductId, setAddingProductId] = useState<number | null>(null);

    // Modal de stock
    const [stockProduct, setStockProduct] = useState<LocationProduct | null>(null);
    const [stockQty, setStockQty] = useState(0);
    const [savingStock, setSavingStock] = useState(false);
    const [confirmEmpty, setConfirmEmpty] = useState(false);
    const [otherLocations, setOtherLocations] = useState<{ location_id: number; code: string; description: string | null; quantity: number }[]>([]);
    const [loadingOtherLocs, setLoadingOtherLocs] = useState(false);

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

    // Búsqueda de producto con ubicaciones (vista lista)
    useEffect(() => {
        if (!productSearchMode) return;
        const timer = setTimeout(async () => {
            if (!productSearchTerm.trim()) { setProductSearchResults([]); return; }
            setLoadingProductSearch(true);
            try {
                const res = await axios.get(`${API_URL}/locations/search-products`, {
                    params: { q: productSearchTerm, with_locations: true },
                });
                setProductSearchResults(res.data);
            } catch { /* ignore */ }
            finally { setLoadingProductSearch(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [productSearchTerm, productSearchMode]);

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
        const clean = code.trim().toUpperCase();
        if (!clean) return;

        try {
            // Buscar si ya existe
            const res = await axios.get(`${API_URL}/locations/by-code/${encodeURIComponent(clean)}`);
            fetchDetail(res.data.id);
            showToast(`Ubicación ${clean} encontrada`);
        } catch {
            // No existe, crearla automáticamente
            try {
                const createRes = await axios.post(`${API_URL}/locations`, { code: clean });
                showToast(`Ubicación ${clean} creada`);
                fetchDetail(createRes.data.id);
            } catch (err: any) {
                showToast(err.response?.data?.detail || "Error al crear ubicación", "error");
            }
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

    // --- MODAL DE STOCK ---
    const openStockModal = async (p: LocationProduct) => {
        setStockProduct(p);
        setStockQty(p.quantity);
        setConfirmEmpty(false);
        setOtherLocations([]);
        setLoadingOtherLocs(true);
        try {
            const res = await axios.get(`${API_URL}/locations/product/${p.product_id}/locations`);
            setOtherLocations(res.data.filter((loc: any) => detail && loc.location_id !== detail.id));
        } catch {
            // silencioso
        } finally {
            setLoadingOtherLocs(false);
        }
    };

    const handleSaveStock = async () => {
        if (!stockProduct || !detail) return;
        setSavingStock(true);
        try {
            await axios.put(`${API_URL}/locations/${detail.id}/products/${stockProduct.product_id}`, { quantity: stockQty });
            showToast("Stock actualizado");
            setDetail({
                ...detail,
                products: detail.products.map(p =>
                    p.product_id === stockProduct.product_id ? { ...p, quantity: stockQty } : p
                ),
            });
            setStockProduct(null);
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error al actualizar", "error");
        } finally {
            setSavingStock(false);
        }
    };

    const handleEmptyStock = async () => {
        if (!stockProduct || !detail) return;
        setSavingStock(true);
        try {
            await axios.put(`${API_URL}/locations/${detail.id}/products/${stockProduct.product_id}`, { quantity: 0 });
            showToast("Inventario vaciado");
            setDetail({
                ...detail,
                products: detail.products.map(p =>
                    p.product_id === stockProduct.product_id ? { ...p, quantity: 0 } : p
                ),
            });
            setStockProduct(null);
            setConfirmEmpty(false);
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error", "error");
        } finally {
            setSavingStock(false);
        }
    };

    // --- IMAGEN DE PRODUCTO ---
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [imageTargetId, setImageTargetId] = useState<number | null>(null);
    const [previewProduct, setPreviewProduct] = useState<LocationProduct | null>(null);

    const compressImage = (file: File, maxWidth = 400, quality = 0.7): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                    canvas.width = img.width * (ratio < 1 ? ratio : 1);
                    canvas.height = img.height * (ratio < 1 ? ratio : 1);
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/webp', quality));
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const triggerImageUpload = (productId: number) => {
        setImageTargetId(productId);
        setTimeout(() => imageInputRef.current?.click(), 50);
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !imageTargetId) return;
        try {
            const compressed = await compressImage(file);
            await axios.put(`${API_URL}/invoices/products/${imageTargetId}`, { image_url: compressed });
            showToast("Imagen actualizada");
            if (detail) {
                const updated = detail.products.map(p =>
                    p.product_id === imageTargetId ? { ...p, image_url: compressed } : p
                );
                setDetail({ ...detail, products: updated });
                if (previewProduct?.product_id === imageTargetId) {
                    setPreviewProduct({ ...previewProduct, image_url: compressed });
                }
            }
        } catch {
            showToast("Error al subir imagen", "error");
        } finally {
            setImageTargetId(null);
            if (imageInputRef.current) imageInputRef.current.value = '';
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
                            className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 dark:text-white"
                        />
                        <button onClick={() => setScannerTarget('addProduct')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all">
                            <Camera className="w-4 h-4" />
                        </button>
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
        let filtered = detail.products;

        // Por defecto solo mostrar con existencia
        if (!showAll) {
            filtered = filtered.filter(p => p.quantity > 0);
        }

        // Filtro de búsqueda
        if (detailSearch) {
            const q = detailSearch.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q) ||
                p.alias.toLowerCase().includes(q)
            );
        }

        const outOfStockCount = detail.products.filter(p => p.quantity <= 0).length;

        return (
            <div className="w-full max-w-7xl mx-auto p-2 md:p-6 pb-24 animate-fade-in">
                <Toast />

                {/* HEADER */}
                <div className="mb-6 px-2">
                    <button onClick={() => { setDetail(null); setShowAll(false); fetchLocations(); }} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors">
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

                {/* BUSCADOR + FILTRO */}
                {detail.products.length > 0 && (
                    <div className="mb-4 px-2">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={detailSearch}
                                    onChange={(e) => setDetailSearch(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-900 dark:text-white shadow-sm"
                                />
                                <button onClick={() => setScannerTarget('detail')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all">
                                    <Camera className="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${showAll ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-transparent'}`}
                            >
                                <Filter className="w-4 h-4" />
                                <span className="hidden md:inline">{showAll ? 'Todos' : 'En existencia'}</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mt-2 px-1">
                            <p className="text-xs text-gray-400">
                                {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
                            </p>
                            {!showAll && outOfStockCount > 0 && (
                                <button onClick={() => setShowAll(true)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                                    + {outOfStockCount} agotado{outOfStockCount !== 1 ? 's' : ''} oculto{outOfStockCount !== 1 ? 's' : ''}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* TABLA */}
                {loadingDetail ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" /></div>
                ) : detail.products.length === 0 ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                        <Package className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-medium text-gray-400">Sin productos</p>
                        <p className="text-sm text-gray-400 mt-2">Agrega productos a esta ubicación</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 opacity-50 flex flex-col items-center">
                        <Package className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-sm text-gray-400">{showAll ? 'Sin resultados' : 'Todos los productos están agotados'}</p>
                        {!showAll && <button onClick={() => setShowAll(true)} className="text-sm text-indigo-500 font-bold mt-2">Mostrar todos</button>}
                    </div>
                ) : (
                    <div className="px-2 md:px-0">
                        {/* Header de tabla (desktop) */}
                        <div className="hidden md:grid grid-cols-[56px_1fr_100px_80px] gap-4 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span></span>
                            <span>Producto</span>
                            <span className="text-center">Cantidad</span>
                            <span></span>
                        </div>

                        <div className="space-y-2">
                            {filtered.map((p) => (
                                <div
                                    key={p.id}
                                    className={`bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-transparent flex items-center gap-3 md:gap-4 group transition-all ${p.quantity <= 0 ? 'opacity-50' : ''}`}
                                >
                                    {/* IMAGEN */}
                                    <button
                                        onClick={() => p.image_url ? setPreviewProduct(p) : triggerImageUpload(p.product_id)}
                                        className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden shrink-0 relative group/img cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all"
                                        title={p.image_url ? "Ver imagen" : "Agregar foto"}
                                    >
                                        {p.image_url ? (
                                            <>
                                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl">
                                                    <ZoomIn className="w-4 h-4 text-white" />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <Camera className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover/img:text-indigo-400 transition-colors" />
                                                {imageTargetId === p.product_id && <Loader2 className="w-3 h-3 animate-spin text-indigo-500 absolute" />}
                                            </div>
                                        )}
                                    </button>

                                    {/* INFO (clickeable para modal de stock) */}
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openStockModal(p)}>
                                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.name}</h3>
                                        <div className="flex flex-wrap gap-1.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            {p.sku && (
                                                <span className="bg-gray-100 dark:bg-gray-900 px-1.5 rounded font-mono">{p.sku}</span>
                                            )}
                                            {p.alias && (
                                                <span className="bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-1.5 rounded font-bold">{p.alias}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* CANTIDAD (clickeable para modal de stock) */}
                                    <div className="text-center shrink-0 w-16 md:w-24 cursor-pointer" onClick={() => openStockModal(p)}>
                                        {p.quantity > 0 ? (
                                            <span className="inline-block bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-lg text-sm font-black">
                                                {p.quantity}
                                            </span>
                                        ) : (
                                            <span className="inline-block bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1 rounded-lg text-xs font-bold">
                                                Agotado
                                            </span>
                                        )}
                                    </div>

                                    {/* ACCIONES */}
                                    <button
                                        onClick={() => handleRemoveProduct(p.product_id)}
                                        title="Quitar de esta ubicación"
                                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors md:opacity-0 md:group-hover:opacity-100 shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MODAL DE STOCK */}
                {stockProduct && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => { setStockProduct(null); setConfirmEmpty(false); }}>
                        <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl relative animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

                            {/* Close */}
                            <button onClick={() => { setStockProduct(null); setConfirmEmpty(false); }} className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                                <X className="w-5 h-5" />
                            </button>

                            {/* Header con imagen */}
                            <div className="px-5 pt-4 pb-4">
                                <div className="flex items-center gap-4 pr-8">
                                    {stockProduct.image_url ? (
                                        <img src={stockProduct.image_url} className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-sm" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                            <Package className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight line-clamp-2">{stockProduct.name}</h3>
                                        {stockProduct.sku && <p className="text-xs text-gray-400 font-mono mt-0.5">{stockProduct.sku}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Stock control - card estilo referencia */}
                            <div className="mx-5 mb-4 bg-indigo-50 dark:bg-indigo-900/15 rounded-2xl p-5">
                                <label className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5" /> Stock en {detail?.code}
                                </label>
                                <div className="flex items-center justify-center gap-4 mt-4">
                                    <button
                                        onClick={() => setStockQty(Math.max(0, stockQty - 1))}
                                        className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold text-xl shadow-sm hover:shadow-md transition-all active:scale-90 flex items-center justify-center select-none border border-gray-100 dark:border-gray-700"
                                    >−</button>
                                    <input
                                        type="number"
                                        min={0}
                                        value={stockQty}
                                        onChange={(e) => setStockQty(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-20 h-12 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-center text-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white shadow-sm"
                                    />
                                    <button
                                        onClick={() => setStockQty(stockQty + 1)}
                                        className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold text-xl shadow-sm hover:shadow-md transition-all active:scale-90 flex items-center justify-center select-none border border-gray-100 dark:border-gray-700"
                                    >+</button>
                                </div>

                                {/* Guardar */}
                                <button
                                    onClick={handleSaveStock}
                                    disabled={savingStock || stockQty === stockProduct.quantity}
                                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/25"
                                >
                                    {savingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar stock
                                </button>
                            </div>

                            {/* Vaciar inventario */}
                            <div className="px-5 pb-4">
                                {stockProduct.quantity > 0 && !confirmEmpty && (
                                    <button
                                        onClick={() => setConfirmEmpty(true)}
                                        className="w-full border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                                    >
                                        Vaciar inventario
                                    </button>
                                )}
                                {confirmEmpty && (
                                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
                                        <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-3 text-center">¿Confirmas dejar el stock en 0?</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => setConfirmEmpty(false)} className="flex-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold text-sm border border-gray-200 dark:border-gray-600">Cancelar</button>
                                            <button onClick={handleEmptyStock} disabled={savingStock} className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm flex justify-center items-center gap-1">
                                                {savingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sí, vaciar'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Otras ubicaciones */}
                            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Otras ubicaciones
                                </label>
                                {loadingOtherLocs ? (
                                    <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></div>
                                ) : otherLocations.length === 0 ? (
                                    <p className="text-sm text-gray-400 mt-2">Solo está en esta ubicación</p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        {otherLocations.map((loc) => (
                                            <div
                                                key={loc.location_id}
                                                onClick={() => { setStockProduct(null); setConfirmEmpty(false); fetchDetail(loc.location_id); }}
                                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <MapPin className="w-4 h-4 text-indigo-500" />
                                                    <span className="font-mono font-bold text-sm text-gray-800 dark:text-gray-100">{loc.code}</span>
                                                    {loc.description && <span className="text-xs text-gray-400 truncate max-w-[120px]">{loc.description}</span>}
                                                </div>
                                                <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${loc.quantity > 0 ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                                                    {loc.quantity}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                )}

                {/* LIGHTBOX IMAGEN */}
                {previewProduct && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewProduct(null)}>
                        <div className="relative max-w-lg w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
                            {/* Imagen grande */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                                {previewProduct.image_url ? (
                                    <img src={previewProduct.image_url} alt={previewProduct.name} className="w-full max-h-[60vh] object-contain bg-gray-100 dark:bg-gray-900" />
                                ) : (
                                    <div className="w-full h-64 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                                        <Camera className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                                    </div>
                                )}
                                <div className="p-4">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm line-clamp-2">{previewProduct.name}</h3>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => { triggerImageUpload(previewProduct.product_id); }}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                                        >
                                            <ImagePlus className="w-4 h-4" /> {previewProduct.image_url ? 'Cambiar foto' : 'Subir foto'}
                                        </button>
                                        {previewProduct.image_url && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await axios.put(`${API_URL}/invoices/products/${previewProduct.product_id}`, { image_url: null });
                                                        showToast("Imagen eliminada");
                                                        if (detail) {
                                                            setDetail({
                                                                ...detail,
                                                                products: detail.products.map(p =>
                                                                    p.product_id === previewProduct.product_id ? { ...p, image_url: '' } : p
                                                                ),
                                                            });
                                                        }
                                                        setPreviewProduct(null);
                                                    } catch {
                                                        showToast("Error", "error");
                                                    }
                                                }}
                                                className="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/40 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Botón cerrar */}
                            <button onClick={() => setPreviewProduct(null)} className="absolute -top-3 -right-3 bg-white dark:bg-gray-700 p-2 rounded-full shadow-lg text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Input oculto para subir imagen */}
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="hidden"
                />

                {addProductModalContent}
                {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
                {scannerTarget === 'addProduct' && (
                    <BarcodeScanner
                        onScan={(code) => { setProductSearch(code); setScannerTarget(null); }}
                        onClose={() => setScannerTarget(null)}
                    />
                )}
                {scannerTarget === 'detail' && (
                    <BarcodeScanner
                        onScan={(code) => { setDetailSearch(code); setScannerTarget(null); }}
                        onClose={() => setScannerTarget(null)}
                    />
                )}
            </div>
        );
    }

    // --- VISTA LISTA ---
    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
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

            {/* TABS: Ubicación / Producto */}
            <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => { setProductSearchMode(false); setProductSearchTerm(''); setProductSearchResults([]); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!productSearchMode ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    <MapPin className="w-4 h-4 inline mr-1.5 -mt-0.5" />Ubicaciones
                </button>
                <button
                    onClick={() => { setProductSearchMode(true); setSearchTerm(''); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${productSearchMode ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />Buscar Producto
                </button>
            </div>

            {/* BUSCADOR */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    {productSearchMode ? (
                        <>
                        <input
                            type="text"
                            placeholder="Buscar producto por nombre, SKU o código..."
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-900 dark:text-white shadow-sm"
                            autoFocus
                        />
                        <button onClick={() => setScannerTarget('productSearch')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all">
                            <Camera className="w-5 h-5" />
                        </button>
                        </>
                    ) : (
                        <input
                            type="text"
                            placeholder="Buscar ubicación (ej: R1B2)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-900 dark:text-white shadow-sm"
                        />
                    )}
                </div>
            </div>

            {/* CONTENIDO */}
            {productSearchMode ? (
                /* RESULTADOS BÚSQUEDA PRODUCTO */
                loadingProductSearch ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto" /></div>
                ) : !productSearchTerm.trim() ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                        <Search className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-medium text-gray-400">Busca un producto</p>
                        <p className="text-sm text-gray-400 mt-2">Escribe el nombre, SKU o código de barras</p>
                    </div>
                ) : productSearchResults.length === 0 ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                        <Package className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-medium text-gray-400">Sin resultados</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {productSearchResults.map((p) => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                <div className="flex items-center gap-3">
                                    {p.image_url ? (
                                        <img src={p.image_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                            <Package className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{p.name}</h3>
                                        <p className="text-xs text-gray-400">{p.sku} · ${p.selling_price.toFixed(2)}</p>
                                    </div>
                                </div>
                                {p.locations && p.locations.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {p.locations.map((loc) => (
                                            <span key={loc.code} className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg">
                                                <MapPin className="w-3.5 h-3.5" />{loc.code} <span className="text-indigo-400 dark:text-indigo-500">({loc.quantity})</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 mt-2 italic">Sin ubicaciones asignadas</p>
                                )}
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* LISTA AGRUPADA POR LUGAR */
                loading ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto" /></div>
                ) : locations.length === 0 ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                        <MapPin className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-medium text-gray-400">No hay ubicaciones</p>
                        <p className="text-sm text-gray-400 mt-2">Crea una nueva o escanea un QR</p>
                    </div>
                ) : (
                    <GroupedLocations
                        locations={locations}
                        onSelect={(id) => fetchDetail(id)}
                        onEdit={openEditModal}
                        onDelete={(id) => setDeleteId(id)}
                        searchTerm={searchTerm}
                    />
                )
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

            {/* SCANNER BÚSQUEDA */}
            {scannerTarget && (
                <BarcodeScanner
                    onScan={(code) => {
                        if (scannerTarget === 'addProduct') setProductSearch(code);
                        else if (scannerTarget === 'detail') setDetailSearch(code);
                        else if (scannerTarget === 'productSearch') setProductSearchTerm(code);
                        setScannerTarget(null);
                    }}
                    onClose={() => setScannerTarget(null)}
                />
            )}
        </div>
    );
}

// --- COMPONENTE AGRUPADO JERÁRQUICO (R1 → A → A1, A2) ---
function GroupedLocations({
    locations,
    onSelect,
    onEdit,
    onDelete,
    searchTerm,
}: {
    locations: LocationItem[];
    onSelect: (id: number) => void;
    onEdit: (loc: LocationItem) => void;
    onDelete: (id: number) => void;
    searchTerm: string;
}) {
    // Secciones inician colapsadas por defecto
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const isSearching = searchTerm.trim().length > 0;

    const toggle = (key: string) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isExpanded = (key: string) => isSearching || !!expanded[key];

    // Parsear código: R1B2C3 → letra="R", firstSeg="R1"
    const parseCode = (code: string) => {
        const upper = code.toUpperCase();
        const letter = upper.match(/^([A-Z]+)/)?.[1] || upper;
        const segments = upper.match(/[A-Z]+\d+/g);
        if (!segments || segments.length === 0) return { letter, firstSeg: null };
        return { letter, firstSeg: segments[0] };
    };

    // Construir árbol: letra → firstSeg → locations[]
    const groups: Record<string, { subs: Record<string, LocationItem[]>; standalone: LocationItem[] }> = {};

    for (const loc of locations) {
        const { letter, firstSeg } = parseCode(loc.code);
        if (!groups[letter]) groups[letter] = { subs: {}, standalone: [] };
        if (firstSeg) {
            if (!groups[letter].subs[firstSeg]) groups[letter].subs[firstSeg] = [];
            groups[letter].subs[firstSeg].push(loc);
        } else {
            groups[letter].standalone.push(loc);
        }
    }

    const sortedGroups = Object.keys(groups).sort();

    const countProducts = (items: LocationItem[]) => items.reduce((s, l) => s + l.product_count, 0);
    const countAll = (r: typeof groups[string]) => {
        let total = r.standalone.length;
        let products = countProducts(r.standalone);
        for (const items of Object.values(r.subs)) {
            total += items.length;
            products += countProducts(items);
        }
        return { total, products };
    };

    const LocationRow = ({ loc }: { loc: LocationItem }) => (
        <div
            className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-800 group cursor-pointer transition-all"
            onClick={() => onSelect(loc.id)}
        >
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm font-mono group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{loc.code}</h3>
                {loc.description && <p className="text-xs text-gray-400 truncate">{loc.description}</p>}
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${loc.product_count > 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                {loc.product_count} prod.
            </span>
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit(loc); }} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(loc.id); }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            {sortedGroups.map((letter) => {
                const data = groups[letter];
                const { total, products } = countAll(data);
                const letterKey = `letter-${letter}`;
                const letterOpen = isExpanded(letterKey);
                const sortedSubs = Object.keys(data.subs).sort();

                return (
                    <div key={letter} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                        <button
                            onClick={() => toggle(letterKey)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-lg">{letter}</span>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-xs text-gray-400">{total} ubicaciones · {products} productos</p>
                            </div>
                            {letterOpen
                                ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                                : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                            }
                        </button>

                        {letterOpen && (
                            <div className="px-4 pb-3 space-y-1">
                                {data.standalone.map(loc => <LocationRow key={loc.id} loc={loc} />)}

                                {sortedSubs.map(sub => {
                                    const subItems = data.subs[sub];
                                    const subKey = `sub-${letter}-${sub}`;
                                    const subOpen = isExpanded(subKey);
                                    const subProducts = countProducts(subItems);

                                    return (
                                        <div key={sub} className="rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => toggle(subKey)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                            >
                                                {subOpen
                                                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                                }
                                                <span className="font-bold text-gray-700 dark:text-gray-200 font-mono text-sm">{sub}</span>
                                                <div className="flex-1" />
                                                <span className="text-[11px] text-gray-400 font-medium">{subItems.length} ubic. · {subProducts} prod.</span>
                                            </button>

                                            {subOpen && (
                                                <div className="ml-5 pl-3 border-l-2 border-indigo-100 dark:border-indigo-900/30 space-y-1 py-1 mb-1">
                                                    {subItems.map(loc => <LocationRow key={loc.id} loc={loc} />)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
