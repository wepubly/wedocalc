import type { Snapshot } from "../src/editorial-types";
export type { Snapshot };
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  PUBLIC_ORIGIN: string;
  SETUP_TOKEN?: string;
  MEMBER_AUTH_SECRET?: string;
  MEMBER_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  MEMBER_TEST_MODE?: string;
}
export interface Article {
  id: string;
  draft_version: number;
  published_version: number | null;
  published_slug: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const now = () => new Date().toISOString();
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
