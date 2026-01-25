import { useState } from 'react';
import axios from 'axios';
import { User, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { API_URL } from '../config';

interface Props {
    onLoginSuccess: (userData: any) => void;
}

export function Login({ onLoginSuccess }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        try {
            // 1. Petición al Backend
            const response = await axios.post(`${API_URL}/auth/token`, formData);

            // 2. DEBUG: Ver qué llega realmente del servidor (Míralo en la consola F12)
            console.log("RESPUESTA SERVIDOR (RAW):", response.data);

            // 3. Pasar los datos LIMPIOS a la App
            // IMPORTANTE: No agregamos ni modificamos nada aquí manualmente
            onLoginSuccess(response.data);

        } catch (err: any) {
            console.error(err);
            if (err.response?.status === 401) {
                setError('Usuario o contraseña incorrectos.');
            } else {
                setError('Error de conexión con el servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl w-full max-w-sm border border-gray-100 dark:border-gray-700 animate-scale-in">

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Bienvenido</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Inicia sesión para continuar</p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl flex items-center gap-2 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Usuario</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-[#25262b] border-2 border-transparent focus:border-blue-500 hover:bg-gray-100 dark:hover:bg-[#2c2e33] rounded-xl outline-none font-bold text-gray-900 dark:text-white transition-all placeholder:font-normal"
                                placeholder="Ingresa tu usuario"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Contraseña</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-[#25262b] border-2 border-transparent focus:border-blue-500 hover:bg-gray-100 dark:hover:bg-[#2c2e33] rounded-xl outline-none font-bold text-gray-900 dark:text-white transition-all placeholder:font-normal"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Iniciar Sesión"}
                    </button>
                </form>
            </div>
        </div>
    );
}