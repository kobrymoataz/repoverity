import { ArrowRight, Code2, Github, ShieldCheck } from 'lucide-react'

export default function App() {
  return <div className="starter-page">
    <header className="starter-header"><div className="starter-brand"><ShieldCheck size={25}/><strong>repo<span>verity</span></strong><small>LABS</small></div><a href="https://github.com/kobrymoataz/repoverity" target="_blank" rel="noreferrer"><Github size={17}/> View source</a></header>
    <main className="starter-main"><div className="starter-eyebrow"><span/> OPEN SOURCE / V0.1.0</div><h1>See the work behind<br/><em>a GitHub profile.</em></h1><p>RepoVerity is a developer intelligence dashboard built around public data, clear signals and useful open-source work.</p><div className="starter-progress"><Code2 size={20}/><div><strong>Foundation is ready</strong><span>The next step is connecting GitHub's public API.</span></div><ArrowRight size={18}/></div></main>
    <footer className="starter-footer">REPOVERITY <span>Public data. Real work. Open source.</span></footer>
  </div>
}
