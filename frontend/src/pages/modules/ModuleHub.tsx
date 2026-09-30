import { Link, Navigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { getVisibleModule, type ModuleKey } from '../../config/workspace';
import { getSessionUser } from '../../lib/permissions';

const gridColumns: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

// Página de entrada de un módulo: las mismas acciones que el inicio, con su descripción.
export function ModuleHub({ moduleKey }: { moduleKey: ModuleKey }) {
    const module = getVisibleModule(getSessionUser(), moduleKey);
    if (!module) return <Navigate to="/" replace />;
    // Una acción que apunta a esta misma página (ej. "Consultar inventario") no se repite aquí.
    const actions = module.actions.filter(action => action.path !== module.path);
    const { colors } = module;

    return (
        <div className="mx-auto w-full max-w-7xl p-4 pb-24 md:p-6">
            <PageHeader parent="dashboard" title={module.title} description={module.description} />
            <div className={`grid gap-3 sm:grid-cols-2 ${gridColumns[actions.length] ?? 'lg:grid-cols-4'}`}>
                {actions.map(({ title, description, path, icon: Icon }) => (
                    <Link key={path} to={path} className={`group flex items-start gap-4 rounded-xl border border-gray-300 bg-white p-5 shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 lg:flex-col lg:gap-5 ${colors.card}`}>
                        {/* Ícono con el color sólido del módulo para que cada tarjeta se distinga */}
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg shadow-sm ${colors.icon}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                            <span className={`flex items-center justify-between gap-2 text-base font-bold ${colors.title}`}>
                                {title}
                                <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5 dark:text-gray-400" />
                            </span>
                            <span className="mt-1 block text-sm leading-relaxed text-gray-600 dark:text-gray-300">{description}</span>
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
