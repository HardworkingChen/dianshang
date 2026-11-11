package com.ecommerce.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ecommerce.common.Constants;
import com.ecommerce.entity.ImConversation;
import com.ecommerce.entity.Order;
import com.ecommerce.entity.OrderItem;
import com.ecommerce.entity.Product;
import com.ecommerce.entity.RefundRequest;
import com.ecommerce.mapper.OrderItemMapper;
import com.ecommerce.mapper.OrderMapper;
import com.ecommerce.mapper.ProductMapper;
import com.ecommerce.mapper.RefundMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CustomerSupportAgentService {

    private static final Pattern ORDER_NO_PATTERN = Pattern.compile("ORD\\d{8,}", Pattern.CASE_INSENSITIVE);

    private final OrderMapper orderMapper;
    private final RefundMapper refundMapper;
    private final OrderItemMapper orderItemMapper;
    private final ProductMapper productMapper;

    public CustomerSupportAgentService(OrderMapper orderMapper,
                                       RefundMapper refundMapper,
                                       OrderItemMapper orderItemMapper,
                                       ProductMapper productMapper) {
        this.orderMapper = orderMapper;
        this.refundMapper = refundMapper;
        this.orderItemMapper = orderItemMapper;
        this.productMapper = productMapper;
    }

    /** Runs bounded, read-only support tools against the order already bound to the conversation. */
    public Map<String, Object> executeReadOnlyTools(Long userId, ImConversation conversation, String message) {
        return executeReadOnlyTools(userId, conversation, message, null);
    }

    /** Executes only a whitelisted read-only capability selected by the Python planner. */
    public Map<String, Object> executeReadOnlyTools(Long userId, ImConversation conversation, String message,
                                                    String plannedTool) {
        try {
            return executeReadOnlyToolsInternal(userId, conversation, message, plannedTool);
        } catch (QueryTimeoutException ex) {
            return toolFailure(plannedTool, "timeout", "订单查询暂时超时，请稍后重试或转人工客服。 ");
        } catch (DataAccessException ex) {
            return toolFailure(plannedTool, "backend_unavailable", "订单查询服务暂时不可用，请稍后重试或转人工客服。 ");
        }
    }

    private Map<String, Object> executeReadOnlyToolsInternal(Long userId, ImConversation conversation, String message,
                                                             String plannedTool) {
        String intent = intentForPlannedTool(plannedTool);
        if (intent == null) intent = detectIntent(message);
        if (intent == null && conversation != null && conversation.getProductId() != null
                && containsAny(message == null ? "" : message, "价格", "多少钱", "库存", "有货", "商品", "规格", "参数", "介绍")) {
            intent = "product_info";
        }
        if (intent == null) {
            return Collections.emptyMap();
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("intent", intent);
        if ("product_info".equals(intent)) {
            addProductInfo(result, conversation);
            return result;
        }
        String requestedOrderNo = extractOrderNo(message);
        if ("order_lookup".equals(intent)) {
            if (requestedOrderNo == null) {
                addRecentOrders(result, userId);
            } else {
                bindOrderByNumber(result, userId, requestedOrderNo);
            }
            return result;
        }

        Order order = requestedOrderNo != null
                ? findOwnedOrderByNumber(userId, requestedOrderNo)
                : (conversation == null || conversation.getOrderId() == null
                    ? null : orderMapper.selectById(conversation.getOrderId()));
        if (requestedOrderNo != null && order != null) {
            result.put("selectedOrderId", order.getId());
        }
        if (order == null) {
            if (requestedOrderNo != null) {
                result.put("toolStatus", "order_not_found");
                result.put("facts", "用户提供的订单号没有匹配到该用户的订单。");
                result.put("customerReply", "没有查到这个订单号对应的本人订单，请核对订单号后再试。 ");
            } else {
                addRecentOrders(result, userId);
            }
            return result;
        }
        if (order == null || !Objects.equals(order.getUserId(), userId)) {
            result.put("toolStatus", "order_unavailable");
            result.put("facts", "关联订单不存在或不属于当前用户；未向模型提供订单数据。 ");
            result.put("customerReply", "暂时无法核对这笔订单，请确认从本人订单详情页进入客服。 ");
            return result;
        }

        result.put("orderNo", order.getOrderNo());
        result.put("orderStatus", orderStatusLabel(order.getStatus()));
        result.put("orderItems", orderItemSummary(order.getId()));
        if ("refund_status".equals(intent)) {
            addRefundStatus(result, userId, order);
        } else if ("refund_precheck".equals(intent)) {
            addRefundPrecheck(result, userId, order, message);
        } else if ("order_cancel".equals(intent)) {
            addCancelPrecheck(result, order, message);
        } else {
            result.put("toolStatus", "completed");
            result.put("facts", "订单 " + safeOrderNo(order) + " 当前状态为：" + orderStatusLabel(order.getStatus()) + "。系统未提供物流轨迹数据，不得推断快递节点或预计送达时间。 ");
            result.put("customerReply", "我查到订单 " + safeOrderNo(order) + " 当前状态是“" + orderStatusLabel(order.getStatus()) + "”。这边没有可用的物流轨迹，无法确认具体配送进度。 ");
        }
        return result;
    }

    private Map<String, Object> toolFailure(String plannedTool, String status, String customerReply) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("intent", intentForPlannedTool(plannedTool));
        result.put("toolStatus", status);
        result.put("facts", "业务查询未能完成；没有可向模型提供的订单或商品事实。 ");
        result.put("customerReply", customerReply);
        return result;
    }

    private String intentForPlannedTool(String toolName) {
        if (toolName == null) return null;
        switch (toolName) {
            case "order_lookup": return "order_lookup";
            case "order_status": return "order_status";
            case "refund_status": return "refund_status";
            case "refund_precheck": return "refund_precheck";
            case "cancel_precheck": return "order_cancel";
            case "product_info": return "product_info";
            default: return null;
        }
    }

    private String detectIntent(String message) {
        if (message == null) {
            return null;
        }
        String text = message.toLowerCase();
        if (containsAny(text, "我的订单", "最近订单", "订单列表", "查看订单", "查一下订单", "订单有哪些")) {
            return "order_lookup";
        }
        if (containsAny(text, "取消订单", "订单取消", "不想要了", "帮我取消", "撤销订单", "想取消订单")) {
            return "order_cancel";
        }
        if (containsAny(text, "退款进度", "退款状态", "售后进度", "退款到账", "退款到帐", "退到哪")) {
            return "refund_status";
        }
        if (containsAny(text, "退款", "退货", "售后", "申请退", "能退吗", "可以退吗", "想退")) {
            return "refund_precheck";
        }
        if (containsAny(text, "订单", "物流", "快递", "发货", "到货", "配送")) {
            return "order_status";
        }
        if (extractOrderNo(message) != null) {
            return "order_lookup";
        }
        return null;
    }

    private void addRecentOrders(Map<String, Object> result, Long userId) {
        List<Order> orders = orderMapper.selectList(new LambdaQueryWrapper<Order>()
                .eq(Order::getUserId, userId)
                .orderByDesc(Order::getId)
                .last("limit 5"));
        result.put("toolStatus", "completed");
        if (orders == null || orders.isEmpty()) {
            result.put("facts", "当前用户没有可供客服查询的订单记录。");
            result.put("customerReply", "我没有查到你的订单记录。你可以在商品或订单页面重新打开客服咨询。 ");
            return;
        }
        List<String> summaries = new java.util.ArrayList<>();
        for (Order order : orders) {
            summaries.add(safeOrderNo(order) + "（" + orderStatusLabel(order.getStatus()) + "，¥" + order.getTotalAmount() + "）");
        }
        result.put("recentOrders", summaries);
        result.put("facts", "最近本人订单：" + String.join("；", summaries));
        result.put("customerReply", "我查到你最近的订单：" + String.join("；", summaries)
                + "。请把要处理的订单号发给我，我会先核验并关联到当前会话。");
    }

    private void bindOrderByNumber(Map<String, Object> result, Long userId, String orderNo) {
        Order order = findOwnedOrderByNumber(userId, orderNo);
        result.put("toolStatus", order == null ? "order_not_found" : "completed");
        if (order == null) {
            result.put("facts", "用户提供的订单号没有匹配到该用户的订单。");
            result.put("customerReply", "没有查到这个订单号对应的本人订单，请核对订单号后再试。 ");
            return;
        }
        result.put("selectedOrderId", order.getId());
        result.put("orderNo", order.getOrderNo());
        result.put("orderStatus", orderStatusLabel(order.getStatus()));
        result.put("facts", "已核验并关联本人订单 " + safeOrderNo(order) + "，当前状态为“" + orderStatusLabel(order.getStatus()) + "”。" );
        result.put("customerReply", "已核验订单 " + safeOrderNo(order) + "，当前状态是“" + orderStatusLabel(order.getStatus()) + "”。现在可以继续查询进度或咨询售后。");
    }

    private Order findOwnedOrderByNumber(Long userId, String orderNo) {
        return orderMapper.selectOne(new LambdaQueryWrapper<Order>()
                .eq(Order::getUserId, userId)
                .eq(Order::getOrderNo, orderNo)
                .last("limit 1"));
    }

    private String extractOrderNo(String message) {
        if (message == null) return null;
        Matcher matcher = ORDER_NO_PATTERN.matcher(message);
        return matcher.find() ? matcher.group().toUpperCase() : null;
    }

    private List<String> orderItemSummary(Long orderId) {
        List<OrderItem> items = orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>()
                .eq(OrderItem::getOrderId, orderId)
                .orderByAsc(OrderItem::getId));
        List<String> summaries = new java.util.ArrayList<>();
        if (items == null) return summaries;
        for (OrderItem item : items) {
            if (summaries.size() >= 5) break;
            String name = item.getProductName() == null ? "商品" : item.getProductName();
            summaries.add(name + " × " + item.getQuantity());
        }
        return summaries;
    }

    private void addProductInfo(Map<String, Object> result, ImConversation conversation) {
        Product product = conversation == null || conversation.getProductId() == null
                ? null : productMapper.selectById(conversation.getProductId());
        if (product == null || !Integer.valueOf(Constants.ProductStatus.ON_SHELF).equals(product.getStatus())) {
            result.put("toolStatus", "product_unavailable");
            result.put("customerReply", "当前会话关联的商品暂不可查询，请从商品详情页重新联系商家客服。 ");
            return;
        }
        result.put("toolStatus", "completed");
        result.put("productName", product.getName());
        result.put("productPrice", product.getPrice());
        result.put("productStock", product.getStock());
        result.put("productDescription", product.getDescription());
        result.put("facts", "关联商品“" + product.getName() + "”：当前售价 " + product.getPrice()
                + "，库存 " + product.getStock() + "。商品描述仅作补充信息，不代表平台承诺。");
        result.put("customerReply", "我查到关联商品“" + product.getName() + "”当前售价 " + product.getPrice()
                + "，库存 " + product.getStock() + "。具体规格以商品详情页展示为准。");
    }

    private void addCancelPrecheck(Map<String, Object> result, Order order, String message) {
        boolean cancellable = order.getStatus() != null
                && (order.getStatus() == Constants.OrderStatus.PENDING || order.getStatus() == Constants.OrderStatus.PAID);
        if (!cancellable) {
            result.put("toolStatus", "completed");
            result.put("cancelPrecheck", "not_passed");
            result.put("facts", "当前订单状态为“" + orderStatusLabel(order.getStatus()) + "”，不支持取消。");
            result.put("customerReply", "当前订单状态为“" + orderStatusLabel(order.getStatus()) + "”，暂不支持直接取消。你可以转人工客服进一步处理。");
            return;
        }
        result.put("toolStatus", "completed");
        result.put("cancelPrecheck", "passed");
        result.put("facts", "订单状态允许进入取消流程；最终取消仍需确认并由订单服务再次校验。");
        if (isExplicitOrderCancellation(message)) {
            Map<String, Object> action = new LinkedHashMap<>();
            action.put("id", UUID.randomUUID().toString());
            action.put("type", "order_cancel");
            action.put("orderId", order.getId());
            action.put("orderNo", safeOrderNo(order));
            action.put("description", message.trim().substring(0, Math.min(message.trim().length(), 500)));
            action.put("status", "pending");
            action.put("expiresAt", System.currentTimeMillis() + 5 * 60 * 1000L);
            result.put("pendingAction", action);
            result.put("customerReply", "订单状态允许进入取消流程。确认后订单将取消，已支付金额会按系统订单流程退回账户；请核对订单并在 5 分钟内确认。");
        } else {
            result.put("customerReply", "订单当前可以取消。如需继续，请明确回复“帮我取消订单”，我会先展示确认信息，不会直接修改订单。");
        }
    }

    private boolean isExplicitOrderCancellation(String message) {
        return containsAny(message == null ? "" : message, "取消订单", "订单取消", "不想要了", "帮我取消", "撤销订单", "想取消订单");
    }

    private void addRefundStatus(Map<String, Object> result, Long userId, Order order) {
        List<RefundRequest> history = refundMapper.selectList(new LambdaQueryWrapper<RefundRequest>()
                .eq(RefundRequest::getOrderId, order.getId())
                .eq(RefundRequest::getUserId, userId)
                .orderByDesc(RefundRequest::getId)
                .last("limit 5"));
        if (history == null || history.isEmpty()) {
            result.put("toolStatus", "completed");
            result.put("refundStatus", "none");
            result.put("facts", "订单 " + safeOrderNo(order) + " 当前没有退款申请记录。 ");
            result.put("customerReply", "我查到订单 " + safeOrderNo(order) + " 目前没有退款申请记录。 ");
            return;
        }
        RefundRequest latest = history.get(0);
        String label = refundStatusLabel(latest.getStatus());
        List<String> timeline = new java.util.ArrayList<>();
        for (RefundRequest item : history) {
            String step = "申请 #" + item.getId() + "：" + refundStatusLabel(item.getStatus());
            if (item.getCreateTime() != null) step += "（" + item.getCreateTime() + "）";
            if (Integer.valueOf(Constants.RefundStatus.REJECTED).equals(item.getStatus())
                    && item.getRejectReason() != null && !item.getRejectReason().trim().isEmpty()) {
                step += "，原因：" + item.getRejectReason().trim();
            }
            timeline.add(step);
        }
        result.put("toolStatus", "completed");
        result.put("refundStatus", label);
        result.put("refundHistory", timeline);
        result.put("facts", "订单 " + safeOrderNo(order) + " 售后记录（新到旧）：" + String.join("；", timeline));
        result.put("customerReply", "订单 " + safeOrderNo(order) + " 最近一笔售后状态是“" + label + "”。记录：" + String.join("；", timeline));
    }

    private void addRefundPrecheck(Map<String, Object> result, Long userId, Order order, String message) {
        boolean orderStatusAllowsRefund = order.getStatus() != null
                && (order.getStatus() == Constants.OrderStatus.PAID
                || order.getStatus() == Constants.OrderStatus.SHIPPED
                || order.getStatus() == Constants.OrderStatus.COMPLETED);
        if (!orderStatusAllowsRefund) {
            refundPrecheckResult(result, false, "当前订单状态不支持提交退款申请；订单状态为“" + orderStatusLabel(order.getStatus()) + "”。");
            return;
        }

        Long activeCount = refundMapper.selectCount(new LambdaQueryWrapper<RefundRequest>()
                .eq(RefundRequest::getOrderId, order.getId())
                .eq(RefundRequest::getUserId, userId)
                .in(RefundRequest::getStatus, Arrays.asList(
                        Constants.RefundStatus.PENDING,
                        Constants.RefundStatus.APPROVED,
                        Constants.RefundStatus.REFUNDED)));
        if (activeCount != null && activeCount > 0) {
            refundPrecheckResult(result, false, "该订单已有退款申请处于处理中或已退款状态。");
            return;
        }

        List<OrderItem> items = orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>()
                .eq(OrderItem::getOrderId, order.getId()));
        if (items == null || items.isEmpty()) {
            refundPrecheckResult(result, false, "订单商品数据不完整，暂不能判断退款申请条件。");
            return;
        }
        Long merchantId = null;
        for (OrderItem item : items) {
            Product product = item == null || item.getProductId() == null ? null : productMapper.selectById(item.getProductId());
            if (product == null || product.getMerchantId() == null) {
                refundPrecheckResult(result, false, "订单商品归属数据不完整，暂不能判断退款申请条件。");
                return;
            }
            if (merchantId == null) {
                merchantId = product.getMerchantId();
            } else if (!Objects.equals(merchantId, product.getMerchantId())) {
                refundPrecheckResult(result, false, "该订单包含多个商家的商品，当前退款接口不支持整单在线退款。");
                return;
            }
        }
        String precheck = "订单状态及当前退款记录通过基础校验；这只是提交条件预检，不代表商家审核通过或退款已受理。";
        refundPrecheckResult(result, true, precheck);
        if (isExplicitRefundApplication(message)) {
            Map<String, Object> action = new LinkedHashMap<>();
            action.put("id", UUID.randomUUID().toString());
            action.put("type", "refund_apply");
            action.put("orderId", order.getId());
            action.put("orderNo", safeOrderNo(order));
            String description = extractRefundDescription(message);
            action.put("reason", description.isEmpty() ? "用户申请售后" : description.substring(0, Math.min(description.length(), 200)));
            action.put("description", description.substring(0, Math.min(description.length(), 500)));
            action.put("status", "pending");
            action.put("expiresAt", System.currentTimeMillis() + 5 * 60 * 1000L);
            result.put("pendingAction", action);
            result.put("customerReply", "订单已通过基础条件预检。确认后我会为你提交售后申请，提交后需等待商家审核。请核对下方申请内容并在 5 分钟内确认。");
        }
    }

    private boolean isExplicitRefundApplication(String message) {
        return containsAny(message == null ? "" : message,
                "我要退款", "申请退款", "帮我退款", "帮我申请退款", "发起退款", "我要退货", "申请退货", "申请退货退款", "确认申请售后");
    }

    private String extractRefundDescription(String message) {
        String description = message == null ? "" : message.trim();
        String[] prefixes = {"帮我申请退款", "申请退货退款", "申请退款", "帮我退款", "我要退款", "我要退货", "申请退货", "发起退款"};
        for (String prefix : prefixes) {
            if (description.startsWith(prefix)) {
                description = description.substring(prefix.length()).trim();
                break;
            }
        }
        description = description.replaceFirst("^[，,。:：\\s]+", "").trim();
        if (description.length() > 200) description = description.substring(0, 200).trim();
        return description;
    }

    private void refundPrecheckResult(Map<String, Object> result, boolean eligible, String reason) {
        result.put("toolStatus", "completed");
        result.put("refundPrecheck", eligible ? "passed" : "not_passed");
        result.put("facts", reason);
        result.put("customerReply", eligible
                ? "这笔订单通过了退款申请的基础条件预检。预检不代表审核通过，你可以在订单页提交申请。"
                : reason + "如需进一步处理，可以转人工客服。 ");
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String safeOrderNo(Order order) {
        return order.getOrderNo() == null ? "当前订单" : order.getOrderNo();
    }

    private String orderStatusLabel(Integer status) {
        if (status == null) return "未知";
        switch (status) {
            case Constants.OrderStatus.PENDING: return "待支付";
            case Constants.OrderStatus.PAID: return "待发货";
            case Constants.OrderStatus.SHIPPED: return "已发货";
            case Constants.OrderStatus.COMPLETED: return "已完成";
            case Constants.OrderStatus.CANCELLED: return "已取消";
            case Constants.OrderStatus.REFUNDED: return "已退款";
            default: return "未知";
        }
    }

    private String refundStatusLabel(Integer status) {
        if (status == null) return "未知";
        switch (status) {
            case Constants.RefundStatus.PENDING: return "待审核";
            case Constants.RefundStatus.APPROVED: return "已同意，等待退款处理";
            case Constants.RefundStatus.REJECTED: return "已拒绝";
            case Constants.RefundStatus.REFUNDED: return "已退款";
            default: return "未知";
        }
    }
}
