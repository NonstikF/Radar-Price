// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';

interface Props {
    isAllowed: boolean;
    redirectTo?: string;
    children?: React.ReactNode;
}

export const ProtectedRoute = ({ isAllowed, redirectTo = "/", children }: Props) => {
    if (!isAllowed) {
        return <Navigate to={redirectTo} replace />;
    }
    return children ? <>{children}</> : <Outlet />;
};