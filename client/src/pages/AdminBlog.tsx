import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink, FilePlus2, LogOut, Pencil, Trash2, Wallet, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { BlogPost, BlogPostInput } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { inputClass, labelClass } from "../lib/formStyles";

const EMPTY_FORM: BlogPostInput = {
  title: "",
  slug: "",
  excerpt: null,
  content: "",
  coverImageUrl: null,
  category: null,
  published: false,
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function defaultSlug() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  return `post-${date}-${now.getTime().toString(36).slice(-5)}`;
}

export default function AdminBlog() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null | "new">(null);
  const [form, setForm] = useState<BlogPostInput>(EMPTY_FORM);

  const load = () => {
    setLoading(true);
    api.adminListBlogPosts()
      .then(setPosts)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "記事の読み込みに失敗しました"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => {
    setEditing("new");
    setForm({ ...EMPTY_FORM, slug: defaultSlug() });
  };
  const openEdit = (post: BlogPost) => {
    setEditing(post);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImageUrl: post.coverImageUrl,
      category: post.category,
      published: post.published,
    });
  };
  const update = <K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing === "new") await api.adminCreateBlogPost(form);
      else if (editing) await api.adminUpdateBlogPost(editing.id, form);
      toast.success(form.published ? "記事を公開しました" : "下書きを保存しました");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "記事の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: BlogPost) => {
    const ok = await confirm({ title: "記事を削除しますか?", description: `「${post.title}」は元に戻せません。`, confirmLabel: "削除する", danger: true });
    if (!ok) return;
    try {
      await api.adminDeleteBlogPost(post.id);
      toast.success("記事を削除しました");
      if (editing !== "new" && editing?.id === post.id) setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "記事の削除に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-14 bg-brand-900 text-white flex items-center justify-between px-6">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center"><Wallet size={16} /></div>
          <span className="text-sm font-bold">Kaikei 管理者</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-brand-100">
          <span className="truncate max-w-[200px] hidden sm:block">{user?.email}</span>
          <button className="flex items-center gap-1.5 hover:text-white" onClick={() => logout()}><LogOut size={14} /> ログアウト</button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-700 mb-2"><ArrowLeft size={13} /> 管理者ダッシュボード</Link>
            <h1 className="text-xl font-bold text-gray-900">ブログ管理</h1>
            <p className="text-sm text-gray-500 mt-0.5">公開記事と下書きを作成・編集できます</p>
          </div>
          <Button icon={<FilePlus2 size={15} />} onClick={openNew}>新しい記事</Button>
        </div>

        {editing && (
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{editing === "new" ? "新しい記事" : "記事を編集"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label><span className={labelClass}>タイトル *</span><input className={`${inputClass} w-full`} value={form.title} maxLength={120} required onChange={(e) => update("title", e.target.value)} /></label>
                <label><span className={labelClass}>URLスラッグ *</span><input className={`${inputClass} w-full font-mono`} value={form.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required onChange={(e) => update("slug", e.target.value.toLowerCase())} /><span className="text-[11px] text-gray-400 mt-1 block">半角英小文字・数字・ハイフン（例: tax-return-guide）</span></label>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <label><span className={labelClass}>カテゴリー</span><input className={`${inputClass} w-full`} value={form.category ?? ""} maxLength={50} placeholder="確定申告" onChange={(e) => update("category", e.target.value || null)} /></label>
                <label><span className={labelClass}>アイキャッチ画像URL</span><input type="url" className={`${inputClass} w-full`} value={form.coverImageUrl ?? ""} placeholder="https://..." onChange={(e) => update("coverImageUrl", e.target.value || null)} /></label>
              </div>
              <label className="block"><span className={labelClass}>概要（240文字まで）</span><textarea className={`${inputClass} w-full min-h-20 resize-y`} value={form.excerpt ?? ""} maxLength={240} onChange={(e) => update("excerpt", e.target.value || null)} /></label>
              <label className="block"><span className={labelClass}>本文 *</span><textarea className={`${inputClass} w-full min-h-80 resize-y leading-relaxed`} value={form.content} required maxLength={100000} placeholder={"段落は空行で区切ります。\n\n## 見出し\n見出しは ## から始めます。\n\n- 箇条書き"} onChange={(e) => update("content", e.target.value)} /><span className="text-[11px] text-gray-400 mt-1 block">空行で段落、## で見出し、- で箇条書きを表現できます。</span></label>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-gray-100">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.published} onChange={(e) => update("published", e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />すぐに公開する</label>
                <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>キャンセル</Button><Button type="submit" loading={saving}>{form.published ? "公開して保存" : "下書きを保存"}</Button></div>
              </div>
            </form>
          </Card>
        )}

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-16 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : posts.length === 0 ? (
            <EmptyState icon={<BookOpen size={28} />} title="ブログ記事がありません" description="最初の記事を作成して情報を発信しましょう" action={<Button size="sm" onClick={openNew}>記事を作成</Button>} />
          ) : (
            <div className="divide-y divide-gray-100">
              {posts.map((post) => (
                <div key={post.id} className="p-4 flex items-start gap-4 hover:bg-gray-50/70">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${post.published ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{post.published ? "公開中" : "下書き"}</span>
                      {post.category && <span className="text-xs text-gray-400">{post.category}</span>}
                    </div>
                    <h2 className="font-semibold text-gray-900 mt-1.5 truncate">{post.title}</h2>
                    <p className="text-xs text-gray-400 mt-1">/{post.slug} ・ 更新 {formatDateTime(post.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.published && <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-brand-700" title="公開ページを表示"><ExternalLink size={16} /></a>}
                    <button onClick={() => openEdit(post)} className="p-2 text-gray-400 hover:text-brand-700" title="編集"><Pencil size={16} /></button>
                    <button onClick={() => remove(post)} className="p-2 text-gray-400 hover:text-red-600" title="削除"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
