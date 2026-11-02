# 原生生图关键路径验证

日期：2026-11-01。宿主：OpenClaw `2026.10.9 (8b18b55)`，Windows，Agent `main`。验证目标为 `google/gemini-3-pro-image`、2K、单图、带本地主头像，不指定画幅。

## 当前结论

用户批准的 Google 单域名 fake-IP 排除已完成，域名已恢复公网解析。**两次获准的真实 Google 生成均已成功：headless 返回图片，原生聊天异步交付附件。** 当时完成回合执行保存失败；用户最新已明确取消普通自拍额外副本能力，该失败保留为历史证据，不再阻塞当前方案。

另一次仅复用现有图片验证了“原用户回合保存后回复附件”，没有新增生图。该保存分支最终不采用，不属于正式产品能力，也不删除已产生的用户测试文件。

后续用户已确认 bili 改用官方 plugin runtime 直接接收图片字节，不再强制入库。该内存接口已实现并通过离线官方 runtime 兼容验证、公开 PluginApi 类型检查和本地回归；没有进行第三次付费生图或声称完成不存在于本仓库的 bili plugin 联调。

## DNS 修复

- 初次两条路径均被 fake-IP 地址 `198.18.0.203` 拦截。
- 用户明确批准后，在 Clash 的 dns_config.yaml 和当前生成配置 clash-verge.yaml 中，仅新增 `generativelanguage.googleapis.com` 的 fake-IP 排除项，其他字段经语义比较未变。
- 修改前在原配置目录备份；通过实际生产 Mihomo 本地管道重新加载，保留原控制接口。解析随后返回 Google 的公网 IPv4/IPv6。
- 未修改 OpenClaw 安全检查，未启用 allowPrivateNetwork，未改变其他域名规则。

## bili headless 路径

- 通过实际宿主 CLI 的 `infer image edit`，显式指定 main、Google Pro、单图、2K、参考图和输出位置。
- DNS 修复后的真实调用返回退出码 0、ok=true、provider=google、model=gemini-3-pro-image，ignoredOverrides 为空。
- 请求输出名为 generated.png，实际 outputs 返回 generated.jpg、image/jpeg、2,606,358 字节、1686×2528；保存按实际格式处理，没有猜扩展名。
- 素材 ID：`0cb5651e-56e3-4021-aa79-83fb0df17ed8`；所属 main，生成结果完成记录时间为 `2026-11-01T11:00:09.977Z`。
- 已写入实际 Agent 工作区的 materials/<ID>/image.jpg 和 material.json；文件可读取，SHA256 与 CLI 源输出一致。
- 此路径没有启动聊天 Agent 回合，没有单独向聊天交付图片。它证明原生生成与提交的技术衔接可行，尚不代表完整 bili plugin 联调或生产接口已完成。

## 聊天异步路径

- 使用独立验证会话，未向其他渠道发送，不覆盖 main 现有对话。
- 会话实际调用了 `image_generate`，工具立即返回 `async=true`、`status=started` 和 task ID。
- 首次完成回合正确报告网络失败；DNS 修复后的第二次验证实际生成了一张 JPEG，完成回复包含一个原生图片附件，没有重复生成。
- **成功完成回合的工具目录从原始回合的 53 个缩减为 12 个，只提供读取、检索等能力；没有系统进程执行或文件写入工具。** Code Mode 的 exec 是 JavaScript 工具编排沙箱，不能等同于 Shell 执行工具。
- Agent 在完成回合发现这一限制后，明确报告保存失败并交付原图；对应预留素材 ID 当时没有生成 material.json。按设计要求，没有换接口再次生图，也没有伪造保存成功。
- 源码确认完成事件含结构化附件路径，但这不等于获得保存权限。实测结果足以否定“仅靠完成提示词即可可靠执行保存脚本”的假设；不能修改宿主权限或通过沙箱绕过该限制。
- 当前只验证了该宿主的具体运行路径，不推论所有版本、所有客户端都禁止完成回合写入；现有设计也不能依赖它在其他环境中一定可写。
- 当前宿主 Agent 的初始答复泄露了内部 task ID；正式 skill 应明确要求只简短确认，内部标识不进入用户回复。

## 历史候选方案的无生图验证（最终未采用）

- 在同一隔离会话发起显式用户回合，只复用已生成的 bili 测试图，执行保存脚本；禁止任何新的生图。
- 保存成功，返回素材 `ec13a75c-d894-46f6-a232-34c6ec7e1c3e` 及其文件路径。
- 原生 Agent 返回 payload 的 mediaUrl/mediaUrls 指向该持久图片，实现当前回复的附件交付，没有调用 message send 或其他渠道目标。
- 当时的候选方案为明确保存请求改走 CLI 生成入库，再回复附件；未要求保存时原生异步交付。
- 该分支后来因用户明确取消普通自拍副本而退役，不再待决策，也不实施新的完整生成入库测试。

## plugin 直接接收图片的官方入口（补充核对）

根据用户对“不保存备份，直接返回 bili plugin”的追问，补充核对官方 plugin runtime：

- `api.runtime.imageGeneration.generate(...)` 是官方公开的 plugin 生图入口；本机 2026.10.9 将它委托给与 image_generate 相同的核心 generateImage 实现。
- 本机类型的输入为 cfg、prompt、agentDir、modelOverride、inputImages、count、resolution 等；结果 images 中直接包含 buffer、mimeType、可选 fileName，同时有 provider/model/attempts/ignoredOverrides。
- 核心 generateImage 返回图片字节，没有聊天工具封装中的素材落盘、异步会话唤醒和聊天交付步骤。因此同宿主 bili plugin 可以取得图片字节，由自己的后续流程处理，无需为了交接而复制到 Stella 持久库，也无需自有 Google SDK。
- 聊天 `image_generate` 本身仍是会话工具：成功后先写宿主管理媒体，再完成会话交付；它没有一个可据此承诺“仅返回 bili，关闭聊天交付”的普通参数。取消额外备份并不自动改变其会话交付语义。
- 用户已确认内存字节交接，覆盖此前 bili 的强制入库和长期素材记录要求；bili 接口不创建素材库、持久 ID 或文件路径。随后用户也明确取消普通自拍额外副本能力。
- 已实现 scripts/bili.ts 和 references/bili-integration.md，并纳入发布白名单。没有新增 Stella plugin，也不使用供应商 SDK。
- scripts/verify-bili-runtime.mjs 通过公开 image-generation-runtime 导出，注入一个只返回本地测试 PNG 的 provider，实际运行宿主核心参数规范化与结果返回；断言原样 prompt、绑定 Agent 认证目录、单图、2K、默认无比例、一次调用、返回 Buffer、没有创建素材文件。该验证不联网、不使用真实头像或 key。
- 另外通过本机公开 OpenClawPluginApi 与 listAgentIds 的 TypeScript 编译检查，确认适配器可接受实际插件 api，不仅是测试自定义对象。
- bili 接口初版回归为 176 通过、1 个原有平台用例跳过，构建通过；该数字包含后来退役的 provider/sender/save 测试，不代表最终测试数。真实消费端预览/上传需在该 plugin 中验证。
- 实际白名单包包含 bili.js 和集成文档，并保留 SHA256 清单；从独立 staging 包加载 bili 模块，重复离线官方 runtime 验证通过，不依赖仓库的 provider SDK 安装。维护者验证脚本不进入发布白名单。

依据：[Plugin runtime media helpers](https://docs.openclaw.ai/plugins/sdk-runtime/media#api-runtime-imagegeneration)。该页 cfg/prompt 示例与本机类型一致；architecture-internals 页仍有 config/args 的不同写法，实施以所支持宿主的公开类型和实际接口验证为准。

## 历史本地保存验证（非当前产品能力）

已使用人工构造的有效小图片，在工作区内的独立测试目录完成：

- 图片和 material.json 一起提交，记录可解析且文件可读取。
- 同一保存 ID 重放复用原记录，生成时间与 ID 保持不变。
- 相同 ID 使用不同 Agent 重放时拒绝。
- 测试临时目录已删除；没有将测试图导入真实人物素材库。

这只验证维护者探针的保存步骤，尚不代表最终素材管理实现或完整安全/并发验收通过。

## 探针与原始证据

本次真实生成使用一次性探针，以 Node 参数数组运行宿主 CLI；探针已在验证完成后清理，不属于运行包或当前产品能力。它没有直接使用 Google SDK。

历史 infer/chat/history/save 的本地输入、配置和原始结果位于被 git 忽略的 out/native-verification/，已生成的用户文件继续保留；不将配置、会话内容或头像复制进发布包。可复用的无网络 runtime 验证保留为 scripts/verify-bili-runtime.mjs。

最终迁移：

1. bili 内存交接已实现，消费端按 references/bili-integration.md 接入自己的预览/上传流程。
2. 用户明确取消普通自拍副本后，聊天统一原生 image_generate，已实现 prepare/release 参考图流程，不再实现保存分支。
3. 已安装源码确认原生工具在异步任务返回前读取参考图；快照在发起回合释放，不依赖完成回合写权限。新入口的快照隔离、并发、清理边界、参数及退役字段拒绝有本地测试。
4. 已移除旧 provider/sender/SDK；安装、打包、同步和双语文档同步迁移。最终本地检查结果在文末记录，不能把无生成 smoke 或离线 runtime 当作新增真实生图。

参考：[OpenClaw 原生生图](https://docs.openclaw.ai/tools/image-generation)、[Inference CLI](https://docs.openclaw.ai/cli/infer)、[回复附件协议](https://docs.openclaw.ai/reference/rich-output-protocol)、[完成回合权限边界](https://docs.openclaw.ai/tools/subagents/announce)、[Mihomo fake-IP 过滤规则](https://wiki.metacubex.one/en/config/dns/)。完成回合权限结论以本次实际工具目录为直接证据，不把子 Agent 文档泛化为所有生图宿主的保证。

## 迁移初版本地回归（2026-11-01，后续三项修复见下）

- 清理旧 dist 后重新构建通过；运行包 npm dependencies 为空，lockfile 已同步。
- 当时测试 87 通过、1 跳过。跳过的是原有非 Windows release command 用例；Windows junction 授权测试在宿主环境通过，未跳过。
- 已安装 main Agent 的无生成 smoke 通过三种模式：每次三张有效参考图、Google Pro、2K，默认无画幅；输入快照全部释放，没有上传或新增生图。
- 官方 OpenClawPluginApi 与 listAgentIds 的实际公开类型编译通过；无私有 dist 运行时依赖。
- 官方核心离线验证通过：本地假 provider 单次调用，返回 Buffer，不创建素材文件，不联网。
- 独立白名单包的 13 个运行文件可加载，支持模块无缺失；同一离线验证通过。SHA256 内容指纹为 c4462a883932de051fac804ecdea7e588818d957b5f2c7b9707f85ce4868ab24。
- 本地同步在独立临时安装目录通过，保留用户文件，不复制源码、node_modules 或私人数据；临时包、测试安装目录和类型探针已清理。
- 未增加第三次付费生图，未安装或发布本次版本；bili 消费端预览/上传仍需在其插件仓库联调。

## 三项 review 修复与复核（2026-11-01）

- 首次跨进程建目录竞争：不再先 existsSync 再 mkdirSync，改为直接创建，仅容忍 EEXIST 后继续校验目录类型、链接和工作区边界。新增两个真实进程在共同父目录创建前同步释放的回归，两个请求均成功且互不清理对方快照；权限错误仍失败。
- 部分写入清理：参考图与 manifest 先独占创建并登记，再通过句柄写入。ENOSPC 等写入失败能清理已登记的半文件；单个清理失败仍尝试其他文件，最初错误保持不变，残留目录有明确诊断。新增参考图/清单半写入、清理失败、关闭失败及非本次所有文件碰撞保护用例。
- 参考图保真边界：保留原生聊天架构，SKILL、双语 README、bili 集成说明及设计文档一致说明聊天宿主可能缩放/重编码，bili 直接传 Buffer。前轮离线检查中，合法 3000×1000 PNG 被宿主优化为 2046×682 JPEG；这不是 Stella 的固定尺寸规则。20 MiB 本地校验、宿主媒体预算及成品分辨率分别看待，不再承诺聊天原始字节上传。
- 构建通过，全套测试 **96 通过、1 个原有平台用例跳过**。其中新增 8 个文件系统回归和 1 个文档契约回归；未跳过 Windows junction 用例。
- 独立白名单包仍为 13 个运行文件；包内 prepare/release 与官方 runtime 的离线 bili Buffer 验证均通过，无运行时 npm 依赖。当前包 SHA256 内容指纹为 **988329bab6946a11e4d05aaa5fbc6cfd46736f78cbaf993a027e8c8667e4c2bc**；旧指纹只对应前一节的历史包。
- 修复后的实际 main Agent 无生成 smoke 通过三种模式：每次选出三张参考图，默认 Google Pro/2K，不指定画幅，快照全部释放；本次元数据读取比前次慢，但最终正常完成。未上传参考图或调用生成。
- 修复后分别进行 Standards 与 Spec 只读复核，未发现新的阻塞问题；普通聊天异步交付、bili 内存交接及其他已确认取舍未改变。
- 临时运行包及测试工作区已清理。未新增付费生图，未安装或发布本次版本。

## 2.0.0 本机实际安装验收与发布（2026-11-01）

- 用户要求“本机实际安装测试，验收通过后发布”。因本次移除了旧 provider、跨渠道、批量及保存接口，版本提升为 2.0.0；此前公开 latest 为 1.3.3。
- 实际安装位置为 C:/Users/shixiong/.openclaw/workspace/skills/stella-selfie，宿主发现来源为 openclaw-workspace、eligible=true，无 skill 专用 provider key 门槛。旧安装完整保留在 C:/Users/shixiong/.openclaw/backups/stella-selfie-1.3.3-before-2.0.0-20261101-203203。
- 13 个已安装运行文件与最终发布暂存包逐文件 SHA256 一致。最终本地清单指纹为 33149ee7301107e622c229a17587ed178af570fc90c9a1ab756ec474642df14b；ClawHub 使用自己的指纹算法，不直接比较两种整体指纹。
- 用户另行明确批准聊天、bili 各一次真实 Google Pro/2K 生图和上传 main 当前三张人物参考图。没有把此前仅覆盖两次验证的授权自行延伸。
- bili 首次本地尝试在 URL 地址检查时被 fake-IP 拦截，没有进入 Google 请求。dns_config.yaml 原排除项仍在，但代理当前生成配置丢失了该项；按用户此前单域名授权恢复 generativelanguage.googleapis.com 排除并重载，DNS 恢复公网地址，未关闭 OpenClaw 安全检查。
- 聊天在独立 main 验收会话读取已安装 SKILL，执行 prepare → 原生 image_generate → release。只有一次 generate，使用 Google Pro、2K、三张参考图，未传 aspectRatio/size；最终收到一张 JPEG 结构化附件及准确配文“Stella 2.0.0 安装验收”，没有第二次生图或跨渠道发送。
- 聊天验收的早期环境探针及 PowerShell 引号、cmd 清理错误造成了两次额外 status 查询和一份遗留请求 JSON；无额外 Google 生成。参考图快照均已释放，遗留且内容已核实属于本次验收的 JSON 已用 LiteralPath 清理。随后在 SKILL 和双语 README 补齐 PowerShell 的 & 调用、LiteralPath 清理、等待准备/清理进程完成及区分进程通知与图片完成事件的指引，并重新同步安装。
- bili 从已安装模块加载 generateForBili，使用宿主公开 config、Agent 和 image-generation-runtime 接口，原生认证由宿主解析；单次实际生成返回 JPEG Buffer 2,668,206 字节，SHA256 为 cd4771e2caecdeef787984e372f23af2d170d9966e30107710ad0f1c5dc6e2f5。不保存图片文件、不创建素材记录、不自动聊天交付；这里验收的是正式适配器，消费端运营插件的上传/发布流程不在本仓库。
- 最终构建通过，测试 96 通过、1 个原有平台用例跳过。安装与实测原始证据位于 git 忽略的 out/acceptance-2.0.0/，不进入运行包。
- OpenClaw 原生 `skills install <本地验收包> --agent main --force` 安装成功；其中 force 仅覆盖同一份已验收的工作区 skill，没有使用 force-install 或跳过安全策略。安装后再次确认全部 13 文件 SHA256 匹配。
- 最终 13 文件发布包 dry-run 通过。三次普通 CLI 发布因 ClawHub 间歇性 HTTP500、写入背压及超时中断；失败不仅出现在上传，还出现在 whoami 查询。诊断未发现认证或包校验失败。
- 随后使用同一套官方 API、认证和上传凭证逐文件记录进度，遵守退避。已完成 5/13 文件；第六个文件 images.js 的上传授权请求连续六次退避后仍返回服务端500。存储端另将“Too many writes in a short period of time”作为400返回，导致原 CLI 提前退出；续传对这一明确背压至少等待60秒，不把普通400当成可重试错误。
- **当前结果：本机安装与真实生图验收通过，ClawHub 2.0.0 发布尚未完成。** 当前续传流程尚未发出最终版本提交，不能声称通过了公开扫描、正式上架或下载校验；没有使用其他账号、端点或强制安装标志绕过平台限制。
- 收尾只读探针确认登录仍有效，匿名确切版本查询也返回 HTTP500；当前服务状态无法完成公开可用性核对。本地 release-status.json 记录了未发布状态，主安装的13个文件仍全部匹配最终清单。
- 已验收的最终暂存包、13 文件哈希清单、accepted.json 和私有 upload-progress.json 保留在 out/acceptance-2.0.0/，用于继续同一份发布；上传进度可能含短期上传凭证，不提交 Git 或附到公开问题中。一次性生图、DNS和诊断脚本在收尾删除。
- 服务恢复后可运行该目录的 resumable-publish.mjs 继续，再用 verify-public.mjs 的 inspect/security/download 做正常公开校验。公开下载的13个文件须逐项匹配本地清单；最后可用原生 OpenClaw 安装确切公开版本以更新来源记录。恢复发布不需要再次生图。

## 冗余清理与局部重构（2026-11-01）

- 删除未接入当前入口、仍含退役 provider 配置的 .env.example，以及 smoke/avatars 两张 PNG 和 assets 三张 JPG。全仓引用核对确认这五张静态图片不参与运行、测试、文档或发布，合计 5,966,177 字节；历史生成图片不在删除范围内。
- release-clawhub.mjs 共用进程调用封装与 git 提交标题解析，保留 Windows/POSIX 执行方式、输出及失败处理，移除无对应 ESLint 配置的抑制注释。
- 共享参数准备接口仅要求 Agent 解析与 provider 查询，聊天无需提供永远不会调用的 generate 占位；StellaHost 和 generateForBili 的公开调用方式不变。
- 参考图与聊天快照复用同一个路径包含判断，快照扩展名统一使用现有内容签名识别器。保留 JPEG/PNG/WebP、20 MiB、二次读取、链接边界、首次并发建目录及部分写入清理检查。
- 构建通过，回归 98 通过、1 个原有平台用例跳过；新增 JPEG/WebP 按内容命名与释放的两个用例。沙箱首轮因无法创建 junction 导致三个用例在准备阶段失败，随后在宿主环境重跑全套通过，未跳过这些边界用例。
- Windows 实际执行 release-clawhub.mjs --skip-test --prepare-only 通过，覆盖 git 查询、changelog 生成、npm 构建及 13 文件白名单暂存；未上传。官方 OpenClaw 2026.10.9 公开 runtime 的离线 bili 验证通过，只使用本地合成图片，不联网、不生成付费图片。
- 上一轮发布重试已从 5/13 推进到 12/13；templates/SOUL.fragment.md 上传授权连续六次尝试仍失败，最终版本提交未发出，确切版本查询仍为 Version not found。
- 原验收包、accepted.json、哈希清单及 12/13 续传记录完整保留，仍对应重构前的暂存内容。本轮没有替换已安装 skill，也没有将重构后的源码套用到旧上传记录；后续若发布本轮源码，必须重新暂存并以新指纹追踪，不能把旧续传进度当作新包的上传结果。
- 收尾逐项核对 out/ 原有 93 个文件的路径与 SHA256，全部一致。新临时白名单包的 13 项哈希、入口加载、零运行依赖及独立包官方 runtime 离线验证均通过，随后仅删除本轮新建的暂存包。
- Standards 与 Spec 分别只读复核，均无发现；未发现功能倒退、越界清理或文档与本轮实现不一致。TypeScript 未使用变量/参数检查与 git diff --check 通过。

## Darwin 本机 2.0.0 安装验收（2026-11-02）

宿主：OpenClaw `2026.10.8`，macOS Darwin，Node `24.22.1`，Agent `main`，Gateway loopback `127.0.0.1:18789`。聊天验收只走 Web Control UI，不走 Telegram 等渠道。未发布 ClawHub，未把 token/key 写入仓库。

### 测试修复

- 根因是 macOS `os.tmpdir()` 为 `/var/folders/...`，`realpath` 为 `/private/var/folders/...`。生产仍不对授权根做 realpath，只改测试：`tests/avatar-security.test.ts` 在 `mkdtemp` 后立刻 `realpathSync`；`tests/chat.test.ts` 的 EACCES 用例按 `scripts/chat.ts` 对齐 `realpathSync(workspace)` 再拼 `stella-selfie`。
- `npm test` **109 通过**；`npm run build` 通过。

### 安装与配置迁移

- 旧安装 1.3.3 完整备份到 `~/.openclaw/backups/stella-selfie-1.3.3-before-2.0.0-20261102-101408`，`openclaw.json` 备份到同目录带同一时间戳的副本。
- `npm run sync:local -- --agent main` 安装到 `~/.openclaw/workspace/main/skills/stella-selfie`：版本 2.0.0，13 个运行白名单文件，无 `dist/scripts/providers`，无运行时 npm 依赖。旧副本仍留在 `~/.openclaw/workspace/skills/stella-selfie`，未覆盖。
- 删除 `skills.entries.stella-selfie.env.Provider`（原为 `laozhang`）；不删除用户已有 key 字段，也不把 skill key 当成宿主原生 Google 认证。将 `stella-selfie` 加入 `agents.entries.main.skills`，否则会被 agent filter 挡住。
- main 的 `IDENTITY.md` 当时没有 Avatar；复制了 `avatars/stella.jpg` 与 `1.jpg` 并补了 Avatar/AvatarsDir。Gateway 重载后 skill 快照生效。宿主曾记录 `Blocked skill env overrides for GEMINI_API_KEY/LAOZHANG_API_KEY/FAL_KEY`，符合预期：生图走宿主 native Google。

### 无生图协议

- `npm run smoke -- --agent main`：三种模式 prepare/release，2 张参考图、Google Pro、2K、不生图。
- `openclaw infer image providers --agent main --json`：google 已配置，模型含 `gemini-3-pro-image`。
- 已安装副本对 OpenClaw 2026.10.8 的离线 bili runtime 通过：单图 Buffer、不落盘。
- 已安装 `skill.js prepare` + `release` 通过；`--save-dir` / `count` / `target` 明确失败。

### Web 聊天一次真实生图

- 独立会话 `c6dd4a5c3f9d43fd8f448cc49b19afbd`（标题：生成本机自拍图片测试），请求 2K、不指定画幅、只生成一张。
- 一次原生 `image_generate`（run `6de53a4d-...:ok`）成功；附件 `image-1.jpg`，JPEG 2,253,183 字节，1686×2528，SHA256 `2cde9ab376db428ce2a37bae21cbed1b9c8b9c4107ffde8f08720a35e740703b`。无第二次生图，无跨渠道。
- 偏差：Agent 走 Code Mode，两次 `skill.js prepare`（amber-cl / tidy-cor 均退出码 0）；`timeline_resolve` 被阻止（SKILL 允许跳过）；`skill.js --help` 退出码 2（CLI 无该用法，属探索失败）。成功后未调用 release，快照 `d62d9e49-452d-486d-94f9-27f1734c4baa-eBXcQn` 残留；验收结束时用已安装 `skill.js release` 清掉，未再触发生图。

### bili 一次真实生图

- 从已安装 `dist/scripts/bili.js` 加载 `generateForBili`，注入宿主公开 `config`、`runtime.agent`、`imageGeneration.generate`，以及 `listProviders` 原样转发（Stella 传 `{ cfg }`）。
- 一次 generate 已派出 `google/gemini-3-pro-image`，被宿主 SSRF 拒绝：`generativelanguage.googleapis.com` 解析为 fake-IP `198.18.0.214`。日志：`blocked URL fetch (url-fetch) ... private/internal/special-use IP address`。
- 按计划不重试、不改代理、不关 OpenClaw 安全检查。推断适配器错误为 `PERMISSION_DENIED` / stage `generate` / outcome `unknown`。无 Buffer 落盘、无 material 文件、无自动聊天交付。
- `listProviders({ cfg })` 仍能找到 google，因此失败发生在 generate 而不是校验；同函数读 `{ config }` 时列表更窄（google/minimax/openai）。宿主公开类型字段是 `config`，Stella 传 `cfg`。

### 收尾

- 一次性探针 `/tmp/stella-bili-live-once.mjs`、`/tmp/stella-dashboard-url.txt` 已删。安装目录与备份保留。原始证据在 git 忽略的 `out/acceptance-2.0.0-darwin/`。
- **结果：Darwin 测试全绿；2.0.0 已装到 main；无生图协议通过；Web 聊天一次 Google 2K 生图成功；bili 内存接口一次真实 generate 因 fake-IP 被宿主拦截。未 commit、未 push、未发布。**

## listProviders `{ config }` 修正后再验收（2026-11-02）

宿主公开类型 `RuntimeProviderListParams` 与 2026.10.8/10.9 实现均读取 `params.config`；`generate` 仍用 `cfg`。`7013596` 曾把 Stella 的 `listProviders` 改成 `{ cfg }` 以跟随 media.md 示例。现已改回 `{ config: api.config }`，测试同步断言。`npm test` 109 通过，`npm run build` 通过；`sync:local --agent main` 指纹 `0a3c7394352748afb48b598c7753e0507954c2df8192ff8b250a16b1f810fe35`。

### Web 聊天

- 新独立会话 `6cae414dc325416eadb222749212aef2`。一次 `image_generate`（`7a79e2eb-...:ok`）。JPEG 2,276,611 字节，1686×2528，SHA256 `96fd6efed56f9b6e19fb61eaf046451651c3cd4c62b29efe949f34651f28f8f5`。Agent 自行 release，`.references` 为空。无二次生图、无跨渠道。

### bili

- 已安装 `generateForBili` 传 `{ config }` 后，`listProviders` 返回过滤名单 google/minimax/minimax-portal/openai，`googleViaConfig=true`，随后派出 `google/gemini-3-pro-image`。
- 仍被宿主 SSRF 拦截：`generativelanguage.googleapis.com` → `198.18.0.214`。适配器返回 `PERMISSION_DENIED` / stage `generate` / outcome `unknown`。无 Buffer、无 material。未重试、未改代理。
- 该字段修正已由校验阶段证实；真实 Google 到达仍受 fake-IP 限制。

一次性探针 `/tmp/stella-bili-live-config-fix.mjs` 已删。未 commit、未发布。

## Clash fake-IP 排除后再验收 bili（2026-11-02）

用户确认后仅在 Clash `fake-ip-filter` 追加 `generativelanguage.googleapis.com`，重载 Mihomo 并清缓存。解析从 `198.18.0.214` 变为 `172.217.113.4` 等公网地址。未关 OpenClaw SSRF，未改 TUN / fake-ip 模式。

- 已安装 `generateForBili` 再跑一次：`ok=true`，JPEG 2,057,148 字节，1686×2528，SHA256 `9c2723251f19532700d593b36640c3102230dca276c77acaa959257071f9b758`。DNS `fakeIp=false`。无 material、无自动聊天交付。约 26 秒完成。
- 证据：`out/acceptance-2.0.0-darwin/bili-live-dns-retry.json`（git 忽略）。未把图片写入仓库。
- Web 聊天上一轮已通过，本轮不再付费重跑。

一次性探针 `/tmp/stella-bili-live-dns-retry.mjs` 已删。未 commit、未发布。

**结果：Darwin 本机 2.0.0 安装验收可通过。** 测试/安装/无生图协议、Web 一次 Google 2K、bili 内存接口一次 Google 2K 均已成功。

## 公开入口改名为 generateForPlugin（2026-11-02）

公开同宿主内存接口已硬切改名为 `generateForPlugin` / `dist/scripts/plugin.js` / `references/plugin-integration.md`。请求字段、默认 Agent `main`、默认 2K、单图、调用方持有 Buffer、不落盘、不重试均未改。不保留 `generateForBili`、`bili.js` 或类型别名。上文各节的 bili 探针文件名、已安装 `bili.js` 路径和历史 SHA 仍是当时的证据，不改写。本机已装副本需之后 `sync:local` 才能对上新入口。未进行新的付费生图。

## generateForPlugin 本机同步验收（2026-11-02）

当前 Agent `main` 工作区已合并为 `~/.openclaw/workspace`（不再是 `workspace/main`）。宿主 OpenClaw `2026.10.9`。

- 评审修复：`.clawhubignore` 改为放行 `plugin-integration.md` / `plugin.js`；示例与 README 改为调用方可选 `agentId`。`npm test` 110 通过。
- `npm run sync:local -- --agent main` 指纹 **cac8067743c5be90151e0e259a714079d4b4303d446390e422371a4930f31179**。已装 13 个白名单文件含 `plugin.js`。同步会保留旧文件，因此删除了已装副本里残留的 `dist/scripts/bili.js` 和 `references/bili-integration.md`。
- 无生图：smoke 三种模式各 2 张参考图、Google Pro、2K；已装副本对官方 runtime 的离线 plugin 验证通过；已装 `skill.js prepare` + `release` 通过，`count` / `target` 为 `INPUT_INVALID`。
- DNS `generativelanguage.googleapis.com` 为 `172.217.x.x`，`fakeIp=false`。
- 第一次真机探针在证据阶段对 `isConfigured()` 无参调用崩溃；generate 约 26s 结束但未留下 SHA，无素材文件。修好探针后再跑一次已安装 `generateForPlugin`：`ok=true`，JPEG 2,481,251 字节，1686×2528，SHA256 `5d2193be5118f1e5f3876f40b50f7d30cb531db336485b55d5abbc7d4c779c9d`。`listProviders({ config })` 为 google/minimax/minimax-portal/openai。无 material、无自动聊天交付。约 26 秒。
- 证据：`out/acceptance-2.0.0-darwin/plugin-live.json`（git 忽略）。未把图片写入仓库。Web 聊天未再付费重跑。

一次性探针 `/tmp/stella-plugin-live-once.mjs` 已删。未 commit、未发布。

