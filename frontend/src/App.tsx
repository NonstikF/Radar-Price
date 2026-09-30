import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
  useNavigate,
  Navigate,
  Outlet,
  useOutletContext
} from 'react-router-dom';

// --- COMPONENTES ---
import { InvoiceUploader } from './pages/invoices/InvoiceUploader';
import { ManualEntry } from './pages/products/ManualEntry';
import { PriceChecker } from './pages/products/PriceChecker';
import { Dashboard } from './pages/dashboard/Dashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { Login } from './pages/auth/Login';
import { AppNavigation } from './components/ui/AppNavigation';
import { History } from './pages/history/History';
import { BatchDetails } from './pages/invoices/BatchDetails';
import LabelDesigner from './pages/labels/LabelDesigner';
import { ShoppingLists } from './pages/shopping/ShoppingLists';
import { Suppliers } from './pages/suppliers/Suppliers';
import { Locations } from './pages/inventory/Locations';
import { AssignProduct } from './pages/inventory/AssignProduct';
import { InventoryReports } from './pages/inventory/InventoryReports';
import { StockAdjust } from './pages/inventory/StockAdjust';
import { ModuleHub } from './pages/modules/ModuleHub';
import { RouteError } from './pages/errors/RouteError';
import { Categories } from './pages/products/Categories';
import { Settings } from './pages/settings/Settings';

// --- UTILIDADES ---
import { API_URL } from './config/api';
import { canAccess, getSessionUser } from './lib/permissions';
import { getVisibleModules } from './config/workspace';

// =========================================================================
// 1. ROOT LAYOUT: Maneja la Estructura (Header, State, Auth)
// =========================================================================
function RootLayout() {
  const navigate = useNavigate();

  // --- ESTADOS GLOBALES ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));

  const [user, setUser] = useState<{ username: string, role: string, permissions: string[] } | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [products, setProducts] = useState<any[]>([]);
  const [filterMissing, setFilterMissing] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // --- CONFIGURACIÓN AXIOS ---
  if (isAuthenticated && user) {
    const token = localStorage.getItem('token');
    if (token && token !== 'undefined') {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    axios.defaults.baseURL = API_URL;
  }

  // --- PERMISOS ---
  const isAdmin = user?.role === 'admin';
  const checkPermission = (requiredModule: string) => canAccess(user, requiredModule);

  // --- EFECTOS ---
  // Interceptor global: token vencido / inválido (401) => cerrar sesión y volver al login
  // en vez de mostrar "Error de conexión" en cada pantalla.
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.clear();
          delete axios.defaults.headers.common['Authorization'];
          setIsAuthenticated(false);
          setUser(null);
          navigate('/');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // --- HANDLERS ---
  const handleLoginSuccess = (userData: any) => {
    const token = userData.access_token || userData.token;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    setIsAuthenticated(true);
    setUser(userData);

    navigate('/');
  };

  const handleLogout = () => {
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
    navigate('/');
  };

  // --- RENDERIZADO CONDICIONAL (LOGIN vs APP) ---
  if (!isAuthenticated) {
    return <div className={darkMode ? 'dark' : ''}><Login onLoginSuccess={handleLoginSuccess} /></div>;
  }

  // Contexto que pasaremos a los hijos (Wrappers)
  const contextValue = {
    products,
    setProducts,
    filterMissing,
    setFilterMissing,
    checkPermission,
    isAdmin
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100">
      <AppNavigation username={user?.username} isAdmin={isAdmin} can={checkPermission}
        darkMode={darkMode} onToggleTheme={() => setDarkMode(value => !value)} onLogout={handleLogout} />
      <main id="main-content" tabIndex={-1} className="app-content">
        <Outlet context={contextValue} />
      </main>
    </div>
  );
}

// =========================================================================
// 2. WRAPPERS (Para conectar el Router con los Props de tus componentes)
// =========================================================================

// Tipado del contexto
type ContextType = {
  products: any[];
  setProducts: (p: any[]) => void;
  filterMissing: boolean;
  setFilterMissing: (v: boolean) => void;
  checkPermission: (mod: string) => boolean;
  isAdmin: boolean;
};

const UploadWrapper = () => {
  const { products, setProducts } = useOutletContext<ContextType>();
  return <InvoiceUploader products={products} setProducts={setProducts} />;
};

const SearchWrapper = () => {
  const { filterMissing, setFilterMissing } = useOutletContext<ContextType>();
  return <PriceChecker initialFilter={filterMissing} onClearFilter={() => setFilterMissing(false)} />;
};

// =========================================================================
// 3. COMPONENTES AUXILIARES Y GUARDS (Corregidos)
// =========================================================================

// Usamos React.ReactNode para evitar el error de namespace JSX
function PermissionGuard({ module, children }: { module: string, children: React.ReactNode }) {
  const { checkPermission } = useOutletContext<ContextType>();
  return checkPermission(module) ? <>{children}</> : <Navigate to="/" replace />;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useOutletContext<ContextType>();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

// =========================================================================
// 4. DEFINICIÓN DEL ROUTER (Data Router)
// =========================================================================

// Manda a la primera pantalla que el usuario sí puede abrir. Sin ningún acceso
// se muestra un aviso: redirigir a una ruta protegida volvería aquí en ciclo.
const HomeRedirect = () => {
  const { checkPermission } = useOutletContext<ContextType>();

  if (checkPermission('dashboard')) {
    return <Navigate to="/dashboard" replace />;
  }
  const firstModule = getVisibleModules(getSessionUser())[0];
  if (firstModule) {
    return <Navigate to={firstModule.path} replace />;
  }
  return <p className="mx-auto mt-10 max-w-md rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">Pide al administrador que habilite los accesos de tu cuenta para comenzar.</p>;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<RootLayout />} errorElement={<RouteError fullPage />}>
      {/* Errores de cada pantalla: se muestran dentro del layout para no perder el menú */}
      <Route errorElement={<RouteError />}>
        {/* Redirección Inicial */}
        <Route index element={<HomeRedirect />} />

        {/* Rutas Protegidas */}
        <Route path="dashboard" element={<PermissionGuard module="dashboard"><Dashboard /></PermissionGuard>} />

        {/* --- PRODUCTOS (hub + sub-rutas) --- */}
        <Route path="products" element={<ModuleHub moduleKey="products" />} />
        <Route path="search" element={<PermissionGuard module="search"><SearchWrapper /></PermissionGuard>} />
        <Route path="manual" element={<PermissionGuard module="manual"><ManualEntry /></PermissionGuard>} />
        <Route path="categories" element={<PermissionGuard module="search"><Categories /></PermissionGuard>} />
        <Route path="labels" element={<PermissionGuard module="search"><LabelDesigner /></PermissionGuard>} />

        {/* --- COMPRAS (hub + sub-rutas) --- */}
        <Route path="purchases" element={<ModuleHub moduleKey="purchases" />} />
        <Route path="upload" element={<PermissionGuard module="upload"><UploadWrapper /></PermissionGuard>} />
        <Route path="history" element={<PermissionGuard module="history"><History /></PermissionGuard>} />
        <Route path="history/:id" element={<PermissionGuard module="history"><BatchDetails /></PermissionGuard>} />
        <Route path="batches/:id" element={<PermissionGuard module="history"><BatchDetails /></PermissionGuard>} />
        <Route path="shopping" element={<PermissionGuard module="shopping"><ShoppingLists /></PermissionGuard>} />
        <Route path="suppliers" element={<AdminGuard><Suppliers /></AdminGuard>} />

        {/* --- INVENTARIO --- */}
        <Route path="inventory" element={<ModuleHub moduleKey="inventory" />} />
        <Route path="inventory/locations" element={<PermissionGuard module="inventory"><Locations /></PermissionGuard>} />
        <Route path="inventory/assign" element={<PermissionGuard module="inventory"><AssignProduct /></PermissionGuard>} />
        <Route path="inventory/reports" element={<PermissionGuard module="inventory"><InventoryReports /></PermissionGuard>} />
        <Route path="inventory/stock" element={<AdminGuard><StockAdjust /></AdminGuard>} />

        <Route path="admin" element={<AdminGuard><AdminUsers /></AdminGuard>} />
        <Route path="settings" element={<AdminGuard><Settings /></AdminGuard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  )
);

// =========================================================================
// 5. COMPONENTE APP FINAL
// =========================================================================

function App() {
  return <RouterProvider router={router} />;
}

export default App;
