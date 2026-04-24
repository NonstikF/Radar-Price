import { useState } from 'react';
import axios from 'axios';
import {
    Search, X, Camera, Filter, PackageOpen, Loader2, ArrowDownAZ, ArrowUpAZ,
    CheckCircle2, AlertTriangle, Tag, ShoppingCart, ChevronLeft, ChevronRight,
    CheckSquare, Square, Clock, ListChecks, ShieldAlert
} from 'lucide-react';
import { BarcodeScanner } from '../../components/ui/BarcodeScanner';
import { useProductSearch } from '../../hooks/useProductSearch';
import { useShoppingList } from '../../hooks/useShoppingList';
import { ProductDetailModal } from '../../components/modals/ProductDetailModal';
import { TOAST_DURATION } from '../../config/constants';
import { API_URL } from '../../config/api';

interface Props {
    initialFilter?: boolean;
    onClearFilter?: () => void;
}

export function PriceChecker({ initialFilter = false, onClearFilter }: Props) {
    // 1. Usamos el Hook de Búsqueda (Lógica extraída)
    const {
        products, loading, searchTerm, setSearchTerm, filters, setFilters,
        clearFilters, setProducts, page, totalPages, total, goToPage
    } = useProductSearch(initialFilter);

    const { addToList, adding } = useShoppingList();

    // 2. Estado local solo para UI del componente principal
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [cartModal, setCartModal] = useState<{ product: any; quantity: number } | null>(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), TOAST_DURATION);
    };

    const handleClearAllFilters = () => {
        clearFilters();
        if (onClearFilter) onClearFilter();
    };

    const handleProductUpdate = (updatedProduct: any) => {
        // Actualizamos la lista localmente para no tener que recargar todo
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        setSelectedProduct(updatedProduct); // Actualizamos el modal también
    };

    const handleProductDelete = () => {
        setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
        setSelectedProduct(null);
        showToast("Producto eliminado");
    };

    const toggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    };

    const exitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    const handleBulkTouch = async () => {
        if (selectedIds.size === 0) return;
        setBulkLoading(true);
        try {
            await axios.post(`${API_URL}/invoices/products/bulk-touch`, { ids: Array.from(selectedIds) });
            showToast(`${selectedIds.size} productos actualizados`);
            exitSelectionMode();
        } catch {
            showToast("Error al actualizar", "error");
        } finally {
            setBulkLoading(false);
        }
    };

    const handleOpenCartModal = (e: React.MouseEvent, product: any) => {
        e.stopPropagation();
        if (!product.supplier_id) {
            showToast("Asigna un proveedor primero", "error");
            return;
        }
        setCartModal({ product, quantity: 1 });
    };

    const handleConfirmAddToCart = async () => {
        if (!cartModal) return;
        try {
            const result = await addToList(cartModal.product.id, cartModal.quantity);
            showToast(`Agregado a lista de ${result.supplier_name}`);
            setCartModal(null);
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error al agregar", "error");
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-2 md:p-6 pb-24 relative animate-fade-in">
            {/* TOAST FLOTANTE */}
            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                </div>
            </div>

            {/* HEADER */}
            <div className="mb-2 md:mb-6">
                <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white px-2">Buscador</h1>
            </div>

            {/* BARRA DE BÚSQUEDA */}
            <div className="sticky top-0 z-40 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur pt-2 pb-2 md:pb-4 px-2 md:px-0">
                <div className="bg-white dark:bg-gray-800 p-2 md:p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-transparent">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                // CORRECCIÓN: dark:bg-gray-900 dark:text-white
                                className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-900 dark:text-white shadow-inner"
                            />
                            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                                <button onClick={() => setShowScanner(true)} className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all">
                                    <Camera className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${showFilters || filters.minPrice || filters.missingPrice ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <Filter className="w-4 h-4" /> Filtros
                            </button>
                            <button
                                onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
                                className={`px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${selectionMode ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                title="Modo selección múltiple"
                            >
                                <ListChecks className="w-4 h-4" />
                            </button>
                            {(searchTerm || filters.minPrice || filters.missingPrice) && (
                                <button onClick={handleClearAllFilters} className="px-4 py-3 rounded-xl font-bold text-red-500 dark:text-red-400 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* FILTROS EXPANDIBLES */}
            {showFilters && (
                <div className="mb-4 mx-2 md:mx-0 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg animate-scale-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Ordenar</label>
                            <div className="flex gap-2">
                                {/* CORRECCIÓN: Select con fondo oscuro y texto blanco */}
                                <select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="updated_at">Últimos</option>
                                    <option value="name">Nombre</option>
                                    <option value="selling_price">Precio</option>
                                </select>
                                <button onClick={() => setFilters({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })} className="p-2 bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                                    {filters.sortOrder === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Estado</label>
                            <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <input type="checkbox" checked={filters.missingPrice} onChange={(e) => setFilters({ ...filters, missingPrice: e.target.checked })} className="text-blue-600 rounded" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Solo sin precio</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                <input type="checkbox" checked={(filters as any).onlyDelicate || false} onChange={(e) => setFilters({ ...filters, onlyDelicate: e.target.checked } as any)} className="text-amber-500 rounded" />
                                <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Solo delicados</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
                    <p>Cargando productos...</p>
                </div>
            ) : (
                <div className="space-y-3 px-2 md:px-0">
                    {products.length === 0 && (
                        <div className="text-center py-20 opacity-50 flex flex-col items-center">
                            <PackageOpen className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-xl font-medium text-gray-400">No se encontraron productos</p>
                        </div>
                    )}

                    {/* BARRA SELECCIONAR TODO */}
                    {selectionMode && products.length > 0 && (
                        <div className="flex items-center justify-between px-1 py-2">
                            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                {selectedIds.size === products.length
                                    ? <><CheckSquare className="w-4 h-4" /> Deseleccionar todos</>
                                    : <><Square className="w-4 h-4" /> Seleccionar todos ({products.length})</>
                                }
                            </button>
                            <span className="text-xs text-gray-400">{selectedIds.size} seleccionados</span>
                        </div>
                    )}

                    {products.map((product) => {
                        const isSelected = selectedIds.has(product.id);
                        const isDelicate = !!product.is_delicate;
                        return (
                        <div
                            key={product.id}
                            onClick={() => selectionMode ? toggleSelection(product.id) : setSelectedProduct(product)}
                            className={`p-3 md:p-4 rounded-xl shadow-sm border flex justify-between items-center cursor-pointer transition-all active:scale-[0.99] group
                                ${isSelected ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                : isDelicate ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                        >
                            {selectionMode && (
                                <div className="mr-3 shrink-0 text-indigo-500">
                                    {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />}
                                </div>
                            )}
                            <div className="flex-1 min-w-0 pr-3">
                                <div className="flex items-center gap-2 mb-1">
                                    {isDelicate && <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />}
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">{product.name}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    {product.sku && <span className="bg-gray-100 dark:bg-gray-900 px-2 rounded font-mono">ID: {product.sku}</span>}
                                    {product.upc && <span className="bg-gray-100 dark:bg-gray-900 px-2 rounded font-mono">UPC: {product.upc}</span>}
                                    {product.alias && <span className="bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 rounded font-bold flex items-center gap-1"><Tag className="w-3 h-3" /> {product.alias}</span>}
                                    {isDelicate && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 rounded font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Delicado</span>}
                                    {(!product.selling_price) && <span className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 rounded flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> Sin precio</span>}
                                </div>
                            </div>
                            {!selectionMode && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={(e) => handleOpenCartModal(e, product)}
                                        disabled={adding}
                                        title={product.supplier_id ? "Agregar a lista de compras" : "Sin proveedor asignado"}
                                        className={`p-2 rounded-xl transition-all active:scale-90 ${product.supplier_id ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                                    >
                                        <ShoppingCart className="w-5 h-5" />
                                    </button>
                                    <div className="text-right">
                                        {(!product.selling_price) ?
                                            <span className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-bold">Sin Precio</span> :
                                            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">${product.selling_price?.toFixed(2)}</div>
                                        }
                                    </div>
                                </div>
                            )}
                        </div>
                        );
                    })}

                    {/* PAGINACIÓN */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 pb-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {page * 100 + 1}-{Math.min((page + 1) * 100, total)} de {total} productos
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => goToPage(page - 1)}
                                    disabled={page === 0}
                                    className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i)
                                    .filter(i => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1)
                                    .reduce((acc: (number | 'dots')[], i, idx, arr) => {
                                        if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push('dots');
                                        acc.push(i);
                                        return acc;
                                    }, [])
                                    .map((item, idx) =>
                                        item === 'dots' ? (
                                            <span key={`dots-${idx}`} className="px-2 text-gray-400">...</span>
                                        ) : (
                                            <button
                                                key={item}
                                                onClick={() => goToPage(item as number)}
                                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${page === item ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                            >
                                                {(item as number) + 1}
                                            </button>
                                        )
                                    )}
                                <button
                                    onClick={() => goToPage(page + 1)}
                                    disabled={page >= totalPages - 1}
                                    className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* BARRA FLOTANTE DE SELECCIÓN */}
            {selectionMode && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
                    <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-gray-700">
                        <span className="text-sm font-bold text-gray-300 min-w-[80px]">
                            {selectedIds.size} selec.
                        </span>
                        <button
                            onClick={handleBulkTouch}
                            disabled={selectedIds.size === 0 || bulkLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-bold text-sm transition-all"
                        >
                            {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                            Actualizar fecha
                        </button>
                        <button
                            onClick={exitSelectionMode}
                            className="p-2 rounded-xl hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DETALLE (Componente extraído) */}
            {selectedProduct && (
                <ProductDetailModal
                    product={selectedProduct}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedProduct(null)}
                    onDelete={handleProductDelete}
                    onUpdate={handleProductUpdate}
                    showToast={showToast}
                />
            )}

            {showScanner && (
                <BarcodeScanner onScan={(code) => { setSearchTerm(code); showToast("Buscando..."); setShowScanner(false); }} onClose={() => setShowScanner(false)} />
            )}

            {/* MODAL CANTIDAD CARRITO */}
            {cartModal && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                    onClick={() => setCartModal(null)}
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div
                        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-xs animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                                <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Agregar a lista</p>
                                <p className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{cartModal.product.name}</p>
                            </div>
                        </div>

                        <div className="mb-5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Cantidad</label>
                            <div className="flex items-stretch h-12 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={() => setCartModal(m => m && m.quantity > 1 ? { ...m, quantity: m.quantity - 1 } : m)}
                                    className="w-12 shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center justify-center border-r border-gray-200 dark:border-gray-700"
                                >
                                    −
                                </button>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={cartModal.quantity}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value);
                                        if (!isNaN(v) && v >= 1) setCartModal(m => m ? { ...m, quantity: v } : m);
                                    }}
                                    className="flex-1 min-w-0 text-center text-2xl font-black text-gray-900 dark:text-white bg-white dark:bg-gray-800 outline-none"
                                />
                                <button
                                    onClick={() => setCartModal(m => m ? { ...m, quantity: m.quantity + 1 } : m)}
                                    className="w-12 shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95 flex items-center justify-center border-l border-gray-200 dark:border-gray-700"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setCartModal(null)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmAddToCart}
                                disabled={adding}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                            >
                                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}