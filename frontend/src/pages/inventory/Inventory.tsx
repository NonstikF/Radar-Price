import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight, PackageSearch, ClipboardList } from 'lucide-react';

export function Inventory() {
    const navigate = useNavigate();

    const modules = [
        {
            key: 'locations',
            title: 'Ubicaciones',
            description: 'Gestiona estantes, racks y ubicaciones físicas',
            icon: MapPin,
            color: 'indigo',
            path: '/inventory/locations',
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
            description: 'Entradas, salidas y transferencias',
            icon: PackageSearch,
            color: 'teal',
            path: '/inventory/movements',
            ready: false,
        },
    ];

    const colorMap: Record<string, { bg: string; icon: string; hover: string }> = {
        indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: 'text-indigo-600 dark:text-indigo-400', hover: 'hover:border-indigo-200 dark:hover:border-indigo-800' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', hover: 'hover:border-amber-200 dark:hover:border-amber-800' },
        teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', icon: 'text-teal-600 dark:text-teal-400', hover: 'hover:border-teal-200 dark:hover:border-teal-800' },
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Inventario</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Módulos de gestión de inventario.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map((mod) => {
                    const colors = colorMap[mod.color];
                    const Icon = mod.icon;
                    return (
                        <button
                            key={mod.key}
                            onClick={() => mod.ready && navigate(mod.path)}
                            disabled={!mod.ready}
                            className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent ${mod.ready ? `${colors.hover} cursor-pointer active:scale-[0.98]` : 'opacity-50 cursor-not-allowed'} transition-all text-left flex items-center gap-4 group`}
                        >
                            <div className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center ${colors.icon} shrink-0`}>
                                <Icon className="w-7 h-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">{mod.title}</h3>
                                    {!mod.ready && <span className="text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full uppercase">Próximamente</span>}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mod.description}</p>
                            </div>
                            {mod.ready && <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-1 transition-all shrink-0" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
