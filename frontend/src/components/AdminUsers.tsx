import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Trash2, User, Loader2, CheckCircle2, X, AlertTriangle, Shield, CheckSquare, Square, Lock } from 'lucide-react';
import { API_URL } from '../config';

// 1. DEFINICIÓN DE PERMISOS DISPONIBLES
const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Ver Panel Financiero' },
    { id: 'upload', label: 'Cargar XML/Facturas' },
    { id: 'search', label: 'Buscador de Precios' },
    { id: 'manual', label: 'Entrada Manual' },
];

export function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // 2. ESTADO ACTUALIZADO CON ARRAY DE PERMISOS
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        role: 'user',
        permissions: [] as string[] // <--- Lista de permisos activados
    });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            headers: { 'Authorization': `Bearer ${token}` }
        };
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/users`, getAuthHeaders());
            setUsers(response.data);
            setErrorMsg('');
        } catch (error) {
            console.error("Error al cargar usuarios", error);
            setErrorMsg("No se pudieron cargar los usuarios. Verifica tu conexión o permisos.");
        } finally {
            setLoading(false);
        }
    };

    // 3. FUNCIÓN PARA MARCAR/DESMARCAR PERMISOS
    const togglePermission = (permId: string) => {
        setNewUser(prev => {
            if (prev.permissions.includes(permId)) {
                // Si ya lo tiene, lo quitamos
                return { ...prev, permissions: prev.permissions.filter(p => p !== permId) };
            } else {
                // Si no lo tiene, lo agregamos
                return { ...prev, permissions: [...prev.permissions, permId] };
            }
        });
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await axios.post(`${API_URL}/auth/register`, newUser, getAuthHeaders());
            await fetchUsers(); // Recargar lista

            setShowModal(false);
            // Resetear formulario
            setNewUser({ username: '', password: '', role: 'user', permissions: [] });
            alert("Usuario creado correctamente");
        } catch (error: any) {
            console.error(error);
            alert("Error al crear: " + (error.response?.data?.detail || "Error desconocido"));
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
        try {
            await axios.delete(`${API_URL}/users/${id}`, getAuthHeaders());
            setUsers(users.filter(u => u.id !== id));
        } catch (error: any) {
            alert("Error al eliminar: " + (error.response?.data?.detail || "No tienes permisos"));
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 pb-24 animate-fade-in">

            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Administra el acceso y los permisos del sistema.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 dark:bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 dark:hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/30 active:scale-95"
                >
                    <UserPlus className="w-5 h-5" /> Nuevo Usuario
                </button>
            </div>

            {errorMsg && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-800">
                    <AlertTriangle className="w-5 h-5" /> {errorMsg}
                </div>
            )}

            {/* LISTA DE USUARIOS */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400 dark:text-gray-500 flex flex-col justify-center items-center gap-4">
                        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
                        <span className="font-medium">Cargando usuarios...</span>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 uppercase text-xs font-bold border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-5">Usuario</th>
                                <th className="px-6 py-5">Rol</th>
                                <th className="px-6 py-5">Permisos Asignados</th>
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
                                    {/* COLUMNA DE PERMISOS */}
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
                                        <button
                                            onClick={() => handleDeleteUser(u.id)}
                                            className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                            title="Eliminar usuario"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MODAL CREAR USUARIO */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1b1e] rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-scale-in border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">

                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 p-2 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                                <UserPlus className="w-7 h-7" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Nuevo Usuario</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Define credenciales y permisos.</p>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            {/* INPUTS NORMALES */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Usuario</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-[#25262b] border-2 border-gray-100 dark:border-gray-700/50 rounded-xl focus:bg-white dark:focus:bg-[#2c2e33] focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white font-medium"
                                        value={newUser.username}
                                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                        placeholder="Ej: almacen2"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="password"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-[#25262b] border-2 border-gray-100 dark:border-gray-700/50 rounded-xl focus:bg-white dark:focus:bg-[#2c2e33] focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white font-medium"
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Rol</label>
                                <div className="relative">
                                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <select
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-[#25262b] border-2 border-gray-100 dark:border-gray-700/50 rounded-xl focus:bg-white dark:focus:bg-[#2c2e33] focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white font-medium appearance-none cursor-pointer"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="user">Usuario (Limitado)</option>
                                        <option value="admin">Administrador (Total)</option>
                                    </select>
                                </div>
                            </div>

                            {/* SECCIÓN DE PERMISOS: SOLO SI ES USUARIO */}
                            {newUser.role === 'user' && (
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-fade-in mt-4">
                                    <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-3 flex items-center gap-2">
                                        <CheckSquare className="w-4 h-4" /> Asignar Permisos
                                    </label>
                                    <div className="space-y-2">
                                        {AVAILABLE_PERMISSIONS.map(perm => (
                                            <div
                                                key={perm.id}
                                                onClick={() => togglePermission(perm.id)}
                                                className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-all border ${newUser.permissions.includes(perm.id)
                                                    ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 shadow-sm'
                                                    : 'hover:bg-white/50 dark:hover:bg-gray-800/50 border-transparent'
                                                    }`}
                                            >
                                                {newUser.permissions.includes(perm.id)
                                                    ? <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                    : <Square className="w-5 h-5 text-gray-400" />
                                                }
                                                <span className={`text-sm font-medium ${newUser.permissions.includes(perm.id) ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    {perm.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full bg-blue-600 dark:bg-blue-600 text-white font-bold py-4 rounded-xl mt-4 hover:bg-blue-700 dark:hover:bg-blue-500 active:scale-95 transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-500/25"
                            >
                                {creating ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                {creating ? "Registrando..." : "Confirmar Usuario"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}