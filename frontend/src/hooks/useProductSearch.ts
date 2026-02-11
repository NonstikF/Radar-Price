import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { DEBOUNCE_DELAY, PRODUCTS_LIMIT } from '../config/constants';

export function useProductSearch(initialFilter = false) {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [filters, setFilters] = useState({
        minPrice: "",
        maxPrice: "",
        missingPrice: initialFilter,
        sortBy: "updated_at",
        sortOrder: "desc"
    });

    // Renombrado para ser descriptivo
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        searchDebounceRef.current = setTimeout(() => {
            fetchProducts();
        }, DEBOUNCE_DELAY);

        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [searchTerm, filters]);

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const params: any = {
                q: searchTerm,
                missing_price: filters.missingPrice,
                sort_by: filters.sortBy,
                sort_order: filters.sortOrder,
                limit: PRODUCTS_LIMIT // Uso de constante
            };
            if (filters.minPrice) params.min_price = filters.minPrice;
            if (filters.maxPrice) params.max_price = filters.maxPrice;

            const response = await axios.get(`${API_URL}/invoices/products`, { params });
            setProducts(response.data);
        } catch (err: any) {
            console.error("Error fetching products:", err);
            setError(err.response?.data?.detail || "Error al cargar productos");
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm("");
        setFilters({
            minPrice: "",
            maxPrice: "",
            missingPrice: false,
            sortBy: "updated_at",
            sortOrder: "desc"
        });
    };

    return {
        products,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        filters,
        setFilters,
        clearFilters,
        refreshProducts: fetchProducts,
        setProducts // Exportamos por si necesitamos actualizar manualmente tras editar
    };
}