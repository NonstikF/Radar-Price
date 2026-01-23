import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, FileText, ArrowRight, CheckCircle2, AlertCircle, ChevronLeft, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

interface Props {
    onBack: () => void;
}

export function History({ onBack }: Props) {
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
    const [batchProducts, setBatchProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);

    useEffect(() => {
        loadBatches();
    }, []);

    const loadBatches = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/invoices/batches`);
            setBatches(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleSelectBatch = async (batch: any) => {
        setLoadingProducts(true);
        setSelectedBatch(batch);
        try {
            const res = await axios.get(`${API_URL}/invoices/batches/${batch.id}/products`);
            // Ordenar: primero los que no tienen precio (missing_price = true)
            const sorted = res.data.sort((a: any, b: any) => Number(b.missing_price) - Number(a.missing_price));
            setBatchProducts(sorted);
        } catch (e) { console.error(e); }
        setLoadingProducts(false);
    };

    const handleUpdatePrice = async (id: number, price: string) => {
        try {
            const val = parseFloat(price);
            await axios.put(`${API_URL}/invoices/products/${id}`, { selling_price: val });

            // Actualizar visualmente sin recargar
            setBatchProducts(prev => prev.map(p =>
                p.id === id ? { ...p, selling_price: val, missing_price: val <= 0 } : p
            ));
        } catch (error) { alert("Error al guardar precio"); }
    };

    // --- VISTA DE DETALLE (PRODUCTOS DE UN LOTE ESPECÍFICO) ---
    if (selectedBatch) {
        return (
            <div className="max-w-4xl mx-auto p-4 animate-fade-in pb-24">
                {/* Botón para volver a la LISTA DE LOTES (navegación interna) */}
                <button onClick={() => setSelectedBatch(null)} className="flex items-center gap-2 text-gray-500 mb-6 hover:text-blue-600 transition-colors font-bold bg-white px-4 py-2 rounded-xl shadow-sm">
                    <ChevronLeft className="w-5 h-5" /> Volver al Historial
                </button>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-500" /> {selectedBatch.filename}
                    </h2>
                    <p className="text-gray-500 text-sm ml-8">Importado el: {new Date(selectedBatch.date).toLocaleString()}</p>
                </div>

                <div className="space-y-3">
                    {loadingProducts ? (
                        <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></div>
                    ) : batchProducts.length === 0 ? (
                        <p className="text-center text-gray-400">Este lote no tiene productos registrados.</p>
                    ) : (
                        batchProducts.map((p) => (
                            <div key={p.id} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 transition-all ${p.missing_price ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base">{p.name}</h3>
                                    <div className="flex gap-3 text-xs mt-1">
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500">SKU: {p.sku || 'N/A'}</span>
                                        {p.missing_price && <span className="text-orange-600 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Falta Precio</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Venta $</span>
                                    <input
                                        type="number"
                                        defaultValue={p.selling_price || ''}
                                        onBlur={(e) => handleUpdatePrice(p.id, e.target.value)}
                                        placeholder="0.00"
                                        className="w-24 bg-transparent text-right font-black text-lg focus:outline-none text-gray-800 dark:text-white placeholder-gray-300"
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // --- VISTA PRINCIPAL (LISTA DE LOTES) ---
    return (
        <div className="max-w-5xl mx-auto p-6 animate-fade-in pb-24">

            {/* --- AQUÍ ESTÁ LA CORRECCIÓN: Botón para volver al Dashboard --- */}
            <button onClick={onBack} className="flex items-center gap-2 text-gray-500 mb-6 hover:text-blue-600 transition-colors font-bold w-fit bg-white/50 px-3 py-2 rounded-lg">
                <ChevronLeft className="w-5 h-5" /> Volver al Inicio
            </button>
            {/* ------------------------------------------------------------- */}

            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Historial de Importaciones</h1>
            <p className="text-gray-500 mb-8">Selecciona una carga anterior para revisar qué productos subiste y completar precios.</p>

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></div>
                ) : batches.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 font-bold">No hay historial aún.</p>
                        <p className="text-xs text-gray-400">Sube tu primer archivo XML para verlo aquí.</p>
                    </div>
                ) : (
                    batches.map((batch) => (
                        <div key={batch.id} onClick={() => handleSelectBatch(batch)} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between active:scale-[0.99]">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full transition-colors ${batch.pending > 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                    {batch.pending > 0 ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-white group-hover:text-blue-600 transition-colors">{batch.filename}</h3>
                                    <div className="flex gap-4 text-sm text-gray-500 mt-1">
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(batch.date).toLocaleDateString()}</span>
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 rounded-md text-xs flex items-center">{batch.total} productos</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right pl-4">
                                {batch.pending > 0 ? (
                                    <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-100">
                                        Faltan {batch.pending}
                                    </span>
                                ) : (
                                    <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-100">
                                        Completo
                                    </span>
                                )}
                                <div className="mt-2 text-gray-300 group-hover:translate-x-1 transition-transform flex justify-end">
                                    <ArrowRight className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}