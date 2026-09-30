import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Barcode, Hash, Tag, CheckCircle2, Loader2, AlertCircle, Camera, Trash2, Truck } from 'lucide-react'; // <--- AGREGAMOS TRASH2
import { BarcodeScanner } from '../../components/ui/BarcodeScanner';

// IMPORTAMOS LA CONFIGURACIÓN CENTRALIZADA
import { API_URL } from '../../config/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

interface ManualEntryProps {
    initialName?: string;
    initialSku?: string;
    initialUpc?: string;
    onCreated?: (product: { id: number; name: string; sku: string }) => void;
    // Desde Inventario: el producto debe ser de un proveedor con gestión de
    // inventario, o no se podría asignar a una ubicación.
    requireInventorySupplier?: boolean;
}

export function ManualEntry({ initialName, initialSku, initialUpc, onCreated, requireInventorySupplier }: ManualEntryProps = {}) {
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    // 1. ESTADO INICIAL DEFINIDO
    const initialState = {
        name: initialName || "",
        sku: initialSku || "",
        upc: initialUpc || "",
        price: "",        // Costo
        selling_price: "", // Venta
        stock: "",
        supplier_id: ""
    };

    const [formData, setFormData] = useState(initialState);
    const isDirty = (Object.keys(initialState) as (keyof typeof initialState)[]).some(key => formData[key] !== initialState[key]);
    const { dialog: unsavedDialog } = useUnsavedChanges(isDirty);

    // Proveedores para el selector. Desde Inventario solo sirven los que
    // gestionan inventario; en los demás casos el proveedor es opcional.
    const [suppliers, setSuppliers] = useState<{ id: number; name: string; manages_inventory: boolean }[] | null>(null);
    useEffect(() => {
        axios.get(`${API_URL}/suppliers`)
            .then(res => setSuppliers(res.data))
            .catch(() => setErrorMsg("No se pudieron cargar los proveedores."));
    }, []);
    const supplierOptions = requireInventorySupplier ? suppliers?.filter(s => s.manages_inventory) : suppliers;
    const noInventorySuppliers = requireInventorySupplier && supplierOptions?.length === 0;
    // La existencia inicial solo aplica a productos del almacén
    const selectedInWarehouse = !!suppliers?.find(s => String(s.id) === formData.supplier_id)?.manages_inventory;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setSuccessMsg(""); // Limpiar mensajes al escribir
        setErrorMsg("");
    };

    // 2. FUNCIÓN PARA LIMPIAR TODO
    const handleClearForm = () => {
        setFormData(initialState);
        setSuccessMsg("");
        setErrorMsg("");
    };

    const handleScanSuccess = (code: string) => {
        setFormData(prev => ({ ...prev, upc: code }));
        setShowScanner(false);
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
        if (requireInventorySupplier && !formData.supplier_id) {
            setErrorMsg("Elige el proveedor del producto");
            setLoading(false);
            return;
        }

        try {
            const payload = {
                name: formData.name,
                sku: formData.sku || null,
                upc: formData.upc || null,
                price: parseFloat(formData.price) || 0,
                selling_price: parseFloat(formData.selling_price) || 0,
                stock: selectedInWarehouse ? parseInt(formData.stock) || 0 : 0,
                supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null
            };

            const res = await axios.post(`${API_URL}/invoices/products/manual`, payload);

            if (onCreated && res.data.id) {
                onCreated({ id: res.data.id, name: res.data.name, sku: res.data.sku || '' });
                return;
            }

            setSuccessMsg(`Producto "${formData.name}" agregado con éxito.`);
            setFormData(initialState); // Limpiar tras éxito

        } catch (error: any) {
            setErrorMsg(error.response?.data?.detail || "Error al guardar el producto.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 pb-24">

            <PageHeader parent={onCreated ? undefined : 'products'} title="Agregar producto" description="Registra a mano un producto nuevo." />
            {unsavedDialog}

            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 md:p-8 space-y-6 transition-colors">

                {/* Mensajes de Estado */}
                {successMsg && (
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-4 rounded-2xl flex items-center gap-3 border border-green-100 dark:border-green-800 animate-fade-in">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="font-bold text-sm">{successMsg}</span>
                    </div>
                )}
                {errorMsg && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 border border-red-100 dark:border-red-800 animate-fade-in">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="font-bold text-sm">{errorMsg}</span>
                    </div>
                )}

                {/* NOMBRE (Obligatorio) */}
                <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 ml-1">Nombre del producto *</label>
                    <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-2xl focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all font-medium"
                            placeholder="Ej. Maceta de barro 12 cm"
                            autoFocus
                        />
                    </div>
                </div>

                {/* PROVEEDOR (obligatorio solo desde Inventario) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={selectedInWarehouse ? '' : 'md:col-span-2'}>
                        <label htmlFor="manual-supplier" className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 ml-1">
                            Proveedor {requireInventorySupplier ? '*' : <span className="text-[10px] font-normal lowercase">(opcional)</span>}
                        </label>
                        {noInventorySuppliers ? (
                            <p className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-4 rounded-2xl text-sm border border-amber-100 dark:border-amber-800">
                                Ningún proveedor tiene gestión de inventario. Actívala en Configuración para registrar productos desde aquí.
                            </p>
                        ) : (
                            <div className="relative">
                                <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5 pointer-events-none" />
                                <select
                                    id="manual-supplier"
                                    name="supplier_id"
                                    value={formData.supplier_id}
                                    onChange={handleChange}
                                    disabled={!supplierOptions}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-2xl focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white focus:outline-none transition-all"
                                >
                                    <option value="">
                                        {!supplierOptions ? 'Cargando proveedores...' : requireInventorySupplier ? 'Elige un proveedor con inventario' : 'Sin proveedor'}
                                    </option>
                                    {supplierOptions?.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}{!requireInventorySupplier && s.manages_inventory ? ' · almacén' : ''}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* EXISTENCIA INICIAL (solo proveedores del almacén) */}
                    {selectedInWarehouse && (
                        <div>
                            <label htmlFor="manual-stock" className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 ml-1">Existencia inicial <span className="text-[10px] font-normal lowercase">(piezas)</span></label>
                            <input
                                id="manual-stock"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                name="stock"
                                value={formData.stock}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-2xl focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all font-bold"
                                placeholder="0"
                            />
                        </div>
                    )}
                </div>

                {/* FILA 1: SKU y UPC */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 ml-1">SKU <span className="text-[10px] font-normal lowercase">(opcional)</span></label>
                        <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                            <input
                                type="text"
                                name="sku"
                                value={formData.sku}
                                onChange={handleChange}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-2xl focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all"
                                placeholder="Ej. 12345"
                            />
                        </div>
                    </div>

                    {/* CAMPO UPC CON BOTÓN DE CÁMARA */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 ml-1">Código de barras <span className="text-[10px] font-normal lowercase">(opcional)</span></label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                                <input
                                    type="text"
                                    name="upc"
                                    value={formData.upc}
                                    onChange={handleChange}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-2xl focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all"
                                    placeholder="Escanear..."
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowScanner(true)}
                                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 p-3 rounded-2xl transition-colors active:scale-95 border-2 border-transparent focus:border-blue-500"
                                title="Escanear con cámara"
                            >
                                <Camera className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILA 2: Costo y Venta */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 ml-1">Costo</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold">$</span>
                            <input
                                type="number"
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-2xl focus:bg-white dark:focus:bg-gray-600 focus:border-orange-400 dark:focus:border-orange-500 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all font-bold"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-blue-500 dark:text-blue-400 uppercase mb-2 ml-1">Precio de venta</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400 font-bold">$</span>
                            <input
                                type="number"
                                name="selling_price"
                                value={formData.selling_price}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800 rounded-2xl focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 dark:focus:border-blue-500 text-blue-700 dark:text-blue-300 placeholder-blue-300 dark:placeholder-blue-700 focus:outline-none transition-all font-bold text-lg"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                {/* BOTONES DE ACCIÓN (LIMPIAR Y GUARDAR) */}
                <div className="flex gap-3 pt-2">
                    {/* 3. BOTÓN DE LIMPIEZA */}
                    <button
                        type="button"
                        onClick={handleClearForm}
                        className="px-4 py-4 rounded-2xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-500"
                        title="Limpiar formulario"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>

                    <button
                        type="submit"
                        disabled={loading || noInventorySuppliers}
                        className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 rounded-2xl shadow-lg hover:bg-black dark:hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                        Guardar producto
                    </button>
                </div>

            </form>

            {/* COMPONENTE DE ESCÁNER */}
            {showScanner && (
                <BarcodeScanner
                    onScan={handleScanSuccess}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}