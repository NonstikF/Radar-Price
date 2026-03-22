import { useState, useRef } from 'react';
import {
    Settings, RotateCcw, Layout, Eye, Tag,
    Printer, PenTool, Box, Building2
} from 'lucide-react';
import { ProductLabel } from '../../components/labels/ProductLabel';
import { useLabelSettings, type LabelSize } from '../../hooks/useLabelSettings';
import { usePrintLabel } from '../../hooks/usePrintLabel';

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

    // Hook de impresión
    const handlePrintFree = usePrintLabel(printRef, `Etiqueta_Libre_${new Date().toLocaleTimeString()}`);

    // Configuración del producto dummy
    const productToRender = mode === 'preview' ? {
        name: "Maceta Rattan Redonda D20 Chocolate Premium",
        price: 185.50,
        selling_price: 185.50,
        sku: "MRRD2006",
        upc: "7501234567890",
        alias: "Rattan Choco"
    } : {
        name: customData.bottomText,
        alias: customData.bottomText,
        selling_price: parseFloat(customData.price) || 0,
        price: parseFloat(customData.price) || 0,
        sku: "0000",
        upc: "0000"
    };

    // Ajustes al vuelo
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
                        {mode === 'preview' ? 'Configura el diseño global de tus etiquetas.' : 'Crea etiquetas rápidas manualmente.'}
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

                {/* COLUMNA IZQUIERDA: VISUALIZADOR */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-gray-100 dark:bg-gray-800/50 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-700 relative group">

                        <span className="absolute top-4 left-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {mode === 'preview' ? 'Vista Previa' : 'Listo para Imprimir'}
                        </span>

                        <div className="shadow-xl transition-all duration-300 hover:scale-105">
                            <div ref={printRef}>
                                <ProductLabel
                                    product={productToRender}
                                    settings={settingsToRender}
                                />
                            </div>
                        </div>

                        <p className="mt-8 text-xs text-gray-400 text-center max-w-xs">
                            * {mode === 'preview' ? 'Así se verán tus productos.' : 'Lo que ves es lo que se imprimirá.'}
                        </p>
                    </div>

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

                    {mode === 'free' ? (
                        // --- MODO LIBRE ---
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-purple-100 dark:border-gray-700 p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                <PenTool className="w-5 h-5 text-purple-600" />
                                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Datos Manuales</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Título Superior</label>
                                    <input
                                        type="text"
                                        value={customData.topText}
                                        onChange={(e) => setCustomData({ ...customData, topText: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold text-center"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Precio</label>
                                    <input
                                        type="number"
                                        value={customData.price}
                                        onChange={(e) => setCustomData({ ...customData, price: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-black text-3xl text-center"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Texto Inferior</label>
                                    <textarea
                                        rows={2}
                                        value={customData.bottomText}
                                        onChange={(e) => setCustomData({ ...customData, bottomText: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold text-center uppercase"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        // --- MODO CONFIGURACIÓN GLOBAL ---
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                <Settings className="w-5 h-5 text-blue-600" />
                                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Configuración Global</h2>
                            </div>

                            <div className="space-y-6">

                                {/* 1. TÍTULO EMPRESA (NUEVO AQUÍ) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-2">
                                        <Building2 className="w-3 h-3" /> Título de la Etiqueta
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.companyName || ''}
                                        onChange={(e) => updateSettings({ companyName: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nombre de tu Empresa"
                                    />
                                </div>

                                {/* 2. TAMAÑO (ACTUALIZADO con PERSONALIZADO) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-2">
                                        <Layout className="w-3 h-3" /> Dimensiones
                                    </label>
                                    <select
                                        value={settings.size}
                                        onChange={(e) => updateSettings({ size: e.target.value as LabelSize })}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 dark:text-white mb-2"
                                    >
                                        <option value="50x25mm">50mm x 25mm (Estándar)</option>
                                        <option value="2x1">2" x 1" (Pulgadas)</option>
                                        <option value="1.5x1">1.5" x 1" (Pequeña)</option>
                                        <option value="custom">📏 Medida Personalizada</option>
                                    </select>

                                    {/* Inputs condicionales para medida personalizada */}
                                    {settings.size === 'custom' && (
                                        <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 animate-fade-in">
                                            <div>
                                                <label className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Ancho</label>
                                                <input
                                                    type="text"
                                                    value={settings.customWidth || ''}
                                                    onChange={(e) => updateSettings({ customWidth: e.target.value })}
                                                    className="w-full p-2 text-sm font-bold rounded border border-blue-200 text-center"
                                                    placeholder="Ej: 2in"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Alto</label>
                                                <input
                                                    type="text"
                                                    value={settings.customHeight || ''}
                                                    onChange={(e) => updateSettings({ customHeight: e.target.value })}
                                                    className="w-full p-2 text-sm font-bold rounded border border-blue-200 text-center"
                                                    placeholder="Ej: 0.95in"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 3. VISIBILIDAD (SIN SKU/UPC) */}
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
                                    {/* Eliminado: Mostrar SKU/UPC */}
                                </div>
                            </div>

                            <button
                                onClick={() => updateSettings({
                                    size: '50x25mm',
                                    showPrice: true,
                                    showSku: false,
                                    showName: true,
                                    boldPrice: true,
                                    companyName: ''
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