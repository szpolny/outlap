import { apiResponse } from '#lib/server/api.ts';
import { openapi } from '#lib/server/openapi.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => apiResponse(() => openapi(url.origin));
