import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, X, Save, Barcode, Hash, CheckCircle2, AlertTriangle, ArrowLeft, History, ArrowRight, Camera, Filter } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { API_URL } from '../config';

// Definimos las props (incluye lo del filtro)
interface Props {
    initialFilter?: boolean;
    onClearFilter?: () => void;
}

export function PriceChecker({ initialFilter = false, onClearFilter }: Props) {
    const [products, setProducts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    // Estados del Modal, Camara y Edición
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [editUpc, setEditUpc] = useState("");
    const [editSku, setEditSku] = useState("");
    const [saving, setSaving] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Historial y Scanner
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showScanner, setShowScanner] = useState(false); // <--- Estado para mostrar la cámara

    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_URL}/invoices/products`);
            setProducts(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleProductClick = async (p: any) => {
        setSelectedProduct(p);
        setEditUpc(p.upc ? String(p.upc) : "");
        setEditSku(p.sku ? String(p.sku) : "");
        setShowExitConfirm(false);
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
        if (clean(editUpc) !== clean(selectedProduct.upc) || clean(editSku) !== clean(selectedProduct.sku)) {
            setShowExitConfirm(true);
        } else {
            setSelectedProduct(null);
        }
    };

    const handleDiscardChanges = () => { setShowExitConfirm(false); setSelectedProduct(null); };

    const handleSaveField = async (field: 'upc' | 'sku') => {
        if (!selectedProduct) return;
        setSaving(true);
        try {
            const cleanValue = field === 'upc' ? editUpc.trim() : editSku.trim();
            const payload = field === 'upc' ? { upc: cleanValue } : { sku: cleanValue };
            await axios.put(`${API_URL}/invoices/products/${selectedProduct.id}`, payload);
            const updatedProducts = products.map(p => p.id === selectedProduct.id ? { ...p, ...payload } : p);
            setProducts(updatedProducts);
            setSelectedProduct((prev: any) => ({ ...prev, ...payload }));
            if (field === 'upc') setEditUpc(cleanValue);
            if (field === 'sku') setEditSku(cleanValue);
            showToast(`${field === 'upc' ? 'CÓDIGO' : 'ID'} GUARDADO`);
        } catch (error) { showToast("Error al guardar.", 'error'); } finally { setSaving(false); }
    };

    // ✅ Función que se ejecuta cuando la cámara lee un código
    const handleScanSuccess = (code: string) => {
        setEditUpc(code);
        setShowScanner(false);
        showToast("Código escaneado");
    };

    // FILTRO MAESTRO (Texto + "Sin Precio")
    const filteredProducts = products.filter(p => {
        const term = searchTerm.toLowerCase();
        const textMatch =
            p.name.toLowerCase().includes(term) ||
            (p.sku && String(p.sku).toLowerCase().includes(term)) ||
            (p.upc && String(p.upc).toLowerCase().includes(term)) ||
            (p.selling_price && String(p.selling_price).includes(term));
        const missingPriceCondition = initialFilter ? (!p.selling_price || parseFloat(p.selling_price) <= 0) : true;
        return textMatch && missingPriceCondition;
    });

    return (
        <div className="w-full max-w-4xl mx-auto p-4 pb-24 relative">

            {/* TOAST */}
            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                </div>
            </div>

            {/* BUSCADOR + AVISO DE FILTRO */}
            <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur pt-2 pb-4 space-y-2">
                {initialFilter && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between animate-fade-in shadow-sm">
                        <div className="flex items-center gap-2 text-orange-700">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm font-bold">Mostrando solo productos sin precio</span>
                        </div>
                        <button onClick={onClearFilter} className="text-xs bg-white px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 font-bold hover:bg-orange-100 transition-colors">Ver Todos</button>
                    </div>
                )}
                <div className="relative shadow-sm group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-6 w-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input type="text" className="block w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-shadow" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* LISTA */}
            {loading ? (
                <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p>Cargando inventario...</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <p>No se encontraron productos.</p>
                            {initialFilter && <button onClick={onClearFilter} className="text-blue-500 font-bold mt-2">Borrar filtros</button>}
                        </div>
                    ) : (
                        filteredProducts.map((p, i) => (
                            <div key={i} onClick={() => handleProductClick(p)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:bg-blue-50 active:scale-[0.99] transition-all cursor-pointer hover:shadow-md">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h3 className="font-bold text-gray-800 text-base leading-tight mb-1">{p.name}</h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-mono">ID: {p.sku}</span>
                                        {p.upc && <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-mono border border-yellow-100">UPC: {p.upc}</span>}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    {(!p.selling_price || p.selling_price === 0) ? (
                                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-lg text-xs font-bold">Sin Precio</span>
                                    ) : (
                                        <div className="text-2xl font-black text-blue-600 tracking-tight">${p.selling_price?.toFixed(2)}</div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* --- MODAL PRINCIPAL --- */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="absolute inset-0" onClick={handleAttemptClose}></div>
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in relative z-10 flex flex-col max-h-[90vh]">

                        {/* HEADER DEL MODAL */}
                        <div className="bg-blue-600 p-8 text-white relative text-center shrink-0">
                            <button onClick={handleAttemptClose} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors active:scale-90"><X className="w-6 h-6 text-white" /></button>
                            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2">Precio de Venta</p>
                            <h2 className="text-7xl font-black tracking-tighter drop-shadow-lg">${selectedProduct.selling_price?.toFixed(2)}</h2>
                        </div>

                        {/* SWITCHER */}
                        <div className="bg-blue-50 p-2 flex gap-2">
                            <button onClick={() => setShowHistory(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${!showHistory ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Datos Generales</button>
                            <button onClick={() => setShowHistory(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${showHistory ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'} flex items-center justify-center gap-1`}><History className="w-3 h-3" /> Historial</button>
                        </div>

                        {/* CONTENIDO MODAL */}
                        <div className="p-6 space-y-6 bg-white overflow-y-auto">
                            {!showHistory ? (
                                <>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-wide">Producto</label>
                                        <p className="text-gray-800 font-medium text-sm leading-relaxed">{selectedProduct.name}</p>
                                    </div>
                                    <div className="space-y-4">
                                        {/* SECCION UPC CON CAMARA */}
                                        <div className={`transition-all ${String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() ? 'bg-yellow-50 p-3 rounded-2xl border border-yellow-200' : ''}`}>
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2 tracking-wide"><Barcode className="w-4 h-4 text-blue-500" /> UPC {String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() && <span className="text-yellow-600 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={editUpc} onChange={(e) => setEditUpc(e.target.value)} className="flex-1 bg-white border border-gray-200 text-gray-900 font-mono text-lg p-3 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="Escanear..." />

                                                {/* BOTÓN CAMARA */}
                                                <button onClick={() => setShowScanner(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-3 rounded-xl transition-colors active:scale-95" title="Escanear con cámara">
                                                    <Camera className="w-6 h-6" />
                                                </button>

                                                <button onClick={() => handleSaveField('upc')} disabled={saving || String(editUpc || "").trim() === String(selectedProduct.upc || "").trim()} className={`px-4 rounded-xl transition-all shadow-md flex items-center justify-center ${String(editUpc || "").trim() !== String(selectedProduct.upc || "").trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}><Save className="w-6 h-6" /></button>
                                            </div>
                                        </div>

                                        {/* SECCION SKU */}
                                        <div className={`transition-all ${String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() ? 'bg-yellow-50 p-3 rounded-2xl border border-yellow-200' : ''}`}>
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2 tracking-wide"><Hash className="w-4 h-4 text-purple-500" /> ID Interno {String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() && <span className="text-yellow-600 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={editSku} onChange={(e) => setEditSku(e.target.value)} className="flex-1 bg-white border border-gray-200 text-gray-900 font-mono text-lg p-3 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all" placeholder="Clave..." />
                                                <button onClick={() => handleSaveField('sku')} disabled={saving || String(editSku || "").trim() === String(selectedProduct.sku || "").trim()} className={`px-4 rounded-xl transition-all shadow-md flex items-center justify-center ${String(editSku || "").trim() !== String(selectedProduct.sku || "").trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}><Save className="w-6 h-6" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    {history.length === 0 ? <p className="text-center text-gray-400 py-10 italic">No hay historial.</p> :
                                        <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-4">
                                            {history.map((h, i) => (
                                                <div key={i} className="relative pl-6">
                                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${h.type === 'COSTO' ? 'bg-orange-400' : 'bg-green-500'}`}></div>
                                                    <div className="flex justify-between items-start">
                                                        <div><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${h.type === 'COSTO' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{h.type === 'COSTO' ? 'Costo Compra' : 'Precio Venta'}</span><p className="text-xs text-gray-400 mt-1">{new Date(h.date).toLocaleDateString()}</p></div>
                                                        <div className="text-right"><div className="flex items-center gap-1 justify-end font-bold text-gray-800"><span className="text-gray-400 line-through text-xs">${h.old.toFixed(2)}</span><ArrowRight className="w-3 h-3 text-gray-300" /><span>${h.new.toFixed(2)}</span></div></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                </div>
                            )}
                        </div>

                        {showExitConfirm && (
                            <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                                <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 max-w-xs w-full">
                                    <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600"><AlertTriangle className="w-8 h-8" /></div>
                                    <h3 className="text-xl font-black text-gray-900 mb-2">¡Espera!</h3>
                                    <p className="text-gray-500 text-sm mb-6">Tienes cambios sin guardar.</p>
                                    <div className="space-y-3">
                                        <button onClick={() => setShowExitConfirm(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Regresar</button>
                                        <button onClick={handleDiscardChanges} className="w-full text-red-500 hover:bg-red-50 font-bold py-3 rounded-xl transition-colors text-sm">Salir sin guardar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* COMPONENTE ESCANER RENDERIZADO */}
            {showScanner && <BarcodeScanner onScan={handleScanSuccess} onClose={() => setShowScanner(false)} />}
        </div>
    );
}