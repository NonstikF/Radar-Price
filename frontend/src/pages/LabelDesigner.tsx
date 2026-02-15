import { useState, useRef } from 'react';
import {
    Settings, RotateCcw, Layout, Eye, Tag,
    Printer, PenTool, Box
} from 'lucide-react';
import { ProductLabel } from '../components/labels/ProductLabel';
import { useLabelSettings } from '../hooks/useLabelSettings';
import { usePrintLabel } from '../hooks/usePrintLabel';

export default function LabelDesigner() {
    const { settings, updateSettings } = useLabelSettings();
    const printRef = useRef<HTMLDivElement>(null);

    // Estado para el modo: 'preview' (producto ejemplo) o 'free' (libre)
    const [mode, setMode] = useState<'preview' | 'free'>('preview');

    // Estado para los datos del modo libre
    const [customData, setCustomData] = useState({
        topText: settings.companyName || 'OFERTA',
        price: '99',
        bottomText: 'TEXTO PERSONALIZADO'
    });

    // Hook de impresión para el modo libre
    const handlePrintFree = usePrintLabel(printRef, `Etiqueta_Libre_${new Date().toLocaleTimeString()}`);

    // --- LÓGICA DEL PRODUCTO A MOSTRAR ---
    // Si estamos en preview, usamos un producto dummy fijo.
    // Si estamos en free, creamos un "producto falso" con lo que escribas.
    const productToRender = mode === 'preview' ? {
        name: "Maceta Rattan Redonda D20 Chocolate Premium",
        price: 185.50,
        selling_price: 185.50,
        sku: "MRRD2006",
        upc: "7501234567890",
        alias: "Rattan Choco"
    } : {
        // En modo libre, el "nombre" y "alias" son tu texto de abajo
        name: customData.bottomText,
        alias: customData.bottomText,
        // El precio es lo que escribas
        selling_price: parseFloat(customData.price) || 0,
        price: parseFloat(customData.price) || 0,
        sku: "0000",
        upc: "0000"
    };

    // Ajustes modificados al vuelo para el modo libre
    // (Para que el texto de arriba obedezca al input manual y no a la config global)
    const settingsToRender = mode === 'free'
        ? { ...settings, companyName: customData.topText }
        : settings;

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Tag className="text-blue-600" /> Diseñador de Etiquetas
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {mode === 'preview' ? 'Personaliza el diseño general.' : 'Crea etiquetas rápidas manualmente.'}
                    </p>
                </div>

                {/* SELECTOR DE MODO */}
                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex items-center gap-1">
                    <button
                        onClick={() => setMode('preview')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${mode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Box className="w-4 h-4" /> Diseño Global
                    </button>
                    <button
                        onClick={() => setMode('free')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${mode === 'free' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <PenTool className="w-4 h-4" /> Modo Libre
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* COLUMNA IZQUIERDA: PREVISUALIZACIÓN */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-gray-100 dark:bg-gray-800/50 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-700 relative group">

                        <span className="absolute top-4 left-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {mode === 'preview' ? 'Vista Previa (Ejemplo)' : 'Listo para Imprimir'}
                        </span>

                        {/* ZONA DE IMPRESIÓN (usamos ref aquí para capturar esto al imprimir en modo libre) */}
                        <div className="shadow-xl transition-all duration-300 hover:scale-105">
                            <div ref={printRef}>
                                <ProductLabel
                                    product={productToRender}
                                    settings={settingsToRender}
                                />
                            </div>
                        </div>

                        <p className="mt-8 text-xs text-gray-400 text-center max-w-xs">
                            * {mode === 'preview' ? 'Así se verán tus productos del inventario.' : 'Lo que ves es lo que se imprimirá.'}
                        </p>
                    </div>

                    {/* BOTÓN IMPRIMIR (SOLO MODO LIBRE) */}
                    {mode === 'free' && (
                        <button
                            onClick={handlePrintFree}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/30 text-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <Printer className="w-6 h-6" /> Imprimir Etiqueta Libre
                        </button>
                    )}
                </div>

                {/* COLUMNA DERECHA: CONTROLES */}
                <div className="lg:col-span-5 space-y-6">

                    {/* SI ESTAMOS EN MODO LIBRE: MOSTRAR INPUTS MANUALES */}
                    {mode === 'free' ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-purple-100 dark:border-gray-700 p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                <PenTool className="w-5 h-5 text-purple-600" />
                                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Datos Manuales</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Texto Superior (Empresa/Título)</label>
                                    <input
                                        type="text"
                                        value={customData.topText}
                                        onChange={(e) => setCustomData({ ...customData, topText: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold text-center"
                                        placeholder="Ej: OFERTA"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Número Central (Precio)</label>
                                    <input
                                        type="number"
                                        value={customData.price}
                                        onChange={(e) => setCustomData({ ...customData, price: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-black text-3xl text-center"
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Texto Inferior (Descripción)</label>
                                    <textarea
                                        rows={2}
                                        value={customData.bottomText}
                                        onChange={(e) => setCustomData({ ...customData, bottomText: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold text-center uppercase"
                                        placeholder="Descripción..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* SI ESTAMOS EN MODO PREVIEW: MOSTRAR CONFIGURACIÓN GLOBAL */
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                <Settings className="w-5 h-5 text-blue-600" />
                                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Configuración Global</h2>
                            </div>

                            <div className="space-y-6">
                                {/* SECCIÓN: TAMAÑO Y FUENTE */}
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                        <Layout className="w-3 h-3" /> Dimensiones
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Tamaño Papel</label>
                                            <select
                                                value={settings.size}
                                                onChange={(e) => updateSettings({ size: e.target.value as any })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                            >
                                                <option value="50x25mm">50mm x 25mm (Estándar)</option>
                                                <option value="2x1">2" x 1" (Pulgadas)</option>
                                                <option value="1.5x1">1.5" x 1" (Pequeña)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Tamaño Letra</label>
                                            <select
                                                value={settings.fontSize}
                                                onChange={(e) => updateSettings({ fontSize: e.target.value as any })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                            >
                                                <option value="small">Pequeña (8px)</option>
                                                <option value="normal">Normal (10px)</option>
                                                <option value="large">Grande (12px)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* SECCIÓN: VISIBILIDAD */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                        <Eye className="w-3 h-3" /> Elementos Visibles
                                    </label>

                                    <ToggleOption
                                        label="Mostrar Nombre del Producto"
                                        checked={settings.showName}
                                        onChange={(v) => updateSettings({ showName: v })}
                                    />
                                    <ToggleOption
                                        label="Mostrar Precio"
                                        checked={settings.showPrice}
                                        onChange={(v) => updateSettings({ showPrice: v })}
                                    />
                                    <ToggleOption
                                        label="Mostrar Código SKU/UPC"
                                        checked={settings.showSku}
                                        onChange={(v) => updateSettings({ showSku: v })}
                                    />
                                </div>
                            </div>

                            {/* BOTÓN RESTAURAR */}
                            <button
                                onClick={() => updateSettings({
                                    size: '50x25mm',
                                    showPrice: true,
                                    showSku: true,
                                    showDate: true,
                                    showName: true,
                                    boldPrice: true,
                                    fontSize: 'normal'
                                })}
                                className="w-full mt-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" /> Restaurar valores originales
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Componente auxiliar
function ToggleOption({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) {
    return (
        <div
            onClick={() => onChange(!checked)}
            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors group"
        >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
            <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? 'translate-x-5' : ''}`}></div>
            </div>
        </div>
    );
}