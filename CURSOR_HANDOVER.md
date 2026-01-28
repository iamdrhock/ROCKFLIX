# Project Status & Handover Instructions for Cursor

**Date**: 2026-01-27
**Topic**: Data Loss Recovery & Server State

## 🚨 Critical Context: Data Recovery Event
*   **Issue**: The project recently experienced a data loss (server usage dropped from 10GB to 2GB).
*   **Cause**: Large media files were removed from the Git history to reduce repository size. When the server pulled these changes, Git deleted the local copies of the files matching the new history.
*   **Resolution**: The `public/uploads` directory (containing ~6,831 media files) has been **successfully restored** from commit `9ea0fbf`.

## ✅ Current State
1.  **Media Files**: Restored to `c:\ROCKFLIX\public\uploads`.
2.  **Git Safety**: `/public/uploads` has been added to `.gitignore`. **DO NOT REMOVE THIS**. It prevents Git from tracking (and subsequently deleting) these large files again.
3.  **Codebase**: The current HEAD is on the main branch (or a recent commit), but the `public/uploads` folder is a "ghost" resource—it exists locally but is ignored by git. This is the desired state for 10GB of data.

## 🛡️ Prevention: Avoid Wiping `public/uploads` Again
1.  **Keep uploads out of git**: Ensure `/public/uploads` stays in `.gitignore`.
2.  **Never rewrite history that removes uploads**: Avoid force-pushes or deploying commits that excluded large media files.
3.  **Protect deploys**: Before pulling new code on the server, verify `public/uploads` exists and has expected size/file count.
4.  **Independent backups**: Keep RunCloud backups or a separate rsync snapshot of `public/uploads`.

## ⚠️ Outstanding Issues / Next Steps
The repository is **missing `docker-compose.yml`**.
*   It was NOT present in the "last working" commit (`9ea0fbf`) either.
*   **Immediate Action Required**: You need to recreate `docker-compose.yml` for this Next.js + PostgreSQL application.

### Recommended `docker-compose.yml` structure (Suggestion):
You will likely need a service for the database (Postgres) and potentially one for the app if running via Docker.
*   **Database**: Postgres (ensure volumes are mapped to persist data!).
*   **App**: Node/Next.js (ensure `.env` is loaded).

## Environment Details
*   **Tech Stack**: Next.js, TypeScript, PostgreSQL (using `@neondatabase/serverless` and `@auth/pg-adapter`), Tailwind CSS.
*   **Authentication**: NextAuth.js.
*   **Deployment**: Previously deployed via runcloud/SSH.

**Instructions for Cursor**:
1.  Verify `docker-compose.yml` creation.
2.  Ensure `DATABASE_URL` in `.env` matches the new container configuration (or external DB).
3.  **Do not** commit the contents of `public/uploads` to git.
