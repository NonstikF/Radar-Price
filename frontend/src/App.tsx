import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
  useNavigate,
  useLocation,
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
import { Logo } from './components/ui/Logo';
import { History } from './pages/history/History';
import { BatchDetails } from './pages/invoices/BatchDetails';
import LabelDesigner from './pages/labels/LabelDesigner';
import { ShoppingLists } from './pages/shopping/ShoppingLists';
import { Suppliers } from './pages/suppliers/Suppliers';
import { Inventory } from './pages/inventory/Inventory';
import { Locations } from './pages/inventory/Locations';
import { AssignProduct } from './pages/inventory/AssignProduct';
import { ProductsHub } from './pages/products/ProductsHub';
import { PurchasesHub } from './pages/purchases/PurchasesHub';

// --- UTILIDADES ---
import { LayoutGrid, Package, Moon, Sun, Users, LogOut, ShoppingCart, Warehouse, MoreHorizontal, ChevronDown } from 'lucide-react';
import { API_URL } from './config/api';

// =========================================================================
// 1. ROOT LAYOUT: Maneja la Estructura (Header, State, Auth)
// =========================================================================
function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- ESTADOS GLOBALES ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));

  const [user, setUser] = useState<{ username: string, role: string, permissions: string[] } | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [products, setProducts] = useState<any[]>([]);
  const [filterMissing, setFilterMissing] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);

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
  const checkPermission = (requiredModule: string) => {
    if (!user) return false;
    if (isAdmin) return true;
    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
    if (requiredModule === 'history') return userPerms.includes('dashboard') || userPerms.includes('upload');
    return userPerms.includes(requiredModule);
  };

  // --- EFECTOS ---
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

    if (userData.role === 'admin' || userData.permissions?.includes('dashboard')) {
      navigate('/dashboard');
    } else {
      navigate('/search');
    }
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

  // Definimos todos los items de navegación (agrupados por módulos)
  const allNavItems = [
    { key: 'dashboard', path: '/dashboard', icon: <LayoutGrid className="w-4 h-4" />, label: 'Panel', perm: 'dashboard', primary: true },
    { key: 'products', path: '/products', icon: <Package className="w-4 h-4" />, label: 'Productos', perm: 'search', primary: true },
    { key: 'purchases', path: '/purchases', icon: <ShoppingCart className="w-4 h-4" />, label: 'Compras', perm: 'upload', primary: true },
    { key: 'inventory', path: '/inventory', icon: <Warehouse className="w-4 h-4" />, label: 'Inventario', perm: 'inventory', primary: true },
    { key: 'admin', path: '/admin', icon: <Users className="w-4 h-4" />, label: 'Admin', perm: 'admin', primary: false, adminOnly: true },
  ];

  const visibleItems = allNavItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    return checkPermission(item.perm);
  });

  const primaryItems = visibleItems.filter(i => i.primary);
  const secondaryItems = visibleItems.filter(i => !i.primary);
  const pathStartsWith = ['inventory', 'products', 'purchases'];
  const isActive = (item: typeof allNavItems[0]) =>
    pathStartsWith.includes(item.key) ? location.pathname.startsWith(item.path) : location.pathname === item.path;

  const isSecondaryActive = secondaryItems.some(i => isActive(i));

  // Mobile: primeros 4 + más
  const mobileMainItems = visibleItems.slice(0, 4);
  const mobileExtraItems = visibleItems.slice(4);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* HEADER */}
      <header className="bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="cursor-pointer shrink-0" onClick={() => navigate(isAdmin ? '/dashboard' : '/search')}>
            <Logo variant="full" />
          </div>

          <div className="flex items-center gap-2">
            {/* NAV DESKTOP */}
            <nav className="hidden md:flex items-center gap-0.5">
              {primaryItems.map(item => (
                <NavButton key={item.key} active={isActive(item)} onClick={() => navigate(item.path)} icon={item.icon} label={item.label} />
              ))}

              {/* MENÚ "MÁS" */}
              {secondaryItems.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all ${isSecondaryActive || showMoreMenu ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span>Más</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 min-w-[200px] z-40 animate-scale-in">
                        {secondaryItems.map(item => (
                          <button
                            key={item.key}
                            onClick={() => { navigate(item.path); setShowMoreMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all ${isActive(item) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </nav>

            {/* USER ACTIONS */}
            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
              <span className="hidden lg:block text-xs font-bold text-gray-500 dark:text-gray-400 capitalize mr-1">{user?.username}</span>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {darkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-gray-600" />}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* AQUÍ SE RENDERIZAN LAS RUTAS HIJAS */}
      <main className="animate-fade-in">
        <Outlet context={contextValue} />
      </main>

      {/* MENÚ MÓVIL */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/90 dark:bg-gray-800/90 text-white p-1.5 rounded-2xl flex justify-around shadow-2xl z-50 border border-white/10 backdrop-blur-md">
        {mobileMainItems.map(item => (
          <MobileNavBtn key={item.key} onClick={() => { navigate(item.path); setShowMobileMore(false); }} icon={item.icon} active={isActive(item)} />
        ))}
        {mobileExtraItems.length > 0 && (
          <MobileNavBtn
            onClick={() => setShowMobileMore(!showMobileMore)}
            icon={<MoreHorizontal className="w-5 h-5" />}
            active={showMobileMore || mobileExtraItems.some(i => isActive(i))}
          />
        )}
      </div>

      {/* MENÚ MÓVIL EXPANDIDO */}
      {showMobileMore && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMore(false)} />
          <div className="md:hidden fixed bottom-24 left-4 right-4 z-50 bg-gray-900 dark:bg-gray-800 rounded-2xl p-3 shadow-2xl border border-white/10 animate-scale-in">
            <div className="grid grid-cols-3 gap-2">
              {mobileExtraItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => { navigate(item.path); setShowMobileMore(false); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${isActive(item) ? 'bg-blue-600 shadow-lg' : 'text-gray-400 hover:bg-gray-800 dark:hover:bg-gray-700'}`}
                >
                  {item.icon}
                  <span className="text-[10px] font-bold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
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

const DashboardWrapper = () => {
  const navigate = useNavigate();
  return <Dashboard onNavigate={(view: string) => navigate('/' + view)} />;
};

const HistoryWrapper = () => {
  const navigate = useNavigate();
  return <History onBack={() => navigate('/dashboard')} />;
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

const HomeRedirect = () => {
  const { isAdmin, checkPermission } = useOutletContext<ContextType>();

  if (isAdmin || checkPermission('dashboard')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/search" replace />;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<RootLayout />}>
      {/* Redirección Inicial */}
      <Route index element={<HomeRedirect />} />

      {/* Rutas Protegidas */}
      <Route path="dashboard" element={<PermissionGuard module="dashboard"><DashboardWrapper /></PermissionGuard>} />

      {/* --- PRODUCTOS (hub + sub-rutas) --- */}
      <Route path="products" element={<PermissionGuard module="search"><ProductsHub /></PermissionGuard>} />
      <Route path="search" element={<PermissionGuard module="search"><SearchWrapper /></PermissionGuard>} />
      <Route path="manual" element={<PermissionGuard module="manual"><ManualEntry /></PermissionGuard>} />
      <Route path="labels" element={<LabelDesigner />} />

      {/* --- COMPRAS (hub + sub-rutas) --- */}
      <Route path="purchases" element={<PermissionGuard module="upload"><PurchasesHub /></PermissionGuard>} />
      <Route path="upload" element={<PermissionGuard module="upload"><UploadWrapper /></PermissionGuard>} />
      <Route path="history" element={<PermissionGuard module="history"><HistoryWrapper /></PermissionGuard>} />
      <Route path="history/:id" element={<PermissionGuard module="history"><BatchDetails /></PermissionGuard>} />
      <Route path="batches/:id" element={<PermissionGuard module="history"><BatchDetails /></PermissionGuard>} />
      <Route path="shopping" element={<PermissionGuard module="shopping"><ShoppingLists /></PermissionGuard>} />
      <Route path="suppliers" element={<AdminGuard><Suppliers /></AdminGuard>} />

      {/* --- INVENTARIO --- */}
      <Route path="inventory" element={<PermissionGuard module="inventory"><Inventory /></PermissionGuard>} />
      <Route path="inventory/locations" element={<PermissionGuard module="inventory"><Locations /></PermissionGuard>} />
      <Route path="inventory/assign" element={<PermissionGuard module="inventory"><AssignProduct /></PermissionGuard>} />

      <Route path="admin" element={<AdminGuard><AdminUsers /></AdminGuard>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);

// =========================================================================
// 5. COMPONENTE APP FINAL
// =========================================================================

function App() {
  return <RouterProvider router={router} />;
}

// Componentes visuales pequeños
const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold transition-all ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
    {icon} {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-2.5 rounded-xl transition-all ${active ? 'bg-blue-600 shadow-lg shadow-blue-500/50' : 'text-gray-400 hover:text-white'}`}>
    {icon}
  </button>
);

export default App;