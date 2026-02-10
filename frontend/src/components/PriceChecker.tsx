import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Search, X, Save, Barcode, Hash, CheckCircle2, AlertTriangle,
    ChevronLeft, History, ArrowRight, Camera, Filter, Edit3,
    PackageOpen, Trash2, Loader2, ArrowDownAZ, ArrowUpAZ, Tag,
    Printer, Settings
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { BarcodeScanner } from './BarcodeScanner';
import { ProductLabel, type LabelSize } from './ProductLabel'; // Asegúrate de que ProductLabel exporte LabelSize
import { API_URL } from '../config';

interface Props {
    initialFilter?: boolean;
    onClearFilter?: () => void;
}

export function PriceChecker({ initialFilter = false, onClearFilter }: Props) {
    // --- ESTADOS DE DATOS ---
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // --- ESTADOS DE BÚSQUEDA Y FILTROS ---
    const [searchTerm, setSearchTerm] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        minPrice: "",
        maxPrice: "",
        missingPrice: initialFilter,
        sortBy: "updated_at",
        sortOrder: "desc"
    });

    // --- ESTADOS DE PRODUCTO SELECCIONADO Y EDICIÓN ---
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [editUpc, setEditUpc] = useState("");
    const [editSku, setEditSku] = useState("");
    const [editAlias, setEditAlias] = useState("");
    const [editPrice, setEditPrice] = useState("");

    // --- ESTADOS DE UI Y CONTROL ---
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // --- ESTADOS DE IMPRESIÓN ---
    const [labelSize, setLabelSize] = useState<LabelSize>('1.5x1'); // Tamaño por defecto
    const companyName = "PlantArte"; // Nombre de tu empresa para la etiqueta

    // --- REFS ---
    const inputRef = useRef<HTMLInputElement>(null);
    const timeoutRef = useRef<any>(null);
    const labelRef = useRef<HTMLDivElement>(null); // Ref para el componente a imprimir

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    // --- HANDLER DE IMPRESIÓN (react-to-print v7+) ---
    const handlePrint = useReactToPrint({
        contentRef: labelRef,
        documentTitle: selectedProduct?.alias || selectedProduct?.name || 'Etiqueta',
        onAfterPrint: () => showToast("Enviado a impresión"),
    });

    // --- EFECTO DE BÚSQUEDA (DEBOUNCE) ---
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            fetchProducts();
        }, 500);
        return () => clearTimeout(timeoutRef.current);
    }, [searchTerm, filters]);

    // --- FUNCIONES API ---
    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params: any = {
                q: searchTerm,
                missing_price: filters.missingPrice,
                sort_by: filters.sortBy,
                sort_order: filters.sortOrder,
                limit: 100
            };
            if (filters.minPrice) params.min_price = filters.minPrice;
            if (filters.maxPrice) params.max_price = filters.maxPrice;

            const response = await axios.get(`${API_URL}/invoices/products`, { params });
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

    const clearAllFilters = () => {
        setSearchTerm("");
        setFilters({
            minPrice: "",
            maxPrice: "",
            missingPrice: false,
            sortBy: "updated_at",
            sortOrder: "desc"
        });
        if (onClearFilter) onClearFilter();
    };

    // --- MANEJO DE SELECCIÓN Y EDICIÓN ---
    const handleProductClick = async (p: any) => {
        setSelectedProduct(p);
        setEditUpc(p.upc ? String(p.upc) : "");
        setEditSku(p.sku ? String(p.sku) : "");
        setEditAlias(p.alias ? String(p.alias) : "");
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

    const handleAttemptClose = () => {
        if (!selectedProduct) return;
        const clean = (val: any) => String(val || "").trim();
        const priceChanged = parseFloat(editPrice || "0") !== parseFloat(selectedProduct.selling_price || "0");
        const upcChanged = clean(editUpc) !== clean(selectedProduct.upc);
        const skuChanged = clean(editSku) !== clean(selectedProduct.sku);
        const aliasChanged = clean(editAlias) !== clean(selectedProduct.alias);

        if (upcChanged || skuChanged || aliasChanged || (isAdmin && priceChanged)) {
            setShowExitConfirm(true);
        } else {
            setSelectedProduct(null);
        }
    };

    const handleDiscardChanges = () => { setShowExitConfirm(false); setSelectedProduct(null); };

    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/invoices/products/${selectedProduct.id}`);
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

    const handleSaveField = async (field: 'upc' | 'sku' | 'price' | 'alias') => {
        if (!selectedProduct) return;
        setSaving(true);
        try {
            let payload = {};
            let cleanValue: any = "";

            if (field === 'upc') { cleanValue = editUpc.trim(); payload = { upc: cleanValue }; }
            else if (field === 'sku') { cleanValue = editSku.trim(); payload = { sku: cleanValue }; }
            else if (field === 'alias') { cleanValue = editAlias.trim(); payload = { alias: cleanValue }; }
            else if (field === 'price') { cleanValue = parseFloat(editPrice) || 0; payload = { selling_price: cleanValue }; }

            await axios.put(`${API_URL}/invoices/products/${selectedProduct.id}`, payload);

            const updatedProducts = products.map(p => p.id === selectedProduct.id ? { ...p, ...payload } : p);
            setProducts(updatedProducts);
            setSelectedProduct((prev: any) => ({ ...prev, ...payload }));

            if (field === 'upc') setEditUpc(cleanValue);
            if (field === 'sku') setEditSku(cleanValue);
            if (field === 'alias') setEditAlias(cleanValue);
            if (field === 'price') setEditPrice(String(cleanValue));

            showToast(`${field.toUpperCase()} ACTUALIZADO`);
        } catch (error: any) {
            showToast(error.response?.data?.detail || "Error al guardar.", 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleScanSuccess = (code: string) => {
        if (selectedProduct) {
            setEditUpc(code);
            showToast("Código capturado para edición");
        } else {
            setSearchTerm(code);
            showToast("Buscando producto...");
        }
        setShowScanner(false);
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-2 md:p-6 pb-24 relative animate-fade-in">

            {/* TOAST ALERTA */}
            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                </div>
            </div>

            {/* HEADER COMPACTO */}
            <div className="mb-2 md:mb-6">
                <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white px-2">Buscador</h1>
            </div>

            {/* BARRA DE BÚSQUEDA Y FILTROS */}
            <div className="sticky top-0 z-40 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur pt-2 pb-2 md:pb-4 transition-colors px-2 md:px-0">
                <div className="bg-white dark:bg-gray-800 p-2 md:p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-900 dark:text-white text-sm md:text-base"
                            />
                            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                                <button onClick={() => setShowScanner(true)} className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95" title="Escanear">
                                    <Camera className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border text-sm md:text-base ${showFilters || filters.minPrice || filters.missingPrice ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300'}`}
                            >
                                <Filter className="w-4 h-4 md:w-5 md:h-5" />
                                <span>Filtros</span>
                                {(filters.minPrice || filters.missingPrice) && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                            </button>

                            {(searchTerm || filters.minPrice || filters.missingPrice || filters.maxPrice) && (
                                <button onClick={clearAllFilters} className="px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 hover:border-red-100 bg-white dark:bg-gray-900">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* PANEL DE FILTROS */}
            {showFilters && (
                <div className="mb-4 mx-2 md:mx-0 p-4 md:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-100 dark:border-blue-900/30 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 animate-scale-in">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Ordenar por</label>
                        <div className="flex gap-2">
                            <select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:text-white cursor-pointer">
                                <option value="updated_at">Últimos (Fecha)</option>
                                <option value="name">Nombre (A-Z)</option>
                                <option value="selling_price">Precio Venta</option>
                            </select>
                            <button onClick={() => setFilters({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 w-24 justify-center" title={filters.sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}>
                                {filters.sortOrder === 'asc' ? <ArrowDownAZ className="w-4 h-4 dark:text-white" /> : <ArrowUpAZ className="w-4 h-4 dark:text-white" />}
                                <span className="text-xs font-bold dark:text-white">{filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Precio Venta ($)</label>
                        <div className="flex gap-2 items-center">
                            <input type="number" placeholder="Min" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" />
                            <span className="text-gray-300">-</span>
                            <input type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Estado</label>
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                            <input type="checkbox" checked={filters.missingPrice} onChange={(e) => setFilters({ ...filters, missingPrice: e.target.checked })} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Solo sin precio</span>
                        </label>
                    </div>
                </div>
            )}

            {/* LISTA DE RESULTADOS */}
            {loading ? (
                <div className="text-center py-20 text-gray-400 dark:text-gray-500 flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400" />
                    <p>Cargando productos...</p>
                </div>
            ) : (
                <div className="space-y-3 px-2 md:px-0">
                    {!searchTerm && !filters.missingPrice && !filters.minPrice && products.length === 0 && (
                        <div className="text-center py-20 opacity-50 flex flex-col items-center">
                            <Search className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-xl font-medium text-gray-400">Listo para buscar...</p>
                        </div>
                    )}

                    {(searchTerm || filters.missingPrice || filters.minPrice || filters.maxPrice) && products.length === 0 && (
                        <div className="text-center py-16 flex flex-col items-center">
                            <PackageOpen className="w-12 h-12 text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">No se encontraron productos</h3>
                            <p className="text-gray-500 text-sm">Prueba otros filtros.</p>
                        </div>
                    )}

                    {products.map((p, i) => (
                        <div key={i} onClick={() => handleProductClick(p)} className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center active:bg-blue-50 dark:active:bg-gray-700 active:scale-[0.99] transition-all cursor-pointer hover:shadow-md group">
                            <div className="flex-1 min-w-0 pr-3">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm md:text-base leading-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">{p.name}</h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono text-[10px] md:text-xs">ID: {p.sku || 'N/A'}</span>
                                    {p.alias && <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-1"><Tag className="w-3 h-3" /> {p.alias}</span>}
                                    {(!p.selling_price || p.selling_price <= 0) && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex items-center gap-1 font-bold whitespace-nowrap"><AlertTriangle className="w-3 h-3" /> Sin precio</span>}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                {(!p.selling_price || p.selling_price === 0) ? (
                                    <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">Sin Precio</span>
                                ) : (
                                    <div className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">${p.selling_price?.toFixed(2)}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL DETALLE / EDICIÓN */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="absolute inset-0" onClick={handleAttemptClose}></div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in relative z-10 flex flex-col max-h-[90vh]">
                        <div className="bg-blue-600 dark:bg-blue-700 p-6 md:p-8 text-white relative text-center shrink-0">

                            <button onClick={handleAttemptClose} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors active:scale-90 z-20"><X className="w-5 h-5 text-white" /></button>

                            {/* BOTONES DE ACCIÓN (SELECTOR DE TAMAÑO / IMPRIMIR / BORRAR) */}
                            <div className="absolute top-4 left-4 flex gap-2 z-20 items-center">

                                {/* SELECTOR DE TAMAÑO */}
                                <div className="relative group">
                                    <select
                                        value={labelSize}
                                        onChange={(e) => setLabelSize(e.target.value as LabelSize)}
                                        className="appearance-none bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold py-1.5 pl-2 pr-6 rounded-lg border border-white/30 outline-none cursor-pointer transition-colors backdrop-blur-sm"
                                        title="Tamaño de Etiqueta"
                                    >
                                        <option value="1.5x1" className="text-gray-900">1.5" x 1"</option>
                                        <option value="2x1" className="text-gray-900">2" x 1"</option>
                                    </select>
                                    {/* Flechita decorativa */}
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                        <Settings className="w-3 h-3 text-white" />
                                    </div>
                                </div>

                                {/* BOTÓN IMPRIMIR */}
                                <button
                                    onClick={handlePrint}
                                    className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors active:scale-90 text-white border border-white/30 backdrop-blur-sm"
                                    title={`Imprimir (${labelSize})`}
                                >
                                    <Printer className="w-5 h-5" />
                                </button>

                                {/* BOTÓN BORRAR (ADMIN) */}
                                {isAdmin && (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="bg-red-500/20 hover:bg-red-500/40 p-2 rounded-full transition-colors active:scale-90 text-white border border-red-400/30 backdrop-blur-sm"
                                        title="Eliminar Producto"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-2">Precio de Venta {isAdmin && <Edit3 className="w-3 h-3 opacity-50" />}</p>
                            {isAdmin ? (
                                <div className="relative inline-block w-full max-w-[200px]">
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl md:text-4xl font-black text-blue-300">$</span>
                                    <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full bg-transparent text-center text-6xl md:text-7xl font-black tracking-tighter text-white placeholder-blue-300 focus:outline-none border-b-2 border-transparent focus:border-white/50 transition-all pl-6" placeholder="0" />
                                    {parseFloat(editPrice || "0") !== parseFloat(selectedProduct.selling_price || "0") && (
                                        <button onClick={() => handleSaveField('price')} disabled={saving} className="absolute -right-10 md:-right-12 top-1/2 -translate-y-1/2 bg-white text-blue-600 p-2 rounded-full shadow-lg hover:scale-110 transition-transform active:scale-90 animate-bounce-in"><Save className="w-5 h-5" /></button>
                                    )}
                                </div>
                            ) : (
                                <h2 className="text-6xl md:text-7xl font-black tracking-tighter drop-shadow-lg">${selectedProduct.selling_price?.toFixed(2)}</h2>
                            )}
                        </div>

                        <div className="bg-blue-50 dark:bg-gray-900 p-2 flex gap-2">
                            <button onClick={() => setShowHistory(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${!showHistory ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}>Datos Generales</button>
                            <button onClick={() => setShowHistory(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${showHistory ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500'} flex items-center justify-center gap-1`}><History className="w-3 h-3" /> Historial</button>
                        </div>

                        <div className="p-4 md:p-6 space-y-6 bg-white dark:bg-gray-800 overflow-y-auto">
                            {!showHistory ? (
                                <>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-wide">Producto</label>
                                        <p className="text-gray-800 dark:text-gray-100 font-medium text-sm leading-relaxed">{selectedProduct.name}</p>
                                    </div>
                                    <div className="space-y-4">
                                        {/* CAMPO ALIAS */}
                                        <div className={`transition-all ${String(editAlias || "").trim() !== String(selectedProduct.alias || "").trim() ? 'bg-purple-50 p-3 rounded-2xl border border-purple-200' : ''}`}>
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2"><Tag className="w-4 h-4 text-purple-500" /> Alias / Apodo {String(editAlias || "").trim() !== String(selectedProduct.alias || "").trim() && <span className="text-purple-600 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={editAlias} onChange={(e) => setEditAlias(e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none dark:text-white text-sm" placeholder="Ej: Ficus Trenzado..." />
                                                <button onClick={() => handleSaveField('alias')} disabled={saving || String(editAlias || "").trim() === String(selectedProduct.alias || "").trim()} className={`px-4 rounded-xl flex items-center justify-center ${String(editAlias || "").trim() !== String(selectedProduct.alias || "").trim() ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'}`}><Save className="w-5 h-5" /></button>
                                            </div>
                                        </div>

                                        {/* CAMPO UPC */}
                                        <div className={`transition-all ${String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() ? 'bg-yellow-50 p-3 rounded-2xl border border-yellow-200' : ''}`}>
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2"><Barcode className="w-4 h-4 text-blue-500" /> UPC {String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() && <span className="text-yellow-600 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={editUpc} onChange={(e) => setEditUpc(e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white text-sm" placeholder="Escanear..." />
                                                <button onClick={() => setShowScanner(true)} className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl"><Camera className="w-5 h-5 dark:text-gray-300" /></button>
                                                <button onClick={() => handleSaveField('upc')} disabled={saving || String(editUpc || "").trim() === String(selectedProduct.upc || "").trim()} className={`px-4 rounded-xl flex items-center justify-center ${String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}><Save className="w-5 h-5" /></button>
                                            </div>
                                        </div>

                                        {/* CAMPO SKU */}
                                        <div className={`transition-all ${String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() ? 'bg-yellow-50 p-3 rounded-2xl border border-yellow-200' : ''}`}>
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2"><Hash className="w-4 h-4 text-gray-500" /> ID Interno {String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() && <span className="text-yellow-600 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={editSku} onChange={(e) => setEditSku(e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-xl focus:ring-2 focus:ring-gray-500 outline-none dark:text-white text-sm" placeholder="Clave..." />
                                                <button onClick={() => handleSaveField('sku')} disabled={saving || String(editSku || "").trim() === String(selectedProduct.sku || "").trim()} className={`px-4 rounded-xl flex items-center justify-center ${String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-400'}`}><Save className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-center text-gray-400 py-10 italic text-sm">No hay historial.</p> :
                                        <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-6 pb-4">
                                            {history.map((h, i) => (
                                                <div key={i} className="relative pl-6">
                                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${h.type === 'COSTO' ? 'bg-orange-400' : 'bg-green-500'}`}></div>
                                                    <div className="flex justify-between items-start">
                                                        <div><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${h.type === 'COSTO' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{h.type === 'COSTO' ? 'Costo Compra' : 'Precio Venta'}</span><p className="text-xs text-gray-400 mt-1">{new Date(h.date).toLocaleDateString()}</p></div>
                                                        <div className="text-right"><div className="flex items-center gap-1 justify-end font-bold text-gray-800 dark:text-gray-200"><span className="text-gray-400 line-through text-xs">${h.old.toFixed(2)}</span><ArrowRight className="w-3 h-3 text-gray-300" /><span>${h.new.toFixed(2)}</span></div></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                </div>
                            )}
                        </div>

                        {showExitConfirm && (
                            <div className="absolute inset-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-xs w-full">
                                    <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-8 h-8" /></div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">¡Espera!</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Tienes cambios sin guardar.</p>
                                    <div className="space-y-3">
                                        <button onClick={() => setShowExitConfirm(false)} className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><ChevronLeft className="w-4 h-4" /> Regresar</button>
                                        <button onClick={handleDiscardChanges} className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold py-3 rounded-xl transition-colors text-sm">Salir sin guardar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {showDeleteConfirm && (
                            <div className="absolute inset-0 z-30 bg-red-600/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-2xl max-w-xs w-full">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">¿Eliminar?</h3>
                                    <div className="space-y-3">
                                        <button onClick={handleDeleteProduct} disabled={deleting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl">{deleting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Sí, Eliminar"}</button>
                                        <button onClick={() => setShowDeleteConfirm(false)} className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl">Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* COMPONENTE DE ETIQUETA (INVISIBLE) */}
            <div style={{ display: "none" }}>
                <ProductLabel
                    ref={labelRef}
                    product={selectedProduct}
                    size={labelSize}
                    companyName={companyName}
                />
            </div>

            {showScanner && (
                <BarcodeScanner onScan={handleScanSuccess} onClose={() => setShowScanner(false)} />
            )}
        </div>
    );
}