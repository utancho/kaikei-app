import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { api } from "../lib/api";
import type { BlogPostSummary } from "../lib/types";
export default function LaunchJournal() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  useEffect(() => {
    let active = true;
    api.listBlogPosts().then(data => { if (active) setPosts(data.slice(0, 3)); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <section className="studio-container launch-journal" aria-labelledby="journal-title">
    <div className="studio-section-top"><div><span className="studio-section-label">keirio journal</span><h2 id="journal-title">明日の記帳に、使える読みもの。</h2></div><Link className="studio-text-link" to="/blog">記事をすべて見る <ArrowUpRight size={18} /></Link></div>
    {posts.length > 0 ? <div className="journal-grid">{posts.map(post => <Link key={post.id} className="journal-card" to={"/blog/" + post.slug}>{post.coverImageUrl && <img src={post.coverImageUrl} alt="" width="900" height="560" loading="lazy" />}<span>{post.category}</span><h3>{post.title}</h3><p>{post.excerpt}</p><span className="journal-read">記事を読む <ArrowUpRight size={16} /></span></Link>)}</div> : <p className="journal-empty">明細の取込、月次確認、請求書の管理。具体的な操作をブログで紹介しています。<Link to="/blog">ブログへ →</Link></p>}
  </section>;
}
