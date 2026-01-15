import xml.etree.ElementTree as ET
from typing import List, Dict, Any

class XmlInvoiceParser:
    async def extract_data(self, file_content: bytes, db=None) -> List[Dict[str, Any]]:
        print("--- LEYENDO XML CON DESGLOSE DE IMPUESTOS ---")
        
        try:
            tree = ET.ElementTree(ET.fromstring(file_content.decode('utf-8')))
            root = tree.getroot()
            
            # Namespaces obligatorios del SAT
            ns = {'cfdi': 'http://www.sat.gob.mx/cfd/4'}

            items = []
            conceptos = root.findall('.//cfdi:Concepto', ns)

            for c in conceptos:
                # 1. Datos Básicos
                descripcion = c.get('Descripcion', 'Sin descripción')
                cantidad = float(c.get('Cantidad', 0))
                valor_unitario = float(c.get('ValorUnitario', 0.0)) # Precio Sin IVA
                importe_subtotal = float(c.get('Importe', 0.0))     # Cantidad * ValorUnitario

                # 2. Buscar Impuestos (IVA)
                # Entramos a: Concepto -> Impuestos -> Traslados -> Traslado
                iva_total = 0.0
                
                impuestos = c.find('cfdi:Impuestos', ns)
                if impuestos:
                    traslados = impuestos.find('cfdi:Traslados', ns)
                    if traslados:
                        for t in traslados.findall('cfdi:Traslado', ns):
                            # Verificamos que sea IVA (002)
                            if t.get('Impuesto') == '002':
                                iva_total += float(t.get('Importe', 0.0))

                # 3. Cálculos Finales
                precio_total_linea = importe_subtotal + iva_total
                
                # Precio Unitario con IVA = Total de la línea / Cantidad
                precio_unitario_con_iva = 0.0
                if cantidad > 0:
                    precio_unitario_con_iva = precio_total_linea / cantidad

                # 4. SKU (Misma lógica anterior)
                sku = c.get('NoIdentificacion')
                if not sku:
                    sku = c.get('ClaveProdServ', 'GENERICO')

                items.append({
                    "sku": sku,
                    "name": descripcion,
                    "quantity": int(cantidad),
                    "unit_price_no_tax": valor_unitario,      # Precio Sin IVA
                    "unit_price_with_tax": precio_unitario_con_iva, # Precio Con IVA
                    "total_line": precio_total_linea          # Total (Con todo)
                })

            print(f"Productos procesados: {len(items)}")
            return items

        except Exception as e:
            print(f"Error leyendo XML: {e}")
            raise ValueError("Error al leer estructura del XML")