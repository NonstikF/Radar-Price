import { useState } from 'react';
import axios from 'axios';
import { Upload, Save, FileText, Loader2, DollarSign, Package, EyeOff, GitMerge, ArrowRight, CheckCircle2 } from 'lucide-react';

// IP DE TU PC (AJUSTA SI ES NECESARIO)
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Definimos las propiedades que vienen del padre (App.tsx)
interface Props {
    products: any[];
    setProducts: (products: any[]) => void;
}

export function InvoiceUploader({ products, setProducts }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    // Estados locales para la interfaz de carga
    const [hiddenCount, setHiddenCount] = useState(0);
    const [savedMessage, setSavedMessage] = useState("");

    // Control de menús de fusión
    const [mergeMenuOpen, setMergeMenuOpen] = useState<number | null>(null);
    const [pendingMerge, setPendingMerge] = useState<{ discardIndex: number, keepId: number, targetName: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setProducts([]); // Limpiamos usando la función del padre
        setHiddenCount(0);
        setSavedMessage("");

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`${API_URL}/invoices/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setProducts(response.data.products); // Actualizamos al padre
            setHiddenCount(response.data.hidden_count || 0);
        } catch (error) {
            console.error(error);
            alert("Error al cargar XML. Verifica tu conexión e IP.");
        } finally {
            setLoading(false);
        }
    };

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
            setSavedMessage("¡Precios guardados!");
            setTimeout(() => setSavedMessage(""), 3000);
        } catch (error) {
            alert("Error al guardar precios");
        } finally {
            setLoading(false);
        }
    };

    // 1. INICIAR FUSIÓN (Abre el modal)
    const initiateMerge = (discardProductIndex: number, keepDbId: number, targetName: string) => {
        setPendingMerge({
            discardIndex: discardProductIndex,
            keepId: keepDbId,
            targetName: targetName
        });
        setMergeMenuOpen(null);
    };

    // 2. EJECUTAR FUSIÓN (Llamada al backend)
    const executeMerge = async () => {
        if (!pendingMerge) return;
        setLoading(true);
        const productToDiscard = products[pendingMerge.discardIndex];

        try {
            await axios.post(`${API_URL}/invoices/merge`, {
                keep_id: pendingMerge.keepId,
                discard_id: productToDiscard.id
            });

            // Eliminar de la lista visual
            const newProducts = products.filter((_, i) => i !== pendingMerge.discardIndex);
            setProducts(newProducts);
            setPendingMerge(null);
        } catch (error) {
            alert("Error al fusionar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 pb-24 relative">

            {/* --- ZONA DE CARGA --- */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full">
                    <div className="bg-blue-50 p-3 rounded-full shrink-0">
                        <Upload className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cargar XML (CFDI)</label>
                        <input type="file" accept=".xml" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                </div>
                <button onClick={handleUpload} disabled={!file || loading} className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2">
                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    {loading ? 'Procesando...' : 'Cargar Lista'}
                </button>
            </div>

            {/* MENSAJE DE OCULTOS */}
            {hiddenCount > 0 && (
                <div className="mb-4 bg-gray-100 text-gray-600 px-4 py-3 rounded-xl text-xs md:text-sm flex items-center gap-2 border border-gray-200">
                    <EyeOff className="w-4 h-4 shrink-0" />
                    <span>Se ocultaron <b>{hiddenCount} productos</b> sin cambios de precio y con precio de venta ya asignado.</span>
                </div>
            )}

            {/* --- LISTA DE PRODUCTOS --- */}
            {products.length > 0 && (
                <div className="animate-fade-in">

                    {/* Header Sticky */}
                    <div className="sticky top-2 z-20 bg-white/95 backdrop-blur shadow-md rounded-xl p-3 md:p-4 mb-4 border border-gray-200 flex justify-between items-center gap-3">
                        <div className="flex flex-col">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-base md:text-lg">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                <span>Gestión de Precios</span>
                            </h3>
                            <span className="text-gray-400 text-xs md:hidden">({products.length} visibles)</span>
                        </div>

                        {savedMessage ? (
                            <span className="text-green-600 font-bold px-4 py-2 bg-green-50 rounded-lg border border-green-200 animate-pulse text-sm">
                                ✅ Guardado
                            </span>
                        ) : (
                            <button onClick={handleSavePrices} disabled={loading} className="bg-green-600 text-white px-4 py-2 md:px-6 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center gap-2 text-sm md:text-base">
                                <Save className="w-5 h-5" />
                                <span>Guardar</span>
                            </button>
                        )}
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
                                <div key={i} className={`p-4 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden ${isPriceChanged ? 'bg-yellow-50/50' : 'bg-white'}`}>

                                    {/* Etiquetas */}
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {isPriceChanged && <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-md border border-yellow-200">⚠️ Costo Cambió</span>}
                                        {p.status === 'new' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-md border border-blue-200">NUEVO</span>}
                                    </div>

                                    {/* Nombre */}
                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <h4 className="font-bold text-gray-800 text-sm leading-snug">{p.name}</h4>
                                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-lg shrink-0 flex items-center gap-1">
                                            <Package className="w-3 h-3" /> {p.qty}
                                        </span>
                                    </div>

                                    {/* Botón Fusión Móvil */}
                                    {isNewWithSuggestions && (
                                        <div className="mb-3">
                                            <button
                                                onClick={() => setMergeMenuOpen(mergeMenuOpen === i ? null : i)}
                                                className="w-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 active:bg-orange-100"
                                            >
                                                <GitMerge className="w-4 h-4" />
                                                {mergeMenuOpen === i ? 'Cerrar sugerencias' : '¿Es duplicado? Ver opciones'}
                                            </button>

                                            {mergeMenuOpen === i && (
                                                <div className="mt-2 space-y-2 animate-scale-in">
                                                    {p.suggestions.map((s: any) => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => initiateMerge(i, s.id, s.name)}
                                                            className="w-full text-left p-3 bg-white border border-orange-200 rounded-lg shadow-sm active:bg-orange-50"
                                                        >
                                                            <div className="text-xs font-bold text-gray-800 mb-1">Fusionar con: {s.name}</div>
                                                            <div className="text-[10px] text-gray-500 flex justify-between">
                                                                <span>Costo BD: ${s.price}</span>
                                                                <span className="text-blue-600 font-bold">Clic para unir</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Inputs */}
                                    <div className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <div className="flex justify-between text-[10px] text-gray-400 mb-1 uppercase font-bold tracking-wide">
                                                <span>Costo: ${p.cost_with_tax?.toFixed(2)}</span>
                                                {isPriceChanged && <span className="text-yellow-600">Ant: ${p.old_cost?.toFixed(2)}</span>}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    value={p.selling_price === 0 ? '' : p.selling_price}
                                                    onChange={(e) => handlePriceChange(i, e.target.value)}
                                                    className="w-full pl-8 pr-3 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-blue-900 text-lg bg-blue-50/30"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 shrink-0 ${margen > 0 ? 'border-green-100 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-300'}`}>
                                            <span className="text-[10px] font-bold">{margen > 0 ? margen.toFixed(0) : '-'}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* --- VISTA ESCRITORIO (TABLA) --- */}
                    <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-visible">
                        <div className="overflow-visible">
                            <table className="min-w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                                    <tr>
                                        <th className="px-4 py-3 w-32">Estado</th>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3 text-center">Cant.</th>
                                        <th className="px-4 py-3 text-right">Costo</th>
                                        <th className="px-4 py-3 text-center bg-blue-50 text-blue-700 border-l border-blue-100 w-40">PRECIO VENTA</th>
                                        <th className="px-4 py-3 text-right">Margen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {products.map((p, i) => {
                                        const costo = p.cost_with_tax || 0;
                                        const venta = parseFloat(p.selling_price) || 0;
                                        const margen = venta > 0 ? ((venta - costo) / venta * 100) : 0;
                                        const isPriceChanged = p.status === 'price_changed';
                                        const isNewWithSuggestions = p.status === 'new' && p.suggestions?.length > 0;

                                        let rowClass = "hover:bg-gray-50 transition-colors";
                                        if (isPriceChanged) rowClass = "bg-yellow-50 hover:bg-yellow-100 transition-colors";

                                        return (
                                            <tr key={i} className={rowClass}>
                                                <td className="px-4 py-3 align-top">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {isPriceChanged && <span className="bg-yellow-200 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-md">⚠️ Precio</span>}
                                                        {p.status === 'new' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md">NUEVO</span>}

                                                        {isNewWithSuggestions && (
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setMergeMenuOpen(mergeMenuOpen === i ? null : i)}
                                                                    className="mt-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer border border-orange-300 transition-colors"
                                                                >
                                                                    <GitMerge className="w-3 h-3" /> Duplicado?
                                                                </button>

                                                                {mergeMenuOpen === i && (
                                                                    <div className="absolute left-0 top-8 z-50 bg-white shadow-2xl rounded-xl border border-gray-200 p-3 w-80 animate-scale-in">
                                                                        <p className="text-xs text-gray-500 mb-2 font-bold uppercase">Posibles coincidencias:</p>
                                                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                                                            {p.suggestions.map((s: any) => (
                                                                                <button
                                                                                    key={s.id}
                                                                                    onClick={() => initiateMerge(i, s.id, s.name)}
                                                                                    className="w-full text-left p-2 hover:bg-blue-50 rounded-lg text-xs border border-gray-100 group transition-colors"
                                                                                >
                                                                                    <div className="font-bold text-gray-800 group-hover:text-blue-700">{s.name}</div>
                                                                                    <div className="text-gray-400 flex justify-between mt-1">
                                                                                        <span>Costo BD: ${s.price}</span>
                                                                                        <span className="text-blue-600 font-bold flex items-center gap-1">Fusionar <ArrowRight className="w-3 h-3" /></span>
                                                                                    </div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                        <button onClick={() => setMergeMenuOpen(null)} className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">Cancelar</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 align-middle">
                                                    <div className="font-medium text-gray-900">{p.name}</div>
                                                    {isPriceChanged && <div className="text-xs text-yellow-700 mt-0.5">Antes: ${p.old_cost?.toFixed(2)}</div>}
                                                </td>

                                                <td className="px-4 py-3 text-center align-middle">{p.qty}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 align-middle">${p.cost_with_tax?.toFixed(2)}</td>

                                                <td className="px-4 py-2 bg-blue-50 border-l border-blue-100 align-middle">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                                        <input
                                                            type="number"
                                                            value={p.selling_price === 0 ? '' : p.selling_price}
                                                            onChange={(e) => handlePriceChange(i, e.target.value)}
                                                            className="w-full pl-6 pr-2 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-900 text-right placeholder-gray-300"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </td>

                                                <td className={`px-4 py-3 text-right font-bold align-middle ${margen > 0 ? 'text-green-600' : 'text-red-400'}`}>
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
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in relative text-center p-6">

                        <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg relative -mt-10">
                            <GitMerge className="w-10 h-10 text-blue-600" />
                        </div>

                        <h3 className="text-xl font-black text-gray-900 mb-2">Unificar Producto</h3>

                        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                            Este producto se registrará como:
                            <br />
                            <strong className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md mt-2 inline-block border border-blue-100">
                                {pendingMerge.targetName}
                            </strong>
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={executeMerge}
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-5 h-5" />}
                                Confirmar y Unificar
                            </button>

                            <button
                                onClick={() => setPendingMerge(null)}
                                disabled={loading}
                                className="w-full bg-white hover:bg-gray-50 text-gray-500 font-bold py-3 rounded-xl transition-colors border border-gray-200"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}