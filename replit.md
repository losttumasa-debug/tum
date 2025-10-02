# MCR File Humanizer

## Project Overview

This is an MCR (Macro) File Humanizer application that allows users to upload, process, and optimize MCR files used in 3D Studio Max. The application provides tools for analyzing, cleaning, and humanizing macro commands to make them appear more natural.

## Architecture

- **Framework**: React + TypeScript (Frontend), Express.js (Backend)
- **Database**: PostgreSQL (via Replit Database)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **Real-time Updates**: WebSocket connection for live file processing updates

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities
│   └── index.html
├── server/                 # Backend Express server
│   ├── services/          # Business logic (MCR processing)
│   ├── db.ts              # Database connection
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database operations
│   └── index.ts           # Server entry point
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema and types
├── uploads/               # Uploaded MCR files storage
└── processed/             # Processed files storage

## Key Features

1. **File Upload**: Upload MCR files with configurable humanization settings
2. **File Management**: View, download, and delete uploaded files
3. **Processing Queue**: Background processing with progress tracking
4. **Keyboard Editor**: Visual editor for MCR keyboard commands
5. **File Operations**:
   - Calculate and display MCR file duration
   - Lengthen files to target duration
   - Clean up mouse commands and zero delays
   - Merge and optimize two files
6. **Real-time Updates**: WebSocket connection for live status updates

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users`: User authentication (optional, not currently used)
- `mcr_files`: Uploaded MCR files with metadata
- `processing_queue`: File processing queue
- `images`: Associated images for MCR files (future feature)

## Development

The application runs on port 5000 with:
- Frontend: Vite dev server (HMR enabled)
- Backend: Express server with WebSocket support
- Database: PostgreSQL connection via DATABASE_URL

### Running Locally

The workflow is already configured to run `npm run dev` which starts both the frontend and backend on port 5000.

### Database Migrations

To update the database schema:
```bash
npm run db:push
```

If you encounter data-loss warnings:
```bash
npm run db:push --force
```

## Deployment

The application is configured for Replit Autoscale deployment:
- Build command: `npm run build`
- Run command: `node dist/index.js`
- Port: 5000 (configured in server/index.ts)

## Advanced Features (October 2025)

### 🚀 **Sistema de Colas con BullMQ**
- Procesamiento paralelo de múltiples archivos MCR
- 3 workers concurrentes para máximo rendimiento
- Sistema de reintentos automáticos en caso de errores
- Monitoreo de estado de cola en tiempo real

### 🧠 **Minería Inteligente de Patrones**
- Análisis de N archivos simultáneamente (3, 5, 10+)
- Detección automática de secuencias comunes
- Almacenamiento de patrones con metadata y confianza
- Sistema de scoring para seleccionar los mejores patrones

### 📊 **Análisis de Transiciones (Markov)**
- Cálculo de probabilidades de transición entre comandos
- Predicción del próximo comando más probable
- Identificación de "hotspots" (secuencias más comunes)

### 🎭 **Perfiles de Humanización**
- 5 perfiles predefinidos: Novice, Average, Expert, Cautious, Power User
- Cada perfil con características únicas de velocidad y precisión
- Sistema configurable para crear perfiles personalizados
- Aplicación automática de perfiles en batch processing

### 🖼️ **Análisis de Imágenes con OCR**
- Extracción de texto con Tesseract.js
- Detección automática de elementos UI (botones, campos, menús)
- Generación inteligente de MCR desde screenshots
- Integración con patrones aprendidos para mejor calidad

### ⚡ **Sistema de Caché con Redis**
- Caché de comandos parseados por hash de archivo
- Caché de análisis de patrones
- Caché de resultados de análisis de imágenes
- Invalidación inteligente de caché

### 📦 **Batch Processing**
- Procesamiento masivo de archivos con un solo click
- Aprendizaje automático de patrones durante el proceso
- Aplicación de perfiles a múltiples archivos
- Monitoreo de progreso en tiempo real

### 📈 **Métricas y Estadísticas**
- Estadísticas completas del sistema
- Conteo de patrones y perfiles
- Estado de la cola de procesamiento
- Métricas de éxito por patrón

## New API Endpoints

### Patterns
- `GET /api/patterns` - Obtener todos los patrones
- `POST /api/patterns/mine` - Minar patrones de múltiples archivos
- `POST /api/patterns/by-files` - Obtener patrones por IDs de archivo
- `POST /api/patterns/transitions` - Analizar transiciones Markov
- `DELETE /api/patterns/:id` - Eliminar patrón

### Profiles
- `GET /api/profiles` - Listar perfiles de humanización
- `GET /api/profiles/default` - Obtener perfil por defecto
- `GET /api/profiles/:id` - Obtener perfil específico
- `POST /api/profiles` - Crear nuevo perfil
- `PUT /api/profiles/:id` - Actualizar perfil
- `DELETE /api/profiles/:id` - Eliminar perfil

### Images
- `POST /api/images/upload` - Subir imagen
- `POST /api/images/:id/analyze` - Analizar imagen con OCR
- `GET /api/images/:id/analysis` - Obtener resultados del análisis
- `POST /api/images/:id/generate-mcr` - Generar MCR desde imagen

### Batch Processing
- `POST /api/batch/process` - Procesar múltiples archivos
- `GET /api/queue/status` - Estado de la cola
- `POST /api/queue/pause` - Pausar cola
- `POST /api/queue/resume` - Reanudar cola
- `POST /api/queue/clear` - Limpiar trabajos completados

## Technology Stack

### Backend Services
- **BullMQ**: Sistema de colas de trabajos
- **Redis**: Caché y almacenamiento de sesiones
- **Tesseract.js**: OCR para análisis de imágenes
- **Sharp**: Procesamiento y optimización de imágenes
- **ml-kmeans**: Clustering para análisis de patrones

### Database Extensions
- Tabla `patterns`: Patrones aprendidos con metadata
- Tabla `humanization_profiles`: Perfiles configurables
- Tabla `image_analysis`: Resultados de análisis OCR/CV
- Tabla `pattern_usage`: Métricas de uso de patrones

## Recent Setup Changes (October 2025)

- Created vite.config.ts with proper ES module support
- Set up PostgreSQL database and ran initial migrations
- Created upload/processed directories for file storage
- Configured Tailwind CSS with standard v3.x approach
- Fixed Vite config to work with Replit environment
- Configured deployment settings for production
- **NEW**: Implementado sistema completo de AI/ML para humanización inteligente
- **NEW**: Sistema de colas BullMQ con 3 workers concurrentes
- **NEW**: Caché Redis para optimización de rendimiento
- **NEW**: 5 servicios nuevos: cache, queue, pattern, image analysis, profile
- **NEW**: 20+ nuevos endpoints API para funcionalidades avanzadas

## User Preferences

None specified yet.
