package com.ecommerce.service;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.ecommerce.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class CustomerSupportAgentClient {

    @Value("${agent.service.url:http://localhost:8091}")
    private String serviceUrl;

    @Value("${agent.service.token:}")
    private String serviceToken;

    private final RestTemplate restTemplate = createRestTemplate();

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(45000);
        return new RestTemplate(factory);
    }

    public Map<String, Object> reply(Map<String, Object> conversationContext,
                                     List<Map<String, Object>> history,
                                     String userMessage) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("message", userMessage);
        request.put("business_context", conversationContext == null ? new LinkedHashMap<>() : conversationContext);
        request.put("history", normalizeHistory(history));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (serviceToken != null && !serviceToken.trim().isEmpty()) {
            headers.setBearerAuth(serviceToken.trim());
        }
        try {
            String url = serviceUrl.endsWith("/") ? serviceUrl + "v1/agent/chat" : serviceUrl + "/v1/agent/chat";
            String body = restTemplate.postForObject(url, new HttpEntity<>(JSON.toJSONString(request), headers), String.class);
            JSONObject response = JSON.parseObject(body);
            String answer = response == null ? null : response.getString("answer");
            if (answer == null || answer.trim().isEmpty()) {
                throw new BusinessException("Python Agent 服务返回为空");
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("answer", answer.trim());
            result.put("intent", response.getString("intent"));
            result.put("citations", response.get("citations"));
            result.put("trace", response.get("trace"));
            return result;
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("Python Agent 服务暂不可用");
        }
    }

    public Map<String, Object> plan(Map<String, Object> conversationContext, String userMessage) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("message", userMessage);
        request.put("business_context", conversationContext == null ? new LinkedHashMap<>() : conversationContext);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (serviceToken != null && !serviceToken.trim().isEmpty()) {
            headers.setBearerAuth(serviceToken.trim());
        }
        try {
            String url = serviceUrl.endsWith("/") ? serviceUrl + "v1/agent/plan" : serviceUrl + "/v1/agent/plan";
            String body = restTemplate.postForObject(url, new HttpEntity<>(JSON.toJSONString(request), headers), String.class);
            JSONObject response = JSON.parseObject(body);
            return response == null ? new LinkedHashMap<>() : new LinkedHashMap<>(response);
        } catch (Exception ex) {
            // The existing Java keyword router remains the availability fallback.
            return new LinkedHashMap<>();
        }
    }

    private List<Map<String, String>> normalizeHistory(List<Map<String, Object>> history) {
        List<Map<String, String>> normalized = new ArrayList<>();
        if (history == null) return normalized;
        int start = Math.max(0, history.size() - 12);
        for (int i = start; i < history.size(); i++) {
            Map<String, Object> item = history.get(i);
            if (item == null || item.get("content") == null) continue;
            Object rawRole = item.containsKey("role") ? item.get("role") : item.get("senderRole");
            String role = "assistant".equals(rawRole) || "ai".equals(rawRole) ? "assistant" : "user";
            String content = String.valueOf(item.get("content")).trim();
            if (content.isEmpty()) continue;
            Map<String, String> row = new LinkedHashMap<>();
            row.put("role", role);
            row.put("content", content.substring(0, Math.min(content.length(), 500)));
            normalized.add(row);
        }
        return normalized;
    }
}
