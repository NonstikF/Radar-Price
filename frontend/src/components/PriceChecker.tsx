import { useState } from 'react';
import {
    Search, X, Camera, Filter, PackageOpen, Loader2, ArrowDownAZ, ArrowUpAZ,
    CheckCircle2, AlertTriangle, Tag
} from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { useProductSearch } from '../hooks/useProductSearch';
import { ProductDetailModal } from './ProductDetailModal';
import { TOAST_DURATION } from '../config/constants';

interface Props {
    initialFilter?: boolean;
    onClearFilter?: () => void;
}

export function PriceChecker({ initialFilter = false, onClearFilter }: Props) {
    // 1. Usamos el Hook de Búsqueda (Lógica extraída)
    const {
        products, loading, searchTerm, setSearchTerm, filters, setFilters,
        clearFilters, setProducts
    } = useProductSearch(initialFilter);

    // 2. Estado local solo para UI del componente principal
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

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
                <div className="bg-white dark:bg-gray-800 p-2 md:p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-900 dark:text-white"
                            />
                            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                                <button onClick={() => setShowScanner(true)} className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                    <Camera className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border text-sm ${showFilters || filters.minPrice || filters.missingPrice ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                            >
                                <Filter className="w-4 h-4" /> Filters
                            </button>
                            {(searchTerm || filters.minPrice || filters.missingPrice) && (
                                <button onClick={handleClearAllFilters} className="px-4 py-3 rounded-xl font-bold text-red-500 border border-gray-200 bg-white hover:bg-red-50">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* FILTROS EXPANDIBLES */}
            {showFilters && (
                <div className="mb-4 mx-2 md:mx-0 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-100 animate-scale-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Reutilizando lógica de filtros, ahora más limpia */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Ordenar</label>
                            <div className="flex gap-2">
                                <select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })} className="w-full p-2 rounded-lg bg-gray-50 border">
                                    <option value="updated_at">Últimos</option>
                                    <option value="name">Nombre</option>
                                    <option value="selling_price">Precio</option>
                                </select>
                                <button onClick={() => setFilters({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })} className="p-2 bg-gray-100 rounded-lg">
                                    {filters.sortOrder === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        {/* Más filtros... (Min/Max precio) */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Estado</label>
                            <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={filters.missingPrice} onChange={(e) => setFilters({ ...filters, missingPrice: e.target.checked })} className="text-blue-600 rounded" />
                                <span className="text-sm font-medium">Solo sin precio</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* LISTA DE RESULTADOS */}
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

                    {products.map((product) => (
                        <div key={product.id} onClick={() => setSelectedProduct(product)} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-all active:scale-[0.99] group">
                            <div className="flex-1 min-w-0 pr-3">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base leading-tight mb-1 group-hover:text-blue-600 line-clamp-2">{product.name}</h3>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span className="bg-gray-100 px-2 rounded font-mono">ID: {product.sku || 'N/A'}</span>
                                    {product.alias && <span className="bg-purple-100 text-purple-700 px-2 rounded font-bold flex items-center gap-1"><Tag className="w-3 h-3" /> {product.alias}</span>}
                                    {(!product.selling_price) && <span className="bg-orange-100 text-orange-700 px-2 rounded flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> Sin precio</span>}
                                </div>
                            </div>
                            <div className="text-right">
                                {(!product.selling_price) ?
                                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-lg text-xs font-bold">Sin Precio</span> :
                                    <div className="text-2xl font-black text-blue-600 tracking-tight">${product.selling_price?.toFixed(2)}</div>
                                }
                            </div>
                        </div>
                    ))}
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
        </div>
    );
}