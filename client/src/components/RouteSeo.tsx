import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {classifyPagePath} from '../../../server/src/lib/seoRoutes';
export default function RouteSeo() {
  const { pathname, hash }=useLocation();
  useEffect(()=>{
    if(!hash)return;
    let id: string;
    try{id=decodeURIComponent(hash.slice(1));}catch{return;}
    const scroll=()=>{const target=document.getElementById(id);if(!target)return false;target.scrollIntoView({block:"start"});return true;};
    if(scroll())return;
    const observer=new MutationObserver(()=>{if(scroll())observer.disconnect();});
    observer.observe(document.getElementById("root")!,{childList:true,subtree:true,attributes:true,attributeFilter:["id"]});
    const timeout=window.setTimeout(()=>observer.disconnect(),10000);
    return ()=>{observer.disconnect();clearTimeout(timeout);};
  },[pathname,hash]);
  useEffect(()=>{
    const routeType=classifyPagePath(pathname);
    const publicPage=routeType==='public'||routeType==='article';
    let canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if(!canonical){canonical=document.createElement("link");canonical.rel="canonical";document.head.appendChild(canonical);}
    canonical.href="https://keirio-hub.com"+pathname;
    let robots=document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if(!robots){robots=document.createElement("meta");robots.name="robots";document.head.appendChild(robots);}
    robots.content=publicPage?"index,follow":"noindex,nofollow";
    const schema=document.querySelector('script[data-keirio-seo][type="application/ld+json"]');
    if(schema){try{const data=JSON.parse(schema.textContent??"{}");const url="https://keirio-hub.com"+pathname;const belongs=data.mainEntityOfPage===url||(Array.isArray(data["@graph"])&&data["@graph"].some((item:{mainEntityOfPage?:string;url?:string})=>item.mainEntityOfPage===url||item.url===url));if(!(pathname==="/"&&data["@type"]==="SoftwareApplication")&&!belongs)schema.remove();}catch{schema.remove();}}
  },[pathname]);
  return null;
}
