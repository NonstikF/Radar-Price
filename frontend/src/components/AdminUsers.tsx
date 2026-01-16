import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Trash2, User, Loader2, CheckCircle2, X } from 'lucide-react';
import { API_URL } from '../config';

export function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Estado formulario nuevo usuario
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            // Endpoint sugerido: GET /users
            const response = await axios.get(`${API_URL}/users`);
            setUsers(response.data);
        } catch (error) {
            console.error("Error al cargar usuarios", error);
            // Datos falsos por si no tienes backend aún
            setUsers([
                { id: 1, username: 'admin', role: 'admin', created_at: new Date().toISOString() },
                { id: 2, username: 'almacen', role: 'user', created_at: new Date().toISOString() }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            // Endpoint sugerido: POST /users
            await axios.post(`${API_URL}/auth/register`, newUser); // Ajusta la ruta a tu backend

            // Refrescamos lista o agregamos manual
            setUsers([...users, { ...newUser, id: Date.now(), created_at: new Date().toISOString() }]);
            setShowModal(false);
            setNewUser({ username: '', password: '', role: 'user' });
        } catch (error) {
            alert("Error al crear usuario");
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
        try {
            await axios.delete(`${API_URL}/users/${id}`);
            setUsers(users.filter(u => u.id !== id));
        } catch (error) {
            alert("Error al eliminar");
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 pb-24 animate-fade-in">

            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Administra el acceso al sistema.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 dark:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                >
                    <UserPlus className="w-5 h-5" /> Nuevo Usuario
                </button>
            </div>

            {/* LISTA DE USUARIOS */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-gray-400 dark:text-gray-500">Cargando usuarios...</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-bold border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Fecha Creación</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <User className="w-5 h-5" />
                                        </div>
                                        {u.username}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDeleteUser(u.id)}
                                            className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
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
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-scale-in">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <X className="w-6 h-6" />
                        </button>

                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Registrar Usuario</h2>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nombre de Usuario</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 focus:border-blue-500 outline-none dark:text-white"
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Contraseña</label>
                                <input
                                    type="password"
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 focus:border-blue-500 outline-none dark:text-white"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Rol</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 focus:border-blue-500 outline-none dark:text-white"
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="user">Usuario (Almacén)</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-blue-700 flex justify-center items-center gap-2"
                            >
                                {creating ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                Crear Usuario
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}