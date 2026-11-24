import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "./ui/AppLayout";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { DataPage } from "./pages/DataPage";
import { Settings } from "./pages/Settings";
import "./styles.css";

const initialDark=localStorage.theme?localStorage.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark",initialDark);
document.querySelector('meta[name="theme-color"]')?.setAttribute("content",initialDark?"#09090b":"#f6f7f9");

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: 1 } } });
const routes = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/", element: <AppLayout />, children: [
    { index: true, element: <Overview /> },
    { path: "repositories", element: <DataPage title="Repositories" endpoint="/api/repositories" columns={["full_name","visibility","default_branch","monitored","last_activity_at","html_url"]} /> },
    { path: "pull-requests", element: <DataPage title="Pull Requests" endpoint="/api/pull-requests" columns={["title","author","repository_name","state","review_status","risk_level","html_url"]} /> },
    { path: "issues", element: <DataPage title="Issues" endpoint="/api/issues" columns={["title","author","repository_name","category","state","reply_status","html_url"]} /> },
    { path: "reviews", element: <Navigate to="/pull-requests" replace /> },
    { path: "security", element: <DataPage title="Security Findings" endpoint="/api/security/findings" columns={["title","repository_name","severity","finding_type","status","confirmed","html_url"]} /> },
    { path: "workflows", element: <DataPage title="Workflow Runs" endpoint="/api/workflows" columns={["name","repository_name","status","conclusion","branch","updated_at","html_url"]} /> },
    { path: "activity", element: <DataPage title="Activity Logs" endpoint="/api/activity" columns={["event_type","repository_name","description","created_at"]} /> },
    { path: "settings", element: <Settings /> },
    { path: "ai", element: <Settings /> },
    { path: "automation", element: <Settings /> },
    { path: "github", element: <Settings /> },
    { path: "*", element: <Navigate to="/" replace /> }
  ]}
]);
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={routes} /></QueryClientProvider></React.StrictMode>);
