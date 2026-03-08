import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
    children: ReactNode;
    /** 回退 UI 的标题（可选） */
    title?: string;
    /** 是否为全屏级别（用于 App 顶层） */
    fullScreen?: boolean;
    /** 自定义回退 UI（可选） */
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        if (this.props.fallback) {
            return this.props.fallback;
        }

        const { fullScreen, title } = this.props;
        const containerClass = fullScreen
            ? "flex-1 flex items-center justify-center h-screen w-full bg-background"
            : "flex items-center justify-center py-16 px-4";

        return (
            <div className={containerClass}>
                <div className="text-center max-w-md space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                        {title || "出现了一个错误"}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {this.state.error?.message || "未知错误"}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                            bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                        <RefreshCw className="w-4 h-4" />
                        重试
                    </button>
                </div>
            </div>
        );
    }
}
