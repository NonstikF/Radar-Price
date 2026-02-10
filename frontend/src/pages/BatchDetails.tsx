import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeft, FileText, Save, Loader2, AlertTriangle, CheckCircle2,
    Barcode, Box, Search, X, Camera, Filter, Tag, ChevronLeft
} from 'lucide-react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { API_URL } from '../config';

// ==========================================
// 1. SUB-COMPONENTE: Tarjeta Móvil
// ==========================================
const BatchItemCard = React.memo(({ p, onPriceUpdate, onUpcUpdate, onAliasUpdate }: any) => {
    const [localPrice, setLocalPrice] = useState(p.selling_price || '');
    const [localUpc, setLocalUpc] = useState(p.upc || '');
    const [localAlias, setLocalAlias] = useState(p.alias || '');

    useEffect(() => {
        setLocalPrice(p.selling_price || '');
        setLocalUpc(p.upc || '');
        setLocalAlias(p.alias || '');
    }, [p.selling_price, p.upc, p.alias]);

    const costo = p.price || 0;
    const venta = parseFloat(localPrice) || 0;
    const cantidad = p.quantity !== undefined ? p.quantity : 0;
    const margen = venta > 0 ? ((venta - costo) / venta * 100) : 0;
    const tienePrecio = venta > 0;

    const cardClass = tienePrecio
        ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm";

    const inputClass = tienePrecio
        ? "text-green-700 dark:text-green-300 border-green-200 focus:ring-green-500 bg-white dark:bg-gray-900"
        : "text-red-700 dark:text-red-300 border-red-300 focus:ring-red-500 bg-white dark:bg-gray-900 ring-1 ring-red-100 dark:ring-red-900/30";

    return (
        <div className={`p-4 rounded-xl border transition-all ${cardClass}`}>
            <div className="mb-3">
                <div className="flex justify-between items-start gap-2">
                    <div className="w-[85%]">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                <Box className="w-3 h-3" /> x{cantidad}
                            </span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{p.name}</h3>

                        {/* INPUT DE ALIAS MÓVIL */}
                        <div className="mt-2 flex items-center gap-2">
                            <Tag className="w-3 h-3 text-purple-500" />
                            <input
                                type="text"
                                value={localAlias}
                                onChange={(e) => setLocalAlias(e.target.value)}
                                onBlur={() => onAliasUpdate(p.id, localAlias)}
                                placeholder="Agregar alias/apodo..."
                                className="text-xs w-full bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-purple-500 outline-none text-purple-700 dark:text-purple-300 placeholder-gray-400"
                            />
                        </div>

                    </div>
                    {tienePrecio
                        ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        : <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    }
                </div>
                <div className="flex flex-col gap-1 mt-2 pl-1">
                    <p className="text-xs text-gray-400 font-mono">SKU: {p.sku || 'N/A'}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Barcode className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={localUpc}
                            onChange={(e) => setLocalUpc(e.target.value)}
                            onBlur={() => onUpcUpdate(p.id, localUpc)}
                            placeholder="UPC..."
                            className="text-xs border-b border-gray-300 dark:border-gray-600 bg-transparent focus:border-blue-500 outline-none w-full py-1 text-gray-700 dark:text-gray-200"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end bg-white/50 dark:bg-gray-800/50 p-2 rounded-lg mt-3">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Costo Unit.</p>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">${costo.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Total: ${(costo * cantidad).toFixed(2)}</p>
                </div>
                <div>
                    <p className={`text-[10px] uppercase font-bold mb-1 ${tienePrecio ? 'text-green-600' : 'text-red-500'}`}>Precio Venta</p>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input
                            type="number"
                            value={localPrice}
                            onChange={(e) => setLocalPrice(e.target.value)}
                            onBlur={() => onPriceUpdate(p.id, localPrice)}
                            className={`w-full pl-5 pr-2 py-2 text-sm font-bold text-right border rounded-lg focus:ring-2 outline-none transition-colors ${inputClass}`}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="text-right mt-1">
                        <span className={`text-[10px] font-bold ${margen > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            Margen: {margen > 0 ? `${margen.toFixed(0)}%` : '-'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});

// ==========================================
// 2. SUB-COMPONENTE: Fila Escritorio
// ==========================================
const BatchItemRow = React.memo(({ p, onPriceUpdate, onUpcUpdate, onAliasUpdate }: any) => {
    const [localPrice, setLocalPrice] = useState(p.selling_price || '');
    const [localUpc, setLocalUpc] = useState(p.upc || '');
    const [localAlias, setLocalAlias] = useState(p.alias || '');

    useEffect(() => {
        setLocalPrice(p.selling_price || '');
        setLocalUpc(p.upc || '');
        setLocalAlias(p.alias || '');
    }, [p.selling_price, p.upc, p.alias]);

    const costo = p.price || 0;
    const venta = parseFloat(localPrice) || 0;
    const cantidad = p.quantity !== undefined ? p.quantity : 0;
    const margen = venta > 0 ? ((venta - costo) / venta * 100) : 0;
    const tienePrecio = venta > 0;

    const rowClass = tienePrecio
        ? "bg-green-50/30 hover:bg-green-50 dark:bg-green-900/10 dark:hover:bg-green-900/20"
        : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700";

    const inputClass = tienePrecio
        ? "text-green-700 border-green-200 focus:ring-green-500 bg-white"
        : "text-red-600 border-red-300 focus:ring-red-500 bg-white shadow-sm ring-1 ring-red-100";

    return (
        <tr className={`transition-colors ${rowClass}`}>
            <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku || '-'}</td>
            <td className="px-4 py-3">
                <div className="relative group w-32">
                    <input
                        type="text"
                        value={localUpc}
                        onChange={(e) => setLocalUpc(e.target.value)}
                        onBlur={() => onUpcUpdate(p.id, localUpc)}
                        className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-blue-500 outline-none font-mono text-xs text-gray-600 dark:text-gray-400 focus:text-gray-900 dark:focus:text-white py-1 transition-colors"
                        placeholder="---"
                    />
                    <Barcode className="w-3 h-3 text-gray-300 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </td>

            {/* NOMBRE Y ALIAS */}
            <td className="px-4 py-3">
                <div className="flex flex-col justify-center">
                    <span className="font-medium text-gray-900 dark:text-white text-sm max-w-xs truncate" title={p.name}>
                        {p.name}
                    </span>
                    <div className="flex items-center gap-1 mt-1 group/alias">
                        <Tag className="w-3 h-3 text-purple-400 opacity-50 group-hover/alias:opacity-100" />
                        <input
                            type="text"
                            value={localAlias}
                            onChange={(e) => setLocalAlias(e.target.value)}
                            onBlur={() => onAliasUpdate(p.id, localAlias)}
                            placeholder="Agregar alias..."
                            className="text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 outline-none text-purple-600 dark:text-purple-300 placeholder-gray-400/50 w-full transition-all"
                        />
                    </div>
                </div>
            </td>

            <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold">
                    {cantidad}
                </span>
            </td>
            <td className="px-4 py-3 text-right text-gray-500 text-xs">
                <div>${costo.toFixed(2)}</div>
                <div className="text-[10px] text-gray-400">Total: ${(costo * cantidad).toFixed(0)}</div>
            </td>
            <td className="px-4 py-2 w-32">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                        type="number"
                        value={localPrice}
                        onChange={(e) => setLocalPrice(e.target.value)}
                        onBlur={() => onPriceUpdate(p.id, localPrice)}
                        className={`w-full pl-6 pr-2 py-1.5 border rounded-lg focus:ring-2 font-bold text-right outline-none transition-all ${inputClass}`}
                        placeholder="0.00"
                    />
                </div>
            </td>
            <td className={`px-4 py-3 text-center font-bold text-xs ${margen > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                {margen > 0 ? `${margen.toFixed(0)}%` : '-'}
            </td>
            <td className="px-4 py-3 text-center">
                {tienePrecio
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                    : <AlertTriangle className="w-5 h-5 text-red-400 mx-auto opacity-50" />
                }
            </td>
        </tr>
    );
});


// ==========================================
// 3. COMPONENTE PRINCIPAL (Padre)
// ==========================================
export function BatchDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [error, setError] = useState("");

    // Estados de control de cambios y navegación
    const [hasChanges, setHasChanges] = useState(false);
    const [showExitPrompt, setShowExitPrompt] = useState(false);

    const [filter, setFilter] = useState<'all' | 'missing' | 'ready'>('all');
    const [searchTerm, setSearchTerm] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    // --- PROTECCIÓN CONTRA CIERRE DE NAVEGADOR ---
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = ''; // Necesario para Chrome
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    useEffect(() => {
        const fetchBatchData = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_URL}/invoices/batches/${id}/products`);
                setProducts(response.data);
                setHasChanges(false); // Reset al cargar
            } catch (err) {
                console.error(err);
                setError("No se pudo cargar la información del lote.");
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchBatchData();
    }, [id]);

    // --- MANEJO SEGURO DE RETROCESO ---
    const handleBack = () => {
        if (hasChanges) {
            setShowExitPrompt(true);
        } else {
            navigate('/history');
        }
    };

    const handleDiscardAndExit = () => {
        setShowExitPrompt(false);
        setHasChanges(false);
        navigate('/history');
    };

    // --- UPDATERS CON FLAG DE CAMBIOS ---
    const handlePriceUpdate = useCallback((productId: number, newPrice: string) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, selling_price: newPrice } : p
        ));
        setHasChanges(true); // Marca sucio
    }, []);

    const handleUpcUpdate = useCallback((productId: number, newUpc: string) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, upc: newUpc } : p
        ));
        setHasChanges(true); // Marca sucio
    }, []);

    const handleAliasUpdate = useCallback((productId: number, newAlias: string) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, alias: newAlias } : p
        ));
        setHasChanges(true); // Marca sucio
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = products.map(p => ({
                id: p.id,
                name: p.name,
                selling_price: parseFloat(p.selling_price) || 0,
                upc: p.upc || "",
                alias: p.alias || ""
            }));
            await axios.post(`${API_URL}/invoices/update-prices`, updates);
            setSuccessMsg("Guardado");
            setHasChanges(false); // Limpia estado sucio
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
            alert("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    const handleScanSuccess = (code: string) => {
        setSearchTerm(code);
        setShowScanner(false);
    };

    const stats = useMemo(() => {
        const totalItems = products.length;
        const totalPiezas = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
        const itemsReady = products.filter(p => parseFloat(p.selling_price) > 0).length;
        const itemsMissing = totalItems - itemsReady;
        const progress = totalItems > 0 ? Math.round((itemsReady / totalItems) * 100) : 0;
        return { totalItems, itemsReady, itemsMissing, progress, totalPiezas };
    }, [products]);

    // --- FILTRADO AVANZADO ---
    const displayedProducts = useMemo(() => {
        return products.filter(p => {
            const hasPrice = parseFloat(p.selling_price) > 0;
            if (filter === 'missing' && hasPrice) return false;
            if (filter === 'ready' && !hasPrice) return false;

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchName = p.name?.toLowerCase().includes(term);
                const matchSku = p.sku?.toLowerCase().includes(term);
                const matchUpc = p.upc?.toLowerCase().includes(term);
                const matchAlias = p.alias?.toLowerCase().includes(term);
                if (!matchName && !matchSku && !matchUpc && !matchAlias) return false;
            }
            return true;
        });
    }, [products, filter, searchTerm]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-600" />
            <p>Cargando detalles...</p>
        </div>
    );

    if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 pb-24 animate-fade-in relative">

            {/* HEADER SUPERIOR */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <button onClick={handleBack} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium mb-2 text-sm">
                        <ArrowLeft className="w-4 h-4" /> Volver al Historial
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                            <FileText className="w-8 h-8 md:w-6 md:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white truncate">Importación #{id}</h1>
                            <div className="flex items-center gap-2 mt-1 w-full max-w-[200px]">
                                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${stats.progress}%` }}></div>
                                </div>
                                <span className="font-bold text-green-600 text-xs">{stats.progress}%</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Indicador de Cambios sin Guardar */}
                    {hasChanges && <span className="text-orange-500 text-xs font-bold animate-pulse flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sin guardar</span>}

                    {successMsg && <span className="text-green-600 dark:text-green-400 text-xs font-bold animate-pulse flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg whitespace-nowrap"><CheckCircle2 className="w-4 h-4" /> {successMsg}</span>}
                    <button onClick={handleSave} disabled={saving} className={`flex-1 md:flex-none hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base ${hasChanges ? 'bg-green-600 ring-2 ring-green-400 ring-offset-2 dark:ring-offset-gray-900' : 'bg-green-600'}`}>
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            {/* BARRA DE HERRAMIENTAS STICKY */}
            <div className="sticky top-16 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur py-2 -mx-4 px-4 md:mx-0 md:px-0">
                <div className="space-y-3">
                    {/* BUSCADOR */}
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Buscar por nombre, SKU, UPC o Alias..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-900 dark:text-white text-sm"
                            />
                            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                        <X className="h-5 w-5" />
                                    </button>
                                )}
                                <button onClick={() => setShowScanner(true)} className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95" title="Escanear">
                                    <Camera className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* FILTROS VISIBLES */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filter === 'all' ? 'bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 shadow-sm'}`}>
                            Todos <span className="opacity-60">({stats.totalItems})</span>
                        </button>
                        <button onClick={() => setFilter('missing')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filter === 'missing' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' : 'bg-white text-gray-500 border-gray-300 hover:bg-orange-50 hover:text-orange-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 shadow-sm'}`}>
                            <AlertTriangle className="w-3 h-3" /> Faltan Precio <span className="opacity-80">({stats.itemsMissing})</span>
                        </button>
                        <button onClick={() => setFilter('ready')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${filter === 'ready' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' : 'bg-white text-gray-500 border-gray-300 hover:bg-green-50 hover:text-green-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 shadow-sm'}`}>
                            <CheckCircle2 className="w-3 h-3" /> Listos <span className="opacity-80">({stats.itemsReady})</span>
                        </button>

                        {/* Info Total Piezas */}
                        <div className="ml-auto px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl whitespace-nowrap border border-blue-100 dark:border-blue-800/50 hidden md:block">
                            Total Piezas: {stats.totalPiezas}
                        </div>
                    </div>
                </div>
            </div>

            {/* LISTA DE RESULTADOS */}
            {displayedProducts.length === 0 ? (
                <div className="text-center py-20 text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No se encontraron productos{searchTerm ? ` para "${searchTerm}"` : ''}.</p>
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-2 text-blue-500 hover:underline text-sm">Limpiar búsqueda</button>}
                </div>
            ) : (
                <>
                    {/* VISTA MÓVIL */}
                    <div className="md:hidden space-y-4">
                        {displayedProducts.map(p => (
                            <BatchItemCard key={p.id} p={p} onPriceUpdate={handlePriceUpdate} onUpcUpdate={handleUpcUpdate} onAliasUpdate={handleAliasUpdate} />
                        ))}
                    </div>

                    {/* VISTA ESCRITORIO */}
                    <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase text-xs font-bold">
                                <tr>
                                    <th className="px-4 py-3 w-28">SKU</th>
                                    <th className="px-4 py-3 w-36">Cód. Barras</th>
                                    <th className="px-4 py-3">Producto / Alias</th>
                                    <th className="px-4 py-3 text-center w-20">Cant.</th>
                                    <th className="px-4 py-3 text-right">Costo</th>
                                    <th className="px-4 py-3 text-center w-40">Precio Venta</th>
                                    <th className="px-4 py-3 text-center w-20">Margen</th>
                                    <th className="px-4 py-3 text-center w-16">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {displayedProducts.map(p => (
                                    <BatchItemRow key={p.id} p={p} onPriceUpdate={handlePriceUpdate} onUpcUpdate={handleUpcUpdate} onAliasUpdate={handleAliasUpdate} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* MODAL DE CONFIRMACIÓN DE SALIDA */}
            {showExitPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-xs w-full animate-scale-in">
                        <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-8 h-8" /></div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 text-center">¡Espera!</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 text-center">Tienes cambios sin guardar. ¿Seguro que quieres salir?</p>
                        <div className="space-y-3">
                            <button onClick={() => setShowExitPrompt(false)} className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><ChevronLeft className="w-4 h-4" /> Cancelar</button>
                            <button onClick={handleDiscardAndExit} className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold py-3 rounded-xl transition-colors text-sm">Salir sin guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ESCÁNER MODAL */}
            {showScanner && (
                <BarcodeScanner onScan={handleScanSuccess} onClose={() => setShowScanner(false)} />
            )}
        </div>
    );
}