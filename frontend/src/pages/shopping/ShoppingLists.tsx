import { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    ShoppingCart, ChevronLeft, Package, Trash2, CheckCircle2, XCircle,
    Loader2, Plus, Minus, AlertTriangle, RotateCcw, FileText, Search, Camera, X,
    Download, Building2
} from 'lucide-react';
import { BarcodeScanner } from '../../components/ui/BarcodeScanner';
import { API_URL } from '../../config/api';
import { TOAST_DURATION } from '../../config/constants';

interface ShoppingListSummary {
    id: number;
    supplier_id: number;
    supplier_name: string;
    supplier_rfc: string;
    status: string;
    notes: string | null;
    item_count: number;
    created_at: string;
    updated_at: string;
}

interface ShoppingListItem {
    id: number;
    product_id: number;
    product_name: string;
    product_alias: string;
    product_sku: string;
    price: number;
    selling_price: number;
    quantity: number;
    subtotal: number;
    added_at: string;
}

interface ShoppingListDetail {
    id: number;
    supplier_name: string;
    supplier_rfc: string;
    status: string;
    notes: string | null;
    items: ShoppingListItem[];
    total: number;
    created_at: string;
    updated_at: string;
}

export function ShoppingLists() {
    const [lists, setLists] = useState<ShoppingListSummary[]>([]);
    const [selectedList, setSelectedList] = useState<ShoppingListDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("active");
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const [itemSearch, setItemSearch] = useState('');
    const [showScanner, setShowScanner] = useState(false);

    const [generatingPDF, setGeneratingPDF] = useState<'supplier' | 'internal' | null>(null);

    const buildHeader = (pdf: jsPDF, title: string, subtitle: string, accentColor: [number, number, number], list: ShoppingListDetail, date: string) => {
        const pageW = pdf.internal.pageSize.getWidth();
        // Banda de color superior
        pdf.setFillColor(...accentColor);
        pdf.roundedRect(14, 12, pageW - 28, 28, 3, 3, 'F');
        // Título
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(255, 255, 255);
        pdf.text(title, 20, 22);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(220, 230, 255);
        pdf.text(subtitle, 20, 28);
        // Proveedor y fecha (derecha)
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
        pdf.text(list.supplier_name, pageW - 20, 21, { align: 'right' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(210, 225, 255);
        pdf.text(list.supplier_rfc, pageW - 20, 26, { align: 'right' });
        pdf.text(date, pageW - 20, 31, { align: 'right' });
    };

    const downloadSupplierPDF = () => {
        if (!selectedList) return;
        setGeneratingPDF('supplier');
        try {
            const date = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
            const accent: [number, number, number] = [37, 99, 235];

            buildHeader(pdf, 'Solicitud de Compra', 'Lista de artículos requeridos', accent, selectedList, date);

            autoTable(pdf, {
                startY: 46,
                head: [['#', 'Código', 'Descripción del Artículo', 'Cant.']],
                body: selectedList.items.map((item, idx) => [
                    idx + 1,
                    item.product_sku || '—',
                    item.product_alias ? `${item.product_alias}\n${item.product_name}` : item.product_name,
                    item.quantity,
                ]),
                headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                alternateRowStyles: { fillColor: [239, 246, 255] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center', textColor: [170, 170, 170], fontSize: 7 },
                    1: { cellWidth: 26, fontStyle: 'bold', textColor: [30, 64, 175], fontSize: 8 },
                    2: { cellWidth: 'auto', fontSize: 9 },
                    3: { cellWidth: 18, halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235], fontSize: 13 },
                },
                styles: { cellPadding: 3, lineColor: [224, 234, 255], lineWidth: 0.1 },
                margin: { left: 14, right: 14 },
            });

            const finalY = (pdf as any).lastAutoTable.finalY + 6;
            const pageW = pdf.internal.pageSize.getWidth();
            const totalUnits = selectedList.items.reduce((s, i) => s + i.quantity, 0);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.setTextColor(60, 60, 60);
            pdf.text(`Total: ${totalUnits} unidades · ${selectedList.items.length} referencias`, pageW - 14, finalY, { align: 'right' });

            pdf.save(`Solicitud-${selectedList.supplier_name}.pdf`);
        } finally {
            setGeneratingPDF(null);
        }
    };

    const downloadInternalPDF = () => {
        if (!selectedList) return;
        setGeneratingPDF('internal');
        try {
            const date = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
            const accent: [number, number, number] = [124, 58, 237];

            buildHeader(pdf, 'Lista de Compras', 'Interno', accent, selectedList, date);

            autoTable(pdf, {
                startY: 46,
                head: [['#', 'Código', 'Descripción del Artículo', 'Cant.', 'P. Costo', 'Subtotal']],
                body: selectedList.items.map((item, idx) => [
                    idx + 1,
                    item.product_sku || '—',
                    item.product_alias ? `${item.product_alias}\n${item.product_name}` : item.product_name,
                    item.quantity,
                    `$${item.price.toFixed(2)}`,
                    `$${item.subtotal.toFixed(2)}`,
                ]),
                headStyles: { fillColor: [91, 33, 182], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                alternateRowStyles: { fillColor: [245, 243, 255] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center', textColor: [170, 170, 170], fontSize: 7 },
                    1: { cellWidth: 24, fontStyle: 'bold', textColor: [91, 33, 182], fontSize: 8 },
                    2: { cellWidth: 'auto', fontSize: 9 },
                    3: { cellWidth: 16, halign: 'center', fontStyle: 'bold', textColor: [124, 58, 237], fontSize: 12 },
                    4: { cellWidth: 22, halign: 'right', textColor: [100, 100, 100], fontSize: 8 },
                    5: { cellWidth: 26, halign: 'right', fontStyle: 'bold', fontSize: 9 },
                },
                styles: { cellPadding: 3, lineColor: [237, 233, 254], lineWidth: 0.1 },
                margin: { left: 14, right: 14 },
            });

            const finalY = (pdf as any).lastAutoTable.finalY + 4;
            const pageW = pdf.internal.pageSize.getWidth();
            const subtotal = selectedList.total;
            const iva = subtotal * 0.16;
            const totalConIva = subtotal + iva;
            const totalUnits = selectedList.items.reduce((s, i) => s + i.quantity, 0);

            // Resumen izquierda
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Referencias: ${selectedList.items.length}   ·   Total unidades: ${totalUnits}`, 14, finalY + 6);

            // Bloque de totales derecha
            const boxX = pageW - 80;
            const rowH = 7;
            // Subtotal
            pdf.setFillColor(248, 246, 255);
            pdf.rect(boxX, finalY, 66, rowH, 'F');
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(80, 80, 80);
            pdf.text('Subtotal', boxX + 4, finalY + 4.8);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`$${subtotal.toFixed(2)}`, pageW - 14, finalY + 4.8, { align: 'right' });
            // IVA
            pdf.setFillColor(237, 233, 254);
            pdf.rect(boxX, finalY + rowH, 66, rowH, 'F');
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(124, 58, 237);
            pdf.text('IVA (16%)', boxX + 4, finalY + rowH + 4.8);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`$${iva.toFixed(2)}`, pageW - 14, finalY + rowH + 4.8, { align: 'right' });
            // Total con IVA
            pdf.setFillColor(124, 58, 237);
            pdf.rect(boxX, finalY + rowH * 2, 66, rowH + 2, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.setTextColor(200, 180, 255);
            pdf.text('TOTAL CON IVA', boxX + 4, finalY + rowH * 2 + 5.5);
            pdf.setFontSize(11);
            pdf.setTextColor(255, 255, 255);
            pdf.text(`$${totalConIva.toFixed(2)}`, pageW - 14, finalY + rowH * 2 + 5.5, { align: 'right' });

            pdf.save(`Lista-Interna-${selectedList.supplier_name}.pdf`);
        } finally {
            setGeneratingPDF(null);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), TOAST_DURATION);
    };

    const fetchLists = async () => {
        setLoading(true);
        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const res = await axios.get(`${API_URL}/shopping-lists`, { params });
            setLists(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (listId: number) => {
        setLoadingDetail(true);
        setItemSearch('');
        try {
            const res = await axios.get(`${API_URL}/shopping-lists/${listId}`);
            setSelectedList(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetail(false);
        }
    };

    useEffect(() => {
        fetchLists();
    }, [statusFilter]);

    const handleUpdateQty = async (listId: number, itemId: number, newQty: number) => {
        if (newQty < 1) {
            handleDeleteItem(listId, itemId);
            return;
        }
        setSelectedList(prev => {
            if (!prev) return prev;
            const items = prev.items.map(it =>
                it.id === itemId ? { ...it, quantity: newQty, subtotal: it.price * newQty } : it
            );
            return { ...prev, items, total: items.reduce((s, it) => s + it.subtotal, 0) };
        });
        try {
            await axios.put(`${API_URL}/shopping-lists/${listId}/items/${itemId}`, { quantity: newQty });
        } catch (err) {
            showToast("Error al actualizar", "error");
            fetchDetail(listId);
        }
    };

    const handleDeleteItem = async (listId: number, itemId: number) => {
        setSelectedList(prev => {
            if (!prev) return prev;
            const items = prev.items.filter(it => it.id !== itemId);
            return { ...prev, items, total: items.reduce((s, it) => s + it.subtotal, 0) };
        });
        try {
            await axios.delete(`${API_URL}/shopping-lists/${listId}/items/${itemId}`);
            showToast("Item eliminado");
        } catch (err) {
            showToast("Error al eliminar", "error");
            fetchDetail(listId);
        }
    };

    const handleUpdateStatus = async (listId: number, status: string) => {
        try {
            await axios.put(`${API_URL}/shopping-lists/${listId}/status`, { status });
            showToast(status === 'completed' ? 'Lista completada' : status === 'active' ? 'Lista reactivada' : 'Lista cancelada');
            setSelectedList(null);
            fetchLists();
        } catch (err) {
            showToast("Error", "error");
        }
    };

    const handleDeleteList = async (listId: number) => {
        try {
            await axios.delete(`${API_URL}/shopping-lists/${listId}`);
            showToast("Lista eliminada");
            setSelectedList(null);
            fetchLists();
        } catch (err) {
            showToast("Error al eliminar", "error");
        }
    };

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
            completed: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
            cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        };
        const labels: Record<string, string> = { active: 'Activa', completed: 'Completada', cancelled: 'Cancelada' };
        return (
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles[status] || styles.active}`}>
                {labels[status] || status}
            </span>
        );
    };

    // --- VISTA DETALLE ---
    if (selectedList) {
        return (
            <div className="w-full max-w-7xl mx-auto p-2 md:p-6 pb-24 animate-fade-in">
                {/* TOAST */}
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                    <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        <span className="font-bold text-sm">{toast.message}</span>
                    </div>
                </div>

                {/* HEADER */}
                <div className="mb-6">
                    <button onClick={() => { setSelectedList(null); fetchLists(); }} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors">
                        <ChevronLeft className="w-4 h-4" /> Volver a listas
                    </button>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white">{selectedList.supplier_name}</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedList.supplier_rfc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {statusBadge(selectedList.status)}
                        </div>
                    </div>
                </div>

                {/* ACCIONES */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {selectedList.status === 'active' && (
                        <button onClick={() => handleUpdateStatus(selectedList.id, 'completed')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all">
                            <CheckCircle2 className="w-4 h-4" /> Completar
                        </button>
                    )}
                    {selectedList.status === 'completed' && (
                        <button onClick={() => handleUpdateStatus(selectedList.id, 'active')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all">
                            <RotateCcw className="w-4 h-4" /> Reactivar
                        </button>
                    )}
                    {selectedList.status !== 'cancelled' && (
                        <button onClick={() => handleUpdateStatus(selectedList.id, 'cancelled')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold transition-all">
                            <XCircle className="w-4 h-4" /> Cancelar
                        </button>
                    )}
                    <button onClick={() => handleDeleteList(selectedList.id)} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold transition-all">
                        <Trash2 className="w-4 h-4" /> Eliminar
                    </button>

                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={downloadSupplierPDF}
                            disabled={!!generatingPDF}
                            title="Descargar PDF para proveedor (sin precios)"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        >
                            {generatingPDF === 'supplier' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                            PDF Proveedor
                        </button>
                        <button
                            onClick={downloadInternalPDF}
                            disabled={!!generatingPDF}
                            title="Descargar PDF interno (con precios y totales)"
                            className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-400 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                        >
                            {generatingPDF === 'internal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            PDF Interno
                        </button>
                    </div>
                </div>

                {/* BUSCADOR */}
                <div className="mb-4 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-transparent flex items-center gap-2">
                    <Search className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
                    <input
                        type="text"
                        placeholder="Buscar en esta lista..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white text-sm font-medium placeholder-gray-400"
                    />
                    {itemSearch && (
                        <button onClick={() => setItemSearch('')} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => setShowScanner(true)} className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all">
                        <Camera className="w-5 h-5" />
                    </button>
                </div>

                {/* ITEMS */}
                {loadingDetail ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" /></div>
                ) : selectedList.items.length === 0 ? (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                        <Package className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-medium text-gray-400">Lista vacía</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {selectedList.items.filter(item => {
                            const q = itemSearch.toLowerCase();
                            return !q || item.product_name.toLowerCase().includes(q) || (item.product_alias || '').toLowerCase().includes(q) || (item.product_sku || '').toLowerCase().includes(q);
                        }).map((item) => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-transparent flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight mb-1 line-clamp-2">
                                        {item.product_alias || item.product_name}
                                    </h3>
                                    {item.product_alias && (
                                        <p className="text-xs text-gray-400 line-clamp-1">{item.product_name}</p>
                                    )}
                                    <div className="flex gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {item.product_sku && <span className="bg-gray-100 dark:bg-gray-900 px-2 rounded font-mono">{item.product_sku}</span>}
                                        <span className="text-gray-400">Costo: ${item.price.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* CANTIDAD */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleUpdateQty(selectedList.id, item.id, item.quantity - 1)}
                                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                    </button>
                                    <span className="w-8 text-center font-bold text-gray-900 dark:text-white text-sm">{item.quantity}</span>
                                    <button
                                        onClick={() => handleUpdateQty(selectedList.id, item.id, item.quantity + 1)}
                                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                    </button>
                                </div>

                                {/* SUBTOTAL */}
                                <div className="text-right min-w-[70px]">
                                    <p className="font-black text-blue-600 dark:text-blue-400">${item.subtotal.toFixed(2)}</p>
                                </div>

                                {/* ELIMINAR */}
                                <button
                                    onClick={() => handleDeleteItem(selectedList.id, item.id)}
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        {/* TOTAL */}
                        {!itemSearch && (
                            <div className="bg-gray-900 dark:bg-gray-950 text-white p-5 rounded-2xl flex justify-between items-center">
                                <span className="text-sm font-bold uppercase tracking-wider text-gray-400">Total estimado</span>
                                <span className="text-3xl font-black">${selectedList.total.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}

                {showScanner && (
                    <BarcodeScanner
                        onScan={(code) => { setItemSearch(code); setShowScanner(false); }}
                        onClose={() => setShowScanner(false)}
                    />
                )}

            </div>
        );
    }

    // --- VISTA LISTA ---
    return (
        <div className="w-full max-w-7xl mx-auto p-2 md:p-6 pb-24 animate-fade-in">
            {/* TOAST */}
            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${toast.type === 'success' ? 'bg-gray-900 text-green-400 border-green-500/30' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold text-sm">{toast.message}</span>
                </div>
            </div>

            {/* HEADER */}
            <div className="mb-2 md:mb-6 px-2">
                <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white">Listas de Compras</h1>
            </div>

            {/* FILTROS DE ESTADO */}
            <div className="flex gap-2 mb-6 px-2 overflow-x-auto">
                {[
                    { value: 'active', label: 'Activas', icon: <ShoppingCart className="w-4 h-4" /> },
                    { value: 'completed', label: 'Completadas', icon: <CheckCircle2 className="w-4 h-4" /> },
                    { value: '', label: 'Todas', icon: <FileText className="w-4 h-4" /> },
                ].map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setStatusFilter(opt.value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${statusFilter === opt.value
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        {opt.icon} {opt.label}
                    </button>
                ))}
            </div>

            {/* CONTENIDO */}
            {loading ? (
                <div className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" /></div>
            ) : lists.length === 0 ? (
                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <ShoppingCart className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-xl font-medium text-gray-400">No hay listas de compras</p>
                    <p className="text-sm text-gray-400 mt-2">Agrega productos desde el buscador para crear una</p>
                </div>
            ) : (
                <div className="space-y-3 px-2 md:px-0">
                    {lists.map((list) => (
                        <div
                            key={list.id}
                            onClick={() => fetchDetail(list.id)}
                            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-transparent flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all active:scale-[0.99] group"
                        >
                            <div className="flex-1 min-w-0 pr-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {list.supplier_name}
                                    </h3>
                                    {statusBadge(list.status)}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="bg-gray-100 dark:bg-gray-900 px-2 rounded font-mono">{list.supplier_rfc}</span>
                                    <span>{list.item_count} {list.item_count === 1 ? 'producto' : 'productos'}</span>
                                    <span>{new Date(list.updated_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <ShoppingCart className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
