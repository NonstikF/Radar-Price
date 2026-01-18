import { useState, useEffect } from 'react';
import axios from 'axios';
import { InvoiceUploader } from './components/InvoiceUploader';
import { ManualEntry } from './components/ManualEntry';
import { PriceChecker } from './components/PriceChecker';
import { Dashboard } from './components/Dashboard';
import { AdminUsers } from './components/AdminUsers';
import { Login } from './components/UserLogin';
import { Logo } from './components/Logo';
import { LayoutGrid, FileText, Search, PlusCircle, Moon, Sun, Users, LogOut } from 'lucide-react';
import { API_URL } from './config';

function App() {
  const [currentView, setCurrentView] = useState('search'); // Vista segura por defecto
  const [products, setProducts] = useState<any[]>([]);
  const [filterMissing, setFilterMissing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Usuario ahora incluye permisos
  const [user, setUser] = useState<{ username: string, role: string, permissions: string[] } | null>(null);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark';
    return false;
  });

  // --- HELPER: ¿TIENE PERMISO? ---
  const canAccess = (viewName: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin ve todo
    return user.permissions.includes(viewName);
  };

  useEffect(() => {
    axios.defaults.baseURL = API_URL;
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setIsAuthenticated(true);
      setUser(parsedUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Redirigir si está en una vista prohibida
      if (parsedUser.role !== 'admin' && currentView === 'dashboard' && !parsedUser.permissions.includes('dashboard')) {
        setCurrentView('search');
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

  const handleLoginSuccess = (userData: any) => {
    // userData viene del backend con { ..., permissions: [...] }
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData)); // Guardamos todo el objeto user
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    setIsAuthenticated(true);
    setUser(userData);

    // Redirección inteligente al entrar
    if (userData.role === 'admin' || userData.permissions.includes('dashboard')) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('search');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleNavigate = (view: string, enableFilter: boolean = false) => {
    setCurrentView(view);
    setFilterMissing(enableFilter);
  };

  if (!isAuthenticated) return <div className={darkMode ? 'dark' : ''}><Login onLoginSuccess={handleLoginSuccess} /></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <header className="bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => handleNavigate('search')}>
            <Logo variant="full" />
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-1">
              {canAccess('dashboard') && <NavButton active={currentView === 'dashboard'} onClick={() => handleNavigate('dashboard')} icon={<LayoutGrid className="w-4 h-4" />} label="Panel" />}
              {canAccess('upload') && <NavButton active={currentView === 'upload'} onClick={() => handleNavigate('upload')} icon={<FileText className="w-4 h-4" />} label="Cargar XML" />}
              {canAccess('search') && <NavButton active={currentView === 'search'} onClick={() => handleNavigate('search')} icon={<Search className="w-4 h-4" />} label="Buscador" />}
              {canAccess('manual') && <NavButton active={currentView === 'manual'} onClick={() => handleNavigate('manual')} icon={<PlusCircle className="w-4 h-4" />} label="Manual" />}
              {canAccess('users') && <NavButton active={currentView === 'admin'} onClick={() => handleNavigate('admin')} icon={<Users className="w-4 h-4" />} label="Usuarios" />}
            </nav>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
              <span className="hidden md:block text-sm font-bold text-gray-500 mr-2 capitalize">{user?.username}</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                title="Cambiar tema"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-500"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="animate-fade-in">
        {currentView === 'dashboard' && canAccess('dashboard') && <Dashboard onNavigate={handleNavigate} />}
        {currentView === 'upload' && canAccess('upload') && <InvoiceUploader products={products} setProducts={setProducts} />}
        {currentView === 'search' && canAccess('search') && <PriceChecker initialFilter={filterMissing} onClearFilter={() => setFilterMissing(false)} />}
        {currentView === 'manual' && canAccess('manual') && <ManualEntry />}
        {currentView === 'admin' && canAccess('users') && <AdminUsers />}
      </main>

      {/* MENÚ MÓVIL */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/90 text-white p-2 rounded-2xl flex justify-around shadow-2xl z-50 overflow-x-auto">
        {canAccess('dashboard') && <MobileNavBtn onClick={() => handleNavigate('dashboard')} icon={<LayoutGrid className="w-5 h-5" />} active={currentView === 'dashboard'} />}
        {canAccess('upload') && <MobileNavBtn onClick={() => handleNavigate('upload')} icon={<FileText className="w-5 h-5" />} active={currentView === 'upload'} />}
        {canAccess('search') && <MobileNavBtn onClick={() => handleNavigate('search')} icon={<Search className="w-5 h-5" />} active={currentView === 'search'} />}
        {canAccess('manual') && <MobileNavBtn onClick={() => handleNavigate('manual')} icon={<PlusCircle className="w-5 h-5" />} active={currentView === 'manual'} />}
        {canAccess('users') && <MobileNavBtn onClick={() => handleNavigate('admin')} icon={<Users className="w-5 h-5" />} active={currentView === 'admin'} />}
      </div>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
    {icon} {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-3 rounded-xl transition-all ${active ? 'bg-blue-600 shadow-lg' : 'text-gray-400'}`}>
    {icon}
  </button>
);

export default App;