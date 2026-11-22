import { apiResponse, listSeries } from '#lib/server/api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => apiResponse(() => ({ series: listSeries() }));
