# OpenClaw Easy

本机上的 Easy Shell：三步向导、聊天主界面、危险操作确认卡。能力仍是 OpenClaw（或内置演示），不托管模型，不加付费层，数据写在 `~/.openclaw-easy/`。

A local shell for OpenClaw: a three-step wizard, chat, and approval cards. It does not host models or add a paid tier. State stays in `~/.openclaw-easy/`.

## 运行 / Run

```bash
npm install
npm run dev
```

打开 [http://127.0.0.1:4721](http://127.0.0.1:4721)。不设 Gateway 地址时走内置 MockGateway，向导和聊天都可以直接用。

Open [http://127.0.0.1:4721](http://127.0.0.1:4721). With no gateway URL, the built-in MockGateway answers so onboarding and chat work immediately.

## Windows 一键 / Windows one click

双击 `scripts\dev.cmd`。没有 `node_modules` 时会先 `npm install`，然后 `npm run dev`。`/api/health` 通了之后打开浏览器到 [http://127.0.0.1:4721](http://127.0.0.1:4721)。

PowerShell 里也可以：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
```

需要已安装 Node.js。这一步只开网页，不开托盘。

Double-click `scripts\dev.cmd`, or run `powershell -ExecutionPolicy Bypass -File scripts\dev.ps1`. If `node_modules` is missing it runs `npm install`, then `npm run dev`, and opens http://127.0.0.1:4721 after `/api/health` responds. Node.js has to be installed already. This path does not start the tray.

## 托盘 / Tray

可选。网页开发仍然只用 `npm run dev`。

```bash
npm install
npm run desktop
```

Electron 窗口加载同一个 Easy。托盘图标对应四种状态：在线、在忙、需你确认、离线。菜单可以启动或停止它自己拉起的 dev 服务，也可以在系统浏览器里再开一次。如果 4721 上已经有服务，托盘只附着上去，退出时不会把它关掉。

Optional. `npm run dev` still runs the site by itself. `npm run desktop` opens an Electron window on the same UI and a tray icon for 在线 / 在忙 / 需你确认 / 离线. Start and Stop control only the dev server the tray launched. If something is already listening on 4721, the tray attaches and does not stop it on quit.

## 接到本机 Gateway / Point at a real gateway

Easy 不改写 OpenClaw Gateway。本机已经跑着 Gateway 时：

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=你的令牌 \
npm run dev
```

- 令牌对应 Gateway 的 `gateway.auth.token`。密码模式可用 `OPENCLAW_GATEWAY_PASSWORD`。
- 聊天走文档里的 `POST /v1/chat/completions`。这个接口默认关闭，需要在 Gateway 配置里打开 `gateway.http.endpoints.chatCompletions.enabled`。
- 健康检查先请求 `GET /v1/models`。HTTP 不通时，只会听 WebSocket 的 `connect.challenge`，用来判断进程在不在。完整的 `chat.send` 设备握手不在这个壳里。
- 向导里的 Claude / GPT / Grok / 本地只是本机偏好。真正的模型由 Gateway 上的 agent 决定。可选 `OPENCLAW_MODEL`，会作为 `x-openclaw-model` 传过去。
- 连不上时，聊天会改用演示回复，并写明这不是真实执行。401 不会假装连上。

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=your-token \
npm run dev
```

The token is `gateway.auth.token` (`OPENCLAW_GATEWAY_PASSWORD` works for password auth). Chat uses `POST /v1/chat/completions`, which stays off until `gateway.http.endpoints.chatCompletions.enabled` is true. Health checks `GET /v1/models`, then listens for a WebSocket `connect.challenge` if HTTP is down. Model cards are a local preference; the Gateway agent picks the real model. Set `OPENCLAW_MODEL` only when you want that id sent as `x-openclaw-model`.

换数据目录可以用 `OPENCLAW_EASY_HOME`。终端里看同一台 Gateway：`openclaw gateway status` 和 `openclaw health`。

## 测试 / Tests

```bash
npm test
```

覆盖 MockGateway 的角色回复、确认卡、`@` 交办、Watchdog 的模拟中断与修复、渠道占位文件，以及邀请码加入。可选 OpenClaw 客户端的 HTTP 行为也在里面。

Covers mock replies, approval cards, `@` handoff, the simulated Watchdog outage and repair, channel placeholder files, and invite-code join. The optional OpenClaw HTTP client is covered too.

## 交给另一只 Claw / Hand off

聊天里写 `@跑腿 明天有什么安排`，或点「交给 跑腿」。任务和最近几句对话会交给同一只 Easy 里的另一只 Claw，两边的记录里都能看到交办。不用写转发规则。发送邮件和删除文件仍然先出确认卡，卡在接收的那只 Claw 上。

Type `@跑腿 …` or use the 交给 chip. The task and a short slice of context go to the other Claw on this shell. Both transcripts show the handoff. Send and delete still require an approval card, on the receiving Claw.

## Watchdog

侧栏可以「模拟中断」。健康变成需你确认，点「修复」会重新检查。演示进程大约 12 秒后也会自己再查一次。这不会杀掉或拉起真正的 OpenClaw 进程，也不会改它的配置。真的连不上 Gateway 时，状态是离线，修复只是再探一次。

Use 模拟中断 in the sidebar. Health becomes 需你确认; 修复 probes again. The demo process also rechecks itself after about 12 seconds. This does not kill or start the real OpenClaw process. A gateway that is actually unreachable stays 离线, and repair only probes.

## 常驻这台 Mac / Keep a Mac mini awake

Watchdog 只负责检查和提示，不改系统设置。

- 系统设置 → 通用 → 登录项：留下 Gateway 的启动项，登录后自己起来。
- 系统设置 → 节能：接电时防止自动睡眠。临时可用 `caffeinate -s`。
- 系统设置 → 节能 → 唤醒以供网络访问。远程访问用 Tailscale 或身份代理，不要把 Gateway 裸露到公网。

Watchdog only checks and prompts. It does not change system settings. Leave the Gateway in Login Items, keep the Mac awake on power (`caffeinate -s` is the short version), and enable wake for network access. Reach it through Tailscale or an identity proxy, not an open public port.

## 渠道占位 / Channels

「连接」里有 Telegram、WhatsApp、Slack 三步说明。保存后写入 `~/.openclaw-easy/channels.json`，形状对应 OpenClaw 的 `channels.*`，并且默认不启用。令牌不会写进这个文件，也不会进聊天。真正接通仍在 Gateway 上做：

- Telegram：`openclaw channels add --channel telegram --token <bot-token>`，配置键 `channels.telegram.botToken`，`dmPolicy: "pairing"`。文档：[Telegram](https://docs.openclaw.ai/channels/telegram/setup)
- WhatsApp：没有 bot token，用 `openclaw channels login --channel whatsapp` 扫码。占位里是 `channels.whatsapp.dmPolicy`。文档：[WhatsApp](https://docs.openclaw.ai/channels/whatsapp/)
- Slack：Socket Mode 的 `channels.slack.appToken` / `botToken` 写成 SecretRef，对应环境变量 `SLACK_APP_TOKEN` 和 `SLACK_BOT_TOKEN`。文档：[Slack](https://docs.openclaw.ai/channels/slack/setup)

Easy does not log into those networks. Saving a wizard writes a disabled placeholder at `~/.openclaw-easy/channels.json`. Put real tokens in OpenClaw with the commands above.

## 邀请 / Invite

「邀请」给出本机链接 `?invite=邀请码`。另一台浏览器打开后可以用名字加入，侧栏能看到谁在看哪只 Claw。也可以点「模拟有人加入」。这只存在于 Easy 的本地状态，不是 OpenClaw 的多人 Gateway，也没有账号服务器。

The invite link is local (`?invite=`). Another browser on this state file can join by name, and the header shows who is viewing which Claw. 模拟有人加入 adds a fake guest. This is not OpenClaw multiplayer and there is no account server.

## 之后 / Later

还没做的是把渠道占位真正写进 Gateway、扫码登录、以及多人 Gateway 的在场和审计。当前壳里没有这些。

Not in this shell yet: applying channel placeholders onto the Gateway, QR login, and real multiplayer presence or audit.
