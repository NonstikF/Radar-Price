import { useNavigate } from 'react-router-dom';
import { Search, PlusCircle, Tag, Layers, ArrowRight } from 'lucide-react';

export function ProductsHub() {
    const navigate = useNavigate();

    const modules = [
        {
            key: 'search',
            title: 'Buscador de Precios',
            description: 'Consulta precios, stock y detalles de productos',
            icon: Search,
            color: 'purple',
            path: '/search',
            ready: true,
        },
        {
            key: 'manual',
            title: 'Agregar Manual',
            description: 'Registra productos de forma manual',
            icon: PlusCircle,
            color: 'green',
            path: '/manual',
            ready: true,
        },
        {
            key: 'categories',
            title: 'Categorías',
            description: 'Agrupa productos por temporada o tipo',
            icon: Layers,
            color: 'amber',
            path: '/categories',
            ready: true,
        },
        {
            key: 'labels',
            title: 'Etiquetas',
            description: 'Diseña e imprime etiquetas de precios',
            icon: Tag,
            color: 'cyan',
            path: '/labels',
            ready: true,
        },
    ];

    const colorMap: Record<string, { bg: string; icon: string; hover: string }> = {
        purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400', hover: 'hover:border-purple-200 dark:hover:border-purple-800' },
        green: { bg: 'bg-green-50 dark:bg-green-900/20', icon: 'text-green-600 dark:text-green-400', hover: 'hover:border-green-200 dark:hover:border-green-800' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', hover: 'hover:border-amber-200 dark:hover:border-amber-800' },
        cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', icon: 'text-cyan-600 dark:text-cyan-400', hover: 'hover:border-cyan-200 dark:hover:border-cyan-800' },
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Productos</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de catálogo de productos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map((mod) => {
                    const colors = colorMap[mod.color];
                    const Icon = mod.icon;
                    return (
                        <button
                            key={mod.key}
                            onClick={() => navigate(mod.path)}
                            className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-transparent ${colors.hover} cursor-pointer active:scale-[0.98] transition-all text-left flex items-center gap-4 group`}
                        >
                            <div className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center ${colors.icon} shrink-0`}>
                                <Icon className="w-7 h-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">{mod.title}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mod.description}</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-1 transition-all shrink-0" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
