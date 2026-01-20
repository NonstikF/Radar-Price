import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, X, Save, Barcode, Hash, CheckCircle2, AlertTriangle, ArrowLeft, History, ArrowRight, Camera, Filter, Edit3, PackageOpen, Trash2, Loader2 } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { API_URL } from '../config';

interface Props {
    initialFilter?: boolean;
    onClearFilter?: () => void;
}

export function PriceChecker({ initialFilter = false, onClearFilter }: Props) {
    // --- ESTADOS DE DATOS ---
    const [products, setProducts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false); // Empezamos en false para no cargar todo

    // --- ESTADOS DE SELECCIÓN Y EDICIÓN ---
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [editUpc, setEditUpc] = useState("");
    const [editSku, setEditSku] = useState("");
    const [editPrice, setEditPrice] = useState("");

    // --- ESTADOS DE ACCIÓN (GUARDAR/BORRAR) ---
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // --- MODALES Y ALERTA ---
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // --- REFS Y ROL ---
    const inputRef = useRef<HTMLInputElement>(null);
    const timeoutRef = useRef<any>(null); // Para el debounce
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    // --- 1. EFECTO DE BÚSQUEDA INTELIGENTE (OPTIMIZACIÓN) ---
    useEffect(() => {
        // A) Si hay filtro de "Sin Precio" activo
        if (initialFilter) {
            fetchProducts('', true);
            return;
        }

        // B) Si el término es muy corto, limpiamos y no buscamos
        if (searchTerm.trim().length < 2) {
            setProducts([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // C) DEBOUNCE: Esperar 500ms antes de llamar al servidor
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            fetchProducts(searchTerm, false);
        }, 500);

        return () => clearTimeout(timeoutRef.current);
    }, [searchTerm, initialFilter]);

    // --- 2. FUNCIÓN PARA LLAMAR AL BACKEND ---
    const fetchProducts = async (term: string, missingPrice: boolean) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (term) params.append('q', term);
            if (missingPrice) params.append('missing_price', 'true');

            // Llamada optimizada: Backend filtra y devuelve pocos resultados
            const response = await axios.get(`${API_URL}/invoices/products?${params.toString()}`);
            setProducts(response.data);
        } catch (error) {
            console.error(error);
            showToast("Error de conexión", "error");
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // --- 3. ABRIR PRODUCTO (CARGA HISTORIAL) ---
    const handleProductClick = async (p: any) => {
        setSelectedProduct(p);
        setEditUpc(p.upc ? String(p.upc) : "");
        setEditSku(p.sku ? String(p.sku) : "");
        setEditPrice(p.selling_price ? String(p.selling_price) : "");
        setShowExitConfirm(false);
        setShowDeleteConfirm(false);
        setShowHistory(false);
        setHistory([]);
        try {
            const res = await axios.get(`${API_URL}/invoices/products/${p.id}/history`);
            setHistory(res.data);
        } catch (err) { console.error("Error historial"); }
    };

    // --- 4. VALIDAR CIERRE SIN GUARDAR ---
    const handleAttemptClose = () => {
        if (!selectedProduct) return;
        const clean = (val: any) => String(val || "").trim();

        const priceChanged = parseFloat(editPrice || "0") !== parseFloat(selectedProduct.selling_price || "0");
        const upcChanged = clean(editUpc) !== clean(selectedProduct.upc);
        const skuChanged = clean(editSku) !== clean(selectedProduct.sku);

        if (upcChanged || skuChanged || (isAdmin && priceChanged)) {
            setShowExitConfirm(true);
        } else {
            setSelectedProduct(null);
        }
    };

    const handleDiscardChanges = () => { setShowExitConfirm(false); setSelectedProduct(null); };

    // --- 5. ELIMINAR PRODUCTO (SOLO ADMIN) ---
    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/invoices/products/${selectedProduct.id}`);
            // Eliminar de la lista local para no recargar
            setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
            showToast("Producto eliminado correctamente");
            setSelectedProduct(null);
        } catch (error) {
            showToast("Error al eliminar el producto", "error");
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    // --- 6. GUARDAR CAMBIOS (UPC, SKU, PRECIO) ---
    const handleSaveField = async (field: 'upc' | 'sku' | 'price') => {
        if (!selectedProduct) return;
        setSaving(true);
        try {
            let payload = {};
            let cleanValue: any = "";

            if (field === 'upc') {
                cleanValue = editUpc.trim();
                payload = { upc: cleanValue };
            } else if (field === 'sku') {
                cleanValue = editSku.trim();
                payload = { sku: cleanValue };
            } else if (field === 'price') {
                cleanValue = parseFloat(editPrice) || 0;
                payload = { selling_price: cleanValue };
            }

            await axios.put(`${API_URL}/invoices/products/${selectedProduct.id}`, payload);

            // Actualizar estado local
            const updatedProducts = products.map(p => p.id === selectedProduct.id ? { ...p, ...payload } : p);
            setProducts(updatedProducts);
            setSelectedProduct((prev: any) => ({ ...prev, ...payload }));

            if (field === 'upc') setEditUpc(cleanValue);
            if (field === 'sku') setEditSku(cleanValue);
            if (field === 'price') setEditPrice(String(cleanValue));

            showToast(`${field.toUpperCase()} ACTUALIZADO`);
        } catch (error: any) {
            showToast(error.response?.data?.detail || "Error al guardar.", 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- 7. ESCÁNER ---
    const handleScanSuccess = (code: string) => {
        if (selectedProduct) {
            setEditUpc(code);
            showToast("Código capturado para edición");
        } else {
            setSearchTerm(code); // Activa el useEffect para buscar
            showToast("Buscando producto...");
        }
        setShowScanner(false);
    };

    const handleClearSearch = () => {
        setSearchTerm("");
        setProducts([]);
        inputRef.current?.focus();
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 pb-24 relative">

            {/* TOAST DE NOTIFICACIÓN */}
            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                </div>
            </div>

            {/* BARRA DE BÚSQUEDA FLOTANTE */}
            <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur pt-2 pb-4 space-y-2 transition-colors">
                {initialFilter && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center justify-between animate-fade-in shadow-sm">
                        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm font-bold">Mostrando solo productos sin precio</span>
                        </div>
                        <button onClick={onClearFilter} className="text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400 font-bold hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">Ver Todos</button>
                    </div>
                )}

                <div className="relative shadow-sm group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-6 w-6 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        className="block w-full pl-12 pr-24 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                        placeholder="Buscar por nombre, ID, UPC..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                        <button onClick={() => setShowScanner(true)} className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95">
                            <Camera className="h-6 w-6" />
                        </button>
                        {searchTerm && (
                            <button onClick={handleClearSearch} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                                <X className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* LISTA DE RESULTADOS */}
            {loading ? (
                <div className="text-center py-10 text-gray-400 dark:text-gray-500 flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                    <p>Buscando en catálogo...</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* MENSAJE INICIAL (SIN BÚSQUEDA) */}
                    {!searchTerm && !initialFilter && products.length === 0 && (
                        <div className="text-center py-20 opacity-50 flex flex-col items-center">
                            <Search className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-xl font-medium text-gray-400">Escribe para buscar...</p>
                            <p className="text-sm text-gray-400 mt-2">Busca en tus 15,000+ artículos</p>
                        </div>
                    )}

                    {/* MENSAJE NO ENCONTRADO */}
                    {searchTerm && products.length === 0 && (
                        <div className="text-center py-16 flex flex-col items-center animate-fade-in px-4">
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                                <PackageOpen className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1">
                                No se encontraron productos
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                Intenta buscar con <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-1 rounded">sinónimos</span> o verifica el código.
                            </p>
                        </div>
                    )}

                    {/* ITEMS DE LA LISTA */}
                    {products.map((p, i) => (
                        <div key={i} onClick={() => handleProductClick(p)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center active:bg-blue-50 dark:active:bg-gray-700 active:scale-[0.99] transition-all cursor-pointer hover:shadow-md group">
                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base leading-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{p.name}</h3>
                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    {p.sku ? (
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono border border-transparent dark:border-gray-600">ID: {p.sku}</span>
                                    ) : (
                                        <span className="text-gray-300 dark:text-gray-600 italic">Sin ID</span>
                                    )}
                                    {p.upc && <span className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded font-mono border border-yellow-100 dark:border-yellow-900/30">UPC: {p.upc}</span>}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                {(!p.selling_price || p.selling_price === 0) ? (
                                    <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-bold">Sin Precio</span>
                                ) : (
                                    <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">${p.selling_price?.toFixed(2)}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- MODAL DETALLE / EDICIÓN --- */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="absolute inset-0" onClick={handleAttemptClose}></div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in relative z-10 flex flex-col max-h-[90vh] transition-colors">

                        {/* HEADER AZUL DEL MODAL */}
                        <div className="bg-blue-600 dark:bg-blue-700 p-8 text-white relative text-center shrink-0">
                            {/* Botón Cerrar */}
                            <button onClick={handleAttemptClose} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors active:scale-90"><X className="w-6 h-6 text-white" /></button>

                            {/* Botón ELIMINAR (Solo Admin) */}
                            {isAdmin && (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="absolute top-4 left-4 bg-red-500/20 hover:bg-red-500/40 p-2 rounded-full transition-colors active:scale-90 text-white border border-red-400/30"
                                    title="Eliminar producto"
                                >
                                    <Trash2 className="w-6 h-6" />
                                </button>
                            )}

                            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                Precio de Venta
                                {isAdmin && <Edit3 className="w-3 h-3 opacity-50" />}
                            </p>

                            {/* PRECIO (EDITABLE SI ES ADMIN) */}
                            {isAdmin ? (
                                <div className="relative inline-block w-full max-w-[200px]">
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-black text-blue-300">$</span>
                                    <input
                                        type="number"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        className="w-full bg-transparent text-center text-7xl font-black tracking-tighter text-white placeholder-blue-300 focus:outline-none border-b-2 border-transparent focus:border-white/50 transition-all pl-6"
                                        placeholder="0"
                                    />
                                    {/* Botón flotante para guardar precio */}
                                    {parseFloat(editPrice || "0") !== parseFloat(selectedProduct.selling_price || "0") && (
                                        <button onClick={() => handleSaveField('price')} disabled={saving} className="absolute -right-12 top-1/2 -translate-y-1/2 bg-white text-blue-600 p-2 rounded-full shadow-lg hover:scale-110 transition-transform active:scale-90 animate-bounce-in">
                                            <Save className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <h2 className="text-7xl font-black tracking-tighter drop-shadow-lg">${selectedProduct.selling_price?.toFixed(2)}</h2>
                            )}
                        </div>

                        {/* TABS DE NAVEGACIÓN */}
                        <div className="bg-blue-50 dark:bg-gray-900 p-2 flex gap-2 transition-colors">
                            <button onClick={() => setShowHistory(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${!showHistory ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>Datos Generales</button>
                            <button onClick={() => setShowHistory(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${showHistory ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'} flex items-center justify-center gap-1`}><History className="w-3 h-3" /> Historial</button>
                        </div>

                        {/* CONTENIDO DEL MODAL */}
                        <div className="p-6 space-y-6 bg-white dark:bg-gray-800 overflow-y-auto">
                            {!showHistory ? (
                                <>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-wide">Producto</label>
                                        <p className="text-gray-800 dark:text-gray-100 font-medium text-sm leading-relaxed">{selectedProduct.name}</p>
                                    </div>
                                    <div className="space-y-4">
                                        {/* UPC */}
                                        <div className={`transition-all ${String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() ? 'bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-2xl border border-yellow-200 dark:border-yellow-800' : ''}`}>
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2 tracking-wide"><Barcode className="w-4 h-4 text-blue-500" /> UPC {String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() && <span className="text-yellow-600 dark:text-yellow-400 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={editUpc} onChange={(e) => setEditUpc(e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono text-lg p-3 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 outline-none transition-all" placeholder="Escanear..." />
                                                <button onClick={() => setShowScanner(true)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 p-3 rounded-xl transition-colors active:scale-95" title="Escanear con cámara"><Camera className="w-6 h-6" /></button>
                                                <button onClick={() => handleSaveField('upc')} disabled={saving || String(editUpc || "").trim() === String(selectedProduct.upc || "").trim()} className={`px-4 rounded-xl transition-all shadow-md flex items-center justify-center ${String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}><Save className="w-6 h-6" /></button>
                                            </div>
                                        </div>
                                        {/* SKU */}
                                        <div className={`transition-all ${String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() ? 'bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-2xl border border-yellow-200 dark:border-yellow-800' : ''}`}>
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2 tracking-wide"><Hash className="w-4 h-4 text-purple-500" /> ID Interno {String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() && <span className="text-yellow-600 dark:text-yellow-400 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={editSku} onChange={(e) => setEditSku(e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono text-lg p-3 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:focus:ring-purple-500/20 outline-none transition-all" placeholder="Clave..." />
                                                <button onClick={() => handleSaveField('sku')} disabled={saving || String(editSku || "").trim() === String(selectedProduct.sku || "").trim()} className={`px-4 rounded-xl transition-all shadow-md flex items-center justify-center ${String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}><Save className="w-6 h-6" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // TABLA DE HISTORIAL
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-center text-gray-400 py-10 italic">No hay historial.</p> :
                                        <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-6 pb-4">
                                            {history.map((h, i) => (
                                                <div key={i} className="relative pl-6">
                                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${h.type === 'COSTO' ? 'bg-orange-400' : 'bg-green-500'}`}></div>
                                                    <div className="flex justify-between items-start">
                                                        <div><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${h.type === 'COSTO' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>{h.type === 'COSTO' ? 'Costo Compra' : 'Precio Venta'}</span><p className="text-xs text-gray-400 mt-1">{new Date(h.date).toLocaleDateString()}</p></div>
                                                        <div className="text-right"><div className="flex items-center gap-1 justify-end font-bold text-gray-800 dark:text-gray-200"><span className="text-gray-400 line-through text-xs">${h.old.toFixed(2)}</span><ArrowRight className="w-3 h-3 text-gray-300" /><span>${h.new.toFixed(2)}</span></div></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                </div>
                            )}
                        </div>

                        {/* ALERTA: CONFIRMACIÓN SALIR SIN GUARDAR */}
                        {showExitConfirm && (
                            <div className="absolute inset-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-xs w-full">
                                    <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-8 h-8" /></div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">¡Espera!</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Tienes cambios sin guardar.</p>
                                    <div className="space-y-3">
                                        <button onClick={() => setShowExitConfirm(false)} className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Regresar</button>
                                        <button onClick={handleDiscardChanges} className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold py-3 rounded-xl transition-colors text-sm">Salir sin guardar</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ALERTA: CONFIRMACIÓN DE BORRADO */}
                        {showDeleteConfirm && (
                            <div className="absolute inset-0 z-30 bg-red-600/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-2xl max-w-xs w-full">
                                    <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><Trash2 className="w-8 h-8" /></div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">¿Eliminar Producto?</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Esta acción no se puede deshacer.</p>
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleDeleteProduct}
                                            disabled={deleting}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
                                        >
                                            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                                            {deleting ? "Eliminando..." : "Sí, Eliminar"}
                                        </button>
                                        <button onClick={() => setShowDeleteConfirm(false)} className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition-colors">Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* COMPONENTE DE ESCÁNER */}
            {showScanner && (
                <BarcodeScanner onScan={handleScanSuccess} onClose={() => setShowScanner(false)} />
            )}
        </div>
    );
}