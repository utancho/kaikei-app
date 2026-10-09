import { useEffect, useRef, useState } from "react";

export default function Workflow3D({ stage, enabled }: { stage: number; enabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const stageRef = useRef(stage);
  const [ready, setReady] = useState(false);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => {
    if (!enabled || !host.current) return;
    const element = host.current;
    let alive = true, started = false, visible = false, raf = 0;
    let dispose = () => {};
    let startFrames = () => {};
    const start = async () => {
      if (started) return;
      started = true;
      try {
        const T = await import("three");
        if (!alive) return;
        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.domElement.dataset.renderer = "threejs";
        element.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(34, 1, .1, 50);
        camera.position.set(0, .15, 5.3);
        scene.add(new T.HemisphereLight(0xffffff, 0x49754a, 2.5));
        const light = new T.DirectionalLight(0xffffff, 3);
        light.position.set(2, 4, 5); scene.add(light);
        const group = new T.Group(); scene.add(group);
        const w = 3.4, h = 2.2, r = .13;
        const shape = new T.Shape();
        shape.moveTo(-w/2+r, -h/2); shape.lineTo(w/2-r,-h/2); shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
        shape.lineTo(w/2,h/2-r); shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
        shape.lineTo(-w/2+r,h/2); shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
        shape.lineTo(-w/2,-h/2+r); shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
        const geometry = new T.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: true, bevelSegments: 2, bevelSize: .02, bevelThickness: .02, steps: 1 });
        const colors = [0xd3e4c6, 0xe5efd9, 0xfafdf5];
        const materials = colors.map(color => new T.MeshStandardMaterial({ color, roughness: .65, metalness: .07 }));
        const sheets = materials.map((material,index) => {
          const sheet = new T.Mesh(geometry, material);
          sheet.position.set((index-1)*.13,(index-1)*.07,index*.18);
          group.add(sheet); return sheet;
        });
        const textures = [0,1,2].map(index=>{
          const canvas=document.createElement("canvas");canvas.width=800;canvas.height=520;
          const ctx=canvas.getContext("2d")!;
          ctx.beginPath();ctx.roundRect(0,0,800,520,24);ctx.clip();ctx.fillStyle="#ffffff";ctx.fillRect(0,0,800,520);
          ctx.fillStyle="#286c46";ctx.font="600 45px Arial";ctx.fillText("keirio",45,75);
          ctx.fillStyle="#69836b";ctx.font="24px Arial";ctx.fillText(["取込","仕訳","月次レポート"][index],610,72);
          ctx.strokeStyle="#deead7";ctx.beginPath();ctx.moveTo(35,110);ctx.lineTo(765,110);ctx.stroke();
          if(index===2){
            const heights=[65,108,86,132,122,166];heights.forEach((height,i)=>{ctx.fillStyle=i===5?"#347b50":"#c6dbb6";ctx.fillRect(65+i*112,320-height,80,height);});
          }else{
            const rows=index===0?[["10/08","売上の入金","128,000"],["10/07","事務用品","18,420"],["10/06","通信費","7,980"]]:[["借方","普通預金","128,000"],["貸方","売上高","128,000"],["確認","貸借の整合性","一致"]];
            rows.forEach((row,i)=>{const y=177+i*70;ctx.fillStyle="#5a765b";ctx.font="23px Arial";ctx.fillText(row[0],45,y);ctx.fillText(row[1],150,y);ctx.textAlign="right";ctx.fillText(row[2],745,y);ctx.textAlign="left";ctx.beginPath();ctx.moveTo(40,y+24);ctx.lineTo(760,y+24);ctx.stroke();});
          }
          ctx.fillStyle="#348653";ctx.font="22px Arial";ctx.fillText(["元資料を見ながら確認","サンプルの貸借は一致","今月の確認を次の判断へ"][index],45,408);
          ctx.fillStyle="#7d9178";ctx.font="18px Arial";ctx.fillText("操作イメージ · サンプルデータ",45,472);
          const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
        });
        const faceGeometry=new T.PlaneGeometry(3.25,2.1);
        const faceMaterial=new T.MeshBasicMaterial({map:textures[stageRef.current],transparent:true});
        const face=new T.Mesh(faceGeometry,faceMaterial);face.position.z=.46;group.add(face);
        const ringGeometry = new T.TorusGeometry(2.25,.012,8,80);
        const ringMaterial = new T.MeshStandardMaterial({ color: 0x98b780, roughness: .7 });
        const ring = new T.Mesh(ringGeometry, ringMaterial); ring.rotation.x=1.2; ring.position.set(0,-.45,-2.7); scene.add(ring);
        let px=0,py=0,last=0,angle=0;
        const pointer = (event: PointerEvent) => {
          const box=element.getBoundingClientRect();
          px=Math.max(-1,Math.min(1,(event.clientX-box.left)/Math.max(1,box.width)*2-1));
          py=Math.max(-1,Math.min(1,(event.clientY-box.top)/Math.max(1,box.height)*2-1));
        };
        const resize = () => {
          const width=element.clientWidth,height=element.clientHeight;
          if (!width || !height) return;
          renderer.setSize(width,height); camera.aspect=width/height; camera.updateProjectionMatrix();
          camera.position.z=Math.max(5.3,3.9/(2*Math.tan(17*Math.PI/180)*camera.aspect));
        };
        const frame = (now: number) => {
          if (!alive || !visible || document.hidden) { raf=0; return; }
          raf=requestAnimationFrame(frame);
          if(now-last<33) return;
          last=now;
          angle+=(stageRef.current*.12-angle)*.075;
          if(faceMaterial.map!==textures[stageRef.current]){faceMaterial.map=textures[stageRef.current];faceMaterial.needsUpdate=true;}
          group.rotation.x=.16+py*.035;
          group.rotation.y=-.2+angle+px*.08;
          group.rotation.z=Math.sin(now*.0005)*.035;
          group.position.y=Math.sin(now*.0008)*.04;
          sheets.forEach((sheet,index)=>{sheet.rotation.z=(index-1)*(.08+Math.sin(angle*3)*.045);});
          ring.rotation.z=now*.00006;
          renderer.render(scene,camera);
        };
        startFrames=()=>{ if(!raf && visible && !document.hidden) raf=requestAnimationFrame(frame); };
        const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else startFrames();};
        const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);
        window.addEventListener("pointermove",pointer,{passive:true});document.addEventListener("visibilitychange",visibility);
        resize();renderer.render(scene,camera);setReady(true);startFrames();
        dispose=()=>{
          resizeObserver.disconnect();cancelAnimationFrame(raf);window.removeEventListener("pointermove",pointer);document.removeEventListener("visibilitychange",visibility);
          geometry.dispose();materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());faceGeometry.dispose();faceMaterial.dispose();ringGeometry.dispose();ringMaterial.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
        };
      } catch { if(alive) setReady(false); }
    };
    const observer=new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if(visible){void start();startFrames();}else {cancelAnimationFrame(raf);raf=0;}
    },{rootMargin:"150px"});
    observer.observe(element);
    return ()=>{alive=false;observer.disconnect();dispose();setReady(false);};
  },[enabled]);
  return <div ref={host} className={"workflow-webgl"+(ready?" is-ready":"")} aria-hidden="true" />;
}
