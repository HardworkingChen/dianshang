# 大数据电商系统

基于“大数据分析 + 个性化推荐 + 电商交易闭环”设计的一体化项目，包含微信小程序用户端、Vue 3 管理端、Spring Boot 后端、Python LangGraph 售后客服 Agent、实时计算链路、离线分析脚本与部署配置。

这个仓库适合以下场景：

- 电商推荐系统课程设计 / 毕业设计
- 大数据与实时计算项目展示
- 微信小程序电商项目二次开发
- 管理后台、推荐中台、实时看板的综合演示

当前公开仓库已经做过脱敏处理：

- 服务器账号、数据库密码、小程序私有配置不随仓库发布
- 本地私有环境文件已加入忽略规则
- 可直接作为公开展示仓库继续维护

## 项目简介

项目围绕“用户浏览商品 -> 推荐召回与排序 -> 加购/下单/支付/退款 -> 行为回流 -> 后台分析与策略调优”这条主线展开，既包含完整交易功能，也包含推荐、实时指标、用户画像、分群分析、风险控制等偏中后台能力。

相比单纯的商城项目，这个仓库更强调：

- 推荐链路：曝光、点击、加购、下单、支付、退款等行为回流
- 数据能力：实时聚合、离线分析、用户分群、效果看板
- 管理能力：管理员 / 商家双角色后台
- Agent 能力：只读工具规划、订单与售后预检、政策 RAG、证据校验及用户确认后的业务操作
- 演示能力：适合做课程答辩、作品集展示、比赛项目说明

## 核心能力

### 1. 用户小程序端

小程序目录：`user-miniprogram---2/user-miniprogram---2`

当前用户端已覆盖的页面与业务主线包括：

- 首页推荐
- 秒杀频道
- 探索页 / 分类浏览
- 商品详情
- 搜索结果页
- 购物车
- 结算页
- 订单列表 / 订单详情
- 评价与退款申请
- 个人中心
- 收藏、足迹、地址、消息、设置、钱包
- 客服与聊天
- AI 助手入口

小程序整体定位是“电商交易 + 推荐体验展示”，重点突出：

- 推荐内容呈现
- 商品浏览与转化路径
- 下单与售后闭环
- 用户个人中心与互动能力

### 2. 管理端 / 商家端

管理端目录：`management-pc`

当前 PC 端基于同一套 Vue 3 前端，根据账号角色切换管理员与商家视图，主要包括：

- 管理驾驶舱 / 工作台
- 商品、订单、用户、评价、退款管理
- 分类、Banner、优惠券、广播消息管理
- 秒杀活动管理
- 风险控制中心
- 推荐预览、推荐分析、AB Test 面板
- 用户画像、用户分群、大数据分析
- 实时流式看板
- AI 管理与智能辅助页面
- 商家端商品、订单、客服、评价、营销与店铺信息页

适合用于演示“运营后台 + 数据后台 + 推荐后台”三位一体的系统结构。

### 3. 后端服务

后端目录：`backend`

后端提供完整的电商业务接口与中后台能力，主要覆盖：

- 用户认证、注册、验证码、JWT 登录态
- 商品、分类、购物车、订单、退款、评价
- 优惠券、消息、地址、钱包
- 秒杀业务
- 文件上传与对象存储
- 推荐服务与推荐事件回流
- 实时指标接口
- 用户分群与分析任务触发
- AI 服务接入
- AI 客服只读业务工具：按客服意图核验当前会话绑定的本人订单、退款状态与退款申请基础条件
- Python LangGraph 客服 Agent：结构化意图与只读工具规划、BM25/可选向量混合 RAG、RRF 排序、grounding 校验与有界修复
- 风险控制、限流、角色权限
- WebSocket 实时推送

### AI 客服 Agent（订单与售后只读工具）

用户从订单或商品上下文进入官方客服后，客服工作流根据消息路由到受限业务工具：核验本人订单状态、查询最近售后记录时间线、查询关联商品信息、预检取消/退款条件。无订单上下文时可查询本人最近 5 笔订单，并通过输入订单号完成归属核验后绑定当前会话；不会按用户提供的任意 ID 查询他人订单。符合条件且用户明确提出写操作时，系统生成带 5 分钟有效期的确认卡片；用户二次确认后，退款申请调用统一退款业务服务，订单取消调用已有订单取消服务。

- 工具使用当前会话关联订单，或先按用户输入的订单号核验归属后绑定；订单归属不匹配时不向模型提供订单数据。
- 工具结果作为可信业务事实交给 AI 组织回复；模型不可自行推断物流轨迹、退款审核结果或其它未提供的订单事实。
- 预检阶段只读，不会创建退款申请或修改订单。确认卡片对应的操作再次校验会话、用户和订单；确认记录保存在客服消息中并加行锁防止重复执行。
- Agent 与订单页共用退款应用服务，复用订单状态、重复申请和单商家约束；订单取消复用订单服务的库存、优惠券及已付款金额回退逻辑。商家审核仍按原退款流程执行。
- 当前系统没有物流轨迹数据，客服明确告知无法核验具体配送节点，不会生成快递进度。
- Python Agent 先从只读工具白名单中规划订单/商品/售后查询，Java 再执行并校验用户、会话和订单权限；规划服务不可用时回退到 Java 规则路由。模型不能选择退款/取消写工具。
- AI 服务关闭或调用失败时，已核验的工具结果仍可用于确定性兜底回复；非订单类问题继续沿用原客服回复与转人工流程。

实现入口：`backend/src/main/java/com/ecommerce/service/CustomerSupportAgentService.java`，由现有 `POST /api/im/conversations/{id}/messages` 客服消息流程调用；确认操作走 `POST /api/im/conversations/{id}/agent-actions/confirm`。测试覆盖未绑定订单、跨用户订单隔离、本人订单列表、订单号绑定、确认卡片生成及预检只读约束。

自然语言客服回复由独立 `agent-service/` Python 服务处理，使用 FastAPI + LangGraph；Python 先规划只读工具，Java 执行权限校验后的业务查询，再将工具事实交回 Python 完成政策检索和有引用的答复生成。退款/取消写操作仍由 Java 中的既有事务服务执行。服务安装、配置及本地运行见 [agent-service/README.md](./agent-service/README.md)。

工作流、工具白名单、确认状态与异常处理边界详见 [Agent 架构与业务流程](./docs/agent-architecture.md)。

## 技术栈

### 前端

- 微信原生小程序
- Vue 3
- Vite
- Element Plus
- Pinia
- Vue Router
- ECharts

### 后端

- Spring Boot 2.7
- MyBatis-Plus
- MySQL 8
- Redis
- RabbitMQ
- Kafka
- WebSocket
- Spring Security
- SpringDoc / Swagger UI

### 数据与分析

- Flink
- Debezium CDC
- Kafka Streams 风格实时链路
- Python 分析脚本
- 用户分群 / 推荐评估 / 数据质量巡检

### AI Agent

- Python、FastAPI、Pydantic
- LangGraph 状态图与有界纠错检索
- LangChain 模型适配与结构化输出
- BM25Plus、可选 Embedding 召回、RRF 排名融合

## 仓库结构

```text
大数据电商系统
├─ backend                         Spring Boot 后端
├─ agent-service                   Python LangGraph 客服 Agent 与政策知识库
├─ docs                            Agent 架构和业务流程说明
├─ management-pc                  管理端 / 商家端 Vue 3 前端
├─ user-miniprogram---2           微信小程序端
├─ streaming                      Flink / Kafka / CDC 相关脚本与模板
├─ scripts                        根目录运维、分析、压测、构建脚本
├─ deploy                         Docker / systemd / Nginx 部署配置
├─ package.json                   根脚本入口
└─ README.md
```

## 已实现的项目特点

- 不只是商城页面，而是包含推荐、分析、实时链路的综合系统
- 交易闭环比较完整，适合演示真实电商流程
- 管理端页面维度丰富，适合展示后台复杂度
- 小程序端更偏“推荐电商”而不是普通模板商城
- 支持实时看板与离线分析并存
- 适合继续扩展成毕业设计、比赛项目或求职作品

## 快速启动

### 1. 安装根目录工具依赖

```bash
npm install
```

### 2. 启动管理端前端

```bash
cd management-pc
npm install
npm run dev
```

默认开发地址：

- `http://localhost:5173`

### 3. 启动后端

```bash
cd backend
mvn spring-boot:run
```

或打包后运行：

```bash
mvn clean package -DskipTests
java -jar target/ecommerce-recommendation-1.0.0.jar
```

### 4. 启动 Python 客服 Agent

在独立终端、`agent-service` 目录下执行：

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8091
```

使用 Python 3.12；虚拟环境和模型配置见 [Agent 服务说明](./agent-service/README.md)。Java 后端配置 `AGENT_SERVICE_URL=http://127.0.0.1:8091`，两端设置相同的 `AGENT_SERVICE_TOKEN`。未配置模型密钥时，Python 采用规则规划、BM25Plus 召回和确定性答复；Java 无法连接 Agent 时回落到原客服业务路由与回复。

### 5. 小程序端

使用微信开发者工具打开：

```text
user-miniprogram---2/user-miniprogram---2
```

仓库中的 `project.config.json` 已使用公开占位配置，实际联调时请在你本地填写自己的小程序私有配置。

## 根目录常用命令

```bash
npm run bootstrap
npm run smoke
npm run analytics:run
npm run audit:mini
npm run seckill:test
npm run register:load-test
```

对应用途：

- `bootstrap`：项目基础初始化辅助脚本
- `smoke`：基础联通性检查
- `analytics:run`：执行分析任务脚本
- `audit:mini`：巡检小程序交易 / 推荐链路
- `seckill:test`：秒杀并发测试
- `register:load-test`：注册接口压测

## 实时链路与大数据能力

实时与流式相关内容位于：`streaming`

支持两类使用方式：

- 本机 Flink 直连 MySQL 的轻量实时聚合
- MySQL CDC -> Kafka -> Flink -> Redis / 后端接口 的增强链路

主要面向这些数据场景：

- 用户行为分布统计
- 用户类目偏好聚合
- 商品热度实时更新
- 推荐核心指标实时看板

如果你想单独查看这部分说明，可以直接阅读：

- [streaming/README.md](./streaming/README.md)

## 部署说明

部署相关配置位于：`deploy`

当前仓库保留了：

- Docker Compose 部署
- 宿主机 + Docker 混合部署
- systemd 服务模板
- Nginx 反向代理配置

可直接查看：

- [deploy/README.md](./deploy/README.md)

## 适合展示的亮点

如果你要把这个项目作为 GitHub 作品展示、课程答辩项目或简历项目，可以重点介绍：

- 小程序端与后台端是联动的，不是单端 Demo
- 有推荐系统，不只是普通 CRUD 商城
- 有实时计算链路和离线分析链路
- 有用户画像、分群、风险控制、AB Test、实时看板等中台能力
- 售后客服接入 Python Agent，具备只读工具白名单、政策检索、引用校验和用户二次确认流程
- 技术覆盖前端、后端、消息队列、缓存、流处理与部署

## 注意事项

- 本仓库已经移除或占位化处理敏感信息，实际部署时请自行配置环境变量
- `deploy/server.env`、小程序私有配置等文件默认不提交
- 如果你要公开展示项目，建议继续保持“配置与代码分离”
- 如果你要在线上部署，请使用你自己的数据库、对象存储、小程序配置与域名

## 后续可继续扩展

- 增加完整的接口文档与演示截图
- 增加数据库表结构说明
- 增加系统架构图与推荐链路图
- 增加默认演示账号说明
- 增加 Docker 一键启动文档
