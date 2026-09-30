export interface SessionUser {
    username?: string;
    role?: string;
    permissions?: string[];
}

export const getSessionUser = (): SessionUser => {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
        return {};
    }
};

// Misma regla para rutas, menú y botones: el admin puede todo, 'admin' es solo
// para el rol admin y el historial se abre con 'dashboard' o con 'upload'.
export const canAccess = (user: SessionUser | null | undefined, permission: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (permission === 'admin') return false;
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (permission === 'history') return permissions.includes('dashboard') || permissions.includes('upload');
    return permissions.includes(permission);
};
