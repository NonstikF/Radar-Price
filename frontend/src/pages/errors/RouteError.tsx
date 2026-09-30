import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';

// Reemplaza la pantalla técnica de React Router cuando una pantalla truena.
// Dentro del layout el menú sigue visible; en la raíz ocupa toda la página.
export function RouteError({ fullPage = false }: { fullPage?: boolean }) {
    const error = useRouteError();
    const detail = isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : error instanceof Error ? error.message : String(error);
    console.error(error);

    return (
        <div className={fullPage ? 'flex min-h-[100dvh] items-center justify-center bg-gray-50 p-4 dark:bg-gray-900' : 'mx-auto w-full max-w-7xl p-4 md:p-6'}>
            <div role="alert" className="mx-auto mt-6 max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800 md:p-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    <AlertTriangle aria-hidden="true" className="h-6 w-6" />
                </div>
                <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Algo salió mal en esta pantalla</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No se perdió nada de lo que ya estaba guardado. Intenta cargarla de nuevo o regresa al inicio.</p>
                {import.meta.env.DEV && <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-gray-100 p-3 text-left text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">{detail}</pre>}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                    <Link to="/" reloadDocument={fullPage} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Ir al inicio</Link>
                    <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">
                        <RotateCw aria-hidden="true" className="h-4 w-4" /> Reintentar
                    </button>
                </div>
            </div>
        </div>
    );
}
