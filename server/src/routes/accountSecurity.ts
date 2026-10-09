import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { authAttemptLimit } from '../middleware/security.js';
import { AUTH_COOKIE_NAME } from '../lib/auth.js';
import type { AppEnv } from '../types/env.js';
import { accountSecurityStatus, requestEmailVerification, confirmEmailVerification, listSessions, deleteSession, logoutAll, listNotifications, readNotification } from '../services/accountSecurityService.js';

export const accountSecurityRouter=new Hono<AppEnv>();
accountSecurityRouter.use('*',requireAuth);
accountSecurityRouter.use('*',bodyLimit({maxSize:16384,onError:c=>c.json({error:'送信データが大きすぎます'},413)}));
accountSecurityRouter.use('*',authAttemptLimit);
accountSecurityRouter.get('/status',async c=>c.json(await accountSecurityStatus(c.env,c.get('userId'))));
accountSecurityRouter.post('/verify-email/request',async c=>c.json(await requestEmailVerification(c.env,c.get('userId'))));
accountSecurityRouter.post('/verify-email/confirm',async c=>{
  const {token}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).parse(await c.req.json());
  return c.json(await confirmEmailVerification(c.env.DB,c.get('userId'),token));
});
accountSecurityRouter.get('/sessions',async c=>c.json(await listSessions(c.env.DB,c.get('userId'),getCookie(c,AUTH_COOKIE_NAME)!)));
accountSecurityRouter.delete('/sessions/:id',async c=>c.json(await deleteSession(c.env.DB,c.get('userId'),c.req.param('id'))));
accountSecurityRouter.post('/logout-all',async c=>{
  const {password,code}=z.object({password:z.string().min(1).max(200),code:z.string().max(100).optional()}).parse(await c.req.json());
  const result=await logoutAll(c.env.DB,c.get('userId'),password,code);
  deleteCookie(c,AUTH_COOKIE_NAME,{path:'/'});return c.json(result);
});
accountSecurityRouter.get('/notifications',async c=>c.json(await listNotifications(c.env.DB,c.get('userId'))));
accountSecurityRouter.post('/notifications/:id/read',async c=>c.json(await readNotification(c.env.DB,c.get('userId'),c.req.param('id'))));
