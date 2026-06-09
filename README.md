# 🎮 Game Pass Explorer

Visualizador web de los juegos disponibles en **Xbox Game Pass**, organizados por tiers con filtros, ordenación y detalles completos.

## Características

- **4 tiers**: Essential, Premium, Ultimate y PC Game Pass
- **Filtros por plataforma**: Todas, Consola, PC, Ambas
- **Filtros por categoría**: Acción, Aventura, Deportes, etc.
- **Ordenación**: Alfabética, mejor valorados, más votados, más recientes, precio
- **Filtro de descuentos**: Muestra solo juegos con precio rebajado
- **Filtro exclusivos**: Juegos que no están en tiers inferiores
- **Detalle completo**: Video, screenshots, requisitos del sistema, clasificación por edades, tamaño de instalación
- **Diseño responsive**: Funciona en móvil, tablet y escritorio

## Datos

Se obtienen automáticamente de las APIs de Microsoft:
- **Emerald API**: Catálogo completo con metadatos, precios y valoraciones
- **Display Catalog API**: Videos en formato HLS

Los datos se actualizan automáticamente cada día a las 8:00 UTC mediante GitHub Actions.

## Tecnologías

- HTML5, CSS3, JavaScript vanilla
- hls.js para reproducción de video
- GitHub Actions para actualización automática
- GitHub Pages para hosting

## Desarrollo local

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080` en el navegador.

## Actualización de datos

```bash
node fetch-data.js
```

Genera `data/games.json` con los datos actualizados de Microsoft.

## Licencia

MIT
