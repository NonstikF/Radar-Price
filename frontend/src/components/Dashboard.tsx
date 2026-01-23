import { FileText, Search, PlusCircle, ArrowRight } from 'lucide-react';

interface Props {
    onNavigate: (view: string, filterMissing?: boolean) => void;
}

export function Dashboard({ onNavigate }: Props) {
    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-24">

            {/* Encabezado */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Panel Principal</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Bienvenido a Radar Price. Selecciona una herramienta para comenzar.</p>
                </div>
                <div className="text-right hidden md:block">
                    <span className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Fecha</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{new Date().toLocaleDateString()}</span>
                </div>
            </div>

            {/* Sección de Herramientas */}
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Herramientas Rápidas</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Botón Cargar XML */}
                <button onClick={() => onNavigate('upload')} className="group bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-3xl shadow-lg hover:shadow-blue-500/30 transition-all text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm"><FileText className="w-6 h-6 text-white" /></div>
                        <h3 className="text-xl font-bold mb-1">Cargar XML</h3>
                        <p className="text-blue-100 text-sm mb-4 opacity-90">Importa facturas masivamente.</p>
                        <div className="flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm group-hover:bg-white group-hover:text-blue-600 transition-colors">Ir ahora <ArrowRight className="w-3 h-3" /></div>
                    </div>
                </button>

                {/* Botón Buscador */}
                <button onClick={() => onNavigate('search')} className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-500 transition-all text-left">
                    <div className="bg-purple-50 dark:bg-purple-900/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><Search className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Buscador</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Consulta y edita precios.</p>
                    <span className="text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">Entrar <ArrowRight className="w-3 h-3" /></span>
                </button>

                {/* Botón Manual */}
                <button onClick={() => onNavigate('manual')} className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-green-300 dark:hover:border-green-500 transition-all text-left">
                    <div className="bg-green-50 dark:bg-green-900/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><PlusCircle className="w-6 h-6 text-green-600 dark:text-green-400" /></div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Manual</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Registro manual unitario.</p>
                    <span className="text-green-600 dark:text-green-400 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">Entrar <ArrowRight className="w-3 h-3" /></span>
                </button>

            </div>
        </div>
    );
}