import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// 自动注入 E2E Mock 的专属插件
const tauriMockPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html: string) {
      if (process.env.VITE_TEST_MOCK_TAURI) {
        return html.replace(
          '</head>',
          `  <script>
window.__TAURI__ = true;
Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {
        invoke: async (cmd, args) => {
            if (cmd.startsWith("plugin:store|") || cmd === "plugin:sql|load" || cmd === "set_workspace") return null;
            if (cmd === "plugin:sql|execute" || cmd === "plugin:sql|select") return [];
            if (cmd === "pick_folder") return "/mock/workspace";
            if (cmd === "cloud_list_files") return [];
            return null;
        }
    },
    configurable: true,
    writable: true,
});
</script>\n</head>`
        );
      }
      return html;
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tauriMockPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // 4. 代码分割优化 — 将三方依赖拆为独立 chunk
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react-router")) {
              return "vendor-react";
            }
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("@tauri-apps")) {
              return "vendor-tauri";
            }
            if (id.includes("zustand")) {
              return "vendor-zustand";
            }
            if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-") || id.includes("lowlight") || id.includes("highlight.js") || id.includes("mdast-") || id.includes("hast-") || id.includes("micromark") || id.includes("unist-")) {
              return "vendor-markdown";
            }
          }
        },
      },
    },
  },
  // 5. Vitest 配置 — 排除 Playwright e2e 测试
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'src-tauri/**'],
  },
}));
