/**
 * 虚拟滚动列表组件
 *
 * 高性能渲染大量列表项，只渲染可视区域内的元素。
 * 用于对话列表、消息列表等大量数据场景。
 */

import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";

interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    overscan?: number; // 上下额外渲染的行数
    containerClassName?: string;
    renderItem: (item: T, index: number) => ReactNode;
    getKey: (item: T, index: number) => string;
}

export default function VirtualList<T>({
    items,
    itemHeight,
    overscan = 5,
    containerClassName = "",
    renderItem,
    getKey,
}: VirtualListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });
        observer.observe(el);
        setContainerHeight(el.clientHeight);
        return () => observer.disconnect();
    }, []);

    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            setScrollTop(containerRef.current.scrollTop);
        }
    }, []);

    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex);

    return (
        <div
            ref={containerRef}
            className={`overflow-y-auto ${containerClassName}`}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, position: "relative" }}>
                {visibleItems.map((item, i) => {
                    const actualIndex = startIndex + i;
                    return (
                        <div
                            key={getKey(item, actualIndex)}
                            style={{
                                position: "absolute",
                                top: actualIndex * itemHeight,
                                left: 0,
                                right: 0,
                                height: itemHeight,
                            }}
                        >
                            {renderItem(item, actualIndex)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
