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

## Recent Setup Changes (October 2025)

- Created vite.config.ts with proper ES module support
- Set up PostgreSQL database and ran initial migrations
- Created upload/processed directories for file storage
- Configured Tailwind CSS with standard v3.x approach
- Fixed Vite config to work with Replit environment
- Configured deployment settings for production

## User Preferences

None specified yet.
