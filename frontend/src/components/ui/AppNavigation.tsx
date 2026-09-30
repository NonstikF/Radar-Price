import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Users, Settings, Moon, Sun, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from './Logo';
import { workspaceModules, type ModuleKey } from '../../config/workspace';

const firstSegment = (path: string) => path.split('/')[1];
// Detalle de factura: no es una acción del módulo pero vive en Compras.
const extraRoutes: Partial<Record<ModuleKey, string[]>> = { purchases: ['/batches'] };

interface NavItem {
    label: string;
    // En móvil el nombre completo no cabe junto a los demás.
    shortLabel?: string;
    path: string;
    icon: LucideIcon;
    show: boolean;
    routes: string[];
}

interface Props {
    username?: string;
    isAdmin: boolean;
    can: (permission: string) => boolean;
    darkMode: boolean;
    onToggleTheme: () => void;
    onLogout: () => void;
}

export const AppNavigation = ({ username, isAdmin, can, darkMode, onToggleTheme, onLogout }: Props) => {
    const { pathname } = useLocation();
    const modules = workspaceModules
        .filter(module => module.actions.some(action => can(action.permission)))
        .map(module => ({
            label: module.title, path: module.path, icon: module.icon, show: true,
            // Sección activa: el módulo y cualquier pantalla que cuelga de él.
            routes: [module.path, ...module.actions.map(action => action.path), ...(extraRoutes[module.key] ?? [])].map(firstSegment),
        }));
    const items: NavItem[] = [
        { label: 'Inicio', path: '/dashboard', icon: LayoutGrid, show: can('dashboard'), routes: ['dashboard'] },
        ...modules,
        { label: 'Usuarios', path: '/admin', icon: Users, show: isAdmin, routes: ['admin'] },
        { label: 'Configuración', shortLabel: 'Ajustes', path: '/settings', icon: Settings, show: isAdmin, routes: ['settings'] },
    ].filter(item => item.show);
    const section = pathname.split('/')[1];

    return <>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-blue-600 focus:p-3 focus:text-white">Saltar al contenido</a>
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
                <Link to={items[0]?.path || '/'} aria-label="Radar Price, inicio" className="shrink-0 rounded-lg"><Logo variant="full" /></Link>
                <nav aria-label="Navegación principal" className="hidden items-center gap-1 lg:flex">
                    {items.map(({ label, path, icon: Icon, routes }) => {
                        const active = routes.includes(section);
                        return <NavLink key={label} to={path} aria-current={active ? 'page' : false} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />{label}
                        </NavLink>;
                    })}
                </nav>
                <div className="flex items-center gap-1 sm:gap-2">
                    <span className="hidden max-w-28 truncate text-sm text-gray-500 xl:block">{username}</span>
                    <button type="button" onClick={onToggleTheme} aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'} title={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'} className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"><LogOut className="h-5 w-5" /></button>
                </div>
            </div>
        </header>
        <nav aria-label="Navegación móvil" className="mobile-navigation fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-gray-200 bg-white/95 px-2 pt-2 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95 lg:hidden">
            {items.map(({ label, shortLabel, path, icon: Icon, routes }) => {
                const active = routes.includes(section);
                return <NavLink key={label} to={path} aria-label={shortLabel ? label : undefined} aria-current={active ? 'page' : false} className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />{shortLabel ?? label}
                </NavLink>;
            })}
        </nav>
    </>;
};
