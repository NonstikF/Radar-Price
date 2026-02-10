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
import { InvoiceUploader } from './components/InvoiceUploader';
import { ManualEntry } from './components/ManualEntry';
import { PriceChecker } from './components/PriceChecker';
import { Dashboard } from './components/Dashboard';
import { AdminUsers } from './components/AdminUsers';
import { Login } from './components/UserLogin';
import { Logo } from './components/Logo';
import { History } from './components/History';
import { BatchDetails } from './pages/BatchDetails';
// Borramos ProtectedRoute porque ya no lo usamos aquí

// --- UTILIDADES ---
import { LayoutGrid, FileText, Search, PlusCircle, Moon, Sun, Users, LogOut } from 'lucide-react';
import { API_URL } from './config';

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

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* HEADER */}
      <header className="bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate(isAdmin ? '/dashboard' : '/search')}>
            <Logo variant="full" />
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-1">
              {checkPermission('dashboard') && <NavButton active={location.pathname === '/dashboard'} onClick={() => navigate('/dashboard')} icon={<LayoutGrid className="w-4 h-4" />} label="Panel" />}
              {checkPermission('upload') && <NavButton active={location.pathname === '/upload'} onClick={() => navigate('/upload')} icon={<FileText className="w-4 h-4" />} label="Cargar XML" />}
              {checkPermission('search') && <NavButton active={location.pathname === '/search'} onClick={() => navigate('/search')} icon={<Search className="w-4 h-4" />} label="Buscador" />}
              {checkPermission('manual') && <NavButton active={location.pathname === '/manual'} onClick={() => navigate('/manual')} icon={<PlusCircle className="w-4 h-4" />} label="Manual" />}
              {isAdmin && <NavButton active={location.pathname === '/admin'} onClick={() => navigate('/admin')} icon={<Users className="w-4 h-4" />} label="Usuarios" />}
            </nav>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
              <div className="flex flex-col items-end mr-2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 capitalize leading-none">{user?.username}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isAdmin ? 'text-blue-600' : 'text-gray-400'}`}>
                  {isAdmin ? 'Administrador' : 'Usuario'}
                </span>
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
                {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-500">
                <LogOut className="w-5 h-5" />
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
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/90 dark:bg-gray-800/90 text-white p-2 rounded-2xl flex justify-around shadow-2xl z-50 border border-white/10 backdrop-blur-md">
        {checkPermission('dashboard') && <MobileNavBtn onClick={() => navigate('/dashboard')} icon={<LayoutGrid className="w-5 h-5" />} active={location.pathname === '/dashboard'} />}
        {checkPermission('upload') && <MobileNavBtn onClick={() => navigate('/upload')} icon={<FileText className="w-5 h-5" />} active={location.pathname === '/upload'} />}
        {checkPermission('search') && <MobileNavBtn onClick={() => navigate('/search')} icon={<Search className="w-5 h-5" />} active={location.pathname === '/search'} />}
        {checkPermission('manual') && <MobileNavBtn onClick={() => navigate('/manual')} icon={<PlusCircle className="w-5 h-5" />} active={location.pathname === '/manual'} />}
        {isAdmin && <MobileNavBtn onClick={() => navigate('/admin')} icon={<Users className="w-5 h-5" />} active={location.pathname === '/admin'} />}
      </div>
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

      <Route path="history" element={<PermissionGuard module="history"><HistoryWrapper /></PermissionGuard>} />
      <Route path="history/:id" element={<PermissionGuard module="history"><BatchDetails /></PermissionGuard>} />
      <Route path="batches/:id" element={<PermissionGuard module="history"><BatchDetails /></PermissionGuard>} />

      <Route path="upload" element={<PermissionGuard module="upload"><UploadWrapper /></PermissionGuard>} />

      <Route path="search" element={<PermissionGuard module="search"><SearchWrapper /></PermissionGuard>} />

      <Route path="manual" element={<PermissionGuard module="manual"><ManualEntry /></PermissionGuard>} />

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
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
    {icon} {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-3 rounded-xl transition-all ${active ? 'bg-blue-600 shadow-lg shadow-blue-500/50' : 'text-gray-400 hover:text-white'}`}>
    {icon}
  </button>
);

export default App;