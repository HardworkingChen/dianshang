package com.ecommerce.recommendation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ecommerce.common.Constants;
import com.ecommerce.entity.Product;
import com.ecommerce.entity.UserBehavior;
import com.ecommerce.entity.UserPreference;
import com.ecommerce.mapper.ProductMapper;
import com.ecommerce.mapper.UserBehaviorMapper;
import com.ecommerce.mapper.UserPreferenceMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ColdStartRecommendationService {

    private static final int BOOTSTRAP_VECTOR_THRESHOLD = 4;
    private static final int WARM_VECTOR_THRESHOLD = 12;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private UserBehaviorMapper userBehaviorMapper;

    @Autowired
    private UserPreferenceMapper userPreferenceMapper;

    @Autowired
    private CollaborativeFiltering collaborativeFiltering;

    public enum Strategy {
        HYBRID,
        COLLABORATIVE,
        CONTENT
    }

    public RecommendationStage resolveStage(Long userId) {
        UserState state = loadUserState(userId);
        if (state.interactedProducts >= WARM_VECTOR_THRESHOLD || state.preferenceWeights.size() >= 3 || state.tagCount >= 3) {
            return new RecommendationStage(
                    "preference_rich",
                    "偏好明确",
                    "已经沉淀出稳定的品类和标签偏好，可以展示更强的个性化策略。");
        }
        if (state.interactedProducts >= BOOTSTRAP_VECTOR_THRESHOLD
                || !state.preferenceWeights.isEmpty()
                || state.searchCategoryCount > 0
                || state.tagCount >= 2) {
            return new RecommendationStage(
                    "warming_up",
                    "正在升温",
                    "兴趣信号开始积累，适合继续用多路候选承接并放大偏好差异。");
        }
        return new RecommendationStage(
                "cold_start",
                "冷启动",
                "当前行为还很轻，优先用新客承接策略做分散、稳妥且更好看的首轮推荐。");
    }

    public boolean shouldUseBootstrapStrategy(Long userId) {
        if (userId == null || userId <= 0) {
            return false;
        }
        return loadUserState(userId).interactedProducts < BOOTSTRAP_VECTOR_THRESHOLD;
    }

    public List<Product> buildCandidates(Long userId, int limit, Strategy strategy, String seed) {
        int safeLimit = Math.max(1, limit);
        UserState state = loadUserState(userId);
        String safeSeed = StringUtils.hasText(seed) ? seed.trim() : "cold-start";
        CandidateBundle bundle;
        switch (strategy) {
            case COLLABORATIVE:
                bundle = buildCollaborativeBundle(state, safeLimit, safeSeed);
                break;
            case CONTENT:
                bundle = buildContentBundle(state, safeLimit, safeSeed);
                break;
            case HYBRID:
            default:
                bundle = buildHybridBundle(state, safeLimit, safeSeed);
                break;
        }
        applyPresentationMetadata(bundle.products, strategy, resolveStage(userId), bundle.scoreMap);
        return bundle.products;
    }

    public void applyPresentationMetadata(List<Product> products,
                                          Strategy strategy,
                                          RecommendationStage stage,
                                          Map<Long, Double> scoreMap) {
        if (products == null || products.isEmpty()) {
            return;
        }
        String reason = buildReason(strategy, stage);
        String reasonType = buildReasonType(strategy);
        String sourceType = buildSourceType(strategy);
        List<String> tags = buildReasonTags(strategy, stage);
        int size = products.size();
        for (int index = 0; index < size; index++) {
            Product product = products.get(index);
            if (product == null) {
                continue;
            }
            if (!StringUtils.hasText(product.getRecommendReason())) {
                product.setRecommendReason(reason);
            }
            product.setReasonType(reasonType);
            product.setSourceType(sourceType);
            product.setRecommendationSourceType(sourceType);
            product.setMatchedReasonTags(tags);
            product.setDataFreshness("近实时");
            double score = scoreMap == null
                    ? (double) (size - index) / Math.max(size, 1)
                    : scoreMap.getOrDefault(product.getId(), (double) (size - index) / Math.max(size, 1));
            product.setRecommendationScore(BigDecimal.valueOf(score).setScale(4, RoundingMode.HALF_UP));
        }
    }

    private CandidateBundle buildHybridBundle(UserState state, int limit, String seed) {
        int poolSize = Math.max(limit * 4, 48);
        CandidateBundle collaborative = buildCollaborativeBundle(state, poolSize, seed + ":cf");
        CandidateBundle content = buildContentBundle(state, poolSize, seed + ":cb");
        List<Product> hotPool = loadHotPool(Math.max(limit * 5, 60));

        LinkedHashMap<Long, Product> productMap = new LinkedHashMap<>();
        putAll(productMap, collaborative.products);
        putAll(productMap, content.products);
        putAll(productMap, hotPool);

        Map<Long, Double> finalScores = new HashMap<>();
        mergeRankScores(finalScores, collaborative.products, 0.38D);
        mergeRankScores(finalScores, content.products, 0.34D);
        mergeRankScores(finalScores, hotPool, 0.28D);
        for (Product product : productMap.values()) {
            if (product == null || product.getId() == null) {
                continue;
            }
            double preferenceBoost = state.preferenceWeights.getOrDefault(product.getCategoryId(), 0D) * 0.35D;
            double explorationBoost = stableUnit(seed + ":hybrid:" + product.getId()) * 0.12D;
            finalScores.merge(product.getId(), preferenceBoost + explorationBoost, Double::sum);
        }

        List<Product> ranked = productMap.values().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble((Product product) -> finalScores.getOrDefault(product.getId(), 0D)).reversed())
                .collect(Collectors.toList());
        Set<Long> hotIds = hotPool.stream()
                .map(Product::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<Product> diversified = diversifyProducts(ranked, limit, hotIds, Math.max(2, (int) Math.floor(limit * 0.6D)), 2);
        return new CandidateBundle(diversified, finalScores);
    }

    private CandidateBundle buildCollaborativeBundle(UserState state, int limit, String seed) {
        List<Product> activeProducts = loadActiveProducts(Math.max(limit * 3, 120), false);
        if (activeProducts.isEmpty()) {
            return new CandidateBundle(Collections.emptyList(), Collections.emptyMap());
        }
        Set<Long> hotIds = loadHotPool(Math.max(limit, 18)).stream()
                .map(Product::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<Long, Product> productMap = new LinkedHashMap<>();
        for (Product product : activeProducts) {
            if (product != null && product.getId() != null) {
                productMap.put(product.getId(), product);
            }
        }

        Map<Long, Double> behaviorScores = new HashMap<>();
        Map<Long, Set<Long>> userSetMap = new HashMap<>();
        List<UserBehavior> recentBehaviors = userBehaviorMapper.selectList(
                new LambdaQueryWrapper<UserBehavior>()
                        .select(UserBehavior::getUserId, UserBehavior::getProductId, UserBehavior::getBehaviorType, UserBehavior::getCreateTime)
                        .isNotNull(UserBehavior::getProductId)
                        .in(UserBehavior::getBehaviorType, Arrays.asList(
                                Constants.BehaviorType.VIEW,
                                Constants.BehaviorType.FAVORITE,
                                Constants.BehaviorType.CART,
                                Constants.BehaviorType.PURCHASE))
                        .orderByDesc(UserBehavior::getCreateTime)
                        .last("LIMIT 2400"));

        int index = 0;
        for (UserBehavior behavior : recentBehaviors) {
            if (behavior == null || behavior.getProductId() == null || !productMap.containsKey(behavior.getProductId())) {
                index++;
                continue;
            }
            double recency = Math.max(0.35D, 1.0D - (index / 2600.0D));
            double weight = behaviorWeight(behavior.getBehaviorType()) * recency;
            behaviorScores.merge(behavior.getProductId(), weight, Double::sum);
            if (behavior.getUserId() != null && behavior.getUserId() > 0) {
                userSetMap.computeIfAbsent(behavior.getProductId(), key -> new HashSet<>()).add(behavior.getUserId());
            }
            index++;
        }

        Map<Long, Double> scoreMap = new HashMap<>();
        for (Product product : activeProducts) {
            if (product == null || product.getId() == null) {
                continue;
            }
            double crowdScore = behaviorScores.getOrDefault(product.getId(), 0D);
            double distinctUserBoost = Math.log1p(userSetMap.getOrDefault(product.getId(), Collections.emptySet()).size()) * 2.1D;
            double quality = safeRating(product) * 0.8D + Math.log10(Math.max(1, safeInt(product.getSalesCount())) + 10.0D) * 0.45D;
            double preferenceBoost = state.preferenceWeights.getOrDefault(product.getCategoryId(), 0D) * 2.1D;
            double jitter = stableUnit(seed + ":cf:" + product.getId()) * 1.15D;
            double antiHot = hotIds.contains(product.getId()) ? -0.25D : 0.28D;
            scoreMap.put(product.getId(), crowdScore + distinctUserBoost + quality + preferenceBoost + jitter + antiHot);
        }

        List<Product> ranked = activeProducts.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble((Product product) -> scoreMap.getOrDefault(product.getId(), 0D)).reversed())
                .collect(Collectors.toList());
        List<Product> diversified = diversifyProducts(ranked, limit, hotIds, Math.max(1, (int) Math.floor(limit * 0.45D)), 2);
        return new CandidateBundle(diversified, scoreMap);
    }

    private CandidateBundle buildContentBundle(UserState state, int limit, String seed) {
        List<Product> qualityPool = loadActiveProducts(Math.max(limit * 3, 140), true);
        if (qualityPool.isEmpty()) {
            return new CandidateBundle(Collections.emptyList(), Collections.emptyMap());
        }
        List<Product> showcasePool = loadCategoryShowcaseProducts(Math.max(limit * 2, 36), seed);
        Set<Long> showcaseIds = showcasePool.stream()
                .map(Product::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> hotIds = loadHotPool(Math.max(limit, 18)).stream()
                .map(Product::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        LinkedHashMap<Long, Product> candidateMap = new LinkedHashMap<>();
        if (!state.preferenceWeights.isEmpty()) {
            for (Product product : qualityPool) {
                if (product != null && product.getId() != null && state.preferenceWeights.containsKey(product.getCategoryId())) {
                    candidateMap.putIfAbsent(product.getId(), product);
                }
            }
        }
        putAll(candidateMap, showcasePool);
        putAll(candidateMap, qualityPool);

        Map<Long, Double> scoreMap = new HashMap<>();
        for (Product product : candidateMap.values()) {
            if (product == null || product.getId() == null) {
                continue;
            }
            double preferenceBoost = state.preferenceWeights.getOrDefault(product.getCategoryId(), 0D) * 3.2D;
            double ratingScore = safeRating(product) * 1.45D;
            double salesScore = Math.log10(Math.max(1, safeInt(product.getSalesCount())) + 10.0D) * 0.42D;
            double showcaseBoost = showcaseIds.contains(product.getId()) ? 0.55D : 0D;
            double tagBoost = Math.min(0.55D, (product.getTags() == null ? 0 : product.getTags().size()) * 0.08D);
            double explorationBoost = stableUnit(seed + ":cb:" + product.getId()) * 0.95D;
            double hotPenalty = hotIds.contains(product.getId()) ? 0.22D : 0D;
            scoreMap.put(product.getId(), preferenceBoost + ratingScore + salesScore + showcaseBoost + tagBoost + explorationBoost - hotPenalty);
        }

        List<Product> ranked = candidateMap.values().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingDouble((Product product) -> scoreMap.getOrDefault(product.getId(), 0D)).reversed())
                .collect(Collectors.toList());
        List<Product> diversified = diversifyProducts(ranked, limit, hotIds, Math.max(1, (int) Math.floor(limit * 0.35D)), 2);
        return new CandidateBundle(diversified, scoreMap);
    }

    private UserState loadUserState(Long userId) {
        if (userId == null || userId <= 0) {
            return new UserState(0, Collections.emptyMap(), 0, 0);
        }
        int interactedProducts;
        try {
            Map<Long, Double> userVector = collaborativeFiltering.buildUserVector(userId);
            interactedProducts = userVector == null ? 0 : userVector.size();
        } catch (Exception exception) {
            interactedProducts = 0;
        }

        UserPreference pref = userPreferenceMapper.selectOne(
                new LambdaQueryWrapper<UserPreference>()
                        .eq(UserPreference::getUserId, userId)
                        .last("LIMIT 1"));
        Map<Long, Double> preferenceWeights = loadPreferenceWeights(pref, userId);
        int tagCount = countPositiveEntries(pref == null ? null : pref.getTagPreferences());
        int searchCategoryCount = loadSearchCategoryCount(userId);
        return new UserState(interactedProducts, preferenceWeights, tagCount, searchCategoryCount);
    }

    private Map<Long, Double> loadPreferenceWeights(UserPreference pref, Long userId) {
        LinkedHashMap<Long, Double> weights = new LinkedHashMap<>();
        if (pref != null && pref.getCategoryPreferences() != null) {
            for (Map.Entry<String, Integer> entry : pref.getCategoryPreferences().entrySet()) {
                Long categoryId = parseLong(entry.getKey());
                Integer value = entry.getValue();
                if (categoryId != null && value != null && value > 0) {
                    weights.merge(categoryId, value.doubleValue(), Double::sum);
                }
            }
        }
        try {
            List<Map<String, Object>> searchRows = userBehaviorMapper.selectUserSearchCategoryPreferences(userId, 6);
            if (searchRows != null) {
                for (Map<String, Object> row : searchRows) {
                    Long categoryId = parseLong(row.get("category_id"));
                    double weight = parseDouble(row.get("weight"));
                    if (categoryId != null && weight > 0D) {
                        weights.merge(categoryId, weight * 12D, Double::sum);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return normalizeWeights(weights);
    }

    private int loadSearchCategoryCount(Long userId) {
        try {
            List<Map<String, Object>> rows = userBehaviorMapper.selectUserSearchCategoryPreferences(userId, 4);
            return rows == null ? 0 : rows.size();
        } catch (Exception ignored) {
            return 0;
        }
    }

    private Map<Long, Double> normalizeWeights(Map<Long, Double> source) {
        if (source == null || source.isEmpty()) {
            return Collections.emptyMap();
        }
        double max = source.values().stream()
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .max()
                .orElse(0D);
        if (max <= 0D) {
            return Collections.emptyMap();
        }
        LinkedHashMap<Long, Double> normalized = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry.getKey() != null && entry.getValue() != null && entry.getValue() > 0D)
                .sorted((left, right) -> Double.compare(right.getValue(), left.getValue()))
                .forEach(entry -> normalized.put(entry.getKey(), entry.getValue() / max));
        return normalized;
    }

    private List<Product> loadCategoryShowcaseProducts(int limit, String seed) {
        List<Map<String, Object>> categoryRows = productMapper.selectAllCategoryIds();
        if (categoryRows == null || categoryRows.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> categoryIds = categoryRows.stream()
                .map(row -> parseLong(row.get("categoryId")))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (categoryIds.isEmpty()) {
            return Collections.emptyList();
        }
        int offset = Math.abs((seed == null ? "" : seed).hashCode());
        int startIndex = categoryIds.isEmpty() ? 0 : offset % categoryIds.size();
        LinkedHashMap<Long, Product> result = new LinkedHashMap<>();
        int visited = 0;
        while (visited < categoryIds.size() && result.size() < limit) {
            Long categoryId = categoryIds.get((startIndex + visited) % categoryIds.size());
            List<Product> categoryProducts = productMapper.selectRandomByCategory(categoryId, 2);
            for (Product product : categoryProducts) {
                if (product != null && product.getId() != null) {
                    result.putIfAbsent(product.getId(), product);
                    if (result.size() >= limit) {
                        break;
                    }
                }
            }
            visited++;
        }
        return new ArrayList<>(result.values());
    }

    private List<Product> loadActiveProducts(int limit, boolean qualityFirst) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<Product>()
                .eq(Product::getStatus, Constants.ProductStatus.ON_SHELF)
                .eq(Product::getDeleted, 0);
        if (qualityFirst) {
            wrapper.orderByDesc(Product::getRating)
                    .orderByDesc(Product::getSalesCount)
                    .orderByDesc(Product::getId);
        } else {
            wrapper.orderByDesc(Product::getSalesCount)
                    .orderByDesc(Product::getId);
        }
        wrapper.last("LIMIT " + Math.max(24, Math.min(limit, 240)));
        return productMapper.selectList(wrapper);
    }

    private List<Product> loadHotPool(int limit) {
        List<Product> hotProducts = productMapper.selectHotProducts(Math.max(12, Math.min(limit, 120)));
        return hotProducts == null ? Collections.emptyList() : hotProducts;
    }

    private void putAll(Map<Long, Product> target, Collection<Product> products) {
        if (target == null || products == null) {
            return;
        }
        for (Product product : products) {
            if (product != null && product.getId() != null) {
                target.putIfAbsent(product.getId(), product);
            }
        }
    }

    private void mergeRankScores(Map<Long, Double> scoreMap, List<Product> products, double weight) {
        if (scoreMap == null || products == null || products.isEmpty() || weight <= 0D) {
            return;
        }
        int size = products.size();
        for (int index = 0; index < size; index++) {
            Product product = products.get(index);
            if (product == null || product.getId() == null) {
                continue;
            }
            double rankScore = ((double) (size - index) / Math.max(size, 1)) * weight;
            scoreMap.merge(product.getId(), rankScore, Double::sum);
        }
    }

    private List<Product> diversifyProducts(List<Product> rankedProducts,
                                            int limit,
                                            Set<Long> hotIds,
                                            int hotOverlapLimit,
                                            int maxPerCategory) {
        if (rankedProducts == null || rankedProducts.isEmpty()) {
            return Collections.emptyList();
        }
        List<Product> result = new ArrayList<>();
        Set<Long> selected = new LinkedHashSet<>();
        Map<Long, Integer> categoryCounts = new HashMap<>();
        int hotOverlap = 0;
        int safeMaxPerCategory = Math.max(1, maxPerCategory);

        for (Product product : rankedProducts) {
            if (product == null || product.getId() == null || !selected.add(product.getId())) {
                continue;
            }
            Long categoryId = product.getCategoryId();
            int categoryCount = categoryCounts.getOrDefault(categoryId, 0);
            boolean isHot = hotIds != null && hotIds.contains(product.getId());
            if (categoryCount >= safeMaxPerCategory || (isHot && hotOverlap >= hotOverlapLimit)) {
                selected.remove(product.getId());
                continue;
            }
            result.add(product);
            categoryCounts.put(categoryId, categoryCount + 1);
            if (isHot) {
                hotOverlap++;
            }
            if (result.size() >= limit) {
                return result;
            }
        }

        for (Product product : rankedProducts) {
            if (product == null || product.getId() == null || !selected.add(product.getId())) {
                continue;
            }
            result.add(product);
            if (result.size() >= limit) {
                break;
            }
        }
        return result;
    }

    private String buildReason(Strategy strategy, RecommendationStage stage) {
        String stageLabel = stage == null ? "新客冷启动" : stage.getLabel();
        switch (strategy) {
            case COLLABORATIVE:
                return stageLabel + "：先参考近期多人浏览、收藏、加购和购买的群体行为，再拉开类目差异。";
            case CONTENT:
                return stageLabel + "：优先围绕已选兴趣、高评分商品和多品类内容建立第一版画像。";
            case HYBRID:
            default:
                return stageLabel + "：融合群体行为、内容偏好和热门趋势，先把首屏推荐做得更稳妥也更好看。";
        }
    }

    private String buildReasonType(Strategy strategy) {
        switch (strategy) {
            case COLLABORATIVE:
                return "COLD_START_COLLABORATIVE";
            case CONTENT:
                return "COLD_START_CONTENT";
            case HYBRID:
            default:
                return "COLD_START";
        }
    }

    private String buildSourceType(Strategy strategy) {
        switch (strategy) {
            case COLLABORATIVE:
                return "cold_start_collaborative";
            case CONTENT:
                return "cold_start_content";
            case HYBRID:
            default:
                return "cold_start_hybrid";
        }
    }

    private List<String> buildReasonTags(Strategy strategy, RecommendationStage stage) {
        List<String> tags = new ArrayList<>();
        tags.add(stage == null ? "冷启动" : stage.getLabel());
        switch (strategy) {
            case COLLABORATIVE:
                tags.add("群体行为");
                tags.add("类目分散");
                break;
            case CONTENT:
                tags.add("兴趣承接");
                tags.add("高评分内容");
                break;
            case HYBRID:
            default:
                tags.add("群体行为");
                tags.add("热门趋势");
                tags.add("内容承接");
                break;
        }
        return tags;
    }

    private double behaviorWeight(String behaviorType) {
        if (Constants.BehaviorType.PURCHASE.equals(behaviorType)) {
            return 8.0D;
        }
        if (Constants.BehaviorType.CART.equals(behaviorType)) {
            return 5.0D;
        }
        if (Constants.BehaviorType.FAVORITE.equals(behaviorType)) {
            return 4.0D;
        }
        return 1.4D;
    }

    private int countPositiveEntries(Map<String, Integer> source) {
        if (source == null || source.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (Integer value : source.values()) {
            if (value != null && value > 0) {
                count++;
            }
        }
        return count;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private double safeRating(Product product) {
        return product == null || product.getRating() == null ? 4.5D : product.getRating().doubleValue();
    }

    private double stableUnit(String seed) {
        int hash = seed == null ? 0 : seed.hashCode();
        long positive = Integer.toUnsignedLong(hash);
        return (positive % 10000L) / 10000.0D;
    }

    private Long parseLong(Object rawValue) {
        if (rawValue instanceof Number) {
            return ((Number) rawValue).longValue();
        }
        if (rawValue instanceof String && StringUtils.hasText((String) rawValue)) {
            try {
                return Long.parseLong(((String) rawValue).trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private double parseDouble(Object rawValue) {
        if (rawValue instanceof Number) {
            return ((Number) rawValue).doubleValue();
        }
        if (rawValue instanceof String && StringUtils.hasText((String) rawValue)) {
            try {
                return Double.parseDouble(((String) rawValue).trim());
            } catch (Exception ignored) {
                return 0D;
            }
        }
        return 0D;
    }

    public static class RecommendationStage {
        private final String code;
        private final String label;
        private final String summary;

        public RecommendationStage(String code, String label, String summary) {
            this.code = code;
            this.label = label;
            this.summary = summary;
        }

        public String getCode() {
            return code;
        }

        public String getLabel() {
            return label;
        }

        public String getSummary() {
            return summary;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("code", code);
            payload.put("label", label);
            payload.put("summary", summary);
            return payload;
        }
    }

    private static class UserState {
        private final int interactedProducts;
        private final Map<Long, Double> preferenceWeights;
        private final int tagCount;
        private final int searchCategoryCount;

        private UserState(int interactedProducts,
                          Map<Long, Double> preferenceWeights,
                          int tagCount,
                          int searchCategoryCount) {
            this.interactedProducts = interactedProducts;
            this.preferenceWeights = preferenceWeights == null ? Collections.emptyMap() : preferenceWeights;
            this.tagCount = tagCount;
            this.searchCategoryCount = searchCategoryCount;
        }
    }

    private static class CandidateBundle {
        private final List<Product> products;
        private final Map<Long, Double> scoreMap;

        private CandidateBundle(List<Product> products, Map<Long, Double> scoreMap) {
            this.products = products == null ? Collections.emptyList() : products;
            this.scoreMap = scoreMap == null ? Collections.emptyMap() : scoreMap;
        }
    }
}
