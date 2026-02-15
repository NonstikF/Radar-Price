import { X, Save, Tag, Ruler, Building2, Settings2 } from 'lucide-react';
import { useLabelSettings, type LabelSize } from '../../hooks/useLabelSettings';

interface Props {
    onClose: () => void;
}

export function LabelSettingsModal({ onClose }: Props) {
    const { settings, updateSettings } = useLabelSettings();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative animate-scale-in z-10 border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Settings2 className="w-6 h-6 text-blue-600" /> Configurar Etiqueta
                </h2>

                <div className="space-y-6">

                    {/* 1. TITULO EMPRESA */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Building2 className="w-3 h-3" /> Título / Empresa
                        </label>
                        <input
                            type="text"
                            value={settings.companyName}
                            onChange={(e) => updateSettings({ companyName: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-white"
                            placeholder="Ej: PlantArte"
                        />
                    </div>

                    {/* 2. TAMAÑO (Ahora con opción Personalizada) */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Ruler className="w-3 h-3" /> Tamaño de Papel
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {/* Botones predefinidos */}
                            {(['50x25mm', '2x1', '1.5x1', 'custom'] as LabelSize[]).map((size) => (
                                <button
                                    key={size}
                                    onClick={() => updateSettings({ size })}
                                    className={`py-2 rounded-lg border-2 font-bold text-xs transition-all ${settings.size === size ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-100 dark:border-gray-700 text-gray-500'}`}
                                >
                                    {size === '50x25mm' && '50mm x 25mm'}
                                    {size === '2x1' && '2" x 1"'}
                                    {size === '1.5x1' && '1.5" x 1"'}
                                    {size === 'custom' && 'Personalizado'}
                                </button>
                            ))}
                        </div>

                        {/* INPUTS PARA MEDIDA PERSONALIZADA */}
                        {settings.size === 'custom' && (
                            <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                                <div>
                                    <label className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Ancho</label>
                                    <input
                                        type="text"
                                        value={settings.customWidth}
                                        onChange={(e) => updateSettings({ customWidth: e.target.value })}
                                        className="w-full p-2 text-sm font-bold rounded border border-blue-200 text-center"
                                        placeholder="Ej: 2in"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Alto</label>
                                    <input
                                        type="text"
                                        value={settings.customHeight}
                                        onChange={(e) => updateSettings({ customHeight: e.target.value })}
                                        className="w-full p-2 text-sm font-bold rounded border border-blue-200 text-center"
                                        placeholder="Ej: 1in"
                                    />
                                    <p className="text-[9px] text-gray-400 mt-1 text-center">Usa "in" o "mm"</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. LÓGICA DE NOMBRE */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Tag className="w-3 h-3" /> Fuente del Nombre
                        </label>
                        <div className="space-y-2">
                            <Option
                                selected={settings.nameSource === 'alias_if_available'}
                                onClick={() => updateSettings({ nameSource: 'alias_if_available' })}
                                title="Automático"
                                desc="Usa Alias si existe, si no usa Nombre."
                            />
                            <Option
                                selected={settings.nameSource === 'always_alias'}
                                onClick={() => updateSettings({ nameSource: 'always_alias' })}
                                title="Siempre Alias"
                                desc="Solo muestra el alias."
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95">
                        <Save className="w-5 h-5" /> Guardar y Salir
                    </button>
                </div>
            </div>
        </div>
    );
}

// Componente auxiliar
const Option = ({ selected, onClick, title, desc }: any) => (
    <div onClick={onClick} className={`p-3 rounded-xl border cursor-pointer transition-all ${selected ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
        <div className="flex items-center gap-2 mb-1">
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </div>
            <span className={`font-bold text-sm ${selected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>{title}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 leading-tight">{desc}</p>
    </div>
);