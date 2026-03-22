import { FileText, Search, PlusCircle, Users, History, ArrowRight, Tag } from 'lucide-react';

interface Props {
    onNavigate: (view: string) => void;
}

export function Dashboard({ onNavigate }: Props) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';
    const perms = user.permissions || [];

    const can = (module: string) => isAdmin || perms.includes(module);

    return (
        <div className="w-full max-w-5xl mx-auto p-4 animate-fade-in">

            {/* TÍTULO PEQUEÑO */}
            <div className="mb-4">
                <h1 className="text-xl font-black text-gray-900 dark:text-white">Panel Principal</h1>
            </div>

            {/* GRID PRINCIPAL */}
            <div className="grid grid-cols-2 gap-3">

                {/* 1. CARGAR XML (BANNER HORIZONTAL) */}
                {can('upload') && (
                    <button
                        onClick={() => onNavigate('upload')}
                        className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white h-20 px-5 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-between group overflow-hidden relative"
                    >
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-lg leading-none">Cargar XML</h3>
                                <p className="text-blue-100 text-xs mt-0.5">Importar facturas</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform relative z-10" />

                        {/* Decoración fondo */}
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-16 pointer-events-none"></div>
                    </button>
                )}

                {/* 2. HISTORIAL */}
                {(can('history') || can('dashboard')) && (
                    <button
                        onClick={() => onNavigate('history')}
                        className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-28 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm active:scale-95 flex flex-col justify-between text-left group"
                    >
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 p-2 rounded-xl w-fit">
                            <History className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Historial</h3>
                            <span className="text-[10px] text-gray-400 group-hover:text-yellow-600 transition-colors flex items-center gap-1">
                                Ver anterior <ArrowRight className="w-2 h-2" />
                            </span>
                        </div>
                    </button>
                )}

                {/* 3. BUSCADOR */}
                {can('search') && (
                    <button
                        onClick={() => onNavigate('search')}
                        className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-28 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm active:scale-95 flex flex-col justify-between text-left group"
                    >
                        <div className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 p-2 rounded-xl w-fit">
                            <Search className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Buscador</h3>
                            <span className="text-[10px] text-gray-400 group-hover:text-purple-600 transition-colors flex items-center gap-1">
                                Consultar <ArrowRight className="w-2 h-2" />
                            </span>
                        </div>
                    </button>
                )}

                {/* 4. MANUAL */}
                {can('manual') && (
                    <button
                        onClick={() => onNavigate('manual')}
                        className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-28 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm active:scale-95 flex flex-col justify-between text-left group"
                    >
                        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-2 rounded-xl w-fit">
                            <PlusCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Manual</h3>
                            <span className="text-[10px] text-gray-400 group-hover:text-green-600 transition-colors flex items-center gap-1">
                                Registrar <ArrowRight className="w-2 h-2" />
                            </span>
                        </div>
                    </button>
                )}

                {/* 5. DISEÑADOR DE ETIQUETAS (NUEVO) */}
                {/* Se muestra para todos, o puedes restringirlo con can('labels') si prefieres */}
                <button
                    onClick={() => onNavigate('labels')}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-28 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm active:scale-95 flex flex-col justify-between text-left group"
                >
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 p-2 rounded-xl w-fit">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">Etiquetas</h3>
                        <span className="text-[10px] text-gray-400 group-hover:text-cyan-600 transition-colors flex items-center gap-1">
                            Configurar <ArrowRight className="w-2 h-2" />
                        </span>
                    </div>
                </button>

                {/* 6. USUARIOS (SOLO ADMIN) */}
                {isAdmin && (
                    <button
                        onClick={() => onNavigate('admin')}
                        className="bg-[#1a1b1e] dark:bg-gray-700 hover:bg-black dark:hover:bg-gray-600 h-28 p-3 rounded-2xl shadow-lg active:scale-95 flex flex-col justify-between text-left group relative overflow-hidden"
                    >
                        <div className="bg-white/10 p-2 rounded-xl w-fit relative z-10">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="font-bold text-white text-sm">Usuarios</h3>
                            <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors flex items-center gap-1">
                                Gestionar <ArrowRight className="w-2 h-2" />
                            </span>
                        </div>
                        {/* Decoración */}
                        <div className="absolute right-0 top-0 w-20 h-20 bg-white/5 rounded-full blur-xl -mr-5 -mt-5 pointer-events-none"></div>
                    </button>
                )}

            </div>
        </div>
    );
}