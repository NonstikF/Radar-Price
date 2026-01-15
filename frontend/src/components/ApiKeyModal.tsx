import { useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Key } from 'lucide-react'; // Iconos bonitos

interface Props {
    isOpen: boolean;
    onSuccess: () => void; // Función que se ejecuta cuando se guarda bien
}

export function ApiKeyModal({ isOpen, onSuccess }: Props) {
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            // Enviamos la llave al backend
            await axios.post('http://127.0.0.1:8000/config/api-key', {
                api_key: apiKey
            });
            // Si todo sale bien:
            alert('API Key guardada correctamente ✅');
            onSuccess(); // Cerramos el modal
        } catch (err) {
            console.error(err);
            setError('Error al guardar. Verifica que el Backend esté corriendo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">

                {/* Encabezado con Icono */}
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="bg-orange-100 p-3 rounded-full mb-4">
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">API Key Requerida</h2>
                    <p className="text-gray-500 mt-2 text-sm">
                        Para procesar facturas con Inteligencia Artificial, el sistema necesita una llave válida de Google Gemini.
                    </p>
                </div>

                {/* Formulario */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ingresa tu API Key
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Ej: AIzaSy..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        onClick={handleSubmit}
                        disabled={!apiKey || loading}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all
              ${!apiKey || loading
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-orange-500 hover:bg-orange-600 shadow-lg hover:shadow-orange-500/30'
                            }`}
                    >
                        {loading ? 'Guardando...' : 'Guardar y Continuar'}
                    </button>

                    <p className="text-xs text-center text-gray-400 mt-4">
                        Tu llave se guardará de forma segura en la base de datos local.
                    </p>
                </div>
            </div>
        </div>
    );
}