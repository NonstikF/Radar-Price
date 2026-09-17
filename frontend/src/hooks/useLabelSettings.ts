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

export function useLabelSettings() {
    // Usamos una clave nueva (v3) para evitar conflictos con configuraciones viejas
    const [settings, setSettings] = useState<LabelSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        const saved = localStorage.getItem('radar_label_settings_v3');
        if (saved) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Error cargando settings", e);
            }
        }
    }, []);

    const updateSettings = (newSettings: Partial<LabelSettings>) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('radar_label_settings_v3', JSON.stringify(updated));
    };

    return { settings, updateSettings };
}