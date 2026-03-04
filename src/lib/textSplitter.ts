/**
 * 递归字符文本分割器
 * 在指定的块大小 (chunkSize) 和重叠大小 (overlap) 下，
 * 尽量按段落、句子、单词的边界进行切割，保留语义完整性。
 */

interface SplitterOptions {
    chunkSize: number;
    overlap: number;
}

export function splitText(text: string, options: SplitterOptions = { chunkSize: 1000, overlap: 200 }): string[] {
    const { chunkSize, overlap } = options;
    if (chunkSize <= 0) return [text];

    // 分隔符优先级树：双换行(段落) -> 单换行 -> 句号/问号/叹号 -> 空格 -> 字符
    const separators = ["\n\n", "\n", "。 ", ". ", "！ ", "! ", "？ ", "? ", " ", ""];

    function _split(textToSplit: string, separatorIndex: number): string[] {
        if (textToSplit.length <= chunkSize) {
            return [textToSplit];
        }

        const separator = separators[separatorIndex];
        let splits: string[];

        if (separator !== "") {
            splits = textToSplit.split(separator);
        } else {
            splits = textToSplit.split("");
        }

        const chunks: string[] = [];
        let currentChunk = "";

        for (const split of splits) {
            const nextChunk = currentChunk ? currentChunk + separator + split : split;

            if (nextChunk.length <= chunkSize) {
                currentChunk = nextChunk;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);

                    // 计算重叠部分的起始位置
                    const overlapStart = Math.max(0, currentChunk.length - overlap);
                    // 尽量从一个完整的单词或句子边界开始切片
                    let safeOverlapStart = overlapStart;
                    if (overlapStart > 0 && separator !== "") {
                        const previousSplitIdx = currentChunk.lastIndexOf(separator, currentChunk.length - 1);
                        if (previousSplitIdx > overlapStart) {
                            safeOverlapStart = previousSplitIdx;
                        }
                    }

                    currentChunk = currentChunk.slice(safeOverlapStart) + separator + split;

                    // 如果即使只加上当前的 split 也超出长度，必须向下递归
                    if (currentChunk.length > chunkSize && separatorIndex < separators.length - 1) {
                        const subChunks = _split(currentChunk, separatorIndex + 1);
                        chunks.push(...subChunks.slice(0, -1));
                        currentChunk = subChunks[subChunks.length - 1];
                    }

                } else {
                    // split 本身太长，继续用更细的粒度分隔
                    if (separatorIndex < separators.length - 1) {
                        chunks.push(..._split(split, separatorIndex + 1));
                    } else {
                        // 兜底（按字符强制截断）
                        chunks.push(split.slice(0, chunkSize));
                        currentChunk = split.slice(chunkSize);
                    }
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    return _split(text.trim(), 0).map(c => c.trim()).filter(c => c.length > 0);
}
