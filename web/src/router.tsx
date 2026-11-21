import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import UserLayout from "@/layouts/user-layout";

const HomePage = lazy(() => import("@/pages/home"));
const AssetsPage = lazy(() => import("@/pages/assets"));
const CanvasPage = lazy(() => import("@/pages/canvas"));
const CanvasProjectPage = lazy(() => import("@/pages/canvas/project"));
const ConfigPage = lazy(() => import("@/pages/config"));
const NotFound = lazy(() => import("@/pages/not-found"));

const RouteFallback = () => <main className="flex h-full items-center justify-center bg-background text-sm text-stone-500">Loading…</main>;

export const router = createBrowserRouter([
    {
        element: (
            <UserLayout>
                <AnalyticsTracker />
                <Suspense fallback={<RouteFallback />}>
                    <Outlet />
                </Suspense>
            </UserLayout>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
            { path: "/config", element: <ConfigPage /> },
        ],
    },
    {
        path: "*",
        element: (
            <Suspense fallback={<RouteFallback />}>
                <NotFound />
            </Suspense>
        ),
    },
]);
