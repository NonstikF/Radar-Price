import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    UserPlus, Trash2, User, Loader2, X, AlertTriangle, Shield,
    CheckSquare, Square, Edit3, Key, CheckCircle2
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

    // --- ESTADOS DE MODALES ---
    const [showFormModal, setShowFormModal] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null); // ID del usuario a borrar
    const [successMessage, setSuccessMessage] = useState<string | null>(null); // Mensaje de éxito

    // Estado del formulario
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
                setErrorMsg("Acceso denegado: No tienes permisos de administrador.");
            } else {
                setErrorMsg("No se pudieron cargar los usuarios.");
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

    // --- ACCIONES DEL FORMULARIO ---
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
                setSuccessMessage("Usuario actualizado correctamente");
            } else {
                if (!formData.password) {
                    alert("La contraseña es obligatoria"); // Fallback simple solo validación local
                    setProcessing(false);
                    return;
                }
                payload.password = formData.password;
                await axios.post(`${API_URL}/auth/register`, payload, getAuthHeaders());
                setSuccessMessage("Usuario creado correctamente");
            }

            await fetchUsers();
            setShowFormModal(false);

        } catch (error: any) {
            alert("Error: " + (error.response?.data?.detail || "Error desconocido"));
        } finally {
            setProcessing(false);
        }
    };

    // --- ACCIÓN DE ELIMINAR ---
    const confirmDelete = async () => {
        if (!deleteId) return;
        setProcessing(true);
        try {
            await axios.delete(`${API_URL}/users/${deleteId}`, getAuthHeaders());
            setUsers(users.filter(u => u.id !== deleteId));
            setDeleteId(null); // Cerrar modal
            setSuccessMessage("Usuario eliminado correctamente");
        } catch (error: any) {
            alert("Error al eliminar: " + (error.response?.data?.detail || "Error"));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 pb-24 animate-fade-in">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Administra el acceso y los permisos del sistema.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-blue-600 dark:bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 active:scale-95"
                >
                    <UserPlus className="w-5 h-5" /> Nuevo Usuario
                </button>
            </div>

            {errorMsg && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-800">
                    <AlertTriangle className="w-5 h-5" /> {errorMsg}
                </div>
            )}

            {/* TABLA */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400 dark:text-gray-500 flex flex-col justify-center items-center gap-4">
                        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
                        <span className="font-medium">Cargando usuarios...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
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
                                                    <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                                                        ACCESO TOTAL
                                                    </span>
                                                ) : (
                                                    u.permissions && u.permissions.length > 0 ? (
                                                        u.permissions.map((p: string) => (
                                                            <span key={p} className="text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
                                                                {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label.replace('Ver ', '').replace('Cargar ', '') || p}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Sin permisos</span>
                                                    )
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditModal(u)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg transition-all" title="Editar">
                                                    <Edit3 className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setDeleteId(u.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 p-2 rounded-lg transition-all" title="Eliminar">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- 1. MODAL FORMULARIO (CREAR/EDITAR) --- */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1b1e] rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-scale-in border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setShowFormModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 p-2 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                {editingId ? <Edit3 className="w-7 h-7" /> : <UserPlus className="w-7 h-7" />}
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h2>
                            <p className="text-sm text-gray-500">Configura el acceso y roles.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* USUARIO */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Usuario</label>
                                <div className="relative mt-1">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input type="text" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-[#25262b] border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-[#2c2e33] focus:border-blue-500 outline-none text-gray-900 dark:text-white font-medium transition-all" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="Ej: almacen2" required />
                                </div>
                            </div>

                            {/* CONTRASEÑA */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Contraseña</label>
                                <div className="relative mt-1">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="password"
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-[#25262b] border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-[#2c2e33] focus:border-blue-500 outline-none text-gray-900 dark:text-white font-medium transition-all placeholder:font-normal placeholder:text-gray-400"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingId ? "Dejar vacío para mantener actual" : "••••••••"}
                                        required={!editingId}
                                    />
                                </div>
                            </div>

                            {/* ROL */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Rol del Sistema</label>
                                <div className="relative mt-1">
                                    <Shield className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${formData.role === 'admin' ? 'text-purple-500' : 'text-gray-400'}`} />
                                    <select
                                        className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl outline-none font-bold appearance-none cursor-pointer transition-all ${formData.role === 'admin' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : 'bg-gray-50 border-gray-100 text-gray-700 dark:bg-[#25262b] dark:border-gray-700 dark:text-gray-200'}`}
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="user">Usuario (Limitado)</option>
                                        <option value="admin">Administrador (Total)</option>
                                    </select>
                                </div>
                            </div>

                            {/* PERMISOS */}
                            {formData.role === 'user' && (
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-fade-in">
                                    <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-3 flex items-center gap-2">
                                        <CheckSquare className="w-4 h-4" /> Asignar Permisos
                                    </label>
                                    <div className="space-y-2">
                                        {AVAILABLE_PERMISSIONS.map(perm => (
                                            <div key={perm.id} onClick={() => togglePermission(perm.id)} className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg transition-all border ${formData.permissions.includes(perm.id) ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 shadow-sm' : 'hover:bg-white/50 border-transparent'}`}>
                                                {formData.permissions.includes(perm.id) ? <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" /> : <Square className="w-5 h-5 text-gray-400" />}
                                                <span className={`text-sm font-medium ${formData.permissions.includes(perm.id) ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{perm.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button type="submit" disabled={processing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl mt-4 active:scale-95 transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-500/25">
                                {processing ? <Loader2 className="animate-spin w-5 h-5" /> : (editingId ? <CheckCircle2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
                                {processing ? "Guardando..." : (editingId ? "Guardar Cambios" : "Crear Usuario")}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- 2. MODAL CONFIRMACIÓN DE BORRADO --- */}
            {deleteId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-scale-in text-center border border-gray-100 dark:border-gray-800">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Eliminar Usuario?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                            Esta acción no se puede deshacer. ¿Estás seguro de que quieres borrarlo?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={confirmDelete} disabled={processing} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors flex justify-center items-center gap-2">
                                {processing ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 3. MODAL DE ÉXITO --- */}
            {successMessage && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-scale-in text-center border border-gray-100 dark:border-gray-800">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¡Éxito!</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                            {successMessage}
                        </p>
                        <button onClick={() => setSuccessMessage(null)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
                            Aceptar
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}