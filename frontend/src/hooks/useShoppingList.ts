import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

export function useShoppingList() {
    const [adding, setAdding] = useState(false);

    const addToList = async (productId: number, quantity: number = 1) => {
        setAdding(true);
        try {
            const res = await axios.post(`${API_URL}/shopping-lists/add-item`, {
                product_id: productId,
                quantity,
            });
            return res.data as { message: string; list_id: number; supplier_name: string };
        } finally {
            setAdding(false);
        }
    };

    return { addToList, adding };
}
