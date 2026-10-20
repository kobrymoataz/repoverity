import { useState, type FormEvent } from 'react'
import { ArrowRight, Github, ShieldCheck, Star, Users, BookOpen, GitFork } from 'lucide-react'
import { useGithubProfile } from './hooks/useGithubProfile'
import { calculateInsights, compactNumber } from './lib/insights'

export default function App() {
  const { username, snapshot, status, error, analyze, retry } = useGithubProfile()
  const [input, setInput] = useState(username)
  const info = snapshot && calculateInsights(snapshot.repositories)

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (input.trim()) analyze(input)
  }

  return <div className="v01-shell">
    <header className="v01-header"><a href="https://github.com/kobrymoataz/repoverity" className="v01-brand"><ShieldCheck size={23}/> repo<span>verity</span></a><span>PUBLIC API / V0.1</span></header>
    <main className="v01-main">
      <div className="v01-kicker">DEVELOPER INTELLIGENCE</div>
      <h1>Explore any public GitHub profile.</h1>
      <p>Live profile data, repository counts and sample engagement, read directly from the GitHub REST API.</p>
      <form className="v01-search" onSubmit={submit}><Github size={21}/><input value={input} onChange={e=>setInput(e.target.value)} placeholder="GitHub username" aria-label="GitHub username"/><button type="submit">Analyze <ArrowRight size={16}/></button></form>
      {status === 'loading' && <div className="v01-message">Loading public profile...</div>}
      {status === 'error' && <div className="v01-message"><strong>Lookup unsuccessful:</strong> {error} <button type="button" onClick={retry}>Retry</button></div>}
      {status === 'success' && snapshot && info && <div className="v01-results">
        <div className="v01-profile"><img src={snapshot.user.avatar_url} alt="Profile avatar"/><div><h2>{snapshot.user.name || snapshot.user.login}</h2><a href={snapshot.user.html_url} target="_blank" rel="noreferrer">@{snapshot.user.login}</a><p>{snapshot.user.bio || 'No public biography available.'}</p></div></div>
        <div className="v01-metrics"><div><Users/><small>FOLLOWERS</small><strong>{compactNumber(snapshot.user.followers)}</strong></div><div><BookOpen/><small>PUBLIC REPOS</small><strong>{compactNumber(snapshot.user.public_repos)}</strong></div><div><Star/><small>STARS IN SAMPLE</small><strong>{compactNumber(info.stars)}</strong></div><div><GitFork/><small>FORKS IN SAMPLE</small><strong>{compactNumber(info.forks)}</strong></div></div>
        <div className="v01-note">Sampling: the {snapshot.repositories.length} most recently updated public owned repositories, up to 100. No private data is accessed.</div>
      </div>}
    </main>
  </div>
}
