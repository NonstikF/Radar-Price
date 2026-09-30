import {
    Package, ShoppingCart, Warehouse, Search, FileUp, Plus, ListChecks, Tag, Layers,
    History, Truck, MapPin, PackagePlus, ChartColumn,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { canAccess, type SessionUser } from '../lib/permissions';

// Fuente única de los módulos: la usan el inicio, las páginas de cada módulo,
// el menú y el botón de regreso, para que nombres y permisos no se desfasen.

export type ModuleKey = 'products' | 'purchases' | 'inventory';

export interface WorkspaceAction {
    title: string;
    description: string;
    path: string;
    icon: LucideIcon;
    permission: string;
}

export interface WorkspaceModule {
    key: ModuleKey;
    title: string;
    description: string;
    path: string;
    icon: LucideIcon;
    colors: ModuleColors;
    actions: WorkspaceAction[];
}

export interface ModuleColors {
    row: string;
    icon: string;
    title: string;
    primary: string;
    secondary: string;
    tile: string;
    card: string;
}

const moduleColors: Record<ModuleKey, ModuleColors> = {
    products: {
        row: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
        icon: 'bg-blue-600 text-white',
        title: 'text-blue-900 dark:text-blue-200',
        primary: 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700',
        secondary: 'border-blue-200 bg-white text-blue-800 hover:border-blue-400 hover:bg-blue-100/60 dark:border-blue-900 dark:bg-gray-800 dark:text-blue-200 dark:hover:border-blue-600 dark:hover:bg-blue-900/40',
        tile: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        card: 'hover:border-blue-300 focus-visible:border-blue-400 dark:hover:border-blue-700',
    },
    purchases: {
        row: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
        icon: 'bg-emerald-700 text-white',
        title: 'text-emerald-900 dark:text-emerald-200',
        primary: 'border-emerald-700 bg-emerald-700 text-white hover:border-emerald-800 hover:bg-emerald-800 dark:border-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800',
        secondary: 'border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100/60 dark:border-emerald-900 dark:bg-gray-800 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/40',
        tile: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        card: 'hover:border-emerald-300 focus-visible:border-emerald-400 dark:hover:border-emerald-700',
    },
    inventory: {
        row: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
        icon: 'bg-amber-700 text-white',
        title: 'text-amber-900 dark:text-amber-200',
        primary: 'border-amber-700 bg-amber-700 text-white hover:border-amber-800 hover:bg-amber-800 dark:border-amber-600 dark:bg-amber-700 dark:hover:bg-amber-800',
        secondary: 'border-amber-200 bg-white text-amber-900 hover:border-amber-400 hover:bg-amber-100/60 dark:border-amber-900 dark:bg-gray-800 dark:text-amber-200 dark:hover:border-amber-600 dark:hover:bg-amber-900/40',
        tile: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        card: 'hover:border-amber-300 focus-visible:border-amber-400 dark:hover:border-amber-700',
    },
};

export const workspaceModules: WorkspaceModule[] = [
    {
        key: 'products', title: 'Productos', description: 'Consulta y organiza tu catálogo.', path: '/products', icon: Package, colors: moduleColors.products,
        actions: [
            { title: 'Consultar precios', description: 'Busca productos y revisa precio, existencias y proveedor.', path: '/search', icon: Search, permission: 'search' },
            { title: 'Agregar producto', description: 'Registra a mano un producto nuevo.', path: '/manual', icon: Plus, permission: 'manual' },
            { title: 'Categorías', description: 'Agrupa productos por temporada o tipo.', path: '/categories', icon: Layers, permission: 'search' },
            { title: 'Diseñar etiquetas', description: 'Configura e imprime etiquetas de precio.', path: '/labels', icon: Tag, permission: 'search' },
        ],
    },
    {
        key: 'purchases', title: 'Compras', description: 'Prepara pedidos y registra facturas.', path: '/purchases', icon: ShoppingCart, colors: moduleColors.purchases,
        actions: [
            { title: 'Importar factura XML', description: 'Sube el XML del proveedor para actualizar costos.', path: '/upload', icon: FileUp, permission: 'upload' },
            { title: 'Listas de compras', description: 'Arma y da seguimiento a pedidos por proveedor.', path: '/shopping', icon: ListChecks, permission: 'shopping' },
            { title: 'Historial de facturas', description: 'Revisa las facturas importadas y sus productos.', path: '/history', icon: History, permission: 'history' },
            { title: 'Proveedores', description: 'Administra proveedores y los productos que surten.', path: '/suppliers', icon: Truck, permission: 'admin' },
        ],
    },
    {
        key: 'inventory', title: 'Inventario', description: 'Controla existencias y ubicaciones.', path: '/inventory', icon: Warehouse, colors: moduleColors.inventory,
        actions: [
            { title: 'Consultar inventario', description: 'Revisa existencias y ubicaciones del almacén.', path: '/inventory/stock', icon: Package, permission: 'inventory' },
            { title: 'Ubicaciones', description: 'Administra estantes, racks y ubicaciones del almacén.', path: '/inventory/locations', icon: MapPin, permission: 'inventory' },
            { title: 'Asignar productos', description: 'Escanea un producto y asígnalo a una ubicación.', path: '/inventory/assign', icon: PackagePlus, permission: 'inventory' },
            { title: 'Reportes de inventario', description: 'Consulta los movimientos de existencias.', path: '/inventory/reports', icon: ChartColumn, permission: 'inventory' },
        ],
    },
];

// Módulos con solo las acciones que el usuario puede abrir; un módulo sin
// acciones permitidas no aparece.
export const getVisibleModules = (user: SessionUser | null | undefined): WorkspaceModule[] =>
    workspaceModules
        .map(module => ({ ...module, actions: module.actions.filter(action => canAccess(user, action.permission)) }))
        .filter(module => module.actions.length > 0);

export const getVisibleModule = (user: SessionUser | null | undefined, key: ModuleKey) =>
    getVisibleModules(user).find(module => module.key === key);

// A dónde regresa cada pantalla. Si el usuario no puede abrir el padre,
// se sube un nivel más; si tampoco puede abrir el inicio, no hay regreso.
export type ParentKey = ModuleKey | 'dashboard' | 'history';
export interface BackTarget { to: string; label: string; }

export const resolveBackTarget = (user: SessionUser | null | undefined, parent: ParentKey): BackTarget | null => {
    if (parent === 'history' && canAccess(user, 'history')) return { to: '/history', label: 'Historial de facturas' };
    if (parent !== 'dashboard' && parent !== 'history') {
        const module = getVisibleModule(user, parent);
        if (module) return { to: module.path, label: module.title };
    }
    if (parent === 'history') return resolveBackTarget(user, 'purchases');
    return canAccess(user, 'dashboard') ? { to: '/dashboard', label: 'Inicio' } : null;
};
