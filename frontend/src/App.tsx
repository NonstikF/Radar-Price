import { useState, useEffect } from 'react';
import axios from 'axios';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'; // <--- IMPORTANTE

// --- COMPONENTES ---
import { InvoiceUploader } from './components/InvoiceUploader';
import { ManualEntry } from './components/ManualEntry';
import { PriceChecker } from './components/PriceChecker';
import { Dashboard } from './components/Dashboard';
import { AdminUsers } from './components/AdminUsers';
import { Login } from './components/UserLogin';
import { Logo } from './components/Logo';
import { History } from './components/History';
import { BatchDetails } from './pages/BatchDetails'; // <--- LA NUEVA PÁGINA

// --- UTILIDADES ---
import { LayoutGrid, FileText, Search, PlusCircle, Moon, Sun, Users, LogOut } from 'lucide-react';
import { API_URL } from './config';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Estados Globales
  const [products, setProducts] = useState<any[]>([]);
  const [filterMissing, setFilterMissing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ username: string, role: string, permissions: string[] } | null>(null);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark';
    return false;
  });

  // --- SEGURIDAD ---
  const canAccess = (viewName: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];

    // Permisos especiales
    if (viewName === 'history') return userPerms.includes('dashboard') || userPerms.includes('upload');

    return userPerms.includes(viewName);
  };

  // --- EFECTOS ---
  useEffect(() => {
    axios.defaults.baseURL = API_URL;
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setIsAuthenticated(true);
        setUser(parsedUser);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        handleLogout();
      }
    }
  }, []);

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
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    setIsAuthenticated(true);
    setUser(userData);

    // Redirección inteligente
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

  // --- RENDER ---
  if (!isAuthenticated) return <div className={darkMode ? 'dark' : ''}><Login onLoginSuccess={handleLoginSuccess} /></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* HEADER */}
      <header className="bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Logo variant="full" />
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-1">
              {canAccess('dashboard') && <NavButton active={location.pathname === '/dashboard'} onClick={() => navigate('/dashboard')} icon={<LayoutGrid className="w-4 h-4" />} label="Panel" />}
              {canAccess('upload') && <NavButton active={location.pathname === '/upload'} onClick={() => navigate('/upload')} icon={<FileText className="w-4 h-4" />} label="Cargar XML" />}
              {canAccess('search') && <NavButton active={location.pathname === '/search'} onClick={() => navigate('/search')} icon={<Search className="w-4 h-4" />} label="Buscador" />}
              {canAccess('manual') && <NavButton active={location.pathname === '/manual'} onClick={() => navigate('/manual')} icon={<PlusCircle className="w-4 h-4" />} label="Manual" />}
              {user?.role === 'admin' && <NavButton active={location.pathname === '/admin'} onClick={() => navigate('/admin')} icon={<Users className="w-4 h-4" />} label="Usuarios" />}
            </nav>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
              <span className="hidden md:block text-sm font-bold text-gray-500 mr-2 capitalize">{user?.username}</span>
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

      {/* CONTENIDO (RUTAS) */}
      <main className="animate-fade-in">
        <Routes>
          {/* Ruta por defecto */}
          <Route path="/" element={<Navigate to={user?.role === 'admin' ? "/dashboard" : "/search"} replace />} />

          {/* Rutas protegidas */}
          <Route path="/dashboard" element={canAccess('dashboard') ? <Dashboard onNavigate={(view) => navigate('/' + view)} /> : <Navigate to="/" />} />

          <Route path="/history" element={canAccess('history') ? <History onBack={() => navigate('/dashboard')} /> : <Navigate to="/" />} />

          {/* 🚀 LA RUTA MAGICA: Detalle de Lote */}
          <Route path="/history/:id" element={canAccess('history') ? <BatchDetails /> : <Navigate to="/" />} />

          {/* Alias para que funcione si InvoiceUploader usa /batches/ID */}
          <Route path="/batches/:id" element={canAccess('history') ? <BatchDetails /> : <Navigate to="/" />} />

          <Route path="/upload" element={canAccess('upload') ? <InvoiceUploader products={products} setProducts={setProducts} /> : <Navigate to="/" />} />

          <Route path="/search" element={canAccess('search') ? <PriceChecker initialFilter={filterMissing} onClearFilter={() => setFilterMissing(false)} /> : <Navigate to="/" />} />

          <Route path="/manual" element={canAccess('manual') ? <ManualEntry /> : <Navigate to="/" />} />

          <Route path="/admin" element={user?.role === 'admin' ? <AdminUsers /> : <Navigate to="/" />} />
        </Routes>
      </main>

      {/* MENÚ MÓVIL */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/90 dark:bg-gray-800/90 text-white p-2 rounded-2xl flex justify-around shadow-2xl z-50 border border-white/10 backdrop-blur-md">
        {canAccess('dashboard') && <MobileNavBtn onClick={() => navigate('/dashboard')} icon={<LayoutGrid className="w-5 h-5" />} active={location.pathname === '/dashboard'} />}
        {canAccess('upload') && <MobileNavBtn onClick={() => navigate('/upload')} icon={<FileText className="w-5 h-5" />} active={location.pathname === '/upload'} />}
        {canAccess('search') && <MobileNavBtn onClick={() => navigate('/search')} icon={<Search className="w-5 h-5" />} active={location.pathname === '/search'} />}
        {canAccess('manual') && <MobileNavBtn onClick={() => navigate('/manual')} icon={<PlusCircle className="w-5 h-5" />} active={location.pathname === '/manual'} />}
        {user?.role === 'admin' && <MobileNavBtn onClick={() => navigate('/admin')} icon={<Users className="w-5 h-5" />} active={location.pathname === '/admin'} />}
      </div>
    </div>
  );
}

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