import { X, Save, Tag, Type, Ruler, Building2 } from 'lucide-react';
import { useLabelSettings, type LabelSize } from '../hooks/useLabelSettings'; interface Props {
    onClose: () => void;
}

export function LabelSettingsModal({ onClose }: Props) {
    const { settings, updateSettings } = useLabelSettings();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            {/* Click afuera para cerrar */}
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative animate-scale-in z-10 border border-gray-100 dark:border-gray-700">

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Tag className="w-6 h-6 text-blue-600" /> Configurar Etiqueta
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
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-white transition-all"
                            placeholder="Ej: PlantArte"
                        />
                    </div>

                    {/* 2. TAMAÑO */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Ruler className="w-3 h-3" /> Tamaño de Papel
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {(['1.5x1', '2x1'] as LabelSize[]).map((size) => (
                                <button
                                    key={size}
                                    onClick={() => updateSettings({ size })}
                                    className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${settings.size === size ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                >
                                    {size === '1.5x1' ? '1.5" x 1"' : '2" x 1"'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. LÓGICA DE NOMBRE */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Type className="w-3 h-3" /> Fuente del Nombre
                        </label>
                        <div className="space-y-2">
                            <Option
                                selected={settings.nameSource === 'alias_if_available'}
                                onClick={() => updateSettings({ nameSource: 'alias_if_available' })}
                                title="Automático (Recomendado)"
                                desc="Usa el Alias si existe. Si no, usa el nombre original."
                            />
                            <Option
                                selected={settings.nameSource === 'always_alias'}
                                onClick={() => updateSettings({ nameSource: 'always_alias' })}
                                title="Siempre Alias"
                                desc="Solo muestra el alias. Si no tiene, sale vacío."
                            />
                            <Option
                                selected={settings.nameSource === 'always_name'}
                                onClick={() => updateSettings({ nameSource: 'always_name' })}
                                title="Siempre Nombre Original"
                                desc="Ignora el alias, siempre muestra el nombre del sistema."
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95">
                        <Save className="w-5 h-5" /> Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    );
}

// Componente auxiliar para las opciones
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