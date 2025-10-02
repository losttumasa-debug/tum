# Proyecto MCR - Gestión y Optimización de Archivos MCR

## Descripción

Este proyecto tiene como objetivo mejorar la gestión, manipulación y optimización de archivos MCR, facilitando la edición, limpieza, comparación y visualización de comandos en dichos archivos. Está diseñado para ejecutarse y desarrollarse eficientemente en **Replit Starter**, aprovechando sus capacidades y respetando sus limitaciones de recursos y tiempo de ejecución.

---

## ⚡ Recomendaciones para usar en Replit Starter

- **Trabaja en fases:** Ejecuta y prueba cada fase/funcionalidad de forma independiente.
- **Procesa archivos de uno en uno:** Evita procesar grandes lotes o realizar tareas pesadas en simultáneo.
- **Evita dejar servidores corriendo:** Detén el repl al terminar cada prueba para ahorrar tus horas de ejecución mensuales.
- **Descarga y respalda archivos importantes:** Guarda localmente o sube a GitHub los archivos generados, ya que los repls pueden reiniciarse.
- **Haz commits frecuentes:** Así no pierdes avances.
- **Para procesamiento de imágenes:** Usa muestras pequeñas y pocas imágenes por vez.
- **Si llegas al límite de recursos:** Considera optimizar el código o migrar a un plan superior.

---

## Fases del Proyecto

### 1. Herramientas de Análisis y Limpieza ✅
- Calcular y visualizar la duración total de archivos MCR.
- Alargar archivos a una duración objetivo, repitiendo y humanizando el contenido.
- Eliminar comandos de mouse y/o delays de 0 ms.
- Opción automática para limpiar comandos al subir archivos.

### 2. Comparación y Optimización Inteligente ✅ (con limitación de tiempo real)
- Comparar dos archivos y fusionar los patrones comunes, humanizando delays.
- Generar un archivo MCR optimizado a partir de dos seleccionados.
- **Limitación actual:** La lista de archivos no se actualiza en tiempo real tras "Optimize & Merge" (requiere recarga manual por un problema de WebSocket).

### 3. Editor de Teclado Visual 🚧 (En progreso)
- Interfaz gráfica que representa un teclado para editar comandos de un MCR de forma visual.
- Permite agregar, quitar o marcar teclas para ignorar.
- **Problema actual:** Error `isCommandEqual is not defined` al humanizar archivos.

### 4. Optimización Basada en Imágenes 🌱 (Visión a largo plazo)
- Utilizar imágenes de referencia para optimizar rutas de mouse y acciones.
- Requiere procesamiento ligero de imágenes si se prueba en Replit Starter.

---

## Cómo ejecutar en Replit Starter

1. **Abre el proyecto en Replit.**
2. Ejecuta la fase o script que desees probar.  
   - Por ejemplo: análisis de duración, limpieza, comparación, etc.
3. Sube o descarga archivos MCR según sea necesario.
4. Detén el repl después de cada sesión para ahorrar recursos.
5. Haz commits frecuentes a este repositorio para respaldar tu avance.
6. Si pruebas la fase de imágenes, usa archivos pequeños y pocas pruebas por sesión.

---

## Recursos y Dependencias

- **Lenguajes principales:** MAXScript, TypeScript, JavaScript, HTML, CSS.
- **Librerías:** Solo instala las necesarias para la funcionalidad que estés probando.
- **No se usan dependencias pesadas** (como OpenCV) por defecto; si llegas a necesitarlas, hazlo en pruebas controladas.

---

## Contribuciones y Mejoras

- Si encuentras un error o limitación, documenta el problema en la sección de Issues.
- Sugiére mejoras basadas en la experiencia de uso en Replit Starter.
- Para tareas pesadas, considera migrar a un entorno con más recursos.

---

## Estado Actual

Consulta el archivo `resumen_proyecto_mcr.txt` para ver el estado y progreso detallado de cada fase.

---

**¡Este proyecto está optimizado para Replit Starter! Sigue las recomendaciones y podrás desarrollarlo dentro de sus capacidades.**
