import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    UserPlus, Trash2, User, Loader2, X, AlertTriangle, Shield, Square, Edit3, Key, CheckCircle2
} from 'lucide-react';
import { API_URL } from '../config';

const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Ver Panel Financiero' },
    { id: 'upload', label: 'Cargar XML/Facturas' },
    { id: 'search', label: 'Buscador de Precios' },
    { id: 'manual', label: 'Entrada Manual' },
];

export function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const [showFormModal, setShowFormModal] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'user',
        permissions: [] as string[]
    });

    const [editingId, setEditingId] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return { headers: { 'Authorization': `Bearer ${token}` } };
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/users`, getAuthHeaders());
            setUsers(response.data);
            setErrorMsg('');
        } catch (error: any) {
            if (error.response?.status === 403) {
                setErrorMsg("Acceso denegado: No tienes permisos.");
            } else {
                setErrorMsg("Error de conexión.");
            }
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (permId: string) => {
        setFormData(prev => {
            const currentPerms = prev.permissions || [];
            if (currentPerms.includes(permId)) {
                return { ...prev, permissions: currentPerms.filter(p => p !== permId) };
            } else {
                return { ...prev, permissions: [...currentPerms, permId] };
            }
        });
    };

    const openCreateModal = () => {
        setEditingId(null);
        setFormData({ username: '', password: '', role: 'user', permissions: [] });
        setShowFormModal(true);
    };

    const openEditModal = (user: any) => {
        setEditingId(user.id);
        setFormData({
            username: user.username,
            password: '',
            role: user.role,
            permissions: user.permissions || []
        });
        setShowFormModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const payload: any = {
                username: formData.username.trim(),
                role: formData.role,
                permissions: formData.role === 'admin' ? [] : formData.permissions
            };

            if (formData.password.trim()) {
                payload.password = formData.password.trim();
            }

            if (editingId) {
                await axios.put(`${API_URL}/users/${editingId}`, payload, getAuthHeaders());
                setSuccessMessage("Usuario actualizado");
            } else {
                if (!formData.password) {
                    alert("Contraseña obligatoria");
                    setProcessing(false);
                    return;
                }
                payload.password = formData.password;
                await axios.post(`${API_URL}/auth/register`, payload, getAuthHeaders());
                setSuccessMessage("Usuario creado");
            }

            await fetchUsers();
            setShowFormModal(false);

        } catch (error: any) {
            alert("Error: " + (error.response?.data?.detail || "Error desconocido"));
        } finally {
            setProcessing(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        setProcessing(true);
        try {
            await axios.delete(`${API_URL}/users/${deleteId}`, getAuthHeaders());
            setUsers(users.filter(u => u.id !== deleteId));
            setDeleteId(null);
            setSuccessMessage("Usuario eliminado");
        } catch (error: any) {
            alert("Error al eliminar");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4 md:p-6 pb-24 animate-fade-in">

            {/* HEADER COMPACTO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Administra el acceso al sistema.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="w-full md:w-auto bg-blue-600 dark:bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                >
                    <UserPlus className="w-5 h-5" /> Nuevo Usuario
                </button>
            </div>

            {errorMsg && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-800 text-sm">
                    <AlertTriangle className="w-5 h-5" /> {errorMsg}
                </div>
            )}

            {/* CONTENEDOR DE LISTA */}
            <div className="bg-transparent md:bg-white md:dark:bg-gray-800 rounded-3xl md:shadow-xl md:border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400 dark:text-gray-500 flex flex-col justify-center items-center gap-4">
                        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
                        <span className="font-medium">Cargando...</span>
                    </div>
                ) : (
                    <>
                        {/* --- VISTA ESCRITORIO (TABLA) --- */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 uppercase text-xs font-bold border-b border-gray-100 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-5">Usuario</th>
                                        <th className="px-6 py-5">Rol</th>
                                        <th className="px-6 py-5">Permisos</th>
                                        <th className="px-6 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                {u.username}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}>
                                                    {u.role === 'admin' && <Shield className="w-3 h-3" />}
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {u.role === 'admin' ? (
                                                        <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded border border-green-200 dark:border-green-800">ACCESO TOTAL</span>
                                                    ) : (
                                                        u.permissions && u.permissions.length > 0 ? u.permissions.map((p: string) => (
                                                            <span key={p} className="text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
                                                                {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label.replace('Ver ', '').replace('Cargar ', '') || p}
                                                            </span>
                                                        )) : <span className="text-xs text-gray-400 italic">Sin permisos</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEditModal(u)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-all"><Edit3 className="w-5 h-5" /></button>
                                                    <button onClick={() => setDeleteId(u.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-all"><Trash2 className="w-5 h-5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* --- VISTA MÓVIL (TARJETAS) --- */}
                        <div className="md:hidden space-y-3">
                            {users.map(u => (
                                <div key={u.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white">{u.username}</h3>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {u.role}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => openEditModal(u)} className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-700 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                                            <button onClick={() => setDeleteId(u.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Permisos</p>
                                        <div className="flex flex-wrap gap-1">
                                            {u.role === 'admin' ? (
                                                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">ACCESO TOTAL</span>
                                            ) : (
                                                u.permissions && u.permissions.length > 0 ? u.permissions.map((p: string) => (
                                                    <span key={p} className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                                                        {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label.replace('Ver ', '').replace('Cargar ', '') || p}
                                                    </span>
                                                )) : <span className="text-xs text-gray-400 italic">Ninguno</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* MODAL FORMULARIO */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1b1e] rounded-3xl w-full max-w-sm md:max-w-md p-6 shadow-2xl relative animate-scale-in flex flex-col max-h-[90vh]">
                        <button onClick={() => setShowFormModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-800 p-2 rounded-full"><X className="w-5 h-5" /></button>

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                {editingId ? <Edit3 className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-1">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Usuario</label>
                                <div className="relative mt-1">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input type="text" className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#25262b] border rounded-xl outline-none font-bold text-sm dark:text-white" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Contraseña</label>
                                <div className="relative mt-1">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input type="password" className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#25262b] border rounded-xl outline-none font-bold text-sm dark:text-white" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={editingId ? "Vacío para mantener" : ""} required={!editingId} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Rol</label>
                                <div className="relative mt-1">
                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <select className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#25262b] border rounded-xl outline-none font-bold text-sm appearance-none cursor-pointer dark:text-white" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                        <option value="user">Usuario</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                            </div>

                            {formData.role === 'user' && (
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                    <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Permisos</label>
                                    <div className="space-y-2">
                                        {AVAILABLE_PERMISSIONS.map(perm => (
                                            <div key={perm.id} onClick={() => togglePermission(perm.id)} className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg border ${formData.permissions.includes(perm.id) ? 'bg-white dark:bg-gray-800 border-blue-200 shadow-sm' : 'border-transparent'}`}>
                                                {formData.permissions.includes(perm.id) ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{perm.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button type="submit" disabled={processing} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2 flex justify-center gap-2">
                                {processing ? <Loader2 className="animate-spin w-5 h-5" /> : (editingId ? "Guardar" : "Crear")}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL BORRAR */}
            {deleteId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl w-full max-w-xs p-6 shadow-2xl text-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">¿Eliminar Usuario?</h3>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 font-bold py-3 rounded-xl">Cancelar</button>
                            <button onClick={confirmDelete} disabled={processing} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EXITO */}
            {successMessage && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl w-full max-w-xs p-6 shadow-2xl text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600"><CheckCircle2 className="w-6 h-6" /></div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{successMessage}</h3>
                        <button onClick={() => setSuccessMessage(null)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Aceptar</button>
                    </div>
                </div>
            )}
        </div>
    );
}