import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

// Protege lo capturado y no guardado: pregunta antes de cambiar de pantalla dentro
// de la app, avisa al cerrar o recargar la pestaña, y con confirm() también al
// cerrar un modal. Devuelve el diálogo para que la pantalla lo pinte.
export function useUnsavedChanges(isDirty: boolean) {
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const blocker = useBlocker(({ currentLocation, nextLocation }) =>
        isDirty && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (!isDirty) return;
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Ejecuta la acción de inmediato si no hay cambios; si los hay, primero pregunta.
    const confirm = (action: () => void) => {
        if (isDirty) setPendingAction(() => action);
        else action();
    };

    const open = blocker.state === 'blocked' || pendingAction !== null;

    const keepEditing = () => {
        if (blocker.state === 'blocked') blocker.reset();
        setPendingAction(null);
    };

    const discard = () => {
        if (blocker.state === 'blocked') blocker.proceed();
        pendingAction?.();
        setPendingAction(null);
    };

    const dialog = open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={keepEditing}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-text" className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertTriangle aria-hidden="true" className="h-6 w-6" />
                </div>
                <h2 id="unsaved-title" className="mt-4 text-lg font-bold text-gray-900 dark:text-white">¿Descartar los cambios?</h2>
                <p id="unsaved-text" className="mt-1 text-sm text-gray-500 dark:text-gray-400">Lo que capturaste todavía no se ha guardado.</p>
                <div className="mt-6 flex flex-col gap-2">
                    <button type="button" autoFocus onClick={keepEditing} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Seguir editando</button>
                    <button type="button" onClick={discard} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">Descartar cambios</button>
                </div>
            </div>
        </div>
    ) : null;

    return { confirm, dialog };
}
