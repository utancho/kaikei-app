import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  category?: string | null;
  published: boolean;
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function assertSlugAvailable(slug: string, exceptId?: string) {
  const existing = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== exceptId) badRequest("このURLスラッグはすでに使われています");
}

export async function listPublishedBlogPosts(options: { query?: string; category?: string } = {}) {
  const query = options.query?.trim();
  const category = options.category?.trim();
  return prisma.blogPost.findMany({
    where: {
      published: true,
      ...(category ? { category } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { excerpt: { contains: query } },
              { category: { contains: query } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      category: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getPublishedBlogPost(slug: string) {
  const post = await prisma.blogPost.findFirst({ where: { slug, published: true } });
  if (!post) notFound("記事が見つかりません");
  return post;
}

export async function listAllBlogPosts() {
  return prisma.blogPost.findMany({ orderBy: [{ updatedAt: "desc" }] });
}

export async function createBlogPost(input: BlogPostInput) {
  const slug = input.slug.trim().toLowerCase();
  await assertSlugAvailable(slug);
  return prisma.blogPost.create({
    data: {
      title: input.title.trim(),
      slug,
      excerpt: nullableText(input.excerpt),
      content: input.content.trim(),
      coverImageUrl: nullableText(input.coverImageUrl),
      category: nullableText(input.category),
      published: input.published,
      publishedAt: input.published ? new Date() : null,
    },
  });
}

export async function updateBlogPost(id: string, input: BlogPostInput) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) notFound("記事が見つかりません");
  const slug = input.slug.trim().toLowerCase();
  await assertSlugAvailable(slug, id);

  return prisma.blogPost.update({
    where: { id },
    data: {
      title: input.title.trim(),
      slug,
      excerpt: nullableText(input.excerpt),
      content: input.content.trim(),
      coverImageUrl: nullableText(input.coverImageUrl),
      category: nullableText(input.category),
      published: input.published,
      publishedAt: input.published ? existing!.publishedAt ?? new Date() : null,
    },
  });
}

export async function deleteBlogPost(id: string) {
  const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true } });
  if (!existing) notFound("記事が見つかりません");
  await prisma.blogPost.delete({ where: { id } });
}
