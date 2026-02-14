import {
    Settings, RotateCcw,
    Type, Layout, Eye, Tag
} from 'lucide-react';
import { ProductLabel } from '../components/labels/ProductLabel';
// CORRECCIÓN: Agregamos 'type' explícitamente a LabelSettings
import { useLabelSettings } from '../hooks/useLabelSettings';

export default function LabelDesigner() {
    const { settings, updateSettings } = useLabelSettings();

    // Producto de ejemplo para la previsualización
    const dummyProduct = {
        name: "Maceta Rattan Redonda D20 Chocolate Premium",
        price: 185.50,
        selling_price: 185.50,
        sku: "MRRD2006",
        upc: "7501234567890",
        alias: "Rattan Choco"
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Tag className="text-blue-600" /> Diseñador de Etiquetas
                    </h1>
                    <p className="text-gray-500 mt-1">Personaliza cómo se verán tus etiquetas al imprimirlas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* COLUMNA IZQUIERDA: PREVISUALIZACIÓN */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-gray-100 dark:bg-gray-800/50 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-700 relative group">

                        <span className="absolute top-4 left-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Vista Previa Real</span>

                        {/* Aquí renderizamos tu componente real */}
                        <div className="shadow-xl transition-all duration-300 hover:scale-105">
                            <ProductLabel product={dummyProduct} settings={settings} />
                        </div>

                        <p className="mt-8 text-xs text-gray-400 text-center max-w-xs">
                            * Así es exactamente como saldrá en tu impresora térmica.
                            Asegúrate de que el tamaño de papel coincida.
                        </p>
                    </div>
                </div>

                {/* COLUMNA DERECHA: CONTROLES */}
                <div className="lg:col-span-5 space-y-6">

                    {/* TARJETA DE CONFIGURACIÓN */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                            <Settings className="w-5 h-5 text-blue-600" />
                            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Configuración</h2>
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
                                <ToggleOption
                                    label="Mostrar Fecha de Impresión"
                                    checked={settings.showDate}
                                    onChange={(v) => updateSettings({ showDate: v })}
                                />
                            </div>

                            {/* SECCIÓN: ESTILO */}
                            <div className="space-y-3 pt-2">
                                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                    <Type className="w-3 h-3" /> Estilo
                                </label>
                                <ToggleOption
                                    label="Precio en Negritas (Bold)"
                                    checked={settings.boldPrice}
                                    onChange={(v) => updateSettings({ boldPrice: v })}
                                />
                            </div>

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
                        className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" /> Restaurar valores originales
                    </button>
                </div>
            </div>
        </div>
    );
}

// Pequeño componente auxiliar para los interruptores
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