# Extractor de remisiones

App que extrae datos de remisiones (foto o PDF) usando Gemini y los guarda en Google Sheets.

## 1. Crear la hoja de Google Sheets

1. Crea una hoja de Google Sheets nueva (vacía), llámala como quieras (ej. "Remisiones extractor").
2. Ve a Extensiones > Apps Script.
3. Borra el contenido de "Code.gs" y pega el contenido del archivo `extractor-remisiones-Code.gs` que te entregué aparte.
4. Haz clic en "Implementar" > "Nueva implementación".
5. Tipo de implementación: "Aplicación web".
6. Ejecutar como: "Yo".
7. Quién tiene acceso: "Cualquier usuario".
8. Haz clic en "Implementar", autoriza los permisos que te pida.
9. Copia la URL que termina en `/exec`. Esa es tu `APPS_SCRIPT_URL`.

Las 4 pestañas (CAME MAQUILA, CAME INTERNO, SMURFIT MAQUILA, SMURFIT INTERNO) se crean automáticamente la primera vez que llega un dato de ese tipo, con los encabezados correctos.

## 2. Configurar la URL de Apps Script en el código

Abre `app.js` y reemplaza esta línea:

```
const APPS_SCRIPT_URL = "PEGA_AQUI_TU_URL_DE_APPS_SCRIPT";
```

por tu URL real, antes de subir el archivo a GitHub.

## 3. Subir el proyecto a GitHub

1. Crea un repositorio nuevo llamado `extractor-remisiones`.
2. Sube todos los archivos de esta carpeta (incluida la carpeta `api/` con `extract.js` dentro) usando "Add file" > "Upload files", manteniendo la misma estructura de carpetas.

## 4. Desplegar en Vercel

1. En Vercel, "Add New" > "Project" > importa el repo `extractor-remisiones`.
2. Antes de hacer deploy, en "Environment Variables" agrega:
   - Nombre: `GEMINI_API_KEY`
   - Valor: tu clave de Gemini (la que generaste en aistudio.google.com)
3. Haz clic en "Deploy".

## 5. Probar

Abre la URL que te da Vercel desde tu celular, elige un tipo de documento, sube una foto o PDF, revisa los datos extraídos y guarda. Verifica que aparezcan en la pestaña correspondiente de tu Google Sheet.

## Notas

- Las fotos se comprimen automáticamente antes de enviarse para no exceder los límites de tamaño.
- Los PDF muy pesados (más de ~7MB) pueden fallar; si pasa, intenta con menos páginas o una resolución menor.
- Si cambias el nombre o el orden de las columnas, edítalas en 3 lugares para que coincidan: `app.js` (COLUMNS), `api/extract.js` (dentro de cada prompt) y `extractor-remisiones-Code.gs` (HEADERS).
