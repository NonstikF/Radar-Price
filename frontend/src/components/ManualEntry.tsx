import { useState } from 'react';
import axios from 'axios';
import { Save, Barcode, Hash, Tag, PlusCircle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

//IMPORTAMOS LA CONFIGURACIÓN CENTRALIZADA
import { API_URL } from '../config';

export function ManualEntry() {
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    // Formulario
    const [formData, setFormData] = useState({
        name: "",
        sku: "",
        upc: "",
        price: "",        // Costo
        selling_price: "", // Venta
        stock: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMsg("");
        setErrorMsg("");

        if (!formData.name.trim()) {
            setErrorMsg("El nombre es obligatorio");
            setLoading(false);
            return;
        }

        try {
            // Preparamos datos numéricos
            const payload = {
                name: formData.name,
                sku: formData.sku || null, // Si está vacío mandamos null para que el backend genere uno
                upc: formData.upc || null,
                price: parseFloat(formData.price) || 0,
                selling_price: parseFloat(formData.selling_price) || 0,
                stock: parseInt(formData.stock) || 0
            };

            // Usamos la variable importada
            await axios.post(`${API_URL}/invoices/products/manual`, payload);

            setSuccessMsg(`Producto "${formData.name}" agregado con éxito.`);

            // Limpiar formulario
            setFormData({ name: "", sku: "", upc: "", price: "", selling_price: "", stock: "" });

        } catch (error: any) {
            setErrorMsg(error.response?.data?.detail || "Error al guardar el producto.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 pb-24">

            {/* Título */}
            <div className="text-center mb-8">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PlusCircle className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900">Agregar Producto</h2>
                <p className="text-gray-500 text-sm">Registro manual de inventario</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">

                {/* Mensajes de Estado */}
                {successMsg && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-2xl flex items-center gap-3 border border-green-100 animate-fade-in">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="font-bold text-sm">{successMsg}</span>
                    </div>
                )}
                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100 animate-fade-in">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="font-bold text-sm">{errorMsg}</span>
                    </div>
                )}

                {/* NOMBRE (Obligatorio) */}
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Nombre del Producto *</label>
                    <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-medium text-gray-900"
                            placeholder="Ej. Maceta de Barro 12cm"
                            autoFocus
                        />
                    </div>
                </div>

                {/* FILA 1: SKU y UPC */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">ID Interno / SKU <span className="text-[10px] font-normal lowercase">(Opcional)</span></label>
                        <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                name="sku"
                                value={formData.sku}
                                onChange={handleChange}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                                placeholder="Auto-generar"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Código de Barras <span className="text-[10px] font-normal lowercase">(Opcional)</span></label>
                        <div className="relative">
                            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                name="upc"
                                value={formData.upc}
                                onChange={handleChange}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                                placeholder="Escanear..."
                            />
                        </div>
                    </div>
                </div>

                {/* FILA 2: Costo y Venta */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Costo (Compra)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                            <input
                                type="number"
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-orange-400 focus:outline-none transition-all font-bold text-gray-700"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-blue-500 uppercase mb-2 ml-1">Precio Venta</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 font-bold">$</span>
                            <input
                                type="number"
                                name="selling_price"
                                value={formData.selling_price}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-blue-50 border-2 border-blue-100 rounded-2xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-bold text-blue-700 text-lg"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>


                {/* Botón Guardar */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    Guardar Producto
                </button>

            </form>
        </div>
    );
}