// e2e/tauri-mock.ts
// 这是一个注入到浏览器端 mock Tauri API 的脚本
console.log("注入 Mock Tauri 环境...");

// 无论 window.__TAURI__ 是什么，我们都强制覆盖 __TAURI_INTERNALS__ 避免 undefined 调用 invoke
Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {
        invoke: async (cmd: string, args: any) => {
            console.log(`[Mock Tauri] 调用命令: ${cmd}`, args);

            switch (cmd) {
                case "plugin:store|load":
                case "plugin:store|set":
                case "plugin:store|save":
                case "plugin:store|get":
                    return null;

                case "plugin:sql|load":
                    return null;

                case "plugin:sql|execute":
                case "plugin:sql|select":
                    return [];

                // 给 workspace 等方法一些默认返回
                case "pick_folder":
                    return "/mock/workspace";
                case "set_workspace":
                    return null;

                default:
                    return null;
            }
        }
    },
    configurable: true,
    writable: true,
});

(window as any).__TAURI__ = true;
