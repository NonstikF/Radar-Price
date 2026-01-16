import { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, Search, PlusCircle, AlertCircle, Package, ArrowRight, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

interface Props {
    // ✅ Actualizamos la definición para aceptar el segundo parámetro opcional
    onNavigate: (view: string, filterMissing?: boolean) => void;
}

export function Dashboard({ onNavigate }: Props) {
    const [stats, setStats] = useState({ total: 0, missingPrice: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await axios.get(`${API_URL}/invoices/products`);
                const allProducts = response.data;
                const total = allProducts.length;
                const missing = allProducts.filter((p: any) => !p.selling_price || parseFloat(p.selling_price) <= 0).length;
                setStats({ total, missingPrice: missing });
            } catch (error) {
                console.error("Error cargando estadísticas", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-24">

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. Total Productos (Clic lleva al buscador normal) */}
                <div
                    onClick={() => onNavigate('search')}
                    className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
                >
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Productos</p>
                        {loading ? <Loader2 className="w-8 h-8 text-blue-600 animate-spin" /> : <p className="text-5xl font-black text-blue-600 tracking-tighter">{stats.total}</p>}
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                        <Package className="w-8 h-8 text-blue-600" />
                    </div>
                </div>

                {/* 2. Pendientes (Clic lleva al buscador CON FILTRO) */}
                <div
                    onClick={() => onNavigate('search', true)} // 👈 AQUÍ ACTIVAMOS EL FILTRO
                    className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all cursor-pointer ring-2 ring-transparent hover:ring-orange-100"
                >
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sin Precio Venta</p>
                        {loading ? <Loader2 className="w-8 h-8 text-orange-500 animate-spin" /> : <p className="text-5xl font-black text-orange-500 tracking-tighter">{stats.missingPrice}</p>}
                    </div>
                    <div className="bg-orange-50 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                        <AlertCircle className="w-8 h-8 text-orange-500" />
                    </div>
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-orange-500 text-xs font-bold flex items-center gap-1">
                        Ver lista <ArrowRight className="w-3 h-3" />
                    </div>
                </div>

            </div>

            <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">Herramientas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <button onClick={() => onNavigate('upload')} className="group bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-3xl shadow-lg hover:shadow-blue-500/30 transition-all text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm"><FileText className="w-6 h-6 text-white" /></div>
                        <h3 className="text-xl font-bold mb-1">Cargar XML</h3>
                        <p className="text-blue-100 text-sm mb-4 opacity-90">Importa facturas masivamente.</p>
                        <div className="flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm group-hover:bg-white group-hover:text-blue-600 transition-colors">Ir ahora <ArrowRight className="w-3 h-3" /></div>
                    </div>
                </button>

                <button onClick={() => onNavigate('search')} className="group bg-white border border-gray-200 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-blue-300 transition-all text-left">
                    <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><Search className="w-6 h-6 text-purple-600" /></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">Buscador</h3>
                    <p className="text-gray-500 text-sm mb-4">Consulta precios.</p>
                    <span className="text-blue-600 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">Entrar <ArrowRight className="w-3 h-3" /></span>
                </button>

                <button onClick={() => onNavigate('manual')} className="group bg-white border border-gray-200 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-green-300 transition-all text-left">
                    <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><PlusCircle className="w-6 h-6 text-green-600" /></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">Manual</h3>
                    <p className="text-gray-500 text-sm mb-4">Registro manual.</p>
                    <span className="text-green-600 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">Entrar <ArrowRight className="w-3 h-3" /></span>
                </button>

            </div>
        </div>
    );
}