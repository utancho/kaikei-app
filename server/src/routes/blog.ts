import { Hono } from "hono";
import { z } from "zod";
import { getPublishedBlogPost, listPublishedBlogPosts } from "../services/blogService.js";
import type { AppEnv } from "../types/env.js";

export const blogRouter = new Hono<AppEnv>();

const listQuerySchema = z.object({
  query: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
});

blogRouter.get("/", async (c) => {
  const query = listQuerySchema.parse(c.req.query());
  return c.json(await listPublishedBlogPosts(query));
});

blogRouter.get("/:slug", async (c) => {
  const slug = z.string().min(1).max(100).parse(c.req.param("slug"));
  return c.json(await getPublishedBlogPost(slug));
});
