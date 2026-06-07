// src/hooks/usePrintLabel.ts
// Impresión de etiquetas ocultando el resto de la app vía @media print.
//
// Historia: react-to-print y el truco del iframe NO funcionan en Chrome
// Android (imprime el documento padre, no el iframe). La forma confiable en
// móvil + desktop es imprimir el documento principal pero esconder todo
// excepto la etiqueta con CSS de impresión.
//
// Flujo:
//   1. Movemos el nodo real de la etiqueta a #rp-print-root (fijo en body).
//   2. Añadimos la clase body.rp-printing.
//   3. El CSS @media print oculta todo menos #rp-print-root.
//   4. window.print() -> solo sale la etiqueta.
//   5. Regresamos el nodo a su lugar original.
//
// Movemos el nodo (no usamos innerHTML) para no romper estilos ni exponernos
// a inyección de HTML.

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

        // Recordar de dónde sacamos el nodo para devolverlo intacto
        const originalParent = node.parentNode;
        const placeholder = document.createComment("rp-label-placeholder");
        if (originalParent) {
            originalParent.insertBefore(placeholder, node);
        }
        root.appendChild(node);

        const prevTitle = document.title;
        document.title = documentTitle || "Etiqueta";
        document.body.classList.add("rp-printing");

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            document.body.classList.remove("rp-printing");
            document.title = prevTitle;
            // Regresar el nodo a su posición original
            if (placeholder.parentNode) {
                placeholder.parentNode.insertBefore(node, placeholder);
                placeholder.parentNode.removeChild(placeholder);
            }
            window.removeEventListener("afterprint", cleanup);
        };

        window.addEventListener("afterprint", cleanup);

        // Esperar render antes de imprimir; respaldo de limpieza para móviles
        setTimeout(() => {
            window.print();
            setTimeout(cleanup, 3000);
        }, 300);
    };

    return handlePrint;
}
