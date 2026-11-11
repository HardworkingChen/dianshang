package com.ecommerce.controller;

import com.ecommerce.common.Result;
import com.ecommerce.config.StreamKafkaConsumerProperties;
import com.ecommerce.config.StreamRealtimeProperties;
import com.ecommerce.entity.Product;
import com.ecommerce.entity.User;
import com.ecommerce.mapper.ProductMapper;
import com.ecommerce.mapper.UserBehaviorMapper;
import com.ecommerce.mapper.UserMapper;
import com.ecommerce.service.StreamKafkaMonitorService;
import com.ecommerce.service.StreamRealtimeRedisSinkService;
import com.ecommerce.util.ProductVisibilityUtil;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/stream")
@Tag(name = "Admin Stream", description = "流式链路调试与实时特征巡检接口")
@SecurityRequirement(name = "BearerAuth")
public class AdminStreamController {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Autowired
    private StreamRealtimeProperties streamRealtimeProperties;

    @Autowired
    private StreamKafkaConsumerProperties streamKafkaConsumerProperties;

    @Autowired(required = false)
    private StreamRealtimeRedisSinkService streamRealtimeRedisSinkService;

    @Autowired(required = false)
    private StringRedisTemplate stringRedisTemplate;

    @Autowired(required = false)
    private StreamKafkaMonitorService streamKafkaMonitorService;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private UserBehaviorMapper userBehaviorMapper;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/status")
    public Result<?> status() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("realtimeEnabled", streamRealtimeProperties.isEnabled());
        data.put("kafkaConsumerEnabled", streamKafkaConsumerProperties.isEnabled());
        data.put("consumerGroupId", streamKafkaConsumerProperties.getGroupId());
        data.put("monitorMode", resolveMonitorMode());
        data.put("topics", buildTopicBlock());
        data.put("redisHotLastUpdate", getValue("stream:product:hot:lastUpdate"));
        data.put("hotProducts1m", loadHotProducts("1m", 10));
        data.put("hotProducts1h", loadHotProducts("1h", 10));
        data.put("hotProducts1d", loadHotProducts("1d", 10));
        data.put("recommendationKpi", loadRecommendationKpi(null));
        data.put("monitor", buildMonitorBlock());
        return Result.success(data);
    }

    @GetMapping("/overview")
    public Result<?> overview(@RequestParam(defaultValue = "8") int hotLimit,
                              @RequestParam(defaultValue = "6") int userLimit) {
        Map<String, Object> data = new LinkedHashMap<>();
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("realtimeEnabled", streamRealtimeProperties.isEnabled());
        status.put("kafkaConsumerEnabled", streamKafkaConsumerProperties.isEnabled());
        status.put("consumerGroupId", streamKafkaConsumerProperties.getGroupId());
        status.put("monitorMode", resolveMonitorMode());
        status.put("topics", buildTopicBlock());
        status.put("redisHotLastUpdate", getValue("stream:product:hot:lastUpdate"));
        status.put("monitor", buildMonitorBlock());

        List<Map<String, Object>> hotProducts1m = loadHotProducts("1m", hotLimit);
        List<Map<String, Object>> hotProducts1h = loadHotProducts("1h", hotLimit);
        List<Map<String, Object>> hotProducts1d = loadHotProducts("1d", hotLimit);
        Map<String, Object> recommendationKpi = loadRecommendationKpi(null);
        List<Map<String, Object>> sampleUsers = loadSampleUsers(userLimit);

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("trackedTopics", getCoreDataTopics().size());
        metrics.put("sampleUsers", sampleUsers.size());
        metrics.put("hotProducts1m", hotProducts1m.size());
        metrics.put("hotProducts1h", hotProducts1h.size());
        metrics.put("hotProducts1d", hotProducts1d.size());
        metrics.put("recommendationKpiAvailable", recommendationKpi.isEmpty() ? 0 : 1);
        metrics.put("pipelineReady", isPipelineReady());
        metrics.put("monitorAvailable", isMonitorAvailable());

        data.put("status", status);
        data.put("metrics", metrics);
        data.put("pipeline", buildPipelineSteps());
        data.put("hotProducts1m", hotProducts1m);
        data.put("hotProducts1h", hotProducts1h);
        data.put("hotProducts1d", hotProducts1d);
        data.put("recommendationKpi", recommendationKpi);
        data.put("sampleUsers", sampleUsers);
        data.put("monitor", status.get("monitor"));
        return Result.success(data);
    }

    @GetMapping("/users/{userId}/snapshot")
    public Result<?> userSnapshot(@PathVariable Long userId) {
        if (streamRealtimeRedisSinkService == null || userId == null || userId <= 0) {
            return Result.success(Collections.emptyMap());
        }

        User user = userMapper.selectById(userId);
        Map<String, Object> snapshot = streamRealtimeRedisSinkService.getUserRealtimeSnapshot(userId);
        if ((snapshot == null || snapshot.isEmpty()) && user == null) {
            return Result.success(Collections.emptyMap());
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("user", buildUserInfo(user, userId));
        payload.put("behaviorDistribution", normalizeBehaviorDistribution(snapshot == null ? null : snapshot.get("behaviorDistribution")));
        payload.put("categoryWeights", normalizeCategoryWeights(snapshot == null ? null : snapshot.get("categoryWeights")));
        payload.put("tags", normalizeTags(snapshot == null ? null : snapshot.get("tags")));
        payload.put("lastUpdate", snapshot == null ? null : snapshot.get("lastUpdate"));
        payload.put("hotProducts1m", snapshot == null ? Collections.emptyList() : snapshot.get("hotProducts1m"));
        payload.put("hotProducts1h", snapshot == null ? Collections.emptyList() : snapshot.get("hotProducts1h"));
        payload.put("hotProducts1d", snapshot == null ? Collections.emptyList() : snapshot.get("hotProducts1d"));
        return Result.success(payload);
    }

    @GetMapping("/hot-products")
    public Result<?> hotProducts(@RequestParam(defaultValue = "1h") String window,
                                 @RequestParam(defaultValue = "10") int limit) {
        return Result.success(loadHotProducts(window, limit));
    }

    @GetMapping("/monitor")
    public Result<?> monitor() {
        return Result.success(buildMonitorBlock());
    }

    @GetMapping("/recommendation-kpi/realtime")
    public Result<?> recommendationKpiRealtime(@RequestParam(required = false) String statDate) {
        return Result.success(loadRecommendationKpi(statDate));
    }

    private Map<String, Object> buildTopicBlock() {
        Map<String, Object> topics = new LinkedHashMap<>();
        topics.put("userBehaviorDistribution", streamKafkaConsumerProperties.getUserBehaviorTopic());
        topics.put("userCategoryPreference", streamKafkaConsumerProperties.getUserCategoryTopic());
        topics.put("productHotnessRealtime", streamKafkaConsumerProperties.getProductHotnessTopic());
        topics.put("recommendationCoreMetricsRealtime", streamKafkaConsumerProperties.getRecommendationCoreMetricsTopic());
        topics.put("productChangedEvent", streamKafkaConsumerProperties.getProductChangedTopic());
        topics.put("productCdc", streamKafkaConsumerProperties.getProductCdcTopic());
        return topics;
    }

    private List<String> getCoreDataTopics() {
        List<String> topics = new ArrayList<>();
        addTopicIfPresent(topics, streamKafkaConsumerProperties.getUserBehaviorTopic());
        addTopicIfPresent(topics, streamKafkaConsumerProperties.getUserCategoryTopic());
        addTopicIfPresent(topics, streamKafkaConsumerProperties.getProductHotnessTopic());
        addTopicIfPresent(topics, streamKafkaConsumerProperties.getRecommendationCoreMetricsTopic());
        return topics;
    }

    private List<Map<String, Object>> loadHotProducts(String window, int limit) {
        if (streamRealtimeRedisSinkService == null) {
            return Collections.emptyList();
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> rows = streamRealtimeRedisSinkService.getHotProducts(window, safeLimit);
        if (rows.isEmpty()) {
            return rows;
        }

        List<Long> productIds = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long productId = parseLong(row.get("productId"));
            if (productId != null && productId > 0) {
                productIds.add(productId);
            }
        }
        Map<Long, Product> productMap = new HashMap<>();
        if (!productIds.isEmpty()) {
            List<Product> products = productMapper.selectByIds(productIds);
            for (Product product : products) {
                if (product != null && product.getId() != null) {
                    productMap.put(product.getId(), product);
                }
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>(row);
            Long productId = parseLong(row.get("productId"));
            Product product = productId == null ? null : productMap.get(productId);
            if (product == null || ProductVisibilityUtil.shouldHideFromRecommendation(product)) {
                continue;
            }
            item.put("productName", product.getName());
            item.put("productImage", product.getImage());
            item.put("categoryName", product.getCategoryName());
            item.put("price", product.getPrice());
            item.put("salesCount", product.getSalesCount());
            item.put("rating", product.getRating());
            result.add(item);
        }
        return result;
    }

    private String getValue(String key) {
        if (stringRedisTemplate == null) {
            return null;
        }
        try {
            return stringRedisTemplate.opsForValue().get(key);
        } catch (Exception ignore) {
            return null;
        }
    }

    private Map<String, Object> buildMonitorBlock() {
        String groupId = streamKafkaConsumerProperties.getGroupId();
        Map<String, Object> payload;

        if (streamKafkaConsumerProperties.isEnabled() && streamKafkaMonitorService != null) {
            List<String> coreTopics = getCoreDataTopics();
            payload = new LinkedHashMap<>(streamKafkaMonitorService.getRealtimeMonitor(groupId, coreTopics));
            payload.put("mode", "kafka");
        } else {
            payload = buildLocalProjectionMonitor(groupId);
        }

        appendHotDataStaleAlert(payload);
        return payload;
    }

    private Map<String, Object> buildLocalProjectionMonitor(String groupId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        String hotLastUpdate = getValue("stream:product:hot:lastUpdate");
        String kpiLastUpdate = getValue("stream:recommendation:kpi:lastUpdate");
        boolean projectionAvailable = hasRealtimeProjectionData();

        payload.put("available", projectionAvailable);
        payload.put("mode", projectionAvailable ? "local_projection" : "offline");
        payload.put("consumerLag", buildEmptyConsumerLag(groupId));
        payload.put("deadLetter", buildEmptyDeadLetter());
        payload.put("alerts", Collections.emptyList());
        payload.put("updatedAt", StringUtils.hasText(hotLastUpdate) ? hotLastUpdate : kpiLastUpdate);
        if (projectionAvailable) {
            payload.put("note", "Kafka consumer is disabled; reporting Redis local projection health.");
        }
        return payload;
    }

    private Map<String, Object> buildEmptyConsumerLag(String groupId) {
        Map<String, Object> lag = new LinkedHashMap<>();
        lag.put("groupId", groupId);
        lag.put("groupFound", false);
        lag.put("totalLag", 0L);
        lag.put("topicCount", 0);
        lag.put("partitionCount", 0);
        lag.put("topics", Collections.emptyList());
        return lag;
    }

    private Map<String, Object> buildEmptyDeadLetter() {
        Map<String, Object> deadLetter = new LinkedHashMap<>();
        deadLetter.put("totalMessages", 0L);
        deadLetter.put("topicCount", 0);
        deadLetter.put("topics", Collections.emptyList());
        return deadLetter;
    }

    private void appendHotDataStaleAlert(Map<String, Object> monitor) {
        if (monitor == null) {
            return;
        }
        Object alertsRaw = monitor.get("alerts");
        List<Map<String, Object>> alerts = new ArrayList<>();
        if (alertsRaw instanceof Collection<?>) {
            for (Object item : (Collection<?>) alertsRaw) {
                if (item instanceof Map<?, ?>) {
                    alerts.add(new LinkedHashMap<>((Map<String, Object>) item));
                }
            }
        }

        String lastUpdate = getValue("stream:product:hot:lastUpdate");
        LocalDateTime lastUpdateTime = parseDateTime(lastUpdate);
        if (lastUpdateTime == null) {
            alerts.add(buildAlert(
                    "warning",
                    "hot_data_missing",
                    "实时热榜尚未刷新，请检查 DWS 到 Redis 的写入链路",
                    0L,
                    streamKafkaConsumerProperties.getHotDataStaleSeconds()));
        } else {
            long delaySeconds = Math.max(Duration.between(lastUpdateTime, LocalDateTime.now()).getSeconds(), 0L);
            if (delaySeconds >= streamKafkaConsumerProperties.getHotDataStaleSeconds()) {
                alerts.add(buildAlert(
                        "warning",
                        "hot_data_stale",
                        "实时热榜更新延迟超过阈值",
                        delaySeconds,
                        streamKafkaConsumerProperties.getHotDataStaleSeconds()));
            }
        }

        monitor.put("alerts", alerts);
        monitor.put("hotDataLastUpdate", lastUpdate);
    }

    private Map<String, Object> buildAlert(String level, String code, String message, long metric, long threshold) {
        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("level", level);
        alert.put("code", code);
        alert.put("message", message);
        alert.put("metric", metric);
        alert.put("threshold", threshold);
        return alert;
    }

    private LocalDateTime parseDateTime(String text) {
        if (!StringUtils.hasText(text)) {
            return null;
        }
        try {
            return LocalDateTime.parse(text.trim(), DATE_TIME_FORMATTER);
        } catch (Exception ignore) {
            return null;
        }
    }

    private List<Map<String, Object>> buildPipelineSteps() {
        List<Map<String, Object>> steps = new ArrayList<>();
        String monitorStepStatus = isMonitorAvailable() ? "active" : "idle";
        steps.add(buildStep("MySQL CDC", "行为、订单、订单项、商品、推荐事件捕获", "cdc.user_behavior / cdc.orders / cdc.order_item / cdc.product / cdc.recommendation_event", "ready"));
        steps.add(buildStep("DWD 标准层", "统一事件格式，便于下游复用", "dwd.user_behavior_event / dwd.order_paid_event / dwd.product_changed_event / dwd.recommendation_event", "ready"));
        steps.add(buildStep("DWS 聚合层", "多窗口热榜、品类偏好、行为分布、推荐核心8指标聚合", "dws.user_behavior_distribution / dws.user_category_preference / dws.product_hotness_realtime(1m/1h/1d) / dws.recommendation_core_metrics_realtime", "ready"));
        steps.add(buildStep("Redis 实时特征", "在线画像与热榜缓存", "stream:user:* / stream:product:*", streamRealtimeProperties.isEnabled() ? "active" : "idle"));
        steps.add(buildStep("消费监控与告警", "消费积压、死信队列、告警面板", "/api/admin/stream/monitor", monitorStepStatus));
        steps.add(buildStep("推荐与看板", "前台推荐、实时热榜与核心8指标看板使用", "/api/recommendations/realtime-hot* / /api/admin/stream/recommendation-kpi/realtime", isPipelineReady() ? "active" : "idle"));
        return steps;
    }

    private boolean isPipelineReady() {
        return streamRealtimeProperties.isEnabled()
                && (streamKafkaConsumerProperties.isEnabled() || hasRealtimeProjectionData());
    }

    private boolean isMonitorAvailable() {
        if (streamKafkaConsumerProperties.isEnabled()) {
            return streamKafkaMonitorService != null;
        }
        return streamRealtimeProperties.isEnabled()
                && streamRealtimeRedisSinkService != null
                && hasRealtimeProjectionData();
    }

    private String resolveMonitorMode() {
        if (streamKafkaConsumerProperties.isEnabled() && streamKafkaMonitorService != null) {
            return "kafka";
        }
        if (streamRealtimeProperties.isEnabled() && streamRealtimeRedisSinkService != null) {
            return hasRealtimeProjectionData() ? "local_projection" : "offline";
        }
        return "offline";
    }

    private boolean hasRealtimeProjectionData() {
        return StringUtils.hasText(getValue("stream:product:hot:lastUpdate"))
                || StringUtils.hasText(getValue("stream:recommendation:kpi:lastUpdate"));
    }

    private Map<String, Object> buildStep(String name, String summary, String target, String status) {
        Map<String, Object> step = new LinkedHashMap<>();
        step.put("name", name);
        step.put("summary", summary);
        step.put("target", target);
        step.put("status", status);
        return step;
    }

    private List<Map<String, Object>> loadSampleUsers(int limit) {
        if (streamRealtimeRedisSinkService == null) {
            return Collections.emptyList();
        }
        int safeLimit = Math.max(1, Math.min(limit, 12));
        List<Long> candidateIds = userBehaviorMapper.selectActiveUserIds(safeLimit * 3);
        if (candidateIds == null || candidateIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> dedupedIds = candidateIds.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (dedupedIds.isEmpty()) {
            return Collections.emptyList();
        }

        Map<Long, User> userMap = new HashMap<>();
        List<User> users = userMapper.selectBatchIds(dedupedIds);
        for (User user : users) {
            if (user != null && user.getId() != null) {
                userMap.put(user.getId(), user);
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Long userId : dedupedIds) {
            Map<String, Object> snapshot = streamRealtimeRedisSinkService.getUserRealtimeSnapshot(userId);
            if (snapshot == null || snapshot.isEmpty()) {
                continue;
            }

            List<Map<String, Object>> behaviorDistribution = normalizeBehaviorDistribution(snapshot.get("behaviorDistribution"));
            List<Map<String, Object>> categoryWeights = normalizeCategoryWeights(snapshot.get("categoryWeights"));
            List<String> tags = normalizeTags(snapshot.get("tags"));
            Object lastUpdate = snapshot.get("lastUpdate");
            boolean hasRealtimeProfile = !behaviorDistribution.isEmpty()
                    || !categoryWeights.isEmpty()
                    || !tags.isEmpty()
                    || (lastUpdate != null && StringUtils.hasText(String.valueOf(lastUpdate)));
            if (!hasRealtimeProfile) {
                continue;
            }
            long totalBehaviorCount = 0L;
            for (Map<String, Object> row : behaviorDistribution) {
                totalBehaviorCount += parseLong(row.get("count")) == null ? 0L : parseLong(row.get("count"));
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("user", buildUserInfo(userMap.get(userId), userId));
            item.put("behaviorDistribution", behaviorDistribution);
            item.put("categoryWeights", categoryWeights);
            item.put("tags", tags);
            item.put("lastUpdate", lastUpdate);
            item.put("behaviorEventCount", totalBehaviorCount);
            item.put("categoryCount", categoryWeights.size());
            item.put("topCategory", categoryWeights.isEmpty() ? null : categoryWeights.get(0).get("categoryName"));
            result.add(item);

            if (result.size() >= safeLimit) {
                break;
            }
        }
        return result;
    }

    private Map<String, Object> buildUserInfo(User user, Long userId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", userId);
        payload.put("username", user == null ? null : user.getUsername());
        payload.put("nickname", user == null ? null : user.getNickname());
        payload.put("avatar", user == null ? null : user.getAvatar());
        payload.put("role", user == null ? null : user.getRole());
        return payload;
    }

    private List<Map<String, Object>> normalizeBehaviorDistribution(Object raw) {
        if (!(raw instanceof Map<?, ?>)) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<?, ?> entry : ((Map<?, ?>) raw).entrySet()) {
            String behaviorType = entry.getKey() == null ? null : String.valueOf(entry.getKey()).trim();
            Long count = parseLong(entry.getValue());
            if (!StringUtils.hasText(behaviorType) || count == null || count <= 0) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("behaviorType", behaviorType);
            row.put("count", count);
            result.add(row);
        }
        result.sort((left, right) -> Long.compare(
                parseLong(right.get("count")) == null ? 0L : parseLong(right.get("count")),
                parseLong(left.get("count")) == null ? 0L : parseLong(left.get("count"))));
        return result;
    }

    private List<Map<String, Object>> normalizeCategoryWeights(Object raw) {
        if (!(raw instanceof Map<?, ?>)) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<?, ?> entry : ((Map<?, ?>) raw).entrySet()) {
            String categoryName = entry.getKey() == null ? null : String.valueOf(entry.getKey()).trim();
            Double weight = parseDouble(entry.getValue());
            if (!StringUtils.hasText(categoryName) || weight == null || weight <= 0D) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("categoryName", categoryName);
            row.put("weight", BigDecimal.valueOf(weight).setScale(2, BigDecimal.ROUND_HALF_UP));
            result.add(row);
        }
        result.sort((left, right) -> Double.compare(
                parseDouble(right.get("weight")) == null ? 0D : parseDouble(right.get("weight")),
                parseDouble(left.get("weight")) == null ? 0D : parseDouble(left.get("weight"))));
        return result;
    }

    private List<String> normalizeTags(Object raw) {
        if (raw == null) {
            return Collections.emptyList();
        }
        Set<String> values = new LinkedHashSet<>();
        if (raw instanceof Collection<?>) {
            for (Object item : (Collection<?>) raw) {
                String tag = item == null ? null : String.valueOf(item).trim();
                if (StringUtils.hasText(tag)) {
                    values.add(tag);
                }
            }
        } else {
            String tag = String.valueOf(raw).trim();
            if (StringUtils.hasText(tag)) {
                values.add(tag);
            }
        }
        return new ArrayList<>(values);
    }

    private Long parseLong(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number) {
            return ((Number) raw).longValue();
        }
        try {
            return (long) Double.parseDouble(String.valueOf(raw).trim());
        } catch (Exception ignore) {
            return null;
        }
    }

    private Double parseDouble(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number) {
            return ((Number) raw).doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(raw).trim());
        } catch (Exception ignore) {
            return null;
        }
    }

    private void addTopicIfPresent(List<String> topics, String topic) {
        if (topics == null || !StringUtils.hasText(topic)) {
            return;
        }
        String normalized = topic.trim();
        if (!normalized.isEmpty() && !topics.contains(normalized)) {
            topics.add(normalized);
        }
    }

    private Map<String, Object> loadRecommendationKpi(String statDate) {
        if (streamRealtimeRedisSinkService == null) {
            return Collections.emptyMap();
        }
        Map<String, Object> snapshot = streamRealtimeRedisSinkService.getRecommendationCoreMetrics(statDate);
        if (snapshot == null || snapshot.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Object> normalizedSnapshot = new LinkedHashMap<>(snapshot);
        mergeRecommendationKpiWithDb(normalizedSnapshot, statDate);

        Long exposureCount = firstNonNull(parseLong(normalizedSnapshot.get("exposureCount")), parseLong(normalizedSnapshot.get("exposures")));
        Long clickCount = firstNonNull(parseLong(normalizedSnapshot.get("clickCount")), parseLong(normalizedSnapshot.get("clicks")));
        Long orderCount = firstNonNull(parseLong(normalizedSnapshot.get("orderCount")), parseLong(normalizedSnapshot.get("orders")));
        Long refundCount = firstNonNull(parseLong(normalizedSnapshot.get("refundCount")), parseLong(normalizedSnapshot.get("refunds")));
        Double gmv = parseDouble(normalizedSnapshot.get("gmv"));

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("DAU", parseLong(normalizedSnapshot.get("dau")));
        metrics.put("CTR", firstNonNull(parseDouble(normalizedSnapshot.get("ctr")), percentage(clickCount, exposureCount)));
        metrics.put("CVR", firstNonNull(parseDouble(normalizedSnapshot.get("cvr")), percentage(orderCount, clickCount)));
        metrics.put("GMV", gmv);
        metrics.put("AOV", firstNonNull(parseDouble(normalizedSnapshot.get("avgOrderValue")), average(gmv, orderCount)));
        metrics.put("RepurchaseRate", parseDouble(normalizedSnapshot.get("repurchaseRate")));
        metrics.put("Retention7d", parseDouble(normalizedSnapshot.get("retention7d")));
        metrics.put("RefundRate", firstNonNull(parseDouble(normalizedSnapshot.get("refundRate")), percentage(refundCount, orderCount)));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("statDate", normalizedSnapshot.get("statDate"));
        payload.put("ts", normalizedSnapshot.get("ts"));
        payload.put("lastUpdate", normalizedSnapshot.get("lastUpdate"));
        payload.put("metrics", metrics);
        payload.put("counts", buildRecommendationCounts(exposureCount, clickCount, orderCount, refundCount));
        payload.put("raw", normalizedSnapshot);
        return payload;
    }

    private void mergeRecommendationKpiWithDb(Map<String, Object> snapshot, String requestedStatDate) {
        if (snapshot == null || snapshot.isEmpty() || jdbcTemplate == null) {
            return;
        }
        Object snapshotStatDate = snapshot.get("statDate");
        String resolvedStatDate = StringUtils.hasText(requestedStatDate)
                ? requestedStatDate.trim()
                : (snapshotStatDate == null ? null : String.valueOf(snapshotStatDate).trim());
        if (!StringUtils.hasText(resolvedStatDate)) {
            return;
        }

        Map<String, Object> dbAggregate = loadRecommendationKpiAggregateFromDb(resolvedStatDate);
        if (dbAggregate.isEmpty()) {
            return;
        }

        // In local projection mode, prefer DB aggregates for recommendation core counts and amounts,
        // because older Redis snapshots may only contain historical counts without amount backfill.
        mergeKpiField(snapshot, dbAggregate, "statDate", false);
        mergeKpiField(snapshot, dbAggregate, "dau", true);
        mergeKpiField(snapshot, dbAggregate, "exposureCount", true);
        mergeKpiField(snapshot, dbAggregate, "clickCount", true);
        mergeKpiField(snapshot, dbAggregate, "orderCount", true);
        mergeKpiField(snapshot, dbAggregate, "refundCount", true);
        mergeKpiField(snapshot, dbAggregate, "orderUserCount", true);
        mergeKpiField(snapshot, dbAggregate, "repurchaseUserCount", true);
        mergeKpiField(snapshot, dbAggregate, "gmv", true);
        mergeKpiField(snapshot, dbAggregate, "refundAmount", true);
        mergeKpiField(snapshot, dbAggregate, "avgOrderValue", true);
        mergeKpiField(snapshot, dbAggregate, "ctr", true);
        mergeKpiField(snapshot, dbAggregate, "cvr", true);
        mergeKpiField(snapshot, dbAggregate, "refundRate", true);
        mergeKpiField(snapshot, dbAggregate, "ts", false);
        mergeKpiField(snapshot, dbAggregate, "lastUpdate", false);
    }

    private Map<String, Object> loadRecommendationKpiAggregateFromDb(String statDate) {
        if (!StringUtils.hasText(statDate) || jdbcTemplate == null) {
            return Collections.emptyMap();
        }
        try {
            return jdbcTemplate.query(
                    "SELECT ? AS statDate, " +
                            "COALESCE(SUM(CASE WHEN event_type = 'exposure' THEN 1 ELSE 0 END), 0) AS exposureCount, " +
                            "COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS clickCount, " +
                            "COALESCE(SUM(CASE WHEN event_type = 'order' THEN 1 ELSE 0 END), 0) AS orderCount, " +
                            "COALESCE(SUM(CASE WHEN event_type = 'refund' THEN 1 ELSE 0 END), 0) AS refundCount, " +
                            "COALESCE(COUNT(DISTINCT user_id), 0) AS dau, " +
                            "COALESCE(COUNT(DISTINCT CASE WHEN event_type = 'order' THEN user_id END), 0) AS orderUserCount, " +
                            "COALESCE(SUM(CASE WHEN event_type = 'order' THEN COALESCE(amount, 0) ELSE 0 END), 0) AS gmv, " +
                            "COALESCE(SUM(CASE WHEN event_type = 'refund' THEN COALESCE(amount, 0) ELSE 0 END), 0) AS refundAmount, " +
                            "DATE_FORMAT(MAX(COALESCE(event_time, create_time)), '%Y-%m-%d %H:%i:%s') AS lastUpdate " +
                            "FROM recommendation_event " +
                            "WHERE DATE(COALESCE(event_time, create_time)) = ?",
                    rs -> {
                        if (!rs.next()) {
                            return Collections.<String, Object>emptyMap();
                        }
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("statDate", rs.getString("statDate"));
                        row.put("dau", rs.getLong("dau"));
                        row.put("exposureCount", rs.getLong("exposureCount"));
                        row.put("clickCount", rs.getLong("clickCount"));
                        row.put("orderCount", rs.getLong("orderCount"));
                        row.put("refundCount", rs.getLong("refundCount"));
                        row.put("orderUserCount", rs.getLong("orderUserCount"));
                        row.put("gmv", rs.getDouble("gmv"));
                        row.put("refundAmount", rs.getDouble("refundAmount"));
                        String lastUpdate = rs.getString("lastUpdate");
                        row.put("ts", lastUpdate);
                        row.put("lastUpdate", lastUpdate);

                        Long exposureCount = rs.getLong("exposureCount");
                        Long clickCount = rs.getLong("clickCount");
                        Long orderCount = rs.getLong("orderCount");
                        Long refundCount = rs.getLong("refundCount");
                        Double gmv = rs.getDouble("gmv");

                        row.put("ctr", percentage(clickCount, exposureCount));
                        row.put("cvr", percentage(orderCount, clickCount));
                        row.put("avgOrderValue", average(gmv, orderCount));
                        row.put("refundRate", percentage(refundCount, orderCount));
                        return row;
                    },
                    statDate, statDate);
        } catch (Exception ignore) {
            return Collections.emptyMap();
        }
    }

    private void mergeKpiField(Map<String, Object> target,
                               Map<String, Object> source,
                               String field,
                               boolean preferSource) {
        if (target == null || source == null || !StringUtils.hasText(field) || !source.containsKey(field)) {
            return;
        }
        Object sourceValue = source.get(field);
        if (preferSource || target.get(field) == null) {
            target.put(field, sourceValue);
        }
    }

    private Map<String, Object> buildRecommendationCounts(Long exposureCount,
                                                          Long clickCount,
                                                          Long orderCount,
                                                          Long refundCount) {
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("exposureCount", exposureCount);
        counts.put("clickCount", clickCount);
        counts.put("orderCount", orderCount);
        counts.put("refundCount", refundCount);
        return counts;
    }

    private Double percentage(Long numerator, Long denominator) {
        if (numerator == null || denominator == null || denominator <= 0L) {
            return null;
        }
        return round2((numerator * 100D) / denominator);
    }

    private Double average(Double total, Long count) {
        if (total == null || count == null || count <= 0L) {
            return null;
        }
        return round2(total / count);
    }

    private Double round2(Double value) {
        if (value == null) {
            return null;
        }
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        if (values == null || values.length == 0) {
            return null;
        }
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
