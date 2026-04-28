# Desktop 打包运行时测试清单（Anydocs）

> 用途：验收打包产物（非浏览器开发运行时）
> 适用：`anydocs` 项目，macOS 为主；其他系统路径按各自产物后缀替换。

## 一、目标
1. 仅验证打包后的 Desktop 二进制行为，不重复执行浏览器版 E2E。
2. 覆盖安装、启动、核心 CRUD、Build/Preview、持久化、错误边界。
3. 保留最小可复用记录，供每次发布前执行。

## 二、执行前置

- 当前仓库：`/Users/shawn/workspace/code/anydocs`
- 环境变量：`Node >= 18`, `pnpm >= 8`, `Rust/cargo`（Tauri 打包链）
- 推荐命令：`corepack enable`，`corepack prepare pnpm@9.0.0 --activate`

## 三、打包步骤（产物构建）

1. 安装依赖：
   `pnpm install`
2. 构建打包产物：
   - full 版 app：`pnpm --filter @anydocs/desktop tauri:build:full:app`
   - full 版 dmg：`pnpm --filter @anydocs/desktop tauri:build:full:dmg`
   - lite 版 app：`pnpm --filter @anydocs/desktop tauri:build:lite:app`
   - lite 版 dmg：`pnpm --filter @anydocs/desktop tauri:build:lite:dmg`
3. 验证产物文件存在：
   - full：`dist/desktop/full/dmg/Anydocs-full_*.dmg`
   - lite：`dist/desktop/lite/dmg/Anydocs-lite_*.dmg`
   - 说明：当前 dmg 打包链路不再调用 Tauri 的 create-dmg GUI 化流程，不会自动挂载；打包完成后仅产出文件，由你手动打开安装。

## 四、安装与启动

1. 安装 `.dmg`，确认 App 可启动。
2. 首次启动无崩溃，窗口可见，标题正常显示。
3. 记录：
   - 打开耗时
   - 是否出现白屏/崩溃
   - 控制台/日志可读性（如能捕获）

## 五、P0 核心验收（必须通过）

1. 打开项目：通过桌面“选择项目目录”打开 `examples/starter-docs`。
2. 连接验证：页面列表可见，状态显示 `Connected`。
3. 页面编辑：打开 `welcome`，修改标题并保存。
4. 重启后持久化：重启应用再次打开同一项目，标题应保持。
5. 新建页面：创建新页面并填写 title/slug，保存成功。
6. 文件落盘：在磁盘检查 `pages/<lang>/<pageId>.json` 新建记录。
7. Build：触发构建并确保产物路径可见（`dist/` 及 `llms.txt`、`search-index`、`mcp`）。
8. Preview：触发预览并确认 preview URL 可打开、内容正确。
9. 发布范围：确认只有 `published` 内容进入读者/搜索/LLM 产物。

## 六、P1 稳定性与防退化（建议每次执行）

1. 语言切换：EN / 中文切换后界面稳定，未触发非预期写入。
2. 错误处理：模拟 build/preview 异常（重复触发、锁超时），验证错误提示清晰。
3. 导航保存：页面移动、重命名、删除后不应出现脏数据。
4. 重开工程后状态一致：保存状态回显、最近操作可恢复。

## 七、补充验收（按需）

1. 记录文件结构：比对是否包含 `desktop-server` 与资源文件。
2. 体验验证：页面加载、菜单响应延时、窗口大小与缩放。
3. 升级回归：从旧版升级安装后执行“打开->保存->build->preview”一遍。

## 八、录屏与证据

每条关键路径至少留下一条短视频/截图：
- 打开应用
- 新建并保存页面
- Build 成功
- Preview 成功

## 九、验收结果模板

- 测试版本（版本号/提交）：
- 测试人：
- 开始时间：
- 结束时间：
- P0 通过（是/否）：
- P1 通过（是/否）：
- 阻断项：
- 备注：


## 2026-04-26 执行记录（当前环境）

- 执行版本：`1.0.0`
- 执行命令：`pnpm build:desktop:full`
- 结果：打包流程启动成功，已完成 `desktop:export`、`@anydocs/web` 构建、`@anydocs/cli`、`@anydocs/desktop-server`，进入 `@anydocs/desktop tauri:build:app` 阶段；当前环境工具链在打包流程后段无持续输出，需本地机器再次复核是否完整产物稳定。
- 产物检查：
- `.app`：
  - full：`dist/desktop/full/macos/*.app`
  - lite：`dist/desktop/lite/macos/*.app`
- `.dmg`：
  - full：`dist/desktop/full/dmg/Anydocs-full_*.dmg`
  - lite：`dist/desktop/lite/dmg/Anydocs-lite_*.dmg`
  - `Info.plist` 版本/标识：`1.0.0`, `com.anydocs.desktop`
  - 资源包含：`Resources/desktop-server/dist/index.js`、`Resources/cli/dist/index.js`
- 启动性验证结果（受限环境）：
  - 直接启动主二进制：`open` 失败（`kLSNoExecutableErr`）
  - 直接执行二进制：启动时会尝试监听 `127.0.0.1` 端口，抛出 `listen EPERM`
  - 结论：当前会话环境不允许本地监听端口，导致无法完成桌面 UI 交互级 smoke（功能场景需在本机 GUI 环境执行）
- 风险：
  - 产物路径存在且资源完整，但未完成“打开应用、创建/保存页面、Build/Preview”三级关键流程验证
  - 需在可运行 GUI 的机器上复跑以下命令链：
    1. 打开 `.app`
    2. 打开样例项目并完成 P0 基础流
    3. 重新验证 `Build` -> `Preview` -> `dist` 可达性

## 2026-04-26 执行记录（直接运行）

- 执行人：系统内联会话
- 执行命令 1：
  - `ANYDOCS_E2E_STUDIO_MODE=desktop pnpm --filter @anydocs/web exec playwright test tests/e2e/desktop-runtime.spec.ts`
  - 结果：`Error: listen EPERM: operation not permitted 0.0.0.0:3000`
  - 结论：当前环境不允许启动 Playwright 管理的本地 WebServer，测试无法进入 UI 用例。
- 执行命令 2（打包产物一致性脚本）：
  - 结果：通过项：app/dmg/可执行体、`desktop-server` 与 `cli/core` bundle、`symlink manifest`、可执行权限均存在。
  - 未通过：`binary --help` 不输出帮助信息（该路径为 GUI 可执行体，非 CLI 命令入口，预期不稳定）。
  - 结论：产物结构通过，当前环境不支持“启动行为的交互级验证”。
- 结论：在当前受限运行时，无法替代人工 GUI 验证打包后的桌面应用行为；请在真实 macOS 桌面环境复测。
