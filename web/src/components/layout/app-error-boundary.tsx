import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("App crashed", error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-stone-900 dark:text-stone-100">
                <h1 className="text-xl font-semibold">页面出现了一个错误 / Something went wrong</h1>
                <p className="max-w-xl break-words text-sm text-stone-500">{this.state.error.message}</p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-80 dark:bg-white dark:text-stone-900"
                        onClick={() => window.location.reload()}
                    >
                        刷新页面 / Reload
                    </button>
                    <button
                        type="button"
                        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                        onClick={() => {
                            window.location.href = "/";
                        }}
                    >
                        返回首页 / Home
                    </button>
                </div>
            </div>
        );
    }
}
