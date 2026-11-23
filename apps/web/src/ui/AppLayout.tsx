import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Activity, Bot, Boxes, CircleDot, GitPullRequest, Github, LayoutDashboard, Menu, Moon, Settings, ShieldAlert, Sparkles, Sun, Workflow, X } from "lucide-react";
import { api, ApiError } from "../api";
const links = [
  ["/", "Overview", LayoutDashboard], ["/repositories", "Repositories", Boxes], ["/pull-requests", "Pull Requests", GitPullRequest], ["/issues", "Issues", CircleDot], ["/security", "Security", ShieldAlert], ["/workflows", "Workflows", Workflow], ["/activity", "Activity Logs", Activity], ["/ai", "AI Settings", Sparkles], ["/automation", "Automation Rules", Bot], ["/github", "GitHub Integration", Github], ["/settings", "General Settings", Settings]
] as const;
export function AppLayout() {
  const navigate=useNavigate(); const [open,setOpen]=useState(false); const [dark,setDark]=useState(localStorage.theme!=="light");
  useEffect(()=>{ document.documentElement.classList.toggle("dark",dark); localStorage.theme=dark?"dark":"light"; },[dark]);
  useEffect(()=>{ api("/api/auth/me").catch((error)=>{ if(error instanceof ApiError&&error.status===401) navigate("/login"); }); },[navigate]);
  return <div className="shell"><aside className={open?"sidebar open":"sidebar"}><div className="brand"><div className="logo"><Bot size={22}/></div><div><strong>EliteGitBot</strong><span>Automation Control</span></div><button className="mobile-close" onClick={()=>setOpen(false)} aria-label="Close menu"><X/></button></div><nav>{links.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==="/"} onClick={()=>setOpen(false)}><Icon size={18}/>{label}</NavLink>)}</nav><div className="sidebar-foot"><span className="status-dot"/> Worker connected</div></aside><main><header><button className="icon-button menu" onClick={()=>setOpen(true)} aria-label="Open menu"><Menu/></button><div><h1>Administration</h1><p>GitHub automation, without the noise.</p></div><button className="icon-button" onClick={()=>setDark(!dark)} aria-label="Toggle theme">{dark?<Sun/>:<Moon/>}</button></header><div className="content"><Outlet/></div></main>{open&&<button className="backdrop" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}</div>;
}
