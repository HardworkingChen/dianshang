package com.ecommerce.util;

import com.ecommerce.entity.Product;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

public final class ProductVisibilityUtil {

    private static final List<String> HIDDEN_MARKERS = List.of(
            "秒杀压测",
            "自动秒杀压测商品",
            "链路测试"
    );

    private ProductVisibilityUtil() {
    }

    public static boolean shouldHideFromRecommendation(Product product) {
        if (product == null) {
            return false;
        }
        if (containsMarker(product.getName()) || containsMarker(product.getCategoryName())) {
            return true;
        }
        List<String> tags = product.getTags();
        if (tags == null || tags.isEmpty()) {
            return false;
        }
        for (String tag : tags) {
            if (containsMarker(tag)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsMarker(String text) {
        if (!StringUtils.hasText(text)) {
            return false;
        }
        String normalized = text.trim().toLowerCase(Locale.ROOT);
        for (String marker : HIDDEN_MARKERS) {
            if (normalized.contains(marker.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }
}
