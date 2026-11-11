package com.ecommerce.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.ecommerce.common.Constants;
import com.ecommerce.entity.ImConversation;
import com.ecommerce.entity.Order;
import com.ecommerce.entity.OrderItem;
import com.ecommerce.entity.Product;
import com.ecommerce.mapper.OrderItemMapper;
import com.ecommerce.mapper.OrderMapper;
import com.ecommerce.mapper.ProductMapper;
import com.ecommerce.mapper.RefundMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.dao.QueryTimeoutException;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Arrays;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerSupportAgentServiceTest {

    @Mock private OrderMapper orderMapper;
    @Mock private RefundMapper refundMapper;
    @Mock private OrderItemMapper orderItemMapper;
    @Mock private ProductMapper productMapper;

    private CustomerSupportAgentService service;

    @BeforeEach
    void setUp() {
        service = new CustomerSupportAgentService(orderMapper, refundMapper, orderItemMapper, productMapper);
    }

    @Test
    void offersRecentOrderLookupWhenConversationHasNoBoundOrder() {
        ImConversation conversation = new ImConversation();

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "帮我查物流");

        assertEquals("completed", result.get("toolStatus"));
        assertTrue(String.valueOf(result.get("customerReply")).contains("没有查到你的订单"));
        verify(orderMapper, never()).selectById(any());
        verify(orderMapper).selectList(any(Wrapper.class));
    }

    @Test
    void refusesToExposeAnOrderOwnedByAnotherUser() {
        ImConversation conversation = conversation(42L);
        Order order = order(42L, 8L, Constants.OrderStatus.SHIPPED);
        when(orderMapper.selectById(42L)).thenReturn(order);

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "查下订单物流");

        assertEquals("order_unavailable", result.get("toolStatus"));
        assertTrue(String.valueOf(result.get("facts")).contains("未向模型提供订单数据"));
        verify(refundMapper, never()).selectOne(any(Wrapper.class));
    }

    @Test
    void refundPrecheckUsesExistingOrderAndMerchantConstraintsWithoutWriting() {
        ImConversation conversation = conversation(42L);
        Order order = order(42L, 7L, Constants.OrderStatus.COMPLETED);
        OrderItem item = new OrderItem();
        item.setProductId(5L);
        Product product = new Product();
        product.setMerchantId(3L);

        when(orderMapper.selectById(42L)).thenReturn(order);
        when(refundMapper.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(orderItemMapper.selectList(any(Wrapper.class))).thenReturn(Collections.singletonList(item));
        when(productMapper.selectById(5L)).thenReturn(product);

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "这单能不能退货退款");

        assertEquals("passed", result.get("refundPrecheck"));
        assertTrue(String.valueOf(result.get("customerReply")).contains("不代表审核通过"));
        verify(refundMapper, never()).insert(any());
        verify(orderMapper, never()).updateById(any());
    }

    @Test
    void explicitRefundRequestCreatesAConfirmationActionButDoesNotSubmitIt() {
        ImConversation conversation = conversation(42L);
        Order order = order(42L, 7L, Constants.OrderStatus.COMPLETED);
        OrderItem item = new OrderItem();
        item.setProductId(5L);
        Product product = new Product();
        product.setMerchantId(3L);

        when(orderMapper.selectById(42L)).thenReturn(order);
        when(refundMapper.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(orderItemMapper.selectList(any(Wrapper.class))).thenReturn(Collections.singletonList(item));
        when(productMapper.selectById(5L)).thenReturn(product);

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "我要退款，商品收到时有破损");

        Map<?, ?> action = (Map<?, ?>) result.get("pendingAction");
        assertEquals("refund_apply", action.get("type"));
        assertEquals("商品收到时有破损", action.get("description"));
        assertTrue(String.valueOf(result.get("customerReply")).contains("确认"));
        verify(refundMapper, never()).insert(any());
    }

    @Test
    void explicitCancellationCreatesConfirmationOnlyForCancelableOrder() {
        ImConversation conversation = conversation(42L);
        when(orderMapper.selectById(42L)).thenReturn(order(42L, 7L, Constants.OrderStatus.PAID));

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "帮我取消订单");

        assertEquals("order_cancel", ((Map<?, ?>) result.get("pendingAction")).get("type"));
        assertEquals("passed", result.get("cancelPrecheck"));
        verify(orderMapper, never()).updateById(any());
    }

    @Test
    void cancellationRequestForShippedOrderDoesNotCreateAction() {
        ImConversation conversation = conversation(42L);
        when(orderMapper.selectById(42L)).thenReturn(order(42L, 7L, Constants.OrderStatus.SHIPPED));

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "帮我取消订单");

        assertEquals("not_passed", result.get("cancelPrecheck"));
        assertTrue(!result.containsKey("pendingAction"));
    }

    @Test
    void plannedReadOnlyToolIsMappedToWhitelistedBusinessIntent() {
        ImConversation conversation = conversation(42L);
        when(orderMapper.selectById(42L)).thenReturn(order(42L, 7L, Constants.OrderStatus.SHIPPED));

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation,
                "查一下订单", "order_status");

        assertEquals("order_status", result.get("intent"));
        assertEquals("completed", result.get("toolStatus"));
    }

    @Test
    void classifiesDatabaseTimeoutAsARecoverableToolFailure() {
        ImConversation conversation = conversation(42L);
        when(orderMapper.selectById(42L)).thenThrow(new QueryTimeoutException("internal database detail"));

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation,
                "查一下订单", "order_status");

        assertEquals("timeout", result.get("toolStatus"));
        assertTrue(String.valueOf(result.get("customerReply")).contains("稍后重试"));
        assertTrue(!String.valueOf(result.get("customerReply")).contains("internal database detail"));
    }

    @Test
    void listsOnlyRecentOrdersWhenConversationDoesNotHaveAnOrderBound() {
        Order recent = order(42L, 7L, Constants.OrderStatus.PAID);
        recent.setOrderNo("ORD123456789012345678");
        recent.setTotalAmount(new java.math.BigDecimal("68.00"));
        when(orderMapper.selectList(any(Wrapper.class))).thenReturn(Collections.singletonList(recent));

        Map<String, Object> result = service.executeReadOnlyTools(7L, new ImConversation(), "查看我的订单");

        assertEquals("completed", result.get("toolStatus"));
        assertTrue(String.valueOf(result.get("customerReply")).contains("ORD123456789012345678"));
        verify(orderMapper, never()).selectById(any());
    }

    @Test
    void bindsExactOrderNumberOnlyWhenItBelongsToCurrentUser() {
        ImConversation conversation = new ImConversation();
        Order order = order(42L, 7L, Constants.OrderStatus.SHIPPED);
        order.setOrderNo("ORD123456789012345678");
        when(orderMapper.selectOne(any(Wrapper.class))).thenReturn(order);

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "ORD123456789012345678");

        assertEquals(42L, result.get("selectedOrderId"));
        assertEquals("已发货", result.get("orderStatus"));
    }

    @Test
    void neverFallsBackToBoundOrderWhenAnotherOrderNumberWasRequested() {
        ImConversation conversation = conversation(41L);
        when(orderMapper.selectOne(any(Wrapper.class))).thenReturn(null);

        Map<String, Object> result = service.executeReadOnlyTools(7L, conversation, "查订单 ORD999999999999999999");

        assertEquals("order_not_found", result.get("toolStatus"));
        verify(orderMapper, never()).selectById(41L);
    }

    private ImConversation conversation(Long orderId) {
        ImConversation conversation = new ImConversation();
        conversation.setOrderId(orderId);
        return conversation;
    }

    private Order order(Long id, Long userId, Integer status) {
        Order order = new Order();
        order.setId(id);
        order.setUserId(userId);
        order.setOrderNo("TEST-" + id);
        order.setStatus(status);
        return order;
    }
}
