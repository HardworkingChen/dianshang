package com.ecommerce.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.ecommerce.common.BusinessException;
import com.ecommerce.common.Constants;
import com.ecommerce.entity.Order;
import com.ecommerce.entity.OrderItem;
import com.ecommerce.entity.Product;
import com.ecommerce.entity.RefundRequest;
import com.ecommerce.mapper.MessageMapper;
import com.ecommerce.mapper.OrderItemMapper;
import com.ecommerce.mapper.OrderMapper;
import com.ecommerce.mapper.RefundMapper;
import com.ecommerce.mq.MqEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefundApplicationServiceTest {

    @Mock private RefundMapper refundMapper;
    @Mock private OrderMapper orderMapper;
    @Mock private OrderItemMapper orderItemMapper;
    @Mock private ProductService productService;
    @Mock private MqEventPublisher mqEventPublisher;
    @Mock private ManagementWorkbenchRealtimeService realtimeService;
    @Mock private MessageMapper messageMapper;
    @Mock private ModuleSwitchService moduleSwitchService;

    private RefundApplicationService service;

    @BeforeEach
    void setUp() {
        service = new RefundApplicationService(refundMapper, orderMapper, orderItemMapper, productService,
                mqEventPublisher, realtimeService, messageMapper, moduleSwitchService);
    }

    @Test
    void appliesRefundThroughLockedOrderAndExistingBusinessRules() {
        Order order = new Order();
        order.setId(9L);
        order.setUserId(7L);
        order.setOrderNo("ORDER-9");
        order.setStatus(Constants.OrderStatus.PAID);
        order.setTotalAmount(new BigDecimal("88.00"));
        OrderItem item = new OrderItem();
        item.setProductId(3L);
        Product product = new Product();
        product.setMerchantId(5L);
        when(orderMapper.selectByIdForUpdate(9L)).thenReturn(order);
        when(refundMapper.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(orderItemMapper.selectList(any(Wrapper.class))).thenReturn(Collections.singletonList(item));
        when(productService.getById(3L)).thenReturn(product);
        when(mqEventPublisher.isEnabled()).thenReturn(false);
        when(moduleSwitchService.isEnabled("message")).thenReturn(false);

        RefundRequest request = new RefundRequest();
        request.setOrderId(9L);
        request.setReason("商品破损");
        request.setDescription("外包装破损");
        request.setUserId(999L);
        request.setAmount(new BigDecimal("1.00"));

        service.apply(7L, request);

        verify(orderMapper).selectByIdForUpdate(9L);
        verify(refundMapper).insert(request);
        assertEquals(7L, request.getUserId());
        assertEquals(new BigDecimal("88.00"), request.getAmount());
        assertEquals(Constants.RefundStatus.PENDING, request.getStatus());
        verify(realtimeService).notifyAdmins(any(), any());
        verify(realtimeService).notifyMerchant(org.mockito.ArgumentMatchers.eq(5L), any(), any());
    }

    @Test
    void rejectsAnOrderOwnedByAnotherUserBeforeCreatingRefund() {
        Order order = new Order();
        order.setId(9L);
        order.setUserId(8L);
        when(orderMapper.selectByIdForUpdate(9L)).thenReturn(order);
        RefundRequest request = new RefundRequest();
        request.setOrderId(9L);
        request.setReason("商品破损");

        assertThrows(BusinessException.class, () -> service.apply(7L, request));
        verify(refundMapper, never()).insert(any());
    }
}
