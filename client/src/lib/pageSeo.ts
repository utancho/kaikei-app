import {safeEditorialUrl} from '../../../server/src/lib/blogContent';
export function updatePageSeo(title: string, description: string, schema?: unknown, image?: string | null) {
  document.title=title;
  const meta=document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if(meta)meta.content=description;
  const safeImage=image?safeEditorialUrl(image):null;
  for(const [property,content] of [["og:title",title],["og:description",description],["og:url","https://keirio-hub.com"+location.pathname],["og:image",safeImage?new URL(safeImage,"https://keirio-hub.com").href:"https://keirio-hub.com/brand/keirio-icon.png"]]){
    let tag=document.querySelector<HTMLMetaElement>('meta[property="'+property+'"]');
    if(!tag){tag=document.createElement("meta");tag.setAttribute("property",property);document.head.appendChild(tag);}
    tag.content=content;
  }
  if(schema){
    let tag=document.querySelector<HTMLScriptElement>('script[data-keirio-seo][type="application/ld+json"]');
    if(!tag){tag=document.createElement("script");tag.type="application/ld+json";tag.dataset.keirioSeo="";document.head.appendChild(tag);}
    tag.textContent=JSON.stringify(schema).replace(/</g,"\\u003c");
  }
}
