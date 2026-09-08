# 无限画布 · ComfyUI MiniMax-H3 版

这是一个支持本地 ComfyUI MiniMax-H3 工作流的无限画布版本。可以在画布中连接参考图片、参考视频和参考音频，直接调用本机 ComfyUI 生成视频，不需要每次进入 ComfyUI 手动替换素材或重新连线。

## 已完成功能

- 无限画布：创建、移动、缩放和连接图片、视频、音频、文本及生成配置节点。
- 核心创作：在画布内完成图片、视频、音频和文本节点的生成与组合，不再提供独立的生图工作台、视频工作台和提示词库。
- 独立素材上传：从画布节点菜单直接上传图片、视频或音频，上传节点与生成节点相互分离。
- 本地 ComfyUI：浏览器通过 ComfyUI 标准 HTTP 接口连接官方版、源码版、桌面版或第三方整合包；`http://127.0.0.1:8188` 只是默认地址。
- 本地服务快捷接入：内置 ComfyUI、Ollama、LM Studio 和通用 OpenAI 兼容服务预设，本地无鉴权服务可不填 API Key。
- 云端 API 保留：仍可添加 OpenAI、Gemini、火山方舟及其他兼容接口。
- MiniMax-H3 全能参考：支持最多 9 张参考图、3 个参考视频和 3 个独立参考音频。
- 动态参考素材：只把画布中实际连接的素材传入本次工作流；没有连接的参考槽位会自动移除。
- 视频音轨参考：参考视频自身的音轨会连接到对应的视频音频参考输入。
- 自动执行：自动上传素材、填写提示词、设置时长和比例、提交工作流、等待生成并把成品视频放回画布。
- 自带工作流接入：每个 ComfyUI 模型都能上传自己的 API 格式工作流，自动识别输入和参考槽位，并检查当前 ComfyUI 是否缺少节点。
- 生成前检查：提交前显示最终提示词、模型参数、参考素材顺序、工作流槽位和输出节点，发现槽位超量或映射丢失时阻止提交。
- 视频参数：所有视频模型支持比例选择、自定义宽高以及 5/10/15 秒和自定义时长；MiniMax-H3 额外支持 0.4 MP 与 0.9 MP。
- 后端同步取消：停止画布中的 ComfyUI 任务时，同时取消对应的 ComfyUI 排队或运行任务。
- 节点键盘删除：选中节点后可使用 Backspace 或 Delete 删除，输入框和弹窗内不会误删节点。
- 本地服务状态：配置页集中显示本机服务是否在线、连接耗时以及 ComfyUI 版本或模型数量。
- 生成任务中心：画布右上角统一查看、定位、取消和清理等待中、运行中、已完成、失败或已取消的任务。
- 参考自动排序：连接素材按画布中从上到下、同排从左到右自动编号；组装提示词中明确插入的引用顺序仍优先生效。
- 素材重新关联：浏览器本地图片、视频或音频丢失后保留节点与连线，并可从画布右上角选择原文件恢复。
- 源码一键更新：画布右上角可从本仓库 `main` 分支安全更新本地源码，不会强制覆盖本地修改。
- Windows 桌面版：GitHub Release 提供独立安装程序，并通过同一仓库接收后续版本更新。
- 安全调用：已删除未实现的 AI 超分入口和任意自定义调用脚本，ComfyUI 工作流由固定调用器执行。
- 本地保存：画布、素材和渠道配置默认保存在当前浏览器中。

## 尚未完成

当前核心画布、ComfyUI 工作流接入和本轮计划功能均已写入代码，仍需要按[待测试清单](docs/content/docs/progress/pending-test.zh-CN.mdx)进行实际使用验证。后续开发项目记录在 [TODO](docs/content/docs/progress/todo.zh-CN.mdx)，目前主要是：

- 将 Claude Code CLI Adapter 升级为 Claude Agent SDK Adapter，并继续完善 Agent 工具队列。
- 增加从网络检索安装 Skill、Skill 资源文件管理和可控的本地记忆功能。
- 取得可信证书后为 Windows 安装包增加代码签名，并在 Windows 发布链路稳定后评估 macOS 与 Linux 版本。
- 等待 `@ant-design/pro-components` 3.x 提供兼容的上游修复后，移除其语法高亮依赖链剩余的中等级安全告警；当前不强制降级到不兼容的 2.x。

## 项目说明

本项目由 `kiligsqsq-ctrl` 独立维护，源码、版本、发行包和自动更新均以本仓库为准。项目依法保留所使用 MIT 开源代码的版权与许可声明，具体内容见 [LICENSE](LICENSE)。

## Windows 桌面版

普通 Windows 用户可以在 [GitHub Releases](https://github.com/kiligsqsq-ctrl/infinite-canvas-comfyui/releases) 下载最新版本中以 `.exe` 结尾的安装程序。安装后从开始菜单启动即可，不需要另外安装 Git、Bun 或 Node.js。桌面包已包含画布前端和 Canvas Agent；进入右侧 Agent 面板可点击「启动内置 Agent」。ComfyUI 和模型文件仍由用户自行安装、启动并在画布中填写地址。

应用会根据同一版本发布中的 `latest.yml` 和 `.blockmap` 检查更新。收到新版本提示后按应用提示下载并重启，画布和配置数据会继续保存在本机。桌面版连接本机或局域网 ComfyUI 时会使用只允许私有地址的内置代理，因此无需给 ComfyUI 增加浏览器 CORS 参数；源码安装仍按下文配置 CORS，并使用 Git 更新通道。

`v0.0.1` 暂未配置商业代码签名证书，Windows SmartScreen 可能显示「未知发布者」。请只从本仓库 Releases 下载，并在核对来源后继续安装。

维护者发布版本时，先整理 `CHANGELOG.md`，然后使用版本脚本。当前版本从根目录 `VERSION` 读取，版本依次为 `0.0.1` 至 `0.0.5`、`0.1.0` 至 `0.1.5`、`0.2.0`，以此类推：

```powershell
node scripts/version.mjs next
node scripts/version.mjs bump
$releaseVersion = Get-Content VERSION
node scripts/version.mjs check "v$releaseVersion"
git add -A
git commit -m "release: v$releaseVersion"
git tag "v$releaseVersion"
git push origin main
git push origin "v$releaseVersion"
```

首次发布已有的 `0.0.1` 时跳过 `bump`。推送格式严格为 `v<主版本>.<次版本>.<补丁版本>` 的 tag 后，Windows 工作流会校验根版本、桌面端、Web 与 Canvas Agent 的版本，并确认 tag 相对最近的合法版本严格递增；随后从干净检出构建桌面包，把 `.exe`、`.blockmap` 和 `latest.yml` 上传到对应的 GitHub Release。本地发版流程不需要手工构建安装包。

## 源码运行前准备

本节及后续命令用于源码开发方式。安装 Windows 桌面版的用户不需要 Git 或 Bun，可以直接跳到「三、启动 ComfyUI」。使用源码方式前，请确认电脑中已经具备：

1. Git。
2. Bun。
3. 任意能够提供标准 HTTP API 的 ComfyUI，例如官方桌面版、官方源码版、便携版或第三方整合包。
4. 能在自己的 ComfyUI 中正常运行的目标工作流，以及该工作流需要的模型、VAE、CLIP、LoRA 和自定义节点。

本仓库只包含画布和调用功能，不包含 MiniMax-H3 或其他模型文件。画布不读取 ComfyUI 的安装目录，也不依赖任何特定启动器。

## 一、源码方式：下载仓库

```bash
git clone https://github.com/kiligsqsq-ctrl/infinite-canvas-comfyui.git
cd infinite-canvas-comfyui
cd web
```

也可以在 GitHub 仓库页面点击 `Code` → `Download ZIP`，解压后进入其中的 `web` 文件夹。

## 二、源码方式：安装并启动无限画布

第一次运行时，在 `web` 文件夹中执行：

```bash
bun install
bun run dev
```

看到下面的地址后，在浏览器中打开：

```text
http://localhost:3000
```

以后再次使用时，进入 `web` 文件夹执行：

```bash
bun run dev
```

运行画布的命令窗口需要保持打开。

## 三、启动 ComfyUI

在你自己的 ComfyUI 启动参数中加入：

```text
--enable-cors-header http://localhost:3000
```

源码版或命令行版也可以这样启动：

```bash
python main.py --enable-cors-header http://localhost:3000
```

然后确认自己的 ComfyUI 地址能够在浏览器中打开，例如：

```text
http://127.0.0.1:8188
```

`8188` 只是 ComfyUI 常见的默认端口，不是强制端口。如果你的 ComfyUI 使用其他端口或局域网地址，后面的接口地址填写实际地址即可。使用浏览器源码版时需要允许来自 `http://localhost:3000` 的跨域访问；Windows 桌面版不需要这项启动参数。

## 四、在无限画布中配置 ComfyUI

源码方式打开 `http://localhost:3000`；Windows 桌面版从开始菜单启动。进入画布后：

1. 点击右上角“配置”。
2. 打开“渠道”页面。
3. 在“本地服务快捷接入”中点击“ComfyUI · MiniMax-H3”。
4. 系统会自动填入示例地址 `http://127.0.0.1:8188`，并加入 `MiniMax-H3` 视频模型。
5. 本地 ComfyUI 默认不需要 API Key，保持空白即可。
6. 如果你的 ComfyUI 端口不是 `8188`，只修改“接口地址”中的端口。
7. 点击“测试连接”，看到连接成功。
8. 必须点击模型右侧的“上传 API 工作流”，导入你从自己的 ComfyUI 导出的 API 格式 JSON。
9. 检查自动识别的提示词、时长、比例、参考槽位和输出节点，再点击“检查当前 ComfyUI”。缺少节点时会直接列出节点类型。
10. 保存工作流映射，再点击渠道右上角“保存”。以后生成时会使用这个本地工作流，不要求和仓库作者拥有完全相同的工作流。

Ollama、LM Studio 和其他本地 OpenAI 兼容服务也可以在同一区域快捷添加。添加后点击“选择模型”→“拉取模型列表”；如果服务不提供 `/models` 接口，也可以手动填写模型名称。

云端 API 没有被删除：点击“新增 API 渠道”即可继续配置协议、接口地址、API Key 和模型能力。

如果没有看到“本地服务快捷接入”，请重新启动画布，然后在浏览器中按 `Ctrl + F5` 强制刷新。

## 五、一键更新

页面右上角的云下载按钮用于一键更新画布。源码开发模式会固定从 `kiligsqsq-ctrl/infinite-canvas-comfyui` 仓库的 `main` 分支获取最新版，并在完成后自动刷新网页；Windows 桌面版则检查 GitHub Releases，下载完成后提示重启安装。

下面三个条件只适用于源码方式的一键更新：

- 使用 `git clone` 安装，而不是下载 ZIP。
- 当前位于 `main` 分支。
- 本地源码没有未提交或未跟踪的文件。

本地与仓库版本发生分叉时，更新会安全停止，不会强制覆盖文件。

## 六、在画布中生成视频

1. 把需要使用的图片、视频和音频添加到画布。
2. 创建视频生成配置节点，选择 `MiniMax-H3`。
3. 把本次需要参考的素材连接到视频生成配置节点。
4. 输入视频提示词并开始生成。
5. 画布会自动把素材上传到 ComfyUI，运行工作流并等待结果。
6. 生成完成后，视频会自动添加回画布。

参考素材按照画布传入顺序排列：第一张连接的图片对应第一个图片参考槽位，第一个视频对应第一个视频参考槽位，第一个独立音频对应第一个音频参考槽位。

不需要使用的素材不要连接，也不需要打开 ComfyUI 手动修改工作流。如果你上传的工作流准备了 9 图、3 视频和 3 音频槽位，画布只会填入本次实际连接的素材并移除未使用的加载节点；实际参考数量仍需遵守模型和当前工作流的限制。

## 常见问题

### 无法连接 ComfyUI

确认以下三项：

- ComfyUI 已经启动。
- 浏览器能够打开 `http://127.0.0.1:8188`。
- 使用浏览器源码版时，ComfyUI 启动参数中已经加入 `--enable-cors-header http://localhost:3000`；Windows 桌面版无需添加。

官方版、源码版和整合包使用的是同一套连接逻辑。画布只访问 `/system_stats`、`/object_info`、`/upload/image`、`/prompt`、`/history`、`/view` 和取消任务等标准接口，不识别也不要求某个整合包。

### 工作流兼容性检查提示缺少节点

“检查当前 ComfyUI”会读取当前实例实际注册的节点类型，并和上传的 API 工作流逐项对比。先在 ComfyUI 中安装提示的自定义节点并重启，再重新检查。

节点检查无法确认磁盘上的模型文件。模型、VAE、CLIP、LoRA 等仍需在 ComfyUI 中加载并先成功运行一次工作流。

### 打开画布后没有 MiniMax-H3 预设

关闭旧的画布进程，在 `web` 文件夹重新执行：

```bash
bun run dev
```

然后在浏览器中按 `Ctrl + F5`。

### 别人安装后不能生成

不要求对方使用秋叶整合包，也不要求 ComfyUI 安装路径相同。对方只需启动任意兼容的 ComfyUI、安装自己工作流所需的节点和模型，然后在画布中上传自己的 API 格式工作流并完成映射。
