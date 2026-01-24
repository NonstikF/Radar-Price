import { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, Save, FileText, Loader2, DollarSign, Package, EyeOff, GitMerge, ArrowRight, CheckCircle2, Trash2, Database, AlertCircle, FileStack } from 'lucide-react';
import { API_URL } from '../config';

interface Props {
    products: any[];
    setProducts: (products: any[]) => void;
}

export function InvoiceUploader({ products, setProducts }: Props) {
    // --- ESTADOS CARGA NORMAL (FACTURAS) ---
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [hiddenCount, setHiddenCount] = useState(0);
    const [savedMessage, setSavedMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- ESTADOS CARGA CATÁLOGO ESPECIAL (MASIVA) ---
    const [catalogFiles, setCatalogFiles] = useState<File[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogProgress, setCatalogProgress] = useState({ current: 0, total: 0, successes: 0, errors: 0 });
    const [catalogMsg, setCatalogMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const catalogInputRef = useRef<HTMLInputElement>(null);

    // Control de menús de fusión (Normal)
    const [mergeMenuOpen, setMergeMenuOpen] = useState<number | null>(null);
    const [pendingMerge, setPendingMerge] = useState<{ discardIndex: number, keepId: number, targetName: string } | null>(null);


    // --- HANDLERS NORMALES (CARGA DE FACTURA) ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
    };

    const handleClearAll = () => {
        setProducts([]);
        setFile(null);
        setHiddenCount(0);
        setSavedMessage("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setProducts([]);
        setHiddenCount(0);
        setSavedMessage("");

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Este endpoint guarda automáticamente en el historial (ImportBatch)
            const response = await axios.post(`${API_URL}/invoices/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setProducts(response.data.products);
            setHiddenCount(response.data.hidden_count || 0);
        } catch (error) {
            console.error(error);
            alert("Error al cargar XML. Verifica tu conexión e IP.");
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS CATÁLOGO ESPECIAL (MASIVO - MÚLTIPLES ARCHIVOS) ---
    const handleCatalogChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Convertimos FileList a Array real para poder iterar
            setCatalogFiles(Array.from(e.target.files));
            setCatalogMsg(null);
            setCatalogProgress({ current: 0, total: 0, successes: 0, errors: 0 });
        }
    };

    const handleCatalogUpload = async () => {
        if (catalogFiles.length === 0) return;

        setCatalogLoading(true);
        setCatalogMsg(null);

        let createdTotal = 0;
        let updatedTotal = 0;
        let errorsCount = 0;

        // Inicializamos progreso
        setCatalogProgress({ current: 0, total: catalogFiles.length, successes: 0, errors: 0 });

        // Procesamos UNO POR UNO para no saturar el servidor (Cola secuencial)
        for (let i = 0; i < catalogFiles.length; i++) {
            const file = catalogFiles[i];
            const formData = new FormData();
            formData.append('file', file);

            try {
                // Actualizamos UI: "Procesando archivo X..."
                setCatalogProgress(prev => ({ ...prev, current: i + 1 }));

                // Este endpoint TAMBIÉN guarda historial
                const response = await axios.post(`${API_URL}/invoices/upload-catalog`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                createdTotal += response.data.created || 0;
                updatedTotal += response.data.updated || 0;

            } catch (error) {
                console.error(`Error en archivo ${file.name}`, error);
                errorsCount++;
                setCatalogProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
            }
        }

        // Resumen Final
        setCatalogLoading(false);
        setCatalogMsg({
            type: errorsCount === catalogFiles.length ? 'error' : 'success',
            text: `Proceso finalizado. ${createdTotal} creados, ${updatedTotal} actualizados. (${errorsCount} errores). Revisa el Historial.`
        });

        // Limpiar inputs
        setCatalogFiles([]);
        if (catalogInputRef.current) catalogInputRef.current.value = "";
    };


    // ... (Funciones de precios y fusión se mantienen igual) ...
    const handlePriceChange = (index: number, newPrice: string) => {
        const updatedProducts = [...products];
        updatedProducts[index].selling_price = newPrice;
        setProducts(updatedProducts);
    };

    const handleSavePrices = async () => {
        setLoading(true);
        try {
            const updates = products.map(p => ({
                name: p.name,
                selling_price: p.selling_price || 0
            }));
            await axios.post(`${API_URL}/invoices/update-prices`, updates);
            setSavedMessage("¡Precios guardados correctamente! ✅");
            setTimeout(() => { handleClearAll(); }, 1500);
        } catch (error) {
            alert("Error al guardar precios");
        } finally {
            setLoading(false);
        }
    };

    const initiateMerge = (discardProductIndex: number, keepDbId: number, targetName: string) => {
        setPendingMerge({ discardIndex: discardProductIndex, keepId: keepDbId, targetName: targetName });
        setMergeMenuOpen(null);
    };

    const executeMerge = async () => {
        if (!pendingMerge) return;
        setLoading(true);
        const productToDiscard = products[pendingMerge.discardIndex];
        try {
            await axios.post(`${API_URL}/invoices/merge`, { keep_id: pendingMerge.keepId, discard_id: productToDiscard.id });
            const newProducts = products.filter((_, i) => i !== pendingMerge.discardIndex);
            setProducts(newProducts);
            setPendingMerge(null);
        } catch (error) { alert("Error al fusionar."); } finally { setLoading(false); }
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 pb-24 relative space-y-8 animate-fade-in">

            {/* --- ZONA 1: CARGA NORMAL (FACTURAS) --- */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                        <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Cargar Factura (Actualizar Precios)</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sube tu XML para detectar cambios de costo y ajustar precios.</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xml"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300 dark:hover:file:bg-blue-900/50"
                        />
                    </div>
                    <button onClick={handleUpload} disabled={!file || loading} className="w-full md:w-auto bg-blue-600 dark:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 active:scale-95">
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        {loading ? 'Procesando...' : 'Cargar Lista'}
                    </button>
                </div>
            </div>

            {/* --- ZONA 2: CARGA ESPECIAL MASIVA --- */}
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl shadow-sm p-6 border border-purple-200 dark:border-purple-800 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                        <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Importador Masivo de Catálogo</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Soporta múltiples archivos. Reglas:
                            <span className="bg-white dark:bg-gray-800 px-2 py-0.5 rounded mx-1 font-mono text-xs border border-gray-200 dark:border-gray-700">ClaveProdServ ➔ UPC</span>
                            <span className="bg-white dark:bg-gray-800 px-2 py-0.5 rounded mx-1 font-mono text-xs border border-gray-200 dark:border-gray-700">NoIdentificacion ➔ SKU</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                        {/* INPUT MÚLTIPLE */}
                        <input
                            ref={catalogInputRef}
                            type="file"
                            accept=".xml"
                            multiple // <--- ESTO PERMITE SELECCIONAR LOS 64 ARCHIVOS
                            onChange={handleCatalogChange}
                            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 dark:file:bg-purple-900/30 dark:file:text-purple-300 dark:hover:file:bg-purple-900/50"
                        />
                        {catalogFiles.length > 0 && !catalogLoading && (
                            <p className="mt-2 text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 animate-fade-in">
                                <FileStack className="w-4 h-4" /> {catalogFiles.length} archivos seleccionados
                            </p>
                        )}
                    </div>
                    <button onClick={handleCatalogUpload} disabled={catalogFiles.length === 0 || catalogLoading} className="w-full md:w-auto bg-purple-600 dark:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors shadow-lg shadow-purple-500/20 active:scale-95">
                        {catalogLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
                        {catalogLoading ? `Importando ${catalogProgress.current}/${catalogProgress.total}` : 'Importar Todo'}
                    </button>
                </div>

                {/* BARRA DE PROGRESO */}
                {catalogLoading && (
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden animate-fade-in">
                        <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(catalogProgress.current / catalogProgress.total) * 100}%` }}></div>
                    </div>
                )}

                {/* MENSAJES DEL CATÁLOGO */}
                {catalogMsg && (
                    <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 text-sm font-medium animate-fade-in ${catalogMsg.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {catalogMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {catalogMsg.text}
                    </div>
                )}
            </div>

            {/* MENSAJE DE OCULTOS (NORMAL) */}
            {hiddenCount > 0 && (
                <div className="mb-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-3 rounded-xl text-xs md:text-sm flex items-center gap-2 border border-gray-200 dark:border-gray-700 animate-fade-in">
                    <EyeOff className="w-4 h-4 shrink-0" />
                    <span>Se ocultaron <b>{hiddenCount} productos</b> sin cambios de precio y con precio de venta ya asignado.</span>
                </div>
            )}

            {/* --- LISTA DE PRODUCTOS (SOLO APARECE AL USAR EL CARGADOR NORMAL) --- */}
            {products.length > 0 && (
                <div className="animate-fade-in pt-4 border-t border-gray-200 dark:border-gray-700">
                    {/* Header Sticky */}
                    <div className="sticky top-2 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-md rounded-xl p-3 md:p-4 mb-4 border border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3 transition-colors">
                        <div className="flex flex-col">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 text-base md:text-lg">
                                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                                <span>Gestión de Precios</span>
                            </h3>
                            <span className="text-gray-400 dark:text-gray-500 text-xs md:hidden">({products.length} visibles)</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* BOTÓN LIMPIAR LISTA */}
                            <button
                                onClick={handleClearAll}
                                title="Limpiar lista"
                                className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-2 md:px-4 md:py-2 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span className="hidden md:inline">Limpiar</span>
                            </button>

                            {savedMessage ? (
                                <span className="text-green-600 dark:text-green-400 font-bold px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900 animate-pulse text-sm">
                                    {savedMessage}
                                </span>
                            ) : (
                                <button onClick={handleSavePrices} disabled={loading} className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 md:px-6 rounded-xl font-bold hover:bg-green-700 dark:hover:bg-green-600 shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center gap-2 text-sm md:text-base">
                                    <Save className="w-5 h-5" />
                                    <span>Guardar</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* --- VISTA MÓVIL (TARJETAS) --- */}
                    <div className="md:hidden space-y-3">
                        {products.map((p, i) => {
                            const costo = p.cost_with_tax || 0;
                            const venta = parseFloat(p.selling_price) || 0;
                            const margen = venta > 0 ? ((venta - costo) / venta * 100) : 0;
                            const isPriceChanged = p.status === 'price_changed';
                            const isNewWithSuggestions = p.status === 'new' && p.suggestions?.length > 0;

                            return (
                                <div key={i} className={`p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden transition-colors ${isPriceChanged ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : 'bg-white dark:bg-gray-800'}`}>
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {isPriceChanged && <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-[10px] font-bold px-2 py-1 rounded-md border border-yellow-200 dark:border-yellow-800">⚠️ Costo Cambió</span>}
                                        {p.status === 'new' && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-1 rounded-md border border-blue-200 dark:border-blue-800">NUEVO</span>}
                                    </div>
                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-snug">{p.name}</h4>
                                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded-lg shrink-0 flex items-center gap-1">
                                            <Package className="w-3 h-3" /> {p.qty}
                                        </span>
                                    </div>
                                    {isNewWithSuggestions && (
                                        <div className="mb-3">
                                            <button onClick={() => setMergeMenuOpen(mergeMenuOpen === i ? null : i)} className="w-full bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 active:bg-orange-100 dark:active:bg-orange-900/40 transition-colors">
                                                <GitMerge className="w-4 h-4" />
                                                {mergeMenuOpen === i ? 'Cerrar sugerencias' : '¿Es duplicado? Ver opciones'}
                                            </button>
                                            {mergeMenuOpen === i && (
                                                <div className="mt-2 space-y-2 animate-scale-in">
                                                    {p.suggestions.map((s: any) => (
                                                        <button key={s.id} onClick={() => initiateMerge(i, s.id, s.name)} className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 rounded-lg shadow-sm active:bg-orange-50 dark:active:bg-gray-700 transition-colors">
                                                            <div className="text-xs font-bold text-gray-800 dark:text-white mb-1">Fusionar con: {s.name}</div>
                                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between">
                                                                <span>Costo BD: ${s.price}</span>
                                                                <span className="text-blue-600 dark:text-blue-400 font-bold">Clic para unir</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase font-bold tracking-wide">
                                                <span>Costo: ${p.cost_with_tax?.toFixed(2)}</span>
                                                {isPriceChanged && <span className="text-yellow-600 dark:text-yellow-400">Ant: ${p.old_cost?.toFixed(2)}</span>}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold">$</span>
                                                <input type="number" value={p.selling_price === 0 ? '' : p.selling_price} onChange={(e) => handlePriceChange(i, e.target.value)} className="w-full pl-8 pr-3 py-3 border border-blue-200 dark:border-blue-900/50 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-blue-900 dark:text-blue-200 text-lg bg-blue-50/30 dark:bg-gray-700" placeholder="0.00" />
                                            </div>
                                        </div>
                                        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 shrink-0 ${margen > 0 ? 'border-green-100 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400' : 'border-gray-100 bg-gray-50 text-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-500'}`}>
                                            <span className="text-[10px] font-bold">{margen > 0 ? margen.toFixed(0) : '-'}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* --- VISTA ESCRITORIO (TABLA) --- */}
                    <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-visible transition-colors">
                        <div className="overflow-visible">
                            <table className="min-w-full text-sm text-left">
                                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase text-xs font-bold">
                                    <tr>
                                        <th className="px-4 py-3 w-32">Estado</th>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3 text-center">Cant.</th>
                                        <th className="px-4 py-3 text-right">Costo</th>
                                        <th className="px-4 py-3 text-center bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l border-blue-100 dark:border-blue-800 w-40">PRECIO VENTA</th>
                                        <th className="px-4 py-3 text-right">Margen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {products.map((p, i) => {
                                        const costo = p.cost_with_tax || 0;
                                        const venta = parseFloat(p.selling_price) || 0;
                                        const margen = venta > 0 ? ((venta - costo) / venta * 100) : 0;
                                        const isPriceChanged = p.status === 'price_changed';
                                        const isNewWithSuggestions = p.status === 'new' && p.suggestions?.length > 0;
                                        let rowClass = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors";
                                        if (isPriceChanged) rowClass = "bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors";

                                        return (
                                            <tr key={i} className={rowClass}>
                                                <td className="px-4 py-3 align-top">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {isPriceChanged && <span className="bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-[10px] font-bold px-2 py-0.5 rounded-md">⚠️ Precio</span>}
                                                        {p.status === 'new' && <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md">NUEVO</span>}
                                                        {isNewWithSuggestions && (
                                                            <div className="relative">
                                                                <button onClick={() => setMergeMenuOpen(mergeMenuOpen === i ? null : i)} className="mt-1 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-300 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer border border-orange-300 dark:border-orange-800 transition-colors">
                                                                    <GitMerge className="w-3 h-3" /> Duplicado?
                                                                </button>
                                                                {mergeMenuOpen === i && (
                                                                    <div className="absolute left-0 top-8 z-50 bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-3 w-80 animate-scale-in">
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase">Posibles coincidencias:</p>
                                                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                                                            {p.suggestions.map((s: any) => (
                                                                                <button key={s.id} onClick={() => initiateMerge(i, s.id, s.name)} className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg text-xs border border-gray-100 dark:border-gray-700 group transition-colors">
                                                                                    <div className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">{s.name}</div>
                                                                                    <div className="text-gray-400 dark:text-gray-500 flex justify-between mt-1">
                                                                                        <span>Costo BD: ${s.price}</span>
                                                                                        <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">Fusionar <ArrowRight className="w-3 h-3" /></span>
                                                                                    </div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                        <button onClick={() => setMergeMenuOpen(null)} className="mt-2 w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-1">Cancelar</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
                                                    {isPriceChanged && <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">Antes: ${p.old_cost?.toFixed(2)}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-center align-middle text-gray-700 dark:text-gray-300">{p.qty}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500 align-middle">${p.cost_with_tax?.toFixed(2)}</td>
                                                <td className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-l border-blue-100 dark:border-blue-900 align-middle">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">$</span>
                                                        <input type="number" value={p.selling_price === 0 ? '' : p.selling_price} onChange={(e) => handlePriceChange(i, e.target.value)} className="w-full pl-6 pr-2 py-2 border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-900 dark:text-blue-200 text-right placeholder-gray-300 dark:placeholder-gray-600 bg-white dark:bg-gray-800" placeholder="0.00" />
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-3 text-right font-bold align-middle ${margen > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-400 dark:text-red-400'}`}>
                                                    {margen > 0 ? `${margen.toFixed(0)}%` : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL BONITO PARA UNIFICAR --- */}
            {pendingMerge && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in relative text-center p-6 transition-colors">
                        <div className="bg-blue-100 dark:bg-blue-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-gray-800 shadow-lg relative -mt-10 transition-colors">
                            <GitMerge className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Unificar Producto</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                            Este producto se registrará como: <br />
                            <strong className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md mt-2 inline-block border border-blue-100 dark:border-blue-900">{pendingMerge.targetName}</strong>
                        </p>
                        <div className="space-y-3">
                            <button onClick={executeMerge} disabled={loading} className="w-full bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 active:scale-95 flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-5 h-5" />}
                                Confirmar y Unificar
                            </button>
                            <button onClick={() => setPendingMerge(null)} disabled={loading} className="w-full bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-500 dark:text-white font-bold py-3 rounded-xl transition-colors border border-gray-200 dark:border-gray-600">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}