import { Package, ShoppingCart, Warehouse, Users, ArrowRight } from 'lucide-react';

interface Props {
    onNavigate: (view: string) => void;
}

export function Dashboard({ onNavigate }: Props) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';
    const perms = user.permissions || [];

    const can = (module: string) => isAdmin || perms.includes(module);

    const modules = [
        {
            key: 'products',
            title: 'Productos',
            description: 'Buscador, registro manual y etiquetas',
            icon: Package,
            color: 'purple' as const,
            path: 'products',
            show: can('search') || can('manual'),
        },
        {
            key: 'purchases',
            title: 'Compras',
            description: 'XML, historial, listas y proveedores',
            icon: ShoppingCart,
            color: 'blue' as const,
            path: 'purchases',
            show: can('upload') || can('shopping'),
        },
        {
            key: 'inventory',
            title: 'Inventario',
            description: 'Ubicaciones, asignación y stock',
            icon: Warehouse,
            color: 'indigo' as const,
            path: 'inventory',
            show: can('inventory'),
        },
        {
            key: 'admin',
            title: 'Administración',
            description: 'Gestión de usuarios y permisos',
            icon: Users,
            color: 'gray' as const,
            path: 'admin',
            show: isAdmin,
        },
    ];

    const colorMap = {
        purple: {
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            icon: 'text-purple-600 dark:text-purple-400',
            border: 'border-purple-100 dark:border-purple-900/30',
            hover: 'hover:border-purple-300 dark:hover:border-purple-700',
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            icon: 'text-blue-600 dark:text-blue-400',
            border: 'border-blue-100 dark:border-blue-900/30',
            hover: 'hover:border-blue-300 dark:hover:border-blue-700',
        },
        indigo: {
            bg: 'bg-indigo-50 dark:bg-indigo-900/20',
            icon: 'text-indigo-600 dark:text-indigo-400',
            border: 'border-indigo-100 dark:border-indigo-900/30',
            hover: 'hover:border-indigo-300 dark:hover:border-indigo-700',
        },
        gray: {
            bg: 'bg-gray-100 dark:bg-gray-700',
            icon: 'text-gray-700 dark:text-gray-300',
            border: 'border-gray-200 dark:border-gray-600',
            hover: 'hover:border-gray-400 dark:hover:border-gray-500',
        },
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Panel Principal</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selecciona un módulo para comenzar.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {modules.filter(m => m.show).map((mod) => {
                    const colors = colorMap[mod.color];
                    const Icon = mod.icon;
                    return (
                        <button
                            key={mod.key}
                            onClick={() => onNavigate(mod.path)}
                            className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border ${colors.border} ${colors.hover} active:scale-[0.98] transition-all text-left flex items-center gap-5 group`}
                        >
                            <div className={`w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center ${colors.icon} shrink-0`}>
                                <Icon className="w-8 h-8" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-gray-900 dark:text-white text-lg">{mod.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{mod.description}</p>
                            </div>
                            <ArrowRight className="w-6 h-6 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-1 transition-all shrink-0" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
