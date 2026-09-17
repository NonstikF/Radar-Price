import { useState, useEffect } from 'react';

// Definimos los tipos permitidos, incluyendo 'custom'
export type LabelSize = '1.5x1' | '2x1' | '2.25x1.25' | '50x25mm' | 'custom';

// De dónde sale el valor del código de barras.
// 'upc_if_available' usa el UPC del producto y, si no tiene, cae al SKU (ID interno).
export type BarcodeSource = 'upc_if_available' | 'always_upc' | 'always_sku';

export interface LabelSettings {
    size: LabelSize;
    showPrice: boolean;
    showSku: boolean;
    showDate: boolean;
    showName: boolean;
    boldPrice: boolean;
    fontSize: 'small' | 'normal' | 'large';
    companyName?: string;
    nameSource?: string;

    // CÓDIGO DE BARRAS
    showBarcode: boolean;
    barcodeSource?: BarcodeSource;

    // CAMPOS NUEVOS PARA MEDIDA PERSONALIZADA
    customWidth?: string;
    customHeight?: string;
}

const DEFAULT_SETTINGS: LabelSettings = {
    size: '2.25x1.25',
    showPrice: true,
    showSku: true,
    showDate: true,
    showName: true,
    boldPrice: true,
    fontSize: 'normal',
    companyName: '',
    nameSource: 'alias_if_available',

    showBarcode: true,
    barcodeSource: 'upc_if_available',

    // Valores por defecto
    customWidth: '2in',
    customHeight: '1in'
};

// Usamos una clave nueva (v3) para evitar conflictos con configuraciones viejas
const STORAGE_KEY = 'radar_label_settings_v3';

function readStored(): LabelSettings {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
        console.error("Error cargando settings", e);
    }
    return DEFAULT_SETTINGS;
}

// Los ajustes viven fuera de los componentes porque varios usan el hook a la vez:
// el modal que los edita no es el mismo que imprime la etiqueta, y con un estado
// por instancia el que imprimía se quedaba con la copia vieja hasta recargar.
let sharedSettings: LabelSettings = readStored();
const listeners = new Set<(s: LabelSettings) => void>();

export function useLabelSettings() {
    const [settings, setSettings] = useState<LabelSettings>(sharedSettings);

    useEffect(() => {
        // Alinearse por si otra instancia guardó algo entre el render y el efecto.
        setSettings(sharedSettings);
        listeners.add(setSettings);
        return () => {
            listeners.delete(setSettings);
        };
    }, []);

    const updateSettings = (newSettings: Partial<LabelSettings>) => {
        sharedSettings = { ...sharedSettings, ...newSettings };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedSettings));
        } catch (e) {
            console.error("Error guardando settings", e);
        }
        listeners.forEach(fn => fn(sharedSettings));
    };

    return { settings, updateSettings };
}