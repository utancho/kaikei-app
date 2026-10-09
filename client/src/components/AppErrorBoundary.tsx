import { Component, type ReactNode } from "react";
export class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div role="alert" className="mx-auto max-w-lg p-8"><h1 className="text-xl font-semibold">画面を表示できませんでした</h1><p className="mt-4 text-sm leading-7 text-gray-600">接続とブラウザの状態をご確認のうえ、再読み込みをお試しください。</p><button onClick={()=>location.reload()} className="mt-5 rounded-lg bg-emerald-700 px-5 py-3 text-white">画面を再読み込み</button></div>:this.props.children;}
}
