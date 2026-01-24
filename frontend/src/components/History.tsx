import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, FileText, ArrowRight, CheckCircle2, AlertTriangle, ChevronLeft, Loader2, Package, Pencil, X, Check } from 'lucide-react';
import { API_URL } from '../config';

interface Props {
    onBack: () => void;
}

export function History({ onBack }: Props) {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Estados para renombrar
    const [editingId, setEditingId] = useState<number | null>(null);
    const [tempName, setTempName] = useState("");
    const [renaming, setRenaming] = useState(false);

    useEffect(() => {
        loadBatches();
    }, []);

    const loadBatches = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/invoices/batches`);
            setBatches(res.data);
        } catch (e) {
            console.error("Error cargando historial:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenBatch = (batchId: number) => {
        if (editingId === batchId) return;
        navigate(`/history/${batchId}`);
    };

    // --- LÓGICA DE RENOMBRADO ---
    const startEditing = (e: React.MouseEvent, batch: any) => {
        e.stopPropagation();
        setEditingId(batch.id);
        setTempName(batch.filename);
    };

    const cancelEditing = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        setEditingId(null);
        setTempName("");
    };

    // Cambié el tipo a SyntheticEvent para que acepte tanto Mouse (Click) como Keyboard (Enter)
    const saveName = async (e: React.SyntheticEvent, batchId: number) => {
        e.stopPropagation();
        if (!tempName.trim()) return;

        setRenaming(true);
        try {
            await axios.put(`${API_URL}/invoices/batches/${batchId}`, { filename: tempName });

            setBatches(prev => prev.map(b => b.id === batchId ? { ...b, filename: tempName } : b));
            setEditingId(null);
        } catch (error) {
            alert("Error al renombrar");
        } finally {
            setRenaming(false);
        }
    };

    // Nuevo manejador para detectar teclas
    const handleKeyDown = (e: React.KeyboardEvent, batchId: number) => {
        if (e.key === 'Enter') {
            saveName(e, batchId);
        } else if (e.key === 'Escape') {
            cancelEditing(e);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-500 mb-3 hover:text-blue-600 transition-colors font-bold text-sm"
                    >
                        <ChevronLeft className="w-4 h-4" /> Volver al Inicio
                    </button>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-1">
                        Historial de Importaciones
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Gestiona tus cargas anteriores.
                    </p>
                </div>
            </div>

            {/* LISTA */}
            <div className="grid gap-4 w-full">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                        <p>Cargando historial...</p>
                    </div>
                ) : batches.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 font-bold text-lg">No hay historial aún.</p>
                    </div>
                ) : (
                    batches.map((batch) => {
                        const isComplete = batch.pending === 0;
                        const isEditing = editingId === batch.id;

                        return (
                            <div
                                key={batch.id}
                                onClick={() => handleOpenBatch(batch.id)}
                                className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-900 transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4 w-full relative overflow-hidden"
                            >
                                {/* --- IZQUIERDA: ICONO + INFO --- */}
                                <div className="flex items-start gap-3 w-full md:w-auto min-w-0">

                                    {/* Icono */}
                                    <div className={`p-3 rounded-xl shrink-0 transition-colors ${isComplete ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'}`}>
                                        {isComplete ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                    </div>

                                    {/* Info Texto */}
                                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                                        {isEditing ? (
                                            // MODO EDICIÓN
                                            <div className="flex items-center gap-2 w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={tempName}
                                                    onChange={(e) => setTempName(e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={(e) => handleKeyDown(e, batch.id)} // <--- AQUÍ ESTÁ LA MAGIA DEL ENTER
                                                    className="w-full text-sm font-bold border-b-2 border-blue-500 bg-transparent outline-none py-1 text-gray-900 dark:text-white"
                                                />
                                                <button onClick={(e) => saveName(e, batch.id)} disabled={renaming} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                                                    {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                </button>
                                                <button onClick={cancelEditing} className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-gray-200">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            // MODO LECTURA
                                            <div className="group/title flex items-center gap-2">
                                                <h3 className="font-bold text-sm md:text-lg text-gray-800 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                                                    {batch.filename}
                                                </h3>
                                                <button
                                                    onClick={(e) => startEditing(e, batch)}
                                                    className="text-gray-400 hover:text-blue-500 p-2 transition-all"
                                                    title="Renombrar"
                                                >
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                                            <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(batch.date).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                                                <Package className="w-3 h-3" />
                                                {batch.total} items
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* --- DERECHA --- */}
                                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto mt-1 md:mt-0 pt-3 md:pt-0 border-t border-gray-100 dark:border-gray-700 md:border-0">

                                    {isComplete ? (
                                        <span className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-100 dark:border-green-800/50 shrink-0">
                                            Completo
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-100 dark:border-orange-800/50 shrink-0">
                                            Faltan {batch.pending}
                                        </span>
                                    )}

                                    <div className="flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                        <span>Abrir</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}