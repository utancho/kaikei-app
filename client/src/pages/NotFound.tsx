import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {updatePageSeo} from '../lib/pageSeo';
export default function NotFound(){
 useEffect(()=>{updatePageSeo('ページが見つかりません | keirio','URLをご確認ください。');const tag=document.querySelector<HTMLMetaElement>('meta[name="robots"]');if(tag)tag.content='noindex';},[]);
 return <main className="mx-auto max-w-2xl px-6 py-24"><h1 className="text-3xl font-semibold">ページが見つかりません</h1><p className="mt-5">URLをご確認ください。</p><p className="mt-6"><Link className="text-emerald-800 underline" to="/">ホームへ</Link> · <Link className="text-emerald-800 underline" to="/blog">ブログへ</Link></p></main>;
}
