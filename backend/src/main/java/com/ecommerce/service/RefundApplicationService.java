package com.ecommerce.service;

import com.alibaba.fastjson2.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ecommerce.common.BusinessException;
import com.ecommerce.common.Constants;
import com.ecommerce.entity.Order;
import com.ecommerce.entity.OrderItem;
import com.ecommerce.entity.Message;
import com.ecommerce.entity.RefundRequest;
import com.ecommerce.mapper.MessageMapper;
import com.ecommerce.mapper.OrderItemMapper;
import com.ecommerce.mapper.OrderMapper;
import com.ecommerce.mapper.RefundMapper;
import com.ecommerce.mq.MqEventPublisher;
import com.ecommerce.mq.RabbitMqNames;
import com.ecommerce.service.ManagementWorkbenchRealtimeService;
import com.ecommerce.service.ModuleSwitchService;
import com.ecommerce.service.ProductService;
import com.ecommerce.utils.RefundViewUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class RefundApplicationService {

    private final RefundMapper refundMapper;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final ProductService productService;
    private final MqEventPublisher mqEventPublisher;
    private final ManagementWorkbenchRealtimeService managementWorkbenchRealtimeService;
    private final MessageMapper messageMapper;
    private final ModuleSwitchService moduleSwitchService;

    public RefundApplicationService(RefundMapper refundMapper,
                                    OrderMapper orderMapper,
                                    OrderItemMapper orderItemMapper,
                                    ProductService productService,
                                    MqEventPublisher mqEventPublisher,
                                    ManagementWorkbenchRealtimeService managementWorkbenchRealtimeService,
                                    MessageMapper messageMapper,
                                    ModuleSwitchService moduleSwitchService) {
        this.refundMapper = refundMapper;
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.productService = productService;
        this.mqEventPublisher = mqEventPublisher;
        this.managementWorkbenchRealtimeService = managementWorkbenchRealtimeService;
        this.messageMapper = messageMapper;
        this.moduleSwitchService = moduleSwitchService;
    }

    @Transactional(rollbackFor = Exception.class)
    public RefundRequest apply(Long userId, RefundRequest request) {
        if (request == null || request.getOrderId() == null) {
            throw new BusinessException("订单ID不能为空");
        }
        if (request.getReason() == null || request.getReason().trim().isEmpty()) {
            throw new BusinessException("退款原因不能为空");
        }

        Order order = orderMapper.selectByIdForUpdate(request.getOrderId());
        if (order == null || !Objects.equals(order.getUserId(), userId)) {
            throw new BusinessException("订单不存在");
        }
        if (order.getStatus() != Constants.OrderStatus.PAID
                && order.getStatus() != Constants.OrderStatus.SHIPPED
                && order.getStatus() != Constants.OrderStatus.COMPLETED) {
            throw new BusinessException("当前订单状态不支持退款");
        }
        Long merchantId = resolveSingleMerchantId(order.getId());

        long existCount = refundMapper.selectCount(
                new LambdaQueryWrapper<RefundRequest>()
                        .eq(RefundRequest::getOrderId, request.getOrderId())
                        .in(RefundRequest::getStatus,
                                Constants.RefundStatus.PENDING,
                                Constants.RefundStatus.APPROVED,
                                Constants.RefundStatus.REFUNDED));
        if (existCount > 0) {
            throw new BusinessException("该订单已有退款申请在处理中");
        }

        request.setUserId(userId);
        request.setAmount(order.getTotalAmount());
        request.setStatus(Constants.RefundStatus.PENDING);
        request.setId(null);
        refundMapper.insert(request);

        dispatchRefundMessage(userId, order, request);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("scope", "refund");
        payload.put("refundId", request.getId());
        payload.put("orderId", order.getId());
        payload.put("status", "pending");
        managementWorkbenchRealtimeService.notifyAdmins("refund-updated", payload);
        managementWorkbenchRealtimeService.notifyMerchant(merchantId, "refund-updated", payload);

        RefundViewUtil.enrichRefundView(request);
        return request;
    }

    private Long resolveSingleMerchantId(Long orderId) {
        List<OrderItem> items = orderItemMapper.selectList(
                new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, orderId));
        if (items == null || items.isEmpty()) {
            throw new BusinessException("订单不存在");
        }
        Long merchantId = null;
        for (OrderItem item : items) {
            if (item == null || item.getProductId() == null) {
                throw new BusinessException("订单商品数据异常，暂不支持退款");
            }
            com.ecommerce.entity.Product product = productService.getById(item.getProductId());
            if (product == null || product.getMerchantId() == null) {
                throw new BusinessException("订单商品数据异常，暂不支持退款");
            }
            if (merchantId == null) {
                merchantId = product.getMerchantId();
            } else if (!Objects.equals(merchantId, product.getMerchantId())) {
                throw new BusinessException("多商家合并订单暂不支持整单在线退款");
            }
        }
        return merchantId;
    }

    private void dispatchRefundMessage(Long userId, Order order, RefundRequest refund) {
        String title = "退款申请已提交";
        String content = "您的订单 " + order.getOrderNo() + " 退款申请已提交，请等待审核";
        if (mqEventPublisher.isEnabled()) {
            JSONObject payload = new JSONObject();
            payload.put("userId", userId);
            payload.put("title", title);
            payload.put("content", content);
            payload.put("messageType", "order");
            payload.put("relatedId", order.getId());
            payload.put("refundId", refund.getId());
            payload.put("orderId", order.getId());
            payload.put("orderNo", order.getOrderNo());
            payload.put("amount", refund.getAmount());
            mqEventPublisher.publishEvent(RabbitMqNames.ROUTING_REFUND_APPLIED,
                    String.valueOf(refund.getId()), payload);
            return;
        }
        if (!moduleSwitchService.isEnabled("message")) return;
        Message message = new Message();
        message.setUserId(userId);
        message.setTitle(title);
        message.setContent(content);
        message.setType("order");
        message.setRelatedId(order.getId());
        message.setIsRead(0);
        messageMapper.insert(message);
        managementWorkbenchRealtimeService.notifyUserMessageChanged(userId, "user-message-created");
    }
}
