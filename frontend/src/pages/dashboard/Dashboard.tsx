import { Link } from 'react-router-dom';
import { Users, Settings, ArrowUpRight, ChevronRight } from 'lucide-react';
import { getVisibleModules, type WorkspaceModule } from '../../config/workspace';
import { getSessionUser } from '../../lib/permissions';

const adminLinks = [
    { title: 'Usuarios y permisos', description: 'Administra el acceso de tu equipo', path: '/admin', icon: Users },
    { title: 'Configuración', description: 'Ajustes generales del sistema', path: '/settings', icon: Settings },
];

const desktopColumns: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' };

const ModuleRow = ({ module }: { module: WorkspaceModule }) => {
    const Icon = module.icon;
    const colors = module.colors;
    return (
        <section aria-label={module.title} className={`flex flex-col gap-5 border-b border-l-4 border-b-gray-200 px-4 py-6 last:border-b-0 dark:border-b-gray-700 sm:px-6 lg:gap-6 lg:border-b-0 lg:border-l-0 lg:border-r lg:border-r-gray-200 lg:p-6 lg:last:border-r-0 dark:lg:border-r-gray-700 ${colors.row}`}>
            <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.icon}`}><Icon aria-hidden="true" className="h-5 w-5" /></div>
                <div>
                    <h2 className={`text-base font-bold ${colors.title}`}>{module.title}</h2>
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">{module.description}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                {module.actions.map(({ title, path, icon: ActionIcon }, index) => <Link key={path} to={path} className={`group flex min-h-16 items-center gap-2 rounded-lg border px-3 py-3 lg:min-h-12 lg:gap-3 lg:px-4 text-left text-sm font-medium transition-colors ${index === 0 ? colors.primary : colors.secondary}`}>
                    <ActionIcon aria-hidden="true" className="hidden h-4 w-4 shrink-0 opacity-70 sm:block" />
                    <span className="flex-1">{title}</span>
                    {index === 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                </Link>)}
            </div>
        </section>
    );
};

export function Dashboard() {
    const user = getSessionUser();
    const isAdmin = user.role === 'admin';
    const modules = getVisibleModules(user);

    return (
        <div className="mx-auto max-w-7xl px-4 py-7 md:px-6 md:py-10">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Inicio</p>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">Centro de trabajo</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">De la consulta a la compra. Todas tus tareas a mano.</p>
                </div>
            </div>
            {modules.length > 0 && <div className="overflow-hidden rounded-2xl border border-gray-300/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_-12px_rgba(15,23,42,0.18)] dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
                <div className={`lg:grid ${desktopColumns[modules.length] ?? 'lg:grid-cols-3'}`}>
                    {modules.map(module => <ModuleRow key={module.key} module={module} />)}
                </div>
            </div>}
            {modules.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">Pide al administrador que habilite los accesos de tu cuenta para comenzar.</p>}
            {isAdmin && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 lg:justify-end lg:gap-4">
                <p className="px-3 text-xs text-gray-500 dark:text-gray-400">Configuración del equipo</p>
                {adminLinks.map(({ title, description, path, icon: Icon }) => <Link key={path} to={path} className="group flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 sm:w-auto sm:min-w-72">
                    <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
                    <span className="flex-1"><span className="block text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{description}</span></span>
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                </Link>)}
            </div>}
        </div>
    );
}
