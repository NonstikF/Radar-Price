import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    Search, QrCode, Package, MapPin, ChevronLeft, Loader2,
    CheckCircle2, AlertTriangle, Camera, ArrowRight, Plus
} from 'lucide-react';
import { BarcodeScanner } from '../../components/ui/BarcodeScanner';
import { ManualEntry } from '../products/ManualEntry';
import { API_URL } from '../../config/api';
import { TOAST_DURATION } from '../../config/constants';
import { useNavigate } from 'react-router-dom';

interface ProductResult {
    id: number;
    name: string;
    sku: string;
    price: number;
    selling_price: number | null;
    alias: string | null;
    image_url: string | null;
}

interface LocationResult {
    id: number;
    code: string;
    description: string | null;
    product_count: number;
}

interface ProductLocation {
    location_id: number;
    code: string;
    description: string | null;
    quantity: number;
}

type ScanMode = 'product' | 'location';

export function AssignProduct() {
    const navigate = useNavigate();

    // Producto seleccionado
    const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);
    const [productLocations, setProductLocations] = useState<ProductLocation[]>([]);
    const [loadingProductLocs, setLoadingProductLocs] = useState(false);

    // Búsqueda de producto
    const [productQuery, setProductQuery] = useState('');
    const [productResults, setProductResults] = useState<ProductResult[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const productTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Búsqueda de ubicación (paso 2)
    const [locationQuery, setLocationQuery] = useState('');
    const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Scanner
    const [showScanner, setShowScanner] = useState(false);
    const [scanMode, setScanMode] = useState<ScanMode>('product');

    // Asignando
    const [assigning, setAssigning] = useState(false);
    const [assignedSuccess, setAssignedSuccess] = useState(false);

    // Cantidad a asignar
    const [assignQty, setAssignQty] = useState(1);
    const [pendingLocationId, setPendingLocationId] = useState<number | null>(null);
    const [pendingLocationCode, setPendingLocationCode] = useState('');

    // Crear producto
    const [showCreateProduct, setShowCreateProduct] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState('');

    // Toast
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), TOAST_DURATION);
    };

    // --- Búsqueda de productos con debounce ---
    useEffect(() => {
        if (!productQuery.trim()) { setProductResults([]); return; }
        if (productTimerRef.current) clearTimeout(productTimerRef.current);
        productTimerRef.current = setTimeout(async () => {
            setLoadingProducts(true);
            try {
                const res = await axios.get(`${API_URL}/locations/search-products`, { params: { q: productQuery } });
                setProductResults(res.data);
            } catch { setProductResults([]); }
            setLoadingProducts(false);
        }, 300);
        return () => { if (productTimerRef.current) clearTimeout(productTimerRef.current); };
    }, [productQuery]);

    // --- Búsqueda de ubicaciones con debounce ---
    useEffect(() => {
        if (!locationQuery.trim()) { setLocationResults([]); return; }
        if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
        locationTimerRef.current = setTimeout(async () => {
            setLoadingLocations(true);
            try {
                const res = await axios.get(`${API_URL}/locations/search`, { params: { q: locationQuery } });
                setLocationResults(res.data);
            } catch { setLocationResults([]); }
            setLoadingLocations(false);
        }, 300);
        return () => { if (locationTimerRef.current) clearTimeout(locationTimerRef.current); };
    }, [locationQuery]);

    // --- Cargar ubicaciones del producto ---
    const fetchProductLocations = async (productId: number) => {
        setLoadingProductLocs(true);
        try {
            const res = await axios.get(`${API_URL}/locations/product/${productId}/locations`);
            setProductLocations(res.data);
        } catch { setProductLocations([]); }
        setLoadingProductLocs(false);
    };

    // --- Seleccionar producto ---
    const selectProduct = (p: ProductResult) => {
        setSelectedProduct(p);
        setProductQuery('');
        setProductResults([]);
        setLocationQuery('');
        setLocationResults([]);
        fetchProductLocations(p.id);
    };

    // --- Seleccionar ubicación (muestra control de cantidad) ---
    const selectLocation = (locationId: number, code: string) => {
        setPendingLocationId(locationId);
        setPendingLocationCode(code);
        setAssignQty(1);
    };

    // --- Confirmar asignación con cantidad ---
    const confirmAssign = async () => {
        if (!selectedProduct || !pendingLocationId) return;
        setAssigning(true);
        try {
            const res = await axios.post(`${API_URL}/locations/${pendingLocationId}/products`, {
                product_id: selectedProduct.id,
                quantity: assignQty,
            });
            showToast(res.data.message || "Producto asignado");
            await fetchProductLocations(selectedProduct.id);
            setLocationQuery('');
            setLocationResults([]);
            setPendingLocationId(null);
            setAssignedSuccess(true);
        } catch (err: any) {
            showToast(err.response?.data?.detail || "Error al asignar", "error");
        } finally {
            setAssigning(false);
        }
    };

    // --- Scanner ---
    const openScanner = (mode: ScanMode) => {
        setScanMode(mode);
        setShowScanner(true);
    };

    const handleScan = async (code: string) => {
        setShowScanner(false);
        if (scanMode === 'product') {
            // Buscar producto por SKU/barcode
            setLoadingProducts(true);
            try {
                const res = await axios.get(`${API_URL}/locations/search-products`, { params: { q: code } });
                if (res.data.length === 1) {
                    const p = res.data[0];
                    selectProduct(p);
                } else if (res.data.length > 1) {
                    setProductQuery(code);
                    setProductResults(res.data);
                } else {
                    setScannedBarcode(code);
                    setShowCreateProduct(true);
                }
            } catch {
                showToast("Error al buscar producto", "error");
            }
            setLoadingProducts(false);
        } else {
            // Buscar ubicación por código QR
            if (selectedProduct) {
                try {
                    const res = await axios.get(`${API_URL}/locations/by-code/${code}`);
                    if (res.data?.id) {
                        selectLocation(res.data.id, res.data.code);
                    }
                } catch {
                    showToast(`Ubicación ${code} no encontrada`, "error");
                }
            }
        }
    };

    // --- Producto creado desde ManualEntry ---
    const handleProductCreated = (product: { id: number; name: string; sku: string }) => {
        setShowCreateProduct(false);
        showToast("Producto creado");
        selectProduct({
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: 0,
            selling_price: null,
            alias: null,
            image_url: null,
        });
    };

    // --- Limpiar producto ---
    const clearProduct = () => {
        setSelectedProduct(null);
        setProductLocations([]);
        setLocationQuery('');
        setLocationResults([]);
        setAssignedSuccess(false);
        setPendingLocationId(null);
    };

    const Toast = () => (
        toast.show ? (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {toast.message}
            </div>
        ) : null
    );

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
            <Toast />

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/inventory')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Asignar Productos</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Escanea o busca un producto y asígnalo a una ubicación.</p>
                </div>
            </div>

            {/* PASO 1: Seleccionar producto */}
            {!selectedProduct ? (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent p-5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                            <Package className="w-3.5 h-3.5" /> Paso 1 — Buscar producto
                        </label>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Nombre, SKU o alias..."
                                    value={productQuery}
                                    onChange={(e) => setProductQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-900 dark:text-white"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={() => openScanner('product')}
                                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
                            >
                                <Camera className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Resultados */}
                        {loadingProducts && (
                            <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" /></div>
                        )}
                        {!loadingProducts && productResults.length > 0 && (
                            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                                {productResults.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => selectProduct(p)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors text-left"
                                    >
                                        {p.image_url ? (
                                            <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                <Package className="w-4 h-4 text-gray-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{p.sku || 'Sin SKU'}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {!loadingProducts && productQuery.trim() && productResults.length === 0 && (
                            <div className="text-center py-6">
                                <p className="text-sm text-gray-400 mb-3">No se encontraron productos</p>
                                <button
                                    onClick={() => {
                                        setScannedBarcode(productQuery);
                                        setShowCreateProduct(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Crear producto nuevo
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Producto seleccionado */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent p-5">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Producto seleccionado
                            </label>
                            <button onClick={clearProduct} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                Cambiar
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            {selectedProduct.image_url ? (
                                <img src={selectedProduct.image_url} className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-sm" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                    <Package className="w-7 h-7 text-gray-400" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight line-clamp-2">{selectedProduct.name}</h3>
                                {selectedProduct.sku && <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedProduct.sku}</p>}
                                {selectedProduct.price > 0 && <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">${selectedProduct.price.toFixed(2)}</p>}
                            </div>
                        </div>

                        {/* Ubicaciones actuales */}
                        {loadingProductLocs ? (
                            <div className="mt-4 text-center py-2"><Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" /></div>
                        ) : productLocations.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ubicaciones actuales</p>
                                <div className="flex flex-wrap gap-2">
                                    {productLocations.map(loc => (
                                        <span key={loc.location_id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                                            <MapPin className="w-3 h-3" />
                                            {loc.code}
                                            <span className="text-indigo-400 dark:text-indigo-500">({loc.quantity})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PASO 2: Seleccionar ubicación */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent p-5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                            <MapPin className="w-3.5 h-3.5" /> Paso 2 — Seleccionar ubicación
                        </label>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Código de ubicación (ej: R1B2)..."
                                    value={locationQuery}
                                    onChange={(e) => setLocationQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium font-mono text-gray-900 dark:text-white"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={() => openScanner('location')}
                                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
                            >
                                <QrCode className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Resultados ubicaciones */}
                        {loadingLocations && (
                            <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" /></div>
                        )}
                        {!loadingLocations && locationResults.length > 0 && (
                            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                                {locationResults.map(loc => {
                                    const alreadyIn = productLocations.some(pl => pl.location_id === loc.id);
                                    return (
                                        <button
                                            key={loc.id}
                                            onClick={() => selectLocation(loc.id, loc.code)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-100 font-mono">{loc.code}</p>
                                                    {loc.description && <p className="text-xs text-gray-400">{loc.description}</p>}
                                                </div>
                                            </div>
                                            {alreadyIn && <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full shrink-0">Ya asignado</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {!loadingLocations && locationQuery.trim() && locationResults.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-6">No se encontraron ubicaciones</p>
                        )}
                    </div>

                    {/* Control de cantidad antes de asignar */}
                    {pendingLocationId && !assignedSuccess && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/15 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                                    Asignar a {pendingLocationCode}
                                </span>
                            </div>
                            <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Cantidad</label>
                            <div className="flex items-center justify-center gap-4 mt-3">
                                <button
                                    onClick={() => setAssignQty(Math.max(1, assignQty - 1))}
                                    className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold text-xl shadow-sm hover:shadow-md transition-all active:scale-90 flex items-center justify-center select-none border border-gray-100 dark:border-gray-700"
                                >−</button>
                                <input
                                    type="number"
                                    min={1}
                                    value={assignQty}
                                    onChange={(e) => setAssignQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 h-12 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-center text-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white shadow-sm"
                                />
                                <button
                                    onClick={() => setAssignQty(assignQty + 1)}
                                    className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-bold text-xl shadow-sm hover:shadow-md transition-all active:scale-90 flex items-center justify-center select-none border border-gray-100 dark:border-gray-700"
                                >+</button>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => setPendingLocationId(null)}
                                    className="px-4 py-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmAssign}
                                    disabled={assigning}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/25"
                                >
                                    {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Asignar {assignQty > 1 ? `(${assignQty})` : ''}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Éxito - Asignar otro */}
                    {assignedSuccess && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/15 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4">Producto asignado correctamente</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={clearProduct}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <Camera className="w-4 h-4" /> Asignar otro producto
                                </button>
                                <button
                                    onClick={() => setAssignedSuccess(false)}
                                    className="px-4 py-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Seguir aquí
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Scanner */}
            {/* Modal crear producto - reutiliza ManualEntry */}
            {showCreateProduct && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreateProduct(false)}>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl w-full max-w-2xl shadow-2xl relative animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowCreateProduct(false)} className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            <span className="text-sm font-bold">Cancelar</span>
                        </button>
                        <ManualEntry
                            initialUpc={scannedBarcode}
                            onCreated={handleProductCreated}
                        />
                    </div>
                </div>
            )}

            {/* Scanner */}
            {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
        </div>
    );
}
