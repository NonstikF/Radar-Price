import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { resolveBackTarget, type BackTarget, type ParentKey } from '../../config/workspace';
import { getSessionUser } from '../../lib/permissions';
import { cn } from '../../lib/utils';

interface BackLinkProps {
    parent?: ParentKey;
    target?: BackTarget;
    // Vistas de detalle dentro de la misma pantalla: regresan a la lista sin cambiar de ruta.
    onClick?: () => void;
    label?: string;
    className?: string;
}

const backLinkClass = '-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white';

// Regreso al nivel de arriba (no al historial del navegador): funciona igual
// si la pantalla se abrió desde el menú, desde el inicio o con un enlace directo.
export const BackLink = ({ parent, target, onClick, label, className }: BackLinkProps) => {
    if (onClick && label) {
        return (
            <button type="button" onClick={onClick} aria-label={`Regresar a ${label}`} className={cn(backLinkClass, className)}>
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                {label}
            </button>
        );
    }
    const back = target ?? (parent ? resolveBackTarget(getSessionUser(), parent) : null);
    if (!back) return null;
    return (
        <Link to={back.to} aria-label={`Regresar a ${back.label}`} className={cn(backLinkClass, className)}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            {back.label}
        </Link>
    );
};

interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    parent?: ParentKey;
    actions?: ReactNode;
    className?: string;
}

export const PageHeader = ({ title, description, parent, actions, className }: PageHeaderProps) => (
    <header className={cn('mb-6', className)}>
        {parent && <BackLink parent={parent} className="mb-2" />}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">{title}</h1>
                {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
            </div>
            {actions && <div className="flex w-full flex-wrap gap-2 md:w-auto md:flex-nowrap">{actions}</div>}
        </div>
    </header>
);
