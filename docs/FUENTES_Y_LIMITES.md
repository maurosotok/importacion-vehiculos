# Fuentes y límites - versión 2

## Fuentes privadas del usuario
`fuentes_privadas/Carros.xlsx`: fórmulas, encabezados, catálogo Grúas, proveedores y caso 104.
No se modifica ni migra historial. `Bank Statement` queda fuera del alcance.

`fuentes_privadas/transcripcion_video.txt`: flujo de trabajo y motivaciones. El texto contiene
errores de transcripcion; el Excel y la última instruccion prevalecen cuando discrepan.

`fuentes_privadas/gruas_north_atlantic.pdf`: precios por rutas, excepciones y notas del proveedor.
`fuentes_privadas/embarques_honduras_2025.pdf`: 30 importes, cuatro puertos/zona, referencia 2025.
Las condiciones de tamaño se conservan, pero el usuario opta por estimar por tipo sin bloqueos.
El video original no se duplica en este ZIP por su peso; la transcripcion está incluida y el
archivo original sigue disponible en la conversacion. No necesita subirse a Git ni a producción.

## Fuentes oficiales consultadas para perfiles, no importes completos
Consulta: 19-10-2026. Se verificaron familias/denominaciones; este paquete NO aporta una tabla
monetaria completa de IAA/Copart. Los enlaces se deben usar al implementar el Prompt 2.

- https://www.iaai.com/marketing/buyer-fees
- https://www.iaai.com/marketing/standard-iaa-licensed-buyer-fees
- https://www.iaai.com/marketing/standard-iaa-non-licensed-buyer-fees
- https://www.iaai.com/marketing/standard-iaa-heavy-vehicle-buyer-fees
- https://www.iaai.com/marketing/standard-iaa-rec-rides-buyer-fees
- https://www.copart.com/content/us/en/member-fees-us-non-licensed
- https://www.copart.com/content/us/en/member-fees-us-licensed-less
- https://www.copart.com/content/us/en/member-fees-us-licensed-more

IAA: Standard/High Volume en licensed, non-licensed y segmentos Heavy/Rec Rides según sus
fuentes. No inventar High Volume Rec Rides si la fuente no lo ofrece. Copart separa Standard y
Preferred Pricing, título y otras opciones. No confundir Basic/Premier de membresia con una
versión de tabla de tarifas. No usar IAA Canada para una compra en Estados Unidos.

Las páginas pueden cargar tablas por pestañas/imagenes. El texto parseado de Copart puede
mostrar tablas con encabezados repetidos: identificar segmento/título/método antes de importar.
IAA no devolvio los tramos completos en la lectura disponible. Un fallback manual es obligatorio;
no es correcto rellenar huecos a partir de calculadoras de terceros o del caso histórico.

## Fuentes tecnicas para el despliegue y funcionamiento
- https://code.claude.com/docs/en/setup
- https://code.claude.com/docs/en/memory
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/deployment/managing-environments
- https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
- https://vpic.nhtsa.dot.gov/api/

Usar las versiones y sintaxis oficiales vigentes al implementar. La guia de Supabase describe
multiples entornos como ejemplo; este proyecto adapta el flujo a una única producción y pruebas
efímeras. No copiar staging/develop como requisitos del usuario.

## SARAH: solo enlace de consulta manual
https://sistemas.aduanas.gob.hn/SarahWeb/#/plataforma/informacion/calculadora_vehicular

No se investigo nuevamente ni se incorpora un algoritmo en v2. No se adjuntan los scripts
fiscales experimentales de v1. El importe de pago único y la referencia de gastos locales son
datos del usuario, no una verificación de reglas legales ni de elegibilidad.

## Qué está listo y qué falta
Listo: instrucciones v2, mapa del Excel, catálogos estructurados de referencia, opciones de
perfiles, caso original/corregido y pruebas del paquete. No listo: la aplicación, base alojada,
CI real, carga completa de tramos IAA/Copart y validación de tarifas actuales del proveedor.
Estos últimos son trabajo de implementación de los cuatro prompts, no resultados ya ejecutados.
