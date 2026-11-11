# Docker Deployment Notes

这套部署文件按“小内存服务器”做了收敛，并保留两种部署方式：

- 全容器模式：`backend`、`admin-frontend`、`redis`、`rabbitmq`
- 混合模式：`backend` 跑宿主机，`admin-frontend`、`redis`、`rabbitmq` 跑 Docker
- 演示时临时拉起：`zookeeper`、`kafka`、`kafka-ui`、`connect`、`jobmanager`、`taskmanager`

## 1. 环境变量

复制并修改：

```bash
cp deploy/server.env.example deploy/server.env
```

当前模板默认复用宿主机已有的 MySQL，数据库名示例为 `ecommerce_recommend`。请在本地 `deploy/server.env` 中配置实际的 `DB_NAME`、`DB_USERNAME`、`DB_PASSWORD`，不随源码发布运行凭据。

## 2. 全容器模式

```bash
docker compose --env-file deploy/server.env -f deploy/docker-compose.server.yml up -d redis backend admin-frontend
```

## 3. 启动 RabbitMQ

```bash
docker compose --env-file deploy/server.env -f deploy/docker-compose.server.yml --profile mq up -d rabbitmq
```

同时把 `MQ_ENABLED=true` 写入 `deploy/server.env`，然后重启后端：

```bash
docker compose --env-file deploy/server.env -f deploy/docker-compose.server.yml up -d backend
```

## 4. 启动 Kafka / Flink 增强链路

```bash
docker compose --env-file deploy/server.env -f deploy/docker-compose.server.yml --profile streaming up -d
```

再把下面开关打开：

```text
STREAM_KAFKA_ENABLED=true
STREAM_REALTIME_ENABLED=true
```

然后重启后端：

```bash
docker compose --env-file deploy/server.env -f deploy/docker-compose.server.yml up -d backend
```

## 5. 混合模式

如果宿主机 MySQL 只允许 `localhost` 连接，推荐这样跑：

1. 只启动 Docker 服务：

```bash
docker compose --env-file deploy/server.env -f deploy/docker-compose.runtime.yml up -d redis rabbitmq admin-frontend
```

2. 把 `deploy/ecommerce-backend.service` 放到：

```text
/etc/systemd/system/ecommerce-backend.service
```

3. 重新加载并启动：

```bash
systemctl daemon-reload
systemctl enable --now ecommerce-backend
```

4. 安装健康检查脚本与定时器：

```bash
install -m 755 deploy/ecommerce-backend-healthcheck.sh /opt/ecommerce/scripts/ecommerce-backend-healthcheck.sh
cp deploy/ecommerce-backend-healthcheck.service /etc/systemd/system/
cp deploy/ecommerce-backend-healthcheck.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ecommerce-backend-healthcheck.timer
```

## 6. 宿主机 Nginx

宿主机 Nginx 继续监听 `80`，把请求反代给容器：

- `/` -> `127.0.0.1:8088`
- `/api` -> `127.0.0.1:8080`
- `/uploads` -> `127.0.0.1:8080`
- `/ws` -> `127.0.0.1:8080`

配置参考文件：

```text
deploy/nginx-ecommerce.conf
deploy/nginx-bt-site.conf
```

## 7. Python 说明

当前仓库已包含 `backend/python_analytics/`，可通过根目录脚本触发离线分析：

```bash
npm run analytics:run
```

生产部署时建议把 Python analytics 作为独立 worker 或定时任务运行，并复用后端相同的数据库环境变量：

- `ANALYTICS_DB_HOST`
- `ANALYTICS_DB_PORT`
- `ANALYTICS_DB_USERNAME`
- `ANALYTICS_DB_PASSWORD`
- `ANALYTICS_DB_NAME`

Python 调度器已写入 `analytics_job_log`，并通过 MySQL `GET_LOCK` 做同一任务/日期的互斥保护，避免手动触发和定时触发撞车。

## Python 客服 Agent

`agent-service/` 是独立的 FastAPI + LangGraph 服务，与上面的离线 analytics 任务用途不同。客服请求由 Java 调用 Python 规划只读工具，Java 完成权限校验和业务查询后，再调用 Python 的答复工作流。

现有 `deploy/docker-compose.server.yml` 和 `deploy/docker-compose.runtime.yml` 没有自动启动 Agent，需要单独启动或增加 Compose 服务配置。

### Java 运行在宿主机

从仓库根目录执行：

```bash
cp agent-service/.env.example agent-service/.env
# 在本地 .env 中填写 AGENT_SERVICE_TOKEN，按需填写模型服务配置。
docker compose --env-file agent-service/.env -f agent-service/docker-compose.yml up -d --build
```

该 Compose 将 Python 服务映射到宿主机 `127.0.0.1:8091`。Java 进程需要设置：

```text
AGENT_SERVICE_URL=http://127.0.0.1:8091
AGENT_SERVICE_TOKEN=与Python端相同的内部调用令牌
```

使用仓库中的 systemd 模板时，将这两个配置写入该模板读取的 `/opt/ecommerce/backend/server.env`，再重启后端服务；仅修改 `deploy/server.env` 不会自动影响这个 systemd 服务。

### Java 运行在容器

容器中的 `localhost` 指向容器本身。需要让 Java 和 Agent 加入同一 Compose 网络，并把 Python 服务名作为连接地址。可在本地补充覆盖文件，例如 `deploy/docker-compose.agent.local.yml`：

```yaml
services:
  customer-support-agent:
    build:
      context: ../agent-service
    restart: unless-stopped
    environment:
      AGENT_SERVICE_TOKEN: ${AGENT_SERVICE_TOKEN:?Set AGENT_SERVICE_TOKEN}
      AGENT_LLM_API_KEY: ${AGENT_LLM_API_KEY:-}
      AGENT_LLM_BASE_URL: ${AGENT_LLM_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}
      AGENT_LLM_MODEL: ${AGENT_LLM_MODEL:-qwen-plus}
      AGENT_EMBEDDING_MODEL: ${AGENT_EMBEDDING_MODEL:-text-embedding-v3}
  backend:
    environment:
      AGENT_SERVICE_URL: http://customer-support-agent:8091
      AGENT_SERVICE_TOKEN: ${AGENT_SERVICE_TOKEN:?Set AGENT_SERVICE_TOKEN}
```

将 Agent 变量与现有数据库等变量配置到本地 `deploy/server.env` 后，在仓库根目录启动：

```bash
docker compose --env-file deploy/server.env -f deploy/docker-compose.server.yml -f deploy/docker-compose.agent.local.yml up -d --build customer-support-agent backend
```

该覆盖方式使用服务间网络，不需要向宿主机映射 Python 端口。Compose 的 `--env-file` 负责变量替换；Java 容器所需的变量仍要在 `backend.environment` 中显式传入。

API 与配置项见 [Agent 服务说明](../agent-service/README.md)，业务链路见 [Agent 架构与业务流程](../docs/agent-architecture.md)。模型密钥配置在 Python 进程；Java 使用的是 `AGENT_SERVICE_URL`，不是模型供应商地址。退款与取消订单仍由 Java 确认接口及事务服务执行。

## 8. 说明

- `docker-compose.runtime.yml` 默认把端口绑定到 `127.0.0.1`，依赖宿主机 Nginx 做公网入口。
- 当前混合部署建议：电商后端只保留 systemd 服务，`docker-compose.runtime.yml` 仅负责 `admin-frontend`、`redis`、`rabbitmq` 等辅助容器。
- `ecommerce-backend.service` 已加入 `StartLimitIntervalSec=15min`、`StartLimitBurst=3`、`RestartSec=30`，用于避免失败时无限狂重启。
- `ecommerce-backend-healthcheck.timer` 每分钟检查一次 `http://127.0.0.1:8080/ws/info`，连续 3 次失败才允许重启，并带 30 分钟冷却和 6 小时内最多 2 次自动重启的限制。
- 2 GB 左右内存的机器不建议常驻启动 Kafka/Flink。
