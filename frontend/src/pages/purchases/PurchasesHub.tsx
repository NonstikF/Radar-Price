import { useNavigate } from 'react-router-dom';
import { FileText, History, ShoppingCart, Truck, ArrowRight } from 'lucide-react';

export function PurchasesHub() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    const modules = [
        {
            key: 'upload',
            title: 'Cargar XML',
            description: 'Importa facturas desde archivos XML',
            icon: FileText,
            color: 'blue',
            path: '/upload',
            ready: true,
            show: true,
        },
        {
            key: 'history',
            title: 'Historial',
            description: 'Consulta cargas anteriores y lotes',
            icon: History,
            color: 'amber',
            path: '/history',
            ready: true,
            show: true,
        },
        {
            key: 'shopping',
            title: 'Lista de Compras',
            description: 'Gestiona listas de compras por proveedor',
            icon: ShoppingCart,
            color: 'emerald',
            path: '/shopping',
            ready: true,
            show: true,
        },
        {
            key: 'suppliers',
            title: 'Proveedores',
            description: 'Administra proveedores y asigna productos',
            icon: Truck,
            color: 'orange',
            path: '/suppliers',
            ready: true,
            show: isAdmin,
        },
    ];

    const colorMap: Record<string, { bg: string; icon: string; hover: string }> = {
        blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400', hover: 'hover:border-blue-200 dark:hover:border-blue-800' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', hover: 'hover:border-amber-200 dark:hover:border-amber-800' },
        emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', hover: 'hover:border-emerald-200 dark:hover:border-emerald-800' },
        orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-600 dark:text-orange-400', hover: 'hover:border-orange-200 dark:hover:border-orange-800' },
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Compras</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de compras, proveedores y facturación.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.filter(m => m.show).map((mod) => {
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
