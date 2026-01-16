import { useState } from 'react';
import axios from 'axios';
import { LogIn, Loader2, AlertCircle, Lock, User } from 'lucide-react';
import { API_URL } from '../config';
import { Logo } from './Logo';

interface Props {
    onLoginSuccess: (userData: any) => void;
}

export function Login({ onLoginSuccess }: Props) {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Ajusta este endpoint a tu backend real. 
            // Si aún no tienes backend de auth, esto fallará.
            // Para probar visualmente, puedes descomentar la línea de abajo simulada:

            // SIMULACIÓN (Borrar cuando tengas backend):
            // await new Promise(r => setTimeout(r, 1000));
            // onLoginSuccess({ username: credentials.username, role: 'admin', token: 'fake-jwt-token' }); return;

            const formData = new FormData();
            formData.append('username', credentials.username);
            formData.append('password', credentials.password);

            const response = await axios.post(`${API_URL}/auth/token`, formData);

            // Asumiendo que el backend devuelve { access_token, user_data }
            const userData = {
                username: credentials.username,
                token: response.data.access_token,
                role: 'admin' // Esto debería venir del backend
            };

            onLoginSuccess(userData);

        } catch (err: any) {
            console.error(err);
            setError('Credenciales inválidas o error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">

                <div className="flex justify-center mb-8">
                    <Logo variant="full" />
                </div>

                <h2 className="text-2xl font-black text-gray-900 dark:text-white text-center mb-2">Bienvenido</h2>
                <p className="text-gray-500 dark:text-gray-400 text-center mb-8 text-sm">Ingresa tus credenciales para acceder</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm font-bold border border-red-100 dark:border-red-800 animate-fade-in">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Usuario</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                name="username"
                                value={credentials.username}
                                onChange={handleChange}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white font-medium"
                                placeholder="usuario"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                name="password"
                                value={credentials.password}
                                onChange={handleChange}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white font-medium"
                                placeholder="••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 dark:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                        Ingresar al Sistema
                    </button>
                </form>
            </div>
        </div>
    );
}