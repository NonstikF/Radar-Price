import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight, PackageSearch, ClipboardList, ScanBarcode, BarChart3 } from 'lucide-react';

export function Inventory() {
    const navigate = useNavigate();

    const modules = [
        {
            key: 'locations',
            title: 'Ubicaciones',
            description: 'Gestiona estantes, racks y ubicaciones físicas del almacén',
            icon: MapPin,
            color: 'indigo',
            path: '/inventory/locations',
            ready: true,
        },
        {
            key: 'assign',
            title: 'Asignar Productos',
            description: 'Escanea productos y asígnalos a ubicaciones específicas',
            icon: ScanBarcode,
            color: 'emerald',
            path: '/inventory/assign',
            ready: true,
        },
        {
            key: 'reports',
            title: 'Reportes',
            description: 'Historial de movimientos de existencias y resumen de inventario',
            icon: BarChart3,
            color: 'violet',
            path: '/inventory/reports',
            ready: true,
        },
        {
            key: 'stock',
            title: 'Conteo de Stock',
            description: 'Realiza conteos e inventarios físicos',
            icon: ClipboardList,
            color: 'amber',
            path: '/inventory/stock',
            ready: false,
        },
        {
            key: 'movements',
            title: 'Movimientos',
            description: 'Entradas, salidas y transferencias entre ubicaciones',
            icon: PackageSearch,
            color: 'teal',
            path: '/inventory/movements',
            ready: false,
        },
    ];

    const colorMap: Record<string, { bg: string; icon: string; hover: string; border: string }> = {
        indigo: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/15', icon: 'text-indigo-500 dark:text-indigo-400', hover: 'hover:border-indigo-400/50', border: 'border-indigo-500/20' },
        emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', icon: 'text-emerald-500 dark:text-emerald-400', hover: 'hover:border-emerald-400/50', border: 'border-emerald-500/20' },
        amber: { bg: 'bg-amber-500/10 dark:bg-amber-500/15', icon: 'text-amber-500 dark:text-amber-400', hover: 'hover:border-amber-400/50', border: 'border-amber-500/20' },
        teal: { bg: 'bg-teal-500/10 dark:bg-teal-500/15', icon: 'text-teal-500 dark:text-teal-400', hover: 'hover:border-teal-400/50', border: 'border-teal-500/20' },
        violet: { bg: 'bg-violet-500/10 dark:bg-violet-500/15', icon: 'text-violet-500 dark:text-violet-400', hover: 'hover:border-violet-400/50', border: 'border-violet-500/20' },
    };

    const ready = modules.filter(m => m.ready);
    const soon = modules.filter(m => !m.ready);

    return (
        <div className="w-full max-w-6xl mx-auto p-4 md:p-8 pb-24 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Inventario</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona ubicaciones, movimientos y reportes de tu almacén.</p>
            </div>

            {/* Módulos disponibles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {ready.map((mod) => {
                    const colors = colorMap[mod.color];
                    const Icon = mod.icon;
                    return (
                        <button
                            key={mod.key}
                            onClick={() => navigate(mod.path)}
                            className={`group relative bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 ${colors.hover} cursor-pointer active:scale-[0.98] transition-all text-left flex flex-col gap-4`}
                        >
                            <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center ${colors.icon}`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base mb-1">{mod.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug">{mod.description}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                                Abrir <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Próximamente */}
            {soon.length > 0 && (
                <>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Próximamente</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {soon.map((mod) => {
                            const colors = colorMap[mod.color];
                            const Icon = mod.icon;
                            return (
                                <div
                                    key={mod.key}
                                    className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 flex items-center gap-4 opacity-60"
                                >
                                    <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center ${colors.icon} shrink-0`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm">{mod.title}</h3>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{mod.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
