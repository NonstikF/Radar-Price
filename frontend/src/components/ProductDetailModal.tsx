import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    X, Save, Barcode, Hash,
    ArrowRight, Camera, Trash2, Loader2, Tag, Printer, Settings
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { ProductLabel } from './ProductLabel';
import { useLabelSettings } from '../hooks/useLabelSettings';
import { LabelSettingsModal } from './LabelSettingsModal';
import { API_URL } from '../config';
import { BarcodeScanner } from './BarcodeScanner';

interface Props {
    product: any;
    isAdmin: boolean;
    onClose: () => void;
    onDelete: () => void;
    onUpdate: (updatedProduct: any) => void;
    showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function ProductDetailModal({ product, isAdmin, onClose, onDelete, onUpdate, showToast }: Props) {
    // Hooks de estado locales del modal
    const [editUpc, setEditUpc] = useState(product.upc ? String(product.upc) : "");
    const [editSku, setEditSku] = useState(product.sku ? String(product.sku) : "");
    const [editAlias, setEditAlias] = useState(product.alias ? String(product.alias) : "");
    const [editPrice, setEditPrice] = useState(product.selling_price ? String(product.selling_price) : "");

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const { settings } = useLabelSettings();
    const labelRef = useRef<HTMLDivElement>(null);

    // Cargar historial al montar
    useEffect(() => {
        axios.get(`${API_URL}/invoices/products/${product.id}/history`)
            .then(res => setHistory(res.data))
            .catch(err => console.error("Error historial", err));
    }, [product.id]);

    const handlePrint = useReactToPrint({
        contentRef: labelRef,
        documentTitle: product.alias || product.name || 'Etiqueta',
        onAfterPrint: () => showToast("Enviado a impresión"),
    });

    // Lógica simplificada de "Hay cambios sin guardar"
    const hasUnsavedChanges = () => {
        const clean = (val: any) => String(val || "").trim();
        const priceChanged = parseFloat(editPrice || "0") !== parseFloat(product.selling_price || "0");
        return (
            clean(editUpc) !== clean(product.upc) ||
            clean(editSku) !== clean(product.sku) ||
            clean(editAlias) !== clean(product.alias) ||
            (isAdmin && priceChanged)
        );
    };

    const handleAttemptClose = () => {
        if (hasUnsavedChanges()) setShowExitConfirm(true);
        else onClose();
    };

    const handleSaveField = async (field: 'upc' | 'sku' | 'price' | 'alias') => {
        setSaving(true);
        try {
            // Objeto de configuración para evitar IF/ELSE gigantes
            const fieldConfig = {
                upc: { value: editUpc.trim(), payloadKey: 'upc' },
                sku: { value: editSku.trim(), payloadKey: 'sku' },
                alias: { value: editAlias.trim(), payloadKey: 'alias' },
                price: { value: parseFloat(editPrice) || 0, payloadKey: 'selling_price' }
            };

            const config = fieldConfig[field];
            const payload = { [config.payloadKey]: config.value };

            await axios.put(`${API_URL}/invoices/products/${product.id}`, payload);

            // Actualizar el padre
            onUpdate({ ...product, ...payload });
            showToast(`${field.toUpperCase()} ACTUALIZADO`);

            // Actualizar estados locales para reflejar que ya se guardó
            if (field === 'upc') setEditUpc(config.value as string);
            if (field === 'sku') setEditSku(config.value as string);
            if (field === 'alias') setEditAlias(config.value as string);
            // Price ya es string en el estado, cuidado con el parse
        } catch (error: any) {
            showToast(error.response?.data?.detail || "Error al guardar.", 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/invoices/products/${product.id}`);
            onDelete();
        } catch (error: any) {
            console.error(error);
            // Mensaje más útil para el usuario
            if (error.response && error.response.status === 500) {
                showToast("No se puede eliminar: El producto tiene ventas asociadas.", "error");
            } else {
                showToast("Error al eliminar el producto", "error");
            }
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false); // Cerramos el modal de confirmación
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={handleAttemptClose}></div>
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in relative z-10 flex flex-col max-h-[90vh]">

                {/* HEADER AZUL */}
                <div className="bg-blue-600 dark:bg-blue-700 p-6 md:p-8 text-white relative text-center shrink-0">
                    {/* BOTONES IZQUIERDA (Print/Config) */}
                    <div className="absolute top-4 left-4 flex gap-3 z-20 items-center">
                        <button onClick={() => setShowSettings(true)} className="bg-blue-800/40 hover:bg-blue-800/60 text-white p-2 rounded-lg backdrop-blur-md">
                            <Settings className="w-5 h-5" />
                        </button>
                        <button onClick={handlePrint} className="bg-white text-blue-600 hover:bg-blue-50 p-2 rounded-full shadow-lg">
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>

                    {/* BOTONES DERECHA (Cerrar/Borrar) */}
                    <div className="absolute top-4 right-4 flex gap-2 z-20 items-center">
                        {isAdmin && (
                            <button onClick={() => setShowDeleteConfirm(true)} className="bg-red-500/20 hover:bg-red-500/40 p-2 rounded-full text-white backdrop-blur-sm">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={handleAttemptClose} className="bg-black/10 hover:bg-black/20 p-2 rounded-full text-white backdrop-blur-sm">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* PRECIO GIGANTE */}
                    <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2 mt-6 md:mt-0">Precio de Venta</p>
                    {isAdmin ? (
                        <div className="relative inline-block w-full max-w-[200px]">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-black text-blue-300">$</span>
                            <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                placeholder="0"
                                className="w-full bg-transparent text-center text-6xl font-black text-white placeholder-blue-300/50 focus:outline-none border-b-2 border-transparent focus:border-white/50 pl-6"
                            />
                            {parseFloat(editPrice || "0") !== parseFloat(product.selling_price || "0") && (
                                <button onClick={() => handleSaveField('price')} disabled={saving} className="absolute -right-10 top-1/2 -translate-y-1/2 bg-white text-blue-600 p-2 rounded-full shadow-lg animate-bounce-in hover:scale-110 active:scale-95 transition-all">
                                    <Save className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <h2 className="text-6xl font-black tracking-tighter drop-shadow-lg">${(product.selling_price || 0).toFixed(2)}</h2>
                    )}
                </div>

                {/* TABS NAVEGACIÓN */}
                <div className="bg-blue-50 dark:bg-gray-900 p-2 flex gap-2">
                    <button onClick={() => setShowHistory(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${!showHistory ? 'bg-white shadow-sm text-blue-700' : 'text-gray-400'}`}>Datos Generales</button>
                    <button onClick={() => setShowHistory(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${showHistory ? 'bg-white shadow-sm text-blue-700' : 'text-gray-400'}`}>Historial</button>
                </div>

                {/* CONTENIDO SCROLLABLE */}
                <div className="p-4 md:p-6 space-y-6 bg-white dark:bg-gray-800 overflow-y-auto">
                    {!showHistory ? (
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Producto</label>
                                <p className="text-gray-800 dark:text-gray-100 font-medium text-sm">{product.name}</p>
                            </div>

                            {/* COMPONENTES DE EDICIÓN REUTILIZABLES O DIRECTOS PERO LIMPIOS */}
                            <EditField
                                label="Alias / Apodo" icon={<Tag className="w-4 h-4 text-purple-500" />}
                                value={editAlias} original={product.alias}
                                onChange={setEditAlias} onSave={() => handleSaveField('alias')}
                                saving={saving} colorClass="bg-purple-50 border-purple-200"
                            />

                            <EditField
                                label="UPC" icon={<Barcode className="w-4 h-4 text-blue-500" />}
                                value={editUpc} original={product.upc}
                                onChange={setEditUpc} onSave={() => handleSaveField('upc')}
                                saving={saving} colorClass="bg-yellow-50 border-yellow-200"
                                hasCamera onCamera={() => setShowScanner(true)}
                            />

                            <EditField
                                label="ID Interno" icon={<Hash className="w-4 h-4 text-gray-500" />}
                                value={editSku} original={product.sku}
                                onChange={setEditSku} onSave={() => handleSaveField('sku')}
                                saving={saving} colorClass="bg-yellow-50 border-yellow-200"
                            />
                        </div>
                    ) : (
                        <HistoryList history={history} />
                    )}
                </div>

                {/* MODALES INTERNOS (Scanner, Settings, Confirms) */}
                {showScanner && <BarcodeScanner onScan={(code) => { setEditUpc(code); setShowScanner(false); }} onClose={() => setShowScanner(false)} />}
                {showSettings && <LabelSettingsModal onClose={() => setShowSettings(false)} />}

                {/* ALERTAS DE CONFIRMACIÓN */}
                {showExitConfirm && (
                    <div className="absolute inset-0 z-20 bg-white/90 dark:bg-gray-900/90 flex flex-col items-center justify-center p-8 text-center">
                        <h3 className="text-xl font-black mb-2">¡Cambios sin guardar!</h3>
                        <div className="space-y-3 w-full max-w-xs">
                            <button onClick={() => setShowExitConfirm(false)} className="w-full bg-gray-100 py-3 rounded-xl font-bold">Regresar</button>
                            <button onClick={onClose} className="w-full text-red-500 py-3 rounded-xl font-bold">Salir sin guardar</button>
                        </div>
                    </div>
                )}

                {showDeleteConfirm && (
                    <div className="absolute inset-0 z-30 bg-red-600/90 flex flex-col items-center justify-center p-8 text-center text-white">
                        <h3 className="text-xl font-black mb-4">¿Eliminar producto?</h3>
                        <button onClick={handleDelete} disabled={deleting} className="bg-white text-red-600 px-6 py-3 rounded-xl font-bold mb-3 w-full">
                            {deleting ? <Loader2 className="animate-spin mx-auto" /> : "Sí, Eliminar"}
                        </button>
                        <button onClick={() => setShowDeleteConfirm(false)} className="bg-black/20 text-white px-6 py-3 rounded-xl font-bold w-full">Cancelar</button>
                    </div>
                )}
            </div>

            {/* ETIQUETA INVISIBLE */}
            <div style={{ display: "none" }}>
                <ProductLabel ref={labelRef} product={product} settings={settings} />
            </div>
        </div>
    );
}

// Subcomponentes para limpiar el JSX principal
const EditField = ({ label, icon, value, original, onChange, onSave, saving, colorClass, hasCamera, onCamera }: any) => {
    const isChanged = String(value || "").trim() !== String(original || "").trim();
    return (
        <div className={`transition-all ${isChanged ? `${colorClass} p-3 rounded-2xl border` : ''}`}>
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase mb-2">
                {icon} {label} {isChanged && <span className="text-red-500 animate-pulse ml-auto text-[10px]">● Sin guardar</span>}
            </label>
            <div className="flex gap-2">
                <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                {hasCamera && <button onClick={onCamera} className="bg-gray-100 p-3 rounded-xl"><Camera className="w-5 h-5" /></button>}
                <button onClick={onSave} disabled={saving || !isChanged} className={`px-4 rounded-xl flex items-center justify-center ${isChanged ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <Save className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const HistoryList = ({ history }: { history: any[] }) => {
    if (history.length === 0) return <p className="text-center text-gray-400 py-10 italic text-sm">No hay historial.</p>;
    return (
        <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-4">
            {history.map((item, index) => (
                <div key={index} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${item.type === 'COSTO' ? 'bg-orange-400' : 'bg-green-500'}`}></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${item.type === 'COSTO' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                {item.type === 'COSTO' ? 'Costo Compra' : 'Precio Venta'}
                            </span>
                            <p className="text-xs text-gray-400 mt-1">{new Date(item.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-1 font-bold">
                            <span className="text-gray-400 line-through text-xs">${item.old.toFixed(2)}</span>
                            <ArrowRight className="w-3 h-3 text-gray-300" />
                            <span>${item.new.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};