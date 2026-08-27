# PWA de Peluquería Marisa

Sube todo el contenido de esta carpeta al repositorio de GitHub. Esta carpeta
ya contiene únicamente la aplicación, sus dependencias de compilación y el
workflow de publicación. No tienes que seleccionar archivos uno por uno.

No se incluyen la base de datos local, `.env`, `.next`, `node_modules` ni la
carpeta `src/app/api`: esa API solo sirve para el HTTPS temporal del PC.

## Publicarla en GitHub Pages

1. Crea un repositorio vacío en GitHub.
2. Sube todos los archivos de esta carpeta, incluido `.github`.
3. En el repositorio, abre **Settings → Pages** y selecciona **GitHub Actions**.
4. Haz un `push` a la rama `main` o `master`.

El workflow calcula automáticamente la URL de GitHub Pages y el QR de
«Instalar app» apuntará a ella.

GitHub Pages necesita servir la aplicación por HTTPS. El QR no debe apuntar a
los enlaces `raw.githubusercontent.com`, porque esos enlaces descargan los
archivos y no ejecutan la aplicación.

La base de datos sigue siendo local en cada navegador. La sincronización entre
PC y móvil se realiza mediante Google Drive cuando se inicia sesión en Drive.
