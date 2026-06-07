// src/hooks/usePrintLabel.ts
// Impresión de etiquetas ocultando el resto de la app vía @media print.
//
// Historia:
//   - react-to-print y el truco del iframe NO funcionan en Chrome Android
//     (imprime el documento padre, no el contenido aislado).
//   - Tampoco sirve mover el nodo y limpiarlo en "afterprint": en móvil
//     window.print() NO bloquea y "afterprint" se dispara de inmediato, así
//     que limpiábamos antes de que Android capturara la página -> salía la app.
//
// Solución confiable (desktop + móvil):
//   1. CLONAMOS la etiqueta dentro de #rp-print-root (fijo en body).
//      Clonar (no mover) evita romper el árbol de React.
//   2. Añadimos la clase body.rp-printing.
//   3. El CSS @media print oculta todo menos #rp-print-root.
//   4. window.print() -> solo sale la etiqueta.
//   5. NO limpiamos por tiempo/afterprint: el clon queda oculto en pantalla
//      (display:none) y la clase solo afecta a la impresión. En la siguiente
//      impresión se reemplaza el clon. Así no dependemos de ningún timing.

const PRINT_STYLE_ID = "rp-print-style";
const PRINT_ROOT_ID = "rp-print-root";

function ensurePrintStyles() {
    if (document.getElementById(PRINT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.textContent = `
        #${PRINT_ROOT_ID} { display: none; }
        @media print {
            body.rp-printing > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
            body.rp-printing #${PRINT_ROOT_ID} {
                display: block !important;
                position: absolute;
                top: 0;
                left: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

export function usePrintLabel(contentRef: any, documentTitle: string) {
    const handlePrint = () => {
        const node: HTMLElement | null = contentRef?.current;
        if (!node) {
            console.error("usePrintLabel: contentRef vacío");
            return;
        }

        ensurePrintStyles();

        let root = document.getElementById(PRINT_ROOT_ID);
        if (!root) {
            root = document.createElement("div");
            root.id = PRINT_ROOT_ID;
            document.body.appendChild(root);
        }

        // Reemplazar contenido previo con un CLON de la etiqueta actual
        while (root.firstChild) root.removeChild(root.firstChild);
        root.appendChild(node.cloneNode(true));

        document.title = documentTitle || "Etiqueta";
        document.body.classList.add("rp-printing");

        // Esperar a que el clon renderice estilos antes de imprimir
        setTimeout(() => {
            window.print();
        }, 300);
    };

    return handlePrint;
}
