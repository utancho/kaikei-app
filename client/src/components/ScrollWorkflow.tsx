import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import Workflow3D from "./Workflow3D";
const STEPS = [
  { name: "明細を取り込む", title: "取引が、ひとつずつ並ぶ。", copy: "銀行・カードのCSV明細を取り込みます。日付と金額を元資料に照らし合わせ、記帳する取引を選びます。", label: "取込", rows: [["10/08", "売上の入金", "128,000"], ["10/07", "事務用品", "18,420"], ["10/06", "通信費", "7,980"]] },
  { name: "仕訳を確認する", title: "内容を確かめて、記帳する。", copy: "科目と摘要を確認して仕訳を保存。定型の取引はテンプレートを使い、今回の金額や日付を見直します。", label: "仕訳", rows: [["借方", "普通預金", "128,000"], ["貸方", "売上高", "128,000"], ["確認", "貸借の整合性", "一致"]] },
  { name: "レポートを見る", title: "今月の数字を、見渡す。", copy: "損益や残高のレポートを確認。月次タスクに確認状況を残して、次の月の仕事へ進みます。", label: "月次", rows: [["確認", "仕訳と証憑", "完了"], ["確認", "請求と入金", "完了"], ["確認", "月次の残高", "完了"]] },
];
export default function ScrollWorkflow({ motion }: { motion: boolean }) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [automatic, setAutomatic] = useState(true);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 900px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!motion || !automatic || reduce.matches || !wide) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const bounds = section.current?.getBoundingClientRect();
      if (!bounds) return;
      const progress = Math.max(0, Math.min(0.999, -bounds.top / Math.max(1, bounds.height - innerHeight)));
      setActive(Math.floor(progress * STEPS.length));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [motion, automatic, wide]);
  const current = STEPS[active];
  return <section ref={section} id="workflow" className={"scroll-workflow" + (motion ? " is-automatic" : "")} aria-labelledby="workflow-title">
    <div className="workflow-sticky studio-container">
      <div className="workflow-copy"><p className="studio-section-label">取込から、毎月の確認まで</p><h2 id="workflow-title">仕事の流れに、<br />会計がついてくる。</h2><p className="workflow-instruction">スクロール、または下のボタンで操作の流れをご覧いただけます。</p><div className="workflow-controls" role="group" aria-label="操作の流れを選択">{STEPS.map((step,index)=><button key={step.name} type="button" aria-pressed={index === active} onClick={()=>{setAutomatic(false);setActive(index);}}><span>0{index+1}</span>{step.name}<ArrowRight size={16} /></button>)}</div>{motion && !automatic && <button type="button" className="workflow-resume" onClick={()=>setAutomatic(true)}>スクロール連動に戻す</button>}</div>
      <div className="workflow-visual" data-step={active}>
        <Workflow3D stage={active} enabled={motion} />
        <div className="workflow-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="workflow-sheet workflow-sheet-back" aria-hidden="true" />
        <div className="workflow-sheet workflow-sheet-middle" aria-hidden="true" />
        <div className="workflow-sheet workflow-sheet-front" key={active}><div className="workflow-sheet-heading"><span>keirio</span><span>{current.label}</span></div><div className="workflow-sheet-content">{active === 2 ? <div className="workflow-mini-chart" role="img" aria-label="サンプル売上推移のグラフ">{[35,60,48,74,68,93].map((height,index)=><div key={index} style={{height:height+"%"}} />)}</div> : <div className="workflow-sheet-rows">{current.rows.map(row=><div key={row[0]+row[1]}><span>{row[0]}</span><span>{row[1]}</span><strong>{row[2]}</strong></div>)}</div>}<div className="workflow-confirm"><Check size={15}/>{active===0?"元資料を見ながら確認":active===1?"サンプルの貸借は一致":"今月の確認を次の判断へ"}</div></div><span className="workflow-sample">操作イメージ · サンプルデータ</span></div>
        <div className="workflow-caption"><span aria-hidden="true">0{active+1} / 03</span><h3>{current.title}</h3><p>{current.copy}</p></div>
      </div>
    </div>
  </section>;
}
