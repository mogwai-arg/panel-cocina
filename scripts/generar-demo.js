// Genera imágenes SVG de ejemplo en web/demo/ para probar el slideshow sin Drive.
// Uso: npm run demo
const fs = require('node:fs');
const path = require('node:path');

const destino = path.join(__dirname, '..', 'web', 'demo');
fs.mkdirSync(destino, { recursive: true });

// [nombre, ancho, alto, cielo arriba, cielo abajo, suelo, rótulo]
const fotos = [
  ['playa', 1600, 1200, '#f6c08a', '#e47f62', '#2c3254', 'Horizontal 4:3'],
  ['montana', 1920, 1080, '#a9c3dc', '#6f8db0', '#3e5a43', 'Horizontal 16:9'],
  ['cumple-1', 1080, 1920, '#f3d9c4', '#e0a98a', '#7b4a3a', 'Vertical 9:16'],
  ['cumple-2', 1080, 1920, '#d9d4ec', '#9c92c7', '#463d6b', 'Vertical 9:16'],
  ['cumple-3', 1080, 1920, '#cfe0d4', '#8db59a', '#2f5a3e', 'Vertical 9:16'],
  ['plaza-1', 1200, 1600, '#bcd6e8', '#8fb3cf', '#c8ae7d', 'Vertical 3:4'],
  ['plaza-2', 1200, 1600, '#e9e3d6', '#d7cbb4', '#7b6246', 'Vertical 3:4'],
  ['perro', 1200, 1600, '#f1e4c2', '#d9b871', '#5c4a2a', 'Vertical 3:4'],
  ['asado', 1200, 1200, '#f4d3a1', '#e8a15c', '#6b3b22', 'Cuadrada 1:1'],
  ['glaciar', 3600, 1200, '#dfe9f2', '#9cb6cf', '#e9eef2', 'Panorámica 3:1'],
  ['lago', 1600, 1200, '#9fb3c8', '#6f8aa6', '#26303f', 'Horizontal 4:3'],
  ['primer-dia', 1200, 1600, '#fbe3e8', '#e8a3b4', '#5b2c3a', 'Vertical 3:4'],
];

for (const [nombre, w, h, c1, c2, suelo, rotulo] of fotos) {
  const fs1 = Math.round(Math.min(w, h) / 9);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.72}" cy="${h * 0.28}" r="${Math.min(w, h) * 0.07}" fill="#fff" opacity=".7"/>
  <ellipse cx="${w * 0.3}" cy="${h}" rx="${w * 0.6}" ry="${h * 0.32}" fill="${suelo}"/>
  <ellipse cx="${w * 0.85}" cy="${h}" rx="${w * 0.45}" ry="${h * 0.22}" fill="${suelo}" opacity=".8"/>
  <text x="50%" y="46%" text-anchor="middle" font-family="sans-serif" font-weight="700"
    font-size="${fs1}" fill="#fff" opacity=".85">${rotulo}</text>
  <text x="50%" y="${46 + 1.6 * (fs1 / h) * 100}%" text-anchor="middle" font-family="sans-serif"
    font-size="${Math.round(fs1 * 0.5)}" fill="#fff" opacity=".75">${nombre}</text>
</svg>`;
  fs.writeFileSync(path.join(destino, nombre + '.svg'), svg);
}
console.log('Generadas', fotos.length, 'imágenes en', destino);
