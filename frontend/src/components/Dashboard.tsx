import { FileText, Search, PlusCircle, TrendingUp, AlertCircle, Package, ArrowRight } from 'lucide-react';

interface Props {
    products: any[];
    onNavigate: (view: string) => void;
}

export function Dashboard({ products, onNavigate }: Props) {

    // --- ESTADÍSTICAS RÁPIDAS ---
    const totalProducts = products.length;
    const withPrice = products.filter(p => parseFloat(p.selling_price) > 0).length;
    const withoutPrice = totalProducts - withPrice;

    // Calcular valor total de inventario (Costo)
    const totalInventoryValue = products.reduce((acc, curr) => acc + (curr.cost_with_tax || 0) * (curr.stock || curr.qty || 0), 0);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-24">

            {/* Header de Bienvenida */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Panel Principal</h1>
                    <p className="text-gray-500 mt-1">Bienvenido a Radar Price. Aquí tienes un resumen de tu inventario.</p>
                </div>
                <div className="text-right hidden md:block">
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha</span>
                    <span className="font-medium text-gray-700">{new Date().toLocaleDateString()}</span>
                </div>
            </div>

            {/* --- TARJETAS DE ESTADÍSTICAS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Productos */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Productos</p>
                        <p className="text-3xl font-black text-blue-600">{totalProducts}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl">
                        <Package className="w-6 h-6 text-blue-600" />
                    </div>
                </div>

                {/* Pendientes de Precio */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Sin Precio Venta</p>
                        <p className="text-3xl font-black text-orange-500">{withoutPrice}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-xl">
                        <AlertCircle className="w-6 h-6 text-orange-500" />
                    </div>
                </div>

                {/* Valor Inventario (Aproximado) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Valor Inventario (Costo)</p>
                        <p className="text-3xl font-black text-green-600">${totalInventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                </div>
            </div>

            {/* --- ACCESOS RÁPIDOS (MÓDULOS) --- */}
            <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">Herramientas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Cargar XML */}
                <button
                    onClick={() => onNavigate('upload')}
                    className="group bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-3xl shadow-lg hover:shadow-blue-500/30 transition-all text-left relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Cargar XML</h3>
                        <p className="text-blue-100 text-sm mb-4 opacity-90">Importa facturas masivamente desde el SAT.</p>
                        <div className="flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm group-hover:bg-white group-hover:text-blue-600 transition-colors">
                            Ir ahora <ArrowRight className="w-3 h-3" />
                        </div>
                    </div>
                </button>

                {/* 2. Buscador */}
                <button
                    onClick={() => onNavigate('search')}
                    className="group bg-white border border-gray-200 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-blue-300 transition-all text-left"
                >
                    <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                        <Search className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">Buscador & Precios</h3>
                    <p className="text-gray-500 text-sm mb-4">Consulta y edita precios individuales rápidamente.</p>
                    <span className="text-blue-600 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Entrar <ArrowRight className="w-3 h-3" />
                    </span>
                </button>

                {/* 3. Manual */}
                <button
                    onClick={() => onNavigate('manual')}
                    className="group bg-white border border-gray-200 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-green-300 transition-all text-left"
                >
                    <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                        <PlusCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">Registro Manual</h3>
                    <p className="text-gray-500 text-sm mb-4">Agrega productos que no tienen factura XML.</p>
                    <span className="text-green-600 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Entrar <ArrowRight className="w-3 h-3" />
                    </span>
                </button>

            </div>
        </div>
    );
}