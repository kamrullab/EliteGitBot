import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Bot, Boxes, CircleDot, GitPullRequest, Github, LayoutDashboard, LogOut, Menu, Moon, Settings, ShieldAlert, Sparkles, Sun, Workflow, X } from "lucide-react";
import { api, ApiError } from "../api";
const links = [
  ["/", "Overview", LayoutDashboard], ["/repositories", "Repositories", Boxes], ["/pull-requests", "Pull Requests", GitPullRequest], ["/issues", "Issues", CircleDot], ["/security", "Security", ShieldAlert], ["/workflows", "Workflows", Workflow], ["/activity", "Activity Logs", Activity], ["/ai", "AI Settings", Sparkles], ["/automation", "Automation Rules", Bot], ["/github", "GitHub Integration", Github], ["/settings", "General Settings", Settings]
] as const;
const routeMeta:Record<string,{title:string;description:string}>={
  "/":{title:"Overview",description:"Live GitHub automation statistics and repository activity."},
  "/repositories":{title:"Repositories",description:"Manage repositories connected to EliteGitBot."},
  "/pull-requests":{title:"Pull Requests",description:"Review automated pull request analysis and findings."},
  "/issues":{title:"Issues",description:"Monitor issue classification and automated responses."},
  "/security":{title:"Security",description:"Review repository security findings."},
  "/workflows":{title:"Workflows",description:"Monitor GitHub Actions workflow results."},
  "/activity":{title:"Activity Logs",description:"Audit EliteGitBot automation activity."},
  "/ai":{title:"AI Settings",description:"Securely configure AI analysis providers."},
  "/automation":{title:"Automation Rules",description:"Review repository automation controls."},
  "/github":{title:"GitHub Integration",description:"View GitHub App integration status."},
  "/settings":{title:"General Settings",description:"Manage administrator account settings."}
};
export function AppLayout() {
  const navigate=useNavigate(),location=useLocation(); const [open,setOpen]=useState(false); const [dark,setDark]=useState(()=>localStorage.theme?localStorage.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(()=>{ document.documentElement.classList.toggle("dark",dark); localStorage.theme=dark?"dark":"light";document.querySelector('meta[name="theme-color"]')?.setAttribute("content",dark?"#09090b":"#f6f7f9"); },[dark]);
  useEffect(()=>{ api("/api/auth/me").catch((error)=>{ if(error instanceof ApiError&&error.status===401) navigate("/login"); }); },[navigate]);
  useEffect(()=>{const meta=routeMeta[location.pathname]??routeMeta["/"]!;const title=`${meta.title} · EliteGitBot`;document.title=title;document.querySelector('meta[name="description"]')?.setAttribute("content",meta.description);document.querySelector('meta[property="og:title"]')?.setAttribute("content",title);document.querySelector('meta[property="og:description"]')?.setAttribute("content",meta.description);document.querySelector('meta[name="twitter:title"]')?.setAttribute("content",title);document.querySelector('meta[name="twitter:description"]')?.setAttribute("content",meta.description)},[location.pathname]);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("keydown",close);document.body.classList.add("nav-open");return()=>{document.removeEventListener("keydown",close);document.body.classList.remove("nav-open")}},[open]);
  async function signOut(){try{await api("/api/auth/logout",{method:"POST",body:"{}"})}finally{navigate("/login")}}
  const meta=routeMeta[location.pathname]??routeMeta["/"]!;
  return <div className="shell"><a className="skip-link" href="#main-content">Skip to content</a><aside id="primary-navigation" aria-label="Primary navigation" className={open?"sidebar open":"sidebar"}><div className="brand"><div className="logo" aria-hidden="true"><Bot size={22}/></div><div><strong>EliteGitBot</strong><span>Automation Control</span></div><button className="mobile-close" onClick={()=>setOpen(false)} aria-label="Close menu"><X/></button></div><nav aria-label="Administration">{links.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==="/"} onClick={()=>setOpen(false)}><Icon size={18} aria-hidden="true"/>{label}</NavLink>)}</nav><div className="sidebar-foot"><div><span className="status-dot"/> Worker connected</div><button onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button></div></aside><main id="main-content"><header className="app-header"><button className="icon-button menu" onClick={()=>setOpen(true)} aria-label="Open menu" aria-controls="primary-navigation" aria-expanded={open}><Menu/></button><div><h1>{meta.title}</h1><p>{meta.description}</p></div><button className="icon-button" onClick={()=>setDark(!dark)} aria-label={`Switch to ${dark?"light":"dark"} theme`}>{dark?<Sun/>:<Moon/>}</button></header><div className="content"><Outlet/></div></main>{open&&<button className="backdrop" onClick={()=>setOpen(false)} aria-label="Close navigation" tabIndex={-1}/>}</div>;
}
