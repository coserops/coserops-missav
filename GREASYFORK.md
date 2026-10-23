<img src="https://raw.githubusercontent.com/coserops/coserops-missav/main/logo.png" alt="CoserOps MissAV 播放器脚本 Logo" width="96">

# CoserOps MissAV 播放器脚本

[更多 CoserOps 项目](https://github.com/orgs/coserops/repositories) · [联系作者：X @coserops](https://x.com/coserops)

在 MissAV 网页播放时，减少切换窗口的打断，记住画质与语言，让重复设置少一些。安装后可从页面右上方打开设置，在播放页查看视频源与下载选项。

## 播放时少些重复操作

- **切换窗口，少些暂停**：拦截适配播放器的失焦暂停调用；不保证后台持续播放，也可能拦截失焦时经同一接口发出的主动暂停。
- **自动扩大播放区域**：按布局收起右侧侧栏，保留下方内容；不是全屏或通用广告拦截，页面改版可能影响效果。
- **画质与语言记住一次**：保存常用画质和网站界面语言，下次自动尝试应用。画质以视频可用档位为准，语言需有对应入口，不改变字幕或音轨。
- **先看清来源，再下载**：集中查看画质、时长和大小，提供浏览器保存、复制链接及 FFmpeg 命令。列表可能含预览或广告，HLS 大小为估算；加密、独立音轨等特殊 HLS 或 DASH 需尝试 FFmpeg，不保证成功。

## 开始使用

1. 安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/index.php?locale=zh_cn)，打开下方 Sleazy Fork 发布页，点击 **安装此脚本**，在脚本管理器中确认安装。
2. 打开或刷新支持的网站，点击“播放器脚本设置”，选择偏好后“保存并应用”，查看运行状态。
3. 播放页点击“视频下载”；没有来源时先播放，再点“重新获取”。仅保存有权下载的内容。

后续通过脚本管理器检查并获取 Sleazy Fork 更新，或回到同一发布页安装更新。自动更新取决于管理器设置和有效元数据；当前源码仍声明 GitHub 更新源，详情见 README。

## 使用前了解

匹配 HTTPS 域名：`missav.ws`、`missav01.com`、`missav123.com`、`missav.live`、`missav.ai`、`missav.fans`、`missav.media`，不自动覆盖其他镜像或子域名。

无需 API Key 或脚本付费配置，网站访问条件另计；FFmpeg 命令需自行安装工具。偏好与版本已读状态保存在脚本管理器，语言跳转保护使用网站会话存储。打开下载面板即会向媒体服务器读取列表和文件信息，手动下载才保存视频；源链接可能含令牌，请勿公开分享。网络限制仍适用；不能流式写盘时，浏览器内存下载上限为 512 MiB。

功能说明依据当前源码，平台版本可能不同，详细操作与限制见下方 README。

## 下载与源码

- [Sleazy Fork 下载、安装与更新](https://sleazyfork.org/zh-CN/scripts/601634-coserops-missav-%E6%92%AD%E6%94%BE%E5%99%A8%E8%84%9A%E6%9C%AC)
- [GitHub 源码与使用说明](https://github.com/coserops/coserops-missav)
