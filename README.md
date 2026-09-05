# Trackrr

A modern, responsive freelance and video production tracker & billing management application built with React 19, TypeScript, Material UI, and Vite.

## Features

- **Workspace Management**: Multi-workspace support for managing multiple brands or client categories.
- **Task & Video Tracking**: Direct tracking of videos, projects, prices, and completion dates.
- **Client & Retainer Billing**: Flexible billing for both per-video rates and monthly retainer agreements.
- **Invoicing & Work Reports**: Instant print/PDF bills, CSV download, and WhatsApp report generator.
- **Financial Analytics**: Revenue breakdowns, client-by-client distribution, and payment timeline charts.
- **Authentication & Cloud Ready**: Supabase integration supporting Email/Password and Google OAuth with Row Level Security (RLS).
- **Offline First**: Works fully offline out of the box using local storage persistence with seamless cloud upgrade.

## Quick Start

### Option 1: Direct Double-Click (Windows)
Double-click **	est_launch.bat** to automatically install dependencies and launch the dev server.

### Option 2: Command Line
`ash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
`

## Supabase & Google Login Setup

1. Copy .env.example to .env:
   `ash
   cp .env.example .env
   `
2. Enter your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings (Project Settings -> API).
3. Run the SQL schema in supabase_schema.sql in your Supabase SQL Editor to provision tables and RLS security policies.
4. Enable Google OAuth under Authentication -> Providers -> Google in your Supabase dashboard using credentials from Google Cloud Console.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI Framework**: Material UI (MUI v7), Emotion
- **Charts**: Recharts
- **Date Utilities**: date-fns
- **Backend / Auth**: Supabase (@supabase/supabase-js)
