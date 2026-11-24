import { Activity, Bot, BrainCircuit, Github, GitPullRequest, LockKeyhole, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { useEffect } from "react";

const features=[
  [GitPullRequest,"Pull request reviews","Deterministic code review with clear findings and human approval safeguards."],
  [Activity,"Issue automation","Classifies new issues, records activity, and posts a safe acknowledgement."],
  [Workflow,"Workflow monitoring","Tracks GitHub Actions runs and highlights failures in one dashboard."],
  [ShieldCheck,"Security focused","Signed webhooks, short-lived GitHub tokens, encrypted settings, and protected secrets."],
  [BrainCircuit,"Flexible AI","Use the free local rule engine, Gemini, or an OpenAI-compatible provider."],
  [LockKeyhole,"Private by design","Repository access stays limited to the GitHub App installations you choose."]
] as const;

export function Home(){
  useEffect(()=>{document.title="EliteGitBot · Secure GitHub automation";document.querySelector('meta[name="description"]')?.setAttribute("content","Secure, self-hosted GitHub automation for pull requests, issues, workflows, and repository activity.")},[]);
  return <main className="public-home">
    <nav className="home-nav" aria-label="Public navigation"><a className="home-brand" href="#top"><span className="home-logo"><Bot/></span><span><strong>EliteGitBot</strong><small>Automation without the noise</small></span></a><div><a className="home-github" href="https://github.com/kamrullab/EliteGitBot" target="_blank" rel="noopener noreferrer"><Github/> GitHub</a></div></nav>
    <section className="home-hero" id="top"><div className="home-copy"><span className="home-kicker"><Sparkles/> Secure GitHub automation</span><h1>Your repositories,<br/><span>under intelligent watch.</span></h1><p>Review pull requests, triage issues, monitor workflows, and audit repository activity from one fast Cloudflare-powered control center.</p><div className="home-actions"><a className="home-primary" href="https://github.com/kamrullab/EliteGitBot" target="_blank" rel="noopener noreferrer"><Github/> View on GitHub</a><a className="home-secondary" href="#features">Explore features</a></div><div className="home-trust"><span><i/> Worker ready</span><span>Free rule-based mode</span><span>Self-hosted secrets</span></div></div><div className="bot-stage" aria-label="Animated EliteGitBot illustration"><div className="bot-orbit orbit-one"/><div className="bot-orbit orbit-two"/><div className="bot-core"><Bot/><span className="bot-eye eye-one"/><span className="bot-eye eye-two"/></div><div className="signal-card signal-pr"><GitPullRequest/><span>PR reviewed</span><b>Safe</b></div><div className="signal-card signal-security"><ShieldCheck/><span>Webhook</span><b>Verified</b></div><div className="signal-card signal-ai"><BrainCircuit/><span>Analysis</span><b>Ready</b></div></div></section>
    <section className="home-features" id="features"><div className="home-section-title"><span>BUILT FOR REAL REPOSITORIES</span><h2>Everything your automation needs.</h2><p>Useful defaults today, with external AI entirely optional.</p></div><div className="feature-grid">{features.map(([Icon,title,text])=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <footer className="home-footer"><a className="home-brand" href="#top"><span className="home-logo"><Bot/></span><span><strong>EliteGitBot</strong><small>Built by kamrullab</small></span></a><p>Secure automation. Human decisions.</p></footer>
  </main>
}
