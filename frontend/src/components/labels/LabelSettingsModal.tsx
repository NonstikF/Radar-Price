import { X, Save, Tag, Ruler, Building2 } from 'lucide-react';
import { useLabelSettings } from '../../hooks/useLabelSettings';

interface Props {
    onClose: () => void;
}

export function LabelSettingsModal({ onClose }: Props) {
    const { settings, updateSettings } = useLabelSettings();

    // Lista simple de tamaños disponibles
    const sizes = [
        { id: '50x25mm', label: '50mm x 25mm' },
        { id: '2x1', label: '2" x 1"' },
        { id: '1.5x1', label: '1.5" x 1"' },
        { id: 'custom', label: 'Personalizado' }
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative animate-scale-in z-10 border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Ruler className="w-6 h-6 text-blue-600" /> Configurar Etiqueta
                </h2>

                <div className="space-y-6">

                    {/* 1. EMPRESA */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Building2 className="w-3 h-3" /> Título / Empresa
                        </label>
                        <input
                            type="text"
                            value={settings.companyName || ''}
                            onChange={(e) => updateSettings({ companyName: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-white"
                            placeholder="Ej: Mi Tienda"
                        />
                    </div>

                    {/* 2. TAMAÑO DE PAPEL */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Ruler className="w-3 h-3" /> Tamaño de Papel
                        </label>

                        {/* Botones de selección */}
                        <div className="grid grid-cols-2 gap-2">
                            {sizes.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => updateSettings({ size: item.id as any })}
                                    className={`py-2 rounded-lg border-2 font-bold text-xs transition-all ${settings.size === item.id ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* INPUTS DE MEDIDA PERSONALIZADA (Solo aparecen si eliges Personalizado) */}
                        {settings.size === 'custom' && (
                            <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 animate-fade-in">
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
                                    <p className="text-[9px] text-gray-400 mt-1 text-center">Usa "in" o "mm"</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. FUENTE DEL NOMBRE */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                            <Tag className="w-3 h-3" /> Mostrar Nombre
                        </label>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => updateSettings({ nameSource: 'alias_if_available' })}
                                className={`p-3 rounded-xl border text-left transition-all ${settings.nameSource === 'alias_if_available' ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}`}
                            >
                                <span className="text-xs font-bold block text-gray-800">Automático</span>
                                <span className="text-[10px] text-gray-500">Usa Alias si existe, si no usa el Nombre.</span>
                            </button>
                            <button
                                onClick={() => updateSettings({ nameSource: 'always_alias' })}
                                className={`p-3 rounded-xl border text-left transition-all ${settings.nameSource === 'always_alias' ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}`}
                            >
                                <span className="text-xs font-bold block text-gray-800">Siempre Alias</span>
                                <span className="text-[10px] text-gray-500">Solo muestra el alias (útil para etiquetas cortas).</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95">
                        <Save className="w-5 h-5" /> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
}